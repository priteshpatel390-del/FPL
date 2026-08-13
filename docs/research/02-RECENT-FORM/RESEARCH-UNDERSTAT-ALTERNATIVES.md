# Research — Recent Form / Understat Alternatives

Status: **Planned**  
Programme root: [External Intelligence Foundation](../../EXTERNAL-INTELLIGENCE-FOUNDATION.md) §§2, 3.2, 7–8, 11–12  
Control centre: [Research Programme](../README.md)  
Production effect: **None**  
Implementation approval: **Not granted**  
Research date: **TBD**

## 1. Research question

Should Teamsheet repair, replace or retire the current Understat team-form layer, and which free team-level xG/xGA approaches are credible alternatives?

## 2. Current Teamsheet behaviour

Understat remains **team-level only** under D-05. The current design uses last-six team xG/xGA as a 45% blend against the structural baseline when valid, but the measured current page did not expose the parser's expected `teamsData` shape. R1 limits repeated waste; it does not repair the parser. Production falls back to Official FPL strengths.

## 3. Why this matters

A broken or low-value form layer adds complexity without useful information. A replacement is worthwhile only if it is reliable, rights-safe and incrementally useful.

## 4. Candidate sources / repositories / approaches

Planned: repair current Understat extraction; retire Understat; evaluate credible free team-level xG/xGA alternatives. `amosbastian/understat` belongs to the separate External Repositories branch as prior art, not an approved dependency.

## 5. Exact fields or observations required

Team identity; match date/fixture identity; team xG/xGA or equivalent; source observation/effective/fetch times; provenance and quality indicators.

## 6. Coverage

TBD: EPL teams, promoted teams, season transition, missing/postponed matches and historical depth.

## 7. Freshness / update cadence

TBD. Research must distinguish completed-match revision from fetch cadence and avoid treating stale values as current form.

## 8. Reliability

TBD: parser/schema stability, missingness, correction behaviour and cross-check against known fixtures/results.

## 9. Historical availability

TBD. Determine whether point-in-time team-form inputs can be reconstructed without post-match leakage.

## 10. Cost / free-tier constraints

TBD; re-verify current access and limits before implementation.

## 11. Rights / licensing / retention

TBD. Current permanent Understat server retention remains fail-closed. Any alternative needs an explicit rights classification.

## 12. Security / privacy

No secret or user identifier should be required. Any scrape/API transport still needs origin, relay and diagnostic-scrubbing review.

## 13. Canonical identity / mapping requirements

Deterministic team mapping to Official FPL identity; no display-name-only join.

## 14. Proposed provider-neutral / shadow contract

TBD. A future team-form observation must use the Foundation contract and begin `shadow_only` unless separately promoted.

## 15. Fallback behaviour

Official FPL structural strengths remain the production fallback. A failed form source must not manufacture a multiplier.

## 16. Failure modes

Parser/schema drift, incomplete teams, stale last-six window, promoted-team history gaps, postponed fixtures, conflicting identities and rights uncertainty.

## 17. Double-counting / leakage risks

Recent form overlaps with structural strength and market odds; combining them without ablation risks counting the same match information multiple times.

## 18. Validation / ablation plan

Predeclare FPL-only, current Understat and candidate alternative variants. Evaluate chronologically/prospectively and keep team-level xG/xGA separate from player xG/xA.

## 19. Required tests

Future implementation: parser/schema fixtures, team mapping, stale/missing fallback, no player-level Understat path, provenance and no-production-effect shadow tests.

## 20. Evidence required before production use

Reliable acquisition plus incremental out-of-sample/prospective value relative to FPL-only and current production variants.

## 21. Current recommendation

**Planned. Do not repair, replace, retire or reweight Understat in this checkpoint.**

## 22. Explicit implementation approval gate

Any Understat repair/retirement, new provider or 45% blend change requires a separate evidence-led proposal and explicit approval.