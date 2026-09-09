# DATA-OPS A1.4 — Persistent Incident Lifecycle + Independent Watchdog

**Status: repository implementation candidate. Not deployed. Not provisioned. Not activated. Not
live-accepted.** Every fact in this document about the watchdog's behaviour is a claim about
source code and tests that exist in this repository, never about a running system.

## 0. What A1.4 is, in one paragraph

A1.1 gave the Data Steward a deterministic, observe-only policy foundation. A1.2 gave it three
read-only sentinels over the real production chain. A1.3 turned that into a dedicated,
GitHub-hosted, read-only observer with manual dispatch and (once separately activated) two daily
schedule opportunities. All three remain exactly what they were: a sensor with no memory and no
voice. A1.4 adds the memory and the voice, **outside** that sensor: a separate, isolated
Cloudflare Worker that reads the sensor's own GitHub Actions history, remembers what it has seen
in its own database, decides whether a problem is new, unchanged, worse, better or back, and — at
most a few times a day — tells the owner by email. It adds no ability to fix anything.

## 1. The hard boundary this checkpoint does not cross

A1.3 is not rewritten into a stateful service and does not "phone home." The watchdog is a
**separate Worker, in a separate directory (`workers/data-steward-watchdog/`), with its own
Cloudflare identity, its own D1 database, and its own GitHub credential.** It imports nothing from
`workers/data-steward/` and nothing from `workers/data-steward/` imports it — pinned by a
permanent test in both directions. A1.3's own workflow file, its sentinels, its heartbeat/verdict
contract and its no-mutation regressions are untouched.

## 2. Architecture

```
A1.3 GitHub read-only observer (dedicated workflow, unchanged)
        |  produces ordinary GitHub Actions run/job history, plus one sanitized JSON summary line
        v
A1.4 GitHub evidence reader (workers/data-steward-watchdog/lib/github-evidence-reader.mjs)
        |  bounded GET-only reads of that one workflow's own runs/jobs, GET-only job-log read of
        |  at most one run's summary line per cycle
        v
A1.4 observation classifier + heartbeat classifier (lib/observation-classifier.mjs, lib/heartbeat.mjs)
        |  pure functions: job outcome -> health state; durable last-success timestamp -> HEALTHY/STALE/MISSING
        v
A1.4 incident lifecycle reducer (lib/lifecycle-reducer.mjs), over a deterministic fingerprint
        |  (lib/incident-fingerprint.mjs) -> NEW / ONGOING / CHANGED / RECOVERED / REOPENED / NONE
        v
A1.4 isolated Data Steward Watchdog D1 (persistence/, its own migrations/0001_watchdog_foundation.sql)
        |
        v
A1.4 notification decision (notification/decision.mjs) -> notification message (notification/message.mjs)
        |
        v
A1.4 email transport (notification/transport.mjs) -> Cloudflare `send_email` binding -> one fixed
        owner recipient
```

Every arrow above is a function call inside `workers/data-steward-watchdog/run-watchdog.mjs`, the
one orchestrator that wires the package together. The Worker entry point
(`workers/data-steward-watchdog/watchdog.mjs`) exports a `scheduled` handler and nothing else — no
`fetch` handler, no public HTTP surface.

The watchdog is architecturally separate from: the production collection dispatcher
(`workers/schedule-dispatcher/`), the historical data-platform Worker and production Official FPL
D1 (`workers/data-platform/`), the evidence archive Worker (`workers/evidence-archive/`), and every
Teamsheet application/model module under `src/`. A permanent test walks every `.mjs` file in
`workers/data-steward-watchdog/` and refuses any reference to those identities, bindings or
secrets, and walks `src/` and `app.html` to confirm the application never mentions the watchdog
either.

## 3. Heartbeat policy

GitHub schedule delivery has been measured, in this repository's own history, arriving
approximately 3h21m, 4h31m and 4h44m late. A short freshness threshold would therefore be a false
alarm generator, not a monitor. The approved policy:

- **HEALTHY** — at least one scheduled A1.3 observation is known to have executed successfully
  within the previous 12 hours.
- **STALE** — no such success within the previous 12 hours.
- **MISSING** — no such success within the previous 24 hours (this includes "never observed at
  all").

Both boundaries are inclusive on the healthy/stale side: exactly 12h00m00.000s of age is still
HEALTHY, and exactly 24h00m00.000s of age is still STALE, not MISSING; one millisecond past either
boundary crosses it. `lib/heartbeat.mjs` is a pure function of two explicit inputs — the last known
scheduled-success timestamp and the current instant — and every boundary is pinned by an exact
test in `tests/data-ops-a1-4-heartbeat.test.mjs`.

**A manual `workflow_dispatch` run never resets this clock.** The GitHub evidence reader records
each observed run's `event` (`schedule`, `workflow_dispatch` or `unknown`), and the durable
freshness fact the heartbeat reads — `SELECT MAX(run_completed_at) ... WHERE event_type='schedule'
AND health_state='SUCCESS'` — is filtered to `schedule` rows only. A manual acceptance dispatch is
still recorded as evidence (for its own historical value) but can never make a stale schedule look
healthy.

**The freshness fact is durable, not recomputed only from this cycle's GitHub read.** It is read
back from the watchdog's own D1 history every cycle, so a single cycle's GitHub read failure
degrades to "no new evidence this cycle," never to a false MISSING classification manufactured
from nothing — the previous cycle's stored success is still honoured. GitHub read failure is its
own, independent, separately-notified problem (`GITHUB_EVIDENCE`), never folded into or confused
with the heartbeat's own verdict.

## 4. Incident lifecycle

Two closed "problems" exist, each a fixed `(problemClass, component)` pair in
`lib/reason-codes.mjs`: `OBSERVER_HEARTBEAT` and `GITHUB_EVIDENCE`. Each resolves to a stable,
long-lived fingerprint (`lib/incident-fingerprint.mjs`) that depends on **only** that fixed pair —
never a reason code, run id, head SHA, timestamp or evidence hash — so the same underlying problem
never mints a new incident on every run, and a repository main-SHA change alone can never create
one either (the fingerprint never sees a SHA at all).

`lib/lifecycle-reducer.mjs` is a pure function from `(previous incident row or null, this cycle's
evaluation)` to one of:

- **NEW** — the fingerprint was not previously active.
- **ONGOING** — still active, same reason code: no material change, no notification.
- **CHANGED** — still active, a *different* reason code (e.g. STALE escalating to MISSING): a
  material change, notified.
- **RECOVERED** — was active, now is not.
- **REOPENED** — was RECOVERED, is active again; `firstSeenAt` is preserved across the reopen so the
  incident's whole history stays attributable to one continuous identity, while `reopenedCount`
  and `occurrenceCount` both increment.
- **NONE** — nothing worth persisting or notifying (a healthy cycle with no prior incident, an
  already-RECOVERED incident staying healthy, or evidence that is not newer than what is already
  stored).

**Replay/ordering safety lives in the reducer itself**, not bolted on afterwards: evidence whose
own observed-at instant is not strictly newer than the incident's stored
`lastEvidenceObservedAt` always returns `NONE` with the state unchanged — a retry of the exact same
cycle, a duplicate Cron delivery, or genuinely older evidence arriving late can never move state
backwards or manufacture a duplicate transition.

## 5. Persistence

One isolated D1 database, `teamsheet-data-steward-watchdog`, bound only inside this Worker as
`STEWARD_WATCHDOG_DB`. Its migration
(`workers/data-steward-watchdog/migrations/0001_watchdog_foundation.sql`) declares exactly three
tables — `watchdog_observations`, `watchdog_incidents`, `watchdog_notifications` — and nothing else.
It holds no Official FPL data, no application data and no production collection history, and
nothing outside `workers/data-steward-watchdog/persistence/` ever reads or writes it.

Every SQL statement the package can ever issue is a fixed string literal in
`persistence/statements.mjs`, bound with `?` placeholders only. `assertAllowedStatement()` checks
every statement against that frozen list by reference before `persistence/repository.mjs` ever
calls `db.prepare(...)`, so an unreviewed query cannot execute even if a future edit tried to add
one inline. There is no generic SQL surface, no table-name parameter and no column-name parameter
anywhere in the package.

**Idempotency is a database property, not an application-level lock.** `watchdog_observations` is
keyed by a deterministic hash of `(workflowRunId, healthState)`: the same evidence observed again
(a retry, a duplicate delivery, an unchanged run seen on a later cycle) writes the identical key and
is silently ignored by `ON CONFLICT DO NOTHING`; a genuine state change (e.g. in-flight becoming
success) has a different key and is recorded as a new fact rather than overwriting or losing the
earlier one. `watchdog_notifications` is keyed by a deterministic hash of
`(fingerprint, notificationTransition, evidenceObservedAt)`: a duplicate notification decision over
the same evidence reserves zero rows and sends nothing a second time.

## 6. Notification policy

The owner is notified on NEW, CHANGED, RECOVERED and REOPENED, always. ONGOING never notifies on
its own — no email for every unchanged observation — except that an unresolved incident earns
**at most one reminder every 24 hours** (`notification/decision.mjs`,
`REMINDER_CEILING_MS = 24h`). The decision is a pure function, entirely separate from the email
transport, and is fully testable without a Worker, a D1 binding or a `send_email` binding in scope.

A delivery failure (the binding's own `send()` rejecting) is recorded as `FAILED` and is **not**
retried inside the same cycle. It self-heals: because `markIncidentNotified` is only called on a
successful send, the incident's `lastNotifiedAt` stays at its prior value, so the very next cycle's
notification decision (now `ONGOING`, since the condition persists) treats a `null`/stale
`lastNotifiedAt` as due for a reminder and tries again — no bespoke retry logic is needed.

## 7. Email transport

`notification/transport.mjs` is the only module that ever touches a `send_email` binding, and it
never accepts a recipient from a caller. Cloudflare's own binding restriction —
`destination_address` in `wrangler.jsonc` — is the platform-level authority over who can ever
receive mail from this Worker; the transport passes `to` as `undefined` so Cloudflare substitutes
the one configured address, and there is no code path anywhere in the package that could name a
different one. That is what makes the binding structurally incapable of becoming a general mail
relay — a platform guarantee, not merely an application convention that a later change could
loosen.

**The tracked `wrangler.jsonc` does not contain the owner's real email address.** Its
`destination_address` is the literal placeholder `REPLACE_LOCALLY_BEFORE_DEPLOY@example.invalid`,
which Cloudflare will refuse as an unverified destination if deployment were ever attempted with it
unchanged. Before any live deployment, the owner must edit that one field locally to their real,
already-verified Email Routing destination address, and must **not** commit that edit — it is
config the repository must never carry. The sending address, `data-steward-watchdog@fpltsheet.co.uk`,
is a bot identity on the owner's already-public `fpltsheet.co.uk` domain, not a secret, and is a
plain repository constant (`notification/transport.mjs`, `NOTIFICATION_SENDER_ADDRESS`).

The message body is hand-built RFC 5322 text (`notification/message.mjs` +
`notification/transport.mjs`). This repository's toolchain is deliberately zero-dependency, so no
MIME-building package was introduced for one plain-text email. Content is built only from a closed
field set (`message.mjs`'s `CONTEXT_KEYS`) and runs through the shared `secretFinding()` check as
defence in depth; it explicitly states that no remediation was attempted.

## 8. Fail-closed reasoning

Closed, watchdog-owned reason codes (`lib/reason-codes.mjs`):

| Code | Meaning |
|---|---|
| `OBSERVER_HEARTBEAT_HEALTHY` | a scheduled success was seen within 12h |
| `OBSERVER_HEARTBEAT_STALE` | no scheduled success within 12h, but one within 24h |
| `OBSERVER_HEARTBEAT_MISSING` | no scheduled success within 24h, or ever |
| `OBSERVER_HEARTBEAT_INCOMPLETE` | the freshest relevant run is still in flight / unclassifiable |
| `OBSERVER_JOB_SKIPPED` | the observer's own job was skipped this run |
| `OBSERVER_JOB_FAILED` | the observer's own job failed, timed out or was cancelled this run |
| `OBSERVER_SUMMARY_INVALID` | GitHub reports the job succeeded, but its own sanitized summary line could not be decoded, so the run is not trusted as evidence of health |
| `GITHUB_EVIDENCE_UNAVAILABLE` | the bounded GitHub read this cycle could not be completed |
| `GITHUB_READ_BOUND_EXHAUSTED` | the fixed read budget for one cycle was spent before the read finished |

**`GITHUB_EVIDENCE_UNAVAILABLE` is reported, and only that — never `GITHUB_OUTAGE` or any claim
about GitHub's own state.** A watchdog that cannot reach GitHub has proven only that it cannot
currently observe, never that GitHub itself is failing, and this repository does not manufacture a
stronger claim than its evidence supports. A1.2/A1.3's existing sentinel reason codes remain
available as historical/comparative context and are not redefined.

## 9. Authority isolation

The watchdog **can**: issue bounded `GET`-only reads of one GitHub Actions workflow's own run/job
metadata and, for at most one run per cycle, its job log; read and write its own three D1 tables
through the fixed allowlisted statements above; send at most a small, bounded number of emails to
the one Cloudflare-configured recipient.

The watchdog **cannot** — and a permanent test (`tests/data-ops-a1-4-worker-config.test.mjs`)
scans every file in the package for the shapes that would let it: dispatch, re-run or cancel a
GitHub workflow; write to GitHub in any way (no `contents:write`, no `actions:write`, no PR/issue
endpoint); mutate any Cloudflare resource (no Worker Version upload, no secret, route, domain or
Cron Trigger endpoint); invoke or influence production collection; read or write production
Official FPL D1, the evidence archive D1, or any database but its own; call a football data
provider; send email to any recipient other than the one the binding is configured with; run
arbitrary SQL, an HTTP request to an arbitrary URL, or a shell command; merge or open a pull
request; or perform any autonomous repair. There is no `runShell`, `runSql`, `httpRequest`,
`apiCall` or `execute*` generic escape hatch anywhere in the package.

## 10. Retention

| Table | Policy | Enforcement |
|---|---|---|
| `watchdog_observations` | 45 days | `PRUNE_OBSERVATIONS`, exempting rows an ACTIVE incident's `lastEvidenceObservationId` still points to |
| `watchdog_incidents` | 365 days, **RECOVERED only** | `PRUNE_INCIDENTS`; an ACTIVE incident is never pruned by age |
| `watchdog_notifications` | 90 days | `PRUNE_NOTIFICATIONS` |
| Raw GitHub logs | never stored | only the closed, decoded summary shape is ever kept, never response bytes |

Pruning runs once at the end of every watchdog cycle (`persistence/repository.mjs`,
`pruneRetention`), over fixed cutoffs computed from the cycle's own clock, and is proven never to
delete an observation an open incident still depends on.

## 11. Cadence and live-provisioning boundary

`workers/data-steward-watchdog/wrangler.jsonc` declares exactly **one** Cloudflare Cron Trigger,
`"17 5,11,17,23 * * *"` — four fires a day, six hours apart, as one array entry rather than four,
to minimise additional account-level Cron Trigger usage (Teamsheet already holds three on the
production dispatcher, out of the Workers Free plan's five-per-account limit; this checkpoint adds
one more, leaving one spare). **Declaring this configuration in the repository arms nothing.**
Cloudflare Cron Triggers are only live once an attended deployment of this exact configuration has
happened, and this checkpoint performs no such deployment. The D1 database, the GitHub credential
and the email binding's real destination address likewise do not exist anywhere live as a result of
this PR.

## 12. What this checkpoint proves, and what it does not

**Proves (by test, in this repository):** the lifecycle reducer's NEW/ONGOING/CHANGED/RECOVERED/
REOPENED/NONE semantics over fixtures, exactly at its stated boundaries; the heartbeat classifier's
12h/24h boundaries, exactly; the GitHub evidence reader's bounded, GET-only, fail-closed decoding
over fixtures, including a bounded read-budget exhaustion path; the persistence layer's
idempotency, allowlisted-SQL-only surface, and retention boundaries against an in-memory fake D1
that faithfully implements this schema's real conflict/uniqueness semantics; the notification
decision's always/never/reminder-ceiling policy; the transport's inability to specify a recipient;
and, at the orchestrator level, the whole cycle wired together end to end — including
GitHub-unavailable resilience using durable D1 history, retry-safety at an identical instant, and
self-healing after a delivery failure — all against fakes, with no live Cloudflare or GitHub
request ever issued.

**Does not prove:** that the watchdog is deployed (it is not); that the isolated D1 database, the
GitHub credential or the email binding exist live (they do not); that a live Cron fire has ever
executed this code; that the fake D1 test harness is a substitute for D1's actual SQLite semantics
under concurrent access (D1's true concurrency behaviour under simultaneous overlapping cycles is
untested here and is a live-acceptance question, not a repository one); or that Cloudflare's
`send_email` binding behaves, under live conditions, exactly as its documentation describes.

## 13. The fundamental limitation this checkpoint does not remove

A Cloudflare-hosted watchdog is independent of GitHub Actions as a *process* — it does not share
GitHub's own outage modes — but it is not independent of the world. A simultaneous Cloudflare and
GitHub and network failure cannot be perfectly diagnosed by anything hosted on either provider.
When the watchdog cannot reach GitHub, that proves evidence is unavailable, never a root cause, and
never that GitHub itself is unavailable to anyone else. There remains no independent, third-party
heartbeat outside this repository's own infrastructure, and this checkpoint does not claim to have
built one.

## 14. Live closeout — one consolidated package for a later, separate owner gate

None of the following has been done. All of it is a later, explicit, combined owner decision,
listed here in the order it would need to happen:

1. Merge this PR after owner review; verify exact-`main` Verify success on the merged commit.
2. Create the isolated D1 database (`wrangler d1 create teamsheet-data-steward-watchdog`) and apply
   `workers/data-steward-watchdog/migrations/0001_watchdog_foundation.sql`.
3. Create a narrowly scoped, repository-only-readable GitHub fine-grained token (Metadata: Read,
   Actions: Read, no write permission of any kind) and bind it as the Worker secret
   `DATA_STEWARD_WATCHDOG_GITHUB_TOKEN`.
4. Confirm Email Routing is enabled for a domain the owner controls and at least one destination
   address is verified; locally edit (never commit) `wrangler.jsonc`'s `send_email[0].destination_address`
   to that verified address.
5. Deploy the exact reviewed `workers/data-steward-watchdog/` configuration (temporarily reconnecting
   a Git build integration and disconnecting it again immediately after, exactly as Package C did
   for the dispatcher, or via an attended local `wrangler deploy`).
6. Confirm the account's live Cron Trigger count leaves room for one more (Workers Free allows five
   per account; the dispatcher already holds three).
7. Perform one safe, attended functional acceptance: trigger the deployed Worker's `scheduled`
   handler through Wrangler's own local/remote test tooling against the real bindings, without
   fabricating a fake production incident, and confirm it reads, writes and (if a real problem is
   present) notifies correctly.
8. Observe the first two or three natural Cron fires and confirm persistence and, if applicable,
   notification behaviour, without deliberately harming production or the A1.3 observer to force a
   test incident.
9. Record final closeout documentation once live behaviour is observed.

## 15. Owner decision required next

Whether to approve this repository-side PR for merge. Everything in §14 remains separate, and
scheduled activation of the underlying A1.3 observer itself remains exactly as separately gated as
it already was — this checkpoint changes nothing about that gate.
