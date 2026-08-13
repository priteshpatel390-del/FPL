# Research — External Repositories

Status: **Research complete**  
Programme root: [External Intelligence Foundation](../../EXTERNAL-INTELLIGENCE-FOUNDATION.md) §§7–8, 14  
Control centre: [Research Programme](../README.md)  
Production effect: **None**  
Implementation approval: **Not granted**  
Research date: **13 August 2026**

## 1. Research question

What can credible public football/FPL repositories teach Teamsheet about modelling, optimisation, data contracts, testing, identity and edge cases without importing incompatible assumptions, unclear rights or unnecessary dependencies?

## 2. Current Teamsheet behaviour

Teamsheet remains a Vanilla JavaScript ES-module application with a zero-dependency production toolchain, Node built-in tests/custom bundler, deterministic single-file GitHub Pages deployment, provider-neutral contracts, graceful optional-provider fallback and separate model/provider approval gates.

No repository researched here is a Teamsheet dependency, approved provider or evidence of superior predictive accuracy.

## 3. Why this matters

Prior art can expose useful state models, data contracts, tests and edge cases before Teamsheet reinvents them. But repository sophistication, popularity or mathematical formalism does not prove better FPL decisions.

The correct use of external repositories is to learn **concepts, contracts, tests and failure modes**, then independently evaluate any promising idea under Teamsheet's evidence and approval rules.

## 4. Candidate sources / repositories / approaches

Required repositories researched:

- [`alan-turing-institute/AIrsenal`](https://github.com/alan-turing-institute/AIrsenal)
- [`solioanalytics/open-fpl-solver`](https://github.com/solioanalytics/open-fpl-solver)
- [`amosbastian/understat`](https://github.com/amosbastian/understat)
- [`openfootball/football.json`](https://github.com/openfootball/football.json)
- [`vaastav/Fantasy-Premier-League`](https://github.com/vaastav/Fantasy-Premier-League)
- [`jeppe-smith/fpl-api`](https://github.com/jeppe-smith/fpl-api)

One additional repository was justified:

- [`martgra/fpl-timeseries-data`](https://github.com/martgra/fpl-timeseries-data) — stale as an active source, but useful prior art for timestamped immutable upstream snapshots.

No additional repository was added merely to increase list size.

## 5. Exact fields or observations required

For each repository the research assessed:

- purpose/category;
- language/runtime/dependencies;
- software licence and separate upstream-data rights;
- meaningful activity/maintenance state as of the research date;
- tests/documentation;
- data/provider dependencies;
- FPL rule/state assumptions;
- useful algorithms/contracts/tests/edge cases;
- identity/mapping approach;
- historical/replay assumptions;
- architectural compatibility with Teamsheet;
- whether a finding is useful as a concept, data source, code candidate or not suitable.

## 6. Coverage

Research findings by repository:

### AIrsenal

Richest broad-system prior art. Useful concepts include pre-target historical training, team/player decomposition, promoted-team treatment, persistent identity/state, transfer/chip planning, replay tooling and extensive tests. It uses a Python/database/probabilistic-modelling ecosystem that is not directly compatible with Teamsheet's production architecture.

### Open FPL Solver

Strongest optimiser-state prior art. It explicitly models multi-period squads, five-transfer rollover, hits, bank/selling value, captaincy, ordered bench and chips with a mathematical solver. Its objective also embeds heuristic values for resources such as free transfers/bank and future discounting, so solver optimality is conditional on those assumptions and input projections.

### amosbastian/understat

Useful API-wrapper/test prior art. A material provider API change required the wrapper and tests to change, reinforcing the need for encapsulated provider contracts, schema tests and graceful failure. Wrapper maintenance does not approve Understat as a Teamsheet provider.

### openfootball/football.json

Useful simple fixture/result schema and calendar-contract prior art. It does not solve player identity, minutes, availability or expected-minutes questions.

### vaastav/Fantasy-Premier-League

Most practically valuable historical FPL dataset reviewed. Useful for outcomes and lagged features, but Gameweek organisation is not equivalent to decision-time provenance; its documented `xP` caveat is a concrete example of lookahead risk.

### jeppe-smith/fpl-api

Useful typed endpoint/schema boundary prior art, but stale activity and npm-oriented dependency assumptions make direct adoption unattractive for Teamsheet.

### martgra/fpl-timeseries-data

Useful snapshot-custody concept: preserve successive timestamped upstream states rather than relying only on later consolidated season data. Stale project/activity means it is not proposed as a current source/dependency.

## 7. Freshness / update cadence

Repository activity, APIs, licences and FPL rules are time-sensitive. Research date is 13 August 2026.

Before any implementation proposal, re-verify:

- current repository head/release/activity;
- current licence text;
- FPL transfer/chip/scoring rules;
- provider contracts;
- dataset field/update policy;
- upstream rights/terms.

Research-time activity counts or stars/forks are contextual only and must not be treated as quality evidence.

## 8. Reliability

Reliability findings:

- AIrsenal has broad tests and active maintenance, but its modelling choices/parameters are not Teamsheet validation evidence;
- Open FPL Solver has formal state/constraint modelling, but solver correctness and objective sophistication do not prove predictive or decision superiority;
- Understat wrapper maintenance demonstrates provider-contract drift rather than provider reliability;
- vaastav is strong historical infrastructure but includes fields whose timing semantics can be unsafe;
- fpl-api's older activity makes schema freshness uncertain;
- martgra is useful architecture prior art but stale as an operational source.

Popularity/stars/forks are not treated as correctness evidence.

## 9. Historical availability

External repositories can provide useful historical outcomes/state structures, but each historical field still requires temporal-provenance review.

AIrsenal's replay/state approach, vaastav's season/GW archives and martgra's timestamped snapshots are useful for different reasons. None automatically reconstructs the complete current Teamsheet production information bundle at historical deadlines.

Repository commits/tags used for future implementation evidence should be pinned where feasible.

## 10. Cost / free-tier constraints

Repository access may be free while required solvers, package registries, APIs or upstream data are not. Teamsheet cannot assume npm/Python package-registry availability or introduce production dependencies without separate architectural approval.

No paid provider, solver service or hosted dependency is approved by this research.

## 11. Rights / licensing / retention

Research distinction:

- **AIrsenal:** MIT software licence; upstream data/provider rights remain separate.
- **Open FPL Solver:** inspected project licensing is materially ambiguous because Apache-2.0 text coexists with additional commercial-use wording. **Do not copy code unless clarified.**
- **amosbastian/understat:** MIT wrapper code; no automatic grant of Understat data rights.
- **openfootball/football.json:** CC0 repository material, but third-party/upstream rights still require care.
- **vaastav/Fantasy-Premier-League:** MIT software; repository explicitly distinguishes upstream FPL/Understat data ownership.
- **jeppe-smith/fpl-api:** MIT software; FPL API data rights remain separate.
- **martgra/fpl-timeseries-data:** Apache-2.0 software; FPL snapshot rights remain a separate question.

General rule: **permission to inspect/learn is not the same as permission to copy code, and software licence is not the same as data licence.** Ambiguity means do not copy or retain data until clarified.

## 12. Security / privacy

Do not import account-write flows, credential handling, telemetry, server/database assumptions or new network dependencies from external projects without separate security review.

Any useful provider/data concept must preserve Teamsheet's rule that secrets never reach client-side application code and optional providers fail gracefully.

## 13. Canonical identity / mapping requirements

Strong reusable lesson: use canonical IDs and explicit crosswalks, not name-only joins.

AIrsenal's persistent identity/alternate-name handling and vaastav's stable FPL identity are useful prior art. Historical team/player membership must be effective-date aware so current mappings are not projected backwards.

## 14. Proposed provider-neutral / shadow contract

Useful external concepts must be translated into Teamsheet's own provider-neutral/shadow contracts rather than importing repository-specific schemas wholesale.

Examples of compatible concepts:

- immutable source/version/checksum;
- canonical IDs/crosswalks;
- fixture/calendar normalisation;
- rule-versioned decision state;
- timestamped raw shadow observations;
- predeclared ablations and no-transfer baselines.

No production shadow store is approved here.

## 15. Fallback behaviour

No external repository is required for production. If a repository disappears, becomes stale, changes licence or conflicts with Teamsheet constraints, production remains unchanged.

Any future adopted concept must retain an independent Teamsheet fallback and must not make production availability depend on research-only infrastructure.

## 16. Failure modes

Material risks include:

- copying licence-ambiguous code;
- assuming software licences grant data rights;
- importing stale FPL rules;
- importing package/runtime dependencies incompatible with Teamsheet;
- believing solver/model sophistication proves accuracy;
- adopting heuristic objective weights as facts;
- using historical evaluations with hindsight leakage;
- name-only identity joins;
- importing authenticated account-write behaviour;
- treating maintained wrappers as provider-quality evidence;
- importing a full external architecture for a concept that can be independently represented more simply.

## 17. Double-counting / leakage risks

External projects may train/evaluate under information assumptions different from Teamsheet's. Their reported model results must not be repeated as Teamsheet accuracy evidence unless the methodology, prediction origin and input availability are reproduced honestly.

Specific rejected patterns include same-GW `xP`, full-season feature leakage, future-minute backtests, closing Odds substituted for deadline Odds and parameters/objectives tuned on the period being reported.

## 18. Validation / ablation plan

Promising concepts must be independently evaluated against Teamsheet's current baseline and evidence contracts.

Research classification:

- **GREEN / conceptually compatible:** immutable source refs/checksums, canonical IDs/crosswalks, rolling-origin evaluation, rule-versioned transfer-state tests, no-transfer baselines, predeclared ablation, fixture normalisation.
- **AMBER / adaptation and evidence required:** multi-GW planning, five-FT state/value modelling, scenario analysis, structural probabilistic team strength, promoted-team priors, richer expected-minutes evidence, persistent raw shadow archives.
- **RED / incompatible or unjustified:** direct AIrsenal Python/database runtime, direct HiGHS/Pandas solver runtime, authenticated FPL account-write flows, name-only joins, retrospective closing Odds, same-GW `xP`, copying licence-ambiguous Open Solver code or replacing Teamsheet's optimiser merely because another solver is mathematically sophisticated.

## 19. Required tests

Any later independent adoption should require focused tests for:

- Teamsheet FPL-rule equivalence and historical rule versioning;
- canonical identity/crosswalk correctness;
- deterministic behaviour/build preservation;
- dependency/security boundaries;
- provider/schema failure and fallback;
- state transitions for FT/bank/selling value/hits/chips where relevant;
- temporal provenance and leakage prevention;
- paired baseline/ablation identity;
- licence/provenance records for copied/adapted material, if any.

## 20. Evidence required before production use

External prior art is not production evidence.

A future production proposal requires:

1. a concrete Teamsheet problem/hypothesis;
2. compatible rights and architecture;
3. independent Teamsheet implementation/design rather than blind copying;
4. appropriate historical/prospective evaluation;
5. explicit fallback and security boundaries;
6. the normal provider/model/optimiser approval package where applicable.

No external repository inspected provides directly comparable untouched out-of-sample evidence proving it would outperform Teamsheet under Teamsheet's information constraints.

## 21. Current recommendation

**Research complete.** Preserve the following as the highest-value research leads:

1. expected-minutes calibration using Teamsheet's own prospective evidence;
2. temporal-provenance/timestamped-snapshot methodology;
3. structural team-strength research, including promoted-team cold starts;
4. explicit transfer-state/multi-GW research covering free transfers, bank, selling value, hits and robustness;
5. predeclared paired ablations as timestamped provider/workload/availability evidence becomes available.

AIrsenal is the richest broad-system prior art; Open FPL Solver is the richest optimiser-state prior art; vaastav is the most useful historical FPL dataset reviewed; martgra contributes the strongest snapshot-custody concept. Understat/openfootball/fpl-api are principally useful for provider boundaries, schemas, identity and test design.

Do not copy external code or assumptions merely because they are sophisticated or popular.

## 22. Explicit implementation approval gate

This research authorises **no** dependency, copied code, provider, dataset, solver, optimiser, model, expected-minutes, structural-strength, shadow-store or recommendation change.

Every future proposal must identify the exact external concept/source, current re-verified licence/rights/activity, Teamsheet-compatible design, evaluation method, fallbacks, security implications and tests, then receive separate owner approval before implementation.