# Teamsheet — FPL Decision Desk

Teamsheet is a mobile-first Fantasy Premier League decision app for a manager's complete 15-player squad. It provides an explainable best XI, captaincy and bench order, exact transfer-plan comparisons, fixture planning, and factual Official FPL League context. The application remains vanilla JavaScript ES modules with the repository's zero-dependency build/test toolchain and GitHub Pages deployment.

## Current repository baseline — 12 August 2026

Latest merged `main` is `58b834a1824c4977a442e7b3e309e2bbf3d05da1`, the merge of **GW1-P1 — Cloudflare Evidence Foundation** through PR #118. PR #118 is complete and merged. Its final reviewed head `7b739e5e6d68775da04d179346269ae295c1332a` passed Verify Teamsheet #251 / run `31526697241`: **883 tests, 883 passed, 0 failed, 0 skipped, 0 cancelled**, plus deterministic build, provenance and build-identity gates.

**GW1-P2 — Browser Evidence Delivery + Durable Outbox** is the active implemented candidate in draft PR #119, branch `claude/gw1-p2-evidence-delivery-design-ejsb0d`, head `252c5eba0381c8aa5afb7bda1686dd102326c6df`. Verify Teamsheet #255 / run `31537859087` passed on that exact head: **931 tests, 931 passed, 0 failed, 0 skipped, 0 cancelled**, plus deterministic production build and provenance/build-identity gates.

GW1-P2 is **not accepted and not merged**. The decisive remaining gate is the physical iPhone Safari credentialled cross-site background upload with **Prevent Cross-Site Tracking ON** once a genuine Stage 10 record can exist. The configured Stage 10 window opens **20 August 2026 at 18:30 BST**. Do not merge PR #119 before that acceptance and final verification.

Current GitHub Pages serves `main` from `/` and has been observed built after the temporary PR #119 acceptance-preparation deployment was restored.

The detailed current state and approval boundary live in [Project Context](docs/PROJECT_CONTEXT.md). Historical checkpoint evidence is indexed in [Historical Records](docs/HISTORICAL_RECORDS.md).

## Planning correction

The first relevant 2026/27 international break is between **GW5 and GW6**, not GW2 and GW3. Pre-GW1 readiness remains the immediate priority; GW1–GW5 is the initial stability/prospective-evidence period; the GW5 → GW6 break is the first major evidence-led review opportunity, subject to evidence actually available. This calendar correction authorises no model, provider, fixture, expected-minutes, scoring or recommendation change.

## Source, generated output and deployment

- `src/` is the canonical application source. The app uses Vanilla JavaScript ES modules and no runtime framework.
- `app.html` is the source HTML/CSS shell.
- `build.mjs` and `build-utils.mjs` form the zero-dependency deterministic bundler.
- `dist/` and root `index.html` are generated. Never edit them by hand.
- GitHub Pages serves the generated root `index.html`, which must be byte-identical to `dist/index.html`.
- `workers/` contains two separately deployed Cloudflare boundaries: the allowlisted read-only Official FPL gateway and the Access-authenticated GW1-P1 evidence archive.
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

Every development session must read [`CLAUDE.md`](CLAUDE.md) first, then the canonical documents it names. Historical records remain valuable, but current-state sections and live GitHub state take precedence over historical snapshots.

1. [CLAUDE.md](CLAUDE.md) — working rules, current baseline and approval gate.
2. [Project Context](docs/PROJECT_CONTEXT.md) — current product and engineering state.
3. [Architecture](docs/ARCHITECTURE.md) — runtime, build and ownership map.
4. [Decisions](docs/DECISIONS.md) — approved architectural decisions.
5. [Roadmap](docs/ROADMAP.md) — open, proposed and deferred checkpoints only.
6. [Known Limitations](docs/KNOWN_LIMITATIONS.md) — present constraints and deferred evidence.
7. [Teamsheet 2.0 Product Blueprint](docs/TEAMSHEET2-PRODUCT-BLUEPRINT.md) — approved product direction.
8. Before evidence-custody work: [Data Architecture D1](docs/DATA-ARCHITECTURE-D1.md), [GW1-P1 Cloudflare Evidence Foundation](docs/GW1-P1-CLOUDFLARE-EVIDENCE-FOUNDATION.md) and [GW1-P2 Browser evidence delivery](docs/GW1-P2-BROWSER-EVIDENCE-DELIVERY.md).
9. Before calculation work: [Projection Model](docs/PROJECTION_MODEL.md) and [Testing](docs/TESTING.md).
10. Before provider or security work: [Data Sources](docs/DATA_SOURCES.md) and [Security](docs/SECURITY.md).

## Change discipline

Investigate first, define exact scope and exclusions, obtain owner approval where required, work on a separate branch, run the complete verification gate, open a draft pull request and merge only after explicit approval. Model, provider, fixture, transfer, rank, Mini-League and strategy behaviour have additional evidence gates documented in `CLAUDE.md`.
