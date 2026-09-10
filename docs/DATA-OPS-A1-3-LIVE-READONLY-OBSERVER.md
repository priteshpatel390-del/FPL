# DATA-OPS A1.3 — Live Read-Only Observer

## Current status — 10 September 2026

**Repository clock-correction candidate: draft PR #241. Not yet deployed or live-accepted under the corrected automatic-clock architecture.**

The A1.3 read-only observer runtime itself was live-accepted through an attended manual GitHub Actions run on 9 September 2026. That evidence remains valid for the observer runtime. PR #241 changes only who owns the automatic timer: GitHub Actions remains the execution engine, while a dedicated Cloudflare Worker becomes the authoritative automatic clock.

PR #240 is merged on `main` as `e358982baef10911c51c00393e02a223716e7943`. PR #241 does not alter Official FPL collection behaviour, production DATA-S2C Cron opportunities, provider/data-source contracts, production D1 schemas, projection/model/calculation logic or repair authority.

## Approved operating model

The production collection clock is deliberately outside this correction. `teamsheet-data-s2-dispatcher` remains exactly as on `main`, with the existing three 01:17, 02:17 and 03:17 UTC **dispatch opportunities** and the existing same-day production opportunity guard. They are not three collection entitlements, and PR #241 neither removes nor adds any production collection opportunity.

The corrected observer/watchdog sequence is:

1. **04:17 UTC — A1.3 observer opportunity.** `teamsheet-data-steward-observer-dispatcher` receives a Cloudflare Cron event and dispatches the existing `Data Steward Read-Only Observer` workflow on exact branch `main`.
2. **04:47 UTC — A1.4 watchdog check.** The watchdog evaluates the exact 04:17 opportunity after a bounded 30-minute delivery tolerance.
3. **08:17 UTC — A1.3 observer opportunity.** The same isolated dispatcher creates a second, independently receipted automatic observer run.
4. **08:47 UTC — A1.4 watchdog check.** The watchdog evaluates the exact 08:17 opportunity after the same bounded tolerance.

No GitHub Actions scheduled trigger remains on the observer workflow.

## Why Cloudflare owns the observer clock

Repository evidence showed GitHub scheduled workflows arriving hours late. That forced A1.4 to tolerate a five-hour delivery window and then solve overlapping 04:17/08:17 attribution. The correction removes the unreliable clock rather than engineering around its lateness.

```text
Cloudflare Cron 04:17 / 08:17
        |
        v
teamsheet-data-steward-observer-dispatcher
        |  one fixed workflow_dispatch per opportunity
        v
Data Steward Read-Only Observer on main
        |  existing read-only A1.3 runtime
        v
sanitized observer summary
```

The GitHub workflow retains `workflow_dispatch` so Cloudflare can invoke it and an owner can still perform attended diagnostics. The job is restricted to exact branch `main`; workflow permissions remain `contents: read`, `actions: read` and `checks: read`; the protected environment remains `data-steward-readonly` with deployment creation disabled.

The previous `DATA_STEWARD_SCHEDULED_ENABLED` variable is no longer part of the architecture because there is no GitHub `schedule:` event to gate.

## Automatic provenance is a receipt, not an inference

A raw GitHub `workflow_dispatch` event cannot distinguish a Cloudflare-created automatic run from an ordinary manual run. Actor identity, timestamp proximity, newest-run selection and history searching are therefore not accepted as automatic provenance.

The new dispatcher owns a tiny isolated D1 ledger:

- Worker: `teamsheet-data-steward-observer-dispatcher`
- D1: `teamsheet-data-steward-observer-clock`
- binding: `STEWARD_OBSERVER_CLOCK_DB`
- dispatch secret: `DATA_STEWARD_OBSERVER_DISPATCH_TOKEN`
- Crons: `17 4 * * *` and `17 8 * * *`

For each exact opportunity the dispatcher atomically claims one row, sends at most one fixed GitHub Actions workflow dispatch with `ref: main` and `return_run_details: true`, and finalizes the row only after classifying the response. `DISPATCHED` is trusted only when GitHub returns a valid exact `workflow_run_id` with matching API and HTML run URLs.

An ordinary manual observer run cannot satisfy the automatic heartbeat because it has no matching Cloudflare-created receipt. A rerun of the same receipt-proven workflow run is still attributable because the workflow run ID stays the same while `run_attempt` changes. If a receipt is absent, `CLAIMED`, `FAILED` or `AMBIGUOUS`, A1.4 does not search for a replacement run.

## Dispatcher failure discipline

The dispatcher has a scheduled handler only. It has no public `fetch` handler, route, production D1 binding, Official FPL/provider binding, application binding, watchdog-incident D1 authority or repair path.

`controller.noRetry()` is called before the outbound GitHub request. There is at most one dispatch attempt per Cloudflare Cron event. The receipt states are closed:

- `DISPATCHED` — exact GitHub run identity returned and persisted.
- `FAILED` — definite no-success condition such as a missing credential or closed rejected GitHub status.
- `AMBIGUOUS` — transport uncertainty or a response that cannot prove exact run identity.
- duplicate claim — no second dispatch is attempted.

There is one deliberate fail-closed distributed edge: GitHub may accept a dispatch and the subsequent receipt-finalization write may fail. The GitHub run can then exist without a trusted `DISPATCHED` receipt. A1.4 must alert rather than infer that run as automatic.

## Security boundary

`DATA_STEWARD_OBSERVER_DISPATCH_TOKEN` exists for one purpose: dispatch the fixed A1.3 workflow in `priteshpatel390-del/FPL`. It should be a fine-grained credential restricted to this repository with the minimum Actions write permission required for workflow dispatch. Contents write is not required and must not be granted for this purpose.

The token is a Cloudflare Worker secret only; it is not committed, rendered, logged or exposed to the browser. A1.4 uses a separate GitHub read credential and never receives the observer-dispatch token. The observer workflow continues to use only its protected read-only runtime values.

The receipt D1 contains operational identifiers only: opportunity timestamp, Cron identity, closed dispatch state/reason, returned workflow-run ID, and claim/finalization timestamps. It contains no Official FPL payload, player/team/fixture facts, model data, provider body or user data.

## Corrected live activation runbook

PR #241 is repository work only. Merge, provisioning and activation remain separate owner gates. After an explicit merge approval and exact-`main` verification, the attended A1.4 activation package is:

1. Verify exact merged `main`, full `./run-tests.sh`, production build and deterministic-build evidence.
2. Re-verify that production `teamsheet-data-s2-dispatcher` is unchanged from the approved DATA-S2C baseline and still declares exactly `17 1 * * *`, `17 2 * * *` and `17 3 * * *`. Do not modify those production collection opportunities in this activation.
3. Create `teamsheet-data-steward-observer-clock` and apply only `workers/data-steward-observer-dispatcher/migrations/0001_observer_clock.sql` to it. Keep live database IDs out of committed source.
4. Create/set `DATA_STEWARD_OBSERVER_DISPATCH_TOKEN` on `teamsheet-data-steward-observer-dispatcher` with repository-limited Actions-write authority only.
5. Deploy `teamsheet-data-steward-observer-dispatcher` with no public route and exactly two Cron Triggers: `17 4 * * *` and `17 8 * * *`.
6. Provision/deploy A1.4 as described in its lifecycle document, including its own isolated D1, fixed owner email binding, separate GitHub read token, SELECT-only binding to the observer-clock D1, and exactly `47 4 * * *` plus `47 8 * * *` watchdog Crons.
7. Perform attended positive acceptance for both automatic observer opportunities: prove the Cloudflare Cron event, exact receipt claim/finalization, exact returned GitHub run on `main`, sanitized observer result and paired A1.4 classification at/after 04:47 and 08:47.
8. Perform negative provenance acceptance: an ordinary manual observer run must not satisfy either automatic heartbeat unless the exact Cloudflare receipt points to that run—which an ordinary manual run will not have.
9. Verify duplicate, rejected, ambiguous, clock-D1 and GitHub-read failure cases remain fail-closed and that logs expose no credential, live database/account ID, full fingerprint, destination email, provider body or raw response.
10. Record safe live acceptance evidence in canonical closeout documentation and stop. Do not expand into A1.5 or autonomous repair.

## Rollback

If corrected live acceptance fails, remove/disable the 04:17 and 08:17 observer-dispatcher Crons and the paired 04:47 and 08:47 watchdog Crons. Leave the GitHub observer available for attended manual diagnosis. Do not silently restore GitHub Actions scheduling, and do not change the production DATA-S2C 01:17/02:17/03:17 opportunities as part of observer rollback.

## Acceptance standard

Repository implementation is not evidence that scheduled A1.3 is live. Final acceptance requires both exact chains to be observed after approved deployment:

`Cloudflare 04:17 -> durable receipt -> exact GitHub observer run on main -> read-only summary -> A1.4 04:47 classification`

`Cloudflare 08:17 -> durable receipt -> exact GitHub observer run on main -> read-only summary -> A1.4 08:47 classification`

Until those live proofs exist, the corrected automatic A1.3 clock is not live-accepted.
