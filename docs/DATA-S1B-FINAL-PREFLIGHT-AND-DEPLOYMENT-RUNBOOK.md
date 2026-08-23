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
export VALIDATION_WORKER_NAME="teamsheet-data-platform-s1b-validation-20260822"
export WORKER_NAME="teamsheet-data-platform"
export DATA_HOST="data.fpltsheet.co.uk"
export VALIDATION_CONFIG="${HOME}/.local/share/teamsheet-tools/data-s1b/wrangler.validation.json"
export PRODUCTION_CONFIG="${HOME}/.local/share/teamsheet-tools/data-s1b/wrangler.production.jsonc"
export EVIDENCE_ROOT="${HOME}/.local/share/teamsheet-tools/data-s1b/evidence"

test "$("${NODE_BIN}" --version)" = "v24.15.0"
test "$("${NODE_BIN}" "${WRANGLER_JS}" --version)" = "4.125.0"
test -f "${DESIGN_CONFIG}"
test -f "${MIGRATIONS_DIR}/0001_shadow_data_foundation.sql"
mkdir -p "$(dirname "${VALIDATION_CONFIG}")" "$(dirname "${PRODUCTION_CONFIG}")" "${EVIDENCE_ROOT}"

resolve_authoritative_main() {
  git ls-remote https://github.com/priteshpatel390-del/FPL.git refs/heads/main |
    awk '$2 == "refs/heads/main" { print $1 }'
}

resolved_main="$(resolve_authoritative_main)"
"${NODE_BIN}" -e '
  if (!/^[0-9a-f]{40}$/.test(process.argv[1])) {
    throw new Error("authoritative main did not resolve to one commit SHA");
  }
' "${resolved_main}"
readonly EXECUTION_MAIN_SHA="${resolved_main}"
unset resolved_main

assert_execution_main() {
  test "$(git branch --show-current)" = "main"
  test -z "$(git status --porcelain=v1)"
  test "$(git rev-parse HEAD)" = "${EXECUTION_MAIN_SHA}"
  test "$(resolve_authoritative_main)" = "${EXECUTION_MAIN_SHA}"
}
assert_execution_main

CI_JSON="$(curl --fail --silent --show-error \
  --header 'Accept: application/vnd.github+json' \
  "https://api.github.com/repos/priteshpatel390-del/FPL/actions/runs?head_sha=${EXECUTION_MAIN_SHA}&status=success&per_page=100")"
CI_EVIDENCE="$(printf '%s' "${CI_JSON}" | "${NODE_BIN}" -e '
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", chunk => { input += chunk; });
  process.stdin.on("end", () => {
    const sha = process.argv[1];
    const runs = JSON.parse(input).workflow_runs || [];
    const exact = runs.find(run =>
      run.name === "Verify Teamsheet" &&
      run.head_sha === sha &&
      run.head_branch === "main" &&
      run.conclusion === "success"
    );
    if (!exact) throw new Error("no successful exact-main Verify Teamsheet run");
    process.stdout.write(`Verify Teamsheet run ${exact.id}: success`);
  });
' "${EXECUTION_MAIN_SHA}")"
readonly CI_EVIDENCE
unset CI_JSON
printf '%s\n' "${EXECUTION_MAIN_SHA}" | tee "${EVIDENCE_ROOT}/execution-main-sha.txt"
printf '%s\n' "${CI_EVIDENCE}" | tee "${EVIDENCE_ROOT}/execution-main-ci.txt"
```

`EXECUTION_MAIN_SHA` is the immutable execution baseline, not the historical
preflight baseline recorded at the top of this document. `assert_execution_main`
must run immediately before every mutation below. It stops on a detached,
non-`main`, dirty, stale, or drifted checkout; the exact-SHA API check stops when
Verify Teamsheet is not green on that same current `main` commit.

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
collision, a non-Free plan, or any unexplained resource. Run
`assert_execution_main` immediately before every mutation command.

## Phase 2 — disposable D1 validation

This phase needs its own explicit approval. Create exactly one disposable database:

```bash
assert_execution_main
"${NODE_BIN}" "${WRANGLER_JS}" d1 create "${VALIDATION_DB_NAME}"
```

Capture its UUID without exposing account identifiers, prove exactly one matching
database exists, and securely enter the exact returned value:

```bash
read -r -p "Disposable validation D1 UUID: " VALIDATION_DB_ID
export VALIDATION_DB_ID
case "${VALIDATION_DB_ID}" in
  ????????-????-????-????-????????????) ;;
  *) printf 'Invalid validation D1 UUID\n' >&2; exit 1 ;;
esac
```

Create this exact owner-controlled validation overlay outside the repository. It
has the deterministic temporary Worker name, DATA-S1 entry point, no public
hostname configuration, and exactly one binding to the captured disposable UUID:

```bash
cat > "${VALIDATION_CONFIG}" <<JSON
{
  "name": "${VALIDATION_WORKER_NAME}",
  "main": "/workspace/FPL/workers/data-platform/data-platform.mjs",
  "compatibility_date": "2026-08-22",
  "workers_dev": false,
  "preview_urls": false,
  "observability": { "enabled": true },
  "d1_databases": [{
    "binding": "TEAMSHEET_DATA_DB",
    "database_name": "${VALIDATION_DB_NAME}",
    "database_id": "${VALIDATION_DB_ID}",
    "migrations_dir": "/workspace/FPL/workers/data-platform/migrations"
  }]
}
JSON
chmod 600 "${VALIDATION_CONFIG}"
```

Before any use, reject placeholders, a malformed or mismatched UUID, a wrong
Worker/database/binding, an extra binding, or any route/Custom Domain key. Record
the accepted external overlay's SHA-256:

```bash
"${NODE_BIN}" -e '
  const fs = require("node:fs");
  const [path, worker, database, uuid] = process.argv.slice(1);
  const config = JSON.parse(fs.readFileSync(path, "utf8"));
  const db = config.d1_databases;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(uuid) || /[<>]/.test(uuid)) throw new Error("invalid UUID");
  if (config.name !== worker) throw new Error("wrong validation Worker");
  if (config.main !== "/workspace/FPL/workers/data-platform/data-platform.mjs") throw new Error("wrong entry point");
  if (config.workers_dev !== false || config.preview_urls !== false) throw new Error("public development endpoint enabled");
  if ("routes" in config || "route" in config || "custom_domain" in config) throw new Error("route or Custom Domain present");
  if (!Array.isArray(db) || db.length !== 1) throw new Error("binding count is not one");
  if (db[0].binding !== "TEAMSHEET_DATA_DB" || db[0].database_name !== database || db[0].database_id !== uuid) throw new Error("D1 binding mismatch");
  if (db[0].migrations_dir !== "/workspace/FPL/workers/data-platform/migrations") throw new Error("wrong migrations directory");
' "${VALIDATION_CONFIG}" "${VALIDATION_WORKER_NAME}" "${VALIDATION_DB_NAME}" "${VALIDATION_DB_ID}"
test "$(stat -c '%a' "${VALIDATION_CONFIG}")" = "600"
sha256sum "${VALIDATION_CONFIG}" | tee "${EVIDENCE_ROOT}/validation-config.sha256"
```

Apply the unchanged migration:

```bash
assert_execution_main
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
to the disposable UUID. Under separate approval, use this exact order:

1. Deploy the temporary validation Worker from the verified overlay with
   `--no-x-provision`; the overlay fixes `workers_dev: false`,
   `preview_urls: false`, no Workers Route, and no Custom Domain:

   ```bash
   assert_execution_main
   "${NODE_BIN}" "${WRANGLER_JS}" deploy \
     --no-x-provision --config "${VALIDATION_CONFIG}"
   ```
2. Immediately use read-only inventories to prove its binding has the disposable
   UUID and it has no route, domain, preview, or `workers.dev` endpoint.
3. On the now-existing temporary Worker, enable Worker-level Cloudflare Access for
   **All traffic**.
4. Create its dedicated validation service token and exactly one **Service Auth**
   policy whose sole Include rule is that token. Add no Allow, Bypass, human
   identity, public-health exception, or shared credential.
5. Verify through read-only inventory that Worker-level Access is active.
6. Only then attach any separately approved temporary validation hostname. Never
   reuse the production hostname.
7. Run the Access negative and positive checks before sending the synthetic
   fixture from the acceptance plan.

POST once for HTTP 201/`inserted`, replay byte-for-byte for HTTP 200/`existing`,
then change `value_boolean` with the same idempotency tuple for HTTP
409/`idempotency_conflict`. Verify replay immediately before `fetched_at` excludes
the row, replay at/after it includes it, and a quarantined row is excluded.

Delete the temporary Worker/Access resources and disposable D1 only under explicit
resource-specific approval and only after evidence capture. Re-run inventories to
prove removal. Any failed validation blocks production.

## Phase 3 — deterministic production D1

This phase needs separate approval after Phase 2 passes.

```bash
assert_execution_main
"${NODE_BIN}" "${WRANGLER_JS}" d1 create "${PRODUCTION_DB_NAME}"
```

Rerun D1 inventory and require exactly one `teamsheet-data`. Securely enter the
exact UUID returned by the create command and reject a malformed value:

```bash
read -r -p "Production D1 UUID: " PRODUCTION_DB_ID
export PRODUCTION_DB_ID
case "${PRODUCTION_DB_ID}" in
  ????????-????-????-????-????????????) ;;
  *) printf 'Invalid production D1 UUID\n' >&2; exit 1 ;;
esac
```

Generate `PRODUCTION_CONFIG` outside the repository using that exact value:

```bash
cat > "${PRODUCTION_CONFIG}" <<JSON
{
  "name": "${WORKER_NAME}",
  "main": "/workspace/FPL/workers/data-platform/data-platform.mjs",
  "compatibility_date": "2026-08-22",
  "workers_dev": false,
  "preview_urls": false,
  "observability": { "enabled": true },
  "d1_databases": [{
    "binding": "TEAMSHEET_DATA_DB",
    "database_name": "${PRODUCTION_DB_NAME}",
    "database_id": "${PRODUCTION_DB_ID}",
    "migrations_dir": "/workspace/FPL/workers/data-platform/migrations"
  }]
}
JSON
chmod 600 "${PRODUCTION_CONFIG}"
```

Before any dry-run, migration, or deployment, reject placeholders, malformed or
mismatched UUIDs, the wrong Worker/database/binding, extra bindings, public
development endpoints, routes, or Custom Domains. Record the verified external
overlay's SHA-256 and use its immutable hash to detect later changes:

```bash
"${NODE_BIN}" -e '
  const fs = require("node:fs");
  const [path, worker, database, uuid] = process.argv.slice(1);
  const config = JSON.parse(fs.readFileSync(path, "utf8"));
  const db = config.d1_databases;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const forbidden = ["routes", "route", "custom_domain", "custom_domains", "domain", "domains"];
  if (!uuidPattern.test(uuid) || /[<>]/.test(uuid)) throw new Error("invalid UUID");
  if (config.name !== worker) throw new Error("wrong production Worker");
  if (config.main !== "/workspace/FPL/workers/data-platform/data-platform.mjs") throw new Error("wrong entry point");
  if (config.workers_dev !== false || config.preview_urls !== false) throw new Error("public development endpoint enabled");
  if (forbidden.some(key => key in config)) throw new Error("route or Custom Domain present");
  if (!Array.isArray(db) || db.length !== 1) throw new Error("binding count is not one");
  if (db[0].binding !== "TEAMSHEET_DATA_DB" || db[0].database_name !== database || db[0].database_id !== uuid) throw new Error("D1 binding mismatch");
  if (db[0].migrations_dir !== "/workspace/FPL/workers/data-platform/migrations") throw new Error("wrong migrations directory");
' "${PRODUCTION_CONFIG}" "${WORKER_NAME}" "${PRODUCTION_DB_NAME}" "${PRODUCTION_DB_ID}"
test "$(stat -c '%a' "${PRODUCTION_CONFIG}")" = "600"
sha256sum "${PRODUCTION_CONFIG}" | tee "${EVIDENCE_ROOT}/production-config.sha256"
readonly PRODUCTION_CONFIG_SHA="$(sha256sum "${PRODUCTION_CONFIG}" | awk '{ print $1 }')"
assert_production_config() {
  test "$(sha256sum "${PRODUCTION_CONFIG}" | awk '{ print $1 }')" = "${PRODUCTION_CONFIG_SHA}"
}
assert_production_config
```

Then perform the non-mutating dry run (which is prohibited until specifically
approved) only from the verified overlay:

```bash
assert_execution_main
assert_production_config
"${NODE_BIN}" "${WRANGLER_JS}" deploy \
  --dry-run --no-x-provision --config "${PRODUCTION_CONFIG}" \
  --outdir "${EVIDENCE_ROOT}/production-dry-run"
```

Review the bundle and resolved binding, then rerun D1 inventory and prove no D1
was provisioned. Apply migration 0001 and repeat the schema/foreign-key/index
checks used for validation:

```bash
assert_execution_main
assert_production_config
"${NODE_BIN}" "${WRANGLER_JS}" d1 migrations apply "${PRODUCTION_DB_NAME}" \
  --remote --config "${PRODUCTION_CONFIG}"
```

## Phase 4 — production Worker, Access, and Custom Domain

This phase needs separate approval after the production schema passes.

1. Deploy the reviewed Worker with provisioning disabled. At this point the config
   must still have `workers_dev: false`, `preview_urls: false`, no Workers Route,
   and no Custom Domain:

   ```bash
   assert_execution_main
   assert_production_config
   "${NODE_BIN}" "${WRANGLER_JS}" deploy \
     --no-x-provision --config "${PRODUCTION_CONFIG}"
   ```

2. Immediately use read-only Worker, binding, domain, DNS, and route inventories
   to prove the deployed `teamsheet-data-platform` Worker has the exact production
   D1 UUID and has no externally reachable Workers Route, Custom Domain, Preview
   URL, or `workers.dev` endpoint. Rerun D1 inventory and stop for a separate
   rollback decision if any second database exists or the live binding differs.
3. In **Workers & Pages**, select the now-existing `teamsheet-data-platform`
   Worker, open **Access**, and enable Worker-level Cloudflare Access for **All
   traffic**.
4. Create one new, dedicated DATA-S1 Service Token and exactly one **Service Auth**
   policy whose sole Include rule is that token. Do not add Allow, Bypass, human
   identity, public-health exception, shared archive credentials, or browser
   credentials. Securely retain the client ID and one-time-displayed secret.
5. Verify through read-only inventory that Worker-level Access is active for **All
   traffic** before attaching any hostname. Failure or ambiguity is a hard stop.
6. Only then, in Workers & Pages, add exactly one Worker Custom Domain,
   `data.fpltsheet.co.uk`, to `teamsheet-data-platform`. Do not add a Workers
   Route, `workers.dev` hostname, Preview URL, or second public hostname.
7. Wait for active DNS/TLS and verify through read-only inventories that the
   Custom Domain exists, there is still no Workers Route, `workers_dev` and
   previews are disabled, and Access covers all Worker traffic.
8. Perform the negative and positive Access checks in Phase 5 before any synthetic
   production write.

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
