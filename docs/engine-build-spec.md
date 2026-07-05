# BUILD SPEC — Local SEO Engine ("Rankbeater") · v2, post-red-team

**Status:** decision-ready · **Date:** 2026-07-05 · **Reference implementation of output:** `/workspace/crescent-electric` (crescentinlandnw.com) · **Engine home:** fresh repo `seo-engine`

This revision integrates two red-team passes. The headline changes: the product claim is corrected (§1), M3 is rebuilt around data that actually exists, verdicts and time-to-win become probability bands instead of numbers, five new guardrails cover GBP suspension risk, scaled-content pacing, licensing compliance, algorithm volatility, and feed health, a table of mandatory human checkpoints is now part of the loop (§6), and v0.1 is cut roughly in half by deleting machinery that cannot fire before v0.5 (§7).

---

## 0. Gap summary — today's Crescent one-off vs. the vision

| # | Gap | Severity | Closes in |
|---|-----|----------|-----------|
| 1 | **Everything is hardcoded** — phone (×3), Jobber URL (×4), towns, services, licenses live in components; a second client is impossible without a fork | Critical | v0.1 (intake + templates) |
| 2 | **Zero measurement** — no GSC pipeline, no geo-grid, no review ledger; we cannot currently say whether anything we shipped worked | Critical | v0.1 (M9 minimal) |
| 3 | **Rules are prose, not gates** — the guardrails exist only as advice in `seo-research.md`; nothing blocks a doorway page, a cannibalizing URL, or an unwinnable cell | Critical | v0.1 (M4/M5/M6 gates) |
| 4 | **8 live location pages are proof-less near-doorways** — the known flaw of the reference site; no proof pipeline exists to fix them | Critical | v0.1 (proof gate + degraded tier + PROOF_COLLECT tasks) |
| 5 | **"Calls" is the KPI and nothing measures calls** — `call_tracking: null` passes today; success is unverifiable | High | v0.1 (intake blocker) |
| 6 | **No compliance layer** — licensing × state never checked, local factual claims (permits, code) unsourced, review-ask practice unreviewed against Google TOS | High | v0.1 (G8/G15 + TOS-safe review program) |
| 7 | **GBP is flown blind** — no gap analysis vs. pack winners, no edit-safety discipline, no suspension detection on a 10-month-old SAB profile | High | v0.1 manual (G13 + transcription tasks) → v0.5 semi-automated |
| 8 | **Off-site work is verbal** — review asks, citations, photos are untracked requests with no evidence, no escalation, no unblocking chain | High | v0.1 (`plan.json` + M8) |
| 9 | **Competitor intelligence is one-shot manual research** — no registry, no per-cell profiles, no refresh, no spam/LSA/SERP-furniture awareness | Medium | v0.1 semi-manual → v0.5 automated |
| 10 | **Strategy is static** — no re-planner, no algo-update awareness, no MAINTAIN/regression handling; also *correctly deferred*, since new pages emit no signals for 8–16 weeks | Medium | v0.5 (M10), full at v1.0 |

---

## 1. What the engine is — and honestly is not

The engine is a client-agnostic pipeline that takes `(website URL, client-manifest.json)` and produces four artifacts per run: a per-cell **Competition Report** (cell = town × service-cluster × surface, surface ∈ {LOCAL_PACK, ORGANIC}), an **SEO Strategy** (keyword map, GBP plan, proof-gated page architecture), a machine-readable **Task Plan**, and a **measurement loop** (GSC + geo-grid + review ledger → re-planner) that amends the plan over time.

**The honest claim, stated up front because it is also the pitch:**

- The engine **executes and verifies the on-site half end-to-end** — site generation, schema, content through hard QA gates, publication, indexation and rank measurement — with human PR approval and editorial review as defined checkpoints.
- **Off-site levers are emitted as tracked human tasks** (review asks, GBP edits, citations, job photos) with evidence requirements and escalation. They are never simulated. Because pack outcomes are dominated by exactly these levers, **outcomes are rate-limited by owner labor**, and the intake process computes an *owner-throughput forecast* — the expected stall probability per cell given the owner's actual commitments — before anyone signs.
- Ranking outcomes are **stochastic**. Google's local algorithm is nonstationary; the feasibility scorer is a deterministic classifier of a random process. All verdicts are therefore expressed as probability bands with named assumptions (`WINNABLE_PACK, est. 60–80% within 6–9 mo, conditional on owner throughput`), never as promises. Time-to-win is reported in coarse buckets (`<6mo / 6–12mo / 12mo+ / unknown`) with the driving assumption stated.
- **Geo-grid data is a best-effort third-party scrape** of Google surfaces (contractually gray, subject to breakage). Grid positions are labeled as estimates in every client-facing artifact, and win definitions tolerate scan gaps.
- The delivery substrate is **our Next.js template stack: we build and host the client's site**. That is the product, stated plainly. Clients on WordPress/Wix are out of scope until a CMS-export adapter is explicitly roadmapped (post-v1.0, if ever). "Client-agnostic" means any business and region *on our stack*, not any platform.

Hard guardrails (G1–G16, §6) are encoded as gates that block plans, not advice that decorates them. Cells the rules say are unwinnable are reported as INFEASIBLE with the fired rule; budget goes to cells that can be won — and because early review-physics estimates skew pessimistic, **INFEASIBLE/LONG_HORIZON verdicts pass human review before a client ever sees them.**

---

## 2. Repo layout (`seo-engine`, fresh repo)

The layout below is the **v1.0 target**; §7 marks what each version actually builds.

```
seo-engine/
├── intake/
│   ├── manifest.schema.ts            # zod schema (§3); exports JSON Schema
│   ├── validate-manifest.ts          # CLI: rejects on incomplete NAP, no base lat/lng, no proof
│   │                                 #   assets + no photo commitment, gbp.access=none w/o task,
│   │                                 #   AND primary_kpi=calls with no call-tracking integration
│   ├── throughput-forecast.ts        # owner commitments → per-cell stall probability (shown pre-sign)
│   └── examples/crescent-electric.manifest.json
├── pipeline/
│   ├── m1-competitors/
│   │   ├── serp-sweep.ts             # per-cell: town centroid + 4 offset pins; pack+organic split;
│   │   │                             #   SERP-furniture capture (LSA present? ads count? directory stack?)
│   │   ├── profile-competitor.ts     # registry entry = business; per (business × cell) facet for pack
│   │   │                             #   winners (multi-location competitors differ per town);
│   │   │                             #   observable fields ONLY: primary category, review count/rating,
│   │   │                             #   name keywords, distance-from-centroid, site depth/schema
│   │   ├── spam-signals.ts           # keyword-stuffed names, address-type anomalies, review-burst
│   │   │                             #   timing → suspected-spam tag consumed by M4 + SPAM_REPORT tasks
│   │   ├── citation-audit.ts         # existing citations + duplicate listings by phone/name variants
│   │   └── registry.schema.ts
│   ├── m2-keywords/
│   │   ├── seed-expand.ts            # clusters × towns × intent modifiers; do_not_offer = negatives
│   │   ├── demand.ts                 # volume where real data exists; hyper-local cells gate on
│   │   │                             #   MARKET EXISTENCE (pack present? competitors have pages?)
│   │   │                             #   from M1 — never invented population-scaled numbers
│   │   ├── cluster-validate.ts       # §18 SERP-overlap rule as code (≥60% merge / 30–60% borderline
│   │   │                             #   / <30% split; mega-domains excluded)
│   │   └── keyword-map.schema.ts
│   ├── m3-gbp-observables/           # renamed: built on what APIs actually return
│   │   ├── gbp-diff.ts               # per-QUERY primary-category distribution of actual pack top-3
│   │   │                             #   (not a modal blend); review count/rating/reply-rate diffs
│   │   ├── spot-check-gen.ts         # emits human tasks: "open these 5 profiles, transcribe secondary
│   │   │                             #   categories/services into this form" — the PERMANENT v0.x
│   │   │                             #   path for fields no API exposes; GBP API is an upgrade, not a plan
│   │   └── gbp-gap-report.schema.ts
│   ├── m4-feasibility/
│   │   ├── rules.ts                  # guardrails as pure functions → {verdict, ruleId, band, ttw_bucket,
│   │   │                             #   confidence, named_assumptions[]}
│   │   ├── compliance.ts             # G15: town.state ∈ licensed states, else INFEASIBLE
│   │   └── score-cells.ts            # deterministic mechanics, probabilistic outputs
│   ├── m5-architecture/
│   │   ├── url-map.ts                # one canonical URL per intent; many keywords per URL;
│   │   │                             #   conflicts resolved by rule and logged (it is not a bijection
│   │   │                             #   and we no longer call it one)
│   │   ├── proof-gate.ts             # full tier: ≥2 publishable jobs per town×cluster;
│   │   │                             #   DEGRADED tier: no proof-dependent claims, genuinely-local
│   │   │                             #   content only (permitting, utility, housing stock) — publishable,
│   │   │                             #   auto-upgraded via R10 when proof arrives
│   │   ├── crawl-diff.ts             # existing-site crawl → 301/canonical plan
│   │   └── site-architecture.schema.ts
│   ├── m6-content/
│   │   ├── generate-page.ts
│   │   ├── genspec.yaml              # v0.1: hand-synced with QA rules; compiles-to-rules mechanism
│   │   │                             #   deferred to v0.5 (one template set ≠ a drift problem yet)
│   │   └── gates/
│   │       ├── copy-qa.ts            # generic ai.* defaults + client qa-config overlay (kills the
│   │       │                         #   hardcoded Crescent|Electric|Moscow regex)
│   │       ├── boilerplate-ratio.ts  # sibling-page shared-text cap
│   │       ├── info-gain.ts          # generated page vs. the RANKING incumbents' pages (M1 crawls
│   │       │                         #   them): must add local information, not just avoid n-gram overlap
│   │       ├── claim-substantiation.ts # superlatives/numbers AND regulatory/local-factual claims
│   │       │                         #   (permits, code, utility programs) → manifest local_facts ref
│   │       │                         #   or the generator writes around the topic
│   │       └── faq-unique.ts
│   ├── m7-technical/
│   │   ├── schema-graph.ts           # ONE LocalBusiness node, stable @id, referenced everywhere
│   │   ├── sitemap-robots.ts         # derived from architecture (no hand-duplicated slug lists)
│   │   └── redirects.ts
│   └── m8-offsite/
│       └── queue-gen.ts              # TOS-safe review program, CITATION_FIX before CITATION,
│                                     #   G13-throttled GBP tasks, proof-collection, SPAM_REPORT drafts
├── rules/
│   ├── guardrails.ts                 # G1–G16 (§6) + constants
│   ├── signals-actions.ts            # R1–R13 (§6)
│   └── verticals/                    # vertical-profile layer: regulated-claim rules, required trust
│       └── electrician.ts            #   elements, intent modifiers, seasonality curves; new vertical
│                                     #   intake = human-expert checkpoint, not a vocab overlay
├── templates/
│   ├── site/                         # extracted from Crescent, BusinessProfile-driven
│   │   ├── components/…              #   ServicePage, LocationPage (full + degraded tiers), SiteShell…
│   │   ├── content-model.ts          #   ServiceData/LocationData + proofItems[], localFaq[]
│   │   └── next-boilerplate/
│   └── reports/                      # renderers — v0.5
├── loop/
│   ├── collectors/
│   │   ├── gsc.ts                    # daily
│   │   ├── geogrid.ts                # weekly, labeled-estimate data
│   │   ├── reviews.ts                # weekly, client + registry competitors
│   │   ├── gbp-liveness.ts           # profile visible in latest snapshot? disappearance = hard-stop
│   │   ├── feed-health.ts            # schema-versioned response validation; >30% empty-pack pins
│   │   │                             #   ⇒ quarantine scan, never feed R-rules corrupted data
│   │   └── store.ts                  # SQLite: clients/<slug>/measurements/metrics.db
│   ├── replan.ts                     # v0.5+: weekly light / monthly heavy
│   └── goal-check.ts                 # WON transitions, scan-gap tolerant, lead-floor aware
├── plan/
│   ├── task.schema.ts                # §5 — incl. verified/attested split + approval field
│   └── tracker.ts                    # v0.1: status + dependencies; escalation automation v0.5
└── clients/<slug>/
    ├── manifest.json
    ├── qa-config.json
    ├── runs/<run_id>/                # versioned artifacts + FROZEN raw API fixtures (acceptance
    │                                 #   tests run against fixtures; live-SERP diff is monitoring)
    ├── reports/
    ├── plan.json
    ├── content/
    └── measurements/metrics.db
```

---

## 3. Client manifest schema — with Crescent's real values

Changes from v1: `local_facts` registry (feeds G8), `owner_commitments.hours_per_month` (feeds G11 as a capacity model, not just a review count), call-tracking is now a validation concern, and GBP integration reflects the screenshot-and-transcribe reality.

```jsonc
{
  "business": {
    "legal_name": "Crescent Electric",
    "phone_nap": "(509) 903-9411",
    "email": "admin@crescentnw.com",
    "website_url": "https://crescentinlandnw.com",
    "domain_age_months": 10,                          // G4 window + G14 publish ramp apply
    "entity": { "schema_type": "Electrician", "founding_year": 2023, "owner_names": ["<owner>"] },
    "licenses": [
      { "type": "electrical_contractor", "number": "2471680", "state": "ID" },
      { "type": "electrical_contractor", "number": "CRESCLE781QD", "state": "WA" }   // G15 checks towns against these
    ],
    "booking_url": "https://clienthub.getjobber.com/hubs/fb22d875-.../new",
    "brand_constraints": {
      "banned_phrases": [], "required_disclaimers": [],
      "tone_notes": "plain-spoken tradesman, first-person plural",
      "competitor_names_never_mention": []
    }
  },
  "locations": {
    "base": { "city": "Moscow", "state": "ID", "zip": "83843",
              "lat_lng": [46.7324, -116.9996], "is_storefront_or_SAB": "SAB" },
    "service_area": {
      "target_region_label": "the Palouse / Inland Northwest",
      "towns": [
        { "slug": "moscow-id",   "name": "Moscow, ID",   "drive_time_min": 0,  "county": "Latah" },
        { "slug": "pullman-wa",  "name": "Pullman, WA",  "drive_time_min": 15, "county": "Whitman" },
        { "slug": "troy-id",     "name": "Troy, ID",     "drive_time_min": 15 },
        { "slug": "genesee-id",  "name": "Genesee, ID",  "drive_time_min": 20 },
        { "slug": "palouse-wa",  "name": "Palouse, WA",  "drive_time_min": 30 },
        { "slug": "colfax-wa",   "name": "Colfax, WA",   "drive_time_min": 35 },  // G2 is now EMPIRICAL:
        { "slug": "lewiston-id", "name": "Lewiston, ID", "drive_time_min": 40 },  //   rural packs admit distant
        { "slug": "spokane-wa",  "name": "Spokane, WA",  "drive_time_min": 95 }   //   SABs; M1 data decides
      ]
    },
    "priority_towns": ["moscow-id", "pullman-wa"]
  },
  "services": {
    "clusters": [
      { "cluster_id": "panel",     "label": "Electrical Panel Upgrades", "emergency_offered": false, "capacity": true },
      { "cluster_id": "ev",        "label": "EV Charger Installation",   "capacity": true },
      { "cluster_id": "generator", "label": "Generator Installation",    "capacity": true },
      { "cluster_id": "rewiring",  "label": "Home Rewiring & Old Wiring","capacity": true },
      { "cluster_id": "hot-tub",   "label": "Hot Tub Wiring",            "capacity": true },
      { "cluster_id": "lighting",  "label": "Lighting Installation",     "capacity": true }
    ],
    "do_not_offer": ["solar installation", "HVAC", "appliance repair"]
  },
  "proof_assets": {
    "jobs": [ /* {job_id, town, service_cluster, date, photos[], description,
                 permission_to_publish} — EMPTY today: full-tier location pages stay
                 BLOCKED under G6; DEGRADED tier is the publishable interim */ ],
    "certifications": [], "awards": []
  },
  "local_facts": [ /* NEW — G8 source of truth for regulatory/factual claims:
       {fact_id, claim: "Whitman County requires a permit for panel upgrades",
        source_url_or_owner_attestation, verified_by, verified_date, towns[], clusters[]}
       Content may only state permit/code/utility facts that resolve to an entry here;
       otherwise the generator writes around the topic. Owner verifies trade facts. */ ],
  "gbp": { "access_level": "owner", "profile_url": "<GBP url>",
           "current_primary_category": "Electrician",     // changing this is a NAMED HUMAN DECISION (G13)
           "review_reply_policy": "owner_replies" },
  "owner_commitments": {
    "hours_per_month": 4,                                 // NEW — G11 capacity model; M8 emission is
                                                          //   budgeted against this, not unbounded
    "will_ask_for_reviews": { "yes": true, "expected_per_month": 4 },
    "will_provide_job_photos": { "yes": true, "cadence": "per_job" },
    "will_do_gbp_posts": "delegate",
    "budget": { "content_pages_per_month": 6, "citations_budget_usd": 50, "link_outreach": false },
    "hard_nos": ["no video content"]
  },
  "goals": { "primary_kpi": "calls", "target_clusters_ranked": ["panel", "ev", "rewiring"],
             "time_horizon_months": 12 },
  "integrations": {
    "gsc_property": "sc-domain:crescentinlandnw.com",
    "ga4": null,
    "call_tracking": null,          // VALIDATION: primary_kpi=calls + call_tracking=null → HARD WARN at
                                    //   v0.1 with a mandatory day-0 task to install tracking (~$45–65/mo);
                                    //   BLOCKING at v0.5. Rank without lead attribution is not the KPI.
    "gbp_api_token": "pending_approval",   // treated as an UPGRADE if it ever arrives; the plan-of-record
                                           //   client-side path is screenshots + transcription tasks
    "dataforseo": "env:DFS_LOGIN"
  }
}
```

**Validation gate** rejects on: incomplete NAP; missing base lat/lng; empty `proof_assets.jobs` AND `will_provide_job_photos: no`; `gbp.access_level: none` without an accepted owner task; and (v0.5+) `primary_kpi: calls` without call attribution. **Intake also runs `throughput-forecast.ts`**: given 4 review-asks/mo and 4 owner-hours/mo, it prints per-cell stall probabilities before signing — because the engine's most common failure mode is human PROOF_COLLECT/GBP tasks going OVERDUE, and the client should see that forecast on day one, not in month six.

---

## 4. Module-by-module build plan

Effort key: **S** ≤ 1 day · **M** 2–5 days · **L** 1–3 weeks. Primary vendor **DataForSEO** + free Google owner-side APIs. All acceptance tests that touch SERPs run against **frozen fixtures** captured at doc-writing time; live-SERP comparison is a monitoring check with overlap thresholds (e.g., ≥2 of the hand-found top-3 present in ≥70% of repeated scans), never a build gate — SERPs move weekly and a test that conflates "engine works" with "Google hasn't changed" teaches the team to ignore red.

### INTAKE — manifest + validation + throughput forecast · **M**
- **Extract from Crescent:** every hardcoded constant — phone (×3), Jobber URL (×4), email, geo, licenses, towns/drive-times, clusters. Strip phones out of copy strings while porting.
- **Accept:** Crescent manifest validates; a broken copy (no lat/lng) rejected with fix-list; zero grep hits for `903-9411` outside the manifest; calls-KPI-without-tracking produces the hard warning and the day-0 tracking task; throughput forecast renders per-cell stall probabilities.

### M1 — Competitor discovery & profiling · **L** (semi-manual ⚙ at v0.1) · **DataForSEO SERP + Business Data**
- **Out:** `competitor-registry.json` — registry entry per business, **profile facets per (business × cell)** for pack winners (a single deduped profile cannot explain why a multi-location competitor wins Pullman but not Moscow, which is the entire point of the report).
- **Records, per cell:** pack top-3 and organic top-10 split; **SERP furniture** — LSA present, ads count, directory-stacked organic (a pack win under three LSA slots is worth materially less and M4's value math must know); winner **distance-from-centroid distribution** (feeds empirical G2); **spam signals** (name-stuffing, address anomalies, review-burst timing) → suspected-spam tags; **citation/duplicate-listing audit** for the client (week-one hygiene: wrong phones, duplicates suppress pack rank — we fix before we build).
- **Observable competitor fields only:** primary category, review count/rating/reply-rate, name keywords, site depth/schema, distance. Secondary categories, services lists, attributes, and photo counts are **not reliably available from any API** — they are emitted as M3 human spot-check tasks, not pretended feeds. Review *velocity* is a derivative we do not have on day one; the ledger earns it over ~8 weeks.
- **Accept (against frozen fixtures):** Pullman top-3 ≠ Moscow top-3 reproduced; the 258-review incumbent present with fixture-pinned count; every cell has surface-split top-3 with registry refs and furniture flags; the suspected-spam heuristics flag a seeded synthetic offender.

### M2 — Keyword/demand research · **M** · **DataForSEO Keywords Data + Labs**; reuses M1 snapshots
- **Volume honesty:** town-level long-tail volume is fiction and population-scaled proxies are invented numbers in costume. For hyper-local cells the gate is **market existence** — does a pack render for the query? do incumbents maintain pages for it? — both already in M1. Real volume is used only where sources return real data. The true demand test is **R3** (12+ weeks indexed, near-zero impressions → demote/re-target); the spec's honest mechanism was always post-hoc, and we stop pretending otherwise. GSC impressions validate demand only for *already-ranking* pages — never for pages we haven't built.
- **Code the trapped algorithm:** `cluster-validate.ts` = §18 SERP-overlap merge/split rule.
- **Accept (fixtures):** reproduces the confirmed-skip list and ≥80% of documented merge/split calls; every keyword lands on exactly one cluster; zero invented volume numbers appear in any client-facing artifact.

### M3 — GBP observables & gap analysis · **M** · **Business Data** (competitor) + **human transcription** (client + spot-checks)
- **Rebuilt around reality.** Out: `gbp-gap-report.json` containing (a) **per-query primary-category distribution of the actual pack top-3** — never a modal blend, which averages away the one signal that decides pack entry; (b) review count/rating/reply-rate diffs; (c) generated **spot-check tasks**: a human opens the top 5 profiles per priority cell and transcribes secondary categories/services into a typed form — this is the *permanent* v0.x path, with the GBP API as an upgrade if approval ever arrives (it may simply never; there is no real "manual export" fallback and we no longer claim one).
- **Primary-category strategy is a named human decision**: the report models the cross-cluster tradeoff (optimizing primary for EV can shock "electrician near me") and any change ships with a rollback plan and G13 spacing — never as a paste-ready task.
- **Accept:** report shows per-query category distributions for Moscow/Pullman priority cells from fixtures + one completed transcription round; every recommended client-side edit renders as a G13-throttled, human-approved task; velocity targets never exceed owner commitments.

### M4 — Feasibility scorer · **M** · No feed
- **Out:** `cell-verdicts.json`: per cell `{verdict, probability band, ttw_bucket, confidence, fired rule IDs, named_assumptions[]}`. Verdicts: `WINNABLE_PACK | WINNABLE_ORGANIC | ORGANIC_ONLY | LONG_HORIZON | INFEASIBLE`.
- **Corrected physics:** G2 is **empirical** — the pack-demotion radius per cell comes from M1's observed winner-distance distribution, with the drive-time constant only as a prior when data is thin (rural Palouse packs routinely admit 30-min SABs; a hardcoded 15–20 min ceiling would wrongly kill Colfax). G3 uses **velocity delta, recency, review-text topicality, and reply rate** — not count-gap division; a 30-review business beats a stale 258-review incumbent on velocity and recency all the time. At v0.1, before the ledger matures, G3 runs on static count-gap **explicitly flagged low-confidence**, and all pessimistic verdicts (INFEASIBLE/LONG_HORIZON) pass **human review before the client sees them**. G15 fires before anything else: `town.state` not covered by a license entry → INFEASIBLE with a compliance rule ID (Crescent holds ID + WA, which is the only reason the original spec never noticed this rule was missing). Suspected-spam incumbents (M1 tags) are scored as removable obstacles, not legitimate moats. LSA-heavy cells get discounted value.
- **Scoring mechanics are deterministic; outputs are probabilistic.** Same inputs → same bands. We do not claim the *outcome* is deterministic, because it is not.
- **Accept:** Spokane (95 min, no observed distant winners) → `ORGANIC_ONLY` citing G2 with the empirical distribution shown; Colfax **not** auto-demoted when fixtures show 30-min SABs winning its pack; a synthetic WA-only-license manifest makes all ID cells INFEASIBLE citing G15; every verdict carries a band, a bucket, and ≥1 rule ID; no raw months-to-close number appears anywhere.

### M5 — Site-architecture generator · **L** (M for v0.1 subset)
- **Out:** `site-architecture.json`: URL → target keywords → page type → **tier (FULL | DEGRADED)** → template → proof refs → internal links → priority → status (`PLANNED | BLOCKED: awaiting proof | LIVE`).
- **Gates:** **one canonical URL per intent** (many keywords map to one URL; conflicts resolved by rule and logged — it is not a bijection and the spec stops calling it one); proof gate **G6 with N=2** publishable jobs per town×cluster for FULL tier; **DEGRADED tier** — no "jobs we've done in X" section, no proof-dependent claims, genuinely-local content only (permitting via `local_facts`, utility, housing stock) — publishable without proof and auto-upgraded via R10 when proof arrives. This keeps G6's honesty without deadlocking the funnel on a busy tradesman who forgets photos. Min-unique-words floors; 301/canonical plan from crawl diff.
- **Accept:** run on Crescent marks all 8 existing location pages as failing FULL tier (proof registry empty) and emits DEGRADED-tier rebuild specs plus PROOF_COLLECT tasks; no query maps to two URLs; the never-built high-value pages appear as PLANNED.

### M6 — Content generation + gates · **M/L**
- **Extract from Crescent (strongest salvage):** `ServiceData`/`LocationData` → `content-model.ts`; `copy-qa.mjs` → config-driven `copy-qa.ts` (14 generic ai.* rules default; client vocab in `qa-config.json` — fixes the hardcoded Crescent regex that silently drops other clients' copy); `page-templates.md` + generic voice guide → `genspec.yaml`. **Deferred:** genspec *compiling* QA rules — a single-source-of-truth mechanism for a 3-way-drift problem we have with exactly one template set; hand-sync until client #3. Delete `render_copy_audit.py`.
- **Gates:** boilerplate-ratio cap; **information-gain vs. the ranking incumbents' pages** (uniqueness vs. siblings is not value — post-scaled-content-policy, the evaluation is sitewide and pattern-based); **claim-substantiation extended to regulatory/factual claims** — permits, code, licensing, utility programs must resolve to a verified `local_facts` entry or the generator writes around the topic (a hallucinated permit claim on a licensed electrician's page is a liability, not a marketing miss); FAQ uniqueness; proof embedding. **Human editorial review is a hard gate on the first ~10 pages per client and per new vertical**, then sampled — a gate cannot catch a confident falsehood that parses cleanly. Cost-anchor/pricing sections require **owner sign-off**: publishing prices is a business decision.
- **Accept:** existing Crescent location pages fail boilerplate + info-gain when passed through (regression proof); a generated page for a fixture plumbing client passes copy-qa with zero code edits (de-Crescenting proof); an unsubstantiated "award-winning" is stripped and logged; a permit claim with no `local_facts` ref is blocked, not published.

### M7 — Technical/schema scaffold · **S/M**
- **Extract + fix:** JSON-LD builders → one `LocalBusiness` node with stable `@id` referenced by every Service/FAQ/Breadcrumb (current per-location re-declaration is a violation); sitemap/robots derived from architecture (kills ×3 hand-duplicated slug lists); preview-noindex; 301 map.
- **Accept:** exactly one LocalBusiness entity across the rendered site (schema-crawler validated); sitemap diff vs. live = intentional changes only; NAP byte-identical site-wide.

### M8 — Off-site action queue · **M**
- **Out:** `plan.json` tasks. Ordering matters: **`CITATION_FIX` (from M1's audit: wrong NAPs, duplicate listings) before any `CITATION`**; **pack levers ship in wave 1 for WINNABLE_PACK cells** (GBP tasks, review program, citations) — not as a fallback after an organic campaign, because GBP relevance/reviews/proximity dominate pack outcomes and sequencing them behind M5/M6 was backwards.
- **TOS-safe review program (G10 companion):** evidence = **asks sent** (owner attestation + ledger trend), never "reviews received mentioning X" — a done-condition requiring review *content* structurally incentivizes coaching text, which is detectable, filterable, and against policy. No selective gating in any script; ask-script wording gets a one-time human/owner sign-off; R6 cadence increases are smoothing-capped (a velocity spike after flatness is itself a filter trigger).
- **GBP tasks are G13-throttled** (§6) and structural edits are human-approved with rollback notes, never batch-emitted.
- **`SPAM_REPORT` tasks:** where M1 flags a suspected-spam incumbent, emit an evidence-gathering task; a human verifies and a human files — a successful redressal removes a "competitor" faster than any content sprint, and the task taxonomy now contains the highest-ROI pack move a practitioner actually makes.
- **All emission is budgeted against `owner_commitments.hours_per_month`** — the queue never asks for more labor than the owner committed; overflow surfaces as an honest ESCALATION at planning time, not 30 quietly-ignored tasks.
- **Accept:** `link_outreach: false` → zero outreach tasks; every task has evidence + verification; a completed Colfax photo task flips the Colfax page DEGRADED→FULL on the next M5 pass; monthly emitted human-task hours ≤ committed hours.

### M9 — Measurement collectors · **L** (M for minimal) · **GSC (free)** + **DIY geo-grid via DataForSEO Maps** (~$0.03–0.10/49-pin scan) + **Business Data** reviews
- **Out:** `metrics.db` time series + task-ledger join. Two additions from the red-teams: **`gbp-liveness.ts`** — is the client profile visible in the latest snapshot? Disappearance = suspension until proven otherwise = hard-stop ESCALATION with the reinstatement runbook, because a suspension zeroes the entire LOCAL_PACK surface and every other rule would otherwise emit content tasks at a corpse. **`feed-health.ts`** — schema-versioned response validation and anomaly quarantine (>30% of grid pins returning empty pack ⇒ quarantine the scan; corrupted scans never feed R-rules or reset win clocks). Grid data is stored and displayed as *estimates*.
- **Accept:** after 2 weeks on Crescent, "position vs. each named top-3 competitor for `panel upgrade moscow`, per surface, per pin" answers from local data; collectors idempotent + resumable; a seeded malformed scan is quarantined, not ingested; a seeded profile disappearance fires the hard-stop within one cycle.

### M10 — Re-planner · **v0.5, not v0.1** · **L** (M for minimal)
- Deliberately deferred: indexation latency is 8–16 weeks, so M10's first real firing is a quarter after launch no matter when it is built. For v0.1's first quarter, "re-planning" is **a human reading a standing SQL review query weekly** — cheaper and it teaches us which rules we actually need.
- When built (v0.5): amendments only (never rewrites), each citing `{signal, rule_id, input_snapshot}`; **volatility freeze** (R11) so a core update doesn't trigger dozens of per-cell tasks chasing noise; G4 indexation-alarm suppression; monthly heavy re-plan (M1–M3 deltas → M4 re-score) with **event-based staleness stamps** on artifacts (a confirmed algo update expires cached difficulty scores, not just the calendar).
- **Accept:** replayed against synthetic fixtures each rule fires exactly on its predicate; 4-week-old unranked pages produce no alarm; a synthetic cross-cell correlated rank drop produces one `ESCALATION: probable algo update` and zero content tasks.

### OUTPUT renderers · **v0.5** · **S/M**
- Typed JSON → markdown, structure lifted from the `docs/` set. Deferred from v0.1: one client does not need generated reports; the JSON artifacts are the deliverable until client #2. **Accept:** non-SEO reader finds "who beats us in Pullman for panels and why" in under a minute; every grid-derived number is labeled as an estimate; every verdict shows its band and assumptions.

---

## 5. Machine-readable strategy format (`plan.json`)

```jsonc
// plan/task.schema.ts
{
  "task_id": "string",
  "type": "PAGE_BUILD | CONTENT_DEPTH | CANNIBAL_FIX | GBP_EDIT | REVIEW_ASK | CITATION |
           CITATION_FIX | SPAM_REPORT | PROOF_COLLECT | TECH_FIX | LINK | ESCALATION",
  "owner": "agent | human",
  "approval": "none | human_review | owner_signoff",   // NEW — judgment gates, distinct from labor;
                                                       //   see the checkpoint table in §6
  "surface": "ORGANIC | LOCAL_PACK | BOTH",
  "cell": { "town": "slug", "cluster": "cluster_id" },
  "target": { "queries": ["…"], "url": "canonical URL owning the intent (M5 ref) | null" },
  "action": "imperative instruction",
  "gate_checks": ["rule IDs that must pass before DONE"],
  "depends_on": ["task_id"],
  "estimated_human_minutes": 0,                        // NEW — rolls up against G11 capacity
  "done_condition": {                                  // SPLIT — machine truth vs. human attestation
    "verified": "metrics.db/repo predicate | null",
    "attested": "human attestation + evidence artifact | null",
    "min_data": "data-volume precondition; below it the predicate returns UNKNOWN, never DONE"
                // e.g. GSC omits low-volume queries below privacy thresholds — absence of data
                //   must never read as satisfied
  },
  "evidence_required": "what proves completion",
  "verifies_via": "M9 signal confirming effect",
  "status": "PLANNED | BLOCKED | IN_PROGRESS | DONE | VERIFIED | OVERDUE | UNKNOWN",
  "provenance": { "run_id": "…", "emitted_by": "M5|M8|M10", "signal": "…", "rule_id": "…" }
}
```

**Five example tasks from the real Crescent strategy (corrected):**

```jsonc
[
  { "task_id": "T-001", "type": "PAGE_BUILD", "owner": "agent", "approval": "human_review",  // first-10 editorial gate
    "surface": "ORGANIC", "cell": { "town": "pullman-wa", "cluster": "panel" },
    "target": { "queries": ["electrical panel upgrade pullman wa", "panel replacement pullman"],
                "url": "/services/electrical-panel-upgrades/pullman-wa" },
    "action": "Generate FULL-tier service×town page from M5 spec: ≥600 unique words; Pullman-specific facts drawn ONLY from verified local_facts entries (permitting, utility) — write around anything unsourced; cost-anchor section requires owner sign-off; 4-6 unique FAQs; Service+Breadcrumb schema referencing the LocalBusiness @id.",
    "gate_checks": ["G5", "G6", "G7", "G8", "G14"], "depends_on": ["T-004"],
    "estimated_human_minutes": 20,
    "done_condition": { "verified": "URL live, HTTP 200, in GSC coverage", "attested": null,
                        "min_data": "GSC coverage report present for property" },
    "evidence_required": "QA report all-green + editorial approval + PR merged",
    "verifies_via": "GSC impressions for target queries > 0 within G4 window",
    "status": "BLOCKED", "provenance": { "emitted_by": "M5", "rule_id": "G6" } },

  { "task_id": "T-004", "type": "PROOF_COLLECT", "owner": "human", "approval": "none",
    "surface": "BOTH", "cell": { "town": "pullman-wa", "cluster": "panel" },
    "target": { "queries": [], "url": null },
    "action": "Photograph the next 2 Pullman panel jobs (before/after, panel label visible), get publish permission, add to manifest proof_assets.jobs. Until then the Pullman page ships at DEGRADED tier.",
    "gate_checks": [], "depends_on": [], "estimated_human_minutes": 30,
    "done_condition": { "verified": "proof_assets.jobs[town=pullman-wa, cluster=panel] >= 2",
                        "attested": null, "min_data": null },
    "evidence_required": "2 job entries with photos and permission_to_publish=true",
    "verifies_via": "M5 re-run upgrades T-001 tier DEGRADED→FULL (R10)",
    "status": "IN_PROGRESS", "provenance": { "emitted_by": "M8" } },

  { "task_id": "T-011", "type": "GBP_EDIT", "owner": "human", "approval": "human_review",   // G13: structural
    "surface": "LOCAL_PACK", "cell": { "town": "moscow-id", "cluster": "ev" },
    "target": { "queries": ["ev charger installation moscow id"], "url": null },
    "action": "Add GBP services from gbp-gap-report spot-check: 'EV charging station installation', 'Level 2 charger installation'. Secondary category addition is scheduled ≥14 days after this edit per G13 — never batched. Primary category is NOT touched (named strategy decision only, with rollback plan).",
    "gate_checks": ["G11", "G13"], "depends_on": [], "estimated_human_minutes": 15,
    "done_condition": { "verified": "services present in next Business Data snapshot (min_data: snapshot exists post-edit)",
                        "attested": "screenshot of updated services list", "min_data": "1 post-edit snapshot" },
    "evidence_required": "screenshot + gbp-liveness green for 7 days post-edit",
    "verifies_via": "M3 delta shows gap closed; gbp-liveness stable",
    "status": "PLANNED", "provenance": { "emitted_by": "M8", "signal": "gbp-gap:services" } },

  { "task_id": "T-017", "type": "REVIEW_ASK", "owner": "human", "approval": "owner_signoff", // script wording, once
    "surface": "LOCAL_PACK", "cell": { "town": "moscow-id", "cluster": "panel" },
    "target": { "queries": ["electrician moscow id"], "url": null },
    "action": "Send this month's 4 review asks to recent Moscow panel/rewiring customers using signed-off script A. Ask every recent customer in scope — no selective gating. Do NOT request specific wording in reviews. Incumbent gap is large; verdict is LONG_HORIZON (low-confidence until ledger matures) and the plan says so.",
    "gate_checks": ["G3", "G10", "G11"], "depends_on": [], "estimated_human_minutes": 20,
    "done_condition": { "verified": null,
                        "attested": "owner attests 4 asks sent (dates + job refs)",
                        "min_data": null },
    "evidence_required": "ask log (attested); ledger trend is the OUTCOME metric, not the done condition",
    "verifies_via": "review-ledger velocity trend vs incumbent (M9, smoothing-capped per R6)",
    "status": "PLANNED", "provenance": { "emitted_by": "M8", "rule_id": "G3" } },

  { "task_id": "T-023", "type": "CANNIBAL_FIX", "owner": "agent", "approval": "human_review", // de-optimization
    "surface": "ORGANIC", "cell": { "town": "moscow-id", "cluster": "rewiring" },
    "target": { "queries": ["knob and tube rewiring moscow"], "url": "/services/home-rewiring" },
    "action": "GSC shows URL flip-flopping AND combined-position decay over 4+ weeks for this query across /services/home-rewiring and /locations/moscow-id (co-impressions alone are normal in local and do NOT fire this task). Per M5 intent map /services/home-rewiring owns it: draft de-optimization of the location-page section + internal link; human approves before merge — this is the one task class that removes working relevance.",
    "gate_checks": ["G7"], "depends_on": [], "estimated_human_minutes": 15,
    "done_condition": { "verified": "single URL receives impressions for the query over 4 wks",
                        "attested": null,
                        "min_data": "query above GSC privacy threshold in >= 3 of last 6 weeks — else UNKNOWN" },
    "evidence_required": "PR merged with human approval; intent map unchanged",
    "verifies_via": "GSC URL×query join",
    "status": "PLANNED", "provenance": { "emitted_by": "M10", "signal": "url-flipflop+position-decay", "rule_id": "G7" } }
]
```

---

## 6. The closed(-ish) loop

### Guardrails G1–G16

| ID | Rule |
|----|------|
| G1 | Two-surface separation (pack and organic planned, measured, and won separately) |
| G2 | **Empirical proximity ceiling** — per-cell radius from M1's observed pack-winner distance distribution; drive-time constant is only a prior when data is thin |
| G3 | **Review realism, correct physics** — velocity delta, recency, review-text topicality, reply rate; raw count as tiebreaker only. Static count-gap allowed pre-ledger but flagged low-confidence; pessimistic verdicts human-reviewed before client delivery |
| G4 | Indexation latency (8–16 wk alarm suppression, new domains) |
| G5 | Demand validation — real volume where it exists; **market-existence gate** for hyper-local cells; R3 is the authoritative post-hoc demand test |
| G6 | Anti-doorway proof gate — FULL tier needs ≥2 publishable jobs per town×cluster; **DEGRADED tier** publishable without proof (no proof-dependent claims, genuinely-local content only), auto-upgraded via R10 |
| G7 | One canonical URL per intent (many keywords per URL; conflicts resolved by rule) |
| G8 | No unsubstantiated claims — superlatives/numbers AND **regulatory/local-factual claims** (permits, code, utilities) must resolve to manifest evidence / verified `local_facts`, or be written around |
| G9 | Schema single-entity (one LocalBusiness `@id`) |
| G10 | Review-program integrity — no self-serving review markup, no gating, no content coaching, evidence = asks sent |
| G11 | **Owner-capacity ceiling** — task emission budgeted against committed hours/month, not just review counts; overflow escalates at planning time |
| G12 | Honest boundary — off-site is human labor, never simulated; grid data labeled estimates; outcomes stated as probability bands |
| G13 | **GBP edit safety** — one structural change per profile per 7–14 days; never name/address/primary-category in the same window as other edits; primary-category changes are named human decisions with rollback plans; liveness monitored, suspension = hard-stop + reinstatement runbook |
| G14 | **Publish pacing / scaled-content defense** — pages-per-week cap ramped for new domains (interacts with G4); information-gain gate vs. ranking incumbents; human editorial hard gate on first ~10 pages per client and per new vertical |
| G15 | **Licensing compliance** — town.state must be covered by a manifest license entry or the cell is INFEASIBLE |
| G16 | **Volatility freeze** — cross-cell correlated rank movement above threshold suspends corrective amendments (R1–R5); one escalation artifact; human decides when to resume |

**Cadence:** GSC daily · geo-grid + review ledger + gbp-liveness + feed-health weekly · v0.1: **human SQL review weekly** · v0.5+: re-planner weekly light / monthly heavy (M1–M3 delta, M4 re-score, event-based staleness) · quarterly human-facing strategy review.

### Signals → actions (R1–R13)

| # | Signal (metrics.db predicate) | Amendment emitted |
|---|---|---|
| R1 | Page indexed 6+ wks, impressions > 0, avg position 8–15 | `CONTENT_DEPTH`: expand with long-tails already earning impressions; hub links |
| R2 | **URL flip-flopping or combined-position decay ≥4 wks** for one query across two URLs (co-impressions alone are normal in local and never fire this) | `CANNIBAL_FIX` per intent map — agent-drafted, **human-approved** (G7) |
| R3 | Page 12+ wks, indexed, near-zero impressions | Demand re-validation: demote or re-target — the real G5 test |
| R4 | Published pages unindexed past G4 window | `TECH_FIX`: internal links, sitemap ping, crawl check |
| R5 | Organic top-3 won, pack lagging, town within empirical G2 radius | Intensify pack levers (already wave-1 for WINNABLE_PACK cells): review mix, GBP photos/services, citations |
| R6 | Review-velocity slope negative vs. incumbent | Raise ask cadence **within smoothing cap** (spikes trigger filters); if G11 binds → `ESCALATION` + honest re-score |
| R7 | Cell top-3 changed (registry diff; spam-tag check on new entrant) | M1 delta re-profile → M4 re-score → amend that cell only; suspected spam → `SPAM_REPORT` evidence task |
| R8 | Human task `OVERDUE` ≥ 2 cycles | `ESCALATION`; dependent cells downgraded with named cause (G12) — and the intake throughput forecast is re-printed against actuals |
| R9 | Rank up, **calls flat** (call-tracking data, which intake guarantees exists) | CTR/snippet task or demand re-check; check cell's LSA/furniture flags — KPI overrides rank |
| R10 | New proof asset matches a DEGRADED/BLOCKED page | Auto-queue `PAGE_BUILD`/upgrade (M6) — the T-004→T-001 chain, no human in the loop needed |
| R11 | **Cross-cell correlated movement above volatility threshold** | G16 freeze: suspend R1–R5 amendments, emit one `ESCALATION: probable algo update`, human resumes |
| R12 | **Client GBP absent from latest snapshot** | Hard-stop: suspected suspension → immediate `ESCALATION` + reinstatement runbook; all LOCAL_PACK tasks paused |
| R13 | **Feed anomaly** (schema mismatch, >30% empty-pack pins) | Quarantine scan; win clocks and trends unaffected; vendor-health flag raised |

### Human checkpoints (judgment, not just labor)

The `owner` field marks who does the work; the `approval` field marks who exercises judgment. These are mandatory:

| Decision | Handling |
|---|---|
| GBP primary-category or business-name change | Named human strategy decision + rollback plan; never a paste-ready task (G13) |
| Any GBP structural edit | Rate-limited per G13 + human-approved |
| First ~10 pages per client / per new vertical | Human editorial read is a hard gate (G14) |
| `CANNIBAL_FIX` / any de-optimization | Human-approved — the one task class that removes working relevance |
| Regulatory/permit/code claims | Only from owner/human-verified `local_facts` (G8) |
| Cost-anchor / pricing content | Owner sign-off — pricing is a business decision |
| Review-ask script wording | One-time human/owner TOS review (G10) |
| INFEASIBLE / LONG_HORIZON verdicts | Human review before client delivery (G3 early math skews pessimistic) |
| `SPAM_REPORT` filings | Human verifies evidence; human files |
| Resuming amendments after a volatility freeze | Human decides (G16) |
| New vertical intake | Human-expert checkpoint against the vertical-profile layer — verticals differ structurally (YMYL, bar advertising rules, seasonality), not lexically; a vocab overlay cannot express "testimonials are prohibited here" |

**Safely automated as specified:** M2 expansion/clustering, M4 scoring mechanics, M5 URL mapping, M7 schema/sitemap, M9 collectors, R1/R4/R10/R13, report rendering.

### "Beat #1–3," measured honestly (`loop/goal-check.ts`)

Per cell per surface against *named registry competitors* (refs, not fixed positions):

- `PACK_WON(cell)`: client in pack top-3 at ≥70% of grid pins for the cluster's head keywords, in **≥8 of the last 10 valid weekly scans** (quarantined scans excluded — a vendor parser regression must not reset a win clock), **AND**, where call attribution exists, a lead floor for the cell is met. Rank without leads is R9's problem, not a win.
- `ORGANIC_WON(cell)`: canonical URL above all three named competitors for ≥80% of target keywords, same 8-of-10 sustain rule, same lead-floor condition.
- Won cell → `MAINTAIN` (reduced cadence; defend rules R6/R7/R11/R12). A MAINTAIN cell **can regress for exogenous reasons**; regression during a G16 freeze does not emit corrective tasks. **Region done** = every WINNABLE cell in MAINTAIN; INFEASIBLE cells reported with the fired rule and never budgeted.

---

## 7. Versioned roadmap

### v0.1 — "Crescent through the pipe" (semi-manual data, no loop machinery) · **~5–6 engineer-weeks**

Day 0 (parallel, long-lead): DataForSEO account ($50 deposit); file GBP API application (treated as a possible future upgrade — **the plan does not depend on approval**); **install call tracking on Crescent** (calls is the KPI; ~$45–65/mo); Crescent stays client #1.

1. Intake: schema + validation + throughput forecast + `local_facts` + Crescent manifest (M) — the de-hardcoding migration is the test.
2. Templates package: content model + components (FULL + **DEGRADED** location tiers) + `@id` schema fix + sitemap/robots/noindex (S/M).
3. QA gates: config-driven copy-qa, boilerplate, **info-gain**, extended claim-substantiation, FAQ-unique; Python duplicate deleted. Genspec is hand-synced — **no compiler** (M).
4. M1 semi-manual ⚙: scripted SERP pulls → human-assembled registry in the typed schema, **including furniture flags, distance distributions, spam heuristics, citation/duplicate audit**; raw responses frozen as fixtures (M).
5. M2 with market-existence gating + coded §18/§15 rules (M).
6. M4: bands + buckets + G15 compliance + empirical G2 + low-confidence G3; human review step for pessimistic verdicts (M). M3 inputs via manual spot-check transcription ⚙.
7. M5 v0.1 subset: URL map + cannibalization + proof gates + tiers (M).
8. `plan.json` + tracker (status/dependencies only — escalation automation deferred) + M8 with CITATION_FIX-first, TOS-safe review program, G13-throttled GBP tasks, wave-1 pack levers, capacity budgeting (M).
9. M6 generation through gates (human editorial on first 10 pages) → M7 publish, **G14-paced**: ship the never-built high-value pages and DEGRADED-tier location rebuilds (M).
10. **M9 minimal starts the day pages ship** (GSC + weekly grid + review snapshots + gbp-liveness + basic feed-health → SQLite) — the indexation clock is the schedule driver (M).
11. **No M10, no renderers, no escalation automation.** Weekly re-planning = a human running the standing SQL review queries. The first loop signal that matters is R4 (indexation), a quarter away regardless of what we build.

**Exit criteria:** Crescent's `plan.json` live with ≥30 gated tasks whose human-hours fit the owner's committed capacity; DEGRADED location pages live and proof tasks flowing (≥1 R10-style upgrade executed manually); call tracking reporting; 4 weeks of clean metrics (zero quarantine leaks); throughput forecast vs. actuals reviewed with the owner once.

### v0.5 — "Loop wired, second client" (proves generalization) · **~7 weeks after v0.1**

M10 minimal (R2/R4/R6/R10/R11/R12 + G4 suppression, weekly) + tracker escalation (R8) — *now* there are signals to re-plan against; genspec→QA compilation (justified at template-set #2); full M1 automation (human review only); M3 semi-automated (Business Data + structured transcription workflow; GBP API if it ever arrives); M5 crawl-diff/301 automation; report renderers; **second client in a different vertical and region** through the **vertical-profile layer** with a human-expert intake checkpoint — the generalization test is config + vertical profile, zero core-code edits; G3 velocity-mode activates on Crescent (ledger now mature); DataForSEO Backlinks ($100/mo floor) only when link data would change a decision.

**Exit:** client #2 goes intake→published pages→collecting metrics in <2 weeks wall-clock with <1 day human research; first auto-amendment emitted with signal + rule citation; Crescent verdicts re-scored on real velocity data and deltas explained to the owner.

### v1.0 — "Agent-run loop" · **~8 weeks after v0.5**

Full R1–R13; monthly heavy re-plan with event-based staleness; agent executes `owner: agent` tasks end-to-end with the §6 checkpoint table as the only human touchpoints; owner dashboard (per-cell scoreboard with bands, review-velocity trend, task/capacity view, KPI incl. calls); BrightLocal citations API; mature SPAM_REPORT workflow; escalation artifacts delivered automatically.

**Exit:** one full quarterly cycle on 2+ clients where every amendment traces to signal + rule, no hand-written strategy documents, ≥1 cell reaches WON (rank + lead floor) or an honest INFEASIBLE/LONG_HORIZON verdict with cited physics and a human-reviewed band, and ≥1 volatility or feed-health event was absorbed without emitting garbage tasks.

### Cost model (corrected — the original counted only API spend)

| Line | Client 1 | Marginal per client |
|---|---|---|
| Data vendors (DataForSEO; Backlinks deferred) | $50–90/mo ($150–190 with backlinks) | $10–20/mo |
| LLM generation + QA tokens | $20–60/mo | ~$15–40/mo |
| Call tracking (required for calls KPI) | $45–65/mo | $45–65/mo |
| **Agency human labor** (PR/editorial review, GBP transcription, registry assembly at v0.x, OVERDUE chasing, verdict review) | **6–10 hrs/mo** at v0.1–0.5, trending 3–5 hrs/mo at v1.0 | similar until automation matures |
| **Owner labor** (photos, asks, GBP edits) | 2–4 hrs/mo — modeled in G11, forecast at intake | per client |
| Engineering maintenance (SERP/vendor parser churn — the permanent tax of this category) | **10–15% of eng time, forever** | amortized |

Fixed dollar floors amortize by client 3–4. The human-labor lines are the real cost of the product and are now stated as such.

**The three schedule killers are external, not code:** indexation latency (8–16 wks — why v0.1 ends at collectors, not a re-planner), owner throughput (why intake forecasts stall probability before signing), and GBP API approval (why the plan of record never depends on it).