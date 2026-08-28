# DATA-S2B Phase 4B — Cron Activation Preparation

**Status:** REPOSITORY PREPARATION ONLY — NO LIVE CRON ACTIVATION PERFORMED

**Prepared:** 28 August 2026

## Intended bounded action

This addition prepares, but does not authorize or perform, one future schedule-configuration mutation for `teamsheet-data-platform`. The sole target is exactly one `*/30 * * * *` Cron Trigger. The intended active Worker Version is `733093ef-e01f-43a8-828a-0c8c67e7626f`; retained rollback evidence is Version `3a2b065a-6527-4887-9bf8-b08e82e81133`. Installing a schedule is configuration only. The helper never calls `scheduled()`, invokes the Official FPL collector, or writes D1 itself.

## Preconditions

The manual workflow accepts one exact approved SHA, checks out that SHA, proves it is still canonical remote `main`, requires a clean tree, and requires the repository-owned **Tests and deterministic build** check on that exact head before a protected environment exposes credentials.

Immediately before mutation, two stable read-only snapshots require:

- Worker `teamsheet-data-platform`, Custom Domain `data.fpltsheet.co.uk`, and no existing schedules;
- candidate Version `733093ef-e01f-43a8-828a-0c8c67e7626f` solely active at 100% with an unchanged Deployment ID;
- rollback Version `3a2b065a-6527-4887-9bf8-b08e82e81133` retained;
- compatibility date `2026-08-22` and season `2026-27`;
- exact bindings: D1 `TEAMSHEET_DATA_DB`, retained `DATA_S1_HTTP_AUTH_TOKEN` of shape `secret_text`, and plain-text `DATA_S2_SEASON`;
- stable resolved `teamsheet-data` D1 identity;
- exact Phase 1 migration/source-revision governance, zero DATA-S2 collection/history/head counts, and exactly `151552` bytes;
- authenticated health at HTTP 200 with `ok=true` and `mode=shadow_only`.

The bearer is inspected only as binding metadata. Its value must not appear in Version Detail and is never read, printed, serialized, or persisted. Raw responses remain runner-temporary; the summary is sanitized.

Every Cloudflare API request and authenticated health request is bounded by an explicit 15-second Node-native `AbortSignal.timeout(...)`. Ordinary read timeouts fail closed as transport failures. This request timeout, rather than the GitHub job timeout, is the mutation-outcome control mechanism and leaves time for reconciliation and postflight inside the unchanged 10-minute job budget.

## Sole mutation

The executable allowlist admits only:

```text
PUT /accounts/{account}/workers/scripts/teamsheet-data-platform/schedules
```

with exact body `[{"cron":"*/30 * * * *"}]`. It admits no Version upload, Deployment, D1 mutation, Access, secret, route/domain, KV, R2, service-binding, traffic, collector, or arbitrary Cloudflare write. No Wrangler deploy/trigger command is used.

## Outcome ambiguity and stop behaviour

A definite non-success response stops without retry. An explicit 15-second mutation timeout, connection termination, HTTP 5xx, or malformed mutation response is potentially delivered: the helper submits no second PUT and performs exactly one read-only Schedules GET reconciliation. That GET is independently bounded by the same request timeout; if it times out, fails, or cannot be parsed, reconciliation is `UNPROVABLE` and stops.

- `TARGET_PRESENT`: continue to postflight;
- `ABSENT`: stop without retry;
- `UNEXPECTED`: stop fail-closed;
- `UNPROVABLE`: stop fail-closed.

This path deliberately uses **STOP + manual intervention**, not automatic rollback. A postflight failure after the target appears can mean a live schedule exists and must not cause an unapproved second mutation. Schedule removal requires separate review and approval.

## Postflight

Two complete postflight snapshots re-prove exactly one target schedule; candidate-only 100% traffic; unchanged Deployment ID and Version History; retained rollback; unchanged compatibility, season, bindings, secret shape, D1 identity/governance/zero counts/size, domain, and authenticated health. The endpoint allowlist proves that this helper performs no Version, Deployment, D1, Access, secret, route/domain, or collector mutation. Account-wide external concurrency is not atomic, so any observed immutable-state drift stops as an incident.

## First runtime event and exclusions

Activation itself performs no collection. The first later scheduled opportunity enters the existing Phase 4A gate: full collection only at 01:00 UTC or the final half-hour opportunity before the next stored future Official FPL deadline; ordinary opportunities make the bounded deadline evaluation and skip. Before a first routine baseline, non-daily opportunities safely skip because no stored future deadline exists.

This preparation changes no Worker runtime, scheduler decision logic, collector transform, D1 schema, provider scope, application, UI, model, fixture, expected-minutes, captaincy, squad, transfer, simulation, rank, or Mini-League behaviour. **No DATA-S2B production Cloudflare read or mutation was performed by this repository-only preparation task.** An automatic PR integration may create an unrelated `teamsheet-fpl-gateway` preview build/check; that is not a DATA-S2B production mutation.

After review, merge, and exact-main verification, the next gate remains separate explicit owner approval for:

> **one DATA-S2B Cron activation to `*/30 * * * *` only**

Merge of this repository preparation is not that approval.
