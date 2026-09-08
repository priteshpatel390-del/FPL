# DATA-OPS A1.3 — Dormant live read-only observer runtime

Status: **REPOSITORY-READY; NOT LIVE-ACTIVATED**
Source main: `b2ce4e4e3e12a4c6b76e0d1075cb22f06ecac2e2` (PR #231 / DATA-OPS A1.2 merge)

## Outcome

A1.3 adds one dedicated GitHub Actions workflow and one narrow Node adapter that execute exactly one
existing `observeProductionChain(...)` run. The workflow declares manual dispatch plus observation
opportunities at `17 4 * * *` and `17 8 * * *` UTC. Neither opportunity collects, retries, repairs or
mutates anything. The existing A1.2 evaluation deadline remains 04:02 UTC.

Repository-ready does not mean live-activated. Scheduled runs require repository variable
`DATA_STEWARD_SCHEDULED_ENABLED` to equal exact lowercase `true`. Missing, blank, false, uppercase or
any other value skips the job. Manual `workflow_dispatch` remains independent for later attended
acceptance, but every event must also have exact ref `refs/heads/main`; branch and tag dispatches are
skipped before environment credentials can be exposed. This PR creates no variable, environment,
secret or credential and performs no live run. The available authenticated tooling received HTTP 403
when reading the live activation variable, so its absent/non-`true` state is **not independently
proven** and this checkpoint does not claim that live dormant-on-merge state as fact.

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

Remaining attended owner steps, in order:

1. Provision protected environment `data-steward-readonly` with Cloudflare account id, separately
   supplied fingerprint and the read-only Cloudflare token. **First create/configure it with Selected
   branches and tags → exact branch `main`; do not rely on Protected branches only.**
2. Obtain an authorized read-only result proving `DATA_STEWARD_SCHEDULED_ENABLED` is absent or not
   exact lowercase `true`; current tooling cannot prove this because its read returned HTTP 403.
3. Manually dispatch one live read-only observer run on `main` and accept its sanitized evidence.
4. Only after that acceptance, separately approve and set repository variable
   `DATA_STEWARD_SCHEDULED_ENABLED` to exact `true`.

Repository logic is fail-closed for absent/non-`true` values, but live dormant-on-merge status remains
unproven until step 2. This checkpoint does not perform any step above or claim live monitoring.
