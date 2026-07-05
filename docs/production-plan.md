# THE PRODUCTION PLAN (FINAL) — seo-engine v0.1 → operating 2 paying clients

**Status:** final, post-hostile-review. Integrates the red-team's 18 findings (capacity math restated, live-site cutover protected, sales pipeline added, day-90 SCALE split from the sales gate) and the two sibling docs that have now **landed on disk**: `docs/page-brief-spec.md` (the first-10 editorial rubric is now the brief-conformance rubric, not an interim checklist) and `docs/completeness-addendum.md` (call-attribution consent/G13 sequencing, 301/site-equity gate, license-number audit, R3 season mask, uptime pinger, v0.5 wiring reconciliation).

**Operator model:** one technical operator (Mike) + AI agents + client-owners. **The honest labor numbers, stated once and used everywhere below:** ramp = **15–20 hr/wk for weeks 0–4** (mostly agent-code review + onboarding); steady state = **12–15 hr/mo/client at v0.x** (not the spec's 6–10 aspiration — that is the v0.5 target, and pricing below reflects the honest number). A standing **2 hr/wk incident buffer** is part of the capacity model, not overflow. If EvoStack's existing book exceeds ~20 hr/wk, the 16-week sequence stretches to 20 — decide that in week 0, not by discovering it in week 3.

**"M reviews" is now defined (review tiers):**
- **Tier L (line-by-line):** anything on a money path or live-site path — budget caps, `api_costs`, QA gates, publish/deploy path, GBP edit logic, escalation logic, 301 maps. Budget 1 hr per ~150 changed lines.
- **Tier S (spot-check + tests-as-proof):** collectors against fixtures, GHA workflows, scaffolding. Verified by injected-failure drills, not by reading every line.
- **Tier A (acceptance-suite-only):** pure refactors behind a green acceptance suite and determinism diff.
Every hardening item below carries its tier. Review at ~2 hr/wk against 3–4 eng-weeks of agent output would be rubber-stamping; the ramp budget prices real review.

**Context state (2026-07-05):** intake done; M1–M8, plan/tracker, collectors, CLI, e2e in flight (13-agent loop); fixture-driven, zero live feeds; Crescent hand-built site LIVE on Vercel (`crescentinlandnw.com`); page-brief-spec + completeness-addendum ON DISK.

---

## 1. DEFINITION OF PRODUCTION-READY (the exit bar)

The program exits when ALL of these hold:

**Engine / infra**
- [ ] Every CLI run emits a run manifest (`runs/<run_id>/run.json`): modules, versions, artifact hashes, per-module status, wall time, API cost.
- [ ] Runs idempotent + resumable; re-ingest never double-counts; interrupted runs resume without recompute or double-charge.
- [ ] Every artifact read zod-parsed at the boundary (fail loud, dotted paths); every artifact carries `schema_version` + `generated_at` + `inputs_hash` + event-based `stale_after_events`.
- [ ] `metrics.db` migrations table; fresh and upgraded DBs schema-identical; code refuses a newer DB.
- [ ] Hard API budget caps (per-run ~$10 + per-month ~$150) per client; breach = abort + ESCALATION artifact, never a surprise bill. Prepaid DFS balance is the structural backstop.
- [ ] All timestamps UTC ISO-8601 via `core/dates.ts`; G13 spacing and ISO-week bucketing pass DST-boundary tests.
- [ ] CI required and green: typecheck+vitest on push; fixture acceptance suite (spec invariants + double-run determinism diff) on PR; secret-shape grep gate. (Weekly gitleaks/npm-audit: **deferred to post-first-invoice** — one manual pass at week 2 suffices at N=1.)
- [ ] Structured JSONL logs per run; a failed Tuesday run is diagnosable Thursday without rerunning.
- [ ] **Storage decided now, not later:** raw API responses → Cloudflare R2 with a manifest of content hashes committed to git; git keeps artifacts + weekly `metrics.db` text dump. Repo never becomes a multi-GB fossil bed; GHA checkout time stays flat. Rebuilding `metrics.db` from R2 raws is the restore path.

**Live operation**
- [ ] Live fetch layer (DataForSEO SERP/Maps/Business Data, GSC) writes raw responses fixture-shaped to R2 + `runs/<id>/raw/` manifest, then invokes the existing fixture-driven collectors. Target: zero edits to `loop/` or `rules/`; **accepted fallback if the H-6 seam missed the build window: edits confined to one named adapter file**, acceptance suite as the net.
- [ ] 14 consecutive days of green scheduled collector runs on Crescent **before any GBP structural edit**; R13 quarantine and R12 GBP-liveness verified against seeded failures on the live path; injected credential failure alerts Mike (email + push) within one cycle.
- [ ] **Uptime monitoring live:** external pinger per client domain (homepage 200 + content assertion) + domain/cert expiry on the ops checklist, wired to the same ntfy channel. EvoStack hosts the product; a silently down site is zero calls and calls are the KPI.
- [ ] Cost metering: `api_costs` table (DFS `cost` field + LLM tokens + subscription seed rows); **monthly eyeball reconciliation vs the DFS dashboard** (automated 5%-tolerance reconciliation deferred until 3 clients — it's fleet tooling).
- [ ] Disaster recovery drilled **once** (H-14): fresh clone + `clients/<slug>/` + R2 raws = full restore, artifacts byte-identical. (Quarterly re-drills deferred to 3+ clients.)

**Client operation**
- [ ] Crescent meets the spec v0.1 exit on the live site: `plan.json` ≥30 gated tasks fitting committed owner hours; DEGRADED rebuilds + ≥3 never-built pages live G14-paced; ≥1 manual R10 DEGRADED→FULL upgrade on real proof; call tracking reporting **with WA all-party-consent announcement verified at install**; 4 weeks clean metrics, zero quarantine leaks; forecast-vs-actuals reviewed with the owner once.
- [ ] **The live site is not damaged:** no priority cell materially below its 2-scan baseline attributable to rebuilds — the regression tripwire (W-PILOT) never fired unresolved; page-level rollback artifacts exist for every replaced page.
- [ ] License-number-in-advertising compliance (WA WAC 296-46B-925 / ID DOPL) verified on every live page; 301/site-equity gate enforced at publish; R3 season mask live so no seasonal page is demoted out-of-season.
- [ ] Weekly cadence proven: 4 consecutive Monday rituals ≤1 hr each (**the brief consumption IS the 45-min triage block, not additive**); ≥2 actioned findings from the standing SQL pack; every task transition traceable; first R10 upgrade within 7 days of proof arrival.
- [ ] Contract path proven: **interim LOI signed + first payment collected by week 2** (grandfathered $750–1,000 as papered consideration: case-study rights + data consent + testimonial); full lawyer-reviewed exhibit set swapped in by week 9 hard deadline. A client who has never paid is a demo, and demos produce demo-quality owner throughput.
- [ ] Client #2 signed **at the day-150 value checkpoint** (not day-90) against the selection criteria, onboarded via the runbook: intake→published→collecting in <2 weeks wall-clock, <1 day human research, zero core-code edits (v0.5 generalization proof).
- [ ] Mike's actual measured labor **≤15 hr/mo/client** across a full month at 2 clients (time-log mandatory from week 4), trending toward ≤10 by v0.5 exit. First-10 editorial hours and the 10–15% maintenance-tax review hours are ON this ledger, not beside it.

---

## 2. WORKSTREAMS

**Owner key:** [M]=Mike · [A]=AI agent (tiered review) · [O]=client-owner (Parker for Crescent) · [P]=professional (lawyer). Efforts: S ≤1d, M 2–5d, L 1–3wk.

### W-INFRA — Runtime, feeds, hosting, secrets

**Goal:** the engine runs on a schedule, on live data, with alerting and metering — no pet servers, no fleet tooling before a fleet exists.

**Scheduler resolution (stands):** GitHub Actions runs the deterministic loop (cron, secrets, logs, failure email, ~$0–4/mo); Claude sessions driven by Mike do judgment only. VPS rejected.

| # | Task | Owner | Effort | Cost |
|---|---|---|---|---|
| I1 | **Fetch layer behind the H-6 seam**: `cli/fetch/{gsc,geogrid,reviews,liveness}.ts` — live API → raw response to R2 (hash manifest in git) → existing collector → MetricsStore. **Contingency (red-team 16):** if M1/M9 poured concrete before the seam landed, budget 2–4 days adapter-shim in week 1; "zero core edits" relaxes to "edits confined to one named adapter file." | A, M Tier-S | M (1–2d, +2–4d fallback) | — |
| I2 | Four GHA workflows: `collect-gsc.yml` (daily, 3-day-lagged), `collect-weekly.yml` (Mon: grid → reviews → liveness → ingest → commit), `weekly-review.yml` (Mon: standing SQL → brief → Issue), `escalation-check.yml` (fetch failure / R12 hard-stop / R13 quarantine / DFS low balance / **uptime failure** → labeled Issue + ntfy push). All `workflow_dispatch`-able. Multi-client matrix/concurrency plumbing: **written single-client now, generalized at client #2** — no fleet abstractions at N=1. R12 issue pinned + `hard-stop`; collect skips GBP-dependent emission while open. | A, M Tier-S (verified by injected-failure drills) | M (2d) | $0–4/mo |
| I3 | **Storage (decided now — red-team 8):** raw responses → **R2** (free tier, then pennies), content-hash manifest committed per run; git keeps artifacts + `metrics.db` + weekly `sqlite3 .dump \| gzip`. No repo-as-raw-database. | A | S | ~$0 |
| I4 | **DataForSEO**: register, $50 deposit (prepaid balance IS the hard cap), low-balance alert at $15, creds → GHA secrets. Standard queue (~3× cheaper). Grid ≈ $1.50–5/mo/client at v0.1 volume. | M | 30 min | $50 |
| I5 | **GSC**: service account primary (agency controls DNS → self-verify `sc-domain:`, SA as Full user, no user-token expiry). Owner-delegation fallback for client-owned properties. | M | 1 hr | $0 |
| I6 | **GBP API**: file day 0, 60-day calendar check, build nothing against it. Plan of record stays screenshots + M3 transcription. | M | 30 min | $0 |
| I7 | **Call tracking (CallRail-class)** — resequenced per red-team 12/13 + addendum Tier-1 #1: **(a)** Mike provisions **day 0 on EvoStack's card** (critical path never hostage to owner billing latency); billing transfers to Crescent's name at LOI signature — portability preserved, number ports at exit. **(b)** **WA all-party consent (RCW 9.73.030):** vendor consent announcement enabled and verified at install; recording-retention policy recorded in the manifest data-ownership block. **(c)** **GBP primary phone is NOT swapped.** Default = Google's supported call-reporting pattern that leaves the primary slot untouched (addendum 1b); if a slot change is ever required it is an isolated G13 edit with a 14-day liveness buffer, only after R12 has 14 green days, with the reinstatement runbook already written. **(d)** `manifest.integrations.known_tracking_numbers[]` allowlist so `auditCitations` doesn't file WRONG_PHONE against our own install (G19). **(e)** DNI via template package manifest; schema `LocalBusiness.telephone` stays the real NAP number. **(f)** Pricing: **pass-through on the client invoice** (decided — the offboarding-consistent choice); note per-minute overages + taxes/fees ≈ +10–20% over sticker. Monthly CSV → raw store until v0.5 live pull. | M installs, O signs consent + NAP-note, A template PR (Tier L — live site) | 1.5 hr M | $45–65/mo + overage, pass-through |
| I8 | **Vercel Pro** ($20/mo — Hobby prohibits commercial use; add to spec §7; **per-seat** — solo fine, any contractor with deploy access doubles it). Preview-noindex CI gate (`X-Robots-Tag: noindex` on previews, indexable on prod). DNS cutover runbook for FUTURE clients only. **Crescent: no DNS cutover — but content cutover is real surgery; see W-PILOT tripwire.** | A scripts, M Tier-L on the publish path | 1d A + 2 hr M | $20/mo total |
| I9 | **Secrets + doctor + metering (right-sized)**: flat GHA secrets, `<PROVIDER>__<SLUG>` convention; CI grep gate for credential shapes; `doctor` subcommand validates tokens/balance at top of every scheduled run (OAuth expiry = specific ESCALATION, never a silent empty ingest); `api_costs` table + cost line in the weekly brief. **Deferred to 3 clients:** automated 5% reconciliation, GHA Environments, scheduled gitleaks. | A + M values | 1–2d | $0 |
| I10 | **Uptime + cert monitoring (new — red-team 18 / addendum):** external pinger per client domain (homepage 200 + content assertion, e.g. UptimeRobot-class free tier), domain/cert expiry on the monthly ops checklist, alerts into ntfy. 30 minutes of work; the cheapest insurance after H-5. | M | 30 min | $0–10/mo |

**Exit:** 14 days green scheduled runs; injected DFS-credential failure → alert within one cycle; seeded `profileVisible:false` → pinned R12 issue + paused emission; preview-noindex green; uptime alert fires on a seeded 500; storage split (R2 raws / git artifacts) operating; DR drill run once.

### W-HARD — Engineering hardening (slots inside indexation dead time)

**P0 — before any live page publish (~2 wks agent work; Mike review budget: 8–12 hr/wk in weeks 1–3, tiered):**

| # | Item | Review tier | Effort |
|---|---|---|---|
| H-1 | Run manifest + CLI orchestrator. Exit: kill mid-M4 → run.json shows M1–M2 OK, M4 FAILED, nothing downstream. | S | M |
| H-2 | Idempotent/resumable runs (orchestrator memoization on input hashes). Exit: completed-run re-invoke <2s no-op. | S | M |
| H-3 | `loadArtifact<T>(path, schema)` — zod on READ at every handoff. Exit: truncated registry fails M4 loud. | L (data integrity) | S/M |
| H-4 | Structured JSONL logging; lint-ban bare `console.log` in pipeline. | A | S |
| H-5 | API budget caps in `engine-config.json` (per-run ~$10, per-month ~$150). Built against fixtures NOW so the seam pre-exists live wiring. Exit: $0.01 cap + synthetic 1000-call sweep aborts with ESCALATION. | **L (money path)** | S |
| H-6 | **Source seams** (`SerpSource`/`GscSource`/`BusinessDataSource`) — land before M1/M9 pour concrete; CONTRACTS amendment. `FixtureSerpSource` only v0.1 impl. **Fallback if the race is lost: I1 adapter-shim, named file, 2–4 days.** | L (architecture) | S/M |
| H-7 | Artifact envelope: `schema_version` + `generated_at` + `inputs_hash` + `stale_after_events`. | S | S |
| H-8 | `core/dates.ts`: UTC-only, ISO-week helpers, lint-ban raw `new Date()` arithmetic. Exit: G13 spacing across DST. | S | S |
| H-8b | **Addendum NOW items (new):** R3 season mask + `season_windows`; 301/site-equity publish gate (aged domain or material 90-day GSC clicks ⇒ publish BLOCKED until keep/redirect map exists); `known_tracking_numbers` allowlist in `auditCitations` (G19); ownership assertions in `validate-manifest`. | L (publish path) | M |

**P1 — before the loop runs unattended (~1 wk):** H-9 metrics.db migrations; H-10 feed-health generalized (0-row GSC day = UNKNOWN, never zero); H-11 R8 escalation artifact format; H-12 **SQL pack v1 — 4 queries, not 12** (see W-OPS); H-13 merged into I9; H-14 DR drill (once).

**P2 — resequenced (red-team 4/5):** H-15 multi-client isolation (`--client` required, per-client locks/budgets) and H-18 golden-file vendor contract tests move to **after DP-3 says SCALE, before client-#2 onboarding**; H-16 renderer determinism + estimate-labeling lint rides the reports module; H-17 genspec→QA compilation only at template-set #2. **Offboarding export tooling + dry-run also lives here, not in pilot weeks** — the contract *clause* is week-2 words; the tooling waits for a SCALE verdict.

**CI order:** `ci.yml` day 1; `acceptance.yml` when the CLI exists (frozen Crescent fixtures, invariants, determinism diff); `fixture-drift.yml` weekly once live creds exist — issue, never a red X.

**Exit:** §1 engine/infra checklist; P0 (incl. H-8b) before any live page publish; P1 before week 5 of unattended cadence; P2 before client-#2 onboarding.

### W-OPS — Operating cadence, task flow, quality gates, offboarding

**Goal:** Mike operates N clients inside the **honest** 12–15 hr/mo/client v0.x envelope, with the owner labor loop flowing and every §6 checkpoint staffed.

**Onboarding runbook (≤5 business days, ≤8 hrs Mike; unchanged in substance):** Day 0 pre-signature scripted SERP pulls (~$5–15) → draft registry → M4 scoreCells; Mike reviews every INFEASIBLE/LONG_HORIZON pre-prospect; throughput-forecast conversation, commitments verbatim in the manifest; **contract = interim LOI if exhibits aren't final** (commitment schedule + data consent + month-to-month + payment), full exhibits swapped when ready. Day 1: 60–90 min intake (NAP/E.164, licenses read back incl. **license-number-in-advertising check**, drive-time towns, do_not_offer, 30 min local_facts with `source_url_or_owner_attestation`, G6 proof expectations, review script sign-off, pricing policy). Day 1–2 access grants [O 30 min]: GBP Manager (never Primary Owner), GSC, call-tracking billing transfer + consent announcement verified, domain stays in client registrar. Day 2–3: manifest → green validate → pipeline → plan.json; Mike judgment pass (verdicts, conflictLog, G11 rollup, citation audit **against the tracking-number allowlist**). Day 3–4: GBP transcription spot-check (A + M 20%). Day 5: kickoff — Mike narrates the artifacts, digest #1, collector clock starts.

**Weekly cadence (per client, steady state).** The Monday brief consumption **is** the triage block — one 45-min sitting, not two line items:

| When | Who | What |
|---|---|---|
| Daily | GHA | GSC collect; alert after 2 consecutive missed days; uptime pinger continuous |
| Mon early | GHA | Weekly collect + SQL pack → Monday brief + Issue; owner digest drafted, never auto-sent |
| **Mon 9:00–9:45** | M | One block: triage in strict order — (1) R12 hard-stop; (2) R13/vendor health + **sitewide-devaluation query** once pages ship; (3) R8 overdue ≥2 cycles; (4) R4 alarms past G4; (5) approve + send digest |
| Mon–Tue | M | Judgment queue 30–45 min: `human_review` approvals (GBP edits w/ G13 check, CANNIBAL_FIX, SPAM_REPORT evidence), editorial due |
| Wed | A | Execute unblocked agent tasks → PRs; process owner evidence; R10 → rebuild queue |
| Thu | M 15 min | PR approvals (G14 pacing check) |
| Fri | A | Ledger hygiene: detectOverdue, reconciliation, next week's scan list |

**The honest per-client monthly ledger (red-team 2):** cadence ~7.5 hr + monthly review 1 hr + quarterly amortized ~0.7 hr + editorial (first-10 ramp 1.5–3 hr/wk, steady sampling ~1–2 hr/mo) + transcription spot-verify ~0.5 hr + maintenance-tax review ~1–1.5 hr + amortized incident buffer = **12–15 hr/mo/client at v0.x**. This is the number pricing uses. Time-log from week 4; DP-2 reads it.

**Standing SQL pack — staged (red-team 6):** **Week 4 ships 5 queries with day-one signal:** R12 liveness, R13 quarantine/vendor health, R8 overdue joined to dependents, G11 capacity (>90% flag), canary (no future timestamps, no 8-day weeks). **When first pages ship, add the 6th: sitewide-devaluation tripwire** (sitewide GSC impressions/coverage drop pattern distinct from new-page lag — the doorway-risk detector, risk #9). **Week 8+ adds the demand/rank set** (R4 indexation, R3 dead demand w/ season mask, R1 striking distance, R2 precursor, R6 velocity w/ low-confidence banner, R10 proof arrivals, R11/G16 volatility screen — Mike decides freeze, never the query, goalCheck tabulation, R7-lite competitor delta). Twelve queries at week 4 would report on data that can't say anything yet.

**Owner task flow (unchanged):** SMS-first, one task per text, photo-reply = evidence, [A] parses + transitions, Mike verifies Fridays; Monday email digest is the durable record. R8 ladder: cycle-2 friendly SMS → cycle-3 ten-minute call with unblocking moves → cycle-4 formal ESCALATION + named-cause downgrades + forecast re-print. Hard conversation (2 months <50% AND ≥2 owner-cause downgrades): recommit smaller / delegate-up priced / rescope. Never an ambush — the day-1 forecast predicted it.

**Quality gates:** first 10 pages/client = Mike personally, 2-business-day SLA, ≤3-page batches. **Rubric = `page-brief-spec.md` conformance** (brief is the generation contract; every claim traces to a licensed source; claim-mass preflight satisfied; sibling-similarity gate green; DEGRADED pages carry zero proof-dependent claims) — the interim checklist is retired now that the spec landed. Pages 11+: gates + 1-in-3 sampling → 1-in-5 after a clean month; any sampled failure resets full review for 5 pages. New vertical first-10: Mike + bought hour of a licensed tradesperson. A missed editorial SLA blocks publication; it never waives review.

**Offboarding:** the ownership/portability **clause** ships in the week-2 LOI (domain in client registrar, GBP client = Primary Owner always, tracking number in client billing name — ports, content perpetual license; EvoStack keeps engine/templates/machinery + anonymized fixtures). The **export tooling + Crescent dry-run** builds after DP-3 SCALE, before client-#2 contract (red-team 5). Runbook: freeze emission → export (metrics.db + CSVs labeled estimates + plan.json history) → handoff → access removal ≤5 days → PII purge at 90 days.

**Exit:** onboarding runbook proven on Crescent (≤5 days, ≤8 Mike-hrs); 4 straight Monday rituals ≤1 hr; ≥80% owner tasks DONE/attested within 2 cycles over a quarter; zero tasks rotting past cycle 4 without an ESCALATION artifact; first-10 gate logged against the brief rubric; ownership clause in every contract; export dry-run done before client #2 signs.

### W-PILOT — Crescent proof + live-site protection + legal

**Goal:** the closed loop demonstrably looping on a **paying** client, without sacrificing the rankings the hand-built site already has.

**Crescent re-onboards through the front door** (real manifest, real local_facts interview with Parker, forecast shown) — runbook dry-run and pilot in one. **Interim LOI + first payment in week 2** (red-team 4/15): grandfathered $750–1,000/mo, papered as consideration (case-study rights + data consent + testimonial), full exhibits swapped by week 9.

**Baseline before touching anything:** full pipeline on the real manifest; architecture diff vs live site; **2 consecutive clean 49-pin baseline scans on priority cells — these scans now GATE the rebuild (see tripwire)**; review-ledger snapshot (G3 low-confidence until ~wk 8, verdicts say so); citation audit w/ tracking-number allowlist; 16 months GSC backfill (this is also the day-150 value baseline); **same-day license-number audit of the live site + footer fix (addendum Tier-1 #2 — live legal exposure, hours of work)**; Mike signs the verdict sheet before Parker sees it.

**Live-site protection (red-team 11/12 — new, non-negotiable):**
- **Page-level rollback:** before any rebuild, the current production page set is tagged as a deployable artifact (git tag + per-page snapshot). "Old host paid 30 days" covered DNS; this covers content.
- **Rebuild order:** the single **worst-performing** existing DEGRADED page first — lowest current value, lowest blast radius. Observe **2 weekly scans** post-swap. Only then batch 2–3/wk per G14.
- **Regression tripwire (armed from first rebuild):** any priority cell materially down vs the 2-scan baseline (drops out of pack, or sustained multi-position organic slide) for **2 consecutive scans** post-change → **pause C4/C5, root-cause, roll back the suspect pages from the snapshot**. Rank movement is not a success bar, but rank *regression on pages we replaced* is a failure bar. The baselines gate something now.
- **GBP sequencing inverted:** no structural edit until R12 liveness has **14 green days**. First G13 window = a reversible edit (hours/attributes/services). **The primary phone is never swapped** — Google's supported call-reporting pattern leaves the slot untouched (addendum 1b); DNI handles the website; citations keep the real number. The residual GBP-number/website-DNI split is documented as an explicit risk decision **with Parker's written sign-off**, not a table cell.
- **Doorway-risk discipline:** never-built pages (C5) ship only with the sitewide-devaluation query live, G14 at the conservative end, and every page passing the "would a human editor publish this as a standalone local page" test (also the KILL signal). Said out loud to Parker pre-LOI — his domain carries the risk (risk #9).

**Cutover sequence (G14-paced):** C1 technical fixes (schema `@id`, branded 404, sitemap/robots, 301 map through the site-equity gate, license footer) → C2 citation fixes + GBP transcriptions (**no phone swap**) → C3 review-program launch (Parker signs script; attestation only — G10) → C4 DEGRADED rebuilds **worst-first, tripwire armed**, through the brief-rubric editorial gate → C5 never-built pages, cost-anchors owner-signed, devaluation query live → C6 PROOF_COLLECT live → first manual R10 upgrade → C7 weekly SQL ritual (already running since week 4).

**Success criteria (honest per G12; grid-week counts fixed to the calendar):**
- **Day 30 "machine runs":** call tracking attributing w/ consent verified; 4 clean scans, zero quarantine leaks; citation fixes done; first reversible G13 edit with liveness green 7 days; Parker ≥3/4 asks attested; first DEGRADED rebuild live through editorial **with no tripwire fire**.
- **Day 60 "loop has inputs":** all rebuilds live within pacing, 100% submitted, ≥60% of ≥4-wk-old pages in GSC coverage; ≥1 R10 upgrade on real proof; owner throughput ≥70%; ≥2 actioned SQL findings; tripwire clean or resolved.
- **Day 90 "operations verdict" (DP-3):** ≥80% of ≥8-wk-old pages indexed (small-sample caveat stated: this is the first 6–10 pages); impressions >0 on ≥50% of indexed new pages; ≥85% agent / ≥70% owner completion; **12 clean grid weeks (available by week 16 — baselines started week 2–3)**; G3 re-scored; calls attributed, direction noted, no target. **DP-3 is the OPERATIONS verdict only — it authorizes prospecting and the v0.5 build, not the client-#2 signature.**
- **Day ~150 "value checkpoint" (DP-3.5, new — red-team 10):** the sales gate. Call-volume delta vs the 16-month GSC/CallRail baseline, or at minimum impressions/clicks trending up on pages now genuinely 12+ weeks old, plus zero unresolved tripwire events. **Client #2 signs here.** "Indexed with nonzero impressions" is a bar lorem ipsum on a healthy domain clears; nobody sells on it.
- **Non-criteria at every gate:** pack/organic rank movement upside, WON transitions — upside, never the bar. Rank *regression on replaced pages* is the one rank-shaped failure bar (tripwire).

**Client #2 selection (unchanged):** different vertical AND region (licensed-SAB structure, real `rules/verticals/*.ts`, human-expert intake checkpoint); on our stack, stated at sale; G15 license dry-run pre-signature; owner ≥4 hr/mo with stall-probability table pre-sign (balk = walk); retainer floor + 12-month horizon in writing; ≥3 WINNABLE_* cells on a quick M1 pass; shadow-mode live-SERP week on the new region pre-signature. REFUSE: all YMYL, rank-and-rent/lead-gen, unlicensed, multi-state franchises, call-tracking refusers claiming calls as KPI (validate-manifest WARN→ERROR at client-#2 intake).

**Legal [P, ~$1.5–3k one-time]:** engage week 1; **hard week-9 deadline for the full exhibit set** (slip does not cascade — the LOI covers Crescent meanwhile; only client-#2 signature actually blocks on exhibits, and that's week ~22). Set: no-guarantee (bands, algorithm risk **for both parties** — the scaled-content risk to the client's existing traffic is named, not just EvoStack's exposure); ownership/portability incl. recording-retention + number port-out; GBP written authorization with enumerated edit classes + suspension-risk + reinstatement-not-guaranteed; review-compliance split; grid-data disclaimer; licensing rep + indemnity; liability cap; 6-month initial term then month-to-month. EvoStack's own marketing passes its own G8/G12 gates.

### W-SALES — Client-#2 pipeline (new workstream — red-team 14)

**Goal:** a qualified, forecast-briefed prospect ready to sign at day 150 — because a REFUSE-list this strict plus a $1,500–2,000/mo + build-fee, 6-month-term offer is a 4–12 week sales cycle, and no other workstream produces prospects.

| # | Task | Owner | When | Hours |
|---|---|---|---|---|
| S1 | Case-study skeleton from Crescent (structure now, numbers as they land; claims pass G8/G12 — machine-health + throughput at first, call data only after day 150) | A drafts, M edits | Week 2, updated monthly | 1 hr/mo |
| S2 | Waitlist framing: "pilot results in the fall; onboarding client #2 after the value checkpoint" — scarcity that is also just true | M | Week 2 | — |
| S3 | 2–3 qualification conversations/mo from referral network + local trade associations, run against the selection criteria; forecast conversation as the qualifier (an owner who balks self-selects out) | M | Weeks 4–20 | 2–3 hr/mo |
| S4 | Day-0 pre-check on the finalist (scripted M1 pass ~$5–15, G15 dry-run, shadow-mode SERP week) | A + M | Weeks 18–21 | 4 hr once |
| S5 | Sign at DP-3.5 (day ~150) with full exhibits | M + P | Week ~22 | — |

**Budgeted at ~3–4 hr/mo of Mike's time from week 4 — on the ledger, inside the capacity model.**

**Exit:** ≥1 prospect passing all must-haves by week 20; signature at DP-3.5; zero prospects signed early on machine-health evidence alone.

---

## 3. THE SEQUENCE — 16 weeks to the operations verdict, ~22 to client #2

**External clocks rule:** indexation latency starts when pages ship → collectors + publishing stay the critical path; hardening, legal, sales parallelize in the dead time. The 12-week draft was arithmetic fiction (12 clean grid weeks weren't available by day 90; ramp review hours didn't exist) — 16 weeks makes both true. **If EvoStack's existing book >20 hr/wk, stretch to 20 weeks by halving weeks 1–3 review throughput — decide in week 0.**

**Mike's explicit weekly hours (the survivability test):**

| Weeks | Program hours/wk | What it is |
|---|---|---|
| 0 | ~10 | Day-0 accounts 4h; license audit + footer 2h; review-tier setup + H-6 race call 2h; LOI draft 2h |
| 1–3 | **15–20 (peak)** | Agent-code review 8–12h tiered; onboarding 7.5h (wk 2); I7/I8 execution; verdict signing; lawyer kickoff |
| 4–6 | 8–12 | First-10 editorial 1.5–3h; cadence 2.5–3.5h; sales 1h; incident buffer 2h |
| 7–16 | 5–8 | Cadence + sampling editorial + monthly reviews + sales + buffer |
| Steady (2 clients) | ~6–8 (≈12–15 hr/mo/client) | The honest v0.x number; priced in §4 |

**Dependency graph:**

```
Day-0 accounts (I4,I5,I6,I7a on EvoStack card) ─┐
Engine build (in-flight) ── H-6 seam race ──────┼─► I1 fetch (or adapter-shim) ─► I2 workflows ─► first live run ─► 14-day R12 green window
License audit + footer fix (same-day) ──────────┘                                                        │
P0 incl. H-8b (301 gate, season mask, G19 allowlist) ── blocks ─► any live page publish                  ▼
Crescent LOI + payment (wk 2) ─► baseline (2 scans + snapshot tag) ─► C1 ─► C4 worst-first + TRIPWIRE ─► C5 (needs devaluation query live)
call tracking live w/ consent ── blocks ─► publishing                    14-day R12 green ── blocks ─► first G13 edit (reversible; never the phone)
W-SALES opens wk 2 ─► prospect by wk 20 ─► DP-3.5 signature wk ~22
Exhibits (hard wk-9 deadline) ── block ─► client-#2 signature only
DP-3 (wk 16, ops verdict) ─► P2 + export tooling + v0.5 build ─► DP-3.5 (day ~150) ─► client #2 onboards
```

| Week | Work | Owner | Gate to next |
|---|---|---|---|
| **0** | In-flight loop finishes; **H-6 seam race decided** (landed → I1 clean; lost → adapter-shim budgeted, wk 1 absorbs 2–4d); day-0 long-leads: DFS + $50, GSC SA on `sc-domain:crescentinlandnw.com`, GBP API filed + 60-day calendar, **CallRail on EvoStack card** w/ consent announcement config; `ci.yml`; **same-day license-number audit of live Crescent + footer fix**; capacity call: 16 vs 20 weeks. | M (~10h) + A | v0.1 tests green; creds in secrets; seam status known |
| **1** | P0 hardening (H-1..H-8b) under review tiers; I1 fetch layer (+shim if needed); I2 workflows; I3 R2 storage split; `acceptance.yml`; lawyer engaged (wk-9 exhibit deadline set); LOI drafted. | A + M (15–20h) + P | One live e2e Crescent run; raws in R2 |
| **2** | **Crescent re-onboarding front-door + LOI SIGNED + first payment**; intake interview w/ Parker (local_facts, licenses, commitments, **doorway-risk and NAP-split conversations on the record**); call-tracking billing → Crescent, DNI template PR (Tier L), consent verified; baseline pack: architecture diff, **baseline scan 1 + production page-set snapshot tag**, citation audit w/ allowlist, 16-mo GSC backfill (= day-150 baseline); I8 noindex gate; I9 doctor; **I10 uptime monitor live**; W-SALES S1/S2. | M (15–20h) + A + O | LOI + payment; runbook proven ≤8 Mike-hrs |
| **3** | C1 tech fixes through the site-equity gate (schema `@id`, 404, sitemap, 301 map, license footer); kickoff call (verdict narration, review-script sign-off); **baseline scan 2**; scheduled runs begin their 14-day green window; P1 starts. | M (15h) + A + O | Baselines locked; runs green |
| **4** | **First page publishes: single worst DEGRADED rebuild, tripwire armed** — starts the indexation + M9 clocks. SQL pack v1 (5 queries) + Monday-brief generator; first Monday ritual; **time-log starts**; W-SALES conversations begin. | M (8–12h) + A + O | Page live; 2-scan observation window opens; brief ≤1 hr |
| **5–6** | Tripwire window clean → batch rebuilds 2–3/wk; first monthly review-ask batch; P1 finishes (H-14 DR drill once); injected-failure + seeded-R12 drills; 14-day R12 green completes → **first G13 window: reversible edit only**. | GHA + M (8–12h) + A | Tripwire clean; **DP-1 (day ~30)** |
| **7–9** | Never-built pages begin (**devaluation query live first**); month-2 asks; first PROOF_COLLECT → **first R10 DEGRADED→FULL**; monthly review #1 (spend eyeball vs §7, capacity vs attested); sampling → 1-in-3; **exhibits finalized (hard wk-9 deadline)**, Crescent grandfather papered into full contract. | M (5–8h) + A + O + P | R10 executed; exhibits signed |
| **10–12** | Cadence; SQL pack full set (wk 8+ queries); R4 firing meaningfully; forecast-vs-actuals session with Parker; second G13 window. | M (5–8h) + A + O | **DP-2 (day ~60)**; clean metric weeks accruing |
| **13–16** | Cadence weeks; 12 clean grid weeks complete; G3 re-scored on real velocity; **DP-3 (day ~90, week 16): OPERATIONS verdict** → authorizes v0.5 build + P2 hardening + export-tooling build + active prospect pre-check. NOT a sales green light. | M + A | DP-3 = SCALE-track / ITERATE / KILL |
| **16–21** | v0.5 build (wiring order reconciled with the addendum: live DFS behind the seam w/ 2-wk shadow → M10 minimal re-planner — needs ≥8 wks metrics + ≥4 wks of Mike's SQL log as ground truth, every amendment `human_review` month 1, per-rule promotion at 4/4 agreement → R8 automation → report renderers per the addendum's renderer-contract doc → addendum Tier-3 slots: GA4 AI-referrals, content-hash diffing). P2: H-15, H-18, offboarding export dry-run on Crescent. S4 prospect pre-check + shadow-mode SERP week. | A + M (5–8h) | v0.5 shadow month running |
| **~22** | **DP-3.5 (day ~150) value checkpoint** → client #2 signs with full exhibits; onboarding runbook reruns unchanged; call-tracking WARN→ERROR; new vertical profile authored + expert-reviewed ($100–200). | M + O₂ + P | Client #2 intake→collecting <2 wks, zero core edits |
| **22+** | Two-client steady state; measured labor vs the ≤15 hr/mo/client bar; **DP-4** (~wk 26–28). | M + A | v0.5 exit; first cited auto-amendment |

---

## 4. BUDGET

**One-time setup**

| Item | Cost |
|---|---|
| DataForSEO deposit | $50 |
| Lawyer: exhibit set (reused forever) | $1,500–3,000 |
| Domain-expert hour, vertical #2 | $100–200 |
| GCP / GHA / R2 / ntfy / uptime setup | $0 |
| **Mike setup labor, restated honestly (red-team 9d):** wk-0 ~10h + wks 1–3 ~45–55h + wks 4–6 ramp delta ~10h ≈ **65–80 hrs** (~$6,500–8,000 at $100/hr opportunity cost) | amortized into the build fee — which is why the build fee exists |
| AI-agent build labor (P0+P1 ≈ 3 eng-wks now; P2 + v0.5 later) | in the monthly tooling line below |

**Monthly run-rate (EvoStack hard costs; call tracking is pass-through on the client invoice — decided)**

| Line | 1 client | 3 clients | Notes |
|---|---|---|---|
| Data (DFS: grid + SERP + reviews) | $50–90 | $90–130 | Marginal $10–20/client (§7) |
| LLM client generation + QA tokens | $20–60 | $60–140 | Marginal $15–40/client |
| **Agent/LLM dev+ops tooling (new — red-team 7):** Claude subscription or API tokens for the build loops, hardening, v0.5, maintenance, per-page agent work | **$100–250** | **$100–250** | The largest hard cost after labor; was invisibly $0 in the draft |
| Vercel Pro (per-seat; solo = 1 seat; add to spec §7) | $20 | $20 | Amortizes |
| GHA / R2 / uptime / alerting / drift | $5–15 | $10–30 | R2 storage split keeps GHA minutes flat |
| **EvoStack hard-cost total** | **$195–435** | **$280–570** | ≈ $95–190/client at 3 |
| Call tracking (pass-through, client-billed; sticker + 10–20% overage/taxes) | ($50–80) | ($150–240) | On client invoices; ports at exit |
| Mike labor @ **12–15 hr/mo/client** (honest v0.x) × $100/hr | $1,200–1,500 | $3,600–4,500 | Trending 6–10 hr at v0.5, 3–5 at v1.0 |
| Engineering maintenance tax (10–15% eng time — review hours are ON the labor ledger) | amortized | amortized | Permanent |

**Retainer-floor math (repriced to the honest labor number — red-team 2/9):** economic cost/client ≈ $1,300–1,700/mo at v0.x → **absolute floor $1,250/mo** (below it you're buying work), **viable retainer $1,500–2,000/mo + one-time build fee $3,500–6,000** (covers the 65–80 setup hrs + intake/manifest/architecture labor per client). Re-price toward $1,250–1,750 only when the time-log shows ≤10 hr/mo/client sustained. Crescent grandfathered at $750–1,000 **only** as papered consideration (case study + data + testimonial), paying from week 2. At v1.0 labor, $1,750 yields ~$1,100–1,400/mo contribution; **8–10 clients = a real solo business — but do not price for v1.0 automation while operating v0.x.** Marketing claims pass our own G8/G12 gates; no call-volume claims before day-150 data exists.

---

## 5. RISK REGISTER (top 10)

| # | Risk | L/I | Mitigation |
|---|---|---|---|
| 1 | **Operator overload in ramp** — 3–4 eng-wks of agent code + onboarding + live surgery land on one human in 3 weeks | High / High (rubber-stamped review = the safety model collapsing) | Ramp priced at 15–20 hr/wk explicitly; review tiers (L/S/A) make the budget real; 16-week sequence (20 if existing book >20 hr/wk); standing 2 hr/wk incident buffer; time-log from wk 4 read at DP-2 |
| 2 | **Owner goes dark** — the engine's own predicted #1 failure mode | High / High | Forecast pre-signature + re-printed vs actuals; SMS-first flow; R8 ladder; three-option hard conversation; **paying from week 2** — a paying client shows up differently than a demo |
| 3 | **Scaled-content / doorway algorithmic action (new — red-team 17)** — programmatic service×town pages trip a site-level demotion and take Crescent's EXISTING traffic with them | Low-Med / **Severe** (the domain, not a cell) | Sitewide-devaluation standing query live before any never-built page; G14 conservative end; brief-spec claim-mass preflight + "human editor would publish this" test (also the KILL signal); runbook: pause C5 → GSC manual-action check → prune-don't-plead; named to Parker pre-LOI with his sign-off — his domain carries it |
| 4 | **Cutover regression** — replacing live ranking pages with template DEGRADED rebuilds tanks what Crescent has today | Med / High | 2-scan gated baseline + production snapshot tag (page-level rollback); worst-page-first order; tripwire (2 consecutive down scans → pause + rollback); rank regression on replaced pages IS a failure bar even though rank upside is never a success bar |
| 5 | **Indexation latency vs client patience** — 8–16 wks of nothing while paying | Certain / High | 6-month term matching physics; 30/60/90 = machine-health + throughput; **sales gate at day 150, not day 90** — nobody is sold on lorem-ipsum-clears-it evidence; report leads with calls + owner scorecard |
| 6 | **GBP suspension** (possibly self-inflicted) | Low-Med / Severe | **Primary phone never swapped** (supported call-reporting pattern); no structural edit before 14 green R12 days; first window reversible; one edit per G13 window w/ rollback notes; R12 hard-stop pauses LOCAL_PACK emission; reinstatement runbook pre-written; contract acknowledges risk |
| 7 | **Vendor churn** — DFS schema drift breaks parsers silently | High / High (permanent 10–15% tax) | H-18 golden contract tests (at P2); `fixture-drift.yml` → issue never a red X; R13 quarantine + rising-rate trend; every live pull frozen as a fixture |
| 8 | **Silent auth/feed death** — expired tokens read as "no demand" | Med / High | GSC service account (no user-token expiry); `doctor` pre-run validation → specific ESCALATION; H-10 0-row = UNKNOWN; freshness monitor |
| 9 | **Site down / cert lapse unnoticed** (new — red-team 18) — we host the product; a 500 for three days = zero calls | Low / High | External uptime pinger + content assertion per domain → ntfy; domain/cert expiry on monthly checklist; $0–10/mo |
| 10 | **Cost overrun** — grid-scan loop bug, LLM runaway, or the tooling line drifting | Med / Med | Prepaid DFS balance = structural cap; H-5 per-run/per-month aborts; monthly spend eyeball vs dashboard; agent-tooling line now VISIBLE in §4 so drift is a budget variance, not a surprise |

(Operator bus-factor and M10 garbage-amendments remain real and carry their prior mitigations — runbooks + committed artifacts + DR drill; M10 shadow month + per-rule 4/4 promotion — they rank just below the table now that ramp overload and doorway risk are priced.)

---

## 6. DECISION POINTS

**DP-1 — day ~30 (week 6–7): "does the machine run?"**
*Data:* 4 weekly scans (quarantine rate); call attribution live w/ consent y/n; first reversible G13 edit + liveness; Parker asks/photos vs commitment; first-rebuild tripwire status; run manifests clean; Mike's logged hours vs the ramp table.
*Decide:* **Continue** if collectors clean + attribution live + tripwire clean. **Pause publishing** (not the program) if pipes dirty or tripwire fired — fix pipes / root-cause regression first; never ship pages you can't measure or that cost rankings you had. **Owner-escalate** if Parker at 0/0.

**DP-2 — day ~60 (week 10–11): "does the loop have inputs?"**
*Data:* GSC coverage % of ≥4-wk pages; R4 emissions; first R10 y/n; owner throughput %; actioned SQL findings; **Mike's time-log** vs 12–15 hr/mo/client.
*Decide:* **Continue** at ≥70% owner throughput + R10 executed + ≥2 actioned findings. **Iterate economics** if owner <50% two cycles (three-option conversation — the predicted failure mode, not product failure). **Iterate automation** if Mike >15 hr/mo/client — automate the top time sink before anything else.

**DP-3 — day ~90 (week 16): the OPERATIONS verdict — SCALE-track / ITERATE / KILL**
*Data:* indexation ≥80% of ≥8-wk pages (small-sample caveat on the record); impressions on ≥50% of indexed; throughput ≥85%/70%; **12 clean grid weeks (now arithmetically available)**; G3 re-scored; labor vs band; tripwire history; cost actuals incl. the tooling line.
*Decide:* **SCALE-track** — start v0.5 build + P2 + export tooling + prospect pre-check. **It does NOT authorize the client-#2 signature** — the machine working is not the product proven. **ITERATE** — machine green but owner throughput chronically low (productize delegate-up) or labor over band (automate first). **KILL signals:** measurement can't stay clean at ≤ the maintenance tax; gates pass content a human editor rejects; grid data too unstable to label even as estimates; **or the tripwire shows rebuilds systematically underperform the pages they replaced** — the product would be destroying value.

**DP-3.5 — day ~150 (week ~22): the VALUE checkpoint — the sales gate (new)**
*Data:* call-volume delta vs the 16-month CallRail/GSC baseline; impressions/clicks trend on pages now genuinely 12+ weeks old; zero unresolved tripwire events; Parker's testimonial willingness.
*Decide:* **Sign client #2** if value direction is real and evidenced. **Hold** (keep prospect warm, waitlist framing is true) if signal is flat — selling before value evidence is deferred disappointment with a signature on it. Case study updates to include call data only now.

**DP-4 — v0.5 gate (~week 26–28): "trust the re-planner?"**
*Data:* client #2 wall-clock (intake→collecting <2 wks? zero core edits — or edits confined to the named adapter file?); M10 shadow month per-rule agreement vs Mike's SQL log; shadow-mode SERP diff on the new region; marginal cost per client from `api_costs` actuals.
*Decide:* **Promote** rules to auto individually at 4/4 agreement; **hold in human_review** any rule that disagrees — half-closed is fine. **Re-scope v0.5** if client #2 required core edits. **Pricing re-check:** if measured labor hasn't fallen toward 10 hr/mo/client, don't add client #3 at current pricing — and don't add client #3 at all until the time-log says the hours exist.

---

**Changes from the draft, logged:** (1) Ramp restated 15–20 hr/wk wks 0–4 with review tiers; 12→16 weeks; steady state 12–15 hr/mo/client and pricing moved to match (floor $1,000→$1,250, viable $1,250–1,750→$1,500–2,000, build fee $2,500–5,000→$3,500–6,000, setup labor 15–18→65–80 hrs). (2) DP-3 split: day-90 = operations verdict; day-150 DP-3.5 = sales gate; client #2 signs at ~week 22. (3) Live-site protection: baseline scans now gate, page-level rollback snapshot, worst-page-first, 2-scan regression tripwire. (4) GBP: primary phone never swapped (addendum's supported call-reporting pattern); first G13 edit reversible and only after 14 green R12 days; WA all-party consent + `known_tracking_numbers` allowlist + CallRail on EvoStack's card day 0, billing transferred at LOI. (5) W-SALES lane added week 2 (~3–4 hr/mo). (6) Crescent interim LOI + payment week 2; exhibits hard-deadline week 9; exhibits block only client-#2 signature. (7) Agent/LLM tooling $100–250/mo added; 1-client hard cost $135–241→$195–435. (8) Raw responses → R2 with hash manifest in git, decided now. (9) Call tracking pass-through decided; overages/taxes noted. (10) Fleet tooling deferred: 5% auto-reconciliation, gitleaks cadence, GHA Environments, quarterly DR re-drills → 3 clients; offboarding export tooling → post-DP-3; multi-client matrix + H-15/H-18 → post-DP-3. (11) SQL pack staged: 5 queries wk 4, +devaluation tripwire at first pages, full set wk 8. (12) Risk register: doorway/scaled-content demotion (#3), cutover regression (#4), uptime (#9), operator ramp overload (#1) added. (13) H-6 race has a named fallback (adapter-shim, 2–4d). (14) Sibling docs landed: first-10 rubric = page-brief-spec conformance (interim checklist retired); addendum NOW items absorbed into P0 (H-8b: season mask, 301/site-equity gate, G19 allowlist, ownership assertions) + same-day license audit + uptime pinger + v0.5 wiring reconciled (renderer-contract doc, GA4 AI-referrals, content-hash diffing at their addendum slots). (15) Grid-week arithmetic fixed (12 clean weeks by week 16). (16) 20-week stretch trigger defined (existing book >20 hr/wk, decided week 0).
