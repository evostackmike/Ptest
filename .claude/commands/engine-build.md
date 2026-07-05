---
description: "Continue/complete engine build scope via a closed-loop workflow (builders → integrate → verify → red-team → fix)"
argument-hint: "[module or scope, e.g. 'reports + page-briefs' — omit to build all missing]"
---

Build the requested engine scope: $ARGUMENTS (if empty: everything in docs/*.md spec'd for the current version but missing or failing).

Rules of engagement:
- Contracts first: conform to core/CONTRACTS.md + core/types.ts. If the scope needs new shared types, add them to core/ FIRST, coherently, then build against them.
- Use a workflow (closed loop): parallel builders on disjoint dirs → integration agent (whole-repo `npx tsc --noEmit` + `npx vitest run` green, CLI wiring) → verification agent (e2e both example clients, zero code edits between them) → 2 hostile reviewers (spec conformance; correctness/robustness) → fixer (verify each finding against code before fixing; root-cause fixes only).
- Builder constraints: zod + Node builtins only (node:sqlite allowed); NodeNext ESM .js import suffixes; fixture-driven, no network in tests; colocated *.test.ts asserting real behavior; client literals live only in manifests/fixtures/qa-configs — the engine stays client-agnostic (grep-proof it).
- Guardrails are code, not advice: anything you build that plans/publishes/claims must route through rules/guardrails.ts checks (G6 proof tiers, G7 one-URL-per-intent, G8 claim substantiation, G11 capacity, G13 GBP throttle, G14 pacing, G15 licensing).
- Done bar: the /engine-verify criteria pass. Then commit + push with a message listing what was built and its test counts.
