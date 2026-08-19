# Research — Historical Evaluation

Status: **Research complete**  
Programme root: [External Intelligence Foundation](../../EXTERNAL-INTELLIGENCE-FOUNDATION.md) §§9, 12, 15  
Control centre: [Research Programme](../README.md)  
Production effect: **None**  
Implementation approval: **Not granted**  
Research date: **13 August 2026**

## 1. Research question

What historical evidence can Teamsheet legitimately use to evaluate ideas, reject weak hypotheses and design future experiments without creating hindsight leakage or overstating predictive accuracy?

## 2. Current Teamsheet behaviour

Teamsheet has three materially different evaluation paths:

- legacy `computeBacktest()` survives for regression/historical comparison but is not valid out-of-sample validation because it uses realised future minutes and same-sample calibration;
- Stage 7 archive replay uses a pinned vaastav archive and chronological `informationGameweek < gameweek` discipline, rolling train/calibration/holdout folds and identical-key ablations, but reconstructs a simplified archive model rather than the full production information bundle;
- Stage 10 prospective evidence freezes the actual current predictions, minutes probabilities, decisions, provider/model/rules/build identity and later links outcomes without rerunning the current model.

The historical aggregate `r≈0.80` therefore remains **method-flattered** and must not be described as validated predictive accuracy.

## 3. Why this matters

Historical evidence is useful only when the information available at the simulated decision time is known. A field organised by Gameweek is not automatically a pre-deadline snapshot. Temporal provenance therefore comes before accuracy metrics: a precise RMSE, correlation or ablation on leaking data is not meaningful evidence.

Historical replay can reject obviously weak hypotheses, detect gross bias, test chronology/data integrity, compare reconstructible variants and help predeclare future experiments. It cannot establish the prospective accuracy of the complete current production model when important inputs were not archived as they existed before historical deadlines.

## 4. Candidate sources / repositories / approaches

Primary historical source already used by Teamsheet:

- [`vaastav/Fantasy-Premier-League`](https://github.com/vaastav/Fantasy-Premier-League) — strongest immediately relevant free FPL historical archive, but not automatically deadline-safe.

Useful prior art for historical state/snapshot methodology:

- [`alan-turing-institute/AIrsenal`](https://github.com/alan-turing-institute/AIrsenal) — persistent historical modelling, identity/state and replay tooling;
- [`martgra/fpl-timeseries-data`](https://github.com/martgra/fpl-timeseries-data) — stale but useful prior art for timestamped upstream snapshots rather than retrospectively consolidated season files.

Approaches assessed: rolling-origin/walk-forward evaluation, field-level temporal provenance, calibration diagnostics, proper probability scoring, paired ablation and untouched future validation.

## 5. Exact fields or observations required

For any historical experiment preserve or establish:

- prediction unit and target Gameweek/fixture;
- exact source/version/checksum;
- value plus when it became knowable;
- observation/fetch/effective/deadline timing where relevant;
- player/team/fixture canonical identity and effective team membership;
- rule version;
- model/rules/build identity for prospective records;
- target outcome collected only after the prediction origin;
- correction/revision history where available.

Historical fields currently useful when strictly lagged include earlier-GW points, minutes, BPS, cards, saves and relevant xG/xA coverage. Candidate price/selection/transfer fields require timestamp-semantics verification before stateful transfer replay.

## 6. Coverage

The current Stage 7 archive replay covers a simplified historical projection problem, not faithful historical production replay. It does not reconstruct the complete historical deadline state for current fixture strength, expected-minutes probabilities, provider health, exact Odds inputs, Understat state, detailed availability/team news, predicted line-ups or role beliefs.

Evaluation must segment early season, promoted clubs, blanks/doubles/postponements, transfers, rule changes, missing-history players and provider/data-regime changes rather than silently pooling them.

## 7. Freshness / update cadence

Historical datasets should be immutable/pinned where possible. The current Stage 7 path pins a specific vaastav archive revision and validates its content hash.

Time-sensitive dataset schemas, update policies and licences must be re-verified before new implementation. Prospective Stage 10 evidence remains the preferred source for actual current-system evaluation.

## 8. Reliability

Chronology plumbing is necessary but not sufficient. `informationGameweek < gameweek` protects against explicit target-GW lookahead, but a retrospectively consolidated field can still carry a value that was not genuinely available at that earlier time.

Reliability therefore requires **field-level temporal provenance**, not merely Gameweek labels.

The vaastav archive is valuable for outcomes and lagged features, but its own documentation warns that `xP` can contain post-GW information. Same-GW `xP` must not be used as a decision-time feature.

## 9. Historical availability

Research classification:

- **Safely historical:** lagged points/minutes/BPS/cards and other clearly prior-fixture observations; transfer-rule mechanics when rules are historically versioned.
- **Historical with important limitations:** lagged xG/xA across varying field regimes, structural team strength, workload reconstructed from final schedules, player price/ownership/transfer state, historical availability/role evidence and transfer strategy replay.
- **Prospective evidence required:** current expected-minutes state, exact bookmaker input/quote state, provider health/failure state, predicted line-ups, current availability beliefs, exact role beliefs and faithful replay of the complete current production model.

When an input cannot be reconstructed honestly, evaluate a reduced model or wait for prospective evidence. Do not synthesize hindsight data as if it were known pre-deadline.

## 10. Cost / free-tier constraints

Historical evaluation should prefer reproducible free sources. Free access does not remove rate, availability, maintenance, retention or licensing constraints. No paid data source is approved by this research.

## 11. Rights / licensing / retention

Repository software licences do not automatically grant rights to upstream football/FPL data. This is explicit in the vaastav repository and applies generally to wrappers/archives that contain third-party data.

Any future historical-data adoption must separately verify software licence, source-data rights, redistribution/retention and current terms.

## 12. Security / privacy

Historical evaluation must not retain user account identifiers, authentication material or secrets unnecessarily. Existing evidence privacy and custody rules remain authoritative.

Prospective provider failure/health evidence must be captured without exposing credentials or raw secrets.

## 13. Canonical identity / mapping requirements

Use stable season-aware player/team/fixture IDs plus effective dates or explicit crosswalks. Name-only joins are insufficient.

Historical transfers and promoted/relegated clubs must not be reconstructed using present-day membership/name assumptions. Identity mapping itself is a potential leakage source if current knowledge is projected backwards.

## 14. Proposed provider-neutral / shadow contract

Future historical/shadow evaluation should represent each observation with enough timing and provenance to answer: **was this exact value knowable at the simulated decision time?**

At minimum the research contract should carry canonical identity, source/version, observed/effective/fetched timing where applicable, decision/deadline context, immutable payload/value identity and correction status. It must remain outside production read paths unless separately approved.

## 15. Fallback behaviour

If a field's decision-time provenance cannot be established:

1. classify the experiment as partial;
2. remove that field and evaluate a reduced reconstructible model; or
3. require prospective evidence.

Never replace the missing field with a later/closing/revised value and describe the result as historical production replay.

## 16. Failure modes

Critical failure modes include:

- end-of-season or same-GW statistics leaking backwards;
- future minutes/starts/injuries/roles/transfers;
- revised fixture schedules or post-match values treated as pre-deadline facts;
- closing bookmaker information substituted for deadline information;
- current team/player mappings projected backwards;
- tuning and evaluating on the same Gameweeks;
- hypothesis selection after inspecting the evaluation period;
- survivor/missing-player bias;
- post-hoc corrections hidden by consolidated archives;
- current FPL rules applied to historical seasons;
- retrospective provider success hiding real historical outages.

The legacy `computeBacktest()` belongs in this category as a historical diagnostic rather than validation because of future-minutes and same-sample-calibration leakage.

## 17. Double-counting / leakage risks

This branch owns the rule that **temporal provenance precedes metrics**.

Features created from the same outcome later used to score them, future line-up/news knowledge, full-season aggregates at early prediction points, same-GW vaastav `xP`, closing odds unavailable at the decision time and post-hoc model selection are prohibited from being presented as clean out-of-sample evidence.

Any idea selected after inspecting GW1–GW5 becomes a design choice and must face later untouched Gameweeks before an improvement claim is allowed.

## 18. Validation / ablation plan

Recommended hierarchy:

1. integrity;
2. temporal provenance;
3. coverage;
4. calibration and bias;
5. projection error/ranking;
6. predeclared paired ablation;
7. decision-quality evaluation;
8. untouched prospective validation.

Use rolling-origin chronology rather than random train/test mixing. Separate **TRAIN/DESIGN**, chronologically later **VALIDATION**, and a fixed **UNTOUCHED FUTURE TEST**. Once validation results drive a choice, that period is no longer untouched.

Retrospective ablations are valid only where every compared input can be reconstructed at the original decision time. Exact Odds, current provider state, current expected-minutes enhancements, predicted line-ups and similar live beliefs require prospective ablation.

Different questions require different primary units: player×fixture for minutes/projection mechanisms where possible, fixture/team×fixture for team models, decision-set×GW for captaincy, and frozen manager-state×decision-GW/horizon for transfer/optimiser evaluation.

## 19. Required tests

Future evaluation tooling should test:

- immutable source/version/checksum;
- chronology and deadline cutoffs;
- field-level temporal-provenance classification;
- identity/effective-date mapping;
- duplicate/correction handling;
- historical FPL rule versioning;
- train/validation/test isolation;
- identical-key paired ablations;
- deterministic metrics;
- explicit partial-evidence labelling;
- no future target/minutes/starts/provider state in inputs.

Metrics should answer specific questions rather than be treated as interchangeable proof. MAE/RMSE/bias/rank correlation are point-forecast diagnostics; Brier/log loss/reliability are appropriate for binary expected-minutes probabilities; interval coverage/width assess uncertainty; captain/transfer/squad metrics require frozen pre-decision counterfactuals and must separate projection quality from decision/optimiser quality.

## 20. Evidence required before production use

Historical evidence can justify rejecting an idea or proposing a prospective experiment. It does not by itself justify production activation where the current production information bundle was not historically reconstructible.

Claims about current expected-minutes calibration, exact Odds value, live provider/availability/line-up value, transfer-policy superiority or complete production accuracy require genuine prospective deadline-state evidence.

No universal player-observation count or small number of Gameweeks is treated as validation. Player×GW observations are clustered by fixture, team and repeated player; GW1–GW5 remains evidence collection/diagnosis.

## 21. Current recommendation

**Research complete.** Use historical evidence for integrity checks, chronology, reconstructible lagged-feature diagnostics, bias/calibration/error description, carefully controlled retrospective ablations and experiment design.

Do **not** describe Stage 7 as faithful replay of the complete current production model. Preserve Stage 10 prospective evidence as the decisive route for current production behaviour.

Research priority emerging from this branch:

1. prospective expected-minutes calibration and projection diagnostics using existing Stage 10 evidence;
2. temporal-provenance/snapshot methodology;
3. leakage-safe structural team-strength research;
4. stateful transfer/multi-GW research;
5. later provider/workload/availability/market ablations when authentic timestamped evidence exists.

## 22. Explicit implementation approval gate

This research authorises **no** automatic calibration, tuning, replay rewrite, new dataset/provider, model change, expected-minutes change, Odds change, optimiser change or production shadow store.

Any implementation must present existing/proposed behaviour, exact inputs/sources/timing, fallbacks, assumptions, leakage controls, rights/security, validation/ablation plan and tests, then receive separate owner approval.