# DATA-S2B — first-run reconciliation, resume hardening and production identifier logging

Repository-only checkpoint. **No Cloudflare request, workflow dispatch, D1 read or mutation,
production reconciliation, resume, collection, migration, deployment, schedule, Cron or
credential change was performed while preparing it.** Everything below describes repository
machinery that existed after merge.

## Live outcome — this machinery has since been executed, and the first run is completed

**This section supersedes the "first production collection run remains unresolved and unresumed"
baseline bullet below and every later statement in this record that describes the reconciliation
or the resume as never executed. The rest of the record remains the authoritative design and
contract evidence.**

Both runs were dispatched by the owner from exact `main`
`d79dd37451e16b642ce96709b8635c3ac618c366` and were verified independently from the GitHub
Actions API:

- **Read-only reconciliation** — `DATA-S2B First Production Run Reconciliation`, run
  `33792104384`, attempt 1, event `workflow_dispatch`, conclusion `success`. The entry point
  exits zero only on `RESUME_RECONCILIATION_SAFE`, so success proves that classification. The
  runner requires `rows_written === 0` and enforces the 1,000-row read guard, so it performed no
  D1 mutation.
- **First-run resume** — `DATA-S2 First Production Run Resume`, run `33815400284`, attempt 1,
  event `workflow_dispatch`, conclusion `success`, with both the `repository-gate` and
  `first-run-resume` jobs successful. `runProductionCollection` returns only after its
  synchronous postflight has proved the exact completed run, its counters, run-owned observation
  ownership, head/logical-key equality and zero orphan, non-accepted, quarantined and rejection
  state. **The originally unresolved first production collection run is therefore definitively
  completed**, and needs no further reconciliation or resume.

The exact provider `meta.rows_read` and `meta.rows_written` for either run reach only the GitHub
Step Summary, which is not retrievable through the GitHub API available here. They are
**unavailable** and are stated nowhere. Cloudflare dashboard aggregates observed after the resume
are account-level, time-window figures, are not attributable to one workflow, and must never be
recorded as exact resume accounting.

GitHub scheduling remains disabled and live Cloudflare Cron remains intentionally absent. The
manual normal collection path has since been hardened to this same trust boundary; see
[manual collection hardening](DATA-S2B-MANUAL-COLLECTION-HARDENING.md).

## Baseline this checkpoint starts from

- `main` is `faffe2d1e72dd991743b65d35c6c2b77574a4924` (PR #214 merged); exact-main Verify
  Teamsheet `33780720616` succeeded.
- **Migration 0003 is applied.** Manual run `33756058903` succeeded in both jobs and could exit
  zero only through `DEFINITELY_APPLIED_SUCCESSFULLY` or `DEFINITELY_ALREADY_APPLIED`.
- **Live EXPLAIN acceptance passed.** Run `33783839210`, dispatched against approved SHA
  `faffe2d1e72dd991743b65d35c6c2b77574a4924`, succeeded, so the runner reached `PLAN_ACCEPTED`
  and all four production query plans passed live D1 validation. The runner requires
  `rows_written === 0`, so that acceptance performed no D1 mutation.
- The exact provider `rows_read` for the EXPLAIN request is **not recoverable** through the
  GitHub connector available to this session, and is deliberately stated nowhere. Only the
  1,000-row operational guard and the fact that the run passed it are claimed.
- The **first production collection run remains unresolved and unresumed.** Run `33662554360`
  left a visible `started` ledger row after a definite start mutation and stopped at
  `d1_result_contract_invalid` while decoding current-head accounting. No later collection has
  run, the resume workflow has never run, GitHub scheduling is disabled and live Cloudflare Cron
  is intentionally absent.

## A. Read-only reconciliation of the unresolved first run

`resume/first-run-reconciliation-contract.mjs` (pure) and
`resume/reconcile-first-production-run.mjs` (runner) answer exactly one question: did the failed
run leave its start-ledger row, and nothing else, behind?

The proof is one trusted read-only plan of three fixed statements built by
`buildFirstRunReconciliationRead`: the existing governance constant, the existing single-run
constant, and one run-scoped integrity row. There is no SQL, table, column, statement, path,
identity or timestamp input; the run id is derived from the immutable
`2026-09-02T17:41:00.000Z` scheduled time and the source revision is the pinned repository
constant, and both only ever become bound parameters. The mechanism imports no mutation plan
builder, so no `INSERT`, `UPDATE`, `DELETE` or DDL statement is reachable from it, and a
permanent test asserts that.

The integrity row returns seven counters — `run_observations`, `run_heads`, `run_rejections`,
`revision_runs`, `started_runs`, `completed_runs`, `other_runs`.

The high-volume paths are index-supported: the observation, head and rejection predicates use
`shadow_observations_ingestion_run`, `observation_heads_observation_id` and
`observation_rejections_source_revision`, proved locally against migrations 0001–0003, so the
reconciliation visits the pinned run's own rows instead of scanning `shadow_observations`,
`observation_heads` or `observation_rejections`. The small `ingestion_runs` counters filtered by
source revision and status are **not** covered by a source-revision-leading index under the
current schema; that table holds a handful of rows, and those counters are bounded instead by the
reconciliation's strict 1,000 provider-rows-read ceiling, so any unexpected read amplification
fails the run closed. No index is added and migration 0003 is unchanged. These are local plan
observations, not Cloudflare billing; only Cloudflare's returned `meta.rows_read` and
`meta.rows_written` are ever reported as accounting.

Classifications are explicit and total:

| Classification | Meaning |
| --- | --- |
| `RESUME_RECONCILIATION_SAFE` | Governance exact, the pinned row is the exact untouched `started` row, the run owns zero observations, zero governed heads and zero rejections, and it is the only unresolved run for the revision. |
| `RESUME_RECONCILIATION_BLOCKED` | A well-formed state a resume must not mutate from: completed, failed or drifted run row, partial observations/heads/rejections, a second `started` run, or governance drift. |
| `AMBIGUOUS_REQUIRES_OWNER_ATTENTION` | Malformed, unbounded, non-numeric or otherwise undecidable result, a lost or non-2xx response, or any resource violation. |

`NOT_REQUIRED` is deliberately absent: the repository cannot prove the question away, only
answer it. The reconciliation resumes nothing — SAFE is a precondition for a separately approved
resume, never an authorisation to perform one — and it never repairs, completes or deletes
anything.

Resource contract: at most **one** D1 API call, `rows_written` must be exactly **zero**, and at
most **1,000** rows read. That ceiling is an operational guard, not a billing prediction; only
Cloudflare's returned `meta.rows_read` and `meta.rows_written` are ever reported as accounting.
There is no retry inside an execution, and a second attempt is only ever a separate
owner-approved dispatch.

## B. Resume workflow hardening

`.github/workflows/data-s2-production-resume.yml` previously checked out floating `main`, took no
approved SHA, proved no exact head, required no exact-head Verify Teamsheet, and exposed
credentials without a credential-free gate. It is now built to the migration-0003 / live-EXPLAIN
standard.

- `workflow_dispatch` only, with one immutable input, `approved_sha`.
- A credential-free `repository-gate` job, with no protected environment and no Cloudflare
  variable of any kind, proves: canonical repository, `workflow_dispatch`, `refs/heads/main`, a
  lowercase 40-character SHA, checkout of that exact SHA, `HEAD` equal to it, a clean tree, fresh
  remote `main` equal to it, and a completed, successful **Tests and deterministic build** check
  run on that exact head posted by the `github-actions` app.
- The protected `first-run-resume` job requests the existing `data-s2-production-collection`
  environment and its existing secrets only. It pins Node 24.19.0, checks out the exact approved
  SHA, re-proves a clean tree, removes Wrangler from the runner, and then resolves remote `main`
  **again** — from the remote, not from any value carried between jobs — in the same shell
  immediately before the entry point. No Cloudflare request is made before that second gate; a
  permanent test executes the exact shell block with stub binaries and proves a moved or empty
  remote `main` stops before the runner is invoked.
- Concurrency group `data-s2-production-collection` with `cancel-in-progress: false`, shared with
  collection, migration, EXPLAIN and the new reconciliation workflow.
- A workflow re-run is refused: every production entry point rejects `GITHUB_RUN_ATTEMPT !== '1'`.
  Another attempt requires fresh owner approval and a new dispatch.

`.github/workflows/data-s2-first-run-reconciliation.yml` is the same shape for the strictly
read-only reconciliation entry point.

## C. Resume runtime

The resume continues the **original logical run**: it never inserts a second start row, and the
immutable identity and `started_at` remain repository constants. It records a genuine later
execution time from the runner's clock, which must be strictly after the immutable start.

Sequence, at most five D1 API calls:

1. the fixed read-only reconciliation — must classify SAFE, `rows_written` must be zero and rows
   read must stay inside the reconciliation ceiling, or the resume stops **before** the Official
   FPL fetch and before any mutation;
2. the existing population and current-head read;
3. exactly one mutation request (the commit batch, or the unchanged completion), capped by
   `RESUME_MAX_MUTATION_REQUESTS = 1`;
4. a bounded read-only reconciliation of the run row if that mutation's outcome is unknown;
5. the consolidated synchronous postflight.

Once the single commit mutation has been issued and its outcome is unknown, no later failure may
downgrade the operation to "no mutation": the one bounded read-back is classified inside that
branch, so a read-back transport failure, HTTP failure, malformed result, provider-accounting
failure or resource-ceiling failure all report mutation `unknown`, phase `commit_reconciliation`
and `retryable: false`, and the outer wrapper preserves that classification rather than applying
its default `none`. Permanent regressions cover each of those read-back failure modes and prove
exactly one commit mutation and exactly one post-commit read-back.

Unchanged and still enforced: a definite non-transport failure is never retried; an unknown
mutation outcome triggers exactly one bounded read-only reconciliation, never a second mutation;
an unchanged safe pre-state classifies as no write; a proven completed post-state classifies as a
definite completed run; a partial or inconsistent state is owner attention. Duplicate
observations and heads are prevented by the existing content-addressed observation identity and
the `ON CONFLICT(logical_key)` head upsert, and the append-only postflight rejects orphan heads,
invalid heads, non-accepted or quarantined observations, any rejection row, any non-zero
quarantined/rejected counter and any error class. Nothing is silently repaired and no credential
is widened.

## D. Production identifier logging

**Observation.** The successful EXPLAIN job log displayed the production account fingerprint and
the production D1 database id before the Node entry point's `::add-mask::` ran. The API token was
sourced from `secrets.*` and stayed masked throughout.

**Root cause.** GitHub Actions echoes each step's resolved environment in that step's log header,
and only `secrets.*` values are registered as masks by the runner. Both identifiers were declared
in the credentialled job's job-level `env:` block from `vars.*`, so they were written to the log
by the very first step — before any Node process existed to mask them. The runtime masking was
never wrong; it was simply too late to be the primary control.

**Severity: low, and they are not credentials.** Neither value authenticates anything; a D1 REST
request still requires the token, which was never exposed. The database id is already a reviewed
public repository constant (`PRODUCTION_D1_ID`), so its appearance in a log disclosed nothing the
repository does not already publish. The fingerprint is a SHA-256 hash, not the account id. This
repository nonetheless keeps account ids and D1 UUIDs out of diagnostics as a standing rule, so
the exposure is a real policy defect and is remediated. No credential is rotated, no secret is
renamed, no GitHub Variable is reclassified as a secret, and no identifier is written into tests
or documentation.

**Remediation, at the workflow boundary.**

- `CLOUDFLARE_PRODUCTION_D1_ID` is removed from every credentialled workflow. The database
  identity is taken from the reviewed repository constant instead, and a supplied override is
  accepted only when it is byte-identical to that constant. This is stronger than the previous
  arrangement: the target database is now pinned by reviewed, SHA-gated repository content and
  cannot be redirected by an environment variable.
- `CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT` stays environment-supplied, because deriving it
  from the credential it validates would make the account check tautological. It is no longer
  declared at job level; it appears only on the final production step, and the credentialled
  job's **first** step registers its mask, derived from the already-masked account credential, so
  the runner prints `***` when that step's environment is echoed.
- The runtime `::add-mask::` for token, account id and database id is retained as defence in
  depth in the shared `production-identity.mjs` module used by every protected entry point.
- Permanent tests prove, for the collection, migration-0003, EXPLAIN, resume and reconciliation
  workflows, that no production identifier variable is materialised into a workflow-level or
  job-level `env:` block, that the only remaining `vars.*` reference is the fingerprint and it
  appears after the mask step, that the mask step is the credentialled job's first step, and that
  the D1 identifier appears in no workflow at all.

**Residual limitation.** If the environment's fingerprint variable ever stops matching
`sha256(account id)`, the pre-registered mask will not cover it and the mismatched value would
appear once in the final step's header. That run also fails closed at the fingerprint check, so
the exposed value would be a wrong one, but the case is stated rather than claimed impossible.

## E. Resume resource envelope and daily headroom

From repository truth, at the last proven governed population `H = N = 9,860` with `D = 0`:

| Quantity | Value |
| --- | --- |
| Structural whole-cycle read estimate (`5H + 4N + 4D + 64`) | 88,804 |
| Reconciliation read guard | 1,000 |
| **Expected resume reads** | **≤ 89,804** |
| Hard read ceiling (unchanged) | 125,000 |
| Hard write ceiling (unchanged) | 40,000 |
| Resume D1 API call ceiling | 5 |
| Resume mutation request ceiling | 1 |
| Reconciliation / fallback overhead | 1 reconciliation read before the cycle; at most 1 bounded read-only run read if the mutation outcome is unknown; 1 synchronous postflight read |

Minimum safe headroom a future owner approval should assume: **126,000 `rows_read`** — the hard
cycle ceiling plus the reconciliation guard — available in the Cloudflare Free daily D1
allowance at dispatch time.

These are repository plan estimates, not Cloudflare billing. Cloudflare's returned
`meta.rows_read` and `meta.rows_written` remain independently enforced after every request, and
no ceiling is raised by this checkpoint.

**The repository has no mechanism to read remaining daily D1 quota, and none was added; no live
quota check was performed.** The 5,000,000 `rows_read` Free daily allowance was recorded as
exhausted on 2026-09-02 with reads blocked until `2026-09-03T00:00:00Z`; that account-level
notice never proved failed run `33662554360` alone consumed it, and it is not evidence about
today's remaining allowance. Real-time remaining daily quota therefore **cannot be proven from
this repository** and must be treated as an owner-side judgement at approval time.

## Fail-closed conditions

A future resume stops, with no repair, no blind retry and no credential widening, for: a wrong or
malformed approved SHA; a moved remote `main` at either gate; a failed, missing or
non-exact-head Verify Teamsheet; a dirty checkout; a workflow re-run; a wrong account
fingerprint; a wrong D1 identity; missing credentials; a reconciliation that is not SAFE; an
unexpected run state; an unexpected observation, head or rejection state; a malformed provider
response; malformed accounting; any read, write or API ceiling exceeded; an unknown mutation
outcome that cannot be safely reconciled; a partial or inconsistent state; or any remaining
ambiguity.

## What this checkpoint does not do

It performs no production reconciliation and no resume, resumes no collection, applies no
migration, deploys no Worker, changes no schedule, Cron, credential or environment, and changes
no model, fixture, captaincy, squad, transfer, simulation, rank, Mini-League, rival, strategy or
recommendation behaviour. GitHub scheduling stays disabled; live Cloudflare Cron stays
intentionally absent, and the historical `"crons": ["*/30 * * * *"]` declaration in
`wrangler.jsonc` remains repository configuration that must not be used to restore live Cron.
Normal recurring collection and scheduling are explicitly out of scope.
