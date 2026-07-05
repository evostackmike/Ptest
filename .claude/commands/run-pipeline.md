---
description: "Run the full engine pipeline for an existing client and summarize verdicts + plan"
argument-hint: "<client-slug>"
---

Run the full pipeline for client: $ARGUMENTS

1. Locate the manifest (clients/<slug>/manifest.json or intake/examples/<slug>.manifest.json); validate it first.
2. Run every stage via the CLI: sweep → keywords → gbp → score → architect → briefs → queue → plan. Use the client's fixture set; if fixtures are stale (>90 days) or missing cells, tell me before proceeding.
3. Artifact sanity per stage: registry has per-cell surface-split top-3 with furniture flags; keyword map has no invented volumes (null is correct); verdicts carry bands + fired rules; architecture has no G7 violations and correct FULL/DEGRADED tiers vs proof registry; plan.json validates and respects G11 capacity.
4. Summarize for me: verdict matrix (cell × surface), what changed vs the previous run (diff verdicts + architecture), top 10 tasks by leverage, any ESCALATIONs, and the honest blockers (missing facts, proof, owner capacity).
5. Commit artifacts + push.
