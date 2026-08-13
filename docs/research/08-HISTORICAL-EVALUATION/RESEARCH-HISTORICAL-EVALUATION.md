# Research — Historical Evaluation

Status: **Planned**  
Programme root: [External Intelligence Foundation](../../EXTERNAL-INTELLIGENCE-FOUNDATION.md) §§9, 12, 15  
Control centre: [Research Programme](../README.md)  
Production effect: **None**  
Implementation approval: **Not granted**  
Research date: **TBD**

## 1. Research question

How should Teamsheet use historical datasets, walk-forward testing, prospective evidence, calibration and ablation without leakage or exaggerated accuracy claims?

## 2. Current Teamsheet behaviour

Stage 7 uses a pinned vaastav historical archive for chronological diagnostic replay. Historical provider gaps mean it is not full validation of every current input. Stage 10 prospective evidence is downstream and does not auto-tune production. Historical aggregate r≈0.80 remains method-flattered.

## 3. Why this matters

Historical evidence is useful for experiment design and rejecting weak ideas, but incomplete decision-time inputs and post-event knowledge can make backtests look stronger than reality.

## 4. Candidate sources / repositories / approaches

Planned: current pinned vaastav dataset; other reproducible free historical FPL/fixture sources; walk-forward, calibration and ablation methods. `vaastav/Fantasy-Premier-League` is also reviewed in External Repositories for licence/maintenance/prior art.

## 5. Exact fields or observations required

Decision-time player/fixture/team facts, outcomes, deadlines, source revisions, model/version identity and exact feature availability at each simulated decision time.

## 6. Coverage

TBD: seasons, promoted teams, rule changes, blanks/doubles/postponements, price/status/minutes and missing provider layers.

## 7. Freshness / update cadence

Historical snapshots are immutable/pinned where possible. Prospective records preserve actual decision-time capture and later corrections separately.

## 8. Reliability

TBD: dataset completeness, correction history, schema consistency and whether fields were truly available pre-deadline.

## 9. Historical availability

Central research question. Explicitly classify each current input as reconstructible, approximately reconstructible or prospective-only.

## 10. Cost / free-tier constraints

Prefer reproducible free sources; record any download/API limits and re-verify before use.

## 11. Rights / licensing / retention

Record dataset/repository licences and redistribution limits; immutable pinning does not override rights.

## 12. Security / privacy

Historical evaluation must not retain user account identifiers or secrets unnecessarily. Existing evidence privacy rules remain.

## 13. Canonical identity / mapping requirements

Versioned player/team/fixture identity across seasons, transfers and promoted/relegated clubs; name-only joins are insufficient.

## 14. Proposed provider-neutral / shadow contract

Historical evaluation should consume frozen/versioned research observations without creating a production read path.

## 15. Fallback behaviour

When an input cannot be reconstructed honestly, mark the experiment partial or exclude that comparison; do not synthesize hindsight data as if known pre-deadline.

## 16. Failure modes

Target leakage, revised outcome leakage, survival bias, missing seasons, rule drift, data corrections, tuning on holdout, duplicated fixtures and unpinned mutable downloads.

## 17. Double-counting / leakage risks

This branch owns leakage discipline. Features created from the same outcomes later used to score them, post-deadline lineups/news and full-season aggregates at early decision points are prohibited unless explicitly treated as hindsight diagnostics.

## 18. Validation / ablation plan

Chronological train/calibration/holdout for historical diagnostics, predeclared prospective ablations, clustered/Gameweek-aware interpretation and untouched future Gameweeks for any idea designed using GW1–GW5.

## 19. Required tests

Future evaluation tooling: chronology, deadline cutoffs, dataset hash/version, identity, duplicate/correction handling, split isolation, deterministic metrics and explicit partial-evidence labelling.

## 20. Evidence required before production use

Historical support can justify a prospective experiment, not production activation by itself. Production changes require genuine out-of-sample/prospective evidence appropriate to the claim.

## 21. Current recommendation

**Planned. Use historical evidence to design/triage experiments, while preserving prospective evidence as the decisive accuracy gate.**

## 22. Explicit implementation approval gate

No automatic calibration, tuning or model change is authorised. Any such proposal requires separate model approval.