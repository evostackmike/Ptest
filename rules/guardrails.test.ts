import { describe, expect, it } from "vitest";
import type { CapacityRollup, Cell, KeywordEntry, LocalFact, ProofJob } from "../core/types.js";
import {
  G2_DRIVE_TIME_PRIOR_MIN,
  G2_MIN_OBSERVATIONS,
  G3_COUNT_GAP_RATIO,
  G6_MIN_PROOF_JOBS,
  G13_MIN_STRUCTURAL_EDIT_DAYS,
  G14_PUBLISH_RAMP,
  g2ProximityCeiling,
  g3ReviewRealism,
  g5DemandGate,
  g6ProofGate,
  g7CanonicalUrl,
  g8ClaimCheck,
  g11CapacityCeiling,
  g13GbpThrottle,
  g14CapFor,
  g14PublishPacing,
  g15Licensing,
} from "./guardrails.js";

const cell: Cell = { town: "colfax-wa", cluster: "panel" };

describe("G2 — empirical proximity ceiling", () => {
  it("does NOT fire for a 35-min town when the observed pack is won by 30-min SABs (empirical overrules the prior)", () => {
    const r = g2ProximityCeiling(cell, [24.5, 22.0, 27.5], 35);
    expect(r.ok).toBe(true);
    expect(r.ruleId).toBe("G2");
    expect(r.reason).toContain("empirical");
    // A pure drive-time prior WOULD have fired here — that is the point.
    expect(35).toBeGreaterThan(G2_DRIVE_TIME_PRIOR_MIN);
  });

  it("fires for a 95-min town whose observed winners are all local, and the reason shows the distribution", () => {
    const r = g2ProximityCeiling({ town: "spokane-wa", cluster: "panel" }, [2.4, 4.1, 1.8], 95);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("3 observed winner distances");
    expect(r.reason).toContain("max 4.1 mi");
  });

  it("falls back to the drive-time prior when observations are thin (<3)", () => {
    expect(G2_MIN_OBSERVATIONS).toBe(3);
    const thinFar = g2ProximityCeiling(cell, [24.5], 35);
    expect(thinFar.ok).toBe(false);
    expect(thinFar.reason).toContain("prior");
    const thinNear = g2ProximityCeiling(cell, [], 15);
    expect(thinNear.ok).toBe(true);
    expect(thinNear.reason).toContain("prior");
  });
});

describe("G3 — review realism (v0.1 static count-gap)", () => {
  it("fires on a large count gap pre-ledger and flags low confidence in reason AND result", () => {
    const r = g3ReviewRealism(12, [258, 120, 190], false);
    expect(r.ok).toBe(false);
    expect(r.lowConfidence).toBe(true);
    expect(r.reason).toContain("low-confidence static count-gap");
  });

  it("passes when the median gap is within the ratio", () => {
    const r = g3ReviewRealism(30, [40, 35, 18], false);
    expect(r.ok).toBe(true);
    expect(r.lowConfidence).toBe(true);
    expect(35 / 30).toBeLessThanOrEqual(G3_COUNT_GAP_RATIO);
  });

  it("passes with no observed top-3 counts (no gap to measure)", () => {
    const r = g3ReviewRealism(0, [], false);
    expect(r.ok).toBe(true);
    expect(r.lowConfidence).toBe(true);
  });
});

describe("G5 — demand gate", () => {
  const base: KeywordEntry = {
    query: "panel upgrade colfax",
    town: "colfax-wa",
    volume: null,
    marketExists: false,
    canonicalUrl: null,
  };
  it("passes on market existence even with null volume", () => {
    expect(g5DemandGate({ ...base, marketExists: true }).ok).toBe(true);
  });
  it("passes on real vendor volume without market observation", () => {
    expect(g5DemandGate({ ...base, volume: 50 }).ok).toBe(true);
  });
  it("fires when neither market nor real volume exists — null volume is never invented", () => {
    const r = g5DemandGate(base);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("volume=null");
  });
});

describe("G6 — proof gate", () => {
  const job = (id: string, publish: boolean, town = "colfax-wa"): ProofJob => ({
    job_id: id,
    town,
    service_cluster: "panel",
    date: "2026-05-01",
    photos: ["a.jpg"],
    description: "200A panel swap",
    permission_to_publish: publish,
  });
  it("passes with 2 publishable jobs for the cell", () => {
    expect(g6ProofGate(cell, [job("j1", true), job("j2", true)]).ok).toBe(true);
  });
  it("fires when jobs lack permission or belong to another town", () => {
    const r = g6ProofGate(cell, [job("j1", false), job("j2", true, "pullman-wa")]);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain(`0/${G6_MIN_PROOF_JOBS}`);
  });
});

describe("G7 — one canonical URL per intent", () => {
  it("passes with one owner and fires with two", () => {
    expect(g7CanonicalUrl("panel upgrade pullman", ["/services/panel/pullman-wa"]).ok).toBe(true);
    const r = g7CanonicalUrl("panel upgrade pullman", [
      "/services/panel/pullman-wa",
      "/locations/pullman-wa",
    ]);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("2 URLs");
  });
});

describe("G8 — claim substantiation", () => {
  const fact: LocalFact = {
    fact_id: "f-whitman-permit",
    claim: "Whitman County requires a permit for panel upgrades",
    source_url_or_owner_attestation: "https://whitmancounty.test/permits",
    verified_by: "owner",
    verified_date: "2026-06-01",
    towns: ["colfax-wa"],
    clusters: ["panel"],
  };
  it("resolves a matching claim to the verified fact", () => {
    const r = g8ClaimCheck("A permit is required for panel upgrades in Whitman County", cell, [fact]);
    expect(r.ok).toBe(true);
    expect(r.reason).toContain("f-whitman-permit");
  });
  it("fires when the fact does not apply to the cell", () => {
    const r = g8ClaimCheck("A permit is required for panel upgrades in Whitman County", { town: "pullman-wa", cluster: "panel" }, [fact]);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("write around");
  });
  it("fires on an unsubstantiated claim", () => {
    expect(g8ClaimCheck("Avista offers a rebate for EV charger installs", cell, [fact]).ok).toBe(false);
  });
});

describe("G11 — capacity ceiling", () => {
  const rollup = (planned: number, committed: number): CapacityRollup => ({
    committedMinutesPerMonth: committed,
    plannedHumanMinutes: planned,
    overflowMinutes: Math.max(0, planned - committed),
    ok: planned <= committed,
  });
  it("passes within capacity and fires on overflow", () => {
    expect(g11CapacityCeiling(rollup(200, 240)).ok).toBe(true);
    const r = g11CapacityCeiling(rollup(300, 240));
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("60");
  });
});

describe("G13 — GBP structural-edit throttle", () => {
  it("passes with no history", () => {
    expect(g13GbpThrottle(null, "2026-07-01T00:00:00Z").ok).toBe(true);
  });
  it("measures whole days: 6 days fires, 7 days passes", () => {
    expect(g13GbpThrottle("2026-07-01T00:00:00Z", "2026-07-07T23:00:00Z").ok).toBe(false);
    expect(g13GbpThrottle("2026-07-01T00:00:00Z", "2026-07-08T00:00:00Z").ok).toBe(true);
    expect(G13_MIN_STRUCTURAL_EDIT_DAYS).toBe(7);
  });
  it("fails closed on unparseable timestamps", () => {
    expect(g13GbpThrottle("not-a-date", "2026-07-08T00:00:00Z").ok).toBe(false);
  });
});

describe("G14 — publish pacing", () => {
  it("ramps the cap by domain age", () => {
    expect(g14CapFor(1)).toBe(2);
    expect(g14CapFor(4)).toBe(4);
    expect(g14CapFor(8)).toBe(6);
    expect(g14CapFor(24)).toBe(10);
    expect(G14_PUBLISH_RAMP.length).toBe(4);
  });
  it("fires above the cap for a young domain and passes for an old one", () => {
    expect(g14PublishPacing(2, 3).ok).toBe(false);
    expect(g14PublishPacing(24, 3).ok).toBe(true);
  });
});

describe("G15 — licensing compliance", () => {
  const licenses = [{ type: "electrical_contractor", number: "X1", state: "WA" }];
  it("passes for a covered state (case-insensitive)", () => {
    expect(g15Licensing("wa", licenses).ok).toBe(true);
  });
  it("fires for an uncovered state with an INFEASIBLE-grade reason", () => {
    const r = g15Licensing("ID", licenses);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("INFEASIBLE");
  });
  it("fails closed on an empty state", () => {
    expect(g15Licensing("  ", licenses).ok).toBe(false);
  });
});
