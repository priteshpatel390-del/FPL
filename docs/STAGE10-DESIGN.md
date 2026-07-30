# STAGE10-DESIGN.md — Prospective Live-Season Validation
Status: owner-approved on 2026-07-29. Stage 10.1 merged through PR #27; Stage 10.2 through PR #29; Stage 10.3 through PR #32; Stage 10.4 through PR #35 at `6a96096cfa59fd3476aa89c191cc8ca6400d358b` after owner approval. Stage 10.5 is the next investigation and exact-scope approval checkpoint.
Related: STAGE10-ITEM1.md, STAGE10-ITEM2.md, STAGE10-ITEM3.md, PROJECTION_MODEL.md, TESTING.md, DATA_SOURCES.md, SECURITY.md, KNOWN_LIMITATIONS.md.

## Objective
Build a deadline-safe evidence trail for the 2026/27 live season so Teamsheet can compare what it knew before each deadline with what subsequently happened. Stage 10 records evidence and evaluates it; it does not change projection, expected-minutes, scoring, fixture, uncertainty, captaincy, squad or transfer-optimiser formulas.

The completion language is deliberately strict: implementation of collection and metric infrastructure is not proof that the model is accurate or calibrated. Prospective validation remains in progress until enough genuinely pre-deadline observations and final outcomes have accumulated.

## Approved checkpoint sequence
1. **10.1 — Deadline-safe snapshot foundation:** immutable schema, deadline evidence, provenance, hashes, JSON import/export, bounded local recovery and phone-first status controls.
2. **10.2 — Outcome collection:** immutable official player, fixture and optional manager outcomes with correction records.
3. **10.3 — Metrics:** deterministic player, minutes, uncertainty, squad, captaincy, bench and frozen-transfer evaluation.
4. **10.4 — Operating review/export:** weekly and cumulative summaries, completeness review and analysis-friendly exports.
5. **10.5 — Hardening and documentation:** failure recovery, migration discipline, security review and final operational guidance.

Stage 10.4 and 10.5 require separate scopes. Completion of Stage 10.3 does not authorise either.

## 10.1 immutable pre-deadline snapshot
The canonical record type is `preDeadlineSnapshot`. Every record contains:

- schema, metric and segmentation versions;
- season, Gameweek and validated official FPL deadline;
- anonymous per-device manager reference, never FPL Team ID, manager name or league ID;
- capture start/completion times and network-clock evidence;
- exact build commit, source hash, model/rules/simulation versions and frozen rule configuration;
- Provider Health state, freshness, threshold, accepted/rejected counts, retry summary, issues and whether each provider affected the model;
- the restricted model inputs actually used: FPL events, teams, players, fixtures and minute histories, plus Understat, odds and archive/calibration inputs when active;
- all-player expected-minutes outputs;
- all-player next-Gameweek projection components, per-Gameweek horizon totals and aggregate horizon totals;
- all-player uncertainty summaries when available, without raw Monte Carlo samples;
- the real squad, unchanged model best XI/captain/vice decision, temporary user preview and transfer-optimiser baseline/plans when a complete squad exists;
- explicit completeness and quality fields.

All optional material is represented by an explicit state or `null`; missing information is not silently manufactured.

## Deadline and leakage controls
The deadline comes only from the validated official FPL event payload. The approved operating windows are:

- capture opens 24 hours before the deadline;
- a due-soon prompt begins 60 minutes before the deadline;
- the ideal operating window is 20–10 minutes before the deadline;
- the final safe window ends at a two-minute cutoff;
- captures inside the cutoff or after the deadline can be retained only as recorded evidence and cannot become official.

A same-origin HTTP `Date` response is sampled before and after the freeze. Timing grades are `network_attested`, `client_recorded`, `clock_conflict` and `late`.

Official eligibility requires a complete network-attested record inside the 24-hour window, before the two-minute cutoff, with every included provider recorded before the cutoff and no timing reason present. Client-only, conflicted, incomplete, late or post-deadline records fail closed.

The latest complete eligible record for the active deadline is official. A later incomplete record cannot displace an earlier complete one. If the official deadline changes, older-deadline records are not selected for the revised deadline. Missed snapshots are never backfilled or manually backdated.

GitHub Pages cannot cryptographically notarise capture time. Network-attested means the client recorded a same-origin server clock and passed the checks; it is evidence, not an external trusted timestamp.

## Identity, hashing and immutability
Records are canonicalised with sorted object keys, finite JSON numbers, UTC ISO timestamps and deterministic array ordering. Snapshot finalisation produces section/provider/rule SHA-256 hashes, a whole-record hash, deterministic snapshot ID and duplicate key.

Imports recompute hashes, rule identity, timing semantics and duplicate identity. Unknown fields, unsupported schema versions, forbidden identifiers, malformed identity and timing inconsistencies are rejected. Records are deep-frozen. Corrections append or supersede records rather than rewriting originals.

Stage 10.2 outcomes add immutable outcome revisions and Stage 10.3 adds immutable evaluation revisions. A current pointer identifies the authoritative revision while earlier valid revisions remain audit evidence.

## Provider and fallback evidence
Provider evidence records the seven-state Provider Health vocabulary: Live, Cached, Stale, Fallback, Partial, Disabled and Unavailable. It also records last success, age, stale threshold, consequence, accepted/rejected counts, safe retry diagnostics and whether the provider affected the current model.

Per-output source usage identifies FPL, Understat, odds, archive calibration and expected-minutes source. Stage 10.3 can describe associations between provider state and observed performance, but those comparisons are observational and cannot establish causal provider value or uptime quality.

## Storage and export
Canonical pre-deadline evidence is a user-controlled JSON file. The browser keeps a bounded recovery mirror with three compact metadata rows, two complete snapshot records, native gzip where available, verified writes, surfaced failures and explicit deletion.

Outcome and metric records use separate bounded compressed stores with current pointers, journals and limited superseded revisions. Metric storage has a 3 MiB encoded target and remains recovery rather than a permanent database.

Imported JSON is limited to 25 MB, schema checked, hash verified and restricted to approved provider identities. Imports remain recovery-only and cannot become official locally. Exports are intentionally unencrypted. No database, hosted evidence API, serverless service or Google Sheets authentication is introduced. Derived CSV and season bundles belong to Stage 10.4.

## Security and privacy
Evidence is built from allowlisted shapes rather than serialising `S`, saved configuration or arbitrary DOM state. It rejects secret/key/token fields and values, FPL Team ID, entry ID, league ID, manager name, email and phone fields. Provider endpoints redact entry and league identifiers. Odds and Anthropic secrets cannot enter evidence.

The manager reference is 128 random bits generated on-device and is not derived from an FPL identifier. Existing DOM-builder, restricted-Markdown and hash-based CSP boundaries remain unchanged.

## Phone-first workflow
The normal user does not manage provider files or manually trigger routine evidence. Startup and qualifying foreground returns:

1. prepare the last accepted FPL snapshot as fallback;
2. refresh Official FPL and enabled approved supporting sources;
3. validate source identity, schema, freshness, completeness and provider consequence;
4. resolve every approved source to a known Provider Health state;
5. recalculate without rendering mixed intermediate state;
6. apply one complete verified render;
7. automatically capture eligible deadline evidence.

Outcome collection runs after access and never blocks the app. Metrics are derived automatically when an authoritative linked outcome exists and are updated idempotently after corrections. Evidence and metrics remain subordinate under More → Deadline evidence.

## Stage 10.2 outcome design
Implemented under the owner-approved Official FPL-only contract. `/event/{gw}/live/` supplies unique all-player Gameweek totals and per-fixture explanations; `/fixtures/?event={gw}` supplies assignment, scores and completion; the bootstrap event row supplies deadline, `finished` and `data_checked`. Optional public picks/history supply manager facts without persisting Team ID. Starts remain `null` unless officially supplied; appearance and the 60-minute threshold derive only from official minutes.

Valid in-flight facts are immutable `provisional` revisions. A record becomes `complete` only when every assigned fixture is finished, the event is finished and data-checked and player detail validates. Later changed complete facts append a `corrected` revision. Duplicate players and conflicting fixtures fail closed. Identical rechecks create no duplicate full record.

Automatic work starts after verified render, checks provisional outcomes every fifteen minutes while visible, checks completed outcomes daily for fourteen days and catches up six missed Gameweeks per trigger. Squad outcomes remain optional and non-blocking. Stage 10.2 records facts only and does not calculate metrics.

Verified Stage 10.2 source `e84e7f1bf05ed1f3e574f78101e4a6e413273306` passes **376/376 tests** with generated artefacts at `9d81210b493ab40a542c50709733b14e448a481c`.

## Stage 10.3 metric design and implementation
No composite accuracy score is approved or implemented.

### Player points
The observation unit is player–Gameweek. Prediction is frozen `nextGameweek.total`; outcome is Official FPL `totalPoints`. Metrics are MAE, RMSE, prediction-minus-outcome bias, Pearson, average-rank Spearman, predicted/observed means, coverage and error bands.

Approved absolute-error bands are exact `0`, small `>0–2`, material `>2–5`, large `>5–10` and very large `>10`. Blank, single and double Gameweeks remain explicit segments. Realised and schedule-aligned views remain distinguishable where fixture assignments change.

### Minutes and appearance probabilities
The observation unit is player–fixture opportunity because the production expected-minutes outputs are per fixture. Metrics are minutes MAE/RMSE/bias, within 15/30 minutes and Brier/reliability for start, appearance and 60 minutes.

Official starts are used only where supplied. Starts are not inferred from minutes. In Double Gameweeks, missing per-fixture values may be assigned zero only where known values reconcile exactly with the official aggregate; otherwise the affected fixture row is unallocatable and excluded from that metric denominator.

### Uncertainty
P10–P90 and P25–P75 use inclusive coverage and mean width. Brier/reliability evaluates the unchanged production events: blank `<=2`, return `>=5`, haul `>=10`, mega-haul `>=15`. These are evaluated, not modified.

### Squad, captaincy and bench
The frozen Teamsheet XI uses official-style reserve-goalkeeper handling, ordered outfield substitutions and minimum formation rules. A Double Gameweek player who appears in either fixture blocks an automatic substitution.

Every legal XI from the same frozen 15 is enumerable. Top frozen alternatives are ranked by stored pre-deadline projections. The highest realised legal base-points XI from that frozen squad is labelled `Hindsight oracle`; it excludes captain doubling, chips and transfers and is never presented as a recommendation.

Captain evaluation applies captain-to-vice fallback. Frozen candidate comparisons remain descriptive. Bench reporting records order, substitution contribution and signed points left on unused bench players.

### Transfers
Only frozen optimiser plans can be evaluated because Stage 10.2 does not store actual manager transfer identities. Every plan is compared with its frozen zero-transfer baseline over the exact stored horizon. Gross gain is realised plan base points minus realised baseline base points. Net gain subtracts frozen hit cost.

Captain doubling, chips and the optimiser's judgement-based roll value are not treated as realised transfer points. Roll difference remains planning context. A horizon remains incomplete until all required Gameweeks and player outcomes are authoritative.

### Matching, revisions and leakage prevention
An official metric requires a complete officially eligible local snapshot, a complete/corrected linked outcome, exact season/Gameweek/deadline/manager/snapshot identity and valid unique player/fixture IDs. Recovery-only, late, incomplete and mismatched snapshots fail closed. Provisional outcomes produce no authoritative metric.

Corrected outcomes append corrected evaluation revisions. Identical source data creates no duplicate metric record. The metric engine consumes stored snapshot fields only and does not import or invoke current projection, expected-minutes, simulation or optimiser functions.

### Storage and reporting
`gameweekEvaluation` and `transferHorizonEvaluation` records are canonical, hash-verifiable and immutable. Browser storage uses compression, reload verification, a journal, current revision pointers, bounded superseded revisions and surfaced quota failure.

The mobile-first UI reports player, minutes and uncertainty summaries, coverage/missingness, frozen decisions and completed transfer horizons. It does not use good/bad accuracy colouring, a composite grade or automatic model updates.

Verified Stage 10.3 source `3eaae862b8a8277e450af062ff4bcecd15b12f3f` passes **397/397 tests** with byte-identical exact-identity builds. Generated artefacts are committed at `8c4b60a367b9858146b42ff8710d888856462c21`. The item merged through PR #32 at `2c703be2ccebc9bd0c4d782ad07b5324b1ed0997` after owner approval.

## Segmentation and sample safeguards
Approved segments include all/schedule-aligned players, owned and frozen role, primary transfer in/out, position, position-aware frozen-price band, expected-minutes source/confidence, provider state, venue/FDR context, blank/single/double Gameweek, frozen availability, observed role and season period.

Approved season periods are pre-season, early GW1–6, transition GW7–12 and mature GW13–38. Position-aware price bands are:

- GKP/DEF: up to £4.4m, £4.5m–£5.4m, £5.5m+;
- MID: up to £5.4m, £5.5m–£7.4m, £7.5m–£9.9m, £10.0m+;
- FWD: up to £5.4m, £5.5m–£7.4m, £7.5m–£9.4m, £9.5m+.

Sample warnings are:

- fewer than 30 observations: raw-only;
- 30–199: descriptive;
- 200+ across at least ten Gameweeks: potentially stable descriptive sample;
- probability-bin observed frequency requires 30 observations, with 500 overall observations across ten Gameweeks preferred;
- captain/transfer aggregate comparison requires ten decisions;
- provider-state comparison requires both 100 observations and five affected Gameweeks.

Initial reporting makes no formal significance claim. Clustered resampling, confidence intervals and multiple-comparison control require separate design and approval.

## Explicit exclusions
Stage 10 does not change projection, expected-minutes, scoring, calibration, fixture, uncertainty, best-XI, captaincy, squad or transfer-optimiser formulas. It does not add providers, FPL write actions, chip optimisation, ownership modelling, a framework, package dependency, database, hosted evidence API, public repository publication, private-repository automation, Google Sheets authentication, composite score or automatic model update.

Stage 10.3 specifically excludes actual-transfer identity inference, significance tests, confidence intervals and Stage 10.4 CSV/season-bundle operating workflows.

## Known limitations
- The browser cannot provide external timestamp notarisation.
- Local storage can be cleared, quota-limited or lost; exported JSON remains the durable owner-controlled evidence.
- Exact provider interaction bytes are not retained; normalised accepted inputs and provenance are retained.
- Early and subgroup samples are small, clustered and unstable.
- Blank zeroes can flatter all-player metrics.
- Provider-state associations are observational, not causal.
- Official starts and Double Gameweek fixture minutes may have lower coverage than points.
- Manager outcomes remain optional.
- Actual manager transfer identities cannot be evaluated under the current outcome record.
- The hindsight oracle is descriptive only.
- Automated logic/build tests do not replace physical iPhone review for meaningful new interaction changes.

## Acceptance evidence
Stage 10.1 and Stage 10.2 acceptance records remain in their item documents.

Stage 10.3 acceptance evidence is:

- exact approved metric definitions and exclusions recorded in `STAGE10-ITEM3.md`;
- immutable correction-aware records and strict source matching;
- no post-deadline model recomputation;
- deterministic ordering, hashes and bounded verified storage;
- complete player, minutes, uncertainty, squad, captaincy, bench and frozen-transfer tests;
- **397/397 tests passing**;
- successful production build and byte-identical exact-identity rebuild;
- root/deployable equality and exact build commit identity;
- verified source `3eaae862b8a8277e450af062ff4bcecd15b12f3f` and generated artefacts `8c4b60a367b9858146b42ff8710d888856462c21`;
- merged through PR #32 at `2c703be2ccebc9bd0c4d782ad07b5324b1ed0997` after owner approval.

Even after Stage 10.5, the correct wording is: **Stage 10 collection and evaluation infrastructure is complete; prospective model validation remains in progress.**
## Stage 10.4 verified implementation
The owner approved the exact operating-review/export scope on 30 July 2026. PR #35 merged at `6a96096cfa59fd3476aa89c191cc8ca6400d358b` without changing projection, expected-minutes, scoring, fixture, uncertainty, squad, captaincy, transfer-optimiser or provider behaviour. Source `1eca9a8817da41597d0632c819142237d31627fb` passes 413/413 tests with deterministic exact-identity builds; generated artefacts are `1af7dac5383c91e915587218e7551c2f619cec8f`. Physical iPhone acceptance was not independently recorded. Stage 10.5 remains a separate investigation/design checkpoint.
