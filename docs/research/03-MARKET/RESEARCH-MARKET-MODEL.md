# Research — Market / Odds Model

Status: **Planned**  
Programme root: [External Intelligence Foundation](../../EXTERNAL-INTELLIGENCE-FOUNDATION.md) §§2, 3.3, 9–13  
Control centre: [Research Programme](../README.md)  
Production effect: **None**  
Implementation approval: **Not granted**  
Research date: **TBD**

## 1. Research question

How should bookmaker market information be sourced, de-vigged, transformed, freshness-gated and evaluated, and does the current production market layer add incremental value?

## 2. Current Teamsheet behaviour

The Odds API provides UK-region h2h and totals where available. Current code validates, filters staleness/outliers, derives market-implied team goals and blends eligible market context at **65%**. That weight is judgement-based and unvalidated under D-09. Requests are direct-only and the key must never be relayed. Stage 10 already preserves the normalised Odds inputs that actually affected a prediction when the provider is healthy.

## 3. Why this matters

Markets may efficiently aggregate injuries, team strength and expectations, but that is also the main double-counting risk. Free-tier history limitations make prospective evidence especially important.

## 4. Candidate sources / repositories / approaches

Planned: current Odds API design as baseline; bookmaker-selection rules; alternative de-vig methods; h2h/totals transformations; staleness/outlier policies. New market providers are out of scope unless separately researched and approved.

## 5. Exact fields or observations required

Fixture identity, home/away teams, kickoff, bookmaker/market coverage counts, accepted h2h/totals inputs or the derived values needed for evaluation, fetched/observed/effective times, transform version and rejection reasons. Never persist the API key or keyed URL.

## 6. Coverage

TBD: EPL fixture coverage, bookmaker coverage, promoted teams, early/late market windows, blanks/doubles/postponements.

## 7. Freshness / update cadence

Current production cadence remains unchanged. Research must evaluate how staleness and market movement affect usefulness without assuming faster is automatically better.

## 8. Reliability

TBD: quote completeness, bookmaker disagreement, outliers, matching errors, quota/access failures and transform stability.

## 9. Historical availability

Free-tier historical odds are not available under the current plan. Normalised production inputs are prospectively captured by Stage 10 when healthy; raw bookmaker prices/intraday movement are not reconstructible later.

## 10. Cost / free-tier constraints

Current canonical docs record a capped free quota. Re-verify plan limits/pricing before any implementation or collection expansion.

## 11. Rights / licensing / retention

Permanent server retention of Odds-derived material remains separately gated. Raw bookmaker-level feed reconstruction/redistribution is not approved.

## 12. Security / privacy

D-06/SEC-1 direct-only key handling remains mandatory. No key, keyed URL, cookie, token or secret belongs in research/shadow evidence.

## 13. Canonical identity / mapping requirements

Fixture mapping must use canonical teams plus kickoff/fixture identity rules and explicitly reject ambiguous matches.

## 14. Proposed provider-neutral / shadow contract

TBD. Research observations must preserve transform version, timing, provenance and accepted/rejected status. No shadow market record may influence production until separately approved.

## 15. Fallback behaviour

Current internal team model remains the fallback with reduced-confidence labelling where already defined. No new fallback is approved here.

## 16. Failure modes

Quota/key rejection, missing market, stale quote, outlier book, fixture mismatch, postponed kickoff, partial market, transform error and rights uncertainty.

## 17. Double-counting / leakage risks

Odds may already price strength, form, injuries, lineups and congestion. Adding those factors separately can count the same information twice. Post-deadline odds must never leak into a pre-deadline evaluation.

## 18. Validation / ablation plan

Preserve the Foundation variants: FPL structural only, FPL+Understat, FPL+Odds and actual production. Predeclare any additional market transform variant before outcomes are inspected. No weight tuning from the same evaluation sample.

## 19. Required tests

Future changes require key isolation, fixture matching, de-vig/transform arithmetic, staleness/outlier, quota/fallback, provenance and no-production-effect shadow tests.

## 20. Evidence required before production use

Healthy frozen pre-deadline captures across enough Gameweeks plus untouched future validation for any changed transform or weight.

## 21. Current recommendation

**Planned. Keep current Odds behaviour and the unvalidated 65% blend unchanged. Prioritise truthful prospective capture.**

## 22. Explicit implementation approval gate

No Odds provider, collection, transform, retention or model-weight change without a separate provider/security/model proposal and explicit approval.