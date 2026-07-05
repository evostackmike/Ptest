/**
 * pipeline/m3-gbp-observables/spot-check-gen.ts
 *
 * generateSpotCheckTasks — CONTRACTS §4. Emits owner:"human" transcription
 * tasks for the GBP fields no API exposes (secondary categories, services,
 * attributes): the permanent v0.x path.
 *
 * G13-awareness: spot-check tasks are `type: "GBP_EDIT"` with
 * `approval: "none"` and a transcribe-only action — they change nothing on
 * any profile, so the G13 structural-edit throttle does not apply. Any task
 * recommending an ACTUAL profile edit is M8's job and ships G13-throttled
 * with `approval: "human_review"`; M3 never emits one.
 */

import type { GbpGapReport, Task } from "../../core/types.js";

/** Realistic minutes to open ~5 profiles and fill the transcription form. */
export const SPOT_CHECK_MINUTES = 15;

export function generateSpotCheckTasks(report: GbpGapReport): Task[] {
  const tasks: Task[] = [];

  for (const cellGap of report.cells) {
    cellGap.spotCheckTasks.forEach((action, i) => {
      const suffix = cellGap.spotCheckTasks.length > 1 ? `-${i + 1}` : "";
      tasks.push({
        task_id: `m3-spotcheck-${cellGap.cell.town}--${cellGap.cell.cluster}${suffix}`,
        type: "GBP_EDIT",
        owner: "human",
        approval: "none",
        surface: "LOCAL_PACK",
        cell: { ...cellGap.cell },
        target: { queries: [cellGap.query], url: null },
        action,
        gate_checks: [],
        depends_on: [],
        estimated_human_minutes: SPOT_CHECK_MINUTES,
        done_condition: {
          verified: null,
          attested:
            `Completed spot-check transcription form for ` +
            `${cellGap.cell.town} × ${cellGap.cell.cluster} (secondary ` +
            `categories, services, attributes for the top profiles)`,
          min_data: null,
        },
        evidence_required: "Filled transcription form attached to the task",
        verifies_via:
          "M3 re-run consumes the transcription; gap report gains secondary-category/services fields for the cell",
        status: "PLANNED",
        provenance: {
          emitted_by: "M3",
          signal: `gbp-gap-report@${report.generatedAt}`,
        },
      });
    });
  }

  return tasks;
}
