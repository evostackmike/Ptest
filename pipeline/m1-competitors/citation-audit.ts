/**
 * pipeline/m1-competitors/citation-audit.ts
 *
 * auditCitations — CONTRACTS §2. Diffs the client's frozen citation crawl
 * (`<fixtureDir>/citations.json`) against the manifest NAP and reports wrong
 * phones/addresses/names, duplicate listings, and missing listings. M8's
 * CITATION_FIX tasks are generated from this output (they precede any new
 * CITATION task — week-one hygiene: wrong phones and duplicates suppress
 * pack rank, so we fix before we build).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CitationIssue, ClientManifest } from "../../core/types.js";
import {
  citationFixtureSchema,
  type CitationListing,
} from "./registry.schema.js";
import { tokenize } from "./profile-competitor.js";

// ---------------------------------------------------------------------------
// NAP normalization
// ---------------------------------------------------------------------------

/** Last 10 digits — tolerant of formatting and a leading country code. */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D+/g, "").slice(-10);
}

/** Legal suffixes ignored when comparing name variants. */
const LEGAL_SUFFIXES = new Set(["llc", "inc", "co", "corp", "ltd", "pllc", "llp"]);

/**
 * Case/punctuation-insensitive, legal-suffix-insensitive canonical name.
 * "Crescent Electric LLC" == "Crescent Electric";
 * "Crescent Electric Services" is a reportable variant.
 */
export function normalizeName(name: string): string {
  const tokens = tokenize(name);
  while (tokens.length > 1 && LEGAL_SUFFIXES.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return tokens.join(" ");
}

/**
 * The manifest's base location has no street line (city/state/zip only), so
 * the v0.1 address check verifies the listing address carries the right
 * city, state, and zip. // V05: street-level diff once the manifest carries
 * a street address for storefront clients.
 */
export function addressMatchesBase(
  address: string,
  base: { city: string; state: string; zip: string }
): boolean {
  const tokens = new Set(tokenize(address));
  return (
    tokenize(base.city).every((t) => tokens.has(t)) &&
    tokens.has(base.state.toLowerCase()) &&
    tokens.has(base.zip.toLowerCase())
  );
}

// ---------------------------------------------------------------------------
// auditCitations
// ---------------------------------------------------------------------------

export function auditCitations(
  fixtureDir: string,
  manifest: ClientManifest
): CitationIssue[] {
  const path = join(fixtureDir, "citations.json");
  const parsed = citationFixtureSchema.safeParse(
    JSON.parse(readFileSync(path, "utf8"))
  );
  if (!parsed.success) {
    throw new Error(
      `Invalid citation fixture ${path}: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`
    );
  }
  const { expectedSources, listings } = parsed.data;

  const base = manifest.locations.base;
  const expectedName = manifest.business.legal_name;
  const expectedPhone = manifest.business.phone_nap;
  const expectedAddress = `${base.city}, ${base.state} ${base.zip}`;

  const issues: CitationIssue[] = [];
  const seenPerSource = new Map<string, CitationListing[]>();

  for (const listing of listings) {
    const prior = seenPerSource.get(listing.source) ?? [];
    if (prior.length > 0) {
      issues.push({
        source: listing.source,
        issue: "DUPLICATE_LISTING",
        observed: `${listing.name}${listing.phone ? ` — ${listing.phone}` : ""}`,
        expected: `exactly one listing on ${listing.source}`,
      });
    }
    seenPerSource.set(listing.source, [...prior, listing]);

    if (normalizeName(listing.name) !== normalizeName(expectedName)) {
      issues.push({
        source: listing.source,
        issue: "WRONG_NAME",
        observed: listing.name,
        expected: expectedName,
      });
    }
    if (
      listing.phone !== null &&
      normalizePhone(listing.phone) !== normalizePhone(expectedPhone)
    ) {
      issues.push({
        source: listing.source,
        issue: "WRONG_PHONE",
        observed: listing.phone,
        expected: expectedPhone,
      });
    }
    if (listing.address !== null && !addressMatchesBase(listing.address, base)) {
      issues.push({
        source: listing.source,
        issue: "WRONG_ADDRESS",
        observed: listing.address,
        expected: expectedAddress,
      });
    }
  }

  for (const source of [...expectedSources].sort()) {
    if (!seenPerSource.has(source)) {
      issues.push({
        source,
        issue: "MISSING",
        observed: null,
        expected: `${expectedName} — ${expectedPhone} — ${expectedAddress}`,
      });
    }
  }

  return issues.sort(
    (a, b) => a.source.localeCompare(b.source) || a.issue.localeCompare(b.issue)
  );
}
