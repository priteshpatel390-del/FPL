# A3 — Cache and Persistence Resilience

Status: implementation candidate on `agent/a3-cache-persistence-resilience`; owner-approved implementation scope, not approved for merge.

Baseline: GitHub `main` `473cfdb3295d2b896a00c0aa7b1308814bf2e043` (PR #103 merge), accepted baseline 803 tests with deterministic/provenance gates and physical iPhone Safari acceptance.

## Scope

This checkpoint hardens the current browser-side persistence architecture only. It does not implement Cloudflare D1, R2, a data Worker, authentication, cloud migrations, Google Sheets automation, provider changes, calculation changes or `fpl:calib` changes.

The implementation covers:

- explicit compatibility identity for the main Official FPL cache;
- season/version ownership for user configuration, manual squads and Mini-League/rival preferences;
- checked and read-back-verified writes for user-owned persistence;
- truthful session-only warnings when a durable write fails;
- safe manual-squad/config sequencing so a failed squad write cannot persist a new `useManual=true` state;
- preservation of the accepted Atomic Foreground Refresh ordering and `persist_failed` boundary;
- the Odds-key forget action using the decoded/versioned configuration surface rather than writing a raw legacy config shape.

## Main Official FPL cache contract

`fpl:cache` is now written as a compatibility envelope containing:

- record type `teamsheet.main-fpl-cache`;
- cache version 1;
- current repository schema version;
- exact `FPL_RULES.season`;
- fetched timestamp;
- the existing slim Official FPL snapshot payload.

A versioned record is accepted only when cache version, schema and season match. The payload still passes the existing `hydrate()`/core validation before application state is mutated.

The immediately preceding raw cache shape has a narrow compatibility adapter. It is accepted only when its Official FPL event deadlines establish the current season. A previous-season, unsupported-schema, malformed or structurally incompatible record is ignored rather than promoted to current data.

Model/build identity is deliberately not a main-cache acceptance gate: this cache stores Official FPL facts, not derived projections. The existing Minutes, Understat and Odds R1 caches retain their separate schema/model/season contracts and cadence rules unchanged.

## User-owned configuration contract

`fpl:config` version 1 separates:

- season-independent preferences: Understat toggle, transfer horizon, result count and locally held Odds configuration;
- season/account-owned values: Team ID, free transfers, bank and manual-team mode, stored under the current FPL season.

A previous-season or invalid account section is dropped while valid season-independent preferences remain available. An unversioned legacy record cannot prove account-season ownership, so only season-independent preferences are migrated. Deprecated `claudeKey` material is removed during that migration and never rewritten.

Configuration writes use checked JSON serialisation, browser write handling and read-back verification. A failure leaves the current in-memory/UI change active but presents a local persistence warning that the setting may revert after reload. Storage failure is not attributed to Official FPL or an optional provider.

The Odds-key forget action now reads the decoded configuration contract and writes through the same verified versioned surface, preventing a raw legacy config from being reintroduced.

## Manual squad contract

`fpl:squad` version 1 stores:

- record type `teamsheet.manual-squad`;
- exact current season;
- validated player ID and purchase-price pairs.

Unversioned and previous-season manual squads fail closed because player IDs alone cannot establish season ownership safely.

Every manual-squad writer uses verified persistence. A valid add/remove remains active in memory even if browser persistence fails, but the app reports that it is session-only. For additions, the squad must save successfully before configuration is allowed to persist the new manual-team setting. A failed squad save therefore cannot create a durable `useManual=true` state pointing at stale squad bytes.

## Mini-League/rival preference contract

`fpl:mini-leagues` is now version 3 and carries the exact current season. A prior v1/v2 or season-mismatched preference record is not promoted. Current Official FPL league membership is rediscovered and normalized instead; standings, points and rival squads remain session-only.

Mini-League preference writes are read-back verified. On failure the current session selection remains active, the previous durable bytes are left intact where the browser write itself fails, and the UI warns that the change may revert after reload.

## Atomic Foreground Refresh interaction

No refresh orchestration was redesigned.

The accepted ordering remains collection → synchronous atomic commit → render → persistence. Main-cache persistence still runs after the accepted in-memory generation is committed. A cache write failure leaves that generation active, remains `persist_failed`, does not roll back application state, does not change the FPL provider-health classification and does not affect refresh generations.

`src/main.mjs` is unchanged by this checkpoint.

## Validation

Final reviewed source/test head for local validation: `3b6dc0f12ed239381f94f320644621560bd38047`.

All **823 candidate test cases passed locally**. The execution sandbox cannot complete the CPU-heavy `transfer-exact-correction.test.mjs` as one process within its short command ceiling, so its ten unchanged subtests were executed in bounded name-pattern groups; all ten passed. No test was skipped, deleted or weakened. The other 69 test files ran in bounded complete-file batches, including the two exact-transfer performance/scale files.

Focused persistence coverage includes:

- current-season main cache envelope;
- previous-season and unsupported-schema cache rejection;
- narrow legacy current-season cache acceptance;
- malformed cache JSON;
- failed cache replacement preserving previous bytes;
- storage-manager read fallback;
- local storage unavailable;
- quota/write and read-back verification failure;
- legacy configuration migration and season-account rejection;
- manual-squad version/season rejection;
- manual squad write failure and config sequencing;
- removal of unchecked manual-squad builder writers;
- Mini-League version/season rejection and failed write preservation;
- version-safe Odds-key removal;
- existing Atomic Refresh persistence/error-boundary regressions.

Two exact-identity production builds were byte-identical with `BUILD_COMMIT=3b6dc0f12ed239381f94f320644621560bd38047`. Root `index.html` equals `dist/index.html`. Manifest build identity matched the current build inputs.

Validated hashes:

- build-input hash: `be1d47badfff0ad625566a0bdda55656245fa89d4c9ed3045782bf9cefd0216d`;
- source hash: `41799cb5ac38e6f7945d90bdb0e975adce1d09c8f8dc692269fa7b4a270ee772`;
- `dist/app.bundle.js`: `0c159173e13a40bc7328cee651d532bf20ce63cabc1e637ad91546a1f78f9348`;
- `dist/index.html` / root `index.html`: `0bac7afece9ce33789dc6be66081487973d810d20a7028ee2b1aa355529e5f8e`;
- `dist/manifest.json`: `edf63befeea6c2767e720d6c909f513113ba8c9f2c5e74c80bc5a741d9ad420d`.

Permanent GitHub Actions provenance/full-suite verification is still required on the final generated head before review can be considered complete.

## Explicit exclusions

No changes were made to projection formulas, expected minutes, scoring, fixtures, captaincy, squad selection, transfer optimisation, simulation, projected rank, Mini-League calculations, rival calculations, strategy logic, provider identities/endpoints, Understat parsing, Odds market calculations/cadence, Refresh-Load R1 cache cadence/cooldowns, Stage 10 evidence storage, D1/R2/Worker infrastructure or Google Sheets automation.

`fpl:calib` remains untouched. Investigation found that a legacy calibration record can affect projections without a current season/model identity, but changing that behavior crosses the model approval gate and remains a separately gated follow-up.

## Remaining publication gates

Before merge consideration:

1. commit the generated outputs produced from source/test head `3b6dc0f12ed239381f94f320644621560bd38047` as a generated-only commit;
2. update affected canonical summary/roadmap documentation as needed;
3. open a draft PR;
4. obtain permanent GitHub Actions full-suite, deterministic-build, root/deployable, build-identity and reachable-provenance success on the exact generated head;
5. perform any physical iPhone Safari check warranted by the new failure-only persistence warning UI;
6. obtain explicit owner approval before merge.

No merge is approved by this document.
