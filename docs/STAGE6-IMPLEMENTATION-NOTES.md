# Stage 6 implementation notes

Status: implemented and verified on draft PR #14; awaiting owner review and explicit merge approval.

## Implemented scope
- versioned transfer rules and model/rules version bump
- pure transfer optimiser module
- exact zero-to-three move search with a mandatory roll baseline
- complete squad legality, position quotas and inherited club-quota repair
- exact selling prices where purchase prices are known and explicit estimated affordability otherwise
- pooled bank, free-transfer, hit and next-Gameweek transfer calculations
- per-Gameweek legal best-XI horizon scoring
- unavailable-target exclusion and doubtful-player warnings
- deterministic plan ordering and fail-closed evaluation limit
- production safe pruning with position-feasibility, minimum-cost and partial club-impossibility checks
- independent exhaustive reference search for reduced-pool equivalence tests
- Stage 6 transfer-view integration and dedicated direct-module tests

## Verification
Verified source commit: `5181299c8773c118220bdd8c18e80eb053eaf592`.

- Full `./run-tests.sh`: **254/254 passed**.
- Deterministic two-build comparison: passed for `dist/index.html`, `dist/app.bundle.js` and `dist/manifest.json`.
- Production versus independent exhaustive reference: passed on reduced search pools.
- Null or missing purchase-price regression: passed; current price is used and the result is labelled estimated.
- Search-incomplete behaviour: passed; only the zero-transfer baseline is returned and no partial optimum is claimed.
- Verified generated artefacts committed at `212b071687aa1ec6fc99e2006db824eb99291657`, embedding build identity `f57c5f2d260ab7dc60aac7d5e29d47bb19f44c90` and source hash `de591a1ea580252f140127ed15b9152794eebc82a639b3b091ab9122292e9d6e`.
- Temporary verification workflow removed at `026848dc5b11dded156e0e7fc873d5a457f59067`.

## Deliberate exclusions
No expected-minutes, scoring, calibration, fixture, captaincy, ownership, provider, Wildcard, Free Hit, uncertainty, future-transfer-path or Stage 9 UI formula changed. No prediction-accuracy improvement is claimed.

## Remaining limitations
- Public squad imports may not expose purchase prices, so affordability can be estimated rather than verified.
- The planning horizon holds the resulting squad fixed and does not model later transfers or chips.
- Projections are point estimates; uncertainty and auto-sub simulation remain Stage 8 work.
- The 0.5-point roll value is an explicit judgement parameter, not a validated predictive constant.
- Exact search is bounded by a deterministic evaluation ceiling and fails closed if that ceiling is reached.

Stage 7 must not begin until Pritesh explicitly approves and merges Stage 6.