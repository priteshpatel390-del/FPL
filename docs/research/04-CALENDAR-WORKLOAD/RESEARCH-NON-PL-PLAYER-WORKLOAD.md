# Research — Non-Premier-League Player Workload

Status: **Planned**  
Programme root: [External Intelligence Foundation](../../EXTERNAL-INTELLIGENCE-FOUNDATION.md) §§3.4–3.5, 14  
Control centre: [Research Programme](../README.md)  
Production effect: **None**  
Implementation approval: **Not granted**  
Research date: **TBD**

## 1. Research question

Can player starts, minutes, substitutions and extra time outside the Premier League provide reliable incremental evidence for future expected-minutes estimates?

## 2. Current Teamsheet behaviour

Expected minutes use current-season Official FPL histories plus aggregate/prior fallbacks and Official availability. Non-Premier-League player workload is not a production input.

## 3. Why this matters

European/domestic-cup minutes may reveal rotation load that Premier League history alone cannot see, but the effect must be learned rather than assumed.

## 4. Candidate sources / repositories / approaches

Planned: sources capable of player-level starts/minutes/substitutions/extra time across UEFA and domestic cups. No source is approved by this stub.

## 5. Exact fields or observations required

Canonical player identity, club, fixture/competition, kickoff, started, minutes, substitution-on/off timing where available, extra-time minutes and observation/fetch provenance.

## 6. Coverage

TBD across relevant Premier League players and competitions; missing reserve/youth/qualifier coverage must be explicit.

## 7. Freshness / update cadence

TBD. Post-match corrections and late-stat updates need separate observation/effective/fetch timing.

## 8. Reliability

TBD: compare starts/minutes against authoritative match records and quantify missing/conflicting cases.

## 9. Historical availability

TBD. Determine what historical player workload can be reconstructed point-in-time and where only final corrected data exists.

## 10. Cost / free-tier constraints

TBD; re-verify before implementation.

## 11. Rights / licensing / retention

TBD per source. Player-level data retention/redistribution rights require explicit classification.

## 12. Security / privacy

Public football facts only; nevertheless no credential, keyed URL or secret belongs in retained observations.

## 13. Canonical identity / mapping requirements

Player mapping is a primary risk. Official FPL player IDs are canonical; name-only joins are forbidden. Transfers/club changes must be handled explicitly.

## 14. Proposed provider-neutral / shadow contract

TBD. Player-workload observations must be shadow-only, fixture-linked and provenance/timing complete.

## 15. Fallback behaviour

Current Official FPL-only expected-minutes behaviour remains unchanged when workload observations are absent or invalid.

## 16. Failure modes

Player identity collision, transfer between clubs, missing substitution detail, extra-time accounting, duplicate appearances, postponed fixtures, late corrections and partial competition coverage.

## 17. Double-counting / leakage risks

Recent Premier League minutes, availability/team news and predicted line-ups may already encode workload effects. Post-match facts must never leak into earlier expected-minutes snapshots.

## 18. Validation / ablation plan

If later proposed, compare unchanged production expected-minutes outputs with a predeclared workload-evidence variant using prospective `pStart`, `pAppear`, `p60` calibration/Brier and `expMin` MAE/RMSE.

## 19. Required tests

Future implementation: player/fixture mapping, extra-time arithmetic, substitution/minute bounds, transfer identity, stale/missing fallback, provenance and no-production-effect shadow tests.

## 20. Evidence required before production use

Prospective player-level observations across enough fixtures plus untouched future evaluation demonstrating incremental expected-minutes value.

## 21. Current recommendation

**Planned. Collect/research workload evidence only after a separate shadow-data approval; do not alter expected minutes now.**

## 22. Explicit implementation approval gate

Any source integration or expected-minutes use requires a separate provider/model proposal and Pritesh's explicit approval.