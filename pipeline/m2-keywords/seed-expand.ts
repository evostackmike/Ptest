/**
 * pipeline/m2-keywords/seed-expand.ts — M2 seed expansion (spec §4-M2,
 * core/CONTRACTS.md §3).
 *
 * Candidate queries = service clusters × towns × the vertical profile's
 * intent modifiers, with `services.do_not_offer` acting as HARD negatives:
 * any candidate containing a do-not-offer term (word-boundary match on
 * normalized text) is excluded and recorded with a reason.
 *
 * Emergency-flavored modifiers are only expanded for clusters with
 * `emergency_offered: true` — pages must never target emergency intent the
 * business cannot serve (mirrors the electrician profile's prohibitions).
 *
 * Pure and deterministic: same manifest → same candidate list, same order.
 */

import type { ClientManifest, Town, VerticalProfile } from "../../core/types.js";
import { electricianProfile } from "../../rules/verticals/electrician.js";

/**
 * Vertical profiles known to the engine at v0.1. New vertical intake is a
 * human-expert checkpoint (spec §6): a real profile must be authored in
 * rules/verticals/ before a vertical gets its structural knowledge.
 */
const KNOWN_PROFILES: readonly VerticalProfile[] = [electricianProfile];

/**
 * Fallback intent modifiers for verticals without an authored profile.
 * Deliberately thin and structurally safe: no emergency semantics, no
 * regulated-claim exposure.
 */
export const GENERIC_INTENT_MODIFIERS: readonly string[] = [
  "installation",
  "repair",
  "replacement",
  "cost",
  "near me",
  "quote",
];

/**
 * Normalized markers identifying emergency-semantics modifiers. A modifier
 * containing any of these (word-boundary) is expanded ONLY for clusters
 * with `emergency_offered: true`.
 */
export const EMERGENCY_MODIFIER_MARKERS: readonly string[] = [
  "emergency",
  "24 hour",
  "24/7",
  "same day",
  "after hours",
  "power outage",
  "urgent",
];

/** Lowercase, "&" → "and", strip punctuation, collapse whitespace. */
export function normalizePhrase(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Slug form of any label/query: normalized phrase with "-" separators. */
export function slugify(s: string): string {
  return normalizePhrase(s).replace(/ /g, "-");
}

/** Word-boundary containment of a normalized term inside a normalized phrase. */
export function phraseContainsTerm(phrase: string, term: string): boolean {
  if (term.length === 0) return false;
  return ` ${phrase} `.includes(` ${term} `);
}

/** True when a modifier carries emergency semantics (see markers above). */
export function isEmergencyModifier(modifier: string): boolean {
  const m = normalizePhrase(modifier);
  return EMERGENCY_MODIFIER_MARKERS.some((marker) =>
    phraseContainsTerm(m, normalizePhrase(marker))
  );
}

/**
 * Resolve the vertical profile for a manifest from
 * `business.entity.schema_type` (matched against profile schemaType or
 * verticalId, case-insensitive). Unknown verticals get a generic fallback
 * profile so expansion still works with zero code edits.
 */
export function resolveVerticalProfile(manifest: ClientManifest): VerticalProfile {
  const schemaType = manifest.business.entity.schema_type.trim().toLowerCase();
  const known = KNOWN_PROFILES.find(
    (p) =>
      p.schemaType.trim().toLowerCase() === schemaType ||
      p.verticalId.trim().toLowerCase() === schemaType
  );
  if (known) return known;
  // V05: authoring a real VerticalProfile in rules/verticals/ is the
  // human-expert new-vertical checkpoint; this fallback only keeps the
  // pipeline structurally sound (thin generic modifiers, no regulated
  // claims, no emergency semantics) — it is not vertical knowledge.
  return {
    verticalId: slugify(manifest.business.entity.schema_type),
    schemaType: manifest.business.entity.schema_type,
    regulatedClaimTopics: [],
    requiredTrustElements: ["NAP consistent with manifest"],
    intentModifiers: [...GENERIC_INTENT_MODIFIERS],
    seasonality: {},
    prohibitions: [],
  };
}

/** One candidate query with its generation metadata (consumed by demand.ts). */
export interface SeedCandidate {
  /** Normalized query text. */
  query: string;
  /** Town slug the query targets; null for town-less hub queries. */
  town: string | null;
  /** Manifest cluster id the candidate was generated from. */
  clusterId: string;
}

export interface SeedExpansion {
  candidates: SeedCandidate[];
  /** Candidates excluded by the do_not_offer hard-negative gate, with reasons. */
  negatives: { query: string; reason: string }[];
}

/** City portion of a town's display name ("Pullman, WA" → "pullman"). */
function townPhrase(town: Town): string {
  const city = town.name.split(",")[0] ?? town.name;
  const normalized = normalizePhrase(city);
  return normalized.length > 0 ? normalized : normalizePhrase(town.slug);
}

/**
 * Full expansion with metadata. `expandSeeds` (the contract surface) is the
 * query-only projection of this.
 */
export function expandSeedCandidates(manifest: ClientManifest): SeedExpansion {
  const profile = resolveVerticalProfile(manifest);
  const negativeTerms = manifest.services.do_not_offer
    .map(normalizePhrase)
    .filter((t) => t.length > 0);
  const towns = manifest.locations.service_area.towns;

  const seen = new Set<string>();
  const negativeSeen = new Set<string>();
  const candidates: SeedCandidate[] = [];
  const negatives: { query: string; reason: string }[] = [];

  const push = (rawQuery: string, town: string | null, clusterId: string): void => {
    const query = normalizePhrase(rawQuery);
    if (query.length === 0 || seen.has(query)) return;
    const hit = negativeTerms.find((t) => phraseContainsTerm(query, t));
    if (hit !== undefined) {
      if (!negativeSeen.has(query)) {
        negativeSeen.add(query);
        negatives.push({
          query,
          reason: `do_not_offer: candidate contains "${hit}" — hard negative, never planned or written about`,
        });
      }
      return;
    }
    seen.add(query);
    candidates.push({ query, town, clusterId });
  };

  for (const cluster of manifest.services.clusters) {
    // No capacity → the business cannot take the work; generating demand for
    // it would plan pages the owner must refuse.
    if (!cluster.capacity) continue;

    const phrase = normalizePhrase(cluster.label);
    if (phrase.length === 0) continue;

    const modifiers = profile.intentModifiers.filter(
      (m) => cluster.emergency_offered === true || !isEmergencyModifier(m)
    );

    // Town-less hub seeds (KeywordEntry.town: null → M5 service-hub pages).
    push(phrase, null, cluster.cluster_id);
    if (modifiers.some((m) => normalizePhrase(m) === "near me")) {
      push(`${phrase} near me`, null, cluster.cluster_id);
    }

    for (const town of towns) {
      const tp = townPhrase(town);
      // Head query for the cell.
      push(`${phrase} ${tp}`, town.slug, cluster.cluster_id);
      for (const modifier of modifiers) {
        const m = normalizePhrase(modifier);
        if (m === "near me") continue; // town-less by nature — handled above
        push(`${phrase} ${m} ${tp}`, town.slug, cluster.cluster_id);
      }
    }
  }

  return { candidates, negatives };
}

/**
 * Contract surface (core/CONTRACTS.md §3): candidate queries from clusters ×
 * towns × the vertical's intent modifiers, do_not_offer terms excluded.
 */
export function expandSeeds(manifest: ClientManifest): string[] {
  return expandSeedCandidates(manifest).candidates.map((c) => c.query);
}
