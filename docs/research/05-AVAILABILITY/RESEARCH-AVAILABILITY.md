# Research — Availability, Injuries, Suspensions and Team News

Status: **Research complete**  
Programme root: [External Intelligence Foundation](../../EXTERNAL-INTELLIGENCE-FOUNDATION.md) §§3.4, 7–8, 14  
Control centre: [Research Programme](../README.md)  
Production effect: **None**  
Implementation approval: **Not granted**  
Research date: **13 August 2026**

## 1. Research question

Which factual sources can reliably supplement Official FPL availability with injuries, suspensions and team news while preserving freshness, provenance, rights and conflict handling?

## 2. Current Teamsheet behaviour

Official FPL availability/news/status remains the production baseline. Current expected-minutes behaviour has an important asymmetry: a player whose FPL status is not `"a"` is hard-gated to zero `pStart`, `pAppear`, `p60` and `expMin`, while an available player with missing/limited history can receive comparatively strong positional default minutes. The scoring layer separately applies current chance-of-playing treatment. No new injury/team-news source is approved.

The research also found that current `pStart` is inferred from a >=45-minute proxy despite FPL detailed history already containing a `starts` field. That is a model-design/evidence weakness to evaluate later, not approval to change the formula during the freeze.

## 3. Why this matters

Availability mistakes have asymmetric downstream consequences. A factual false high or false zero can affect xP, XI/bench order, captaincy and transfers more materially than a modest minutes error for a stable starter. First-party authority is therefore valuable, but ambiguous prose must not be converted into false numerical certainty.

## 4. Candidate sources / repositories / approaches

Research priority is:

1. Official FPL and first-party FPL context as the existing baseline;
2. official club websites/manager press conferences for authoritative injury/fitness statements;
3. official disciplinary/competition records for formal suspensions/ineligibility;
4. structured candidates such as API-Football and Sportmonks for research convenience, subject to separate rights/reliability/provider approval.

Official FPL Player Notes, introduced in December 2025, are a noteworthy first-party evidence class for possible future absences such as suspension thresholds, international-tournament participation, loan-parent ineligibility and confirmed blanks. This investigation did not establish their exact API representation or historical/version accessibility.

No candidate is an approved provider.

## 5. Exact fields or observations required

Player/team identity; evidence class; factual claim/status/injury/suspension information; source reference; source publication/observation time; source update/revision time where available; `retrieved_at`; effective period where explicit; raw-versus-normalised designation; verification/conflict state; and rights/retention classification.

Keep three semantic classes separate:

- **FACT:** formally suspended, confirmed unavailable, confirmed returned to training, confirmed ineligibility;
- **INTERPRETATION:** doubtful, expected to miss, should be fit, late fitness test;
- **PREDICTION:** likely starter, expected bench, explicit start probability.

A prediction or ambiguous manager phrase must not silently become a numerical expected-minutes instruction.

## 6. Coverage

Research target is all active Premier League players/clubs with injury, illness, suspension, eligibility and late team-news relevance. First-party club information is authoritative but heterogeneous and unstructured; structured providers may offer broader normalisation but do not gain authority merely by republishing the same underlying fact.

## 7. Freshness / update cadence

Publication, update/revision and Teamsheet retrieval times are distinct. Mutable FPL/team-news states generally require prospective freezing for faithful point-in-time evaluation. Stale claims must not be treated as current merely because the page remains accessible.

## 8. Reliability

Official club and competition statements have high authority for what they explicitly state, but language can remain ambiguous and later be superseded. FPL chance-of-playing values should be treated as provider indicators; this research found no authoritative evidence establishing them as empirically calibrated probabilities.

A future source trial should measure factual precision, timeliness, conflicts/retractions and incremental information relative to the existing FPL baseline.

## 9. Historical availability

Exact FPL availability/news state at a past deadline is generally **Class C — prospective capture required** unless a frozen Stage 10 snapshot or immutable timestamped archive establishes the exact vintage. Club articles may be **Class B** when publication timing is durable, but edit/version history may remain unknown. Press-conference/team-news state is often **B/C**.

Actual starts/minutes are labels, not historical pre-deadline features. Gameweek-labelled data does not prove pre-deadline knowledge.

## 10. Cost / free-tier constraints

Official/public first-party material is accessible for research reference. API-Football and Sportmonks advertised realistic free/paid entry points on 13 August 2026, but current pricing, quotas, required features and competition coverage must be re-verified before any implementation proposal.

## 11. Rights / licensing / retention

Readable web content does not imply permission to scrape, copy or durably retain it. Prefer minimum factual normalisation plus source/provenance where rights permit. Detailed 2026 raw/derived-data retention and redistribution terms for structured candidates were not fully established and remain implementation-blocking re-verification items.

## 12. Security / privacy

No user-private data is expected. Credentials, paywall bypass, subscription scraping or unapproved authentication are outside this research. Any future keyed provider must satisfy canonical secret-handling/security requirements.

## 13. Canonical identity / mapping requirements

Official FPL player/team IDs remain canonical. Stable provider IDs should be stored alongside them if later approved. Name-only joins are forbidden; ambiguous reports remain unresolved. Transfers, youth players, accents/abbreviations and duplicate names require explicit mapping review.

## 14. Proposed provider-neutral / shadow contract

Research-only minimum provenance is: provider, source URL/endpoint or record ID, evidence class, observation, source timestamp, `retrieved_at`, revision/version/hash where permitted, canonical/provider player/team IDs, raw-versus-normalised designation, and rights/retention classification.

This is not an approved production schema. Any future external availability evidence must remain shadow-only until separately approved.

## 15. Fallback behaviour

Official FPL availability remains the production baseline. Missing, stale, conflicting, ambiguous or unavailable external evidence must not manufacture an availability state or alter production decisions.

## 16. Failure modes

Rumour presented as fact, interpretation presented as probability, stale update, retraction, source conflict, ambiguous player, suspension competition mismatch, page/schema change, provider outage, revision after capture, identity mismatch and rights uncertainty.

## 17. Double-counting / leakage risks

FPL status, club team news, predicted-lineup sites and market odds can react to the same underlying press-conference/injury information. Future evaluation must measure incremental signal conditional on the production FPL baseline rather than treating different domains as independent evidence. Post-deadline confirmations must never be backfilled into pre-deadline decisions.

## 18. Validation / ablation plan

First evaluate factual precision, freshness, conflict/retraction rates and source age at the deadline. If later approved for expected-minutes research, freeze the evidence before deadlines and compare a predeclared shadow variant with unchanged production on separate `pStart`, `pAppear`, `p60` probability/calibration metrics and `expMin` minutes metrics, followed by downstream decision-impact analysis.

Anything designed using GW1–GW5 outcomes must later face untouched future Gameweeks.

## 19. Required tests

Future implementation would require identity, timing/expiry, revision immutability, conflict handling, fact-vs-interpretation-vs-prediction separation, missing/stale fallback, rights/provenance, secret isolation and structural no-production-effect tests. Production calculation/recommendation modules must not import/read the external research path.

## 20. Evidence required before production use

Prospective source reliability/freshness evidence, lawful retention/acquisition, canonical identity coverage, and a separate expected-minutes evaluation demonstrating incremental value on untouched future evidence. Provider and model approval remain separate gates.

## 21. Current recommendation

**Research complete. Factual availability/team news is the highest-priority additional expected-minutes evidence class because it targets high-asymmetry errors and can preserve facts separately from tactical predictions. Keep Official FPL as production baseline. No new provider or expected-minutes change is justified before GW1.**

## 22. Explicit implementation approval gate

No new availability provider, external collection, stored evidence, expected-minutes influence or recommendation change is approved. Each requires a separate evidence-led provider/model proposal and Pritesh's explicit approval.