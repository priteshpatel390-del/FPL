# STAGE10-ITEM4.md — Operating review/export
Purpose: authoritative implementation and verification record for Stage 10.4. Last updated: 2026-07-30.

## Status
**Implemented and verified on draft PR #35; not merged.** Exact scope was approved by Pritesh before implementation. Physical iPhone acceptance and explicit merge approval remain required.

- Base `main`: `ccfd06a9380714ac987934b5bfd03adba38a2875`
- Branch: `agent/stage10-4-operating-review`
- Verified source: `1eca9a8817da41597d0632c819142237d31627fb`
- Generated artefacts: `1af7dac5383c91e915587218e7551c2f619cec8f`
- Embedded source hash: `d1773a1ae9e36ae28adef232148a3f7e315f21baf989e03e0158c9beefe729ed`
- Tests: **413 passed, 0 failed, 0 skipped**

## Approved purpose
Turn immutable Stage 10.1–10.3 evidence into a practical weekly and season operating review, plus deterministic analysis-friendly exports, without changing any production model or provider behaviour.

## Implemented files
- `src/evidence/review.mjs` — source validation, current-revision selection, weekly/cumulative derivation, deterministic JSON/Markdown/CSV contracts, hashes and size limits.
- `src/ui/review.mjs` — phone-first on-demand controls under More → Deadline evidence.
- `build.mjs` — fixed review module order.
- `tests/review-fixtures.mjs`
- `tests/operating-review.test.mjs`
- `tests/cumulative-review.test.mjs`
- `tests/review-export.test.mjs`
- `tests/review-ui.test.mjs`
- Generated `dist/app.bundle.js`, `dist/manifest.json`, `dist/index.html` and root `index.html`.

## Weekly review
Weekly review is keyed to a current `gameweekEvaluation` revision and exposes source IDs/hashes/revisions, completeness and warnings, player points, fixture-minutes, uncertainty, frozen squad/XI, captaincy, bench and optional manager outcome, provider states, corrections and completed transfer horizons.

Player detail sorts absolute error descending then player ID. Missing or unallocatable minutes remain null, never manufactured zero. The hindsight optimum is labelled **Hindsight oracle (descriptive only)**. An incomplete transfer horizon reports required/missing Gameweeks and exposes no interim gain.

## Cumulative review
Cumulative review selects only current evaluation revisions and presents:
- all matched observations;
- schedule-aligned observations;
- one selected approved segment dimension/value at a time;
- Gameweek coverage/missingness trend;
- existing raw-only/descriptive/potentially-stable sample wording;
- correction/revision audit and observational provider-state context.

It does not aggregate overlapping transfer-horizon gains, create a composite score, classify performance as good/bad, claim significance or calibration, infer provider causality or update the model.

## Export contract
1. Hash-verifiable JSON evidence/review bundle containing exact retained source records, source manifest, weekly reviews, cumulative review and bundle/review hashes.
2. Deterministic Markdown review.
3. Eight individually selectable CSV files: `gameweeks`, `players`, `minute_fixtures`, `squad_decisions`, `transfer_horizons`, `transfer_horizon_gameweeks`, `provider_states`, `revisions`.

Filenames are deterministic and zero-pad Gameweek. No click timestamp is included. CSV is UTF-8 BOM, CRLF and RFC 4180 with fixed columns and deterministic rows. Null is blank; numeric zero remains `0`. Formula-like text is neutralised while genuine negative numbers remain numeric.

## Evidence and revision behaviour
Exact retained records remain authoritative. Analysis uses current evaluation revisions only. Known superseded revision metadata remains visible. Missing/pruned exact records make the bundle and affected reviews explicitly partial. Unsupported source schemas fail closed; migration is not silently attempted.

## Google Sheets boundary
Stage 10.4 performs manual download/import only. The intended destination is the live `Teamsheet — Live Gameweek Log 2026/27` workbook; the historical archive remains separate and read-only. The app stores no spreadsheet ID, OAuth token or Drive credential and performs no unattended append.

## Security and privacy
- Allowlisted Stage 10 fields only; no wholesale app state, configuration, secret or raw provider response.
- Derived review, Markdown and CSV omit manager references.
- Exact canonical JSON source records remain unchanged for hash verification.
- Spreadsheet-formula injection is tested for `=`, `+`, `-`, `@`, tab, carriage return and leading whitespace.
- No new CSP origin, relay, backend, database, scheduler or authentication flow.

## Storage and performance
Review/export is generated on demand and is not retained as an additional local record. A warning is returned above 10 MiB and export fails above 25 MiB; no silent truncation, ZIP, compression or automatic splitting is provided. A synthetic 38 × 700 case covers 26,600 player rows and equivalent fixture-minute rows under a 10-second test ceiling.

## Failure behaviour
- Invalid/tampered source: exclude and mark partial; never recompute from current model code.
- Provisional outcome: no authoritative evaluation.
- Pruned full revision: retain metadata and mark partial.
- Incomplete transfer horizon: pending only; no partial gain.
- Unknown schema: fail closed and report; migration belongs to a later approved item.
- Over 25 MiB: reject the requested export; never truncate.

## Verification evidence
GitHub Actions materialised the final source by immutable Git blob identity, verified final source SHA-256 values, ran `./run-tests.sh`, rebuilt with the same `BUILD_COMMIT`, compared all generated bytes and confirmed root `index.html` equals `dist/index.html`.

- Test runner: 413 tests, 413 passed, 0 failed/cancelled/skipped/todo; 4.58 seconds.
- Build output: 509,268-byte `dist/index.html`; model `2.4.0`; rules `2026-27.3`.
- Exact-identity comparison: `dist/index.html`, `dist/app.bundle.js`, `dist/manifest.json` byte-identical across both builds.
- Manifest commit: `1eca9a8817da41597d0632c819142237d31627fb`; source hash: `d1773a1ae9e36ae28adef232148a3f7e315f21baf989e03e0158c9beefe729ed`.

## Deliberately unchanged
Projection, expected-minutes, scoring, calibration, fixtures, uncertainty simulation, squad selection, captaincy, transfer optimisation, provider transport/validation, source allowlists, storage limits for earlier evidence stages, primary navigation and deployment hosting.

## Remaining limitations and review gate
Local evidence retention can make a season bundle partial. CSVs are individual downloads; no XLSX/ZIP/direct Sheets sync exists. Provider comparisons remain observational. Prospective sample size begins at zero. Static phone-first checks pass, but physical iPhone acceptance has not yet been recorded.

PR #35 must remain draft and unmerged until Pritesh reviews the UI/exports, completes physical iPhone acceptance and explicitly approves merge.
