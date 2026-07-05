# pipeline/m6-content/fixtures

All gate tests are fixture-driven; nothing touches the network.

| File | Provenance / shape |
|---|---|
| `manifest.crescent.json` | Full `ClientManifest` for the reference electrician client, hand-built from the reference repo's site data and docs. `proof_assets.jobs` is empty (matches the real M5 regression state); `local_facts` carries two verified entries (county permit fee, serving utility) used by the claim-substantiation pass cases. Phone is a dummy NAP. |
| `manifest.plumbing.json` | Full `ClientManifest` for a synthetic plumbing client ("Bluewater Plumbing", Oregon). Used for the de-Crescenting proof: gates must pass this vertical with zero code edits. |
| `crescent-location-pages.json` | `PageContent[]` — REAL location-page copy (h1 + heroLead + heroParagraph + aboutCity, plus real titles/meta descriptions) copied verbatim from the reference client's `app/locations/_data.ts` for palouse-wa, colfax-wa, troy-id, genesee-id. This is the spec's regression corpus: these pages must FAIL boilerplate-ratio and info-gain. |
| `incumbents.crescent.json` | `string[]` — synthetic crawled body texts of two ranking incumbent competitor pages for the same market. They already carry the generic local entities (county names, town names, university references), so re-mentioning those is zero information gain. |
| `sample-local-page.json` | `PageContent` — hand-written, genuinely-local panel-upgrade page for palouse-wa. Adds local info units the incumbents lack (utility names, permit fee range, panel-brand housing-stock fact) with every regulatory claim resolving to a `local_facts` entry. Must PASS all gates. |
| `plumbing-page.json` | `PageContent` — synthetic drain-cleaning page for the plumbing client. Must pass copy-qa (and the full gate run) with zero code edits, using only `qa-config.plumbing.json`. |
| `qa-config.crescent.json` | `QaConfig` overlay for the reference client. This is where ALL the client vocabulary from the original `copy-qa.mjs` moved: brand terms ("Crescent", "Crescent Electric"), electrician vocab allow-list, and the client-specific banned phrases (`"Moscow shop"`, `"shop in Moscow"`, `"select Spokane-area projects"` — formerly hardcoded `project.*` rules / zero-budget phrases). The gate code itself contains zero client literals. |
| `qa-config.plumbing.json` | `QaConfig` overlay for the synthetic plumbing client (brand + plumbing vocab). |

Notes on the `copy-qa.mjs` port:

- The 14 generic `ai.*` rules moved verbatim into `gates/copy-qa.ts` as engine
  defaults (`DEFAULT_COPY_RULES`).
- The client-specific `project.*` rules and the hardcoded phrase-budget list
  became config data here (banned phrases) plus a *generic* repetition budget
  (any 3-word phrase > 3 repeats, any significant word > 8 repeats, brand/vocab
  terms exempt via config).
- The owner-name-overuse rule (`project.owner-name-overuse`) has no config slot
  at v0.1; add the owner's name to `bannedPhrases` if a client needs a hard cap.
