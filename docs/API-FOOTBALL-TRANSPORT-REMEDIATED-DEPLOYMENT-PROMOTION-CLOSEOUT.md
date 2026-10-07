# API-Football Transport-Remediated Deployment Promotion — Gate B Live Closeout

Date: 7 October 2026

Status: **complete and consumed**.

This record closes Gate B after the one-time live workflow run `37688525299`, attempt 1, on exact approved main `2516eeec669f3b44001f9cc5d22135dcbe0e235e` (merged PR #315). It supersedes the pre-dispatch wording in the Gate B preparation record. **Gate B must never be rerun.**

## Outcome

The workflow `API-Football Transport-Remediated Deployment Promotion` completed all four jobs successfully:

1. `repository-gate`
2. `fresh-readonly-admission`
3. `protected-deployment-promotion`
4. `final-readonly-reconciliation`

Fresh admission classified the exact pre-mutation state as `READY_FOR_TRANSPORT_REMEDIATED_DEPLOYMENT_PROMOTION` with zero production mutations, zero API-Football requests, zero secret values read and `retryAuthorized:false`.

Protected execution submitted exactly **one** Deployment POST. The sanitized execution artifact classified the result as `TRANSPORT_REMEDIATED_DEPLOYMENT_PROMOTION_SUBMITTED_RECONCILIATION_REQUIRED` with outcome `APPLIED_CONFIRMED_BY_READBACK`.

Independent final reconciliation classified the terminal state as:

`TRANSPORT_REMEDIATED_DEPLOYMENT_PROMOTED_INERT`

## Exact evidence

| Field | Value |
|---|---|
| Workflow run | `37688525299` |
| Attempt | `1` |
| Approved/execution SHA | `2516eeec669f3b44001f9cc5d22135dcbe0e235e` |
| Candidate Version | `4171f3cf-953e-452e-9e5f-068df9a3ca47` |
| Candidate immutable creation SHA | `f01ccff5b13a4bbc98d7927cf620f69f46c4c54c` |
| New active Deployment | `9b48b57a-e505-4213-9547-fe44835a9bdb` |
| Historical Deployment retained | `2417a3e0-15db-4e45-a3c8-00b148a300f4` |
| Historical Version retained in historical Deployment | `04d79556-3070-429f-9944-b5b53d799842` |
| Deployment POST attempts | `1` |
| Deployment mutations in executor | `1` |
| Version uploads | `0` |
| D1 mutations | `0` |
| workers.dev mutations | `0` |
| Preview mutations | `0` |
| schedule / route / domain mutations | `0 / 0 / 0` |
| Worker invocations | `0` |
| API-Football requests | `0` |
| Secret values serialized | `0` |
| retryAuthorized | `false` |

Retained sanitized artifact hashes:

- admission artifact `879465a2de4bad79de48e586ea7f514b8305d7a7987a48f415269df3662384fa`;
- execution artifact `cc5955b48fc3874e007c3c5847d3c232ce50653441990ad85ffd96106c26efa0`;
- final reconciliation artifact `f377668671e45a79f223c28d645a4d4611eadfcb3330b9ec901c04de68e7f07e`.

## Final live state proved by independent reconciliation

- exactly **4 Worker Versions**;
- exactly **2 Deployment history rows**;
- active Deployment `9b48b57a-e505-4213-9547-fe44835a9bdb` selects corrected Version `4171f3cf-953e-452e-9e5f-068df9a3ca47` at 100%;
- historical Deployment `2417a3e0-15db-4e45-a3c8-00b148a300f4` remains unchanged and records old Version `04d79556-3070-429f-9944-b5b53d799842` at 100%;
- workers.dev off;
- Preview off;
- Cron 0;
- custom domains 0;
- legacy routes 0;
- authoritative zone-route scan 0;
- collection disabled;
- credential state `AVAILABLE`;
- no active lease;
- request attempts 1, attempt 1 count 1, attempt 2 count 0;
- `TRANSPORT_UNKNOWN` count 1;
- one failed generation, zero committed generations;
- fixture revisions 0;
- mapping 20/20 `COMMITTED`;
- fresh Official FPL authority valid at 20 teams;
- model/UI imports 0;
- raw API-Football payload storage absent.

## Consumed history

These live paths are consumed and carry no retry authority:

- `37505586273` — original one-shot Deployment creation;
- `37511401491` — continuation that consumed provider attempt 1 as `TRANSPORT_UNKNOWN`;
- `37680114065` — Gate A corrected Version preparation;
- `37688525299` — Gate B corrected Deployment promotion.

The Gate B workflow file is retained as auditable history but is marked `CONSUMED`. Its admission also fails closed against the now-two-Deployment live state, so the successful promotion cannot be repeated through the reviewed Gate B contract.

## What Gate B proves

Gate B proves exact candidate provenance, one-time Deployment promotion and an independently reconciled **inert** terminal topology.

It does **not** prove:

- Worker invocation against the corrected Version;
- successful API-Football network transport;
- successful provider response;
- response validation;
- persistence of a new successful collection generation;
- provider reliability;
- predictive value or model benefit.

The previous provider transport problem therefore remains **unproven as fixed**.

## Next gate

Gate C is separate and **not implemented or authorized by this closeout**. Before any Gate C implementation or live mutation, the owner must review and explicitly approve the proposed invocation path, provider-request ceiling, D1 effects, trigger/credential handling, concurrency and lease behaviour, retry and ambiguity policy, validation/persistence rules, owner-attention handling, security boundaries, tests, success evidence and remaining limitations.

API-Football remains shadow-only and has no path into expected minutes, projected points, XI, transfers, captaincy, rank, Mini Leagues, rivals, recommendations or strategy logic.
