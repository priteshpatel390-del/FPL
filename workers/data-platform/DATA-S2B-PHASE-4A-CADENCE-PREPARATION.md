# DATA-S2B Phase 4A — Daily + Deadline-Anchored Cadence Preparation

**Status:** REPOSITORY CANDIDATE ONLY — NO LIVE CRON OR COLLECTION APPROVAL

**Baseline main:** `01cb844ae6793e4acf11de40d31d6ef48295a934`

**Phase 4A branch:** `agent/data-s2b-phase4a-cadence-prep`

## Outcome

Phase 4A prepares the already-built Official FPL historical collector for a minimum-data cadence:

- one routine full Official FPL collection per UTC day;
- one additional full collection shortly before an Official FPL Gameweek deadline;
- no general fixed 4-hour, 6-hour or hourly full collection;
- no new provider, Worker, database, credential, route, application dependency, model input or retained field.

This document and the repository changes are **not** approval to upload a new Worker Version, deploy it, activate a Cron Trigger, run the collector or write production D1.

## Why the earlier fixed cadence was reopened

The historical collector is `shadow_only`. It does not serve current Team/Transfers data and is not an approved runtime/model input. A faster historical cadence therefore does not make the live application fresher.

Empirical 2026/27 research found that collection timing around the manager decision point matters more than evenly spaced polling:

- on the GW1 deadline day, a high-frequency public Official FPL archive recorded 37 availability/news field changes across 14 players between 10:02 UTC and 16:39 UTC before the 17:30 UTC deadline;
- a fixed 12:00 UTC historical capture would have preceded 31 of those 37 changes;
- a fixed four-hour `00/04/08/12/16/20` UTC pattern would still have missed a Kudus chance/news update detected at 16:39 UTC;
- short-lived availability states were also observed outside the deadline window, but preserving every intraday transition is not the current DATA-S2 product requirement;
- Official FPL prices are persistent daily state, so prices do not justify uniform intraday collection.

The conclusion is not that every historical transition is preserved. The design target is to preserve routine daily state plus the state close to the point at which an FPL manager must act.

## Repository candidate schedule

`workers/data-platform/wrangler.jsonc` now declares exactly one candidate Cron expression:

```text
*/30 * * * *
```

This is a **schedule-check cadence**, not a full-collection cadence.

Cloudflare supplies the exact triggering Cron expression and nominal scheduled time to the Worker scheduled handler. The Worker fails closed unless the trigger string exactly matches the reviewed expression.

### Routine daily collection

At `01:00 UTC`, the scheduled handler permits one full Official FPL collection.

The fixed UTC slot is deliberately after the current Official FPL midnight-UK daily price-change point in both GMT and BST. The collection itself remains exactly the existing two-endpoint Official FPL collection and existing D1 delta commit path.

### Pre-deadline collection

At every other half-hour opportunity, the Worker does **not** fetch Official FPL first.

It performs one bounded, read-only D1 lookup of the current completed Official FPL `event.deadline_time` heads for the configured season.

A full collection is permitted only when all of these are true:

1. the trigger string is exactly `*/30 * * * *`;
2. the stored next deadline is valid and still in the future;
3. the nominal scheduled opportunity is more than zero and no more than 30 minutes before that deadline;
4. the actual invocation has not already reached or passed the deadline.

Because the schedule grid is every 30 minutes, there is at most one nominal scheduled opportunity in that final 30-minute window for a given deadline.

### Ordinary schedule checks

If the invocation is neither the `01:00 UTC` daily slot nor the final pre-deadline opportunity, it returns `schedule_skip`.

It performs:

- zero Official FPL HTTP requests;
- zero `ingestion_runs` writes;
- zero observation/head/entity writes;
- one bounded read of stored event deadline heads, except the daily slot and fail-closed wrong-Cron path.

Therefore `48` nominal scheduled invocations per day must **not** be described as `48` Official FPL collections.

In a normal one-deadline week the intended steady state is approximately:

- 336 lightweight schedule invocations;
- 8 full collector executions (7 daily + 1 pre-deadline);
- 16 Official FPL upstream requests from those full executions because the existing collector fetches exactly two endpoints per execution.

The actual D1 rows-read accounting and CPU time remain live acceptance evidence, not repository-proven facts.

## Deadline source

No new source is introduced.

The scheduler uses the `deadline_time` facts already retained from Official FPL by DATA-S2A. It reads current `observation_heads` joined to completed Official FPL observations/runs.

This keeps the schedule check:

- same-Worker;
- same-D1;
- secret-free;
- provider-free;
- read-only until a collection window is reached.

Before the first successful baseline collection there are no stored deadline heads, so non-daily schedule checks safely skip. A future live activation must therefore establish and verify the first routine baseline before relying on deadline-anchored collection.

## Existing collector behaviour deliberately unchanged

Phase 4A does **not** change:

- `bootstrap-static` acquisition;
- `fixtures` acquisition;
- Official FPL source governance;
- season validation;
- field allowlist;
- `selected_by_percent` retention;
- delta comparison;
- disappearance lifecycle observations;
- observation identity/hashing;
- write-budget cap;
- batch limits;
- D1 schema;
- append-only history;
- current-head semantics;
- run idempotency for the same scheduled timestamp;
- collector failure handling.

The only Worker behaviour change is the gate that decides whether a scheduled invocation is allowed to call the existing collector.

## Fail-closed behaviour

The candidate scheduler is designed to skip without collection when:

- the Cron string is not the reviewed expression;
- scheduled time is malformed;
- no future stored FPL deadline is available;
- the next deadline is outside the final 30-minute window;
- the invocation has already reached/passed the deadline.

A D1 deadline-read error does not fall through to collection. It fails the scheduled invocation as `data_s2_schedule_read_failed` so Cloudflare observability can expose the failure.

An existing collector failure still fails the scheduled invocation using the existing `data_s2_<reason>` behaviour.

## Known limitations

### Deadline freshness

The deadline gate relies on the deadline stored by the most recent successful full collection. If Official FPL changes the next deadline after the latest full collection and before the intended pre-deadline window, the scheduler can temporarily reason from stale deadline history. Daily routine collection greatly limits this exposure but does not mathematically eliminate a same-day late deadline change.

This is accepted as a documented Phase 4A limitation rather than adding a new frequent Official FPL polling path merely to refresh the scheduler.

### Exact pre-deadline offset

The current candidate uses the final half-hour schedule opportunity, meaning nominal lead is greater than 0 and at most 30 minutes. One observed 2026/27 deadline supports this direction but does not prove that 30 minutes is globally optimal across all 38 Gameweeks.

### Ownership resolution

`selected_by_percent` remains in the approved DATA-S2A allowlist. Its exact intraday churn was not measured by the high-resolution change log used for the cadence research. No approved current Teamsheet feature requires intraday ownership history, so that unknown does not justify uniform full collection every few hours.

### Free-plan CPU

Current Cloudflare Workers Free guidance allows 10 ms CPU per Cron Trigger invocation. Repository tests cannot prove the real production collector remains comfortably within that limit. CPU evidence remains a mandatory live acceptance item before permanent Cron approval.

## Historical Phase 2 workflow is intentionally not reusable

The existing Phase 2 Version-upload helper remains pinned to the exact historical Phase 2 hourly candidate configuration.

Phase 4A does **not** loosen that contract.

After this candidate changes the repository Cron configuration, the historical Phase 2 config validator must reject the current config with `phase2_triggers_drift`. This prevents an old mutation workflow from being silently repurposed for Phase 4.

Any future Phase 4 Worker Version upload/deployment/Cron activation requires a new, separately reviewed and explicitly approved mutation path.

## Tests required for Phase 4A

Permanent repository coverage must prove:

- candidate config declares exactly one `*/30 * * * *` trigger;
- wrong/unrecognised Cron fails closed without D1 read or collection;
- malformed scheduled time fails closed;
- `01:00 UTC` is the only routine daily slot;
- a normal half-hour check reads the deadline once and performs zero collection;
- only the final half-hour opportunity before deadline can collect;
- an invocation at/after deadline cannot be treated as pre-deadline evidence;
- deadline lookup is read-only and bounded to current completed Official FPL event deadline heads;
- D1 deadline-read failure cannot fall through to collection;
- existing collector failure remains visible as scheduled failure;
- historical Phase 2 tooling remains pinned and rejects the Phase 4 config;
- DATA-S2A field and delta tests continue to pass;
- application/model files remain independent of DATA-S2.

## Future live sequence — not approved by Phase 4A

A future owner-approved live checkpoint must not jump directly from this PR to Cron activation.

The safe sequence is:

1. merge an owner-approved Phase 4A candidate only after CI/review;
2. design and separately approve a Phase 4 Worker Version upload mechanism pinned to an exact `main` SHA and exact-main CI;
3. upload the reviewed Version without changing traffic, Cron, D1, route, Access or secrets;
4. verify the uploaded Version and unchanged live state;
5. separately approve deployment of that reviewed Version;
6. verify production health with Cron still empty;
7. separately approve creation of exactly the reviewed `*/30 * * * *` schedule;
8. establish the first routine `01:00 UTC` baseline and reconcile exact D1/CPU/storage evidence;
9. verify ordinary schedule-skip behaviour causes no FPL fetch/write;
10. verify a natural pre-deadline run when an appropriate deadline arrives;
11. stop Cron immediately on CPU/resource failure, D1 reconciliation failure, unexpected collection, schedule drift or unapproved data behaviour.

Worker rollback is for a defective deployed Worker. Cron removal is the first stop action for scheduling/collection failure. Worker rollback does not undo D1 history and no D1 repair is authorised by this design.

## Explicit exclusions

Phase 4A authorises none of the following:

- live Cron creation/update/deletion;
- production collector execution;
- production D1 write;
- Worker Version upload;
- Worker Deployment mutation;
- route/domain mutation;
- Access mutation;
- secret/credential mutation;
- provider/data-source addition;
- D1 migration/schema change;
- app/UI change;
- projection/model/fixture/captaincy/squad/transfer/rank/Mini-League logic change.
