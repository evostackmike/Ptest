/**
 * gates/info-gain.ts — information gain vs the RANKING incumbents' pages
 * (context.incumbentTexts), not vs siblings: avoiding overlap is not value.
 * The page must ADD local information the incumbents do not carry.
 *
 * v0.1 heuristic: extract "local info units" — multi-word proper-noun
 * entities and concrete numeric facts (money, unit-numbers, years) — then
 * discount (a) the client's own brand/owner names, (b) units that also appear
 * across ≥2 sibling pages (template furniture, not local knowledge). What
 * remains must include at least MIN_INFO_GAIN units absent from every
 * incumbent text.
 * // V05: upgrade to embedding/entity-linking based novelty scoring.
 */

import type { GateContext, PageContent, QaFailure } from "../../../core/types.js";
import { pageProse } from "./text-utils.js";

export const GATE_ID = "info-gain";

/** Minimum unique local info units a page must add over the incumbents. */
export const MIN_INFO_GAIN = 3;

const PROPER = "[A-Z][A-Za-z'&.\\-]+";
/**
 * Multi-word capitalized sequences, optionally joined by of/the ("City of
 * Springfield" style). "and"/"&" are NOT joiners — a coordination is two
 * mentions, not one entity. Joined by spaces/tabs only — never spans a line break.
 */
const ENTITY_RE = new RegExp(
  `${PROPER}(?:[ \\t]+(?:of|the)[ \\t]+${PROPER}|[ \\t]+${PROPER})+`,
  "g"
);

const MONEY_RE = /\$\s?\d[\d,]*(?:\s?[–—-]\s?\$?\d[\d,]*)?/g;
const UNIT_NUMBER_RE =
  /\b\d{1,4}(?:[.,]\d+)?[-\s]?(?:amp|amps|volt|volts|watt|watts|kw|kwh|percent|%|gpm|psi|sq\.?\s?ft\.?|square feet)\b/gi;
const YEAR_RE = /\b(?:18|19|20)\d{2}s?\b/g;

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Extract candidate local-info units (entity/fact strings) from text. Exported for tests. */
export function extractInfoUnits(text: string): Map<string, string> {
  const units = new Map<string, string>();
  for (const re of [ENTITY_RE, MONEY_RE, UNIT_NUMBER_RE, YEAR_RE]) {
    const fresh = new RegExp(re.source, re.flags);
    let m: RegExpExecArray | null;
    while ((m = fresh.exec(text))) {
      const display = m[0]
        .trim()
        .replace(/^(?:The|A|An)\s+/i, "")
        .replace(/[,.;:]+$/, "");
      if (display.length < 3) continue;
      units.set(normalizeKey(display), display);
    }
  }
  return units;
}

function containsKey(haystackLower: string, key: string): boolean {
  return haystackLower.includes(key);
}

export function infoGain(page: PageContent, context: GateContext): QaFailure[] {
  if (context.incumbentTexts.length === 0) {
    // No incumbent baseline injected — nothing to gain against. // V05: make
    // missing incumbent context a hard failure once M1 always supplies it.
    return [];
  }

  const units = extractInfoUnits(pageProse(page) + "\n" + page.faq.map((f) => `${f.q} ${f.a}`).join("\n"));

  // Discount the client's own brand and owner names — self-reference is not
  // local information.
  const brandWords = new Set(
    [
      ...context.manifest.business.legal_name.split(/\s+/),
      ...context.manifest.business.entity.owner_names.flatMap((n) => n.split(/\s+/)),
    ]
      .map((w) => w.toLowerCase().replace(/[^a-z]/g, ""))
      .filter((w) => w.length > 2 && !["llc", "inc", "corp", "ltd"].includes(w))
  );
  const isBrandUnit = (key: string): boolean =>
    key.split(/[^a-z0-9$%]+/).some((w) => brandWords.has(w));

  // Discount units that are template furniture: present in ≥2 sibling pages.
  const siblingTexts = context.siblings
    .filter((s) => s.url !== page.url)
    .map((s) => pageProse(s).toLowerCase());
  const isSiblingBoilerplate = (key: string): boolean =>
    siblingTexts.filter((t) => containsKey(t, key)).length >= 2;

  const incumbentsLower = context.incumbentTexts.map((t) => t.toLowerCase());
  const gained: string[] = [];
  for (const [key, display] of units) {
    if (isBrandUnit(key)) continue;
    if (isSiblingBoilerplate(key)) continue;
    if (incumbentsLower.some((t) => containsKey(t, key))) continue;
    gained.push(display);
  }

  if (gained.length < MIN_INFO_GAIN) {
    return [
      {
        gate: GATE_ID,
        message:
          `page adds only ${gained.length} unique local info unit(s) over the ranking ` +
          `incumbents (need ≥${MIN_INFO_GAIN})` +
          (gained.length ? ` — found: ${gained.join("; ")}` : "") +
          ` — add genuinely local facts (permit authority, utility, housing stock, prices) the incumbents do not carry`,
      },
    ];
  }
  return [];
}
