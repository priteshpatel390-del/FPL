# Teamsheet — FPL Decision Desk

## Current Stage 10 infrastructure acceptance

GW1-P2C5 is **PASS for the synthetic production infrastructure path only**. One fixed `2099-00`/GW38 incomplete, non-Official fixture traversed the real physical iPhone Safari → production local storage/event/outbox/scheduled-delivery → unchanged Worker → R2 → D1 manifest/accepted receipt → browser `Archived` path. Sanitized read-only reconciliation matched its exact identity, size, stored SHA-256 and R2-first/D1-second custody timestamps. The temporary candidate was then removed from production by restoring authoritative `main`, and PR #143 was closed unmerged. Natural Stage 10 capture, genuine prospective custody and GW2 Official eligibility remain unproven. See [GW1-P2C5 closeout](docs/GW1-P2C5-STAGE10-PRODUCTION-PATH-ACCEPTANCE-CLOSEOUT.md).

## Current same-site transport acceptance

GW1-P2C3B records a **transport-only PASS** on the deployed sibling origins. A real physical iPhone running normal Safari with **Prevent Cross-Site Tracking ON** directly emitted `Sec-Fetch-Site: same-site`; authenticated OPTIONS returned 204, the matching deliberately invalid `{}` POST returned 422, and Safari read `{"error":"envelope_schema"}`. No genuine Stage 10 evidence was sent, so genuine custody, D1/R2 persistence and idempotency remain unproven. See [GW1-P2C3B Same-site transport closeout](docs/GW1-P2C3B-SAME-SITE-TRANSPORT-CLOSEOUT.md).

Rollback paths remain retained. This documentation closeout and the required one-LF `CNAME` normalization change no application or live-infrastructure behaviour.


Teamsheet is a mobile-first Fantasy Premier League decision app for a manager's complete 15-player squad. It provides an explainable best XI, captaincy and bench order, exact transfer-plan comparisons, fixture planning, and factual Official FPL League context. The application remains vanilla JavaScript ES modules with the repository's zero-dependency build/test toolchain and GitHub Pages deployment.

## Current repository baseline

This section describes the tree it lives in. It deliberately does not restate the current `main` commit SHA — GitHub owns that fact and it changes on every merge. Read it live with `git rev-parse origin/main`.

**Repository test baseline: 971 tests, 971 passed, 0 failed, 0 skipped, 0 cancelled**, plus deterministic byte-identical production builds, root/deployable equality, exact build identity and verified committed build provenance. This describes the tree this file lives in; the merged `main` baseline is separately the then-current 907/907 until an approved merge.

The most recent application checkpoint is **GW1 readiness — pre-deadline Transfers safety guard**, delivered on PR #121. Before the first Official FPL deadline of a season the Transfers screen suppresses the weekly free-transfer/hit optimiser and states that initial squad changes are unlimited; the rule is derived from verified Official FPL event data and normal weekly behaviour resumes at the deadline instant. No optimiser mathematics changed. Pritesh physically accepted it on iPhone Safari at head `f72023043813566fe8b11da2d959e374d34bca39`, which passed Verify Teamsheet #262 / run `31583716004`. The preceding GW1 readiness audit found **zero blockers**; the application is suitable for GW1 subject to the separate live-only gates below.

**GW1-P2 — Browser Evidence Delivery + Durable Outbox** is a separate implemented candidate in draft PR #119, branch `claude/gw1-p2-evidence-delivery-design-ejsb0d`, head `252c5eba0381c8aa5afb7bda1686dd102326c6df`. Verify Teamsheet #255 / run `31537859087` passed on that exact head: **931 tests, 931 passed, 0 failed, 0 skipped, 0 cancelled**, plus deterministic production build and provenance/build-identity gates.

GW1-P2 is **not accepted and not merged**, and it is **not a GW1 blocker** — cloud custody is a one-way side effect that the recommendation never depends on. The decisive remaining gate is the physical iPhone Safari credentialled cross-site background upload with **Prevent Cross-Site Tracking ON** once a genuine Stage 10 record can exist. The configured Stage 10 window opens **20 August 2026 at 18:30 BST**. Do not merge PR #119 before that acceptance and final verification. Until then, local Stage 10 capture, recovery and owner-controlled export remain the operating pre-deadline evidence path.

GitHub Pages serves `main` from `/` and was observed built after the temporary PR #121 acceptance-preparation deployment was restored.

The detailed current state and approval boundary live in [Project Context](docs/PROJECT_CONTEXT.md). Historical checkpoint evidence is indexed in [Historical Records](docs/HISTORICAL_RECORDS.md).

Forward research planning for external football information lives in [External Intelligence Foundation](docs/EXTERNAL-INTELLIGENCE-FOUNDATION.md). It is documentation only: it approves no provider, retention, model or calculation change, and it does not alter the pre-GW1 freeze.

## Planning correction

The first relevant 2026/27 international break is between **GW5 and GW6**, not GW2 and GW3. GW1 readiness remediation is complete, so the immediate operating state is pre-GW1 code freeze and operational rehearsal; GW1–GW5 is the initial stability/prospective-evidence period; the GW5 → GW6 break is the first major evidence-led review opportunity, subject to evidence actually available. This calendar correction authorises no model, provider, fixture, expected-minutes, scoring or recommendation change.

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
11. Before any new external-data, provider-evaluation, shadow-evidence or ablation proposal: [External Intelligence Foundation](docs/EXTERNAL-INTELLIGENCE-FOUNDATION.md).

## Change discipline

Investigate first, define exact scope and exclusions, obtain owner approval where required, work on a separate branch, run the complete verification gate, open a draft pull request and merge only after explicit approval. Model, provider, fixture, transfer, rank, Mini-League and strategy behaviour have additional evidence gates documented in `CLAUDE.md`.
