/**
 * gates/copy-qa.ts — config-driven port of the reference client's copy-qa
 * script. Keeps its real checks — the 14 generic ai.* slop rules, banned
 * phrases, phrase-repetition budgets, Flesch/FK readability — but every piece
 * of client vocabulary (brand terms, vertical vocab, banned phrases, ignore
 * patterns) comes from QaConfig. This file contains ZERO client literals.
 */

import type { PageContent, QaConfig, QaFailure } from "../../../core/types.js";
import {
  escapeRegex,
  readability,
  sentences,
  words,
  pageFullText,
  LONG_SENTENCE_WORDS,
} from "./text-utils.js";

export const GATE_ID = "copy-qa";

export type CopyRuleSeverity = "error" | "warn" | "info";

export interface CopyRule {
  id: string;
  severity: CopyRuleSeverity;
  pattern: RegExp;
  message: string;
}

/**
 * The 14 generic ai.* slop rules ported from the reference copy-qa script,
 * plus one generic unsupported-superlative rule (its vertical-specific
 * variants live in claim-substantiation and client qa-config).
 */
export const DEFAULT_COPY_RULES: CopyRule[] = [
  { id: "ai.all-your-needs", severity: "error", pattern: /\b(all|any) (of )?your [a-z\s-]{0,28}needs\b/i, message: "Classic AI/service-business filler. Say the actual problem or work type." },
  { id: "ai.peace-of-mind", severity: "warn", pattern: /\bpeace of mind\b/i, message: "Overused trust filler. Replace with concrete behavior: written quote, permit handled, cleanup, call before added cost." },
  { id: "ai.top-notch", severity: "warn", pattern: /\btop[- ]notch\b|\bbest[- ]in[- ]class\b|\bpremier\b|\bleading\b/i, message: "Unsupported hype. Replace with proof or plain description." },
  { id: "ai.comprehensive", severity: "warn", pattern: /\bcomprehensive\b|\bwide range\b|\bfull range\b/i, message: "Usually filler. Name the actual services or situations." },
  { id: "ai.tailored", severity: "warn", pattern: /\btailored (solutions|services|approach)\b|\bcustomized solutions\b/i, message: "Generic agency/service copy. Say what gets looked at and decided." },
  { id: "ai.seamless", severity: "warn", pattern: /\bseamless\b|\bhassle[- ]free\b|\bstress[- ]free\b/i, message: "Overpromises and sounds canned. Replace with specific process language." },
  { id: "ai.commitment", severity: "warn", pattern: /\bcommitment to\b|\bdedication to\b/i, message: "Corporate values phrasing. Translate into observable behavior." },
  { id: "ai.excellence", severity: "warn", pattern: /\bexcellence\b|\bquality workmanship\b|\bhigh[- ]quality\b/i, message: "Generic quality claim. Use concrete proof: clean work, inspection passed, written quote." },
  { id: "ai.trusted-reliable", severity: "info", pattern: /\btrusted\b|\breliable\b|\bdependable\b/i, message: "Trust words are fine sparingly, but repeated trust claims weaken the copy. Back them with proof." },
  { id: "ai.nestled-heart", severity: "warn", pattern: /\bnestled\b|\bin the heart of\b|\bvibrant\b|\brich\b/i, message: "Tourism/location-page filler. Use job-relevant local context instead." },
  { id: "ai.not-just", severity: "warn", pattern: /\bnot just\b|\bmore than just\b|\bnot merely\b/i, message: "Overused AI contrast pattern. Make the direct claim." },
  { id: "ai.from-x-to-y", severity: "info", pattern: /\bfrom\b[^.?!\n]{3,80}\bto\b[^.?!\n]{3,80}/i, message: "Check for false range/list padding. Keep if it is a real range." },
  { id: "ai.ensure", severity: "info", pattern: /\bensur(e|es|ing)\b|\bprovid(e|es|ing)\b/i, message: "Often vague. Check whether a stronger verb or concrete action is better." },
  { id: "ai.vital-crucial-key", severity: "info", pattern: /\b(vital|crucial|pivotal|key)\b/i, message: "Importance inflation. Use only if the word earns its place." },
  { id: "generic.no-proof-superlative", severity: "error", pattern: /\b#1\b|\bhighest[- ]rated\b|\btop[- ]rated\b/i, message: "Unsupported superlative. Needs proof nearby or should be removed." },
];

/** error + warn hits fail the gate; info hits are advisory and dropped at v0.1. */
export const FAILING_SEVERITIES: ReadonlySet<CopyRuleSeverity> = new Set(["error", "warn"]);

/** Readability hard limits (from the reference script's attention thresholds). */
export const MAX_GRADE_LEVEL = 10;

/** Generic phrase budget: any 3-word phrase repeated more than this fails. */
export const MAX_TRIGRAM_REPEATS = 3;

/** Generic word budget: any significant word repeated more than this fails. */
export const MAX_WORD_REPEATS = 8;

const STOPWORD_RE = /^(the|a|an|and|or|but|of|to|in|on|for|with|that|this|it|is|are|was|be|we|you|your|our)$/;

function applyIgnorePatterns(text: string, patterns: string[]): string {
  let out = text;
  for (const p of patterns) {
    try {
      out = out.replace(new RegExp(p, "gi"), " ");
    } catch {
      // Invalid client regex: skip rather than crash the gate.
    }
  }
  return out;
}

function protectedByConfig(phrase: string, config: QaConfig): boolean {
  const hay = phrase.toLowerCase();
  const hayWords = new Set(hay.split(/\s+/));
  const covers = (term: string): boolean => {
    const t = term.toLowerCase();
    // The phrase contains the whole term, or shares a word with a multi-word
    // term (so the single word "acme" is covered by brand term "Acme Wiring").
    return hay.includes(t) || t.split(/\s+/).some((w) => hayWords.has(w));
  };
  return config.brandTerms.some(covers) || config.vocabAllow.some(covers);
}

export function copyQa(page: PageContent, config: QaConfig): QaFailure[] {
  const failures: QaFailure[] = [];
  const rawText = pageFullText(page);
  const text = applyIgnorePatterns(rawText, config.ignorePatterns);

  // 1. Banned phrases (client overlay; runGates also merges manifest
  //    brand_constraints.banned_phrases into this list).
  for (const phrase of config.bannedPhrases) {
    const re = new RegExp(`\\b${escapeRegex(phrase)}\\b`, "gi");
    const hits = text.match(re) ?? [];
    if (hits.length > 0) {
      failures.push({
        gate: GATE_ID,
        message: `banned phrase "${phrase}" appears ${hits.length} time(s)`,
      });
    }
  }

  // 2. Generic slop rules (error + warn fail; info advisory-only at v0.1).
  //    // V05: surface info-severity findings in a non-blocking report channel.
  for (const rule of DEFAULT_COPY_RULES) {
    if (!FAILING_SEVERITIES.has(rule.severity)) continue;
    const re = new RegExp(rule.pattern.source, rule.pattern.flags.includes("g") ? rule.pattern.flags : rule.pattern.flags + "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      failures.push({
        gate: GATE_ID,
        message: `[${rule.severity}] ${rule.id}: "${m[0]}" — ${rule.message}`,
      });
    }
  }

  // 3. Phrase budgets, generalized: instead of a hardcoded client phrase list,
  //    any 3-word phrase or significant word repeated past budget fails —
  //    unless the config marks it as brand/vertical vocabulary.
  const tokens = words(text);
  const trigramCounts = new Map<string, number>();
  for (let i = 0; i + 3 <= tokens.length; i++) {
    const tri = tokens.slice(i, i + 3).join(" ");
    trigramCounts.set(tri, (trigramCounts.get(tri) ?? 0) + 1);
  }
  for (const [tri, count] of trigramCounts) {
    if (count > MAX_TRIGRAM_REPEATS && !protectedByConfig(tri, config)) {
      failures.push({
        gate: GATE_ID,
        message: `phrase budget: "${tri}" repeated ${count}x (max ${MAX_TRIGRAM_REPEATS})`,
      });
    }
  }
  const wordCounts = new Map<string, number>();
  for (const w of tokens) {
    if (w.length < 4 || STOPWORD_RE.test(w)) continue;
    wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1);
  }
  for (const [w, count] of wordCounts) {
    if (count > MAX_WORD_REPEATS && !protectedByConfig(w, config)) {
      failures.push({
        gate: GATE_ID,
        message: `word budget: "${w}" repeated ${count}x (max ${MAX_WORD_REPEATS})`,
      });
    }
  }

  // 4. Readability (body + FAQ answers; titles/metas are fragments).
  const proseForReadability = [page.body, ...page.faq.map((f) => f.a)].join("\n");
  const stats = readability(applyIgnorePatterns(proseForReadability, config.ignorePatterns));
  if (stats) {
    if (stats.grade > MAX_GRADE_LEVEL) {
      failures.push({
        gate: GATE_ID,
        message: `readability: grade level ${stats.grade.toFixed(1)} exceeds ${MAX_GRADE_LEVEL}`,
      });
    }
    for (const s of stats.longSentences) {
      failures.push({
        gate: GATE_ID,
        message: `readability: sentence over ${LONG_SENTENCE_WORDS} words (${words(s).length}): "${s}"`,
      });
    }
  }

  return failures;
}

/** Exported for tests: sentence splitter used by the readability check. */
export { sentences as splitSentences };
