# Stage 10.1 — Deadline-safe snapshot foundation

Status: **implemented and locally verified on draft PR #27; owner review and physical iPhone acceptance pending.** Approved 29 July 2026.

## Scope delivered
- Versioned immutable `preDeadlineSnapshot` records.
- Official FPL deadline window, two same-origin network-clock samples, 60-second skew rule, two-minute cutoff and fail-closed timing grades.
- All-player deterministic projection, expected-minutes and live-season uncertainty summaries at the unchanged 5,000-sample production setting.
- Frozen squad, model decision, user preview and exact transfer optimiser evidence when a complete squad is loaded.
- Provider Health/provenance, retry/validation summaries and per-player source-use evidence.
- Canonical JSON, whole-record and eleven section/provider/rule SHA-256 hashes, deterministic IDs, import verification and deadline-revision handling.
- Random anonymous manager reference; FPL Team ID, manager name, league identifiers, config and secrets excluded.
- Bounded local recovery: three metadata rows and two compressed full records, verified writes, quota recovery and explicit delete/reset.
- Complete unencrypted JSON export/import.
- Minimalist startup verification gate with plain-English phases; the app opens only after Official FPL and approved optional providers resolve to a verified live/cache/fallback/disabled state.
- Automatic refresh at startup and when the page returns to the foreground after ten minutes, with intermediate renders suppressed and one consistent final update.
- Automatic eligible evidence capture after verification, with duplicate suppression across open, due-soon, ideal and final windows.
- Compact global status and phone-first More > Deadline evidence surface; export/restore/delete are subordinate recovery controls and no routine user action is required.
- Recovery imports are provider-allowlisted and stored as non-official `recovery_import` records.
- Transfer evidence reuses the exact result already rendered for the same squad/horizon/bank/free-transfer context instead of rerunning the search.

## Performance decision
The first 620-player live-season benchmark exposed an unacceptable runtime above three minutes because invariant fixture components were recalculated inside every Monte Carlo sample. The implementation now precomputes those components once per player/fixture. This is a performance-only refactor: seed, sample count, distributions, scoring and summaries remain unchanged and the full golden suite remains green.

In the repository execution environment, the resulting synthetic benchmark captured 620 players with 5,000 samples each in approximately 2.8–3.5 seconds. Canonical JSON was about 2.2 MB and its browser-local gzip recovery representation about 153 KB. Projection work yields to the browser every 20 players. Physical iPhone startup timing, foreground refresh, automatic capture and recovery restore remain an explicit owner acceptance gate.

## Deliberate exclusions
No closed-app/background service, outcome ingestion, metrics, CSV/season bundle, public/private hosted archive, serverless timestamp, Google Sheets integration or model update. No projection, expected-minutes, scoring, fixture, simulation, captaincy, squad or optimiser formula changes.

## Verification
- Verified source `__SOURCE_SHA__`: full `./run-tests.sh` **349/349 passing**.
- Production build succeeds, two builds are byte-identical and the manifest/deployable record the exact source commit.
- Focused evidence tests cover deadline boundaries, timing grades, provider cutoff, hashes/tampering, deadline changes, privacy, chunking, compression, bounded storage, quota failure, import and delete/reset.

## Remaining acceptance gate
Open the review deployment on Pritesh’s iPhone and verify: status readability, capture progress, no unacceptable interaction lock, JSON download, JSON re-import, local delete/reset and no console-visible error. Stage 10.1 must remain draft until this check is reported.

- The generated root `index.html` deployment copy is byte-identical to `dist/index.html`.
