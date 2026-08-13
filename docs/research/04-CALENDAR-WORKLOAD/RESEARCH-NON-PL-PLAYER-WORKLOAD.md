# Research — Non-Premier-League Player Workload

Status: **Research complete**  
Programme root: [External Intelligence Foundation](../../EXTERNAL-INTELLIGENCE-FOUNDATION.md) §§3.4–3.5, 14  
Control centre: [Research Programme](../README.md)  
Production effect: **None**  
Implementation approval: **Not granted**  
Research date: **13 August 2026**

## 1. Research question

Can player starts, minutes, substitutions and extra time outside the Premier League provide reliable incremental evidence for future expected-minutes estimates?

## 2. Current Teamsheet behaviour

Expected minutes use current-season Official FPL histories plus aggregate/prior fallbacks and Official availability. Non-Premier-League player workload is not a production input. The current estimator does not inspect player-level European or domestic-cup exposure.

## 3. Why this matters

European/domestic-cup minutes may reveal rotation load that Premier League history alone cannot see, but the effect must be learned rather than assumed. Workload facts must not be converted into an arbitrary `Europe = -X xP`, fixed-minutes penalty or travel penalty.

## 4. Candidate sources / repositories / approaches

Research identified these serious candidates, all unapproved for production:

- **Sportmonks — high-value research candidate:** structured fixtures, line-ups, events and player statistics across broad football coverage. Headline 13 August 2026 pricing/coverage is time-sensitive and must be re-verified with detailed rights/retention terms before any collection proposal.
- **API-Football — high-value research candidate:** structured fixtures, events, line-ups, player statistics and sidelined/injury information. Free/paid access, exact competition coverage and rights/retention require implementation-time re-verification.
- **StatsBomb Open Data — medium-value historical-methodology candidate:** useful event/line-up data for selected competitions/seasons, not a complete live workload feed; its user agreement/attribution and exact included competitions govern use.
- **football-data.org — medium-value candidate pending full re-verification:** prior Teamsheet research found it potentially useful, but current 2026 features, price, coverage and rights were not sufficiently re-verified in this investigation.
- **Official UEFA/FA/EFL match records — high-authority verification references, medium acquisition practicality:** public match centres do not themselves establish bulk automated acquisition or retention rights.

No candidate is an approved provider or dependency.

## 5. Exact fields or observations required

Minimum useful factual observations are: stable provider player ID plus canonical FPL player ID, provider/canonical club identity, competition and fixture ID, opponent, scheduled/actual kickoff UTC, venue, started, minutes, substitution on/off detail, extra-time exposure, match final status, and source observation/update/retrieval timestamps.

Rest hours, fixture density, travel distance and rotation risk are derived features, not source facts. Fatigue is a hypothesis, not an observation.

## 6. Coverage

Relevant scope is competitive senior football that can plausibly alter a Premier League player's short-term exposure: UEFA Champions League, Europa League, Conference League, FA Cup and League Cup. Other competitions should enter only when a Premier League player has relevant senior competitive participation. Missing competition/player coverage must remain explicit.

## 7. Freshness / update cadence

Completed-match workload is normally reconstructible later, so it does not require pre-deadline capture merely to avoid losing the observation. Post-match corrections still require observation/update/retrieval provenance. Pre-match states from any provider are a different evidence class and need point-in-time handling.

## 8. Reliability

A future source trial should compare starts/minutes/substitutions/extra-time facts with authoritative match records and quantify missing/conflicting cases. Provider operational claims do not establish incremental value for Teamsheet expected minutes.

## 9. Historical availability

**Research conclusion:** actual non-PL starts, minutes, substitutions and extra time are generally **Class A — valid historically** when a trustworthy stable event archive exists. They are completed-event facts, not pre-deadline predictions. This is materially different from mutable predicted line-ups or team-news states.

Do not create unnecessary pre-deadline storage for reconstructible workload facts.

## 10. Cost / free-tier constraints

13 August 2026 research found realistic commercial/free-entry options among API-Football and Sportmonks, but price, quota, required competition coverage and plan boundaries are time-sensitive. Re-verify first-party terms before any implementation proposal.

## 11. Rights / licensing / retention

Detailed 2026 retention, derived-data, bulk-storage and redistribution clauses for the serious commercial candidates were not fully established. That is an implementation-blocking re-verification item. Public accessibility or an API plan does not imply durable storage/redistribution rights; software/open-data licences do not grant rights to unrelated provider data.

## 12. Security / privacy

Public football facts only; nevertheless no credential, keyed URL or secret belongs in retained observations. A future provider proposal must follow canonical secret-handling and acquisition rules.

## 13. Canonical identity / mapping requirements

Official FPL player IDs remain canonical, with stable provider IDs recorded alongside them. Name matching may generate candidates only; it must not silently establish identity. Transfers, youth promotions, accents, abbreviations and duplicate names require explicit mapping review. Team mapping likewise needs canonical FPL team IDs plus provider IDs/aliases.

## 14. Proposed provider-neutral / shadow contract

Research-only minimum provenance is: provider, source URL/endpoint or source record ID, evidence class, observation, source timestamp, `retrieved_at`, revision/version/hash where permitted, canonical player/team IDs, provider IDs, raw-versus-normalised designation, and rights/retention classification.

This is a research requirement, not an approved production schema. Any future workload observations must remain shadow-only until separately approved.

## 15. Fallback behaviour

Current Official FPL-only expected-minutes behaviour remains unchanged when workload observations are absent, invalid or unavailable. A future research source failure must not affect production decisions.

## 16. Failure modes

Player identity collision, transfer between clubs, missing substitution detail, extra-time accounting, duplicate appearances, postponed/abandoned fixtures, late corrections, partial competition coverage, stale provider data, provider-ID changes and rights/access changes.

## 17. Double-counting / leakage risks

Recent Premier League minutes, availability/team news, fixture-density effects and predicted line-ups may already encode or react to workload. Future evaluation must test incremental signal conditional on the production baseline rather than treating correlated observations as independent. Completed match facts may be used as prior-workload observations only when they genuinely preceded the decision deadline; future match outcomes must never leak backwards.

## 18. Validation / ablation plan

If later approved, compare unchanged production expected-minutes outputs with a predeclared workload-evidence shadow variant. Evaluate `pStart`, `pAppear` and `p60` separately with proper probability/calibration metrics and `expMin` with MAE/RMSE/bias/error distributions. Then assess downstream xP/XI/bench/captain/transfer effects while holding other components constant.

An improvement in minutes MAE alone is not evidence of improved FPL decisions. Anything designed using GW1–GW5 outcomes must later face untouched future Gameweeks.

## 19. Required tests

Future implementation would require player/fixture mapping, transfer identity, extra-time arithmetic, substitution/minute bounds, postponed/abandoned handling, correction provenance, stale/missing fallback, rights/provenance, deterministic isolation and structural no-production-effect tests. Production calculation/recommendation modules must not depend on the shadow store.

## 20. Evidence required before production use

Prospective or valid historical player-level observations with trustworthy identity/provenance, a predeclared paired ablation against frozen production, and untouched future evaluation demonstrating incremental expected-minutes value. Any provider additionally requires separate purpose/fields/reliability/rights/security/fallback approval.

## 21. Current recommendation

**Research complete. Non-PL workload is a medium/high-value research class but is lower priority than factual availability and predicted-lineup evidence. Most useful completed-match workload is reconstructible, so it creates no essential pre-GW1 capture requirement. Do not alter expected minutes or add a workload provider now.**

## 22. Explicit implementation approval gate

No provider integration, workload store, fatigue feature, expected-minutes use or downstream recommendation effect is approved. Any such step requires a separate provider/model proposal and Pritesh's explicit approval.