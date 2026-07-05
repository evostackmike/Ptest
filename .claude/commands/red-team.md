---
description: "Hostile review of any engine artifact: code module, strategy, report, or the working diff"
argument-hint: "<target: module path | client report | 'diff' | 'spec'>"
---

Run a hostile red-team pass on: $ARGUMENTS

Use a workflow with 2-3 adversarial reviewers, each a different lens, then verify findings before reporting:
- **Code target**: spec-conformance (does it implement docs/engine-build-spec.md + CONTRACTS.md, exactly — guardrail thresholds, boundary conditions, tier semantics) + correctness (ESM/NodeNext imports, zod/type drift, off-by-ones in windowed logic, silent catches, tautological tests) + honesty (does any output overclaim what the data supports?).
- **Strategy/verdict target**: proximity/review physics honored? bands justified by evidence? INFEASIBLE cells actually infeasible? anything promised that G12 forbids?
- **Client-facing report target**: rank promises, unsubstantiated superlatives, numbers that don't trace to artifacts, grid estimates presented as facts, AEO hype not evidence-graded.
Every finding: file/section, defect, concrete failure scenario, severity. Verify each against the actual artifact before reporting (reviewers can be wrong — kill unverified findings). Report survivors ranked by severity; fix only if I say so.
