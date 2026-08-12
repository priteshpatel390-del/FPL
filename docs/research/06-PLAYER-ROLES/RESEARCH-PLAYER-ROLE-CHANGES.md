# Research — Player Role Changes

Status: **Planned**  
Programme root: [External Intelligence Foundation](../../EXTERNAL-INTELLIGENCE-FOUNDATION.md) §§3.6, 11, 14  
Control centre: [Research Programme](../README.md)  
Production effect: **None**  
Implementation approval: **Not granted**  
Research date: **TBD**

## 1. Research question

Can Teamsheet detect material player role changes — penalties, corners, direct free kicks and tactical/position shifts — in a way that adds useful information without double counting existing xG/xA or market context?

## 2. Current Teamsheet behaviour

No external role-change feed or fixed role bonus affects production projected points. Existing player attacking statistics and role-related scoring logic remain unchanged.

## 3. Why this matters

A genuine set-piece or positional change can alter opportunity, but noisy observations or a fixed xP bonus could overstate short-lived changes.

## 4. Candidate sources / repositories / approaches

Planned: Official FPL facts where available, match event evidence and credible free tactical/set-piece observations. No source is approved.

## 5. Exact fields or observations required

Player/team/fixture identity; role type; observed event/evidence; effective date; persistence/reversal evidence; source/observation/fetch times and provenance.

## 6. Coverage

TBD: penalties, corners, direct free kicks, tactical position/role and team/player changes across the season.

## 7. Freshness / update cadence

TBD. Role changes should be event-driven and expire/revert when evidence no longer supports them.

## 8. Reliability

TBD. Separate confirmed duty-taking from one-off incidents and measure persistence.

## 9. Historical availability

TBD. Determine which event evidence can be reconstructed consistently and what requires prospective capture.

## 10. Cost / free-tier constraints

TBD; re-verify before implementation.

## 11. Rights / licensing / retention

TBD per source; retain only permitted minimum normalised observations.

## 12. Security / privacy

No user-private data expected; no credential/new origin without separate approval.

## 13. Canonical identity / mapping requirements

Official FPL player/team/fixture identities are canonical; transfers and renamed clubs must map deterministically.

## 14. Proposed provider-neutral / shadow contract

TBD. Record role observations/events with provenance and `shadow_only`; never store “+X xP” as the observation itself.

## 15. Fallback behaviour

No role observation means current production behaviour unchanged.

## 16. Failure modes

One-off penalty, substitute taker, shared duties, tactical switch caused by game state, player transfer, ambiguous event attribution and stale role persistence.

## 17. Double-counting / leakage risks

Current xG/xA, recent form and odds can already reflect a new role. Any later adjustment must prove incremental value and avoid counting realised post-change output twice.

## 18. Validation / ablation plan

First validate detection/persistence. Any later predictive effect must be predeclared and compared with unchanged production prospectively.

## 19. Required tests

Future implementation: role-event identity, timing, persistence/reversal, ambiguous/shared duties, transfer handling, fallback and no-production-effect shadow tests.

## 20. Evidence required before production use

Reliable role classification plus prospective evidence of incremental predictive value on untouched future observations.

## 21. Current recommendation

**Planned. Research role-change observations; approve no fixed xP bonus or model adjustment.**

## 22. Explicit implementation approval gate

Any role source or model effect requires a separate provider/model proposal and explicit approval.