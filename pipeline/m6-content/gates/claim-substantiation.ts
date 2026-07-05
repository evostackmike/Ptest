/**
 * gates/claim-substantiation.ts — G8. Superlatives, numeric claims, and
 * regulatory/local-factual claims (permit / code / utility / licensing
 * patterns) must resolve to a manifest local_facts entry in scope for the
 * page's town×cluster, or to a proof asset (awards / certifications /
 * licenses). Otherwise the gate fails WITH the offending sentence — the
 * generator must write around the topic, never publish the claim.
 *
 * DEGRADED-tier pages additionally fail on any proof-dependent claim
 * ("jobs we've done in X") because they carry no publishable proof jobs.
 */

import type {
  ClientManifest,
  GateContext,
  LocalFact,
  PageContent,
  QaFailure,
} from "../../../core/types.js";
import { sentences, pageFullText, words } from "./text-utils.js";

export const GATE_ID = "claim-substantiation";

// --- superlatives -----------------------------------------------------------

/** Superlatives that nothing in a v0.1 manifest can substantiate: always fail. */
export const HARD_SUPERLATIVE_RE =
  /\b#1\b|\btop[- ]rated\b|\bhighest[- ]rated\b|\bmost trusted\b|\bfive[- ]star\b|\bbest[- ]in[- ]class\b|\b(?:the\s+)?best\s+[a-z][a-z-]*(?:\s+[a-z][a-z-]*)?\s+(?:in|around|near)\b/i;
// V05: allow rating superlatives when the review ledger proves them.

const AWARD_RE = /\baward[- ]winning\b/i;
const CERTIFIED_RE = /\b(?:[A-Za-z][\w-]*[- ])?certified\b/i;
const LICENSED_RE = /\blicens(?:ed|e)\b/i;

// --- numeric claims ---------------------------------------------------------

const VOLUME_CLAIM_RE = /\b(?:over|more than|nearly|almost)\s+[\d,]+\b/i;
const YEARS_CLAIM_RE = /\b\d+\+?\s+years\b/i;
const PERCENT_CLAIM_RE = /\b\d{1,3}(?:\.\d+)?%/;

// --- regulatory / local-factual claims --------------------------------------

const REG_TOPIC_RE =
  /\bpermit(?:s|ting)?\b|\bcode\b|\binspection\b|\butilit(?:y|ies)\b|\brebate(?:s)?\b|\blicens\w*\b|\bordinance\b|\bbuilding department\b|\bcounty\b|\bcity of\b/i;
const REG_ASSERT_RE =
  /\brequires?\b|\brequired\b|\bmust\b|\bcharges?\b|\bcosts?\b|\bruns\b|\bmandates?\b|\benforces?\b/i;

// --- proof-dependent claims (DEGRADED tier) ----------------------------------

export const PROOF_CLAIM_PATTERNS: RegExp[] = [
  /\b(?:jobs?|projects?|installs?|installations?|work)\s+we(?:'ve|\s+have)?\s+(?:done|completed|finished|handled)\b/i,
  /\bwe(?:'ve|\s+have)\s+(?:recently\s+)?(?:installed|upgraded|replaced|rewired|wired|built|completed|done)\b/i,
  /\bwe\s+recently\s+(?:installed|upgraded|replaced|rewired|wired|built|completed)\b/i,
  /\bour\s+(?:recent\s+)?(?:projects?|jobs?|work)\s+in\b/i,
  /\brecent\s+(?:projects?|jobs?|installs?)\b/i,
  /\bphotos?\s+(?:of|from)\s+(?:our|the)\s+(?:work|jobs?|projects?)\b/i,
];

// --- helpers -----------------------------------------------------------------

const STOP = new Set([
  "the", "a", "an", "and", "or", "for", "with", "that", "this", "from",
  "into", "onto", "over", "under", "your", "our", "their", "have", "has",
  "will", "would", "must", "requires", "require", "required", "charges",
  "charge", "costs", "cost", "runs",
]);

function sigWords(text: string): Set<string> {
  return new Set(
    words(text)
      .filter((w) => w.length > 3 && !STOP.has(w))
      .map((w) => w.replace(/s$/, ""))
  );
}

function numbersIn(text: string): Set<string> {
  return new Set(
    (text.match(/\$?\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/[$,]/g, ""))
  );
}

/** Derive the page's town slug / cluster id from its canonical URL segments. */
export function cellFromUrl(
  url: string,
  manifest: ClientManifest
): { town: string | null; cluster: string | null } {
  const segments = url.split("/").filter(Boolean);
  let town: string | null = null;
  let cluster: string | null = null;
  for (const seg of segments) {
    if (manifest.locations.service_area.towns.some((t) => t.slug === seg)) town = seg;
    for (const c of manifest.services.clusters) {
      if (seg === c.cluster_id || seg.includes(c.cluster_id)) cluster = c.cluster_id;
    }
  }
  return { town, cluster };
}

function factInScope(
  fact: LocalFact,
  town: string | null,
  cluster: string | null
): boolean {
  const townOk = fact.towns.length === 0 || town === null || fact.towns.includes(town);
  const clusterOk =
    fact.clusters.length === 0 || cluster === null || fact.clusters.includes(cluster);
  return townOk && clusterOk;
}

/**
 * A sentence resolves to a fact when the fact is in scope for the page's cell
 * AND they share ≥2 significant words or a literal number. When
 * `requireNumber` is set (numeric claims), the fact must carry the same
 * number — word overlap alone cannot substantiate a quantity.
 * // V05: replace lexical overlap with claim-level entailment checking.
 */
export function sentenceResolvesToFact(
  sentence: string,
  facts: LocalFact[],
  town: string | null,
  cluster: string | null,
  opts: { requireNumber?: boolean } = {}
): LocalFact | null {
  const sWords = sigWords(sentence);
  const sNums = numbersIn(sentence);
  for (const fact of facts) {
    if (!factInScope(fact, town, cluster)) continue;
    const numShared = [...sNums].some((n) => numbersIn(fact.claim).has(n));
    if (opts.requireNumber) {
      if (numShared) return fact;
      continue;
    }
    const fWords = sigWords(fact.claim);
    let shared = 0;
    for (const w of sWords) if (fWords.has(w)) shared++;
    if (shared >= 2 || numShared) return fact;
  }
  return null;
}

// --- gate ---------------------------------------------------------------------

export function claimSubstantiation(page: PageContent, context: GateContext): QaFailure[] {
  const failures: QaFailure[] = [];
  const manifest = context.manifest;
  const { town, cluster } = cellFromUrl(context.page.url, manifest);
  const facts = manifest.local_facts;

  const fail = (sentence: string, why: string) =>
    failures.push({ gate: GATE_ID, ruleId: "G8", message: `${why} — offending sentence: "${sentence}"` });

  for (const sentence of sentences(pageFullText(page))) {
    // 1. Superlatives.
    const hard = sentence.match(HARD_SUPERLATIVE_RE);
    if (hard) {
      fail(sentence, `unsubstantiated superlative "${hard[0]}" (no v0.1 evidence path)`);
    }
    if (AWARD_RE.test(sentence) && manifest.proof_assets.awards.length === 0) {
      fail(sentence, `"award-winning" claim with no award in proof_assets.awards`);
    }
    if (CERTIFIED_RE.test(sentence) && manifest.proof_assets.certifications.length === 0) {
      fail(sentence, `certification claim with no entry in proof_assets.certifications`);
    }
    if (LICENSED_RE.test(sentence) && manifest.business.licenses.length === 0) {
      fail(sentence, `licensing claim but the manifest lists no licenses`);
    }

    // 2. Numeric claims (experience/volume/percentage). Technical spec numbers
    //    ("40-amp circuit") are vocabulary, not claims, and do not match here.
    if (
      VOLUME_CLAIM_RE.test(sentence) ||
      YEARS_CLAIM_RE.test(sentence) ||
      PERCENT_CLAIM_RE.test(sentence)
    ) {
      if (!sentenceResolvesToFact(sentence, facts, town, cluster, { requireNumber: true })) {
        fail(sentence, `numeric claim does not resolve to any in-scope local_facts entry`);
      }
    }

    // 3. Regulatory / local-factual assertions: permit, code, utility,
    //    licensing, rebate patterns stated as requirements or prices.
    if (REG_TOPIC_RE.test(sentence) && REG_ASSERT_RE.test(sentence)) {
      if (!sentenceResolvesToFact(sentence, facts, town, cluster)) {
        fail(
          sentence,
          `regulatory/local-factual claim does not resolve to any in-scope local_facts entry — write around the topic`
        );
      }
    }

    // 4. DEGRADED tier: no proof-dependent claims at all (no publishable jobs).
    if (context.page.tier === "DEGRADED") {
      for (const re of PROOF_CLAIM_PATTERNS) {
        const m = sentence.match(re);
        if (m) {
          fail(sentence, `proof-dependent claim "${m[0]}" on a DEGRADED-tier page (no publishable proof jobs)`);
          break;
        }
      }
    }
  }

  return failures;
}
