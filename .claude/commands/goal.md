---
description: "Master orchestrator: assess engine state, build ALL remaining scope via closed loops, verify everything, commit + push"
argument-hint: "[optional focus, e.g. 'reports module' or 'v0.5 wiring']"
---

You are operating the seo-engine repo. Your goal: get every piece of committed scope BUILT and VERIFIED, honestly. Focus (if given): $ARGUMENTS

## 1. Assess (never skip)
- Read docs/engine-build-spec.md (§4 module accept criteria, §6 guardrails, §7 roadmap), docs/page-brief-spec.md (implementation checklist at end), docs/completeness-addendum.md (accepted v0.1/v0.5 deltas), docs/production-plan.md, core/CONTRACTS.md.
- Run: `npx tsc --noEmit` and `npx vitest run`. Inventory which modules/contracts exist vs missing.
- Produce a gap list: spec'd-but-unbuilt, built-but-failing, built-but-unverified.

## 2. Plan
- Order the gap list by dependency. State what you will build this session and what you won't (with reason).

## 3. Build — use a workflow (closed loop)
- Run a multi-agent workflow: parallel builders on disjoint directories per core/CONTRACTS.md → integrate (whole-repo typecheck + full suite green) → verify (see §4) → 2 hostile reviewers → fixer verifying each finding before fixing.
- Builders: zod + Node builtins only; NodeNext ESM (.js import suffixes); fixture-driven (no live APIs in tests); colocated vitest tests asserting real behavior.

## 4. CHECK IT (the non-negotiable bar)
All of the following must pass before you may claim anything is done:
- `npx tsc --noEmit` clean; `npx vitest run` 100% green (never weaken an assertion to pass).
- End-to-end: full CLI pipeline on BOTH clients — intake/examples/crescent-electric.manifest.json AND the synthetic second client — with zero code edits between them; artifacts land in clients/<slug>/.
- tests/acceptance.test.ts green (spec cross-cutting criteria: G2 Spokane→ORGANIC_ONLY, G15 wrong-state→INFEASIBLE, no query→two URLs, capacity ≤ owner hours, no hardcoded client literals outside manifests/fixtures).
- Report results per criterion, pass/fail. If anything fails, say so plainly with the output — do NOT summarize failures away.

## 5. Ship
- Commit with a descriptive message and push to the current branch. Report: what was built, what was verified, what remains, next action.

Honesty rules (G12 applies to you): no "done" without the §4 bar; stochastic outcomes stay probability-banded; if blocked, state the blocker instead of routing around it silently.
