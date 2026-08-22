# Research — Calendar, Congestion and Travel

Status: **Research complete**  
Programme root: [External Intelligence Foundation](../../EXTERNAL-INTELLIGENCE-FOUNDATION.md) §§3.5, 7–8, 11, 14–15  
Control centre: [Research Programme](../README.md)  
Production effect: **None**  
Implementation approval: **Not granted**  
Research date: **13 August 2026**

## 1. Research question

Which cross-competition calendar, rest, extra-time, location and travel facts can Teamsheet study reliably, which of those facts are reconstructible later, and what is the smallest scientifically useful future experiment for testing whether team-level calendar exposure adds incremental expected-minutes information without inventing a generic fatigue penalty?

## 2. Current Teamsheet behaviour

Production currently knows Premier League fixture context through the approved Official FPL/Understat/Odds inputs. There is no approved cross-competition calendar layer.

Production does not currently know Champions League, Europa League, Conference League, FA Cup or League Cup fixtures as a separate calendar input. It has no approved all-competition rest interval, team-level non-Premier-League extra-time, cross-competition fixture-density, travel-distance or time-zone feature.

There is no arbitrary congestion, fatigue, travel or `Europe = -X xP` adjustment. No calendar observation changes `pStart`, `pAppear`, `p60`, `expMin`, fixture strength, projected points or recommendations.

This branch is **team-level calendar exposure** only. Player-level facts such as whether Player X started or played 90/120 minutes belong to the already-completed [Non-Premier-League Player Workload](RESEARCH-NON-PL-PLAYER-WORKLOAD.md) branch and are not reopened here.

## 3. Why this matters

The useful information gap is narrower than “more fixtures”. A Premier League club may have played another competitive match shortly before a league fixture, may have gone to extra time, or may be in a sequence of away matches. Those are objective facts that could plausibly help diagnose rotation/minutes errors.

The effect must not be assumed. European clubs differ systematically in squad depth, quality, opponent strength, expectations and existing information already reflected in Official FPL, recent starts/minutes, Odds and other production inputs. This branch therefore treats calendar variables as possible **associational/residual discriminators**, not causal fatigue rules.

## 4. Candidate sources / repositories / approaches

The Step 8 research considered authoritative completed-match references such as Premier League / Official FPL, UEFA, The FA, EFL and official club pages, plus structured/free reconstruction candidates including football-data.org, API-Football/API-SPORTS, TheSportsDB, Football-Data.co.uk, Wikidata and `openfootball/football.json`. Sportmonks remains a paid research comparator only under the owner's £0 recurring-subscription constraint.

None is an approved Teamsheet provider, collector or dependency. Public page availability is evidence that a fact can be inspected; it is **not** proof that automated recurring collection, storage or redistribution is permitted.

The recommended first approach, if separately approved later, is offline historical reconstruction of completed prior-match facts. It does not require a prospective Step 8 collector before GW1.

## 5. Exact fields or observations required

The smallest factual source layer for a future reconstruction experiment would need only enough information to identify completed prior matches and derive bounded team-level calendar observations:

- canonical club/team and opponent identity;
- competition identity;
- objective stage/round where reliably available;
- actual/final played date and kickoff;
- home/away and final venue/location at a coarse factual level;
- completion/result state;
- team-level extra-time occurrence.

Candidate derived observations to preserve for later consideration are deliberately small:

1. hours since previous completed all-competition match kickoff;
2. number of non-PL matches between the previous and current Premier League fixture;
3. completed matches in the prior 7 days;
4. immediately preceding match extra-time flag;
5. optionally, a simple international-away flag as a secondary travel observation.

These are research candidates, not an approved schema or feature set. A later experiment should use fewer observations where possible. The strongest primary raw/derived candidate is continuous rest hours, conceptually `previous_all_comp_kickoff_to_pl_kickoff_hours`.

Do not encode fixed rest thresholds, fatigue multipliers, competition-importance scores or distance penalties.

## 6. Coverage

The relevant team-level competition scope is Premier League clubs across the Premier League, UEFA Champions League, Europa League, Conference League, FA Cup and League Cup, including knockout/extra-time cases and schedule changes where they affect a completed prior-match reconstruction.

Coverage must remain explicit for clubs not participating in a competition, missing rounds, neutral/changed venues, postponements, abandoned matches and competition-format changes.

Competition identity and objective stage/round are facts. Managerial “importance”, expected rotation or a knockout importance score are interpretations and must not be manufactured as factual observations.

## 7. Freshness / update cadence

The central Step 8 finding is that the smallest useful first experiment needs **completed prior-match facts**, which are generally reconstructible later. No pre-GW1 Step 8 acquisition cadence is therefore justified.

If a later experiment specifically asks what future non-PL schedule was known at an earlier FPL deadline, that becomes a different point-in-time evidence class. It would need source publication/revision state, Teamsheet retrieval time and the relevant FPL deadline preserved without hindsight substitution.

No such prospective calendar collector is approved by this research closeout.

## 8. Reliability

A future reconstructed dataset should verify completed-match identity, actual kickoff, competition/stage, venue/home-away and extra-time status against authoritative records where practicable, quantify unresolved/missing cases and quarantine ambiguous mappings.

Reliability of calendar facts is separate from predictive value. Correctly reconstructing that Manchester City played a Wednesday European match does not establish that the observation improves expected-minutes predictions.

Exact travel/distance estimates are especially vulnerable to false precision because public fixtures do not establish the squad's real door-to-door itinerary, transport mode, lodging or travel timing.

## 9. Historical availability

**Primary research conclusion: most useful completed-match calendar facts are reconstructible later.**

### Reconstructible later

Where a trustworthy final record exists, the following may be treated as historical completed-event facts:

- match actually occurred;
- competition;
- teams/opponent;
- home/away;
- final venue;
- actual/final played date and kickoff;
- final score/result;
- competition stage/round;
- team-level extra time;
- historical previous-match rest interval derived from completed kickoffs;
- historical fixture density derived from completed matches;
- historical away sequence;
- coarse travel/location derived from final venue.

### Prospective / point-in-time only if a later experiment needs it

The following cannot be assumed from the final schedule to represent what was known before an earlier FPL deadline:

- original future scheduled date as known before that deadline;
- whether a future fixture was announced, postponed or rescheduled by that deadline;
- provisional venue known at the deadline;
- exact source revision state at the deadline;
- forward fixture density based on what was actually known then.

The first possible future experiment does **not** need this prospective class. Therefore no pre-GW1 Step 8 collector is justified.

## 10. Cost / free-tier constraints

**Owner cost constraint — 13 August 2026:** any implementation proposal must have **£0 recurring external data/API subscription cost**. A temporary trial of a normally paid provider does not satisfy this constraint for continuing operation.

The reconstruction-first conclusion avoids creating a paid subscription or new operational dependency merely to preserve facts that can be rebuilt later. Sportmonks remains a paid comparator only.

No account, API key, subscription, trial, geocoding account or mapping service is approved by this record.

## 11. Rights / licensing / retention

First-party competition/club pages are useful authoritative references for completed facts, but public visibility does not establish permission for automated recurring scraping, storage or redistribution. Automated first-party scraping is therefore **NOT IMPLEMENTATION-READY / RIGHTS CLARIFICATION REQUIRED**.

Structured/free candidates remain research/reconstruction candidates only. Before any actual dataset construction or implementation, re-verify current provider terms, storage/retention/redistribution rights and any open-source/data licence separately from software licence.

Unknown rights fail closed. No provider is promoted to approved status by this closeout.

## 12. Security / privacy

The approved Step 8A change is documentation only and adds no origin, endpoint, key, credential, relay, Cloudflare configuration, D1/R2 store, geocoder or mapping service.

Any future research implementation must keep secrets server-side where required, retain no keyed URLs/tokens/cookies in observations, collect only the minimum football facts needed for the experiment and remain structurally unable to influence production.

The existing security and provider-retention gates remain unchanged.

## 13. Canonical identity / mapping requirements

Official FPL team/fixture identity remains canonical where an equivalent exists. Provider/source IDs remain provenance. Display-name-only matching is insufficient.

A future reconstruction needs explicit competition and match identity plus season-aware club mapping. Renames, promotions/relegations, neutral venues, postponements, duplicates and revised kickoff times must not be silently resolved by current display names.

Player identity is outside this team-level branch; any player-minute mapping remains governed by the separate Non-PL Player Workload record.

## 14. Proposed provider-neutral / shadow contract

No schema or runtime store is approved here.

If a bounded reconstruction-only experiment is later approved, its research observations should remain factual and provider-neutral with canonical identity, value/observation, timing, source, provenance, quality, rights and a hard research-only boundary. Completed-match reconstruction must preserve the source/version used and enough timing to prove the prior match actually preceded the target FPL deadline.

The contract must not contain a fatigue coefficient, rotation probability, competition-importance score or model multiplier unless a still-later separately approved research design explicitly creates and validates one.

## 15. Fallback behaviour

Current frozen production remains the fallback and control.

If a historical calendar fact is missing, ambiguous, rights-blocked or cannot be reconstructed reliably, omit/quarantine that observation and keep the target case on the unchanged Stage 10 production baseline. Do not infer a match, venue, extra-time flag, travel route or rest interval from weak evidence.

A future research-source failure must never change a recommendation or Provider Health.

## 16. Failure modes

Important failure modes include:

- postponed/rescheduled/abandoned matches being assigned the wrong effective kickoff;
- duplicate fixtures or ambiguous competition identity;
- neutral or changed venues;
- extra-time status missing or confused with player-level 120-minute exposure;
- current/final schedules projected backwards as pre-deadline knowledge;
- club identity mismatch across seasons/providers;
- exact travel distance presented as real itinerary evidence;
- competition stage converted into an unmeasured importance/rotation score;
- sparse extra-time samples;
- threshold fishing after outcomes are inspected;
- provider/free-tier/rights changes after the research date.

Team-level extra time means only that the match went to extra time. It does **not** imply that every player played 120 minutes or incurred equal workload.

## 17. Double-counting / leakage risks

A future calendar experiment overlaps materially with information already present in:

- Official FPL availability/news;
- `pStart`, `pAppear`, `p60` and `expMin`;
- recent Official FPL starts/minutes;
- Odds;
- Understat/recent form;
- team strength;
- player history.

Public congestion or team news may already affect market prices and manager behaviour. Therefore the scientific question is incremental residual value against the **exact frozen Stage 10 production control**, not whether European teams or short-rest teams differ in raw outcomes.

Do not record or test a simplistic causal claim that “Europe causes fatigue” or “players score fewer points after Europe”. Later-known schedule revisions, confirmed line-ups, player workload or match outcomes must never leak backwards into the pre-deadline control.

## 18. Validation / ablation plan

No experiment is approved now. If the existing GW5→GW6 evidence-led review identifies a material calendar-shaped expected-minutes gap and Pritesh separately approves a bounded reconstruction experiment, the first test should be deliberately small:

1. use the exact immutable Stage 10 production snapshot as control;
2. reconstruct completed prior-match team facts only;
3. predeclare the smallest observation set before inspecting the experiment outcomes, preferring continuous rest hours and adding other observations only where justified;
4. evaluate expected-minutes targets separately: actual **START**, **APPEAR**, **>=60** and official **minutes**;
5. test incremental residual/discrimination/calibration value rather than raw group differences;
6. account for clustering/confounding by team, player and fixture context where the sample permits;
7. do not convert descriptive rest bins into model thresholds;
8. do not alter production or tune a coefficient during the experiment;
9. require untouched future Gameweeks before any predictive-improvement claim if the candidate was designed using GW1–GW5 evidence.

The named diagnostic sub-question inside the existing GW5→GW6 review is:

> Are there repeated, decision-relevant expected-minutes residuals where a prior completed non-PL team fixture, short all-competition rest or team-level extra time is a plausible missing factual discriminator?

A positive diagnosis permits only a **separate approval proposal** for a bounded historical/reconstruction-only research experiment. It does not approve that experiment automatically.

## 19. Required tests

This documentation closeout changes no runtime and therefore requires no new model/provider test.

If a future reconstruction-only implementation is approved, tests should cover at minimum:

- canonical club/competition/fixture identity;
- actual kickoff ordering and rest-hour arithmetic;
- postponement/reschedule/abandoned handling;
- team-level extra-time classification;
- venue/home-away/coarse-location handling;
- duplicate/missing/conflicting facts;
- source/provenance and rights fail-closed behaviour;
- deterministic reconstruction from pinned inputs;
- exact linkage to the frozen Stage 10 control;
- structural proof that research data cannot enter production calculations or recommendations.

## 20. Evidence required before production use

No production use is currently contemplated or approved.

Before even proposing a model effect, evidence would need to progress through separate gates: GW1–GW5 Stage 10 evidence collection; GW5→GW6 residual diagnosis; separate approval and execution of a bounded reconstruction-only experiment if justified; evidence of repeatable incremental value after confounding/double-counting checks; and untouched future validation of any candidate designed from the exploratory period.

Provider/source rights, current free-tier coverage and implementation-time first-party competition facts must also be re-verified before actual dataset construction.

## 21. Current recommendation

**GO — HISTORICAL/RECONSTRUCTION EXPERIMENT ONLY.**

This is a research conclusion, not implementation approval. Completed cross-competition team calendar facts are largely reconstructible later, so there is no scientific need for a pre-GW1 Step 8 collector. The smallest possible future experiment should use completed prior-match facts offline against the exact frozen Stage 10 control, and only if the existing GW5→GW6 review first diagnoses a material calendar-shaped expected-minutes gap.

Through GW1–GW5:

- do not build a calendar collector;
- do not create a provider account or API key;
- do not add D1/R2 storage or change Cloudflare;
- do not change Stage 10 or fixture-strength logic;
- do not change expected minutes;
- do not add fatigue, congestion, travel or Europe penalties;
- do not change projections or recommendations.

Travel remains deliberately conservative: start with no travel feature; if later evidence justifies one, consider a simple international-away flag before any coarse distance band, and consider exact great-circle distance only if simpler measures prove inadequate. Door-to-door estimates, route assumptions, exact squad itineraries, jet-lag coefficients, east/west penalties, kilometres × fatigue and geocoding/mapping integration are rejected as current design.

### Stop rule

Calendar/congestion work should be abandoned if later evidence shows any of the following:

- no repeatable residual pattern;
- the apparent effect disappears after basic confounding/clustering control;
- existing Odds/FPL/minutes inputs already capture it;
- team-level calendar exposure adds no value without player workload;
- travel adds nothing beyond rest/simple away status;
- extra time is too sparse;
- the result depends on threshold fishing;
- rights/provenance cannot be established;
- £0 operation is too fragile;
- sample size is insufficient;
- untouched future evidence fails to reproduce the exploratory finding.

“Do nothing” remains a valid outcome.

## 22. Explicit implementation approval gate

Step 8A approves **documentation/research reconciliation only**. It does not approve a runtime provider, account, key, collector, scraper, scheduler, D1/R2/Cloudflare change, geocoder/mapping service, Stage 10 change, fixture-strength adjustment, fatigue/travel/Europe rule, expected-minutes change or any projection/recommendation effect.

If the GW5→GW6 diagnosis is positive, the possible next owner decision is a separately scoped **Bounded Historical/Reconstruction-Only Calendar Research Experiment**. That concept would be offline/research-only, use completed prior-match facts only, keep the exact frozen Stage 10 baseline as control, create no production provider/storage dependency and have no model effect. Prospective forward-schedule capture would remain separately justified and approval-gated if a later research question actually needed it.

Before any actual dataset construction or implementation, current first-party evidence must be re-verified for 2026/27 UEFA participants/draws/dates, League Cup round dates/entry, FA Cup dates/rules, relevant venue/postponement state, current free API tiers/coverage, provider terms, storage/retention rights, open-source/data licences and the relevant Official FPL deadline. The underlying Step 8 Deep Research report did not freshly reopen every one of those time-sensitive external pages before finalisation. That limitation does not change the present **no pre-GW1 implementation** conclusion.

> **Dated cost-policy supersession — 22 August 2026:** The owner has superseded the blanket £0 recurring-cost constraint used when this historical research conclusion was reached. Free remains preferred where genuinely comparable; small recurring paid options may now be considered only after explicit current pricing, rights and value/cost justification, preferably through a shadow trial. The original conclusion and its historical context above are intentionally preserved. This amendment approves no provider, acquisition, subscription, retention or production use.
