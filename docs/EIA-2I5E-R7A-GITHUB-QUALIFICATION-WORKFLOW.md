# EIA-2I5E-R7A — Secure GitHub Qualification Workflow Foundation

Date: 17 September 2026
Base: latest GitHub `main` at implementation (`6309dae3614aa06e7c021bfab0f138cac2437a2b`).
Candidate executed later, not copied onto `main`: PR #251 head `03cd231cd3e1d38821194a5d1aad87bc87232154` on `eia-2i5e-prelive-qualification`.
R7A-R1: secret-bearing workflow final hardening on the same draft PR #252. Still repository-only.

## Outcome

R7A adds a dormant, manual-only GitHub Actions workflow that can later run the exact reviewed PR #251 qualification candidate under a protected GitHub Environment. R7A-R1 hardens that workflow without authorizing a provider call. It is repository-only. It does not qualify response size, activate the collector, deploy anything, merge PR #251, or call API-Football.

R7A and R7A-R1:

- made **0** API-Football HTTP requests;
- accessed the environment secret **0** times;
- invoked `runAttendedApiFootballQualification()` **0** times;
- did not trigger the new workflow;
- did not approve the GitHub environment;
- did not merge this PR or modify PR #251;
- did not mutate GitHub branch-protection or ruleset configuration.

## R7A-R1 hardening

1. External actions are pinned to independently verified immutable full commit SHAs:
   - `actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09` (`v5`)
   - `actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444` (`v5`)
   - `actions/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f` (`v6`)
2. UI reruns are structurally blocked. Both jobs require `github.event_name == 'workflow_dispatch' && github.run_attempt == 1`. A GitHub "Re-run jobs" operation cannot reach environment approval, the secret, the runner or provider egress. A new provider attempt requires a new manual `workflow_dispatch` and a new protected-environment approval.
3. After environment admission, and again immediately before the secret-bearing step, the workflow re-resolves remote `refs/heads/main` and requires it still equal the original dispatch SHA. It also continues requiring remote `refs/heads/eia-2i5e-prelive-qualification` equal `03cd231cd3e1d38821194a5d1aad87bc87232154`.
4. The driver does not pass `globalThis.fetch` directly. An opaque `boundedFetch` wrapper refuses a 12th HTTP egress before calling `globalThis.fetch`. It does not inspect URLs, headers or the credential, and it adds no retry or alternate transport.
5. Dispatches are serialized with `concurrency.group: eia-2i5e-api-football-qualification` and `cancel-in-progress: false`. Serialization is not authorization of a second dispatch.
6. An active main-protection ruleset is a required **owner-configured** pre-dispatch precondition. R7A-R1 did not create or alter it. **This manual precondition is still outstanding.**

## Why this is a separate PR

The owner-configured environment `eia-api-football-qualification` is restricted to `main` only. PR #251 therefore cannot itself supply the trusted secret-bearing workflow without weakening that restriction. R7A does not weaken it. The workflow must exist on `main` before an attended dispatch can run, and that merge is a later explicit owner action.

## Trust architecture

```
GitHub Environment secret API_FOOTBALL_API_KEY
        ↓
protected GitHub Actions job `qualify` (run_attempt == 1 only)
        ↓
exact reviewed PR #251 candidate SHA
        ↓
runAttendedApiFootballQualification() once, via boundedFetch
        ↓
API-Football (at most 11 GET attempts, 0 retries; 12th egress impossible)
        ↓
sanitized JSON result + allowlisted job summary
```

Grok, Codex and any external caller must never be able to read, request, receive or print `API_FOOTBALL_API_KEY`. The secret lives only inside the protected job's single execution step after owner approval.

## Hard-coded candidate

The workflow accepts **no** `workflow_dispatch` inputs. It does not accept a SHA or branch. It hard-codes:

- `QUALIFICATION_CANDIDATE_SHA=03cd231cd3e1d38821194a5d1aad87bc87232154`
- `QUALIFICATION_BRANCH=eia-2i5e-prelive-qualification`
- `QUALIFICATION_PR=251`

If PR #251 moves away from that SHA, the workflow fails closed. It must not be silently retargeted.

## Two-job trust boundary

1. `repository-gate` — no environment, no secret, `contents: read` only, `run_attempt == 1` only. Proves `workflow_dispatch`, repository `priteshpatel390-del/FPL`, ref `refs/heads/main`, that the execution revision is current remote `main`, that the candidate SHA is a valid 40-character SHA, that remote `refs/heads/eia-2i5e-prelive-qualification` still resolves to the hard-coded SHA, and that the tree is clean. Failure stops with zero secret access and zero provider attempts.
2. `qualify` — `needs: repository-gate`, `contents: read` only, `run_attempt == 1` only, environment `eia-api-football-qualification`. After environment admission it refuses reruns, checks out the hard-coded SHA with `persist-credentials: false`, reconfirms `HEAD`, remote candidate branch **and** remote `main` versus the dispatch SHA, runs `node --test tests/eia2i5e-prelive-qualification.test.mjs`, asserts `API_FOOTBALL_MAX_RESPONSE_BYTES` remains `null`, reconfirms remote main and candidate immediately before any secret is introduced, then invokes the runner once through `boundedFetch`.

If the candidate branch or `main` moves between dispatch and the protected job, or during the environment-approval wait, the qualify job stops **before** the secret-bearing step.

## Secret scope

`API_FOOTBALL_API_KEY` is not declared at workflow or job level. It is exposed only to the single execution step:

```yaml
env:
  API_FOOTBALL_API_KEY: ${{ secrets.API_FOOTBALL_API_KEY }}
```

No preceding or later step receives it. The workflow does not echo it, fingerprint it, log its length, or test it with `curl`/`wget`/a health endpoint. GitHub automatic secret masking remains active.

## Authorized later provider budget

When the owner later dispatches this workflow from `main`:

- maximum API-Football HTTP attempts: **11**
- retries: **0**
- runner invocations: **1**
- timeout: the candidate's existing 15-second `AbortSignal.timeout`
- sleep: real one-second gaps from the candidate module
- request source: the module-owned canonical manifest only
- execution-bound transport ceiling: `boundedFetch` refuses the 12th `fetch` before network egress

The 11 logical requests remain:

`discovery-2`, `discovery-3`, `discovery-848`, `discovery-45`, `discovery-48`, `fixture-1636205`, `lineups-1636205`, `players-1636205`, `events-1636205`, `fixture-1635643`, `players-1635643`.

## Result handling

The workflow does not commit evidence, push to GitHub, or modify PR #251. It writes sanitized JSON to `$RUNNER_TEMP/eia-2i5e-qualification-result.json` and uploads artifact `eia-2i5e-qualification-result` with 7-day retention. The job summary is allowlisted (candidate SHA, invocation count, attempts, retries, stop reason, completion/skips, HTTP class, byte/row/pagination/identity/participant/quota fields, formal response-size decision, candidate ceiling, raw-body-retained=false, production constant remains null). It does not dump arbitrary JSON, headers, keyed URLs, raw bodies or the API key.

Workflow success means sanitized evidence was produced. It does **not** mean response-size qualification GO. A `NO-GO` result is recorded honestly and is not retried.

UI reruns are structurally blocked. A new provider attempt requires a new manual `workflow_dispatch` and a new protected-environment approval.

## Trusted computing base limitation

The secret-bearing job executes the exact reviewed PR #251 candidate code. That candidate therefore becomes part of the trusted computing base for the one qualification run. This is acceptable only because:

- the exact SHA is hard-coded;
- the SHA has already undergone independent review;
- the workflow refuses branch movement;
- no arbitrary SHA input exists;
- the environment requires manual owner approval;
- `boundedFetch` independently caps egress at 11.

This mechanism must not be generalized into arbitrary PR execution with secrets.

## Owner-configured environment preconditions

The following were configured by the owner in the GitHub UI and are **not** programmatically verified by R7A or R7A-R1:

- environment name `eia-api-football-qualification`;
- environment secret `API_FOOTBALL_API_KEY`;
- required reviewer protection, with Pritesh as reviewer;
- administrator bypass disabled;
- deployment branch restriction: `main` only.

Presence or value of the secret is proven only by a later attended workflow execution.

Operational preflight, not inferred and not configured by this change: if Pritesh will both initiate the workflow and approve the environment, GitHub's "Prevent self-review" option must **not** be enabled. If it is enabled, a second eligible reviewer is required instead.

## Owner-configured main-protection precondition — still outstanding

Independent owner review found that current `main` has no legacy branch protection and that the repository's current active branch ruleset targets `cloudflare-data-production` only, not `main`.

R7A-R1 **must not** and **did not** mutate GitHub branch or ruleset configuration.

Before PR #252 may become the trusted secret-bearing workflow on `main`, and before any qualification dispatch, the owner must configure and independently verify an active main-protection ruleset. Minimum intended owner-configured controls:

- target `refs/heads/main`;
- prevent branch deletion;
- prevent non-fast-forward / force-push;
- require changes to `main` to go through a pull request;
- require the repository's normal verification status check before merge where supported/practical;
- avoid routine bypass actors for the qualification window.

For a single-owner repository, requiring a PR is sufficient for this checkpoint without inventing an impossible second-human approval requirement.

**This manual precondition is still outstanding.** R7A-R1 does not claim main protection exists.

## What remains blocked

- collector, Cron, live D1, Worker secret, model and UI activation;
- changing `API_FOOTBALL_MAX_RESPONSE_BYTES` from `null`;
- merging PR #251;
- any API-Football HTTP request from this R7A / R7A-R1 change;
- qualification dispatch until this foundation is merged **and** the owner-configured main-protection ruleset is independently observed.

## Next owner action after merge

1. Configure and independently verify the main-protection ruleset above. Do not dispatch until that is observed.
2. Confirm exact-`main` Verify on the merge commit.
3. Do **not** treat merge as qualification GO.
4. A later, separate, explicit owner dispatch of `EIA-2I5E API-Football Qualification` from `main` is required to run the candidate. That dispatch is the environment-approval and provider-attempt boundary. Confirm Prevent-self-review will not deadlock a single-owner approval.

See also [SECURITY.md](SECURITY.md), [TESTING.md](TESTING.md) and PR #251.
