/**
 * pipeline/m2-keywords/cluster-validate.ts — the §18 SERP-overlap rule as
 * code (spec §4-M2, core/CONTRACTS.md §3).
 *
 * Given two queries' organic top-10 URL sets (mega-domains like
 * yelp/angi/homeadvisor EXCLUDED from counting):
 *   - overlap ≥ 60%  → the queries share one intent → MERGE their clusters;
 *   - overlap < 30%  → distinct intents → queries wrongly sharing a cluster
 *                      are SPLIT out;
 *   - 30–60%         → borderline → stays put.
 *
 * Snapshot lookup convention (documented in fixtures/README.md): a
 * cluster-validation snapshot for query `q` carries
 * `cell.cluster === slugifyQuery(q)` — SerpSnapshot has no query field, so
 * the query slug is encoded in the cell's cluster slot for these
 * M2-validation fixtures. Candidates without a snapshot are left untouched
 * (no evidence → no reassignment).
 *
 * Pure and deterministic: merge representatives and split ordering are
 * resolved lexicographically, never by input order or randomness.
 */

import type { SerpSnapshot } from "../../core/types.js";
import { slugify } from "./seed-expand.js";

/** ≥ this overlap between two queries' organic sets → same cluster (merge). */
export const CLUSTER_MERGE_OVERLAP = 0.6;

/** < this overlap between same-cluster queries → split them apart. */
export const CLUSTER_SPLIT_OVERLAP = 0.3;

/**
 * Mega-domains excluded from overlap counting: national directories rank for
 * EVERYTHING, so shared directory results say nothing about intent identity.
 */
export const MEGA_DOMAINS: readonly string[] = [
  "yelp.com",
  "angi.com",
  "angieslist.com",
  "homeadvisor.com",
  "thumbtack.com",
  "houzz.com",
  "yellowpages.com",
  "bbb.org",
  "facebook.com",
  "nextdoor.com",
  "porch.com",
  "expertise.com",
  "mapquest.com",
];

const MEGA_SLUGS: readonly string[] = MEGA_DOMAINS.map((d) =>
  d.replace(/[^a-z0-9]+/g, "-")
);

/** Slug used to match a candidate query to its validation snapshot. */
export function slugifyQuery(query: string): string {
  return slugify(query);
}

/**
 * Normalize an organic result id for set membership and mega-domain checks.
 * Handles full URLs ("https://www.yelp.com/biz/x"), bare hosts ("yelp.com"),
 * and url-derived registry ids ("yelp-com-biz-x") uniformly.
 */
export function normalizeSerpId(id: string): string {
  return id
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** True when an organic result id belongs to a mega-domain directory. */
export function isMegaDomain(id: string): boolean {
  const norm = normalizeSerpId(id);
  return MEGA_SLUGS.some((slug) => norm === slug || norm.includes(slug));
}

/** Organic top-10 ids with mega-domain entries removed. */
export function filterMegaDomains(organicIds: string[]): string[] {
  return organicIds.filter((id) => !isMegaDomain(id));
}

/**
 * Overlap coefficient (shared / min set size) of two organic top-10 lists
 * AFTER mega-domain exclusion. Returns null when either side is empty after
 * filtering — no evidence, not zero overlap.
 */
export function serpOverlap(a: string[], b: string[]): number | null {
  const setA = new Set(filterMegaDomains(a).map(normalizeSerpId));
  const setB = new Set(filterMegaDomains(b).map(normalizeSerpId));
  if (setA.size === 0 || setB.size === 0) return null;
  let shared = 0;
  for (const id of setA) if (setB.has(id)) shared++;
  return shared / Math.min(setA.size, setB.size);
}

/** Find the validation snapshot for a query (see convention in header). */
export function snapshotForQuery(
  snapshots: SerpSnapshot[],
  query: string
): SerpSnapshot | undefined {
  const slug = slugifyQuery(query);
  return snapshots.find((s) => s.cell.cluster === slug);
}

function findRoot(parent: Map<string, string>, id: string): string {
  let cur = id;
  for (;;) {
    const p = parent.get(cur);
    if (p === undefined || p === cur) return cur;
    cur = p;
  }
}

/**
 * Contract surface (core/CONTRACTS.md §3): returns the corrected
 * query→cluster assignment (same order as `candidates`).
 *
 * Pass 1 (merge): any cross-cluster query pair with overlap ≥
 * CLUSTER_MERGE_OVERLAP unions the two clusters; the merged cluster keeps
 * the lexicographically smallest clusterId.
 *
 * Pass 2 (split): within each post-merge cluster, a query whose overlap with
 * EVERY other measurable member is < CLUSTER_SPLIT_OVERLAP is split out to
 * `<clusterId>--split--<query-slug>`. Members are examined in reverse
 * lexicographic query order so the lexicographically smallest member anchors
 * the cluster; splitting stops when one measurable member remains.
 */
export function validateClusters(
  snapshots: SerpSnapshot[],
  candidates: { query: string; clusterId: string }[]
): { query: string; clusterId: string }[] {
  const organicSets: (string[] | null)[] = candidates.map((c) => {
    const snap = snapshotForQuery(snapshots, c.query);
    return snap ? snap.organicTop10 : null;
  });

  // Pass 1 — merge via union-find over clusterIds.
  const parent = new Map<string, string>();
  for (let i = 0; i < candidates.length; i++) {
    const a = candidates[i];
    const setA = organicSets[i];
    if (a === undefined || setA === null || setA === undefined) continue;
    for (let j = i + 1; j < candidates.length; j++) {
      const b = candidates[j];
      const setB = organicSets[j];
      if (b === undefined || setB === null || setB === undefined) continue;
      if (findRoot(parent, a.clusterId) === findRoot(parent, b.clusterId)) continue;
      const overlap = serpOverlap(setA, setB);
      if (overlap !== null && overlap >= CLUSTER_MERGE_OVERLAP) {
        const rootA = findRoot(parent, a.clusterId);
        const rootB = findRoot(parent, b.clusterId);
        const winner = rootA < rootB ? rootA : rootB;
        const loser = rootA < rootB ? rootB : rootA;
        parent.set(loser, winner);
      }
    }
  }

  const merged = candidates.map((c, i) => ({
    query: c.query,
    clusterId: findRoot(parent, c.clusterId),
    organic: organicSets[i] ?? null,
  }));

  // Pass 2 — split within post-merge clusters.
  const byCluster = new Map<string, typeof merged>();
  for (const m of merged) {
    const group = byCluster.get(m.clusterId);
    if (group) group.push(m);
    else byCluster.set(m.clusterId, [m]);
  }

  const finalCluster = new Map<string, string>(); // query → final clusterId
  for (const [clusterId, group] of byCluster) {
    const measurable = group
      .filter((m) => m.organic !== null)
      .sort((a, b) => (a.query < b.query ? -1 : a.query > b.query ? 1 : 0));
    const core = new Set(measurable.map((m) => m.query));

    // Reverse-lex: the lexicographically smallest measurable query anchors.
    for (let k = measurable.length - 1; k >= 0 && core.size > 1; k--) {
      const candidate = measurable[k];
      if (candidate === undefined || !core.has(candidate.query)) continue;
      const others = measurable.filter(
        (m) => m.query !== candidate.query && core.has(m.query)
      );
      if (others.length === 0) continue;
      const isOutlier = others.every((o) => {
        const overlap = serpOverlap(candidate.organic ?? [], o.organic ?? []);
        // null overlap = no evidence → never split on it (fail toward stability).
        return overlap !== null && overlap < CLUSTER_SPLIT_OVERLAP;
      });
      if (isOutlier) {
        core.delete(candidate.query);
        finalCluster.set(
          candidate.query,
          `${clusterId}--split--${slugifyQuery(candidate.query)}`
        );
      }
    }
    for (const m of group) {
      if (!finalCluster.has(m.query)) finalCluster.set(m.query, clusterId);
    }
  }

  return merged.map((m) => ({
    query: m.query,
    clusterId: finalCluster.get(m.query) ?? m.clusterId,
  }));
}
