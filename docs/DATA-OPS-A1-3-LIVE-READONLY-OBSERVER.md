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

Remaining attended owner steps, in order:

1. Explicitly create and configure protected environment `data-steward-readonly`, with deployment
   branches/tags set to **Selected branches and tags → exact branch `main`**; do not rely on
   **Protected branches only**. The environment must exist and be restricted before it holds any
   value.
2. Only then store the read-only Cloudflare credentials in it: account id, the separately supplied
   account fingerprint and one token limited to **Workers Scripts Read** plus **D1 Read**.
3. Manually dispatch one live read-only observer run on `main` and accept its sanitized evidence.
4. Only after that acceptance, separately approve and set repository variable
   `DATA_STEWARD_SCHEDULED_ENABLED` to exact `true`.

The activation-variable question that formerly sat at the head of this list is **closed by owner UI
evidence**: `DATA_STEWARD_SCHEDULED_ENABLED` is absent, repository logic is fail-closed for absent and
non-`true` values, and the scheduled observer is therefore dormant on merge. Closing it changes no
other gate. This checkpoint performs no step above and claims no live monitoring, no environment, no
credential and no accepted observation.
