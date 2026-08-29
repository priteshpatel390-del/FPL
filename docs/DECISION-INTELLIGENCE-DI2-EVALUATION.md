# DI-2 — Automated Evaluation & Ablation

## Status and boundary

DI-2 is an offline, repository/operator-facing, `shadow_only` evaluation checkpoint. It evaluates explicitly declared candidate arms and creates evidence artifacts. It cannot create a production approval, alter a weight, mutate a model or recommendation, activate a provider, call DATA-S2B, or change application UI. DI-3 remains a separate owner-approved checkpoint.

The implementation is under `src/decision-intelligence/`; it is absent from `build.mjs` and the production dependency graph. The only supplied dataset is deliberately synthetic and supports infrastructure assertions, not a football-accuracy claim. No approved point-in-time DATA-S2B export was available at implementation time, so no real-data parity result is claimed.

## Manifest contract

`di-experiment-manifest-v1` pre-registers identity and exploratory/confirmatory mode; baseline and source revision; registered candidate signal versions, dependencies and overlap risks; cohort and time-ordered split; deadline/as-of rules; outcome source/revision/policy; versioned primary and secondary metrics; explicit arms; sample-warning policy; and code/input lineage. Validation rejects duplicate arms, undeclared signal combinations, unknown registered signal versions, invalid metrics, missing primary metrics, random/unknown time-split types and incomplete lineage.

`freezeEvaluationManifest()` canonicalises, validates, deeply freezes and SHA-256-addresses the manifest before evaluation. Mode is part of identity. Any manifest field change changes the manifest hash. Arms are explicit: the runner never creates the power set or searches for a best combination.

## Frozen point-in-time view

The offline adapter accepts approved fixture/export-shaped observations and outcomes; it does not implement another Official FPL history store. For the exact cutoff it applies deterministic cohort rules; requires declared timing fields; reuses DI-1 eligibility for publication, observation, fetch and expiry clocks; checks effective time when supplied; rejects post-cutoff, expired, unresolved-conflict and outcome-role feature rows; selects only the latest eligible correction; and joins the exact outcome revision only when it became available after the cutoff. The selected view and rejection ledger are canonicalised and hashed.

All arms receive the same outcomes, cohort boundary and view hash. Missing candidate data falls back to the unchanged baseline prediction for that field and is counted as incomplete coverage; a missing baseline excludes that subject from metric pairs and is counted separately. This preserves equal declared outcome cohorts without hiding candidate attrition.

## Metrics, ablation and interpretation

Metric adapters are small deterministic functions rather than a universal score. Version 1 includes Brier score, MAE, RMSE and fixed-edge reliability bins with expected calibration error. Each adapter applies the same explicit missing-pair rule and reports its sample count. Calibration edges must be predeclared and strictly increasing from zero to one.

Reports state arm values and sample accounting only. They do not assign production weights or produce promotion or decision-quality claims. Overlap risks and dependencies remain manifest evidence for later factual interpretation; DI-2 does not infer causal independence from a score change. Decision utility remains deliberately unimplemented because transfer flexibility, competitive policy and other utility semantics require owner approval.

## Deterministic artifacts and reference experiment

Run `node scripts/run-di2-reference.mjs` to write canonical `experiments/di2-synthetic/report.json` and `report.md`. The fixture contains baseline, A, B and A+B arms; eligible observations; a post-deadline correction; expired and missing candidate evidence; an unresolved conflict; an outcome-leakage sentinel; exact outcomes; several metrics; and an intentionally insufficient sample warning. Re-running unchanged inputs and code produces byte-identical files.

Machine-readable lineage includes experiment/version/mode, manifest hash, source commit, evaluation code version, declared input hashes, frozen-view hash, outcome revision and a content-derived run identity. It contains no wall-clock run timestamp.

## Multiple testing and time splits

Candidate arms and primary metrics are frozen before execution; secondary metrics are labelled; total arms and metric counts are reported; and exploratory and confirmatory modes receive distinct identities. DI-2 deliberately uses governance rather than decorative significance correction. Confirmatory evidence should use a later untouched holdout after an exploratory manifest is closed.

Supported declarations are explicit historical windows, later holdouts and rolling/walk-forward contracts. DI-2 validates them but does not train or tune a model. Random train/test splitting is not supported.

## Limitations

- The offline input contract is not an approved DATA-S2B read/export implementation.
- Synthetic evidence proves mechanics only; it says nothing about FPL prediction, transfer or decision accuracy.
- Calibration is fixed-bin descriptive analysis; tiny samples remain visibly sparse.
- The runner does not implement statistical significance, causal attribution, a universal decision score, transfer utility or production promotion.
- Per-subcohort metric breakdowns can be added through a later versioned reporting contract when a real approved dataset demonstrates the necessary domain fields.
