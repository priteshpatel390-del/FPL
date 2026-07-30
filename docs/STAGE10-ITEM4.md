# Stage 10.4 — Operating Review and Export

Status: **approved implementation candidate on `agent/stage10-4-operating-review-export`; full repository verification, generated artefacts, physical iPhone acceptance and owner merge approval remain pending.**

Focused Stage 10.4 harness: **12/12 tests passing**, zero failures and zero skipped. This focused result verifies the new review/export logic in isolation; it is not a substitute for `./run-tests.sh`, the production build or deterministic exact-identity rebuild.

## Objective

Turn immutable Stage 10.1 snapshots, Stage 10.2 Official FPL outcomes and Stage 10.3 evaluations into useful phone-first weekly and cumulative operating reviews plus deterministic analysis-friendly exports. Stage 10.4 organises existing evidence only. It does not recreate historical predictions, alter production formulas or claim validated model accuracy from small samples.

## Delivered scope

- A pure downstream operating-review module with explicit review, bundle and export schema versions.
- A one-Gameweek review covering snapshot/outcome/evaluation status, completeness, points, minutes, uncertainty, frozen XI, captaincy, bench, transfer horizons, Provider Health, corrections and warnings.
- A cumulative season review with separate overall and schedule-aligned evidence, one approved segment at a time, coverage/missingness trends, provider-state context and non-summed frozen transfer horizons.
- Current-revision analytical selection with correction-aware revision manifests and explicit pruned-record reporting.
- Hash-linked weekly and season JSON bundles containing exact available validated Stage 10 source records plus derived reviews.
- Deterministic Markdown summaries.
- Eight tidy CSV exports: Gameweeks, Players, Minute Fixtures, Squad Decisions, Transfer Horizons, Transfer Horizon Gameweeks, Provider States and Revisions.
- RFC 4180 CSV, UTF-8 BOM, CRLF line endings, fixed columns and deterministic row ordering.
- Typed spreadsheet-formula-injection protection that preserves genuine negative numeric metrics while neutralising dangerous text.
- Phone-first UI under More → Deadline evidence → Operating review, with Gameweek/season selection, dynamic one-dimension segmentation, lazy expandable details and on-demand downloads.
- A 10 MiB warning and 25 MiB hard file limit. Generated exports are not retained locally.

## Authority boundary

1. Validated immutable Stage 10 source records and their IDs/hashes remain authoritative.
2. The JSON bundle manifest and hashes provide transport and tamper detection.
3. Weekly/cumulative reviews, CSV and Markdown are deterministic convenience outputs.
4. Google Sheets remains a non-authoritative analysis destination.

The live workbook is the intended manual-import destination. The historical workbook remains read-only and must not receive 2026/27 live records. Direct Google Sheets writes remain excluded.

## Weekly review contract

The weekly review exposes:

- snapshot status: official, recorded only, recovery only or unavailable;
- outcome status: provisional, complete, corrected or unavailable;
- evaluation status: current, corrected, pending, excluded or unavailable;
- full-evidence and evaluation completeness separately;
- matched, missing, schedule-aligned and unallocatable coverage;
- player MAE, RMSE, bias, means and approved error bands;
- player–fixture minutes and probability evidence without converting missing values to zero;
- uncertainty interval coverage and unchanged blank/return/haul probabilities;
- frozen XI realised points/rank and prominently labelled Hindsight oracle;
- captain/vice fallback and bench/automatic-substitution evidence;
- completed frozen transfer horizons or an explicit no-partial-result pending state;
- frozen Provider Health context;
- correction, supersession, pruning and source identity detail;
- fixed sample warnings.

## Cumulative review contract

- Highest valid current evaluation revision per logical Gameweek.
- No duplicate contribution from superseded records.
- Overall and schedule-aligned reports remain separate.
- One approved segment dimension/value at a time.
- Provider comparisons require the existing observation-and-Gameweek threshold and remain observational, not causal.
- Frozen transfer horizons remain individual records because they can overlap or represent alternatives; no season transfer score is produced.
- No composite accuracy score, significance test, confidence interval, validated-accuracy language or automatic model update.

## Export schemas

### JSON

`operatingReviewBundle` schema `1.0.0` includes:

- profile and Gameweek scope;
- deterministic evidence-through timestamp derived from included records;
- version sets and build identities;
- explicit completeness and missing full-record IDs;
- correction-aware manifest;
- exact available source records;
- weekly reviews;
- cumulative review;
- manifest, review-data and whole-bundle SHA-256 hashes;
- deterministic bundle ID.

### CSV

All tables carry applicable source bundle, source record and version identifiers. JSON `null` becomes an empty CSV field; genuine zero remains numeric zero. Arrays and objects use canonical JSON text. Text beginning, after leading whitespace, with `=`, `+`, `-` or `@`, or beginning with tab/carriage return, is prefixed with an apostrophe before RFC 4180 quoting.

### Markdown

Markdown is a human-readable convenience summary. It repeats the descriptive-evidence warning, correction/missingness context, Hindsight oracle label and integrity hashes.

## Storage and performance

- Exports are generated on demand from validated available records.
- No export cache or new local-storage family is introduced.
- Work is loaded and rendered lazily where detail can be large.
- Files above 10 MiB require confirmation; files above 25 MiB fail without truncation.
- No ZIP, gzip export, `.xlsx`, dependency, database or backend is introduced.
- Browser recovery bounds for snapshots, outcomes and metrics remain unchanged.

## Security and privacy

- Export construction is allowlist-based and reuses Stage 10 evidence safety checks.
- No arbitrary application state, raw provider response or configuration is serialised.
- API keys, secrets, entry/team/league identifiers, manager name, email and phone remain excluded.
- Derived CSV and Markdown omit the anonymous manager reference. Exact embedded canonical records are not rewritten because that would invalidate their hashes.
- CSV formula-injection defence is tested across dangerous prefixes and leading whitespace.
- Source, manifest and bundle hashes detect changes but do not authenticate the external author or notarise time.

## Deliberately unchanged

No projection, expected-minutes, scoring, calibration, fixture, uncertainty, captaincy, best-XI, squad-selection, transfer-optimiser, provider blend or production threshold changed. No model code is imported or executed by the review module. No new network origin, provider, authentication, direct Sheets write, serverless service, database, scheduled export, schema migration, model update, composite score or Stage 10.5 hardening was added.

## Verification status

Completed before the candidate commit:

- JavaScript syntax checks for the new evidence, UI and test modules;
- focused Stage 10.4 harness: **12/12 passing**;
- static guards confirming no `projectXP`, `minutesEstimate`, `simulatePlayerGameweek` or `optimiseTransfers` path;
- static guards confirming no runtime style API or inline-style use in the new UI module;
- recovery-only snapshot labelling and local-current revision-pointer tests.

Still required before completion:

- all pre-existing tests plus Stage 10.4 review/export tests;
- weekly/cumulative derivation, revisions, missing/pruned records and transfer-horizon states;
- deterministic JSON, CSV, Markdown, ordering, filenames and hashes;
- blank/single/double/postponed schedule behaviour inherited from exact Stage 10.3 rows;
- CSV injection and privacy rejection;
- 38-Gameweek synthetic export/size boundaries;
- mobile UI wiring and class-only presentation;
- successful production build;
- two byte-identical exact-identity builds;
- root/deployable equality.

## Remaining limitations

- Browser storage cannot manufacture or restore a full snapshot already pruned or never captured.
- A season raw-evidence bundle can be partial even when cumulative metric records remain usable.
- Manager transfer identities remain unavailable.
- Starts and Double Gameweek minute allocation can remain missing.
- Static GitHub Pages cannot export while the app is closed or suspended.
- Google Sheets import is manual.
- CSV and Sheets copies are editable; hashes provide traceability rather than immutability.
- Prospective sample size begins near zero. Infrastructure integrity does not establish prediction accuracy or probability calibration.
- Physical iPhone acceptance remains mandatory before merge.

## Physical iPhone acceptance

Pritesh must confirm the weekly/season switch, Gameweek selector, dynamic segment selector, expandable rows, correction language, schedule-aligned distinction, Hindsight oracle labelling, pending horizon behaviour, Files downloads, manual live-workbook CSV import, formula-safe cells, responsive generation and failure messaging. The page itself must not gain horizontal overflow.

## Completion gate

The item is not complete and must not be merged until:

- the exact verification evidence above is recorded;
- generated artefacts match the verified source identity;
- the draft PR is reviewed;
- Pritesh completes physical iPhone acceptance;
- Pritesh explicitly approves merge.
