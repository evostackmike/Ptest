---
description: "The weekly measure→act cadence for a client: ingest data, run review queries, apply R-rules, emit amendments + escalations"
argument-hint: "<client-slug>"
---

Run the weekly closed-loop cycle for client: $ARGUMENTS

1. **Ingest**: run collectors on the week's data drops (GSC export, geo-grid scan, review snapshots, GBP liveness) into clients/<slug>/measurements/. Respect feed-health: quarantine anomalous scans (>30% empty pins / schema drift) — quarantined data never feeds decisions.
2. **Hard-stops first**: GBP liveness (R12 — profile gone = suspected suspension = STOP + escalation with reinstatement runbook), volatility freeze (R11 — cross-cell correlated movement = one escalation, no corrective tasks).
3. **Standing review** (v0.1 = you are the re-planner): per cell × surface — position trends vs named competitors, indexation status vs G4 window, impressions vs demand expectations (R3: 12+ wks near-zero = demote/re-target), cannibalization (R2: URL flip-flop + position decay ≥4 wks, co-impressions alone never fire), review velocity vs incumbent (R6, smoothing-capped), task ledger (R8: OVERDUE ≥2 cycles → escalation + downgrade dependent cells with named cause).
4. **Act**: emit plan.json amendments ONLY where an R-rule fires, each citing {signal, rule_id, evidence}. Amendments, never rewrites. New proof assets → R10 tier upgrades. Respect G11 capacity in anything you ask of the owner.
5. **Goal check**: evaluate WON conditions (8-of-10 valid scans, lead floor where tracking exists); transition cells to MAINTAIN as earned.
6. **Report to me**: the week in 15 lines — movement, fires, escalations, owner asks, next week's watch list. Honest: "no signal yet, domain still in indexation window" is a valid and common answer. Commit + push.
