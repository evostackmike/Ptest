---
description: "Generate the operator report and/or customer-facing 'where you're invisible' SEO+AEO report — red-teamed before delivery"
argument-hint: "<client-slug> [operator|prospect|both]"
---

Generate reports for: $ARGUMENTS (default: both audiences)

1. Load the client's latest run artifacts (registry, keyword map, gbp gap report, verdicts, architecture, briefs, plan.json, forecast). If renderers (templates/reports/) aren't built yet, say so and offer to build them via /engine-build first.
2. **Operator report** — professional, readable in ~10 min: executive verdict (where winnable / not, with probability bands and named binding constraints), competitor profiles per town, the strategy (keyword map, recommended pages with per-page brief summaries, GBP moves, off-site queue + owner-hours budget), measurement baseline + what "won" means per cell.
3. **Prospect report** — plain-language, customer-facing: visibility scorecard per town × service ("when someone searches X in Y, you don't appear — these competitors do, with N reviews vs your M"), what that costs, the fix list in priority order, and the AEO section (AI-answer visibility: entity/schema completeness, NAP consistency across AI-cited sources, Bing/Apple presence, review-platform diversity, answerable-content coverage) — evidence-graded, no hype.
4. **Red-team before delivery** (mandatory for prospect): a hostile pass over the copy for rank promises, unsubstantiated superlatives, invented numbers, or anything G8/G12 forbids. Every number must trace to an artifact. Grid data labeled as estimates. Timeframes as ranges.
5. Render markdown (+ self-contained HTML for prospect) to clients/<slug>/reports/. Show me the prospect report for sign-off — never mark it deliverable without my approval. Commit + push.
