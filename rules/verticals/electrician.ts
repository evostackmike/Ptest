/**
 * rules/verticals/electrician.ts — the electrician vertical profile.
 *
 * Structural vertical knowledge (spec §6 / core/types.ts VerticalProfile):
 * verticals differ structurally — regulated-claim exposure, trust
 * requirements, emergency semantics, seasonality — not just lexically.
 * New vertical intake is a human-expert checkpoint, not a vocab overlay.
 */

import type { VerticalProfile } from "../../core/types.js";

/**
 * Intent modifiers that carry EMERGENCY semantics for electricians: these
 * queries expect 24/7 availability claims, response-time framing, and a
 * phone-first CTA. Pages must never claim emergency service unless the
 * cluster has `emergency_offered: true` in the manifest.
 */
export const ELECTRICIAN_EMERGENCY_MODIFIERS: readonly string[] = [
  "emergency",
  "24 hour",
  "24/7",
  "same day",
  "after hours",
  "power outage",
];

export const electricianProfile: VerticalProfile = {
  verticalId: "electrician",
  schemaType: "Electrician",

  /**
   * Claim categories requiring a verified `local_facts` entry (G8). A
   * hallucinated permit/code claim on a licensed electrician's page is a
   * liability, not a marketing miss — the generator writes around any topic
   * it cannot substantiate. Patterns are topic keys the G8 caller scans for.
   */
  regulatedClaimTopics: [
    "permit requirements",
    "electrical code compliance",
    "national electrical code",
    "inspection requirements",
    "utility rebate or program",
    "licensing requirements",
    "insurance coverage claims",
    "code violation correction",
    "panel amperage requirements",
  ],

  /**
   * Trust elements every electrician page must carry — license identity is
   * the vertical's core trust signal and a legal advertising requirement in
   * both WA and ID.
   */
  requiredTrustElements: [
    "state contractor license number",
    "licensed-bonded-insured statement",
    "service-area statement",
    "NAP consistent with manifest",
    "emergency availability disclosure (only when emergency_offered)",
  ],

  /** Intent modifiers for M2 seed expansion (emergency set included). */
  intentModifiers: [
    "installation",
    "replacement",
    "repair",
    "upgrade",
    "cost",
    "near me",
    "inspection",
    "quote",
    "residential",
    "commercial",
    ...ELECTRICIAN_EMERGENCY_MODIFIERS,
  ],

  /**
   * Month → relative demand multiplier. Electrician demand skews to late
   * spring–summer (remodels, AC load, new construction) with a small winter
   * bump from heating/outage failures; deep winter is the trough.
   */
  seasonality: {
    1: 0.9,
    2: 0.85,
    3: 0.95,
    4: 1.05,
    5: 1.15,
    6: 1.2,
    7: 1.2,
    8: 1.15,
    9: 1.05,
    10: 1.0,
    11: 0.95,
    12: 0.95,
  },

  /** Hard prohibitions for generated electrician content. */
  prohibitions: [
    "never publish DIY instructions for permit-required electrical work",
    "never claim emergency service for clusters without emergency_offered",
    "never guarantee permit approval or inspection outcomes",
    "never state code requirements without a verified local_facts entry (G8)",
    "never advertise work in a state without a manifest license (G15)",
  ],
};
