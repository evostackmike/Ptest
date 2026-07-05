/**
 * pipeline/m4-feasibility/compliance.ts — G15 licensing compliance (spec §6).
 *
 * G15 fires BEFORE anything else in M4: a town whose state no manifest
 * license covers is INFEASIBLE with no further scoring. This module is the
 * standalone predicate (re-exported for rules consumers) — the actual
 * verdict wiring lives in score-cells.ts.
 */

import type { ClientManifest, GuardrailResult, Town } from "../../core/types.js";
import { g15Licensing } from "../../rules/guardrails.js";

/**
 * Derive a town's two-letter state code. The manifest Town carries no state
 * field, so we parse the conventions the manifest already uses:
 *   1. slug suffix — "pullman-wa" → "WA"
 *   2. display-name suffix — "Pullman, WA" → "WA"
 * Returns null when neither yields a two-letter code (caller fails closed).
 */
export function townState(town: Town): string | null {
  const slugTail = town.slug.split("-").at(-1) ?? "";
  if (/^[a-z]{2}$/i.test(slugTail)) return slugTail.toUpperCase();

  const nameTail = town.name.match(/,\s*([A-Za-z]{2})\s*$/)?.[1];
  if (nameTail) return nameTail.toUpperCase();

  return null;
}

/**
 * checkCompliance — the standalone G15 predicate: town state must be covered
 * by a manifest license entry. Unresolvable state → fires (fail closed):
 * compliance is never assumed.
 */
export function checkCompliance(town: Town, manifest: ClientManifest): GuardrailResult {
  const state = townState(town);
  if (state === null) {
    return {
      ok: false,
      ruleId: "G15",
      reason: `G15 fires: cannot determine state for town "${town.slug}" ("${town.name}") — fail closed until the manifest resolves it`,
    };
  }
  return g15Licensing(state, manifest.business.licenses);
}
