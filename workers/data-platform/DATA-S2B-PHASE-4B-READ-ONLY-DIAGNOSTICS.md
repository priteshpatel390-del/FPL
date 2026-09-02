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

### Cron triggers are absent because collection was intentionally stopped

The live Worker carries no Cron triggers (`schedule_count=0`, `classification=absent`).
**This is an intentional owner safety stop, not drift and not an unexplained defect.** An
earlier reading of this bundle characterised it as an unexplained production defect and
proposed restoring the schedule; that reading was wrong and is corrected here.

**Owner-provided historical fact, not recorded in this repository at the time of the stop.**
The production scheduled collector was observed using approximately **630 ms of Worker CPU**.
The Cron trigger was then deliberately removed so it would not fire again at approximately
01:00 UTC and risk breaching the Free-tier resource constraints. The disposable E2 programme
and the GitHub Actions machinery were undertaken specifically to obtain a safer way to
validate and progress the collection path without repeatedly executing the
resource-problematic production Cron collector. The 630 ms measurement and the executed stop
are **owner-provided facts**; neither is documented in the repository, and neither is
inferable from the retained evidence. That documentary gap is recorded here rather than
back-filled with invented evidence.

**Repository evidence corroborating the decision as the pre-registered procedure.** The stop
was not improvised — the repository had already defined it, three times over:

- [`DATA-S2A-OFFICIAL-FPL-STRUCTURED-HISTORY.md`](DATA-S2A-OFFICIAL-FPL-STRUCTURED-HISTORY.md)
  §"Important Free-plan CPU limitation" pre-registered the rule: DATA-S2A "cannot prove" a
  real baseline stays inside the 10 ms Cron CPU ceiling, and "if the exact Free-plan Cron
  exceeds the CPU ceiling, activation stops. The project must then redesign/split the
  collector or separately approve a paid Workers decision".
- [`DATA-S2B-LIVE-DEPLOYMENT-ACCEPTANCE-PLAN.md`](DATA-S2B-LIVE-DEPLOYMENT-ACCEPTANCE-PLAN.md)
  §"After Cron activation" specifies that when collection is "over CPU/resource limits" the
  first action is to "remove/disable the DATA-S2 Cron", and the fourth is to "preserve D1
  evidence for diagnosis rather than deleting history".
- [`DATA-S2B-PHASE-4A-CADENCE-PREPARATION.md`](DATA-S2B-PHASE-4A-CADENCE-PREPARATION.md)
  step 11 requires stopping Cron immediately on CPU/resource failure, and states plainly that
  "Cron removal is the first stop action".

The observed production state matches that procedure exactly: schedule empty, Worker left
deployed and healthy, D1 history preserved rather than deleted. The same plan already defines
**NO-GO — FREE LIMITS** as a legitimate acceptance outcome, so an over-limit collector was
always an anticipated result rather than a surprise.

The retained ledger is consistent with the stop and dates it. Three runs sit exactly 1,440
minutes apart, and the sole completed run is the first after the redirect remediation was
promoted: 30 August (failed, redirect), 31 August (failed, redirect), 1 September (completed,
9,860 records). No run exists for 2 September, and the read at 14:59 UTC that day found no
schedule, so the trigger was removed between 01:00 UTC on 1 and 2 September — immediately
after the one collection that produced the CPU observation.

**The schedule must not be restored** until a resource-safe execution architecture is
resolved and explicitly approved. Restoring it is a production Cron mutation and is neither
performed nor recommended here.

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

An earlier draft of this record inferred from the baseline completing that the collector fits
the 10 ms Workers Free CPU ceiling. **That inference was wrong and is withdrawn.** Cloudflare
documents that each isolate carries "some built-in flexibility to allow for cases where your
Worker infrequently runs over the configured limit", and terminates execution only once a
Worker "starts hitting the limit consistently". A single run can therefore complete while
substantially over the ceiling, which is exactly what happened: the owner observed
approximately 630 ms of CPU, roughly sixty-three times the 10 ms Cron Trigger allowance on
Workers Free. Completion is evidence of isolate tolerance, not of fitness. `cpu_resource_suitability`
stays `PENDING` for exact figures, and the collector is to be treated as over-limit for
sustained scheduled operation. On the
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

## Execution architecture — decision proposal (approval required, nothing implemented)

### Problem

The deployed Worker collector is over the Free-plan CPU ceiling for sustained scheduled
operation: approximately 630 ms observed against a 10 ms Cron Trigger allowance. Correctness
is not in question — the data path produced a clean 9,860-record baseline. Only the
**execution mechanism** is unresolved.

### Which limits apply, and to whom

Re-verified from first-party Cloudflare documentation on 2 September 2026:

| Limit | Value (Workers Free) | Applies to a Worker invocation | Applies to D1 REST from GitHub Actions |
|---|---|---|---|
| CPU time per Cron Trigger | 10 ms | **Yes** | **No** — no Worker is invoked |
| CPU time per HTTP request | 10 ms | Yes | No |
| D1 queries per Worker invocation | 50 | Yes | No |
| Worker requests per day | 100,000 | Yes | No |
| D1 rows read per day | 5,000,000 | Yes | **Yes** |
| D1 rows written per day | 100,000 | Yes | **Yes** |
| D1 storage | 5 GB total | Yes | **Yes** |
| Cloudflare API rate limit | 1,200 requests / 5 min, cumulative per user | No | **Yes** |

The decisive distinction: **a D1 REST call reaches `api.cloudflare.com` and then D1 directly;
it never invokes this account's Worker, so it consumes no Workers CPU.** The parsing,
validation, diffing and SHA-256 identity work moves to the GitHub runner, which is where the
630 ms currently lands. D1's own internal query-CPU guard is a separate and far larger budget
aimed at multi-gigabyte scans; E2's 9,860-row workload did not approach it.

What does **not** change with caller: the D1 row read/write/storage limits, which since
1 September 2026 fail the query outright rather than merely being billed. Those apply to the
Workers Binding API and the REST API alike.

### Options

**Option 1 — restore Cloudflare Cron unchanged.** Rejected. It re-creates the exact condition
the stop was executed to prevent, at roughly sixty-three times the ceiling. Cloudflare
terminates a Worker that hits the limit consistently, so this converts a clean baseline into
recurring `exceededCpu` failures. The repository's own pre-registered rule forbids it without
either a redesign or a separately approved paid decision.

**Option 2 — optimise the Worker, then restore Cron.** Technically open but a poor fit. The
gap is not marginal: 630 ms to under 10 ms is a ~63× reduction, across work that is
irreducibly proportional to ~9,860 observations (JSON parse of two Official FPL payloads,
allowlist validation, diff against current heads, deterministic SHA-256 per observation).
Splitting collection into many small sub-invocations would need chunked state, partial-run
bookkeeping and a many-invocation schedule — substantially more new production machinery than
Option 3, and each chunk would still carry the 50-queries-per-invocation binding limit. It
also cannot be proven without repeatedly running the very collector the stop was meant to
prevent.

**Option 3 — GitHub Actions scheduled collection through the validated D1 REST path.**
Recommended. This is what the E2 programme was for, and most of it already exists:

| Capability | Status |
|---|---|
| Official FPL collection expressed as bounded D1 REST plans | **Exists** — `official-fpl-d1-rest-plan.mjs`: source-revision read, run read, current-heads read, start-run, fail-run, complete-unchanged, commit batch |
| Bounded REST transport | **Exists** — `d1-rest-client.mjs`, 16 MB request cap, `{batch:[…]}` shape, 401/403/429 classification, result-contract check |
| Statement/parameter/size bounds | **Exists** — 40 statements, 100 bound parameters, 100 KB SQL, 2 MB per value |
| Live proof at production scale | **Exists** — E2 wrote 9,860 records; W01 serialised request 2,378,807 bytes, ~15% of the 16 MB cap |
| SQLite `ON CONFLICT` compatibility | **Exists** — the `WHERE true` disambiguator fix |
| Protected manual workflow pattern | **Exists** — exact-SHA, exact-Verify, protected environment |
| Ambiguity/no-retry policy | **Exists** — reconcile-then-stop, never silent retry |
| **Scheduling** | **Missing** — every workflow is `workflow_dispatch` only |
| **Production runner** | **Missing** — the REST plan is imported only by tests and E2; no Worker or workflow calls it in production |
| **Official FPL fetch on the runner** | **Missing** — fetch currently lives in the Worker collector |

The repository is public, so GitHub Actions minutes are unlimited and free; a daily job of a
minute or two costs nothing and introduces no paid infrastructure.

### Recommendation

**Option 3.** It is the only option that removes the binding constraint rather than fighting
it, it reuses machinery already proven live at exactly the required scale, and it keeps the
Worker deployed and healthy as the read/health surface without granting it a schedule.

### Free-tier analysis under Option 3

A baseline writes roughly 9,860 observations + 9,860 head upserts + 1,064 canonical entities
≈ 21,000 rows, against 100,000/day. An unchanged cycle writes only its run row. Reads are
roughly one heads scan (~9,860 rows) per cycle against 5,000,000/day. A cycle needs on the
order of ten REST calls against 1,200 per five minutes. Storage is 10.3 MB against 5 GB.
Every dimension has wide headroom; the previously binding constraint — Worker CPU — is
removed entirely rather than merely reduced.

### Risks and fallbacks

- **Ambiguous write.** The existing reconcile-then-stop policy is retained unchanged: never a
  silent retry after an ambiguous mutation; read back and stop.
- **Scheduled-workflow reliability.** GitHub delays `schedule:` runs under load and disables
  them after 60 days of repository inactivity. Collection cadence therefore becomes
  best-effort rather than guaranteed — acceptable for a shadow-only history, and the retained
  run ledger makes a missed cycle visible rather than silent.
- **GitHub outage.** A missed cycle. The next cycle re-derives from current Official FPL
  state; nothing is lost because the history is append-only.
- **Official FPL outage.** Existing fail-closed behaviour: the run is recorded failed with an
  error class and writes nothing, exactly as the two retained redirect failures did.
- **D1 daily limit reached.** Since 1 September 2026 the query fails outright. Treated as a
  fail-closed run, not a retry.
- **Credential exposure.** A D1 write token in Actions is a materially wider capability than
  today's read token and is the principal new risk, mitigated below.

### Security

Collection would need a D1 write-scoped Cloudflare API token, held as a secret in a protected
environment with owner approval, never printed, and masked as the existing workflows already
do. It must be scoped to the single production database and must not carry Worker upload,
deployment, Cron or Access permissions. This is a genuine widening of what Actions can do to
production data and is the main reason this proposal is an approval gate rather than an
implementation.

### Acceptance plan under Option 3

The requirement for a second **Cron** cycle is superseded; the substance of each proof is not.

1. **Second successful collection** — one scheduled Actions cycle completing through the REST
   path, appending a run and reconciling counts.
2. **Unchanged-cycle proof** — that cycle sees records, accepts none, writes no observation
   and moves no head; the existing `classifyUnchangedCycle` contract is unchanged.
3. **Changed-fact proof** — a later cycle where an Official fact genuinely moves, producing a
   second observation on a logical key and an advanced head; still never manufactured.
4. **Resource proof** — replaces CPU suitability with the accounting that actually governs:
   D1 rows written and read per cycle, from the REST `meta` object each response already
   carries, plus storage. This closes `cpu_resource_suitability` honestly by making it
   inapplicable rather than unmeasurable, and needs no GraphQL analytics surface.
5. **Closeout** — a fresh consolidated read-only diagnostic bundle covering all seventeen rows.

### Proposed implementation scope, if approved

Add a scheduled-plus-manual Actions workflow and a bounded production collection runner that
fetches the two fixed Official FPL endpoints on the runner, normalises through the existing
canonical modules, and commits through the existing `official-fpl-d1-rest-plan.mjs` and
`d1-rest-client.mjs`. Reuse the existing identity gating, sanitization and reconcile-then-stop
policy. Add permanent tests. Record the resource evidence from REST `meta`.

### Explicit exclusions

No provider added. No paid infrastructure or plan upgrade. No Cloudflare Cron restored or
mutated. No Worker uploaded, deployed or given a schedule. No GraphQL analytics surface. No
change to the Official FPL endpoint allowlist, the shadow-only boundary, retention or
redistribution rights, or any model, fixture, captaincy, squad, transfer, simulation, rank or
Mini-League behaviour. No acceptance criterion weakened: each proof above retains its existing
contractual definition.

### One acceptance constant would need owner approval to change

`EXPECTED_CRON` (`live-contract.mjs`) and the Wrangler `triggers.crons` entry both still
assert `*/30 * * * *` as the intended production schedule. Under the intentional stop that
assertion is no longer true, which is why `cron_triggers` reports `FAIL` and
`collector_cadence` reports `cron_unrecognised_no_collection`. Those rows are factually
correct about the live state and are **not** changed here.

- **Existing requirement:** production must carry exactly `*/30 * * * *`.
- **Proposed replacement:** while the resource-safety stop stands, the expected production
  Worker schedule is *empty*, and the two rows report the stop as an approved state rather
  than a failure.
- **Evidence:** the stop is the pre-registered DATA-S2A/Phase-4A/Phase-plan procedure for an
  over-CPU collector, and the plan already defines NO-GO — FREE LIMITS.
- **Trade-off:** it stops the bundle reporting a permanent false failure, but it also removes
  a loud signal that production is not collecting. Mitigated by making the rows report the
  stop explicitly rather than silently passing.

This is a change to an acceptance constant, so it is proposed and not applied.
