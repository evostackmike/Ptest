import { describe, expect, it } from "vitest";
import type { ArchitecturePage, GeogridScan, GscMetricsRow, ProofJob } from "../core/types.js";
import {
  r1ContentDepth,
  r2CannibalFix,
  r3DemandRevalidate,
  r4IndexationAlarm,
  r5PackLeverIntensify,
  r6ReviewVelocity,
  r7RegistryTop3Diff,
  r8OverdueEscalation,
  r9KpiOverride,
  r10ProofUnblock,
  r11VolatilityFreeze,
  r12GbpLiveness,
  r13FeedAnomaly,
  type CellMovement,
} from "./signals-actions.js";

const row = (date: string, url: string, impressions: number, position: number): GscMetricsRow => ({
  date,
  query: "panel upgrade pullman",
  url,
  impressions,
  clicks: 0,
  position,
});

/** Six weekly dates, one week apart. */
const WEEK_DATES = ["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26", "2026-02-02", "2026-02-09"];
const A = "/services/panel/pullman-wa";
const B = "/locations/pullman-wa";

describe("R2 — cannibalization (flip-flop AND combined-position decay)", () => {
  it("NEVER fires on co-impressions alone (stable winner, stable positions)", () => {
    const rows = WEEK_DATES.flatMap((d) => [row(d, A, 100, 5), row(d, B, 30, 6)]);
    const r = r2CannibalFix(rows);
    expect(r.fired).toBe(false);
    expect(r.reason).toContain("co-impressions");
  });

  it("fires when the winner URL flip-flops AND combined position decays over ≥4 weeks", () => {
    const rows = WEEK_DATES.flatMap((d, i) => [
      row(d, A, i % 2 === 0 ? 100 : 20, 4 + i),
      row(d, B, i % 2 === 0 ? 20 : 100, 4 + i),
    ]);
    const r = r2CannibalFix(rows);
    expect(r.fired).toBe(true);
    expect(r.ruleId).toBe("R2");
    expect(r.reason).toContain("CANNIBAL_FIX");
  });

  it("does not fire on flip-flop without decay", () => {
    const rows = WEEK_DATES.flatMap((d, i) => [
      row(d, A, i % 2 === 0 ? 100 : 20, 5),
      row(d, B, i % 2 === 0 ? 20 : 100, 5),
    ]);
    expect(r2CannibalFix(rows).fired).toBe(false);
  });

  it("does not fire on decay without flip-flop (single stable winner)", () => {
    const rows = WEEK_DATES.flatMap((d, i) => [row(d, A, 100, 4 + i), row(d, B, 10, 4 + i)]);
    expect(r2CannibalFix(rows).fired).toBe(false);
  });

  it("does not fire below the 4-week observation window", () => {
    const rows = WEEK_DATES.slice(0, 3).flatMap((d, i) => [
      row(d, A, i % 2 === 0 ? 100 : 20, 4 + i * 3),
      row(d, B, i % 2 === 0 ? 20 : 100, 4 + i * 3),
    ]);
    const r = r2CannibalFix(rows);
    expect(r.fired).toBe(false);
    expect(r.reason).toContain("weeks");
  });

  it("does not fire for a single-URL query", () => {
    const rows = WEEK_DATES.map((d, i) => row(d, A, 50, 4 + i));
    expect(r2CannibalFix(rows).fired).toBe(false);
  });
});

describe("R3 — demand re-validation", () => {
  it("fires at 12+ indexed weeks with near-zero impressions", () => {
    const r = r3DemandRevalidate([row("2026-06-01", A, 2, 40)], 14);
    expect(r.fired).toBe(true);
    expect(r.reason).toContain("re-target");
  });
  it("does not fire before 12 weeks (too early)", () => {
    expect(r3DemandRevalidate([], 8).fired).toBe(false);
  });
  it("does not fire when impressions evidence demand", () => {
    expect(r3DemandRevalidate([row("2026-06-01", A, 500, 12)], 14).fired).toBe(false);
  });
});

describe("R4 — indexation alarm (G4 window)", () => {
  it("suppresses the alarm inside the 16-week window for a new domain", () => {
    const r = r4IndexationAlarm(10, false, 3);
    expect(r.fired).toBe(false);
    expect(r.reason).toContain("suppressed");
  });
  it("fires past 16 weeks on a new domain and past 8 weeks on an established one", () => {
    expect(r4IndexationAlarm(17, false, 3).fired).toBe(true);
    expect(r4IndexationAlarm(9, false, 24).fired).toBe(true);
    expect(r4IndexationAlarm(7, false, 24).fired).toBe(false);
  });
  it("never fires for an indexed page", () => {
    expect(r4IndexationAlarm(30, true, 3).fired).toBe(false);
  });
});

describe("R10 — proof unblock", () => {
  const job: ProofJob = {
    job_id: "j-colfax-1",
    town: "colfax-wa",
    service_cluster: "panel",
    date: "2026-06-15",
    photos: ["p.jpg"],
    description: "200A upgrade",
    permission_to_publish: true,
  };
  const page = (over: Partial<ArchitecturePage>): ArchitecturePage => ({
    url: "/services/panel/colfax-wa",
    pageType: "service-town",
    tier: "DEGRADED",
    targetQueries: ["panel upgrade colfax wa"],
    templateId: "service-town-v1",
    proofRefs: [],
    internalLinks: [],
    priority: 1,
    status: "PLANNED",
    ...over,
  });

  it("fires when a publishable job matches a DEGRADED page", () => {
    const r = r10ProofUnblock(job, [page({})]);
    expect(r.fired).toBe(true);
    expect(r.reason).toContain("j-colfax-1");
    expect(r.reason).toContain("PAGE_BUILD");
  });
  it("fires for a BLOCKED page even at FULL tier", () => {
    expect(r10ProofUnblock(job, [page({ tier: "FULL", status: "BLOCKED", blockReason: "G6" })]).fired).toBe(true);
  });
  it("does not fire without permission_to_publish", () => {
    expect(r10ProofUnblock({ ...job, permission_to_publish: false }, [page({})]).fired).toBe(false);
  });
  it("does not fire when no page matches the town", () => {
    expect(r10ProofUnblock(job, [page({ url: "/services/panel/pullman-wa" })]).fired).toBe(false);
  });
});

describe("R11 — volatility freeze (cross-cell correlated movement)", () => {
  const move = (town: string, delta: number): CellMovement => ({
    cell: { town, cluster: "panel" },
    positionDelta: delta,
  });

  it("fires when most cells move together in one direction", () => {
    const movements = [
      move("a", 3), move("b", 4), move("c", 2), move("d", 5), move("e", 3), move("f", 2),
      move("g", -1), move("h", 0),
    ];
    const r = r11VolatilityFreeze(movements);
    expect(r.fired).toBe(true);
    expect(r.reason).toContain("probable algo update");
    expect(r.reason).toContain("suspend R1–R5");
  });

  it("does not fire on uncorrelated (mixed-direction) movement of the same magnitude", () => {
    const movements = [
      move("a", 3), move("b", 4), move("c", 3), move("d", 2),
      move("e", -3), move("f", -4), move("g", -3), move("h", -2),
    ];
    expect(r11VolatilityFreeze(movements).fired).toBe(false);
  });

  it("does not fire below the minimum cell count", () => {
    expect(r11VolatilityFreeze([move("a", 5), move("b", 5), move("c", 5)]).fired).toBe(false);
  });

  it("does not fire with no observations", () => {
    expect(r11VolatilityFreeze([]).fired).toBe(false);
  });
});

describe("R12 — GBP liveness", () => {
  it("fires a hard stop when the profile is absent from the latest snapshot", () => {
    const r = r12GbpLiveness({ observedAt: "2026-07-01T00:00:00Z", profileVisible: false });
    expect(r.fired).toBe(true);
    expect(r.reason).toContain("suspected suspension");
    expect(r.reason).toContain("LOCAL_PACK tasks paused");
  });
  it("does not fire when visible, and missing data neither fires nor reads healthy", () => {
    expect(r12GbpLiveness({ observedAt: "2026-07-01T00:00:00Z", profileVisible: true }).fired).toBe(false);
    const none = r12GbpLiveness(null);
    expect(none.fired).toBe(false);
    expect(none.reason).toContain("cannot confirm health");
  });
});

describe("R13 — feed anomaly", () => {
  const scan = (emptyPins: number, totalPins: number, quality: GeogridScan["quality"] = "VALID"): GeogridScan => ({
    scanId: "s-1",
    cell: { town: "pullman-wa", cluster: "panel" },
    query: "panel upgrade pullman",
    scannedAt: "2026-07-01T00:00:00Z",
    quality,
    pins: Array.from({ length: totalPins }, (_, i) => ({
      pinId: `p${i}`,
      lat: 46.7,
      lng: -117.1,
      clientPackPosition: i < emptyPins ? null : 2,
      packBusinessIds: i < emptyPins ? [] : ["b-swift-electric"],
    })),
  });

  it("fires above 30% empty-pack pins", () => {
    const r = r13FeedAnomaly(scan(4, 10));
    expect(r.fired).toBe(true);
    expect(r.reason).toContain("win clocks unaffected");
  });
  it("does not fire within tolerance", () => {
    expect(r13FeedAnomaly(scan(2, 10)).fired).toBe(false);
  });
  it("fires on zero pins (schema mismatch) and on an already-quarantined scan", () => {
    expect(r13FeedAnomaly(scan(0, 0)).fired).toBe(true);
    expect(r13FeedAnomaly(scan(0, 10, "QUARANTINED")).fired).toBe(true);
  });
});

describe("v0.1 stubs (R1, R5–R9) never fire and carry their rule ids", () => {
  it("returns fired:false with the correct ruleId", () => {
    expect(r1ContentDepth([], 8)).toMatchObject({ fired: false, ruleId: "R1" });
    expect(r5PackLeverIntensify(true, false, true)).toMatchObject({ fired: false, ruleId: "R5" });
    expect(r6ReviewVelocity([], [])).toMatchObject({ fired: false, ruleId: "R6" });
    expect(r7RegistryTop3Diff(["a"], ["b"])).toMatchObject({ fired: false, ruleId: "R7" });
    expect(r8OverdueEscalation(3)).toMatchObject({ fired: false, ruleId: "R8" });
    expect(r9KpiOverride(true, true)).toMatchObject({ fired: false, ruleId: "R9" });
  });
});
