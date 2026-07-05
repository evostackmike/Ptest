# core/CONTRACTS.md — module interface contracts (v0.1)

Every module implements **exactly** the exported signatures below, importing all
shared types from `core/types.js` (never redefining them). Spec references are
to `docs/engine-build-spec.md`. Read SHARED CONVENTIONS (bottom) first.

Type names below are those exported by `core/types.ts`.

---

## 1. `intake/`

```ts
export function validateManifest(raw: unknown): ManifestValidationResult;
export function loadManifest(path: string): ManifestValidationResult;
export function throughputForecast(manifest: ClientManifest): ThroughputForecast;
```

`validateManifest` wraps a zod schema (defined in `intake/manifest.schema.ts`)
that parses into `ClientManifest` and additionally enforces the spec §3 gate:
reject (ERROR) on incomplete NAP, missing `locations.base.lat_lng`, empty
`proof_assets.jobs` AND `will_provide_job_photos.yes === false`, and
`gbp.access_level === "none"` without mitigation; emit a WARN (not reject) for
`primary_kpi === "calls"` with `call_tracking === null` (v0.1 behavior — leave a
`// V05:` note for the blocking upgrade). `loadManifest` reads + JSON-parses the
file and delegates to `validateManifest`; I/O or parse failure returns
`{ ok: false, errors: [...] }`, never throws. `throughputForecast` distributes
`owner_commitments.hours_per_month` across cells that need human labor
(proof-less town×cluster combos, review asks, GBP edits) and returns per-cell
stall probabilities in [0,1] with named drivers — deterministic given the
manifest, no randomness.

## 2. `pipeline/m1-competitors/`

```ts
export function buildRegistry(fixtureDir: string, manifest: ClientManifest): CompetitorRegistry;
export function detectSpamSignals(registry: CompetitorRegistry): CompetitorRegistry;
export function auditCitations(fixtureDir: string, manifest: ClientManifest): CitationIssue[];
```

`buildRegistry` reads frozen SERP fixture JSON from `fixtureDir` (one file per
cell is the suggested layout; document yours in the fixtures README), dedupes
businesses across cells into `RegistryBusiness` entries, and attaches
per-(business × cell × surface) `CompetitorFacet`s including position, review
count/rating, distance-from-centroid, primary category, plus per-cell
`SerpSnapshot`s with furniture flags (LSA present, ads count, directory-stacked).
`detectSpamSignals` is pure: returns a NEW registry with `spamFlags` populated
on facets (name-keyword stuffing vs. `nameKeywords`, address anomalies,
review-burst timing heuristics from fixture review histories) — never mutates
its input. `auditCitations` diffs citation fixtures against manifest NAP and
reports wrong phones/addresses/names, duplicates, and missing listings;
`CITATION_FIX` tasks in M8 are generated from this output.

## 3. `pipeline/m2-keywords/`

```ts
export function expandSeeds(manifest: ClientManifest): string[];
export function validateClusters(
  snapshots: SerpSnapshot[],
  candidates: { query: string; clusterId: string }[]
): { query: string; clusterId: string }[];
export function buildKeywordMap(
  manifest: ClientManifest,
  registry: CompetitorRegistry,
  volumeFixture?: Record<string, number>
): KeywordMap;
```

`expandSeeds` produces candidate queries from clusters × towns × the vertical's
intent modifiers, with `services.do_not_offer` acting as hard negatives (any
candidate containing a do-not-offer term is excluded). `validateClusters`
implements the §18 SERP-overlap rule (≥60% overlap → merge into one cluster,
<30% → split, 30–60% borderline stays put; mega-domains excluded from overlap
counting) and returns the corrected query→cluster assignment. `buildKeywordMap`
applies the market-existence gate using `registry.snapshots` (a pack renders for
the query and/or incumbents maintain pages), sets `volume` only from the
injected fixture where a real number exists — **`volume: null` is never replaced
by an invented number** — leaves `canonicalUrl: null` (M5 assigns it), and
records dropped queries in `skipped` with reasons.

## 4. `pipeline/m3-gbp-observables/`

```ts
export function gbpDiff(registry: CompetitorRegistry, manifest: ClientManifest): GbpGapReport;
export function generateSpotCheckTasks(report: GbpGapReport): Task[];
```

`gbpDiff` covers priority cells (`priority_towns` × `goals.target_clusters_ranked`)
and computes, per cell/head-query, the **per-query** primary-category
distribution of the actual observed pack top-3 (from facets — never a modal
blend across queries) and the review gap (client count from manifest/fixtures
vs. top-3 median). Derive `generatedAt` from the snapshots' `capturedAt`
timestamps — never `Date.now()`. `generateSpotCheckTasks` emits
`owner: "human"` transcription tasks ("open the top 5 profiles for this cell,
transcribe secondary categories/services into the form") — the permanent v0.x
path for fields no API exposes. **Convention: spot-check tasks are
`type: "GBP_EDIT"` with `approval: "none"` and a transcribe-only action string
(they change nothing on the profile).** Any task recommending an actual profile
edit is G13-throttled with `approval: "human_review"` (M8's job, not M3's).
Tasks carry realistic `estimated_human_minutes`, `done_condition.attested`
(completed transcription form), and `provenance.emitted_by: "M3"`.

## 5. `pipeline/m4-feasibility/`

```ts
export function scoreCells(
  manifest: ClientManifest,
  registry: CompetitorRegistry,
  keywordMap: KeywordMap
): CellVerdict[];
export function checkCompliance(town: Town, manifest: ClientManifest): GuardrailResult; // G15
```

`scoreCells` evaluates every cell (towns × clusters, filtered to clusters with
keywords) on both surfaces, calling the pure guardrail functions from
`rules/guardrails.js`. Ordering: G15 fires first (unlicensed state →
`INFEASIBLE`, no further scoring); then empirical G2 (winner-distance
distribution from facets, `drive_time_min` only as a prior when data is thin —
Colfax must NOT be auto-demoted when fixtures show 30-min SABs winning); G3
static count-gap at v0.1 is always `confidence: "LOW"`; G5 market-existence via
the keyword map; suspected-spam incumbents are scored as removable obstacles;
LSA-heavy cells get a discounted band. Deterministic: same inputs → same bands;
outputs are `ProbabilityBand` + `TtwBucket`, never point numbers. Every verdict
carries ≥1 assumption; `INFEASIBLE`/`LONG_HORIZON` get `humanReviewed: false`.
`checkCompliance` is the standalone G15 predicate (also re-exported for rules
consumers): town state ∈ manifest license states.

## 6. `pipeline/m5-architecture/`

```ts
export function buildArchitecture(
  manifest: ClientManifest,
  keywordMap: KeywordMap,
  verdicts: CellVerdict[]
): SiteArchitecture;
```

Maps intents to pages: **one canonical URL per intent** (G7) — many queries per
URL; when two candidate pages claim a query, resolve by rule (more specific
page type wins; service-town beats location beats service hub) and append to
`conflictLog`. Proof gate G6: a service-town/location page gets
`tier: "FULL"` only if `proof_assets.jobs` has ≥2 `permission_to_publish` jobs
for that town×cluster; otherwise `tier: "DEGRADED"` (publishable, no
proof-dependent claims) or `status: "BLOCKED"` with `blockReason` when even
DEGRADED isn't viable (e.g. no `local_facts` for the town). Cells with
`INFEASIBLE` verdicts get no new pages. Priorities follow verdict strength and
`priority_towns`. Also back-fills `KeywordEntry.canonicalUrl` on the returned
architecture's `targetQueries` (return the architecture; do not mutate the
input keyword map).

## 7. `pipeline/m6-content/gates/`

```ts
export function runGates(page: PageContent, context: GateContext, config: QaConfig): QaReport;
export function copyQa(page: PageContent, config: QaConfig): QaFailure[];
export function boilerplateRatio(page: PageContent, context: GateContext, config: QaConfig): QaFailure[];
export function infoGain(page: PageContent, context: GateContext): QaFailure[];
export function claimSubstantiation(page: PageContent, context: GateContext): QaFailure[];
export function faqUnique(page: PageContent, context: GateContext): QaFailure[];
```

`runGates` runs all five and aggregates (`pass` = zero failures). `copyQa`
ports the 14 generic ai.* slop rules from Crescent's `copy-qa.mjs` as engine
defaults, with ALL client vocabulary coming from `QaConfig` (no hardcoded
brand/vertical regex — a plumbing client must pass with zero code edits).
`boilerplateRatio` caps shared n-gram text vs. `context.siblings` at
`config.maxBoilerplateRatio`. `infoGain` compares against
`context.incumbentTexts` (the RANKING pages, not siblings): the page must add
local information, not merely avoid overlap — at v0.1 a defensible heuristic
(unique local-entity/fact mentions absent from incumbents) is acceptable;
mark refinements `// V05:`. `claimSubstantiation` (G8) flags superlatives,
numbers, and regulatory/local-factual claims (permit, code, utility, licensing
patterns) that do not resolve to a manifest `local_facts` entry matching the
page's town/cluster — failure means the generator must write around the topic.
`faqUnique` fails FAQs duplicated (near-verbatim) across siblings. DEGRADED-tier
pages (`context.page.tier`) additionally fail on any proof-dependent claim
("jobs we've done in X").

## 8. `pipeline/m8-offsite/`

```ts
export function generateOffsiteQueue(
  manifest: ClientManifest,
  verdicts: CellVerdict[],
  gbpReport: GbpGapReport,
  registry: CompetitorRegistry,
  citationIssues: CitationIssue[],
  now: string // ISO timestamp for task ids/provenance — no Date.now() inside
): Task[];
```

Ordering rules: every `CITATION_FIX` (from `citationIssues`) precedes any
`CITATION` (fix tasks appear first and citations `depends_on` them); pack
levers (GBP tasks, review program, citations) ship in wave 1 for
`WINNABLE_PACK` cells. GBP tasks are G13-throttled: at most one structural
edit per 7–14-day window — express the spacing via `depends_on` chains, and
structural edits get `approval: "human_review"`; primary-category changes are
never emitted as tasks. Review-ask tasks are TOS-safe (G10): done condition is
**asks sent** (attested), never review content; no gating language in actions.
`SPAM_REPORT` tasks are emitted for registry facets with `spamFlags`, as
evidence-gathering with `approval: "human_review"`. Total
`estimated_human_minutes` per month must fit
`owner_commitments.hours_per_month * 60` (G11) — overflow becomes a single
honest `ESCALATION` task, not silently-dropped or over-emitted work.
`link_outreach: false` → zero LINK tasks.

## 9. `plan/`

```ts
// plan/task.schema.ts
export const taskSchema: z.ZodType<Task>;
export const planFileSchema: z.ZodType<PlanFile>;

// plan/tracker.ts
export class Tracker {
  constructor(plan: PlanFile);
  static load(path: string): { ok: true; tracker: Tracker } | { ok: false; errors: string[] };
  save(path: string): { ok: true } | { ok: false; errors: string[] };
  get plan(): PlanFile;
  transition(taskId: string, to: TaskStatus, now: string):
    { ok: true; task: Task } | { ok: false; reason: string };
  dependenciesMet(taskId: string): boolean;
  detectOverdue(now: string, maxAgeDays?: number): Task[];
}
export function capacityRollup(tasks: Task[], manifest: ClientManifest): CapacityRollup;
```

The zod schemas validate the exact §5 shape (snake_case) into `Task`/`PlanFile`.
`transition` enforces legal moves (e.g. `BLOCKED → IN_PROGRESS` only when
`dependenciesMet`; `DONE → VERIFIED` only; anything → `UNKNOWN` allowed when
min_data is unmet) and returns a domain failure, never throws, on illegal
transitions. `detectOverdue` flags human tasks stuck in
`PLANNED`/`IN_PROGRESS` beyond the window (v0.1: age heuristic from provenance
run timestamps or an explicit `now` diff; escalation *automation* is v0.5 —
`// V05:`). `capacityRollup` sums `estimated_human_minutes` of open
human-owner tasks against committed capacity (G11).

## 10. `loop/`

```ts
// loop/store.ts
export class MetricsStore {
  constructor(dbPath: string); // node:sqlite DatabaseSync; ":memory:" allowed in tests
  ingestGsc(rows: GscMetricsRow[]): { ok: true; inserted: number } | { ok: false; errors: string[] };
  ingestScan(scan: GeogridScan): { ok: true; quality: ScanQuality } | { ok: false; errors: string[] };
  ingestReviews(rows: ReviewLedgerRow[]): { ok: true; inserted: number } | { ok: false; errors: string[] };
  ingestLiveness(row: GbpLivenessRow): { ok: true; hardStop: boolean } | { ok: false; errors: string[] };
  scansFor(cell: Cell, limit: number): GeogridScan[]; // newest first
  close(): void;
}

// loop/collectors/*.ts — one per source, all fixture-driven:
export function collectGsc(fixturePath: string): { ok: true; rows: GscMetricsRow[] } | { ok: false; errors: string[] };
export function collectGeogrid(fixturePath: string): { ok: true; scans: GeogridScan[] } | { ok: false; errors: string[] };
export function collectReviews(fixturePath: string): { ok: true; rows: ReviewLedgerRow[] } | { ok: false; errors: string[] };
export function collectGbpLiveness(fixturePath: string): { ok: true; row: GbpLivenessRow } | { ok: false; errors: string[] };

// loop/goal-check.ts
export function goalCheck(store: MetricsStore, cell: Cell, surface: Surface): GoalCheckResult;
```

Collectors parse fixture exports (GSC CSV or JSON; geogrid scan JSON; review
snapshots) and validate with zod; malformed input is a domain failure.
**Feed health lives in `collectGeogrid`/`ingestScan`:** a scan with >30%
empty-pack pins (or schema mismatch) is marked `QUARANTINED` — stored, but
excluded from every downstream query. `ingestLiveness` returns
`hardStop: true` when `profileVisible === false` (R12: suspected suspension).
Ingestion is idempotent (re-ingesting the same rows/scan ids does not
double-count). `goalCheck` implements `PACK_WON`: client in pack top-3 at ≥70%
of pins for the head keywords in **≥8 of the last 10 VALID scans** — quarantined
scans are skipped, not counted as misses, and a scan gap shrinks the window
rather than failing it (fewer than 8 valid scans on record → `won: false` with
reason "insufficient valid scans"). Lead-floor conditions are `// V05:` (no
call-tracking data at v0.1).

## 11. `rules/`

```ts
// rules/guardrails.ts — one pure function per applicable G-rule, all → GuardrailResult
export function g2ProximityCeiling(cell: Cell, winnerDistancesMiles: number[], driveTimeMin: number): GuardrailResult;
export function g3ReviewRealism(clientCount: number, top3Counts: number[], ledgerMature: boolean): GuardrailResult;
export function g5DemandGate(entry: KeywordEntry): GuardrailResult;
export function g6ProofGate(cell: Cell, jobs: ProofJob[]): GuardrailResult;
export function g7CanonicalUrl(query: string, owningUrls: string[]): GuardrailResult;
export function g8ClaimCheck(claim: string, cell: Cell, facts: LocalFact[]): GuardrailResult;
export function g11CapacityCeiling(rollup: CapacityRollup): GuardrailResult;
export function g13GbpThrottle(lastStructuralEditAt: string | null, proposedAt: string, minDays?: number): GuardrailResult;
export function g14PublishPacing(domainAgeMonths: number, pagesThisWeek: number): GuardrailResult;
export function g15Licensing(townState: string, licenses: License[]): GuardrailResult;

// rules/signals-actions.ts — one predicate per R-rule, r1..r13.
export interface SignalResult { fired: boolean; ruleId: RuleId; reason: string; }
// Each takes the minimal metrics-row slice its predicate needs and returns
// SignalResult. Representative signatures (define analogous ones for the rest):
export function r3DemandRevalidate(rows: GscMetricsRow[], indexedWeeks: number): SignalResult;
export function r4IndexationAlarm(pageAgeWeeks: number, indexed: boolean, domainAgeMonths: number): SignalResult;
export function r10ProofUnblock(job: ProofJob, pages: ArchitecturePage[]): SignalResult;
export function r12GbpLiveness(latest: GbpLivenessRow | null): SignalResult;
export function r13FeedAnomaly(scan: GeogridScan): SignalResult;
// v0.1 must implement R3, R4, R10, R12, R13 with real logic; r1/r2/r5–r9/r11
// may be stubs returning { fired: false } with a // V05: note.

// rules/verticals/electrician.ts
export const electricianProfile: VerticalProfile;
```

Every guardrail is pure and total: no I/O, no clock, no throw; `ok: false`
means the guardrail FIRES (blocks). `g2` derives the ceiling empirically from
`winnerDistancesMiles` (e.g. fire only when the cell's distance exceeds the
observed winner max by a margin) and falls back to a drive-time prior only when
the distribution has <3 observations. `g3` with `ledgerMature: false` must
include "low-confidence static count-gap" in its `reason`. `g13` measures
whole days between timestamps passed by the caller. Keep every threshold a
named exported constant so M4/M8 cite the same numbers.

## 12. `templates/site/`

```ts
// templates/site/content-model.ts — generalized from Crescent's _data.ts:
export interface ProofItem { jobId: string; town: string; cluster: string; photos: string[]; description: string; }
export interface LocalFaqItem { q: string; a: string; }
export interface ServiceData { /* Crescent's ServiceData, de-branded: slug, name,
  metaTitle, metaDescription, h1, heroLead, heroParagraph, pitchBody, subTitle,
  subIntro, subItems[], cityProcessTitle, cityProcessBody, faq[], relatedServices[] */ }
export interface LocationData { /* Crescent's LocationData + tier: PageTier,
  proofItems: ProofItem[], localFaq: LocalFaqItem[] */ }

// templates/site/create-site.ts
export function createSite(
  manifest: ClientManifest,
  architecture: SiteArchitecture,
  outDir: string
): { ok: true; pagesWritten: number } | { ok: false; errors: string[] };
```

`content-model.ts` owns `ServiceData`/`LocationData` (they are template-layer
types, NOT in core/types.ts) — copy the field lists from
`/workspace/crescent-electric/app/{services,locations}/_data.ts` and extend
`LocationData` with `tier`, `proofItems`, `localFaq`; strip every Crescent
constant (phones, brand names) — all NAP/booking data flows from the manifest
at render time. `createSite` scaffolds a Next.js site into `outDir`: copies
`templates/site/components/` and `next-boilerplate/` verbatim (both are
excluded from the engine tsconfig), writes manifest-driven config/data files,
and emits one data stub per `ArchitecturePage` with `status !== "BLOCKED"`,
honoring tier (DEGRADED pages get no proof sections). Pure-ish: only writes
under `outDir`.

---

## SHARED CONVENTIONS (binding on all modules)

1. **Imports.** `module: NodeNext` — every relative import uses the `.js`
   suffix: `import type { Task } from "../../core/types.js";`. Import types
   with `import type` where possible.

2. **Dependencies.** zod + Node builtins ONLY (`node:fs`, `node:path`,
   `node:sqlite`, …). Never edit `package.json` / `tsconfig.json` /
   `vitest.config.ts`.

3. **Fixtures.** Every external data source (DataForSEO SERP/Business Data,
   GSC, GBP) is consumed as fixture JSON on disk, injected by path
   (`fixtureDir`/`fixturePath` params). Fixtures live in
   `<your-module>/fixtures/*.json`. Tests never touch the network. Include a
   short `fixtures/README.md` documenting each file's provenance/shape.

4. **Error style.** Domain failures are values:
   `{ ok: true, ... } | { ok: false, errors|reason }`. Reserve `throw` for
   programmer errors (violated invariants) only. zod parse failures on external
   input are domain failures — catch and convert.

5. **Time.** Pure functions never call `Date.now()`/`new Date()` — callers
   pass ISO-8601 timestamps (`now: string`). Only CLI/entrypoint code may read
   the clock. This keeps every module deterministic and fixture-testable.

6. **Determinism.** Same inputs → same outputs everywhere. No `Math.random()`;
   generated ids derive from content (slugs, counters), not randomness.

7. **Mutation.** Functions return new values; never mutate a parameter
   (registries, keyword maps, plans are treated as immutable inputs).

8. **Zod placement.** `core/types.ts` is types-only. Each module owning an
   on-disk artifact defines the zod validator for it (intake → manifest,
   plan → task/plan, m1 → registry fixtures, loop → metrics fixtures) and the
   validator's output type must be assignable to the core type — add a
   compile-time check like `const _check: ClientManifest = schema.parse(x)` in
   a test.

9. **Casing.** JSON-artifact types keep spec snake_case (`Task`, `PlanFile`,
   `ClientManifest`); derived in-memory types are camelCase. Do not "fix" this.

10. **Tests.** Colocated `*.test.ts`, vitest, real assertions on behavior
    (values in → values out), no network, no `expect(fn).not.toThrow()`-only
    tests. Run `npx vitest run <your-dir>` green before finishing, then confirm
    `npx tsc --noEmit` shows no errors in your files.

11. **Deferred work.** Where a v0.1 cut is specified (escalation automation,
    lead floors, genspec compilation, velocity-mode G3), implement the v0.1
    behavior and mark the upgrade point with a `// V05:` comment.
