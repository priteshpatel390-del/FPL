# DATA-S1B — Final Preflight and Deployment Runbook

Status: **mutation-free preflight PASS; deployment not approved**  
Preflight date: **22 August 2026**  
Authoritative main: `45ad8c6ca7319b5d2f220c77feba5458d4d32eca`  
Exact-main verification: Verify Teamsheet #349, run `32598129668`, success

## Final preflight verdict

**PASS — ready for independent review and a separate, explicit owner deployment
approval.** No deployment approval is implied by this document.

The read-only preflight established all of the following:

- an active user-scoped Cloudflare token and the exact Teamsheet account;
- no collision for Worker `teamsheet-data-platform`, D1 `teamsheet-data`, binding
  `TEAMSHEET_DATA_DB`, Custom Domain/DNS name `data.fpltsheet.co.uk`, Access
  application, dedicated service-token name, exact or wildcard Workers Route, or
  Workers Builds integration;
- zero Workers Routes in the zone and complete tag-based Builds inventories for
  both existing Workers;
- one existing D1 database, leaving room for one disposable validation database
  and the production database within the Workers Free ten-database allowance;
- the portable repository config has no production `database_id`, and neither
  existing Worker has a `TEAMSHEET_DATA_DB` binding;
- isolated Node `v24.15.0` and `wrangler@4.125.0`, whose package requires Node
  `>=22.0.0`, at the absolute paths used below; and
- Wrangler 4.125.0's local `experimental-provision`/`x-provision` boolean contract,
  including the negative `--no-x-provision` control required below.

The preflight made no repository or Cloudflare mutation. DATA-S1 remains not live.

## Plan, usage, and cost reconciliation

Owner-observed Cloudflare dashboard evidence at approximately **22:24 UTC on
22 August 2026** establishes:

- **Workers Free — Active**; Workers Paid is not active and is offered at
  **$5/month plus usage**;
- current billable usage, projected current-cycle cost, and average daily cost are
  each **$0.00**;
- current usage is within included limits, with no Enterprise, legacy, or trial
  Workers subscription shown; and
- the separate R2 Paid subscription is irrelevant because DATA-S1 is D1-only.

The applicable Workers Free envelope is 100,000 requests/day and 10 ms CPU time
per invocation. The D1 Free envelope is ten databases, 500 MB per database, 5 GB
aggregate storage, five million rows read/day, and 100,000 rows written/day.
Read-only evidence found one D1 database (77,824 bytes) and 1,185 Worker requests
in the preceding 30 complete UTC days. The validation and production databases
therefore fit the current count/storage envelope before mutation.

**Cost verdict:** no plan change or subscription purchase is required or permitted
by DATA-S1B. Expected initial incremental cost is **$0.00**, provided operation
remains inside Workers Free and D1 Free limits. A plan-upgrade prompt, a requirement
for more than 10 ms CPU per invocation, or projected billable usage is a hard stop
for a separate owner cost/plan decision.

## Immutable execution variables

Run from the repository root only after a separate deployment approval. Do not use
`npx`, `latest`, an unqualified `wrangler`, or a repository package installation.

```bash
set -euo pipefail

export NODE_BIN="/root/.nvm/versions/node/v24.15.0/bin/node"
export WRANGLER_JS="/root/.local/share/teamsheet-tools/wrangler-4.125.0/node_modules/wrangler/bin/wrangler.js"
export WRANGLER_VERSION="4.125.0"
export DESIGN_CONFIG="workers/data-platform/wrangler.jsonc"
export MIGRATIONS_DIR="workers/data-platform/migrations"
export PRODUCTION_DB_NAME="teamsheet-data"
export VALIDATION_DB_NAME="teamsheet-data-s1b-validation-20260822"
export WORKER_NAME="teamsheet-data-platform"
export DATA_HOST="data.fpltsheet.co.uk"
export PRODUCTION_CONFIG="${HOME}/.local/share/teamsheet-tools/data-s1b/wrangler.production.jsonc"
export EVIDENCE_ROOT="${HOME}/.local/share/teamsheet-tools/data-s1b/evidence"

test "$(git rev-parse HEAD)" = "45ad8c6ca7319b5d2f220c77feba5458d4d32eca"
test -z "$(git status --porcelain=v1)"
test "$("${NODE_BIN}" --version)" = "v24.15.0"
test "$("${NODE_BIN}" "${WRANGLER_JS}" --version)" = "4.125.0"
test -f "${DESIGN_CONFIG}"
test -f "${MIGRATIONS_DIR}/0001_shadow_data_foundation.sql"
mkdir -p "$(dirname "${PRODUCTION_CONFIG}")" "${EVIDENCE_ROOT}"
```

Securely inject a separately approved deployment credential. It is not the
read-only preflight token and must never be printed or committed.

```bash
unset CLOUDFLARE_API_TOKEN
read -r -s -p "DATA-S1B deployment token: " CLOUDFLARE_API_TOKEN
printf '\n'
export CLOUDFLARE_API_TOKEN
"${NODE_BIN}" "${WRANGLER_JS}" whoami
```

Stop unless account identity is exact. Save only sanitized output: no token,
account/zone ID, Access audience, service-token secret, or authorization header.

## Phase 1 — refresh the mutation-free gate

Before each mutation, repeat the successful read-only inventories through the
Cloudflare API: Workers, D1, Custom Domains, Access apps/policies/service tokens,
DNS, exact and wildcard routes, and per-Worker Builds triggers/history. Reconfirm
the exact main/CI evidence and dashboard plan/cost evidence. Stop on drift,
collision, a non-Free plan, or any unexplained resource.

## Phase 2 — disposable D1 validation

This phase needs its own explicit approval. Create exactly one disposable database:

```bash
"${NODE_BIN}" "${WRANGLER_JS}" d1 create "${VALIDATION_DB_NAME}"
```

Capture its UUID without exposing account identifiers, create a temporary
owner-controlled validation config outside the repository with the same binding,
name, migrations directory, and that exact UUID, then prove exactly one matching
database exists. Apply the unchanged migration:

```bash
"${NODE_BIN}" "${WRANGLER_JS}" d1 migrations apply "${VALIDATION_DB_NAME}" \
  --remote --config "${VALIDATION_CONFIG}"
```

Using `wrangler d1 execute --remote --config "${VALIDATION_CONFIG}"`, record:

1. `PRAGMA foreign_keys`, `PRAGMA foreign_key_check`, `PRAGMA table_list`, and
   `PRAGMA index_list`/`index_info` for every required table/index;
2. `schema_migrations` contains exactly version 1,
   `shadow_data_foundation`;
3. the plan's valid seed transaction succeeds;
4. isolated invalid statements prove the mode/value `CHECK`, simple foreign key,
   composite `(run_id, source_revision_id)` foreign key, and idempotency unique
   constraints reject invalid data; and
5. transaction/batch failure leaves no partial acceptance fixture.

For real Worker-binding validation, make an external validation overlay pointing
to the disposable UUID, deploy only under a separately approved temporary,
Access-protected validation identity, and use the synthetic fixture from the
acceptance plan. Do not expose it publicly or reuse the production hostname. POST
once for HTTP 201/`inserted`, replay byte-for-byte for HTTP 200/`existing`, then
change `value_boolean` with the same idempotency tuple for HTTP
409/`idempotency_conflict`. Verify replay immediately before `fetched_at` excludes
the row, replay at/after it includes it, and a quarantined row is excluded.

Delete the temporary Worker/Access resources and disposable D1 only under explicit
resource-specific approval and only after evidence capture. Re-run inventories to
prove removal. Any failed validation blocks production.

## Phase 3 — deterministic production D1

This phase needs separate approval after Phase 2 passes.

```bash
"${NODE_BIN}" "${WRANGLER_JS}" d1 create "${PRODUCTION_DB_NAME}"
```

Capture the returned UUID as `PRODUCTION_DB_ID`, rerun D1 inventory, and require
exactly one `teamsheet-data`. Create `PRODUCTION_CONFIG` outside the repository:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "teamsheet-data-platform",
  "main": "/workspace/FPL/workers/data-platform/data-platform.mjs",
  "compatibility_date": "2026-08-22",
  "workers_dev": false,
  "preview_urls": false,
  "observability": { "enabled": true },
  "d1_databases": [{
    "binding": "TEAMSHEET_DATA_DB",
    "database_name": "teamsheet-data",
    "database_id": "<EXACT_PRODUCTION_DB_UUID>",
    "migrations_dir": "/workspace/FPL/workers/data-platform/migrations"
  }]
}
```

Restrict permissions and record its hash:

```bash
chmod 600 "${PRODUCTION_CONFIG}"
sha256sum "${PRODUCTION_CONFIG}" | tee "${EVIDENCE_ROOT}/production-config.sha256"
```

Reject placeholders, a missing/mismatched UUID, any extra binding, or any route.
Then perform the non-mutating dry run (which is prohibited until specifically
approved):

```bash
"${NODE_BIN}" "${WRANGLER_JS}" deploy \
  --dry-run --no-x-provision --config "${PRODUCTION_CONFIG}" \
  --outdir "${EVIDENCE_ROOT}/production-dry-run"
```

Review the bundle and resolved binding, then rerun D1 inventory and prove no D1
was provisioned. Apply migration 0001 and repeat the schema/foreign-key/index
checks used for validation:

```bash
"${NODE_BIN}" "${WRANGLER_JS}" d1 migrations apply "${PRODUCTION_DB_NAME}" \
  --remote --config "${PRODUCTION_CONFIG}"
```

## Phase 4 — production Worker, Access, and Custom Domain

This phase needs separate approval after the production schema passes.

1. In the Cloudflare dashboard, create a Worker-level Access application for
   `teamsheet-data-platform`, select **All traffic**, and create exactly one
   **Service Auth** policy whose sole Include rule is one new, dedicated DATA-S1
   Service Token. Do not add Allow, Bypass, human identity, public health, shared
   archive credentials, or browser credentials. Securely retain the client ID and
   secret; the secret is displayed only once.
2. Deploy the reviewed Worker with provisioning disabled:

   ```bash
   "${NODE_BIN}" "${WRANGLER_JS}" deploy \
     --no-x-provision --config "${PRODUCTION_CONFIG}"
   ```

3. Immediately rerun D1 inventory. Stop and request rollback approval if any
   second database exists or the live binding UUID differs.
4. In Workers & Pages, add exactly one Worker Custom Domain,
   `data.fpltsheet.co.uk`, to `teamsheet-data-platform`. Do not add a Workers
   Route, `workers.dev` hostname, Preview URL, or second public hostname.
5. Wait for active DNS/TLS and verify through read-only inventories that the
   Custom Domain exists, there is still no Workers Route, `workers_dev` and
   previews are disabled, and Access covers all Worker traffic.

## Phase 5 — live acceptance

Run every request with a bounded timeout and capture sanitized status/body/headers.

1. Unauthenticated `GET https://data.fpltsheet.co.uk/v1/health` must be denied by
   Access and must not return the Worker health JSON.
2. Invalid Access credentials must be denied.
3. Dedicated service-token headers must return HTTP 200 and exactly
   `{"ok":true,"platformVersion":"1.0.1","mode":"shadow_only"}`.
4. With the truthful current timestamps substituted into the canonical synthetic
   fixture, repeat inserted/existing/conflict and before/after replay acceptance
   against production. Verify quarantined exclusion and the absence of CORS.
5. Verify D1 migration/schema/binding, deployed Worker version/SHA, Custom Domain,
   DNS, zero routes, Access All-traffic policy, disabled `workers.dev`/previews,
   and unchanged Workers Builds state.
6. Check Workers CPU telemetry. Every acceptance invocation must remain within the
   **10 ms Workers Free CPU limit**. Reconcile requests and D1 rows/storage with
   the Free allowances and confirm projected cost remains $0.00.

If CPU cannot meet 10 ms, any charge/upgrade is requested, Access can be bypassed,
an endpoint is public, a binding/schema differs, or an unexpected resource appears,
stop. Do not upgrade the plan or improvise cleanup; request a separate owner
cost/plan or resource-specific rollback decision.

## Closeout evidence and prohibitions

Close only after sanitized before/after inventories, commands, Wrangler/Node
identity, D1 UUID and config hash, schema evidence, Worker version/SHA and binding,
Access negative/positive checks, route/domain evidence, synthetic acceptance,
CPU/usage/cost evidence, cleanup evidence, and explicit owner acceptance exist.

Never commit the production overlay, Cloudflare IDs, Access audience/team domain,
service-token material, API tokens, request authorization headers, or raw dashboard
billing evidence. Unset credentials at the end:

```bash
unset CLOUDFLARE_API_TOKEN CF_ACCESS_CLIENT_ID CF_ACCESS_CLIENT_SECRET
```

This runbook authorizes no DATA-S2 acquisition, provider integration, browser or
production-model read path, R2 use, cron, CORS, Google Sheets integration, plan
upgrade, or live mutation without its named separate approval gate.
