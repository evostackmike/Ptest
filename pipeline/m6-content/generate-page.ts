/**
 * generate-page.ts — M6 orchestrator (the gate harness). Takes a drafted page
 * (markdown/plain sections) plus injected context {manifest, architecture
 * page, siblings, incumbent texts} and a QaConfig, runs all five gates, and
 * returns a QaReport. LLM drafting itself is out of scope at v0.1 — this
 * module decides whether a draft is publishable, it does not write copy.
 */

import type {
  GateContext,
  PageContent,
  QaConfig,
  QaFailure,
  QaReport,
} from "../../core/types.js";
import { copyQa } from "./gates/copy-qa.js";
import { boilerplateRatio } from "./gates/boilerplate-ratio.js";
import { infoGain } from "./gates/info-gain.js";
import { claimSubstantiation } from "./gates/claim-substantiation.js";
import { faqUnique } from "./gates/faq-unique.js";

/**
 * Run all five gates and aggregate. pass = zero failures. The manifest's
 * brand_constraints.banned_phrases are merged into the config's banned list
 * here, so copyQa stays a pure (page, config) function.
 */
export function runGates(page: PageContent, context: GateContext, config: QaConfig): QaReport {
  const merged: QaConfig = {
    ...config,
    bannedPhrases: [
      ...new Set([
        ...config.bannedPhrases,
        ...context.manifest.business.brand_constraints.banned_phrases,
      ]),
    ],
  };
  const failures: QaFailure[] = [
    ...copyQa(page, merged),
    ...boilerplateRatio(page, context, config),
    ...infoGain(page, context),
    ...claimSubstantiation(page, context),
    ...faqUnique(page, context),
  ];
  return { pass: failures.length === 0, failures };
}

// ---------------------------------------------------------------------------
// Draft assembly: markdown/plain sections → PageContent
// ---------------------------------------------------------------------------

export interface DraftedSection {
  /** Optional heading (rendered as its own line in the body). */
  heading?: string;
  /** Markdown or plain text. */
  text: string;
}

export interface DraftedPage {
  url: string;
  title: string;
  metaDescription: string;
  sections: DraftedSection[];
  faq: { q: string; a: string }[];
}

/** Strip light markdown syntax so the gates see rendered plain text. */
export function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "");
}

export function draftToPageContent(draft: DraftedPage): PageContent {
  const body = draft.sections
    .flatMap((s) => [s.heading ? stripMarkdown(s.heading) : null, stripMarkdown(s.text)])
    .filter((x): x is string => x !== null && x.trim().length > 0)
    .join("\n");
  return {
    url: draft.url,
    title: draft.title,
    metaDescription: draft.metaDescription,
    body,
    faq: draft.faq,
  };
}

/** Full orchestration: assemble the draft, run every gate, return page + report. */
export function generatePage(
  draft: DraftedPage,
  context: GateContext,
  config: QaConfig
): { page: PageContent; report: QaReport } {
  const page = draftToPageContent(draft);
  return { page, report: runGates(page, context, config) };
}
