# DATA-OPS A1.4 — Persistent Incident Lifecycle + Independent Watchdog

<!-- DATA-OPS-A1-4-2026-09-09-SET-ATTRIBUTION -->
## A1.4 set-based opportunity attribution correction (PR #240, draft and unmerged)

The 04:17 and 08:17 UTC five-hour delivery windows overlap from 08:17 through 09:17. Greedily
assigning each GitHub run while iterating newest-first was unsafe: two runs created inside that
overlap could claim the two opportunities in processing order and swap their real identities.
Attribution now evaluates the complete bounded scheduled-run set as a bipartite matching problem.
Existing ledger assignments are fixed first. For each independent overlap component, the resolver
enumerates all maximum one-run/one-opportunity matchings; a pair is persisted only when every
maximum matching agrees on it. A single-candidate run can therefore force a second overlap run onto
the remaining opportunity, while two runs with identical `{04:17,08:17}` candidates remain
unassigned regardless of input order. Rerun attempts inherit the workflow run's existing mapping.

Unresolved opportunities receive a sanitized synthetic `ATTRIBUTION_AMBIGUOUS` observation with
reason `OBSERVER_OPPORTUNITY_ATTRIBUTION_AMBIGUOUS`. Heartbeat classifies it as `MALFORMED`, opening
the normal observer-heartbeat lifecycle; it is neither HEALTHY, MISSING, job failure nor a GitHub
outage claim. D1 remains final authority through unique opportunity and workflow-run ownership.
Matching happens before writes; a concurrent write conflict is re-read, accepted only if it matches
the resolved pair, otherwise represented fail-closed rather than retried against another candidate.
No live deployment, provisioning, activation, authority, model, provider or calculation change.
Focused A1.4 verification passes 172/172 tests; full repository verification passes 1,994/1,994 tests.


**Status: repository implementation candidate. Not deployed. Not provisioned. Not activated. Not
live-accepted.** Every fact in this document about the watchdog's behaviour is a claim about
source code and tests that exist in this repository, never about a running system.


<!-- DATA-OPS-A1-4-2026-09-09-FINAL-INTEGRATION-CORRECTION -->
## A1.4 final integration correction (PR #240, draft and unmerged)

This section supersedes conflicting A1.4 integration details and test counts below; older text remains as review history.

The watchdog now validates semantic summaries for up to the two newest terminal **scheduled**
candidates per cycle; manual dispatches never consume this fixed read allowance. Scheduled runs are resolved together by the set-based matching contract above. Only pairs forced
across every maximum matching are attributed; overlapping pairs that cannot be distinguished remain
ambiguous and unassigned. Existing workflow-run attribution is reused across rerun attempts, and
bootstrap excludes older opportunities.

Observation identity and evidence hashes include `run_attempt`. Decisive evidence is selected for
the exact attributed opportunity by run attempt descending, terminal state before in-flight,
completion-or-observation time descending, observation time descending, then observation id.
Lifecycle monotonicity uses the decisive run completion/observation timestamp, or the stable logical
opportunity instant for absence; repeated identical GitHub-unavailable states reuse their persisted
evidence instant. Failed email delivery is retried through the same notification row and key even
when lifecycle replay returns `NONE`; retry creates neither a notification reservation nor a
lifecycle occurrence. Exactly-once external delivery is not claimed. Repository-only: no live
resource, credential, schedule, email, deployment, merge, provider, model, calculation or
remediation authority changed.

Final local evidence: 165/165 focused A1.4 tests and 1,987/1,987 full repository tests passed;
two consecutive production builds were byte-identical.
**This is the corrected revision.** An owner review of the first candidate (draft PR #240) found
eight required-correction groups plus additional audit findings; every one is fixed here and is
described in its own section below, each stating the previous problem and the corrected behaviour.

## 0. What A1.4 is, in one paragraph

A1.1 gave the Data Steward a deterministic, observe-only policy foundation. A1.2 gave it three
read-only sentinels over the real production chain. A1.3 turned that into a dedicated,
GitHub-hosted, read-only observer with manual dispatch and (once separately activated) two daily
schedule opportunities. All three remain exactly what they were: a sensor with no memory and no
voice. A1.4 adds the memory and the voice, **outside** that sensor: a separate, isolated
Cloudflare Worker that reads the sensor's own GitHub Actions history, understands which of A1.3's
own declared opportunities is currently due, decides whether a problem is new, unchanged, worse,
better or back, and — at most a few times a day — tells the owner by email. It adds no ability to
fix anything.

## 1. The hard boundary this checkpoint does not cross

A1.3 is not rewritten into a stateful service and does not "phone home." The watchdog is a
**separate Worker, in a separate directory (`workers/data-steward-watchdog/`), with its own
Cloudflare identity, its own D1 database, and its own GitHub credential.** A permanent,
bidirectional test walks every `.mjs` file in the package and every import/require specifier it
contains: the watchdog cannot import `src/` (the FPL application), `workers/data-steward/`
(A1.3's own runtime), `workers/data-platform/`, `workers/schedule-dispatcher/` or
`workers/evidence-archive/`; the reverse direction is checked too. A1.3's own workflow, its
sentinels and its existing no-mutation regressions are byte-unchanged.

## 2. Architecture

```
A1.3 GitHub read-only observer (dedicated workflow, unchanged)
        |  produces ordinary GitHub Actions run/job history, plus one sanitized JSON summary line
        v
A1.4 GitHub evidence reader (lib/github-evidence-reader.mjs)
        |  bounded GET-only reads of that one workflow's own runs/jobs; a job-log read for the
        |  freshest SUCCESS-or-FAILED run only, bounded to one per cycle
        v
A1.4 observer summary semantic contract (lib/observer-summary-contract.mjs)
        |  is this run's own outcome actually trustworthy, or contradictory/malformed?
        v
A1.4 observation classifier (lib/observation-classifier.mjs)
        |  -> one closed health state per run, persisted with real GitHub provenance
        v
A1.4 expected-opportunity model (lib/opportunity-schedule.mjs) + schedule-aware heartbeat
     (lib/heartbeat.mjs), bootstrap-clamped (persistence/repository.mjs: ensureBootstrap)
        v
A1.4 incident lifecycle reducer (lib/lifecycle-reducer.mjs), over a deterministic fingerprint
     (lib/incident-fingerprint.mjs) -> NEW / ONGOING / CHANGED / RECOVERED / REOPENED / NONE,
     carrying a real evidence pointer through to persistence
        v
A1.4 isolated Data Steward Watchdog D1 (persistence/, migrations/0001_watchdog_foundation.sql) —
     gated by a single-writer scheduled-event claim before any of the above runs
        v
A1.4 notification decision (notification/decision.mjs) -> notification message
     (notification/message.mjs), built from real evidence -> email transport
     (notification/transport.mjs) -> Cloudflare `send_email` binding -> one fixed owner recipient
```

Every arrow above is a function call inside `workers/data-steward-watchdog/run-watchdog.mjs`, the
one orchestrator that wires the package together. The Worker entry point
(`workers/data-steward-watchdog/watchdog.mjs`) exports a `scheduled` handler and nothing else — no
`fetch` handler, no public HTTP surface.

## 3. Correction 1 — the heartbeat is schedule-aware, not age-only

**Previous problem.** The first candidate classified HEALTHY/STALE/MISSING purely from "how long
since the last success," with fixed 12h/24h age thresholds. A1.3 declares two independent daily
opportunities, 04:17 and 08:17 UTC, four hours apart, followed by a roughly twenty-hour overnight
gap back to the next day's 04:17. A watchdog firing at 23:17 UTC under the old rule would see
~15 hours since the 08:17 success and call a perfectly healthy day STALE or MISSING — every day.

**Corrected behaviour.** `lib/opportunity-schedule.mjs` computes the single most recent declared
opportunity instant at or before `now` (`latestExpectedOpportunity()`), pinned by test against the
exact cron strings in `.github/workflows/data-steward-readonly-observer.yml`.
`lib/heartbeat.mjs`'s `classifyHeartbeat()` then asks only one question about that one opportunity:
what happened to it? A success (or an acceptable `NOT_EVALUATED` outcome — see §4) at that
opportunity is HEALTHY for as long as it remains the latest due opportunity — there is no age
decay, which is exactly what makes the ~20-hour overnight gap a non-event. A decisive outcome
(failure, skip, or a malformed/contradictory summary — see §4) never waits for grace; it is
reported immediately. Absence of any evidence is PENDING (no incident) until grace expires, then
MISSING.

**Grace, from this repository's own evidence.** CLAUDE.md records three independently measured
GitHub Actions schedule-delivery delays for this repository's other cron-triggered workflows:
approximately 3h21m, 4h31m and 4h44m late. `OBSERVER_GRACE_MS = 5 hours` is the smallest clean
bound that still comfortably exceeds every one of those three samples — pinned by test against
the exact figures in CLAUDE.md, not invented as a round number.

**A consequence, stated honestly.** Because grace (5h) exceeds the 4-hour gap between the two
same-day opportunities, a missed 04:17 opportunity that is immediately followed by a healthy
08:17 will never be separately reported as MISSING — by the time 04:17's own grace would expire
(09:17), 08:17 has already become the latest due opportunity and, once it succeeds, the whole day
reads HEALTHY. This is the same "later evidence supersedes earlier" principle A1.2 already uses
for the production chain, applied to A1.3's own two-opportunities-a-day schedule: only the most
recent opportunity's fate is load-bearing at read time. It is a real, understood limitation, not
an oversight, and it is why the 08:17 opportunity — whose *own* next opportunity is a full day
away — is the one used to prove the MISSING/FAILED/CHANGED test scenarios exactly at their
boundaries.

## 4. Correction 2 + 3 — real execution outcomes are first-class evidence, judged by a genuine semantic contract

**Previous problem.** The first candidate trusted "GitHub says the job succeeded" as sufficient
proof of health, and separately, an older success could remain the only evidence the heartbeat
ever looked at, so a genuinely failed later opportunity could not open an incident at all.

**Corrected behaviour.** `lib/github-evidence-reader.mjs` now reads the observer's own job-log
summary for the freshest run whose GitHub job conclusion is `success` **or** `failure` (previously
only `success` was checked), bounded to one such read per cycle.
`lib/observer-summary-contract.mjs`'s `evaluateObserverSummary()` pins the actual contract
`run-observer.mjs`/`observation-run.mjs` establish: `escalationRequired` is true exactly when
`verdict === 'UNHEALTHY'`, which is exactly when the job's own exit code makes GitHub report
`failure` — so a successful job can never legitimately carry `escalationRequired: true`, an
incomplete heartbeat, or an unhealthy verdict, and a failed job can never legitimately carry a
summary claiming otherwise. Either combination is `SUMMARY_CONTRADICTORY`, never trusted as
evidence of health. `verdict: 'NOT_EVALUATED'` is deliberately accepted (`NOT_EVALUATED_OK`) — it
describes the underlying production-collection day-window not yet being evaluable, a fact about
the chain A1.3 *observes*, not about whether A1.3 itself ran correctly; A1.3 exits zero for it
precisely because it is not an A1.3 problem, and requiring literal `verdict === 'HEALTHY'` here
would manufacture a false incident every time A1.3 legitimately runs outside that window.
`lib/observation-classifier.mjs` turns every combination into one closed health state
(`SUCCESS`, `NOT_EVALUATED_OK`, `FAILED`, `SKIPPED`, `IN_FLIGHT`, `SUMMARY_INVALID`,
`SUMMARY_UNHEALTHY`, `SUMMARY_CONTRADICTORY`, `UNCLASSIFIED`), and `heartbeat.mjs` treats every one
except `SUCCESS`/`NOT_EVALUATED_OK` as decisive, active evidence — reported immediately, never
masked by an older success. `persistence/statements.mjs`'s `SELECT_LATEST_SCHEDULED_SINCE` is
bound to `run_created_at >= <opportunity instant>`, so a prior day's success structurally cannot
satisfy today's opportunity query at all.

## 5. Correction 4 — a real single-writer claim, enforced by the database

**Previous problem.** The first candidate identified a Cron firing by wall-clock execution time
and relied only on downstream idempotent keys; two genuinely overlapping executions of the same
logical firing could both evaluate incident state, both attempt a lifecycle mutation, and both
race to send a notification.

**Corrected behaviour.** `persistence/statements.mjs`'s `CLAIM_SCHEDULED_EVENT` is one atomic
`INSERT ... ON CONFLICT(scheduled_time) DO NOTHING`, keyed on `controller.scheduledTime` (the
Cron's own logical firing instant, per Cloudflare's `scheduled()` handler contract — deliberately
not wall-clock execution time) rather than any application-level check-then-set. It is the
**first** thing `run-watchdog.mjs`'s `runWatchdogCycle()` does, before any GitHub read, D1 read or
notification decision. A losing execution — true concurrency, a retried delivery, or a re-fired
event — does nothing further at all and resolves with
`{duplicate: true, reasonCode: 'WATCHDOG_DUPLICATE_SCHEDULED_EVENT'}`, never an error.
`tests/data-ops-a1-4-orchestrator.test.mjs`'s `CONCURRENCY:` tests exercise this with real
`Promise.all()` overlap (including a five-way overlap), proving exactly one lifecycle mutation and
exactly one notification per logical event, and prove that different scheduled events remain
fully independent. A separate test proves that a crash *after* the claim commits but before later
work completes still leaves the claim durably recorded (so a retry of that exact event is
correctly treated as a duplicate rather than reprocessed) while a later, independently-scheduled
cycle is entirely unaffected — the honestly-stated cost of this design is that one scheduled
event's own work can be lost to a mid-cycle crash, recovered only by the next natural firing, never
silently repeated.

## 6. Correction 5 — a genuine runtime failure is visible to Cloudflare, never silently successful

**Previous problem.** The first candidate wrapped GitHub reads and retention pruning in
`.catch(() => null)`-style swallows, and its Worker entry point never let any exception escape the
`scheduled()` handler, so a real D1 outage, a config error or a code bug would still resolve the
Cron invocation as a success in Cloudflare's own history.

**Corrected behaviour.** Every D1 access in `persistence/repository.mjs` throws a
`RepositoryError` on failure and none of them are caught by `run-watchdog.mjs` — a D1 read/write
failure, an incomplete environment (`resolveWatchdogEnvironment()` failing is now a thrown
`WatchdogExecutionError('WATCHDOG_ENVIRONMENT_INCOMPLETE')`, not a quiet `{ok:false}` return), a
retention-pruning failure, or an unexpected bug anywhere in the pipeline propagates all the way out
of `runWatchdogCycle()`. `watchdog.mjs`'s `scheduled()` handler logs one sanitized diagnostic line
(a closed reason code only, never the caught error's own message or stack) and then re-throws a
new, sanitized `Error`, so the Worker's returned promise genuinely rejects and Cloudflare records
a failed Cron invocation. The one deliberate exception, the lost single-writer claim, resolves
normally — it is an expected, healthy outcome, not a failure. GitHub read failures that
`lib/github-evidence-reader.mjs` itself classifies as `{ok:false, reasonCode}` (a non-200 response,
a decode failure, a transport error) are **not** re-thrown by that module — they are handled,
expected-degradation paths that open their own `GITHUB_EVIDENCE` incident and let the cycle
continue; only a genuinely unexpected exception escaping that module's own internal contracts
would propagate as a fatal failure.

**Notification transport is the deliberate, documented exception to "propagate on failure."** A
`send_email` binding rejection is recorded truthfully as a `FAILED` delivery row and is **not**
re-thrown — it is expected and transient, and re-throwing it would fail the whole cycle's
otherwise-successful lifecycle/persistence work over a problem in the one place that is allowed to
degrade gracefully. Because `markIncidentNotified()` only runs on a successful send, the
incident's `last_notified_at` stays at its prior value, so the very next cycle's notification
decision (now `ONGOING`, since the underlying condition persists) treats that unset/stale value as
due for an immediate reminder and retries automatically — no bespoke retry logic, and no alert
storm, because the decision policy's own 24-hour reminder ceiling still applies.

## 7. Correction 6 — real, wired provenance instead of decorative placeholder fields

**Previous problem.** `run_attempt` was decoded from GitHub but discarded at the persistence
boundary (always written as `null`); an incident's evidence pointer was always `null`; a
notification's "last known healthy/scheduled observation" was populated from the watchdog's own
evaluation-cycle timestamp rather than the evidence's real timestamp.

**Corrected behaviour.** `github-evidence-reader.mjs`'s `decorateRun()` now returns the real
`runAttempt`, and `run-watchdog.mjs` persists it. `lib/lifecycle-reducer.mjs` accepts an opaque,
shape-validated `evidenceRef` (`observationId`, `workflowRunId`, `runAttempt`, `headSha`,
`observedAt`) that it carries through to the persisted `next` state without interpreting it, so
the reducer's replay/ordering guarantees and its genuine provenance are the same write.
`persistence/statements.mjs`/`repository.mjs` widen `watchdog_incidents` with
`evidence_observation_id`, `evidence_workflow_run_id`, `evidence_run_attempt`, `evidence_head_sha`
and `evidence_source_at` (the evidence's own real timestamp — deliberately distinct from
`last_evidence_observed_at`, which stays the watchdog's own cycle-clock reading used only for the
reducer's monotonic replay guard). `notification/message.mjs`'s "last known healthy/scheduled
observation" and "related GitHub Actions run id"/"related main SHA" now come from that real
pointer. A `GITHUB_EVIDENCE` incident, which has no observation row to point to, legitimately
persists a `null` pointer — the schema and the UI both distinguish "no evidence exists" from "the
evidence field was wired to a placeholder."

**A related fix found during the audit, worth recording precisely.** GitHub's own timestamps omit
milliseconds (`...T04:17:00Z`); this repository's own `.toISOString()` calls always include them
(`...T04:17:00.000Z`). Comparing the two lexicographically in SQL — as
`SELECT_LATEST_SCHEDULED_SINCE`'s `run_created_at >= ?` bound does — would rank an exact-instant
match as *earlier* than the bound, because `.` (0x2E) sorts before `Z` (0x5A). Every GitHub
timestamp is now normalized to the millisecond-inclusive form the instant it is decoded
(`github-evidence-reader.mjs`), which is what keeps that comparison, and retention pruning's own
TEXT comparisons, correct at exact boundaries. A second, smaller normalization fix: the raw GitHub
job `conclusion` string (`'cancelled'`, `'timed_out'`, etc.) is never passed to
`evaluateObserverSummary()`, which accepts only the literal `'success'`/`'failure'` its contract
defines — `observation-classifier.mjs` derives that normalized value from the already-classified
`jobHealth` instead, so a cancelled or timed-out job is checked for summary contradiction exactly
like an ordinary failure rather than throwing on an unrecognized conclusion string.

## 8. Correction 7 — a genuinely deployable, honestly-placeholder repository configuration

**Previous problem.** `wrangler.jsonc` omitted the `database_id` field `d1_databases` requires,
which is not valid Wrangler configuration at all — it would have failed before ever reaching the
point of asking for a real database.

**Corrected behaviour.** `wrangler.jsonc` now declares
`"database_id": "00000000-0000-0000-0000-000000000000"` — the conventional inert placeholder. It
is not a fabricated production id: it cannot resolve to any real database, and `wrangler deploy`
fails safely against it rather than silently binding to something unintended. The real id, from
`wrangler d1 create teamsheet-data-steward-watchdog` (or `wrangler d1 info` for an
already-created one), is one step of the later, separately approved live-provisioning gate in
§14 — never before it. The `send_email` binding's `destination_address` remains the same
structurally-invalid placeholder (`REPLACE_LOCALLY_BEFORE_DEPLOY@example.invalid`) from the first
candidate, for the same reason: the owner's real address must never be committed.

**A live prerequisite this checkpoint had not previously named.** Cloudflare's Email Service
documentation is explicit: the `send_email` binding's sender address "must always belong to a
domain you have onboarded to Email Service," and before a sending domain is onboarded, sending is
possible only to already-verified destination addresses. This means `fpltsheet.co.uk` (the sender
domain `NOTIFICATION_SENDER_ADDRESS = 'data-steward-watchdog@fpltsheet.co.uk'` uses) must itself be
onboarded to Cloudflare Email Service — SPF/DKIM DNS records added, via
**Compute → Email Service → Onboard Domain** — as an explicit step of live provisioning (§14),
separate from and prior to relying on the `destination_address` restriction. Neither this nor the
destination address's own verification has been checked or performed; both are unproven live
facts, not repository claims.

## 9. Correction 8 — the isolation claim is now actually true

**Previous problem.** Every module in the package imported the tiny generic canonicalisation
helpers (`canonicalise`, `deepFreeze`, `sha256Hex`, `stableStringify`, `secretFinding`) from
`src/decision-intelligence/canonical.mjs` — FPL product code — directly contradicting the
checkpoint's own claim that the watchdog has no dependency on `src/`.

**Corrected behaviour.** `lib/canonical.mjs` is now the watchdog's own byte-for-byte-equivalent
copy of those five functions, and every module in the package imports from it instead. A
permanent, bidirectional test (`tests/data-ops-a1-4-worker-config.test.mjs`) parses every actual
`import`/`require` specifier in the package (not merely a prose mention of a path) and refuses any
that resolves into `src/`, `workers/data-platform/`, `workers/schedule-dispatcher/`,
`workers/evidence-archive/` or `workers/data-steward/`'s own runtime modules, and separately
confirms `src/` and `workers/data-steward/` never mention the watchdog either.

## 10. Bootstrap — no retroactive incidents from before this watchdog ever ran

A1.3's own scheduled runs are not yet live (`DATA_STEWARD_SCHEDULED_ENABLED` remains
owner-verified absent), and historical run #9 skipped *before* that variable existed — which is
not proof of an A1.3 scheduling bug, and this checkpoint does not treat it as one or touch A1.3's
schedule gate. To make sure a freshly deployed watchdog cannot retroactively judge opportunities
that occurred (or failed to occur) before it ever executed, `persistence/repository.mjs`'s
`ensureBootstrap()` records the exact instant of this database's very first cycle, once, and every
later cycle reads that instant back unchanged. `lib/opportunity-schedule.mjs`'s
`latestExpectedOpportunity()` clamps forward to it: a natural opportunity instant earlier than the
bootstrap instant resolves to `null` (nothing due yet, `PENDING`, no incident), never a
manufactured `MISSING`.

## 11. Email delivery — accurate language, not a perfect-exactly-once claim

The repository provides strong idempotent decisioning, deduplication and retry control: a given
lifecycle transition can reserve at most one notification row (§5/§6), and a delivery failure is
recorded truthfully and self-heals without duplicating a later send. It cannot honestly claim
mathematically perfect exactly-once **external** delivery: there is an unavoidable, narrow
distributed-systems window between Cloudflare's Email Service accepting a message and this
Worker's own commit of that fact to D1, in which a crash could leave a message sent with no local
record of it (self-healing on the next reminder cycle would then, in the rare unlucky case, send a
second reminder rather than none). No document in this repository claims otherwise, and this one
states it exactly.

## 12. Retention

| Table | Policy | Enforcement |
|---|---|---|
| `watchdog_observations` | 45 days | `PRUNE_OBSERVATIONS`, exempting rows an ACTIVE incident's `evidence_observation_id` still points to |
| `watchdog_incidents` | 365 days, **RECOVERED only** | `PRUNE_INCIDENTS`; an ACTIVE incident is never pruned by age |
| `watchdog_notifications` | 90 days | `PRUNE_NOTIFICATIONS` |
| `watchdog_scheduled_claims` | not pruned in this checkpoint | one row per Cron firing (four/day); bounded and negligible |
| Raw GitHub logs | never stored | only the closed, decoded summary shape is ever kept, never response bytes |

## 13. Security / authority

Unchanged in substance from the first candidate, restated against the corrected implementation:
the watchdog can issue bounded `GET`-only GitHub reads (plus the one bounded job-log read), read
and write its own D1 tables through the fixed allowlisted statements in
`persistence/statements.mjs`, and send at most a small, bounded number of emails to the one
Cloudflare-configured recipient. It cannot dispatch, re-run or cancel a GitHub workflow; write to
GitHub in any way; mutate any Cloudflare resource; invoke or influence production collection; read
or write production Official FPL D1, the evidence archive D1, or any database but its own; call a
football data provider; send email to any recipient other than the one the binding is configured
with; run arbitrary SQL, an HTTP request to an arbitrary URL, or a shell command; merge or open a
pull request; or perform any autonomous repair — all confirmed by a permanent whole-package scan
(`tests/data-ops-a1-4-worker-config.test.mjs`).

## 14. Live closeout — one consolidated package for a later, separate owner gate

None of the following has been done. All of it is a later, explicit, combined owner decision,
listed here in the order it would need to happen:

1. Merge this PR after owner review; verify exact-`main` Verify success on the merged commit.
2. Create the isolated D1 database (`wrangler d1 create teamsheet-data-steward-watchdog`), obtain
   its real `database_id`, and replace the `00000000-0000-0000-0000-000000000000` placeholder in
   `wrangler.jsonc` with it. Apply `workers/data-steward-watchdog/migrations/0001_watchdog_foundation.sql`.
3. Create a narrowly scoped, repository-only-readable GitHub fine-grained token (Metadata: Read,
   Actions: Read, no write permission of any kind) and bind it as the Worker secret
   `DATA_STEWARD_WATCHDOG_GITHUB_TOKEN`.
4. **Onboard `fpltsheet.co.uk` to Cloudflare Email Service** (Compute → Email Service → Onboard
   Domain; add the SPF/DKIM DNS records) if not already onboarded, and confirm at least one
   destination address is verified. Locally edit (never commit) `wrangler.jsonc`'s
   `send_email[0].destination_address` to that verified address.
5. Deploy the exact reviewed `workers/data-steward-watchdog/` configuration (temporarily
   reconnecting a Git build integration and disconnecting it again immediately after, exactly as
   Package C did for the dispatcher, or via an attended local `wrangler deploy`).
6. Confirm the account's live Cron Trigger count leaves room for one more (Workers Free allows
   five per account; the dispatcher already holds three).
7. Perform one safe, attended functional acceptance: trigger the deployed Worker's `scheduled`
   handler through Wrangler's own local/remote test tooling (`/cdn-cgi/local/scheduled`, or
   `wrangler dev --test-scheduled`) against the real bindings, without fabricating a fake
   production incident, and confirm it claims, reads, writes and (if a real problem is present)
   notifies correctly, and that a second overlapping trigger of the same simulated
   `scheduledTime` is correctly rejected as a duplicate.
8. Observe the first two or three natural Cron fires and confirm persistence and, if applicable,
   notification behaviour, without deliberately harming production or the A1.3 observer to force
   a test incident.
9. Record final closeout documentation once live behaviour is observed.

## 15. Owner decision required next

Whether to approve this repository-side PR for merge. Everything in §14 remains separate, and
scheduled activation of the underlying A1.3 observer itself remains exactly as separately gated as
it already was — this checkpoint changes nothing about that gate.
