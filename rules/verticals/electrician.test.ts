import { describe, expect, it } from "vitest";
import type { VerticalProfile } from "../../core/types.js";
import { ELECTRICIAN_EMERGENCY_MODIFIERS, electricianProfile } from "./electrician.js";

describe("electrician vertical profile", () => {
  it("is a valid VerticalProfile with the electrician schema type", () => {
    const p: VerticalProfile = electricianProfile; // compile-time conformance
    expect(p.verticalId).toBe("electrician");
    expect(p.schemaType).toBe("Electrician");
  });

  it("covers the regulated-claim patterns G8 depends on (permits, code, licensing, utilities)", () => {
    const topics = electricianProfile.regulatedClaimTopics.join(" ");
    expect(topics).toContain("permit");
    expect(topics).toContain("code");
    expect(topics).toContain("licensing");
    expect(topics).toContain("utility");
  });

  it("requires license-identity trust elements on every page", () => {
    const trust = electricianProfile.requiredTrustElements.join(" ");
    expect(trust).toContain("license number");
    expect(trust).toContain("insured");
    expect(trust).toContain("NAP");
  });

  it("carries emergency semantics in the intent modifiers, gated by emergency_offered", () => {
    for (const m of ELECTRICIAN_EMERGENCY_MODIFIERS) {
      expect(electricianProfile.intentModifiers).toContain(m);
    }
    expect(electricianProfile.prohibitions.join(" ")).toContain("emergency_offered");
  });

  it("defines a demand multiplier for all 12 months, centered near 1.0", () => {
    const months = Object.keys(electricianProfile.seasonality).map(Number).sort((a, b) => a - b);
    expect(months).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const values = Object.values(electricianProfile.seasonality);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    expect(mean).toBeGreaterThan(0.9);
    expect(mean).toBeLessThan(1.15);
    for (const v of values) expect(v).toBeGreaterThan(0);
  });

  it("prohibits DIY instructions and unlicensed-state advertising (G15 tie-in)", () => {
    const prohibitions = electricianProfile.prohibitions.join(" ");
    expect(prohibitions).toContain("DIY");
    expect(prohibitions).toContain("G15");
  });
});
