---
description: "Full verification pass: typecheck, all tests, e2e pipelines on both clients, spec acceptance criteria — report only, no silent fixes"
---

Run the complete verification bar for the seo-engine and REPORT — do not fix anything silently (list findings instead).

1. `npx tsc --noEmit` — report clean/errors.
2. `npx vitest run` — report totals; list every failure with the assertion text.
3. E2E: run the CLI pipeline stages on clients from intake/examples/ (crescent-electric + the synthetic second client): validate → sweep → keywords → gbp → score → architect → briefs (if built) → queue → plan → report (if built). Zero code edits allowed. Inventory the artifacts produced per client.
4. Spec acceptance criteria (docs/engine-build-spec.md §4 per-module Accept + tests/acceptance.test.ts): evaluate each explicitly — G2 (Spokane → ORGANIC_ONLY with empirical distance evidence), G15 (unlicensed-state cells → INFEASIBLE), G6/tiers (proof-less location pages ≠ FULL), G7 (no query maps to two URLs), G11 (emitted human-minutes ≤ owner committed hours), TOS-safety (review tasks never condition on review content), de-hardcoding (grep: client phone/name literals only in manifests + fixtures), determinism (same inputs → identical verdicts).
5. Page-brief spec conformance (docs/page-brief-spec.md §6 acceptance tests) if briefs are built: partition/base-city rule, claim-mass preflight blocking, FACT_COLLECT cascade, sibling-similarity gate.
6. Verdict table: criterion | PASS/FAIL/NOT-BUILT | evidence. Then the top 5 risks in what exists. Be blunt.
