# DATA-S2C — external production scheduler, Package A repository foundation

**Status: repository implementation only. Nothing in DATA-S2C is live.**

No GitHub personal access token or GitHub App was created. No Cloudflare secret was created. No
Worker was deployed. No Cloudflare Cron Trigger was created, changed or removed. No workflow was
dispatched. No D1 request was performed. No Official FPL endpoint was contacted for collection. No
production collection was run. The existing GitHub cron remains `17 1 * * *` and is untouched by
this package.

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

DATA-S2C therefore adds a **second, independent way to ask for the day's collection** — an isolated
Cloudflare timer that dispatches a GitHub Actions workflow — while leaving the existing GitHub cron
in place. It does not replace the collection engine, and it must never become one.

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

A run **consumes** the day's opportunity when, on **any of its attempts**, both hold:

* a `collect` job execution exists with any conclusion **other than `skipped`**; and
* that `collect` execution **started** in the current UTC day, **or** within the **trailing six
  hours**.

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
free. **Every attempt's `collect` execution is separate evidence and any one of them consumes**; a
newer skipped attempt never overwrites an older started one, and the order the provider returns
executions in is irrelevant.

The read stays bounded by one page of 100 executions rather than by pagination. The governed
workflows carry exactly two jobs per attempt, so a page of 100 covers fifty attempts of one run, and
a listing whose `total_count` exceeds the rows returned is **truncated and fails closed** — a
truncated page could be missing exactly the attempt that collected. There is no page cursor, no
pagination loop and no change to the twelve-read bound.

### 3.3.2 The window is dated by when `collect` started

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
includes: a listing whose provider total does not equal the rows returned, whether of runs or of
job executions; a run row without a positive integer id or a parseable creation instant; a job row
of the wrong shape, or without a status, attempt number or usable start instant where the decision
depends on one; a started `collect` whose timing contradicts its own run or the clock; a missing or
extra governed workflow; a non-200 response; a body that will not decode; a transport failure; and
an exhausted read bound. Timing that cannot be established is reported as the closed reason
`guard_collect_timing_unusable`.

The read bound is fixed at 12 GitHub REST GETs. The listing itself is bounded by the provider,
using the Actions `created=>=` filter over the window's own start date, so the guard never depends
on an unbounded page happening to be ordered newest first.

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
was read for this checkpoint: workflow `350014371` reports `state: active` and produced successful
natural run `34015422874` on 6 September 2026, so the guard's first live effect will be on genuine
natural runs. Superseded, and retained only as history: the earlier repository evidence had it
owner-disabled
after run `33948145320`.

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
  approved.
* **No device testing** was performed or is required: this is a repository-only backend and workflow
  checkpoint.

## 11. Gates after Package A

Each is separate:

1. owner review and merge of this draft pull request;
2. exact-`main` Verify Teamsheet on the merge commit;
3. Package B and later — the GitHub credential, its scoping and storage;
4. Package C — the dispatcher deployment and the change from `"crons": []` to live cron entries;
5. any first live external dispatch, under its own explicit owner approval.

Merging Package A does not activate DATA-S2C. It adds the guard to the existing scheduled path and
lands the foundation for everything above.
