# DATA-S2B — manual production collection hardening and live resume reconciliation

Repository-only checkpoint. **No Cloudflare request, workflow dispatch, D1 read or mutation,
production reconciliation, resume, collection, migration, deployment, schedule, Cron or
credential change was performed while preparing it.** The live facts recorded below were read
back from the GitHub Actions API; they were produced by owner-dispatched runs that had already
completed before this work began.

## A. Live state established before this checkpoint

Both facts were verified independently from the GitHub Actions API rather than taken from a
report.

| Fact | Evidence |
|---|---|
| Read-only first-run reconciliation | Workflow `DATA-S2B First Production Run Reconciliation`, run `33792104384`, run number 2, attempt 1, event `workflow_dispatch`, head branch `main`, head SHA `d79dd37451e16b642ce96709b8635c3ac618c366`, conclusion `success`. |
| First production run resume | Workflow `DATA-S2 First Production Run Resume`, run `33815400284`, run number 1, attempt 1, event `workflow_dispatch`, head branch `main`, head SHA `d79dd37451e16b642ce96709b8635c3ac618c366`, conclusion `success`; both jobs — `repository-gate` and `first-run-resume` — succeeded. |

### What the reconciliation success proves

`run-first-run-reconciliation.mjs` exits zero only on `RESUME_RECONCILIATION_SAFE`; every other
classification, including `RESUME_RECONCILIATION_BLOCKED` and
`AMBIGUOUS_REQUIRES_OWNER_ATTENTION`, throws. A successful run therefore proves the SAFE
classification: governance was exact, the pinned run row was the exact untouched `started` row,
and the run owned zero observations, zero governed heads and zero rejections. The same runner
requires `rows_written === 0` and enforces the 1,000-row read guard, so the reconciliation
performed no D1 mutation and stayed inside that guard.

SAFE remained a precondition, never an authorisation; the resume that followed was a separate
owner-approved dispatch.

### What the resume success proves

`runProductionCollection` returns `ok:true` only after its synchronous postflight has validated
the exact completed run: status `completed`, the expected `records_seen` and `records_accepted`,
run-owned observations equal to `records_accepted`, zero quarantined and zero rejected counters,
no error class, governed heads equal to distinct logical keys, and zero orphan heads, invalid
heads, retained non-accepted observations, quarantined observations and rejection rows. Any
deviation throws `production_postflight_mismatch`, and the entry point rethrows after writing a
sanitized classification.

The `first-run-resume` job's final step completed successfully, so the runner exited zero.
**The originally unresolved first production collection run is therefore definitively completed**
and no longer requires reconciliation or a further resume.

### What is not recoverable

The exact provider `meta.rows_read` and `meta.rows_written` for the resume are written only to
the run's GitHub Step Summary, which is **not retrievable** through the GitHub API available
here. They are therefore **unavailable** and are stated nowhere in this repository.

Cloudflare dashboard aggregates observed by the owner immediately after the resume — roughly
134,000 rows read and roughly 5,000 rows written across 12 queries in the preceding hour, with
12.53 MB of storage — are account-level, time-window figures. They are **not per-workflow
accounting**, they are not attributable to the resume alone, and they must never be recorded as
exact resume usage. Only provider-returned `meta.rows_read` and `meta.rows_written` are workflow
accounting, and those remain independently enforced inside the runtime after every request.

## B. The defect this checkpoint fixes

The hardened migration-0003, live EXPLAIN, first-run reconciliation and first-run resume
workflows share one trust boundary. The normal manual collection workflow did not. Before this
checkpoint `.github/workflows/data-s2-production-collection.yml` was manual-only but:

- took no immutable `approved_sha`;
- checked out the floating ref `main`, so the code that ran was whatever `main` pointed at when
  the job started, not a reviewed revision;
- had no credential-free repository gate — the single job requested the protected environment
  and its Cloudflare credentials directly;
- proved no canonical repository, ref or event before protected access;
- required no exact-head `Tests and deterministic build` success;
- re-resolved no remote `main` after protected-environment admission, so `main` could advance
  during an arbitrarily long approval wait and the run would proceed regardless;
- fixed the collection identity in an earlier, separate step whose value reached the runner
  through `GITHUB_ENV`, so production identity was established before the final identity checks.

## C. The hardened manual collection gate

The workflow remains **manual-only**. There is no `schedule:` trigger, and the dormant repository
constant `FUTURE_PRODUCTION_COLLECTION_SCHEDULE = '17 1 * * *'` stays unwired.

### One immutable approved SHA

`workflow_dispatch` now requires exactly one input, `approved_sha`: a required lowercase
40-character Git SHA representing the exact current `main`. It is never used as an execution
input — only as a value compared against `git rev-parse HEAD`, the freshly resolved remote
`main`, and the head SHA of the required Verify check run. No database identity, SQL, season,
endpoint, timestamp or other production semantic input exists.

### Credential-free repository gate

A separate `repository-gate` job, with no protected environment, no Cloudflare secret, no
account fingerprint variable and no D1 access, must pass before the collection job exists. It
proves, fail-closed:

1. the event is `workflow_dispatch`;
2. the repository is exactly `priteshpatel390-del/FPL`;
3. the ref is exactly `refs/heads/main`;
4. `approved_sha` matches `^[0-9a-f]{40}$`;
5. the checkout is exactly `approved_sha`;
6. `HEAD` equals `approved_sha`;
7. the working tree is clean;
8. a freshly resolved remote `main` equals `approved_sha`;
9. a `Tests and deterministic build` check run exists on that exact head and is completed,
   successful, produced by `github-actions`, and linked to a GitHub Actions run in this
   repository.

This mirrors the hardened resume, reconciliation, migration-0003 and EXPLAIN gates rather than
inventing a weaker parallel design.

### Protected production job

Only after the gate passes does the `collect` job request the existing
`data-s2-production-collection` GitHub Environment and its existing credentials. No credential
was created, renamed, rotated or widened. The job checks out the gated approved SHA and carries
it as `APPROVED_SHA`.

### Second remote-main check immediately before production

Protected-environment admission can wait indefinitely, so the final step re-establishes
everything in one shell, immediately before the production entry point and before any Cloudflare
request: exact Node `24.19.0`, `HEAD` equals the approved SHA, a clean tree, Wrangler removed
from the runner, then remote `main` resolved again **from the remote** — never from a value
carried out of the gate job — and required to equal the approved SHA. The runner invocation is
the next and last line, so no later step can introduce a race.

Permanent tests execute that exact shell against stubbed `git` and `node` binaries and prove that
a moved remote `main`, an empty remote-main resolution, a wrong `HEAD` and a dirty tree each fail
the step and leave the production runner uninvoked.

### Collection identity

The one attempt's `COLLECTION_SCHEDULED_AT` — the unchanged minute-precision UTC semantic — is
now derived once, inside that same final protected step, after every repository identity check.
It no longer travels through `GITHUB_ENV` from an earlier stage, and the workflow contains no
`GITHUB_ENV` write at all. It is derived from the local clock immediately **before** the
remote-main recheck, so that recheck remains the last thing to happen before the runner.

The source revision, season, endpoint list, canonical normalisation, observation identity, diff
semantics, run-id derivation, write semantics and postflight semantics are unchanged.

### No workflow re-run

`run-production-collection.mjs` still refuses `GITHUB_RUN_ATTEMPT !== '1'` with
`workflow_retry_forbidden`, before any identity resolution or request. A failed or unknown
production operation can never be retried by pressing GitHub's Re-run button. A fresh collection
requires a new owner-approved dispatch, which fixes a new collection identity.

The entry point now also writes the sanitized `productionFailureClassification` to the workflow
summary before rethrowing, exactly as the resume entry point does. Reporting only the throw would
leave an unknown-mutation run indistinguishable from a no-write — precisely the state the first
production run had to be reconciled out of. The unknown-mutation reconciliation logic itself is
unchanged.

### Production identifier logging

The PR #215 remediation is preserved and extended to this workflow. The account id and D1 token
remain secrets; the production D1 id comes from the reviewed repository constant and appears in
no workflow environment; the account fingerprint is never workflow-level or job-level
environment; the credentialled job's first step registers the fingerprint mask, derived from the
already-masked account credential, before any step materialises the variable; and the fingerprint
appears only in the final production execution step. Runtime masking remains as defence in depth.

The live resume job log confirms the remediation works in production: its final step's resolved
environment printed `CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT: ***`.

## D. Resource and mutation safety — unchanged

No ceiling was raised or weakened. Expected D1 reads per cycle stay 100,000; the hard read
ceiling stays 125,000; the hard write ceiling stays 40,000; the API-call ceiling stays 8; the
Official FPL response limit stays 8 MiB; D1 request-size enforcement, the pre-commit write
estimator, the whole-cycle read gate and independently enforced provider accounting all stand.
There is still no blind mutation retry, an unknown mutation outcome still gets exactly one
bounded reconciliation, postflight stays synchronous, and malformed provider accounting and
partial or inconsistent state still fail closed.

## E. Scheduling stays off

No `schedule:` trigger was added, no recurring GitHub collection was enabled, no Cloudflare Cron
was restored or deployed, and `workers/data-platform/wrangler.jsonc` is untouched — its
historical `"crons": ["*/30 * * * *"]` declaration remains repository configuration that must not
be used to restore live Cron. No Worker was deployed and no route, domain or Access policy
changed.

**Superseded on 4 September 2026 for GitHub scheduling only.** Recurring collection is now
scheduled by a separate GitHub Actions workflow at `17 1 * * *`, and the constant referenced in
section C is now the wired `PRODUCTION_COLLECTION_SCHEDULE`. This workflow itself is unchanged and
stays manual-only. **Cloudflare Cron remains superseded and absent**, and the `wrangler.jsonc`
declaration must still never be used to restore it. See
[daily GitHub Actions schedule](DATA-S2B-GITHUB-ACTIONS-DAILY-SCHEDULE.md).

## F. Evidence

- Complete suite: **1,540 tests, 1,540 passed, 0 failed, 0 skipped, 0 cancelled**, against a
  pristine-`main` baseline of 1,531 passed / 0 failed measured in the same environment. The nine
  added tests are the manual-collection trust-boundary regressions.
- Two clean production builds produced byte-identical `dist/app.bundle.js`, `dist/index.html`,
  `dist/manifest.json` and root `index.html`, and root/deployable equality holds.
- No build input changed, so the committed deployable retains its exact recorded source
  provenance and was deliberately not regenerated.

## G. Next gate

This checkpoint prepares a safe **manual** normal collection and nothing more. After owner
approval, merge and an exact-`main` Verify Teamsheet success, the next live gate is exactly
**one** separately approved manual production collection dispatch. Recurring scheduling remains a
later, separate owner approval and is not authorised here.

**Closed on 4 September 2026.** That single manual collection ran and succeeded as run
`33818972728` on head SHA `319dfddd8ac83ae5ab7d20bfb684d3760bf64fbf`, attempt 1, with both jobs
successful. Recurring scheduling was then separately approved and implemented; see
[daily GitHub Actions schedule](DATA-S2B-GITHUB-ACTIONS-DAILY-SCHEDULE.md).
