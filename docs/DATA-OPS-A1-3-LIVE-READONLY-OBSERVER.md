# DATA-OPS A1.3 — Dormant live read-only observer runtime

Status: **REPOSITORY-READY; FIRST LIVE OBSERVATION ATTEMPTED AND FAILED CLOSED; NOT LIVE-ACCEPTED**
Source main: `2f8a4850f911779d2ec48db2f835d0f6af5a45c5` (merge of PR #232, A1.3 repository-ready checkpoint)

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

## Masking remediation

This checkpoint applies the existing PR #215 production identifier-masking pattern
(`.github/workflows/data-s2-production-collection.yml`) to the observer workflow:

1. `DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT` is removed from the job's `env:` block entirely.
2. A new first step, `Register Cloudflare account fingerprint mask before any other step`, reads
   only the already-secret `DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID` (inherited from job-level `env:`,
   itself `secrets.DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID`), fails closed if it is absent, derives its
   SHA-256 locally with `sha256sum`, and registers `::add-mask::<derived hash>`. It issues no
   network request, writes no `GITHUB_ENV` or `GITHUB_OUTPUT`, and produces no step output.
3. Only the final `Execute one read-only observation` step declares
   `DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT: ${{ vars.DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT }}`,
   at step level, after the mask is already registered.

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
steps 3–4 remain outstanding, with a corrective sub-step now required inside step 3:

1. ~~Explicitly create and configure protected environment `data-steward-readonly`, with deployment
   branches/tags set to **Selected branches and tags → exact branch `main`**.~~ Done: the first
   dispatch was admitted to the environment.
2. ~~Store the read-only Cloudflare credentials in it: account id, the separately supplied account
   fingerprint and one token limited to **Workers Scripts Read** plus **D1 Read**.~~ Done, but the
   fingerprint was stored in the wrong shape — see "First live observation attempt" above.
3. Manually dispatch one live read-only observer run on `main` and accept its sanitized evidence.
   **Attempted once (run `34269989975`) and not accepted**: the Cloudflare sentinel failed closed.
   Before dispatching again: merge this remediation, confirm exact-`main` Verify success, then have
   the owner correct the live `DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT` value to the raw
   64-character lowercase SHA-256 hex (no prefix). Only then perform one new attended manual
   dispatch on the then-current `main`, and accept it only if the GitHub, D1 and Cloudflare
   sentinels all observe successfully and the cross-source verdict is healthy.
4. Only after that acceptance, separately approve and set repository variable
   `DATA_STEWARD_SCHEDULED_ENABLED` to exact `true`. Scheduled activation is a later, separate
   approval and remains NOT LIVE-ACTIVATED regardless of how step 3 resolves.

The activation-variable question that formerly sat at the head of this list is **closed by owner UI
evidence**: `DATA_STEWARD_SCHEDULED_ENABLED` is absent, repository logic is fail-closed for absent and
non-`true` values, and the scheduled observer is therefore dormant on merge. Closing it changes no
other gate. This checkpoint fixes provisioning-clarity documentation and identifier masking only; it
performs no live step, changes no live credential value, and claims no accepted observation.
