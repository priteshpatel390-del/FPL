# DATA-S2B — manual read-only scheduled-environment credential preflight

Repository-only checkpoint. **No Cloudflare request, workflow dispatch, D1 read, D1 SQL, D1
mutation, collection, resume, reconciliation, migration, deployment, Worker action, Cron change,
schedule change, GitHub environment change or credential change was performed while preparing
it.** Nothing here has been executed, and executing it requires separate owner approval.

## A. What this is, and what it is not

It answers one question: does the GitHub environment `data-s2-production-scheduled` hold
credentials that are internally consistent and can reach the reviewed production D1 database?

It is a diagnostic. It is **not** a production scheduler, it performs **no collection**, it
executes **no SQL**, it never reaches the D1 `/query` endpoint and it makes no Cloudflare mutation
of any kind. It creates no schedule, changes no cron, and touches neither
`.github/workflows/data-s2-production-scheduled.yml` nor
`.github/workflows/data-s2-production-collection.yml`.

### It deliberately says nothing about GitHub cron

The Stage D record documents that the first temporary acceptance window produced zero schedule
runs and that the non-fire has no proven root cause. **This preflight does not investigate,
explain, work around or alter GitHub's schedule-event creation.** Environment credentials are
strictly downstream of event creation: no run object exists until GitHub creates one, and nothing
inside a run can prove anything about whether the scheduler armed. **A pass here does not prove
that GitHub will create a scheduled event**: it would prove the credential contract and nothing
about cron, and a firing cron would prove nothing about these credentials. The two questions are
separate and are kept separate.

## B. The three checks

| # | Check | Method | Passes only when |
|---|---|---|---|
| 1 | `account_fingerprint` | Local. `SHA-256(CLOUDFLARE_ACCOUNT_ID)` compared byte-for-byte with `CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT` | The environment's account credential and its account fingerprint are the same account |
| 2 | `api_token_active` | Cloudflare's official read-only token verification, `GET https://api.cloudflare.com/client/v4/user/tokens/verify` | `success` is `true` and `result.status` is exactly `active` |
| 3 | `production_d1_access` | Cloudflare's read-only D1 database detail read, `GET .../accounts/{account_id}/d1/database/{database_id}` (`D1:Read`, executes no SQL) | `success` is `true` and every database identity the response carries equals the reviewed repository constant |

Both endpoints were verified against current first-party Cloudflare documentation during
implementation.

Check 1 runs first and is entirely local, so a mismatched environment stops before any credential
leaves the runner. Check 3's database is never a caller or environment value: it is
`PRODUCTION_D1_ID` from `workers/data-platform/production-collection.mjs`, and any other value is
rejected as `preflight_d1_identity_mismatch`. `CLOUDFLARE_PRODUCTION_D1_ID` is deliberately not
introduced as a required environment variable and appears in no workflow.

The fingerprint derivation is imported from the existing `production-identity.mjs`
(`derivedAccountFingerprint`) rather than restated, so no competing definition of the canonical
formula can appear.

### Fail-closed classifications

There is no retry, no fallback and no repair. Every failure is one of a closed set of stable
sanitized classes:

| Condition | Class |
|---|---|
| Malformed account id or fingerprint | `preflight_account_id_invalid` / `preflight_account_fingerprint_invalid` |
| Fingerprint is for another account | `preflight_account_fingerprint_mismatch` |
| 401 / 403 | `preflight_token_verify_unauthorized` / `preflight_d1_metadata_unauthorized` |
| 404 | `..._not_found` |
| 429 | `..._rate_limited` |
| Any other non-2xx, or a non-integer status | `..._http_failed` |
| Transport loss, timeout, refused connection, redirect | `..._transport_failed` |
| Unparseable body, or a body that is not the documented shape | `..._contract_invalid` |
| Token present but not `active` | `preflight_token_not_active` |
| Returned database identity is not the repository constant | `preflight_d1_identity_mismatch` |
| Anything that is not one of this module's own errors | `preflight_unexpected_error` |

## C. Security design

Everything this diagnostic handles is an identifier or a credential, so nothing it emits is
derived from one.

- **Masking before materialisation.** The credentialled job's **first** step derives
  `SHA-256(CLOUDFLARE_ACCOUNT_ID)` from the already-masked account secret and registers it as an
  Actions mask, before any later step materialises
  `CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT`. GitHub echoes each step's resolved environment in
  that step's log header and only auto-masks `secrets.*`, so this preserves the PR #215
  remediation exactly. `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_D1_TOKEN` stay secrets; the
  fingerprint stays a `vars.*` value declared only on the final step; the D1 id is a repository
  constant and is in no workflow or environment value at all.
- **Runtime masking as defence in depth.** The entry point calls `maskProductionIdentity` before
  either request, registering masks for token, account id and database id.
- **No output path.** The preflight module reads no `process.env`, writes no file, and has no
  `console`, stdout, artifact, cache, `GITHUB_ENV` or `GITHUB_OUTPUT` surface. The entry point
  writes exactly one sanitized payload — a PASS/FAIL label plus the closed-set check names — to
  the workflow summary.
- **No raw error escapes.** Transport, HTTP, authorization and decoding failures are converted to
  stable classes inside the module. On failure the entry point discards the original error object
  and rethrows a fresh `Error` carrying only the sanitized class, because an arbitrary runtime
  message (a `fetch` `TypeError`, for example) can contain the request URL and therefore the
  account and database identifiers.
- **No response body is read out.** Only `result.status`, and the database identity fields, are
  inspected; neither is emitted.
- **No verbose transport.** No `curl`, no `-v`, no `set -x`; every shell step is
  `set -euo pipefail` only.

Permanent tests hold each of these, including that the reported failure payload never contains
the account id, the database id, a bearer prefix or the API host.

## D. Workflow shape

`.github/workflows/data-s2-scheduled-environment-preflight.yml`:

- `workflow_dispatch` only, with **zero inputs** — no SHA, database, endpoint, statement or
  identity a caller could supply;
- no `schedule`, `push`, `pull_request`, `pull_request_target`, `repository_dispatch`,
  `workflow_call` or `workflow_run` trigger;
- `permissions: contents: read` and nothing else; no GitHub token is used at all;
- `environment: name: data-s2-production-scheduled` — the exact environment under test;
- its own concurrency group, `data-s2-scheduled-environment-preflight`, so a read-only diagnostic
  never queues behind or appears to serialize with real production work;
- exact Node `24.19.0`, a clean-tree check, and exact repository and `refs/heads/main` checks;
- one invocation, `node workers/data-platform/scheduled/run-scheduled-environment-preflight.mjs`.

It requests the same environment the daily scheduled collection uses; no credential is created,
renamed, rotated, copied or widened, and no environment is created or configured by this
repository.

### Environment creation risk

The Stage D risk is unchanged and applies here too: GitHub creates a referenced environment
implicitly and unprotected on first use. This workflow is read-only, so an implicitly created
empty environment would simply fail closed at the first step — but that is a fallback, not a
control. **Do not dispatch this preflight until the owner has confirmed
`data-s2-production-scheduled` exists as described in the Stage D record's section H.**

## E. What a successful future dispatch would, and would not, prove

Would prove:

- the environment supplies `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_TOKEN` and
  `CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT`;
- the account credential and the account fingerprint describe the same account;
- the API token is valid and active at that moment;
- those credentials authenticate to Cloudflare and the account can read the exact reviewed
  production D1 database.

Would **not** prove:

- that GitHub will create a scheduled event, or why the earlier windows produced none;
- that a collection would succeed, or anything about Official FPL, D1 write authority, resource
  ceilings, postflight or data state;
- that the token's scope is sufficient for a `/query` request, which this never issues;
- the environment's protection rules, which no repository mechanism can prove;
- anything durable — a token can be rotated or revoked after the check.

## F. Not changed

No collector, entry point, gate, cron, environment, credential, ceiling, schema, migration,
provider, model, recommendation or application behaviour changes.
`workers/data-platform/run-production-collection.mjs` and
`workers/data-platform/production-collection.mjs` are untouched, and permanent tests pin the
scheduled cron — temporarily `17 14 * * *` for the third 4 September 2026 acceptance window — and
the manual workflow's shape against this checkpoint.

## G. Next gate

Owner review and merge, then exact-`main` Verify Teamsheet. **Dispatching this preflight is a
separate owner approval**, and is conditional on the Stage D section H environment confirmation.
It authorises no collection, no schedule change, no cron restoration and no D1 SQL.
