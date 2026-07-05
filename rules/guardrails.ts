/**
 * rules/guardrails.ts — pure guardrail predicates (spec §6, G1–G16 subset).
 *
 * Every function is pure and total: no I/O, no clock, no throw.
 * `ok: true`  = the guardrail PASSES (does not block).
 * `ok: false` = the guardrail FIRES (blocks / demotes).
 *
 * Every threshold is a named exported constant so M4 / M8 cite the same
 * numbers (core/CONTRACTS.md §11).
 */

import type {
  Cell,
  CapacityRollup,
  GuardrailResult,
  KeywordEntry,
  License,
  LocalFact,
  ProofJob,
} from "../core/types.js";

// ---------------------------------------------------------------------------
// G2 — empirical proximity ceiling
// ---------------------------------------------------------------------------

/**
 * Minimum observed pack-winner distances required before the empirical
 * distribution is trusted; below this the drive-time prior applies.
 */
export const G2_MIN_OBSERVATIONS = 3;

/**
 * Margin applied on top of the observed max winner distance: the client's
 * implied distance may exceed the observed winner max by up to 25% before
 * the ceiling fires (pack radii are fuzzy; a hard equality would be false
 * precision, G12).
 */
export const G2_EMPIRICAL_MARGIN = 0.25;

/**
 * Rural-road conversion used to turn the manifest's drive_time_min into an
 * implied straight-line-ish distance comparable with facet distanceMiles
 * (≈45 mph average on the Palouse).
 */
export const G2_MILES_PER_DRIVE_MIN = 0.75;

/**
 * Drive-time PRIOR (minutes): used ONLY when the cell has fewer than
 * G2_MIN_OBSERVATIONS observed winner distances. Deliberately conservative —
 * the whole point of empirical G2 is that real rural packs routinely admit
 * 30-min SABs and the data must be allowed to overrule this constant.
 */
export const G2_DRIVE_TIME_PRIOR_MIN = 20;

/**
 * G2 — empirical pack-demotion radius.
 *
 * With ≥G2_MIN_OBSERVATIONS observed winner distances for the cell, the
 * ceiling is `max(observed) * (1 + G2_EMPIRICAL_MARGIN)`; the client's
 * implied distance (`driveTimeMin * G2_MILES_PER_DRIVE_MIN`) must not exceed
 * it. With thinner data the drive-time prior fires above
 * G2_DRIVE_TIME_PRIOR_MIN minutes.
 */
export function g2ProximityCeiling(
  cell: Cell,
  winnerDistancesMiles: number[],
  driveTimeMin: number
): GuardrailResult {
  const clientMiles = driveTimeMin * G2_MILES_PER_DRIVE_MIN;
  const observed = winnerDistancesMiles.filter((d) => Number.isFinite(d) && d >= 0);

  if (observed.length >= G2_MIN_OBSERVATIONS) {
    const maxObserved = Math.max(...observed);
    const ceiling = maxObserved * (1 + G2_EMPIRICAL_MARGIN);
    const dist = `${observed.length} observed winner distances for ${cell.town}×${cell.cluster}, max ${maxObserved.toFixed(1)} mi, empirical ceiling ${ceiling.toFixed(1)} mi`;
    if (clientMiles > ceiling) {
      return {
        ok: false,
        ruleId: "G2",
        reason: `G2 fires (empirical): client implied distance ${clientMiles.toFixed(1)} mi (drive ${driveTimeMin} min) exceeds ceiling — ${dist}`,
      };
    }
    return {
      ok: true,
      ruleId: "G2",
      reason: `G2 passes (empirical): client implied distance ${clientMiles.toFixed(1)} mi within ceiling — ${dist}`,
    };
  }

  // Thin data → drive-time prior only.
  if (driveTimeMin > G2_DRIVE_TIME_PRIOR_MIN) {
    return {
      ok: false,
      ruleId: "G2",
      reason: `G2 fires (prior, thin data: ${observed.length}/${G2_MIN_OBSERVATIONS} observations): drive time ${driveTimeMin} min exceeds ${G2_DRIVE_TIME_PRIOR_MIN}-min prior for ${cell.town}×${cell.cluster}`,
    };
  }
  return {
    ok: true,
    ruleId: "G2",
    reason: `G2 passes (prior, thin data: ${observed.length}/${G2_MIN_OBSERVATIONS} observations): drive time ${driveTimeMin} min within ${G2_DRIVE_TIME_PRIOR_MIN}-min prior`,
  };
}

// ---------------------------------------------------------------------------
// G3 — review realism (v0.1 static count-gap, explicitly low-confidence)
// ---------------------------------------------------------------------------

/**
 * v0.1 static count-gap trigger: fires when the top-3 median review count is
 * more than this multiple of the client's count. Pre-ledger this is the ONLY
 * available signal and it is always low-confidence.
 */
export const G3_COUNT_GAP_RATIO = 5;

/**
 * G3 — review realism.
 *
 * v0.1: static count-gap only. `ledgerMature: false` (the v0.1 reality) makes
 * the result carry `lowConfidence: true` and a reason containing
 * "low-confidence static count-gap".
 *
 * Return type is a strict subtype of GuardrailResult (assignable everywhere
 * a GuardrailResult is expected) with the explicit lowConfidence flag.
 */
// V05: replace count-gap with velocity delta, recency, review-text
// topicality and reply rate once the review ledger has ~8 weeks of history.
export function g3ReviewRealism(
  clientCount: number,
  top3Counts: number[],
  ledgerMature: boolean
): GuardrailResult & { lowConfidence: boolean } {
  const lowConfidence = !ledgerMature;
  const tag = lowConfidence ? "low-confidence static count-gap" : "static count-gap (ledger mature; velocity physics pending)";

  if (top3Counts.length === 0) {
    return {
      ok: true,
      ruleId: "G3",
      lowConfidence,
      reason: `G3 passes (${tag}): no top-3 review counts observed — no gap to measure`,
    };
  }
  const median = medianOf(top3Counts);
  const ratio = median / Math.max(clientCount, 1);
  const detail = `client ${clientCount} vs top-3 median ${median} (ratio ${ratio.toFixed(1)}, threshold ${G3_COUNT_GAP_RATIO})`;
  if (ratio > G3_COUNT_GAP_RATIO) {
    return {
      ok: false,
      ruleId: "G3",
      lowConfidence,
      reason: `G3 fires (${tag}): ${detail}`,
    };
  }
  return {
    ok: true,
    ruleId: "G3",
    lowConfidence,
    reason: `G3 passes (${tag}): ${detail}`,
  };
}

function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ---------------------------------------------------------------------------
// G5 — demand validation (market-existence gate)
// ---------------------------------------------------------------------------

/** Minimum REAL vendor volume that counts as demand evidence on its own. */
export const G5_MIN_REAL_VOLUME = 10;

/**
 * G5 — demand gate. Passes when the market observably exists (a pack renders
 * / incumbents maintain pages — `marketExists` from M1/M2) OR a real vendor
 * volume ≥ G5_MIN_REAL_VOLUME exists. `volume: null` is never treated as a
 * number. R3 remains the authoritative post-hoc demand test.
 */
export function g5DemandGate(entry: KeywordEntry): GuardrailResult {
  if (entry.marketExists) {
    return {
      ok: true,
      ruleId: "G5",
      reason: `G5 passes: market exists for "${entry.query}" (pack renders / incumbents maintain pages)`,
    };
  }
  if (entry.volume !== null && entry.volume >= G5_MIN_REAL_VOLUME) {
    return {
      ok: true,
      ruleId: "G5",
      reason: `G5 passes: real vendor volume ${entry.volume} ≥ ${G5_MIN_REAL_VOLUME} for "${entry.query}"`,
    };
  }
  return {
    ok: false,
    ruleId: "G5",
    reason: `G5 fires: no market evidence for "${entry.query}" (marketExists=false, volume=${entry.volume === null ? "null" : entry.volume})`,
  };
}

// ---------------------------------------------------------------------------
// G6 — anti-doorway proof gate
// ---------------------------------------------------------------------------

/** FULL tier needs at least this many publishable jobs per town×cluster. */
export const G6_MIN_PROOF_JOBS = 2;

/** G6 — proof gate: ≥2 permission_to_publish jobs for the cell's town×cluster. */
export function g6ProofGate(cell: Cell, jobs: ProofJob[]): GuardrailResult {
  const publishable = jobs.filter(
    (j) => j.town === cell.town && j.service_cluster === cell.cluster && j.permission_to_publish
  );
  if (publishable.length >= G6_MIN_PROOF_JOBS) {
    return {
      ok: true,
      ruleId: "G6",
      reason: `G6 passes: ${publishable.length}/${G6_MIN_PROOF_JOBS} publishable jobs for ${cell.town}×${cell.cluster}`,
    };
  }
  return {
    ok: false,
    ruleId: "G6",
    reason: `G6 fires: ${publishable.length}/${G6_MIN_PROOF_JOBS} publishable jobs for ${cell.town}×${cell.cluster} — FULL tier blocked (DEGRADED remains available)`,
  };
}

// ---------------------------------------------------------------------------
// G7 — one canonical URL per intent
// ---------------------------------------------------------------------------

/** G7 — fires when more than one URL claims the same query intent. */
export function g7CanonicalUrl(query: string, owningUrls: string[]): GuardrailResult {
  const distinct = [...new Set(owningUrls)];
  if (distinct.length <= 1) {
    return {
      ok: true,
      ruleId: "G7",
      reason: `G7 passes: "${query}" owned by ${distinct.length === 1 ? distinct[0] : "no URL yet"}`,
    };
  }
  return {
    ok: false,
    ruleId: "G7",
    reason: `G7 fires: "${query}" claimed by ${distinct.length} URLs (${distinct.join(", ")}) — resolve to one canonical owner`,
  };
}

// ---------------------------------------------------------------------------
// G8 — no unsubstantiated claims
// ---------------------------------------------------------------------------

/** Minimum significant-token overlap for a claim to resolve to a local_fact. */
export const G8_MIN_TOKEN_OVERLAP = 0.5;

/**
 * G8 — a regulatory/local-factual claim must resolve to a verified
 * `local_facts` entry applicable to the cell (empty towns/clusters = all).
 * v0.1 matching heuristic: normalized containment or significant-token
 * overlap ≥ G8_MIN_TOKEN_OVERLAP.
 */
// V05: upgrade matching to entity-level (permit types, utility names) once
// local_facts carries structured fields.
export function g8ClaimCheck(claim: string, cell: Cell, facts: LocalFact[]): GuardrailResult {
  const applicable = facts.filter(
    (f) =>
      (f.towns.length === 0 || f.towns.includes(cell.town)) &&
      (f.clusters.length === 0 || f.clusters.includes(cell.cluster))
  );
  const match = applicable.find((f) => claimsMatch(claim, f.claim));
  if (match) {
    return {
      ok: true,
      ruleId: "G8",
      reason: `G8 passes: claim resolves to local_facts ${match.fact_id} (verified ${match.verified_date} by ${match.verified_by})`,
    };
  }
  return {
    ok: false,
    ruleId: "G8",
    reason: `G8 fires: no verified local_facts entry for ${cell.town}×${cell.cluster} substantiates "${claim}" — write around the topic`,
  };
}

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function claimsMatch(claim: string, factClaim: string): boolean {
  const a = normalizeText(claim);
  const b = normalizeText(factClaim);
  if (a.length === 0 || b.length === 0) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const tokens = (s: string) => new Set(s.split(" ").filter((t) => t.length > 3));
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.min(ta.size, tb.size) >= G8_MIN_TOKEN_OVERLAP;
}

// ---------------------------------------------------------------------------
// G11 — owner-capacity ceiling
// ---------------------------------------------------------------------------

/**
 * G11 — fires when planned human minutes exceed committed capacity.
 * Overflow must surface as an honest ESCALATION at planning time (M8),
 * never as silently over-emitted work.
 */
export function g11CapacityCeiling(rollup: CapacityRollup): GuardrailResult {
  if (rollup.overflowMinutes <= 0) {
    return {
      ok: true,
      ruleId: "G11",
      reason: `G11 passes: ${rollup.plannedHumanMinutes} planned human minutes within ${rollup.committedMinutesPerMonth} committed minutes/month`,
    };
  }
  return {
    ok: false,
    ruleId: "G11",
    reason: `G11 fires: ${rollup.plannedHumanMinutes} planned human minutes exceed ${rollup.committedMinutesPerMonth} committed minutes/month by ${rollup.overflowMinutes} — escalate, do not over-emit`,
  };
}

// ---------------------------------------------------------------------------
// G13 — GBP edit safety (structural-edit spacing)
// ---------------------------------------------------------------------------

/** Minimum whole days between structural GBP edits (spec: 7–14-day window). */
export const G13_MIN_STRUCTURAL_EDIT_DAYS = 7;

/**
 * G13 — GBP structural-edit throttle. Measures whole days between the
 * caller-supplied timestamps; a null history passes (first edit).
 */
export function g13GbpThrottle(
  lastStructuralEditAt: string | null,
  proposedAt: string,
  minDays: number = G13_MIN_STRUCTURAL_EDIT_DAYS
): GuardrailResult {
  if (lastStructuralEditAt === null) {
    return {
      ok: true,
      ruleId: "G13",
      reason: `G13 passes: no prior structural edit on record`,
    };
  }
  const last = Date.parse(lastStructuralEditAt);
  const proposed = Date.parse(proposedAt);
  if (Number.isNaN(last) || Number.isNaN(proposed)) {
    return {
      ok: false,
      ruleId: "G13",
      reason: `G13 fires: unparseable timestamp (last=${lastStructuralEditAt}, proposed=${proposedAt}) — fail closed`,
    };
  }
  const wholeDays = Math.floor((proposed - last) / 86_400_000);
  if (wholeDays >= minDays) {
    return {
      ok: true,
      ruleId: "G13",
      reason: `G13 passes: ${wholeDays} whole days since last structural edit (min ${minDays})`,
    };
  }
  return {
    ok: false,
    ruleId: "G13",
    reason: `G13 fires: only ${wholeDays} whole days since last structural edit (min ${minDays})`,
  };
}

// ---------------------------------------------------------------------------
// G14 — publish pacing / scaled-content defense
// ---------------------------------------------------------------------------

/**
 * Pages-per-week caps ramped by domain age (months). Evaluated in order;
 * the first row whose maxDomainAgeMonths exceeds the domain age applies.
 */
export const G14_PUBLISH_RAMP: readonly { maxDomainAgeMonths: number; pagesPerWeekCap: number }[] = [
  { maxDomainAgeMonths: 3, pagesPerWeekCap: 2 },
  { maxDomainAgeMonths: 6, pagesPerWeekCap: 4 },
  { maxDomainAgeMonths: 12, pagesPerWeekCap: 6 },
  { maxDomainAgeMonths: Number.POSITIVE_INFINITY, pagesPerWeekCap: 10 },
];

/** Resolve the applicable pages-per-week cap for a domain age. */
export function g14CapFor(domainAgeMonths: number): number {
  const row = G14_PUBLISH_RAMP.find((r) => domainAgeMonths < r.maxDomainAgeMonths);
  return (row ?? G14_PUBLISH_RAMP[G14_PUBLISH_RAMP.length - 1]).pagesPerWeekCap;
}

/** G14 — publish-pacing cap for the domain's age band. */
export function g14PublishPacing(domainAgeMonths: number, pagesThisWeek: number): GuardrailResult {
  const cap = g14CapFor(domainAgeMonths);
  if (pagesThisWeek <= cap) {
    return {
      ok: true,
      ruleId: "G14",
      reason: `G14 passes: ${pagesThisWeek} pages this week within cap ${cap} for a ${domainAgeMonths}-month-old domain`,
    };
  }
  return {
    ok: false,
    ruleId: "G14",
    reason: `G14 fires: ${pagesThisWeek} pages this week exceed cap ${cap} for a ${domainAgeMonths}-month-old domain`,
  };
}

// ---------------------------------------------------------------------------
// G15 — licensing compliance
// ---------------------------------------------------------------------------

/**
 * G15 — the town's state must be covered by a manifest license entry.
 * Fires (→ INFEASIBLE in M4) when no license covers the state. Compliance is
 * absolute: G15 is evaluated before any other scoring.
 */
export function g15Licensing(townState: string, licenses: License[]): GuardrailResult {
  const state = townState.trim().toUpperCase();
  if (state.length === 0) {
    return {
      ok: false,
      ruleId: "G15",
      reason: `G15 fires: town state is unknown — fail closed until the manifest resolves it`,
    };
  }
  const covering = licenses.filter((l) => l.state.trim().toUpperCase() === state);
  if (covering.length > 0) {
    return {
      ok: true,
      ruleId: "G15",
      reason: `G15 passes: ${state} covered by license ${covering[0].type} #${covering[0].number}`,
    };
  }
  return {
    ok: false,
    ruleId: "G15",
    reason: `G15 fires: no manifest license covers state ${state} — cell is INFEASIBLE on compliance grounds`,
  };
}
