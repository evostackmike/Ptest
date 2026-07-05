# m1-competitors fixtures

All external data (DataForSEO SERP + Business Data, citation crawls) is frozen
here as JSON. Tests never touch the network. Values are transcribed from the
Crescent Electric research set (`/workspace/crescent-electric/docs/
competitor-analysis.md`, `pullman-competitors.md`, `seo-research.md`,
research date 2026-05-13): Cheetah Electric 258 reviews / 4.9★ / 47-yr tenure,
Gropp 60 / 4.6, Artizan 54 / 4.9, Wireworks 34 / 4.9, Mountain City 27 / 5.0,
Omega 15 / 4.6, ECNW 10 / 5.0. Addresses/distances are plausible
reconstructions (research docs record town, not centroid distance). Client NAP
data (phone, email) is synthetic — the real NAP lives only in a real client
manifest.

## Layout

- `serp/<town-slug>__<cluster-id>.json` — one frozen SERP pull per cell
  (town × cluster), the layout `buildRegistry(fixtureDir, …)` expects under
  `<fixtureDir>/serp/`. Shape = `serpCellFixtureSchema` in
  `../registry.schema.ts`:
  - `cell`, `query` (head query the pull was made for), `capturedAt`
  - `furniture` — LSA present / ads count / directory-stacked organic
  - `pack[]` — the observed pack top-3 in rank order, with observable-only
    fields (review count, rating, distance-from-centroid, primary category,
    site depth, schema flag) plus `reviewHistory[]` (weekly ledger snapshots —
    feeds the review-burst spam heuristic)
  - `organic[]` — organic top results in rank order; `businessId: null` rows
    are directory/site-only results that get url-derived ids in the snapshot
- `citations.json` — frozen crawl of the CLIENT's citation listings across
  directories, plus `expectedSources` (where a listing should exist). Consumed
  by `auditCitations(fixtureDir, …)` from `<fixtureDir>/citations.json`.
  Seeded issues: duplicate Yelp listing with a wrong phone and name variant,
  wrong address on BBB, wrong phone on Angi, missing Nextdoor listing.
- `manifest.crescent.json` — test-only `ClientManifest` (synthetic NAP) used
  by m1/m3 tests. Not a shipping client manifest.

## Seeded synthetic entries (not real businesses)

- `b-pullman-best-electrician-pros` ("Pullman Best Electrician Pros",
  pullman-wa__electrician pack #3): keyword-stuffed name (city + service +
  promo qualifiers), PO Box address, review burst 6 → 48 in one week.
  Exists to prove the spam heuristics fire — and that they do NOT fire on
  real names like "Pullman Heating & Electric".
- `b-crescent-electric-supply` ("Crescent Electric Supply Co.", cesco.com):
  the national distributor brand-collision entry — a real SERP hazard for the
  "Crescent Electric" brand, present in moscow-id__electrician organic.
- `b-crescent-electric`: the client itself (organic #7 for
  "electrician pullman wa", 3 reviews) — source of the M3 review-gap
  clientCount.
