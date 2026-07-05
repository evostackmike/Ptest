/**
 * pipeline/m3-gbp-observables/gbp-diff.ts
 *
 * gbpDiff — CONTRACTS §4. For every priority cell (manifest priority_towns ×
 * goals.target_clusters_ranked) compute:
 *  (a) the PER-QUERY primary-category distribution of the ACTUAL observed
 *      pack top-3 for that cell's head query — never a modal blend across
 *      queries: each GbpCellGap is derived from exactly one cell snapshot,
 *      and nothing is ever summed or averaged across queries/cells;
 *  (b) the review gap: client count vs. the observed top-3 median.
 *
 * generatedAt derives from the snapshots' capturedAt timestamps — never
 * Date.now() (SHARED CONVENTIONS 5).
 */

import type {
  Cell,
  ClientManifest,
  CompetitorFacet,
  CompetitorRegistry,
  GbpCellGap,
  GbpGapReport,
  RegistryBusiness,
  SerpSnapshot,
} from "../../core/types.js";

/** Profiles a human transcribes per cell in a spot-check round. */
export const SPOT_CHECK_PROFILE_COUNT = 5;

/** Category recorded when a pack member's primary category was not observable. */
export const UNKNOWN_CATEGORY = "UNKNOWN";

/**
 * Deterministic head query for a cell: cluster label + town name, lowercased,
 * punctuation stripped — matches how the M1 fixture pulls were made (the
 * fixture's own `query` field is informational; SerpSnapshot does not carry
 * it, so M1 fixture authoring and M3 share this derivation).
 */
export function headQueryForCell(cell: Cell, manifest: ClientManifest): string {
  const cluster = manifest.services.clusters.find(
    (c) => c.cluster_id === cell.cluster
  );
  const town = manifest.locations.service_area.towns.find(
    (t) => t.slug === cell.town
  );
  const clusterLabel = (cluster?.label ?? cell.cluster).toLowerCase();
  const townLabel = (town?.name ?? cell.town).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return `${clusterLabel} ${townLabel}`.replace(/\s+/g, " ").trim();
}

const sameCell = (a: Cell, b: Cell): boolean =>
  a.town === b.town && a.cluster === b.cluster;

const hostOf = (url: string | null): string | null => {
  if (url === null) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
};

function packFacetFor(
  business: RegistryBusiness,
  cell: Cell
): CompetitorFacet | undefined {
  return business.facets.find(
    (f) => f.surface === "LOCAL_PACK" && sameCell(f.cell, cell)
  );
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * The client's own review count: taken from the client's registry facets
 * (the client appears in fixtures wherever it actually ranked), matched by
 * website host. A GBP review count is a profile-global number, so the max
 * observed across facets is used for every cell; 0 when the client is
 * invisible in every observed SERP.
 * // V05: source from the review ledger once loop/ has ~8 weeks of rows.
 */
export function clientReviewCount(
  registry: CompetitorRegistry,
  manifest: ClientManifest
): number {
  const clientHost = hostOf(manifest.business.website_url);
  if (clientHost === null) return 0;
  const client = registry.businesses.find(
    (b) => hostOf(b.websiteUrl) === clientHost
  );
  if (!client) return 0;
  const counts = client.facets
    .map((f) => f.reviewCount)
    .filter((c): c is number => c !== null);
  return counts.length > 0 ? Math.max(...counts) : 0;
}

/** Top-N distinct profile names for a cell: pack first, then organic businesses. */
function spotCheckProfiles(
  snapshot: SerpSnapshot,
  registry: CompetitorRegistry,
  n: number
): string[] {
  const byId = new Map(registry.businesses.map((b) => [b.businessId, b]));
  const names: string[] = [];
  const seen = new Set<string>();
  for (const id of [...snapshot.packTop3, ...snapshot.organicTop10]) {
    const business = byId.get(id);
    if (!business || seen.has(business.businessId)) continue;
    seen.add(business.businessId);
    names.push(business.name);
    if (names.length === n) break;
  }
  return names;
}

export function gbpDiff(
  registry: CompetitorRegistry,
  manifest: ClientManifest
): GbpGapReport {
  const byId = new Map(registry.businesses.map((b) => [b.businessId, b]));
  const clientCount = clientReviewCount(registry, manifest);

  const cells: GbpCellGap[] = [];
  const usedCapturedAt: string[] = [];

  for (const town of manifest.locations.priority_towns) {
    for (const cluster of manifest.goals.target_clusters_ranked) {
      const cell: Cell = { town, cluster };
      const snapshot = registry.snapshots.find((s) => sameCell(s.cell, cell));
      if (!snapshot) {
        // V05: emit an explicit data-gap entry + a scan task instead of
        // silently skipping priority cells with no frozen observation.
        continue;
      }
      usedCapturedAt.push(snapshot.capturedAt);

      const query = headQueryForCell(cell, manifest);

      // (a) per-query distribution — from THIS snapshot's pack only.
      const packCategoryDistribution: Record<string, number> = {};
      const packReviewCounts: number[] = [];
      for (const id of snapshot.packTop3) {
        const facet = byId.get(id) ? packFacetFor(byId.get(id)!, cell) : undefined;
        const category = facet?.primaryCategory ?? UNKNOWN_CATEGORY;
        packCategoryDistribution[category] =
          (packCategoryDistribution[category] ?? 0) + 1;
        if (facet?.reviewCount != null) packReviewCounts.push(facet.reviewCount);
      }

      const profiles = spotCheckProfiles(snapshot, registry, SPOT_CHECK_PROFILE_COUNT);
      const spotCheckTasks = [
        `Open the GBP profiles for ${profiles.join(", ")} (top ${profiles.length} ` +
          `for "${query}" in ${town}) and transcribe secondary categories, ` +
          `services, and attributes into the spot-check form. Transcribe only — ` +
          `change nothing on any profile (G13: edits are M8's job, human-approved).`,
      ];

      cells.push({
        cell,
        query,
        packCategoryDistribution,
        reviewGap: {
          clientCount,
          top3Median: median(packReviewCounts),
        },
        spotCheckTasks,
      });
      // V05: reply-rate diff once reply-rate is observable (needs Business
      // Data review payloads or the transcription round; not available v0.1).
    }
  }

  if (usedCapturedAt.length === 0) {
    throw new Error(
      "gbpDiff: no snapshots cover any priority cell — registry and manifest priority_towns/target_clusters_ranked do not intersect"
    );
  }

  // ISO-8601 strings compare lexicographically: max = latest capture.
  const generatedAt = usedCapturedAt.reduce((a, b) => (a > b ? a : b));

  return { cells, generatedAt };
}
