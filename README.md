# Teamsheet — FPL Decision Desk

Teamsheet is a mobile-first Fantasy Premier League decision desk. The application remains vanilla JavaScript ES modules with the repository's zero-dependency build/test toolchain and GitHub Pages deployment.

## Current repository baseline — 12 August 2026

Latest merged `main` is `58b834a1824c4977a442e7b3e309e2bbf3d05da1`, the merge of **GW1-P1 — Cloudflare Evidence Foundation** through PR #118. PR #118 is complete and merged. Its final reviewed head `7b739e5e6d68775da04d179346269ae295c1332a` passed Verify Teamsheet #251 / run `31526697241`: **883 tests, 883 passed, 0 failed, 0 skipped, 0 cancelled**, plus deterministic build, provenance and build-identity gates.

**GW1-P2 — Browser Evidence Delivery + Durable Outbox** is the active implemented candidate in draft PR #119, branch `claude/gw1-p2-evidence-delivery-design-ejsb0d`, head `252c5eba0381c8aa5afb7bda1686dd102326c6df`. Verify Teamsheet #255 / run `31537859087` passed on that exact head: **931 tests, 931 passed, 0 failed, 0 skipped, 0 cancelled**, plus deterministic production build and provenance/build-identity gates.

GW1-P2 is **not accepted and not merged**. The decisive remaining gate is the physical iPhone Safari credentialled cross-site background upload with **Prevent Cross-Site Tracking ON** once a genuine Stage 10 record can exist. The configured Stage 10 window opens **20 August 2026 at 18:30 BST**. Do not merge PR #119 before that acceptance and final verification.

Current GitHub Pages serves `main` from `/` and has been observed built after the temporary PR #119 acceptance-preparation deployment was restored.

## Planning correction

The first relevant 2026/27 international break is between **GW5 and GW6**, not GW2 and GW3. Pre-GW1 readiness remains the immediate priority; GW1–GW5 is the initial stability/prospective-evidence period; the GW5 → GW6 break is the first major evidence-led review opportunity, subject to evidence actually available. This calendar correction authorises no model, provider, fixture, expected-minutes, scoring or recommendation change.

## Start here

Every development session must read [`CLAUDE.md`](CLAUDE.md) first, then the canonical documents it names. Historical records remain valuable, but current-state sections and live GitHub state take precedence over historical snapshots.

For product context see [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md), architecture see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), current sequencing see [`docs/ROADMAP.md`](docs/ROADMAP.md), and accepted limitations see [`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md).
