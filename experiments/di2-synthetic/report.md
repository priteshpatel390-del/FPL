# di2.synthetic.availability 1.0.0 — shadow evaluation

- Mode: **exploratory**
- Run identity: `4f09a6de150a2631c7404f79649d31c7e1de9691ab5ab937879af9553657b328`
- Manifest hash: `bc25bd0ee1ae5c2a234c24ba88cecacd9959b9e64ba7c1d2f2c7c82125541114`
- Frozen view hash: `dd5452c07cfcc1ba94f39ee83b20b5aec69bfb72e3f53c0d14cadcedc36ed57b`
- Outcome revision: `fixture-outcomes-r1`

## Sample accounting

- Input observations: 11
- Outcomes: 4
- Eligible observations: 7
- Excluded observations: 4
- Warnings: insufficient_sample, excluded_observations, incomplete_candidate_coverage

## Arms

### baseline

Samples: 4/4; incomplete candidate coverage: 0.

| Metric | Version | N | Value |
|---|---:|---:|---:|
| start-brier | 1.0.0 | 4 | 0.2825 |
| minutes-mae | 1.0.0 | 4 | 31.25 |
| minutes-rmse | 1.0.0 | 4 | 32.691742076555 |
| start-calibration | 1.0.0 | 4 | 0.225 |

### baseline-a

Samples: 4/4; incomplete candidate coverage: 2.

| Metric | Version | N | Value |
|---|---:|---:|---:|
| start-brier | 1.0.0 | 4 | 0.2075 |
| minutes-mae | 1.0.0 | 4 | 22.5 |
| minutes-rmse | 1.0.0 | 4 | 26.692695630078 |
| start-calibration | 1.0.0 | 4 | 0.075 |

### baseline-b

Samples: 4/4; incomplete candidate coverage: 3.

| Metric | Version | N | Value |
|---|---:|---:|---:|
| start-brier | 1.0.0 | 4 | 0.278125 |
| minutes-mae | 1.0.0 | 4 | 31.25 |
| minutes-rmse | 1.0.0 | 4 | 32.691742076555 |
| start-calibration | 1.0.0 | 4 | 0.2375 |

### baseline-a-b

Samples: 4/4; incomplete candidate coverage: 3.

| Metric | Version | N | Value |
|---|---:|---:|---:|
| start-brier | 1.0.0 | 4 | 0.210625 |
| minutes-mae | 1.0.0 | 4 | 22.5 |
| minutes-rmse | 1.0.0 | 4 | 26.692695630078 |
| start-calibration | 1.0.0 | 4 | 0.0875 |

## Interpretation boundary

This artifact is shadow-only infrastructure evidence. It creates no production approval, model change, weight, recommendation, or football-accuracy claim.
