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

Focused Step 5 research refined the serious candidates, all still unapproved for collection or production:

- **Sportmonks — strongest structured research candidate:** first-party terms reviewed on 13 August 2026 materially permit storage, transfer and distribution of API-delivered data subject to contractual restrictions, while its football product exposes stable player/team/fixture IDs plus line-up and sidelined information. Premier League access appears to require trial or paid coverage rather than permanent free access. Exact current plan, competition scope and terms must be re-verified before any proposal.
- **API-Football — technically capable but rights-unclear:** structured fixtures, official line-ups, injuries/sidelined information and player statistics are available, but first-party terms state that API-Sports does not itself grant the necessary third-party sports-data licence. Durable Teamsheet retention therefore remains **RIGHTS CLARIFICATION REQUIRED**.
- **StatsBomb Open Data — medium-value historical-methodology candidate:** useful event/line-up data for selected competitions/seasons, not a complete live workload feed; its user agreement/attribution and exact included competitions govern use.
- **Official UEFA/FA/EFL match records — high-authority verification references, medium acquisition practicality:** public match centres do not themselves establish bulk automated acquisition or retention rights.

No candidate is an approved provider or dependency.

## 5. Exact fields or observations required

The lightweight factual workload record should retain: canonical/provider player identity, canonical/provider club identity, competition and fixture ID, opponent, scheduled/actual kickoff UTC, venue, started, minutes, substitution on/off detail where available, extra-time exposure, match completion status, and source observation/update/retrieval provenance.

A 120-minute cup match must retain the true 120-minute exposure; workload facts must not be clamped to the Premier League expected-minutes 0–90 range.

Rest hours, fixture density, travel distance and rotation risk are derived features, not source facts. Fatigue is a hypothesis, not an observation.

## 6. Coverage

Relevant scope is competitive senior football that can plausibly alter a Premier League player's short-term exposure: UEFA Champions League, Europa League, Conference League, FA Cup and League Cup. Other competitions should enter only when a Premier League player has relevant senior competitive participation. Missing competition/player coverage must remain explicit.

## 7. Freshness / update cadence

Completed-match workload is normally reconstructible later, so it does not require pre-deadline capture merely to avoid losing the observation. Post-match corrections still require observation/update/retrieval provenance.

If a later experiment depends on what future schedule was known at the FPL deadline, that schedule state becomes a separate mutable pre-deadline evidence class and would need point-in-time freezing. Do not conflate completed workload with future congestion forecasts.

## 8. Reliability

A future source trial should compare starts/minutes/substitutions/extra-time facts with authoritative match records and quantify missing/conflicting cases. Provider operational claims do not establish incremental value for Teamsheet expected minutes.

## 9. Historical availability

**Research conclusion:** actual non-PL starts, minutes, substitutions and extra time are generally **Class A — valid historically** when a trustworthy stable event archive exists. They are completed-event facts, not pre-deadline predictions.

They may be used as prior-workload observations only when the completed match genuinely preceded the relevant FPL deadline. Do not create unnecessary pre-deadline storage for reconstructible workload facts.

## 10. Cost / free-tier constraints

Sportmonks' Premier League path appears to require trial/paid access, while API-Football offers lower-cost/free technical entry. Cost is secondary to rights, coverage and provenance. Current plan prices, quotas and included competitions must be re-verified immediately before any implementation proposal.

**Owner cost constraint — 13 August 2026.** External-intelligence implementation proposals must have **£0 recurring subscription cost**. Paid Sportmonks access therefore remains a **research comparator only** and is not a pilot or implementation candidate unless the owner explicitly changes that constraint; a temporary trial of a normally paid product does not satisfy it. See [Research Programme](../README.md) §2.

No account creation, subscription, trial or spend is approved by this research record.

## 11. Rights / licensing / retention

Rights remain a hard pre-collection gate.

- **Sportmonks:** reviewed first-party terms materially permit API-data storage/transfer/distribution subject to contractual restrictions; exact current entitlement, retention/deletion expectations and derived-data scope still require implementation-time verification.
- **API-Football:** technical access does not itself grant the underlying competition-data licence required for durable Teamsheet use. **RIGHTS CLARIFICATION REQUIRED**.
- **Official/open sources:** public visibility or an open software repository does not grant unrelated bulk-data retention rights.

If acquisition/retention/derived-data rights are unresolved, a future research store must fail closed.

## 12. Security / privacy

Public football facts only; nevertheless no credential, keyed URL or secret belongs in retained observations. Any future keyed provider must follow canonical server-side secret-handling and acquisition rules.

## 13. Canonical identity / mapping requirements

Official FPL player IDs remain canonical, with stable provider IDs recorded alongside them. Name matching may generate candidates only; it must not silently establish identity. Transfers, youth promotions, accents, abbreviations and duplicate names require explicit mapping review. Team mapping likewise needs canonical FPL team IDs plus provider IDs/aliases.

Unresolved mappings remain visible in coverage statistics but are quarantined from candidate metrics and production.

## 14. Proposed provider-neutral / shadow contract

Workload belongs in the **expanded** expected-minutes protocol, not the minimum factual-availability protocol.

A future workload record should be isolated from production and linked to the exact Stage 10 production snapshot used as the control. The conceptual path is completed workload observation -> isolated research store -> shadow candidate/evaluator -> research report, with no read path back into production.

This is a research requirement, not an approved runtime schema or store.

## 15. Fallback behaviour

Current Official FPL-only expected-minutes behaviour remains unchanged when workload observations are absent, invalid, rights-blocked or unavailable. A future research source failure must not affect production decisions.

## 16. Failure modes

Player identity collision, transfer between clubs, missing substitution detail, extra-time accounting, duplicate appearances, postponed/abandoned fixtures, late corrections, partial competition coverage, stale provider data, provider-ID changes, rights/access changes and incorrectly treating a post-deadline match as prior workload.

## 17. Double-counting / leakage risks

Recent Premier League minutes, availability/team news, fixture-density effects and predicted line-ups may already encode or react to workload. Future evaluation must test incremental signal conditional on the exact production baseline rather than treating correlated observations as independent. Future match outcomes must never leak backwards.

## 18. Validation / ablation plan

Do not design a fatigue coefficient during initial collection. First establish whether factual non-PL exposure can be reconstructed reliably and whether it explains repeated residual expected-minutes errors.

Only after a separate approval may a fixed workload candidate be paired against the exact frozen Stage 10 baseline. Evaluate `pStart`, `pAppear` and `p60` separately with proper probability/calibration metrics and `expMin` with MAE/bias plus RMSE/error distribution secondary. Then assess downstream xP/XI/bench/captain/transfer effects while holding other components constant.

Anything designed using GW1–GW5 outcomes must later face untouched future Gameweeks.

## 19. Required tests

Any future implementation would require player/fixture mapping, transfer identity, 120-minute/extra-time arithmetic, substitution/minute bounds, postponed/abandoned handling, correction provenance, stale/missing fallback, rights fail-closed behaviour, secret isolation, deterministic isolation and structural no-production-effect tests.

Production calculation/recommendation modules must not depend on the research store, provider or parser.

## 20. Evidence required before production use

Valid historical or prospective workload observations with trustworthy identity/provenance, a separately approved fixed candidate design, paired evaluation against the exact Stage 10 production baseline, and untouched future evidence demonstrating incremental expected-minutes value. Any provider additionally requires separate purpose/fields/reliability/rights/security/fallback approval.

## 21. Current recommendation

**Research complete. Non-PL workload remains a medium/high-value expanded-protocol research class but is lower priority than factual availability and predicted-lineup evidence. Completed-match workload is generally reconstructible later, so it creates no essential pre-GW1 capture requirement. No workload source or provider is approved, and no workload trial is proposed or pending. Sportmonks was the strongest structured candidate found by the Step 5 research recorded above, but under the owner's £0 recurring-subscription constraint it is a research comparator only, so it is not the intended next step; API-Football remains rights-clarification gated; official and open sources retain acquisition/rights limitations. No fatigue coefficient is approved. Do not alter expected minutes or add a workload provider now.**

## 22. Explicit implementation approval gate

No provider integration, workload store, fatigue feature, expected-minutes use or downstream recommendation effect is approved. Any such step requires a separate provider/model proposal and Pritesh's explicit approval.

> **Dated cost-policy supersession — 22 August 2026:** The owner has superseded the blanket £0 recurring-cost constraint used when this historical research conclusion was reached. Free remains preferred where genuinely comparable; small recurring paid options may now be considered only after explicit current pricing, rights and value/cost justification, preferably through a shadow trial. The original conclusion and its historical context above are intentionally preserved. This amendment approves no provider, acquisition, subscription, retention or production use.
