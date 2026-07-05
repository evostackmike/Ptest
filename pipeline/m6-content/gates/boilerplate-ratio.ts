/**
 * gates/boilerplate-ratio.ts — shared-text ratio across sibling pages of the
 * same template. Locale tokens (town/county/state names from the manifest)
 * are normalized to a placeholder first, so "Electrician in TownA" vs
 * "Electrician in TownB" counts as the shared boilerplate it really is —
 * exactly how doorway templates are stamped out. Ratio = |page shingles ∩
 * union(sibling shingles)| / |page shingles|, capped by
 * config.maxBoilerplateRatio.
 */

import type { GateContext, PageContent, QaConfig, QaFailure } from "../../../core/types.js";
import {
  intersectionSize,
  localeTokens,
  normalizeLocale,
  pageProse,
  shingles,
  words,
} from "./text-utils.js";

export const GATE_ID = "boilerplate-ratio";

/** Word-shingle size for overlap detection. */
export const SHINGLE_SIZE = 3;

function normalizedShingles(page: PageContent, tokens: string[]): Set<string> {
  const text = normalizeLocale(pageProse(page), tokens);
  return shingles(words(text), SHINGLE_SIZE);
}

/** Compute the shared-shingle ratio of `page` against all siblings. Exported for tests. */
export function computeBoilerplateRatio(page: PageContent, context: GateContext): number {
  const tokens = localeTokens(context.manifest);
  const pageShingles = normalizedShingles(page, tokens);
  if (pageShingles.size === 0) return 0;
  const siblingUnion = new Set<string>();
  for (const sib of context.siblings) {
    if (sib.url === page.url) continue;
    for (const sh of normalizedShingles(sib, tokens)) siblingUnion.add(sh);
  }
  return intersectionSize(pageShingles, siblingUnion) / pageShingles.size;
}

export function boilerplateRatio(
  page: PageContent,
  context: GateContext,
  config: QaConfig
): QaFailure[] {
  if (context.siblings.filter((s) => s.url !== page.url).length === 0) return [];
  const ratio = computeBoilerplateRatio(page, context);
  if (ratio > config.maxBoilerplateRatio) {
    return [
      {
        gate: GATE_ID,
        message:
          `shared-text ratio ${ratio.toFixed(2)} exceeds cap ${config.maxBoilerplateRatio} ` +
          `(${SHINGLE_SIZE}-word shingles vs ${context.siblings.length} sibling page(s), ` +
          `locale tokens normalized) — the page is a re-skinned template, not local content`,
      },
    ];
  }
  return [];
}
