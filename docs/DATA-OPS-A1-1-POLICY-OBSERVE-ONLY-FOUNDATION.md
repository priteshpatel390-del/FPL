# DATA-OPS-A1.1 — Policy and observe-only foundation

Status: **MERGED AND CURRENT** — PR #230, merged as
`47345a7035eba0071c66dcab778f0edc9fef4048`. The earlier status line on this record read
"IMPLEMENTED ON DRAFT BRANCH; OWNER REVIEW REQUIRED"; that was accurate before the merge and is no
longer current. Everything below describes the foundation as it now stands on `main`.
Baseline: `df2b307a4ef3ccc10b6c988bc3132694e046f278`

A1.1 remains observe-only and unchanged. The next checkpoint,
[DATA-OPS-A1.2](DATA-OPS-A1-2-OBSERVE-ONLY-PRODUCTION-SENTINELS.md), supplies deterministic
observations INTO this boundary; it registers no new action, enables no autonomy class, and does not
alter the contracts described here.

## Outcome and boundary

A1.1 adds an offline deterministic control-plane foundation under `workers/data-steward/`. It has no
network client, environment/credential reader, SQL, deployment workflow, storage binding or mutation
actuator. It does not change DATA-S2C, workflow B, workflow C, the opportunity guard, Official FPL
collection, production D1, providers, calculations or application behavior.

The separation is explicit:

`supplied evidence -> incident classification -> untrusted proposal -> deterministic policy decision -> future bounded actuator -> future verification -> audit record`

Only the first four representations and the audit contract exist. A policy `ALLOW` is not an
execution: A1.1 exposes only a lookup for registered, enabled, non-mutating Class 0 actions.

## Contracts

- `action-registry.mjs` defines stable action IDs, Classes 0–4, metadata, policy version, mutation
  domains and the deliberately empty Class 3 allowlist. Future Class 1–4 definitions are disabled.
- `incident.mjs` creates evidence-bound deterministic incident identities. Each registered rule has
  an exact expected/observed-state predicate; its label alone proves nothing. Contradictory,
  unsupported, malformed or unproven state is RED.
- `policy-engine.mjs` accepts exact proposal and context schemas and returns `ALLOW`, `DENY` or
  `ESCALATE` plus a stable reason code. Unknown keys/actions/classes, missing evidence, state/SHA
  mismatches, expiry, replay, disabled switches, exhausted budgets, cooldown and tripped breakers
  fail closed. The untrusted proposal contains intent only. Required evidence consists of typed,
  hashed references in trusted policy context, bound to the current incident; proposer evidence and
  trusted-context-like fields are invalid. AI confidence is not accepted input.
- `audit.mjs` canonicalises and hashes a structured audit record. Recursive secret-key/value checks
  reject credential-bearing material; no live audit store exists.
- `provider-health-contract.mjs` accepts dynamic health only. Immutable provider identity, authority
  and purpose come from the repository's existing provider registry; callers cannot redefine
  purpose, fallback or prohibited influence. It always returns `mayInfluenceProduction: false`.

No dispatch failure currently qualifies for AMBER. `dispatch_token_missing` and the dispatcher's
generic `dispatch_status_rejected` are RED: bounded, rejected and side-effect-free does not prove
bounded autonomous repairability. The generic rejection combines 401, 403, 404 and 422, while A1.1
has no authoritative recovery-state contract capable of proving a pre-approved credential-free,
permission-preserving repair. Any future AMBER recovery needs a separate exact registered predicate;
historical recovery of one missing-token incident grants no reusable authority.

That is pinned structurally rather than by example. A permanent regression proves the rule set
registers no AMBER classification at all, while `OPERATIONAL_STATE` keeps AMBER so the removal stays
a policy decision rather than a lost enum member. A second regression pins the dispatcher fact the
policy rests on: `REJECTED_STATUSES` is exactly 401, 403, 404 and 422, and all four return the single
reason `dispatch_status_rejected`. If the dispatcher ever distinguishes them, that test fails and the
classification policy must be re-decided rather than silently widened.

## Safety controls

Overall autonomy and separate Cloudflare, GitHub repository, D1, provider and auto-merge mutation
switches are policy inputs, never proposal-controlled fields. Mutation proposals cannot change them.
The policy also binds proposals to policy version, incident ID, exact main SHA, pre-state fingerprint,
expiry and nonce. Per-incident action count, per-action retry count, cooldown and failed-verification
circuit state are explicit inputs. These are deterministic primitives, not a distributed workflow
engine or authorization store.

## Not implemented

No live Cloudflare/GitHub/D1/provider observer, AI model, authorization persistence, nonce store,
notification adapter, actuator, repair, rollback, repository-repair runtime, provider operation or
auto-merge exists. Later work needs separate owner approval and must supply independently bounded
read adapters, durable state and named domain actuators without weakening this policy boundary.

No generic SQL, shell, HTTP, GitHub API, Cloudflare API or owner-command action exists. The Class 4
example is a non-executable review gate for a separately proposed migration, not migration authority.

## Verification

Permanent coverage is in `tests/data-ops-a1-1-policy-foundation.test.mjs`. It exercises valid Class 0,
all disabled/future classes, adversarial schemas and generic-authority requests, classifications,
kill switches, state binding, replay, budgets, breakers, deterministic incident/audit identities,
secret rejection, provider non-influence and static absence of mutation capabilities.
