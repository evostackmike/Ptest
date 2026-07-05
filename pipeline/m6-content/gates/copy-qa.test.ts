import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { copyQa, DEFAULT_COPY_RULES, MAX_TRIGRAM_REPEATS } from "./copy-qa.js";
import { defaultQaConfig } from "../qa-config.js";
import {
  crescentQaConfig,
  plumbingPage,
  plumbingQaConfig,
  makePage,
} from "../test-support.js";

const cfg = defaultQaConfig;

describe("copyQa — generic slop rules (ported ai.* defaults)", () => {
  it("ships the 14 generic ai.* rules as engine defaults", () => {
    expect(DEFAULT_COPY_RULES.filter((r) => r.id.startsWith("ai.")).length).toBe(14);
  });

  it("fails 'all your electrical needs' filler (error rule)", () => {
    const page = makePage({ body: "We handle all of your electrical needs quickly." });
    const failures = copyQa(page, cfg());
    expect(failures.some((f) => f.message.includes("ai.all-your-needs"))).toBe(true);
  });

  it("fails warn-level slop like 'seamless' and 'peace of mind'", () => {
    const page = makePage({
      body: "A seamless install gives you peace of mind every time.",
    });
    const messages = copyQa(page, cfg()).map((f) => f.message);
    expect(messages.some((m) => m.includes("ai.seamless"))).toBe(true);
    expect(messages.some((m) => m.includes("ai.peace-of-mind"))).toBe(true);
  });

  it("does not fail info-severity words at v0.1 (advisory only)", () => {
    const page = makePage({ body: "A trusted crew can ensure the vital work gets done." });
    const messages = copyQa(page, cfg()).map((f) => f.message);
    expect(messages.some((m) => m.includes("ai.trusted-reliable"))).toBe(false);
    expect(messages.some((m) => m.includes("ai.ensure"))).toBe(false);
  });

  it("fails unsupported superlatives (#1, top-rated)", () => {
    const page = makePage({ body: "We are the #1 crew in town, top-rated by everyone." });
    const messages = copyQa(page, cfg()).map((f) => f.message);
    expect(messages.some((m) => m.includes("generic.no-proof-superlative"))).toBe(true);
  });
});

describe("copyQa — config-driven client vocabulary", () => {
  it("fails client banned phrases supplied via QaConfig only", () => {
    const page = makePage({ body: "Visit the Moscow shop for a quote on panel work." });
    // Generic defaults know nothing about this client phrase:
    expect(copyQa(page, cfg()).some((f) => f.message.includes("banned phrase"))).toBe(false);
    // The client overlay (fixture, zero code edits) bans it:
    const failures = copyQa(page, crescentQaConfig());
    expect(failures.some((f) => f.message.includes('banned phrase "Moscow shop"'))).toBe(true);
  });

  it("strips ignorePatterns before scanning", () => {
    const config = { ...cfg(), bannedPhrases: ["LEGALTEXT"], ignorePatterns: ["LEGALTEXT"] };
    const page = makePage({ body: "Footer boilerplate LEGALTEXT lives here." });
    expect(copyQa(page, config)).toEqual([]);
  });
});

describe("copyQa — generalized phrase budgets", () => {
  it("fails a 3-word phrase repeated past budget", () => {
    const sentence = "Call for details today.";
    const page = makePage({
      body: Array(MAX_TRIGRAM_REPEATS + 1).fill(sentence).join(" "),
    });
    const failures = copyQa(page, cfg());
    expect(failures.some((f) => f.message.includes("phrase budget"))).toBe(true);
  });

  it("exempts brand terms from repetition budgets via config", () => {
    const body =
      "Acme Wiring fixes panels. Acme Wiring quotes in writing. Acme Wiring pulls permits. " +
      "Acme Wiring meets the inspector. Acme Wiring labels the panel. Acme Wiring cleans up. " +
      "Acme Wiring calls ahead. Acme Wiring shows up. Acme Wiring finishes on time.";
    const page = makePage({ body });
    const bare = copyQa(page, cfg());
    expect(bare.some((f) => f.message.includes('"acme'))).toBe(true);
    const branded = copyQa(page, { ...cfg(), brandTerms: ["Acme Wiring"] });
    expect(branded.some((f) => f.message.includes('"acme'))).toBe(false);
  });
});

describe("copyQa — readability (ported Flesch/FK checks)", () => {
  it("fails a sentence over 28 words", () => {
    const long =
      "This single sentence keeps going and going with clause after clause after clause " +
      "so that it easily runs past the twenty eight word limit that the readability check " +
      "enforces on every page body.";
    const failures = copyQa(makePage({ body: long }), cfg());
    expect(failures.some((f) => f.message.includes("sentence over 28 words"))).toBe(true);
  });

  it("fails copy above the max grade level", () => {
    const dense =
      "Municipal electrification infrastructure necessitates extensive administrative " +
      "coordination requirements alongside jurisdictional documentation obligations regarding " +
      "residential modernization initiatives throughout metropolitan communities.";
    const failures = copyQa(makePage({ body: dense }), cfg());
    expect(failures.some((f) => f.message.includes("grade level"))).toBe(true);
  });
});

describe("copyQa — de-Crescenting proof (spec M6 Accept)", () => {
  it("passes a synthetic plumbing-client page with zero code edits", () => {
    expect(copyQa(plumbingPage(), plumbingQaConfig())).toEqual([]);
  });
});

describe("gate code contains zero client literals (grep-proof)", () => {
  it("no reference-client vocabulary in gates/*.ts, generate-page.ts, qa-config.ts", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const files = [
      ...readdirSync(here)
        .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
        .map((f) => join(here, f)),
      join(here, "..", "generate-page.ts"),
      join(here, "..", "qa-config.ts"),
    ];
    const clientLiteral = new RegExp(["Crescent", "Mosc" + "ow", "509"].join("|"));
    for (const file of files) {
      expect(clientLiteral.test(readFileSync(file, "utf8")), `client literal in ${file}`).toBe(false);
    }
  });
});
