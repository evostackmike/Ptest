import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import type { ClientManifest } from "../core/types.js";
import { clientManifestSchema } from "./manifest.schema.js";
import { throughputForecast } from "./throughput-forecast.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const CRESCENT_PATH = join(HERE, "examples", "crescent-electric.manifest.json");

function crescent(hoursPerMonth?: number): ClientManifest {
  const raw = structuredClone(
    JSON.parse(readFileSync(CRESCENT_PATH, "utf8"))
  ) as Record<string, any>;
  if (hoursPerMonth !== undefined) {
    raw.owner_commitments.hours_per_month = hoursPerMonth;
  }
  return clientManifestSchema.parse(raw);
}

describe("throughputForecast", () => {
  it("covers every town × capacity-cluster cell (8 towns × 6 clusters = 48)", () => {
    const forecast = throughputForecast(crescent());
    expect(forecast.cells).toHaveLength(48);
    const keys = new Set(
      forecast.cells.map((c) => `${c.cell.town}|${c.cell.cluster}`)
    );
    expect(keys.size).toBe(48);
    expect(keys.has("moscow-id|panel")).toBe(true);
    expect(keys.has("spokane-wa|lighting")).toBe(true);
  });

  it("reports committed minutes = hours_per_month * 60", () => {
    expect(throughputForecast(crescent(4)).committedMinutesPerMonth).toBe(240);
    expect(throughputForecast(crescent(10)).committedMinutesPerMonth).toBe(600);
  });

  it("every stall probability is in [0, 1] and carries named drivers", () => {
    const forecast = throughputForecast(crescent());
    for (const cell of forecast.cells) {
      expect(cell.stallProbability).toBeGreaterThanOrEqual(0);
      expect(cell.stallProbability).toBeLessThanOrEqual(1);
      expect(cell.drivers.length).toBeGreaterThan(0);
    }
  });

  it("is strictly more pessimistic at 2 owner-hours/mo than at 10 (every loaded cell)", () => {
    const lean = throughputForecast(crescent(2));
    const rich = throughputForecast(crescent(10));
    const richByKey = new Map(
      rich.cells.map((c) => [`${c.cell.town}|${c.cell.cluster}`, c])
    );
    let compared = 0;
    for (const cell of lean.cells) {
      const other = richByKey.get(`${cell.cell.town}|${cell.cell.cluster}`)!;
      if (cell.stallProbability > 0) {
        expect(cell.stallProbability).toBeGreaterThan(other.stallProbability);
        compared++;
      } else {
        expect(other.stallProbability).toBe(0);
      }
    }
    expect(compared).toBeGreaterThan(0); // proof-less Crescent: all cells loaded
  });

  it("proof-less priority cells (moscow×panel) stall harder than proof-less non-priority ones (spokane×lighting)", () => {
    const forecast = throughputForecast(crescent());
    const byKey = new Map(
      forecast.cells.map((c) => [`${c.cell.town}|${c.cell.cluster}`, c])
    );
    const priority = byKey.get("moscow-id|panel")!;
    const outer = byKey.get("spokane-wa|lighting")!;
    expect(priority.stallProbability).toBeGreaterThan(outer.stallProbability);
    expect(priority.drivers.join(" ")).toMatch(/GBP/);
    expect(outer.drivers.join(" ")).not.toMatch(/GBP/);
  });

  it("a cell with 2 publishable proof jobs loses its PROOF_COLLECT demand", () => {
    const manifest = crescent();
    const withProof: ClientManifest = {
      ...manifest,
      proof_assets: {
        ...manifest.proof_assets,
        jobs: [1, 2].map((n) => ({
          job_id: `job-${n}`,
          town: "moscow-id",
          service_cluster: "panel",
          date: "2026-05-0" + n,
          photos: [`p${n}.jpg`],
          description: "200A panel swap",
          permission_to_publish: true,
        })),
      },
    };
    const forecast = throughputForecast(withProof);
    const cell = forecast.cells.find(
      (c) => c.cell.town === "moscow-id" && c.cell.cluster === "panel"
    )!;
    expect(cell.drivers.join(" ")).not.toMatch(/PROOF_COLLECT/);
    const baseline = throughputForecast(manifest).cells.find(
      (c) => c.cell.town === "moscow-id" && c.cell.cluster === "panel"
    )!;
    expect(cell.stallProbability).toBeLessThan(baseline.stallProbability);
  });

  it("jobs without permission_to_publish do not count toward G6 proof", () => {
    const manifest = crescent();
    const unpublishable: ClientManifest = {
      ...manifest,
      proof_assets: {
        ...manifest.proof_assets,
        jobs: [1, 2].map((n) => ({
          job_id: `job-${n}`,
          town: "moscow-id",
          service_cluster: "panel",
          date: "2026-05-0" + n,
          photos: [],
          description: "panel swap, no publish permission",
          permission_to_publish: false,
        })),
      },
    };
    const cell = throughputForecast(unpublishable).cells.find(
      (c) => c.cell.town === "moscow-id" && c.cell.cluster === "panel"
    )!;
    expect(cell.drivers.join(" ")).toMatch(/0\/2 publishable jobs/);
  });

  it("is deterministic: identical manifests produce identical forecasts", () => {
    const a = throughputForecast(crescent());
    const b = throughputForecast(crescent());
    expect(a).toEqual(b);
  });

  it("zero committed hours saturates every loaded cell toward stall (p = 1)", () => {
    const forecast = throughputForecast(crescent(0));
    expect(forecast.committedMinutesPerMonth).toBe(0);
    for (const cell of forecast.cells) {
      expect(cell.stallProbability).toBe(1); // demand / (demand + 0)
    }
  });
});
