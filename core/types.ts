/**
 * core/types.ts — shared type system for the seo-engine (v0.1).
 *
 * Single source of truth for every cross-module shape. NO runtime code and NO
 * zod here: modules that ingest untrusted JSON define their own zod validators
 * that must parse INTO these types (see core/CONTRACTS.md).
 *
 * Conventions:
 * - Types that mirror on-disk JSON artifacts (ClientManifest, Task, PlanFile)
 *   keep the spec's snake_case keys so JSON round-trips without mapping.
 * - Engine-internal derived types (registry, keyword map, verdicts, metrics)
 *   use camelCase.
 * - Domain failures are values ({ ok: false, ... }), never thrown exceptions.
 * - Timestamps are ISO-8601 strings ("2026-07-05T00:00:00Z" or "2026-07-05");
 *   pure functions receive time as a parameter and never call Date.now().
 */

// ---------------------------------------------------------------------------
// Primitives: surfaces, cells, rule identifiers
// ---------------------------------------------------------------------------

/** The two independently planned / measured / won ranking surfaces (G1). */
export type Surface = "LOCAL_PACK" | "ORGANIC";

/** Task-level surface may address both at once; verdicts never do. */
export type TaskSurface = Surface | "BOTH";

/** The atomic strategic unit: town × service-cluster. Surface is carried alongside. */
export interface Cell {
  /** Town slug from manifest locations.service_area.towns[].slug, e.g. "pullman-wa". */
  town: string;
  /** Cluster id from manifest services.clusters[].cluster_id, e.g. "panel". */
  cluster: string;
}

/** Guardrails G1–G16 (spec §6). */
export type GuardrailId =
  | "G1" | "G2" | "G3" | "G4" | "G5" | "G6" | "G7" | "G8"
  | "G9" | "G10" | "G11" | "G12" | "G13" | "G14" | "G15" | "G16";

/** Signals→actions rules R1–R13 (spec §6). */
export type RuleId =
  | "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "R7"
  | "R8" | "R9" | "R10" | "R11" | "R12" | "R13";

/** Any rule identifier usable in task gate_checks / provenance. */
export type AnyRuleId = GuardrailId | RuleId;

/** Uniform return shape for every guardrail pure function in rules/guardrails.ts. */
export interface GuardrailResult {
  /** true = the guardrail passes (does not block). */
  ok: boolean;
  ruleId: GuardrailId;
  /** Human-readable explanation of why it passed or fired. Always populated. */
  reason: string;
}

// ---------------------------------------------------------------------------
// Feasibility verdicts (M4)
// ---------------------------------------------------------------------------

export type Verdict =
  | "WINNABLE_PACK"
  | "WINNABLE_ORGANIC"
  | "ORGANIC_ONLY"
  | "LONG_HORIZON"
  | "INFEASIBLE";

/**
 * Probability band, never a point estimate (G12). Fractions in [0, 1];
 * label is the client-facing rendering, e.g. "60-80%".
 */
export interface ProbabilityBand {
  low: number;
  high: number;
  label: string;
}

/** Coarse time-to-win bucket. Never a raw months number (spec §1/§4-M4). */
export type TtwBucket = "<6mo" | "6-12mo" | "12mo+" | "unknown";

export type Confidence = "LOW" | "MEDIUM" | "HIGH";

/** One scored cell × surface. Deterministic mechanics, probabilistic output. */
export interface CellVerdict {
  cell: Cell;
  surface: Surface;
  verdict: Verdict;
  band: ProbabilityBand;
  ttw: TtwBucket;
  /** LOW is mandatory for pre-ledger static-count-gap G3 scoring. */
  confidence: Confidence;
  /** Guardrails that fired (blocked or demoted the cell). ≥1 for INFEASIBLE. */
  firedRules: GuardrailId[];
  /** Named assumptions the band is conditional on, e.g. "conditional on owner throughput". */
  assumptions: string[];
  /**
   * INFEASIBLE / LONG_HORIZON verdicts must pass human review before client
   * delivery (spec §6 checkpoint table). false until a human signs off.
   */
  humanReviewed?: boolean;
}

// ---------------------------------------------------------------------------
// Client manifest (spec §3) — mirrors clients/<slug>/manifest.json, snake_case
// ---------------------------------------------------------------------------

export interface License {
  /** e.g. "electrical_contractor" */
  type: string;
  number: string;
  /** Two-letter state code; G15 checks town states against these. */
  state: string;
}

export interface BrandConstraints {
  banned_phrases: string[];
  required_disclaimers: string[];
  tone_notes: string;
  competitor_names_never_mention: string[];
}

export interface BusinessEntity {
  /** schema.org type, e.g. "Electrician". */
  schema_type: string;
  founding_year: number;
  owner_names: string[];
}

export interface ManifestBusiness {
  legal_name: string;
  /** Canonical NAP phone; must never appear hardcoded outside the manifest. */
  phone_nap: string;
  email: string;
  website_url: string;
  /** Drives the G4 indexation window and G14 publish ramp. */
  domain_age_months: number;
  entity: BusinessEntity;
  licenses: License[];
  booking_url: string | null;
  brand_constraints: BrandConstraints;
}

export interface BaseLocation {
  city: string;
  state: string;
  zip: string;
  /** [lat, lng]. Required by intake validation. */
  lat_lng: [number, number];
  is_storefront_or_SAB: "storefront" | "SAB";
}

export interface Town {
  /** Stable slug, e.g. "pullman-wa". Primary key for Cell.town. */
  slug: string;
  /** Display name, e.g. "Pullman, WA". */
  name: string;
  /** Drive time from base, minutes. Prior for G2 when SERP data is thin. */
  drive_time_min: number;
  county?: string;
  /** Town centroid [lat, lng] — used for geo-grid pin layout when known. */
  lat_lng?: [number, number];
}

export interface ManifestLocations {
  base: BaseLocation;
  service_area: {
    target_region_label: string;
    towns: Town[];
  };
  /** Town slugs receiving wave-1 focus (M3 spot-checks, M8 pack levers). */
  priority_towns: string[];
}

export interface ServiceCluster {
  cluster_id: string;
  label: string;
  emergency_offered?: boolean;
  capacity: boolean;
}

export interface ManifestServices {
  clusters: ServiceCluster[];
  /** Negative keywords for M2 seed expansion; never planned or written about. */
  do_not_offer: string[];
}

export interface ProofJob {
  job_id: string;
  /** Town slug. */
  town: string;
  /** Cluster id. */
  service_cluster: string;
  /** ISO date the job was done. */
  date: string;
  /** Photo asset paths/URLs. */
  photos: string[];
  description: string;
  permission_to_publish: boolean;
}

export interface ProofAssets {
  /** G6: FULL tier needs ≥2 publishable jobs per town×cluster. */
  jobs: ProofJob[];
  certifications: string[];
  awards: string[];
}

/** G8 source of truth for regulatory/local-factual claims. */
export interface LocalFact {
  fact_id: string;
  /** The claim as it may be stated, e.g. "Whitman County requires a permit for panel upgrades". */
  claim: string;
  /** URL or the literal string of an owner attestation. */
  source_url_or_owner_attestation: string;
  verified_by: string;
  /** ISO date. */
  verified_date: string;
  /** Town slugs the fact applies to (empty = all). */
  towns: string[];
  /** Cluster ids the fact applies to (empty = all). */
  clusters: string[];
}

export interface ManifestGbp {
  access_level: "owner" | "manager" | "none";
  profile_url: string | null;
  /** Changing this is a named human decision with rollback plan (G13). */
  current_primary_category: string;
  review_reply_policy: string;
}

export interface OwnerCommitments {
  /** G11 capacity model: M8 emission is budgeted against this. */
  hours_per_month: number;
  will_ask_for_reviews: { yes: boolean; expected_per_month: number };
  will_provide_job_photos: { yes: boolean; cadence: string };
  will_do_gbp_posts: "yes" | "no" | "delegate";
  budget: {
    content_pages_per_month: number;
    citations_budget_usd: number;
    link_outreach: boolean;
  };
  hard_nos: string[];
}

export interface ManifestGoals {
  primary_kpi: "calls" | "forms" | "bookings" | "traffic";
  target_clusters_ranked: string[];
  time_horizon_months: number;
}

export interface ManifestIntegrations {
  gsc_property: string | null;
  ga4: string | null;
  /** null + primary_kpi=calls → hard warning + mandatory day-0 tracking task at v0.1. */
  call_tracking: string | null;
  gbp_api_token: string | null;
  /** Env-var reference for the SERP vendor, e.g. "env:DFS_LOGIN". */
  dataforseo: string | null;
}

/** Full client manifest — spec §3. */
export interface ClientManifest {
  business: ManifestBusiness;
  locations: ManifestLocations;
  services: ManifestServices;
  proof_assets: ProofAssets;
  local_facts: LocalFact[];
  gbp: ManifestGbp;
  owner_commitments: OwnerCommitments;
  goals: ManifestGoals;
  integrations: ManifestIntegrations;
}

// ---------------------------------------------------------------------------
// M1 — competitor registry + SERP snapshots
// ---------------------------------------------------------------------------

export type SpamFlag =
  | "NAME_KEYWORD_STUFFING"
  | "ADDRESS_ANOMALY"
  | "REVIEW_BURST"
  | "DUPLICATE_LISTING";

/**
 * Per-(business × cell × surface) observable facet. A single deduped profile
 * cannot explain why a multi-location competitor wins Pullman but not Moscow —
 * facets are the point of the registry.
 */
export interface CompetitorFacet {
  cell: Cell;
  surface: Surface;
  /** Rank on that surface (1-based); pack: 1–3, organic: 1–10. */
  position: number;
  reviewCount: number | null;
  rating: number | null;
  /** Distance from the cell's town centroid. Feeds empirical G2. */
  distanceMiles: number | null;
  primaryCategory: string | null;
  spamFlags: SpamFlag[];
}

/** Registry entry per unique business (deduped across cells). */
export interface RegistryBusiness {
  /** Stable id within the registry, e.g. "b-swift-electric". */
  businessId: string;
  name: string;
  websiteUrl: string | null;
  /** Observable-only profile fields (spec M1): no invented data. */
  nameKeywords: string[];
  /** Rough crawl observation: page count on relevant service/location paths. */
  siteDepth: number | null;
  hasLocalBusinessSchema: boolean | null;
  facets: CompetitorFacet[];
}

/** SERP furniture per cell — a pack win under 3 LSA slots is worth less (M4 must know). */
export interface SerpFurniture {
  lsaPresent: boolean;
  adsCount: number;
  /** Organic top results dominated by directories (Yelp/Angi/etc.). */
  directoryStacked: boolean;
}

/** One frozen per-cell SERP observation (fixture-derived at v0.1). */
export interface SerpSnapshot {
  cell: Cell;
  /** ISO timestamp of capture. */
  capturedAt: string;
  /** businessId refs into the registry, rank order 1..3. */
  packTop3: string[];
  /** businessId refs (or url-derived ids for site-only results), rank order 1..10. */
  organicTop10: string[];
  furniture: SerpFurniture;
}

export interface CompetitorRegistry {
  businesses: RegistryBusiness[];
  snapshots: SerpSnapshot[];
}

/** Output row of M1's citation/duplicate-listing audit for the CLIENT. */
export interface CitationIssue {
  /** Directory / platform, e.g. "yelp.com". */
  source: string;
  issue: "WRONG_PHONE" | "WRONG_ADDRESS" | "WRONG_NAME" | "DUPLICATE_LISTING" | "MISSING";
  /** What the source currently shows (null for MISSING). */
  observed: string | null;
  /** What the manifest says it should be. */
  expected: string;
}

// ---------------------------------------------------------------------------
// M2 — keyword map
// ---------------------------------------------------------------------------

export interface KeywordEntry {
  query: string;
  /** Town slug the query targets (queries can be town-less for hub pages: null). */
  town: string | null;
  /**
   * Real vendor volume where sources return real data; null where none exists.
   * null is NEVER replaced by an invented population-scaled number (G5/G12).
   */
  volume: number | null;
  /** Market-existence gate: pack renders and/or incumbents maintain pages (from M1). */
  marketExists: boolean;
  /** The single canonical URL owning this intent (G7); null until M5 assigns it. */
  canonicalUrl: string | null;
}

export interface KeywordCluster {
  /** Cluster id from the manifest, e.g. "panel". */
  clusterId: string;
  keywords: KeywordEntry[];
}

export interface KeywordMap {
  clusters: KeywordCluster[];
  /** Queries dropped by the confirmed-skip / do_not_offer gates, with reasons. */
  skipped: { query: string; reason: string }[];
}

// ---------------------------------------------------------------------------
// M3 — GBP gap report
// ---------------------------------------------------------------------------

export interface GbpCellGap {
  cell: Cell;
  /** The head query this distribution was observed for. */
  query: string;
  /**
   * Per-QUERY primary-category distribution of the ACTUAL pack top-3
   * (category → count). Never a modal blend across queries.
   */
  packCategoryDistribution: Record<string, number>;
  reviewGap: {
    clientCount: number;
    /** Median review count of the observed pack top-3. */
    top3Median: number;
  };
  /**
   * Human spot-check instructions: "open these 5 profiles, transcribe secondary
   * categories/services". The permanent v0.x path for fields no API exposes.
   */
  spotCheckTasks: string[];
}

export interface GbpGapReport {
  /** One entry per priority cell (manifest priority_towns × target clusters). */
  cells: GbpCellGap[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// M5 — site architecture
// ---------------------------------------------------------------------------

export type PageType =
  | "service"
  | "location"
  | "service-town"
  | "hub"
  | "guide"
  | "core";

/** G6: FULL needs ≥2 publishable proof jobs for the page's town×cluster. */
export type PageTier = "FULL" | "DEGRADED";

export type PageStatus = "PLANNED" | "BLOCKED" | "LIVE";

export interface ArchitecturePage {
  /** Site-relative canonical URL, e.g. "/services/electrical-panel-upgrades/pullman-wa". */
  url: string;
  pageType: PageType;
  tier: PageTier;
  /** Every query whose intent this URL owns (G7: many queries, one URL). */
  targetQueries: string[];
  /** Template identifier in templates/site, e.g. "service-town-v1". */
  templateId: string;
  /** ProofJob.job_id refs embedded on the page (empty for DEGRADED). */
  proofRefs: string[];
  /** URLs of pages this page links to (internal-link plan). */
  internalLinks: string[];
  /** 1 = highest build priority. */
  priority: number;
  status: PageStatus;
  /** Required when status is BLOCKED, e.g. "G6: awaiting proof (0/2 jobs pullman-wa×panel)". */
  blockReason?: string;
}

export interface SiteArchitecture {
  pages: ArchitecturePage[];
  /** G7 conflicts resolved by rule, logged for audit: query → losing URL(s). */
  conflictLog: { query: string; wonBy: string; rejected: string[]; rule: string }[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// §5 — plan.json Task (snake_case: mirrors on-disk JSON exactly)
// ---------------------------------------------------------------------------

export type TaskType =
  | "PAGE_BUILD"
  | "CONTENT_DEPTH"
  | "CANNIBAL_FIX"
  | "GBP_EDIT"
  | "REVIEW_ASK"
  | "CITATION"
  | "CITATION_FIX"
  | "SPAM_REPORT"
  | "PROOF_COLLECT"
  | "TECH_FIX"
  | "LINK"
  | "ESCALATION";

export type TaskOwner = "agent" | "human";

/** Judgment gates, distinct from labor (spec §6 checkpoint table). */
export type TaskApproval = "none" | "human_review" | "owner_signoff";

export type TaskStatus =
  | "PLANNED"
  | "BLOCKED"
  | "IN_PROGRESS"
  | "DONE"
  | "VERIFIED"
  | "OVERDUE"
  | "UNKNOWN";

/** Machine truth vs. human attestation, split (spec §5). */
export interface DoneCondition {
  /** metrics.db / repo predicate description; null if verification is attestation-only. */
  verified: string | null;
  /** Human attestation + evidence artifact description; null if machine-verified. */
  attested: string | null;
  /**
   * Data-volume precondition; below it the predicate returns UNKNOWN, never
   * DONE (absence of data must never read as satisfied). null = no precondition.
   */
  min_data: string | null;
}

export interface TaskProvenance {
  run_id?: string;
  emitted_by: "M3" | "M5" | "M8" | "M10" | "intake";
  signal?: string;
  rule_id?: AnyRuleId;
}

export interface Task {
  task_id: string;
  type: TaskType;
  owner: TaskOwner;
  approval: TaskApproval;
  surface: TaskSurface;
  cell: Cell;
  target: {
    queries: string[];
    /** Canonical URL owning the intent (M5 ref) or null for off-site tasks. */
    url: string | null;
  };
  /** Imperative instruction. */
  action: string;
  /** Rule IDs that must pass before DONE. */
  gate_checks: AnyRuleId[];
  depends_on: string[];
  /** Rolls up against G11 capacity (0 for pure-agent tasks). */
  estimated_human_minutes: number;
  done_condition: DoneCondition;
  /** What proves completion. */
  evidence_required: string;
  /** M9 signal confirming effect. */
  verifies_via: string;
  status: TaskStatus;
  provenance: TaskProvenance;
}

export interface PlanFile {
  /** Client slug, e.g. "crescent-electric". */
  client: string;
  /** ISO timestamp. */
  generatedAt: string;
  tasks: Task[];
}

// ---------------------------------------------------------------------------
// M9 / loop — metrics rows, scan quality, goal check
// ---------------------------------------------------------------------------

/** Feed-health verdict for a whole geo-grid scan (R13). */
export type ScanQuality = "VALID" | "QUARANTINED";

/** One GSC performance row (daily granularity). */
export interface GscMetricsRow {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  query: string;
  url: string;
  impressions: number;
  clicks: number;
  /** Average position as reported by GSC. */
  position: number;
}

/** One pin in a geo-grid scan. Grid positions are ESTIMATES (G12). */
export interface GeogridPin {
  pinId: string;
  lat: number;
  lng: number;
  /** Client's pack rank at this pin, or null if absent from the pack. */
  clientPackPosition: number | null;
  /** businessId refs of the observed pack, rank order. Empty = empty pack. */
  packBusinessIds: string[];
}

/** One weekly geo-grid scan for a cell's head query. */
export interface GeogridScan {
  scanId: string;
  cell: Cell;
  query: string;
  /** ISO timestamp. */
  scannedAt: string;
  pins: GeogridPin[];
  /** QUARANTINED scans never feed R-rules and never reset win clocks. */
  quality: ScanQuality;
  /** Populated when quarantined, e.g. ">30% empty-pack pins". */
  quarantineReason?: string;
}

/** Weekly review-ledger observation (client and registry competitors alike). */
export interface ReviewLedgerRow {
  /** "client" or a registry businessId. */
  businessId: string;
  /** ISO timestamp. */
  observedAt: string;
  reviewCount: number;
  rating: number | null;
}

/** Weekly GBP liveness probe; disappearance = suspected suspension (R12 hard-stop). */
export interface GbpLivenessRow {
  /** ISO timestamp. */
  observedAt: string;
  profileVisible: boolean;
}

/** Result of loop/goal-check per cell × surface. */
export interface GoalCheckResult {
  cell: Cell;
  surface: Surface;
  won: boolean;
  /** Valid (non-quarantined) scans among the last 10; win needs ≥8 passing. */
  validScans: number;
  passingScans: number;
  reason: string;
}

// ---------------------------------------------------------------------------
// M6 — content gates: QA report and client config overlay
// ---------------------------------------------------------------------------

/** The unit of content the gates evaluate. */
export interface PageContent {
  /** Site-relative URL this content is destined for. */
  url: string;
  title: string;
  metaDescription: string;
  /** Full body text (rendered plain text, headings included). */
  body: string;
  faq: { q: string; a: string }[];
}

/** Context the gates compare against — everything injected, nothing fetched. */
export interface GateContext {
  manifest: ClientManifest;
  /** The page's architecture entry (tier decides which claims are allowed). */
  page: ArchitecturePage;
  /** Sibling pages of the same template (boilerplate-ratio denominator). */
  siblings: PageContent[];
  /** Crawled body text of the RANKING incumbents' pages (info-gain baseline). */
  incumbentTexts: string[];
}

export interface QaFailure {
  /** Gate identifier, e.g. "copy-qa", "boilerplate-ratio", "claim-substantiation". */
  gate: string;
  ruleId?: AnyRuleId;
  message: string;
}

export interface QaReport {
  pass: boolean;
  failures: QaFailure[];
}

/**
 * Per-client QA overlay (clients/<slug>/qa-config.json). Generic ai.* slop
 * rules are engine defaults; this adds client vocabulary so the gates work
 * for any client with zero code edits (kills the hardcoded Crescent regex).
 */
export interface QaConfig {
  /** Brand terms allowed to repeat without tripping repetition budgets. */
  brandTerms: string[];
  /** Vertical vocabulary treated as expected (e.g. "panel", "amp", "GFCI"). */
  vocabAllow: string[];
  /** Client-specific banned phrases, merged with brand_constraints.banned_phrases. */
  bannedPhrases: string[];
  /** Regexes (as strings) the copy-qa scanner ignores, e.g. legal boilerplate. */
  ignorePatterns: string[];
  /** Max shared-text ratio vs. siblings before boilerplate-ratio fails (0–1). */
  maxBoilerplateRatio: number;
}

// ---------------------------------------------------------------------------
// Intake — validation + throughput forecast
// ---------------------------------------------------------------------------

export interface ManifestValidationError {
  /** JSON path, e.g. "business.phone_nap". */
  path: string;
  message: string;
  /** WARN entries (e.g. calls-KPI-without-tracking at v0.1) do not reject. */
  severity: "ERROR" | "WARN";
}

export type ManifestValidationResult =
  | { ok: true; manifest: ClientManifest; warnings: ManifestValidationError[] }
  | { ok: false; errors: ManifestValidationError[] };

/** Per-cell stall probability shown before signing (spec §3 validation gate). */
export interface ThroughputForecastCell {
  cell: Cell;
  /** Probability [0,1] that human tasks for this cell go OVERDUE and stall it. */
  stallProbability: number;
  /** Named drivers, e.g. "4 owner-hours/mo across 12 cells needing proof". */
  drivers: string[];
}

export interface ThroughputForecast {
  cells: ThroughputForecastCell[];
  /** Total committed owner minutes per month (hours_per_month * 60). */
  committedMinutesPerMonth: number;
}

// ---------------------------------------------------------------------------
// Plan tracker — capacity rollup (G11)
// ---------------------------------------------------------------------------

export interface CapacityRollup {
  committedMinutesPerMonth: number;
  plannedHumanMinutes: number;
  /** max(0, planned - committed). >0 must surface as an ESCALATION at planning time. */
  overflowMinutes: number;
  ok: boolean;
}

// ---------------------------------------------------------------------------
// Vertical profiles (rules/verticals/*)
// ---------------------------------------------------------------------------

/**
 * Structural vertical knowledge — verticals differ structurally (YMYL,
 * advertising rules, seasonality), not lexically. New vertical intake is a
 * human-expert checkpoint, not a vocab overlay.
 */
export interface VerticalProfile {
  /** e.g. "electrician". */
  verticalId: string;
  /** schema.org type the LocalBusiness node uses, e.g. "Electrician". */
  schemaType: string;
  /** Claim categories requiring local_facts substantiation (feeds G8). */
  regulatedClaimTopics: string[];
  /** Trust elements every page must carry (license number, insurance, etc.). */
  requiredTrustElements: string[];
  /** Intent modifiers for M2 seed expansion ("installation", "repair", "cost"...). */
  intentModifiers: string[];
  /** Month (1–12) → relative demand multiplier for seasonality-aware planning. */
  seasonality: Record<number, number>;
  /** Hard prohibitions, e.g. "testimonials prohibited" in some verticals. */
  prohibitions: string[];
}
