/**
 * gates/text-utils.ts — shared, client-agnostic text primitives for the M6
 * content gates. Pure functions only; no I/O, no clock, no client literals.
 */

import type { ClientManifest, PageContent } from "../../../core/types.js";

// ---------------------------------------------------------------------------
// Basic text splitting
// ---------------------------------------------------------------------------

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Split text into sentences (line breaks also terminate a sentence). */
export function sentences(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) =>
      normalizeWhitespace(line)
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
    )
    .filter((s) => s.length > 0);
}

/** Lowercased word tokens (letters + apostrophes). */
export function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
}

/** Crude syllable estimate (ported from the reference copy-qa script). */
export function syllables(word: string): number {
  let w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  w = w.replace(/(?:e|es|ed)$/, "");
  const groups = w.match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

export interface ReadabilityStats {
  sentences: number;
  words: number;
  /** Flesch reading ease. */
  fre: number;
  /** Flesch–Kincaid grade level. */
  grade: number;
  longSentences: string[];
}

export const LONG_SENTENCE_WORDS = 28;

/** Flesch/FK readability, ported from the reference copy-qa script. */
export function readability(text: string): ReadabilityStats | null {
  const ss = sentences(text);
  const ws = words(text);
  if (!ss.length || !ws.length) return null;
  const syll = ws.reduce((n, w) => n + syllables(w), 0);
  const fre = 206.835 - 1.015 * (ws.length / ss.length) - 84.6 * (syll / ws.length);
  const grade = 0.39 * (ws.length / ss.length) + 11.8 * (syll / ws.length) - 15.59;
  const longSentences = ss.filter((s) => words(s).length > LONG_SENTENCE_WORDS);
  return { sentences: ss.length, words: ws.length, fre, grade, longSentences };
}

// ---------------------------------------------------------------------------
// Locale-token normalization (doorway-page detector support)
// ---------------------------------------------------------------------------

/** Two-letter code → full state name, for locale normalization. Generic US data. */
const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin",
  WY: "Wyoming", DC: "District of Columbia",
};

const LOCALE_STOP = new Set(["the", "of", "and", "a", "an"]);

/**
 * Every locale token the manifest knows about (town names, counties, state
 * codes + names, region label words). Used to normalize away the ONE thing a
 * doorway template legitimately varies, so that "Electrician in TownA" and
 * "Electrician in TownB" compare as identical boilerplate.
 */
export function localeTokens(manifest: ClientManifest): string[] {
  const tokens = new Set<string>();
  const add = (raw: string | undefined) => {
    if (!raw) return;
    for (const part of raw.split(/[\s,]+/)) {
      const t = part.trim();
      if (t.length >= 2 && !LOCALE_STOP.has(t.toLowerCase())) tokens.add(t);
    }
  };
  const addState = (code: string | undefined) => {
    if (!code) return;
    add(code);
    add(STATE_NAMES[code.toUpperCase()]);
  };
  add(manifest.locations.base.city);
  addState(manifest.locations.base.state);
  add(manifest.locations.service_area.target_region_label);
  for (const town of manifest.locations.service_area.towns) {
    add(town.name);
    add(town.county);
    const stateFromName = town.name.split(",")[1]?.trim();
    addState(stateFromName);
  }
  // Longest-first so "New Hampshire" is replaced before "New".
  return [...tokens].sort((a, b) => b.length - a.length);
}

/** Replace every locale token with a placeholder (case-insensitive, whole word). */
export function normalizeLocale(text: string, tokens: string[]): string {
  let out = text;
  for (const token of tokens) {
    const re = new RegExp(`\\b${escapeRegex(token)}\\b`, "gi");
    out = out.replace(re, "__loc__");
  }
  return out;
}

// ---------------------------------------------------------------------------
// Shingles + set similarity
// ---------------------------------------------------------------------------

/** Word k-shingles of a token list. */
export function shingles(tokens: string[], k: number): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + k <= tokens.length; i++) {
    out.add(tokens.slice(i, i + k).join(" "));
  }
  return out;
}

export function intersectionSize<T>(a: Set<T>, b: Set<T>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

export function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 0;
  const inter = intersectionSize(a, b);
  return inter / (a.size + b.size - inter);
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Page flattening
// ---------------------------------------------------------------------------

/** Title + meta + body (no FAQ — the faq-unique gate owns FAQ text). */
export function pageProse(page: PageContent): string {
  return [page.title, page.metaDescription, page.body].join("\n");
}

/** Everything on the page, FAQ included (copy-qa and claim scans). */
export function pageFullText(page: PageContent): string {
  return [
    page.title,
    page.metaDescription,
    page.body,
    ...page.faq.flatMap((f) => [f.q, f.a]),
  ].join("\n");
}
