# Research — Availability, Injuries, Suspensions and Team News

Status: **Planned**  
Programme root: [External Intelligence Foundation](../../EXTERNAL-INTELLIGENCE-FOUNDATION.md) §§3.4, 7–8, 14  
Control centre: [Research Programme](../README.md)  
Production effect: **None**  
Implementation approval: **Not granted**  
Research date: **TBD**

## 1. Research question

Which free factual sources can reliably supplement Official FPL availability with injuries, suspensions and team news while preserving freshness, provenance and conflict handling?

## 2. Current Teamsheet behaviour

Official FPL availability/news/status is the production baseline and is applied once in expected minutes. No new injury/team-news source is approved.

## 3. Why this matters

Late factual availability can materially affect minutes, but unreliable or stale news can create false certainty.

## 4. Candidate sources / repositories / approaches

Planned: official club/competition information and credible free structured sources identified during research. Predictions/rumours are not factual availability and belong outside this record.

## 5. Exact fields or observations required

Player/team identity; fact type; status/injury/suspension information; source text/reference where permitted; observed/effective/fetched times; confidence/verification state; conflict status.

## 6. Coverage

TBD: all Premier League clubs/players, suspensions, illness/injury and late team updates.

## 7. Freshness / update cadence

TBD. Publication time and effective time are essential; stale news must expire rather than remain indefinitely active.

## 8. Reliability

TBD. Compare source claims with subsequent confirmed squads/official updates and explicitly measure conflicts/retractions.

## 9. Historical availability

TBD. News is often ephemeral; establish what can be captured prospectively and what cannot be reconstructed later.

## 10. Cost / free-tier constraints

TBD; re-verify before implementation.

## 11. Rights / licensing / retention

TBD. Do not assume that readable news text can be copied or durably stored. Prefer minimum factual normalisation with source provenance where rights allow.

## 12. Security / privacy

No user-private data expected. Avoid scraping/authentication schemes or credentials without explicit security review.

## 13. Canonical identity / mapping requirements

Official FPL player/team IDs are canonical. Name-only matching is forbidden; ambiguous reports remain unresolved.

## 14. Proposed provider-neutral / shadow contract

TBD. Factual availability observations must be shadow-only first, with timing, provenance, confidence and conflict fields.

## 15. Fallback behaviour

Official FPL availability remains the production fallback/baseline. Missing/conflicting external facts must not manufacture an availability state.

## 16. Failure modes

Rumour presented as fact, stale update, retraction, source conflict, ambiguous player, suspension competition mismatch, schema/page change and rights uncertainty.

## 17. Double-counting / leakage risks

Official FPL status and market odds may already reflect availability. Post-deadline confirmations must not be backfilled into pre-deadline decisions.

## 18. Validation / ablation plan

First measure factual precision, timeliness and conflict rates in shadow. Any later expected-minutes proposal must be predeclared and evaluated prospectively against starts/minutes.

## 19. Required tests

Future implementation: identity, timing/expiry, conflict resolution, fact-vs-prediction separation, missing/stale fallback, rights/provenance and no-production-effect tests.

## 20. Evidence required before production use

Prospective source reliability/freshness evidence plus a separate expected-minutes evaluation if an observation is proposed to affect probabilities.

## 21. Current recommendation

**Planned. Keep Official FPL as production availability and investigate external facts separately from predictions.**

## 22. Explicit implementation approval gate

Any new source or use in expected minutes/recommendations requires separate provider/model approval.