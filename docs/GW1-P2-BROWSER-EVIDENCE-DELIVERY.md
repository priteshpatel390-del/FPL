# GW1-P2 — Browser evidence delivery and durable outbox

## Status — 12 August 2026

**Implemented candidate; acceptance incomplete; draft/unmerged.**

- PR: #119 — `GW1-P2 — Browser evidence delivery and durable outbox`
- Branch: `claude/gw1-p2-evidence-delivery-design-ejsb0d`
- Base: `58b834a1824c4977a442e7b3e309e2bbf3d05da1`
- Exact current head: `252c5eba0381c8aa5afb7bda1686dd102326c6df`
- Verify Teamsheet #255 / run `31537859087`: **931 tests, 931 passed, 0 failed, 0 skipped, 0 cancelled**; deterministic production build and provenance/build-identity/output-preservation gates passed.

GW1-P2 connects the existing Stage 10 browser capture path to the merged GW1-P1 evidence archive through a durable local outbox. Cloud custody is a one-way side effect: the recommendation never reads, waits for or fails because of the archive. The canonical Stage 10 record is delivered exactly as stored; delivery must not re-canonicalise, re-hash, strip, restamp or regenerate it.

No model, expected-minutes, fixture, simulation, squad, captaincy, transfer, rank, Mini-League or provider-acquisition behaviour is changed or authorised by this record.

## Proven by repository verification

The current candidate has permanent automated coverage for the durable outbox/delivery state machine, content-hash idempotency, retry/recovery behavior, fail-closed provider retention, exact-origin credentialled CORS contract and the existing deterministic/provenance/build-identity requirements. Automated tests cannot prove Safari/Cloudflare Access cookie behavior in the live cross-site context.

## Owner-performed live acceptance preparation

The following live steps are recorded as owner-performed evidence and must not be generalised beyond the paths stated:

1. Cloudflare Zero Trust Access application `teamsheet-evidence-archive` was opened.
2. **Bypass OPTIONS requests to origin** was enabled and saved.
3. No Access-layer allowed-origin response was configured. The intended architecture remains: Access bypasses only unauthenticated OPTIONS to the origin; the Worker owns exact-origin CORS; POST/GET/admin routes remain Access-protected.
4. GitHub Pages was temporarily switched to the PR #119 branch at `/` and independently observed `built`.
5. Teamsheet was opened in normal physical iPhone Safari. Settings → Evidence showed **Evidence not due yet**, no saved evidence snapshots and **Nothing waiting**, which is expected before an eligible Stage 10 record exists.
6. Non-destructive storage telemetry showed approximately **546.2 KB** of current Teamsheet-owned data in that session. A browser estimate also displayed approximately `0 B used of 39,321.6 MB available`; that estimate is **not** evidence of a usable 39 GB Teamsheet quota and must not be used as a durability guarantee.
7. `Connect evidence archive` was used. Top-level Safari Cloudflare Access authentication succeeded.
8. Protected `GET /v1/health` returned `{"ok":true,"archiveVersion":"1.0.0","schemaVersion":"1.0.0","migrationVersion":1}`.
9. After the partial test Teamsheet still correctly showed **Nothing waiting**, because no eligible Stage 10 record existed.
10. GitHub Pages was restored to `main` at `/` and independently observed `built`.

The health response proves only the recorded top-level Access authentication path, protected Worker reachability and configured archive/D1 migration identity. It does **not** prove the decisive GW1-P2 application transport.

## Remaining decisive acceptance gate

The genuine Stage 10 window opens **20 August 2026 at 18:30 BST**. A real pending Stage 10 snapshot does not exist before that configured window, so the decisive live acceptance must wait.

The required physical sequence is:

1. temporarily deploy PR #119 branch to Pages;
2. use normal Safari with **Prevent Cross-Site Tracking ON**;
3. create a genuine Stage 10 snapshot;
4. confirm local custody and `Waiting to archive`;
5. authenticate if needed and return to Teamsheet;
6. perform **no manual upload action**;
7. observe whether the record automatically becomes `Archived`;
8. reload and verify no incorrect duplicate behaviour;
9. verify server-side canonical identity/hash matches the locally captured record.

Until that sequence succeeds, the credentialled cross-site background POST from `priteshpatel390-del.github.io` to `teamsheet-evidence-archive.fpltsheet.workers.dev` using the Cloudflare Access session is **unaccepted**.

If the test fails under normal Safari privacy settings, stop. Do not disable Prevent Cross-Site Tracking as a product requirement. Do not implement Option B or Option C. Return with an evidence-led Option B versus Option C comparison for separate approval.

## Durable-retention limitation

The bounded outbox remains deliberately conservative. Current device evidence establishes the observed Teamsheet-owned data size in one session, not the usable storage ceiling. Any retention-cap change or persistence-technology change requires a separate proposal; no destructive fill-until-quota test should be performed against real evidence.

## Merge gate

PR #119 must remain **draft and unmerged** until the decisive live transport acceptance succeeds, final exact-head repository verification is green, the PR description/current canonical docs agree, and Pritesh explicitly approves merge.
