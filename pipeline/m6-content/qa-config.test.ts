import { describe, expect, it } from "vitest";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { QaConfig } from "../../core/types.js";
import {
  DEFAULT_MAX_BOILERPLATE_RATIO,
  defaultQaConfig,
  loadQaConfig,
  mergeQaConfig,
  qaConfigSchema,
} from "./qa-config.js";
import { fixturePath } from "./test-support.js";

describe("qaConfigSchema", () => {
  it("parses into a value assignable to the core QaConfig type (compile-time check)", () => {
    const parsed: QaConfig = qaConfigSchema.parse({
      brandTerms: ["X"],
      vocabAllow: ["y"],
      bannedPhrases: ["z"],
      ignorePatterns: ["\\d+"],
      maxBoilerplateRatio: 0.2,
    });
    expect(parsed.brandTerms).toEqual(["X"]);
  });

  it("applies engine defaults for omitted fields", () => {
    const parsed = qaConfigSchema.parse({});
    expect(parsed).toEqual(defaultQaConfig());
    expect(parsed.maxBoilerplateRatio).toBe(DEFAULT_MAX_BOILERPLATE_RATIO);
  });

  it("rejects an out-of-range boilerplate cap", () => {
    expect(qaConfigSchema.safeParse({ maxBoilerplateRatio: 1.5 }).success).toBe(false);
  });
});

describe("loadQaConfig", () => {
  it("loads the client overlay fixtures", () => {
    const res = loadQaConfig(fixturePath("qa-config.crescent.json"));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.config.brandTerms).toContain("Crescent Electric");
      expect(res.config.bannedPhrases).toContain("Moscow shop");
    }
  });

  it("returns a domain failure (never throws) on unreadable or malformed input", () => {
    const missing = loadQaConfig(fixturePath("does-not-exist.json"));
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.errors.length).toBeGreaterThan(0);

    const dir = mkdtempSync(join(tmpdir(), "m6-qa-config-"));
    const bad = join(dir, "bad.json");
    writeFileSync(bad, "{ not json");
    expect(loadQaConfig(bad).ok).toBe(false);

    const wrongShape = join(dir, "wrong.json");
    writeFileSync(wrongShape, JSON.stringify({ brandTerms: "not-an-array" }));
    const res = loadQaConfig(wrongShape);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors[0]).toContain("brandTerms");
  });
});

describe("mergeQaConfig", () => {
  it("overlays client values onto engine defaults", () => {
    const merged = mergeQaConfig({ brandTerms: ["Acme"], maxBoilerplateRatio: 0.1 });
    expect(merged.brandTerms).toEqual(["Acme"]);
    expect(merged.maxBoilerplateRatio).toBe(0.1);
    expect(merged.bannedPhrases).toEqual([]);
  });
});
