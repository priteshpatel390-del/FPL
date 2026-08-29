# Decision Intelligence — DI-0 Foundation & Architecture

> **DI-2 implementation note (29 August 2026):** the automated offline evaluation/ablation checkpoint described in section 18 is now implemented as a review candidate. Its exact manifest, anti-leakage, metric, report, synthetic-evidence and exclusion boundaries are recorded in [DI-2 Automated Evaluation & Ablation](DECISION-INTELLIGENCE-DI2-EVALUATION.md). This creates no DI-3 or production approval.

**Status:** COMPLETE FOR OWNER REVIEW — RESEARCH/ARCHITECTURE ONLY  
**Baseline:** GitHub `main` `9243c113cb9d16d994b280041ce94ddc2e3170cd`  
**Investigated:** 29 August 2026  
**Next gate:** explicit owner approval of DI-1; no implementation is approved by this record

## 1. Executive outcome

**FACT.** Teamsheet already produces projections, expected minutes, a legal best XI, captain/vice, bench order, exact zero-to-three-transfer comparisons, fixture runs, rival exposure and retrospective Stage 10 evaluations. It has no canonical weekly-decision artifact and no approved path from shadow evidence into those calculations.

**INFERENCE.** The missing foundation is not another predictor. It is a controlled layer that preserves independent football beliefs, enumerates legal actions, compares whole-squad consequences, represents uncertainty and cites deadline-valid evidence.

**RECOMMENDATION.** Build Decision Intelligence as a separately versioned, provider-neutral layer over immutable as-of facts and frozen existing model outputs. Require a dependency graph and experiment manifest before combining signals. Keep football expectation, availability, transfer economics, uncertainty and competitive strategy separate. The product should render a frozen decision artifact, not compose recommendations inside UI or provider code.

**LIMITATION.** DI-0 establishes no prospective accuracy improvement. Historical aggregate `r=0.80` remains method-flattered. No runtime, calculation, provider, DATA-S2B, D1, Cloudflare, security or UI behaviour changes here.

## 2. Exact repository baseline

| Item | Finding |
|---|---|
| Authoritative main | `9243c113cb9d16d994b280041ce94ddc2e3170cd`, merge of PR #181 |
| Application checkpoint | GW1 readiness remains the delivered application checkpoint; current later work is isolated DATA-S2B work |
| DATA-S2B | Phase 3 `shadow_only` deployment passed. Phase 4A cadence and Phase 4B candidate/deployment/Cron paths are repository-prepared. At this SHA Cron activation and collection are unperformed/unapproved and live history counts remain zero |
| Tests | `./run-tests.sh`: **1,077 passed, 0 failed, 0 skipped, 0 cancelled** |
| Build | passed: build `953841b`, model `2.4.0`, rules `2026-27.3`, source `3fcfd800e1bd`, inputs `212fa1369b92` |
| Open PRs | Draft #119 (browser evidence delivery) and draft #136 (diagnostic transport probe); both are older evidence-path branches and do not supersede current model/data-platform main |
| Concurrent risk | DATA-S2B owns Official history, D1 history/head semantics, cadence and live activation. DI must use a future read contract and not edit those assets. Evidence-path PRs may overlap Stage 10 files |

The baseline came from fetched `origin/main`, the GitHub pull API, repository history, canonical/historical records, implementation and a fresh repository gate—not from an old handover.

## 3. Current decision-system map

```text
Official FPL bootstrap/fixtures/account/history
  -> validation + atomic refresh
  -> structural strengths + schedule -> match context
  -> status + aggregate/detailed history -> expected minutes
  -> player event rates + scoring rules -> per-fixture/horizon xP

optional Understat team last-six xG/xGA -> 45% blend when both clubs exist
optional Odds match expectations -> 65% sequential blend when quoted

xP -> legal best XI -> captain/vice + ordered bench
xP + squad economics + horizon -> zero-transfer baseline + legal 1–3 transfers/hits

Stage 10 pre-deadline snapshot -> Official outcomes -> descriptive evaluation
Mini-League/rivals -> factual standings/exposure only, never football xP
```

### Existing implementation facts

- Official home/away attack/defence strengths produce match context; invalid strength uses neutral context, with Official fixture difficulty as a Fixtures-view fallback.
- Understat is optional, team-level last-six xG/xGA only. It is relay/scrape-dependent, rights-unresolved and blended at 45% when both teams map.
- Odds is optional/direct-key-only, de-vigs markets into match expectations and receives 65% of the sequential context when a quote maps. Its retention governance is unresolved.
- Expected minutes combines Official status/chance, cumulative minutes/starts and recency-weighted detailed history into `pStart`, `pAppear`, `p60`, `expMin` and a heuristic confidence label.
- xP combines minutes, Official per-90 rates, fixture context, position rules, clean sheets, saves, defensive contributions, bonus and shrunk rare events. Pre-season uses a distinct price/ownership fallback.
- Best XI respects formation; captain/vice are distinct starters; bench order is retained separately.
- Transfers compare exact legal squads, mandatory zero-transfer baseline, hits, bank and horizon. Rollover value is contextual, not a validated point value.
- Stage 8 simulation is conditional on the same model, not independent corroboration.
- Stage 10 freezes pre-deadline inputs/outputs and joins later outcomes. Hindsight oracle/ranks are descriptive only.
- Mini-Leagues expose standings, gaps and selected-rival captain/vice/chip facts. Protect/balanced/chase is not validated or implemented.

## 4. Canonical intelligence inventory

Classification: **1 production input; 2 production output; 3 current unvalidated/broken; 4 shadow candidate; 5 future research; 6 context only; 7 rejected/duplicative/unsuitable; 8 unknown.** Every row records source/timing, role, overlap/leakage/reliability, rights/fallback and validation.

| Intelligence | Class | Canonical assessment |
|---|---:|---|
| Official players/teams/events | 1 | `bootstrap-static` before use; canonical identities/base facts; season-ID and schema drift risk; current gateway/allowlist rights boundary; fail closed/neutral as currently defined; validate season, schema and completeness |
| Fixtures, deadlines, blanks/doubles | 1 | Official as fetched; schedule/horizon/cutoff; later schedule changes cause leakage; retain frozen fixture identity; require as-of-deadline joins |
| Status/news/chance | 1 | Official observation; availability/warnings; overlaps injury news/markets and can lag; no invented fitness fallback; start/appearance/p60 calibration required |
| Aggregate minutes/starts | 1 | Official cumulative facts; expected-minutes base; overlaps detailed history/workload and is weak early; prior fallback; walk-forward evaluation |
| Detailed history | 1 | Official element-summary for bounded cohort; recent minutes; corrections/cohort gaps matter; aggregate/prior fallback; correction-aware point-in-time tests |
| Prices/bank/purchase/sale value | 1 | Official/account facts before deadline; transfer legality/economics; historic selling value often unreconstructible; inconsistent squad must fail closed; property/legality tests |
| Free transfers/hits | 1 | Official/account-derived state plus versioned rules; transfer consequence; deadline-specific; first-deadline optimiser guard; validate against outcomes/rules |
| Ownership/transfers | 1,6 | Official transient facts; current pre-season baseline and competitive context; must not silently represent football ability; omit rather than impute; separately approve/evaluate any new role |
| Set-piece orders | 1,5 | Official facts; current penalty-order use is limited to penalty-miss treatment; overlaps historic xG/xA; missing means unknown; role-change ablation required |
| Squad/account facts | 1 | Official picks/history or validated manual squad; legal action basis; manager identity remains hashed/redacted; manual fallback; exact season/identity validation |
| Mini-League/rivals | 6 | Official on-demand facts; standings/gaps/exposure; pagination/staleness/privacy risk; omit unavailable rival; never adjust football xP |
| Structural FPL strength | 1 | Official opaque strength; team prior; overlaps Understat/markets; neutral fallback; prospective goal/clean-sheet evaluation |
| Understat team xG/xGA | 3 | Optional scrape/relay observed near use; recent-team-performance layer; overlaps structure/results/markets; reliability and rights unresolved; omit on failure; only shadow ablation after approvals |
| Odds expectations | 3 | Direct-key market snapshot; match expectation; may already price injuries, lineup, congestion, travel, form and strength; retention/key constraints; omit on failure; prospective quote-time calibration/ablation |
| 45%/65% sequential blend | 3 | Current calculation, unvalidated and order-dependent; high double-count risk; unchanged in DI-0; compare baseline/each/combination on held-out time |
| Expected minutes | 2 | Pre-deadline model output driving every player decision; upstream uncertainties partly collapsed; existing prior fallback; Brier/log loss/calibration plus minute MAE/RMSE |
| Minutes confidence label | 3 | Heuristic, not calibrated decision confidence; preserve but do not reuse as universal confidence; test association with error |
| Player xP | 2 | Versioned existing model output; consequence basis; inherits every upstream dependency; current fallback; evaluate error, calibration, ranking and downstream decisions separately |
| Simulation distribution | 2,3 | Deterministic descriptive output conditional on current model; shared inputs prohibit use as an independent vote; suppress reduced quality; interval/event calibration |
| XI/captain/vice/bench | 2 | Existing legal outputs; action candidates; close margins/autosubs matter; no independent signal; deterministic legality and descriptive realised evaluation |
| Transfer baseline/candidates/hits | 2 | Exact optimiser; no-action/transfer alternatives; shared upstream uncertainty; mandatory baseline; frozen-horizon evaluation against zero transfer |
| Rollover/flexibility | 6,5 | Context, not point-valued production evidence; future optionality depends on unknowable events; no arbitrary coefficient; later policy research |
| Fixture runs/swings | 2,6 | Derived schedule/context; planning/explanation; already embedded in horizon xP; never sum again; schedule-change evaluation |
| Stage 10 snapshot | 2 evidence output | Hash-identified pre-deadline evidence; timing/coverage can fail; local/export/archive fallback; hash/deadline/provenance validation |
| Official realised outcomes | 2 evaluation input | Post-deadline Official facts; evaluation only; categorical leakage if decision-reachable; provisional/corrected revisions; forbid production import |
| Hindsight metrics/oracle | 6 | Post-event diagnostics; never production input; method-flattery risk; keep separate modules/storage and label fully |
| DATA-S2 history | 4 | `shadow_only` append-only Official observations/heads; future evaluation; cadence misses some transient states; no app read path; future read-only interface, never a DI history clone |
| Domestic/European calendar | 4 | First-party schedules/results where rights permit: prior/next match, competition, venue, rest, 7/14-day counts, extra time; fixture/publication changes matter; omit missing; incremental-minutes ablation |
| Non-PL player starts/minutes | 4 | First-party lineup/match facts if available; workload/rotation evidence; overlaps historical minutes/news and needs prospective capture; missing unknown; expected-minutes ablation |
| Travel/distance | 5,8 | Derived venue/path facts; possible conditional workload context; likely redundant with away/rest/participation; rights/mapping risks; reject if no increment; no fatigue coefficient |
| Injury/suspension/press claims | 4 | Timestamped attributed claims; availability evidence; overlaps Official/market; publication/correction context essential; store permitted claim/reference, not copied articles; source-stratified calibration |
| Predicted lineups | 4 | Timestamped provider forecast; evidence, never instruction; overlaps news/workload/historical starts; copying/rights/version risk; omit failure; source-specific start calibration |
| Confirmed lineups | 6/4 only if eligible | Usually post-FPL-deadline and forbidden; usable only when genuinely published before that exact deadline; hard timing gate |
| Role-change detection | 4,5 | Official order/factual role changes; event-rate research; historical rates already encode past role; append change points, never retro-label; post-change holdout |
| Recent-form alternatives | 5,7 | Must remain separate from structure; raw results/momentum are noisy/duplicative; only pre-registered measurable representations |
| Matchup microstats | 5,7 | High-dimensional/right-cost/multiple-testing risk; defer; reject narrative matchups; require prospective hypothesis |
| Effective ownership | 8 | Requires explicit population/captain/chip scope and deadline-valid data; competitive context only; omit until supportable |
| Rank/strategy | 6,5 | Rank factual; protect/balanced/chase is preference-dependent later research; football xP stays byte-identical |
| Chips | 6,5 | Current use is factual; planning policy separately approved later; excluded from DI-1 |
| Hosted LLM advice | 7 | Disabled and unsuitable as authoritative nondeterministic decision maker; a future language layer may only explain a frozen artifact |
| Arbitrary fatigue/travel/role weights | 7 | Unsupported, hides overlap and fake precision; prohibited pending evidence |

## 5. External Intelligence and DATA-S2B relationship

The accepted boundary remains:

```text
observation -> validation -> normalisation -> rights/retention gate
 -> shadow storage -> evaluation -> separate approval -> optional production adapter
```

`shadow_only` is a capability boundary, never “low-weight production.” DI adds decision contracts/evaluation orchestration, not another provider platform.

**DI needs after DATA-S2B acceptance:** immutable observation/run IDs; season/entity/field identity; values/hashes; source revision; `observedAt`, `fetchedAt`, publication/effective time where known; correction/disappearance status; as-of-deadline read/export.

**DATA-S2B remains unaware of:** actions, utility, confidence, transfer/rival policy, explanations, weights and experiment winners. DATA-S2B owns Official collection/history; DI owns manifests, frozen feature views, predictions/actions/evaluations/approvals; Stage 10 owns manager-specific decision/outcome evidence. Cross-boundary references use immutable IDs/hashes.

**Cannot safely reconstruct later:** exact offered odds/bookmaker set; edited news/predicted lineups; transient Official status/news/ownership/transfer state; source disagreement; provider/model health; account sale economics; and what Teamsheet actually possessed before deadline.

## 6. Recommended architecture

The proposed linear path needs three improvements: rights gates before persistence; repeated time eligibility at feature/decision generation; and uncertainty/control boundaries throughout.

```text
CONTROL: candidate + schema + rights registries, versions, approval ledger,
         experiment manifest, dependency/overlap graph
                    |
ACQUIRE: adapter -> validate -> identity -> rights decision
                    |
EVIDENCE: immutable permitted raw reference -> normalised observation
          -> provenance + timing + quality + shadow/production eligibility
                    |
AS-OF: deadline resolver -> bitemporal eligibility -> frozen feature view
                    |
DOMAIN BELIEFS + FROZEN EXISTING OUTPUTS + CONTEXT-ONLY FACTS
                    |
ACTION: legal enumerator -> consequence engine -> alternative frontier
                    |
POLICY: explicit approved utility/constraints + uncertainty/sensitivity
                    |
DECISION ARTIFACT: recommendation + alternatives + evidence + conditions
              /                              \
PRODUCT READ MODEL                     EVALUATION/ABLATION
```

Shadow storage exposes evaluation capability only. Production retrieval requires a signal/version/scope-specific approval. Production bundles cannot import shadow adapters/query clients or outcome modules. Experiments are pure functions of a frozen view. UI renders the artifact and cannot blend sources, recalculate confidence or choose policy.

## 7. Domain boundaries

| Domain | Owns | Must not own |
|---|---|---|
| Structural ability | slow team attack/defence prior | recent form, market, injury |
| Recent performance | explicit windowed observations | structural default or market |
| Market | quote-specific match distribution | causal injury/congestion explanation |
| Fixture context | opponent/venue/schedule/blank/double | ability or availability |
| Availability/minutes | start/appearance/p60/minutes beliefs | per-90 talent or ownership |
| Workload | factual matches/rest/starts/minutes/extra time | arbitrary fatigue penalty |
| Player role | set-piece/tactical facts | retroactive event-rate rewrite |
| Event-rate projection | conditional scoring expectations | price/rank utility |
| Squad optimisation | legal XI/C/VC/bench/autosubs | provider collection/risk preference |
| Transfer economics | bank/prices/FT/hits/legality/flexibility | football ability |
| Uncertainty | distributions, quality, missingness, disagreement, sensitivity | universal truth score |
| Competitive strategy | rank/league/exposure + explicit utility | football expected points |

Typed outputs may cross boundaries; domains cannot mutate each other. Workload informs a minutes experiment, never direct xP penalty. Fixture-run scores explain xP consequences, never add another benefit. Rival exposure can only enter an approved competitive utility after football xP is frozen.

## 8. Normalised observation/evidence model

```js
{
  observationId, schemaVersion, sourceId, providerVersion,
  mode: "shadow_only" | "production_approved",
  subject: {entityType, canonicalId, season, sourceEntityId},
  predicate, value, unit, scope,
  timing: {sourcePublishedAt, effectiveAt, observedAt, fetchedAt,
           validFrom, validTo, supersededAt},
  acquisition: {runId, endpointClass, status, contentHash},
  provenance: {adapterVersion, normaliserVersion, parentObservationIds},
  quality: {validationDisposition, completeness, freshness,
            sourceConfidence, disagreementGroupId, issues},
  governance: {rightsClass, retentionClass, expiresAt,
               permittedUses, containsPersonalData, approvalId}
}
```

`observedAt` (first possession), `fetchedAt` (transport completion), `sourcePublishedAt` and `effectiveAt` are never aliases. Missing publisher time stays missing and may make replay ineligible. Identity is season-scoped; ambiguous mappings quarantine. Corrections append rather than rewrite. Raw content is retained only with rights; otherwise retain permitted structured facts/hash/reference.

## 9. Canonical weekly decision

```js
{
 decisionId, schemaVersion, generatedAt, season, gameweek,
 deadline:{eventId, deadlineAt, cutoffAt, eligibilityPolicyVersion},
 build:{commit, modelVersion, rulesVersion, policyVersion, manifestId},
 squadBasis:{squadHash, bank, freeTransfers, purchasePriceBasis, chipsContext},
 recommendation:{actionSet, expectedConsequence, opportunityCost,
                 rationaleCodes, evidenceRefs, assumptionRefs},
 alternatives:[{actionSet, expectedConsequence, delta, tradeOffs,
                uncertainty, evidenceRefs}],
 uncertainty, risks,
 reconsiderationConditions:[{observablePredicate, materialityThreshold,
                              affectedActions, expiresAt, evidenceRefs}],
 competitiveContext:{status, facts, policyRef},
 completeness:{status, missingDomains, staleDomains, conflicts},
 explanation:{summaryCodes, reasonGraphRootIds},
 identity:{featureViewHash, candidateSetHash, contentHash}
}
```

`Action` is a union for XI, bench order, captain, vice, transfer and roll; chips/strategy come only after separate approval. Transfer actions record in/out, hit, bank, FT result and legality proof. Consequence keeps football expectation, hit and flexibility descriptors separate—unvalidated flexibility is not converted to points. Include no-action where legal, materially indistinguishable alternatives, missing evidence and deadline-bounded reconsideration conditions. AI cannot create or alter the artifact.

## 10. Confidence and uncertainty

Do not create a universal percentage. Preserve:

- **model:** distributions/intervals, calibration cohort and sample;
- **availability:** calibrated `pStart`, `pAppear`, `p60`, expected minutes;
- **source:** coverage, freshness, reliability status, disagreement and missingness;
- **decision margin:** best versus next and no-action;
- **sensitivity:** which plausible assumption/observation ranges change the action;
- **schedule:** fixture identity and blank/double risk.

Freshness is an age, not confidence. Model dispersion excludes unknown unknowns. Decision uncertainty can be high when alternatives are close even if individual projections look stable. Missing evidence remains explicit rather than silently reducing a score. Any future short label must be a validated disclosure category derived deterministically from this profile.

## 11. Double-counting/dependency map

| Overlap | Required determination |
|---|---|
| FPL strength ↔ Understat | baseline, each, combination; time-blocked goal/CS metrics and residual correlation |
| structure/form ↔ Odds | market-only/model-only/combination; incremental proper score/calibration, not arbitrary blend |
| Odds ↔ injuries/lineups | before/after-news strata and interaction arm; no blind double uplift |
| Odds ↔ congestion/travel | conditional ablation; stop if no residual increment |
| FPL status ↔ injury reports | precedence/conflict cohorts and minutes calibration; never multiply probabilities blindly |
| team news ↔ predicted lineups | provenance clusters/source-independence audit and disagreement cohort |
| historic minutes ↔ workload | only target-preceding incremental workload; interaction test |
| expected minutes ↔ availability | dependency graph forbids a second xP availability multiplier |
| role ↔ historic xG/xA | change-point/post-change experiment, no full-history uplift |
| fixture context ↔ xP ↔ runs | runs explain but cannot be summed with xP |
| ownership ↔ pre-season baseline/strategy | disclose current link; isolate competitive policy |
| simulation ↔ xP | dispersion only, never independent vote |
| rivals ↔ captain policy | approved strategy arm only; underlying xP byte-identical |
| blanks/doubles ↔ fixture count | label/planning only if already included in xP |

Each manifest declares parents, information families, hypothesised relation (`complementary`, `redundant`, `conditional`, `conflicting`, `unsafe`) and forbidden combinations. Factorial ablation, disagreement cohorts and residual correlations decide the relation. A tuned in-sample winning blend cannot graduate.

## 12. Anti-hindsight design

Eligibility normally requires `sourcePublishedAt`, `observedAt`, `fetchedAt` and `modelGeneratedAt` at/before the declared cutoff, with `effectiveAt` valid for the target. Missing timestamps are explicit. Point-in-time joins use both knowledge time and effective time; a later head cannot be used merely because it describes an earlier event.

Pin deadline/fixture identity, observation/adapter/model/rules versions, feature hashes and seeds. Training/tuning precedes validation and untouched holdout. Corrections append. Confirmed post-deadline lineups, closing odds, final ownership/prices/news and actual later workload are forbidden. Reports list exclusions. A permanent test injects a perfectly predictive post-deadline sentinel and must reject it.

## 13. Permanent shadow boundary

1. Shadow governance stays `shadow_only` unless separately migrated/approved.
2. Shadow and production adapters have different namespaces, registries and capabilities.
3. Approval pins signal/predicate, versions, report hash, scope, fallback and expiry.
4. Production retrieval rejects matching-schema shadow rows.
5. Static import/build/config tests prohibit reachability.
6. Adding arbitrary shadow rows leaves production decisions byte-identical.
7. Missing/expired/scope-mismatched approval fails closed.
8. Outcome/evaluation credentials are absent from recommendation runtime.

## 14. Automated evaluation/ablation

Every manifest predeclares hypothesis, baseline, arms, decisions, eligibility/cutoff, cohort, train/tune/validate/holdout windows, metrics/success criteria, coverage/sample, missing policy, overlap family, seeds, versions/hashes and stop rules.

```text
A baseline
B baseline + X
C baseline + Y
D baseline + X + Y
E only a predeclared interaction/replacement
```

One frozen view feeds all deterministic arms. Unequal cohorts/attrition are reported, never hidden. Outputs are machine-readable plus a plain-language evidence package; production weights are never auto-tuned.

| Domain | Metrics (not interchangeable) |
|---|---|
| Minutes | start/appearance/p60 Brier + log loss + reliability/calibration; minutes MAE/RMSE; status/position/team cohorts |
| Team/fixture | goal-distribution log score/deviance; goal MAE secondary; CS Brier/log loss/calibration |
| Player xP | MAE/RMSE, projection-band calibration, rank/top-k descriptive use, interval coverage and cohort errors |
| Uncertainty | interval coverage/width, event proper scores, calibration and sharpness conditional on calibration |
| XI/C/VC/bench | frozen realised consequence, legal autosubs, opportunity cost; conditional vice fallback |
| Transfers | gross/net versus mandatory zero-transfer baseline, declared horizon, hits, schedule changes and option-loss descriptors |
| Decision | regret within the frozen legal candidate set, stability/sensitivity, no-action and material decision-change rate |

Report paired/time-blocked uncertainty, effect sizes, base rates and coverage. A statistical metric win without material/stable decision impact is insufficient; a changed action without outcome evidence remains exploratory. Graduation also requires rights/security, prospective freshness, pre-registration, protected-domain non-regression, double-count audit, deterministic reproduction, fallback tests and owner approval.

## 15. Rights, security, provenance, fallback

- Permissions to acquire, retain raw, retain normalized, derive, display, redistribute and evaluate are separate and fail closed.
- News/lineups should retain permitted structured claims, timestamp, attribution/reference/hash—not copied articles by default.
- Odds keys remain direct-only/masked and absent from logs, URLs and evidence. No new browser secrets.
- Manager/league/rival IDs stay out of general diagnostics/evidence; strategy artifacts are private/purpose-limited.
- Use entity/activity/agent provenance concepts and transitive parent references.
- Invalid/unavailable source is quarantined; approved baseline continues with missing-domain disclosure.
- Stale evidence is omitted or uses its explicit approved fallback; timestamps never refresh on retention.
- Identity ambiguity quarantines; source conflict preserves claims/disagreement, never silent majority voting.
- DATA-S2B outage delays evaluation or uses a pinned export; it never blocks the application.
- Incomplete/unequal experiment arms cannot become clean comparisons.
- Missing production approval rejects the signal. Materially incomplete decisions become partial/no-decision, never fabricated certainty.

## 16. Streamlined workflow

```text
candidate registry -> generated adapter/schema/rights skeleton
 -> contract/property/security tests -> approved shadow capture
 -> automated coverage/quality -> pinned feature view -> manifest ablation
 -> generated evidence report -> repository review -> owner production approval
 -> separately implemented production adapter/policy
```

Automate schemas, mapping fixtures, retention/provenance/timing checks, deterministic manifests, calibration/ablation reports and approval checklists. CI verifies exact identities, no secrets, licences, forbidden imports, baseline byte identity, point-in-time eligibility and report reproduction.

Once a phase is approved, branch/code/tests/build/docs/CI/draft-PR work is bounded autonomy. Owner approval remains mandatory for production calculations, provider activation/weighting, security/auth, rights/retention, material product behaviour, test weakening/golden changes and merge.

## 17. External prior art

| Source | Useful idea | Disposition |
|---|---|---|
| [W3C PROV-DM](https://www.w3.org/TR/prov-dm/) | entity/activity/agent derivation | adopt concepts, not full ontology |
| [Feast point-in-time joins](https://docs.feast.dev/getting-started/concepts/point-in-time-joins) (Apache-2.0 project) | future-safe feature retrieval | adopt semantics/tests; no browser dependency |
| [scikit-learn calibration](https://scikit-learn.org/stable/modules/calibration.html) (BSD-3-Clause) | reliability/proper probabilistic evaluation | adopt offline concepts; no runtime dependency |
| [OpenLineage model](https://openlineage.io/docs/spec/object-model/) (Apache-2.0) | run/job/dataset lineage facets | adapt manifest/run lineage; platform excessive now |
| [MLflow Tracking](https://mlflow.org/docs/latest/ml/tracking/) (Apache-2.0) | immutable params/metrics/artifacts | content-address records; reject server at current scale |
| [AIrsenal](https://github.com/alan-turing-institute/AIrsenal) (MIT, GitHub API verified 29 Aug 2026) | separate prediction, optimisation, multiweek planning | learn boundaries; do not copy/replace exact optimiser blindly |
| vaastav FPL archive | historical reference/verification | not point-in-time truth for transient facts |
| Open FPL Solver/sasoptpy research | explicit constraints/horizon | later solver/chip research only |

Pages were reachable during DI-0. Licence, terms, maintenance, pricing and access must be rechecked before use. No code was copied.

## 18. Implementation programme

### DI-1 — Shadow Intelligence Platform

- **Objective/outputs:** provider-neutral candidate/observation/provenance/timing/rights schemas, validators, candidate/approval registries, point-in-time eligibility and hard capability isolation.
- **Inputs/dependencies:** External Intelligence Foundation, DATA-S1/S2 and Stage 10 patterns; reconcile then-current DATA-S2B/open evidence PRs.
- **Exclusions:** provider/collector/live storage, production read, calculations/UI, D1/Cloudflare/DATA-S2B edits.
- **Tests/evidence:** schema/property/timing sentinel/identity/rights/secret/import/byte-identity/deterministic build; conformance/threat/rights report and zero production reachability.
- **Approval/owner:** approve start, review one package, separately approve merge. Contracts/tests can proceed parallel to DATA-S2B.

### DI-2 — Automated Evaluation & Ablation

- **Objective/outputs:** manifest runner, frozen as-of views, domain metrics, factorial ablations and generated reports.
- **Inputs/dependencies:** DI-1; approved DATA-S2B read/export and Stage 10 evidence when trustworthy.
- **Exclusions:** production signal use, weights and recommendation changes.
- **Tests/evidence:** leakage/time-split/cohort/determinism/metric/multiple-test/artifact tests and reproducible baseline parity reports.
- **Approval/owner:** approve phase/merge; routine experiments inside approved datasets/manifests need no micro-approval. Metric adapters can parallelise after manifest freeze.

### DI-3 — Validated Production Decision Layer

- **Objective/outputs:** canonical action/consequence/policy/artifact generator; graduate only explicitly approved signals.
- **Inputs/dependencies:** DI-2 evidence, current optimiser outputs and owner-approved materiality/utility semantics.
- **Exclusions:** UI redesign, chips and competitive strategy unless separately approved.
- **Tests/evidence:** legal action completeness, no-action, consequence conservation, shadow/competitive separation, deterministic fallback; prospective/holdout report and exact behaviour diff.
- **Approval/owner:** every calculation/policy/provider graduation and merge remains explicit. Contracts/adapters can isolate; policy integration is serial.

### DI-4 — Weekly Decision Synthesis / Product Integration

- **Objective/outputs:** render coherent deadline decision, alternatives, evidence, risks and reconsideration conditions from frozen artifact.
- **Dependencies:** stable DI-3 plus separately approved product design.
- **Exclusions:** account writes, LLM decisions, automatic chips/rank strategy.
- **Tests/evidence:** artifact/render parity, accessibility, stale/missing states, no recomputation, mobile/security regressions, exact provenance and physical iPhone acceptance.
- **Approval/owner:** UX scope, bounded device acceptance and merge. Renderer/resolver can parallelise after artifact freeze.

## 19. Risks and limitations

1. Prospective samples are small and FPL outcomes noisy; evidence may stay inconclusive.
2. DATA-S2B daily/pre-deadline cadence cannot preserve every transient fact.
3. Current Understat/Odds weights are unvalidated/order-dependent and unchanged.
4. Provider rights/terms/licences/pricing change; research is not approval.
5. Markets are opaque and can make double counting hard to diagnose.
6. Minutes truth needs careful doubles/extra-time/correction handling.
7. Candidate construction/horizon can flatter realised regret; hindsight oracle is not a target.
8. Flexibility/chips/competitive utility require later preference semantics.
9. Travel may add nothing beyond rest/away/participation and should then be rejected.
10. DI-1 should implement minimal contracts/capabilities, not infrastructure by default.

## 20. DI-1 implementation checkpoint — 29 August 2026

DI-1 now implements the minimum generic platform described above in `src/decision-intelligence/`. The canonical observation preserves provider-neutral identity, value, all distinct timing clocks, source, quality/conflict, provenance, rights and the hard `shadow_only` capability. Official FPL IDs are canonical where equivalents exist; provider record IDs remain provenance. Display-name-only, ambiguous/unmatched (absence of a canonical ID), wrong-type, cross-season and fixture-type identities fail closed.

The signal registry requires a stable signal/version, domain/source/subject, timing requirements, rights/persistence declaration, evidence type, dependencies, overlap risks, evaluation domain and exact `shadow_only` status. It contains no built-in candidates. The approval ledger requires an explicit approval ID, signal, version, scope, `production_read` capability, approval state/time/owner and exact lookup; DI-1 creates no approval. The shadow repository accepts only hash-identified `shadow_only` observations and exposes no production read.

Permanent tests prove deterministic admission/identity, timing/as-of checks, rights and secrets failure closure, registry/ledger exactness, Provider Health isolation, production-path import absence and unavailable production reads. This is the strongest zero-dependency boundary feasible without inventing the later production adapter: production invariance follows from the DI directory being absent from the executable build dependency graph, and deterministic build equality verifies the deployable bytes remain unchanged apart from build provenance.

## 21. Explicit exclusions and unresolved evidence

No application/model/minutes/fixture/captain/XI/bench/transfer/simulation/rank/league/provider/Understat/Odds/collector/DATA-S2B/D1/Cloudflare/security/UI behaviour changed. No provider or accuracy claim is approved. DI-1 implements contracts and tests only.

Open evidence questions: the accepted DATA-S2B read interface; availability of true publication timestamps; samples per domain; product language for near ties; any utility for rollover/chips/strategy; Understat/Odds evaluation rights; and whether availability sources show timestamp quality, independence and coverage. These are not DI-0 stop conditions.

## 22. Owner decision required

**RECOMMENDATION:** review and, if satisfied, approve merge of **DI-1 — Shadow Intelligence Platform** exactly within section 18.

Merge would not authorise DI-2, any provider, live capture/storage, D1/Cloudflare/DATA-S2B modification, production read/model/calculation/weight, rights/security policy change or product behaviour.
