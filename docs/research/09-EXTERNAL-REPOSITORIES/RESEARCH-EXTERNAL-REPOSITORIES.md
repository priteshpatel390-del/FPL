# Research — External Repositories

Status: **Planned**  
Programme root: [External Intelligence Foundation](../../EXTERNAL-INTELLIGENCE-FOUNDATION.md) §§7–8, 14  
Control centre: [Research Programme](../README.md)  
Production effect: **None**  
Implementation approval: **Not granted**  
Research date: **TBD**

## 1. Research question

What can credible public football/FPL repositories teach Teamsheet about algorithms, data contracts, tests and edge cases, and which assumptions/licences make reuse inappropriate?

## 2. Current Teamsheet behaviour

Teamsheet has a zero-dependency custom toolchain and its own approved model/provider contracts. No external repository listed here is a production dependency or assumed to be more accurate.

## 3. Why this matters

Prior art can prevent reinventing solved problems, but copying unreviewed code, data schemas or modelling assumptions can import hidden dependencies, licensing issues or incompatible behaviour.

## 4. Candidate sources / repositories / approaches

Initial research subjects preserved from the programme handover:

- `alan-turing-institute/AIrsenal`
- `solioanalytics/open-fpl-solver`
- `amosbastian/understat`
- `openfootball/football.json`
- `vaastav/Fantasy-Premier-League`
- `jeppe-smith/fpl-api`

Additional credible repositories may be added with a research date and reason. Listing is not endorsement or dependency approval.

## 5. Exact fields or observations required

For each repository: licence; last meaningful activity/maintenance; language/dependencies; data assumptions; useful algorithms/contracts/tests; edge cases; FPL rule version; reproducibility; incompatible assumptions; candidate concepts worth independent reimplementation.

## 6. Coverage

TBD per repository: team/player data, fixtures, optimisation, APIs, historical data, chips, transfers, minutes or modelling scope.

## 7. Freshness / update cadence

Record repository commit/tag/date used for research. Re-check activity and licence before any later adoption.

## 8. Reliability

TBD: automated tests, CI, issue activity, reproducibility and documented limitations. Popularity/stars are not evidence of correctness.

## 9. Historical availability

Pin commits/tags used for conclusions where feasible so later reviewers can reproduce what was assessed.

## 10. Cost / free-tier constraints

Repository access may be free while required solvers/providers are not. Record those separately. Do not assume package-registry or hosted-service access.

## 11. Rights / licensing / retention

Exact licence is mandatory before copying code or data. No licence or unclear licence means do not copy. Dataset rights may differ from repository code licence.

## 12. Security / privacy

Do not import credential flows, account-write behaviour, telemetry or network dependencies without separate review.

## 13. Canonical identity / mapping requirements

Compare external schemas to Official FPL canonical identity explicitly; do not inherit name-only mapping assumptions.

## 14. Proposed provider-neutral / shadow contract

Not every repository is a provider. Any useful data/provider concept must still be translated into Teamsheet's provider-neutral/shadow contract rather than imported wholesale.

## 15. Fallback behaviour

No external repository is required for production. If a research subject disappears, current Teamsheet remains unchanged.

## 16. Failure modes

Abandoned code, stale FPL rules, incompatible licences, solver/package dependencies, undocumented data provenance, hidden account writes and assumptions that conflict with Teamsheet.

## 17. Double-counting / leakage risks

Repositories may evaluate models with hindsight or datasets unavailable at decision time. Their reported results must not be repeated as Teamsheet accuracy evidence without reproducing the method honestly.

## 18. Validation / ablation plan

Research concepts independently against Teamsheet invariants and current baselines. Any adopted algorithm/model/data idea needs its own branch-specific validation and approval.

## 19. Required tests

Any later adoption: licence/provenance record, deterministic behaviour, Teamsheet-rule equivalence, dependency/security checks and focused regressions for the adopted concept.

## 20. Evidence required before production use

A concrete useful concept with compatible rights/assumptions, independent Teamsheet implementation evidence and the normal provider/model approval package where applicable.

## 21. Current recommendation

**Planned. Study these repositories for concepts, structures, tests and edge cases; do not copy or depend on them blindly.**

## 22. Explicit implementation approval gate

No dependency, copied code, provider or algorithm change is authorised by this research list. Each requires separate approval.