/**
 * test-support.ts — shared fixture loaders/builders for the M6 gate tests.
 * Test-only; not part of the CONTRACTS §7 surface.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type {
  ArchitecturePage,
  ClientManifest,
  GateContext,
  PageContent,
  PageTier,
  QaConfig,
} from "../../core/types.js";
import { loadQaConfig } from "./qa-config.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

export function fixturePath(name: string): string {
  return join(FIXTURES, name);
}

export function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(fixturePath(name), "utf8")) as T;
}

export function crescentManifest(): ClientManifest {
  return loadFixture<ClientManifest>("manifest.crescent.json");
}

export function plumbingManifest(): ClientManifest {
  return loadFixture<ClientManifest>("manifest.plumbing.json");
}

export function crescentPages(): PageContent[] {
  return loadFixture<PageContent[]>("crescent-location-pages.json");
}

export function crescentIncumbents(): string[] {
  return loadFixture<string[]>("incumbents.crescent.json");
}

export function samplePage(): PageContent {
  return loadFixture<PageContent>("sample-local-page.json");
}

export function plumbingPage(): PageContent {
  return loadFixture<PageContent>("plumbing-page.json");
}

export function crescentQaConfig(): QaConfig {
  const res = loadQaConfig(fixturePath("qa-config.crescent.json"));
  if (!res.ok) throw new Error(res.errors.join("; "));
  return res.config;
}

export function plumbingQaConfig(): QaConfig {
  const res = loadQaConfig(fixturePath("qa-config.plumbing.json"));
  if (!res.ok) throw new Error(res.errors.join("; "));
  return res.config;
}

export function archPage(url: string, tier: PageTier = "FULL"): ArchitecturePage {
  return {
    url,
    pageType: "location",
    tier,
    targetQueries: [],
    templateId: "location-v1",
    proofRefs: [],
    internalLinks: [],
    priority: 1,
    status: "PLANNED",
  };
}

export function makeContext(overrides: Partial<GateContext> & { pageUrl?: string; tier?: PageTier } = {}): GateContext {
  const { pageUrl, tier, ...rest } = overrides;
  return {
    manifest: crescentManifest(),
    page: archPage(pageUrl ?? "/locations/palouse-wa", tier ?? "FULL"),
    siblings: [],
    incumbentTexts: [],
    ...rest,
  };
}

export function makePage(overrides: Partial<PageContent> = {}): PageContent {
  return {
    url: "/locations/palouse-wa",
    title: "A page title",
    metaDescription: "A meta description for the page.",
    body: "Some plain body copy about the work we take on around town.",
    faq: [],
    ...overrides,
  };
}
