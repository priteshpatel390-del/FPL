# DATA-S2B Stage D — hardened once-daily GitHub Actions production collection schedule

Repository-only checkpoint. **No Cloudflare request, workflow dispatch, D1 read or mutation,
collection, resume, reconciliation, migration, deployment, Worker action, Cron change, GitHub
environment change or credential change was performed while preparing it.** The live facts
recorded below were read back independently from the GitHub Actions API; they were produced by an
owner-dispatched run that had already completed before this work began.

**Merging this checkpoint activates the schedule.** Once the scheduled workflow reaches the
default branch, GitHub can begin producing natural scheduled events for it. It is an activation
change, not inert preparation. The pre-merge owner gate in section H is mandatory.

**Status: the first natural scheduled production run has now succeeded, and the permanent cadence
`17 1 * * *` is restored.** Section B0.4 records that acceptance in full. The temporary acceptance
windows are finished and none is retained; exactly one production schedule trigger exists.

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

### B0.1 First attempt (10:17 UTC) produced no scheduled run

The first temporary window was `17 10 * * *` (10:17 UTC / 11:17 BST on 4 September 2026), merged to
`main` as `3c017786bce8cba8daf0091cf2e297f8e57789f8` at 09:34:11Z — a lead time of 42m49s before the
nominal minute. **That opportunity produced zero schedule runs.** Verified from the GitHub Actions
API after the minute passed: workflow `350014371` runs `total_count: 0`, and repository-wide
`event=schedule` runs `total_count: 0`. No run object was ever created, so nothing reached the
`repository-gate` job, the exact-head Verify gate, the `data-s2-production-scheduled` environment,
Cloudflare credentials, Official FPL, D1 REST or postflight. This was a pre-workflow event-creation
outcome, not a collection failure.

Configuration checks all passed across that window and remain true: the workflow file is on the
default branch `main` under `.github/workflows/`, it parses, it carries exactly one schedule trigger
and exactly one cron, GitHub recognises it by its `name:`, and its API `state` is `active`. The
repository is public, not a fork, not archived, not disabled, and its owner is a User account, so no
organization Actions policy layer exists. GitHub exposes **no** scheduler-registration or next-run
metadata for Actions cron beyond the workflow definition and `state` — neither REST nor GraphQL —
so whether a given cron is armed cannot be proved from outside. GitHub's own documentation records
that the `schedule` event can be delayed under load and that sufficiently loaded events **may be
dropped entirely**, and documents no required registration delay after a cron is added or edited.
The non-fire therefore has no proven root cause and none is claimed here.

Note also that this repository's `main` had never carried any cron before 08:28:58Z on 4 September
2026, so the absence of earlier natural scheduled runs is expected history rather than evidence of
a defect.

### B0.2 Second attempt (11:30 UTC) also produced no scheduled run

Following that zero-run first attempt the owner approved **a second real natural acceptance
opportunity at 11:30 UTC / 12:30 BST on 4 September 2026**, implemented by moving the same single
trigger to `30 11 * * *`. **That opportunity also produced zero schedule runs**, with the same
observed boundary as the first: no run object was created, so nothing reached the
`repository-gate` job, the exact-head Verify gate, the `data-s2-production-scheduled` environment,
Cloudflare credentials, Official FPL, D1 REST or postflight. The configuration checks recorded in
section B0.1 continued to hold across that window, and the non-fire again has **no proven root
cause**; none is claimed here.

### B0.3 Third owner-approved opportunity — 14:17 UTC / 15:17 BST

After the two zero-run windows the owner approved **a third real natural acceptance opportunity at
14:17 UTC / 15:17 BST on 4 September 2026**, implemented by moving the same single trigger to
`17 14 * * *`. It was a **temporary** window on the same real production scheduled workflow; it
added no second cron, no `workflow_dispatch`, no heartbeat workflow, no diagnostic cron and no
other trigger, and it changed no collector, gate, environment, credential or Cloudflare behaviour.
The permanent intended cadence was, throughout, **`17 1 * * *` (01:17 UTC)**, and restoration to it
was reserved for a later, separate, explicitly owner-approved pull request. **This window fired**:
see section B0.4, and section B0.5 for the restoration.

The workflow declares **no `timezone:` field**, so GitHub interprets its cron in UTC. That UTC
scheduling model is deliberately left unchanged so timezone-aware scheduling is not introduced as
another variable during this diagnostic. The UK is on BST (UTC+1) on 4 September 2026, so
**14:17 UTC is 15:17 BST**. The minute is deliberately `17` rather than the top of the hour.

The window record so far:

| Window | Cron | UTC | BST | Result |
|---|---|---|---|---|
| First | `17 10 * * *` | 10:17 | 11:17 | zero schedule runs created |
| Second | `30 11 * * *` | 11:30 | 12:30 | zero schedule runs created |
| Third | `17 14 * * *` | 14:17 | 15:17 | **one successful natural scheduled run, created 17:38:15Z** |

Live evidence gathered between the second and third windows, none of which changes the failure
boundary:

- PR #220 merged as `main` `98a5f994a3cdd4fc045c1f20ad86160d48170104`, and exact-`main` Verify run
  `33871227472` succeeded.
- The read-only scheduled-environment credential preflight ran once as run `33871716975`,
  attempt 1, on exact `main`, and **succeeded**. It proved, point in time, that
  `CLOUDFLARE_ACCOUNT_ID` matches `CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT`, that
  `CLOUDFLARE_D1_TOKEN` verifies as `active`, and that those credentials can read the exact
  reviewed production D1 database. It executed no SQL and performed no mutation.
- The owner subsequently, manually, **disabled and immediately re-enabled** the existing scheduled
  production workflow.

**The failure boundary observed so far is GitHub schedule-event creation**, which is strictly
upstream of every credential the preflight checks. Neither miss is a credential failure, an
environment failure or a Cloudflare failure, and neither may be described as one. GitHub exposes no
scheduler-registration, armed or next-run state through REST or GraphQL, and documents that
schedule events may be delayed under load or dropped entirely, so no root cause is proven and none
is invented.

What this window does **not** change: the workflow stays schedule-only with exactly one trigger,
no `workflow_dispatch`, no push or pull-request trigger, no `timezone:` field; 01:17 UTC is not
retained beside 14:17; the environment, credentials, collector entry point, concurrency group,
exact-SHA trust gate, exact-head Verify requirement, no-rerun rule, resource ceilings and
synchronous postflight are all unchanged; Cloudflare Cron stays superseded and absent; the manual
production collection workflow and the read-only scheduled-environment preflight workflow are
untouched; no Worker, schema, SQL, migration, provider or model behaviour changes.

That third window did produce a real production D1 collection. Its evidence is section B0.4, and
the restoration it required is section B0.5.

### B0.4 First successful natural scheduled production run — ACCEPTED

The third window produced the **first successful natural scheduled production run**. Every fact
below was read back independently from the GitHub Actions API after the run completed; nothing was
dispatched, simulated, re-run or re-requested to obtain it.

| Fact | Observed value |
|---|---|
| Workflow | `DATA-S2 Scheduled Production Collection via D1 REST` |
| Run ID | `33901634593` |
| Run number | 1 |
| Run attempt | 1 |
| Event | `schedule` |
| Head branch | `main` |
| Head SHA | `dac27b3860428bc55c6d505e8a817a207d30f904` |
| Workflow path | `.github/workflows/data-s2-production-scheduled.yml` |
| `repository-gate` | success |
| `collect` | success |
| Run conclusion | success |
| Nominal cron minute | 14:17 UTC (15:17 BST), from `17 14 * * *` |
| GitHub run created | `2026-09-04T17:38:15Z` |
| Run completed | `2026-09-04T17:38:58Z` |

**This acceptance used no `workflow_dispatch`.** It was a genuine `schedule` event, on attempt 1,
against the then-current `main`, and it therefore satisfies the temporary natural-schedule
acceptance gate that sections B0.1 to B0.3 were opened to close.

What the run proves, and only this:

- GitHub **can** create a natural `schedule` event for this workflow, on this repository, on the
  default branch — the boundary that both earlier windows failed at;
- the credential-free `repository-gate` passes end to end on a scheduled event: event name,
  `github.event.schedule`, repository, ref, 40-character SHA, exact checkout, `HEAD`, clean tree,
  a freshly resolved remote `main`, and the exact-head `Tests and deterministic build` proof, which
  the gate resolved as `verify_success after 1 read(s)`;
- the `collect` job is admitted to the dedicated `data-s2-production-scheduled` environment and its
  credentials resolve;
- the real production collection path executes to success through the unchanged shared entry point
  `workers/data-platform/run-production-collection.mjs`, including its synchronous postflight —
  `runProductionCollection` returns only after that postflight has validated the exact completed
  run, so the job's success is a whole-path proof, not merely a process exit;
- the production D1 REST write path therefore works unattended.

Exact provider `meta.rows_read` and `meta.rows_written` for this run reach only the GitHub Step
Summary and are **not** retrievable through the GitHub API available here. They are stated nowhere,
and no Cloudflare dashboard aggregate is substituted for them.

#### The observed GitHub scheduler delivery delay

The nominal opportunity was 14:17 UTC. GitHub created the run at 17:38:15Z. The observed delay
between the nominal cron minute and **GitHub's creation of the run object** was therefore
approximately **3 hours 21 minutes**.

That is a **schedule-event delivery delay, not a collection delay**, and it must never be recorded
as one. Once GitHub created the run, execution was prompt: the run completed in approximately 43
seconds end to end, with the gate finishing at 17:38:36Z and the collection step itself running
from 17:38:49Z to 17:38:54Z.

**The cause of the delay is not proven, and none is invented here.** GitHub exposes no
scheduler-registration, armed or next-run state through REST or GraphQL, so the delay cannot be
attributed from outside. GitHub documents that the `schedule` event can be delayed under load and
that sufficiently loaded events may be dropped entirely, which is consistent with both this delay
and the two earlier zero-run windows, but consistency is not proof of cause.

One successful natural run does **not** establish scheduler reliability, a delivery-time
distribution, or any guaranteed execution instant. It establishes that natural delivery happens and
that the whole downstream path works when it does. See section L.

### B0.5 Restoration to the permanent cadence

With the acceptance in B0.4 recorded, the separately reviewed restoration returns the single
trigger and `PRODUCTION_COLLECTION_SCHEDULE` together to the permanent **`17 1 * * *`
(01:17 UTC)**. The temporary windows are finished and none is retained beside it: no second cron,
no diagnostic cron, no schedule probe, no heartbeat workflow, no `workflow_dispatch` on this
workflow, no Cloudflare Cron and no `timezone:` field. Exactly one production schedule trigger
exists, and a permanent test binds the constant, the workflow cron and the gate's `EVENT_SCHEDULE`
comparison to the same value.

**Merging the restoration changes the live production collection schedule** from 14:17 UTC back to
01:17 UTC. Nothing else about the collector, gate, environment, credentials, ceilings, schema or
provider behaviour changes with it.

## B. The approved schedule

Exactly one trigger, in a new workflow, `.github/workflows/data-s2-production-scheduled.yml`:

```yaml
on:
  schedule:
    - cron: '17 1 * * *'
```

That is **one best-effort full production collection opportunity each UTC day**, at 01:17 UTC. The
temporary 4 September 2026 acceptance windows in section B0 are finished and the permanent cadence
is restored; the workflow declares no `timezone:` field, so 01:17 UTC is 02:17 BST while the UK is
on British Summer Time and 01:17 GMT otherwise.
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
2. `github.event.schedule` is exactly `17 1 * * *`;
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

**The nominal cron minute — `14:17` in the temporary window, `01:17` permanently — is an opportunity, not the execution instant.** GitHub's documented behaviour is
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
scheduled event** at the wired cron `17 1 * * *`; do not simulate it, do not dispatch anything and
do not create a temporary trigger. Acceptance requires, from the GitHub Actions API:

- event `schedule`, with `github.event.schedule` exactly `17 1 * * *`;
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
  events can be dropped entirely, so the wired cron `17 1 * * *` is a best-effort daily
  opportunity, not a guarantee. A missed day is a missed collection opportunity; the append-only
  history tolerates it and no catch-up mechanism exists or is approved.
- **This repository has now directly observed both failure modes.** Two windows produced zero
  scheduled runs, and the window that did fire was delivered approximately 3h21m after its nominal
  minute (section B0.4). The nominal cron minute is therefore an opportunity, never an execution
  time, and the collection identity is always the actual execution minute. No arbitrary short
  lateness threshold — 30 minutes, 60 minutes or any other — may be used to declare a future run
  missed; a judgement that a day was missed must account for this observed delivery behaviour.
- One successful natural run is a **single sample**. It proves natural delivery and the whole
  downstream path, and it proves nothing about delivery reliability, delay distribution or a
  guaranteed execution instant.
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

The Stage D live proof is **complete**: the first natural scheduled run succeeded (section B0.4),
which closed the temporary acceptance windows and permitted the restoration to `17 1 * * *`
(section B0.5).

The remaining gate belongs to the restoration itself. Owner review, then merge and exact-`main`
Verify Teamsheet; after that, the **first genuine natural run produced by `17 1 * * *`** is the
next live observation. Judge it against section J. Do not substitute a `workflow_dispatch`, do not
create another temporary acceptance cron, and do not declare a missed run against an arbitrary
short lateness threshold — section L records the delivery behaviour this repository has actually
observed.

A pre-deadline collection opportunity, any second daily collection, any shorter cadence and any
Cloudflare Cron each remain separate, later, explicitly unapproved decisions.
