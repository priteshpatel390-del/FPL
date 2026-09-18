# EIA-2I5F — Qualified API-Football Response Ceiling Implementation

Date: 17 September 2026
Approved scope: repository-only implementation of the EIA-2I5E R7 attended-qualified response ceiling.
Base `main`: `8e5fd8ad6d60b6b2953612d24a38865788e24f04` (merge of PR #251 / EIA-2I5E-R7P).

## Outcome

EIA-2I5F implements the formally qualified API-Football response ceiling as:

`API_FOOTBALL_MAX_RESPONSE_BYTES = 720896`

The value is not a new estimate. It is the exact `proposedCeiling` from the attended canonical EIA-2I5E R7 qualification run `35248079758`.

R7 evidence:

- formal decision: `GO`
- qualification state: `ATTENDED_CANONICAL_QUALIFIED`
- canonical provider requests: 11
- retries: 0
- observed maximum: 347,982 bytes
- doubled maximum: 695,964 bytes
- rounding quantum: 65,536 bytes
- qualified ceiling: 720,896 bytes
- artifact ID: `10508920046`
- artifact digest: `sha256:dd6b907cefe6c5d0b29b8c269d91a622ff45411303a571eeb1831d004b5e3459`

The attended evidence file remains unchanged as a historical execution record: its `productionConstant: null` and `implemented: false` fields describe the state at the time R7 ran. EIA-2I5F binds the runtime constant to R7's `proposedCeiling` instead of rewriting that history.

## Behaviour change

Before EIA-2I5F, `validateRuntimeConfiguration()` returned `response_limit_unqualified` after storage and credential checks because the response ceiling was `null`. `readBoundedJson()` also failed closed when invoked with its default unqualified limit.

After EIA-2I5F, the response-size gate is qualified. A runtime that otherwise has a valid D1 binding and credential may pass this one configuration check, and the default bounded decoder rejects any declared or streamed response larger than 720,896 bytes.

This change does not bypass any other runtime gate.

## Preserved fail-closed boundaries

EIA-2I5F does not:

- provision or mutate Cloudflare resources;
- apply migration 0005 live;
- replace the inert all-zero repository D1 identifier;
- create, read, rotate or expose `API_FOOTBALL_API_KEY`;
- enable `collection_enabled`;
- change the seeded `EIA_2I5D_REPOSITORY_ONLY` disable state;
- declare or activate Cron;
- deploy the API-Football collector;
- make a provider request;
- expand provider-to-FPL mapping beyond the existing 2/20 qualified mappings;
- change Official FPL authority rules;
- change quota, lease, spacing, retry, authentication or 429 behaviour;
- add a public Worker route or fetch handler;
- create a browser, model, expected-minutes, projected-points, captaincy, squad, transfer, simulation, rank, Mini-League, rival, strategy, alert or recommendation read path;
- claim predictive or model-value improvement.

The tracked Worker configuration remains repository-only and blocked: no Cron, `workers_dev: false`, `preview_urls: false`, inert D1 ID. Migration 0005 still seeds API-Football collection disabled.

## Verification contract

Permanent coverage must prove:

1. `API_FOOTBALL_MAX_RESPONSE_BYTES` is exactly 720,896.
2. The runtime value equals the immutable R7 evidence `proposedCeiling`.
3. R7 remains formally `GO` / `ATTENDED_CANONICAL_QUALIFIED` with the same arithmetic inputs.
4. The default bounded decoder rejects a declared response one byte above the ceiling.
5. A bounded valid JSON response remains accepted.
6. Storage and credential configuration gates remain fail-closed when absent.
7. Repository Worker configuration remains dormant and migration 0005 still seeds collection disabled.
8. Existing EIA-2I5D quota, concurrency, authentication, authority, scheduler, security, migration and production/browser/model-isolation tests remain unweakened.

Completion requires the full repository suite, production build, deterministic rebuild comparison and build-identity verification on the exact branch head.

## Remaining gates

Response-size qualification and repository implementation are complete once this checkpoint is merged and exact-main verification passes.

The next substantive pre-live blocker is complete 20-club API-Football-to-Official-FPL mapping. Current admitted mappings remain only Chelsea `49→6` and Leeds `63→13`; 18 clubs remain unproven.

Only after a separately approved mapping closeout should an infrastructure activation package be considered: live D1 binding, migration 0005 application, Worker secret, collection enablement, Cron, deployment and bounded shadow acceptance. Model/UI use remains a later independent approval gate.
