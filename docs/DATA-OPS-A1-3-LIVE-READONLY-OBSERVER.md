# DATA-OPS A1.3 — Dormant live read-only observer runtime

Status: **REPOSITORY-READY; THIRD LIVE OBSERVATION ATTEMPTED, IDENTITY ADMISSION SUCCEEDED, `/schedules` READ FAILED CLOSED; NOT LIVE-ACCEPTED**
Source main: `465e54260005c96591bd77be0a1fe1cb44547631` (merge of PR #234, A1.3 Cloudflare fixed-read diagnostic remediation)

## First live observation attempt — 8 September 2026

The owner performed the first attended dispatch of `Data Steward Read-Only Observer`: run
`34269989975`, run number 1, event `workflow_dispatch`, branch `main`, head SHA
`2f8a4850f911779d2ec48db2f835d0f6af5a45c5`. **This is not a live acceptance.** No collection,
repair, D1 write, schedule activation or Cloudflare mutation occurred.

Sanitized result: `verdict: UNHEALTHY`, `evaluationReason: SENTINEL_EVIDENCE_UNAVAILABLE`,
`heartbeat: INCOMPLETE`, `escalationRequired: true`.

| Sentinel | State | Reason | Detail |
|---|---|---|---|
| GitHub | OBSERVED | `GITHUB_CHAIN_OBSERVED` | — |
| D1 | OBSERVED | `D1_STATE_OBSERVED` | `rowsRead: 88580` |
| Cloudflare | OBSERVATION_FAILED | `CLOUDFLARE_IDENTITY_MISMATCH` | fail-closed before any Cloudflare request |

**Root cause.** `assertProductionAccount()` in
`workers/data-steward/sentinels/cloudflare-sentinel.mjs` requires the supplied account fingerprint
to match exactly `^[0-9a-f]{64}$` — 64 lowercase hexadecimal characters, with **no prefix of any
kind** — and then compares it against `derivedAccountFingerprint(accountId)`. The live
`DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT` value was provisioned as `sha256:<64 lowercase hex>`,
a shape the pattern rejects outright, so identity admission failed before any Cloudflare read was
attempted. **The runtime contract was correct; provisioning instructions were not explicit enough.**
No full live account id or fingerprint value — the live production fingerprint begins with
`dbc3bff…` — is recorded in this repository, its tests, its fixtures or this document.

**Second live finding — identifier logging.** GitHub Actions echoes each step's resolved
environment, including `vars.*` values, in that step's own log header. Because
`DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT` was declared at job level, its value appeared in the
resolved-environment header of every step in the job — before any Cloudflare credential was ever
exposed. The fingerprint is not an authentication credential, but this violated A1.3's own
identifier-sanitisation boundary. See "Masking remediation" below.

## Second live observation attempt — 8 September 2026

The owner performed a second attended dispatch of `Data Steward Read-Only Observer`, after the
masking remediation above merged as PR #233: run `34277208819`, run number 2, event
`workflow_dispatch`, branch `main`, head SHA `d9599c4aa557ce0727c4f8b6ddd24a4778b21497`. **This is
not a live acceptance.** No collection, repair, D1 write, schedule activation or Cloudflare
mutation occurred.

**FACT: the masking remediation worked live.** The job log proved the first masking step
succeeded, the account id was masked, the fingerprint was masked before materialisation, and the
final observer step's resolved environment displayed every protected value as `***`.

Sanitized result: `verdict: UNHEALTHY`, `evaluationReason: SENTINEL_EVIDENCE_UNAVAILABLE`,
`heartbeat: INCOMPLETE`, `escalationRequired: true`.

| Sentinel | State | Reason | Detail |
|---|---|---|---|
| GitHub | OBSERVED | `GITHUB_CHAIN_OBSERVED` | — |
| D1 | OBSERVED | `D1_STATE_OBSERVED` | `rowsRead: 88580` |
| Cloudflare | OBSERVATION_FAILED | `CLOUDFLARE_READ_FAILED` | reached the read phase; stage unidentified |

**FACT: Cloudflare identity admission now succeeds.** The previous `CLOUDFLARE_IDENTITY_MISMATCH`
is gone. **FACT: the failure now occurs during one of the three already-approved fixed `GET`
reads** — `/schedules`, `/deployments` or `/settings` — under
`workers/data-steward/sentinels/cloudflare-sentinel.mjs`.

**Existing ambiguity.** `readCloudflareConfiguration()` collapsed a transport error, a non-200
response, a malformed envelope or an invalid decoded result from *any* of those three sequential
reads into the single `CLOUDFLARE_READ_FAILED` code, so this live evidence alone cannot say which
stage failed. See "Cloudflare fixed-read diagnostic remediation" below.

**Do not claim.** This evidence does not prove the Cloudflare token permission is wrong, that
production Cloudflare configuration is wrong, that the Cron configuration is wrong, or that any
decoder is wrong. It proves only that the read phase was reached and one of its three stages
failed.

## Cloudflare fixed-read diagnostic remediation

This checkpoint replaces the single collapsed `CLOUDFLARE_READ_FAILED` code with three closed,
stage-named reason codes so a future live run can say which fixed read failed, without widening
any permission, endpoint, response shape or logging surface:

* `CLOUDFLARE_SCHEDULES_READ_FAILED` — the `GET .../schedules` read failed (transport error,
  non-200 status, malformed envelope or an invalid decoded result).
* `CLOUDFLARE_DEPLOYMENTS_READ_FAILED` — schedules succeeded but `GET .../deployments` failed.
* `CLOUDFLARE_SETTINGS_READ_FAILED` — schedules and deployments succeeded but
  `GET .../settings` failed.

Each code names only the failed stage. None of them carries, and none of the surrounding code
retains, an HTTP status, a Cloudflare provider error code or message, a request URL, a response
body, a header, the account id, the token or the fingerprint — the same sanitisation boundary the
sentinel already enforced is preserved exactly, just made precise per stage.

**Fail-closed read order is unchanged and is itself diagnostic.** The three reads still run
strictly in sequence and stop at the first failure: a schedules failure issues exactly one
Cloudflare request and returns `CLOUDFLARE_SCHEDULES_READ_FAILED`; a deployments failure issues
exactly two and returns `CLOUDFLARE_DEPLOYMENTS_READ_FAILED`; a settings failure issues exactly
three and returns `CLOUDFLARE_SETTINGS_READ_FAILED`. A fully successful cycle still issues exactly
three `GET` requests against the three fixed paths and produces byte/field-identical successful
observation output to before. `CLOUDFLARE_IDENTITY_MISMATCH` remains earlier and stronger, and
still issues zero Cloudflare requests.

**What is deliberately unchanged.** `decodeEnvelope`, `decodeSchedules`, `decodeDeployments` and
`decodeSettings` are byte-identical — this remediation does not guess at or correct the response
contract those decoders enforce. The Cloudflare credential contract remains exactly **Workers
Scripts: Read** plus **D1: Read**; no token was recreated, rotated or widened, and no fourth read,
endpoint or arbitrary path/method was added. `CLOUDFLARE_SENTINEL_MAX_READS` stays exactly `3`. No
Cloudflare or D1 mutation, no Cron change, no schedule activation and no Workflow B/C or
opportunity-guard change occurred.

## Third live observation attempt — 9 September 2026

The owner performed a third attended dispatch of `Data Steward Read-Only Observer`, after the
fixed-read diagnostic remediation above merged as PR #234: run `34311398342`, run number 3, event
`workflow_dispatch`, branch `main`, head SHA `465e54260005c96591bd77be0a1fe1cb44547631`. **This is
not a live acceptance.** No collection, repair, D1 write, schedule activation or Cloudflare
mutation occurred.

| Sentinel | State | Reason | Detail |
|---|---|---|---|
| GitHub | OBSERVED | `GITHUB_CHAIN_OBSERVED` | — |
| D1 | OBSERVED | `D1_STATE_OBSERVED` | `rowsRead: 89066` |
| Cloudflare | OBSERVATION_FAILED | `CLOUDFLARE_SCHEDULES_READ_FAILED` | fails at the first fixed read |

**FACT: identity admission continues to succeed.** **FACT: the failure narrows specifically to the
first fixed read, `GET .../schedules`.** Because reads are sequential and fail closed,
`/deployments` and `/settings` were not attempted in this observation. Protected runtime values
remained masked throughout, per the PR #233 remediation still holding live.

**Downstream evidence, recorded but not upgraded into proof.** Production Workflow B runs appeared
at approximately the three expected 01:17, 02:17 and 03:17 UTC opportunities on 9 September. That
is evidence the dispatch chain is operating; it is **not** independent proof that the Cloudflare
Cron configuration or the `/schedules` API response itself is correct, and it is not treated as
such here.

**Existing ambiguity.** `CLOUDFLARE_SCHEDULES_READ_FAILED` itself collapsed a transport error, an
authorization refusal, a missing-resource response, any other non-200 status and a
successful-but-unusable response into one code, so this live evidence alone cannot say which of
those broad categories applied. See "Schedules-read failure classification" below.

**Do not claim.** This evidence does not prove the token permission is wrong, that the Worker is
missing, that the response decoder is wrong, that the Cron configuration is wrong, or that A1.3 is
live accepted. It proves only that `/schedules` failed and identity admission did not.

## Fourth live observation attempt — 9 September 2026

The owner performed a fourth attended dispatch of `Data Steward Read-Only Observer`, after the
schedules-classification remediation above merged as PR #235: run `34319945520`, run number 4,
event `workflow_dispatch`, branch `main`, head SHA `90d7851d0084f45577c330e9fa7f1c15432f80c0`.
**This is not a live acceptance.** No collection, repair, D1 write, schedule activation or
Cloudflare mutation occurred.

| Sentinel | State | Reason | Detail |
|---|---|---|---|
| GitHub | OBSERVED | `GITHUB_CHAIN_OBSERVED` | — |
| D1 | OBSERVED | `D1_STATE_OBSERVED` | `rowsRead: 89066` |
| Cloudflare | OBSERVATION_FAILED | `CLOUDFLARE_SCHEDULES_RESPONSE_INVALID` | HTTP 200 reached; response unusable |

**FACT: identity admission continues to succeed, and the request now reaches HTTP 200.** The
result did not classify as `CLOUDFLARE_SCHEDULES_AUTH_REFUSED`, `CLOUDFLARE_SCHEDULES_NOT_FOUND`,
`CLOUDFLARE_SCHEDULES_HTTP_FAILED` or `CLOUDFLARE_SCHEDULES_TRANSPORT_FAILED` — it reached response
processing after a successful HTTP 200. That rules out the four other broad `/schedules`
categories for this run and places the failure somewhere inside HTTP-200 response processing.
Protected runtime values remained masked throughout, per the PR #233 remediation still holding
live.

**Existing ambiguity.** `CLOUDFLARE_SCHEDULES_RESPONSE_INVALID` itself collapsed three distinct
response-processing layers into one code, so this live evidence alone cannot say whether the HTTP
body failed to parse as JSON, a parsed body failed to decode as a valid Cloudflare envelope, or a
valid envelope carried a result the existing schedules decoder rejects. See "Response-layer
diagnostic split" below.

**Do not claim.** This evidence does not prove JSON parsing is the cause, the envelope shape is the
cause, `decodeSchedules` is the cause, Cloudflare's documentation is wrong, the repository's
decoder is wrong, or that A1.3 is live accepted. It proves only that the response reached HTTP-200
processing and that processing then failed to produce a usable schedules payload.

## Schedules-read failure classification

This checkpoint replaces the single collapsed `CLOUDFLARE_SCHEDULES_READ_FAILED` code with five
closed categories, for `/schedules` only, so a future live run can say which broad category of
failure applied without widening any permission, endpoint, response shape or logging surface:

* `CLOUDFLARE_SCHEDULES_AUTH_REFUSED` — HTTP 401 or 403 only.
* `CLOUDFLARE_SCHEDULES_NOT_FOUND` — HTTP 404 only.
* `CLOUDFLARE_SCHEDULES_HTTP_FAILED` — any other non-200 HTTP response.
* `CLOUDFLARE_SCHEDULES_RESPONSE_INVALID` — HTTP 200 but the JSON cannot be parsed, the Cloudflare
  envelope is invalid, or the existing `decodeSchedules()` rejects the decoded result.
* `CLOUDFLARE_SCHEDULES_TRANSPORT_FAILED` — the fetch throws, times out, or otherwise fails before
  any HTTP response exists.

The sentinel reads `response.status` internally, once, purely to select one of these five enums.
The status itself, any Cloudflare provider error code or message, the response body, the request
URL, headers, the account id, the fingerprint and the token never leave the sentinel — the same
sanitisation boundary already in force, made precise per category rather than widened.
`/deployments` and `/settings` are **unchanged** and keep their single collapsed codes
(`CLOUDFLARE_DEPLOYMENTS_READ_FAILED`, `CLOUDFLARE_SETTINGS_READ_FAILED`); this checkpoint does not
add equivalent sub-classification for those two stages.

**Fail-closed read order and count are unchanged.** Exactly one Cloudflare request is issued for
this classification, matching the previous collapsed behaviour exactly; a schedules failure of any
of the five categories still stops the sequence before `/deployments` or `/settings` is attempted.
A fully successful cycle is byte/field-identical to before: three `GET` requests, the same decoders,
the same Cron-set comparison. `CLOUDFLARE_IDENTITY_MISMATCH` remains earlier and stronger, issuing
zero Cloudflare requests. `CLOUDFLARE_SENTINEL_MAX_READS` stays exactly `3`.

**What is deliberately unchanged.** `decodeEnvelope`, `decodeSchedules`, `decodeDeployments` and
`decodeSettings` are byte-identical — this remediation does not guess at or correct the response
contract those decoders enforce, and does not widen the accepted Cron expression format. The
Cloudflare credential contract remains exactly **Workers Scripts: Read** plus **D1: Read**; no
token was recreated, rotated or widened. The `/schedules`, `/deployments` and `/settings` paths,
the `GET`-only method, the request timeout and the observer workflow YAML are all unchanged.

## Response-layer diagnostic split

The fourth live observation above proved `CLOUDFLARE_SCHEDULES_RESPONSE_INVALID` itself still
collapsed three distinct HTTP-200 response-processing layers into one code. This checkpoint
replaces it with three closed categories, for the response-processing branch of `/schedules` only:

* `CLOUDFLARE_SCHEDULES_JSON_INVALID` — HTTP 200, but `response.json()` throws or otherwise fails
  to produce parsed JSON.
* `CLOUDFLARE_SCHEDULES_ENVELOPE_INVALID` — HTTP 200, the body parses as JSON, but the existing
  `decodeEnvelope()` returns `null`.
* `CLOUDFLARE_SCHEDULES_PAYLOAD_INVALID` — HTTP 200, the body parses as JSON, `decodeEnvelope()`
  succeeds, but the existing `decodeSchedules()` returns `null`.

Which step first produced an unusable result is read internally, once, purely to select one of
these three enums. The parsed or raw response body, its top-level object keys, its `result` keys,
any schedules entries, any Cron expression from a failing response, the Cloudflare provider's own
error code or message, the HTTP status, the request URL, headers, the account id, the fingerprint,
the token, any caught exception text, stack trace or JSON-parse-error detail never leave the
sentinel — the same sanitisation boundary already in force, made precise per layer rather than
widened. `CLOUDFLARE_SCHEDULES_AUTH_REFUSED`, `CLOUDFLARE_SCHEDULES_NOT_FOUND`,
`CLOUDFLARE_SCHEDULES_HTTP_FAILED` and `CLOUDFLARE_SCHEDULES_TRANSPORT_FAILED` are **unchanged**.
`/deployments` and `/settings` are **unchanged** and keep their single collapsed codes; this
checkpoint does not add equivalent sub-classification for those two stages. The old
`CLOUDFLARE_SCHEDULES_RESPONSE_INVALID` code is removed: no live evidence, documentation reference
or compatibility requirement was found for keeping it once the runtime no longer emits it.

**Fail-closed read order and count are unchanged.** Exactly one Cloudflare request is issued for
this classification, matching the previous collapsed behaviour exactly; a schedules failure of any
of the three response-processing categories still stops the sequence before `/deployments` or
`/settings` is attempted. A fully successful cycle is byte/field-identical to before: three `GET`
requests, the same decoders, the same Cron-set comparison. `CLOUDFLARE_SENTINEL_MAX_READS` stays
exactly `3`.

**What is deliberately unchanged.** `decodeEnvelope()` and `decodeSchedules()` are not modified in
any way — no new accepted shape, no coercion, no normalisation of an otherwise-rejected response,
no special case for any live production output. They are invoked exactly as the generic `read()`
helper already invokes them for `/deployments` and `/settings`; only the failure of each of the two
calls now carries its own reason code instead of both being folded into one. The Cloudflare
credential contract, the fixed Worker name, the `GET`-only method, the three fixed paths, the
`redirect:'error'` option, the Authorization Bearer header construction, the Accept header, the
15-second timeout, the sequential read ordering and the request-count behaviour on every other
failure path are all unchanged.

## Masking remediation

This checkpoint applies the existing PR #215 production identifier-masking pattern
(`.github/workflows/data-s2-production-collection.yml`) to the observer workflow. Owner review of
the first draft of this fix tightened the boundary further: no steward runtime credential of any
kind — not just the fingerprint — may sit at job level, so the job's `env:` block is removed
entirely and every value is declared at the exact step that needs it.

1. The job's `env:` block is removed in full. No `DATA_STEWARD_GITHUB_TOKEN`,
   `DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID`, `DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT` or
   `DATA_STEWARD_CLOUDFLARE_READ_TOKEN` is declared at job level.
2. A new first step, `Register Cloudflare account fingerprint mask before any other step`, declares
   at step level only `DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID: ${{ secrets.DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID }}`,
   fails closed if it is absent, derives its SHA-256 locally with `sha256sum`, and registers
   `::add-mask::<derived hash>`. It issues no network request, writes no `GITHUB_ENV` or
   `GITHUB_OUTPUT`, and produces no step output.
3. `Check out observer source` and `Set up exact Node` declare no `env:` of any kind — they receive
   no steward value.
4. Only the final `Execute one read-only observation` step declares, at step level, the complete
   runtime contract: `DATA_STEWARD_GITHUB_TOKEN: ${{ github.token }}`,
   `DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID: ${{ secrets.DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID }}`,
   `DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT: ${{ vars.DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT }}`
   and `DATA_STEWARD_CLOUDFLARE_READ_TOKEN: ${{ secrets.DATA_STEWARD_CLOUDFLARE_READ_TOKEN }}` — the
   fingerprint materialised only here, after the mask is already registered.

The ephemeral GitHub token, the account id secret and the Cloudflare read token secret remain
exactly as before; no credential is widened, added or converted from a repository variable into a
secret. The exact `refs/heads/main` guard, `deployment: false`, the exact read-only permission set
(`contents: read`, `actions: read`, `checks: read`), the `17 4 * * *` / `17 8 * * *` schedules and
the exact `DATA_STEWARD_SCHEDULED_ENABLED == 'true'` activation gate are all unchanged.

## Format contract

The Cloudflare account fingerprint contract is, and remains, exactly:

* **Required:** `^[0-9a-f]{64}$` — 64 lowercase hexadecimal characters, nothing else.
* **Forbidden:** any prefix, including `sha256:<hash>`; any uppercase hex; any surrounding
  whitespace or quoting.

The runtime sentinel is **not** changed to accept a second shape. The first live failure proved the
existing raw-hex-only runtime contract was already correct; this remediation only fixes
provisioning clarity in documentation and adds permanent tests pinning both the accepted and the
rejected shape.

## Outcome

A1.3 adds one dedicated GitHub Actions workflow and one narrow Node adapter that execute exactly one
existing `observeProductionChain(...)` run. The workflow declares manual dispatch plus observation
opportunities at `17 4 * * *` and `17 8 * * *` UTC. Neither opportunity collects, retries, repairs or
mutates anything. The existing A1.2 evaluation deadline remains 04:02 UTC.

Repository-ready does not mean live-activated. Scheduled monitoring remains **NOT LIVE-ACTIVATED**
regardless of the first attended manual dispatch above: that dispatch used `workflow_dispatch`, not
`schedule`, and its Cloudflare sentinel failed closed rather than being accepted. Scheduled runs
require repository variable
`DATA_STEWARD_SCHEDULED_ENABLED` to equal exact lowercase `true`. Missing, blank, false, uppercase or
any other value skips the job. Manual `workflow_dispatch` remains independent for later attended
acceptance, but every event must also have exact ref `refs/heads/main`; branch and tag dispatches are
skipped before environment credentials can be exposed. This PR creates no variable, environment,
secret or credential and performs no live run.

**Live dormant state is now recorded, with its provenance stated.** The authenticated tooling
available to this repository received **HTTP 403** when it attempted to read the live Actions
variable, so repository tooling did not and cannot prove that state itself. The owner subsequently
verified through the GitHub owner UI — **Settings → Secrets and variables → Actions → Variables** —
that `DATA_STEWARD_SCHEDULED_ENABLED` is **absent**. That is owner UI evidence, not an independent
repository read. **No variable was created, edited or deleted** in obtaining it. Because the workflow
executes a scheduled job only when that variable equals exact lowercase `true`, and an absent variable
cannot equal it, **the scheduled observer remains dormant on merge**. Scheduled activation still
requires a later explicit owner-approved creation and setting of `DATA_STEWARD_SCHEDULED_ENABLED=true`;
merging this checkpoint performs no part of it.

## Runtime and authority boundary

`.github/workflows/data-steward-readonly-observer.yml` uses protected environment
`data-steward-readonly`. Workflow permissions are exactly `contents: read`, `actions: read` and
`checks: read`. Its ephemeral `${{ github.token }}` is mapped to `DATA_STEWARD_GITHUB_TOKEN`; no
long-lived GitHub PAT is required. Later owner-provisioned Cloudflare values are account id, separate
account fingerprint and one token limited to **Workers Scripts Read** plus **D1 Read**.

The environment reference sets `deployment: false`, retaining environment secrets/variables without
creating GitHub Deployment objects or statuses for observer jobs. Before storing any Cloudflare value
or attempting the first manual run, the owner must explicitly create and configure the environment
with deployment branches/tags set to **Selected branches and tags → exact branch `main`**. Do not use
**Protected branches only**: current `main` was independently observed as not branch-protected, and
GitHub documents that option can permit all branches when no repository branch protections exist.
The environment must exist first because GitHub can automatically create a referenced nonexistent
environment without protection rules. This environment rule is defense in depth behind the workflow's
exact `github.ref == 'refs/heads/main'` execution guard.

There is no D1 write token, dispatcher Actions-write token, deployment credential, Odds key, AI key
or other actuator credential. Production D1 identity and dispatcher Worker identity remain fixed
repository constants. No GitHub dispatch/re-run/cancel endpoint, Cloudflare mutation endpoint,
arbitrary SQL or D1 mutation is reachable.

`workers/data-steward/run-observer.mjs` is the sole new ambient-environment boundary. It copies only
the four allowlisted steward names, injects fetch and clock into the deterministic A1.2 core, emits
one closed sanitized JSON summary, and exits non-zero only for unhealthy/escalating observations.
Healthy and legitimate `NOT_DUE`/`AWAITING_LATER_OPPORTUNITY` outcomes succeed and remain
non-incidents. Logs exclude tokens, account identifiers/fingerprint source, D1 identity, raw API
bodies, raw gate logs, provider text, headers and credential fragments.

## Persistence and limitations

A1.3 adds no persistence or migration. Initial operational evidence is the existing deterministic
heartbeat, sanitized output and GitHub Actions run history. Migrations remain exactly 0001–0003.

A GitHub-hosted observer cannot independently detect a total GitHub outage or complete absence of
its own scheduled workflow runs. Independent watchdog/persistent-heartbeat work remains a future
checkpoint. Cloudflare per-fire invocation history also remains explicitly unobservable through any
repository-proven read-only API. These gaps are not reported as healthy evidence.

## Activation gate

Steps 1–2 below were performed by the owner ahead of the first attended dispatch recorded above;
step 3 is now attempted three times and still not accepted, with a further corrective sub-step
required inside it:

1. ~~Explicitly create and configure protected environment `data-steward-readonly`, with deployment
   branches/tags set to **Selected branches and tags → exact branch `main`**.~~ Done: the first
   dispatch was admitted to the environment.
2. ~~Store the read-only Cloudflare credentials in it: account id, the separately supplied account
   fingerprint and one token limited to **Workers Scripts Read** plus **D1 Read**.~~ Done. The
   fingerprint was initially stored in the wrong shape (see "First live observation attempt"); the
   owner has since corrected it to the raw 64-character lowercase SHA-256 hex, proved by the second
   and third attempts' successful identity admission.
3. Manually dispatch one live read-only observer run on `main` and accept its sanitized evidence.
   **Attempted four times and not yet accepted.** Run `34269989975` failed closed at Cloudflare
   identity admission (`CLOUDFLARE_IDENTITY_MISMATCH`), resolved by PR #233. Run `34277208819`,
   after that merge, passed identity admission but failed closed during the Cloudflare read phase
   with the then-collapsed `CLOUDFLARE_READ_FAILED`, resolved into per-stage codes by PR #234. Run
   `34311398342`, after that merge, again passed identity admission and narrowed the failure to
   `/schedules`, but with the then-collapsed `CLOUDFLARE_SCHEDULES_READ_FAILED`, resolved into five
   `/schedules` category codes by PR #235. Run `34319945520`, after that merge, again passed
   identity admission, reached HTTP 200 and narrowed the failure to response processing, but with
   the then-collapsed `CLOUDFLARE_SCHEDULES_RESPONSE_INVALID`. Before dispatching again: merge this
   response-layer diagnostic split, confirm exact-`main` Verify success, then perform one new
   attended manual dispatch on the then-current `main`. Read the new closed response-layer category
   code (`CLOUDFLARE_SCHEDULES_JSON_INVALID` / `CLOUDFLARE_SCHEDULES_ENVELOPE_INVALID` /
   `CLOUDFLARE_SCHEDULES_PAYLOAD_INVALID`) to identify the precise underlying cause before deciding
   whether the fix is configuration, credential permission, a response-contract correction or
   another cause. Accept the run only if the GitHub, D1 and Cloudflare sentinels all observe
   successfully and the cross-source verdict is healthy.
4. Only after that acceptance, separately approve and set repository variable
   `DATA_STEWARD_SCHEDULED_ENABLED` to exact `true`. Scheduled activation is a later, separate
   approval and remains NOT LIVE-ACTIVATED regardless of how step 3 resolves.

The activation-variable question that formerly sat at the head of this list is **closed by owner UI
evidence**: `DATA_STEWARD_SCHEDULED_ENABLED` is absent, repository logic is fail-closed for absent and
non-`true` values, and the scheduled observer is therefore dormant on merge. Closing it changes no
other gate. This checkpoint fixes provisioning-clarity documentation and identifier masking only; it
performs no live step, changes no live credential value, and claims no accepted observation.
