# STAGE10-DESIGN.md — Prospective Live-Season Validation
Status: owner-approved on 2026-07-29. Stage 10.1 is complete and merged through PR #27 at `da76c81f552fd9da5c518e73ccc0fbe966c74444`; Stage 10.2 official outcome collection is the next separately scoped checkpoint.
Related: PROJECTION_MODEL.md, TESTING.md, DATA_SOURCES.md, SECURITY.md, KNOWN_LIMITATIONS.md.

## Objective
Build a deadline-safe evidence trail for the 2026/27 live season so Teamsheet can compare what it knew before each deadline with what subsequently happened. Stage 10 records evidence and evaluates it; it does not change projection, expected-minutes, scoring, fixture, uncertainty, captaincy, squad or transfer-optimiser formulas.

The completion language is deliberately strict: implementation of the collection infrastructure is not proof that the model is accurate. Prospective validation remains in progress until enough genuinely pre-deadline observations and final outcomes have accumulated.

## Approved checkpoint sequence
1. **10.1 — Deadline-safe snapshot foundation:** immutable schema, deadline evidence, provenance, hashes, JSON import/export, bounded local recovery and phone-first status controls.
2. **10.2 — Outcome collection:** immutable official player, fixture, squad and transfer outcomes with correction records.
3. **10.3 — Metrics:** deterministic player, minutes, uncertainty, squad, captaincy and transfer evaluation.
4. **10.4 — Operating review/export:** weekly and cumulative summaries, completeness review and analysis-friendly exports.
5. **10.5 — Hardening and documentation:** failure recovery, migration discipline, security review and final operational guidance.

## 10.1 immutable pre-deadline snapshot
The canonical record type is `preDeadlineSnapshot`. Every record contains:

- schema, metric and segmentation versions;
- season, Gameweek and the validated official FPL deadline;
- anonymous per-device manager reference, never the FPL Team ID, manager name or league ID;
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

A same-origin HTTP `Date` response is sampled before and after the freeze. The four timing grades are:

- `network_attested`;
- `client_recorded` when network time is unavailable;
- `clock_conflict` when absolute client/server skew exceeds 60 seconds;
- `late` when the safety cutoff has been reached.

Official eligibility requires a complete network-attested record inside the 24-hour window, before the two-minute cutoff, with every included provider recorded before the cutoff and no timing reason present. Client-only, conflicted, incomplete, late or post-deadline records fail closed.

The latest complete eligible record for the active deadline is official. A later incomplete record cannot displace an earlier complete one. If the official FPL deadline is revised, records tied to the older deadline are not selected for the revised deadline. Missed snapshots are never backfilled or manually backdated.

GitHub Pages cannot cryptographically notarise capture time. Network-attested means the client recorded a same-origin server clock and passed the stated checks; it is evidence, not an external trusted timestamp.

## Identity, hashing and immutability
Records are canonicalised with sorted object keys, finite JSON numbers, UTC ISO timestamps and deterministic array ordering. Finalisation produces:

- SHA-256 hashes for the complete model inputs, provider-specific input groups, player projections, minutes, uncertainty, decisions, providers and rule configuration;
- a complete-record SHA-256 content hash;
- a deterministic snapshot ID derived from the content hash;
- a duplicate key containing season, Gameweek, deadline, source hash, model version and rules version.

Imports recompute section hashes, rule hashes, timing semantics, duplicate identity and the whole-record hash. Unknown top-level fields, unsupported schema versions, forbidden identifiers, malformed identity and timing inconsistencies are rejected. Records are deep-frozen in memory. Corrections in later checkpoints will append or supersede records rather than rewrite originals.

## Provider and fallback evidence
Provider evidence records the current seven-state Provider Health vocabulary: Live, Cached, Stale, Fallback, Partial, Disabled, Unavailable. It also records last success, age, stale threshold, consequence, accepted/rejected counts, safe retry diagnostics and whether the provider affected the current model.

Per-output source usage identifies FPL, Understat, odds, archive calibration and expected-minutes source. This supports later descriptive comparisons between provider states, but it does not establish causal provider value or uptime.

## Storage and export
Canonical evidence is a user-controlled JSON file. The browser keeps only a bounded recovery mirror:

- three compact metadata rows;
- two complete records;
- gzip compression when the browser provides the native Compression Streams API, with an uncompressed fallback;
- verified writes and surfaced quota/storage failures;
- a delete control for all local evidence and the anonymous device reference.

Imported JSON is limited to 25 MB, schema checked, hash verified and restricted to the four approved provider identities. It is stored as recovery-only evidence and cannot become official locally. Exports are intentionally unencrypted; the UI states this. Stage 10.1 introduces no database, public evidence repository, private-repository automation, serverless service or Google Sheets authentication. Derived CSV and season bundles belong to later checkpoints.

## Security and privacy
Evidence is built from an allowlisted shape rather than serialising `S`, saved configuration or arbitrary DOM state. It rejects secret/key/token fields and values, FPL Team ID, entry ID, league ID, manager name, email and phone fields. Provider endpoints redact entry and league identifiers. The Odds API key and Anthropic material can never enter evidence.

The manager reference is 128 random bits generated on-device and is not derived from an FPL identifier. Exported JSON remains the owner's responsibility once downloaded. The existing DOM-builder, restricted-Markdown and hash-based CSP boundaries remain unchanged; `connect-src 'self'` is added solely for the same-origin clock request.

## Phone-first workflow
The normal user does not manage evidence or provider files. On startup Teamsheet shows a minimalist verification screen while it:

1. prepares the last accepted FPL snapshot as a safe fallback;
2. refreshes Official FPL and every enabled approved supporting source;
3. validates source identity, schema, freshness, completeness and provider consequence;
4. resolves every approved source to a known Provider Health state;
5. recalculates projections and recommendations without rendering intermediate mixed state;
6. applies the complete verified dataset in one final render;
7. automatically captures eligible deadline evidence and deduplicates by progressively better capture window.

The same cycle runs when the page returns to the foreground after ten minutes. Previously verified content stays visible, but decision controls are temporarily inert until the staged refresh completes. Official FPL is critical; optional providers may resolve to verified cached/fallback/disabled states. The promise is the latest **verified data available**, not that every external provider is always live.

Evidence status remains subordinate under More. Export, restore and delete controls sit inside a recovery section. Restored JSON is hash/schema/provider checked but marked `recovery_import`; it cannot become the local official prospective record. No routine capture, import or verification action is required from the user.

## Stage 10.2 outcome design
Outcome records will use official FPL fixture/player data where available and preserve provisional, final, corrected, incomplete and unavailable states. Planned fields include minutes, appearance, 60-minute threshold, goals, assists, clean sheets, goals conceded, saves, defensive contribution, bonus/BPS, cards, own goals, penalties and official points. Starts remain `null` unless an official source explicitly provides them.

Squad outcomes will capture picks, multipliers, captain/vice, bench order, chips, hits, auto-subs and official total. Teamsheet will independently reproduce squad scoring and compare it with the official result. Transfer outcomes compare the frozen recommendation with its frozen zero-transfer baseline over the approved horizon; roll value remains separate from realised points.

## Stage 10.3 metric design
No composite accuracy score is approved. Planned deterministic metrics are:

- player points: MAE, RMSE, bias, Spearman, Pearson, observed/predicted means, coverage and error bands;
- minutes: MAE, RMSE, bias, within 15/30 minutes, Brier scores and reliability for start/appearance/60-minute probabilities;
- uncertainty: P10–P90 and P25–P75 coverage/width plus Brier/reliability for blank, return, haul and mega-haul probabilities;
- squad: realised legal XI after auto-subs, frozen legal alternatives and a clearly labelled descriptive oracle;
- captaincy: captain versus vice, top-three and frozen candidate alternatives with fallback handling;
- bench: order and realised substitution contribution;
- transfers: gross and net gain after hits over the frozen horizon, compared with the zero-transfer baseline.

Metrics are descriptive until sufficient prospective data exists. Any future decision-support threshold or model change requires a separate approval and validation item.

## Segmentation and sample safeguards
Planned segments include all players, owned players, recommendations/candidates, transfer in/out, position, position-aware price band, expected-minutes source/confidence, provider state, home/away, FDR/model context, blank/single/double Gameweek, availability, starter/substitute and season period.

Approved season periods are pre-season, early GW1–6, transition GW7–12 and mature GW13–38. Position-aware price bands are:

- GKP/DEF: up to £4.4m, £4.5m–£5.4m, £5.5m+;
- MID: up to £5.4m, £5.5m–£7.4m, £7.5m–£9.9m, £10.0m+;
- FWD: up to £5.4m, £5.5m–£7.4m, £7.5m–£9.4m, £9.5m+.

Sample warnings: below 30 observations is raw-only; 30–199 is descriptive; 200+ across at least ten Gameweeks may be treated as potentially stable. Probability bins require at least 30 observations, with 500 overall observations and ten Gameweeks preferred. Captain/transfer comparisons require at least ten relevant decisions. Provider-state comparisons require at least five affected Gameweeks or 100 observations. Initial reporting has no formal significance claim; clustered resampling and multiple-comparison control would require separate design.

## Explicit exclusions
Stage 10 does not change projection, expected-minutes, scoring, calibration, fixture, uncertainty, best-XI, captaincy, squad or transfer-optimiser formulas. It does not add providers, FPL write actions, chip optimisation, ownership modelling, a framework, package dependency, database, hosted evidence API, public repository publication, private-repository automation, Google Sheets authentication, composite score or automatic model update.

## Known limitations
- The browser cannot provide external timestamp notarisation.
- Local storage can be cleared, quota-limited or lost; exported JSON is canonical.
- Exact provider interaction bytes are not retained; normalised accepted inputs and provenance are retained.
- Early and subgroup samples will be small and unstable.
- Provider-state associations are observational, not causal.
- Physical iPhone performance and interaction still require owner/device review; automated tests cover logic and responsive source boundaries, not real-device thermals or Safari quirks.
- Stage 10.1 has no historical outcomes and proves no accuracy.

## Stage 10.1 acceptance gate
- Deadline boundaries and failure states are tested.
- Records are versioned, immutable, deterministic, hash-verifiable and secret-free.
- Build/source/model/rules identity, rule hashes, provider input hashes and output hashes are frozen.
- All-player projections, minutes, uncertainty summaries and decision context are captured without changing formulas.
- JSON export/import, bounded recovery storage and delete controls work with surfaced failures.
- Full `./run-tests.sh`, production build, two-build reproducibility and exact build identity pass.
- Documentation is updated and implementation remains on a draft PR until owner approval.
- Physical iPhone review is recorded before merge or remains an explicit merge blocker.

Even after Stage 10.5, the correct wording is: **Stage 10 collection infrastructure is complete; prospective model validation remains in progress.**
