# Page Brief Specification — `docs/page-brief-spec.md`

**Module:** M5.5 — brief generator. `pipeline/m5-architecture/page-briefs.ts`, entry `buildPageBriefs(architecture, keywordMap, registry, manifest, vertical, qaConfig): PageBrief[]`. Sits between M5 architecture and M6 generation.
**Artifact:** `clients/<slug>/runs/<run_id>/page-briefs.json`, validated by `page-briefs.schema.ts` (zod parses into the `core/types.ts` interfaces below).
**Status:** merged from Design A (page anatomy) + Design B (derivation & schema), then **hardened by red-team review**. Design-merge resolutions are footnoted **[R1]–[R8]**; red-team resolutions are footnoted **[RT1]–[RT14]**; both are collected in §8.

---

## 1. Purpose and consumers

The engine's answer to the operator question: *"recommended pages to build for organic — what goes on each one, what keywords, what details?"*

One brief per **non-LIVE** `ArchitecturePage` **[R3]**:

- `PLANNED` pages → the brief is a complete, buildable generation contract.
- `BLOCKED` pages → the brief exists chiefly for its `inputGaps`: it documents exactly what unblocks the page (the operator-report answer to "what do you need from me").
- `LIVE` pages get no brief; DEGRADED→FULL upgrades (R10) get a regenerated brief on the next M5 pass.

Three consumers:

1. **M6 (`generate-page.ts`)** — the brief IS the generation contract, injected alongside `GateContext`. The generator may not introduce queries, claims, facts, sections, or media not licensed by the brief. Because the brief and the M6 gates derive from the same artifacts, a brief-conforming page passes info-gain and claim-substantiation by construction; gate failures indicate generator drift, not spec ambiguity. **The gates also measure what the brief can only claim:** the `sibling-similarity` gate (§6) compares the *rendered text* of sibling pages — `uniqueToPage` is a claim the gate falsifies, never a self-certifying flag **[RT1]**.
2. **Operator report** — "Recommended Pages" section: per page, *why it's recommended, what goes on it, what we need from you*. (v0.1: the JSON artifact is the deliverable; renderers are v0.5.)
3. **`plan.json`** — each `PAGE_BUILD` task references its brief (`action` carries `per brief runs/<run_id>/page-briefs.json#<briefId>`); `gate_checks := brief.gates`; `done_condition := brief.doneCondition`; each `inputGaps` entry becomes a task the PAGE_BUILD depends on.

**The one law:** briefs are **derived, never invented**. Every field traces to an engine artifact — keyword map (M2), competitor registry incl. incumbent page crawls (M1), manifest `local_facts`/`proof_assets`, vertical profile, `qa-config`, or the architecture itself. A brief field with no artifact source is a bug, not creative latitude. **The one honest exemption:** `BriefIncumbent.analystNotes` is a provenance-flagged hand-entered channel that is *report-only* — it never licenses generation content (**[RT11]**, §4.2). Guardrail bindings throughout: G5 (no invented volumes), G6 (proof tiers), G7 (one URL per intent), G8 (no unsourced claims), G9 (single LocalBusiness `@id`), G14 (info-gain vs ranking incumbents + no scaled sibling boilerplate).

**The second law (post-red-team):** the brief never asks the generator to write more words than its sources license. Every doorway-risk brief carries a quantitative **claim-mass preflight** (§4.3): licensed claim words × expansion factor bound the unique-word floor, and a page whose verified sources cannot sustain a minimum-viable page is **BLOCKED**, not padded. A short true page beats a long padded one **[RT4]**.

---

## 2. The `PageBrief` interface

Engine-internal derived type → camelCase, added to `core/types.ts` next to the M5 block **[R1]**. No zod here; `page-briefs.schema.ts` validates the on-disk artifact into these types. No `Date.now()` — `provenance.generatedAt` copies `architecture.generatedAt`.

```ts
// ---------------------------------------------------------------------------
// M5.5 — page briefs (generation contract for every non-LIVE architecture page)
// ---------------------------------------------------------------------------

/** Where a brief datum came from. Briefs are DERIVED — every field cites its source artifact. */
export type BriefSource =
  | "keyword-map"        // M2 KeywordEntry
  | "incumbent-crawl"    // M1 crawled incumbent page text
  | "serp-snapshot"      // M1 SerpSnapshot / furniture
  | "manifest"           // ClientManifest field (business, licenses, proof, ...)
  | "local-facts"        // manifest.local_facts entry
  | "vertical-profile"   // rules/verticals/<id>.ts (structural knowledge only — no vocab lives here)
  | "qa-config"          // clients/<slug>/qa-config.json (vocabAllow is the ONLY vocab source) [RT11]
  | "architecture";      // M5 ArchitecturePage

/** Query intent, classified against vertical.intentModifiers (never guessed per-query). */
export type KeywordIntent = "hire" | "cost" | "emergency" | "compare" | "info";

export interface BriefKeyword {
  query: string;
  /** Real vendor volume or null — null is NEVER backfilled with an estimate (G5).
   *  Reports render null as "volume: no reliable data", never a guess. */
  volume: number | null;
  /** M2 market-existence gate result, carried so reports can justify null-volume targets. */
  marketExists: boolean;
  intent: KeywordIntent;
  source: BriefSource;
}

/** Named things the page must mention to match incumbent topical coverage (not queries). */
export interface BriefEntity {
  entity: string;                       // e.g. "200-amp service", "Whitman County", "FPE/Zinsco"
  source: BriefSource;                  // "incumbent-crawl" | "local-facts" | "manifest" | "qa-config"
  sourceRef: string;                    // fact_id, businessId, manifest JSON path, or "qa-config.vocabAllow"
}

export interface BriefKeywords {
  primary: BriefKeyword;                // the ONE query the H1/title carry (G7 intent owner)
  secondaries: BriefKeyword[];          // ≤5, each assigned to exactly one section (structural split, §4.1) [RT9]
  longTails: BriefKeyword[];            // token-superset queries from the map only — the brief never mints queries
  /** Queries this URL owns (G7) but that get NO placement slot — overflow past the
   *  secondary/long-tail capacity. Owned-not-placed; never silently dropped. [RT9] */
  unassigned: string[];
  entities: BriefEntity[];              // sprinkled naturally, never sectioned; no volume, ever
}

/** Structured section instruction — purpose is ASSEMBLED, never free prose. A hand-authored
 *  purpose string was the red team's G8 bypass channel; this closes it. [RT6] */
export interface BriefSectionPurpose {
  /** Verbatim instruction text from templates/site/<templateId>.meta — byte-equal to template
   *  metadata, never authored per-brief. Slots ({town}, {clusterLabel}) are the only variance. */
  instruction: string;
  /** local_facts the instruction licenses the section to state (⊆ localFactsRequired ∪
   *  state-fact summarize+link refs, §4.3). */
  factRefs: string[];
  /** Manifest JSON paths whose VALUES may be stated (drive_time_min, license number, owner name).
   *  First-party process claims ("we file the permit") are NOT free — they must resolve to a
   *  license-holder-attested local_facts entry or a manifest process-claim field. [RT6] */
  manifestRefs: string[];
}

export interface BriefSection {
  /** Slot id stable across runs, e.g. "whats-different-here", "local-permits", "proof-jobs". */
  sectionId: string;
  heading: string;                      // H2/H3 pattern; may contain {town}/{clusterLabel} slots
  purpose: BriefSectionPurpose;         // structured, enumerable — no free-text claim channel [RT6]
  wordBudget: { min: number; max: number };
  /** Queries from BriefKeywords assigned to THIS section (each query → exactly one section). */
  keywordsAssigned: string[];
  /** local_facts fact_ids the section MUST draw from; empty ⇒ no regulated claims allowed here (G8). */
  localFactsRequired: string[];
  /** ProofJob.job_id refs rendered here; only ever non-empty on FULL-tier pages (G6). */
  proofRefs: string[];
  /** True for sections injected from vertical.requiredTrustElements — generator may not drop them. */
  mandatory: boolean;
  /** A CLAIM that this section's words could not move to a sibling town's page unchanged.
   *  M6's sibling-similarity gate FALSIFIES it against rendered sibling text (shingle overlap
   *  ≤0.30 after town-token normalization) — the flag alone proves nothing. [RT1] */
  uniqueToPage: boolean;
  mustNot?: string[];                   // explicit prohibitions scoped to this section
}

export type FaqSeedSource =
  | { kind: "vertical"; modifier: string }                        // intentModifier × cluster template
  | { kind: "local-fact"; factId: string }                        // fact rephrased as Q&A
  | { kind: "manifest"; path: string }                            // answered from a manifest value (drive time, service area, booking) [RT5]
  | { kind: "proof-job"; jobId: string }                          // grounded in a real job (FULL only)
  | { kind: "incumbent-gap"; businessId: string; topic: string }; // v0.5 ONLY — needs topic classifiers v0.1 lacks [RT14c]

export interface BriefFaq {
  question: string;
  sourcedFrom: FaqSeedSource;
  /** fact_ids the ANSWER may state as fact. Empty is allowed ONLY for topics off
   *  vertical.regulatedClaimTopics; on DEGRADED cells "experience" is additionally struck
   *  from the permitted answer basis (zero town jobs ⇒ zero town experience claims). [RT5] */
  answerFactRefs: string[];
}

export interface BriefSchemaBlock {
  /** "Service" | "FAQPage" | "BreadcrumbList" | "LocalBusinessRef" | "Article" — ref, never a second node (G9). */
  type: string;
  wiring: string;                       // e.g. "Service.provider → LocalBusiness @id; areaServed = {town}"
}

export interface BriefLink {
  url: string;
  /** Anchor = target page's primary query (title-cased). Sitewide dedup/rotation is v0.5. [RT14b] */
  anchor: string;
  reason: string;                       // "hub→spoke", "parent-service", "cross-sell ev→panel", ...
}

export interface BriefIncumbent {
  businessId: string;                   // registry ref
  name: string;
  /** The specific RANKING page = SerpSnapshot.organicTop10[].rankingUrl (see registry
   *  extension below) — never guessed from websiteUrl. [RT12] */
  url: string;
  /** From SerpSnapshot.organicTop10; null when the registry is manual/pre-fixture (v0.1). [R4] */
  organicPosition: number | null;
  /** Topics observed on their page, LIMITED to what the v0.1 extractor actually produces:
   *  the six binary section classifiers + normalized heading topic tags. Nothing richer. [RT11] */
  whatTheyHave: string[];
  /** Info-gain targets: topics WE can substantiate that this incumbent does not cover.
   *  NEVER aspirational, never "architecture"-sourced (circular) — every entry carries the
   *  local-facts / manifest / proof ref proving we can write it (G14, G8). [RT11] */
  whatTheyLack: { topic: string; ourSource: BriefSource; sourceRef: string }[];
  /** Hand-entered analyst observations (v0.1 manual registry reality). Provenance-flagged and
   *  REPORT-ONLY: rendered for the operator, never a generation license, exempt from the
   *  derived-law as the one labeled exemption. Shrinks as v0.5 classifiers improve. [RT11] */
  analystNotes?: { note: string; enteredBy: string; date: string }[];
}

/** A required input the engine does NOT have. The anti-hallucination valve: the brief never
 *  leaves an empty slot for the generator to fill — it emits an owner question instead. */
export interface BriefInputGap {
  kind: "FACT_COLLECT" | "PROOF_COLLECT";   // FACT_COLLECT: proposed TaskType addition (§6, [R5])
  ownerQuestion: string;                    // the literal question to put in front of the owner
  topic: string;                            // regulated topic (vertical.regulatedClaimTopics) or "proof-jobs"
  /** sectionIds AND "faq:<slug>" ids suppressed until the gap closes. An FAQ whose topic
   *  matches an open FACT_COLLECT is EXCLUDED from the brief and listed here — the generator
   *  is never asked to answer a question whose ground truth is flagged uncollected. [RT5] */
  blockedSlots: string[];
  resolution: string;                       // what closes it, machine-checkable phrasing
}

export interface BriefMedia {
  type: string;                             // v0.1: "job-photo" (FULL) | "generic-real-photo" (DEGRADED stub) [RT14e]
  required: boolean;
  /** e.g. "[work item] — [town, state] — [business name]". Stock imagery is never required and the
   *  brief never claims a photo exists that the manifest doesn't hold. */
  altPattern: string;
  source: "proof_assets" | "owner_task";    // owner_task ⇒ a paired inputGap/task exists
}

/** Quantitative claim-mass preflight — present on doorway-risk types (service-town, location).
 *  Word minimums may never exceed what verified sources license the generator to write. [RT4] */
export interface BriefPreflight {
  /** Σ words across applicable town/county-scoped fact claims + publishable proof-job
   *  descriptions for this cell. State-scoped facts contribute the link allowance only. */
  licensedClaimWords: number;
  /** licensedClaimWords × 5 (claim + explanation + implication + question form is legitimate
   *  elaboration) + 40 per applicable state-scoped fact (summarize+link allowance, §4.3). */
  supportableUniqueWords: number;
  /** clamp(supportableUniqueWords, 300, templateUniqueFloor). supportable < 300 ⇒ page BLOCKED. */
  uniqueWordFloor: number;
  /** Budget feasibility (§4.5): Σ section mins ≤ 0.85 × totalMax AND
   *  uniqueCeiling − uniqueWordFloor ≥ 80. false ⇒ loud build failure, never a shipped brief. [RT13] */
  feasible: boolean;
}

export interface PageBrief {
  /** Stable id for task references: "brief:" + url. */
  briefId: string;

  // ---- identity (verbatim from ArchitecturePage — the brief never re-decides these)
  url: string;
  pageType: PageType;
  tier: PageTier;
  cell: { town: string | null; cluster: string | null };  // null for hub/core/town-less pages
  templateId: string;
  priority: number;
  status: PageStatus;                       // PLANNED | BLOCKED (LIVE pages get no brief)
  blockReason?: string;

  // ---- content contract
  keywords: BriefKeywords;
  /** Derived from preflight where present (doorway-risk types): totalMax = uniqueWordFloor / 0.6
   *  rounded to 10; template norms bound non-tiered types (§4.5). Never template-norm × flat cut. */
  totalWordBudget: { min: number; max: number };
  preflight?: BriefPreflight;               // REQUIRED for service-town & location [RT4]
  outline: BriefSection[];
  faq: BriefFaq[];                          // 3–6 seeds; faq-unique gate scope = ALL briefs sharing
                                            //   the town (any type) + parent, town-slug-normalized [RT2][RT10]
  schemaBlocks: BriefSchemaBlock[];
  /** OUTBOUND only at v0.1 — inbound is a derivable report-renderer join (v0.5), not N stale copies. [RT14a] */
  internalLinks: { outbound: BriefLink[] };
  incumbents: BriefIncumbent[];             // top-3 ranking organic incumbents for the primary query's cell
  meta: {
    h1Pattern: string;                      // voice-guide H1 rule: descriptor / credential-first /
                                            //   question-hook / benefit+geo — never keyword-strings
    titlePattern: string;                   // "{primary} | {business.legal_name}", ≤60 chars resolved
    descriptionPattern: string;             // primary + one trust element + {phone_nap} token — never a literal phone.
                                            //   Every claim in it resolves to a fact/manifest ref like body copy. [RT6]
  };
  cta: { count: number; positions: string[]; primaryAction: "call" | "book" };
  media: BriefMedia[];

  // ---- constraints & completion
  gates: GuardrailId[];                     // copied verbatim into the PAGE_BUILD task's gate_checks
  /** Hard prohibitions: vertical.prohibitions + brand_constraints.banned_phrases + tier-derived. */
  prohibitions: string[];
  /** Present when tier=DEGRADED: which FULL sections were dropped/replaced, mechanically (§3.1). */
  degradedDeltasApplied: string[];
  inputGaps: BriefInputGap[];
  doneCondition: DoneCondition;             // reused from plan schema; copied into the PAGE_BUILD task

  // ---- provenance
  provenance: {
    generatedAt: string;                    // = architecture.generatedAt (deterministic)
    runId?: string;
    sourceArtifacts: string[];              // e.g. ["keyword-map@runs/r-012", "competitor-registry@runs/r-012"]
  };
}
```

### Required `core/types.ts` extensions (all proposed as one PR alongside the PageBrief block)

```ts
/** M1 crawl of one incumbent RANKING page (M6's info-gain gate already consumes these texts). */
export interface IncumbentPageCrawl {
  url: string;
  /** The page's OWN geographic/service targeting as crawled — informational only. Crawl
   *  relevance to a brief is keyed by rankingUrl match, NOT by this label: Cheetah's
   *  /panel-upgrades-moscow/ ranks for Pullman queries and must reach the Pullman brief. [RT12] */
  cell: Cell;
  headings: string[];                       // ordered H1/H2/H3 text
  bodyText: string;                         // rendered plain text
  crawledAt: string;
}
// RegistryBusiness gains: crawledPages?: IncumbentPageCrawl[];

// SerpSnapshot.organicTop10 changes shape (one line, same spirit as the R4 nullable fix):
//   organicTop10: { businessId: string; rankingUrl: string | null }[];
// v0.1 hand-assembled registries supply rankingUrl manually; null = position-only observation. [RT12]

// LocalFact gains TWO fields — REQUIRED at v0.1, they are the anti-madlib load-bearers: [RT2][RT7]
//   /** Geographic scope of the claim. Only town/county-scoped facts count toward the
//    *  mandatory-local sets (§3.3/§3.4), uniqueToPage word credit, and claim-mass preflight.
//    *  State-scoped facts render ONCE on the parent service page and are summarized+linked
//    *  elsewhere (≤40 words) — never restated per-town as fake localization. */
//   scope: "town" | "county" | "state";
//   /** Typed provenance. "attestation" facts may flavor non-regulated sections but may NOT be
//    *  the sole basis for a regulated-topic section (permits/code/utility) — those need a URL
//    *  or a license-holder professional statement about their own practice. The operator report
//    *  surfaces the url/attestation split. */
//   provenance: "url" | "attestation";
// Backfill derivation for existing manifests: provenance = source starts with "http" ? "url"
//   : "attestation"; scope = towns.length > 0 ? "town" : "state" (county set by intake forward).

// TaskType gains "FACT_COLLECT" (proposed; v0.1 fallback per [R5] below).
```

### Universal rules (all page types)

**Keyword placement (fixed):** primary query or its close natural variant in **H1, title (front-loaded), meta description, first 100 words, one H2** — never verbatim-stuffed when the natural variant reads better (voice-guide H1 rule; the JCS keyword-string city-list anti-pattern is banned). Each secondary owns exactly one H2/H3; each long-tail owns one FAQ question or H3; `unassigned` queries get no placement (owned for G7 only); entities are sprinkled, not sectioned.

**E-E-A-T baseline:** license number **in body copy** (voice-guide: "Lic# CRESCLE781QD" style, not footer-only) — pulled by manifest path, never hardcoded; owner named where `entity.owner_names` permits; founding year; first-person plural ("We pull the permit" — only where a license-holder-attested process claim exists **[RT6]**), never "our team of experts"; footer carries full license/bond/insurance per `vertical.requiredTrustElements`.

**CTA baseline:** minimum 3 (hero, mid-page after cost/benefits, post-FAQ), 4–5 on pages >1,500 words; phone + button paired; mobile sticky tap-to-call. `primaryAction`: manifest `booking_url` present ⇒ `"book"` (button + phone), else `"call"`.

**Media baseline:** real photos only — from `proof_assets.jobs[].photos` or an emitted owner photo task. Alt pattern `"[work item] — [town, state] — [business name]"`. WebP, lazy-load. v0.1 the media block is at most one entry **[RT14e]**.

**Schema baseline (G9):** every block references the single sitewide `LocalBusiness` node by stable `@id` — no per-page re-declaration. `FAQPage` carries exactly the FAQs rendered on-page. No self-serving `Review`/`AggregateRating` markup (G10). SAB stays SAB: no fake local `address` on location pages.

**Voice:** per voice-guide — symptom-first openings, named parts and code articles, cost ranges named directly **but cost sections require owner sign-off** (§6 checkpoint); if the owner declines pricing (as Crescent's owner did), the cost H2 is replaced by a "what drives the price" variables section with no numbers. Banned-phrase list enforced by copy-qa.

---

## 3. Per-page-type anatomy

### 3.1 DEGRADED tier — the general delta

Applies to any page whose town×cluster lacks ≥2 publishable jobs (G6). Deltas are applied **mechanically** and recorded in `degradedDeltasApplied`:

| FULL element | DEGRADED replacement |
|---|---|
| "Recent [service] jobs in [Town]" section w/ photos | **Dropped entirely.** No "jobs we've done in X", no implied volume ("we've upgraded dozens of panels in Pullman"), no fabricated testimonials |
| Proof-backed claims (counts, named streets, "we recently…") | Written around; claims restricted to capability + verified local facts |
| Job photos + alt text | Generic-real photos only (owner's van/tools, with permission, **without town attribution**), or no imagery; PROOF_COLLECT gap paired |
| Testimonial pull quotes for that town | Region-level real reviews only, honestly attributed, never town-relabeled |
| "Experience" as an FAQ answer basis | **Struck** — zero jobs in the town means zero town-experience claims; answers are capability/process only **[RT5]** |
| Word budget | **Recomputed from claim mass** (§4.3/§4.5): `uniqueWordFloor = clamp(supportable, 300, templateFloor)`, `totalMax = floor / 0.6`. Never a flat percentage cut, never a floor the sources can't sustain — padding is boilerplate G14 flags **[RT4]**, supersedes [R6] |
| Info-gain source | Shifts entirely to **town/county-scoped verified local facts** (permit authority, utility, housing stock, climate) — the only legitimate uniqueness source without proof; state-scoped facts do not count **[RT2]** |

Every DEGRADED brief carries the paired `PROOF_COLLECT` gap and the note that R10 auto-upgrades it.

**Preflight rule [R2] + [RT4], now quantitative:** for the doorway-risk types (**service-town, location**), compute the claim-mass preflight (§4.3). If `supportableUniqueWords < 300` — i.e., the town/county-scoped fact + proof mass cannot honestly sustain a minimum-viable page — the brief does **not** authorize a build: `status` stays/becomes `BLOCKED`, the brief consists chiefly of its `inputGaps` (each naming the facts/proof that would close the word deficit), and M5 planning the page at all is reported as a warning. Fact *existence* alone never passes preflight; fact *mass* does. For **service, hub, guide, core**, an empty incumbent-diff builds anyway with section instructions reading "match coverage; differentiation is proof/trust density" and a low-info-gain flag in the report.

### 3.2 SERVICE page (`/services/<cluster>`) — template `service-v1`

The cluster's canonical regional hub. Owns non-geo and region-modified queries ("electrical panel upgrade", "panel upgrade cost", "… palouse"). H1: `[Service] in [Region/City pair]` or credential-first (live Crescent example, correct pattern: "Electrical Panel Upgrades in Moscow & Pullman"). **This is also where every applicable state-scoped fact renders in full** — town pages summarize+link, never restate **[RT2]**.

| # | sectionId | H2 pattern | Purpose | Words | Notes |
|---|---|---|---|---|---|
| 1 | `hero` | H1 + intro + CTA + trust | Primary keyword above fold; symptom-first intro; license + years visible | 50–80 | mandatory |
| 2 | `signs-or-types` | Signs You Need [Service] / What Is It / Types | Problem-awareness or education — **order per service-specific template** (panel, EV, lighting, hot-tub, generator, battery, surge each have a documented order in page-templates.md) | 150–250 | |
| 3 | `whats-included` | What's Included | Scope grid; secondaries land here as H3s ("subpanel installation", "meter base replacement") | 150–300 | |
| 4 | `process` | Our Process | Numbered steps incl. **permit + inspection as named steps**; "who files" claims require a license-holder-attested process fact **[RT6]** | 100–200 | |
| 5 | `cost` | Cost / What Drives the Price | **Middle third, never top, never hidden.** Cost-anchor pattern (range → variance drivers → outlier explanation → permit as line item). Owner sign-off gate; numbers only owner-verified; declined ⇒ variables-only variant | 150–250 | |
| 6 | `benefits` | Benefits / Why It Matters | Safety, resale, EV/solar readiness | 100–200 | |
| 7 | `proof-jobs` | Recent [service] work | **FULL only (G6).** 2–3 jobs w/ photos, town + what was done | 100–150 | dropped at DEGRADED |
| 8 | `why-us` | Why Choose [Business] | License #, owner, real differentiators only (G8) | 75–150 | mandatory |
| 9 | `faq` | FAQ | 4–6 questions (sourcing mix below) | 300–600 | |
| 10 | `service-area` | Service Area | Town list linking to location / service-town pages | 50–100 | |
| 11 | `final-cta` | Final CTA | Phone + button | 30–50 | mandatory |

**Total budget:** per-service norms from page-templates.md (surge 700–1,200; lighting 800–1,500; hot-tub/EV 1,000–1,800; panel 1,200–2,000; generator/battery 1,500–2,500), feasibility-validated (§4.5).

**FAQ mix:** ≥2 PAA-style universals for the service (time, permit, DIY, sizing — the documented per-service lists); ≥1 regulated topic answered only within `local_facts`; ≥1 local ("Do you pull permits in Whitman County?" — fact ref required); remainder from `manifest`-kind seeds. Answer pattern: literal answer in sentence one, 2–4 sentences, never hedge-first.

**Links:** OUT — 2–3 related services (natural-sentence anchors, e.g. the "Do I need a panel upgrade?" cross-link pattern), every service-town child of this cluster, primary locations, one guide if topical. (Inbound is a v0.5 report join **[RT14a]**.)

**Schema:** `Service` (+ `areaServed` from manifest towns), `FAQPage`, `BreadcrumbList`.

**DEGRADED delta:** §7 dropped; region-real testimonials or none. Service pages usually aggregate enough region-wide proof to reach FULL first.

### 3.3 SERVICE-TOWN page (`/services/<cluster>/<town>`) — template `service-town-v1`

Highest commercial intent, highest doorway risk. Only planned where M4 says the cell is winnable and G6/G14 allow. Owns "[service] [town]" and variants. H1: `[Service] in [Town], [ST]` — the one type where the exact SERP-convention pattern is right.

**Anti-doorway rule, now measured not asserted [RT1]:** at generation time, ≥60% of body words must sit in `uniqueToPage: true` sections AND those sections' rendered text must pass the M6 `sibling-similarity` gate (shingle overlap ≤0.30 vs every same-type sibling after town-token normalization) AND the absolute unique-word count must meet `preflight.uniqueWordFloor`. Content that could be moved to another town's page unchanged fails regardless of what the flag says.

| # | sectionId | H2 pattern | Purpose | Words (FULL) | Unique? |
|---|---|---|---|---|---|
| 1 | `hero` | Hero | Primary keyword; symptom + town in first sentence; honest relationship framing | 50–80 | no **[RT13]** |
| 2 | `whats-different-here` | [Service] in [Town]: what's different here | **The load-bearing section.** Town's housing stock × this service, sourced from town/county-scoped local_facts + proof-job observations | 150–300 | YES |
| 3 | `proof-jobs` | Recent [service] jobs in [Town] | **FULL only** — the ≥2 G6 jobs, photos, what/why | 150–250 | YES |
| 4 | `local-permits` | Permits, inspection & utility in [Town/County] | Named authority, named utility — **≥1 town/county-scoped URL-or-license-holder fact required or the section is cut** (G8, [RT2], [RT7]); state-scoped rules summarized ≤40 words + linked to parent | 100–200 | YES |
| 5 | `process` | Our process | Compressed 3–5 steps — never duplicate the parent's full version; link up | 75–150 | no |
| 6 | `cost` | Cost in [Town] | **Only if owner-approved AND town-differentiated**; otherwise OMITTED and the parent's cost section is linked — a re-pasted cost block is boilerplate | 100–150 | cond. |
| 7 | `faq` | FAQ | 3–4, town×service unique — zero overlap (town-normalized) with the parent AND with any brief sharing this town **[RT2][RT10]** | 200–400 | YES |
| 8 | `nearby-related` | Nearby + related | Parent service, town location page, adjacent service-towns | 30–60 | no |
| 9 | `final-cta` | Final CTA | | 30–50 | no |

**Total:** FULL 600–1,000 (600-unique-word template floor per task T-001). DEGRADED budgets are **recomputed from claim mass** (§4.5) — see the worked example (§5) for the arithmetic. Deliberately shorter than the parent; it wins on specificity, not length.

**G7 note in every brief:** the parent service page must NOT target this town's modified queries in its H2s; the architecture `conflictLog` entry is cited.

**Content-cannibalization note [RT10]:** where a fact applies to both this page and the town's location page, the fact's **primary home** is decided by angle — cluster-scoped angles (what the housing stock means *for this service*) live here; general-trade angles live on the location page; the non-home page summarizes in ≤1 sentence and links. G7 partitions query strings; this rule partitions the *content* Google actually resolves intents from.

**Links:** OUT — parent service (anchor: service name), town location page (anchor: "electrician in [Town]"), 1–2 related service-towns **same town** ("EV Charger Installation in Pullman" from panel-Pullman). **Never link sibling towns of the same service in-body** — that's a doorway footprint; nearby-towns list in §8 only.

**Schema:** `Service` with `areaServed` = this town only, `FAQPage`, `BreadcrumbList` (Home › Services › [Service] › [Town]).

**DEGRADED delta:** §3 dropped ⇒ §2 + §4 budgets grow within the claim-mass-derived envelope; **if `supportableUniqueWords < 300`, the page is not built at DEGRADED — it stays BLOCKED behind PROOF_COLLECT/FACT_COLLECT** (stricter than location pages: a thin service-town page is the classic doorway signature) **[RT4]**.

### 3.4 LOCATION page (`/locations/<town>`) — template `location-v1`

Owns the town's general-trade intent ("electrician [town]"). The doorway-death-risk type — the brief exists to force genuine locality. H1: benefit/work-first + town, not a keyword string (live Crescent pattern, keep: "Electrical work for Pullman homes, rentals, and businesses"). Title: `Electrician in [Town, ST] | [Business]`.

**Base-city rule [RT8]:** the base city gets **no** location page — the homepage IS the base city's location page and owns "[trade] [base city]" (§3.7). If the architecture ever plans `/locations/<base-city>`, brief preflight flags it as a G7 conflict with the homepage and refuses the brief. One intent, one URL — decided here, once.

| # | sectionId | H2 pattern | Purpose | Words (FULL) |
|---|---|---|---|---|
| 1 | `hero` | Hero | Primary keyword; **relationship-to-town stated honestly in first 50 words** (headquartered / X minutes away, from manifest `drive_time_min`; never imply a local office that doesn't exist) | 50–80 |
| 2 | `services-in-town` | Electrical work we do in [Town] | Services grid, each linking to service or service-town page; 1-line descriptions flavored by what that town's stock actually needs | 150–250 |
| 3 | `housing-stock` | [Town]'s housing stock / what we see there | **The info-gain engine of this type.** WSU rentals, pre-1950 knob-and-tube, 1970s FPE tract builds, farm outbuildings — from town-scoped local_facts (URL or attestation; attestation flavors, URL carries) | 150–300 |
| 4 | `local-permits` | Permits & inspection in [Town/County] | Authority BY NAME; what requires a permit; who files — every claim resolves to a fact (≥1 town/county URL-or-license-holder fact) or the section is cut (G8, [RT7]) | 100–200 |
| 5 | `proof-jobs` | Recent jobs in [Town] | **FULL only (G6)** | 100–200 |
| 6 | `why-us` | Why [Town] homeowners call us | License valid **in that state** named (G15 verified upstream); honest distance/response framing | 75–150 |
| 7 | `faq` | FAQ | 3–5, all town-anchored; faq-unique scope = all briefs sharing the town, town-normalized **[RT2][RT10]** | 200–450 |
| 8 | `nearby` | Nearby areas | Adjacent-town links from manifest adjacency | 30–60 |
| 9 | `final-cta` | Final CTA | | 30–50 |

**Total:** FULL 800–1,200; DEGRADED recomputed from claim mass (§4.5), viability threshold 300 supportable unique words like all doorway-risk types.

**Mandatory local set (this type lives or dies on it):** permit authority named (town/county-scoped fact); utility named (fact ref); ≥2 housing-stock specifics (town-scoped); honest drive-time statement. Unsourceable ⇒ preflight fail → FACT_COLLECT gaps, no page **[R2]**. State-scoped facts do not satisfy any of these **[RT2]**.

**Schema:** `LocalBusinessRef` + `areaServed`/`Place`, `BreadcrumbList`, `FAQPage`. No fake local address.

**DEGRADED delta (where it bites — Crescent's 8 live near-doorway pages are the cautionary case):** §5 dropped; §3 + §4 become the entire value proposition, budgets grow within the claim-mass envelope; no photos implying local jobs; PROOF_COLLECT paired; must still pass info-gain vs the incumbents for "electrician [town]" — verified permit/utility/housing content is precisely what template pages lack.

### 3.5 HUB page (`/services/residential-electrical`, `/services/commercial-electrical`, `/services`) — template `hub-v1`

Owns broad category intent, distributes authority downward. The hub is a router — depth lives in children; a 2,500-word hub cannibalizes its own children (G7). Sections: hero (50–80) → per-card service grid, **written per-card, not templated** (300–500; child-service names appear as grid links — that IS their keyword placement; the hub must not grow child-intent H2s) → how we work + license (100–150, mandatory) → where we work (75–125) → recent cross-service work (FULL: 2–3 jobs, 100–150) → 3–4 category-scope FAQs — scope boundaries ("do you do solar?" answered from `do_not_offer`), emergency policy, licensing; never a child-service FAQ (30–350) → final CTA. **Total 800–1,200.** Schema: `CollectionPage` + `ItemList` (or broad `Service`), `BreadcrumbList`, `FAQPage`. Highest out-degree on the site. DEGRADED delta minimal: drop proof section — any 2 publishable jobs anywhere qualify a category hub.

### 3.6 GUIDE page (`/guides/<topic>`) — template `guide-v1` — **anatomy deferred to v0.5 [RT14d]**

Two rules are normative NOW; the full section anatomy ships with v0.5 when the first guide clears its gate:

1. **The gate [R7]:** a guide brief is only generated when the topic has **≥3 verified URL-provenance `local_facts` entries** — a guide is nothing *but* claims, so G8 is the whole page. Binary; no DEGRADED variant.
2. **The inbound-link rule:** every service brief in a county the guide covers carries an outbound link to it.

v0.5 anatomy sketch (non-normative until then): direct-answer summary in first 100 words; 3–4 task-ordered fact-ref'd sections; one promotional "Where [Business] fits" section; long-tail FAQ harvest; 1,200–2,000 words; `Article` schema; author = licensed contractor with license # near byline; `verified_date` surfaced on-page with a 12-month re-verification task.

### 3.7 CORE pages — brief-lite

`core` (homepage, about, contact) gets a reduced brief: meta block; E-E-A-T inventory (about = owner story + license + real photos — the biggest open-lane positioning play per competitor-analysis: no Palouse competitor names an owner in the hero); NAP byte-identical to manifest; schema (`AboutPage`/`ContactPage`; **homepage owns the single `LocalBusiness` node** all other pages reference); internal-link hub role.

**Homepage keywords [RT8]:** brand + "[trade] [base city]" — and the homepage is the **permanent canonical owner** of the base-city general-trade intent. No `/locations/<base-city>` page is ever planned (§3.4 base-city rule); the query partition (§4.1) assigns "electrician [base city]" to `/` and any competing assignment is a G7 conflict at preflight.

Full core anatomies beyond this are v0.5 **[RT14d]**.

---

## 4. Derivation rules — every field's algorithm

Deterministic throughout: same artifacts → byte-identical briefs. Sort keys stated wherever a choice exists.

### 4.1 Keyword map → `keywords` (G5, G7)

The brief generator **never assigns** queries to URLs — M5 `url-map.ts` already wrote `KeywordEntry.canonicalUrl` and logged conflicts. Briefing is a pure partition + rank:

1. `K(P) = { e ∈ keywordMap : e.canonicalUrl === P.url }`. Cross-check `K(P) ⊇ P.targetQueries`; a query in two partitions is a G7 violation upstream → domain failure `{ok:false}`. Base-city rule: "[trade] [base city]" must partition to `/` (§3.7) **[RT8]**.
2. **primary** = max of `K(P)` under: real volume desc → `marketExists=true` first → town-slug match with `P.cell.town` → shortest query → lexicographic. Exactly one winner.
3. **Structural secondary/long-tail split [RT9]** — never volume-based (in null-volume town cells *everything* has null volume, so a volume-based split is undefined): after ranking the remainder of `K(P)` under the §4.1.2 ordering,
   - **longTails** = entries whose token set is a strict superset of the primary's or an already-selected secondary's token set (question-forms and modifier-extensions; they map to FAQ questions / H3s);
   - **secondaries** = the first ≤5 non-superset entries in rank order (they own H2/H3s);
   - **unassigned** = everything left. Owned for G7, mapped to no section, listed explicitly — never silently dropped.
4. Long-tails come **only from the map** — minting queries would be invented demand (G5-adjacent).
5. **intent**: modifier-token lookup built from `vertical.intentModifiers` (structural profile knowledge — the profile carries modifiers, never vocabulary).
6. **entities (v0.1, honestly downgraded [RT11])** = union of (a) proper nouns appearing in applicable `local_facts` claims; (b) manifest structurals (county, region label, license numbers, owner names); (c) `qaConfig.vocabAllow` terms that appear in ≥1 crawled ranking-incumbent `bodyText` for this cell. That is the whole list — `VerticalProfile` has no vocabulary field by charter ("not a vocab overlay") and the brief cites none. `sourceRef` for class (c) is `"qa-config.vocabAllow + crawl:<businessId>"`. Entities carry no volume, ever. v0.5 may add multi-incumbent noun-phrase extraction when the classifiers exist.

**Invariant (acceptance test):** across a run, each query string appears in exactly one brief; `keywordsAssigned` across a brief's sections partitions **primary ∪ secondaries ∪ longTails** (not `unassigned`, which is owned-not-placed) **[RT9]**.

### 4.2 Registry + incumbent crawls → `incumbents` (G14)

1. Find the `SerpSnapshot` for the cell; take `organicTop10[0..2]` as `{businessId, rankingUrl}` pairs **[RT12]**; resolve to `RegistryBusiness`; keep those with a `crawledPages` entry whose `url === rankingUrl` — **relevance is keyed by the URL that ranks for this cell's query, never by the crawl's own `cell` label** (Cheetah's `/panel-upgrades-moscow/` ranks for Pullman queries and belongs in the Pullman brief). Uncrawled incumbents are listed with empty `whatTheyHave` and a note — never fabricated coverage. Manual/pre-fixture registries (v0.1) carry hand-entered `rankingUrl` and `organicPosition: null` **[R4]**.
2. **whatTheyHave (v0.1, honestly downgraded [RT11])** = exactly what the shared extraction library produces: the six binary section classifiers (`has-cost-section`, `has-faq`, `has-process`, `has-proof`, `mentions-permit`, `mentions-{town}`) + normalized heading topic tags. Nothing richer — no "active blog", no "title targeting" analysis; those observations go in `analystNotes`, hand-entered, provenance-flagged, report-only. **The same extraction library M6's `info-gain.ts` uses — brief and gate share one library so the target and the test can't drift.**
3. **whatTheyLack** = `coverageChecklist(P) − whatTheyHave`, where the checklist is built ONLY from substantiable items: applicable town/county-scoped `local_facts`, publishable proof jobs for the cell, trust elements resolvable from the manifest, owner-story fields. `"architecture"` is **not** a permitted `ourSource` — "they lack a page we plan to build" is circular, not info-gain **[RT11]**. Each entry carries `ourSource + sourceRef`. This is the post-scaled-content definition of info-gain: not "different words" but **verifiable local information the ranking pages don't have**. Empty diff ⇒ §3.1 preflight rule **[R2]**.
4. **Homogeneous-market note [RT3]:** in small markets the same incumbents rank across every town, so sibling `whatTheyLack` lists converge *legitimately*. That is a **planning signal** (fewer service-town pages, per R2/preflight), never grounds to force artificial brief divergence and never a generator exception — see acceptance test #5.

### 4.3 Manifest `local_facts` / `proof_assets` → `localFactsRequired`, `proofRefs`, `preflight`, `inputGaps` (G6, G8)

- **Applicable facts:** `fact.towns` empty or contains the town, AND `fact.clusters` empty or contains the cluster — **then filtered by scope [RT2]:**
  - `scope: "town" | "county"` facts: full citizens — count toward mandatory-local sets, `uniqueToPage` word credit, and claim mass; assigned to the section whose topic matches the claim category (permit → `local-permits`; housing → `housing-stock`/`whats-different-here`; utility → wherever the type places it).
  - `scope: "state"` facts: render **once, in full, on the parent service page**; every other page gets a ≤40-word summarize+link allowance, never a restatement. A statewide fact "localized" N times is the madlib generator — structurally forbidden.
- **Provenance caps [RT7]:** `provenance: "attestation"` facts may flavor non-regulated sections (housing stock, service style) but may **not** be the sole basis for a `regulatedClaimTopics` section (permits/code/utility) — those require `provenance: "url"` or a license-holder professional statement about the client's own practice (the owner attesting "we file the permit" is admissible; the owner attesting "the county requires X" is not). The operator report renders the url/attestation split per page.
- **Primary-home rule [RT10]:** a fact applicable to both a town's location page and a service-town page is assigned one primary home by angle (cluster-scoped → service-town; general-trade → location); the other brief lists it only as a ≤1-sentence summarize+link.
- **Claim-mass preflight (doorway-risk types) [RT4]:**
  `licensedClaimWords = Σ words(claim)` over applicable town/county facts (post primary-home assignment) `+ Σ words(description)` over publishable proof jobs for the cell.
  `supportableUniqueWords = 5 × licensedClaimWords + 40 × |applicable state facts|`.
  `uniqueWordFloor = clamp(supportableUniqueWords, 300, templateUniqueFloor)`.
  `supportableUniqueWords < 300 ⇒ status = BLOCKED` with gaps enumerating what closes the deficit. The ×5 factor is claim + explanation + implication + question-form — legitimate elaboration, not padding; anything demanding more words than that is asking the generator to invent.
- **Required-but-missing:** `vertical.regulatedClaimTopics` × `pageType` defines expected coverage (electrician service-town: permits). For each expected topic with zero applicable town/county facts of admissible provenance: the section is **removed from the outline** (G8 encoded structurally — no empty slot to hallucinate into) and `inputGaps` gains a `FACT_COLLECT` with the owner question templated from topic × cell ("Does {county} require a permit for {clusterLabel}? Provide source URL or attest.").
- **FAQ–gap exclusion [RT5]:** any candidate FAQ whose topic matches an open `FACT_COLLECT` is excluded from the brief and listed in that gap's `blockedSlots` as `"faq:<slug>"`. The brief never contracts the generator to answer a question whose ground truth it has flagged as uncollected.
- **Proof:** re-validate `architecture.proofRefs` against the manifest (`permission_to_publish && town && cluster` match); a ref that no longer validates is dropped and the tier question escalated, never silently kept. FULL: jobs feed `proof-jobs` (newest first) and may seed one proof-job FAQ. DEGRADED: `proofRefs` empty everywhere; `inputGaps` gains `PROOF_COLLECT` with resolution `"≥2 publishable jobs for {town}×{cluster} (G6)"` — the same signal that drives the R10 upgrade.

### 4.4 Vertical profile + templates → mandatory sections, prohibitions, FAQ seeds, purposes

- **Purposes are assembled, never authored [RT6]:** `purpose.instruction` is copied byte-for-byte from `templates/site/<templateId>.meta` section metadata ({town}/{clusterLabel} slot interpolation is the only variance); `purpose.factRefs` ⊆ the section's `localFactsRequired` ∪ state-fact link refs; `purpose.manifestRefs` are JSON paths. Schema validation rejects any instruction string not present in template metadata. First-party process claims ("we file", "we pull permits") must resolve to a license-holder-attested `local_facts` entry (or a future `services.process_claims[]` manifest field) — they are never free prose.
- Each `requiredTrustElements` entry maps to a `mandatory: true` section or a mandatory hero/footer slot recorded in the instruction; copy-qa verifies presence.
- `prohibitions` = vertical prohibitions + `brand_constraints.banned_phrases` + tier-derived ("DEGRADED: no proof-dependent claims, no 'jobs we've done in {town}'").
- **FAQ seeds (3–6), priority order:** (1) one per applicable town/county local_fact rephrased as a question (strongest info-gain, `answerFactRefs=[fact_id]`) — **question templates are compared town-slug-normalized against every other brief sharing the town AND the parent, so "Who issues the permit in {town}?" × N towns dedupes to its one legitimate home [RT2][RT10]**; (2) `intentModifiers` × cluster templates (cost answers additionally gated on owner sign-off); (3) `manifest`-kind seeds (drive time, service area, booking — the safest answers on the site) **[RT5]**; (4) proof-job grounded (FULL only). `incumbent-gap` seeds are v0.5 — the v0.1 extractor cannot supply the topic granularity **[RT14c]**. Candidates matching an open FACT_COLLECT topic are excluded (§4.3). Empty `answerFactRefs` only off the regulated-topics list; "experience" answer basis struck on DEGRADED cells **[RT5]**. Questions duplicated verbatim from incumbent FAQs are excluded.

### 4.5 Tier + pageType → outline variant and budgets

Base skeleton per `templateId` (§3 tables, extracted from page-templates.md into template metadata); per-section budgets from the same norms. FULL: full skeleton, template-norm totals. DEGRADED (doorway-risk types): proof sections deleted; fact-backed local sections grow; **the whole budget re-derives from preflight [RT4]** — `totalWordBudget.max = round10(uniqueWordFloor / 0.6)`, `totalWordBudget.min ≈ 0.8 × max`, and fact-fed sections' minimums are capped at `5 × (their licensed claim words)`. hub/guide/core: no cell, no proof, no G6; keyword partition still applies (town-less entries); trust elements still mandatory.

**Budget feasibility validation [RT13]** — computed at brief build time for every brief; failure is a loud domain error (`{ok:false}`), never a shipped brief:

1. `Σ section wordBudget.min ≤ 0.85 × totalWordBudget.max` (the generator needs slack, not a pinned-at-minimums corridor);
2. `uniqueCeiling − uniqueWordFloor ≥ 80`, where `uniqueCeiling = totalWordBudget.max − Σ non-unique section mins`;
3. `uniqueWordFloor ≤ 0.6-consistency`: at `totalWordBudget.max`, `uniqueWordFloor / max ≥ 0.6` must be satisfiable (it is by construction when max = floor/0.6).

`uniqueToPage` is boolean; the §3.3 hero row is `false` — "partial" uniqueness does not exist in the type **[RT13]**.

### 4.6 Links, schema, meta, gates, doneCondition

- **outbound** = `P.internalLinks` (architecture is authoritative); anchor = target's primary query, title-cased. Sitewide anchor-dedup (static check + rotation) is v0.5 — a <30-page v0.1 site doesn't need the machinery **[RT14b]**. **Inbound lists are not emitted** — a full link-graph inversion duplicated into every brief is N places to go stale; the report renderer joins outbound edges at v0.5 **[RT14a]**. `reason` from the page-type pair.
- **schemaBlocks** from pageType (§3); every block's `wiring` names the stable `@id` reference (G9).
- **meta:** `titlePattern = "{primary} | {legal_name}"` with ≤60-char check on resolution; description = primary + highest-priority trust element + `{phone_nap}` token (NAP stays a manifest token — intake's zero-grep-hits rule). **Every claim in the description resolves to a fact/manifest ref exactly like body copy** — "we file the permit" in a meta description needs the same license-holder-attested fact as anywhere else **[RT6]**.
- **gates:** always `["G5","G7","G8","G9","G14"]`; + `"G6"` when tiered (service-town/location); `"G15"` carried where the page has a town (enforced upstream; listed for audit). Copied verbatim into the task's `gate_checks`. (Named M6 gate set incl. `sibling-similarity` is fixed per pageType — §6.)
- **doneCondition** (mirrors T-001): `verified: "URL live, HTTP 200, in GSC coverage; QA report all-green"`; `attested: "editorial approval"` while the page falls in the first-10 G14 window, else null; `min_data: "GSC coverage report present for property"`.

---

## 5. Worked example — `/services/electrical-panel-upgrades/pullman-wa`

Real Crescent data throughout. Assumed state: the six facts below have been entered into `manifest.local_facts` at intake (URL facts verified by the 2026-05-13 Crescent research pass — see `docs/pullman-competitors.md` sources; ACS/Avista entries added the same pass); `proof_assets.jobs` is **empty** (true today); no vendor volume data exists for these town-level queries (**all volumes null — honest**); the registry is the v0.1 hand-assembled one from `docs/competitor-analysis.md` + `docs/pullman-competitors.md`, so incumbent positions are null and `rankingUrl` is hand-entered. Owner declined published pricing (real directive) ⇒ no cost section anywhere.

Assumed manifest entries the brief references (note `scope` and `provenance` — the two red-team fields doing the anti-madlib work):

```jsonc
// manifest.local_facts (entered at intake; sources from the verified research pass)
[
  { "fact_id": "fact-wa-lni-permit-panel",
    "claim": "Electrical work in Washington is permitted through the Washington State L&I electrical program; panel changes require a permit and inspection.",
    "scope": "state", "provenance": "url",          // STATE-scoped: renders in full on the PARENT
                                                    //   service page only; this brief gets a ≤40-word
                                                    //   summarize+link allowance, never a restatement [RT2]
    "source_url_or_owner_attestation": "https://lni.wa.gov/licensing-permits/electrical/",
    "verified_by": "research pass 2026-05-13", "verified_date": "2026-05-13",
    "towns": [], "clusters": [] },

  { "fact_id": "fact-pullman-protective-inspections",
    "claim": "The City of Pullman's Community Development department operates a Protective Inspections division for building inspection.",   // 15 words
    "scope": "town", "provenance": "url",
    "source_url_or_owner_attestation": "https://pullman-wa.gov/services/community_development/protective_inspections",
    "verified_by": "research pass 2026-05-13", "verified_date": "2026-05-13",
    "towns": ["pullman-wa"], "clusters": [] },

  { "fact_id": "fact-avista-serves-pullman",
    "claim": "Avista Utilities is the electric service provider for the City of Pullman.",   // 12 words
    "scope": "town", "provenance": "url",
    "source_url_or_owner_attestation": "https://www.myavista.com/about-us/our-service-territory",
    "verified_by": "research pass 2026-05-13", "verified_date": "2026-05-13",
    "towns": ["pullman-wa"], "clusters": [] },

  { "fact_id": "fact-pullman-renter-share",
    "claim": "Roughly two-thirds of Pullman's occupied housing units are renter-occupied (Census ACS DP04), driven by WSU's Pullman campus.",   // 17 words
    "scope": "town", "provenance": "url",
    "source_url_or_owner_attestation": "https://data.census.gov/table/ACSDP5Y2023.DP04?g=160XX00US5356625",
    "verified_by": "research pass 2026-05-13", "verified_date": "2026-05-13",
    "towns": ["pullman-wa"], "clusters": [] },

  { "fact_id": "fact-pullman-housing-stock",
    "claim": "Pullman housing stock is dominated by student rentals near WSU and older homes; many older homes carry 60–100A services.",   // 19 words
    "scope": "town", "provenance": "attestation",   // owner (Parker) 2026-05-20 — flavors housing
                                                    //   sections; may NOT carry regulated topics [RT7]
    "source_url_or_owner_attestation": "owner attestation (Parker), 2026-05-20",
    "verified_by": "owner", "verified_date": "2026-05-20",
    "towns": ["pullman-wa"], "clusters": [] },

  { "fact_id": "fact-crescent-files-permits",
    "claim": "Crescent Electric files the WA L&I electrical permit on the customer's behalf for panel work.",
    "scope": "state", "provenance": "attestation",  // license-holder professional statement about the
                                                    //   client's OWN practice — admissible for first-party
                                                    //   process claims [RT6][RT7]; state-scoped ⇒ no
                                                    //   uniqueness credit (same on every page)
    "source_url_or_owner_attestation": "owner attestation (Parker, license holder), 2026-05-20",
    "verified_by": "owner", "verified_date": "2026-05-20",
    "towns": [], "clusters": ["panel"] }
]
```

**Preflight arithmetic (§4.3), shown because it decides everything downstream:** town/county claim words = 15 (protective-inspections) + 12 (avista) + 17 (renter-share) + 19 (housing-stock) = **63**; proof descriptions = 0. Supportable = 5 × 63 + 40 (one applicable state fact, L&I) = **355** ≥ 300 ⇒ buildable at DEGRADED. Floor = clamp(355, 300, 600) = **355**. TotalMax = round10(355 / 0.6) = **590**. Feasibility: Σ section mins 480 ≤ 0.85 × 590 = 501 ✓; uniqueCeiling = 590 − 150 (non-unique mins) = 440 ≥ 355 + 80 = 435 ✓. Under the pre-red-team spec this brief demanded 600+ unique words from 63 licensed claim words — the hallucination pump [RT4]. Now the page is simply shorter and entirely true.

The brief:

```jsonc
{
  "briefId": "brief:/services/electrical-panel-upgrades/pullman-wa",
  "url": "/services/electrical-panel-upgrades/pullman-wa",
  "pageType": "service-town",
  "tier": "DEGRADED",                        // proof_assets.jobs = 0 for pullman-wa×panel (G6)
  "cell": { "town": "pullman-wa", "cluster": "panel" },
  "templateId": "service-town-v1",
  "priority": 1,
  "status": "PLANNED",                       // claim-mass preflight PASSES: 355 supportable unique
                                             //   words ≥ 300 viability threshold [RT4][R2]

  "keywords": {
    "primary": {
      "query": "electrical panel upgrade pullman wa",
      "volume": null,                        // no reliable town-level vendor data — never estimated (G5)
      "marketExists": true,                  // M2 market-existence: incumbents maintain panel pages in
                                             //   the region (Cheetah /panel-upgrades-moscow/); registry ref
      "intent": "hire", "source": "keyword-map"
    },
    "secondaries": [
      { "query": "panel replacement pullman", "volume": null, "marketExists": true,
        "intent": "hire", "source": "keyword-map" }
        // structural split [RT9]: NOT a token-superset of the primary ⇒ secondary, despite
        //   null volume (a volume-based split is undefined in null-volume town cells)
    ],
    "longTails": [],                         // no token-superset entries in K(P) yet — the brief
                                             //   never mints queries; FAQ long-tails wait for the map
    "unassigned": [],                        // owned-not-placed overflow bucket, empty here [RT9]
    "entities": [
      { "entity": "200-amp service",   "source": "qa-config",   "sourceRef": "qa-config.vocabAllow + crawl:b-cheetah" },
      { "entity": "Federal Pacific (FPE) / Zinsco panels", "source": "qa-config", "sourceRef": "qa-config.vocabAllow + crawl:b-artizan" },
      { "entity": "Whitman County",    "source": "manifest",    "sourceRef": "locations.service_area.towns[pullman-wa].county" },
      { "entity": "WSU",               "source": "local-facts", "sourceRef": "fact-pullman-renter-share" },
      { "entity": "Washington State L&I", "source": "local-facts", "sourceRef": "fact-wa-lni-permit-panel" },
      { "entity": "Avista Utilities",  "source": "local-facts", "sourceRef": "fact-avista-serves-pullman" },
      { "entity": "Lic# CRESCLE781QD", "source": "manifest",    "sourceRef": "business.licenses[state=WA].number" }
      // "load calculation" from the old draft is GONE: no vocabAllow-∩-crawl hit, no fact, no
      //   manifest path — under [RT11] an entity without a resolvable source does not exist
    ]
  },

  "totalWordBudget": { "min": 470, "max": 590 },   // derived from preflight, NOT template-norm × flat cut [RT4]
  "preflight": {
    "licensedClaimWords": 63,
    "supportableUniqueWords": 355,           // 5 × 63 + 40 (state-fact summarize+link allowance)
    "uniqueWordFloor": 355,
    "feasible": true                         // Σ mins 480 ≤ 501; uniqueCeiling 440 ≥ 435 [RT13]
  },

  "outline": [
    { "sectionId": "hero",
      "heading": "Electrical Panel Upgrades in Pullman, WA",
      "purpose": {
        "instruction": "State the primary query in the H1 and first sentence, symptom-first. State the relationship to {town} honestly from drive_time_min in the first 50 words; never imply a local office. Carry the state license number in body copy.",
        "factRefs": [],
        "manifestRefs": ["locations.service_area.towns[pullman-wa].drive_time_min",
                          "business.licenses[state=WA].number"]
      },                                     // instruction is BYTE-EQUAL to service-town-v1.meta/hero [RT6]
      "wordBudget": { "min": 40, "max": 70 },
      "keywordsAssigned": ["electrical panel upgrade pullman wa"],
      "localFactsRequired": [], "proofRefs": [],
      "mandatory": true, "uniqueToPage": false },     // boolean; no "partial" [RT13]

    { "sectionId": "whats-different-here",
      "heading": "Panel upgrades in Pullman: what's different here",
      "purpose": {
        "instruction": "Characterize {town}'s housing stock as it bears on {clusterLabel}, using ONLY the referenced facts. Frame legacy-equipment brands capability-neutrally.",
        "factRefs": ["fact-pullman-housing-stock", "fact-pullman-renter-share"],
        "manifestRefs": []
      },                                     // "landlord turnover work" from the old draft is GONE —
                                             //   no fact says it; unsourced purpose prose was the
                                             //   G8 bypass channel [RT6]
      "wordBudget": { "min": 120, "max": 200 },
      "keywordsAssigned": ["panel replacement pullman"],
      "localFactsRequired": ["fact-pullman-housing-stock", "fact-pullman-renter-share"],
      "proofRefs": [],
      "mandatory": true, "uniqueToPage": true,
      "mustNot": ["proof-dependent claims", "implied job volume in Pullman",
                   "rental/turnover statistics beyond the two referenced facts"] },

    { "sectionId": "local-permits",
      "heading": "Permits, inspection & utility for Pullman panel work",
      "purpose": {
        "instruction": "Name the town/county permitting and inspection actors and the electric utility from the referenced town-scoped facts. Summarize the applicable state-level rule in at most 40 words and link the parent service page's full treatment. State who files only per the referenced process fact.",
        "factRefs": ["fact-pullman-protective-inspections", "fact-avista-serves-pullman",
                      "fact-wa-lni-permit-panel", "fact-crescent-files-permits"],
        "manifestRefs": []
      },                                     // section EXISTS because ≥1 town-scoped URL fact carries
                                             //   it (protective-inspections, avista) [RT2][RT7]; the
                                             //   state L&I fact appears only as the 40-word link summary
      "wordBudget": { "min": 90, "max": 160 },
      "keywordsAssigned": [],
      "localFactsRequired": ["fact-pullman-protective-inspections", "fact-avista-serves-pullman"],
      "proofRefs": [], "mandatory": true, "uniqueToPage": true,
      "mustNot": ["permit fee dollar amounts (no fact/owner source)",
                   "utility disconnect/reconnect coordination claims (open FACT_COLLECT — see inputGaps)"] },

    { "sectionId": "process",
      "heading": "How we handle a Pullman panel swap",
      "purpose": {
        "instruction": "Compressed 3–5 steps; do NOT duplicate the parent service page's full process — link up instead. Who-files claims only per the referenced process fact.",
        "factRefs": ["fact-crescent-files-permits"],
        "manifestRefs": []
      },
      "wordBudget": { "min": 60, "max": 100 },
      "keywordsAssigned": [], "localFactsRequired": [], "proofRefs": [],
      "mandatory": false, "uniqueToPage": false },

    // NOTE: cost section OMITTED entirely — owner directive (no published prices) + not town-
    // differentiated; parent page's "what drives the price" variables section is linked instead.
    // NOTE: proof-jobs section OMITTED — G6 DEGRADED (0/2 jobs). See degradedDeltasApplied.

    { "sectionId": "faq",
      "heading": "Pullman panel upgrade questions",
      "purpose": {
        "instruction": "Render exactly the brief's FAQ seeds. Zero overlap, after town-slug normalization, with the parent service page's FAQ set and with every other brief sharing {town}.",
        "factRefs": ["fact-wa-lni-permit-panel", "fact-pullman-protective-inspections",
                      "fact-pullman-housing-stock", "fact-pullman-renter-share"],
        "manifestRefs": ["locations.service_area.towns[pullman-wa].drive_time_min"]
      },
      "wordBudget": { "min": 120, "max": 220 },
      "keywordsAssigned": [], "localFactsRequired": ["fact-pullman-protective-inspections"],
      "proofRefs": [], "mandatory": true, "uniqueToPage": true },

    { "sectionId": "nearby-related",
      "heading": "Related work in and around Pullman",
      "purpose": {
        "instruction": "Link the parent service, the {town} location page, and 1–2 same-town related service-towns. No same-service sibling-town links in body (doorway footprint).",
        "factRefs": [], "manifestRefs": []
      },
      "wordBudget": { "min": 25, "max": 50 },
      "keywordsAssigned": [], "localFactsRequired": [], "proofRefs": [],
      "mandatory": false, "uniqueToPage": false },

    { "sectionId": "final-cta",
      "heading": "Talk through your Pullman panel",
      "purpose": {
        "instruction": "Phone + booking button; primaryAction per manifest booking_url.",
        "factRefs": [], "manifestRefs": ["business.booking_url", "business.phone_nap"]
      },
      "wordBudget": { "min": 25, "max": 40 },
      "keywordsAssigned": [], "localFactsRequired": [], "proofRefs": [],
      "mandatory": true, "uniqueToPage": false }
  ],

  "faq": [
    { "question": "Who issues the electrical permit for a panel upgrade in Pullman?",
      "sourcedFrom": { "kind": "local-fact", "factId": "fact-pullman-protective-inspections" },
      "answerFactRefs": ["fact-wa-lni-permit-panel", "fact-pullman-protective-inspections",
                          "fact-crescent-files-permits"] },
    { "question": "Can a WSU-area rental on 60–100A service be upgraded between tenants?",
      "sourcedFrom": { "kind": "local-fact", "factId": "fact-pullman-housing-stock" },
      "answerFactRefs": ["fact-pullman-housing-stock", "fact-pullman-renter-share"] },
    { "question": "Do you actually come out to Pullman, or are you Moscow-only?",
      "sourcedFrom": { "kind": "manifest", "path": "locations.service_area.towns[pullman-wa].drive_time_min" },
      "answerFactRefs": [] }                 // empty allowed: service-area is NOT a regulated topic;
                                             //   answer is the manifest drive-time value, honestly framed
    // The old draft's trip-fee FAQ is GONE: its topic (pricing-policy) matches an open
    //   FACT_COLLECT, so it is EXCLUDED and listed in that gap's blockedSlots — the generator is
    //   never contracted to answer a question whose ground truth is flagged uncollected [RT5].
    // The old FPE incumbent-gap FAQ is GONE: incumbent-gap seeds are v0.5 (the v0.1 extractor
    //   cannot supply topic granularity) [RT14c]; FPE/Zinsco remains as an entity mention only.
  ],

  "schemaBlocks": [
    { "type": "Service",        "wiring": "Service.provider → LocalBusiness @id (homepage node); serviceType='Electrical panel upgrade'; areaServed = City(Pullman, WA) ONLY" },
    { "type": "FAQPage",        "wiring": "exactly the 3 rendered FAQs; mainEntity on this page" },
    { "type": "BreadcrumbList", "wiring": "Home › Services › Electrical Panel Upgrades › Pullman, WA" }
  ],

  "internalLinks": {
    "outbound": [
      { "url": "/services/electrical-panel-upgrades", "anchor": "Electrical Panel Upgrades",
        "reason": "spoke→parent-service (full process, cost variables, and the state L&I permit treatment live there)" },
      { "url": "/locations/pullman-wa", "anchor": "Electrician in Pullman, WA",
        "reason": "service-town→town-location" },
      { "url": "/services/ev-charger-installation/pullman-wa", "anchor": "EV Charger Installation in Pullman",
        "reason": "cross-sell same-town (vertical adjacency: EV load is the #1 panel-upgrade driver)" }
    ]
    // inbound: not emitted at v0.1 — derivable report-renderer join, not N stale copies [RT14a]
  },

  "incumbents": [
    { "businessId": "b-cheetah", "name": "Cheetah Electric",
      "url": "https://cheetahelectric.com/panel-upgrades-moscow/",   // = hand-entered rankingUrl in the
                                             //   v0.1 snapshot; crawl matched by URL, NOT by the crawl's
                                             //   own moscow×panel cell label [RT12]
      "organicPosition": null,               // v0.1 hand-assembled registry; no frozen SerpSnapshot [R4]
      "whatTheyHave": ["has-cost-section", "has-faq", "has-process", "mentions-permit",
                        "mentions-town:moscow", "heading-topic:panel-signs", "heading-topic:amp-sizes"],
                                             // ONLY what the six classifiers + heading tags produce [RT11]
      "whatTheyLack": [
        { "topic": "named town-level permit/inspection actors (Pullman Protective Inspections)",
          "ourSource": "local-facts", "sourceRef": "fact-pullman-protective-inspections" },
        { "topic": "named electric utility for Pullman (Avista)",
          "ourSource": "local-facts", "sourceRef": "fact-avista-serves-pullman" },
        { "topic": "Pullman housing/rental-stock specifics tied to panel work",
          "ourSource": "local-facts", "sourceRef": "fact-pullman-renter-share" },
        { "topic": "named owner in hero",
          "ourSource": "manifest", "sourceRef": "business.entity.owner_names" }
        // the old "any Pullman-dedicated panel page" entry is GONE: ourSource:"architecture" is
        //   circular and excluded from the checklist [RT11]; the observation moved to analystNotes
      ],
      "analystNotes": [
        { "note": "No Pullman-dedicated panel page anywhere on the site — Pullman appears in nav/title only. Active blog; dual-city (Moscow|Pullman) title targeting; upfront-pricing page with no $ ranges.",
          "enteredBy": "research pass", "date": "2026-05-13" }
      ] },                                   // report-only channel; never a generation license [RT11]

    { "businessId": "b-artizan", "name": "Artizan Electric & Plumbing",
      "url": "https://artizanelectric.com/replace-federal-pacific-electric-panel-recalls-pullman-whitman-county/",
      "organicPosition": null,
      "whatTheyHave": ["mentions-town:pullman", "mentions-permit", "has-faq",
                        "heading-topic:fpe-recall", "heading-topic:panel-replacement"],
      "whatTheyLack": [
        { "topic": "named town-level permit/inspection actors and who files",
          "ourSource": "local-facts", "sourceRef": "fact-pullman-protective-inspections" },
        { "topic": "named electric utility for Pullman (Avista)",
          "ourSource": "local-facts", "sourceRef": "fact-avista-serves-pullman" },
        { "topic": "renter-share / WSU housing specifics beyond FPE-recall framing",
          "ourSource": "local-facts", "sourceRef": "fact-pullman-renter-share" }
      ],
      "analystNotes": [
        { "note": "Page is FPE-recall-specific — the only Whitman County geo-keyword URL in the market. Named owners + public license record; apartment/landlord page; 24/7 emergency.",
          "enteredBy": "research pass", "date": "2026-05-13" }
      ] }
    // ECNW, Cougar, Pullman Heating: in registry, no crawlable panel content (homepage-only /
    //   HVAC-first) — listed in the report as non-incumbents for this query, not fabricated here.
  ],

  "meta": {
    "h1Pattern": "Electrical Panel Upgrades in Pullman, WA",     // exact-pattern H1 correct for this type
    "titlePattern": "Electrical Panel Upgrade in Pullman, WA | {business.legal_name}",  // 52 chars resolved
    "descriptionPattern": "Panel upgrades and replacements for Pullman homes and rentals. Licensed in Washington (CRESCLE781QD); we file the L&I permit. Call {phone_nap}."
                                             // "we file the L&I permit" now resolves to
                                             //   fact-crescent-files-permits — meta claims carry
                                             //   refs exactly like body copy [RT6]
  },

  "cta": { "count": 3, "positions": ["hero", "after-local-permits", "final"], "primaryAction": "book" },

  "media": [
    { "type": "generic-real-photo", "required": false,
      "altPattern": "Crescent Electric panel work — {business.legal_name}",   // NO town attribution (DEGRADED)
      "source": "owner_task" }               // v0.1 media block: this one stub, period [RT14e]
  ],

  "gates": ["G5", "G6", "G7", "G8", "G9", "G14"],
  "prohibitions": [
    "DEGRADED: no proof-dependent claims; no 'jobs we've done in Pullman'; no town-attributed photos; no experience-based FAQ answers [RT5]",
    "no published prices or cost figures anywhere (owner directive — cost sections replaced by variables framing on the parent)",
    "no utility disconnect/reconnect coordination claims until fact verified (see inputGaps)",
    "no restating the statewide L&I rule beyond the 40-word summarize+link allowance (state-scoped fact renders in full on the parent only) [RT2]",
    "no superlatives without manifest evidence (G8); banned-phrase list per voice-guide DON'Ts",
    "parent page must not grow Pullman-modified H2s (G7 — conflictLog: 'electrical panel upgrade pullman wa' → won by this URL)"
  ],
  "degradedDeltasApplied": [
    "proof-jobs section dropped (0/2 publishable jobs pullman-wa×panel, G6)",
    "budgets recomputed from claim mass: 63 licensed words → 355 supportable unique → floor 355, total 470–590 (template FULL norm 600–1000 does NOT apply) [RT4]",
    "experience struck from FAQ answer basis [RT5]",
    "media downgraded to non-town-attributed generic-real; PROOF_COLLECT gap paired (R10 auto-upgrades)"
  ],

  "inputGaps": [
    { "kind": "PROOF_COLLECT",
      "ownerQuestion": "Photograph the next 2 Pullman panel jobs (before/after, panel label visible) and confirm publish permission.",
      "topic": "proof-jobs",
      "blockedSlots": ["proof-jobs"],
      "resolution": "proof_assets.jobs[town=pullman-wa, cluster=panel, permission_to_publish=true] >= 2 (G6) → R10 upgrade to FULL" },
    { "kind": "FACT_COLLECT",
      "ownerQuestion": "Does Avista require a disconnect/reconnect for Pullman panel swaps, and who schedules it? Provide source URL or attest.",
      "topic": "utility-coordination",
      "blockedSlots": ["local-permits", "faq:avista-coordination"],   // the sub-topic is written around
                                             //   in the section AND its candidate FAQ is excluded [RT5]
      "resolution": "local_facts entry with towns⊇[pullman-wa], topic=utility, scope=town, verified" },
    { "kind": "FACT_COLLECT",
      "ownerQuestion": "Is there a trip fee or minimum for Pullman calls? (Needed before any trip-fee FAQ can state anything.)",
      "topic": "pricing-policy",
      "blockedSlots": ["faq:trip-fee"],      // the FAQ the old draft asked the generator to improvise
                                             //   is now formally excluded until this closes [RT5]
      "resolution": "owner attestation recorded as a local_facts entry (provenance=attestation, license-holder)" }
  ],

  "doneCondition": {
    "verified": "URL live, HTTP 200, in GSC coverage; QA report all-green",
    "attested": "editorial approval (page falls in the first-10 G14 window)",
    "min_data": "GSC coverage report present for property"
  },

  "provenance": {
    "generatedAt": "2026-07-05T00:00:00Z",
    "runId": "r-001",
    "sourceArtifacts": [
      "site-architecture@runs/r-001",
      "keyword-map@runs/r-001",
      "competitor-registry@runs/r-000-manual (hand-assembled 2026-05-13 research pass)",
      "manifest@clients/crescent-electric",
      "qa-config@clients/crescent-electric",
      "vertical:electrician"
    ]
  }
}
```

**What this example demonstrates, deliberately:** all volumes null (no vendor data — G5); the **claim-mass preflight arithmetic in the open** — 63 licensed words → a 470–590-word page, not a 600-word floor squeezed against an 800-word cap with a 15-word feasible band ([RT4]/[RT13]: a short true page beats a long padded one); the statewide L&I fact **linked, not restated** ([RT2] — the madlib channel closed); every purpose assembled from template instruction + refs, with the old draft's unsourced "landlord turnover work" and "we file" claims either deleted or given a real fact home ([RT6]); the trip-fee FAQ **excluded** and parked in its gap's `blockedSlots` instead of left for the generator to improvise ([RT5]); incumbent rows reduced to what the v0.1 classifiers actually produce, with the analyst's real observations preserved in a labeled report-only channel ([RT11]); the ranking URL carried explicitly and crawl-matched by URL ([RT12]); tier DEGRADED with mechanical deltas and a paired PROOF_COLLECT (the T-004→T-001→R10 chain); the cost section absent because the owner declined pricing (a real directive, not a template gap); and the two open lanes the manual research actually found (no Pullman panel page anywhere; no permit-authority/utility content anywhere) as the page's reason to exist — each carried as a `whatTheyLack` entry with the fact ref proving we can write it (G14).

---

## 6. Integration

**Placement & flow**

```
pipeline/m5-architecture/page-briefs.ts        buildPageBriefs(...) — pure function, no clock
pipeline/m5-architecture/page-briefs.schema.ts zod for the on-disk artifact
pipeline/shared/incumbent-extraction.ts        the ONE extraction library (brief targets = gate baselines)
clients/<slug>/runs/<run_id>/page-briefs.json  the artifact (PageBrief[])
```

**→ plan.json (M8):** each non-LIVE brief with `status: PLANNED` yields one `PAGE_BUILD` task: `target.url` = brief url; `target.queries` = primary + secondaries; `action` = one-line imperative + `"per brief runs/<run_id>/page-briefs.json#<briefId>"`; `gate_checks := brief.gates`; `done_condition := brief.doneCondition`; `approval := "human_review"` while in the first-10 G14 window. Each `inputGaps` entry materializes as its own task the PAGE_BUILD `depends_on` (FULL-tier hard dependency; DEGRADED builds now, the gap tasks run in parallel and R10 upgrades later). `PROOF_COLLECT` exists in `TaskType`; **proposed one-line change: add `"FACT_COLLECT"`; v0.1 fallback: emit as `PROOF_COLLECT` with the owner question as `action` and `evidence_required: "local_facts entry verified"`** **[R5]**. Gap-task minutes roll up against G11 like all human tasks.

**→ M6:** `generate-page.ts` takes `(brief, GateContext)`. The brief licenses everything; the gates verify — and one gate is new:

- `claim-substantiation` checks body claims against the brief's `localFactsRequired` unions, honoring fact `scope` (a state fact supports ≤40 summary words off-parent) and `provenance` caps (attestation can't carry regulated topics) **[RT2][RT7]**;
- `info-gain` checks against the same incumbent texts the brief's `whatTheyLack` was diffed from (shared extraction library, §4.2);
- **`sibling-similarity` (NEW, v0.1) [RT1]:** shingle-overlap (5-gram Jaccard) of each `uniqueToPage` section's rendered text against the corresponding sections of every same-type sibling page, after town-token normalization (town names/slugs replaced by a placeholder). Overlap > 0.30 fails the page. This is the gate that measures what `uniqueToPage` merely claims — it looks where Google's scaled-content classifier looks: at our own siblings, not at incumbents. v0.5 upgrades to embeddings.
- `faq-unique` checks rendered FAQs against **all briefs sharing the town (any pageType) + the parent**, comparing town-slug-normalized question strings **[RT2][RT10]**;
- `boilerplate-ratio` checks the ≥60% ratio and the absolute `preflight.uniqueWordFloor`;
- `copy-qa` checks mandatory trust elements and prohibitions.

**→ Reports (operator + prospect):** each brief renders as — **Recommended page:** url · **Why:** cell verdict + band, primary query (volume printed as the number or "no reliable data", never a guess), the `whatTheyLack` list as "what the ranking pages don't have that we can prove", `analystNotes` rendered under a labeled "analyst observations" heading · **What goes on it:** the section table with word budgets + the claim-mass arithmetic · **What we need from you:** `inputGaps` owner questions + media owner-tasks, with the url/attestation provenance split surfaced per page **[RT7]** — the column that converts an owner reading the report into the PROOF_COLLECT/FACT_COLLECT inputs FULL tier needs. BLOCKED briefs render only the why + the gaps (including the claim-mass deficit: "we have 40 licensed words; a viable page needs 300 — these 3 questions close the gap").

**Cross-cutting acceptance (fixtures, Crescent):**
1. Every non-LIVE architecture page yields exactly one brief; no query appears in two briefs; per-brief `keywordsAssigned` partitions primary ∪ secondaries ∪ longTails; `unassigned` entries appear in no section **[RT9]**. "[trade] [base city]" partitions to `/` and a fixture planning `/locations/<base-city>` fails preflight as a G7 conflict **[RT8]**.
2. Zero invented content anywhere: volumes real-or-null; costs only owner-approved; facts only `local_facts`-backed; every `purpose.instruction` byte-matches template metadata (fixture with a hand-edited instruction string must fail schema validation) **[RT6]**.
3. The pullman-wa×panel fixture with an empty proof registry reproduces §5: DEGRADED, floor 355, PROOF_COLLECT, zero `proofRefs`. Deleting `fact-pullman-protective-inspections` and `fact-avista-serves-pullman` removes the permit section AND emits a FACT_COLLECT — never an unsourced section. Deleting **all town-scoped** facts drops supportable words below 300 and flips the page to BLOCKED (quantitative preflight, **[RT4]**) — fact *existence* elsewhere (the state L&I fact survives) must not save it **[RT2]**.
4. The 8 live Crescent location pages produce DEGRADED rebuild briefs whose mandatory-local sets force new town-scoped permit/utility/housing content (regression proof vs today's near-doorways).
5. **Divergence applies only to divergence-capable fields [RT3]:** for two buildable siblings, town-scoped `localFactsRequired` and town-normalized FAQ sets must differ. A sibling whose divergence-capable inputs are empty (no town facts, no proof) must come out **BLOCKED** — the homogeneous-market case is a planning signal (build fewer pages), never a built-but-similar page and never a generator exception. Fixture: two towns, one with town facts, one with only state facts → exactly one PLANNED brief.
6. Every `whatTheyLack` entry carries a resolvable `sourceRef` and none carries `ourSource: "architecture"` **[RT11]**; briefs are byte-identical across reruns on frozen fixtures; every emitted brief passes the §4.5 feasibility checks (a fixture engineered to violate them must produce `{ok:false}`, not a brief) **[RT13]**; a deliberately madlib'd pair of sibling pages (town names swapped) must fail the `sibling-similarity` gate **[RT1]**.

---

## 7. v0.1 vs v0.5

| Concern | v0.1 | v0.5 |
|---|---|---|
| Brief generation | Full `buildPageBriefs` for service, service-town, location, hub + core brief-lite; **guide** briefs only when the ≥3-URL-facts gate passes (anatomy deferred, §3.6) **[RT14d]** | Full guide + core anatomies |
| Claim-mass preflight | **Required** — ×5 factor, 40-word state-link allowance, 300-word viability threshold, feasibility checks **[RT4][RT13]** | Factor tuned against observed gate-failure rates |
| `LocalFact.scope` + `provenance` | **Required** (backfill derivation for old manifests: §2) **[RT2][RT7]** | Intake collects them natively; county adjacency |
| Sibling-similarity gate | **Required** — 5-gram shingle Jaccard ≤0.30, town-normalized **[RT1]** | Embedding-based; drift test vs brief targets |
| Incumbent inputs | Hand-assembled registry + manual page crawls pasted into `crawledPages`; `organicPosition` null; `rankingUrl` hand-entered **[RT12]**; `analystNotes` carries what classifiers can't **[RT11]** | Automated M1 crawls; positions + rankingUrl from frozen SerpSnapshots; refresh on R7 registry diffs; analystNotes shrinks |
| `whatTheyHave` extraction | Six binary classifiers + heading topic tags (shared lib with info-gain gate from day one) — nothing richer **[RT11]** | Richer topic classifiers; drift test between brief targets and gate baselines |
| FAQ seed kinds | `vertical`, `local-fact`, `manifest`, `proof-job` (FULL) **[RT5][RT14c]** | + `incumbent-gap` (needs the v0.5 classifiers) |
| FACT_COLLECT | Emitted as PROOF_COLLECT with owner question in `action` **[R5]** | `TaskType` gains `"FACT_COLLECT"`; tracker escalation (R8) applies |
| Internal links | Outbound only **[RT14a]**; no anchor-dedup machinery **[RT14b]** | Inbound as a report-renderer join; static dedup check + deterministic rotation through target secondaries |
| Media | At most one entry (job-photo on FULL / generic-real stub + owner task on DEGRADED) **[RT14e]** | Full media plan per section |
| Report rendering | None — `page-briefs.json` is the deliverable; operator reads JSON/a formatted dump | `templates/reports` renders the Recommended Pages section per §6 |
| Guide staleness clock | Noted in brief text only | 12-month re-verification tasks auto-emitted |
| Brief regeneration | Manual M5 re-run after proof/fact arrival (R10 chain exercised by hand once, per v0.1 exit criteria) | R10 auto-regenerates the brief and re-queues PAGE_BUILD |

---

## 8. Conflict & red-team resolutions

### Design-merge resolutions (A vs B)

| # | Conflict | Resolution |
|---|---|---|
| R1 | A: snake_case JSONC brief shape with `head`/`eeat` blocks · B: camelCase TS interface | **B wins** (engine-internal derived type → camelCase per `core/types.ts` conventions). A's unique fields folded in: `head` → `meta.h1Pattern`, `cta`, `media`, `degradedDeltasApplied`, per-section `mustNot`/`uniqueToPage` |
| R2 | A: empty info-gain diff ⇒ brief **fails preflight**, emits research task, no page · B: brief builds with a low-info-gain flag | **Page-type split:** doorway-risk types (service-town, location) fail preflight when the mandatory-local set is unsourceable → BLOCKED + gaps; service/hub/guide/core build with the low-info-gain flag. **Now quantitative per [RT4]** |
| R3 | A: briefs for PLANNED pages only · B: all non-LIVE | **B wins:** BLOCKED briefs are the operator report's "what do you need from me" — deleting them deletes the product's best owner-conversion surface |
| R4 | B typed `organicPosition: number` · v0.1 registry is hand-assembled with no frozen snapshot | Made **nullable**; null documents "manual registry / uncrawled position" instead of inviting an invented rank |
| R5 | B proposes new `FACT_COLLECT` TaskType (a `core/types.ts` change) | Kept as a **proposed** one-line change; v0.1 fallback: emit as `PROOF_COLLECT` with `evidence_required: "local_facts entry verified"` |
| R6 | DEGRADED budget cut: A "20–30%", B "~25%" | **Superseded by [RT4]:** DEGRADED budgets derive from claim mass, not a flat percentage; type floors are clamped to what sources sustain, with a 300-word viability threshold below which the page is BLOCKED |
| R7 | A's guide gate (≥3 verified facts or no guide brief) vs B's generic missing-topic handling | **Both:** the ≥3-facts gate (now URL-provenance, per [RT7]) is the guide-type instantiation of R2's preflight rule |
| R8 | A carried volume inside prose derivation notes · B typed it on `BriefKeyword` | B's typed `volume: number \| null` + `marketExists`; A's report rule kept ("no reliable data", never a guess) |

### Red-team resolutions (findings 1–14 → RT1–RT14)

| # | Finding (severity) | Resolution |
|---|---|---|
| RT1 | `uniqueToPage` was a self-asserted flag; nothing compared sibling rendered text (CRITICAL) | New v0.1 M6 gate **`sibling-similarity`**: 5-gram shingle Jaccard ≤0.30 across same-type siblings' `uniqueToPage` sections, town-token-normalized. `uniqueToPage` redefined as a claim the gate falsifies (§2 doc, §6). Fixture: madlib'd town-swap pair must fail |
| RT2 | One statewide fact could "localize" every town — the spec's own worked example did it (CRITICAL) | `LocalFact.scope: "town"\|"county"\|"state"` (required, backfill rule in §2). Only town/county facts count toward mandatory-local sets, unique-word credit, and claim mass; state facts render once on the parent + ≤40-word summarize/link elsewhere. `faq-unique` compares town-slug-normalized strings. §5 rewritten accordingly (L&I fact reclassified state) |
| RT3 | Acceptance test #5 couldn't distinguish generator failure from a homogeneous market (HIGH) | Divergence requirement narrowed to divergence-capable fields (town-scoped facts, proof); homogeneous inputs → the sibling is BLOCKED (planning signal, fewer pages per R2), never built-similar. Test #5 rewritten with a two-town fixture |
| RT4 | Word minimums exceeded licensed claim mass — the hallucination pump (CRITICAL) | Quantitative claim-mass preflight (§4.3, `BriefPreflight`): supportable = 5× licensed claim words + 40/state fact; <300 ⇒ BLOCKED; floors clamp to supportable; DEGRADED budgets derive from it (supersedes R6). §5 shows the arithmetic: 63 words → 470–590-word page |
| RT5 | `answerFactRefs: []` FAQs were the empty slot the spec claimed it never leaves (HIGH) | FAQs whose topic matches an open FACT_COLLECT are excluded and listed in the gap's `blockedSlots` (`"faq:<slug>"` ids added to the type). Empty `answerFactRefs` only off `regulatedClaimTopics`; "experience" struck as an answer basis on DEGRADED cells. §5's trip-fee FAQ removed and parked in its gap |
| RT6 | Free-prose `purpose` smuggled unsourced claims ("landlord turnover work", "we file the L&I permit") past G8 (HIGH) | `purpose` restructured to `{instruction (byte-equal to template metadata), factRefs, manifestRefs}` — schema-validated, no free channel. First-party process claims need a license-holder-attested fact (or future `services.process_claims[]`); §5 adds `fact-crescent-files-permits` and deletes the turnover claim. Meta descriptions carry refs like body copy |
| RT7 | Owner attestation was a G8 laundering channel at scale (MEDIUM) | `LocalFact.provenance: "url"\|"attestation"` (required). Attestation flavors non-regulated sections only; regulated topics need URL or license-holder statement about the client's own practice. Guide gate requires URL provenance. Operator report surfaces the split |
| RT8 | Homepage and base-city location page both speced to own "[trade] [base city]" — a written-in G7 violation (HIGH) | **Base-city rule** (§3.4/§3.7): the base city gets no location page; the homepage is its location page and permanent intent owner. Preflight rejects `/locations/<base-city>` as a G7 conflict. Acceptance test #1 extended |
| RT9 | secondaries/longTails definitions overlapped (volume-based split undefined in null-volume cells); overflow queries had no home (HIGH) | Structural split (§4.1): long-tail = token-superset of primary/selected secondary; secondaries = first ≤5 non-supersets in rank order; new `unassigned: string[]` bucket (owned for G7, no placement). Partition invariant amended to primary ∪ secondaries ∪ longTails |
| RT10 | Query-string partitioning didn't stop content-level location↔service-town cannibalization from shared facts (MEDIUM) | Fact **primary-home rule** (§4.3): cluster-scoped angle → service-town, general-trade angle → location; the other page summarizes ≤1 sentence + links. `faq-unique` scope = all briefs sharing a town (any type) + parent |
| RT11 | §5's incumbent rows and entities weren't derivable from §4's stated algorithms/data ("active blog", `ourSource:"architecture"`, nonexistent vertical vocab path) (CRITICAL) | Algorithms honestly downgraded: v0.1 `whatTheyHave` = six classifiers + heading tags, period; entities = local_facts proper nouns + manifest structurals + `qaConfig.vocabAllow` ∩ ≥1 crawl (new `"qa-config"` BriefSource; `VerticalProfile` stays vocab-free per its charter). `"architecture"` banned from `whatTheyLack`. New `analystNotes` channel: hand-entered, provenance-flagged, report-only, the one labeled exemption to the derived-law. §5 rewritten to match — acceptance test #3 now reproduces against the real algorithms |
| RT12 | "The specific RANKING page" was underivable (`organicTop10` = businessId refs only) and cell-keyed crawl matching dropped Cheetah's Moscow-URL from the Pullman brief (HIGH) | `SerpSnapshot.organicTop10` → `{businessId, rankingUrl}[]` (proposed one-liner; v0.1 hand-entered). Crawl relevance keyed by `rankingUrl` match; `IncumbentPageCrawl.cell` demoted to informational self-targeting label |
| RT13 | §5's arithmetic left a ~15-word feasible band; "partial" uniqueness vs boolean field (MEDIUM) | Feasibility validation at build time (§4.5): Σ mins ≤ 0.85 × totalMax; uniqueCeiling − floor ≥ 80; violations are loud `{ok:false}` failures. Budgets in §5 recomputed with real slack. Hero `uniqueToPage: false` — boolean, no "partial" |
| RT14 | v0.1 overengineering (MEDIUM) | Cut from v0.1: (a) `internalLinks.inbound` (report join, v0.5); (b) anchor-dedup machinery; (c) `incumbent-gap` FAQ kind (needs v0.5 classifiers; `manifest` kind added instead); (d) full guide/core anatomies (gates + brief-lite stay normative); (e) media beyond one entry. Kept deliberately: shared extraction library, preflight/BLOCKED split, nullable-not-invented, inputGaps-as-owner-questions |
