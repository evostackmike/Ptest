---
description: "Draft pages from their briefs and drive them through the M6 gates until green (human review honored)"
argument-hint: "<client-slug> [page-url-or-'next-N']"
---

Build content for client $ARGUMENTS from their page briefs.

1. Load clients/<slug>/plan.json + the page briefs. Select the requested page(s), or the next N PLANNED PAGE_BUILD tasks by priority whose dependencies are DONE. NEVER build a page whose brief is BLOCKED (claim-mass preflight or missing facts) — list its FACT_COLLECT blockers instead.
2. For each page: draft content that satisfies the brief EXACTLY — keyword-to-section assignments, word budgets, only scoped local_facts (cite fact_ids inline as comments), FAQ set (excluding gap-blocked slots), tier rules (DEGRADED = zero proof-dependent claims, no invented experience).
3. Run the full gate suite (pipeline/m6-content): copy-qa, boilerplate-ratio, sibling-similarity, info-gain vs incumbents, claim-substantiation, faq-unique. Iterate draft → gates until ALL green. Never satisfy a gate by weakening it or by lexical shuffling that adds no information — if a gate can't pass honestly, the page is BLOCKED; say why.
4. Human checkpoints (spec §6): if this is among the client's first ~10 pages, STOP and present drafts + gate reports to me for editorial review before marking anything done. Pricing/cost content requires owner sign-off — flag it.
5. Update plan.json task statuses with evidence; write content to clients/<slug>/content/. Commit + push. Report: pages built, gate results, pages blocked + why, what Parker/owner must provide to unblock.
