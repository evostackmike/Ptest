# seo-engine

A client-agnostic local-SEO engine: hand it a website + a client manifest (business facts,
services, target region), and it produces — per client — a per-cell competition report
(cell = town × service-cluster × surface), a full SEO strategy (keywords, GBP gaps, proof-gated
page architecture), a machine-readable task plan an AI agent executes, and a measurement loop
(GSC + geo-grid + review ledger) that re-plans over time.

**Reference implementation of the output:** the Crescent Electric site
([`evostackmike/crescent-electric`](https://github.com/evostackmike/crescent-electric),
crescentinlandnw.com) — built by hand as client #1; this engine generalizes that pipeline.

## Founding documents

| Doc | What it is |
|---|---|
| [`docs/engine-build-spec.md`](docs/engine-build-spec.md) | The build spec (v2, post-red-team): gap summary, honest product claim, repo layout, client-manifest schema, module-by-module build plan (M1–M10), machine-readable task format, guardrails G1–G16, signal→action rules R1–R13, human checkpoints, versioned roadmap v0.1 → v1.0 with cost model. |
| [`docs/gap-matrix.md`](docs/gap-matrix.md) | Module-by-module gap matrix: current Crescent one-off vs. target engine, with the dependency-ordered critical path to v0.1. |

## The honest claim (from the spec)

- The engine executes and verifies the **on-site half** end-to-end (site generation, schema,
  gated content, publication, rank measurement), with defined human checkpoints.
- **Off-site levers** (reviews, GBP edits, citations, job photos) are emitted as tracked human
  tasks with evidence requirements — never simulated. Pack outcomes are rate-limited by owner labor.
- Ranking outcomes are **stochastic**: all verdicts are probability bands with named assumptions,
  never promises.

## Roadmap at a glance

- **v0.1 — "Crescent through the pipe"** (~5–6 eng-weeks): intake + templates + QA gates +
  semi-manual competitor research + feasibility scorer + task plan + minimal collectors.
- **v0.5 — "Loop wired, second client"** (~7 wks after): re-planner, automated M1, report
  renderers, second client in a new vertical with zero core-code edits.
- **v1.0 — "Agent-run loop"** (~8 wks after): full R1–R13, agent executes its tasks end-to-end,
  owner dashboard, quarterly cycle with every amendment traced to signal + rule.
