/**
 * intake/manifest.schema.ts — zod validator for the on-disk client manifest
 * (clients/<slug>/manifest.json, spec §3).
 *
 * Mirrors `ClientManifest` from core/types.ts EXACTLY (snake_case preserved —
 * SHARED CONVENTIONS #9). The schema is purely structural: it establishes the
 * shape and primitive types. The spec §3 *gate* rules (incomplete NAP, missing
 * lat_lng semantics, proof/photo combination, GBP access mitigation, calls-KPI
 * warning) live in intake/validate-manifest.ts so rejections come back as an
 * actionable fix-list rather than raw zod issues.
 *
 * A compile-time assignability check (z.infer → ClientManifest) lives at the
 * bottom of this file and is exercised again in manifest.schema.test.ts.
 */

import { z } from "zod";
import type { ClientManifest } from "../core/types.js";

const latLngSchema = z.tuple([z.number(), z.number()], {
  invalid_type_error: "expected [lat, lng] as a 2-number array",
  required_error: "missing [lat, lng] coordinates",
});

const licenseSchema = z.object({
  type: z.string(),
  number: z.string(),
  state: z.string(),
});

const brandConstraintsSchema = z.object({
  banned_phrases: z.array(z.string()),
  required_disclaimers: z.array(z.string()),
  tone_notes: z.string(),
  competitor_names_never_mention: z.array(z.string()),
});

const businessEntitySchema = z.object({
  schema_type: z.string(),
  founding_year: z.number().int(),
  owner_names: z.array(z.string()),
});

const manifestBusinessSchema = z.object({
  legal_name: z.string(),
  phone_nap: z.string(),
  email: z.string(),
  website_url: z.string(),
  domain_age_months: z.number(),
  entity: businessEntitySchema,
  licenses: z.array(licenseSchema),
  booking_url: z.string().nullable(),
  brand_constraints: brandConstraintsSchema,
});

const baseLocationSchema = z.object({
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  lat_lng: latLngSchema,
  is_storefront_or_SAB: z.enum(["storefront", "SAB"]),
});

const townSchema = z.object({
  slug: z.string(),
  name: z.string(),
  drive_time_min: z.number(),
  county: z.string().optional(),
  lat_lng: latLngSchema.optional(),
});

const manifestLocationsSchema = z.object({
  base: baseLocationSchema,
  service_area: z.object({
    target_region_label: z.string(),
    towns: z.array(townSchema),
  }),
  priority_towns: z.array(z.string()),
});

const serviceClusterSchema = z.object({
  cluster_id: z.string(),
  label: z.string(),
  emergency_offered: z.boolean().optional(),
  capacity: z.boolean(),
});

const manifestServicesSchema = z.object({
  clusters: z.array(serviceClusterSchema),
  do_not_offer: z.array(z.string()),
});

const proofJobSchema = z.object({
  job_id: z.string(),
  town: z.string(),
  service_cluster: z.string(),
  date: z.string(),
  photos: z.array(z.string()),
  description: z.string(),
  permission_to_publish: z.boolean(),
});

const proofAssetsSchema = z.object({
  jobs: z.array(proofJobSchema),
  certifications: z.array(z.string()),
  awards: z.array(z.string()),
});

const localFactSchema = z.object({
  fact_id: z.string(),
  claim: z.string(),
  source_url_or_owner_attestation: z.string(),
  verified_by: z.string(),
  verified_date: z.string(),
  towns: z.array(z.string()),
  clusters: z.array(z.string()),
});

const manifestGbpSchema = z.object({
  access_level: z.enum(["owner", "manager", "none"]),
  profile_url: z.string().nullable(),
  current_primary_category: z.string(),
  review_reply_policy: z.string(),
});

const ownerCommitmentsSchema = z.object({
  hours_per_month: z.number().min(0),
  will_ask_for_reviews: z.object({
    yes: z.boolean(),
    expected_per_month: z.number().min(0),
  }),
  will_provide_job_photos: z.object({
    yes: z.boolean(),
    cadence: z.string(),
  }),
  will_do_gbp_posts: z.enum(["yes", "no", "delegate"]),
  budget: z.object({
    content_pages_per_month: z.number().min(0),
    citations_budget_usd: z.number().min(0),
    link_outreach: z.boolean(),
  }),
  hard_nos: z.array(z.string()),
});

const manifestGoalsSchema = z.object({
  primary_kpi: z.enum(["calls", "forms", "bookings", "traffic"]),
  target_clusters_ranked: z.array(z.string()),
  time_horizon_months: z.number(),
});

const manifestIntegrationsSchema = z.object({
  gsc_property: z.string().nullable(),
  ga4: z.string().nullable(),
  call_tracking: z.string().nullable(),
  gbp_api_token: z.string().nullable(),
  dataforseo: z.string().nullable(),
});

export const clientManifestSchema = z.object({
  business: manifestBusinessSchema,
  locations: manifestLocationsSchema,
  services: manifestServicesSchema,
  proof_assets: proofAssetsSchema,
  local_facts: z.array(localFactSchema),
  gbp: manifestGbpSchema,
  owner_commitments: ownerCommitmentsSchema,
  goals: manifestGoalsSchema,
  integrations: manifestIntegrationsSchema,
});

export type ClientManifestParsed = z.infer<typeof clientManifestSchema>;

// Compile-time contract check (SHARED CONVENTIONS #8): the schema's inferred
// output must be assignable to the core type. If core/types.ts and this schema
// ever drift, this line stops compiling.
const _assignabilityCheck = (parsed: ClientManifestParsed): ClientManifest =>
  parsed;
void _assignabilityCheck;
