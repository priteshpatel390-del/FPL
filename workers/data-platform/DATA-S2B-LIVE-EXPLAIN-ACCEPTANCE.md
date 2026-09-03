# DATA-S2B — live production EXPLAIN QUERY PLAN acceptance

**Status: LIVE EXPLAIN ACCEPTANCE PASSED.** Run
[`33783839210`](https://github.com/priteshpatel390-del/FPL/actions/runs/33783839210), dispatched
against approved SHA `faffe2d1e72dd991743b65d35c6c2b77574a4924`, succeeded. The runner throws on
every classification other than `PLAN_ACCEPTED`, so a successful run means all four production
query plans passed live D1 validation. The runner also requires `rows_written === 0`, so the
acceptance performed **no D1 mutation**. The exact provider `rows_read` for that request is not
recoverable through the GitHub connector available here and is deliberately stated nowhere; only
the 1,000-row operational guard and the fact that the run passed it are claimed.

Acceptance covers plan shape only. It does **not** approve the unresolved first production run
resume, any collection, any scheduling or any Cron change; those remain separate owner gates.

## What is already true

- Migration 0003 **is applied** in production. Manual run
  [`33756058903`](https://github.com/priteshpatel390-del/FPL/actions/runs/33756058903) was
  dispatched from exact `main` `f5aedff686f3b032fee6f7e43c6fcf3104126a97` after exact-main Verify
  Teamsheet `33729943154`, and both its jobs succeeded. That runner exits zero only through
  `DEFINITELY_APPLIED_SUCCESSFULLY` or `DEFINITELY_ALREADY_APPLIED`, and both require its bounded
  read-only reconciliation to classify the live state as `already_applied` — the exact version-3
  ledger row plus all three reviewed indexes with byte-exact `CREATE INDEX` text on their reviewed
  tables. Migration presence is therefore structurally proven.
- The exact success shape and the migration request's own `rows_read` / `rows_written` are **not**
  recoverable from the GitHub API: the runner writes only to the job's Step Summary. No migration
  row counts are stated here or anywhere else in the repository.
- No later production activity exists. Run `33756058903` is the newest workflow run in the
  repository; production collection has exactly one run, `33662554360` (failed, 2 September 2026);
  the first-run resume workflow has never run; and no live `EXPLAIN QUERY PLAN` has ever run.
- GitHub scheduling remains disabled and live Cloudflare Cron remains intentionally absent.

## What this checkpoint adds

A dedicated, fail-closed, repository-owned mechanism that can later prove — with one owner
approval, in one read-only request — that the production query plans are the shapes the approved
whole-cycle read model assumes at schema 0003.

| File | Role |
| --- | --- |
| `workers/data-platform/explain/production-explain-contract.mjs` | Pure pinned contract: the four query identities, the per-query index bindings, the forbidden access patterns, the bounded plan-row shape, the classifications and the EXPLAIN-only resource contract |
| `workers/data-platform/explain/accept-production-plans.mjs` | Read-only runner: identity proof, exactly one trusted request, provider-accounting enforcement, acceptance, sanitized classification |
| `workers/data-platform/run-production-explain.mjs` | Protected entry point: single attempt, masks live identifiers, bounded sanitized summary, fails the workflow on any non-`PLAN_ACCEPTED` outcome |
| `.github/workflows/data-s2b-explain-acceptance.yml` | Manual-only protected workflow with a repository/CI gate that completes before credentials exist |
| `workers/data-platform/official-fpl-d1-rest-plan.mjs` | Gains one additive trusted read plan, `buildProductionExplainAcceptanceRead()` |
| `tests/data-s2b-production-explain-acceptance.test.mjs` | Permanent protection for every property below, including a local SQLite proof against migrations 0001-0003 |

## The four must-pass plan shapes

Each statement is `EXPLAIN QUERY PLAN` prefixed to the **exact existing production SQL constant**;
no production query is duplicated or reworded. Q1 is byte-identical to the pre-existing
`buildProductionCurrentHeadsExplainRead()` statement. Bound parameters are the deterministic
repository identifiers the production SQL already binds; they never reach statement text.

| Query | Production SQL | Required | Forbidden |
| --- | --- | --- | --- |
| Q1 current heads | `HEADS_SQL` | `SEARCH` on `shadow_observations` (`o`) using `shadow_observation_idempotency`; `SEARCH` on `observation_heads` (`h`) using `observation_heads_observation_id`; `SEARCH` on `ingestion_runs` (`r`) using its unique index or primary key | `SCAN` of `observation_heads`; `SCAN` of `shadow_observations`; any automatic index |
| Q2 observation population | `OBSERVATION_POPULATION_SQL` | `SEARCH` on `shadow_observations` using **covering** `shadow_observation_idempotency` | `SCAN` of `shadow_observations`; any automatic index |
| Q3 head population | `HEAD_POPULATION_SQL` | `SCAN` of `observation_heads` using **covering** `observation_heads_observation_id` | a plain `observation_heads` table scan; any automatic index |
| Q4 postflight | `POSTFLIGHT_SQL` | exactly one `shadow_observation_idempotency` traversal; `SEARCH` on `shadow_observations` by observation id (`sqlite_autoindex_shadow_observations_1` or primary key); `SEARCH` on `ingestion_runs` by its unique index or primary key; `SEARCH` on `observation_rejections` using `observation_rejections_source_revision` | a second `shadow_observation_idempotency` traversal (materialized-CTE re-evaluation); `SCAN` of `shadow_observations`; any automatic index. The `head_state` `SCAN` of `observation_heads` is **expected and permitted** — the read model charges it |

Each index requirement is bound to the operation and the table or alias it must apply to, so the
same index name appearing against an unrelated operation cannot satisfy it. Only the semantic
content of each returned `detail` is validated: SQLite node ids, parent ids, row order and
cosmetic formatting are never asserted, because D1 may legitimately vary them.

`shadow_observations_ingestion_run` is deliberately **not** required by any gate. Its leading
column is `ingestion_run_id` while every production predicate leads on `source_revision_id`, and it
is not covering for the postflight observation aggregate, so requiring it would fail a correct
database. Its presence is already proven by the migration-0003 postflight, and a permanent test
proves the contract never names it.

`GOVERNANCE_SQL` and `RUN_SQL` remain **informative and non-binding**. They are bounded
unique/primary-key style lookups inside the model's fixed 64-row reserve; no fifth mandatory
EXPLAIN was added.

## Read-only and resource boundary

The plan is `kind:'read'`, `mutation:false`, registered in the existing trusted-plan set, and the
D1 REST client refuses any plan outside that set. The runner imports no mutation builder, so no
`INSERT`, `UPDATE`, `DELETE` or DDL statement is reachable, and it contains no collection, resume,
migration, retry-mutation, Worker version, deployment, route, Access, secret, schedule or Cron
surface.

At most **one** D1 REST API call. Provider `meta.rows_written` must be exactly **0**, or the run
stops. `meta.rows_read` is captured only as Cloudflare returned it and is bounded by an
EXPLAIN-only guard of **1,000 rows**. That guard is an operational bound, not a billing
prediction: no provider accounting for a D1 REST `EXPLAIN QUERY PLAN` has been observed yet, so the
bound is set far below anything that could threaten the account's daily allowance and the run fails
closed rather than assuming a value. The routine collection contract (100,000 expected reads,
125,000 hard reads, 40,000 writes, 4,000 changed observations, eight API calls, 16 MiB D1 request,
8 MiB Official FPL response) and the separate migration-0003 envelope both stand unchanged and are
not reinterpreted here.

## Stop and fallback behaviour

Every outcome is one of `PLAN_ACCEPTED`, `PLAN_REJECTED` or
`AMBIGUOUS_REQUIRES_OWNER_ATTENTION`, and only the first completes the workflow successfully.

- A well-formed plan that violates a must-pass rule — a missing index binding, an unexpected table
  scan, an automatic index, a repeated postflight traversal — is `PLAN_REJECTED`.
- A transport failure, an undecodable or wrong-cardinality response, a malformed or oversized plan
  row set, any reported written row, or a resource-guard breach is
  `AMBIGUOUS_REQUIRES_OWNER_ATTENTION`.
- Identity drift (account fingerprint or database id), a moved remote `main`, a missing exact-head
  Verify, missing credentials or a workflow re-run all stop before any Cloudflare request.
- A failed plan is **never** "fixed" by creating, rebuilding or dropping an index. There is no such
  capability in this mechanism, and a permanent test proves it.
- No retry occurs inside an execution. Another attempt is only ever a separate owner-approved
  dispatch.

## Workflow gating

Manual `workflow_dispatch` only, with one input, `approved_sha`. A credential-free repository gate
proves the canonical repository, event and ref, a lowercase 40-character SHA, checked-out HEAD
equal to it, a freshly resolved remote `main` equal to it, a clean tree, and a completed successful
exact-head **Tests and deterministic build** check run posted by GitHub Actions — all before the
protected job exists. The protected job then uses the existing `data-s2-production-collection`
environment and only the existing secret and variable names, pins Node 24.19.0, re-proves HEAD and
a clean tree, removes any Wrangler executable, and independently resolves remote `main` again —
from the remote, never from a value carried between jobs — immediately before the entry point, with
nothing between that check and the entry point and no Cloudflare request before it. Concurrency
group `data-s2-production-collection` serializes the acceptance read against collection, resume and
migration activity.

## Limitations

- The local SQLite proofs in `tests/data-s2b-production-explain-acceptance.test.mjs` are
  **repository evidence only**. They demonstrate that the contract accepts the real schema-0003
  plans produced by SQLite; they are not a D1 acceptance claim and no D1 plan acceptance is claimed
  anywhere in this checkpoint.
- D1's `EXPLAIN QUERY PLAN` response shape and its provider accounting have never been observed
  live. The contract decodes defensively and fails closed rather than assuming either.
- A successful live EXPLAIN acceptance proves plan shape only. It does **not** approve the
  unresolved first production run resume, any collection, any scheduling, or any Cron change.
- `.github/workflows/data-s2-production-resume.yml` was unapproved and un-hardened when this
  record was first written. It is hardened to this workflow's gating shape by the separate
  [first-run reconciliation and resume checkpoint](DATA-S2B-FIRST-RUN-RECONCILIATION-AND-RESUME.md),
  and still requires its own explicit owner approval before any dispatch.
- `workers/data-platform/wrangler.jsonc` still declares `"crons": ["*/30 * * * *"]`. That is
  historical repository configuration. Live Cloudflare Cron is intentionally absent and must not be
  restored from it; nothing in this checkpoint deploys that Worker.

## Next gates

Gates 1 and 2 — merge plus exact-main Verify Teamsheet, then one approved live EXPLAIN dispatch —
are closed by run `33783839210` on `faffe2d1e72dd991743b65d35c6c2b77574a4924`. What remains:

1. Owner merge of the first-run reconciliation, resume-hardening and identifier-logging
   remediation, then exact-main Verify Teamsheet on that merge commit.
2. Separate explicit owner approval for exactly one **read-only** production reconciliation of the
   unresolved first `started` run.
3. Only if that reconciliation classifies `RESUME_RECONCILIATION_SAFE`: a further separate owner
   approval for exactly one production resume dispatch, with daily D1 allowance headroom judged at
   that time. Routine collection, scheduling and Cron remain separate later gates after that.

See [first-run reconciliation and resume](DATA-S2B-FIRST-RUN-RECONCILIATION-AND-RESUME.md).
