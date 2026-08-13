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

Official FPL availability/news/status remains the production baseline. Current expected-minutes production uses Official FPL `starts` directly: aggregate `pStart` is based on cumulative `starts / completed team matches`, while detailed recent-history rows derive `started` from each row's `starts` value. The earlier Step 4 closeout statement that current production inferred starts from a `>=45-minute` minutes proxy was incorrect and is superseded by current code/tests on `main`.

Availability itself remains consequential: statuses `i`, `u`, `s` and `n` hard-gate `pStart`, `pAppear`, `p60` and `expMin` to zero, while `d` scales them by `chance_of_playing_next_round` (defaulting to 50% when absent). No new injury/team-news source is approved.

## 3. Why this matters

Availability mistakes have asymmetric downstream consequences. A factual false high or false zero can affect xP, XI/bench order, captaincy and transfers more materially than a modest minutes error for a stable starter. First-party authority is therefore valuable, but ambiguous prose must not be converted into false numerical certainty.

## 4. Candidate sources / repositories / approaches

Research priority remains:

1. Official FPL and first-party FPL context as the existing baseline;
2. official club websites/manager press conferences for authoritative injury/fitness statements;
3. official disciplinary/competition records for formal suspensions/ineligibility;
4. a rights-cleared structured provider for prospective factual research only.

Focused Step 5 provider research found:

- **Sportmonks — strongest structured research candidate:** first-party terms reviewed on 13 August 2026 materially permit storage, transfer and distribution of API-delivered data subject to restrictions including no direct resale. Premier League access appears to require a trial or paid league plan rather than permanent free coverage. This is research suitability only, not provider approval.
- **API-Football — technically capable but rights-unclear:** first-party functionality covers injuries/sidelined data and stable football IDs, but its terms state that API-Sports does not itself grant the competition-data licence required for use/publication. Durable Teamsheet research retention therefore remains **RIGHTS CLARIFICATION REQUIRED**.
- **Official club/disciplinary sources — high authority but operationally heterogeneous:** suitable for tightly scoped manual research where lawful, but public readability does not approve scraping or full-text archival.

Official FPL Player Notes remain a noteworthy first-party evidence class. Their exact API representation and historical/version accessibility were not established here.

No candidate is an approved provider.

## 5. Exact fields or observations required

The minimum prospective factual record should retain only what is needed to test the hypothesis:

- schema/evidence class and semantics (`FACT` or `INTERPRETATION`);
- provider/source identity and provider record ID where available;
- canonical FPL season/player/team/fixture/deadline identity plus provider IDs;
- provider-native categorical value and one provider-neutral normalised claim;
- source publication time where supplied;
- source revision/update time where supplied;
- `retrieved_at`;
- FPL deadline and fixture kickoff;
- mapping status;
- rights/retention classification;
- canonical retained-record hash.

Keep semantic classes separate. A minimal controlled taxonomy is:

- **FACT:** `AVAILABLE_CONFIRMED`, `UNAVAILABLE_CONFIRMED`, `SUSPENDED_OR_INELIGIBLE`, `RETURNED_TO_TRAINING`;
- **INTERPRETATION:** `FITNESS_TEST_PENDING`, `EXPECTED_AVAILABLE`, `EXPECTED_UNAVAILABLE`, `DOUBTFUL_OR_UNCERTAIN`;
- **PREDICTION:** belongs in the separate predicted-lineup record, not this factual stream.

A manager phrase must not silently become a numerical expected-minutes instruction.

## 6. Coverage

Research target is all active Premier League players/clubs with injury, illness, suspension, eligibility and late team-news relevance. First-party club information is authoritative but heterogeneous and unstructured; structured providers may offer broader normalisation but do not gain authority merely by republishing the same underlying fact.

## 7. Freshness / update cadence

Publication, source revision, Teamsheet retrieval, FPL deadline, fixture kickoff and outcome availability are distinct clocks. Canonical research timing should use UTC ISO-8601/RFC-3339 timestamps.

An observation counts as **PRE_DEADLINE** only when Teamsheet actually retrieved the frozen state no later than the official FPL deadline. There is no discretionary grace period. A later source correction creates a new observation and never rewrites the pre-deadline record.

Mutable FPL/team-news states generally require prospective freezing for faithful point-in-time evaluation.

## 8. Reliability

Official club and competition statements have high authority for what they explicitly state, but language can remain ambiguous and later be superseded. FPL chance-of-playing values should be treated as provider indicators; this research found no authoritative evidence establishing them as empirically calibrated probabilities.

A future source trial should first measure factual precision, timeliness, mapping coverage, conflicts/retractions and incremental information relative to the exact frozen production baseline before any expected-minutes candidate formula is designed.

## 9. Historical availability

Exact FPL availability/news state at a past deadline is generally **Class C — prospective capture required** unless a frozen Stage 10 snapshot or immutable timestamped archive establishes the exact vintage. Club articles may be **Class B** when publication timing is durable, but edit/version history may remain unknown. Press-conference/team-news state is often **B/C**.

Actual starts/minutes are outcome labels, not historical pre-deadline features. Gameweek-labelled data does not prove pre-deadline knowledge.

## 10. Cost / free-tier constraints

Sportmonks' Premier League factual research path appears to require trial or paid access; headline pricing and included leagues/features are time-sensitive and must be re-verified immediately before any approval. API-Football advertises a low-cost/free technical entry path, but rights uncertainty is the binding issue rather than headline price.

No account creation, subscription or spend is approved by this research record.

## 11. Rights / licensing / retention

Rights are a hard pre-collection gate.

- **Sportmonks:** reviewed first-party terms materially permit storage/transfer/distribution of API data, subject to contractual restrictions; exact current account terms, Premier League entitlement, derived-data scope, retention/deletion expectations and price still require implementation-time re-verification.
- **API-Football:** technical API access does not resolve the provider's own warning that API-Sports does not grant the necessary third-party competition-data licence. **RIGHTS CLARIFICATION REQUIRED** before Teamsheet durably stores such observations.
- **First-party club pages:** public access does not imply permission for systematic scraping or full-text retention. Prefer minimum lawful normalised facts plus provenance.

If acquisition/retention/derived-data rights are unresolved, the future research path must fail closed.

## 12. Security / privacy

No user-private data is expected. Credentials, paywall bypass, subscription scraping or unapproved authentication are outside this research. Any future keyed provider must keep credentials server-side and satisfy canonical secret-handling/security requirements.

## 13. Canonical identity / mapping requirements

Canonical identity should be season-aware Official FPL identity: season + FPL player ID, season + FPL team ID, and FPL fixture ID. Stable provider IDs should be retained as provenance.

Name matching may generate candidates only; it must not silently establish identity. Mapping status should distinguish `EXACT_CROSSWALK`, `MANUALLY_VERIFIED`, `CONFLICT` and `UNRESOLVED`. Uncertain mappings are quarantined from metrics and production.

## 14. Proposed provider-neutral / shadow contract

The recommended minimum protocol is:

`existing immutable Stage 10 production baseline`
+ `one rights-cleared factual availability observation`
+ `player/fixture/deadline identity`
+ `source/revision/retrieval timing`
+ `FACT/INTERPRETATION semantics`
+ `post-match START/APPEAR/60/MINUTES truth`.

Research observations should reference the existing Stage 10 snapshot ID/hash; they should not be embedded into or mutate the production snapshot. This remains a conceptual research contract, not an approved runtime schema or store.

## 15. Fallback behaviour

Official FPL availability remains the production baseline. Missing, stale, conflicting, ambiguous, rights-blocked or unavailable external evidence must not manufacture an availability state or alter production decisions.

## 16. Failure modes

Rumour presented as fact, interpretation presented as probability, stale update, retraction, source conflict, ambiguous player, suspension competition mismatch, page/schema change, provider outage, revision after capture, identity mismatch, rights uncertainty and post-deadline retrieval.

## 17. Double-counting / leakage risks

FPL status, club team news, predicted-lineup sites and market odds can react to the same underlying press-conference/injury information. Future evaluation must measure incremental signal conditional on the frozen production FPL baseline rather than treating different domains as independent evidence. Post-deadline confirmations must never be backfilled into pre-deadline decisions.

## 18. Validation / ablation plan

The first protocol question is source quality, not a numerical expected-minutes adjustment.

During the initial prospective collection period, compare frozen factual observations with the exact Stage 10 production row and later official outcomes. Evaluate coverage, mapping, timing, conflict/retraction behaviour and whether factual observations identify genuinely new pre-deadline information beyond Official FPL.

Only after a separate approval may a fixed expected-minutes candidate be designed. Any such candidate must be paired against the exact stored Stage 10 `pStart`, `pAppear`, `p60` and `expMin`; probability targets use pre-registered proper/calibration metrics and `expMin` uses MAE/bias with RMSE/error distribution secondary. Anything designed using GW1–GW5 outcomes must later face untouched future Gameweeks.

## 19. Required tests

Any future collection implementation would require identity quarantine, timing/deadline enforcement, revision immutability, conflict handling, semantics separation, rights fail-closed behaviour, missing/stale fallback, secret isolation and structural no-production-effect tests.

Provider/store/parser failure, observation presence/absence and research-store outage must leave production `pStart`, `pAppear`, `p60`, `expMin`, xP and recommendations unchanged. Production calculation/recommendation modules must not import/read the research path.

## 20. Evidence required before production use

Prospective source reliability/freshness evidence, lawful acquisition/retention, canonical identity coverage, a separately approved fixed candidate design, and untouched future evaluation demonstrating incremental expected-minutes value. Provider, collection, candidate-model and production approvals remain separate gates.

## 21. Current recommendation

**Research complete. Factual availability is the first expected-minutes evidence hypothesis to test prospectively. Keep the existing Stage 10 output as the immutable production control. Sportmonks is the strongest currently researched structured candidate for a future factual-only trial, subject to fresh terms/price/coverage verification and separate owner approval. No provider activation, collection, expected-minutes mapping or pre-GW1 production change is approved.**

## 22. Explicit implementation approval gate

No new availability provider, account/subscription, external collection, stored evidence, shadow model, expected-minutes influence or recommendation change is approved. The next possible gate is a separate **Prospective Factual Availability Collection Approval — Minimum Shadow Protocol** package covering exact source, fields, cost, cadence, credentials, storage, retention/deletion, terms/rights, secret handling, failure behaviour and zero-production-effect tests.