# Stage 10.1 — Deadline-safe snapshot foundation

Status: **complete and merged through PR #27 at `da76c81f552fd9da5c518e73ccc0fbe966c74444` after owner iPhone acceptance.** Approved and accepted 29 July 2026.

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
- Silent minimalist startup gate showing only the Teamsheet identity and restrained loader; provider and update details remain off-screen unless a genuine failure blocks safe use.
- Automatic refresh at startup and when the page returns to the foreground after ten minutes, with intermediate renders suppressed and one consistent final update.
- Automatic eligible evidence capture is dispatched after verification without extending the startup gate, with duplicate suppression across open, due-soon, ideal and final windows.
- Compact global status and phone-first More > Deadline evidence surface; export/restore/delete are subordinate recovery controls and no routine user action is required.
- Recovery imports are provider-allowlisted and stored as non-official `recovery_import` records.
- Transfer evidence reuses the exact result already rendered for the same squad/horizon/bank/free-transfer context instead of rerunning the search.

## Performance decision
The first 620-player live-season benchmark exposed an unacceptable runtime above three minutes because invariant fixture components were recalculated inside every Monte Carlo sample. The implementation now precomputes those components once per player/fixture. This is a performance-only refactor: seed, sample count, distributions, scoring and summaries remain unchanged and the full golden suite remains green.

In the repository execution environment, the resulting synthetic benchmark captured 620 players with 5,000 samples each in approximately 2.8–3.5 seconds. Canonical JSON was about 2.2 MB and its browser-local gzip recovery representation about 153 KB. Projection work yields to the browser every 20 players. Pritesh accepted the silent loader and startup behaviour on a physical iPhone; the apparent white top strip in the downloaded review file was confirmed as the iOS/ChatGPT local-file preview container rather than Teamsheet presentation.

## Deliberate exclusions
No closed-app/background service, outcome ingestion, metrics, CSV/season bundle, public/private hosted archive, serverless timestamp, Google Sheets integration or model update. No projection, expected-minutes, scoring, fixture, simulation, captaincy, squad or optimiser formula changes.

## Verification
- Verified source `eb3497ec405d6c7b8ce09105614fcb8280abc34b`: full `./run-tests.sh` **349/349 passing**.
- Production build succeeds, two builds are byte-identical and the manifest/deployable record the exact source commit.
- Focused evidence tests cover deadline boundaries, timing grades, provider cutoff, hashes/tampering, deadline changes, privacy, chunking, compression, bounded storage, quota failure, import and delete/reset.

## Completion record
- Owner iPhone acceptance recorded 29 July 2026.
- Merged through PR #27 at `da76c81f552fd9da5c518e73ccc0fbe966c74444`.
- Verified source `eb3497ec405d6c7b8ce09105614fcb8280abc34b`; generated artefacts `1259e7b5f7505d3330c772e89c77720251552287`.
- The generated root `index.html` deployment copy is byte-identical to `dist/index.html`.
- Stage 10.2 is the next separately scoped checkpoint; no outcome collection or metrics implementation is included here.
