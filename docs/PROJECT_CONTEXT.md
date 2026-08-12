# PROJECT_CONTEXT.md

## 12 August 2026 — canonical current state

Live GitHub is authoritative over this document and all historical handovers.

Latest merged `main` is `58b834a1824c4977a442e7b3e309e2bbf3d05da1`, merge of **GW1-P1 — Cloudflare Evidence Foundation** PR #118. GW1-P1 is complete and merged. Its final reviewed head `7b739e5e6d68775da04d179346269ae295c1332a` passed Verify Teamsheet #251 / `31526697241` with **883/883 tests** and deterministic/provenance/build-identity gates.

The active application candidate is **GW1-P2 — Browser Evidence Delivery + Durable Outbox**, draft PR #119 on `claude/gw1-p2-evidence-delivery-design-ejsb0d`, exact head `252c5eba0381c8aa5afb7bda1686dd102326c6df`. Verify Teamsheet #255 / `31537859087` passed on that head with **931/931 tests**, no failures/skips/cancellations, deterministic production build and provenance/build-identity gates.

GW1-P2 is implementation-complete as a candidate but **acceptance-incomplete**. It remains draft and unmerged. Cloud custody is a one-way side effect and the recommendation path must not read, wait for or fail because of the archive.

### Owner-performed live acceptance preparation

Recorded physical iPhone Safari / live Cloudflare preparation proves only these paths:

- Cloudflare Access `Bypass OPTIONS requests to origin` was enabled and saved for `teamsheet-evidence-archive`.
- No Access-layer allowed-origin response was configured; the Worker remains the sole owner of exact-origin CORS.
- GitHub Pages was temporarily served from the PR #119 branch and observed built, then restored to `main` and observed built.
- Settings → Evidence showed the expected pre-window state: evidence not due, no saved snapshots and `Nothing waiting`.
- current Teamsheet-owned data was approximately **546.2 KB** in that session.
- top-level Safari Cloudflare Access authentication succeeded.
- protected `GET /v1/health` returned `{"ok":true,"archiveVersion":"1.0.0","schemaVersion":"1.0.0","migrationVersion":1}`.

This does **not** prove the decisive cross-site application transport. The browser storage estimate shown during the session is not a usable quota guarantee.

### Remaining GW1-P2 gate

The genuine Stage 10 window opens **20 August 2026 at 18:30 BST**. The remaining acceptance question is whether normal physical iPhone Safari, with **Prevent Cross-Site Tracking ON**, can automatically perform the credentialled cross-site background upload from GitHub Pages to the Access-protected evidence Worker, then retain correct archive/reload/idempotency/canonical-hash behaviour.

If Option A fails under normal Safari privacy settings, stop. Do not make disabling Prevent Cross-Site Tracking a product requirement and do not implement Option B or Option C without a separate evidence-led comparison and explicit approval.

## Immediate sequence

1. Canonical documentation reconciliation — this checkpoint.
2. **GW1 Readiness Audit — investigation only**.
3. Only genuine blocker fixes, each separately approved.
4. Physical rehearsal and code freeze.
5. Live GW1-P2 acceptance when the real Stage 10 window opens.
6. GW1 operations and prospective evidence collection.

The first relevant 2026/27 international break is **GW5 → GW6**, not GW2 → GW3. Treat GW1–GW5 as the initial stability/prospective-evidence period and the GW5 → GW6 break as the first major evidence-led review opportunity, subject to evidence actually available. This planning correction does not authorise model/provider changes.

## Product and technical invariants

Teamsheet remains a polished, fast, mobile-first FPL decision desk. Preserve vanilla JavaScript ES modules, the zero-dependency toolchain, Node built-in tests/custom bundler, deterministic builds, GitHub Pages/single-file deployment, graceful optional-provider fallback and iPhone usability unless separately approved.

No model, expected-minutes, fixture, scoring, captaincy, squad, transfer, optimiser, simulation, rank, Mini-League/rival, provider acquisition/weighting, Understat/Odds repair, Worker behaviour, D1/R2 schema, evidence canonicalisation or hosting change is authorised by this documentation checkpoint.

Historical records remain valid for their recorded dates; they must not be read as current status where this section or live GitHub says otherwise.
