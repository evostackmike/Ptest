/**
 * rules/signals-actions.ts — R1–R13 signal predicates (spec §6).
 *
 * Each predicate takes the minimal metrics-row slice it needs and returns a
 * SignalResult. Pure and total: no I/O, no clock, no throw.
 *
 * v0.1 real logic: R2, R3, R4, R10, R11, R12, R13.
 * v0.1 stubs (never fire, marked // V05:): R1, R5, R6, R7, R8, R9.
 */

import type {
  ArchitecturePage,
  Cell,
  GbpLivenessRow,
  GeogridScan,
  GscMetricsRow,
  ProofJob,
  ReviewLedgerRow,
  RuleId,
} from "../core/types.js";

export interface SignalResult {
  fired: boolean;
  ruleId: RuleId;
  reason: string;
}

// ---------------------------------------------------------------------------
// R1 — content depth (position 8–15 with impressions) — v0.1 stub
// ---------------------------------------------------------------------------

// V05: fire when page indexed 6+ weeks, impressions > 0 and avg position
// 8–15 → CONTENT_DEPTH amendment. Requires the M10 re-planner to consume it.
export function r1ContentDepth(rows: GscMetricsRow[], indexedWeeks: number): SignalResult {
  void rows;
  void indexedWeeks;
  return { fired: false, ruleId: "R1", reason: "R1 stub at v0.1 (re-planner consumes it at v0.5)" };
}

// ---------------------------------------------------------------------------
// R2 — cannibalization: flip-flop AND combined-position decay
// ---------------------------------------------------------------------------

/** Minimum weeks of observation before R2 may fire. */
export const R2_MIN_WEEKS = 4;
/** Minimum consecutive-week winner changes that count as flip-flopping. */
export const R2_MIN_WINNER_FLIPS = 2;
/** Minimum combined-position worsening (positions) across the window. */
export const R2_MIN_POSITION_DECAY = 2;

/**
 * R2 — cannibalization signal for ONE query intent whose GSC rows span
 * multiple URLs. Fires only when BOTH hold over ≥R2_MIN_WEEKS weeks:
 *   (a) flip-flop — the top-impressions URL changes across consecutive weeks
 *       at least R2_MIN_WINNER_FLIPS times, AND
 *   (b) combined-position decay — the impressions-weighted position across
 *       all URLs worsens by ≥R2_MIN_POSITION_DECAY (second half vs first half).
 *
 * Co-impressions alone (two URLs both earning impressions with a stable
 * winner and stable combined position) are normal in local and NEVER fire.
 * The resulting CANNIBAL_FIX is agent-drafted, human-approved (G7).
 */
export function r2CannibalFix(rows: GscMetricsRow[]): SignalResult {
  const urls = [...new Set(rows.filter((r) => r.impressions > 0).map((r) => r.url))];
  if (urls.length < 2) {
    return { fired: false, ruleId: "R2", reason: "R2 not fired: fewer than two URLs earn impressions for this query" };
  }

  // Bucket by week (whole days since epoch / 7 — deterministic, no clock).
  const weeks = new Map<number, Map<string, { impressions: number; posWeighted: number }>>();
  for (const r of rows) {
    const t = Date.parse(r.date);
    if (Number.isNaN(t)) continue;
    const week = Math.floor(t / 86_400_000 / 7);
    let byUrl = weeks.get(week);
    if (!byUrl) {
      byUrl = new Map();
      weeks.set(week, byUrl);
    }
    const agg = byUrl.get(r.url) ?? { impressions: 0, posWeighted: 0 };
    agg.impressions += r.impressions;
    agg.posWeighted += r.position * r.impressions;
    byUrl.set(r.url, agg);
  }

  const weekKeys = [...weeks.keys()].sort((a, b) => a - b);
  if (weekKeys.length < R2_MIN_WEEKS) {
    return {
      fired: false,
      ruleId: "R2",
      reason: `R2 not fired: only ${weekKeys.length}/${R2_MIN_WEEKS} weeks observed`,
    };
  }

  const winners: string[] = [];
  const combinedPositions: number[] = [];
  for (const wk of weekKeys) {
    const byUrl = weeks.get(wk)!;
    let winner = "";
    let winnerImp = -1;
    let totalImp = 0;
    let totalPosWeighted = 0;
    for (const [url, agg] of [...byUrl.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      totalImp += agg.impressions;
      totalPosWeighted += agg.posWeighted;
      if (agg.impressions > winnerImp) {
        winnerImp = agg.impressions;
        winner = url;
      }
    }
    winners.push(winner);
    combinedPositions.push(totalImp > 0 ? totalPosWeighted / totalImp : 0);
  }

  let flips = 0;
  for (let i = 1; i < winners.length; i++) if (winners[i] !== winners[i - 1]) flips++;

  const mid = Math.floor(combinedPositions.length / 2);
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const decay = mean(combinedPositions.slice(mid)) - mean(combinedPositions.slice(0, mid));

  const flipFlop = flips >= R2_MIN_WINNER_FLIPS;
  const decaying = decay >= R2_MIN_POSITION_DECAY;

  if (flipFlop && decaying) {
    return {
      fired: true,
      ruleId: "R2",
      reason: `R2 fires: winner URL flipped ${flips}× across ${weekKeys.length} weeks AND combined position decayed ${decay.toFixed(1)} positions — cannibalization (CANNIBAL_FIX, human-approved per G7)`,
    };
  }
  return {
    fired: false,
    ruleId: "R2",
    reason: `R2 not fired: flips=${flips} (need ≥${R2_MIN_WINNER_FLIPS}) decay=${decay.toFixed(1)} (need ≥${R2_MIN_POSITION_DECAY}) — co-impressions alone are normal in local`,
  };
}

// ---------------------------------------------------------------------------
// R3 — demand re-validation (the authoritative post-hoc G5 test)
// ---------------------------------------------------------------------------

/** Minimum weeks indexed before R3 may fire. */
export const R3_MIN_INDEXED_WEEKS = 12;
/** Total impressions below which the window counts as near-zero. */
export const R3_NEAR_ZERO_IMPRESSIONS = 10;

/** R3 — page indexed 12+ weeks with near-zero impressions → demote/re-target. */
export function r3DemandRevalidate(rows: GscMetricsRow[], indexedWeeks: number): SignalResult {
  if (indexedWeeks < R3_MIN_INDEXED_WEEKS) {
    return {
      fired: false,
      ruleId: "R3",
      reason: `R3 not fired: indexed ${indexedWeeks}/${R3_MIN_INDEXED_WEEKS} weeks — too early to judge demand`,
    };
  }
  const total = rows.reduce((s, r) => s + r.impressions, 0);
  if (total < R3_NEAR_ZERO_IMPRESSIONS) {
    return {
      fired: true,
      ruleId: "R3",
      reason: `R3 fires: indexed ${indexedWeeks} weeks with ${total} total impressions (< ${R3_NEAR_ZERO_IMPRESSIONS}) — demand re-validation: demote or re-target`,
    };
  }
  return {
    fired: false,
    ruleId: "R3",
    reason: `R3 not fired: ${total} impressions over ${indexedWeeks} indexed weeks — demand evidenced`,
  };
}

// ---------------------------------------------------------------------------
// R4 — indexation alarm (G4 window)
// ---------------------------------------------------------------------------

/** G4 window for new domains (<R4_NEW_DOMAIN_MONTHS months): alarm after 16 weeks. */
export const R4_WINDOW_WEEKS_NEW_DOMAIN = 16;
/** G4 window for established domains: alarm after 8 weeks. */
export const R4_WINDOW_WEEKS_ESTABLISHED = 8;
/** Domain age (months) below which the longer new-domain window applies. */
export const R4_NEW_DOMAIN_MONTHS = 12;

/** R4 — published page unindexed past the G4 window → TECH_FIX. */
export function r4IndexationAlarm(
  pageAgeWeeks: number,
  indexed: boolean,
  domainAgeMonths: number
): SignalResult {
  const window =
    domainAgeMonths < R4_NEW_DOMAIN_MONTHS ? R4_WINDOW_WEEKS_NEW_DOMAIN : R4_WINDOW_WEEKS_ESTABLISHED;
  if (indexed) {
    return { fired: false, ruleId: "R4", reason: "R4 not fired: page is indexed" };
  }
  if (pageAgeWeeks > window) {
    return {
      fired: true,
      ruleId: "R4",
      reason: `R4 fires: page unindexed at ${pageAgeWeeks} weeks, past the ${window}-week G4 window (domain age ${domainAgeMonths} mo) — TECH_FIX: internal links, sitemap ping, crawl check`,
    };
  }
  return {
    fired: false,
    ruleId: "R4",
    reason: `R4 not fired: page unindexed at ${pageAgeWeeks} weeks, still within the ${window}-week G4 window (alarm suppressed)`,
  };
}

// ---------------------------------------------------------------------------
// R5 — organic won, pack lagging — v0.1 stub
// ---------------------------------------------------------------------------

// V05: fire when organic top-3 is won, pack lags, and the town sits within the
// empirical G2 radius → intensify pack levers (already wave-1 for WINNABLE_PACK).
export function r5PackLeverIntensify(
  organicTop3Won: boolean,
  packWon: boolean,
  withinG2Radius: boolean
): SignalResult {
  void organicTop3Won;
  void packWon;
  void withinG2Radius;
  return { fired: false, ruleId: "R5", reason: "R5 stub at v0.1 (needs goal-check history)" };
}

// ---------------------------------------------------------------------------
// R6 — review-velocity slope — v0.1 stub (ledger earns velocity over ~8 weeks)
// ---------------------------------------------------------------------------

// V05: fire when client review-velocity slope is negative vs incumbent; raise
// ask cadence within the smoothing cap; G11 binding → ESCALATION + re-score.
export function r6ReviewVelocity(
  clientLedger: ReviewLedgerRow[],
  incumbentLedger: ReviewLedgerRow[]
): SignalResult {
  void clientLedger;
  void incumbentLedger;
  return { fired: false, ruleId: "R6", reason: "R6 stub at v0.1 (review ledger not yet mature)" };
}

// ---------------------------------------------------------------------------
// R7 — cell top-3 changed — v0.1 stub
// ---------------------------------------------------------------------------

// V05: registry diff → M1 delta re-profile → M4 re-score for that cell only;
// suspected spam on the new entrant → SPAM_REPORT evidence task.
export function r7RegistryTop3Diff(previousPackTop3: string[], currentPackTop3: string[]): SignalResult {
  void previousPackTop3;
  void currentPackTop3;
  return { fired: false, ruleId: "R7", reason: "R7 stub at v0.1 (weekly registry diffing is v0.5 loop machinery)" };
}

// ---------------------------------------------------------------------------
// R8 — human task overdue ≥2 cycles — v0.1 stub
// ---------------------------------------------------------------------------

// V05: OVERDUE ≥2 cycles → ESCALATION; dependent cells downgraded with named
// cause (G12); intake throughput forecast re-printed against actuals.
export function r8OverdueEscalation(overdueCycles: number): SignalResult {
  void overdueCycles;
  return { fired: false, ruleId: "R8", reason: "R8 stub at v0.1 (escalation automation is v0.5)" };
}

// ---------------------------------------------------------------------------
// R9 — rank up, calls flat — v0.1 stub (no call-tracking data at v0.1)
// ---------------------------------------------------------------------------

// V05: needs call-tracking rows; KPI overrides rank — check CTR/snippet and
// the cell's LSA/furniture flags.
export function r9KpiOverride(rankTrendImproving: boolean, callsTrendFlat: boolean): SignalResult {
  void rankTrendImproving;
  void callsTrendFlat;
  return { fired: false, ruleId: "R9", reason: "R9 stub at v0.1 (call-tracking data unavailable)" };
}

// ---------------------------------------------------------------------------
// R10 — new proof asset unblocks a DEGRADED/BLOCKED page
// ---------------------------------------------------------------------------

/**
 * R10 — a new publishable proof job matching a DEGRADED or BLOCKED page's
 * town auto-queues the PAGE_BUILD/upgrade (the T-004→T-001 chain; no human
 * in the loop needed).
 */
export function r10ProofUnblock(job: ProofJob, pages: ArchitecturePage[]): SignalResult {
  if (!job.permission_to_publish) {
    return {
      fired: false,
      ruleId: "R10",
      reason: `R10 not fired: job ${job.job_id} lacks permission_to_publish`,
    };
  }
  const match = pages.find(
    (p) => p.url.includes(job.town) && (p.tier === "DEGRADED" || p.status === "BLOCKED")
  );
  if (match) {
    return {
      fired: true,
      ruleId: "R10",
      reason: `R10 fires: publishable job ${job.job_id} (${job.town}×${job.service_cluster}) matches ${match.status === "BLOCKED" ? "BLOCKED" : "DEGRADED"} page ${match.url} — auto-queue PAGE_BUILD/upgrade`,
    };
  }
  return {
    fired: false,
    ruleId: "R10",
    reason: `R10 not fired: no DEGRADED/BLOCKED page matches town ${job.town}`,
  };
}

// ---------------------------------------------------------------------------
// R11 — volatility freeze (cross-cell correlated movement, G16)
// ---------------------------------------------------------------------------

/** One cell's week-over-week rank movement; positive delta = rank worsened. */
export interface CellMovement {
  cell: Cell;
  positionDelta: number;
}

/** Minimum cells moving together before a freeze is considered. */
export const R11_MIN_CELLS = 4;
/** Minimum absolute per-cell movement (positions) that counts as movement. */
export const R11_MIN_ABS_DELTA = 2;
/** Share of observed cells that must move in the SAME direction. */
export const R11_CORRELATED_SHARE = 0.6;

/**
 * R11 — cross-cell correlated movement above threshold → G16 freeze:
 * suspend R1–R5 amendments, emit ONE "ESCALATION: probable algo update",
 * human decides when to resume. Uncorrelated (mixed-direction) movement of
 * the same magnitude never fires.
 */
export function r11VolatilityFreeze(movements: CellMovement[]): SignalResult {
  if (movements.length === 0) {
    return { fired: false, ruleId: "R11", reason: "R11 not fired: no cell movements observed" };
  }
  const down = movements.filter((m) => m.positionDelta >= R11_MIN_ABS_DELTA).length;
  const up = movements.filter((m) => m.positionDelta <= -R11_MIN_ABS_DELTA).length;
  const dominant = Math.max(down, up);
  const direction = down >= up ? "worsened" : "improved";
  const share = dominant / movements.length;
  if (dominant >= R11_MIN_CELLS && share >= R11_CORRELATED_SHARE) {
    return {
      fired: true,
      ruleId: "R11",
      reason: `R11 fires: ${dominant}/${movements.length} cells ${direction} by ≥${R11_MIN_ABS_DELTA} positions in the same direction (share ${(share * 100).toFixed(0)}% ≥ ${R11_CORRELATED_SHARE * 100}%) — G16 freeze: suspend R1–R5, one ESCALATION: probable algo update`,
    };
  }
  return {
    fired: false,
    ruleId: "R11",
    reason: `R11 not fired: correlated movement ${dominant}/${movements.length} cells (need ≥${R11_MIN_CELLS} and ≥${R11_CORRELATED_SHARE * 100}% same-direction)`,
  };
}

// ---------------------------------------------------------------------------
// R12 — GBP liveness (suspected suspension → hard stop)
// ---------------------------------------------------------------------------

/**
 * R12 — client profile absent from the latest snapshot = suspected
 * suspension → immediate ESCALATION + reinstatement runbook; every
 * LOCAL_PACK task pauses. A missing observation does NOT fire (absence of
 * data is not evidence of suspension), but it also never reads as healthy.
 */
export function r12GbpLiveness(latest: GbpLivenessRow | null): SignalResult {
  if (latest === null) {
    return {
      fired: false,
      ruleId: "R12",
      reason: "R12 not fired: no liveness observation on record (cannot confirm health either)",
    };
  }
  if (!latest.profileVisible) {
    return {
      fired: true,
      ruleId: "R12",
      reason: `R12 fires: profile absent from snapshot at ${latest.observedAt} — suspected suspension; hard stop, ESCALATION + reinstatement runbook, all LOCAL_PACK tasks paused`,
    };
  }
  return {
    fired: false,
    ruleId: "R12",
    reason: `R12 not fired: profile visible at ${latest.observedAt}`,
  };
}

// ---------------------------------------------------------------------------
// R13 — feed anomaly (quarantine)
// ---------------------------------------------------------------------------

/** Share of empty-pack pins above which a scan is anomalous. */
export const R13_EMPTY_PIN_SHARE = 0.3;

/**
 * R13 — feed anomaly: scan already QUARANTINED, no pins at all (schema
 * mismatch), or >R13_EMPTY_PIN_SHARE empty-pack pins → quarantine; win
 * clocks and trends unaffected; vendor-health flag raised.
 */
export function r13FeedAnomaly(scan: GeogridScan): SignalResult {
  if (scan.quality === "QUARANTINED") {
    return {
      fired: true,
      ruleId: "R13",
      reason: `R13 fires: scan ${scan.scanId} already quarantined (${scan.quarantineReason ?? "no reason recorded"})`,
    };
  }
  if (scan.pins.length === 0) {
    return {
      fired: true,
      ruleId: "R13",
      reason: `R13 fires: scan ${scan.scanId} has zero pins — schema mismatch / malformed feed; quarantine`,
    };
  }
  const empty = scan.pins.filter((p) => p.packBusinessIds.length === 0).length;
  const share = empty / scan.pins.length;
  if (share > R13_EMPTY_PIN_SHARE) {
    return {
      fired: true,
      ruleId: "R13",
      reason: `R13 fires: ${empty}/${scan.pins.length} pins (${(share * 100).toFixed(0)}%) returned an empty pack (> ${R13_EMPTY_PIN_SHARE * 100}%) — quarantine scan ${scan.scanId}; win clocks unaffected`,
    };
  }
  return {
    fired: false,
    ruleId: "R13",
    reason: `R13 not fired: ${empty}/${scan.pins.length} empty-pack pins within tolerance for scan ${scan.scanId}`,
  };
}
