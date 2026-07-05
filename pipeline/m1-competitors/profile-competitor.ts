/**
 * pipeline/m1-competitors/profile-competitor.ts
 *
 * buildRegistry — CONTRACTS §2. Reads frozen per-cell SERP fixtures, dedupes
 * businesses across cells into RegistryBusiness entries and attaches
 * per-(business × cell × surface) facets, plus per-cell SerpSnapshots with
 * furniture flags. A single deduped profile cannot explain why a
 * multi-location competitor wins Pullman but not Moscow — the facets are the
 * point of the registry.
 */

import type {
  Cell,
  ClientManifest,
  CompetitorFacet,
  CompetitorRegistry,
  SerpSnapshot,
  Surface,
} from "../../core/types.js";
import type {
  OrganicEntry,
  PackEntry,
  RegistryBusinessExt,
  ReviewObservation,
} from "./registry.schema.js";
import { FixtureSerpSource } from "./serp-sweep.js";

// ---------------------------------------------------------------------------
// Token helpers (shared with spam-signals via export)
// ---------------------------------------------------------------------------

/** Lowercase alphanumeric tokens of a string. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

const US_STATE_CODES = new Set([
  "al","ak","az","ar","ca","co","ct","de","fl","ga","hi","id","il","in","ia",
  "ks","ky","la","me","md","ma","mi","mn","ms","mo","mt","ne","nv","nh","nj",
  "nm","ny","nc","nd","oh","ok","or","pa","ri","sc","sd","tn","tx","ut","vt",
  "va","wa","wv","wi","wy",
]);

/** City-name tokens from the manifest's service-area towns ("pullman", "moscow", …). */
export function cityTokensFromManifest(manifest: ClientManifest): Set<string> {
  const out = new Set<string>();
  for (const town of manifest.locations.service_area.towns) {
    for (const tok of [...tokenize(town.slug), ...tokenize(town.name)]) {
      if (!US_STATE_CODES.has(tok)) out.add(tok);
    }
  }
  return out;
}

/**
 * Service-vocabulary tokens derived from the manifest only (no hardcoded
 * vertical lexicon): schema.org type + cluster ids + cluster labels.
 */
export function serviceTokensFromManifest(manifest: ClientManifest): Set<string> {
  const out = new Set<string>();
  for (const tok of tokenize(manifest.business.entity.schema_type)) out.add(tok);
  for (const cluster of manifest.services.clusters) {
    for (const tok of [...tokenize(cluster.cluster_id), ...tokenize(cluster.label)]) {
      out.add(tok);
    }
  }
  return out;
}

/** Matched city/service keyword tokens found in a business name. */
export function extractNameKeywords(name: string, manifest: ClientManifest): string[] {
  const city = cityTokensFromManifest(manifest);
  const service = serviceTokensFromManifest(manifest);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tok of tokenize(name)) {
    if ((city.has(tok) || service.has(tok)) && !seen.has(tok)) {
      seen.add(tok);
      out.push(tok);
    }
  }
  return out;
}

/** Deterministic url-derived id for site-only organic results ("u-yelp-com"). */
export function urlDerivedId(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    host = url;
  }
  const cleaned = host.replace(/^www\./, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return `u-${cleaned.replace(/^-+|-+$/g, "")}`;
}

// ---------------------------------------------------------------------------
// buildRegistry
// ---------------------------------------------------------------------------

interface MutableBusiness extends RegistryBusinessExt {
  facets: CompetitorFacet[];
}

type EntryObservables = Omit<PackEntry, "businessId" | "name"> &
  Omit<OrganicEntry, "businessId" | "url" | "name">;

function mergeProfile(
  existing: MutableBusiness,
  name: string | null,
  obs: EntryObservables
): void {
  // First non-null observation wins; later cells only fill gaps.
  if (existing.websiteUrl === null && obs.websiteUrl !== null) {
    existing.websiteUrl = obs.websiteUrl;
  }
  if (existing.address === null && obs.address !== null) {
    existing.address = obs.address;
  }
  if (existing.siteDepth === null && obs.siteDepth !== null) {
    existing.siteDepth = obs.siteDepth;
  }
  if (existing.hasLocalBusinessSchema === null && obs.hasLocalBusinessSchema !== null) {
    existing.hasLocalBusinessSchema = obs.hasLocalBusinessSchema;
  }
  if (existing.reviewHistory.length === 0 && obs.reviewHistory.length > 0) {
    existing.reviewHistory = dedupeHistory(obs.reviewHistory);
  }
  void name;
}

function dedupeHistory(history: ReviewObservation[]): ReviewObservation[] {
  const byDate = new Map<string, ReviewObservation>();
  for (const row of history) byDate.set(row.observedAt, row);
  return [...byDate.values()].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
}

function facetFrom(
  cell: Cell,
  surface: Surface,
  position: number,
  obs: EntryObservables
): CompetitorFacet {
  return {
    cell: { ...cell },
    surface,
    position,
    reviewCount: obs.reviewCount,
    rating: obs.rating,
    distanceMiles: obs.distanceMiles,
    primaryCategory: obs.primaryCategory,
    spamFlags: [],
  };
}

const facetSortKey = (f: CompetitorFacet): string =>
  `${f.cell.town}|${f.cell.cluster}|${f.surface}|${String(f.position).padStart(2, "0")}`;

/**
 * Build the competitor registry from frozen SERP fixtures under
 * `<fixtureDir>/serp/` (one file per cell — see fixtures/README.md).
 *
 * Fixture-set integrity violations (unreadable dir, schema mismatch,
 * duplicate cells) throw: the contracted signature has no failure channel and
 * a broken frozen research set is a programmer/data error, not runtime input.
 */
export function buildRegistry(
  fixtureDir: string,
  manifest: ClientManifest
): CompetitorRegistry {
  const source = new FixtureSerpSource(fixtureDir);
  const fixtures = source.fetchAll();

  const businesses = new Map<string, MutableBusiness>();
  const snapshots: SerpSnapshot[] = [];

  const upsert = (
    businessId: string,
    name: string | null,
    obs: EntryObservables,
    facet: CompetitorFacet
  ): void => {
    const existing = businesses.get(businessId);
    if (existing) {
      mergeProfile(existing, name, obs);
      existing.facets.push(facet);
      return;
    }
    const displayName = name ?? businessId.replace(/^b-/, "").replace(/-/g, " ");
    businesses.set(businessId, {
      businessId,
      name: displayName,
      websiteUrl: obs.websiteUrl,
      nameKeywords: extractNameKeywords(displayName, manifest),
      siteDepth: obs.siteDepth,
      hasLocalBusinessSchema: obs.hasLocalBusinessSchema,
      facets: [facet],
      address: obs.address,
      reviewHistory: dedupeHistory(obs.reviewHistory),
    });
  };

  for (const fixture of fixtures) {
    const packTop3: string[] = [];
    fixture.pack.forEach((entry, i) => {
      packTop3.push(entry.businessId);
      upsert(
        entry.businessId,
        entry.name,
        entry,
        facetFrom(fixture.cell, "LOCAL_PACK", i + 1, entry)
      );
    });

    const organicTop10: string[] = [];
    fixture.organic.forEach((entry, i) => {
      if (entry.businessId === null) {
        organicTop10.push(urlDerivedId(entry.url));
        return;
      }
      organicTop10.push(entry.businessId);
      upsert(
        entry.businessId,
        entry.name,
        entry,
        facetFrom(fixture.cell, "ORGANIC", i + 1, entry)
      );
    });

    snapshots.push({
      cell: { ...fixture.cell },
      capturedAt: fixture.capturedAt,
      packTop3,
      organicTop10,
      furniture: { ...fixture.furniture },
    });
  }

  const sortedBusinesses = [...businesses.values()]
    .sort((a, b) => a.businessId.localeCompare(b.businessId))
    .map((b) => ({
      ...b,
      facets: [...b.facets].sort((x, y) =>
        facetSortKey(x).localeCompare(facetSortKey(y))
      ),
    }));

  return { businesses: sortedBusinesses, snapshots };
}
