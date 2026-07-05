/**
 * qa-config.ts — zod validator + loader for the per-client QA overlay
 * (clients/<slug>/qa-config.json). The gates themselves ship with generic
 * defaults only; ALL client vocabulary (brand terms, vertical vocab, banned
 * phrases) arrives through this config, so a new client passes the gates with
 * zero code edits.
 */

import { readFileSync } from "node:fs";
import { z } from "zod";
import type { QaConfig } from "../../core/types.js";

/** Engine default: no client vocabulary, conservative boilerplate cap. */
export const DEFAULT_MAX_BOILERPLATE_RATIO = 0.32;

export const qaConfigSchema = z.object({
  brandTerms: z.array(z.string()).default([]),
  vocabAllow: z.array(z.string()).default([]),
  bannedPhrases: z.array(z.string()).default([]),
  ignorePatterns: z.array(z.string()).default([]),
  maxBoilerplateRatio: z.number().min(0).max(1).default(DEFAULT_MAX_BOILERPLATE_RATIO),
});

export function defaultQaConfig(): QaConfig {
  return {
    brandTerms: [],
    vocabAllow: [],
    bannedPhrases: [],
    ignorePatterns: [],
    maxBoilerplateRatio: DEFAULT_MAX_BOILERPLATE_RATIO,
  };
}

/** Overlay a partial client config onto the engine defaults. */
export function mergeQaConfig(overlay: Partial<QaConfig>): QaConfig {
  const base = defaultQaConfig();
  return {
    brandTerms: [...base.brandTerms, ...(overlay.brandTerms ?? [])],
    vocabAllow: [...base.vocabAllow, ...(overlay.vocabAllow ?? [])],
    bannedPhrases: [...base.bannedPhrases, ...(overlay.bannedPhrases ?? [])],
    ignorePatterns: [...base.ignorePatterns, ...(overlay.ignorePatterns ?? [])],
    maxBoilerplateRatio: overlay.maxBoilerplateRatio ?? base.maxBoilerplateRatio,
  };
}

export function loadQaConfig(
  path: string
): { ok: true; config: QaConfig } | { ok: false; errors: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    return { ok: false, errors: [`failed to read/parse ${path}: ${(err as Error).message}`] };
  }
  const parsed = qaConfigSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  }
  return { ok: true, config: parsed.data };
}
