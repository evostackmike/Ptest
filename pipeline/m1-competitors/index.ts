/**
 * pipeline/m1-competitors — public surface (CONTRACTS §2).
 */

export { buildRegistry } from "./profile-competitor.js";
export { detectSpamSignals } from "./spam-signals.js";
export { auditCitations } from "./citation-audit.js";
export {
  FixtureSerpSource,
  DataForSeoSerpSource,
  type SerpSource,
  type DataForSeoCredentials,
} from "./serp-sweep.js";
export {
  serpCellFixtureSchema,
  citationFixtureSchema,
  competitorRegistrySchema,
  asObservables,
  type SerpCellFixture,
  type CitationFixture,
  type RegistryBusinessExt,
} from "./registry.schema.js";
