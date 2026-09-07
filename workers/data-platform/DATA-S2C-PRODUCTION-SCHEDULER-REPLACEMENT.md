# DATA-S2C — external production scheduler

**Status: Package A repository foundation merged; Package B GitHub timer retirement done; no
Cloudflare provisioning performed.** Sections 1–11 record Package A and were accurate when written.
Section 12 records Package B and is the current DATA-S2C state.

No GitHub personal access token or GitHub App was created. No Cloudflare secret was created. No
Worker was deployed. No Cloudflare Cron Trigger was created, changed or removed. No workflow was
dispatched. No D1 request was performed. No Official FPL endpoint was contacted for collection. No
production collection was run. The existing GitHub cron remains `17 1 * * *` and is untouched by
this package.

---

## 0. Owner rollout decision — 7 September 2026

**This section is the canonical statement of how DATA-S2C is to be rolled out, and it supersedes
every earlier statement in this record describing a deliberate period in which the GitHub scheduled
workflow A and the Cloudflare-dispatched workflow B both operate automatically.** Those statements
were accurate when written and are retained below as history, marked SUPERSEDED where they are
forward-looking.

### 0.1 What was previously planned, and why

The original rollout kept workflow A's GitHub cron armed while workflow B was brought up, ran both
automatic paths together for an acceptance period, proved the guard stopped them double-collecting,
and only then retired A. The reasoning was to avoid any gap in DATA-S2 history: the replacement
would be proven while the incumbent still ran.

### 0.2 What the owner decided instead

That rollout is **superseded**. The revised owner-approved direction is:

1. finish and merge the Package A repository safety foundation;
2. **before** Cloudflare automatic scheduling is activated, disable GitHub's automatic scheduler
   workflow A;
3. confirm no already-running or pending workflow A execution remains that could later collect;
4. provision the Cloudflare dispatcher **dormant** — credential, secret binding, Worker deployment,
   and **zero** cron triggers;
5. prove the dormant dispatcher is harmless;
6. separately approve Cloudflare scheduler activation;
7. Cloudflare then becomes the **only** automatic clock;
8. GitHub Actions remains the execution engine;
9. the attended manual workflow C remains available for owner-approved recovery;
10. observe Cloudflare operation and prove no more than one production collection per UTC day;
11. later delete or retire the obsolete GitHub scheduled workflow, once Cloudflare has demonstrated
    acceptable operation.

**There is no planned deliberate A+B automatic coexistence acceptance period, and A+B overlap must
not be described as the intended future operating mode.** A future session must not reconstruct the
coexistence rollout from the historical text below without a new explicit owner approval.

### 0.3 Why the decision changed

Teamsheet is still in development and testing. The DATA-S2 structured history is useful and
valuable, but Teamsheet is not yet dependent on it for normal live decision-making in a way that
justifies keeping a scheduler already known to be unreliable running solely to avoid a temporary
collection gap.

The previous plan spent substantial complexity answering *"how do we safely operate two automatic
schedulers at the same time?"* when the simpler option was *"disable the scheduler we already know
we do not trust before activating its replacement."* The revised approach **removes the failure mode
rather than engineering machinery to tolerate it**.

### 0.4 Capability versus intended rollout — these are different claims

| | |
|---|---|
| **Capability** | The repository safely supports guarded workflow A and guarded workflow B, both governed by the same fail-closed daily opportunity guard. That capability is implemented, tested and unchanged. |
| **Intended rollout** | Workflow A will be disabled before Cloudflare automatic scheduling is activated, so deliberate automatic A+B coexistence is no longer part of acceptance. |

The implementation is **not** rewritten because the rollout changed. Package A's guard, attempt
semantics, pagination, read bound and fail-closed behaviour all stand exactly as reviewed.

**FACT at the Package A checkpoint, retained as history: workflow A was not disabled.** Workflow
`350014371` reported `state: active` as live external state, and this repository could not change
that. Nothing in that documentation reconciliation disabled, enabled, dispatched or otherwise altered
any workflow, credential, Worker or Cron Trigger. **Superseded on 7 September 2026:** the owner has
since taken that separate live action, and the workflow now reports `state: disabled_manually` — see
§12.1.

### 0.5 The guard is not wasted

The guard remains necessary after workflow A is disabled, for two reasons that have nothing to do
with coexistence:

* **Cloudflare's planned scheduler has three dispatch opportunities a day — 01:17, 02:17 and 03:17
  UTC — and they are retry *availability*, not three collections.** The intended shape is: 01:17
  dispatches and the collection succeeds; 02:17 dispatches, the guard sees the day already collected
  and refuses; 03:17 dispatches, the guard refuses again. Without the guard, three opportunities
  would mean three collections.
* **An attended manual workflow C collection can already have consumed the day**, and both automatic
  opportunities must refuse after it.

What is superseded is only the assumption that the guard must support a deliberate long-running
GitHub-scheduler plus Cloudflare-scheduler overlap experiment.

### 0.6 Accepted temporary history gap

A temporary DATA-S2 history gap may occur between disabling GitHub scheduling and successfully
activating Cloudflare. That is an **accepted development-stage trade-off**.

It is accepted because Teamsheet remains in development and testing, the replacement is intended to
be short and controlled, and reducing migration complexity is worth more at this stage than a
zero-gap scheduler handover.

It is **not** claimed that observations lost to a gap can be reconstructed later. The next collection
captures the then-current Official FPL state; intermediate changes that occurred during a gap may
simply be unavailable. **No gap has occurred**, and none may be reported as having occurred unless
it actually has.

### 0.7 The durable engineering principle

> **Prefer removing an unnecessary failure mode over engineering machinery to tolerate it,
> particularly while Teamsheet remains in development and the affected capability is not yet relied
> upon for normal live decision-making.**

Before proposing substantial migration or safety machinery, work this checklist:

1. Can the problem be removed rather than accommodated?
2. Does Teamsheet's current maturity justify the complexity?
3. What is the simplest reversible solution?
4. Which safe related steps can be combined into one owner approval?
5. Can validation be automated instead of requiring repeated owner or manual checking?

This is **not** a blanket rule against production hardening. Use complexity when the product or the
risk actually requires it; do not automatically design for zero-downtime migration when the current
product stage does not need one.

### 0.8 Owner involvement is exception-based

Pritesh makes product, risk and approval decisions. He should not be required to shuttle routine
technical status between tools when those steps can safely be combined or automatically verified, so
safe related actions are grouped into sensible approval packages.

That reduces handoffs; it does **not** weaken any approval gate. Live production mutation,
credentials, deployment, scheduler activation, provider/data/model changes and merging each still
require explicit owner approval.

---

## 1. Why DATA-S2C exists

GitHub Actions schedule delivery is best-effort, and this repository has measured how loosely
"best-effort" can be read. The 4 September 2026 acceptance run `33901634593` was created
approximately **3h21m** after its nominal minute. The 5 September 2026 run `33948145320` was created
approximately **4h31m** after its nominal minute. Earlier acceptance windows — `17 10 * * *` and
`30 11 * * *` — produced **zero** scheduled runs at all. GitHub documents that schedule events may
be delayed under load or dropped entirely, and exposes no scheduler-registration, armed or next-run
state through REST or GraphQL, so none of those observations has a proven cause and none can be
diagnosed further from here.

The collection itself is not the problem: once a run object existed, the accepted run finished in
about 43 seconds. The problem is entirely upstream, in whether and when the run object is created
at all.

DATA-S2C therefore introduces a **separate, independent way to ask for the day's collection** — an
isolated Cloudflare timer that dispatches a GitHub Actions workflow. It does not replace the
collection engine, and it must never become one.

> **SUPERSEDED wording, retained as history.** This section previously read "*while leaving the
> existing GitHub cron in place*". That described the original coexistence rollout. Under the
> 7 September 2026 owner decision in §0, GitHub's automatic scheduler is to be **disabled before**
> Cloudflare automatic scheduling is activated, so Cloudflare becomes the only automatic clock
> rather than a second one running beside GitHub. Workflow A remains active as live external state
> today; that disable is a separate approved action.

## 2. What Package A is, and what it is not

Package A is the repository foundation. It adds:

1. a pure, deterministic, fail-closed **opportunity guard** and its credential-free entry point;
2. that guard **wired into the existing scheduled workflow's** credential-free repository gate;
3. a new **external receiving workflow** for an unattended dispatch;
4. a new **isolated Cloudflare dispatcher Worker** whose Wrangler configuration declares an
   explicitly empty cron list;
5. this record and the canonical documentation reconciliation.

Package A is **not** an activation. It creates no credential, deploys nothing, arms no timer and
dispatches nothing. Packages B, C, D and E — the credential, the deployment and cron activation,
and everything after — are separate and separately approved.

The one behavioural change Package A does carry, once merged, is that **future natural runs of the
existing scheduled workflow will execute the new fail-closed opportunity guard**. That is approved
and intended.

## 3. The daily opportunity guard

`workers/data-platform/scheduled/opportunity-guard.mjs` is a pure classifier over GitHub Actions run
and job metadata. `workers/data-platform/scheduled/run-opportunity-guard.mjs` is its credential-free
workflow entry point.

### 3.1 Why it is needed at all

DATA-S2 offers exactly one full collection opportunity per UTC day. Until DATA-S2C that was true
only because exactly one trigger existed. A second unattended execution path makes "one a day"
something the repository has to prove rather than something the trigger count implies.

### 3.2 Governed scope — routine collection only

| Workflow | File | Kind | Guarded |
|---|---|---|---|
| A | `.github/workflows/data-s2-production-scheduled.yml` | automatic | **Yes** |
| B | `.github/workflows/data-s2-production-external.yml` | automatic | **Yes** |
| C | `.github/workflows/data-s2-production-collection.yml` | owner, attended | **No** |

All three carry a credentialled job literally named `collect`, and the guard's classification turns
on that job.

Resume, migration, reconciliation, EXPLAIN and integrity workflows are **deliberately excluded**
from the daily opportunity. They are not routine collection, they carry their own owner-input and
approval gates, and they share the production concurrency group. Folding them into a daily counter
would let a read-only integrity check silently cancel a day's collection, which is worse than the
duplication it would prevent.

Workflow C is not modified. The attended owner boundary keeps its owner-supplied SHA, its attended
environment and its human approval, and it is deliberately left unguarded so the owner can always
collect. It does, however, **consume** the day for both automatic paths.

### 3.3 The rules

A run **consumes** the day's opportunity when, on its **first attempt**, both hold:

* a `collect` job execution exists with any conclusion **other than `skipped`**; and
* that `collect` execution **started** in the current UTC day, **or** within the **trailing six
  hours**.

Every attempt is still read — see §3.3.1 — so that a later attempt can never hide the first
attempt's evidence. A later attempt is never evidence of a collection itself, because the production
entry point refuses it before any production work.

Workflow A refuses if either condition is true. Workflow B refuses if either condition is true.

`skipped` is exactly what the Actions API reports for a `collect` job whose credential-free
repository gate refused, so a **gate-only failure correctly leaves the opportunity available**. A
`collect` job that is queued or in progress carries a `null` conclusion and **does** consume: it is
either running or about to, and treating that as free is the one direction this guard must never
fail in. A run that has not reached `collect` at all has no such job and does not consume; the
shared concurrency group, not this guard, is what serializes concurrent runs.

A run never consumes its own opportunity, on any attempt: the asking run's id is excluded
explicitly.

### 3.3.1 Every attempt is inspected

The jobs listing is requested with **`filter=all`**, never `filter=latest`. `latest` returns only
the most recent execution of each job, and that would let a re-run erase a real collection: attempt 1
reaches `collect` and may mutate production, somebody later re-runs all jobs, attempt 2's gate
refuses, attempt 2's `collect` is reported `skipped`, and a `latest` view would report the day as
free. **Every attempt is read so that a later one can never hide attempt 1's evidence**, and the
order the provider returns executions in is irrelevant.

**Only attempt 1 can consume the day.** That is a repository fact rather than a provider one. The
shared production entry point, `workers/data-platform/run-production-collection.mjs`, contains

```js
if(process.env.GITHUB_RUN_ATTEMPT!=='1')throw new Error('workflow_retry_forbidden');
```

and it executes **before** `maskProductionIdentity(resolveProductionIdentity(...))`, before
`runProductionCollection(...)` and before any network use. A GitHub re-run attempt therefore cannot
resolve the production identity, cannot reach the collector, cannot call Official FPL, cannot call D1
and cannot mutate production. A permanent structural regression pins that literal, proves it appears
exactly once at module top level, and proves — after blanking the import lines — that every call to
`resolveProductionIdentity`, `maskProductionIdentity` and `runProductionCollection` and every use of
`fetch` occurs after it, with nothing touching the network, Official FPL or D1 before it. **The entry
point is not modified by this package.** If that invariant ever moves, disappears or comes to sit
after production work, the test fails and both the attempt-1 rule and the 35-day discovery horizon
below must be revisited.

So the two roles are separate and both are needed:

* `filter=all` remains **load-bearing**, because a later attempt must never be allowed to hide
  attempt 1's evidence;
* a later attempt is **never evidence of a collection in its own right**.

A re-run's `collect` job does start — the runner boots and the entry point throws — so a later
attempt reported `failure`, `cancelled`, `timed_out`, queued or in progress is exactly what the
invariant predicts and is ignored, needing no timing at all. A later attempt reporting a
**successful** `collect` is not producible under that invariant, so it is treated as impossible state
and returns `AMBIGUOUS_REQUIRES_OWNER_ATTENTION` with the reason `guard_rerun_contract_violated`
rather than being trusted either way. There is deliberately no path by which a re-run can make a day
available that attempt 1 already collected.

The jobs read stays bounded by one page of 100 executions rather than by pagination, and what bounds
it is fail-closed truncation rather than the provider's re-run cap. GitHub permits a run to be re-run
a maximum of **50 times**, and those re-runs are **in addition to** the original attempt, so a fully
exhausted run carries **51 attempts** and, at exactly two governed jobs per attempt, **102 job
executions** — two more than a 100-row page returns. One page therefore cannot be claimed to cover
every history GitHub permits.

That case is bounded, not assumed away: a listing whose `total_count` exceeds the rows returned is
**truncated and fails closed** — a truncated page could be missing exactly the attempt that
collected — so the pathological history returns `AMBIGUOUS_REQUIRES_OWNER_ATTENTION`, never
`OPPORTUNITY_AVAILABLE`, and the two missing rows are never inferred. It is an accepted pathological
limitation rather than a normal operational problem: reaching it takes a single run exhausting
essentially the whole permitted re-run allowance. The jobs listing carries no `page` parameter at
all.

### 3.3.2 Candidate discovery is a different, wider window

Two windows exist, and conflating them is a correctness bug rather than untidiness.

| | Window | Measured from | Purpose |
|---|---|---|---|
| Consumption | current UTC day **or** trailing six hours | the `collect` job's `started_at` | decides whether the day is spent |
| Candidate discovery | consumption window start **minus 35 days** | the workflow run's `created_at` | finds runs that *might* contain an in-window collect |

The Actions API can only filter a run listing on the run's own `created_at`. Filtering it by the
consumption window omits exactly the run this guard most needs: one created at 23:50 whose `collect`
started at 00:10 is invisible to a `created>=` filter dated on the new day, and the classifier never
sees the collection it would have correctly refused.

**The invariant discovery must satisfy:** every governed run containing a `collect` execution that
started inside the consumption window is either examined, or the guard fails closed. Discovery may
return runs that cannot consume; it must never omit one that could.

**The 35 days is derived from a first-party GitHub limit, not chosen.** Because only attempt 1 can
consume, the only gap discovery has to cover is how long an **original** attempt can wait before its
`collect` begins, and one documented limit bounds exactly that:

* **Workflow run time — 35 days per workflow run.** "If a workflow run reaches this limit, the
  workflow run is cancelled. This period includes execution duration, and time spent on waiting and
  approval." ([Actions limits](https://docs.github.com/en/actions/reference/limits))

So no `collect` execution of a run's original attempt can begin later than **T + 35 days**.

**Why the 30-day re-run eligibility is excluded — superseding the earlier 65-day derivation.** An
earlier revision of this record chained GitHub's re-run eligibility ("You can re-run a workflow run,
all failed jobs in a workflow run, or specific jobs in a workflow run up to 30 days after its initial
run") onto the 35-day run limit and reached 65 days. That chaining is only load-bearing if a re-run
can consume the day, and §3.3.1 establishes that none can: the production entry point refuses every
attempt after the first before any production work. A repository invariant that **refuses the work**
is stronger and more specific than a provider window that merely **permits the attempt**. The 65-day
horizon is therefore withdrawn, and the cost of keeping it was real — 65 days of candidates could not
be inspected inside any reasonable read bound.

What the 35-day derivation deliberately does not lean on:

* **Environment approval adds nothing.** "A workflow may wait for up to 30 days on environment
  approvals" is already inside the 35-day run limit, which explicitly includes waiting and approval.
* **The 50-re-run cap is not a discovery input.** It survives in this design only as the arithmetic
  behind the single 100-row jobs page — 50 re-runs beside the original attempt is 51 attempts and
  102 executions, which that page does **not** cover, so the page is bounded by fail-closed
  truncation instead (§3.3.1).
* **It does not matter whether `created_at` advances on a re-run.** Attempt 1 is dated by the
  original creation either way; a run that looked newer would only be discovered more easily.
* **Job-level limits are not used as the bound.** The 6-hour GitHub-hosted job execution limit and
  the 24-hour job queue limit (documented for **self-hosted** runners) bound execution and queueing,
  not the run-creation-to-job-start gap this needs.

**No run-level field is used to prune candidates.** `updated_at`, `run_started_at`, `status` and
`conclusion` would each cheaply exclude most old runs, but the REST reference does not define
semantics strong enough to prove that a run with an old `updated_at` cannot contain a `collect`
execution that started inside the window, and `run_started_at` describes only the **latest** attempt.
An inference that is usually true is not a guard. Correctness is not traded for fewer requests; the
guard reads jobs for every candidate or fails closed.

**Discovery is a bounded page sequence per governed workflow, and it has to be.** Under Package C
workflow B gains three dispatch opportunities a day beside workflow A's one, so a 35-day horizon
holds roughly 35 workflow A runs and 105 workflow B runs — about 140 candidates. One 100-row page
cannot carry workflow B's share, and a single page would silently omit the run that collected.

The algorithm is fixed before it starts and never recurses:

1. request page 1 at `per_page=100` with the provider's own `created>=` filter and an explicit
   `page=1`;
2. take the provider's `total_count` for the whole filtered set and compute the page count from it —
   `ceil(total_count / 100)` — **before** any further request is issued;
3. refuse as `guard_read_bound_exhausted` if that exceeds the ten-page cap;
4. read pages 2..N sequentially with explicit `page=N`, each spending one unit of the same shared
   read budget;
5. require every page to carry **exactly** the rows arithmetic says remain — whatever is left after
   the preceding full pages, capped at the page size — so a short **or** an over-full page is
   rejected;
6. require every later page to report the **same** `total_count`;
7. require the accumulated rows to reconcile exactly with that total, and to contain **no duplicate
   run id**.

Ordering is never relied on for correctness. Every failure mode is an ambiguity, not a best guess:
a malformed, unreadable or failing page, a short or over-full page, a `total_count` that changes in
either direction between pages, a run repeated across pages and a missing row are all
`guard_read_failed`; exceeding the page cap or the read bound is `guard_read_bound_exhausted`. A
filtered set that shifts underneath the sequence — a run created or ageing out mid-read — can produce
exactly those inconsistencies, and the guard then refuses that invocation rather than proceeding on a
set it cannot prove complete. That is recorded as a limitation: a benign race costs an automatic
collection opportunity.

### 3.3.3 The window is dated by when `collect` started

Consumption timing comes from the `collect` job's own `started_at`, **never** from the workflow
run's `created_at`. A run object can be created and then wait — on GitHub, on environment admission,
or behind the shared production concurrency group — long before collection begins, so a run created
at 23:50 UTC whose `collect` starts at 00:10 UTC performed its collection on the **following** UTC
day. Dating that by `created_at` would call the collection stale and admit a second one the same
day.

A non-skipped `collect` execution must therefore prove when it began, and anything less is
`AMBIGUOUS_REQUIRES_OWNER_ATTENTION`, never an assumption:

* a missing or unparseable `started_at` — including a queued execution that has not started;
* a job `status` outside `queued`, `in_progress`, `completed`;
* a missing or non-positive `run_attempt`;
* a `started_at` earlier than its own run's `created_at`, or later than the current clock, both of
  which contradict the payload rather than dating the collection.

A `skipped` execution needs no timing at all: it proves nothing happened, so it is not evidence and
is never the reason for an ambiguity.

### 3.3.4 The read bound

`OPPORTUNITY_GUARD_MAX_READS` is **200**. It is a **hard cap, not a target**, and it counts every
GitHub request the guard makes — each candidate-listing page and each run's job listing. The normal
path exits far below it. On the 201st required request the guard refuses as
`guard_read_bound_exhausted` and **that request is never issued**.

**The budget, stated honestly.** The population below was sized for the superseded coexistence
rollout — workflow A once a day beside workflow B three times a day across the 35-day discovery
horizon. Under the §0 rollout, workflow A is disabled before Cloudflare activation, so the real
steady state is **smaller** than this table: roughly 105 workflow B runs and no workflow A runs, and
the A rows age out of the 35-day horizon after the disable. **The bound is deliberately left at 200
and the sizing is deliberately left at the larger population**, because a conservative budget stays
correct while workflow A is still armed, during the transition, and if the owner ever re-enables it.
No constant changes:

| | Requests |
|---|---|
| Workflow A candidate runs, one a day | ~35 |
| Workflow B candidate runs, three a day after Package C | ~105 |
| Job listings, one per candidate | ~140 |
| Candidate-listing pages — A one, B two, C normally one | ~4 |
| **Total** | **~144** |
| Remaining inside 200 | **~56** |

That remainder covers attended workflow C runs, small variance, additional historical routine runs
and provider page-shape overhead. A permanent regression drives exactly this population — 35 A runs,
105 B runs and 2 attended runs — and measures **146** requests with **54** spare.

**What this is not.** It is not a proof that 200 covers every pathological history. A repository with
an unusual accumulation of governed runs still exceeds it, and pathological history must still fail
closed — it refuses the collection rather than admitting an unexamined candidate. Two further
regressions pin the boundary exactly: a cycle needing exactly 200 requests resolves and issues
exactly 200; a cycle needing a 201st refuses having issued exactly 200 and never reaching the final
listing.

The superseded position — a twelve-read bound allowing at most nine candidates, and the rejected
160-read proposal — are both withdrawn. Nine candidates could not sustain the approved cadence at
all, and 160 was underpriced against the same 35 A + 105 B population. That population is now a
**conservative sizing assumption rather than a description of intended operation**, and the bound is
unchanged at 200. This is recorded as revised limitation **S2C-8**.

### 3.3.5 Guard invocation frequency and rate limits

**Under the §0 rollout the intended steady state is up to three automatic guard invocations in a UTC
day** — workflow B's 01:17, 02:17 and 03:17 UTC opportunities, with workflow A disabled. Four is the
bounding case rather than the plan: it occurs only while workflow A is still armed, which is true
today and until the separately approved disable happens. The earlier "two automatic invocations per
day" statement is superseded, and the "four during overlap" statement is retained below as the
**upper bound**, not as intended operation.

Each invocation is separately bounded at 200 requests. That does **not** mean 800 requests an hour
will occur: the fires are separated by schedule time, and the normal guard path short-circuits far
below the cap. Equally, no unused GitHub rate-limit headroom is claimed here. The real safety
properties are exactly these:

* one invocation is bounded at 200 requests;
* exceeding 200 fails closed, without issuing the request that would exceed it;
* Package C's three workflow B opportunities are the intended automatic invocations once workflow A
  is disabled; while workflow A is still armed, it plus those three are an upper bound of four
  automatic guard invocations in a UTC day;
* GitHub's token and API limits remain an **external dependency**, to be observed in live Stage C/D
  rather than asserted from this repository.

### 3.4 Why the trailing six hours

The current UTC day alone leaves a hole at midnight. A run delivered late at 23:58 UTC and a
punctual run at 00:03 UTC the next day are two collections about five minutes apart that a bare
calendar-day rule would both admit — and GitHub's observed lateness of 3h21m, 4h31m and 4h44m makes
exactly that arrival pattern reachable. Six hours closes it without reaching back into the previous day's
own legitimate opportunity, because the nominal cadence is 01:17 UTC.

The window is the **union** of the two rules, never the intersection.

### 3.5 Fail-closed

Every malformed, partial, truncated, unreadable or unclassifiable input is
`AMBIGUOUS_REQUIRES_OWNER_ATTENTION`, and the workflow stops. There is no fail-open path. That
includes: a listing whose provider total does not equal the rows returned, whether of candidate runs
or of job executions; a run row without a positive integer id or a parseable creation instant; a job row
of the wrong shape, or without a status, attempt number or usable start instant where the decision
depends on one; a started `collect` whose timing contradicts its own run or the clock; a missing or
extra governed workflow; a non-200 response; a body that will not decode; a transport failure; and
an exhausted read bound. Timing that cannot be established is reported as the closed reason
`guard_collect_timing_unusable`.

It also includes: a candidate page carrying a different number of rows than the provider's own
`total_count` arithmetic requires for that page number, a `total_count` that changes between pages,
a run id repeated across pages, and a later attempt reporting a **successful** `collect`, which
contradicts the pinned entry-point invariant and is reported as the closed reason
`guard_rerun_contract_violated`.

The read bound is a hard cap of **200** GitHub REST GETs across every candidate-listing page and
every job listing, with a further ten-page ceiling per workflow listing (§3.3.4). Every listing is
bounded by the provider itself, using the Actions `created=>=` filter over the discovery start date
with an explicit `page=N`, so the guard never depends on an unbounded page happening to be ordered
newest first and never follows a cursor or a `Link` header.

### 3.6 Credentials and logging

The guard needs `actions: read` and nothing else. It holds no Cloudflare credential, no D1
credential and no production D1 identifier. It issues GETs only — it never dispatches a workflow,
re-runs a job, re-requests a check or cancels anything. Its entry point discards the original error
object on failure, so no request URL, header, token or identifier can reach a workflow log through a
runtime message; only a closed classification and a closed reason are ever written.

The Actions read scope is granted **on the credential-free repository-gate job alone**, and both
workflows are written so that this is true of their **effective** permissions, not merely of what
each job happens to declare. GitHub Actions permissions are inherited: a job with no `permissions:`
block runs with the workflow-level block, so a workflow-level `actions: read` reaches every job in
the file. Workflow A already satisfied this — its workflow-level default is `contents: read` and
`checks: read`, and only its gate adds `actions: read`. **Workflow B did not, at the first reviewed
head**: it declared `actions: read` at workflow level, and its credentialled `collect` job, having
no block of its own, inherited it. That was a real least-privilege defect and is corrected here.
Workflow B's workflow-level default now carries `contents: read` and `checks: read` only, and its
`collect` job declares `contents: read` and `checks: read` **explicitly**, so its effective scope is
readable in place and cannot widen again if the workflow-level default changes. `collect` reads no
Actions metadata and holds no `GH_TOKEN`.

`checks: read` is retained on `collect` for parity with workflow A's credentialled job rather than
narrowed further. No step in either `collect` job reads the Checks API, so a narrower scope looks
available, but nothing in this remediation proves that the scope is unused by the runner
environment itself, and narrowing beyond the reviewed shape is not part of this correction.

## 4. Workflow B — the external receiving path

`.github/workflows/data-s2-production-external.yml`, name
`DATA-S2 External Production Collection via D1 REST`.

* Trigger: `workflow_dispatch` with **zero inputs**. No `schedule`, `push`, `pull_request`,
  `repository_dispatch`, `workflow_call` or `workflow_run`.
* Permissions: workflow-level `contents: read`, `checks: read`. The credential-free
  `repository-gate` job adds `actions: read`; the credentialled `collect` job declares
  `contents: read`, `checks: read` explicitly and never inherits the Actions scope.
* Concurrency: `group: data-s2-production-collection`, `cancel-in-progress: false`, no `queue:` key.

It reproduces the scheduled workflow's trust boundary rather than approximating it: the event name,
`refs/heads/main`, the exact repository, a 40-character lowercase event SHA, an exact checkout at
`fetch-depth: 0` with `persist-credentials: false`, `HEAD` equality, a fresh `git ls-remote` proof of
remote `main`, a clean tree, the **unchanged** bounded exact-head Verify Teamsheet module, the
opportunity guard, the dedicated unattended environment `data-s2-production-scheduled`, the existing
credential-masking order, exact Node 24.19.0, Wrangler removal, and a second fresh remote-main
equality check in the **same shell** immediately before the runner. It invokes exactly
`node workers/data-platform/run-production-collection.mjs`, which is where the
`GITHUB_RUN_ATTEMPT !== '1'` re-run refusal already lives.

**There is no caller-supplied SHA input.** The dispatcher supplies `ref: main` and nothing else,
GitHub resolves the event SHA, and the repository-side gates prove current `main` independently. A
caller therefore cannot name a revision, a timestamp, a season, a database, an endpoint or a
statement.

The attended manual workflow C is **not** reused and **not** modified.

## 5. The isolated dispatcher Worker

`workers/schedule-dispatcher/` — `wrangler.jsonc`, `dispatcher.mjs`, `dispatch-contract.mjs`.

### 5.1 Dedicated identity, and why

The Worker identity is **`teamsheet-data-s2-dispatcher`**. It deliberately does **not** reuse
`teamsheet-data-platform`.

That historical Worker is a live hazard that Package A must not touch. Its configuration still
declares a thirty-minute cron and a D1 binding, and its module still exposes a scheduled handler
that calls the historical Official FPL collector. Deploying anything under that identity could
re-arm collection that was intentionally stopped on Workers CPU grounds. A separate identity makes
that structurally impossible from this directory. The historical configuration is left
**byte-unchanged** and its SHA-256 is pinned by test.

### 5.2 It is a timer, not a collector

The dispatcher never collects Official FPL data, imports nothing outside its own directory, holds
no D1 binding and no Cloudflare data credential, reads and writes no D1, and exposes no HTTP fetch
handler, no `workers.dev` hostname, no preview URL, no route and no custom domain. Its Wrangler
configuration carries no `d1_databases`, `kv_namespaces`, `r2_buckets`, `services`,
`durable_objects` or `queues`, and sets `workers_dev: false` and `preview_urls: false`.

The collection engine remains the GitHub Actions runner invoking the unchanged production entry
point. Historical Cloudflare Worker collection remains superseded and forbidden.

### 5.3 Explicitly zero crons

The Package A configuration declares:

```json
"triggers": { "crons": [] }
```

This is **present and explicitly empty, not omitted**. Cloudflare treats the triggers block as a
total assignment: an explicit empty array removes any Cron Trigger held by this Worker identity,
while omitting the block would leave whatever already exists in place. Package A arms nothing.
Replacing this empty array with live cron entries is Package C, later and separately approved.

### 5.4 Secret boundary

The dispatcher may name exactly one future secret binding: **`GITHUB_DISPATCH_TOKEN`**. No
credential is created in Package A.

It contains no `CLOUDFLARE_ACCOUNT_ID`, no `CLOUDFLARE_D1_TOKEN`, no production D1 database id, no
production account fingerprint, no Official FPL endpoint, no Anthropic key and no Odds key. No
secret value is ever logged, and no URL, header, token, run id, account id or database id may reach
a log line. Logs carry **closed enums and bounded integers only**.

### 5.5 The no-retry contract

`controller.noRetry()` is the **first statement** of the scheduled handler, before the credential is
even read and long before any request is built. Exactly one dispatch request is issued per
Cloudflare fire. No second dispatch is ever issued in the same fire, for any outcome. There is no
loop, timer or scheduling primitive in the handler that could produce one.

### 5.6 The dispatch contract

```
POST /repos/priteshpatel390-del/FPL/actions/workflows/data-s2-production-external.yml/dispatches
X-GitHub-Api-Version: 2022-11-28
{"ref":"main","return_run_details":true}
```

No workflow inputs are ever sent.

| Class | Condition |
|---|---|
| `ACCEPTED_WITH_IDENTITY` | HTTP 200 whose body carries a positive safe-integer `workflow_run_id` and `run_url` / `html_url` exactly equal to this repository's canonical paths for that same id |
| `ACCEPTED_NO_IDENTITY` | HTTP 204 |
| `REJECTED` | 401, 403, 404, 422 — and only those |
| `AMBIGUOUS` | HTTP 5xx, 429, any 3xx, transport failure, timeout, malformed HTTP 200 body, and **every** status whose no-side-effect semantics cannot be proved |

The default class for anything unrecognised is `AMBIGUOUS`. Neither `AMBIGUOUS` nor `REJECTED` is
ever retried inside the same fire; the later scheduled opportunity is the only automatic recovery
there is.

When a 200 returns a valid run identity, **one** bounded read may verify that exact returned run id.
The workflow run list is never searched and no run is ever guessed at. A verification read that
fails, or that answers about a different run, changes nothing about the classification — it only
leaves the run-creation measurements unavailable.

For a 204 there is no returned identity, so identity-based verification is unavailable and stays
**honestly unavailable**.

### 5.7 Latency telemetry

Three separate bounded, non-negative, safe-integer measurements, never conflated:

| | Measurement | Telemetry field | Definition |
|---|---|---|---|
| A | timer delivery | `timerLatencyMs` | `handlerStart − controller.scheduledTime` |
| B | request start to run creation | `requestToRunCreationLatencyMs` | GitHub run `created_at` − `dispatchRequestStartedAt` |
| C | end to end | `endToEndLatencyMs` | GitHub run `created_at` − `controller.scheduledTime` |

`dispatchRequestStartedAt` is captured **immediately before the POST is issued**, and the clock is
never read again. B is therefore a **client-observable request-start-to-run-creation** measurement.
It is deliberately **not** acceptance-to-run latency, **not** GitHub internal dispatch latency and
**not** server processing latency: the instant GitHub internally accepted the dispatch is not
observable from this client and is never estimated. B bounds the true server-side figure from above
and nothing more.

The baseline matters, not just the name. Measuring B from the instant the HTTP response returned —
which is what the first reviewed head did — is wrong in a way that silently loses data: GitHub may
create the workflow run **before** the successful response comes back, so `created_at` legitimately
precedes the response, the difference is negative, and a real measurement from a successful live
cycle is discarded as unavailable. The request-start baseline always precedes run creation, so a
successful dispatch keeps its measurement. No HTTP round-trip duration is recorded; it was not
needed for this correction and adding it would widen the telemetry surface for nothing.

**B is structurally unavailable on `ACCEPTED_NO_IDENTITY`**, because a 204 returns no run to read a
creation time from. Unavailable is reported as unavailable and is **never fabricated as zero**. Any
value that is negative, non-integral or beyond a 24-hour bound is likewise unavailable rather than
reported.

## 6. Concurrency, and the limitation Package A does not fix

Package A changes no concurrency semantics. Every member of the `data-s2-production-collection`
group stays `cancel-in-progress: false` with **no `queue:` key**. Membership after Package A is
exactly eight workflows: scheduled collection, external collection, manual collection, resume,
first-run reconciliation, committed-run integrity, EXPLAIN acceptance and migration 0003. A
permanent test pins that set, so membership drift is detected.

**The limitation, stated accurately.** `cancel-in-progress: false` protects a run that is already
running. It does **not** protect a run that is still *pending*: a newly queued workflow can replace
an existing pending workflow in the same group. That applies to a pending scheduled collection,
manual collection, resume, migration, reconciliation, EXPLAIN acceptance, integrity check and the
new external workflow alike.

`queue: max` is deliberately **not** implemented in Package A.

It must **not** be claimed that a future 01:17–03:17 Cloudflare dispatch window fully bounds this
exposure while workflow A remains armed, because workflow A has already arrived hours outside its
nominal minute.

## 7. Live evidence for natural scheduled run `34015422874`

Two kinds of evidence, with their provenance kept apart.

**Independently verified from the GitHub Actions API during this remediation.** Workflow
`DATA-S2 Scheduled Production Collection via D1 REST`, id `350014371`, reports `state: active` — the
scheduled workflow is **enabled**, having been re-enabled by the owner after the capacity
live-acceptance closeout. It produced natural run `34015422874`: run number 3, event `schedule`,
attempt 1, head branch `main`, head SHA `b0637270882f0ab120102dbb04a8eb2eef6a763f`, created
`2026-09-06T06:01:26Z`, completed `2026-09-06T06:01:59Z`, conclusion **success**, with
`repository-gate` (job `101438220728`) and `collect` (job `101438250715`) both succeeding at every
step. Against the 01:17 UTC nominal minute that is **4h44m26s** of schedule-event delivery lateness,
upstream of the workflow and never a collection delay — the collection itself took about 33 seconds
once the run existed. Reading this is a read-only GitHub query; nothing was dispatched, enabled or
disabled.

**Owner-supplied, and not independently verified.** The run's Step Summary is not retrievable
through the GitHub API available here, so these figures are owner evidence:

> `result: changed`, `mutation: definite_completed`, 70 changes, 10,157 `recordsSeen`; committed
> state `completed`, 70 run observations, 11,348 observations, 10,157 heads equal to 10,157 logical
> keys, zero orphan, quarantined and rejected; H 11,278, N 10,157, structural 93,999, projected
> 121,103 classified `expected`, mutation reads 635, amplification 1.35, reserve 2,000; 6 API calls,
> 113,279 rows read, 494 rows written, 106,483 request bytes, `readClassification: expected`;
> over-predicting actual by 7,824 rows, about 6.91%, at about 45.31% of the 250,000 hard ceiling
> with 136,721 of headroom.

Nothing in Package A read, dispatched, re-ran or influenced that run.

**Current operational conclusion.** GitHub cron is active enough to produce natural runs, but
materially late and unreliable as a timer: three delivered natural runs are now approximately 3h21m,
4h31m and 4h44m late, and two earlier acceptance windows produced no run at all. That is the case
for DATA-S2C, and it changes no collection semantics, no cron cadence and no threshold.

**What they support.** A third measured cycle in which the conservative projection again
over-predicted actual provider reads (121,103 projected against 113,279 actual), well inside the
150,000 expected band and far below the 250,000 hard ceiling, with clean committed state.

**What they do not do.** They do not calibrate the capacity model. `PROVIDER_READ_AMPLIFICATION`
stays 1.35 and `PROVIDER_READ_SAFETY_RESERVE` stays 2,000, both unchanged and still **INFERRED**.
Three changed-observation counts — 264, 141 and 70 — are three samples, not a distribution. No
season-long capacity claim follows, and the structural model's `2H` term over an append-only history
still grows.

## 8. Security boundary

* The guard is credential-free and read-only, needs `actions: read` alone, and fails closed.
* The Actions read scope is granted on the credential-free gate job only, never on the credentialled
  production job — proved against each job's **effective** permissions, which inherit the
  workflow-level block when the job declares none. Workflow B's workflow-level `actions: read` at
  the first reviewed head reached its `collect` job by inheritance; that is corrected, and a
  permanent test now resolves effective scope rather than reading an absent block as an absent
  permission.
* Workflow B's credential surface is exactly workflow A's: the same secrets, the same dedicated
  unattended environment, the same masking order, the same reviewed repository constant for the
  production database id, which reaches no workflow or environment value.
* The dispatcher holds one future secret binding name and no production identifier of any kind.
* A future `GITHUB_DISPATCH_TOKEN` will need `actions: write` on this repository. **That is a real
  blast radius**: such a credential can dispatch and re-run repository workflows generally, not only
  workflow B. It does not exist yet, and creating, scoping and storing it is a separate approval in
  a later package. Nothing about Package A reduces that future scope.
* GitHub Actions Step Summary and log retention is finite. Exact provider `meta.rows_read` and
  `meta.rows_written` reach only a run's Step Summary, are not retrievable through the GitHub API
  available here, and are lost when that retention expires. Cloudflare dashboard aggregates are
  account-level time-window figures and are never per-workflow accounting.

## 9. What Package A explicitly does not change

No production collector semantics. No resource threshold — 150,000 expected, 200,000 soft, 250,000
hard, 40,000 writes, 8 API calls, 4,000 routine changed observations and 8 MiB per Official response
all stand. No projection factor. No SQL. No schema, index or migration — still exactly 0001–0003 and
five indexes, with **no migration 0004**. No provider behaviour. No model, fixture, captaincy,
squad, transfer, rank or Mini-League logic. No product or UI code. No build input, and no generated
deployable required regeneration.

The existing GitHub cron stays `17 1 * * *` with no `timezone:` field. Whether GitHub currently has
the scheduled workflow enabled is owner-side state that this repository cannot read or change and
Package A neither reads nor changes. It is, however, readable through the GitHub Actions API, and
was read for that checkpoint: workflow `350014371` reported `state: active` and had produced
successful natural run `34015422874` on 6 September 2026. **Superseded on 7 September 2026:** the
owner has since disabled it and it reports `state: disabled_manually`, so the guard has no armed
automatic path to act on until Package C activates Cloudflare — see §12.1. Retained only as history:
the earlier repository evidence had it owner-disabled after run `33948145320`.

## 10. Limitations

* **Nothing here is live.** Package A proves repository behaviour and nothing about live GitHub,
  live Cloudflare or a live collection.
* **Cloudflare Cron punctuality is not guaranteed either.** Cloudflare documents Cron Triggers as
  best-effort. DATA-S2C adds a second independent asker; it does not add a punctuality guarantee,
  and no such guarantee may be claimed from it.
* **The exact HTTP 200 dispatch body shape is unproven.** The `return_run_details` request is the
  approved design and has not been exercised live. If GitHub answers 204, that is
  `ACCEPTED_NO_IDENTITY` and is handled; if it answers 200 with any other shape, that is `AMBIGUOUS`
  and is handled. Both directions fail safe, but neither has live evidence.
* **The pending-run replacement limitation above is unfixed** and is deliberately out of scope.
* **The guard is only as good as the Actions API's own view.** It reads run and job metadata; it
  cannot see a collection performed by some path outside these three workflows, and no such path is
  approved. Actions metadata is external state: an unavailable or ambiguous API read stops automatic
  collection rather than allowing it.
* **The 200-request bound is a budget for the approved cadence, not a proof.** It is sized
  conservatively for roughly 35 workflow A runs and 105 workflow B runs across the 35-day horizon —
  about 146 requests, measured at exactly 146 by regression — leaving about 54 spare. Under the §0
  rollout workflow A is disabled before Cloudflare activation, so the intended steady state is
  smaller than that; the larger sizing is kept deliberately and no constant changes. A pathological
  history still exceeds the bound and still fails closed. Nothing has run live, so this is arithmetic
  over the approved cadence, not a measurement of real Actions metadata.
* **Paginated reads observe live, changing state.** `total_count` reconciliation, exact per-page row
  counts and duplicate rejection make a shifted set an ambiguity rather than a silent subset, but a
  run created or ageing out mid-sequence can therefore cost an automatic collection opportunity to a
  benign race.
* **The attempt-1-only rule rests on an invariant this package pins but does not own.** A re-run is
  harmless only because `workers/data-platform/run-production-collection.mjs` refuses every attempt
  after the first before any production work. A structural regression pins that literal and its
  source position, and the entry point is unmodified here; if it were ever changed so the refusal
  moved after identity resolution or the collector, that test fails and the 35-day discovery horizon
  must be revisited.
* **Automatic guard invocations in a UTC day: three intended, four bounded.** Under the §0 rollout
  the intended steady state is workflow B's three Package C opportunities with workflow A disabled;
  four is the upper bound that holds only while workflow A remains armed, as it does today. Each
  invocation is separately bounded at 200 requests. GitHub token and API limits remain an external
  dependency to observe in live Stage C/D; no unused rate-limit headroom is claimed.
* **A temporary DATA-S2 history gap may occur during the scheduler replacement** — between disabling
  GitHub scheduling and successfully activating Cloudflare — and is an accepted development-stage
  trade-off (§0.6). Observations lost to a gap are not claimed to be reconstructible. No gap has
  occurred.
* **No device testing** was performed or is required: this is a repository-only backend and workflow
  checkpoint.

## 11. Gates after Package A

This sequence replaces the superseded coexistence sequence. Each package is a separate explicit
owner approval, and safe related steps are grouped so the owner approves packages rather than
individual handoffs.

**Package A — current, this pull request.** Repository foundation only; no live Cloudflare action.
After owner approval: merge, then exact-`main` Verify Teamsheet on the merge commit.

**Next operational step — GitHub timer retirement. DONE, 7 September 2026.** A separate explicit
owner-approved live action: disable GitHub workflow A scheduling; verify the disabled state; verify
no running or pending workflow A execution remains that could later collect. **This happens before
Cloudflare automatic scheduler activation**, and nothing in Package A performed or authorised it. The
owner performed it and the verification is recorded in §12.1.

**Package B — dormant Cloudflare provisioning. PARTLY DONE.** One attended approval package covering
the safe related setup steps: a read-only Cloudflare cron-budget and environment preflight; creating
the approved GitHub dispatch credential; binding the single dispatcher secret; deploying the
exact-`main` isolated dispatcher; keeping `"crons": []`; and proving no automatic invocation and no
external workflow execution results. The owner approved it separately; the timer retirement,
preflight and documentation halves are complete and the three live Cloudflare steps remain
outstanding. See §12.

**Package C — Cloudflare activation.** A separate explicit approval: change the empty cron list to
the approved 01:17 / 02:17 / 03:17 UTC opportunities; deploy; prove external workflow execution;
prove the guard's refusal behaviour on the second and third opportunities of a day already
collected.

**Package D — observation.** Observe Cloudflare as the **sole** automatic scheduler. The acceptance
question is: *did Cloudflare reliably produce no more than one actual production collection per UTC
day?* A-versus-B coexistence evidence is **not** required, and the absence of workflow A during this
period is expected rather than a failure.

**Package E — repository retirement.** Only after sufficient Package D evidence: delete or retire the
obsolete GitHub scheduled workflow and any obsolete scheduler-specific material, if justified, and
reconcile the canonical documentation. **Package E must not be pulled forward.**

Merging Package A does not activate DATA-S2C. It adds the guard to the existing scheduled path and
lands the foundation for everything above.

---

## 12. Package B — dormant Cloudflare provisioning

Package B is the attended owner-approved package that retires the GitHub automatic timer, performs a
read-only Cloudflare preflight, provisions the dispatcher **dormant**, and proves it cannot run
automatically. It activates nothing: Cloudflare cron activation is Package C and remains separately
gated.

**Outcome: partly complete.** The GitHub half is done and independently verified. The read-only
Cloudflare preflight is done. The documentation is reconciled. The three live Cloudflare steps —
credential creation, secret binding and Worker deployment — were **not** performed, for the reason
recorded in §12.4.

### 12.1 GitHub timer retirement — verified

Every fact below was read directly from the GitHub Actions API for this checkpoint. Reading run and
workflow metadata is a read-only query; nothing here dispatched, enabled, disabled, cancelled or
re-ran any workflow.

| Fact | Observed value |
|---|---|
| Workflow A id | `350014371` |
| Workflow A name | `DATA-S2 Scheduled Production Collection via D1 REST` |
| Workflow A path | `.github/workflows/data-s2-production-scheduled.yml` |
| Workflow A state | **`disabled_manually`** |
| Workflow A last updated | `2026-09-07T04:03:30Z` |
| Workflow A run population | exactly 3 — `33901634593`, `33948145320`, `34015422874` |
| Newest workflow A run | `34015422874`, created `2026-09-06T06:01:26Z`, conclusion `success` |
| Repository runs with status `queued` | **0** |
| Repository runs with status `in_progress` | **0** |
| Workflow B (`data-s2-production-external.yml`) run population | **0** |
| Workflow C (`data-s2-production-collection.yml`) run population | 3, newest `33990959542` (5 September 2026) |
| Acceptance read instant | `2026-09-07T04:09:54Z` |

The queued and in-progress counts are **repository-wide**, not filtered to workflow A, so they
exclude a pending execution of any governed workflow rather than only the scheduled one. **No
workflow A execution remains that could later collect**, and none was cancelled to reach that state.

**One `waiting` run exists and was deliberately left alone.** Run `33620632272` of `DATA-S2B Phase 4B
Mutation-Free Live Preflight Preparation` (workflow `344574374`, path
`.github/workflows/data-s2b-phase4b-readonly-preflight.yml`), run number 9, attempt 2, event
`workflow_dispatch`, has been `waiting` on protected-environment approval since
`2026-09-02T10:40:00Z`. It is not workflow A, it is a strictly read-only Phase 4B preflight, and it
carries no `collect` job, so it cannot perform a production collection and does not consume a day
under the opportunity guard. It is stale and is worth the owner's attention, but cancelling a run is
a separate decision and Package B did not take it.

**Baseline confirmed.** Package A merged as `f519e319d107ca1d45834a15c45cd785a173b43f`, and the
post-merge exact-`main` `Verify Teamsheet` run `34081463226` — run number 623, event `push`, head SHA
`f519e319d107ca1d45834a15c45cd785a173b43f` — concluded `success`. Local `origin/main` matches that
SHA exactly, so `main` has not moved since the Package A baseline and no delta review was required.

### 12.2 The gap risk is live; no gap is claimed

The accepted development-stage trade-off of §0.6 is now in force: GitHub no longer provides an
automatic clock and Cloudflare does not yet provide one, so there is currently **no automatic
production collection path at all**. Workflow C remains available for owner-approved attended
recovery.

As of the acceptance read at `2026-09-07T04:09:54Z`, **no production collection has run on UTC day
2026-09-07** through any of the three governed workflows. That day had not closed at the time of
reading, and an attended manual collection could still consume it, so **this is not a completed gap
and must not be reported as one.** Observations lost to any gap that does occur are not claimed to be
reconstructible.

### 12.3 Cloudflare read-only preflight

The Cloudflare account reached by the read-only tooling available here is the Teamsheet account, and
it holds exactly five Workers:

| Worker | Relevance |
|---|---|
| `teamsheet-fpl-gateway` | Official FPL application gateway — unrelated, untouched |
| `teamsheet-evidence-archive` | Stage 10 evidence archive — unrelated, untouched |
| `teamsheet-data-platform` | historical collector; the live hazard §5.1 forbids reusing — read, untouched, not redeployed |
| `teamsheet-data-platform-acceptance-caller` | historical DATA-S1C acceptance caller — untouched |
| `teamsheet-data-platform-s1b-validation-20260822` | historical DATA-S1B validation Worker — untouched |

**`teamsheet-data-s2-dispatcher` does not exist.** The approved isolated identity is free: there is
no name collision, no pre-existing route, custom domain, binding, secret or Cron Trigger under it,
and nothing that a first deployment would overwrite. That is the cleanest possible starting state for
a dormant first deployment.

**Limitations of this preflight, stated rather than papered over.**

* The read-only Worker tooling available here returns a Worker's **name and id only**. It could not
  enumerate the Cron Triggers, routes, bindings or secrets of the *existing* Workers. Their absence
  under the dispatcher identity follows from that identity not existing at all; nothing is claimed
  about the other five.
* Cloudflare account plan limits and remaining Cron Trigger quota are **not readable** through the
  tooling available here, so the §0.5 statement that Package C's three daily opportunities fit within
  the account's cron budget remains an assumption to confirm at Package C rather than a verified
  fact.
* No Cloudflare mutation of any kind was performed: no deployment, no secret, no Cron Trigger, no D1
  request.

### 12.4 Why the three live Cloudflare steps were not performed

They were not skipped by choice, and no substitute was improvised. The session performing Package B
holds no mechanism capable of performing them:

* **Credential.** Creating a fine-grained GitHub personal access token is an interactive
  account-owner action; GitHub exposes no API that can mint one. No broader existing token was
  reused — not a GitHub CLI token, not the agent's own authentication, not another Teamsheet secret —
  because a convenient credential with wider scope is exactly what §8 warns against.
* **Secret binding and deployment.** No Cloudflare deployment credential is present in the
  environment, Wrangler is not installed, and the read-only Cloudflare tooling available here can
  deploy nothing and set no secret.
* **No deployment machinery was invented.** The repository deliberately ships no Cloudflare
  deployment workflow for the dispatcher, and Package B did not add one. Building a protected
  deploy workflow, with its own credential, gate and acceptance surface, would be substantial new
  machinery for a step the owner can perform once, attended, in a few minutes — precisely the
  trade-off the §0.7 principle rejects. If recurring automated dispatcher deployment is ever
  genuinely needed, that is its own proposal with its own approval.

The remaining Package B work is therefore one attended owner action, not new repository code.

### 12.5 What the completed deployment must satisfy

Recorded here so the attended step has a written contract rather than a remembered one. The
dispatcher must be deployed from the exact `main` source at `workers/schedule-dispatcher/`, whose
Wrangler configuration already declares:

```json
{
  "name": "teamsheet-data-s2-dispatcher",
  "main": "dispatcher.mjs",
  "workers_dev": false,
  "preview_urls": false,
  "triggers": { "crons": [] }
}
```

and it must be deployed with that configuration unmodified. In particular the deployment must add no
cron entry of any kind — not 01:17, not 02:17, not 03:17 — no route, no custom domain, no public
fetch endpoint, no `workers.dev` hostname, no D1, KV, R2, Queue, Durable Object or service binding,
no provider credential, and no secret other than the single approved `GITHUB_DISPATCH_TOKEN`.
`"crons": []` is present and explicitly empty rather than omitted, so the deployment removes Cron
Triggers from this identity and can never arm one (§5.3).

The credential bound to `GITHUB_DISPATCH_TOKEN` must be a fine-grained personal access token scoped
to the single repository `priteshpatel390-del/FPL`, carrying **Actions: read and write** and no other
repository permission, with a finite expiry. §8 records the blast radius honestly and it is unchanged
by Package B: a credential able to dispatch workflow B can dispatch and re-run this repository's
workflows generally. Its value must never be printed, committed, placed in documentation, echoed
into a log, pasted into a pull request or issue, or stored client-side, and it must never be read
back after it is set.

### 12.6 What Package B did not do

No Cloudflare Cron Trigger was created, changed or removed. No Worker was deployed. No credential or
Cloudflare secret was created. No workflow was dispatched, re-run, enabled or disabled — workflow A
was not re-enabled and workflow B was not dispatched for testing. No D1 request of any kind was
performed. No Official FPL collection was run. `scheduled()` was not invoked manually.

No repository implementation changed. The dispatcher, the dispatch contract, the opportunity guard,
workflow A, workflow B, workflow C and the production entry point are all byte-unchanged from the
approved Package A `main`. No collector semantics, guard semantics, resource threshold, projection
factor, SQL statement, schema, index or migration changed — still exactly 0001–0003 with five
indexes and **no migration 0004**. No provider, model, fixture, expected-minutes, captaincy, squad,
transfer, rank, Mini-League, product or UI behaviour changed. No build input changed, so no generated
deployable required regeneration.

### 12.7 Package B limitations

* **Live Cloudflare-to-GitHub dispatch remains entirely unproven.** Package B deliberately dispatches
  nothing, so nothing is known about whether the deployed dispatcher would successfully reach GitHub,
  what status GitHub would answer, or whether the `return_run_details` 200 body carries the shape §5.6
  expects. That is Package C's acceptance question.
* **Dormancy could not be verified on the Cloudflare side**, because nothing was deployed. When the
  deployment is performed, the dormancy acceptance statement it can support is exactly *"the
  dispatcher is deployed but has no timer capable of invoking it automatically"* — never that it can
  dispatch successfully.
* **Cron quota headroom is unverified** (§12.3).
* **The stale `waiting` run `33620632272` is unresolved** by choice (§12.1).
* **A DATA-S2 collection gap is now possible** and is accepted (§12.2). None has been proved to have
  occurred.
* **No device testing** was performed or is required: this is a repository, workflow and
  infrastructure checkpoint.

### 12.8 Next gates

1. **Remaining Package B owner action** — create the narrowly scoped dispatch credential, bind it as
   `GITHUB_DISPATCH_TOKEN`, deploy the exact-`main` dispatcher with `"crons": []`, and record the
   deployment evidence and zero-cron proof.
2. **Package C — Cloudflare activation.** A separate explicit owner approval: replace the empty cron
   list with the approved 01:17 / 02:17 / 03:17 UTC opportunities, deploy, prove external workflow
   execution, and prove the guard refuses the second and third opportunities of a day already
   collected.
3. **Package D — observation**, then **Package E — repository retirement**, unchanged from §11.
