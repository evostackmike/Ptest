/**
 * pipeline/m1-competitors/registry.schema.ts
 *
 * zod validators for every on-disk artifact M1 owns (CONTRACTS §SHARED-8):
 * - per-cell SERP fixture files (`fixtures/serp/<town>__<cluster>.json`)
 * - the client citation-crawl fixture (`fixtures/citations.json`)
 * - the competitor registry artifact itself (round-trip validation)
 *
 * Parse outputs are assignable to the core types (compile-time checked in
 * registry.schema.test.ts). core/types.ts stays types-only.
 */

import { z } from "zod";
import type {
  CompetitorFacet,
  CompetitorRegistry,
  RegistryBusiness,
  SerpSnapshot,
} from "../../core/types.js";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const cellSchema = z.object({
  town: z.string().min(1),
  cluster: z.string().min(1),
});

export const surfaceSchema = z.enum(["LOCAL_PACK", "ORGANIC"]);

export const spamFlagSchema = z.enum([
  "NAME_KEYWORD_STUFFING",
  "ADDRESS_ANOMALY",
  "REVIEW_BURST",
  "DUPLICATE_LISTING",
]);

/** One weekly review-ledger style observation frozen into a fixture. */
export const reviewObservationSchema = z.object({
  /** ISO date or timestamp. */
  observedAt: z.string().min(1),
  reviewCount: z.number().int().nonnegative(),
});
export type ReviewObservation = z.infer<typeof reviewObservationSchema>;

// ---------------------------------------------------------------------------
// SERP fixture files (one per cell)
// ---------------------------------------------------------------------------

export const serpFurnitureSchema = z.object({
  lsaPresent: z.boolean(),
  adsCount: z.number().int().nonnegative(),
  directoryStacked: z.boolean(),
});

/** Observable-only business fields as they arrive from a SERP/Business-Data pull. */
const observablesShape = {
  websiteUrl: z.string().nullable().default(null),
  address: z.string().nullable().default(null),
  reviewCount: z.number().int().nonnegative().nullable().default(null),
  rating: z.number().min(1).max(5).nullable().default(null),
  distanceMiles: z.number().nonnegative().nullable().default(null),
  primaryCategory: z.string().nullable().default(null),
  siteDepth: z.number().int().nonnegative().nullable().default(null),
  hasLocalBusinessSchema: z.boolean().nullable().default(null),
  reviewHistory: z.array(reviewObservationSchema).default([]),
};

/** A pack (top-3) result: always a resolved business. */
export const packEntrySchema = z.object({
  businessId: z.string().regex(/^b-[a-z0-9-]+$/),
  name: z.string().min(1),
  ...observablesShape,
});
export type PackEntry = z.infer<typeof packEntrySchema>;

/**
 * An organic result: either a resolved business (`businessId` set, profile
 * fields optional — merged across cells) or a site-only/directory result
 * (`businessId: null` → url-derived id in the snapshot).
 */
export const organicEntrySchema = z.object({
  businessId: z
    .string()
    .regex(/^b-[a-z0-9-]+$/)
    .nullable()
    .default(null),
  url: z.string().min(1),
  name: z.string().nullable().default(null),
  ...observablesShape,
});
export type OrganicEntry = z.infer<typeof organicEntrySchema>;

/** One frozen per-cell SERP pull — the file shape under `fixtures/serp/`. */
export const serpCellFixtureSchema = z.object({
  cell: cellSchema,
  /** The head query this pull was made for (informational; snapshots are per-cell). */
  query: z.string().min(1),
  capturedAt: z.string().min(1),
  furniture: serpFurnitureSchema,
  pack: z.array(packEntrySchema).max(3),
  organic: z.array(organicEntrySchema).max(10),
});
export type SerpCellFixture = z.infer<typeof serpCellFixtureSchema>;

// ---------------------------------------------------------------------------
// Registry (round-trip validation of M1's own artifact)
// ---------------------------------------------------------------------------

export const competitorFacetSchema: z.ZodType<CompetitorFacet> = z.object({
  cell: cellSchema,
  surface: surfaceSchema,
  position: z.number().int().positive(),
  reviewCount: z.number().int().nonnegative().nullable(),
  rating: z.number().min(1).max(5).nullable(),
  distanceMiles: z.number().nonnegative().nullable(),
  primaryCategory: z.string().nullable(),
  spamFlags: z.array(spamFlagSchema),
});

export const registryBusinessSchema = z.object({
  businessId: z.string().min(1),
  name: z.string().min(1),
  websiteUrl: z.string().nullable(),
  nameKeywords: z.array(z.string()),
  siteDepth: z.number().int().nonnegative().nullable(),
  hasLocalBusinessSchema: z.boolean().nullable(),
  facets: z.array(competitorFacetSchema),
  // M1 extension fields (see RegistryBusinessExt) — optional on round-trip.
  address: z.string().nullable().optional(),
  reviewHistory: z.array(reviewObservationSchema).optional(),
});

export const serpSnapshotSchema: z.ZodType<SerpSnapshot> = z.object({
  cell: cellSchema,
  capturedAt: z.string().min(1),
  packTop3: z.array(z.string()),
  organicTop10: z.array(z.string()),
  furniture: serpFurnitureSchema,
});

export const competitorRegistrySchema = z.object({
  businesses: z.array(registryBusinessSchema),
  snapshots: z.array(serpSnapshotSchema),
});

/**
 * What `buildRegistry` actually puts in `CompetitorRegistry.businesses`:
 * structurally a `RegistryBusiness` (so the registry satisfies the core type)
 * plus the extra observables the spam heuristics need. Consumers that only
 * know `RegistryBusiness` are unaffected; `detectSpamSignals` narrows via
 * `asObservables`.
 */
export interface RegistryBusinessExt extends RegistryBusiness {
  /** Listed address as observed on the SERP/profile (null for SAB-hidden). */
  address: string | null;
  /** Weekly review-count observations frozen from fixtures (may be empty). */
  reviewHistory: ReviewObservation[];
}

/** Safe narrowing from the core type to the extended observables. */
export function asObservables(b: RegistryBusiness): RegistryBusinessExt {
  const ext = b as Partial<RegistryBusinessExt> & RegistryBusiness;
  return {
    ...b,
    address: typeof ext.address === "string" ? ext.address : null,
    reviewHistory: Array.isArray(ext.reviewHistory) ? ext.reviewHistory : [],
  };
}

// ---------------------------------------------------------------------------
// Citation fixture (client NAP crawl)
// ---------------------------------------------------------------------------

export const citationListingSchema = z.object({
  /** Directory / platform, e.g. "yelp.com". */
  source: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().nullable().default(null),
  address: z.string().nullable().default(null),
});
export type CitationListing = z.infer<typeof citationListingSchema>;

export const citationFixtureSchema = z.object({
  /** Sources where a client listing is expected to exist (MISSING check). */
  expectedSources: z.array(z.string().min(1)),
  listings: z.array(citationListingSchema),
});
export type CitationFixture = z.infer<typeof citationFixtureSchema>;
