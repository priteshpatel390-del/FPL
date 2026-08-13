# Research — Structural Team Strength

Status: **Planned**  
Programme root: [External Intelligence Foundation](../../EXTERNAL-INTELLIGENCE-FOUNDATION.md) §§1, 3.1, 11–12  
Control centre: [Research Programme](../README.md)  
Production effect: **None**  
Implementation approval: **Not granted**  
Research date: **TBD**

## 1. Research question

Should Teamsheet add an independent structural team-strength anchor, and if so which approach is most useful for early-season and promoted-team uncertainty without duplicating current inputs?

## 2. Current Teamsheet behaviour

Production uses Official FPL team strengths as the structural foundation. ClubElo is recorded under D-10 only as an unimplemented candidate prior/anchor. Understat and Odds are separate recent-form/market layers and must not be silently reclassified as structural strength.

## 3. Why this matters

Early-season and promoted-team inputs can be sparse or coarse. An independent anchor may be useful, but only if it contributes information that is not already represented and survives proper ablation.

## 4. Candidate sources / repositories / approaches

Planned: Official FPL strengths as the required baseline comparator; ClubElo; credible free alternatives discovered during investigation. Candidate status is not provider approval.

## 5. Exact fields or observations required

TBD. At minimum research team identity, dated rating/strength value, effective date, competition/season context and promoted-team mapping.

## 6. Coverage

TBD: all 20 Premier League clubs, promoted clubs, pre-season/early-season availability and continuity across seasons.

## 7. Freshness / update cadence

TBD. Rating effective time and fetch time must remain distinct.

## 8. Reliability

TBD. Compare stability, missingness and predictive usefulness against the current structural baseline rather than relying on provider reputation.

## 9. Historical availability

TBD. Determine whether ratings can be reconstructed at historical decision dates without hindsight leakage.

## 10. Cost / free-tier constraints

TBD and time-sensitive; re-verify before any implementation proposal.

## 11. Rights / licensing / retention

TBD. Access, storage, redistribution and attribution rights must be classified separately; unknown retention fails closed.

## 12. Security / privacy

No user-private data is expected. Any future acquisition still requires origin/transport review and must introduce no client secret without approval.

## 13. Canonical identity / mapping requirements

Map every team to the current Official FPL team identity through a reviewed deterministic mapping. Display-name-only matching is not sufficient.

## 14. Proposed provider-neutral / shadow contract

TBD. Any future observation must conform to the Foundation contract and begin `shadow_only`; no rating may write directly into fixture context or projected points.

## 15. Fallback behaviour

Current Official FPL structural behaviour remains the fallback and production baseline unless separately changed.

## 16. Failure modes

TBD: missing promoted clubs, stale ratings, club rename/relegation identity drift, season discontinuity, source outage and ambiguous effective dates.

## 17. Double-counting / leakage risks

Primary risk: blending another strength-like signal on top of FPL, Understat and Odds without establishing independent value. Historical ratings captured after a match must not be used as if known before it.

## 18. Validation / ablation plan

Predeclare FPL structural-only versus FPL plus candidate structural anchor, including early-season/promoted-team segments. Use chronological/prospective evidence; do not tune and report on the same sample.

## 19. Required tests

TBD. Future implementation would need identity, effective-time, stale/missing fallback, provider-neutral schema and structural no-production-effect tests before any model-consumption proposal.

## 20. Evidence required before production use

Coverage/reliability evidence plus out-of-sample or prospective ablation showing useful incremental information without unacceptable overlap.

## 21. Current recommendation

**Planned. Keep current production structural behaviour unchanged while the branch is investigated.**

## 22. Explicit implementation approval gate

Any proposed provider acquisition, retained rating or model blend requires a separate provider/model proposal and Pritesh's explicit approval.