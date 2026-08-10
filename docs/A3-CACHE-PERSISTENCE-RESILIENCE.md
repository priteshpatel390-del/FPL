# A3 — Cache and Persistence Resilience

Status: implementation candidate for PR #104 on `agent/a3-cache-persistence-resilience`; owner-approved implementation scope, corrected after independent review, not approved for merge and not marked ready for review.

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

## Independent-review correction — authoritative backend durability

An independent review of the first candidate found one real persistence defect and it is corrected in this checkpoint.

`src/storage.mjs` reads through `rawStoredText()`, which asks the storage manager first and only consults `localStorage` when the manager read itself throws. The original `ssetChecked()` and `ssetVerified()` fell through to `localStorage` whenever the manager *write* failed and then reported success. When a manager can still serve reads but not writes, that fallback creates a copy no later read can ever return, reported as a durable save — and for `useManual` sequencing a false squad success could durably enable manual-team mode.

The correction makes both surfaces respect the real read order. After a manager failure they probe which backend the next read will use. The `localStorage` fallback is attempted, and reported as saved, only when `localStorage` is that backend; otherwise the operation is reported as a persistence failure and no divergent copy is written.

The coarser alternative — treating any manager failure as a persistence failure — was rejected on repository evidence. It broke the merged Atomic Foreground Refresh contract (`tests/atomic-foreground-refresh.test.mjs`, case 76) that `ssetChecked` falls through to `localStorage` when the manager is unavailable. That contract is legitimate: when the manager cannot serve reads either, the `localStorage` copy genuinely is restorable, so reporting success is factually correct. The two situations are different persistence contracts and both are now covered.

New reason codes `manager_write_failed` (checked surface) and `manager_unverified` (verified surface) are internal classification only; no user-facing copy exposes them.

## Validation

Final source/test commit: `502a1f7ac0e0456743f3ddb0695433decf8976d1`. Generated-only child: `02216b8`.

The complete suite passes **832 tests, 832 passed, 0 failed, 0 skipped, 0 cancelled** through `./run-tests.sh` as a single run. No test was skipped, deleted or weakened, and no golden expectation changed.

Focused persistence coverage includes:

- current-season main cache envelope;
- previous-season and unsupported-schema cache rejection;
- narrow legacy current-season cache acceptance;
- malformed cache JSON;
- failed cache replacement preserving previous bytes;
- storage-manager read fallback;
- local storage unavailable;
- quota/write and read-back verification failure;
- a selected storage manager owning the verified write and the reload read;
- a manager write failure never being reported as a verified `localStorage` success, with the previous durable bytes intact and no divergent copy written;
- the previous durable squad still reloading after an unrestorable manager write;
- a manager cache write failure reported as `persist_failed` rather than a divergent local copy;
- a wholly unusable manager still falling back to a genuinely restorable local write;
- an authoritative-manager squad failure being unable to durably enable manual mode;
- legacy configuration migration and season-account rejection;
- manual-squad version/season rejection;
- manual squad write failure and config sequencing;
- removal of unchecked manual-squad builder writers;
- Mini-League version/season rejection and failed write preservation;
- version-safe Odds-key removal;
- existing Atomic Refresh persistence/error-boundary regressions, retained unchanged.

Committed build provenance verified from reachable source `502a1f7ac0e0456743f3ddb0695433decf8976d1`. Two exact-identity production builds were byte-identical, root `index.html` equals `dist/index.html`, and manifest build identity matched the build inputs.

Validated hashes for the committed deployables:

- build-input hash: `da6f316b0d14c0ac72ed5e96db3811bf0e1f137b3cfd993b921a23177fd96f6b`;
- `dist/app.bundle.js`: `ccf9044847de26861f1b05993df95457f74e079111cda8a285dc4687e5a34e01`;
- `dist/index.html` / root `index.html`: `fa3e25be9fc6985f66f910d5a3a164cc952a8fb51b12027a40f979eb77c154be`;
- `dist/manifest.json`: `51f32fd402191d625afc97a387c598d2961965db21ebd4b1d7c5ba3bf8d4a7b0`.

Permanent Verify Teamsheet must pass on the exact final PR head; earlier runs on superseded heads do not discharge that gate.

## Explicit exclusions

No changes were made to projection formulas, expected minutes, scoring, fixtures, captaincy, squad selection, transfer optimisation, simulation, projected rank, Mini-League calculations, rival calculations, strategy logic, provider identities/endpoints, Understat parsing, Odds market calculations/cadence, Refresh-Load R1 cache cadence/cooldowns, Stage 10 evidence storage, D1/R2/Worker infrastructure or Google Sheets automation.

`fpl:calib` remains untouched. Investigation found that a legacy calibration record can affect projections without a current season/model identity, but changing that behavior crosses the model approval gate and remains a separately gated follow-up.

## Remaining publication gates

Before merge consideration:

1. permanent GitHub Actions full-suite, deterministic-build, root/deployable, build-identity and reachable-provenance success on the exact final PR head;
2. independent review of the final diff;
3. an owner decision on whether the failure-only persistence warning warrants a physical iPhone Safari check;
4. explicit owner approval before merge.

No merge is approved by this document. No physical device testing has been performed for this checkpoint.
