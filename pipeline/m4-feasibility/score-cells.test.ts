import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  CellVerdict,
  ClientManifest,
  CompetitorRegistry,
  KeywordMap,
} from "../../core/types.js";
import { resolveClientReviewCount, scoreCells } from "./score-cells.js";

const FIXTURES = join(import.meta.dirname, "fixtures");
const load = <T>(name: string): T => JSON.parse(readFileSync(join(FIXTURES, name), "utf8")) as T;

const manifest = load<ClientManifest>("manifest.synthetic.json");
const waOnly = load<ClientManifest>("manifest.wa-only.json");
const registry = load<CompetitorRegistry>("registry.json");
const keywordMap = load<KeywordMap>("keyword-map.json");

const verdicts = scoreCells(manifest, registry, keywordMap);
const find = (vs: CellVerdict[], town: string, surface: CellVerdict["surface"]): CellVerdict => {
  const v = vs.find((x) => x.cell.town === town && x.cell.cluster === "panel" && x.surface === surface);
  if (!v) throw new Error(`no verdict for ${town}/${surface}`);
  return v;
};

describe("scoreCells — spec §4-M4 acceptance", () => {
  it("scores every town×cluster cell on both surfaces", () => {
    expect(verdicts).toHaveLength(4 * 1 * 2);
  });

  it("Spokane (95 min, no observed distant winners) → ORGANIC_ONLY citing G2, with the empirical distribution shown", () => {
    const v = find(verdicts, "spokane-wa", "LOCAL_PACK");
    expect(v.verdict).toBe("ORGANIC_ONLY");
    expect(v.firedRules).toContain("G2");
    const cited = v.assumptions.join(" ");
    expect(cited).toContain("observed winner distances");
    expect(cited).toContain("max 4.1 mi");
  });

  it("Colfax is NOT auto-demoted when the fixture shows 30-min SABs winning its pack", () => {
    const v = find(verdicts, "colfax-wa", "LOCAL_PACK");
    expect(v.verdict).not.toBe("ORGANIC_ONLY");
    expect(v.firedRules).not.toContain("G2");
    expect(v.verdict).toBe("WINNABLE_PACK");
    expect(v.assumptions.join(" ")).toContain("empirical");
  });

  it("a WA-only-license manifest makes every ID cell INFEASIBLE citing G15, on both surfaces", () => {
    const vs = scoreCells(waOnly, registry, keywordMap);
    for (const surface of ["LOCAL_PACK", "ORGANIC"] as const) {
      const v = find(vs, "moscow-id", surface);
      expect(v.verdict).toBe("INFEASIBLE");
      expect(v.firedRules).toContain("G15");
      expect(v.humanReviewed).toBe(false);
    }
    // WA towns are unaffected by the license change.
    expect(find(vs, "colfax-wa", "LOCAL_PACK").verdict).toBe("WINNABLE_PACK");
  });

  it("every verdict carries a band, a bucket, and at least one rule ID", () => {
    for (const v of verdicts) {
      expect(v.band.low).toBeGreaterThanOrEqual(0);
      expect(v.band.high).toBeGreaterThan(v.band.low);
      expect(v.band.high).toBeLessThanOrEqual(1);
      expect(v.band.label).toMatch(/^\d+-\d+%$/);
      expect(["<6mo", "6-12mo", "12mo+", "unknown"]).toContain(v.ttw);
      const ruleIds = new Set<string>(v.firedRules);
      for (const a of v.assumptions) {
        for (const m of a.match(/\bG\d{1,2}\b/g) ?? []) ruleIds.add(m);
      }
      expect(ruleIds.size).toBeGreaterThanOrEqual(1);
      expect(v.assumptions.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("pessimistic verdicts (INFEASIBLE / LONG_HORIZON) carry humanReviewed: false", () => {
    const pessimistic = verdicts.filter((v) => v.verdict === "INFEASIBLE" || v.verdict === "LONG_HORIZON");
    expect(pessimistic.length).toBeGreaterThan(0);
    for (const v of pessimistic) expect(v.humanReviewed).toBe(false);
  });

  it("G3 static count-gap verdicts are confidence LOW and cite the low-confidence mode", () => {
    const pullmanPack = find(verdicts, "pullman-wa", "LOCAL_PACK");
    expect(pullmanPack.verdict).toBe("LONG_HORIZON"); // 258/120 vs client 12
    expect(pullmanPack.firedRules).toContain("G3");
    expect(pullmanPack.confidence).toBe("LOW");
    expect(pullmanPack.assumptions.join(" ")).toContain("low-confidence static count-gap");
  });

  it("suspected-spam incumbents are scored as removable obstacles (excluded from the G3 gap)", () => {
    const pullmanPack = find(verdicts, "pullman-wa", "LOCAL_PACK");
    expect(pullmanPack.assumptions.join(" ")).toContain("removable obstacle");
  });

  it("LSA-heavy pack cells get a discounted band", () => {
    // Colfax (no LSA) is WINNABLE_PACK at the top band; a Pullman-style LSA cell
    // would sit one band lower — assert via Colfax vs a synthetic LSA registry.
    const colfax = find(verdicts, "colfax-wa", "LOCAL_PACK");
    expect(colfax.band.label).toBe("60-80%");
    const lsaRegistry: CompetitorRegistry = {
      businesses: registry.businesses,
      snapshots: registry.snapshots.map((s) =>
        s.cell.town === "colfax-wa"
          ? { ...s, furniture: { ...s.furniture, lsaPresent: true, adsCount: 3 } }
          : s
      ),
    };
    const lsaColfax = find(scoreCells(manifest, lsaRegistry, keywordMap), "colfax-wa", "LOCAL_PACK");
    expect(lsaColfax.verdict).toBe("WINNABLE_PACK");
    expect(lsaColfax.band.label).toBe("40-60%");
    expect(lsaColfax.assumptions.join(" ")).toContain("LSA present");
  });

  it("G5 fires for a cell with no keyword evidence (LONG_HORIZON, not silently scored)", () => {
    const noSpokane: KeywordMap = {
      clusters: [
        {
          clusterId: "panel",
          keywords: (keywordMap.clusters[0]?.keywords ?? []).filter((k) => k.town !== "colfax-wa"),
        },
      ],
      skipped: keywordMap.skipped,
    };
    const v = find(scoreCells(manifest, registry, noSpokane), "colfax-wa", "ORGANIC");
    expect(v.verdict).toBe("LONG_HORIZON");
    expect(v.firedRules).toContain("G5");
    expect(v.humanReviewed).toBe(false);
  });

  it("deterministic: same inputs produce identical outputs", () => {
    const again = scoreCells(manifest, registry, keywordMap);
    expect(JSON.stringify(again)).toBe(JSON.stringify(verdicts));
  });

  it("no raw months-to-close number appears in any output field (buckets only)", () => {
    const json = JSON.stringify(verdicts);
    expect(json).not.toMatch(/\d+\s*months?\b/i);
    expect(json).not.toMatch(/months_to_close|monthsToClose|ttwMonths/);
    for (const v of verdicts) {
      expect(["<6mo", "6-12mo", "12mo+", "unknown"]).toContain(v.ttw);
    }
  });

  it("resolves the client review count from the registry, never inventing one", () => {
    expect(resolveClientReviewCount(manifest, registry)).toBe(12);
    const noClient: CompetitorRegistry = {
      businesses: registry.businesses.filter((b) => b.businessId !== "b-client"),
      snapshots: registry.snapshots,
    };
    expect(resolveClientReviewCount(manifest, noClient)).toBe(0);
  });
});
