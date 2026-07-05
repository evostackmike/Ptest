import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import type { ClientManifest } from "../core/types.js";
import { clientManifestSchema } from "./manifest.schema.js";
import { loadManifest, validateManifest } from "./validate-manifest.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const CRESCENT_PATH = join(HERE, "examples", "crescent-electric.manifest.json");

function crescentRaw(): unknown {
  return JSON.parse(readFileSync(CRESCENT_PATH, "utf8"));
}

/** Deep-clone so each test mutates its own copy. */
function brokenCopy(): Record<string, any> {
  return structuredClone(crescentRaw()) as Record<string, any>;
}

describe("manifest schema (structural)", () => {
  it("parses the Crescent manifest into a ClientManifest (compile-time assignability)", () => {
    const parsed = clientManifestSchema.parse(crescentRaw());
    // Compile-time contract check (CONTRACTS shared convention #8):
    const manifest: ClientManifest = parsed;
    expect(manifest.business.phone_nap).toBe("(509) 903-9411");
    expect(manifest.business.licenses.map((l) => l.number).sort()).toEqual(
      ["2471680", "CRESCLE781QD"]
    );
    expect(manifest.locations.service_area.towns).toHaveLength(8);
    expect(manifest.services.clusters).toHaveLength(6);
    expect(manifest.proof_assets.jobs).toEqual([]);
  });
});

describe("validateManifest — spec §3 gate", () => {
  it("accepts the real Crescent manifest (ok:true) with real extracted values intact", () => {
    const result = validateManifest(crescentRaw());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.business.email).toBe("admin@crescentnw.com");
    expect(result.manifest.business.booking_url).toContain(
      "clienthub.getjobber.com"
    );
    expect(result.manifest.locations.base.lat_lng).toEqual([46.7324, -116.9996]);
    expect(result.manifest.local_facts.length).toBeGreaterThanOrEqual(2);
    expect(
      result.manifest.local_facts.every(
        (f) => f.source_url_or_owner_attestation === "owner_attestation"
      )
    ).toBe(true);
  });

  it("rejects a copy with no base lat_lng, pointing at the exact path", () => {
    const broken = brokenCopy();
    delete broken.locations.base.lat_lng;
    const result = validateManifest(broken);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const hit = result.errors.find((e) => e.path === "locations.base.lat_lng");
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe("ERROR");
  });

  it("rejects out-of-range lat/lng values with an actionable message", () => {
    const broken = brokenCopy();
    broken.locations.base.lat_lng = [467.324, -116.9996];
    const result = validateManifest(broken);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const hit = result.errors.find((e) => e.path === "locations.base.lat_lng");
    expect(hit!.message).toMatch(/lat must be -90\.\.90/);
  });

  it("rejects incomplete NAP (empty phone + empty city) with one actionable error per field", () => {
    const broken = brokenCopy();
    broken.business.phone_nap = "";
    broken.locations.base.city = "";
    const result = validateManifest(broken);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const paths = result.errors.map((e) => e.path);
    expect(paths).toContain("business.phone_nap");
    expect(paths).toContain("locations.base.city");
    for (const e of result.errors) {
      expect(e.message.length).toBeGreaterThan(10); // fix-list, not bare "invalid"
    }
  });

  it("rejects a non-dialable NAP phone", () => {
    const broken = brokenCopy();
    broken.business.phone_nap = "call us!";
    const result = validateManifest(broken);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      result.errors.some(
        (e) => e.path === "business.phone_nap" && /dialable/.test(e.message)
      )
    ).toBe(true);
  });

  it("rejects empty proof_assets.jobs combined with will_provide_job_photos: no", () => {
    const broken = brokenCopy();
    broken.owner_commitments.will_provide_job_photos = {
      yes: false,
      cadence: "never",
    };
    const result = validateManifest(broken);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      result.errors.some(
        (e) => e.path === "proof_assets.jobs" && /G6/.test(e.message)
      )
    ).toBe(true);
  });

  it("accepts empty jobs when the owner WILL provide photos (Crescent's true state)", () => {
    const result = validateManifest(crescentRaw());
    expect(result.ok).toBe(true);
  });

  it("rejects gbp.access_level 'none' without an accepted owner GBP task", () => {
    const broken = brokenCopy();
    broken.gbp.access_level = "none";
    // will_do_gbp_posts is "delegate" in the example → no mitigation
    const result = validateManifest(broken);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      result.errors.some((e) => e.path === "gbp.access_level")
    ).toBe(true);
  });

  it("accepts gbp.access_level 'none' when the owner accepts GBP ops (will_do_gbp_posts: yes)", () => {
    const mitigated = brokenCopy();
    mitigated.gbp.access_level = "none";
    mitigated.owner_commitments.will_do_gbp_posts = "yes";
    const result = validateManifest(mitigated);
    expect(result.ok).toBe(true);
  });

  it("emits a HARD WARN (ok:true + warnings[]) for calls KPI without call tracking", () => {
    const result = validateManifest(crescentRaw()); // Crescent: calls + null tracking
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const w = result.warnings.find(
      (x) => x.path === "integrations.call_tracking"
    );
    expect(w).toBeDefined();
    expect(w!.severity).toBe("WARN");
    expect(w!.message).toMatch(/day-0/);
  });

  it("emits no call-tracking warning when tracking is configured", () => {
    const fixed = brokenCopy();
    fixed.integrations.call_tracking = "callrail:crescent";
    const result = validateManifest(fixed);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.warnings.some((w) => w.path === "integrations.call_tracking")
    ).toBe(false);
  });

  it("rejects non-object input with zod errors, never throws", () => {
    const result = validateManifest("not a manifest");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("loadManifest — I/O as domain failures", () => {
  it("loads and validates the Crescent example from disk", () => {
    const result = loadManifest(CRESCENT_PATH);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.business.legal_name).toBe("Crescent Electric");
    expect(result.warnings).toHaveLength(1); // the calls-KPI warn
  });

  it("returns ok:false (not a throw) for a missing file", () => {
    const result = loadManifest(join(HERE, "examples", "no-such-file.json"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.message).toMatch(/cannot read manifest file/);
  });

  it("returns ok:false (not a throw) for a file that is not JSON", () => {
    // this very test file is on disk and is not JSON
    const result = loadManifest(fileURLToPath(import.meta.url));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.message).toMatch(/not valid JSON/);
  });
});
