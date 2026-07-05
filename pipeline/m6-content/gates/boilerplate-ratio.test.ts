import { describe, expect, it } from "vitest";
import { boilerplateRatio, computeBoilerplateRatio } from "./boilerplate-ratio.js";
import {
  archPage,
  crescentIncumbents,
  crescentPages,
  crescentQaConfig,
  makeContext,
  samplePage,
} from "../test-support.js";
import type { GateContext } from "../../../core/types.js";

function contextFor(pageUrl: string): GateContext {
  const pages = crescentPages();
  return makeContext({
    pageUrl,
    tier: "DEGRADED",
    page: archPage(pageUrl, "DEGRADED"),
    siblings: pages.filter((p) => p.url !== pageUrl),
    incumbentTexts: crescentIncumbents(),
  });
}

describe("boilerplateRatio — regression proof on the reference client's REAL location copy", () => {
  const config = crescentQaConfig();

  it.each(crescentPages().map((p) => [p.url, p] as const))(
    "fails the real templated location page %s",
    (url, page) => {
      const failures = boilerplateRatio(page, contextFor(url), config);
      expect(failures.length).toBe(1);
      expect(failures[0].gate).toBe("boilerplate-ratio");
      expect(failures[0].message).toMatch(/shared-text ratio 0\.\d+ exceeds cap/);
    }
  );

  it("locale-token normalization drives the detection: town-swapped copy counts as shared", () => {
    const pages = crescentPages();
    const page = pages[0];
    const ctx = contextFor(page.url);
    const ratio = computeBoilerplateRatio(page, ctx);
    // Real templated pages sit far above the cap...
    expect(ratio).toBeGreaterThan(config.maxBoilerplateRatio);
    // ...and the ratio is deterministic.
    expect(computeBoilerplateRatio(page, ctx)).toBe(ratio);
  });

  it("passes the hand-written genuinely-local page against the same siblings", () => {
    const sample = samplePage();
    const ctx = makeContext({
      page: archPage(sample.url, "DEGRADED"),
      siblings: crescentPages(),
      incumbentTexts: crescentIncumbents(),
    });
    expect(boilerplateRatio(sample, ctx, config)).toEqual([]);
    expect(computeBoilerplateRatio(sample, ctx)).toBeLessThan(0.1);
  });

  it("no siblings → nothing to compare, no failures", () => {
    const sample = samplePage();
    const ctx = makeContext({ page: archPage(sample.url), siblings: [] });
    expect(boilerplateRatio(sample, ctx, config)).toEqual([]);
  });

  it("excludes the page itself when it appears in the sibling list", () => {
    const page = crescentPages()[0];
    const ctx = makeContext({ page: archPage(page.url), siblings: [page] });
    // Identical-to-self must not count as boilerplate.
    expect(boilerplateRatio(page, ctx, config)).toEqual([]);
  });
});
