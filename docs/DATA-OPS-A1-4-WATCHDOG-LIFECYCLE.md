# DATA-OPS A1.4 — Persistent Incident Lifecycle + Independent Watchdog

## Current status — 10 September 2026

**Repository correction candidate: draft PR #242. Not deployed, not provisioned and not live-accepted under this corrected architecture.**

PR #240 is merged on `main` as `e358982baef10911c51c00393e02a223716e7943` and established the persistent incident lifecycle/watchdog foundation. PR #242 is the owner-approved simplification and clock correction before live activation. It replaces the old design assumptions of two A1.3 opportunities, five-hour GitHub delivery grace and four watchdog checks per day.

The incident lifecycle, notification deduplication/retry, bounded evidence processing, isolated watchdog state and no-repair boundary remain. What changes is how A1.4 knows which automatic A1.3 run belongs to the day.

## Owner-approved daily chain

The intended automatic operating model is now:

```text
01:17 UTC  Cloudflare DATA-S2C dispatcher
            -> one Official FPL collection opportunity
            -> existing same-day guard remains

04:17 UTC  Cloudflare A1.3 observer dispatcher
            -> one fixed GitHub workflow_dispatch to main
            -> durable receipt with exact workflow_run_id
            -> existing A1.3 read-only observer

04:47 UTC  Cloudflare A1.4 watchdog
            -> read exact 04:17 receipt
            -> GET exact receipt-proven GitHub run only
            -> classify heartbeat / incident lifecycle
            -> owner email only when lifecycle policy requires it
```

There is no automatic 02:17 or 03:17 collection fallback, no 08:17 observer opportunity and no 05:17/11:17/17:17/23:17 watchdog schedule in the corrected design.

A failed 01:17 collection is observed later and, if recovery is required, uses the existing attended/manual recovery path. A1.4 gains no power to collect, retry, rerun, repair, deploy or mutate production.

## The trust problem A1.4 must solve

The A1.3 GitHub workflow now uses `workflow_dispatch` both for the automatic Cloudflare invocation and for attended manual diagnostics. Therefore the raw GitHub event name is not enough to prove that a run represents the automatic 04:17 opportunity.

A1.4 must not trust:

- a run merely because it is near 04:17;
- actor identity;
- the newest run in GitHub history;
- an ordinary manual `workflow_dispatch`;
- a timestamp-based candidate match;
- a run discovered by scanning history after the expected one is missing.

Instead, automatic provenance comes from an isolated Cloudflare-created receipt.

## Observer clock receipt boundary

A1.3's new `teamsheet-data-steward-observer-dispatcher` owns the separate D1 database `teamsheet-data-steward-observer-clock`. For the exact 04:17 logical opportunity it atomically inserts one claim, sends at most one fixed GitHub workflow dispatch, and finalizes the receipt only when the outcome is known.

The receipt schema contains only:

- exact opportunity timestamp;
- exact cron identity;
- closed dispatch state (`CLAIMED`, `DISPATCHED`, `FAILED`, `AMBIGUOUS`);
- exact GitHub workflow run ID only for `DISPATCHED`;
- closed reason code;
- claimed/finalized timestamps.

It contains no Official FPL data, application/model data, provider payload or owner data.

The dispatcher's D1 is deliberately separate from A1.4's incident D1. The observer dispatcher cannot write `watchdog_incidents`, `watchdog_notifications`, heartbeat observations or any other A1.4 state. Conversely A1.4 receives no dispatch credential and its adapter for the receipt D1 is SELECT-only.

## Exact-run evidence path

At the 04:47 watchdog firing, `controller.scheduledTime` identifies that logical watchdog event. The watchdog derives the paired 04:17 opportunity from that logical scheduled instant, not from a potentially delayed wall-clock execution time.

A1.4 reads exactly one receipt by exact `opportunity_at`. If it is `DISPATCHED`, the watchdog reads only the receipt's exact `workflow_run_id` from GitHub. The run must prove all of the following:

- exact run ID;
- workflow name `Data Steward Read-Only Observer`;
- workflow path `.github/workflows/data-steward-readonly-observer.yml@main`;
- raw event `workflow_dispatch`;
- head branch `main`;
- valid 40-character head SHA;
- structurally valid run/job state.

Only then can the existing observer summary semantic contract classify the run. No recent-run list is searched in the active automatic path.

For storage compatibility inside A1.4's existing watchdog D1, a receipt-proven automatic run is persisted as logical `source_kind='scheduled_run'` and `event_type='schedule'`. That is **logical automatic provenance**, not a claim that GitHub's raw event field was `schedule`. The evidence hash records both the receipt provenance and the raw `workflow_dispatch` event.

## Manual runs cannot satisfy the heartbeat

This is a load-bearing acceptance rule. An owner can still manually dispatch the A1.3 workflow, but that run has no Cloudflare receipt for the 04:17 opportunity. A1.4 therefore does not read it when judging the daily automatic heartbeat.

If the 04:17 receipt is absent, `CLAIMED`, `FAILED` or `AMBIGUOUS`, the watchdog does not search for a replacement run. At the 04:47 deadline that opportunity is missing/incomplete and enters the normal incident lifecycle.

A rerun of the **same receipt-proven workflow run** is different: GitHub keeps the same run ID and increments `run_attempt`, so A1.4 can continue to recognise it as the same automatic execution while preserving attempt-level evidence.

## Thirty-minute delivery tolerance

The old five-hour grace existed because GitHub Actions was acting as the unreliable scheduling clock. Cloudflare now owns the automatic clock, so that justification is gone.

The corrected repository uses `OBSERVER_DELIVERY_TOLERANCE_MS = 30 minutes`. The semantics are explicit:

- before 04:47, absence or in-flight evidence is `PENDING`;
- at 04:47 or later, absence is `MISSING`;
- at 04:47 or later, still-in-flight evidence is `OBSERVER_HEARTBEAT_INCOMPLETE`;
- a decisive success, failure, skip or malformed/contradictory summary is classified immediately whenever it is observed;
- a genuine successful observation remains healthy until the next day's opportunity; there is no age-based decay.

Thirty minutes is an owner-approved operational tolerance in this repository candidate, not an empirically proven Cloudflare service-level guarantee. Live acceptance must verify that it is practical; changing it later requires evidence and a deliberate decision rather than silently widening it back to hours.

## Legacy attribution code

PR #240 introduced set-based time attribution because two GitHub-scheduled A1.3 opportunities had overlapping five-hour windows. That problem no longer exists in the active architecture.

The old attribution helper/modules may remain temporarily in the repository as historical regression code while PR #242 is reviewed, but **they are not authoritative in the new automatic path**. `run-watchdog.mjs` now uses receipt-proven exact run identity. No production decision may fall back from a missing/ambiguous receipt to the legacy timestamp matcher.

A later cleanup may remove the dead compatibility machinery only after tests prove nothing still relies on it. This PR does not weaken tests merely to erase history.

## Bootstrap correction

Under the previous implementation a newly deployed watchdog could bootstrap after an already-passed opportunity and intentionally ignore it. With one paired 04:17/04:47 chain, the first legitimate watchdog firing should evaluate the observer opportunity it exists to check.

The corrected orchestrator seeds its bootstrap boundary from the 04:17 opportunity paired with the first 04:47 logical firing. Therefore the first valid 04:47 watchdog cycle can report that same day's 04:17 as healthy, failed or missing rather than silently starting tomorrow.

## Lifecycle and notification behavior retained

The existing persistent incident model remains the operational memory:

- deterministic incident fingerprint by closed problem class/component;
- `NEW`, `CHANGED`, `RECOVERED`, `REOPENED`, reminder/none behavior from the existing reducer/notification policy;
- decisive evidence provenance persisted with run ID, run attempt and head SHA where evidence exists;
- one atomic scheduled-event claim keyed by `controller.scheduledTime` to prevent duplicate concurrent processing;
- notification idempotency reservation before email delivery;
- failed email delivery recorded and retried through the same reservation on a later cycle;
- bounded retention that does not delete active incident evidence.

A duplicate delivery of the same logical 04:47 scheduled event is not an error and does no second work. A genuine D1/config/runtime failure propagates so Cloudflare can record the Cron invocation as failed; it is not converted into a false successful cycle.

## Independent problem classes retained

`OBSERVER_HEARTBEAT` remains the problem about whether the expected automatic observer execution itself is healthy.

`GITHUB_EVIDENCE` remains a separate problem for inability to validate a receipt-proven exact GitHub run. An unavailable GitHub read never becomes proof that the observer was healthy.

Clock-D1 configuration/read failures are runtime failures, with closed reasons such as `WATCHDOG_CLOCK_DB_UNAVAILABLE` or `WATCHDOG_CLOCK_RECEIPT_INVALID`; they are not silently converted into healthy/missing evidence because that would hide a broken trust source.

## Security and authority boundary

A1.4 remains a watchdog, not an agent with repair powers. Its allowed external actions are:

1. GET-only reads of the exact receipt-proven A1.3 GitHub run/job/log;
2. SELECT-only native reads of the isolated observer-clock D1;
3. reads/writes to its **own** `teamsheet-data-steward-watchdog` D1 for watchdog lifecycle state;
4. send an owner notification through the single fixed Cloudflare `send_email` binding.

It has no production D1 binding, no Official FPL credential, no provider credential, no GitHub Actions write credential, no `DATA_STEWARD_OBSERVER_DISPATCH_TOKEN`, no workflow-dispatch POST, no rerun/cancel endpoint, no Cloudflare deployment authority, no route and no public `fetch` handler.

Its GitHub token remains a separate read credential: `DATA_STEWARD_WATCHDOG_GITHUB_TOKEN`.

## Fail-closed windows and limitations

The corrected design deliberately prefers false-negative operational alarms over false healthy states.

A notable distributed edge exists between GitHub acceptance and receipt finalization: GitHub could accept the 04:17 workflow dispatch, then the dispatcher's clock-D1 finalization could fail. The GitHub run may exist, but because no valid `DISPATCHED` receipt proves its automatic provenance A1.4 will not trust it. The owner may receive an alert even though a run exists. This is safer than accepting an unrelated manual run as healthy.

The current exact GitHub path validator expects `.github/workflows/data-steward-readonly-observer.yml@main`, consistent with the reviewed GitHub REST contract. Repository tests can prove strict parsing but cannot prove the live API payload until attended acceptance. If the live API represents the same branch path differently, acceptance must stop and the contract must be corrected with evidence rather than weakened generically.

Exactly-once **external email delivery** is not claimed; the database provides idempotent decision/reservation semantics, while network uncertainty can never prove that an SMTP-like downstream side effect happened exactly once.

## Corrected live activation package

A1.4 should no longer be deployed using the old four-times-daily / five-hour-grace runbook. The owner-approved activation package after merge approval is:

1. Verify exact merged `main`, full repository tests, production build and deterministic build evidence.
2. Provision `teamsheet-data-steward-observer-clock`, apply its one receipt migration and bind the real database only in the attended deployment configuration.
3. Provision the 04:17 observer dispatcher secret with the minimum repository-limited GitHub Actions write permission required for the fixed workflow dispatch. Deploy the dispatcher with exactly `17 4 * * *` and no public route.
4. Provision `teamsheet-data-steward-watchdog` and apply `workers/data-steward-watchdog/migrations/0001_watchdog_foundation.sql`. Configure its fixed owner email binding and separate GitHub read token.
5. Bind A1.4 to both its own lifecycle D1 and the observer-clock D1. The watchdog does not own the clock D1 migration and must use it read-only.
6. Deploy the watchdog with exactly `47 4 * * *` and no public route.
7. Confirm the production DATA-S2C dispatcher has exactly one intended collection opportunity, `17 1 * * *`; do not change collector/provider/model/data contracts during this activation.
8. Run attended positive acceptance over a genuine 04:17 automatic observer: prove Cron event, receipt claim/finalization, exact returned GitHub run, correct observer summary, exact A1.4 evidence and expected no-alert/alert lifecycle result.
9. Run attended negative provenance acceptance: an ordinary manual observer run must not satisfy the automatic heartbeat unless the exact receipt points to that run (which an ordinary manual run will not have).
10. Verify duplicate/ambiguous/failure states fail closed, logs are sanitized, and no secret/live ID/provider body/full fingerprint is exposed.
11. Record the evidence in canonical closeout docs and stop. Do not merge further repository work, expand into A1.5 or add autonomous repair without a new owner gate.

## Rollback

If corrected live acceptance fails:

- remove/disable the 04:47 watchdog Cron;
- remove/disable the 04:17 observer-dispatcher Cron;
- keep the A1.3 GitHub workflow available for attended manual diagnosis;
- do not restore GitHub Actions scheduling as a hidden fallback;
- do not restore 08:17, 02:17 or 03:17 automatically without a new owner decision;
- do not alter provider/model/calculation logic as part of rollback.

## Repository acceptance evidence

PR #242 must not be called implementation-complete until its exact head has passed the repository's full `./run-tests.sh` path, production build and deterministic-build verification required by Teamsheet. GitHub Actions remains the independent exact-head verification environment for this branch.

Test counts/build hashes belong here only after the exact final PR head is green. Until then they are deliberately not claimed.
