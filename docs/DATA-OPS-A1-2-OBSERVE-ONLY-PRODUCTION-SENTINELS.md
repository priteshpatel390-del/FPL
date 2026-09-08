# DATA-OPS-A1.2 — Observe-only production sentinels

Status: **MERGED IN PR #231**
Baseline: `47345a7035eba0071c66dcab778f0edc9fef4048` (merge of PR #230 / DATA-OPS-A1.1)

## Outcome and boundary

A1.1 gave the Autonomous Data Steward a deterministic control plane: incident classification,
evidence binding, an action registry, a fail-closed policy engine and an audit contract, with no
network, no credential, no SQL and no actuator. A1.2 gives it **eyes, not hands**.

It adds three narrowly bounded, read-only observation domains under
`workers/data-steward/sentinels/`, so Teamsheet can deterministically answer one question:

> Did the expected production data-collection chain operate correctly, and is the resulting
> production data current and internally consistent?

A1.2 remains **Class 0 / observe-only**. There is no remediation, no mutation, no AI decision-maker,
no scheduler activation and no new autonomy class. Merging it deploys nothing, arms nothing,
provisions no credential and changes no production behaviour.

## The chain being observed

A1.2 observes the DATA-S2C chain **as it actually is**, and does not redesign it:

```
Cloudflare Cron → isolated dispatcher Worker → GitHub Actions workflow B
  → repository gate → opportunity guard → Official FPL collection → production D1
```

Cloudflare is the sole automatic clock. GitHub Actions is the execution engine. Workflow C remains
the attended recovery path. **There is no Cloudflare Workflow anywhere in this chain**, and a
permanent test refuses any A1.2 module that speaks of one.

The permanent cron declaration is exactly `17 1 * * *`, `17 2 * * *` and `17 3 * * *`, UTC. Those
are **three opportunities, not three collections**: the fail-closed opportunity guard permits at
most one production collection per UTC day.

## The correction this checkpoint exists to make

A workflow B run whose overall conclusion is `failure` is **not** evidence of a production failure.
The live T2 acceptance proved the opposite: run `34209137195` failed precisely because the
repository gate refused an already-consumed day with
`OPPORTUNITY_CONSUMED (automatic_collection_consumed)` and `collect` was correctly skipped. That is
the guard working.

A1.2 therefore never classifies on `run.conclusion`. Job and step outcomes identify only a candidate
refusal: the `repository-gate` guard step failed after successful prior steps and `collect` skipped.
That shape is called `REFUSED_OPPORTUNITY_CONSUMED` only after a bounded read of that exact gate job's
log independently proves one exact allowlisted `OPPORTUNITY_CONSUMED` result. A failed guard step by
itself proves nothing semantic and never wears the healthy label.

## The three sentinels

### GitHub sentinel — `github-sentinel.mjs`

Reads, all `GET`: the `main` ref; the exact-head `Tests and deterministic build` check runs; the
governed run listings for workflow B and workflow C; the `filter=all` job listing of each run; and,
only for a metadata-proven candidate guard refusal, that exact `repository-gate` job's log.
It decodes strictly — a truncated, over-full or malformed page is refused rather than interpreted —
and reduces every run to a closed outcome: `COLLECTED`, `COLLECT_FAILED`,
`REFUSED_OPPORTUNITY_CONSUMED`, `GUARD_AMBIGUOUS`, `GUARD_CONTRADICTORY`,
`GATE_REFUSED_OTHER`, `IN_FLIGHT` or `UNCLASSIFIED`.

The job log has no generic reader or search interface. Declared and actual response bytes are capped
at 256 KiB. Parsing accepts one whole line only, with GitHub's optional canonical UTC prefix and the
exact machine output emitted by `run-opportunity-guard.mjs`; only current classification/reason pairs
are allowlisted. Raw bytes are reduced immediately to `CONSUMED`, `AMBIGUOUS` or `AVAILABLE` and then
discarded. Raw or unrelated log text never enters an envelope, incident, audit record or persistent
state. Missing, malformed, duplicate, contradictory, unknown and future vocabulary, invalid UTF-8,
oversize data and retrieval failure all fail closed. `AMBIGUOUS_REQUIRES_OWNER_ATTENTION`, including
API/read failure reasons, never becomes consumed; `AVAILABLE` contradicts a failed step and is a
non-healthy gate refusal.

`GUARD_AMBIGUOUS` and `GUARD_CONTRADICTORY` are hard RED conditions before collection health is
considered. An earlier successful collection cannot forgive a later production-control-plane
ambiguity. Non-guard repository-gate failures remain separately classified as `GATE_REFUSED_OTHER`.

Only attempt 1 can have collected, because the shared production entry point throws
`workflow_retry_forbidden` on every later attempt; `filter=all` is still used so a later attempt can
never hide the first attempt's evidence, and a later attempt reporting a *successful* collect
contradicts that invariant outright and is `UNCLASSIFIED`.

A collection is dated by the `collect` job's own start instant, so discovery reaches back one extra
UTC day and a run created at 23:58 that collected after midnight is attributed to the right day.
"Executed a collection" counts every attempt-1 `collect` that actually ran, successful or not,
because that is exactly what consumes the day under the guard's own rule.

**Minimum GitHub permissions:** a fine-grained personal access token scoped to this one repository —
Metadata: Read (mandatory), Contents: Read, Actions: Read, Checks: Read. **No write permission of
any kind**, and no dispatch, re-run, cancel, enable/disable, secrets or settings call exists.

### Cloudflare sentinel — `cloudflare-sentinel.mjs`

Reads, all `GET`, all under the one dispatcher Worker name: `/schedules`, `/deployments` and
`/settings`. These are the endpoint shapes this repository already exercised live and read-only in
the Phase 4B diagnostics bundle. It proves the account is the reviewed production account by
comparing a supplied fingerprint against SHA-256 of the supplied account id through the existing
canonical helper — a missing fingerprint fails closed rather than being derived from the credential
it validates.

The live Cron Trigger set must be exactly the three approved opportunities. Order is not
significant; membership and multiplicity are.

**A named, permanent observation limitation.** Cloudflare's dashboard shows Cron Events as
invocation history, but this repository has **not** proven a supported read-only API returning
per-fire dispatcher invocation outcomes, and this session could not reach
`developers.cloudflare.com` to verify one. No endpoint is invented to pretend otherwise. Dispatcher
execution is therefore reported every cycle as
`CLOUDFLARE_INVOCATION_HISTORY_UNOBSERVABLE`, it can never contribute to a healthy verdict, and
execution causality is established downstream instead — from GitHub's own record of whether
workflow B appeared and ran, and from production D1. **Absence of visibility is never turned into
GREEN.**

**Minimum Cloudflare permission:** account-scoped `Workers Scripts: Read`. No Workers Scripts Write,
no deployment, no version promotion, no Cron Trigger create/update/delete, no secrets, no routes.

### D1 sentinel — `d1-sentinel.mjs`

Three statements, written in full as frozen literals against the real migrated schema (migrations
0001–0003; **no migration 0004**): `governance`, `recent_runs` and `integrity`. One D1 API call
carries all three.

SQL safety is enforced in application code, not left to the API token:

* every statement begins `SELECT` and passes a forbidden-construct scan;
* every value is bound — no identifier, table, column, predicate or literal is assembled from an
  argument;
* a plan can only be produced by this module's builders and is recognised by a private `WeakSet`, so
  a hand-made plan object is refused;
* the client refuses any response reporting a written row, and any read above its row bound;
* there is no code path that can express INSERT, UPDATE, DELETE, DDL, PRAGMA mutation or migration
  execution, and none that accepts SQL from an incident payload, a proposal, configuration or an AI.

The statements are **deliberately not** imported from the production collection plan module, which
can build mutations by design; importing it would hand the steward a route to one. A permanent test
pins that A1.2 imports neither that module nor the production D1 REST client.

Interpretation re-proves, independently and after the fact, the same invariants the production
postflight enforces at commit time: heads equal distinct accepted logical keys, and there is no
orphan head, no non-accepted observation, no non-shadow observation and no rejection.

**Minimum Cloudflare permission:** account-scoped `D1: Read`. The production database id stays a
reviewed repository constant and is never carried in an environment value, preserving the PR #215
identifier-logging remediation.

## Evidence envelopes

No raw provider object reaches classification. Every sentinel decodes into a fixed, versioned,
canonical envelope carrying a closed source type, a bounded subject identity, timestamps, one closed
normalized state, bounded provenance references and a deterministic SHA-256 of its own canonical
form. Nested payloads, unbounded text, unknown fields and non-closed sources all fail closed, and a
secret scan refuses the envelope outright rather than hashing it.

Provenance is deliberately **narrower** than the A1.1 incident reference pattern: it requires a
closed source prefix and a path with no scheme, host or query, so a raw provider URL can never
become provenance.

## Timing and freshness semantics

Every number is derived, and each derivation is stated:

| Constant | Value | Derivation |
|---|---|---|
| Opportunity instants | 01:17, 02:17, 03:17 UTC | the dispatcher's own declared cron list, pinned by test against `wrangler.jsonc` |
| `WORKFLOW_B_MAX_EXECUTION_MS` | 30 min | workflow B's own `timeout-minutes`: 10 (gate) + 20 (collect), pinned by test against the workflow YAML |
| `CRON_PROPAGATION_ALLOWANCE_MS` | 15 min | Cloudflare's published figure for Cron Trigger change propagation |
| `EVALUATION_TOLERANCE_MS` | 45 min | the sum of the two above, and nothing else |
| Evaluation deadline | 04:02 UTC | last opportunity plus the tolerance |
| `MAX_EVIDENCE_AGE_MS` | 60 min | one whole opportunity interval — a reading older than that could already be superseded |

Before the deadline, absence of a proven collection is **not** a failure: the evaluation phase is
`NOT_DUE` or `AWAITING_LATER_OPPORTUNITY`, and no incident is raised at all. **AMBER is not
introduced.** These are observation/evaluation phases, never a new policy authority, never a new
operational state and never an autonomous remediation class. From the deadline onward, inability to
prove the day's collection fails closed.

## Health semantics

GREEN requires **all** of: every required sentinel completed with fresh, actually-observed evidence;
the live cron set exactly the three approved opportunities; no unclassified run; no duplicate
collection; no unresolved D1 run; one collection executed and one completed run persisted matching
the postflight shape. A run that failed purely because the guard refused an already-consumed day
counts as healthy, and an attended workflow C collection legitimately consuming the day is healthy
in exactly the same way.

RED, fail-closed, includes: a sentinel that did not complete; evidence that is stale, failed or
unavailable; a cron set that has drifted; a run state the sentinel cannot recognise; a guard refusal
with no collection executed anywhere; a duplicate production collection from either side; a
successful workflow run with no matching D1 commit; an unresolved D1 run; governance mismatch;
inconsistent D1 state; an unexpected workflow B gate failure with no proven collection; and, past
the deadline, a day whose collection cannot be proven.

**Unknown never means GREEN.**

## Who watches the watcher

An observation run declares its required sentinels up front, records for each whether it completed,
its state, when it was observed, how fresh its evidence was and its evidence hash, and closes with a
deterministic heartbeat hash over the whole record. A crashed, silent or stale sentinel can never
produce an implicit healthy verdict — the watcher is checked before anything it watched.

**No continuous monitoring is faked.** A1.2 activates no scheduler and ships no workflow, so nothing
executes an observation run today. The contract exists; activation is a separate gate.

## A1.1 integration

A1.2 supplies observations and nothing else. It hands A1.1 an incident whose expected state is
`{status:'healthy'}` and whose observed state is that or `{status:'unhealthy'}`; A1.1's registered
rules decide GREEN or RED. A1.2 supplies no confidence, no severity, no suggested action, no
recovery proof and no classification of its own, because proposer evidence must never authorize
anything. A `NOT_EVALUATED` verdict produces **no incident at all**.

The A1.1 registry is untouched: Class 1–3 remain disabled, the Class 3 allowlist remains empty,
Class 4 still escalates, and A1.2 registers no action.

## What A1.2 deliberately does not do

No remediation of any kind. It cannot fix a workflow, re-run a job, rotate a credential, redeploy a
Worker, edit a Cron Trigger, write to D1, repair data, change configuration, open or merge a pull
request, or call an AI to decide any of those. There is no generic SQL, shell, HTTP or API actuator,
no Anthropic or OpenAI credential, and no code path that could use one. No provider, model,
projection, expected-minutes, fixture, captaincy, squad, transfer, simulation, rank, Mini-League,
strategy, UI or navigation behaviour changes. No collection cadence changes. No D1 schema changes.

## Credential boundary

A1.2 **defines** the configuration contract and provisions nothing. No credential is created,
rotated, uploaded or read from a live store, and no secret value appears in source, tests, fixtures,
documentation, logs, audit records or the pull request description.

| Variable | Sentinel | Required | Minimum permission |
|---|---|---|---|
| `DATA_STEWARD_GITHUB_TOKEN` | github | yes | ephemeral Actions `GITHUB_TOKEN`: Contents R, Actions R, Checks R |
| `DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID` | cloudflare | yes | identifier only, no authority on its own |
| `DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT` | cloudflare | yes | SHA-256 of the account id, supplied separately so the check is not tautological |
| `DATA_STEWARD_CLOUDFLARE_READ_TOKEN` | cloudflare, d1 | yes | account scoped: Workers Scripts Read, D1 Read |

Every variable is required; there is no degraded mode in which a sentinel is quietly skipped. A
missing credential makes that sentinel's facts unprovable, and unprovable facts fail closed. Because
both tokens are read-only, a lapsed or revoked credential fails the observation and mutates nothing.

## Verification

* Repository suite: **1,769 tests, 1,769 passed, 0 failed, 0 skipped, 0 cancelled** (baseline before
  A1.2 was 1,714/1,714).
* Two consecutive production builds are byte-identical, and `sourceHash` and `buildInputHash` are
  unchanged from `main` — A1.2 touches no build input, so no product behaviour changed.
* Committed build provenance verifies; no generated file changed.
* Every test uses deterministic fixtures. **No test depends on live GitHub, Cloudflare or D1.**

## Live validation status

**None was performed, and none is claimed.** No Cloudflare request, GitHub Actions mutation, D1
request of any kind, workflow dispatch, deployment, Cron change, credential creation or collection
was executed for this checkpoint. Everything proven here is fixture and contract proof.

What remains to be proven during a separately approved activation and acceptance step:

1. that the ephemeral read-only GitHub Actions token, at the stated permissions, can complete every read the
   GitHub sentinel issues;
2. that the read-only Cloudflare token, at the stated minimum permissions, can complete the three
   dispatcher reads and the one D1 batch;
3. the actual `rows_read` cost of the D1 observation batch against the live population;
4. that the live `/schedules` response shape matches the decoder, on the real dispatcher Worker;
5. whether any supported read-only Cloudflare API can return per-fire dispatcher invocation history,
   which would let the named limitation above be closed rather than carried;
6. that a first live observation run reaches a correct verdict on a real UTC day.

## Limitations, stated plainly

* Dispatcher invocation history is **not observable** through anything this repository has proven.
  Cloudflare-side health is limited to configuration identity.
* The D1 integrity aggregate scans the governed observation history, so its cost grows with the
  append-only history. It is bounded and fails closed above the bound; the bound is a budget, not a
  proof.
* A day is evaluated on strict UTC-day boundaries, dated by when collection began. That is
  deliberately simpler than the guard's own trailing-window rule, which exists to close a different
  hole.
* A GitHub check-run reading proves Verify state for the current `main` only; it is recorded as a
  fact and is not on its own treated as a production failure.
* The broad production dependency scan excludes `workers/data-steward` because the steward is the
  control plane **for** the platform. Its replacement recursively discovers every steward `.mjs`
  module, including future files, denies every data-platform edge by default and permits only four
  exact reviewed source-to-target edges. It also retains the production D1 binding prohibition and
  the application half of the original invariant. A future steward file cannot inherit platform
  access; its exact edge must be reviewed and added before tests pass.
  The complete allowlist is:
  `cloudflare-sentinel.mjs -> production-identity.mjs`;
  `d1-sentinel.mjs -> official-fpl-canonical.mjs`;
  `d1-sentinel.mjs -> production-collection.mjs`; and
  `github-sentinel.mjs -> scheduled/exact-head-verify.mjs`.
  Discovery covers ordinary static `from` imports, static side-effect imports, dynamic `import()` and
  `require()` references; synthetic regressions pin every form.
* Proving a consumed refusal depends on GitHub retaining and serving the exact repository-gate job
  log within 256 KiB. Retention expiry, access failure or output-format drift makes that observation
  RED, never healthy; no raw log is retained.

## Current successor gate

A1.2 merged in PR #231. [A1.3](DATA-OPS-A1-3-LIVE-READONLY-OBSERVER.md) supplies a dormant-by-default
runtime candidate. Protected Cloudflare credential provisioning, first attended live observation and
scheduled activation remain separate owner gates. Autonomous remediation remains unapproved.
