import { describe, expect, it } from "vitest";
import { draftToPageContent, generatePage, runGates, stripMarkdown } from "./generate-page.js";
import type { DraftedPage } from "./generate-page.js";
import {
  archPage,
  crescentIncumbents,
  crescentPages,
  crescentQaConfig,
  makeContext,
  makePage,
  plumbingManifest,
  plumbingPage,
  plumbingQaConfig,
  samplePage,
} from "./test-support.js";
import type { GateContext } from "../../core/types.js";

function fullCrescentContext(pageUrl: string, tier: "FULL" | "DEGRADED"): GateContext {
  return makeContext({
    page: archPage(pageUrl, tier),
    siblings: crescentPages().filter((p) => p.url !== pageUrl),
    incumbentTexts: crescentIncumbents(),
  });
}

describe("runGates — aggregation (CONTRACTS §7)", () => {
  it("REGRESSION PROOF: the reference client's real location page fails, citing boilerplate + info-gain", () => {
    const page = crescentPages()[0]!;
    const report = runGates(page, fullCrescentContext(page.url, "DEGRADED"), crescentQaConfig());
    expect(report.pass).toBe(false);
    const gates = new Set(report.failures.map((f) => f.gate));
    expect(gates.has("boilerplate-ratio")).toBe(true);
    expect(gates.has("info-gain")).toBe(true);
  });

  it("every real location page in the regression corpus fails the gate run", () => {
    for (const page of crescentPages()) {
      const report = runGates(page, fullCrescentContext(page.url, "DEGRADED"), crescentQaConfig());
      expect(report.pass, page.url).toBe(false);
    }
  });

  it("the hand-written genuinely-local sample passes ALL gates against the same context", () => {
    const sample = samplePage();
    const report = runGates(sample, fullCrescentContext(sample.url, "DEGRADED"), crescentQaConfig());
    expect(report.failures).toEqual([]);
    expect(report.pass).toBe(true);
  });

  it("merges manifest brand_constraints.banned_phrases into the copy-qa run", () => {
    const page = makePage({ body: "Fast, cheap panel swaps around town." });
    const ctx = makeContext({ page: archPage(page.url) });
    const report = runGates(page, ctx, crescentQaConfig());
    expect(
      report.failures.some((f) => f.gate === "copy-qa" && f.message.includes('banned phrase "cheap"'))
    ).toBe(true);
  });

  it("de-Crescenting proof: the plumbing client's page passes the full run with zero code edits", () => {
    const ctx: GateContext = {
      manifest: plumbingManifest(),
      page: archPage("/services/drain-cleaning/riverton-or", "FULL"),
      siblings: [],
      incumbentTexts: [],
    };
    const report = runGates(plumbingPage(), ctx, plumbingQaConfig());
    expect(report.failures).toEqual([]);
    expect(report.pass).toBe(true);
  });
});

describe("draft assembly", () => {
  it("stripMarkdown removes headings, emphasis, links, and list markers", () => {
    const md = "## Panel work\nWe **replace** the [panel](/services/panel) and:\n- label circuits\n1. torque lugs";
    const out = stripMarkdown(md);
    expect(out).not.toMatch(/[#*[\]()]/);
    expect(out).toContain("Panel work");
    expect(out).toContain("We replace the panel");
    expect(out).toContain("label circuits");
  });

  it("draftToPageContent joins sections (headings included) into rendered plain text", () => {
    const draft: DraftedPage = {
      url: "/services/x/town",
      title: "T",
      metaDescription: "M",
      sections: [
        { heading: "# Hero", text: "First paragraph." },
        { text: "Second paragraph, no heading." },
      ],
      faq: [{ q: "Q?", a: "A." }],
    };
    const page = draftToPageContent(draft);
    expect(page.body).toBe("Hero\nFirst paragraph.\nSecond paragraph, no heading.");
    expect(page.faq).toEqual(draft.faq);
  });

  it("generatePage runs the assembled draft through every gate", () => {
    const sample = samplePage();
    const draft: DraftedPage = {
      url: sample.url,
      title: sample.title,
      metaDescription: sample.metaDescription,
      sections: sample.body.split("\n").map((text) => ({ text })),
      faq: sample.faq,
    };
    const { page, report } = generatePage(
      draft,
      fullCrescentContext(sample.url, "DEGRADED"),
      crescentQaConfig()
    );
    expect(page.body).toBe(sample.body);
    expect(report.pass).toBe(true);
  });
});
