# Teamsheet External Intelligence Research Programme

Status: **Approved research/documentation structure only. No runtime, provider, model or recommendation implementation is approved by this programme.**

Purpose: permanent control centre for pre-GW1 and later external-intelligence research. This index makes background investigation traceable, reviewable and difficult to lose between project chats, while preserving the existing production approval gates.

## 1. Lineage and authority

The canonical historical root is the existing [External Intelligence Foundation](../EXTERNAL-INTELLIGENCE-FOUNDATION.md), created from the original 12 August 2026 investigation. It stays at its original path and remains the authoritative record of that investigation's date, status, conclusions, research-only boundary, provider-neutral observation contract, hard `shadow_only` rule, rights/retention gate, double-counting controls and pre-registered ablation method.

There is intentionally **no copied `EXTERNAL-INTELLIGENCE-FOUNDATION.md` in this directory**. A duplicate would create competing canonical versions and weaken historical traceability.

The programme lineage is:

`Initial investigation -> External Intelligence Foundation -> topic-specific research branch -> evidence collection/evaluation -> separate owner approval -> optional implementation`

This directory begins at the topic-specific research-branch step. Research findings may refine a question or reject a candidate; they do not silently change the Foundation or production behaviour.

## 2. Production authority is unchanged

Research documents are evidence and planning records, not production specifications. The latest GitHub `main` and canonical operational documents remain authoritative for current behaviour, including `CLAUDE.md`, `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `ROADMAP.md`, `KNOWN_LIMITATIONS.md`, `DATA_SOURCES.md`, `SECURITY.md`, `PROJECTION_MODEL.md` and `TESTING.md`.

A branch reaching **Research complete** or **Ready for approval** does **not** approve:

- a provider, endpoint, API key or acquisition cadence;
- data retention, redistribution or licensing assumptions;
- a model input, weight, formula, fixture-strength adjustment or expected-minutes change;
- transfer, captaincy, squad, rank, Mini-League or recommendation logic;
- a production shadow store, runtime dependency or network origin.

Candidate sources remain unapproved unless they pass the normal provider/data/security approval gate. Candidate model effects remain unapproved unless they pass the normal model/calculation approval gate. `APPROVED_PROVIDER_NAMES` remains exactly the production set recorded in canonical docs and tests.

## 3. Mandatory workflow for future external-intelligence work

Before proposing implementation involving external football information, provider evaluation, expected-minutes evidence, shadow observations, external repositories or model ablation:

1. verify latest GitHub `main` and read `CLAUDE.md` plus the relevant canonical docs;
2. read the [External Intelligence Foundation](../EXTERNAL-INTELLIGENCE-FOUNDATION.md);
3. read this control centre;
4. read the relevant research branch record below;
5. if the branch is not research-complete, investigate and record evidence only;
6. re-verify time-sensitive source access, price/free-tier limits, terms, licensing, retention rights, maintenance and reliability from first-party evidence before any implementation proposal;
7. if evidence supports implementation, prepare the normal approval package with existing/proposed behaviour, exact inputs, sources, fallbacks, assumptions, limitations, trade-offs, validation/ablation evidence and tests;
8. wait for explicit owner approval before changing runtime behaviour.

No research status can bypass step 8.

## 4. Status vocabulary

- **Planned** — scope is registered; branch-specific investigation is not complete.
- **Investigating** — evidence collection/research is actively underway.
- **Research complete** — the research question has a recorded evidence-backed conclusion; no implementation approval is implied.
- **Awaiting evidence** — the current conclusion depends on future evidence that cannot yet be observed or reconstructed reliably.
- **Ready for approval** — enough evidence exists to present a separate implementation proposal; implementation is still unapproved.
- **Approved for implementation** — the owner separately approved an exact implementation scope. This status must link to that approval/decision/PR record.
- **Deferred** — deliberately postponed with a stated reason/trigger.
- **Rejected** — investigated and not recommended for implementation, with rationale preserved.

## 5. Research register

| Area | Foundation origin | Purpose / question | Status | Current conclusion | Unresolved blocker | Evidence required | Earliest implementation trigger | Implementation approval |
|---|---|---|---|---|---|---|---|---|
| [Structural Team Strength](01-TEAM-STRENGTH/RESEARCH-TEAM-STRENGTH.md) | §§1, 3.1, 11–12 | What independent structural anchor, if any, improves FPL team strengths, especially early season/promoted teams? | Planned | FPL strengths remain production; ClubElo is a candidate prior/anchor only | Branch-specific source/coverage/rights/evaluation work not done | Coverage, mapping, historical/prospective ablation, promoted-team handling | Separate evidence-led post-GW1 proposal | Not approved |
| [Recent Form / Understat](02-RECENT-FORM/RESEARCH-UNDERSTAT-ALTERNATIVES.md) | §§2, 3.2, 7–8, 11–12 | Repair, replace or retire the current team-form layer? | Planned | Understat remains team-level only; current parser is known fragile/unrepaired | Alternatives and rights/reliability not comparatively evaluated | Parser evidence, candidate comparisons, team-level xG/xGA ablation | Separate provider proposal after evidence | Not approved |
| [Market / Odds](03-MARKET/RESEARCH-MARKET-MODEL.md) | §§2, 3.3, 9–13 | How should bookmaker market information be transformed and evaluated without double counting? | Planned | Current Odds design remains production; 65% blend is unvalidated and unchanged | Prospective evidence and branch-specific market-method review | Healthy frozen captures, bookmaker coverage, de-vig/staleness/outlier analysis | After sufficient prospective evidence and separate model/provider proposal | Not approved |
| [Calendar / Congestion / Travel](04-CALENDAR-WORKLOAD/RESEARCH-CALENDAR-WORKLOAD.md) | §§3.5, 7–8, 11, 14 | Which competition/calendar facts are reliable and useful without inventing a fatigue penalty? | Planned | No arbitrary `Europe = -X xP` rule is approved | Cross-competition source/identity/rights evaluation not done | PL/UEFA/cups fixtures, rest, extra time, venue/travel evidence | Shadow-only research after separate approval | Not approved |
| [Non-PL Player Workload](04-CALENDAR-WORKLOAD/RESEARCH-NON-PL-PLAYER-WORKLOAD.md) | §§3.4–3.5, 14 | Can non-PL starts/minutes/substitutions/extra time improve expected-minutes evidence? | Research complete | Completed-match workload is factual and mostly reconstructible; Sportmonks is the strongest currently researched structured candidate if a later expanded trial is approved, while API-Football remains rights-clarification gated | Exact current Sportmonks entitlement/terms and any incremental expected-minutes signal remain unproven | Trustworthy identity/provenance, lawful workload observations, predeclared paired ablation and untouched future validation | Separate provider/shadow/model proposal after the factual-availability protocol | Not approved |
| [Availability / Team News](05-AVAILABILITY/RESEARCH-AVAILABILITY.md) | §§3.4, 7–8, 14 | Which factual injury/suspension/team-news observations are reliable, fresh and rights-safe? | Research complete | **GO WITH CONDITIONS:** Sportmonks remains the preferred structured candidate for a minimum factual-only pilot; Stage 10/Official FPL remain the immutable production control and no expected-minutes formula is proposed | Written post-termination retention/derived-data clarification; exact Premier League 2026/27 `sidelined` entitlement; authorised sample/schema semantics | Close rights/entitlement conditions, then a separately approved short assisted pilot using the pre-registered minimum field/cadence contract | Separate Sportmonks Due-Diligence + Assisted Pilot Approval; automated collection only after later pilot evidence | Not approved |
| [Predicted Line-ups / Start Probability](05-AVAILABILITY/RESEARCH-PREDICTED-LINEUPS.md) | §§3.4, 11–12, 14 | Can lineup predictions add calibrated evidence for `pStart`, `pAppear`, `p60`, `expMin`? | Research complete | Predicted line-ups are a second-priority expanded-protocol evidence class; systematic FFS capture is not currently suitable without permission, and categorical XI must never become direct `pStart = 1/0` | Rights/access/revision preservation and independent accuracy remain unresolved | Lawful frozen pre-deadline predictions, source-specific reliability/calibration, paired shadow ablation and untouched future validation | Separate expanded-protocol/provider proposal after factual protocol | Not approved |
| [Player Role Changes](06-PLAYER-ROLES/RESEARCH-PLAYER-ROLE-CHANGES.md) | §§3.6, 11, 14 | Can penalties, set pieces and tactical/position changes be detected without double counting existing xG/xA? | Planned | No fixed role-change xP bonus is approved | Robust observation/identity/validation method not established | Role-change events, timing, persistence and ablation evidence | Shadow-only role research after separate approval | Not approved |
| [FPL Optimisation Prior Art](07-TRANSFERS-OPTIMISATION/RESEARCH-FPL-OPTIMISERS.md) | §§3.8, 14 | What can Teamsheet learn from credible multi-GW FPL optimisation systems without copying incompatible assumptions? | Planned | Current Teamsheet optimiser remains authoritative production behaviour | Comparative algorithm/licence/assumption review not done | Algorithms, objectives, transfer/chip/bench/captain handling, tests | Separate optimiser design/model proposal | Not approved |
| [Historical Evaluation](08-HISTORICAL-EVALUATION/RESEARCH-HISTORICAL-EVALUATION.md) | §§9, 12, 15 | What historical/walk-forward evidence can validly complement prospective evaluation without leakage? | Research complete | Historical replay is useful for chronology, integrity, reconstructible diagnostics and experiment design, but is not faithful replay of the complete current production model; temporal provenance precedes accuracy metrics and r≈0.80 remains method-flattered | Full historical deadline state does not exist for several current production inputs | Field-level temporal provenance, reconstructible paired ablations and prospective Stage 10 evidence for current-system claims | Separate evidence-led evaluation/model proposal after appropriate prospective evidence | Not approved |
| [External Repositories](09-EXTERNAL-REPOSITORIES/RESEARCH-EXTERNAL-REPOSITORIES.md) | §§7–8, 14 | Which public repositories contain useful algorithms/contracts/tests and which assumptions are incompatible? | Research complete | AIrsenal, Open FPL Solver, vaastav and related projects provide valuable prior art, not superiority evidence; learn concepts/contracts/tests and independently validate rather than copying architectures or assumptions | Time-sensitive licence/activity/upstream-rights facts must be re-verified; Open FPL Solver code reuse remains licence-ambiguous | Re-verified rights/activity plus Teamsheet-specific evidence for any adopted concept | Separate provider/model/optimiser/architecture proposal for each exact adoption | Not approved |
| [Shadow Architecture](10-SHADOW-ARCHITECTURE/RESEARCH-SHADOW-IMPLEMENTATION-DESIGN.md) | §§4–6, 10, 14 | What exact provider-neutral storage/identity/provenance contract would permit research with structurally zero production effect? | Planned | Foundation contract and hard `shadow_only` boundary govern; no runtime store exists | Detailed implementation/storage/rights design not approved | Contract tests, identity/timing/rights/failure design | Separate shadow-foundation implementation approval | Not approved |
| [GW1 Evidence Readiness](11-GW1-EVIDENCE/GW1-RESEARCH-EVIDENCE-READINESS.md) | §§9, 12–13, 15 | Which pre-deadline observations are irreconstructible and what must be captured before GW1? | Research complete | Current Stage 10 is sufficient for essential GW1 evaluation if the official record is exported durably outside Safari; exact raw bookmaker quotations remain a research-optionality gap, not a GW1 blocker | Genuine prospective GW1–GW5 evidence still has to be collected; PR #119 remains a separate custody acceptance stream | Official-eligible Stage 10 capture/export, truthful provider state, later linked outcomes and untouched future validation | Evidence collection/evaluation, then a separate evidence-led proposal if any implementation is justified | Not approved |

### Expected-minutes evidence correction — 13 August 2026

Step 5 re-read the executable production code/tests and corrected one Step 4 closeout error. Current production **already uses Official FPL `starts` directly**: aggregate `pStart` is based on cumulative starts and detailed recent-history rows derive `started` from each row's `starts` value. The earlier research statement that current production inferred starts from a `>=45-minute` minutes proxy was wrong and is superseded.

Therefore the previously suggested `>=45 proxy versus starts` prospective experiment is closed before collection. It is not a current-baseline experiment and no formula correction is approved or required by this research closeout.

### Expected Minutes Prospective Evidence Protocol — 13 August 2026

The pre-registered protocol now fixes these research rules:

- the evaluation unit is season × canonical FPL player × Premier League fixture × FPL deadline × exact frozen Stage 10 snapshot;
- Stage 10's stored `pStart`, `pAppear`, `p60`, `expMin`, confidence and source state are the immutable production control; later model reruns are not substitutes;
- outcome targets are separate: actual START, APPEAR, >=60 and official fixture minutes;
- source publication time, source revision time, `retrieved_at`, FPL deadline, fixture kickoff and outcome availability are distinct clocks, normalised to UTC for storage;
- an observation is pre-deadline evidence only if Teamsheet actually retrieved the frozen state no later than the official deadline;
- facts, interpretations and predictions remain different semantics and are never silently converted to probabilities;
- uncertain player/team/fixture mappings are quarantined from metrics and production;
- source revisions append new records rather than rewriting history;
- GW1–GW5 remains integrity/diagnosis, not validation; anything designed from those outcomes must face untouched future Gameweeks;
- any future research implementation must be structurally incapable of affecting production, including fail-closed rights, server-side secrets and deterministic production invariance.

The **minimum protocol** tests factual availability only, linked to the exact frozen Stage 10 baseline and later official START/APPEAR/60/MINUTES outcomes. Predicted line-ups and completed non-PL workload belong to later expanded protocols.

Provider research on 13 August 2026 concluded:

- **Sportmonks:** strongest currently researched structured candidate for a future factual-only prospective trial at the provider-contract level, subject to fresh owner approval and implementation-time verification of exact terms, price, Premier League entitlement, fields, cadence, retention/deletion and security design;
- **API-Football:** technically capable but **RIGHTS CLARIFICATION REQUIRED** before durable Teamsheet research retention;
- **Fantasy Football Scout:** valuable predicted-XI prior art but **not currently suitable for systematic prospective Teamsheet capture without permission** under the reviewed extraction/database restrictions.

These classifications are research findings only. They approve no account, subscription, provider activation, acquisition, storage or model effect.

Step 6 provider/security approval research subsequently narrowed the Sportmonks path to **GO WITH CONDITIONS**. The full field, cadence, retention, security and pilot conditions are recorded in the linked Availability / Team News branch. No account, collection, Worker/D1 code or model effect is approved by that conclusion.

No new essential pre-GW1 evidence-preservation requirement was found. External factual availability and predicted-lineup states would be useful if captured prospectively, but missing GW1 does not invalidate later research. Completed non-PL workload remains generally reconstructible. The completed GW1 Evidence Readiness conclusion therefore remains unchanged.

### Why Availability and Predicted Line-ups are separate records

The original proposed directory combined them. This programme keeps them in the same `05-AVAILABILITY` topic family but separates the records because they represent different evidence classes: factual availability/team news versus uncertain lineup predictions. Combining them would make it easier to blur a fact with a forecast or accidentally treat a predicted XI as a binary expected-minutes instruction.

## 6. Standard research record

Every branch uses [RESEARCH-TEMPLATE.md](RESEARCH-TEMPLATE.md). Sections may contain established canonical facts from the Foundation/current production docs, but branch-specific findings must be labelled with evidence. Unknowns stay `Planned` / TBD; a stub must not manufacture a conclusion just to fill a heading.

Each record must preserve at least:

- research question and current Teamsheet behaviour;
- candidate sources/repositories/approaches and exact fields;
- coverage, freshness, reliability, history and cost/free-tier constraints;
- rights/licensing/retention and security/privacy;
- canonical identity/mapping and timing;
- provider-neutral/shadow contract, fallback and failure modes;
- double-counting/leakage risks;
- validation/ablation plan, tests and evidence threshold;
- current recommendation and explicit implementation approval gate.

## 7. Evidence discipline

Research evidence must distinguish:

- **fact** — directly supported by current repository behaviour or cited source evidence;
- **inference** — reasoned interpretation that must not be presented as a measured result;
- **proposal** — a future design choice requiring approval;
- **limitation** — missing, stale, conflicting or unavailable evidence.

For historical work, **Gameweek-labelled is not the same as pre-deadline-known**. Field-level temporal provenance must be established before treating a historical value as a valid model input; chronology labels and accurate metrics cannot repair hindsight leakage.

Historical data may help reject ideas and design experiments, but retrospective fit is not a production accuracy claim. Anything designed using GW1–GW5 outcomes must later face untouched future Gameweeks before an improvement claim is permitted.

For expected-minutes research, keep factual availability, interpretation and tactical prediction as separate evidence classes. `pStart`, `pAppear`, `p60` and `expMin` are distinct targets and must be evaluated separately. A lower minutes MAE alone is not proof of improved FPL decisions.

## 8. Time-sensitive research rule

Source availability, free tiers, rate limits, terms, licences, retention rights, repository maintenance and API schemas can change. A research conclusion must record its research date. Before implementation, every material time-sensitive claim must be re-verified from first-party sources even when the branch is marked Research complete or Ready for approval.

## 9. Programme boundary for this checkpoint

Creating and closing research records changes documentation governance only. It does not move or alter the original Foundation, add a provider, contact any candidate source, create a production shadow store, change model weights or formulas, change expected minutes, change transfer/captaincy/squad/Mini-League logic, add dependencies, expose secrets or change the deployed application.