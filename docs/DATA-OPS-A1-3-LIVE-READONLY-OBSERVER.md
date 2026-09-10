# DATA-OPS A1.3 — Live Read-Only Observer

## Current status — 10 September 2026

**Repository correction candidate: draft PR #242. NOT LIVE-ACTIVATED under the corrected automatic-clock design.**

A1.3's read-only observer runtime was previously accepted through an attended manual GitHub Actions run on 9 September 2026. That historical proof remains valid for the observer runtime itself. The automatic scheduling architecture is being corrected in PR #242 before scheduled activation: GitHub Actions remains the execution engine, while a dedicated Cloudflare Worker becomes the sole automatic clock.

This correction does not add a provider, change Official FPL acquisition or retention, alter a production D1 schema, change any projection/model/calculation logic, or add repair authority.

## Owner-approved operating model

The complete daily operating sequence is intentionally small:

1. **01:17 UTC — Official FPL collection.** `teamsheet-data-s2-dispatcher` gets one Cloudflare Cron opportunity. There is no 02:17 or 03:17 automatic fallback. The existing same-day production opportunity guard remains defence-in-depth. A failed collection moves to observation and attended/manual recovery; it is not automatically retried.
2. **04:17 UTC — A1.3 observer.** `teamsheet-data-steward-observer-dispatcher` gets one Cloudflare Cron opportunity and dispatches the existing `Data Steward Read-Only Observer` GitHub Actions workflow on exact branch `main`.
3. **04:47 UTC — A1.4 watchdog.** The independent watchdog evaluates the exact 04:17 opportunity after a bounded 30-minute delivery window.

There is no second 08:17 observer opportunity.

## Why Cloudflare owns the observer clock

GitHub's scheduled-workflow delivery was shown by this repository's own earlier evidence to be materially late and irregular. The old A1.3 design therefore needed a five-hour grace window and, once two observer opportunities existed, A1.4 also needed overlapping time-attribution logic.

That was complexity around the wrong clock. Under the corrected design:

```text
Cloudflare Cron 04:17
        |
        v
teamsheet-data-steward-observer-dispatcher
        |  one fixed GitHub workflow_dispatch to main
        v
Data Steward Read-Only Observer
        |  existing read-only A1.3 runtime
        v
sanitized observer summary
```

The GitHub workflow itself has **no `schedule:` trigger**. It retains `workflow_dispatch` so the Cloudflare dispatcher can invoke it and an owner can still run it manually for diagnostics. Its job condition is restricted to exact branch `main`, and the workflow retains only `contents: read`, `actions: read` and `checks: read` permissions.

The protected GitHub environment remains `data-steward-readonly`. Its branch policy must continue to be **Selected branches and tags — exact branch `main`**, with **Protected branches only** where applicable. Those protections are established in the owner UI before Cloudflare runtime credentials are provisioned. A protection failure must fail closed (for example HTTP 403 from GitHub), never bypass the environment.

## Automatic provenance: receipt, not inference

A GitHub `workflow_dispatch` event alone cannot tell A1.4 whether a run was created automatically by Cloudflare or manually by the owner. Therefore event type, actor name, timestamp proximity and workflow-run searching are **not** accepted as automatic provenance.

The new dispatcher owns a tiny separate D1 database:

- Worker: `teamsheet-data-steward-observer-dispatcher`
- D1: `teamsheet-data-steward-observer-clock`
- binding: `STEWARD_OBSERVER_CLOCK_DB`
- dispatch secret: `DATA_STEWARD_OBSERVER_DISPATCH_TOKEN`
- Cron: `17 4 * * *`

For each exact 04:17 opportunity it atomically claims one receipt row. It performs one fixed GitHub Actions `workflow_dispatch` request with `ref: main` and `return_run_details: true`. A dispatch is trusted as automatic only when GitHub returns a valid exact `workflow_run_id` together with the matching API and HTML run URLs. The dispatcher then finalizes that exact receipt as `DISPATCHED` with that run ID.

A normal manual GitHub `workflow_dispatch` **cannot satisfy the automatic heartbeat** because it has no Cloudflare-created receipt for the 04:17 opportunity. A rerun of a receipt-proven run retains the same workflow run ID and is still the same automatic execution. If a receipt is absent, still `CLAIMED`, `FAILED` or `AMBIGUOUS`, A1.4 must not search for another run that looks convenient.

## Dispatcher failure discipline

The dispatcher is intentionally narrower than a general automation service. It has a scheduled handler only and no public `fetch` handler, route, production D1 binding, provider binding, application binding, watchdog-incident D1 authority or repair path.

`controller.noRetry()` is called before the outbound GitHub request. The dispatcher itself never issues a second attempt for one Cron firing. The state contract is:

- `DISPATCHED` — exact GitHub run identity returned and persisted.
- `FAILED` — definite no-success condition such as missing credential or a closed rejected GitHub status.
- `AMBIGUOUS` — transport uncertainty or a response that cannot prove exact run identity. It is deliberately not treated as success.
- duplicate claim — no second dispatch is attempted.

There is one deliberate fail-closed edge: GitHub could accept the request and then the D1 finalization write could fail. In that case the GitHub run may exist but A1.4 will not trust it as automatic because the durable receipt is missing. That can create a false negative, but it cannot create a false healthy state.

## Security boundaries

The dispatcher credential exists for one purpose only: create the fixed A1.3 workflow dispatch in this repository. It should be a fine-grained credential limited to `priteshpatel390-del/FPL` with the minimum GitHub Actions write permission required for workflow dispatch. **Contents write is not required and must not be granted for this purpose.** The credential is stored only as the Cloudflare Worker secret `DATA_STEWARD_OBSERVER_DISPATCH_TOKEN`; it is not committed, rendered, logged or exposed to the browser.

A1.4 uses a different GitHub read credential and must never receive the observer dispatch credential. A1.3's observer workflow uses its existing protected read-only runtime values. The receipt D1 contains operational identifiers only; it holds no Official FPL payload, player/team/fixture facts, application/model data or user data.

The previous `DATA_STEWARD_SCHEDULED_ENABLED` GitHub variable is no longer part of the architecture. The corrected workflow has no GitHub schedule to gate.

## Corrected live activation runbook

PR #242 is repository work only. Merge, provisioning and live activation remain separate owner gates. Once an owner later approves merge and A1.4 live activation, the attended runbook is:

1. Verify exact merged `main`, repository tests, production build and deterministic build evidence before touching Cloudflare.
2. Verify the production DATA-S2C dispatcher is intended to have exactly the one `01:17 UTC` trigger; do not change collector/provider contracts.
3. Create the isolated `teamsheet-data-steward-observer-clock` D1 database. Apply only `workers/data-steward-observer-dispatcher/migrations/0001_observer_clock.sql` to that database. Replace the repository's inert all-zero database ID only in the attended deployment configuration; do not commit live IDs.
4. Create/set `DATA_STEWARD_OBSERVER_DISPATCH_TOKEN` as an encrypted secret on `teamsheet-data-steward-observer-dispatcher`. Confirm the token is repository-limited and Actions-write only for the dispatch purpose.
5. Deploy `teamsheet-data-steward-observer-dispatcher` with no public route and verify exactly one Cron Trigger: `17 4 * * *`.
6. Provision A1.4's own isolated `teamsheet-data-steward-watchdog` D1 and email binding as described in the A1.4 document. Give A1.4 a native binding to `teamsheet-data-steward-observer-clock` for SELECT-only use and deploy exactly one watchdog Cron: `47 4 * * *`.
7. Perform attended acceptance. Prove that a genuine 04:17 Cloudflare opportunity creates exactly one receipt, the receipt names the exact GitHub run, the run is the expected observer on `main`, and A1.4 classifies its result correctly at/after 04:47.
8. Perform the negative provenance proof: create or inspect an ordinary manual observer run and prove it does **not** become evidence for the automatic heartbeat because no matching Cloudflare receipt points to it.
9. Verify Cloudflare and GitHub logs contain only the approved sanitized output. Verify no credential, live account ID, full account fingerprint, destination email, provider body or raw response is exposed.
10. Record exact live resource IDs/evidence outside committed source as required, update canonical closeout documentation with safe identifiers only, and stop. Do not expand into A1.5 or autonomous repair.

The owner must create or edit live credentials/resources through the owner UI or an explicitly approved attended deployment process. Repository merge must not automatically create Cloudflare resources or automatically create credentials. If a required live environment/resource is absent, activation fails closed.

## Rollback

Rollback is operationally simple because A1.3 itself is still a read-only GitHub workflow:

- remove/disable the 04:17 Cron from `teamsheet-data-steward-observer-dispatcher`;
- leave the GitHub observer available for attended manual diagnostics;
- remove/disable the 04:47 watchdog Cron if A1.4 cannot consume trusted receipts;
- do not re-enable a GitHub Actions schedule as a silent fallback;
- do not add 08:17, 02:17 or 03:17 opportunities without a new owner decision.

The production collection and the observer remain separate systems. Rolling back observer automation does not authorize changes to Official FPL collection behavior.

## Acceptance standard

Repository implementation is not enough to claim scheduled A1.3 is working. Final live acceptance requires evidence for the exact chain:

`Cloudflare 04:17 scheduled event → durable receipt → exact GitHub observer run on main → read-only observer summary → A1.4 04:47 classification`.

Until that evidence exists after an approved live deployment, the corrected automatic A1.3 schedule is **not live-accepted**.
