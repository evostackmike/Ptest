/**
 * intake/validate-manifest.ts — spec §3 validation gate (CONTRACTS §1).
 *
 * `validateManifest` wraps the structural zod schema and layers the spec §3
 * gate rules on top, returning either the parsed ClientManifest (plus WARNs)
 * or an actionable fix-list. `loadManifest` adds file I/O + JSON parsing as
 * domain failures (never throws). A tsx-runnable CLI entry at the bottom
 * prints the fix-list on rejection.
 *
 * Gate rules (spec §3 "Validation gate"):
 *  ERROR  incomplete NAP (legal_name / phone_nap / base city+state+zip)
 *  ERROR  missing or malformed locations.base.lat_lng
 *  ERROR  proof_assets.jobs empty AND will_provide_job_photos.yes === false
 *  ERROR  gbp.access_level === "none" without mitigation (at v0.1 the only
 *         machine-readable mitigation is owner_commitments.will_do_gbp_posts
 *         === "yes" — the owner accepting the GBP-ops task themselves)
 *  WARN   primary_kpi === "calls" with integrations.call_tracking === null
 *         // V05: this WARN becomes a BLOCKING error at v0.5 — rank without
 *         // lead attribution is not the KPI (spec §3).
 */

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import type {
  ClientManifest,
  ManifestValidationError,
  ManifestValidationResult,
} from "../core/types.js";
import { clientManifestSchema } from "./manifest.schema.js";

/** Map a zod issue path array to the dotted JSON-path style of the spec. */
function dottedPath(path: (string | number)[]): string {
  return path
    .map((seg) => (typeof seg === "number" ? `[${seg}]` : seg))
    .join(".")
    .replace(/\.\[/g, "[");
}

function err(path: string, message: string): ManifestValidationError {
  return { path, message, severity: "ERROR" };
}

function warn(path: string, message: string): ManifestValidationError {
  return { path, message, severity: "WARN" };
}

/** Spec §3 gate rules that operate on a structurally valid manifest. */
function gateChecks(manifest: ClientManifest): {
  errors: ManifestValidationError[];
  warnings: ManifestValidationError[];
} {
  const errors: ManifestValidationError[] = [];
  const warnings: ManifestValidationError[] = [];

  // --- Incomplete NAP -------------------------------------------------------
  const napFields: [string, string][] = [
    ["business.legal_name", manifest.business.legal_name],
    ["business.phone_nap", manifest.business.phone_nap],
    ["locations.base.city", manifest.locations.base.city],
    ["locations.base.state", manifest.locations.base.state],
    ["locations.base.zip", manifest.locations.base.zip],
  ];
  for (const [path, value] of napFields) {
    if (value.trim() === "") {
      errors.push(
        err(
          path,
          `NAP is incomplete: "${path}" is empty. Fill it in — citations, GBP, and schema.org all key off a complete, consistent NAP.`
        )
      );
    }
  }
  // A phone that carries no digits cannot be a NAP phone.
  if (
    manifest.business.phone_nap.trim() !== "" &&
    !/\d{7}/.test(manifest.business.phone_nap.replace(/\D/g, ""))
  ) {
    errors.push(
      err(
        "business.phone_nap",
        `NAP phone "${manifest.business.phone_nap}" does not look like a dialable number. Provide the canonical business phone with at least 7 digits, e.g. "(555) 000-1234".`
      )
    );
  }

  // --- lat_lng plausibility (presence/shape is enforced by the schema) ------
  const [lat, lng] = manifest.locations.base.lat_lng;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    errors.push(
      err(
        "locations.base.lat_lng",
        `[${lat}, ${lng}] is not a valid [lat, lng] pair (lat must be -90..90, lng -180..180). Geo-grid scans and distance math depend on the true base coordinates.`
      )
    );
  }

  // --- Proof pipeline dead-end ----------------------------------------------
  if (
    manifest.proof_assets.jobs.length === 0 &&
    manifest.owner_commitments.will_provide_job_photos.yes === false
  ) {
    errors.push(
      err(
        "proof_assets.jobs",
        "proof_assets.jobs is empty AND will_provide_job_photos is 'no': the proof pipeline is a dead end — FULL-tier pages can never unblock (G6). Either supply past job records or commit to providing photos going forward."
      )
    );
  }

  // --- GBP access without mitigation ----------------------------------------
  // v0.1 mitigation: the owner has accepted the GBP-ops task themselves
  // (will_do_gbp_posts === "yes"). Without any access AND without an owner
  // committed to executing GBP changes, every GBP_EDIT the engine emits is
  // undeliverable.
  if (
    manifest.gbp.access_level === "none" &&
    manifest.owner_commitments.will_do_gbp_posts !== "yes"
  ) {
    errors.push(
      err(
        "gbp.access_level",
        "gbp.access_level is 'none' and no owner has accepted the GBP-ops task (owner_commitments.will_do_gbp_posts !== 'yes'). Grant manager access to the profile, or have the owner commit to executing GBP edits themselves."
      )
    );
  }

  // --- Calls KPI without call tracking → HARD WARN at v0.1 -------------------
  // V05: upgrade this to a BLOCKING error (spec §3: "BLOCKING at v0.5").
  if (
    manifest.goals.primary_kpi === "calls" &&
    manifest.integrations.call_tracking === null
  ) {
    warnings.push(
      warn(
        "integrations.call_tracking",
        "primary_kpi is 'calls' but call_tracking is null: rank without lead attribution is not the KPI. HARD WARN at v0.1 — a mandatory day-0 task to install call tracking (~$45-65/mo) must ship with the plan. This becomes BLOCKING at v0.5."
      )
    );
  }

  return { errors, warnings };
}

export function validateManifest(raw: unknown): ManifestValidationResult {
  const parsed = clientManifestSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: ManifestValidationError[] = parsed.error.issues.map(
      (issue) => ({
        path: dottedPath(issue.path),
        message: issue.message,
        severity: "ERROR" as const,
      })
    );
    return { ok: false, errors };
  }

  const manifest: ClientManifest = parsed.data;
  const { errors, warnings } = gateChecks(manifest);
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, manifest, warnings };
}

export function loadManifest(path: string): ManifestValidationResult {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    return {
      ok: false,
      errors: [
        err("", `cannot read manifest file "${path}": ${(e as Error).message}`),
      ],
    };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return {
      ok: false,
      errors: [
        err("", `manifest file "${path}" is not valid JSON: ${(e as Error).message}`),
      ],
    };
  }
  return validateManifest(raw);
}

// ---------------------------------------------------------------------------
// CLI entry: npx tsx intake/validate-manifest.ts <path/to/manifest.json>
// Prints a fix-list on rejection (exit 1); warnings + OK on success (exit 0).
// ---------------------------------------------------------------------------

function runCli(argv: string[]): number {
  const path = argv[0];
  if (!path) {
    console.error(
      "usage: npx tsx intake/validate-manifest.ts <path/to/manifest.json>"
    );
    return 2;
  }
  const result = loadManifest(path);
  if (!result.ok) {
    console.error(`REJECTED: ${path}`);
    console.error("Fix-list:");
    for (const e of result.errors) {
      console.error(`  [${e.severity}] ${e.path || "(file)"}: ${e.message}`);
    }
    return 1;
  }
  for (const w of result.warnings) {
    console.warn(`  [WARN] ${w.path}: ${w.message}`);
  }
  console.log(
    `OK: ${path} (${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"})`
  );
  return 0;
}

const isMain =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  process.exit(runCli(process.argv.slice(2)));
}
