/**
 * pipeline/m1-competitors/serp-sweep.ts
 *
 * The SERP data source boundary. Every consumer (buildRegistry) talks to the
 * `SerpSource` interface; at v0.1 the only wired implementation reads frozen
 * fixture JSON from disk. The DataForSEO implementation exists as an
 * interface-conformant stub so the wiring point is typed and visible.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Cell } from "../../core/types.js";
import { serpCellFixtureSchema, type SerpCellFixture } from "./registry.schema.js";

export interface SerpSource {
  /** Every cell this source has an observation for (deterministic order). */
  listCells(): Cell[];
  /** The frozen observation for one cell. Throws if the cell is unknown. */
  fetchCell(cell: Cell): SerpCellFixture;
  /** All observations, ordered by (town, cluster). */
  fetchAll(): SerpCellFixture[];
}

const cellKey = (cell: Cell): string => `${cell.town}__${cell.cluster}`;

/**
 * Reads `<dir>/serp/*.json`, validates each file with `serpCellFixtureSchema`.
 * A malformed fixture is a violated invariant of the frozen research set, not
 * runtime input — it throws with the offending path and zod issues.
 */
export class FixtureSerpSource implements SerpSource {
  private readonly byCell = new Map<string, SerpCellFixture>();

  constructor(fixtureDir: string) {
    const serpDir = join(fixtureDir, "serp");
    const files = readdirSync(serpDir)
      .filter((f) => f.endsWith(".json"))
      .sort();
    for (const file of files) {
      const path = join(serpDir, file);
      const parsed = serpCellFixtureSchema.safeParse(
        JSON.parse(readFileSync(path, "utf8"))
      );
      if (!parsed.success) {
        throw new Error(
          `Invalid SERP fixture ${path}: ${parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")}`
        );
      }
      const key = cellKey(parsed.data.cell);
      if (this.byCell.has(key)) {
        throw new Error(`Duplicate SERP fixture for cell ${key} (${path})`);
      }
      this.byCell.set(key, parsed.data);
    }
  }

  listCells(): Cell[] {
    return this.fetchAll().map((f) => ({ ...f.cell }));
  }

  fetchCell(cell: Cell): SerpCellFixture {
    const hit = this.byCell.get(cellKey(cell));
    if (!hit) {
      throw new Error(`No SERP fixture for cell ${cellKey(cell)}`);
    }
    return hit;
  }

  fetchAll(): SerpCellFixture[] {
    return [...this.byCell.values()].sort((a, b) =>
      cellKey(a.cell).localeCompare(cellKey(b.cell))
    );
  }
}

export interface DataForSeoCredentials {
  /** e.g. from manifest.integrations.dataforseo ("env:DFS_LOGIN"). */
  login: string;
  password: string;
}

/**
 * Interface-only stub: holds credentials, never calls the network at v0.1.
 * // V05: wire DataForSEO SERP + Business Data endpoints and freeze raw
 * responses to fixtures before they enter the pipeline.
 */
export class DataForSeoSerpSource implements SerpSource {
  constructor(private readonly creds: DataForSeoCredentials) {
    void this.creds;
  }

  listCells(): Cell[] {
    throw new Error("DataForSeoSerpSource not wired at v0.1 — use FixtureSerpSource");
  }

  fetchCell(_cell: Cell): SerpCellFixture {
    throw new Error("DataForSeoSerpSource not wired at v0.1 — use FixtureSerpSource");
  }

  fetchAll(): SerpCellFixture[] {
    throw new Error("DataForSeoSerpSource not wired at v0.1 — use FixtureSerpSource");
  }
}
