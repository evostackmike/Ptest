/**
 * pipeline/m2-keywords/demand.ts — market-existence gate + keyword map
 * builder (spec §4-M2 "volume honesty", core/CONTRACTS.md §3).
 *
 * Town-level long-tail volume is fiction and population-scaled proxies are
 * invented numbers in costume. The gate for hyper-local cells is MARKET
 * EXISTENCE, read from M1's frozen registry snapshots:
 *   - a local pack renders for the cell's head query, and/or
 *   - incumbents maintain non-directory organic pages for it.
 *
 * `volume` comes ONLY from the injected fixture where a real vendor number
 * exists; `volume: null` is NEVER replaced by an invented number (G5/G12).
 * The authoritative post-hoc demand test is R3 (12+ weeks indexed with
 * near-zero impressions → demote/re-target) — owned by rules/, not M2.
 */

import type {
  Cell,
  ClientManifest,
  CompetitorRegistry,
  KeywordCluster,
  KeywordEntry,
  KeywordMap,
  SerpSnapshot,
} from "../../core/types.js";
import { g5DemandGate } from "../../rules/guardrails.js";
import { expandSeedCandidates } from "./seed-expand.js";
import { filterMegaDomains } from "./cluster-validate.js";

/**
 * Minimum non-mega-domain organic results for "incumbents maintain pages" to
 * hold: a directory-stacked SERP with one stray local result is not a market.
 */
export const MIN_INCUMBENT_ORGANIC = 3;

export interface MarketEvidence {
  exists: boolean;
  reason: string;
}

/**
 * Market-existence for one cell, from registry snapshots. v0.1 granularity is
 * per-cell (M1 captures one head-query SERP per cell); every modifier query
 * of the cell inherits the cell's evidence.
 */
// V05: per-query SERP snapshots (dedicated M2 pulls) refine this to
// per-query market evidence instead of per-cell inheritance.
export function marketExistsForCell(
  cell: Cell,
  snapshots: SerpSnapshot[]
): MarketEvidence {
  const cellSnaps = snapshots.filter(
    (s) => s.cell.town === cell.town && s.cell.cluster === cell.cluster
  );
  if (cellSnaps.length === 0) {
    return {
      exists: false,
      reason: `no SERP snapshot for ${cell.town}×${cell.cluster} — market unobserved`,
    };
  }
  if (cellSnaps.some((s) => s.packTop3.length > 0)) {
    return {
      exists: true,
      reason: `pack renders for ${cell.town}×${cell.cluster}`,
    };
  }
  if (
    cellSnaps.some(
      (s) => filterMegaDomains(s.organicTop10).length >= MIN_INCUMBENT_ORGANIC
    )
  ) {
    return {
      exists: true,
      reason: `incumbents maintain ≥${MIN_INCUMBENT_ORGANIC} non-directory organic pages for ${cell.town}×${cell.cluster}`,
    };
  }
  return {
    exists: false,
    reason: `no pack renders and organic is directory-stacked/thin for ${cell.town}×${cell.cluster}`,
  };
}

/**
 * Market-existence for a town-less (hub) query: the market exists when ANY
 * town cell of the cluster shows market evidence.
 */
export function marketExistsForCluster(
  clusterId: string,
  snapshots: SerpSnapshot[]
): MarketEvidence {
  const towns = [
    ...new Set(
      snapshots.filter((s) => s.cell.cluster === clusterId).map((s) => s.cell.town)
    ),
  ].sort();
  for (const town of towns) {
    const evidence = marketExistsForCell({ town, cluster: clusterId }, snapshots);
    if (evidence.exists) {
      return {
        exists: true,
        reason: `market exists for cluster "${clusterId}" in at least one town (${evidence.reason})`,
      };
    }
  }
  return {
    exists: false,
    reason: `no town cell of cluster "${clusterId}" shows market evidence`,
  };
}

/**
 * Contract surface (core/CONTRACTS.md §3).
 *
 * - Seeds from `expandSeedCandidates` (do_not_offer negatives land in
 *   `skipped` with reasons).
 * - Market-existence gate from `registry.snapshots`.
 * - `volume` only from the injected fixture where a real number exists —
 *   null is never replaced by an invented number.
 * - `canonicalUrl: null` everywhere (M5 assigns it).
 * - Queries failing G5 (no market evidence AND no qualifying real volume)
 *   are recorded in `skipped`, never silently dropped.
 */
export function buildKeywordMap(
  manifest: ClientManifest,
  registry: CompetitorRegistry,
  volumeFixture?: Record<string, number>
): KeywordMap {
  const { candidates, negatives } = expandSeedCandidates(manifest);
  const skipped: { query: string; reason: string }[] = negatives.map((n) => ({
    query: n.query,
    reason: n.reason,
  }));

  const entriesByCluster = new Map<string, KeywordEntry[]>();
  for (const candidate of candidates) {
    const evidence =
      candidate.town !== null
        ? marketExistsForCell(
            { town: candidate.town, cluster: candidate.clusterId },
            registry.snapshots
          )
        : marketExistsForCluster(candidate.clusterId, registry.snapshots);

    const fixtureValue =
      volumeFixture !== undefined && Object.hasOwn(volumeFixture, candidate.query)
        ? volumeFixture[candidate.query]
        : undefined;
    // Real vendor data only; anything else stays null — never invented.
    const volume =
      typeof fixtureValue === "number" && Number.isFinite(fixtureValue) && fixtureValue >= 0
        ? fixtureValue
        : null;

    const entry: KeywordEntry = {
      query: candidate.query,
      town: candidate.town,
      volume,
      marketExists: evidence.exists,
      canonicalUrl: null,
    };

    const gate = g5DemandGate(entry);
    if (!gate.ok) {
      skipped.push({ query: candidate.query, reason: `${gate.reason}; ${evidence.reason}` });
      continue;
    }

    const bucket = entriesByCluster.get(candidate.clusterId);
    if (bucket) bucket.push(entry);
    else entriesByCluster.set(candidate.clusterId, [entry]);
  }

  const clusters: KeywordCluster[] = manifest.services.clusters
    .map((c) => ({
      clusterId: c.cluster_id,
      keywords: entriesByCluster.get(c.cluster_id) ?? [],
    }))
    .filter((c) => c.keywords.length > 0);

  return { clusters, skipped };
}
