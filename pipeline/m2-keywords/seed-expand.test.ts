import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ClientManifest } from "../../core/types.js";
import { electricianProfile } from "../../rules/verticals/electrician.js";
import {
  expandSeedCandidates,
  expandSeeds,
  isEmergencyModifier,
  phraseContainsTerm,
  resolveVerticalProfile,
  GENERIC_INTENT_MODIFIERS,
} from "./seed-expand.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function loadCrescent(): ClientManifest {
  return JSON.parse(
    readFileSync(join(FIXTURES, "manifest.crescent.json"), "utf8")
  ) as ClientManifest;
}

describe("resolveVerticalProfile", () => {
  it("resolves the electrician profile from schema_type", () => {
    expect(resolveVerticalProfile(loadCrescent())).toBe(electricianProfile);
  });

  it("falls back to a generic profile for an unknown vertical", () => {
    const manifest = loadCrescent();
    manifest.business.entity.schema_type = "Plumber";
    const profile = resolveVerticalProfile(manifest);
    expect(profile.verticalId).toBe("plumber");
    expect(profile.intentModifiers).toEqual([...GENERIC_INTENT_MODIFIERS]);
    expect(profile.regulatedClaimTopics).toEqual([]);
  });
});

describe("expandSeeds", () => {
  it("produces clusters × towns × intent-modifier candidates", () => {
    const queries = expandSeeds(loadCrescent());
    expect(queries).toContain("electrical panel upgrades pullman");
    expect(queries).toContain("electrical panel upgrades cost pullman");
    expect(queries).toContain("ev charger installation moscow");
    // Town-less hub seeds exist too.
    expect(queries).toContain("electrical panel upgrades");
    expect(queries).toContain("electrical panel upgrades near me");
  });

  it("excludes every candidate containing a do_not_offer term", () => {
    const manifest = loadCrescent();
    const queries = expandSeeds(manifest);
    for (const q of queries) {
      expect(phraseContainsTerm(q, "solar installation")).toBe(false);
      expect(phraseContainsTerm(q, "hvac")).toBe(false);
      expect(phraseContainsTerm(q, "appliance repair")).toBe(false);
    }
  });

  it("drops a whole cluster whose label overlaps a do_not_offer term and records negatives", () => {
    const manifest = loadCrescent();
    manifest.services.clusters.push({
      cluster_id: "solar-cleaning",
      label: "Solar Panel Cleaning",
      capacity: true,
    });
    manifest.services.do_not_offer = ["solar"];
    const { candidates, negatives } = expandSeedCandidates(manifest);
    expect(candidates.some((c) => c.query.includes("solar"))).toBe(false);
    expect(candidates.some((c) => c.clusterId === "solar-cleaning")).toBe(false);
    expect(negatives.length).toBeGreaterThan(0);
    for (const n of negatives) {
      expect(n.query).toContain("solar");
      expect(n.reason).toContain("do_not_offer");
      expect(n.reason).toContain('"solar"');
    }
  });

  it("expands emergency modifiers only for clusters with emergency_offered", () => {
    const manifest = loadCrescent();
    // No Crescent cluster offers emergency service → zero emergency queries.
    const without = expandSeeds(manifest);
    expect(without.some((q) => phraseContainsTerm(q, "emergency"))).toBe(false);
    expect(without.some((q) => phraseContainsTerm(q, "24 hour"))).toBe(false);

    const panel = manifest.services.clusters.find((c) => c.cluster_id === "panel");
    expect(panel).toBeDefined();
    if (panel) panel.emergency_offered = true;
    const withEmergency = expandSeeds(manifest);
    expect(withEmergency).toContain("electrical panel upgrades emergency pullman");
    // Other clusters still get none.
    expect(
      withEmergency.some((q) => q.startsWith("ev charger installation emergency"))
    ).toBe(false);
  });

  it("skips clusters without capacity", () => {
    const manifest = loadCrescent();
    const hotTub = manifest.services.clusters.find((c) => c.cluster_id === "hot-tub");
    expect(hotTub).toBeDefined();
    if (hotTub) hotTub.capacity = false;
    const { candidates } = expandSeedCandidates(manifest);
    expect(candidates.some((c) => c.clusterId === "hot-tub")).toBe(false);
  });

  it("is deterministic and duplicate-free", () => {
    const a = expandSeeds(loadCrescent());
    const b = expandSeeds(loadCrescent());
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
  });

  it("attaches town slugs (not display names) to town-scoped candidates", () => {
    const { candidates } = expandSeedCandidates(loadCrescent());
    const head = candidates.find((c) => c.query === "electrical panel upgrades pullman");
    expect(head).toEqual({
      query: "electrical panel upgrades pullman",
      town: "pullman-wa",
      clusterId: "panel",
    });
  });
});

describe("isEmergencyModifier", () => {
  it("classifies emergency-flavored modifiers", () => {
    expect(isEmergencyModifier("emergency")).toBe(true);
    expect(isEmergencyModifier("24/7")).toBe(true);
    expect(isEmergencyModifier("after hours")).toBe(true);
    expect(isEmergencyModifier("installation")).toBe(false);
    expect(isEmergencyModifier("cost")).toBe(false);
  });
});
