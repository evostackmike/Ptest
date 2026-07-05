/**
 * pipeline/m2-keywords/keyword-map.schema.ts — zod validator for the
 * on-disk `keyword-map.json` artifact M2 owns (core/CONTRACTS.md shared
 * convention 8). Parses INTO the core `KeywordMap` type.
 */

import { z } from "zod";
import type { KeywordMap } from "../../core/types.js";

export const keywordEntrySchema = z.object({
  query: z.string().min(1),
  town: z.string().min(1).nullable(),
  volume: z.number().int().min(0).nullable(),
  marketExists: z.boolean(),
  canonicalUrl: z.string().min(1).nullable(),
});

export const keywordClusterSchema = z.object({
  clusterId: z.string().min(1),
  keywords: z.array(keywordEntrySchema),
});

export const keywordMapSchema: z.ZodType<KeywordMap> = z.object({
  clusters: z.array(keywordClusterSchema),
  skipped: z.array(z.object({ query: z.string().min(1), reason: z.string().min(1) })),
});

/**
 * Domain-failure wrapper (shared convention 4): zod parse failures on
 * external input are values, never throws.
 */
export function parseKeywordMap(
  raw: unknown
): { ok: true; keywordMap: KeywordMap } | { ok: false; errors: string[] } {
  const result = keywordMapSchema.safeParse(raw);
  if (result.success) return { ok: true, keywordMap: result.data };
  return {
    ok: false,
    errors: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
  };
}
