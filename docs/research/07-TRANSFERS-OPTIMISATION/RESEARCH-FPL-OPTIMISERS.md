# Research — FPL Optimisation Prior Art

Status: **Planned**  
Programme root: [External Intelligence Foundation](../../EXTERNAL-INTELLIGENCE-FOUNDATION.md) §§3.8, 14  
Control centre: [Research Programme](../README.md)  
Production effect: **None**  
Implementation approval: **Not granted**  
Research date: **TBD**

## 1. Research question

What can Teamsheet learn from credible FPL optimisation projects about multi-Gameweek planning, transfers, hits, free-transfer rollover, bank/value, chips, bench/captaincy and search under uncertainty?

## 2. Current Teamsheet behaviour

Teamsheet's current exact 0–3 transfer optimiser, zero-transfer baseline, legality, bank/free-transfer/hit handling, comparator and independent exhaustive oracle remain authoritative production behaviour. This research does not change them.

## 3. Why this matters

Mature open projects may expose useful formulations, edge cases and tests, but their objectives, data assumptions, solver dependencies and licence terms may be incompatible with Teamsheet.

## 4. Candidate sources / repositories / approaches

Planned: `alan-turing-institute/AIrsenal`, `solioanalytics/open-fpl-solver` and other credible projects found during research. Candidates are research subjects only and are not dependencies.

## 5. Exact fields or observations required

Document objective functions, decision variables, horizon handling, free-transfer rollover, hits, bank/value, chips, bench/captaincy, uncertainty/search method, solver/dependency requirements and reproducibility tests.

## 6. Coverage

TBD: supported FPL rules, season versions, transfer depths/horizons, chips and account-state assumptions.

## 7. Freshness / update cadence

Repository activity/version recency must be recorded at research time and rechecked before adoption.

## 8. Reliability

TBD: test quality, reproducibility, documented invariants, maintenance/activity and evidence of correctness.

## 9. Historical availability

Repository history is available subject to Git retention, but dataset/model inputs used by a project may not be point-in-time reproducible; record that separately.

## 10. Cost / free-tier constraints

TBD: project licences are separate from any solver/cloud/provider cost. Teamsheet's zero-dependency/no-registry constraints remain unless separately approved.

## 11. Rights / licensing / retention

Record exact repository licence and compatibility before copying any code. Concepts may be studied without assuming code can be reused.

## 12. Security / privacy

Do not adopt credential/account-write flows or dependencies without separate review. Teamsheet remains advisory and performs no FPL account writes.

## 13. Canonical identity / mapping requirements

If comparing implementations, map rules and player/team identities explicitly rather than assuming equivalent schemas.

## 14. Proposed provider-neutral / shadow contract

Not a provider branch. Any experimental optimiser comparison must remain downstream/offline research and must not replace production outputs without approval.

## 15. Fallback behaviour

Current Teamsheet optimiser remains the production path.

## 16. Failure modes

Incompatible FPL rules, hidden solver heuristics, package/network dependencies, stale season assumptions, different transfer-value semantics, unsupported chips and non-deterministic search.

## 17. Double-counting / leakage risks

Historical optimiser evaluation can use hindsight projections or actual outcomes unintentionally. Keep decision-time information boundaries explicit.

## 18. Validation / ablation plan

Compare formulations on controlled inputs against Teamsheet's independent oracle/invariants where tractable. Any proposed objective change requires separate prospective decision evaluation; lower runtime alone is not predictive improvement.

## 19. Required tests

Future adoption proposal: licence provenance, deterministic fixtures, rule equivalence, oracle comparisons, legality/budget/hit/roll/chip edge cases and preservation of existing tests.

## 20. Evidence required before production use

A reviewed algorithm/objective showing a concrete advantage under Teamsheet constraints, with correctness evidence and a separately approved model/design change.

## 21. Current recommendation

**Planned. Study prior art; do not copy blindly and do not alter the current optimiser.**

## 22. Explicit implementation approval gate

Any optimiser objective, search, dependency or rule change requires the full model/transfer approval package and Pritesh's explicit approval.