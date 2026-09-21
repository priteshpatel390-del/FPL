# API-Football Attended One-Shot Discovery Acceptance Foundation

## Approval and status

Pritesh approved repository implementation only. This record adds dormant code, tests and a manual protected workflow for a future separately approved attended acceptance. No live Cloudflare mutation, D1 mutation, secret provisioning or inspection, Preview enablement, Version upload/deletion, provider request, collector execution, Deployment, Cron, route, custom domain or merge occurred.

The accepted design preserves **zero Cloudflare Deployments**. A future attended Version is an inactive Version with an exact reviewed identity. Its Versioned Preview URL may be enabled only temporarily after fresh read-only admission, then disabled regardless of outcome. The original blocked inactive Version remains retained.

## Narrow HTTP contract

The Worker now exposes one exact `POST /__teamsheet/api-football/attended-one-shot` path. It requires `ATTENDED_ONE_SHOT_DISCOVERY` and a separate `API_FOOTBALL_ATTENDED_TRIGGER_SECRET`. The trigger is compared through SHA-256 digests; wrong method, path, activation or secret returns the same generic rejection. Responses contain no provider key, trigger, account identity, D1 identity, mapping data or internal error. Accepted requests reuse `runScheduledCollector()` and therefore the existing planner and `runOneShotDiscoveryGeneration()` composition rather than duplicating collection logic.

Checked-in `wrangler.jsonc` remains blocked, with placeholder D1, no secrets, no Cron, `workers_dev=false` and `preview_urls=false`.

## Exact attended Version

`buildAttendedVersionMetadata()` uses the same closed reviewed module graph as inactive staging. Its exact binding set is:

- production `TEAMSHEET_DATA_DB`;
- `API_FOOTBALL_FPL_SEASON=2026-27`;
- `API_FOOTBALL_PROVIDER_SEASON=2026`;
- `EIA_2I5D_ACTIVATION=ATTENDED_ONE_SHOT_DISCOVERY`;
- secret-binding metadata for `API_FOOTBALL_API_KEY`;
- secret-binding metadata for `API_FOOTBALL_ATTENDED_TRIGGER_SECRET`.

No secret value is constructed, read, logged, returned, persisted or stored in repository artifacts.

## Admission and execution order

`ATTENDED_ACCEPTANCE` now requires Worker presence, Deployment/Cron/route/custom-domain counts all zero, workers.dev and Preview URLs disabled, exact reviewed Version identity, exact production D1, exact binding set, both secret names by metadata only, runtime disabled with credential `AVAILABLE`, no lease, migrations 0001–0006, zero FK violations, fresh exact-20 Official FPL authority, current committed 20/20 mapping, exact canonical coverage, pristine history and zero model/UI imports. Any nonzero Deployment count stops admission. Repository-stage rules remain unchanged.

The dormant workflow is exact-main, exact-Verify and first-attempt gated. Its order is:

1. fresh read-only attended admission while collection is disabled;
2. temporarily enable Version Preview URLs;
3. enable collection immediately before invocation;
4. make exactly one authenticated POST to the exact Versioned Preview URL;
5. disable collection regardless of result;
6. disable Preview URLs regardless of result;
7. stop for independent reconciliation.

The executor contains a second-invocation guard and never retries provider work. Unknown transport, cleanup failure or mutation ambiguity returns reconciliation-required. Repository presence does not authorize workflow dispatch.

## Preserved provider and D1 envelopes

Discovery remains five `GET /fixtures?league=<id>&season=2026` requests for league IDs `2`, `3`, `848`, `45` and `48`; provider key remains only in `x-apisports-key`. Timeout remains 15,000 ms, response ceiling 720,896 bytes, per-response row ceiling 2,000, generation ceiling 2,500, spacing 1,000 ms and HTTP-attempt ceiling 5. Attempt 2 and blind retry remain forbidden.

D1 limits remain 50 total statements, 43 mutations, 7 reads, 6 fixture chunks, 1,250 rows per chunk, 1,500,000-byte chunk JSON, 7,500 fixture-related rows, 25 control rows and 7,525 total worst-case rows written.

## Reconciliation

Success requires collection disabled, no active lease, exactly five attempt-1 successes, one committed generation, its current head, 0–2,500 fixture revisions, zero raw payload rows and zero model/UI imports. Any other state stops with `retryAuthorized=false`. Auth, quota, timeout, unknown transport, schema, persistence, completion and commit evidence remains durable under existing collector semantics; no destructive restore or automatic second execution exists.

## Remaining gate

No real Preview URL, live Cloudflare mutation, live D1 mutation, secret provisioning, physical API-Football call, attended Version upload, live reconciliation or staging-credential cleanup/revocation is proven here. Live attended acceptance needs a new explicit owner approval after merge, exact-main verification, exact Version review, credential preparation and fresh admission.
