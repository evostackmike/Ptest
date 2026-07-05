import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ClientManifest, Town } from "../../core/types.js";
import { checkCompliance, townState } from "./compliance.js";

const FIXTURES = join(import.meta.dirname, "fixtures");
const manifest = JSON.parse(readFileSync(join(FIXTURES, "manifest.synthetic.json"), "utf8")) as ClientManifest;
const waOnly = JSON.parse(readFileSync(join(FIXTURES, "manifest.wa-only.json"), "utf8")) as ClientManifest;

const town = (slug: string, name: string): Town => ({ slug, name, drive_time_min: 20 });

describe("townState derivation", () => {
  it("derives the state from the slug suffix", () => {
    expect(townState(town("pullman-wa", "Pullman, WA"))).toBe("WA");
    expect(townState(town("moscow-id", "Moscow, ID"))).toBe("ID");
  });
  it("falls back to the display-name suffix when the slug has no state", () => {
    expect(townState(town("pullman", "Pullman, WA"))).toBe("WA");
  });
  it("returns null when neither convention yields a state", () => {
    expect(townState(town("pullman", "Pullman"))).toBeNull();
  });
});

describe("checkCompliance (G15)", () => {
  it("passes towns in licensed states", () => {
    expect(checkCompliance(town("pullman-wa", "Pullman, WA"), manifest).ok).toBe(true);
    expect(checkCompliance(town("moscow-id", "Moscow, ID"), manifest).ok).toBe(true);
  });
  it("fires for a town in an unlicensed state, citing G15", () => {
    const r = checkCompliance(town("moscow-id", "Moscow, ID"), waOnly);
    expect(r.ok).toBe(false);
    expect(r.ruleId).toBe("G15");
    expect(r.reason).toContain("ID");
  });
  it("fails closed when the state cannot be determined", () => {
    const r = checkCompliance(town("pullman", "Pullman"), manifest);
    expect(r.ok).toBe(false);
    expect(r.ruleId).toBe("G15");
    expect(r.reason).toContain("fail closed");
  });
});
