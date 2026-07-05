# pipeline/m2-keywords/fixtures

Synthetic, hand-frozen fixtures for the M2 keyword tests. Authored 2026-07 to
encode the spec §4-M2 acceptance scenarios; nothing here was fetched at test
time and tests never touch the network.

| File | Shape (core/types.ts) | Purpose |
|------|----------------------|---------|
| `manifest.crescent.json` | `ClientManifest` | Copy of `intake/examples/crescent-electric.manifest.json` (frozen 2026-07) — the reference client: 6 clusters, 8 towns, `do_not_offer: ["solar installation", "HVAC", "appliance repair"]`, empty proof registry. |
| `registry.crescent.json` | `CompetitorRegistry` | Frozen M1-style output for the market-existence gate. Cells WITH markets: pullman/moscow/colfax×panel + pullman/moscow×ev (pack renders); pullman×rewiring (no pack, but 4 non-directory organic incumbents). Cells WITHOUT markets: spokane×panel (no pack, organic 100% directory-stacked — all 10 results are mega-domains); every generator/hot-tub/lighting cell (no snapshot at all → market unobserved). |
| `volume.json` | `Record<string, number>` | The ONLY source of volume numbers (real-vendor stand-in). Includes a real `0` (`ev charger installation cost pullman`) and a volume-rescued no-snapshot query (`generator installation pullman`: 20 ≥ G5_MIN_REAL_VOLUME). Any query absent here must surface as `volume: null` — never an invented number. |
| `serp-overlap.json` | `SerpSnapshot[]` | Per-QUERY organic top-10 sets for `validateClusters`. **Convention: `cell.cluster` holds `slugifyQuery(query)`** because `SerpSnapshot` has no query field; `cell.town` is the query's town. Encodes the four §18 scenarios below. |

## serp-overlap.json scenarios (overlap = shared / min-set-size, mega-domains excluded)

1. **Merge** — `ev charger installation pullman` (cluster `ev`) vs
   `ev charging station install pullman` (cluster `ev-station`): 8 non-mega
   results each, 6 shared → 0.75 ≥ 0.60 → clusters merge into `ev`
   (lexicographic representative).
2. **Split** — `electrical panel upgrades pullman` and
   `hot tub wiring pullman` both seeded into cluster `panel`: 10 non-mega
   each, 2 shared → 0.20 < 0.30 → the hot-tub query splits out to
   `panel--split--hot-tub-wiring-pullman`.
3. **Borderline** — `home rewiring pullman` vs
   `knob and tube replacement pullman` (both `rewiring`): 4/10 shared → 0.40
   → stays put.
4. **Mega-domain exclusion** — `lighting installation pullman` (`lighting`)
   vs `landscape lighting pullman` (`landscape`): the two SERPs share the
   SAME five directory URLs (yelp/angi/homeadvisor/thumbtack/houzz) plus one
   real site → naive raw overlap 6/10 = 0.60 would merge, but after mega
   exclusion the overlap is 1/5 = 0.20 → the clusters correctly stay split.
