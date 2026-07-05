/**
 * pipeline/m1-competitors/spam-signals.ts
 *
 * detectSpamSignals — CONTRACTS §2. Pure heuristics over the registry that
 * populate `spamFlags` on facets of suspected-spam businesses. Never mutates
 * its input; returns a new registry.
 *
 * Heuristics (all thresholds are named exported constants so M4/M8 cite the
 * same numbers):
 * - NAME_KEYWORD_STUFFING: business name contains a city token AND a service
 *   token (both from `nameKeywords`, populated by buildRegistry from the
 *   manifest vocabulary) AND at least one promotional qualifier. The
 *   qualifier requirement is what keeps legitimate legal names like
 *   "Pullman Heating & Electric" (city + service, no qualifier) unflagged.
 * - REVIEW_BURST: one inter-observation delta in the fixture review history
 *   is both large in absolute terms and a multiple of the business's own
 *   baseline delta.
 * - ADDRESS_ANOMALY: PO Box / virtual-office / mailbox-store address on a
 *   business competing in a service pack.
 * - DUPLICATE_LISTING: two distinct registry businesses sharing the same
 *   normalized address or website host.
 */

import type {
  CompetitorRegistry,
  RegistryBusiness,
  SpamFlag,
} from "../../core/types.js";
import { asObservables, type ReviewObservation } from "./registry.schema.js";
import { tokenize } from "./profile-competitor.js";

// ---------------------------------------------------------------------------
// Named thresholds
// ---------------------------------------------------------------------------

/** Promotional qualifiers that turn city+service names into stuffing suspects. */
export const SPAM_NAME_QUALIFIERS: readonly string[] = [
  "best", "top", "pro", "pros", "expert", "experts",
  "cheap", "affordable", "1", "no1", "number1",
];

/** Minimum absolute review-count jump between observations to call a burst. */
export const REVIEW_BURST_MIN_DELTA = 15;

/** The burst delta must exceed this multiple of the baseline (median) delta. */
export const REVIEW_BURST_BASELINE_MULTIPLIER = 5;

/** Address patterns no genuine service-area shopfront should carry. */
export const ADDRESS_ANOMALY_PATTERN =
  /\bp\.?\s*o\.?\s*box\b|\bvirtual\s+office\b|\bmailbox\b|\bups\s+store\b/i;

// ---------------------------------------------------------------------------
// Individual heuristics (exported for unit tests)
// ---------------------------------------------------------------------------

/** City tokens = town-slug tokens observed in the registry's own facets. */
function cityTokensFromRegistry(registry: CompetitorRegistry): Set<string> {
  const out = new Set<string>();
  for (const snapshot of registry.snapshots) {
    for (const tok of tokenize(snapshot.cell.town)) {
      if (tok.length > 2) out.add(tok); // drop 2-letter state codes
    }
  }
  for (const business of registry.businesses) {
    for (const facet of business.facets) {
      for (const tok of tokenize(facet.cell.town)) {
        if (tok.length > 2) out.add(tok);
      }
    }
  }
  return out;
}

export function isNameKeywordStuffed(
  business: RegistryBusiness,
  cityTokens: Set<string>
): boolean {
  const hasCity = business.nameKeywords.some((k) => cityTokens.has(k));
  const hasService = business.nameKeywords.some((k) => !cityTokens.has(k));
  const hasQualifier = tokenize(business.name).some((t) =>
    SPAM_NAME_QUALIFIERS.includes(t)
  );
  return hasCity && hasService && hasQualifier;
}

/**
 * Burst = some inter-observation delta ≥ REVIEW_BURST_MIN_DELTA and ≥
 * REVIEW_BURST_BASELINE_MULTIPLIER × the median of the other deltas
 * (min baseline 1). Needs ≥3 observations; velocity proper is the review
 * ledger's job after ~8 weeks of data.
 */
export function hasReviewBurst(history: ReviewObservation[]): boolean {
  const sorted = [...history].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  if (sorted.length < 3) return false;
  const deltas: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    deltas.push(Math.max(0, sorted[i].reviewCount - sorted[i - 1].reviewCount));
  }
  const max = Math.max(...deltas);
  if (max < REVIEW_BURST_MIN_DELTA) return false;
  const rest = [...deltas].sort((a, b) => a - b).slice(0, -1);
  const baseline = Math.max(1, median(rest));
  return max >= REVIEW_BURST_BASELINE_MULTIPLIER * baseline;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function hasAddressAnomaly(address: string | null): boolean {
  return address !== null && ADDRESS_ANOMALY_PATTERN.test(address);
}

const normalizeAddress = (address: string): string =>
  tokenize(address).join(" ");

const websiteHost = (url: string | null): string | null => {
  if (url === null) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
};

// ---------------------------------------------------------------------------
// detectSpamSignals
// ---------------------------------------------------------------------------

export function detectSpamSignals(registry: CompetitorRegistry): CompetitorRegistry {
  const cityTokens = cityTokensFromRegistry(registry);

  // Cross-business collision maps for DUPLICATE_LISTING.
  const byAddress = new Map<string, string[]>();
  const byHost = new Map<string, string[]>();
  for (const business of registry.businesses) {
    const obs = asObservables(business);
    if (obs.address !== null && !hasAddressAnomaly(obs.address)) {
      const key = normalizeAddress(obs.address);
      byAddress.set(key, [...(byAddress.get(key) ?? []), business.businessId]);
    }
    const host = websiteHost(business.websiteUrl);
    if (host !== null) {
      byHost.set(host, [...(byHost.get(host) ?? []), business.businessId]);
    }
  }

  const businesses = registry.businesses.map((business) => {
    const obs = asObservables(business);
    const flags: SpamFlag[] = [];

    if (isNameKeywordStuffed(business, cityTokens)) {
      flags.push("NAME_KEYWORD_STUFFING");
    }
    if (hasAddressAnomaly(obs.address)) {
      flags.push("ADDRESS_ANOMALY");
    }
    if (hasReviewBurst(obs.reviewHistory)) {
      flags.push("REVIEW_BURST");
    }
    const addressPeers =
      obs.address !== null
        ? (byAddress.get(normalizeAddress(obs.address)) ?? [])
        : [];
    const host = websiteHost(business.websiteUrl);
    const hostPeers = host !== null ? (byHost.get(host) ?? []) : [];
    if (addressPeers.length > 1 || hostPeers.length > 1) {
      flags.push("DUPLICATE_LISTING");
    }

    return {
      ...business,
      facets: business.facets.map((facet) => ({
        ...facet,
        cell: { ...facet.cell },
        spamFlags: [...flags],
      })),
    };
  });

  return {
    businesses,
    snapshots: registry.snapshots.map((s) => ({
      ...s,
      cell: { ...s.cell },
      packTop3: [...s.packTop3],
      organicTop10: [...s.organicTop10],
      furniture: { ...s.furniture },
    })),
  };
}
