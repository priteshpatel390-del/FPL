# DATA-OPS A1.4 — Persistent Incident Lifecycle + Independent Watchdog

## Current status — 10 September 2026

**Repository clock-correction candidate: draft PR #241. Not deployed, not provisioned and not live-accepted under this corrected architecture.**

PR #240 is merged on `main` as `e358982baef10911c51c00393e02a223716e7943` and established the persistent incident lifecycle/watchdog foundation. PR #241 corrects the automatic A1.3 clock before live activation: Cloudflare owns the 04:17/08:17 observer opportunities, GitHub Actions executes the read-only observer, and A1.4 checks each opportunity 30 minutes later at 04:47/08:47.

The incident lifecycle, notification deduplication/retry, bounded evidence handling, isolated watchdog state and no-repair boundary remain. Production DATA-S2C collection behaviour is explicitly outside this change.

## Approved chain and scope boundary

`teamsheet-data-s2-dispatcher` remains unchanged from `main`, including the approved 01:17, 02:17 and 03:17 UTC dispatch opportunities and the same-day production opportunity guard. PR #241 must not remove, add or reinterpret those production collection opportunities.

The corrected observer/watchdog chain is:

```text
04:17 UTC  Cloudflare A1.3 observer dispatcher
            -> fixed workflow_dispatch to main
            -> durable receipt with exact workflow_run_id
            -> existing read-only observer

04:47 UTC  Cloudflare A1.4 watchdog
            -> read exact 04:17 receipt
            -> GET exact receipt-proven GitHub run only
            -> heartbeat / incident lifecycle

08:17 UTC  Cloudflare A1.3 observer dispatcher
            -> fixed workflow_dispatch to main
            -> durable receipt with exact workflow_run_id
            -> existing read-only observer

08:47 UTC  Cloudflare A1.4 watchdog
            -> read exact 08:17 receipt
            -> GET exact receipt-proven GitHub run only
            -> heartbeat / incident lifecycle
```

A1.4 gains no power to collect, retry, rerun, repair, deploy or mutate production.

## Why the trust model changes

The old five-hour grace existed because GitHub scheduled workflows were acting as the automatic timer and were observed arriving hours late. With both 04:17 and 08:17 opportunities, those five-hour windows overlapped and forced set-based time attribution.

The corrected architecture removes GitHub scheduling entirely. A1.3's GitHub workflow uses `workflow_dispatch` for both Cloudflare-created automatic executions and attended manual diagnostics, so the raw GitHub event name is not sufficient provenance. A1.4 therefore trusts an automatic run only when the isolated Cloudflare clock ledger names its exact workflow-run ID.

A1.4 must not trust actor identity, timestamp proximity, the newest run, a manual `workflow_dispatch`, a time-based candidate match, or a history search performed because expected evidence is missing.

## Observer-clock receipt boundary

`teamsheet-data-steward-observer-dispatcher` owns the separate D1 database `teamsheet-data-steward-observer-clock`. For each exact 04:17 or 08:17 opportunity it atomically claims one row, sends at most one fixed GitHub dispatch, and finalizes that row only after classifying the response.

The receipt contains only:

- exact opportunity timestamp;
- exact Cron identity (`17 4 * * *` or `17 8 * * *`);
- closed dispatch state (`CLAIMED`, `DISPATCHED`, `FAILED`, `AMBIGUOUS`);
- exact GitHub workflow-run ID only for `DISPATCHED`;
- closed reason code;
- claim and finalization timestamps.

The ledger contains no Official FPL data, application/model data, provider payload or owner data.

The dispatcher D1 is deliberately separate from A1.4's lifecycle D1. The dispatcher cannot write watchdog incidents/notifications/observations. A1.4 receives no dispatch credential and accesses the clock D1 through a SELECT-only native binding.

## Exact-run evidence path

At 04:47 and 08:47, `controller.scheduledTime` identifies the logical watchdog event even if Cloudflare delivers the invocation later. `latestExpectedOpportunity()` derives the paired 04:17 or 08:17 opportunity from that logical scheduled instant rather than using delayed wall-clock time to choose a different opportunity.

A1.4 reads exactly one receipt by exact `opportunity_at`. Only a `DISPATCHED` receipt supplies a trusted run ID. The exact GitHub run must prove:

- exact receipt-proven run ID;
- workflow name `Data Steward Read-Only Observer`;
- workflow path `.github/workflows/data-steward-readonly-observer.yml@main`;
- raw event `workflow_dispatch`;
- head branch `main`;
- valid 40-character head SHA;
- structurally valid run/job state.

Only then does the existing sanitized observer-summary contract classify the run. The active automatic path never searches recent GitHub run history.

For compatibility with the existing A1.4 D1 schema, a receipt-proven automatic run is stored as logical `source_kind='scheduled_run'` and `event_type='schedule'`. That is logical automatic provenance, not a claim that GitHub's raw event was `schedule`; the evidence hash also records the raw `workflow_dispatch` event.

## Manual runs cannot satisfy an automatic heartbeat

An attended manual A1.3 run has no Cloudflare clock receipt for either expected opportunity. A1.4 therefore does not read or substitute it when judging automatic health.

If a receipt is absent, `CLAIMED`, `FAILED` or `AMBIGUOUS`, the watchdog does not search for a replacement. At the paired 30-minute deadline the opportunity is missing/incomplete and enters the normal incident lifecycle.

A rerun of the same receipt-proven run remains attributable because GitHub keeps the same workflow run ID and increments `run_attempt`.

## Thirty-minute delivery tolerance

`OBSERVER_DELIVERY_TOLERANCE_MS` is exactly 30 minutes. For either opportunity:

- before the paired 04:47/08:47 deadline, absence or in-flight evidence is `PENDING`;
- at the deadline or later, absence is `MISSING`;
- at the deadline or later, still-in-flight evidence is `OBSERVER_HEARTBEAT_INCOMPLETE`;
- decisive success, failure, skip or malformed/contradictory summary is classified immediately when observed;
- a successful 04:17 observation remains healthy until 08:17 becomes due;
- a successful 08:17 observation remains healthy until the next day's 04:17 opportunity becomes due.

Thirty minutes is an approved operating tolerance for this repository candidate, not an empirically proven Cloudflare SLA. Live acceptance must verify that it is practical; any later widening requires evidence and a deliberate decision.

## Legacy attribution code

PR #240's set-based matcher solved overlapping five-hour GitHub-schedule windows. Those windows no longer exist: the active automatic path is receipt-proven and the 30-minute 04:17/08:17 windows do not overlap.

Historical attribution helpers may remain temporarily as compatibility/regression code, but they are not authoritative. No production A1.4 decision may fall back from a missing or ambiguous receipt to timestamp matching. Later removal of dead compatibility machinery is a separate cleanup, not part of this activation correction.

## Bootstrap and paired-check behaviour

The first legitimate 04:47 watchdog firing should evaluate its own 04:17 observer opportunity rather than bootstrap past it. The corrected orchestrator seeds its bootstrap boundary from the opportunity paired with that first watchdog event.

The 08:47 firing independently resolves the newer 08:17 opportunity. A healthy 04:17 observation must not mask a missing 08:17 observation once the latter is due.

## Lifecycle and notification behaviour retained

A1.4 retains the PR #240 operational memory and safety properties:

- deterministic incident fingerprint by closed problem class/component;
- existing `NEW`, `CHANGED`, `RECOVERED`, `REOPENED`, reminder/none transitions;
- decisive evidence provenance with run ID, run attempt and head SHA where evidence exists;
- atomic scheduled-event claim keyed by `controller.scheduledTime`;
- notification reservation before email delivery;
- failed-email retry through the same reservation;
- bounded retention that preserves active-incident evidence.

A duplicate firing of the same logical 04:47 or 08:47 event performs no second work. A genuine D1/config/runtime failure is rethrown so Cloudflare can record a failed invocation rather than a false success.

## Independent problem classes retained

`OBSERVER_HEARTBEAT` remains the problem about whether the expected automatic observer execution is healthy.

`GITHUB_EVIDENCE` remains separate and represents inability to validate a receipt-proven exact GitHub run. An unavailable GitHub read never becomes proof of observer health.

Clock-D1 configuration/read failures use closed runtime reasons such as `WATCHDOG_CLOCK_DB_UNAVAILABLE` and `WATCHDOG_CLOCK_RECEIPT_INVALID`; they are not silently reclassified as healthy.

## Security and authority boundary

A1.4 remains a watchdog, not a repair agent. Its allowed external actions are limited to GET-only reads of the receipt-proven GitHub run/job/log, SELECT-only native reads of the observer-clock D1, reads/writes to its own `teamsheet-data-steward-watchdog` lifecycle D1, and owner notification through one fixed Cloudflare `send_email` binding.

It has no production D1 binding, Official FPL/provider credential, GitHub Actions write credential, `DATA_STEWARD_OBSERVER_DISPATCH_TOKEN`, workflow-dispatch POST, rerun/cancel endpoint, Cloudflare deployment authority, route or public `fetch` handler. Its GitHub read token remains `DATA_STEWARD_WATCHDOG_GITHUB_TOKEN`.

## Fail-closed limitations

GitHub may accept a dispatch and the clock-D1 finalization may then fail. The run can exist without a trusted `DISPATCHED` receipt. A1.4 deliberately refuses to infer it as automatic, potentially generating a false-negative alarm rather than a false healthy state.

The exact GitHub path validator expects `.github/workflows/data-steward-readonly-observer.yml@main`, matching the reviewed REST contract. Repository tests prove strict parsing, but live acceptance must confirm the actual payload. If the live API shape differs, activation stops and the exact contract is corrected from evidence rather than weakened generically.

Exactly-once external email delivery is not claimed. D1 provides idempotent decision/reservation state, but downstream network uncertainty cannot prove an external mail side effect occurred exactly once.

## Corrected live activation package

The old four-times-daily/five-hour-grace A1.4 runbook is superseded. After explicit merge approval, the attended activation package is:

1. Verify exact merged `main`, full repository tests, production build, deterministic bytes and build identity.
2. Verify production DATA-S2C remains unchanged with exactly `17 1 * * *`, `17 2 * * *` and `17 3 * * *`; do not change collector/provider/model/data contracts.
3. Provision `teamsheet-data-steward-observer-clock`, apply its one receipt migration, and keep live database IDs outside committed source.
4. Configure `DATA_STEWARD_OBSERVER_DISPATCH_TOKEN` on the isolated observer dispatcher with repository-limited Actions-write authority only. Deploy with exactly `17 4 * * *` and `17 8 * * *` and no public route.
5. Provision `teamsheet-data-steward-watchdog`, apply `workers/data-steward-watchdog/migrations/0001_watchdog_foundation.sql`, configure its fixed owner-email binding and separate GitHub read token.
6. Bind A1.4 to both its own lifecycle D1 and the observer-clock D1. The watchdog does not own the clock schema and uses that binding read-only.
7. Deploy the watchdog with exactly `47 4 * * *` and `47 8 * * *`, no public route.
8. Run attended positive acceptance over genuine 04:17 and 08:17 automatic observers: prove Cron event, receipt, exact returned GitHub run, observer summary, paired A1.4 evidence and expected lifecycle result at/after 04:47 and 08:47.
9. Run attended negative provenance acceptance: an ordinary manual observer run must satisfy neither automatic heartbeat without the exact Cloudflare receipt.
10. Verify duplicate/rejected/ambiguous/clock-read/GitHub-read failures remain fail-closed and all logs remain sanitized.
11. Record safe evidence in canonical closeout docs and stop. Do not expand into A1.5 or autonomous repair without a new owner gate.

## Rollback

If corrected live acceptance fails, disable/remove the 04:47 and 08:47 watchdog Crons and the 04:17 and 08:17 observer-dispatcher Crons. Keep the A1.3 workflow available for attended manual diagnosis. Do not restore GitHub Actions scheduling as a hidden fallback, and do not alter the production DATA-S2C 01:17/02:17/03:17 schedule during rollback.

## Repository acceptance evidence

PR #241 is not implementation-complete until its exact final head passes `./run-tests.sh`, production build, deterministic rebuild comparison and build-identity verification. The current working environment cannot independently clone GitHub, so GitHub Actions is the independent execution environment for branch verification.

Exact test counts and build hashes belong here only after the final PR head is green; until then they are deliberately not claimed.
