# DATA-S2C — external production scheduler

**Status: Package A repository foundation merged; Package B complete — GitHub automatic scheduling
retired and the isolated Cloudflare dispatcher deployed dormant with zero Cron Triggers; Package C
is a repository activation candidate under review.** Sections 1–11 record Package A and were accurate
when written. Section 12 records Package B. Section 13 records Package C, which changes the
repository's declared cron list from empty to the approved 01:17 / 02:17 / 03:17 UTC opportunities
and prepares the attended activation and its live acceptance contract.

**The live Cloudflare Worker still holds ZERO Cron Triggers.** A repository declaration is not a
deployment: the deployed Worker keeps the configuration it was last deployed with until an attended
owner deployment replaces it. Package C's repository candidate arms nothing by itself, and nothing in
it may be read as a claim that Cloudflare is scheduled today.

**FACT AT THE PACKAGE A CHECKPOINT — retained as history.** At the time sections 1–11 were written,
no GitHub personal access token or GitHub App had been created, no Cloudflare secret had been created,
no Worker had been deployed, no Cloudflare Cron Trigger had been created, changed or removed, no
workflow had been dispatched, no D1 request had been performed, no Official FPL endpoint had been
contacted for collection and no production collection had been run. The GitHub cron was `17 1 * * *`
and untouched by that package.

**CURRENT STATE — see §12 and §13.** The owner has since disabled GitHub scheduled workflow A, created
the approved fine-grained dispatch credential, bound it as the single encrypted Cloudflare secret
`GITHUB_DISPATCH_TOKEN`, and deployed the isolated Worker `teamsheet-data-s2-dispatcher`. Still true
today, and not superseded: **zero Cloudflare Cron Triggers exist**, workflow B has never been
dispatched, no Cloudflare-to-GitHub dispatch has ever been attempted, no D1 request has been performed,
and no production collection has been run through DATA-S2C. Package C changes the repository's
declared cron list only; it performs no Cloudflare request, no deployment, no dispatch and no
collection.

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

### 5.3 Explicit crons — empty in Package A, the three approved opportunities in Package C

The Package A configuration declared:

```json
"triggers": { "crons": [] }
```

This is **present and explicit, never omitted**, and that property is unchanged by Package C.
Cloudflare treats the triggers block as a total assignment: the declared array is the complete set of
Cron Triggers the deployed Worker identity holds, while omitting the block would leave whatever
already exists in place. An explicitly empty array therefore removes triggers; an explicit list
replaces them exactly.

**Superseded by §13 as a statement of the repository's declared value.** The repository now declares
the three owner-approved Package C opportunities:

```json
"triggers": {
  "crons": [
    "17 1 * * *",
    "17 2 * * *",
    "17 3 * * *"
  ]
}
```

Cloudflare interprets a Cron Trigger in UTC unless a timezone is configured, and no timezone override
is declared, so those expressions are 01:17, 02:17 and 03:17 UTC. What is **not** superseded is the
live state: the deployed Worker still holds zero Cron Triggers, because only an attended deployment
of this configuration can change what the live Worker holds. See §13.

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

**Independently verified from the GitHub Actions API during that remediation, and point-in-time.**
Workflow `DATA-S2 Scheduled Production Collection via D1 REST`, id `350014371`, reported
`state: active` — the scheduled workflow was **enabled**, having been re-enabled by the owner after
the capacity live-acceptance closeout. *(Superseded by §12.1: the owner disabled it on 7 September
2026 and it now reports `state: disabled_manually`. The run evidence below stands as history.)* It produced natural run `34015422874`: run number 3, event `schedule`,
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

**Package B — dormant Cloudflare provisioning. DONE, 7 September 2026.** One attended approval package
covering the safe related setup steps: a read-only Cloudflare cron-budget and environment preflight;
creating the approved GitHub dispatch credential; binding the single dispatcher secret; deploying the
exact-`main` isolated dispatcher; keeping `"crons": []`; and proving no automatic invocation and no
external workflow execution results. All of it is complete: `teamsheet-data-s2-dispatcher` is deployed
with its module independently verified against approved `main`, the single `GITHUB_DISPATCH_TOKEN`
secret is bound, zero Cron Triggers are configured, the temporary Git build integration is
disconnected, and no workflow B dispatch, production collection or D1 access occurred. See §12.

**Package C — Cloudflare activation. Repository candidate under review; live activation outstanding.**
A separate explicit approval: change the empty cron list to the approved 01:17 / 02:17 / 03:17 UTC
opportunities; deploy that change attended; prove external workflow execution; prove the guard's
refusal behaviour on the second and third opportunities of a day already collected. The repository
half is the candidate recorded in §13. The attended deployment, the first live dispatch and the
one-collection-per-day proof are all still outstanding, and the live Worker holds zero Cron Triggers
until the owner deploys.

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

**Outcome: complete.** GitHub's automatic timer is retired and independently verified. The read-only
Cloudflare preflight was performed. The owner then created the dispatch credential, bound it as the
single Cloudflare secret, and deployed the isolated dispatcher with zero Cron Triggers, disconnecting
the temporary Git build integration afterwards. §12.7 carries that live acceptance evidence and its
provenance. §12.4 records why the preparing session could not perform those three steps itself and is
retained as history.

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

As of the closeout read at `2026-09-07T17:29:36Z`, **no production collection has run on UTC day
2026-09-07** through any of the three governed workflows — workflow B's run population is still zero
and workflow C's newest run is still `33990959542` from 5 September. That day had not closed at the
time of reading, and an attended manual collection could still consume it, so **this is not a
completed gap and must not be reported as one.** If the day does close without a collection it becomes
one, and observations lost to a gap are not claimed to be reconstructible.

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

**At the preflight instant, `teamsheet-data-s2-dispatcher` did not exist.** The approved isolated
identity was free: no name collision, no pre-existing route, custom domain, binding, secret or Cron
Trigger under it, and nothing that a first deployment would overwrite — the cleanest possible starting
state for a dormant first deployment. *(Superseded by §12.7: the Worker has since been created by the
owner's Package B deployment, and the account now holds six Workers rather than five.)*

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

### 12.4 Why the preparing session could not perform the three live Cloudflare steps

**Historical, and now closed by §12.7.** The owner has since performed all three attended actions.
This section records why they could not be automated, because that reasoning governs Package C too.

They were not skipped by choice, and no substitute was improvised. The session preparing Package B
held no mechanism capable of performing them:

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

The remaining Package B work was therefore one attended owner action rather than new repository code,
and the owner performed it. **The same reasoning governs Package C:** arming the cron is an attended
owner action, not something a standing deployment integration should be able to do.

### 12.5 The deployment contract, and that it was met

Recorded here so the attended step had a written contract rather than a remembered one. §12.7 records
the evidence that the deployment satisfied it. The
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

No Cloudflare **Cron Trigger** was created, changed or removed at any point — the deployment carried
`"crons": []` and the dashboard reports none. No second Worker was created and
`teamsheet-data-platform` was neither touched nor redeployed. No second credential and no second
secret were created, and the token was not rotated. No workflow was dispatched, re-run, enabled or
disabled — workflow A was not re-enabled and workflow B was not dispatched, not even to test the
path. No D1 request of any kind was performed. No Official FPL collection was run. `scheduled()` was
not invoked manually. The Git build integration was not reconnected.

No repository implementation changed. The dispatcher, the dispatch contract, the opportunity guard,
workflow A, workflow B, workflow C and the production entry point are all byte-unchanged from the
approved Package A `main`. No collector semantics, guard semantics, resource threshold, projection
factor, SQL statement, schema, index or migration changed — still exactly 0001–0003 with five
indexes and **no migration 0004**. No provider, model, fixture, expected-minutes, captaincy, squad,
transfer, rank, Mini-League, product or UI behaviour changed. No build input changed, so no generated
deployable required regeneration.

### 12.7 Cloudflare live acceptance — the dormant deployment

The owner performed the three attended actions on 7 September 2026. Their evidence is recorded below
with its provenance kept strictly separate, because these facts do not all rest on the same kind of
proof.

#### 12.7.1 Independently verified from the Cloudflare API

| Fact | Observed value |
|---|---|
| Worker exists | **yes** — `teamsheet-data-s2-dispatcher` |
| Script id | `1a02fa1c1ae54ff19d9a85d35a205490` |
| Created | `2026-09-07T16:36:12Z` |
| Last modified | `2026-09-07T16:39:30Z` |
| Account Worker count | **6**, previously 5 — the dispatcher is the only addition |
| `teamsheet-data-platform` | untouched; `modified_on` unchanged at `2026-08-31T19:46:27Z` |

The identity is the approved isolated one. The historical collector Worker that §5.1 forbids reusing
was not reused and not redeployed, and no second Worker was created.

**The deployed module was read back and matches approved `main`.** The retrieved script is the
esbuild-bundled form of `workers/schedule-dispatcher/dispatcher.mjs` and `dispatch-contract.mjs`,
whose repository bytes are unchanged from `main` — verified by diffing this branch's
`workers/schedule-dispatcher/` and `.github/workflows/` against `origin/main`, which returns empty.
Bundling renames the entry module to `dispatcher.js` and inserts esbuild's `__name` helpers; no
source semantics differ. The read-back independently confirms, in the code actually running in
Cloudflare:

* `controller.noRetry()` is the **first statement** of the scheduled handler, before the credential is
  read and before any request is built (§5.5);
* the only credential read is `env?.GITHUB_DISPATCH_TOKEN` — **the deployed code proves the binding
  name the Worker expects**, independently of any dashboard;
* the dispatch target is `data-s2-production-external.yml` on `priteshpatel390-del/FPL`, with body
  `{"ref":"main","return_run_details":true}` and **no workflow inputs** (§5.6);
* `REJECTED_STATUSES` is exactly `[401, 403, 404, 422]`, with every other status `AMBIGUOUS`;
* the module exports **only** `default { scheduled }` and `runScheduledDispatch` — there is **no
  `fetch` handler at all**, so the Worker has no public HTTP surface regardless of routing;
* no D1, KV, R2, queue, service or Durable Object reference appears anywhere in the deployed module,
  and no Cloudflare account id, D1 database id, account fingerprint, Official FPL endpoint, Anthropic
  key or Odds key appears in it.

#### 12.7.2 Independently verified from the GitHub Actions API, after the deployment

Read at `2026-09-07T17:29:36Z`, after the deployment, the secret binding and the Git disconnect:

| Fact | Observed value |
|---|---|
| Workflow A `350014371` | **`disabled_manually`**, unchanged, last updated `2026-09-07T04:03:30Z` |
| Repository runs with status `queued` | **0** |
| Repository runs with status `in_progress` | **0** |
| Workflow B `data-s2-production-external.yml` run population | **0** — still never dispatched |
| Workflow C run population | 3, newest unchanged at `33990959542` (5 September 2026) |
| `main` | unchanged at `f519e319d107ca1d45834a15c45cd785a173b43f` |

**The deployment sequence created no GitHub run of any kind.** Workflow B has never been dispatched,
no production collection was triggered, and nothing was queued or left in progress.

#### 12.7.3 Owner-provided dashboard evidence

These are visual observations the owner reported from the Cloudflare dashboard. They are not
independently readable through the tooling available here (§12.7.5), and they are recorded as owner
evidence rather than as API-verified facts.

* The Settings page reported **`Cron triggers — No cron triggers configured`** after both the
  deployment and the secret binding. **Zero Cron Triggers.**
* The same page reported **no queue consumers configured**.
* One runtime secret of type Secret was added, and the dashboard showed its value as **encrypted**.
* After the deployment and the secret binding, the Git repository field showed **`Connect`** rather
  than an attached repository, so the temporary Git build integration is disconnected.

#### 12.7.4 Owner-confirmed facts

* **The secret's binding name is `GITHUB_DISPATCH_TOKEN`.** The owner's screenshot visually clipped
  the secret-name column to `GITHUB`, so the full name is **owner-confirmed rather than
  independently read**. What §12.7.1 does independently establish is that the deployed code reads
  exactly `env.GITHUB_DISPATCH_TOKEN`, so a name mismatch would surface at the first Package C fire
  as a `REJECTED` / `dispatch_token_missing` outcome — a refusal, never a silent wrong-credential
  dispatch.
* **The credential.** A GitHub fine-grained personal access token named `teamsheet-data-s2-dispatcher`
  under resource owner `priteshpatel390-del`, with repository access limited to
  `priteshpatel390-del/FPL` alone, repository permissions **Actions: read and write**, the mandatory
  read-only Metadata permission, **no account permissions**, and a **90-day expiry**. Its value is
  recorded nowhere in this repository, in any pull request, log or document, and must never be. It
  must never be read back after storage.
* **The deployment method.** Cloudflare Workers Git import against `priteshpatel390-del/FPL`, project
  name `teamsheet-data-s2-dispatcher`, blank build command, deploy command
  `npx wrangler deploy --config workers/schedule-dispatcher/wrangler.jsonc`. The owner independently
  checked the `main` configuration before deploying and confirmed `name`, `main`, `workers_dev: false`,
  `preview_urls: false`, observability enabled and `triggers.crons: []`.

#### 12.7.5 Tooling limitations, stated rather than blurred

The read-only Cloudflare tooling available here returns a Worker's **name, id and deployed module**.
That is enough to prove the identity exists and that the running code matches approved `main`. It does
**not** expose Cron Triggers, routes, custom domains, bindings, secret names, queue consumers or Git
build-integration state, and Cloudflare account plan limits and remaining cron quota are not readable
either.

Therefore the zero-cron, no-queue-consumer, secret-name and Git-disconnect facts rest on owner
dashboard evidence and owner confirmation. They are not independently API-verified here, and this
record does not present them as if they were.

#### 12.7.6 Why the dispatcher is dormant

Two independent reasons, and the first alone is sufficient:

1. **It has no timer.** Cron Triggers are the only automatic invocation path a Worker with no `fetch`
   handler has. The deployment carried `"crons": []`, which Cloudflare treats as a total assignment,
   and the dashboard reports none configured. A scheduled handler with no schedule never fires.
2. **It has no standing deployment path that could arm one.** The Git build integration used for the
   initial deployment was disconnected, so a future push to `main` cannot redeploy this Worker or add
   a cron through it.

The supportable acceptance statement is therefore exactly: **the dispatcher is deployed but has no
timer capable of invoking it automatically.** It is deliberately *not* claimed that the dispatcher can
successfully dispatch, nor that every conceivable Cloudflare deployment path is closed — an attended
Wrangler deploy or dashboard action remains possible, which is precisely what Package C requires.

#### 12.7.7 The Git build-integration decision

Package B used Cloudflare's Git import **only** to perform the initial exact-source deployment, and
the integration was disconnected immediately afterwards.

The reason is the approval boundary. A standing "deploy on every push to `main`" integration would let
a future repository change reach production Cloudflare — a cron entry among them — without the
separate attended approval each live step is supposed to require. That would quietly convert Package
C's activation gate into a merge, which is exactly the failure mode the §0.7 principle says to remove
rather than tolerate. The deployed Worker persists; the build integration does not.

No permanent Cloudflare CI/CD system was built to replace it, and none should be without its own
proposal. Attended deployment a few times a year does not justify standing deploy credentials.

### 12.8 Package B limitations

* **Live Cloudflare-to-GitHub dispatch remains entirely unproven.** Package B deliberately dispatches
  nothing, so nothing is known about whether the deployed dispatcher would successfully reach GitHub,
  what status GitHub would answer, or whether the `return_run_details` 200 body carries the shape §5.6
  expects. That is Package C's acceptance question.
* **Cron activation is unproven**, because no cron exists. No end-to-end production collection through
  workflow B has ever occurred.
* **The zero-cron, no-queue-consumer, secret-name and Git-disconnect facts are owner evidence**, not
  independent API reads (§12.7.3, §12.7.4, §12.7.5).
* **Cron quota headroom is unverified** and stays an assumption to confirm at Package C.
* **The credential expires after 90 days.** That is a real operational dependency: a lapsed token makes
  every dispatch a `REJECTED` refusal rather than a silent failure, but it does stop collection until
  the owner replaces it.
* **Repository scoping does not reduce the Actions blast radius inside this repository.** A token with
  `actions: write` can dispatch and re-run this repository's workflows generally, not only workflow B.
* **The stale `waiting` run `33620632272` is unresolved** by choice (§12.1).
* **A DATA-S2 collection gap is now possible** and is accepted (§12.2). None has been proved to have
  occurred.
* **No device testing** was performed or is required: this is a repository, workflow and
  infrastructure checkpoint.

### 12.9 Next gates

1. **Package C — Cloudflare activation.** A separate explicit owner approval: replace the empty cron
   list with the approved 01:17 / 02:17 / 03:17 UTC opportunities, deploy that change attended, prove
   external workflow execution, and prove the guard refuses the second and third opportunities of a
   day already collected. Package C is the first step at which live Cloudflare-to-GitHub dispatch is
   exercised at all.
2. **Package D — observation**, then **Package E — repository retirement**, unchanged from §11.

---

## 13. Package C — Cloudflare scheduler activation

Package C is the owner-approved package that arms the timer. It has two halves, and conflating them
would be the single most damaging error this record can make:

* **The repository half — this candidate.** `workers/schedule-dispatcher/wrangler.jsonc` declares the
  three approved daily opportunities instead of an empty list, the permanent regressions that pinned
  the dormant declaration are replaced by regressions that pin the approved one, and this section
  records the attended activation procedure and the live acceptance contract.
* **The live half — outstanding.** An attended owner deployment, the first live
  Cloudflare-to-GitHub dispatch, and the one-collection-per-UTC-day proof. None of it has happened.

### 13.1 Live state at this checkpoint

**The deployed Worker `teamsheet-data-s2-dispatcher` still holds ZERO Cron Triggers.** A repository
declaration changes nothing live: the deployed Worker keeps the configuration it was last deployed
with, and Package B deployed it with an empty cron list. Nothing in this candidate deploys, dispatches
or collects.

Independently re-read from the Cloudflare API while preparing this section, and recorded as
observation rather than as action: the account holds six Workers;
`teamsheet-data-s2-dispatcher` exists with script id `1a02fa1c1ae54ff19d9a85d35a205490`, created
`2026-09-07T16:36:12Z`, `modified_on` unchanged at `2026-09-07T16:39:30Z`; and
`teamsheet-data-platform` is unchanged at `2026-08-31T19:46:27Z`. Reading the Worker list is a
read-only query. No Worker was created, modified, deployed or invoked, no Cron Trigger was created,
changed or removed, no secret was read or written, no D1 request was performed, no workflow was
dispatched, enabled, disabled or re-run, and no collection was run.

**One further Cloudflare-side fact, recorded because it bears on the deployment boundary.** A Workers
Build integration exists on this repository for a **different** Worker, `teamsheet-fpl-gateway`; it
surfaces as the `Workers Builds: teamsheet-fpl-gateway` check on pull requests. It is owner-side
Cloudflare configuration rather than repository configuration — no workflow or script here references
it, and the repository's own workflow set contains nothing that builds or deploys any Worker. It does
not weaken the dispatcher's boundary: Package B disconnected the dispatcher's temporary Git
integration, nothing in this repository directs any build integration at `workers/schedule-dispatcher`
and a permanent test pins that absence. What is **not** claimed is knowledge of another project's
Cloudflare-side build configuration, which is not readable from here.

**The tooling limitation of §12.7.5 still applies.** The read-only Worker tooling available here
returns a Worker's name, id and deployed module. It does **not** expose Cron Triggers, so the
zero-cron claim above rests on Package B's owner evidence plus the fact that nothing since could have
changed it — not on an independent API read of the trigger list.

### 13.2 The exact repository change

```json
"triggers": {
  "crons": [
    "17 1 * * *",
    "17 2 * * *",
    "17 3 * * *"
  ]
}
```

Nothing else in the dispatcher configuration moves: the identity stays
`teamsheet-data-s2-dispatcher`, `main` stays `dispatcher.mjs`, `workers_dev` and `preview_urls` stay
`false`, and there is still no `d1_databases`, `kv_namespaces`, `r2_buckets`, `services`,
`durable_objects`, `queues`, `vars`, route or custom domain. **No timezone override is declared**, and
Cloudflare documents that Cron Triggers execute on UTC time, so these are 01:17, 02:17 and 03:17 UTC.

The dispatcher's request semantics, `controller.noRetry()` placement, timeout, dispatch target, API
version, body, repository target, and REJECTED-versus-AMBIGUOUS classification are **unchanged**, as
are the opportunity guard, workflow A, workflow C, the production collection entry point, the
collector, every resource threshold, the D1 schema and migrations, and all provider, model, product
and UI behaviour.

### 13.3 Three opportunities, one collection

The three crons are **dispatch opportunities, never collection entitlements**:

1. **01:17 UTC** fires the dispatcher, which asks GitHub to start workflow B.
2. If that run reaches `collect` and collects, the UTC day is **consumed**.
3. **02:17 UTC** may still dispatch, and the run may still be created — but the shared fail-closed
   opportunity guard (§3) refuses production collection for a day already consumed, so `collect` is
   skipped.
4. **03:17 UTC** behaves identically.
5. An attended workflow C collection earlier in the day consumes the day for workflow B just the same.
6. Workflow A stays `disabled_manually` and is not part of normal automatic operation.

A later run therefore **existing** is expected and correct; a later run **collecting** would be the
failure. The guard, not the cron list, is what enforces one collection per UTC day, and Package C
changes no guard semantics: attempt-1-only consumption, `filter=all`, the 35-day candidate horizon,
the 200-request read bound and fail-closed truncation all stand exactly as §3 records them.

### 13.4 The attended activation: an exact-`main` deployment, and why it is not automated

Cloudflare deployment stays an attended owner action. The repository ships **no** deployment
workflow, no deployment credential and no standing Git build integration for this Worker, and Package
C adds none: building deployment machinery to avoid one attended action is exactly the complexity the
§0.7 principle rejects.

**The activation boundary is a deployment, and only a deployment.** The dispatcher is
repository-managed through `workers/schedule-dispatcher/wrangler.jsonc`, and that file is the
authoritative scheduler configuration. Live scheduling is therefore established by **deploying the
exact verified `main` configuration**, never by hand-building an independent live state that merely
happens to match it. That keeps one unbroken evidence chain:

> reviewed repository → merged `main` → exact-`main` Verify → attended exact-`main` deployment → live
> scheduler

Cloudflare's own guidance points the same way: a Worker managed with Wrangler should have its Cron
Triggers managed **exclusively** through the Wrangler configuration file, because any later
`wrangler deploy` reasserts whatever that file declares. A hand-created trigger set would be live
state with no deployment behind it, and the first later deploy would silently become its real
author.

**The approved path — a temporary Git integration and an exact-`main` Wrangler deploy.** This is the
Package B path, and it is the normal Package C activation method:

* temporarily reconnect the Cloudflare Workers Git integration to `priteshpatel390-del/FPL`;
* target the **existing** Worker project `teamsheet-data-s2-dispatcher` — never a new one;
* build command: **blank**;
* deploy command, exactly:

  ```
  npx wrangler deploy --config workers/schedule-dispatcher/wrangler.jsonc
  ```

* deploy from the **exact verified `main`**;
* then **disconnect the Git integration again, immediately**.

A standing Git auto-deploy connection remains **forbidden**: it would let a future merge reach
production Cloudflare without the attended approval each live step requires, converting this
activation gate into a merge.

The cost is accepted rather than hidden: this uploads a new Worker version for a module whose bytes
have not changed, and it re-touches the integration Package B deliberately disconnected. Both are
worth paying for an activation whose live state is provably the deployment of reviewed, merged,
CI-verified configuration.

**A local Wrangler deploy under a new Cloudflare API token is not the preferred path**, because it
mints a fresh standing deployment credential for a one-off attended action. It remains available if
the Git-integration path is unusable, and it must deploy the same exact-`main` configuration with the
same command, under the same disconnect-nothing-standing discipline.

**Direct dashboard creation of the three Cron Triggers is NOT the activation method.** It is
explicitly demoted: it would produce live scheduling with no deployment behind it, and it contradicts
both the boundary above and this record's own repeated statement that the deployed Worker keeps its
prior configuration until an attended deployment replaces it. The dashboard's role in Package C is
**verification, observation and rollback only** — see §13.4.1.

Whichever path is used: **do not** create a second Worker, **do not** deploy to
`teamsheet-data-platform`, and **do not** add a route, custom domain, `workers.dev` exposure, queue,
storage binding or fetch handler.

Cloudflare documents that Cron Trigger changes may take **up to 15 minutes** to propagate, so a
deployment completed minutes before 01:17 UTC may legitimately not fire that night. Activate with
margin.

### 13.4.1 What the Cloudflare dashboard is for in Package C

The dashboard is a **read and recovery** surface here, not the source of the live configuration:

* **inspecting the final trigger set** after the attended deployment — Workers & Pages → the Worker →
  Settings → Triggers → Cron Triggers;
* **viewing Cron Events** — Settings → Trigger Events → View events, holding the 100 most recent
  scheduled invocations, with the GraphQL Analytics API as its programmatic equivalent;
* **verifying Worker settings** — identity, bindings, routes, domains, `workers.dev` exposure;
* **emergency rollback** — deleting a Cron Trigger (Triggers → the three-dot icon → Delete) to return
  the live Worker to zero triggers, which is a safety action and must be recorded exactly (§13.7).

Using it for those is expected. Using it to *establish* the three opportunities is not.

### 13.5 The cron budget is an account limit, not a per-Worker limit

Cloudflare's published Workers limits give **5 Cron Triggers per account on Workers Free** and 250 on
Workers Paid. This account is Workers Free. Three opportunities therefore consume **three of five
account-wide**, and that holds only if no other Worker in this account currently holds a live Cron
Trigger.

That is not verifiable from here — the read-only tooling cannot enumerate Cron Triggers (§12.7.5) —
and it is not a safe assumption either: the historical `teamsheet-data-platform` Worker still declares
`"crons": ["*/30 * * * *"]` as repository configuration, and its **live** trigger is recorded as
having been deliberately removed when collection was stopped. **The owner must confirm the account's
current live Cron Trigger count before activating**, and must not restore the historical collector's
trigger to make room or for any other reason. If the account is at or near five, stop and report
rather than deleting another Worker's trigger.

### 13.6 Can the deployed `scheduled()` handler be exercised on demand?

Investigated, and the answer is **no**.

Cloudflare's documented mechanisms for triggering a `scheduled()` handler outside its cron are all
**local**: `wrangler dev --test-scheduled` and the Vite plugin expose `/cdn-cgi/local/scheduled`,
Miniflare dispatches scheduled events in-process, and the Wrangler test harness calls
`worker.scheduled(...)` against a local instance. Every one of them runs a **local** copy of the code,
not the deployed production Worker, and using any of them would additionally require the real dispatch
credential outside Cloudflare's secret store. None of them is acceptable, and none of them is used.

For a **deployed** Worker, Cloudflare documents no API or dashboard action that invokes the scheduled
handler on demand. The dashboard offers **Cron Events** — Settings → Trigger Events → View events,
holding the 100 most recent scheduled invocations, with the GraphQL Analytics API as its programmatic
equivalent — but that is a *history* view, not an invocation control.

**Conclusion: Package C acceptance uses natural cron observation.** No test route, no temporary extra
cron, no fetch handler and no invented invocation path is added to shorten the wait. The first
opportunity after propagation completes is the acceptance event, and the honest cost is that the first
live evidence arrives at the next 01:17 UTC opportunity after activation.

### 13.7 Live acceptance contract

Prepared here; **not executed**. Each stage is evidence to capture, and any failure stops the package.

**A. Pre-deploy safety.** Record: the exact `main` SHA; the exact-`main` `Verify Teamsheet` run and its
`success` conclusion on that SHA; workflow A still `state: disabled_manually`; repository-wide runs
with status `queued` = 0 and `in_progress` = 0; workflow B's run population before activation
(currently **zero**); `teamsheet-data-s2-dispatcher` still present under that exact name;
`GITHUB_DISPATCH_TOKEN` still bound; the deployed Worker still holding zero Cron Triggers; and the
account's current live Cron Trigger count against the five-trigger Free limit (§13.5).

**B. Attended exact-`main` deployment.** Deploy the exact verified `main` configuration by the §13.4
path: temporarily reconnect the Workers Git integration to `priteshpatel390-del/FPL`, target the
existing `teamsheet-data-s2-dispatcher` project, blank build command, deploy command exactly
`npx wrangler deploy --config workers/schedule-dispatcher/wrangler.jsonc`. Afterwards record: that the
deployed Worker is still the existing dispatcher identity, not a new project; that its Cron Triggers
are exactly `17 1 * * *`, `17 2 * * *` and `17 3 * * *` and **nothing else**, with no fourth trigger;
that no second Worker was created; that `teamsheet-data-platform` was not deployed to; that no
unexpected binding, route, custom domain, `workers.dev` exposure, queue or storage binding appeared;
and that the Git integration was **disconnected again immediately**. The dashboard is the surface used
to *verify* that trigger set (§13.4.1) — never the surface that created it.

**C. First live dispatch.** This is the first time Cloudflare-to-GitHub dispatch is exercised at all.
Establish: that a Cloudflare invocation occurred (Cron Events, or the Worker's own log line carrying
its closed-enum `dispatch` classification and bounded latencies); that a GitHub run was created; that
the run belongs to **workflow B**, `.github/workflows/data-s2-production-external.yml`, and no other
workflow; that it is on `main`; that it is attempt 1; the guard's recorded result; and the production
collection result. **Never expose the GitHub token**, and never paste a log line or screenshot that
could carry it.

**D. One collection per UTC day.** If the 01:17 opportunity collects, observe a later opportunity
**refusing** production collection through the guard: the later run may exist, and its `collect` job
must be skipped or refused because the day is consumed. Capture that refusal as the proof. **Do not
manufacture a second production collection to test this**, and do not dispatch workflow B by hand to
create the evidence.

**E. Failure handling.** If the first dispatch produces `REJECTED`, `AMBIGUOUS`, a transport failure,
an unexpected GitHub response, the wrong workflow, guard ambiguity or unexpected production behaviour:
fail closed, capture the evidence and report. Do **not** improvise retries outside the approved
design, do **not** weaken the guard, do **not** re-enable workflow A, and do **not** create an
alternative collection path. `AMBIGUOUS` specifically means a dispatch may already have been accepted,
so the correct response is to look for a created run, never to fire again.

**Rollback.** If the attended deployment produces unsafe or malformed live state — the wrong
expressions land, a fourth trigger appears, the wrong Worker is touched, or the first fire behaves
unexpectedly — fail closed and return the live Worker to **zero Cron Triggers**. Two ways do that:
deploy a configuration whose `crons` array is explicitly empty, or, as an emergency dashboard action,
delete the triggers (Triggers → the three-dot icon → Delete). Record exactly what was removed, when
and why. Do **not** re-enable workflow A, do **not** create another scheduler, do **not** weaken the
guard, and do **not** improvise repeated dispatches.

The canonical repository rollback configuration is the explicit empty array:

```json
"triggers": {
  "crons": []
}
```

Omitting the `triggers` or `crons` key is **not** rollback: Cloudflare documents that an **empty**
array removes all triggers while an **undefined** key leaves the deployed triggers in place.

### 13.8 The gap risk during Package C

The accepted DATA-S2 history-gap risk (§0.6, §12.2) stays live until Cloudflare automatic operation is
proven. **No gap is claimed here**: a gap exists only when a UTC day actually closes with no production
collection through any of the three governed workflows, and observations lost to any gap are **not**
claimed to be reconstructible.

### 13.9 Package C limitations

* **Live Cloudflare-to-GitHub dispatch is still unproven.** The repository candidate proves the
  declared configuration, not that the deployed Worker can reach GitHub or that GitHub answers as §5.6
  expects.
* **The live Worker holds zero Cron Triggers** until the owner deploys. Merging this candidate changes
  no live state.
* **The account's live cron budget is unverified from here** (§13.5) and must be confirmed attended.
* **Cloudflare Cron punctuality is best-effort**, exactly as GitHub's was (S2C-2). Three opportunities
  buy retry availability, not a guaranteed collection instant.
* **Propagation takes up to 15 minutes**, so the first opportunity after activation may legitimately
  not fire.
* **The dispatch credential expires 90 days after its Package B creation.** A lapsed token makes every
  dispatch a refusal rather than a silent failure, but it does stop collection.
* **No device testing** was performed or is required.

### 13.10 Next gates

1. **Owner review and merge of this candidate** — the standing merge gate is unchanged and is not
   waived by Package C approval.
2. **Exact-`main` `Verify Teamsheet`** on the merge commit.
3. **The attended exact-`main` Wrangler deployment** of §13.4 to the existing
   `teamsheet-data-s2-dispatcher`, with the §13.7 A and B evidence, and the temporary Git
   integration disconnected again immediately afterwards.
4. **First live dispatch acceptance** (§13.7 C) and the **one-collection-per-day proof** (§13.7 D).
5. **Package D — observation**, then **Package E — repository retirement**, unchanged from §11.
