/**
 * pipeline/m3-gbp-observables — public surface (CONTRACTS §4).
 */

export {
  gbpDiff,
  headQueryForCell,
  clientReviewCount,
  SPOT_CHECK_PROFILE_COUNT,
  UNKNOWN_CATEGORY,
} from "./gbp-diff.js";
export { generateSpotCheckTasks, SPOT_CHECK_MINUTES } from "./spot-check-gen.js";
