# ROADMAP.md — current and proposed checkpoints

## 12 August 2026 — current sequence

Latest merged `main` is `58b834a1824c4977a442e7b3e309e2bbf3d05da1`, merge of GW1-P1 PR #118. GW1-P1 is complete and merged.

GW1-P2 is the active implemented candidate in **draft PR #119**, exact head `252c5eba0381c8aa5afb7bda1686dd102326c6df`. Its exact-head Verify Teamsheet #255 / `31537859087` passed **931/931 tests** plus deterministic/provenance/build-identity gates. It is not accepted and not merged.

### Before GW1

1. **Canonical documentation reconciliation** — current docs-only checkpoint.
2. **GW1 Readiness Audit — investigation only** after this reconciliation is merged.
3. Fix only genuine readiness blockers, each under its own approval gate.
4. Physical rehearsal.
5. Code freeze.
6. Perform the decisive GW1-P2 physical iPhone Safari acceptance once a genuine Stage 10 record can exist on **20 August 2026 at 18:30 BST**.
7. Do not merge PR #119 before successful live acceptance, final exact-head verification and explicit owner approval.
8. Operate GW1 and collect prospective evidence.

### GW1-P2 acceptance boundary

Owner-performed preparation has established that Access `Bypass OPTIONS requests to origin` was configured, top-level iPhone Safari Access authentication worked, the protected `/v1/health` route worked, non-destructive storage telemetry was observed, and Pages branch switching/restoration was exercised.

The decisive credentialled cross-site application POST with **Prevent Cross-Site Tracking ON** remains unproven. If it fails, stop and return with an evidence-led Option B versus Option C comparison. Do not disable Safari privacy protection as a product requirement and do not implement either alternative without separate approval.

### Early-season evidence period

The previous planning assumption of a major review after GW2 was incorrect. The first relevant 2026/27 international break is **between GW5 and GW6**.

Therefore:

- pre-GW1 readiness remains the immediate priority;
- **GW1–GW5** is the initial stability and prospective-evidence collection period;
- the **GW5 → GW6 international break** is the first major evidence-led review/improvement opportunity;
- by then Teamsheet may have up to five Gameweeks of prospective evidence, depending on what was genuinely captured and validated.

This timing statement authorises **no** model, fixture, expected-minutes, scoring, provider, squad, captaincy, transfer, optimiser, simulation, rank or Mini-League change. Any such change remains separately approval-gated and evidence-led.

## Completed foundations relevant to the current path

- Teamsheet 2.0 product sequence and A3 engineering remediation are complete through their recorded merged checkpoints.
- Data Architecture D1 was approved as the evidence architecture.
- **GW1-P1 — Cloudflare Evidence Foundation** is complete and merged through PR #118.
- **GW1-P2 — Browser Evidence Delivery + Durable Outbox** is implemented as the current draft candidate but remains acceptance-incomplete.

Historical roadmap entries in other records remain historical snapshots. They must not override this current sequence or live GitHub state.
