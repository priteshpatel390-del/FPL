# Teamsheet — FPL Decision Desk

Teamsheet is a mobile-first Fantasy Premier League decision app for a manager's complete 15-player squad. It provides an explainable best XI, captaincy and bench order, exact transfer-plan comparisons, fixture planning, and factual Official FPL League context.

## Current repository baseline

The baseline after the merged Repository Truth A1 checkpoint on 8 August 2026 is:

| Item | Evidence |
|---|---|
| GitHub `main` | `cdc3cb709d97b858f29234678e7860baab918b78` — merge of PR #94 |
| Latest substantive application state | PR #92, merge `6f0501ffc0aff368f9a60aae6de0d552ec2c44a5`, exact reviewed head `130b0a298d4b21c2758e3199b9a82e2e3b0fc58f` |
| Automated repository baseline | 667 passed, 0 failed, 0 skipped, 0 cancelled — the unchanged 664 application tests plus three documentation-integrity tests; two byte-identical exact-identity builds; root/deployable equality; exact manifest identity |
| Physical iPhone Safari baseline | Accepted tested paths for Transfers, Player Detail, Team, Fixtures and the Leagues pre-season experience |
| Deliberately deferred | Populated League rank, standings, gaps, rivals, exposure and relevant large-league pagination until Official FPL publishes post-Gameweek data |

The detailed current state and approval boundary live in [Project Context](docs/PROJECT_CONTEXT.md). Historical checkpoint evidence is indexed in [Historical Records](docs/HISTORICAL_RECORDS.md).

## Source, generated output and deployment

- `src/` is the canonical application source. The app uses Vanilla JavaScript ES modules and no runtime framework.
- `app.html` is the source HTML/CSS shell.
- `build.mjs` and `build-utils.mjs` form the zero-dependency deterministic bundler.
- `dist/` and root `index.html` are generated. Never edit them by hand.
- GitHub Pages serves the generated root `index.html`, which must be byte-identical to `dist/index.html`.
- `workers/` contains the separately deployed, allowlisted Cloudflare gateway for read-only Official FPL transport.
- `tests/` uses Node's built-in test runner. `.github/workflows/verify.yml` applies the permanent pull-request verification gate.

## Build and verify

Node 18 or newer is required; no package installation is needed.

```sh
node build.mjs
./run-tests.sh
```

For release verification, provide the exact revision explicitly:

```sh
BUILD_COMMIT="$(git rev-parse HEAD)" ./run-tests.sh
```

The permanent GitHub workflow additionally rebuilds twice, compares every production artefact byte-for-byte, checks root/deployable equality and verifies the manifest commit identity. See [Build & Test](README-BUILD.md) and [Testing](docs/TESTING.md).

## Maintainer reading order

1. [CLAUDE.md](CLAUDE.md) — working rules, current baseline and approval gate.
2. [Project Context](docs/PROJECT_CONTEXT.md) — current product and engineering state.
3. [Architecture](docs/ARCHITECTURE.md) — runtime, build and ownership map.
4. [Decisions](docs/DECISIONS.md) — approved architectural decisions.
5. [Roadmap](docs/ROADMAP.md) — open, proposed and deferred checkpoints only.
6. [Known Limitations](docs/KNOWN_LIMITATIONS.md) — present constraints and deferred evidence.
7. [Teamsheet 2.0 Product Blueprint](docs/TEAMSHEET2-PRODUCT-BLUEPRINT.md) — approved product direction.
8. Before calculation work: [Projection Model](docs/PROJECTION_MODEL.md) and [Testing](docs/TESTING.md).
9. Before provider or security work: [Data Sources](docs/DATA_SOURCES.md) and [Security](docs/SECURITY.md).

## Change discipline

Investigate first, define exact scope and exclusions, obtain owner approval where required, work on a separate branch, run the complete verification gate, open a draft pull request and merge only after explicit approval. Model, provider, fixture, transfer, rank, Mini-League and strategy behaviour have additional evidence gates documented in `CLAUDE.md`.
