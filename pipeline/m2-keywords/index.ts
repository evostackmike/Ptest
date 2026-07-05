/**
 * pipeline/m2-keywords — public surface (core/CONTRACTS.md §3).
 */

export {
  expandSeeds,
  expandSeedCandidates,
  resolveVerticalProfile,
  normalizePhrase,
  slugify,
  phraseContainsTerm,
  isEmergencyModifier,
  GENERIC_INTENT_MODIFIERS,
  EMERGENCY_MODIFIER_MARKERS,
  type SeedCandidate,
  type SeedExpansion,
} from "./seed-expand.js";

export {
  validateClusters,
  serpOverlap,
  filterMegaDomains,
  isMegaDomain,
  normalizeSerpId,
  slugifyQuery,
  snapshotForQuery,
  CLUSTER_MERGE_OVERLAP,
  CLUSTER_SPLIT_OVERLAP,
  MEGA_DOMAINS,
} from "./cluster-validate.js";

export {
  buildKeywordMap,
  marketExistsForCell,
  marketExistsForCluster,
  MIN_INCUMBENT_ORGANIC,
  type MarketEvidence,
} from "./demand.js";

export {
  keywordMapSchema,
  keywordEntrySchema,
  keywordClusterSchema,
  parseKeywordMap,
} from "./keyword-map.schema.js";
