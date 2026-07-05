# COMPLETENESS ADDENDUM — audit & strategy build vs. "as good as it can be" (FINAL, post-hostile-review)

Synthesized from four gap-hunts (AEO/GEO, adjacent surfaces, conversion+measurement, structural) against `docs/engine-build-spec.md`, `docs/gap-matrix.md`, `core/types.ts`, `core/CONTRACTS.md`, and `/workspace/crescent-electric`, then run through a hostile review. Review findings that survived are integrated below; the draft's scope raids (paid-media advisory, telephony ops, auto-posted reviews, social scheduling) are killed and recorded in the rejected table so they stay dead. Dated claims were re-verified 2026-07-05; corrected grades are shown.

---

## 1. Verdict

No — the build is materially incomplete, and the user's doubt is correct. But the incompleteness is narrower and cheaper to fix than the first draft claimed, and half of the first draft's "fixes" were scope creep that would have broken the engine's own guardrails (G11 owner-hours, G12 honesty, G13 edit-spacing). The four real holes:

1. **The engine measures rank and leads almost nowhere.** No call ledger type exists, call-attribution architecture is undesigned, and the day-0 window is genuinely irreversible: unattributable call history can never be recovered. Worse, the engine's own citation audit would flag a naively-installed tracking number as `WRONG_PHONE` and un-do the install. This is the one true "this week" item — and it drags three legal/operational constraints with it that all four gap-hunters *and* the first draft missed or under-specified: Washington's all-party recording consent (RCW 9.73.030), G13 edit-spacing on any GBP phone-slot change, and the tracking number as a vendor-hostage vector.
2. **The AEO story is a sticker, not machinery** — but the fix is a floor of cheap presence/access work plus two free measurement signals, not a new surface with feasibility physics. `Surface` stays a closed 2-value union (the draft's proposal to widen it would have made `AI_ANSWERS` type-valid in every verdict site, silently breaking the spec §1 product definition); `TaskSurface`/reporting widen instead.
3. **Two live legal exposures**: WA (WAC 296-46B-925) and ID (DOPL) require the electrical license number in advertising including websites — plausibly a defect on the live Crescent site today (same-day audit, hours) — and WCAG at the template layer is a build-once necessity since we build *and* host (on build-once grounds; the draft's ADA-suit statistic was vendor-flavored and is dropped).
4. **One mechanical bug in a shipped rule**: R3 demotes seasonal pages evaluated out-of-season, and G4 indexation latency means generator pages must publish ≈now. Fix is a season mask, v0.1.

**Genuinely NOW (irreversible or freeze-relevant): three things** — call-attribution architecture (with consent + G13 sequencing + portability), the 301/site-equity publish gate, and the R3 season mask. Everything else additive on JSON/SQLite-backed types is cheap *while the parallel core build is open* but is ordinary backlog if missed — the draft's "breaking migration in three months" framing was wrong for pure additions and is retracted. Tier 2 is hard-capped at **one engineer-week** of addendum-driven v0.1 additions, force-ranked in §2.

---

## 2. The miss list, prioritized

Evidence grades: **P**=PROVEN (cited where dated), **L**=LIKELY, **S**=SPECULATIVE. "NOW" = amend v0.1 while it's being built. Hostile-review dispositions marked ⟦HR-n⟧.

### Tier 1 — irreversible, legally live, or mechanically wrong; this week

| # | Gap | Surface/lever | Ev | Engine hook | Version |
|---|-----|--------------|----|-------------|---------|
| 1 | **Call-attribution architecture.** GBP number ≠ site DNI pool ≠ NAP number; citation audit needs an allowlist or it un-does the install. Constraints bundled in ⟦HR-15,17,18⟧: (a) **WA all-party consent** — recording/AI outcome-tagging requires the vendor consent announcement enabled and verified at install, plus a recording-retention policy in the manifest data-ownership block; (b) **G13 sequencing** — a GBP primary-phone change is a structural edit on a 10-month-old SAB profile (suspension risk); prefer Google's supported call-reporting pattern that leaves the primary slot untouched, and if the slot must change, it is an isolated edit with a 14-day buffer and liveness watched; (c) **portability** — the tracking number is vendor-leased; data-ownership block gains number ownership/port-out assertions so we don't build the hostage vector item 8 exists to prevent | Pack-vs-organic call attribution — the G1 premise on the KPI that matters | P | New `CallLedgerRow` + `manifest.integrations.known_tracking_numbers[]` + **G19** (§4a); `auditCitations` consumes allowlist; day-0 `TECH_FIX` task spec | **NOW** — unattributable history can never be recovered |
| 2 | **Per-state license number in all advertising** (WA RCW 19.28 / WAC 296-46B-925; Idaho DOPL) — unenforced. Split per ⟦HR-13⟧: the same-day action is an audit of the live Crescent site + license number in the footer template (hours); the full G17 gate (manifest `licenses[] × page.town.state`, GBP-post + review-ask templates) rides the already-scheduled M6 work, not the freeze | Legal shield + trust element + entity signal | P | Live-site audit + footer fix now; **G17** gate in M6 course | **NOW** (audit+footer), v0.1 (gate) |
| 3 | **Existing-site equity: publish can ship with no 301 map** | Prevents irreversible equity destruction at intake | P | Intake gate: material 90-day GSC clicks or aged live domain ⇒ publish BLOCKED until keep/redirect map exists (manual ~2h at v0.1); manifest `site_equity` block | **NOW** (gate), v0.5 (`crawl-diff.ts`) |
| 4 | **R3 has a season-shaped bug** — demotes a generator page evaluated out-of-season; G4 latency means generator pages must publish ≈now | ORGANIC correctness + timing | P (mechanical) | `season_windows` on service clusters; R3 season mask (impressions judged in-window only); M8 orders PAGE_BUILD by `season_start − indexation_latency` | **NOW** (mask + field) |
| 5 | **AI answers absent from the type system** — but widened at the right layer ⟦HR-11⟧: `Surface` stays closed (verdicts/feasibility/goal-check never see it); `TaskSurface` and a new `ReportSurface` gain `AI_ANSWERS` | All AI answer surfaces, task/report-valid only | L (surface distinctness) | `core/types.ts:26` — `TaskSurface = Surface \| "BOTH" \| "AI_ANSWERS"`; new `ReportSurface = Surface \| "AI_ANSWERS"`; **no feasibility verdicts, no `AI_WON`** (G12 — no honest physics), now enforced by the type system rather than a comment | **NOW** (cheap while build is open) |
| 6 | **Ownership assertions at intake** (domain in client's registrar; GBP client-owned, agency-as-manager; tracking-number portability per #1c) | Anti-hostage; offboarding integrity | P | `validate-manifest` branches + manifest data-ownership block | **NOW** |

**Cheap-while-open type batch** (not freeze-blockers; additive fields don't ossify ⟦HR-10⟧ — do them opportunistically during the open build): `SerpFurniture` gains `lsaSlots`/`lsaAdvertisers`/`aioPresent`/`aioCitedDomains` **alongside** `lsaPresent` (deprecate later, no breaking rename); `ReviewLedgerRow.source` + `unrepliedCount`; `GscMetricsRow` AI-feature dimension; `GbpCellGap.bookingLinkPresent`; staleness stamps (`capturedAt`/`staleAfter`) on registry/keyword-map/verdict types; `VerticalProfile.riskClass` + `season_windows` + `directories` registry; `GateContext.verticalProfile` (field only — gate deferred).

### Tier 2 — v0.1, hard-capped at ONE engineer-week ⟦HR-12⟧, force-ranked

| Rank | Gap | Surface/lever | Ev | Engine hook | Notes |
|---|-----|--------------|----|-------------|-------|
| 1 | Template conversion instrumentation: zero analytics on any CTA; **every Jobber link carries `?source=social_media`** (SiteShell.tsx:107,159,262; ContactForm.tsx:2) | Attribution + after-hours capture | P | Event-instrumented CTA components; per-placement `?source=` derived at render; intake WARN on `ga4: null` when any lead deliverable claimed. Plus ⟦HR-19⟧: a **changeover annotation row in metrics.db** so month-6 reports never chart "leads by source" across the fix boundary | Template code is being extracted this week — marginal cost near zero |
| 2 | AI-crawler access policy + nosnippet footgun. Corrected scope ⟦HR-6⟧: Cloudflare's 2026-09-15 defaults block **Training/Agent categories on ad-displaying pages** (Search stays allowed by default; applies to existing free customers who haven't changed settings; mixed-purpose crawlers get most-restrictive treatment) — an ambient-misconfiguration risk to check per-site, not a universal kill switch; Crescent runs no ads so is likely unaffected, but the check costs minutes | All AI surfaces | P (policy, cited) | Manifest `ai_crawler_policy`; M7 `sitemap-robots.ts` emits it; **G18** static check (robots.txt + nosnippet lint) | Live synthetic-UA collector → v0.5 |
| 3 | Bing Places + Apple Business + Yelp/BBB as AI grounding surfaces — **a cheap hedge, not "where all the value lives"** ⟦HR-7⟧ (ChatGPT increasingly on its own OAI-SearchBot crawl; Perplexity–Yelp is a 2024-era assertion) | ChatGPT, Siri/Spotlight/CarPlay, Perplexity | L | New task type **`LISTING_CLAIM`** (claim + populate; ~2–3 owner-hrs total, G11-sequenced into months 2–3 per §5 ledger); `directories` registry with `ai_grounding` weights; **IndexNow** ping in M7 publish | One owner afternoon; graded honestly |
| 4 | `sameAs` graph generated from citations registry (Crescent has 2 entries: IG+FB) + entity-collision note ("Crescent Electric Supply Co", $2B distributor) | Entity resolution across engines | L (mechanism P) | M7 `schema-graph.ts` derives `sameAs` from citations registry; manifest `entity_collisions[]` + one-time human collision check in §6 checkpoint table | Auto audit → v0.5 |
| 5 | Answer-block shape in generated content — shipped as **genspec template guidance + a per-section answer-block field in the in-flight page-brief generator**, hardened to an M6 gate at v0.5 ⟦HR-12⟧ | AIO/AI Mode, ChatGPT, Perplexity | L (converged practice) | Genspec template + page-brief field (that module is unwritten — adding a field is free); M6 `answerability.ts` gate → v0.5 | Not "zero cost" as a gate; near-zero as guidance |
| 6 | GSC gen-AI performance report — **verified**: launched 2026-06-03, impressions-only, data from 2026-05-18, rolling out UK-subset first ([Google Search Central](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports)) | The one free live AEO metric | P (cited) | `GscMetricsRow` AI-feature dimension (in the cheap-while-open batch); `loop/collectors/gsc.ts` ingests when rollout reaches the property | Schema now, data later |
| 7 | AIO furniture from DataForSEO responses **already paid for** (`aioPresent`/`aioCitedDomains`), snapshot **monthly on M1 cadence** (weekly cut ⟦HR-12⟧) | AI_ANSWERS reporting; LOCAL_PACK context | P (data is in-hand) | Fields in the cheap batch; parse + store at M1 crawl time | Furniture-delta R-rule → v0.5 |
| 8 | Review ledger Google-only; replies unmanaged. **Every reply is owner-approved** ⟦HR-3⟧ — machine-authored auto-posted replies violate G12 ("off-site is human labor, never simulated") and are cut | AI cross-referencing; LSA (reviews are GBP reviews since 2025-07-11, [cited](https://support.google.com/business/community-guide/356978909)); conversion | P | `source`/`unrepliedCount` fields (cheap batch) + a **nudge task** (drafts prepared, owner approves every one, G11-budgeted); unreplied>7d rule → v0.5 | No `approval: none` anywhere off-site |
| 9 | FAQ rich results removed by Google **2026-05-07 — verified** ([SEJ](https://www.searchenginejournal.com/google-drops-faq-rich-results-from-search/574429/); schema still parsed, not deprecated); reports must not promise a dead SERP feature; schema rubric scores `sameAs`/`Service`-`areaServed`/`@id`, not LocalBusiness-blob presence | Report honesty (G12) | P (cited) | M7 checklist wording + renderer-contract rubric (rank 10) | Words, not code |
| 10 | **Renderer contract doc** — contract now, rendering v0.5 per spec §7 ("no M10, no renderers") ⟦HR-5⟧. Binds the in-flight reports module: spam flags/`SPAM_REPORT` provenance stripped from client-facing output (defamation vector); mandatory data-age banner; estimate labels; per-engine invisibility matrix labeled **"prerequisites, not predictions"** ⟦HR-16⟧; any AI-answer screenshot multi-sample, dated, "illustrative — results vary"; deliberate omissions (aggregateRating, llms.txt) stated as discipline; "N calls, M unanswered" only where data exists | Sales honesty; G12 applies to us first | P | One doc in G12 family; costs an afternoon, prevents ossification | Rendering itself ships with the reports module, not here |

**Cut from the draft's Tier 2, with disposition:** `verticalCompliance` gate → v0.5 (its own justification is vertical #2+, which the spec puts at v0.5; the `GateContext` field lands in the cheap batch) · `site-liveness` collector → a $10/mo external pinger + domain/cert expiry on the ops checklist, not engine code · `gbp-insights.ts` → manual monthly spreadsheet export; type + collector at v0.5 · `conversionElements` gate → template-review checklist item · GBP booking-link task → stays, but folded into the G13-sequenced GBP edit calendar, not "wave-1 everything at once" ⟦HR-15⟧ · WCAG 2.1 AA components + axe check in accept path → **stays** (build-once, we host; scare statistic dropped ⟦HR-8⟧) · intake blind-spot manifest fields (`known_competitors[]`, GBP suspension-history, `riskClass`) → stay (fields + validate branches only, minutes each).

### Tier 3 — v0.5, spec the landing slot now

| # | Gap | Hook | Ev |
|---|-----|------|----|
| 11 | GA4 AI-referral channel group (chatgpt.com, Perplexity referrers) above native "AI Assistant" channel | M9 `ai-referrals.ts`; R9-sibling rule | P |
| 12 | DIY prompt-sampling share-of-voice (N samples/priority cell vs ChatGPT/Perplexity/Gemini APIs; **trend-only, estimate-labeled**, quarantine discipline); enterprise tools ($499–26k/yr) rejected at SMB scale | M9 `ai-answers.ts` + `AiAnswerSample` type; goal-check gets SoV trend, never binary WON | L |
| 13 | Incumbent content-hash diffing (info-gain edge silently evaporates when a ranking incumbent rebuilds) — M1 crawl **stores hashes from day one** (v0.1, free); diff+re-run rule at v0.5 | M1 crawl store; CONTENT_DEPTH re-trigger | L |
| 14 | Geo-grid ad-pin contamination (Maps promoted pins; Apple Maps ads) corrupting win clocks — before goal-check goes live | `geogrid.ts` parser flag + feed-health rule | P |
| 15 | LSA slot deltas as **weather feeding R9** (qualified-calls-flat predicate consumes furniture delta). LSA facts, verified: reviews=GBP since 2025-07-11; unified "Google Verified" badge live since **2025-10-20** (the draft's 2026-07-06 date was a policy-doc renaming, corrected ⟦HR-6⟧) | R9 v0.5; one operator-report sentence ("3 LSA slots sit above this pack; eligibility is your call") | P (cited) |
| 16 | Answerability M6 hard gate (hardened from Tier-2 rank-5 guidance) | M6 `answerability.ts` | L |
| 17 | Multi-source review collector + per-platform ask rotation; unreplied>7d rule | `reviews.ts`; R-rule | P |
| 18 | Multi-client ops: per-client `CredentialRef` convention (**document in CONTRACTS now**, one paragraph), scheduler + run budgets + vendor-spend column (spend column from day one), run manifests | `clients/<slug>/credentials`, `cli/` runner, metrics.db | P |
| 19 | Client lifecycle terminal state (R8 currently escalates forever): `ACTIVE\|PAUSED\|OFFBOARDING`, pause-recommendation artifact; `cli/export-client` portability bundle **including tracking-number port-out step** ⟦HR-18⟧ | `clients/<slug>/state.json`; R8 ladder terminus | P |
| 20 | Siri→Gemini→GBP chain — **verification first, one report sentence after, priority multiplier never (until evidence)** ⟦HR-9⟧ | No machinery | S |
| 21 | "Best electrician in [town]" listicle placements (AI engines source ranked listicles; thin-market outsized) | `LINK` subtype `listicle` | L |
| 22 | `ai-crawler-access.ts` live synthetic-UA collector; `crawl-diff.ts`; `gbp-insights` API | M9 | P |

### Rejected — snake oil, dead scope, and the first draft's own overreach (in-spec so nobody re-adds them)

| Item | Why rejected |
|------|--------------|
| **llms.txt** as a visibility lever | ~10% adoption, near-zero AI fetches of deployed files, Google twice on record it's unused. Document the non-decision in M7. If a client demands it: emit static file, never report as a win. |
| **`LSA_ADVISORY` task type + LSA economics reporting** ⟦HR-1⟧ | Paid-media consulting wearing an enum; §5 already says spend is the owner's business. Keep: furniture fields, conditional M4 discount, one report sentence. |
| **Missed-call text-back machinery** ⟦HR-2⟧ | Telephony ops, not SEO. Keep: one intake question + one report line ("N calls, M unanswered — here's a vendor category"). No task type, no R-rule. |
| **Auto-posted review replies (`approval: none`)** ⟦HR-3⟧ | Simulated off-site engagement — violates G12 outright. Every reply owner-approved or the feature is out. |
| **Nextdoor/FB-group recurring tasks** ⟦HR-4⟧ | Social media management; unmeasurable by the engine's own loop. Intake footnote only. |
| **Speakable schema** | News-scoped niche; a competitor recommending it is a tell. |
| **GBP Q&A seeding** | Google retiring Q&A for AI-generated answers; on-site FAQs (M6) are the successor input. |
| **GBP messaging machinery** | Native chat dead since 2024-07. Owner footnote at most. |
| **Reddit/forum seeding** | Cited by engines (P) but seeding = astroturfing: ban/FTC/brand risk. Monitor-only. |
| **Enterprise AI-visibility subscriptions** | $499–26k/yr against a single-town electrician; DIY sampler costs cents. |
| **"AI directory submission" services** | No engine consumes them; classic 2026 grift. |
| **AI_ANSWERS feasibility verdicts / `AI_WON` / probability bands** | No honest physics; inventing bands violates G12 — that would be our own snake oil. Now type-enforced (`Surface` closed). |
| **ADA overlay widgets** | Litigation bait; real WCAG at template layer instead. |
| **A/B testing** | Traffic at this scale is noise. |
| **`aggregateRating` self-markup** | Already banned (G10); reports state the omission as deliberate. |
| **N=1 "ChatGPT recommends your competitor" sales screenshot** ⟦HR-16⟧ | Cherry-picked single sample of a stochastic system = the dishonesty we ban internally. Multi-sample, dated, "illustrative — results vary," or cut. |

---

## 3. AEO verdict specifically

**Current state: a local-SEO engine with a cosmetic AEO sticker.** The AEO report section audits proxies (schema/NAP/FAQ/reviews) while the engine has no AI task surface, no access check, and ignores two free signals. That stands. What changed under review is the *size and grade* of the fix:

- **Floor (cheap, graded honestly):** AI-crawler access asserted and statically checked (G18) — the Cloudflare 2026-09-15 default change is real but scoped (Training/Agent on ad-displaying pages; Search allowed; mixed-purpose crawlers most-restrictive), so this is a per-site misconfiguration check, not a sky-is-falling flip; no `nosnippet` on money pages; Bing Places + Apple Business + Yelp/BBB claimed and populated (`LISTING_CLAIM`, one owner afternoon, **graded L — a cheap hedge, not "where all the value lives"**); generated `sameAs` graph; IndexNow on publish.
- **Shape (L, near-zero marginal cost):** answer-block spec in the in-flight page-brief generator + genspec guidance now; M6 hard gate at v0.5.
- **Measurement (P where free, deferred where not):** AIO presence/citations parsed from DataForSEO responses already paid for (v0.1, monthly); GSC gen-AI impressions dimension (schema v0.1; launched 2026-06-03, impressions-only, UK-first rollout — data when it reaches the property); GA4 AI-referral channel (v0.5); DIY prompt-sampling SoV trend (v0.5). Live AI-answer sampling stays deferred — the original call was right; it had merely deferred the free half along with the expensive half.
- **The reframe:** GBP work is now AEO work — AIO/AI Mode read GBP, and LSA reviews *are* GBP reviews (verified). The two-surface framing undersells work the engine already does; the operator report says so in one sentence.
- **The hype we skip** (rejected table) is itself sales material: "your competitor's agency sold them llms.txt; it does nothing."

Honesty constraints, now structural: `Surface` closed at the type level; no `AI_WON`; trend-only SoV; prospect matrix labeled "prerequisites, not predictions"; screenshots multi-sample and labeled. G12 applies to us first — including in the sales deck.

---

## 4. Spec deltas (apply-ready)

### 4a. New guardrails (G-table §6 of `docs/engine-build-spec.md`)

- **G17 — Advertising disclosure.** Every page targeting state S renders the manifest license number for S (footer + schema); extends to GBP post templates and review-ask scripts. M6 gate `requiredDisclosures` fed by `manifest.licenses[] × page.town.state`. Hard fail. *Sequencing: live-site audit + footer fix same-day; gate machinery in scheduled M6 work.*
- **G18 — Answer-engine access.** No search-class AI crawler (OAI-SearchBot, PerplexityBot, ClaudeBot, Googlebot, Bingbot) blocked at robots.txt or edge; no `nosnippet`/`max-snippet` on money pages; training-bot opt-out (GPTBot, Google-Extended) is a named owner decision recorded in the manifest, never a default and never conflated with search access. No plan may claim an AEO deliverable while this gate fails. v0.1: static check; v0.5: live synthetic-UA collector.
- **G19 — Attribution integrity + consent.** (a) NAP phone (`phone_nap`) appears in schema and citations, always; tracking numbers live only in Google-supported call-reporting slots and on-site DNI; `auditCitations` consumes `manifest.integrations.known_tracking_numbers[]` and never flags them `WRONG_PHONE`; `validate-manifest` errors if a tracking number equals `phone_nap`. (b) **Consent:** call recording/AI outcome-tagging requires the vendor's consent announcement enabled and verified at install (WA RCW 9.73.030 all-party consent); recording-retention policy recorded in the manifest data-ownership block. (c) **Sequencing:** any GBP primary-phone-slot change is a G13 structural edit — isolated, 14-day buffer, liveness watched; prefer patterns that leave the primary slot untouched. (d) **Portability:** number ownership/port-out assertions in the data-ownership block; `cli/export-client` gains a port-out step.

### 4b. `core/types.ts` (cheap while the parallel build is open; only `CallLedgerRow` + G19 fields are urgent)

```ts
// line 23 — Surface stays CLOSED. Verdicts/feasibility/goal-check never see AI_ANSWERS.
export type Surface = "LOCAL_PACK" | "ORGANIC";

// line 26 — widen at the task/report layer instead:
export type TaskSurface = Surface | "BOTH" | "AI_ANSWERS";
export type ReportSurface = Surface | "AI_ANSWERS";

// NEW — urgent (day-0 irreversibility)
export interface CallLedgerRow { observedAt: string; trackingSource: string; durationSec: number;
  classification: "BOOKED"|"QUALIFIED"|"SPAM"|"MISSED"|"OTHER"; cellAttribution: Cell | null;
  consentAnnouncementVerified: boolean; }

// line 319 — SerpFurniture: ADDITIVE, keep lsaPresent, deprecate later (no breaking rename)
lsaSlots: number | null;
lsaAdvertisers: string[];    // registry businessId refs, best-effort
aioPresent: boolean | null;
aioCitedDomains: string[];   // parsed from existing DataForSEO responses

// line 593 — ReviewLedgerRow
source: "google" | "yelp" | "facebook" | "bbb" | "angi" | "nextdoor";
unrepliedCount: number | null;

// line 636 — GateContext (field now; verticalCompliance gate v0.5)
verticalProfile: VerticalProfile;

// GscMetricsRow: add searchAppearance / AI-feature dimension (GSC gen-AI report, launched 2026-06-03)
// CompetitorRegistry, KeywordMap, CellVerdict: add capturedAt: string; staleAfter: string;
// GbpCellGap: add bookingLinkPresent: boolean | null;
// VerticalProfile: add riskClass: "trade"|"licensed-trade"|"regulated-professional"|"refuse";
//   season_windows on service clusters; directories: { platform, ai_grounding: number, askPolicy: "ok"|"never" }[];
// metrics.db: annotations table (one row = dated changeover note, e.g. the ?source= fix boundary)
// GbpInsightsRow → v0.5 with the collector.
```

### 4c. New task types (M8)

`LISTING_CLAIM` (claim+populate Bing Places / Apple Business / Yelp / BBB; G11-sequenced months 2–3; IndexNow ping lives in M7 publish, not here) · `REVIEW_REPLY` (recurring; **every reply owner-approved** — drafts prepared, `approval: owner` always; G10-parallel wording rules). Day-0 additions to intake emission: call-tracking install per G19 (number layout, consent verified, outcome-tagging on, G13 sequencing); GBP booking-link `GBP_EDIT` with `?source=gbp` slotted into the G13 edit calendar. *Cut: `LSA_ADVISORY`, missed-call text-back task, Nextdoor recurring tasks (rejected table).*

### 4d. New/changed collectors (M9)

v0.1: `calls.ts` (stub, fixture-driven) · `gsc.ts` gains AI-feature dimension · monthly furniture snapshot per priority cell on M1 cadence · M1 crawl stores incumbent content hashes. v0.5: `gbp-insights.ts` (manual export → API) · `ai-crawler-access.ts` (synthetic UA) · `ai-referrals.ts` · `ai-answers.ts` sampler · geo-grid ad-pin flag (before goal-check live) · `crawl-diff.ts`. *Cut from engine: site-liveness (external pinger + ops checklist).*

### 4e. Rule changes

v0.1: R3 gains season mask (bug fix); M8 orders PAGE_BUILD by `season_start − indexation_latency`. v0.5: R9 predicate becomes "**qualified** calls flat" and consumes furniture *delta*; unreplied review >7 days → REVIEW_REPLY nudge; incumbent hash changed → re-run infoGain → CONTENT_DEPTH. *Cut: answered-rate escalation rule (telephony ops).*

### 4f. Manifest / intake

New fields: `ai_crawler_policy`, `entity_collisions[]`, `known_competitors[]`, `integrations.known_tracking_numbers[]`, `site_equity` block, GBP existence/eligibility/suspension-history, data-ownership block (domain registrar = client; GBP owner = client; tracking-number ownership/port-out; call-recording retention policy), missed-call intake question (data only — no machinery). New validation: 301-map-before-publish gate when equity exists; `ga4: null` + any lead deliverable = HARD WARN + day-0 setup task; tracking-number ≠ `phone_nap`; `riskClass: "refuse"` rejects (regulated-professional verticals v1.0 earliest, counsel-reviewed profile required — say so in spec); ownership assertions. New §6 checkpoint row: one-time entity-collision search ("Crescent Electric Supply Co", $2B distributor, is the live example).

### 4g. M6 / M7 / templates

M6 v0.1: `requiredDisclosures` (G17) in the already-scheduled gate work. M6 v0.5: `answerability.ts`, `verticalCompliance`. M7: robots emitter owns G18 policy + one paragraph documenting the llms.txt non-decision; IndexNow ping on publish; `schema-graph.ts` derives `sameAs` from citations registry + `knowsAbout` from clusters; axe-style accessibility check in accept path; don't hardcode `lang="en"` into the content model. Templates (in flight this week): event-instrumented CTAs; render-time `?source=` params (fixes SiteShell.tsx:107,159,262 and ContactForm.tsx:2 — **with a metrics.db changeover annotation** so pre/post data is never naively compared); license-number footer slot (G17); WCAG 2.1 AA components; conversion-elements checklist (tel CTA above fold, license visible, review link, booking ≤1 click) applied at template review, not as an M6 gate.

### 4h. Reports (contract now, rendering v0.5 per spec §7)

One contract doc, G12 family, written this week because the reports module is in flight: spam flags/`SPAM_REPORT` provenance stripped from all client-facing output; mandatory data-age banner (fed by staleness stamps); estimate labels; never promise FAQ *rich results* (removed 2026-05-07; schema still parsed — say both); deliberate omissions (aggregateRating, llms.txt) stated as discipline. Operator report: after-the-click line (calls, unanswered count where data exists), one LSA-context sentence, seasonal calendar, GBP-is-AEO sentence. Prospect report: per-engine matrix (rows: ChatGPT, AIO/AI Mode, Perplexity, Gemini, Siri/Apple, Copilot; columns: crawler access, Bing Places, GBP completeness, Apple Business, Yelp/BBB, sameAs/entity, answerability, schema — all artifact-derived) **labeled "prerequisites, not predictions"**; AI-answer sampling shown only as multi-sample, dated, "illustrative — results vary."

### 4i. Page-brief generator (committed scope — fix before it's written)

Adds: per-section answer-block spec; owner-questions emitted as dedup'd `PROOF_COLLECT` tasks with `estimated_human_minutes` (G11), never free text; incumbent-crawl date stamp; no GBP Q&A-seeding items.

---

## 5. What we deliberately leave out — and the budgets that bind the rest

**Out (per rejected table + review):** LSA/ads advisory and bid management · missed-call text-back machinery · auto-posted review replies · Nextdoor/FB recurring tasks · llms.txt, Speakable, GBP Q&A seeding, GBP chat, Reddit seeding, AI-directory submissions, overlay widgets, enterprise AI-tracking subs · AI_ANSWERS feasibility scoring / `AI_WON` · Bing/Apple/Yelp rank tracking (presence yes, rank no) · live ChatGPT/Perplexity sampling at v0.1 · video/YouTube (client hard-no; revisit per-vertical v1.0) · multi-language (one cheap guard: no structural `hreflang` preclusion) · regulated-professional verticals until a counsel-reviewed profile exists (v1.0 earliest) · A/B testing · Siri→Gemini priority multiplier (verify first, sentence after, multiplier never until evidence).

**Engineer-week budget (⟦HR-12⟧, binding):** addendum-driven v0.1 additions ≤ 1 engineer-week, spent in §2 Tier-2 rank order; anything that doesn't fit slides to v0.5 in rank order. The Tier-1 items are not in this budget (they are bug fixes, legal exposure, and irreversibility).

**Owner-hours ledger (⟦HR-14⟧, binding — Crescent `owner_commitments.hours_per_month: 4`, review asks already consume part of it):**

| Month | Items | Est. hrs |
|---|---|---|
| 1 | Call-tracking decision + consent config sign-off (~1.0); ownership + portability assertions (~0.5); license/footer verification sign-off (~0.25); GBP booking link approval (~0.25) | ~2.0 + existing review asks |
| 2 | `LISTING_CLAIM` wave 1: Bing Places + Apple Business (~1.5); first batched PROOF_COLLECT questions (~0.5) | ~2.0 |
| 3 | `LISTING_CLAIM` wave 2: Yelp + BBB (~1.0); review-reply approvals begin (~0.5/mo steady-state) | ~1.5 |

Intake's `throughput-forecast.ts` re-runs with these waves before any task is emitted; anything over budget slides a month or dies. GBP edits (booking link, any phone-slot change, service edits) are additionally sequenced through the G13 calendar — one structural edit per 7–14 days, phone change isolated with a 14-day buffer.

**If only five things get done this week:** (1) G19 + `CallLedgerRow` + the day-0 call-tracking task spec with consent, G13 sequencing, and portability; (2) same-day license audit of the live Crescent site + footer fix (G17 gate rides scheduled M6 work); (3) the 301/site-equity publish gate; (4) the R3 season mask (generator publish window is ≈now); (5) `TaskSurface`/`ReportSurface` widening + the cheap additive type batch in one commit while the core build is open.

**Verify-before-client-facing-use list** (claims that lost P under review; do not put in reports until cited): AIO/3-pack overlap percentages · AI-Mode/AIO citation overlap · SMB unanswered-call rates · ADA suit counts · Perplexity–Yelp grounding currency · Siri→Gemini→GBP chain.

Key files: `/home/user/Ptest/core/types.ts` (lines 23–26, 319, 593, 636) · `/home/user/Ptest/core/CONTRACTS.md` (§7 gates, §10 loop, §11 rules) · `/home/user/Ptest/docs/engine-build-spec.md` (§1 product definition, §4 M7, §6 G-table, §7 roadmap, R-table) · `/workspace/crescent-electric/app/robots.ts`, `SiteShell.tsx:107,159,262`, `ContactForm.tsx:2`.

Sources for dated claims: [GSC gen-AI performance reports (2026-06-03)](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports) · [Cloudflare AI-crawler defaults (2026-09-15)](https://blog.cloudflare.com/content-independence-day-ai-options/) · [FAQ rich results removal (2026-05-07)](https://www.searchenginejournal.com/google-drops-faq-rich-results-from-search/574429/) · [LSA reviews via GBP (2025-07-11)](https://support.google.com/business/community-guide/356978909) · [Google Verified badge unification (2025-10-20)](https://www.coalmarch.com/resources/blog/google-lsa-automated-credits-verified-badge-updates).
