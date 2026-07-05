/**
 * gates/faq-unique.ts — FAQ overlap across sibling pages. A question/answer
 * pair duplicated (near-verbatim) on siblings of the same template is
 * boilerplate wearing an accordion. Locale tokens are normalized first so
 * "Do you serve TownA?" vs "Do you serve TownB?" counts as the duplicate it is.
 */

import type { GateContext, PageContent, QaFailure } from "../../../core/types.js";
import { jaccard, localeTokens, normalizeLocale, words } from "./text-utils.js";

export const GATE_ID = "faq-unique";

/** Jaccard similarity (stopword-free, singularized word sets) at/above which a FAQ is a duplicate. */
export const FAQ_DUPLICATE_JACCARD = 0.75;

const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with",
  "do", "does", "is", "are", "it", "you", "your", "we", "our",
]);

function faqWordSet(text: string, tokens: string[]): Set<string> {
  return new Set(
    words(normalizeLocale(text, tokens))
      .filter((w) => !STOP.has(w))
      .map((w) => w.replace(/s$/, ""))
  );
}

export function faqUnique(page: PageContent, context: GateContext): QaFailure[] {
  const failures: QaFailure[] = [];
  const tokens = localeTokens(context.manifest);
  const siblings = context.siblings.filter((s) => s.url !== page.url);

  for (const item of page.faq) {
    const qSet = faqWordSet(item.q, tokens);
    const aSet = faqWordSet(item.a, tokens);
    for (const sib of siblings) {
      for (const sibItem of sib.faq) {
        const qSim = jaccard(qSet, faqWordSet(sibItem.q, tokens));
        const aSim = jaccard(aSet, faqWordSet(sibItem.a, tokens));
        if (qSim >= FAQ_DUPLICATE_JACCARD || aSim >= FAQ_DUPLICATE_JACCARD) {
          failures.push({
            gate: GATE_ID,
            message:
              `FAQ "${item.q}" duplicates a FAQ on sibling ${sib.url} ` +
              `(question similarity ${qSim.toFixed(2)}, answer similarity ${aSim.toFixed(2)}, ` +
              `threshold ${FAQ_DUPLICATE_JACCARD}) — write a town-specific question or drop it`,
          });
        }
      }
    }
  }
  return failures;
}
