/**
 * pipeline/m4-feasibility/score-cells.ts — M4 feasibility scorer (spec §4-M4).
 *
 * Deterministic mechanics → probabilistic outputs: same inputs always yield
 * the same bands/buckets, but outputs are ProbabilityBand + TtwBucket —
 * NEVER point numbers and NEVER a raw months-to-close figure (G12).
 *
 * Guardrail ordering (core/CONTRACTS.md §5):
 *   1. G15 licensing — fires first; unlicensed state → INFEASIBLE, stop.
 *   2. G2 empirical proximity (LOCAL_PACK only) — winner-distance
 *      distribution from M1 facets; drive-time prior only when data is thin.
 *   3. G5 market existence — via the keyword map.
 *   4. G3 review realism — v0.1 static count-gap, always confidence LOW;
 *      suspected-spam incumbents are scored as removable obstacles (their
 *      counts excluded from the gap).
 * LSA-heavy cells get a discounted band; directory-stacked organic likewise.
 * INFEASIBLE / LONG_HORIZON verdicts carry humanReviewed: false (they must
 * pass human review before client delivery).
 */

import type {
  Cell,
  CellVerdict,
  ClientManifest,
  CompetitorFacet,
  CompetitorRegistry,
  Confidence,
  GuardrailResult,
  KeywordEntry,
  KeywordMap,
  ProbabilityBand,
  SerpSnapshot,
  Surface,
  Town,
  TtwBucket,
  Verdict,
} from "../../core/types.js";
import { g2ProximityCeiling, g3ReviewRealism, g5DemandGate } from "../../rules/guardrails.js";
import { checkCompliance } from "./compliance.js";

// ---------------------------------------------------------------------------
// Bands (fractions in [0,1]; label is the client-facing rendering — G12)
// ---------------------------------------------------------------------------

export const BAND_VERY_LOW: ProbabilityBand = { low: 0, high: 0.2, label: "0-20%" };
export const BAND_LOW: ProbabilityBand = { low: 0.2, high: 0.4, label: "20-40%" };
export const BAND_MEDIUM: ProbabilityBand = { low: 0.4, high: 0.6, label: "40-60%" };
export const BAND_HIGH: ProbabilityBand = { low: 0.6, high: 0.8, label: "60-80%" };

const BAND_ORDER: ProbabilityBand[] = [BAND_VERY_LOW, BAND_LOW, BAND_MEDIUM, BAND_HIGH];

/** One-notch band discount (LSA-heavy pack, directory-stacked organic). */
function discountBand(band: ProbabilityBand): ProbabilityBand {
  const i = BAND_ORDER.findIndex((b) => b.label === band.label);
  return BAND_ORDER[Math.max(0, i - 1)] ?? BAND_VERY_LOW;
}

/** Review gap at or below this ratio counts as "small" for TTW bucketing. */
export const TTW_SMALL_GAP_RATIO = 1.5;
/** Domain age (months) at/above which the faster TTW buckets are reachable. */
export const TTW_ESTABLISHED_DOMAIN_MONTHS = 12;

// ---------------------------------------------------------------------------
// scoreCells
// ---------------------------------------------------------------------------

/**
 * Evaluate every cell (manifest towns × keyword-map clusters that actually
 * have keywords) on both surfaces. Output is sorted (town, cluster, surface)
 * for determinism.
 */
export function scoreCells(
  manifest: ClientManifest,
  registry: CompetitorRegistry,
  keywordMap: KeywordMap
): CellVerdict[] {
  const towns = [...manifest.locations.service_area.towns].sort((a, b) =>
    a.slug.localeCompare(b.slug)
  );
  const clusters = keywordMap.clusters
    .filter((c) => c.keywords.length > 0)
    .map((c) => c.clusterId)
    .sort((a, b) => a.localeCompare(b));

  const verdicts: CellVerdict[] = [];
  for (const town of towns) {
    for (const clusterId of clusters) {
      const cell: Cell = { town: town.slug, cluster: clusterId };
      verdicts.push(scoreSurface(cell, town, "LOCAL_PACK", manifest, registry, keywordMap));
      verdicts.push(scoreSurface(cell, town, "ORGANIC", manifest, registry, keywordMap));
    }
  }
  return verdicts;
}

// ---------------------------------------------------------------------------
// per-surface scoring
// ---------------------------------------------------------------------------

function scoreSurface(
  cell: Cell,
  town: Town,
  surface: Surface,
  manifest: ClientManifest,
  registry: CompetitorRegistry,
  keywordMap: KeywordMap
): CellVerdict {
  // 1. G15 — compliance fires first; unlicensed state → INFEASIBLE, stop.
  const g15 = checkCompliance(town, manifest);
  if (!g15.ok) {
    return finalize({
      cell,
      surface,
      verdict: "INFEASIBLE",
      band: BAND_VERY_LOW,
      ttw: "unknown",
      confidence: "HIGH",
      firedRules: ["G15"],
      assumptions: [g15.reason, "G15 is absolute: compliance cells are never budgeted"],
    });
  }

  // Shared observations.
  const packFacets = facetsFor(registry, cell, "LOCAL_PACK").filter((f) => f.position <= 3);
  const snapshot = snapshotFor(registry, cell);
  const demand = demandFor(cell, keywordMap);

  if (surface === "LOCAL_PACK") {
    const clientCount = resolveClientReviewCount(manifest, registry);
    return scorePack(cell, town, manifest, clientCount, packFacets, snapshot, demand);
  }
  return scoreOrganic(cell, manifest, snapshot, demand);
}

function scorePack(
  cell: Cell,
  town: Town,
  manifest: ClientManifest,
  clientCount: number,
  packFacets: CompetitorFacet[],
  snapshot: SerpSnapshot | null,
  demand: DemandCheck
): CellVerdict {
  const assumptions: string[] = [];

  // 2. G2 — empirical proximity ceiling.
  const winnerDistances = packFacets
    .map((f) => f.distanceMiles)
    .filter((d): d is number => d !== null);
  const g2 = g2ProximityCeiling(cell, winnerDistances, town.drive_time_min);
  if (!g2.ok) {
    return finalize({
      cell,
      surface: "LOCAL_PACK",
      verdict: "ORGANIC_ONLY",
      band: BAND_VERY_LOW,
      ttw: "unknown",
      confidence: winnerDistances.length >= 3 ? "MEDIUM" : "LOW",
      firedRules: ["G2"],
      assumptions: [
        g2.reason,
        "Pack pursuit dropped on proximity physics; organic surface scored independently (G1)",
      ],
    });
  }
  assumptions.push(g2.reason);

  // 3. G5 — market existence via the keyword map.
  if (!demand.ok) {
    return finalize({
      cell,
      surface: "LOCAL_PACK",
      verdict: "LONG_HORIZON",
      band: BAND_LOW,
      ttw: "12mo+",
      confidence: "LOW",
      firedRules: ["G5"],
      assumptions: [...assumptions, demand.reason, "R3 remains the authoritative post-hoc demand test (G5)"],
    });
  }
  assumptions.push(demand.reason);

  // 4. G3 — v0.1 static count-gap, spam-flagged incumbents removed first.
  const spamFacets = packFacets.filter((f) => f.spamFlags.length > 0);
  const legitCounts = packFacets
    .filter((f) => f.spamFlags.length === 0)
    .map((f) => f.reviewCount)
    .filter((c): c is number => c !== null);
  if (spamFacets.length > 0) {
    assumptions.push(
      `${spamFacets.length} suspected-spam incumbent(s) scored as removable obstacles (SPAM_REPORT path), excluded from the G3 gap`
    );
  }
  const g3 = g3ReviewRealism(clientCount, legitCounts, /* ledgerMature */ false);
  assumptions.push(g3.reason);

  if (!g3.ok) {
    return finalize({
      cell,
      surface: "LOCAL_PACK",
      verdict: "LONG_HORIZON",
      band: BAND_LOW,
      ttw: "12mo+",
      confidence: "LOW", // mandatory for static count-gap scoring
      firedRules: ["G3"],
      assumptions,
    });
  }

  // WINNABLE_PACK — LSA-heavy cells get a discounted band (M1 furniture).
  let band = BAND_HIGH;
  if (snapshot?.furniture.lsaPresent) {
    band = discountBand(band);
    assumptions.push(
      `LSA present above the pack (ads ${snapshot.furniture.adsCount}) — pack-win value discounted one band (G12: honest value math)`
    );
  }
  const gapSmall =
    legitCounts.length === 0 ||
    medianOf(legitCounts) <= Math.max(clientCount, 1) * TTW_SMALL_GAP_RATIO;
  const ttw: TtwBucket =
    manifest.business.domain_age_months >= TTW_ESTABLISHED_DOMAIN_MONTHS && gapSmall
      ? "<6mo"
      : "6-12mo";
  assumptions.push("Conditional on owner throughput — pack levers are human labor budgeted under G11");

  return finalize({
    cell,
    surface: "LOCAL_PACK",
    verdict: "WINNABLE_PACK",
    band,
    ttw,
    confidence: "LOW", // pack scoring rests on static-count-gap G3 pre-ledger
    firedRules: [],
    assumptions,
  });
}

function scoreOrganic(
  cell: Cell,
  manifest: ClientManifest,
  snapshot: SerpSnapshot | null,
  demand: DemandCheck
): CellVerdict {
  const assumptions: string[] = [];

  // 3. G5 — market existence.
  if (!demand.ok) {
    return finalize({
      cell,
      surface: "ORGANIC",
      verdict: "LONG_HORIZON",
      band: BAND_LOW,
      ttw: "12mo+",
      confidence: "LOW",
      firedRules: ["G5"],
      assumptions: [demand.reason, "R3 remains the authoritative post-hoc demand test (G5)"],
    });
  }
  assumptions.push(demand.reason);

  let band = BAND_HIGH;
  if (snapshot?.furniture.directoryStacked) {
    band = discountBand(band);
    assumptions.push(
      "Organic top results directory-stacked — banded down one notch (directories are hard-to-displace incumbents)"
    );
  }
  const ttw: TtwBucket =
    manifest.business.domain_age_months >= TTW_ESTABLISHED_DOMAIN_MONTHS ? "6-12mo" : "12mo+";
  assumptions.push(
    "Conditional on G4 indexation latency for this domain age and on the G6 proof/DEGRADED gate at build time"
  );
  assumptions.push("Conditional on owner throughput (G11) for proof collection");

  return finalize({
    cell,
    surface: "ORGANIC",
    verdict: "WINNABLE_ORGANIC",
    band,
    ttw,
    confidence: "MEDIUM",
    firedRules: [],
    assumptions,
  });
}

// ---------------------------------------------------------------------------
// helpers (all pure)
// ---------------------------------------------------------------------------

function facetsFor(registry: CompetitorRegistry, cell: Cell, surface: Surface): CompetitorFacet[] {
  const out: CompetitorFacet[] = [];
  for (const b of registry.businesses) {
    for (const f of b.facets) {
      if (f.cell.town === cell.town && f.cell.cluster === cell.cluster && f.surface === surface) {
        out.push(f);
      }
    }
  }
  return out.sort((a, b) => a.position - b.position);
}

function snapshotFor(registry: CompetitorRegistry, cell: Cell): SerpSnapshot | null {
  return (
    registry.snapshots.find((s) => s.cell.town === cell.town && s.cell.cluster === cell.cluster) ??
    null
  );
}

interface DemandCheck {
  ok: boolean;
  reason: string;
}

/** G5 across the cell's keyword entries: any passing entry validates the cell. */
function demandFor(cell: Cell, keywordMap: KeywordMap): DemandCheck {
  const cluster = keywordMap.clusters.find((c) => c.clusterId === cell.cluster);
  const entries: KeywordEntry[] = (cluster?.keywords ?? []).filter((k) => k.town === cell.town);
  if (entries.length === 0) {
    return {
      ok: false,
      reason: `G5 fires: no keyword in the map targets ${cell.town}×${cell.cluster} — no demand evidence`,
    };
  }
  const results: GuardrailResult[] = entries.map((e) => g5DemandGate(e));
  const pass = results.find((r) => r.ok);
  if (pass) return { ok: true, reason: pass.reason };
  const first = results[0];
  return {
    ok: false,
    reason: first
      ? first.reason
      : `G5 fires: no demand evidence for ${cell.town}×${cell.cluster}`,
  };
}

/**
 * Resolve the client's observed review count from the registry (matched by
 * website URL or legal name); absent that, 0 — never an invented number (G12).
 */
export function resolveClientReviewCount(
  manifest: ClientManifest,
  registry: CompetitorRegistry
): number {
  const client = registry.businesses.find(
    (b) =>
      (b.websiteUrl !== null && b.websiteUrl === manifest.business.website_url) ||
      b.name === manifest.business.legal_name
  );
  if (!client) return 0;
  const counts = client.facets
    .map((f) => f.reviewCount)
    .filter((c): c is number => c !== null);
  return counts.length > 0 ? Math.max(...counts) : 0;
}

function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/**
 * Finalize a verdict: pessimistic verdicts (INFEASIBLE / LONG_HORIZON) get
 * humanReviewed: false — they must pass human review before client delivery
 * (G3 early math skews pessimistic). Every verdict carries ≥1 assumption and
 * ≥1 rule citation (in firedRules or assumption text).
 */
function finalize(v: {
  cell: Cell;
  surface: Surface;
  verdict: Verdict;
  band: ProbabilityBand;
  ttw: TtwBucket;
  confidence: Confidence;
  firedRules: CellVerdict["firedRules"];
  assumptions: string[];
}): CellVerdict {
  const pessimistic = v.verdict === "INFEASIBLE" || v.verdict === "LONG_HORIZON";
  const out: CellVerdict = {
    cell: v.cell,
    surface: v.surface,
    verdict: v.verdict,
    band: v.band,
    ttw: v.ttw,
    confidence: v.confidence,
    firedRules: v.firedRules,
    assumptions: v.assumptions,
  };
  if (pessimistic) out.humanReviewed = false;
  return out;
}
