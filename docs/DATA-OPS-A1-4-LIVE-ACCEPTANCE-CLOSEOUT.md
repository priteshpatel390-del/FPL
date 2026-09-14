# DATA-OPS A1.4 — Live Acceptance Closeout

## Outcome — 14 September 2026

**LIVE ACCEPTED on the genuine positive healthy path.**

This closeout records the first complete natural automatic chain in which the production collection, A1.3 observer dispatcher, durable observer receipt, exact GitHub observer run, and A1.4 watchdog all executed successfully without manual substitution.

Repository source of truth for the accepted chain was exact `main` commit:

`955427106a13c71f451c1d621f596c206cf28a6f`

No provider, model, fixture, captaincy, squad, transfer, rank, Mini-League, simulation or strategy logic changed as part of this acceptance. No repair authority was added.

## Exact natural chain

### 1. Production Official FPL collection — PASS

The single production DATA-S2 collection opportunity fired naturally at 01:17 UTC on 14 September 2026.

- GitHub workflow run: `34795457856`
- workflow: `DATA-S2 External Production Collection via D1 REST`
- event: `workflow_dispatch`
- branch: `main`
- head SHA: `955427106a13c71f451c1d621f596c206cf28a6f`
- conclusion: `success`
- created: `2026-09-14T01:17:45Z`

The owner-approved single-opportunity collection schedule remained unchanged: `17 1 * * *`.

### 2. A1.3 Cloudflare observer dispatcher — PASS

The corrected A1.3 Worker fired naturally from Cloudflare Cron.

- Worker: `teamsheet-data-steward-observer-dispatcher`
- deployed Worker version: `f0026aab-e21b-48e3-a1e0-93f09534e9dc`
- event type: `scheduled`
- Cron: `17 4 * * *`
- represented scheduled time: `2026-09-14T04:17:40Z`
- outcome: `ok`
- wall time: 2836 ms
- CPU time: 5 ms

This is load-bearing acceptance evidence for PR #243's logical-minute remediation. The natural event again carried a non-zero-second represented scheduled time, but the corrected validator accepted the exact 04:17 UTC minute instead of requiring second zero.

### 3. Durable observer receipt — PASS

The observer-clock D1 contained exactly the expected durable receipt for the logical 04:17 opportunity:

- D1: `teamsheet-data-steward-observer-clock`
- table: `observer_dispatch_receipts`
- `opportunity_at`: `2026-09-14T04:17:00.000Z`
- `cron`: `17 4 * * *`
- `dispatch_state`: `DISPATCHED`
- `github_run_id`: `34805502138`
- `reason_code`: `observer_dispatch_accepted`
- `claimed_at`: `2026-09-14T04:17:44.087Z`
- `finalized_at`: `2026-09-14T04:17:46.660Z`

The receipt proves that the exact GitHub observer run was created by the automatic Cloudflare opportunity rather than by an unrelated manual dispatch.

### 4. Exact GitHub A1.3 observer run — PASS

The receipt-proven GitHub run completed successfully:

- workflow run: `34805502138`
- workflow: `Data Steward Read-Only Observer`
- path: `.github/workflows/data-steward-readonly-observer.yml`
- event: `workflow_dispatch`
- branch: `main`
- head SHA: `955427106a13c71f451c1d621f596c206cf28a6f`
- run attempt: `1`
- created: `2026-09-14T04:17:46Z`
- completed: `2026-09-14T04:18:04Z`
- conclusion: `success`

The observer's sanitized semantic summary was:

- `verdict`: `HEALTHY`
- `evaluationReason`: `HEALTHY_EXPECTED_STATE`
- `heartbeat`: `COMPLETE`
- `escalationRequired`: `false`
- Cloudflare sentinel: `OBSERVED`
- D1 sentinel: `OBSERVED`
- GitHub sentinel: `OBSERVED`

The workflow retained read-only GitHub permissions for Actions, Checks and Contents.

### 5. A1.4 Cloudflare watchdog — PASS

The watchdog then fired naturally at the paired 04:47 opportunity.

- Worker: `teamsheet-data-steward-watchdog`
- natural-event Worker version: `cd73bce0-56b1-4835-b6af-7321021577fa`
- event type: `scheduled`
- Cron: `47 4 * * *`
- represented scheduled time: `2026-09-14T04:47:14Z`
- outcome: `ok`
- wall time: 6341 ms
- CPU time: 23 ms

This resolves the previous 11 and 12 September observation that no watchdog event or invocation was visible in the narrow acceptance windows. The available evidence still does not establish the internal Cloudflare reason for those earlier two misses; it only proves that the 14 September natural opportunity was delivered and executed successfully.

### 6. A1.4 persisted classification — PASS

The watchdog D1 recorded the natural scheduled claim and exact healthy observation.

Scheduled claim:

- `scheduled_time`: `2026-09-14T04:47:14.000Z`
- `claimed_at`: `2026-09-14T04:47:15.061Z`

Observation:

- source kind: `scheduled_run`
- logical event type: `schedule`
- workflow run ID: `34805502138`
- run attempt: `1`
- observed at: `2026-09-14T04:47:15.061Z`
- run created at: `2026-09-14T04:17:46.000Z`
- run completed at: `2026-09-14T04:18:04.000Z`
- opportunity: `2026-09-14T04:17:00.000Z`
- head SHA: `955427106a13c71f451c1d621f596c206cf28a6f`
- health state: `SUCCESS`
- reason code: `OBSERVER_HEARTBEAT_HEALTHY`
- durable evidence hash persisted

The watchdog therefore evaluated the exact receipt-proven run rather than searching for a convenient recent run.

### 7. Healthy-path lifecycle side effects — PASS

Read-only D1 checks after the natural watchdog cycle showed:

- `watchdog_incidents`: no rows
- `watchdog_notifications`: no rows

That is the expected healthy-path behavior: no incident was opened and no owner notification was attempted.

## Acceptance decision

The positive healthy automatic chain is live-accepted:

`01:17 collection -> 04:17 Cloudflare A1.3 -> durable receipt -> exact GitHub observer -> HEALTHY summary -> 04:47 Cloudflare A1.4 -> SUCCESS / OBSERVER_HEARTBEAT_HEALTHY -> no incident -> no notification`

Operational status after this evidence:

- DATA-S2 single daily collection: healthy in this acceptance window
- A1.3 automatic observer scheduling and logical-minute remediation: **LIVE ACCEPTED**
- A1.4 watchdog positive healthy path: **LIVE ACCEPTED**
- combined automatic positive path: **LIVE ACCEPTED**

No live configuration change is required as part of this documentation closeout.

## Limits of this acceptance

This natural run proves the positive healthy path. It does not by itself naturally exercise every negative branch, including missing receipt, ambiguous dispatch, GitHub evidence failure, observer failure, lifecycle opening/reopening/recovery, email delivery failure or notification retry. Those remain bounded by the implemented contracts and repository tests unless separately exercised in a future safe acceptance plan.

The negative provenance rule remains load-bearing: an ordinary manual A1.3 `workflow_dispatch` is not accepted as the automatic heartbeat without the exact Cloudflare-created receipt pointing to that run.

Exactly-once external email delivery is still not claimed. The watchdog retains idempotent database decision/reservation semantics, but downstream delivery uncertainty cannot be eliminated completely.

## Version-provenance note

The 14 September natural watchdog telemetry identifies Worker version `cd73bce0-56b1-4835-b6af-7321021577fa`. An earlier A1.3 attended-deployment report recorded A1.4 as remaining on version `cd6229db-ddbe-443e-a736-76e6fb0e5cec` while also reporting byte-for-byte unchanged A1.4 deployment/configuration snapshots across the A1.3 deployment. The available evidence does not explain that version-ID discrepancy.

It is not an acceptance blocker for the 14 September positive path because the natural Cloudflare event proves the exact watchdog version that actually executed, and the watchdog D1 proves the expected exact-run classification result. Do not invent a causal explanation for the earlier version-ID mismatch without additional Cloudflare evidence.

## Security and authority preserved

The accepted path did not expose or change credential values. The architecture remains:

- A1.3 dispatcher: fixed repository/workflow/ref dispatch only, isolated receipt D1, no public route, no production FPL data authority, no repair path;
- A1.3 observer: read-only GitHub/Cloudflare/D1 observation;
- A1.4 watchdog: exact receipt-proven GitHub reads, SELECT-only observer-clock reads, own lifecycle D1 writes, fixed notification binding only when policy requires it;
- no production D1 write authority for A1.4;
- no provider/model/calculation authority for A1.3/A1.4;
- no automatic retry/repair/rerun/deploy authority.

## Closeout boundary

This document records evidence only. It does not authorize A1.5, autonomous repair, new schedulers, retries, providers, model changes or wider credentials.

The next programme may proceed only under its own scope and approval gate. Runtime changes are not required merely to formalize this successful live acceptance.