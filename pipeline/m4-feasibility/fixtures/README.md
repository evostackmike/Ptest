# pipeline/m4-feasibility/fixtures

Synthetic, hand-frozen fixtures for the M4 feasibility scorer tests. Nothing
here was fetched at test time — all values were authored 2026-07 to encode
the spec §4-M4 acceptance scenarios. Tests never touch the network.

| File | Shape (core/types.ts) | Purpose |
|------|----------------------|---------|
| `manifest.synthetic.json` | `ClientManifest` | Palouse electrician holding **WA + ID** licenses; towns `pullman-wa` (10 min), `moscow-id` (15 min), `colfax-wa` (35 min), `spokane-wa` (95 min); one `panel` cluster; domain age 18 mo. |
| `manifest.wa-only.json` | `ClientManifest` | Same client with the ID license removed — G15 must make every ID cell (`moscow-id`) INFEASIBLE. Generated from `manifest.synthetic.json` by deleting the ID license entry. |
| `registry.json` | `CompetitorRegistry` | Frozen M1-style output. Encodes the G2 acceptance physics: **Spokane** pack winners are all local (max 4.1 mi observed) so a 95-min client fails the empirical ceiling; **Colfax** pack is won by three ~30-min SABs (22–27.5 mi) so a 35-min client passes. Pullman carries a seeded spam incumbent (`b-spam-volt`, NAME_KEYWORD_STUFFING) and a 258-review incumbent; the client appears as `b-client` (12 reviews). Snapshots carry furniture: Pullman LSA-present, Spokane LSA-present + directory-stacked. |
| `keyword-map.json` | `KeywordMap` | One `panel` cluster with one market-validated head query per town (`volume: null` where no real vendor number exists — never invented), plus one skipped do-not-offer query. |
