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

## Executed run — 33644480107, 2 September 2026

The consolidated read was dispatched from exact `main`
`c5db7629d0f7bb7e5d88b8e4b5a4d5fba495370e`, whose exact-head Verify Teamsheet run
`33643906698` had passed. The repository gate passed, the owner approved the protected
`data-s2b-phase3-deployment` environment, and the diagnostic completed without a fatal stop.
All twenty-two reads returned `PASS`, including the Worker health check
(`HTTP 200, ok, shadow_only`). Artifact `data-s2b-phase4b-readonly-diagnostics`, ID
`9852654244`, 2,555 bytes, digest
`sha256:f16d1e6b2d5915bccd20b9821def4b05e2e14ab1f93c4d813cad132f5837d699`.

The design goal was met: one dispatch produced the whole remaining read-only bundle instead
of aborting at the first mismatch. The bundle outcome is `FAIL`, which names the production
state — not a malfunction of the read.

| Row | Status | Decisive evidence |
|---|---|---|
| `worker_version_deployment` | PASS | active `222e62d5-9979-468d-9c54-b97f903d58f6` equals the repository pin, 100% traffic, deployment `37cecd53-30a1-4f6b-a4fd-c1f8cd3618bf`, compatibility date `2026-08-22`, no issues |
| `cron_triggers` | **FAIL** | `schedule_count=0`, `expressions=none`, `classification=absent` |
| `collector_cadence` | **FAIL** | `collector_accepts_live_schedule=false`, `collector_guard=cron_unrecognised_no_collection` |
| `fetch_transport` | PASS | 1 completed run, 2 retained redirect-class failures, none after the latest completed run |
| `bootstrap_static_evidence` | PASS | events 38/114, teams 20/200, players 626/6,886; no unexpected categories |
| `fixtures_evidence` | PASS | fixtures 380 subjects / 2,660 observations |
| `season_validation` | PASS | canonical seasons `2026-27` only; Worker binding `2026-27` |
| `baseline_ingestion` | PASS | 3 official runs (completed 1, failed 2), 9,860 observations, 9,860 heads, no unresolved started run |
| `unchanged_cycle_proof` | PENDING | no completed run yet reports zero acceptance |
| `changed_fact_proof` | PENDING | no logical key holds more than one retained observation |
| `d1_observations_heads_orphans` | PASS | 9,860 observations / 9,860 heads / 9,860 distinct logical keys, 0 orphans, 0 non-accepted, no breaches |
| `ingestion_bookkeeping` | PASS | seen 9,860, accepted 9,860, quarantined 0, rejected 0, no rejection reasons, no breaches |
| `cpu_resource_suitability` | PENDING | CPU, rows read, rows written, invocation counts all NOT AVAILABLE; only proxy is 338 ms completed-run wall clock |
| `d1_accounting` | PARTIAL | 10,309,632 bytes, 7/7 tables, both migrations applied, governance 1/1, no breaches |
| `rollback_stop_evidence` | PASS | 11 deployable rollback targets, both expected retained versions present, both failed runs wrote nothing |
| `observability` | PARTIAL | observability enabled, head sampling 1, logpush false, 2/2 failed runs retained an error class |
| `provider_data_security_boundaries` | PASS | `official-fpl`, `durable_allowed`, retention 1, redistribution 0, shadow ingest 1, `shadow_only`, `official_fpl_public_core`, no breaches |

### The single genuine production defect: Cron triggers are absent

The live Worker carries **no Cron triggers at all**. This is materially worse than the drift
the earlier preflight suspected: the collector requires the exact string `*/30 * * * *`
(`official-fpl-history.mjs`, `DATA_S2_COLLECTION_CRON`) and skips every other schedule as
`cron_unrecognised`, but an absent schedule means the `scheduled()` handler is never invoked
at all. **Scheduled collection has stopped.** The repository expectation is not stale: it is
exactly what the deployed collector requires, and the `FAIL` is correct.

The retained ledger dates the stop. Three runs sit exactly 1,440 minutes apart, and the sole
completed run is the first one after the redirect remediation was promoted, so the schedule
fired on 30 August (failed, redirect), 31 August (failed, redirect) and 1 September
(completed, 9,860 records). No run exists for 2 September, and the read at 14:59 UTC that day
found no schedule. **The triggers were therefore removed between 01:00 UTC on 1 September and
01:00 UTC on 2 September.**

No repository automation accounts for that removal. `data-s2b-phase4b-cron-activation.yml` is
the only Cron-mutating workflow and it has run exactly once, successfully, on 29 August
(`33238530138`), setting the expected schedule. The Phase 4B version upload (`33432353930`)
and deployment (`33433195713`) both precede the 1 September collection that the schedule
still drove, so neither removed it. Every E2C-B run in the window targeted the disposable
database, not the production Worker. Cloudflare documents that a Wrangler deploy replaces
triggers and that `crons: []` removes them, but this repository mutates schedules only
through the pinned REST call, never Wrangler. **The cause is therefore outside this
repository's automation and is not established by available evidence** — most plausibly a
manual dashboard action. It must not be guessed at in either direction.

Restoring the schedule is a production Cron mutation and remains an explicit owner gate. It
is not performed, proposed as automatic, or worked around here.

### What the baseline does and does not prove

The completed run is the genuine populated baseline DATA-S2B required: 9,860 observations
reconcile exactly against 9,860 heads and 9,860 distinct logical keys with zero orphans, zero
quarantine and zero rejections, and the four category totals (114 + 200 + 6,886 + 2,660) sum
to exactly 9,860. The redirect remediation is proven in production: the only completed run
post-dates both retained redirect-class failures, and no redirect failure follows it. Both
failed runs wrote nothing, so fail-closed behaviour is proven on live evidence.

It does **not** prove the unchanged cycle or the changed-fact path. Both need a *second*
successful collection, and neither can occur while the schedule is absent. Those two rows are
correctly `PENDING`, and no amount of repository work can advance them.

One inference is available on CPU and should be stated at its true strength. The baseline run
committed 9,860 observations and completed rather than being terminated; had it exceeded the
10 ms Workers Free CPU ceiling, Cloudflare would have killed it as `exceededCpu`. That is
*behavioural* evidence the collector fits the free-plan CPU limit for a full baseline. It is
not a measurement, and `cpu_resource_suitability` stays `PENDING` for exact figures. On the
newly enforced D1 free-tier write limit, a baseline of roughly 9,860 observations plus 9,860
head upserts plus 1,064 canonical entities is on the order of 21,000 rows written against
100,000 per day, and an unchanged cycle writes only its run row — comfortable, but inferred
from retained counts rather than measured.

### Two rows cannot reach PASS by construction

`d1_accounting` returns `PARTIAL` whenever no breach is present and a database size is
available, and `observability` returns `PARTIAL` whenever a run ledger exists and either
observability is enabled or failure classes are retained. Neither has a reachable `PASS`
branch while first-party CPU and row metrics stay unavailable. Because `overallOutcome()`
degrades to the worst row, **the bundle can never report `PASS`**, even with a perfect
production state and both pending proofs satisfied.

That is a deliberate consequence of declining to widen the endpoint scope, not a defect, and
it is recorded here rather than quietly relaxed. It does mean DATA-S2B cannot be closed as a
full `PASS` on this matrix without an owner decision: either approve a bounded GraphQL
analytics read surface, or define acceptance in terms of per-row statuses with those two rows
accepted as permanently `PARTIAL`. Changing the thresholds unilaterally would weaken
acceptance, so no such change is made.

### Account fingerprint was not cross-checked

The run reported `Production account fingerprint cross-check: NOT PROVIDED`, because the
repository variable `CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT` is unset. Identity still held
through the Worker name, the sole Custom Domain hostname, the active Version's D1 binding and
the returned database uuid and name, all of which matched. Setting that variable would add
the independent account cross-check that E2C-B made mandatory for the disposable experiment,
and is an owner action.

### Bundle retrieval

The bundle was gathered but could not be read back without a manual copy: artifact downloads
are served from a storage host that an agent session's egress policy may refuse, and a step
summary has no read API. The runner now also echoes the already-sanitized report to stdout
between `----- BEGIN DATA-S2B PHASE 4B DIAGNOSTIC REPORT -----` and its matching `END`
marker, so the job log — reachable through the ordinary API — carries a third legible copy.
It is the same string the artifact and step summary receive, emitted after the same
`assertSanitizedOutput()` clearance, so it widens legibility and not exposure. Permanent
tests pin the echo to the sanitized binding, forbid it from re-deriving the report or
serialising the JSON, and re-assert that credentials and identifiers still trip the sanitizer
through the wrapped form.
