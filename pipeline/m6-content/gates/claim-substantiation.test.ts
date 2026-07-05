import { describe, expect, it } from "vitest";
import { cellFromUrl, claimSubstantiation } from "./claim-substantiation.js";
import {
  archPage,
  crescentManifest,
  makeContext,
  makePage,
  samplePage,
} from "../test-support.js";

describe("claimSubstantiation — superlatives (G8)", () => {
  it("fails an 'award-winning' claim when proof_assets.awards is empty, citing the sentence", () => {
    const sentence = "Our award-winning crew rewires older homes around the county.";
    const page = makePage({ body: sentence });
    const failures = claimSubstantiation(page, makeContext());
    const hit = failures.find((f) => f.message.includes("award-winning"));
    expect(hit).toBeDefined();
    expect(hit!.ruleId).toBe("G8");
    expect(hit!.message).toContain(sentence);
  });

  it("passes 'award-winning' when the manifest carries an award", () => {
    const manifest = crescentManifest();
    manifest.proof_assets.awards = ["2025 regional trade award"];
    const page = makePage({ body: "Our award-winning crew rewires older homes." });
    expect(claimSubstantiation(page, makeContext({ manifest }))).toEqual([]);
  });

  it("always fails hard superlatives with no v0.1 evidence path (#1, best X in Y)", () => {
    const page = makePage({ body: "We are the best electrician in the region, truly #1." });
    const failures = claimSubstantiation(page, makeContext());
    expect(failures.length).toBeGreaterThanOrEqual(1);
    expect(failures.every((f) => f.ruleId === "G8")).toBe(true);
  });

  it("fails certification claims with empty proof_assets.certifications and passes with one", () => {
    const page = makePage({ body: "Our generator-certified installers handle the changeover." });
    expect(claimSubstantiation(page, makeContext()).length).toBe(1);
    const manifest = crescentManifest();
    manifest.proof_assets.certifications = ["Generator brand certified installer"];
    expect(claimSubstantiation(page, makeContext({ manifest }))).toEqual([]);
  });
});

describe("claimSubstantiation — regulatory/local-factual claims (permit/code/utility)", () => {
  it("blocks a permit claim with no in-scope local_facts ref, citing the offending sentence", () => {
    const sentence =
      "Latah County requires an electrical permit for generator transfer switch installs.";
    const page = makePage({ url: "/services/generator/troy-id", body: sentence });
    const ctx = makeContext({ page: archPage("/services/generator/troy-id") });
    const failures = claimSubstantiation(page, ctx);
    expect(failures.length).toBe(1);
    expect(failures[0]!.message).toContain(sentence);
    expect(failures[0]!.message).toContain("write around the topic");
  });

  it("passes a permit-fee claim that resolves to an in-scope local_facts entry", () => {
    const sentence =
      "The Whitman County electrical permit for a panel changeout runs $95–$140.";
    const page = makePage({ url: "/services/panel-upgrades/palouse-wa", body: sentence });
    const ctx = makeContext({ page: archPage("/services/panel-upgrades/palouse-wa") });
    expect(claimSubstantiation(page, ctx)).toEqual([]);
  });

  it("a fact scoped to other towns does NOT substantiate the claim elsewhere", () => {
    // The permit-fee fact covers Whitman-county towns; the same sentence on a
    // different town's page must fail.
    const sentence = "The county electrical permit for a panel changeout runs $95–$140.";
    const page = makePage({ url: "/services/panel-upgrades/lewiston-id", body: sentence });
    const ctx = makeContext({ page: archPage("/services/panel-upgrades/lewiston-id") });
    const failures = claimSubstantiation(page, ctx);
    expect(failures.length).toBe(1);
    expect(failures[0]!.message).toContain("does not resolve");
  });
});

describe("claimSubstantiation — numeric claims", () => {
  it("fails a volume claim whose number no in-scope fact carries (word overlap is not enough)", () => {
    const sentence = "We have handled more than 300 panel changeouts across Whitman County.";
    const page = makePage({ url: "/services/panel-upgrades/palouse-wa", body: sentence });
    const ctx = makeContext({ page: archPage("/services/panel-upgrades/palouse-wa") });
    const failures = claimSubstantiation(page, ctx);
    expect(failures.some((f) => f.message.includes("numeric claim"))).toBe(true);
  });

  it("passes a numeric claim when a fact carries the same number", () => {
    const manifest = crescentManifest();
    manifest.local_facts.push({
      fact_id: "lf-outage-days",
      claim: "The utility reported more than 300 outage hours in the county last winter",
      source_url_or_owner_attestation: "owner attestation",
      verified_by: "owner",
      verified_date: "2026-05-02",
      towns: [],
      clusters: [],
    });
    const page = makePage({
      url: "/services/generator/palouse-wa",
      body: "The county logged more than 300 outage hours last winter.",
    });
    const ctx = makeContext({ manifest, page: archPage("/services/generator/palouse-wa") });
    expect(claimSubstantiation(page, ctx)).toEqual([]);
  });

  it("does not treat technical spec numbers (200-amp, 240-volt) as claims", () => {
    const page = makePage({
      url: "/services/panel-upgrades/palouse-wa",
      body: "A 200-amp panel with a 240-volt circuit covers most homes.",
    });
    const ctx = makeContext({ page: archPage("/services/panel-upgrades/palouse-wa") });
    expect(claimSubstantiation(page, ctx)).toEqual([]);
  });
});

describe("claimSubstantiation — DEGRADED tier proof-dependent claims", () => {
  const body = "Ask about the panel jobs we've done in town this spring.";

  it("fails proof-dependent claims on a DEGRADED page", () => {
    const page = makePage({ body });
    const ctx = makeContext({ page: archPage("/locations/palouse-wa", "DEGRADED") });
    const failures = claimSubstantiation(page, ctx);
    expect(failures.length).toBe(1);
    expect(failures[0]!.message).toContain("DEGRADED");
    expect(failures[0]!.message).toContain(body);
  });

  it("allows the same sentence on a FULL-tier page (proof exists)", () => {
    const page = makePage({ body });
    const ctx = makeContext({ page: archPage("/locations/palouse-wa", "FULL") });
    expect(claimSubstantiation(page, ctx)).toEqual([]);
  });
});

describe("claimSubstantiation — end-to-end on the hand-written local page", () => {
  it("the genuinely-local sample page passes (every claim resolves)", () => {
    const sample = samplePage();
    const ctx = makeContext({ page: archPage(sample.url, "DEGRADED") });
    expect(claimSubstantiation(sample, ctx)).toEqual([]);
  });
});

describe("cellFromUrl", () => {
  it("derives town slug and cluster id from canonical URL segments", () => {
    const manifest = crescentManifest();
    expect(cellFromUrl("/services/panel-upgrades/palouse-wa", manifest)).toEqual({
      town: "palouse-wa",
      cluster: "panel",
    });
    expect(cellFromUrl("/locations/troy-id", manifest)).toEqual({
      town: "troy-id",
      cluster: null,
    });
    expect(cellFromUrl("/about", manifest)).toEqual({ town: null, cluster: null });
  });
});
