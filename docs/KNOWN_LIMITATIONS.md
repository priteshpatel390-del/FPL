# KNOWN_LIMITATIONS.md
Purpose: single register of every current limitation. Audience: all sessions.
Last updated: 2026-08-05. Related: AUDIT.md, ROADMAP.md, SECURITY.md, TEAMSHEET2-PRODUCT-BLUEPRINT.md.

| ID | Description | Current impact | Planned stage | Status |
|---|---|---|---|---|
| SEC-2 | Odds key remains client-side in local storage and is visible to a determined page inspector | Capped-cost key exposure to browser owner/extensions/compromised same-origin code; mitigated by masked field, direct-only transport, one-action forgetting and diagnostic scrubbing | Serverless trigger under D-08 | Accepted-temporary |
| SEC-3 | Frontend Anthropic key field/persistence and keyed browser request path | None; legacy value is deleted and hosted Ask fails fast | Stage 3 | **CLOSED 2026-07-27** |
| CSP-1 | No CSP in deployed build | Fixed by deterministic hash-based meta CSP with build-time and independent test verification | Stage 3 | **CLOSED 2026-07-28** |
| XSS-1 | Dynamic API/user strings were interpolated into HTML | Fixed by DOM builders; AI output fixed separately by restricted Markdown AST | Stage 3.5/3.6 | **CLOSED 2026-07-28** |
| VAL-1 | No runtime schema validation | Fixed by per-endpoint fatal/partial validation | Stage 3 | **CLOSED 2026-07-27** |
| DUP-1 | Duplicate fixtures could double-count projections | Fixed by provider-boundary identity/deduplication | Stage 3 | **CLOSED 2026-07-26** |
| BUILD-1 | Custom bundler could leave parts of multi-line module declarations in production output | Complete static import/export declarations are stripped and surviving module syntax is rejected | Stage 5 review | **CLOSED 2026-07-28** |
| RET-1 | `Retry-After` is not honoured | Fixed capped backoff may retry sooner than a provider requests | Serverless reconsideration | Open (accepted) |
| RET-2 | No transport-level per-provider circuit breaker | Pooled outages can issue more doomed requests than ideal | Future provider hardening only with separate approval | Open |
| HEALTH-1 | Provider Health is session-scoped | No multi-session incident history; compact global status and full Settings detail reflect only the current session | No planned stage | Accepted |
| VAL-2 | Understat values are structurally but not range validated | Nonsense numeric values could pass structure checks | Future provider hardening | Open |
| VAL-3 | Archive CSV validates headers but not every row width | Stage 7 replay rejects and counts malformed required values instead of manufacturing defaults | Stage 7 | **CLOSED and verified 2026-07-28** |
| MIN-1 | Expected minutes = season minutes ÷ current GW | Replaced by tiered current-season histories with aggregate/prior fallback | Stage 4 | **CLOSED 2026-07-28** |
| DEN-1 | Per-match denominators use GW number | Replaced by completed team fixtures and detailed player opportunities | Stage 4 | **CLOSED 2026-07-28** |
| SCOR-1 | Linear approximations of stepped FPL rules | Replaced by deterministic expected-value distributions for saves, conceded goals and defensive contributions | Stage 5 | **CLOSED and verified 2026-07-28** |
| SCOR-2 | Bonus uses BPS/90 heuristic | Replaced by awarded bonus per estimated appearance with positional shrinkage | Stage 5 | **CLOSED and verified 2026-07-28** |
| FIX-1 | Blank/double ease constants are arbitrary | Removed; genuine blanks score zero and doubles add both fixtures | Stage 5 | **CLOSED and verified 2026-07-28** |
| SCOR-3 | Stage 5 Poisson and shrinkage constants are judgement-based | Rule implementation is explicit but not validated as an accuracy optimum | Prospective validation | Open |
| SCOR-4 | Bonus is empirical rather than a full match-relative BPS simulation | Stage 8 samples bounded bonus outcomes but cannot model match-specific BPS rank or ties | Future only with separate approval | Accepted-temporary |
| SCOR-5 | Clean-sheet retention after a player leaves was simplified | Stage 8 uncertainty samples discrete minutes and clean-sheet outcomes, but does not yet model a full match goal-timing hazard | Stage 8 | Partially addressed; limitation remains |
| LEAK-1 | Calibration fitted and reported on the same sample | Replaced by chronological train/calibration/holdout folds | Stage 7 | **CLOSED and verified 2026-07-28** |
| TRF-1 | Transfer UI did not validate combined plans | Stage 6 exact optimiser validates complete squad legality, budget and club quotas | Stage 6 | **CLOSED and verified 2026-07-28** |
| BT-1 | Historical dataset was unpinned | Stage 7 uses an immutable vaastav commit and runtime SHA-256 | Stage 7 | **CLOSED and verified 2026-07-28** |
| BT-2 | Historical pre-deadline snapshots do not exist for several live inputs | Stage 7 is an honest scoring diagnostic, not full validation of every live production input | Prospective logging from 2026/27 | Open (accepted) |
| SIM-1 | Stage 8 uncertainty is conditional on the existing model | Percentiles do not include every real-world source of uncertainty or prove calibrated coverage | Prospective 2026/27 validation | Open (accepted) |
| SIM-2 | Player attacking samples are not allocated from a complete simulated team score | Player outcomes can be marginally coherent without strict match-level event conservation | Future only with separate approval | Open (accepted) |
| SIM-3 | Detailed simulation is disabled in pre-season | No precise percentiles or haul probabilities until live event-level inputs exist | Live GW1 | Accepted-honest |
| SIM-4 | No full match-relative BPS, tactical substitution or detailed game-state engine | Some correlations and tail outcomes remain approximate | Future only with separate approval | Open (accepted) |
| ODDS-2 | No free historical odds | Odds/blend ablation must be prospective | Stage 7+ | Open |
| UST-1 | Pre-season Understat uses previous closing six matches | Early-season form may be mislabelled | Prospective validation | Open |
| DC-1 | Defensive-contribution history starts in 2025/26 | No multi-season validation | Permanent | Accepted |
| FRAME-1 | `frame-ancestors` is ineffective in meta CSP on GitHub Pages | Frame-buster is compensating control | Serverless | Accepted-temporary |
| STYLE-1 | `style-src-attr 'unsafe-inline'` remained necessary | Replaced fixed/dynamic styles with classes, progress and SVG attributes; source/build/deployable guards reject style attributes and the CSP concession is removed | Stage 9.6 | **CLOSED and verified 2026-07-29** |
| UI-1 | No persistent browser-level screenshot-regression suite | Stage 9.6 completed representative mobile/desktop browser review with no console errors, but future visual changes still require human device review | Future tooling only with separate approval | Open (accepted) |
| UI-2 | Stage 9 primary navigation remained Team, Players, Transfers and More | Replaced by Team, Transfers, Fixtures, Leagues and Settings with Ask Teamsheet as a global/Team action | Teamsheet 2.0.1 | **CLOSED and verified 2026-07-31** |
| UI-3 | Settings and supporting tools were distributed through the Stage 9 More hierarchy | 2.0.1 created the approved hierarchy; 2.0.6 adds route-owned subsections and explicit content mounts | Teamsheet 2.0.1/2.0.6 | **CLOSED and merged 2026-08-04 through PR #65** |
| UI-5 | Physical iPhone rendering of the five-tab navigation is not independently automated | Static responsive, route and accessibility contracts pass, but exact device chrome, text scaling and thumb comfort require owner review | Teamsheet 2.0.1 review and 2.0.7 | Open (acceptance gate) |
| UI-4 | The Team screen did not provide the complete approved decision-home summary | Pitch-first hierarchy, XI/captain/bench forecast, one material risk, deadline action and honest setup/degraded states are implemented without calculation changes | Teamsheet 2.0.2 | **CLOSED and verified 2026-07-31** |
| PREVIEW-1 | Decision previews are intentionally session-only | Transfer/captain previews disappear on refresh and are not submitted to FPL; this prevents accidental persistence or account changes | By design | Accepted |
| PREVIEW-2 | Transfer preview pitch is next-Gameweek only while optimiser gain can span several Gameweeks | The banner must be read alongside the pitch to distinguish next-GW XI score from multi-GW net gain | Stage 9.4 | Accepted-labelled |
| ML-1 | Leagues exposed only a top-N sampled ownership comparison | Replaced by the official 2.0.4 foundation: primary league, current position/movement, points gaps, nearby standings and selected-rival factual comparison | Teamsheet 2.0.4 | **CLOSED and merged 2026-08-02 through PR #59** |
| ML-2 | No approved tactical Mini-League recommendation model | 2.0.5 adds exact selected-rival factual exposure only; it does not predict outcomes, rank meaningful differentials or alter Team/Transfers advice | Separate model gate | Open (gated) |
| ML-3 | Teamsheet 2.0.5 physical iPhone, VoiceOver and live populated-data acceptance is not recorded | Automated source, calculation, route, privacy and build contracts cannot prove real Safari density, assistive reading order or public-endpoint availability | Teamsheet 2.0.5 review / 2.0.7 | Open (acceptance gate) |
| RANK-1 | Projected final Gameweek score and rank movement are not yet designed or validated | Teamsheet must not manufacture live-rank precision or blur projection with confirmed Official FPL results | Separate design and explicit approval | Open (expected) |
| STRAT-1 | No protect, balanced or chase Mini-League strategy model is approved | League position may be described, but it cannot silently alter production recommendations | Separate design and explicit approval | Open (gated) |
| EVID-1 | Browser timing evidence is not externally notarised | Same-origin HTTP `Date` plus clock-skew checks support leakage review but cannot prove capture time to an independent third party | Future serverless only with separate approval | Open (accepted) |
| EVID-2 | Local evidence can be cleared and JSON exports are unencrypted | The owner must export and retain files safely; bounded compressed local copies are recovery only | Stage 10.4 operating workflow | Open (accepted) |
| EVID-3 | Physical iPhone capture/export/import acceptance | Owner accepted the silent loader and startup behaviour; local-preview chrome was distinguished from app UI | Stage 10.1 review | **CLOSED 2026-07-29** |
| EVID-4 | Prospective sample size begins at zero | No validation or calibration claim is possible until enough live Gameweeks and observations are collected | Stage 10.2–10.5 | Open (expected) |
| OUTCOME-1 | Static GitHub Pages cannot collect while the app is fully closed or suspended | Missed Gameweeks are collected when Teamsheet next opens; guaranteed closed-app timing needs a separately approved backend | Future serverless only with separate approval | Open (accepted) |
| OUTCOME-2 | Official FPL live and manager endpoints are undocumented | Schema drift can delay collection; strict validators quarantine ambiguity rather than manufacturing facts | Stage 10.2 operations | Open (accepted) |
| OUTCOME-3 | Manager outcome may be unavailable while global player/fixture facts are complete | Squad, captain and bench coverage can be lower than player coverage without blocking global metrics | Stage 10.3 reporting | Open (accepted) |
| METRIC-1 | Prospective metric samples begin at zero | Early values are volatile and must remain raw-only or descriptive under the approved sample warnings | Stage 10.3+ operations | Open (expected) |
| METRIC-2 | Blank Gameweek zeroes can flatter all-player metrics | All-player results may look better because many structurally blank rows have easy zero outcomes; schedule-aligned and fixture-class segments must remain visible | Stage 10.3 reporting | Accepted-labelled |
| METRIC-3 | Official starts and Double Gameweek per-fixture minutes may be incomplete | Start Brier and fixture-minutes coverage can be lower than player-points coverage; ambiguous rows fail closed rather than being inferred | Stage 10.3 reporting | Open (accepted) |
| METRIC-4 | Actual manager transfer identities are not stored | Stage 10.3 can evaluate frozen optimiser plans but cannot calculate realised gain for the manager's actual transfers | Future collection only with separate approval | Open (accepted) |
| METRIC-5 | Provider-state comparisons are observational and clustered | Hundreds of player rows can share one Gameweek/provider event, so association cannot establish causal provider value | Future formal inference only with separate approval | Open (accepted) |
| METRIC-6 | The legal-XI oracle uses realised outcomes | It is a descriptive hindsight upper bound from the same frozen squad, not a recommendation available before the deadline | By design | Accepted-labelled |
| OPS-1 | Full repository tree was not committed | None | Owner action | **CLOSED 2026-07-26** |
| UI-6 | First Teamsheet 2.0.1 physical iPhone review found dock, icon, focus and Settings-header defects | Approved corrections were implemented and merged through PR #48; populated-data transport remains tracked separately by FPL-1 | Teamsheet 2.0.1 | **CLOSED and merged 2026-07-31** |
| UI-7 | Teamsheet 2.0.2 physical iPhone acceptance is not yet recorded | Automated contracts cover hierarchy, states, wording, accessibility and build integrity, but physical pitch position, text scaling, VoiceOver order and one-handed comfort require owner review | Teamsheet 2.0.2 review / 2.0.7 | Open (acceptance gate) |
| UI-8 | Teamsheet 2.0.6 physical iPhone, VoiceOver and live populated-data acceptance is not recorded | Automated and headless-browser checks cover routes, focus, mounts, warning states and responsive CSS, but they do not establish iPhone Safari density, one-handed comfort, actual VoiceOver order or live transport behaviour | Teamsheet 2.0.7 | Open (acceptance gate) |
| REFRESH-1 | Qualifying foreground return temporarily locked the app after unsuccessful loading | Every completed attempt now starts the ten-minute cooldown, paired Safari events deduplicate and foreground refresh remains interactive; physical owner retest passed | Teamsheet 2.0.7 | **CLOSED and merged 2026-08-05 through PR #68** |
| FPL-1 | Static Pages could not reliably read Official FPL through anonymous browser relays | Replaced on draft PR #69 by the owner-controlled allowlisted Worker; the stable production route returned live 2026/27 bootstrap data on physical iPhone Safari | FPL-T1 | Implemented and transport-verified; merge pending |
| FPL-2 | Full populated Teamsheet behaviour has not yet been accepted against live Official FPL account, fixture, player and league endpoints | Transport success does not by itself prove the 15-player squad, captain/bench, Transfers, Fixtures, Player Detail, leagues, cache and refresh flows | PR #69 live acceptance | Open (acceptance gate) |
| TRF-A1 | The first physical iPhone Safari test of the automatic exact Transfers search exhausted the 2,000,000 evaluation ceiling and reported "Exact search did not complete." | The approved corrective search architecture is implemented and automatically verified, and a Node reproduction of the failure shape that previously took 13 minutes 38 seconds now completes in about 1.2 seconds with identical complete top-8 results, but the corrected build has not yet been physically retested | PR #70 physical retest | **Open (acceptance gate)** |
| TRF-A2 | Official-scale exactness is not proved against the exhaustive oracle | A full-pool exhaustive comparison is not tractable; oracle equality is proved on controlled pools and the Official-scale claim is only that the exact search completes below the unchanged ceiling with `status: 'ok'` | By design of the evidence | Accepted-labelled |
| TRF-A3 | Reduced evaluation counts are a search-efficiency result only | Fewer evaluated plans say nothing about projection quality; no prediction-accuracy claim is created or implied | By design | Accepted |
| ACCOUNT-1 | Bank and available free transfers remain manual inputs rather than proven authoritative account values | Values can be entered but are not yet verified from the connected FPL account; no inference may be labelled authoritative | Separate data/security design | Open (gated) |
| MANUAL-1 | Manual squad editing requires the verified Official FPL player catalogue | First-run core-data failure means player search and saved-ID resolution cannot operate; controls are now disabled and honestly labelled, while production remedies remain separately gated | Manual fallback investigation | Open (design gate) |
| AI-1 | Ask works only inside Claude artifact preview | No hosted AI features | Serverless | Accepted |

| UI-9 | Transfer optimisation previously ran synchronously on the Safari UI thread | PR #69 now uses an explicit cancellable Blob Web Worker, batched projection preparation and session result reuse; physical iPhone speed and memory acceptance remain required | PR #69 performance correction | Implemented and automatically verified; device acceptance open |
| UI-10 | Blob Web Workers depend on the browser accepting `worker-src 'self' blob:` | A single-file GitHub Pages deployable cannot ship a separate worker asset, so a local Blob worker is the only available isolation. If iPhone Safari refuses it, Transfers states plainly that it cannot calculate and no blocking main-thread search is substituted | PR #69 performance correction | Open until physical iPhone acceptance |
| UI-11 | Deadline evidence capture can still run the transfer search on the main thread | `src/evidence/snapshot.mjs` calls `optimiseTransfers()` directly when no matching result is cached. Evidence capture is outside Approved Scope for the Transfers performance correction, so it was documented rather than changed | PR #69 performance correction | Open (scope gate) |
| UI-12 | The session result cache stores each result under an exact key and a weaker alias | The alias omits the player price/status hash. In practice `teamsheet:data-rendered` clears the cache on every verified render, so a price change cannot outlive it, but the alias is not itself price-aware | PR #69 performance correction | Accepted |

## Teamsheet 2.0 migration limitations
- Teamsheet 2.0.1–2.0.6 are complete and merged, implementing the approved navigation, Team, Transfers, factual Mini-League foundation, selected-rival factual exposure and organised Settings/research/evidence/diagnostic surfaces. Projected rank, rival-score prediction, remaining-player simulation, effective-ownership strategy and tactical recommendation work remain separately gated.
- The Stage 9 engineering foundation remains valid, while its primary information architecture is superseded.
- No new projection, captaincy, optimiser, Mini-League strategy or rank model is authorised by the blueprint.
- The migration must preserve verified engineering and existing access to every current functional surface.
- Provider Health retains all seven states. Full detail now remains in Settings; only material core Official FPL consequences surface on primary routes. Provider behaviour is unchanged.
- Official results and projected values require explicit separation in future rank and Mini-League work.
- Low ownership alone must not be presented as a positive differential recommendation.
- Teamsheet 2.0.7 is merged through PR #68; its Safari foreground-resume correction passed owner retest and VoiceOver remains accepted-unverified. FPL-T1 now provides verified live bootstrap transport on draft PR #69, while full populated application acceptance remains open under FPL-2.

## Stage 10.1 automatic refresh limitations
- “Latest” means the latest data that passed approved validation. It does not guarantee every optional provider is live.
- GitHub Pages and iPhone Safari cannot reliably wake a fully closed or suspended app. Automatic work begins on startup or foreground return; guaranteed closed-app scheduling requires a later server-side design.
- Foreground verification temporarily makes decision controls inert to prevent mixed-state use. Existing verified content remains visible.
- Recovery imports are deliberately non-official. They restore owner-controlled records but cannot establish authorship or external timestamp notarisation.

## Stage 10.2 outcome limitations
- Outcome collection starts only after the verified app becomes usable and cannot wake a fully closed iPhone app.
- A record is not final merely because fixtures say `finished`; official event `data_checked` and complete validated player data are required.
- Corrections are monitored daily for fourteen days and by later app openings, but there is no guaranteed server-side polling.
- Bounded local storage is recovery rather than a permanent archive. Complete exports are unencrypted.
- Infrastructure completion is not evidence that the model is accurate or calibrated.

## Stage 10.3 metric limitations
- Player and probability results begin with very small, clustered samples. The interface shows raw-only, descriptive or potentially-stable wording but never a formal significance claim.
- All-player results must be read beside schedule-aligned and blank/single/double segments because structural blank zeroes can flatter error metrics.
- Start facts are used only where Official FPL supplies them. Double Gameweek fixture minutes are included only where they can be allocated and reconciled safely.
- Missing manager outcomes reduce squad/captain/bench coverage without blocking global player evaluation.
- Actual manager transfer identities are unavailable; only frozen optimiser plans can be evaluated against their frozen zero-transfer baseline.
- Hindsight oracle and alternative comparisons are descriptive only and must not be presented as retrospective recommendations.
- Provider-state comparisons are observational and cannot prove causal value or uptime quality.
- Confidence intervals, clustered resampling, multiple-comparison control and statistical significance remain separately scoped future work.
- Metric records are bounded browser recovery, not a permanent database or externally authenticated archive.
- Stage 10.3 implementation and 397 passing tests prove contract integrity, not prediction accuracy or probability calibration.

## Stage 10.4 operating-review limitations
- Review quality cannot exceed retained evidence quality. Pruned or missing exact snapshot/outcome/evaluation payloads are reported as partial and cannot be reconstructed.
- Local Stage 10 retention remains recovery-oriented rather than a permanent season archive; a season JSON bundle may therefore be partial on one device.
- Google Sheets import is manual. The app does not authenticate to Drive, select a workbook, append rows or run unattended exports.
- No XLSX or ZIP export exists. The eight CSV files are downloaded individually to avoid browser multi-download and mobile reliability problems.
- Exports above 25 MiB fail rather than truncate; no compression or automatic splitting is implemented.
- Transfer-horizon gains are not summed cumulatively because horizons can overlap and plans are alternatives.
- Provider-state comparisons are observational, not causal. One Gameweek is never labelled calibrated/uncalibrated or accurate/inaccurate.
- Static phone-first tests pass, but physical iPhone acceptance was not separately recorded. The old standalone Stage 10.5 rehearsal gate is superseded by checkpoint-specific checks and final Teamsheet 2.0.7 rehearsal.

## Stage 10.5 hardening limitations
- Safari can acknowledge only that a download was requested; Pritesh must confirm the file in Files or Downloads.
- Browser storage and exported JSON remain unencrypted and are not a permanent database.
- Static GitHub Pages cannot perform guaranteed closed-app collection.
- Recovery-only imports cannot become official/current or automatically recreate every local metric view.
- No migration engine exists because no older supported Stage 10 schema currently requires one.
- Stage 10 infrastructure completion does not establish prediction accuracy or calibration.

## Teamsheet 2.0.4 acceptance evidence

Automated contracts cover League state migration, official-data validation, ID-free routes, standings/rival states, honest wording, mobile layout and build integrity. Teamsheet 2.0.4 is complete and merged through PR #59. Physical testing of the actual repository build on an iPhone was not separately performed, VoiceOver acceptance was not performed, and live populated-data acceptance was not performed. The approved sample preview established design direction but was not equivalent to full repository-device acceptance. Public FPL transport limitation FPL-1 can still block populated-data acceptance.

## Teamsheet 2.0.4 Mini-League limitations
- Official FPL entry, standings and picks endpoints are undocumented; strict field validation may reduce coverage when schemas drift.
- Only classic public league membership is discovered. Private/authenticated access remains excluded.
- Large leagues are not scanned in full. Teamsheet loads page 1, pages around the official manager rank and additional sequential pages only when requested.
- Rival public picks are loaded one selected manager at a time and may be unavailable or incomplete.
- Fetched standings and rival squads are session-only. A failed refresh may retain the last session result with explicit stale wording; a page reload refetches public data.
- Points gaps and squad overlap are factual derivations. They do not establish projected rank, captaincy gain, meaningful differential quality or protect/chase strategy.
- League/member identifiers remain local but are necessarily sent to Official FPL/public relays for the requested read-only endpoint. They are omitted from routes, rendered diagnostics and Stage 10 evidence.

## Teamsheet 2.0.6 acceptance evidence

Teamsheet 2.0.6 is complete and merged through PR #65 at `cd1ad52ea4d13a247a82bc90f80f2db0b6f77aa4`. Automated contracts cover the nested Settings route map, nearest-parent fallbacks, exact route headings, parent-aware Back focus, identifier-free URLs, explicit Stage 10 UI hosts, export/recovery/deletion separation, consequence-led core-data warnings, build identity, mobile Player Explorer presentation, CSP and deterministic build integrity. A headless Chromium smoke check exercised direct deep links, active navigation, exact focus, Back restoration, dynamic hosts, warning copy and duplicate-ID absence. The verified baseline is **520 passed, 0 failed, 0 skipped**, with deterministic builds and root `index.html` equal to `dist/index.html`.

Physical testing of the actual repository build on an iPhone Safari was not performed. VoiceOver acceptance was not performed. Live populated-data acceptance was not performed. Headless Chromium is not equivalent to iPhone Safari, actual touch comfort, real assistive reading order or public endpoint availability. These limitations carry into Teamsheet 2.0.7 acceptance.

## Teamsheet 2.0.6 organisation limitations

- Player Explorer mobile cards change presentation only; a persistent watchlist and multi-player comparison remain unimplemented and require separate product approval.
- The warning classifier intentionally covers core Official FPL availability only. Optional-provider detail remains in Settings unless an existing recommendation path already exposes a material consequence.
- Browser Back focus restoration depends on the opener remaining in the current DOM. If it is unavailable, the exact route heading receives focus.
- Evidence, outcome and metric storage remains bounded local recovery. Reorganisation does not create a permanent archive or migration engine.
- A persistent screenshot-regression suite remains absent, so later visual changes still require human device review.


## Teamsheet 2.0.7 implementation acceptance status

The approved final-polish implementation is available for review and automated verification. UI-5, ML-3, UI-7 and UI-8 remain open until physical iPhone Safari and VoiceOver acceptance are recorded. FPL-1 remains an external live populated-data acceptance blocker if the public Pages transport still cannot load core Official FPL data. Automated completion does not close those limitations.


### Physical iPhone Safari foreground resume

Physical device acceptance identified a repeat-refresh interaction freeze when Safari returned from another app after an unsuccessful startup load. The approved correction is implemented on PR #68 and automated regression coverage passes, but the limitation remains open until Pritesh repeats the physical app-switch test successfully.

### PR #69 populated-data correction note
Physical iPhone review exposed pre-season public-picks and missing-team-strength gaps. The review branch now derives public picks from the current or explicit next Gameweek and fails honestly to manual setup when FPL withholds a complete public squad. Missing strength inputs no longer create `NaN`: Official FPL difficulty temporarily drives the fixture table/sort while player projections use neutral multipliers. Live owner retest remains required before FPL-2 can close.

### Overall FDR fallback limitation
When current Official FPL attack/defence strengths are unavailable, the Fixtures surface uses the provider's single overall 1–5 difficulty rating. It cannot honestly distinguish attacker and defender fixture quality, so those lenses are hidden and the direct average FDR is shown with lower meaning easier. This is coarse contextual data, not a position-specific model. A historical pre-season prior remains a separately gated design item.

<!-- TRANSFERS-TRACK-A-2026-08-06 -->
## Transfers Track A limitations

| ID | Description | Current impact | Planned stage | Status |
|---|---|---|---|---|
| TRF-PERF-1 | Exact automatic/persistent search is repository-verified but not yet performance-accepted on the physical iPhone | Correctness, non-blocking interaction and route persistence are automated; the proposed well-below-30-second default target, memory pressure and repeated-run stability remain unproven on Safari | Track A physical acceptance | Open acceptance gate |
| TRF-PERF-2 | A browser reload or page close ends the in-memory worker and result cache | The next valid session recalculates automatically; no durable optimiser-result database is introduced | By approved design | Accepted |
| TRF-PERF-3 | Exact pruning is intentionally conservative | It may leave performance on the table rather than risk changing plans or ordering; heuristic candidate restriction remains unapproved | Future only if device target fails | Accepted |
| TRF-PERF-4 | Deadline evidence can still invoke the optimiser directly outside the app-scoped Transfers controller | Evidence capture may retain a main-thread search path; this Track A UI architecture does not silently broaden into Stage 10 evidence orchestration | Separate scope gate | Open |

The Track A implementation does not address captaincy, bench emergency value, auto-subs, future transfer sequencing, recent player attacking-role form or heuristic/progressive search. Those remain separate model/data approval gates.
