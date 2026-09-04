# DATA-S2B Stage D — hardened once-daily GitHub Actions production collection schedule

Repository-only checkpoint. **No Cloudflare request, workflow dispatch, D1 read or mutation,
collection, resume, reconciliation, migration, deployment, Worker action, Cron change, GitHub
environment change or credential change was performed while preparing it.** The live facts
recorded below were read back independently from the GitHub Actions API; they were produced by an
owner-dispatched run that had already completed before this work began.

**Merging this checkpoint activates the schedule.** Once the scheduled workflow reaches the
default branch, GitHub can begin producing natural scheduled events for it. It is an activation
change, not inert preparation. The pre-merge owner gate in section H is mandatory.

## A. Why GitHub Actions is the forward scheduler

The forward production collection architecture is unchanged and is not revisited here:

```
GitHub Actions -> fixed Official FPL public endpoints -> validation / normalisation / diff /
hashing on the runner -> bounded direct Cloudflare D1 REST
```

Cloudflare Worker collection is **not** the forward path and Cloudflare Cron is **not** the
forward scheduler. The production scheduled collector was historically observed using
approximately 630 ms of Worker CPU against a 10 ms Workers Free Cron Trigger ceiling, and its
trigger was deliberately removed. `workers/data-platform/wrangler.jsonc` still declares
`"crons": ["*/30 * * * *"]`; that is historical repository configuration and must never be used to
restore live Cron. The Phase 4A and Phase 4B records remain valid history and are not the forward
design. A D1 REST call invokes no Worker, so the CPU ceiling that stopped the Worker path does not
apply to this one.

## B0. TEMPORARY owner-approved acceptance window — 4 September 2026

The permanent intended cadence is **`17 1 * * *` (01:17 UTC)** and is unchanged as an intent. For
one acceptance opportunity the owner explicitly approved temporarily moving the single schedule
trigger to **`17 10 * * *` (10:17 UTC / 11:17 BST) on 4 September 2026**, so the first natural
scheduled production run can fire inside the working day and be observed end to end: GitHub
scheduler, scheduled-event trust gate, exact-head Verify requirement, the dedicated
`data-s2-production-scheduled` environment, production Cloudflare credentials, Official FPL
collection, D1 REST and synchronous postflight.

What this window does **not** change: the workflow stays schedule-only with exactly one trigger,
no `workflow_dispatch`, no push or pull-request trigger; 01:17 UTC is not retained beside 10:17;
the environment, credentials, collector entry point, concurrency group, exact-SHA trust gate,
exact-head Verify requirement, no-rerun rule, resource ceilings and synchronous postflight are all
unchanged; Cloudflare Cron stays superseded and absent; no Worker, schema, SQL, migration, provider
or model behaviour changes.

**Merging the change that carries `17 10 * * *` temporarily changes the live production collection
schedule and may cause one real production D1 collection at 10:17 UTC / 11:17 BST on 4 September
2026.** After that natural run has been evaluated, a **separate, explicitly reviewed restoration
pull request must return the trigger and `PRODUCTION_COLLECTION_SCHEDULE` together to
`17 1 * * *`**. If the approved 11:17 BST opportunity is missed before merge, no other time is
substituted: that requires new owner approval.

This record does not claim the acceptance passed. Nothing was executed to prepare the window: no
Cloudflare request, workflow dispatch, D1 read or mutation, collection, migration, deployment,
Cron, environment or credential change.

## B. The approved schedule

Exactly one trigger, in a new workflow, `.github/workflows/data-s2-production-scheduled.yml`:

```yaml
on:
  schedule:
    - cron: '17 10 * * *'
```

That is **one best-effort full production collection opportunity each UTC day**, temporarily at
10:17 UTC for the 4 September 2026 acceptance window in section B0 and permanently intended at
01:17 UTC once the separate restoration change lands.
There is no pre-deadline collection, no 30-minute polling, no hourly schedule, no second daily
collection and no Cloudflare Cron. The repository constant, previously the dormant
`FUTURE_PRODUCTION_COLLECTION_SCHEDULE`, is now the wired `PRODUCTION_COLLECTION_SCHEDULE` in
`workers/data-platform/production-collection.mjs` and a permanent test binds it to the workflow's
single cron expression.

## C. Why a separate workflow rather than a `schedule:` on the manual one

`.github/workflows/data-s2-production-collection.yml` is untouched in shape: it stays
`workflow_dispatch`-only, still requires the owner's immutable `approved_sha`, and still requests
the human-approved `data-s2-production-collection` environment. It is the owner-controlled manual
and recovery boundary, and an unattended trigger inside it would make the human approval on that
environment optional in practice.

The two paths therefore differ only in how the candidate revision is established and how CI proof
is obtained. Everything after the gate — the protected job shape, the identifier masking, the
second remote-`main` check, the collection identity, the entry point, the collector, the ceilings
and the postflight — is the same. The small security gate is deliberately duplicated rather than
extracted into a shared composite action: a behaviour-preserving refactor of the live, already
executed manual gate is a larger risk than a second copy the tests hold to the same assertions.

## D. Scheduled SHA trust model

A manual dispatch carries the owner's judgement as `approved_sha`. A scheduled event carries no
judgement at all, so the immutable candidate source is the SHA the scheduled event itself carries
— `github.sha`, the default-branch head at event creation. The credential-free `repository-gate`
job fails closed unless every one of these holds:

1. the event name is exactly `schedule`;
2. `github.event.schedule` is exactly `17 10 * * *` (the temporary window; `17 1 * * *` after restoration);
3. the repository is exactly `priteshpatel390-del/FPL`;
4. the ref is exactly `refs/heads/main`;
5. the scheduled SHA matches `^[0-9a-f]{40}$`;
6. the checkout is exactly that SHA;
7. `HEAD` equals that SHA;
8. the working tree is clean;
9. a freshly resolved remote `main` equals that SHA;
10. a completed, successful, exact-head `Tests and deterministic build` check run exists for that
    SHA, produced by the `github-actions` app and linked to an Actions run in this repository.

There is no floating `main`, no "latest successful build", no acceptance of a check on another
SHA and no fall-forward to a newer commit. If `main` advances between the scheduled event and
execution, requirement 9 fails and the run stops rather than collecting old code; the next
scheduled event is the collection opportunity for the newer revision.

## E. Bounded exact-head Verify wait

A scheduled event can fire while the exact-head Verify run for the same commit is still in
progress, which a manual dispatch never does because the owner waits before dispatching. The gate
therefore waits — read-only, credential-free and inside a fixed bound —
in `workers/data-platform/scheduled/exact-head-verify.mjs`, invoked by
`workers/data-platform/scheduled/run-exact-head-verify.mjs`.

| Observed state on the exact SHA | Outcome |
|---|---|
| Completed and successful | Proceed |
| Completed, any other conclusion | Stop (`verify_check_failed`) |
| Present but not completed | Wait one interval, retry inside the bound |
| Bound exhausted while still pending | Stop (`verify_check_wait_exhausted`) |
| Absent, wrong name, wrong app, wrong repository link or a different head SHA | Stop (`verify_check_absent`) |
| Non-200 response or malformed body | Stop (`verify_check_http_failed` / `verify_check_contract_invalid`) |

The bound is ten reads thirty seconds apart — nine waiting intervals, four and a half minutes —
capped a second time by the job's ten-minute timeout. A caller may narrow the bound but a value
above the module constant is rejected. The module issues GitHub REST `GET`s and nothing else: it
never dispatches a workflow, re-runs a job, re-requests a check or writes to GitHub, and it holds
no Cloudflare authority because it runs before the protected job exists. A completed success on
the exact head is proof even beside an earlier failed attempt on the same commit, which is exactly
how the manual gate already treats it.

## F. Dedicated unattended environment

The scheduled production job requests `data-s2-production-scheduled`. It deliberately does **not**
reuse `data-s2-production-collection`, which remains the human-approved manual and recovery
boundary and must stay attended.

Owner-side configuration this repository cannot perform and cannot prove:

| Setting | Required value |
|---|---|
| Environment name | `data-s2-production-scheduled` |
| Deployment branch rule | `main` only |
| Required reviewers | none — the daily boundary is unattended by design |
| Environment secrets | `CLOUDFLARE_D1_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |
| Environment variable | `CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT` |
| Production D1 identifier | none — it stays the reviewed repository constant |

The credentials are the same minimum-scope production D1 authority the existing collector already
requires. No credential was created, copied, read, displayed, rotated or widened by this
checkpoint, and no environment was created or configured.

### Environment creation risk

GitHub does not fail a workflow that references an environment which has not been preconfigured:
it creates the environment implicitly, with no protection rules, on first use. That means merging
this workflow before the owner has configured `data-s2-production-scheduled` would produce an
unprotected environment with no deployment-branch restriction, and the daily job would then run
against whatever secrets resolve at that scope.

The runtime consequence in the benign case is fail-closed — an environment with no
`CLOUDFLARE_ACCOUNT_ID` stops the job at its first step, before any Cloudflare request — but that
is a fallback, not the control. **Nothing in this repository can prove an environment's protection
rules**, so the control is the owner gate in section H, and this PR must not be merged until it is
satisfied.

## G. Everything the scheduled path preserves unchanged

### Second remote-`main` check immediately before production

Protected-environment admission and the bounded Verify wait both take time, so the final step
re-establishes everything in one shell, immediately before the production entry point and before
any Cloudflare request: exact Node `24.19.0`, `HEAD` equal to the scheduled SHA, a clean tree,
Wrangler removed from the runner, then remote `main` resolved again **from the remote** — never
from a value carried out of the gate job — and required to equal the scheduled SHA. The runner
invocation is the next and last line. Permanent tests execute both that shell and the gate shell
against stubbed `git` and `node` binaries and prove that a moved remote `main`, an empty
remote-`main` resolution, a wrong `HEAD` and a dirty tree each fail and leave the production
runner uninvoked.

### Collection identity

`COLLECTION_SCHEDULED_AT` is fixed exactly once, inside that same final protected step, after
every repository identity check and from the runner clock. Its minute-precision UTC semantic is
unchanged, no workflow input can supply it, and it never travels through `GITHUB_ENV`.

**The nominal cron minute — `10:17` in the temporary window, `01:17` permanently — is an opportunity, not the execution instant.** GitHub's documented behaviour is
that scheduled workflows may be delayed under load, so the collection identity is the actual
execution minute the runner observed and is deliberately not derived from the nominal cron minute.
A permanent test proves no nominal trigger time and no `github.event.schedule` value reaches the
identity.

### Collector semantics

Both workflows invoke the identical entry point,
`workers/data-platform/run-production-collection.mjs`, and there is **no scheduled fast path**.
`productionRunIdFor`, the source revision, season, Official FPL endpoints, canonical
normalisation, hashing, diff, materialisation, observation identity, D1 commit semantics and the
synchronous postflight are unchanged. The scheduled workflow accepts no input of any kind — no
SHA, timestamp, season, endpoint, database or SQL. The one change to the shared entry point is a
sanitized summary label that falls back to the scheduled SHA when no approved SHA exists.

### Resource and integrity contracts

No ceiling moved: 100,000 expected `rows_read`, 125,000 hard `rows_read`, 40,000 hard
`rows_written`, 4,000 maximum routine changed observations, 8 D1 API calls per cycle and 8 MiB per
Official FPL response all stand, alongside the D1 request-size limit, the pre-commit write
estimator, the whole-cycle read gate and independently enforced provider accounting. There is
still no blind mutation retry, an unknown mutation outcome still gets exactly one bounded
reconciliation, and the completed-run, `records_seen`, `records_accepted`, run-owned observation,
quarantine, rejection, `error_class`, head/logical-key, orphan-head, invalid-head, accepted-
observation and append-only requirements are untouched.

### No GitHub re-run

`run-production-collection.mjs` still refuses `GITHUB_RUN_ATTEMPT !== '1'` with
`workflow_retry_forbidden`, before any identity resolution or request, and still writes the
sanitized mutation classification to the workflow summary before rethrowing. A failed or unknown
scheduled collection is never retried by pressing Re-run, and there is no retry workflow and no
"run tomorrow's job now". The next natural scheduled event is the next opportunity.

### Shared serialization

Scheduled collection shares the existing `data-s2-production-collection` concurrency group with
the manual collection, the resume, the reconciliation read, the migration runner and the live
acceptance read, with `cancel-in-progress: false`. A scheduled run can therefore never race a
manual run, a recovery run or another scheduled run, and nothing in the group can cancel anything
else in it.

## H. Owner pre-merge gate — mandatory

Before merge, confirm, owner-side:

- [ ] environment `data-s2-production-scheduled` exists;
- [ ] its deployment branch rule is `main` only;
- [ ] it has **no** required reviewers;
- [ ] its environment secrets `CLOUDFLARE_D1_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set;
- [ ] its environment variable `CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT` is set;
- [ ] no D1 identifier is configured as a workflow or environment value;
- [ ] `data-s2-production-collection` is unchanged and still attended;
- [ ] Cloudflare Cron is still absent.

Secret values must never be requested, read, pasted or displayed.

## I. Live acceptance this checkpoint records

Verified independently from the GitHub Actions API:

| Fact | Evidence |
|---|---|
| Hardened manual normal production collection | Workflow `DATA-S2 Production Collection via D1 REST`, run `33818972728`, run number 2, attempt 1, event `workflow_dispatch`, head branch `main`, head SHA `319dfddd8ac83ae5ab7d20bfb684d3760bf64fbf`, conclusion `success`; both jobs — `repository-gate` and `collect` — succeeded. |

Because `runProductionCollection` returns only after its synchronous postflight has validated the
exact completed run, and the entry point rethrows on anything else, that success proves the
hardened manual trust boundary executed live end to end: the credential-free gate passed, the
protected production job passed, and the production runner completed through synchronous
postflight. It was not re-run and must not be re-run.

### Supporting resource telemetry — not provider accounting

Owner-side Cloudflare telemetry in a cleaner 30-minute window surrounding the accepted manual run
showed approximately 32k rows read, 375 rows written and 10 queries, with 12.55 MB of storage.
That window excludes the earlier first-run resume far better than the previous one-hour view.

These are **Cloudflare database time-window dashboard aggregates, not exact per-workflow provider
accounting**. They must never be recorded as the collection's exact usage. Only provider-returned
`meta.rows_read` and `meta.rows_written` are workflow accounting, and those remain independently
enforced inside the runtime after every request; for this run they reach only the GitHub Step
Summary, which is not retrievable through the GitHub API available here.

The telemetry is nonetheless sufficient to establish that a routine cycle sits far below the
ceilings, so **there is no justified resource-headroom remediation**. No SQL was optimised, no
index changed, no migration 0004 proposed and no read, write or change ceiling moved.

## J. First natural scheduled run — acceptance plan

Merging does not make the schedule live-proven. After merge, **wait for the first natural
scheduled event** at the wired cron (`17 10 * * *` in the temporary window, `17 1 * * *` permanently); do not simulate it, do not dispatch anything and do not create
a temporary trigger. Acceptance requires, from the GitHub Actions API:

- event `schedule`, with `github.event.schedule` exactly the wired cron — `17 10 * * *` in the temporary window, `17 1 * * *` permanently;
- attempt 1, head branch `main`, an exact 40-character head SHA;
- `repository-gate` success, including the exact-head Verify proof;
- `collect` success under `data-s2-production-scheduled`;
- no concurrency collision with a manual or recovery run;
- production postflight success in the runner;
- sanitized resource accounting inside every unchanged ceiling;
- Cloudflare Cron still absent and no Worker deployed.

If the first natural run fails **after production has started**, do not press Re-run and do not
dispatch a manual collection to "catch up". Read the sanitized mutation classification the entry
point wrote to the workflow summary first, then decide whether reconciliation is needed.

## K. Stop conditions

Stop and return to the owner rather than proceeding if a working schedule appears to require
Cloudflare Cron, a Worker deployment, migration 0004, a provider addition, any collector semantic
change, any weakening of the integrity contract, any increase to a resource ceiling, a production
credential in the repository, removal of the exact-head CI proof, removal of the second
remote-`main` check, or making the manual recovery environment unattended. None of those was
required or performed here.

## L. Known limitations

- GitHub's documented behaviour is that scheduled workflows can be delayed under load and that
  events can be dropped entirely, so the wired cron (`17 10 * * *` temporarily, `17 1 * * *`
  permanently) is a best-effort daily opportunity, not a
  guarantee. A missed day is a missed collection opportunity; the append-only history tolerates it
  and no catch-up mechanism exists or is approved.
- GitHub also disables schedules on repositories with no activity for an extended period. That is
  owner-visible, and this repository cannot detect or prevent it.
- The second remote-`main` check closes the admission window but is not atomic with the runner's
  first request; a push landing in that interval would not be detected.
- The environment's protection rules cannot be proved from this repository. Section H is the only
  control for them.
- Exact provider row accounting for the accepted manual run is unavailable, so the resource
  envelope for a routine scheduled cycle remains a repository plan estimate, not a Cloudflare bill.
  The repository still has no mechanism to read remaining daily D1 quota and none was added.

## M. Next gate

Owner review, the section H environment confirmation, then merge and exact-`main` Verify
Teamsheet. Live proof is the **first natural scheduled run**, judged against section J. A
pre-deadline collection opportunity, any second daily collection, any shorter cadence and any
Cloudflare Cron each remain separate, later, explicitly unapproved decisions.
