# Research — Predicted Line-ups and Start Probability

Status: **Planned**  
Programme root: [External Intelligence Foundation](../../EXTERNAL-INTELLIGENCE-FOUNDATION.md) §§3.4, 11–12, 14  
Control centre: [Research Programme](../README.md)  
Production effect: **None**  
Implementation approval: **Not granted**  
Research date: **TBD**

## 1. Research question

Can predicted-lineup sources provide useful calibrated evidence for `pStart`, `pAppear`, `p60` and `expMin`, and how should multiple-source disagreement be represented?

## 2. Current Teamsheet behaviour

Expected minutes are derived from Official FPL histories/availability and existing priors. Predicted line-ups are not a production input. A source saying “starts” must never be converted directly into `pStart = 1` (or absence into `0`).

## 3. Why this matters

Late lineup expectations may contain useful rotation information, but predictions are uncertain opinions rather than confirmed availability.

## 4. Candidate sources / repositories / approaches

Planned: credible free predicted-lineup sources and ensemble/disagreement approaches. Subscription scraping is not approved.

## 5. Exact fields or observations required

Player/team/fixture identity; predicted starting/bench/absent state or source probability if genuinely supplied; publication/observation/effective/fetch times; source version; confidence if defined; disagreement metadata.

## 6. Coverage

TBD: all EPL fixtures/teams, deadline proximity, promoted teams and missing-source cases.

## 7. Freshness / update cadence

TBD. Capture prediction revisions with time; later revisions must not overwrite what was known at the frozen decision time.

## 8. Reliability

TBD. Score frozen predictions against confirmed starts/appearances/60-minute outcomes and minutes, including per-source calibration and disagreement cases.

## 9. Historical availability

Likely limited for point-in-time predictions; verify rather than assume. Prospective capture may be necessary.

## 10. Cost / free-tier constraints

TBD; re-verify access, limits and any subscription boundary.

## 11. Rights / licensing / retention

TBD. Prediction text/feeds may have stricter reuse rights than factual outcomes; minimum normalised facts only where approved.

## 12. Security / privacy

No user-private data expected. Credentials/paywall bypass/scraping are not approved by this research record.

## 13. Canonical identity / mapping requirements

Map every prediction to Official FPL player/team/fixture identity. Name-only matching is forbidden.

## 14. Proposed provider-neutral / shadow contract

TBD. Store a source observation, not a model instruction. Preserve source timing, confidence/disagreement and `shadow_only` mode.

## 15. Fallback behaviour

Current expected-minutes model remains unchanged when predictions are absent, stale, conflicting or invalid.

## 16. Failure modes

Late edits, copied consensus across sites, ambiguous players, wrong fixture, stale prediction, source disagreement, no explicit probability and rights/access change.

## 17. Double-counting / leakage risks

Predicted line-ups may incorporate the same injuries, congestion and press-conference news used elsewhere. Confirmed lineups published after the FPL deadline cannot be used to evaluate a pre-deadline model as if they were known beforehand.

## 18. Validation / ablation plan

Freeze predictions before deadlines; evaluate source and ensemble reliability on `pStart`, `pAppear`, `p60` and `expMin`. Only then predeclare a model ablation against unchanged production.

## 19. Required tests

Future implementation: point-in-time immutability, identity, disagreement, expiry, probability-bound handling, no binary override, fallback and no-production-effect shadow tests.

## 20. Evidence required before production use

Enough prospective frozen predictions and outcomes to establish reliability/calibration, followed by untouched future validation for any expected-minutes integration.

## 21. Current recommendation

**Planned. Treat predicted line-ups as uncertain shadow evidence only; do not alter expected minutes.**

## 22. Explicit implementation approval gate

Any predicted-lineup provider or influence on expected minutes/recommendations needs separate provider/model approval.