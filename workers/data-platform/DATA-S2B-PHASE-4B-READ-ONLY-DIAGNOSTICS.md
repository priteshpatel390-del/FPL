# DATA-S2B Phase 4B — bounded read-only production diagnostics

## Why this exists

DATA-S2B production acceptance had fallen into a one-failure-per-merge pattern. The Phase 4B
preflight validated one exact repository expectation at a time and threw on the first
mismatch, so every stale constant consumed a whole protected run, a pull request, a merge and
an exact-head Verify cycle before the next mismatch could even be seen. Run `33620632272`
stopped at `phase4b_preflight_active_version_drift`; after that correction merged, run
`33622647158` stopped at `phase4b_cron_drift`. Neither run ever reached D1, so none of the
substantive acceptance facts were gathered.

This checkpoint replaces that loop with a single bounded read-only diagnostic pass:

> one bounded diagnostic run -> one complete evidence bundle -> one consolidated correction.

The existing `phase4b/preflight.mjs` is **unchanged and retained**. It remains the strict
fail-closed gate. The diagnostic is an additional, separately dispatched read that answers
questions; it never becomes the acceptance gate itself.

## What it is

Two repository-only modules and one manual workflow:

| File | Role |
|---|---|
| `phase4b/diagnostics-contract.mjs` | Pure contract: endpoint allowlist, pinned SQL allowlist, bounded extractors, seventeen status-matrix classifiers, sanitized report builders. Owns no transport. |
| `phase4b/readonly-diagnostics.mjs` | Runner: identity gates, bounded reads, per-check guarding, sanitized step summary and JSON artifact. |
| `.github/workflows/data-s2b-phase4b-readonly-diagnostics.yml` | Manual-only, exact-current-`main`, exact-head-Verify gated, protected `data-s2b-phase3-deployment` environment. |

## Read-only by construction

There is no mutation surface to reach, rather than a mutation surface that is declined:

- `assertReadOnlyDiagnosticRequest()` permits exactly seven GET paths
  (`/deployments`, `/versions?deployable=true`, `/versions/{uuid}`, `/schedules`, `/settings`,
  account `/workers/domains`, and D1 `?fields=uuid,name,file_size`) plus one POST, the D1
  `/query` read endpoint. Everything else — including `PUT /schedules`, any Version upload,
  any Deployment creation, Access, secrets, D1 `time_travel` and D1 deletion — raises the
  fatal `diagnostics_endpoint_forbidden`.
- `assertAllowedDiagnosticSql()` accepts only the fourteen pinned statements by **raw text**.
  A re-spaced, comment-prefixed or comment-suffixed variant is refused even when it would
  normalise to an allowlisted statement, so no SQL can be smuggled through comment stripping.
- No collector, upload, deployment or cron-activation module is imported, and there is no
  cleanup, teardown, sleep or retry construct anywhere in either file. Because no mutation is
  reachable, there is no ambiguous-mutation state to retry after.
- The runner writes only to `GITHUB_STEP_SUMMARY` and its sanitized JSON artifact path.

Permanent tests in `tests/data-s2b-phase4b-readonly-diagnostics.test.mjs` assert each of these.

## Fail closed versus continue

The whole point of the change is that these two categories are now separated.

**Stops the run immediately** (fatal, `DiagnosticFatalError`, non-zero exit, bounded code only):

- repository identity missing (`APPROVED_SHA` absent or malformed);
- production account ambiguity — missing account, malformed fingerprint, a supplied
  `PRODUCTION_ACCOUNT_FINGERPRINT` that does not match, or the failure of any
  identity-critical read;
- Worker identity mismatch — wrong Worker name, or Custom Domain hostnames that are not
  exactly `data.fpltsheet.co.uk`;
- database identity mismatch — the active Version's D1 binding, or the returned database
  uuid/name, differing from the pinned production database;
- an endpoint outside the allowlist, or SQL outside the pinned set;
- HTTP 401/403 from the control plane;
- a malformed or unbounded provider response (every collection is capped before it is read);
- secret exposure risk — a `secret_text` binding that carries a value, or any retained output
  that would contain a live credential, the account identifier or the database identifier;
- any condition that would require a mutation to continue.

**Recorded as evidence and the read continues** (everything else):

A stale repository expectation is now data, not an abort. If the live Cron is `0 1 * * *`
while the repository expects `*/30 * * * *`, the bundle records
`cron_triggers: FAIL, classification=daily_only` and
`collector_cadence: FAIL, collector_guard=cron_unrecognised_no_collection`, then continues
into every D1, consistency, bookkeeping and boundary read. The schedule is neither mutated
nor silently accepted. Likewise an active Worker Version that differs from the repository pin
is recorded as `SUPERSEDED` with both identities named, not treated as a stop.

Identity is taken from the genuinely active Version, never from the repository pin. That is
what makes a stale pin survivable: the pin becomes an assertion about production instead of
the address used to reach it.

## The evidence bundle

One sanitized status matrix with `PASS` / `FAIL` / `PARTIAL` / `PENDING` / `SUPERSEDED` for
seventeen rows: `worker_version_deployment`, `cron_triggers`, `collector_cadence`,
`fetch_transport`, `bootstrap_static_evidence`, `fixtures_evidence`, `season_validation`,
`baseline_ingestion`, `unchanged_cycle_proof`, `changed_fact_proof`,
`d1_observations_heads_orphans`, `ingestion_bookkeeping`, `cpu_resource_suitability`,
`d1_accounting`, `rollback_stop_evidence`, `observability` and
`provider_data_security_boundaries`. A check that produces no result is reported `PENDING`;
a row is never dropped from the bundle.

Two proofs deserve their exact definitions, because both are easy to overclaim:

- **Unchanged cycle** is `PASS` only when a *completed* run genuinely saw records
  (`records_seen > 0`), accepted none (`records_accepted = 0`), wrote no observation, and
  moved no head. A completed run with zero acceptance that nonetheless owns observations is
  `PARTIAL`, and the absence of such a run is `PENDING` — never an assumed pass.
- **Changed fact** is `PASS` only when at least one logical key holds more than one retained
  observation, a head points at the latest of those observations, and more than one completed
  run has internally consistent appended bookkeeping. Otherwise `PARTIAL` or `PENDING`. No
  Official FPL data is manufactured or mutated to produce this proof.

## What the read cannot provide

Worker CPU time, D1 rows read, D1 rows written and Cron invocation counts are **not available**
through the approved read surface. They live behind the GraphQL analytics API, which is a
different endpoint with a caller-supplied query body. Adding it would widen this diagnostic's
permissions, so it was deliberately not added: `cpu_resource_suitability` reports `PENDING`
and names each unavailable metric explicitly. The only proxies offered are completed-run
wall-clock durations — which are not CPU time — and the D1 `file_size` byte total.

Current first-party limits were re-verified from Cloudflare documentation on
**2 September 2026** rather than inherited from older records, and are reported as context
only:

| Limit (Workers Free) | Current value |
|---|---|
| CPU time per Cron Trigger invocation | 10 ms |
| Requests per day | 100,000 |
| D1 rows read per day | 5,000,000 |
| D1 rows written per day | 100,000 |
| D1 storage | 5 GB total |

One change is material and new. **From 1 September 2026 Cloudflare enforces the D1 free-tier
daily row read and row write limits**: queries fail until midnight UTC once an account
exceeds them, through both the Workers binding API and the REST API. Stored data is
unaffected. This raises the significance of the unavailable row metrics, and it shaped the
diagnostic's own query plan — the run ledger scans `shadow_observations` once and reaches
`observation_heads` through its `logical_key` primary key rather than re-scanning per run.

## Sanitization

Retained output carries no token, no `Authorization` header, no raw Cloudflare response, no
unrestricted error message, no account or database identifier, no arbitrary SQL, no arbitrary
schedule field and no nested provider structure. Every emitted value passes a structural
sanitizer first (`[invalid]` replaces anything that does not match), evidence entries are
capped in both count and length, and `assertSanitizedOutput()` then checks the finished
report and JSON against the live credential values before either is written. A non-fatal
check failure degrades to a bounded `FAIL` row carrying `detail=[withheld]`; the underlying
error text is never retained.

## Boundary

This checkpoint is repository-only. It performs no Cloudflare request, no Worker upload or
deployment, no Cron mutation, no D1 mutation, no collector invocation, no cleanup, no
credential or environment change and no plan change. It changes no model, provider, fixture,
squad, transfer, captaincy, rank, Mini-League, retention or redistribution behaviour.

A completed diagnostic bundle means the read finished and the evidence was gathered. It is
**not** DATA-S2B production acceptance. After an owner-approved merge and a passing exact-head
Verify, one protected dispatch should produce the entire remaining read-only acceptance
bundle in a single pass; the consolidated correction is then prepared from that bundle, with
stale repository assumptions separated from genuine production defects.
