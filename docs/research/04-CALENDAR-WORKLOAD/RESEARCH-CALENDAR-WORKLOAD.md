# Research — Calendar, Congestion and Travel

Status: **Planned**  
Programme root: [External Intelligence Foundation](../../EXTERNAL-INTELLIGENCE-FOUNDATION.md) §§3.5, 7–8, 11, 14  
Control centre: [Research Programme](../README.md)  
Production effect: **None**  
Implementation approval: **Not granted**  
Research date: **TBD**

## 1. Research question

Which cross-competition calendar, rest, extra-time, venue and travel facts can Teamsheet observe reliably, and can they later support evidence-led expected-minutes research without inventing a generic fatigue penalty?

## 2. Current Teamsheet behaviour

Production fixture context is based on current approved FPL/Understat/Odds inputs. There is no approved Champions League, Europa League, Conference League, FA Cup or League Cup workload provider and no arbitrary `Europe = -X xP` adjustment.

## 3. Why this matters

Fixture density may affect rotation and availability, but a crude penalty can double count information already reflected by odds, team news or historical minutes.

## 4. Candidate sources / repositories / approaches

Planned: free/official competition calendars and credible structured football sources for Premier League, Champions League, Europa League, Conference League, FA Cup and League Cup. Source selection is not approved here.

## 5. Exact fields or observations required

Team/fixture/competition identity, kickoff, venue/home-away, prior/next fixture time, rest hours, fixture count over 7/14 days, extra-time occurrence and a defined travel observation where safely measurable.

## 6. Coverage

TBD: all Premier League clubs across domestic and UEFA competitions, qualifiers where relevant, postponements/replays and competition format changes.

## 7. Freshness / update cadence

TBD. Changes/postponements must carry observation and effective times; stale calendars must not masquerade as current.

## 8. Reliability

TBD: official versus community source accuracy, rescheduling latency, extra-time completeness and venue correctness.

## 9. Historical availability

TBD: determine whether point-in-time schedules and later rearrangements can be reconstructed without hindsight.

## 10. Cost / free-tier constraints

TBD and time-sensitive; re-verify before implementation.

## 11. Rights / licensing / retention

TBD for each competition/source. Unknown retention rights fail closed.

## 12. Security / privacy

No user-private data expected. No new key/origin/relay may be added without separate security approval.

## 13. Canonical identity / mapping requirements

Map clubs to Official FPL team identity and keep competition/fixture identity explicit. Do not join by display name alone.

## 14. Proposed provider-neutral / shadow contract

TBD. Calendar observations must remain factual provider-neutral shadow records with timing/provenance and no direct xP/minutes effect.

## 15. Fallback behaviour

Missing external calendar data means no external workload observation; production behaviour remains unchanged.

## 16. Failure modes

Postponements, late rescheduling, neutral venues, extra time, duplicate fixtures, ambiguous club identity, incomplete competition coverage and stale cached calendars.

## 17. Double-counting / leakage risks

Odds and team news may already encode congestion effects. Later-known rescheduling or extra time must not be backdated into earlier predictions.

## 18. Validation / ablation plan

First validate factual capture/identity. If later proposed as expected-minutes evidence, predeclare a shadow variant and compare with unchanged production using prospective starts/minutes outcomes; do not assume a universal fatigue coefficient.

## 19. Required tests

Future implementation: cross-competition identity, reschedule/postponement, rest-hour arithmetic, extra-time, stale/missing fallback, timing/provenance and no-production-effect tests.

## 20. Evidence required before production use

Reliable cross-competition capture plus prospective evidence that a specific derived observation adds useful expected-minutes information.

## 21. Current recommendation

**Planned. Research factual calendar/workload observations only; approve no production penalty or model effect.**

## 22. Explicit implementation approval gate

Any source integration, scheduled collection or use in fixture strength/expected minutes requires a separate approved proposal.