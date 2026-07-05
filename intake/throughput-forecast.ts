/**
 * intake/throughput-forecast.ts — per-cell stall-probability forecast
 * (CONTRACTS §1, spec §3 "Intake also runs throughput-forecast.ts").
 *
 * The engine's most common failure mode is human PROOF_COLLECT / GBP /
 * review-ask tasks going OVERDUE. This forecast shows the client, on day one,
 * how likely each cell (town × cluster) is to stall given what the owner has
 * actually committed (owner_commitments.hours_per_month).
 *
 * THE MODEL (deterministic — same manifest in, same numbers out; no clock,
 * no randomness):
 *
 * 1. Cells = every town in locations.service_area.towns × every cluster in
 *    services.clusters with capacity === true (no capacity → the engine never
 *    plans work there, so nothing can stall).
 *
 * 2. Each cell accrues a monthly HUMAN-LABOR DEMAND estimate (minutes/month),
 *    from the three task families intake can foresee:
 *      a. PROOF_COLLECT — G6 needs 2 publishable jobs per town×cluster for
 *         FULL tier. Each missing job ≈ MINUTES_PER_PROOF_JOB of owner time
 *         (photograph, describe, grant permission). If the owner will not
 *         provide photos at all, the demand still exists but can never be
 *         served — those cells saturate.
 *      b. REVIEW ASKS — will_ask_for_reviews.expected_per_month asks ×
 *         MINUTES_PER_REVIEW_ASK, spread evenly across all cells (reviews
 *         accrue to the profile, not a cell, so every cell shares the load).
 *      c. GBP WORK — spot-check transcriptions and G13-throttled edits hit
 *         priority cells (priority_towns × goals.target_clusters_ranked):
 *         GBP_MINUTES_PER_PRIORITY_CELL each. If will_do_gbp_posts is
 *         "delegate", the owner still reviews/approves, at half weight.
 *
 * 3. Capacity per cell = committed minutes spread evenly across cells that
 *    have non-zero demand (idle cells consume no capacity).
 *
 * 4. stallProbability = demand / (demand + capacityShare)  — a saturating
 *    ratio in [0, 1): 0 when the cell needs no human labor; → 1 as committed
 *    capacity vanishes relative to demand. Monotonically decreasing in
 *    hours_per_month, which is the property the client needs to see ("2 hrs
 *    vs 10 hrs per month changes every cell's stall odds").
 *
 * V05: replace the even capacity split with the real M8 wave scheduler's
 * allocation and calibrate the constants against observed OVERDUE rates from
 * plan-tracker history.
 */

import type {
  Cell,
  ClientManifest,
  ThroughputForecast,
  ThroughputForecastCell,
} from "../core/types.js";

/** Owner minutes to collect ONE publishable proof job (photos + notes + permission). */
export const MINUTES_PER_PROOF_JOB = 20;
/** G6 FULL-tier threshold: publishable jobs needed per town×cluster. */
export const PROOF_JOBS_REQUIRED = 2;
/** Owner minutes per review ask (pick customer, send, log). */
export const MINUTES_PER_REVIEW_ASK = 5;
/** Owner minutes/month of GBP spot-check + edit work per priority cell. */
export const GBP_MINUTES_PER_PRIORITY_CELL = 15;

export function throughputForecast(manifest: ClientManifest): ThroughputForecast {
  const committedMinutesPerMonth =
    manifest.owner_commitments.hours_per_month * 60;

  const towns = manifest.locations.service_area.towns;
  const clusters = manifest.services.clusters.filter((c) => c.capacity);
  const cells: Cell[] = [];
  for (const town of towns) {
    for (const cluster of clusters) {
      cells.push({ town: town.slug, cluster: cluster.cluster_id });
    }
  }

  const publishableJobs = (cell: Cell): number =>
    manifest.proof_assets.jobs.filter(
      (j) =>
        j.town === cell.town &&
        j.service_cluster === cell.cluster &&
        j.permission_to_publish
    ).length;

  const prioritySet = new Set(manifest.locations.priority_towns);
  const targetClusterSet = new Set(manifest.goals.target_clusters_ranked);
  const reviewAsksPerMonth = manifest.owner_commitments.will_ask_for_reviews.yes
    ? manifest.owner_commitments.will_ask_for_reviews.expected_per_month
    : 0;
  const reviewMinutesPerCell =
    cells.length > 0
      ? (reviewAsksPerMonth * MINUTES_PER_REVIEW_ASK) / cells.length
      : 0;
  const gbpWeight =
    manifest.owner_commitments.will_do_gbp_posts === "delegate" ? 0.5 : 1;

  // Pass 1: per-cell demand.
  const demands = cells.map((cell) => {
    const drivers: string[] = [];
    let demand = 0;

    const missingJobs = Math.max(0, PROOF_JOBS_REQUIRED - publishableJobs(cell));
    if (missingJobs > 0) {
      const proofMinutes = missingJobs * MINUTES_PER_PROOF_JOB;
      demand += proofMinutes;
      drivers.push(
        `PROOF_COLLECT: ${PROOF_JOBS_REQUIRED - missingJobs}/${PROOF_JOBS_REQUIRED} publishable jobs for ${cell.town}×${cell.cluster} (~${proofMinutes} owner-min/mo)`
      );
      if (!manifest.owner_commitments.will_provide_job_photos.yes) {
        drivers.push(
          "owner will NOT provide job photos — proof demand can never be served"
        );
      }
    }

    if (reviewMinutesPerCell > 0) {
      demand += reviewMinutesPerCell;
      drivers.push(
        `review-ask share: ${reviewAsksPerMonth} asks/mo spread over ${cells.length} cells (~${round1(reviewMinutesPerCell)} min/mo)`
      );
    }

    if (prioritySet.has(cell.town) && targetClusterSet.has(cell.cluster)) {
      const gbpMinutes = GBP_MINUTES_PER_PRIORITY_CELL * gbpWeight;
      demand += gbpMinutes;
      drivers.push(
        `GBP spot-checks/edits (priority cell${gbpWeight < 1 ? ", delegated: approval only" : ""}): ~${round1(gbpMinutes)} min/mo`
      );
    }

    return { cell, demand, drivers };
  });

  // Pass 2: even capacity split across cells that actually need human labor.
  const activeCells = demands.filter((d) => d.demand > 0).length;
  const capacityShare =
    activeCells > 0 ? committedMinutesPerMonth / activeCells : 0;

  const forecastCells: ThroughputForecastCell[] = demands.map(
    ({ cell, demand, drivers }) => {
      const stallProbability =
        demand === 0 ? 0 : demand / (demand + capacityShare);
      const allDrivers =
        demand === 0
          ? ["no foreseeable human tasks for this cell"]
          : [
              ...drivers,
              `${manifest.owner_commitments.hours_per_month} owner-hours/mo across ${activeCells} cells needing labor (~${round1(capacityShare)} min/mo available here)`,
            ];
      return { cell, stallProbability: round4(stallProbability), drivers: allDrivers };
    }
  );

  return { cells: forecastCells, committedMinutesPerMonth };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
