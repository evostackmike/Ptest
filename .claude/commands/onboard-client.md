---
description: "Onboard a new client end-to-end: intake interview → manifest → research fixtures → full pipeline run → reports"
argument-hint: "<business-name> <website-url> <target-region>"
---

Onboard a new client into the engine: $ARGUMENTS

1. **Intake interview** — ask me (the operator) the manifest questions in batches, per intake/manifest.schema.ts + docs/engine-build-spec.md §3: business facts + NAP, licenses (numbers + states — G15 depends on this), base location + lat/lng, service-area towns with drive times, service clusters + do_not_offer, proof assets (real jobs with publish permission — empty is acceptable and honest), local_facts (permit authority, utility — with source or owner attestation, scoped town/county/state), GBP access level + current primary category, owner_commitments (hours/month, reviews/month, photos, budget, hard nos), goals + KPI, integrations (GSC property, call tracking — warn hard if KPI=calls without tracking).
2. **Manifest**: write intake/examples/<slug>.manifest.json (or clients/<slug>/manifest.json), run validation, fix rejections with me.
3. **Throughput forecast**: run it; show me the per-cell stall probabilities BEFORE proceeding — this is the honest-expectations conversation.
4. **Research fixtures** (v0.x semi-manual path): research the region's actual competitors per cell (WebSearch: pack winners, review counts, site depth per town × cluster) and assemble the m1 fixture set in the typed registry schema. Flag suspected spam competitors. Freeze fixtures with provenance notes.
5. **Run the pipeline**: validate → sweep → keywords → gbp → score → architect → briefs → queue → plan. Artifacts to clients/<slug>/.
6. **Sanity + deliverables**: check verdicts against common sense (proximity, review gaps); generate the operator report and the prospect report (if renderers built); show me the verdict matrix + top tasks. Do NOT send anything client-facing without my sign-off.
7. Commit + push.
