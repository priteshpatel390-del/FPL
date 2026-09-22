# API-Football Attended Preparation Foundation

Status: **repository implementation candidate only — no live preparation is authorized or executed by this document.**

## Baseline

The attended-acceptance foundation from PR #286 is merged on `main` as `fda5a45ccd86928f60d91e8e34ded79ff49064da`. Post-merge Verify Teamsheet run `35699898106` and GitHub Pages run `35699897564` succeeded. The Verify run passed 2,347 / 2,347 tests, deterministic production rebuilds, root/deployable equality and exact manifest identity with build-input hash `7cafd62d767c0b98b919b505ec4ec4b48d69ad028b3b3f0e635fe516d235cbbc`.

The last accepted collector live evidence remains inactive-staging run `35645387203`, not a fresh observation for this checkpoint. It established Worker `teamsheet-api-football-shadow-collector`, exactly one inactive blocked Version `e49ac8f2-4289-46bc-9f0b-87a20cd7be62`, zero Deployments, workers.dev/Preview disabled, no Cron/routes/domains/secrets, runtime collection disabled, credential `UNPROVISIONED`, no lease and 0 / 0 / 0 request attempts / generations / fixture revisions.

No attended secret-bearing Version, real API-Football key, attended trigger secret, credential-state D1 mutation, Preview toggle or provider request has occurred.

## Purpose

This checkpoint supplies only the dormant repository machinery needed for a **later separately approved attended preparation**. It deliberately stops before the already-merged five-request attended acceptance.

The future preparation sequence is:

1. prove fresh exact-current-main and exact-head Verify identity;
2. independently prove the accepted singleton original Version and pristine disabled D1/runtime state;
3. submit at most one inactive secret-bearing attended Version upload;
4. independently prove the resulting exact original-plus-attended two-Version inventory;
5. submit at most one D1 statement transitioning `UNPROVISIONED -> AVAILABLE`;
6. independently reconcile the complete preparation state;
7. classify only exact success as `READY_FOR_SEPARATELY_APPROVED_ATTENDED_ACCEPTANCE`.

Preparation does **not** enable Preview, collection or provider egress.

## Exact original-Version anchor

Preparation admission pins the accepted original Version to:

- Version ID: `e49ac8f2-4289-46bc-9f0b-87a20cd7be62`;
- creation repository SHA: `302dc21cc4b821ac8b224d176765a29c0724a244`;
- main module: `collector.mjs`;
- compatibility date: `2026-09-16`;
- exact D1 binding and three blocked plain-text bindings;
- zero secret bindings;
- the exact 17 uploaded module SHA-256 values reconstructed from the accepted creation commit.

Fresh preparation admission reads the original stable and Beta Version representations and requires those immutable byte hashes. A matching UUID alone is insufficient.

## Read-only preparation stages

The activation preflight adds three preparation-only classifications without changing the existing attended-acceptance executor.

### `ATTENDED_PREPARATION_START`

Requires:

- exact original singleton Version and module bytes;
- original activation `REPOSITORY_ONLY_BLOCKED`;
- exact production D1 binding and seasons;
- no secret binding;
- Worker present;
- Deployment 0;
- Preview off and workers.dev off;
- Cron/routes/custom domains 0;
- migrations 0001–0006 and FK violations 0;
- fresh exact-20 Official FPL authority;
- committed exact 20/20 canonical mapping coverage;
- collection disabled;
- credential `UNPROVISIONED`;
- no active lease;
- attempts / generations / fixture revisions 0 / 0 / 0;
- model/UI import count 0 and no raw-provider-payload store.

Success classification: `READY_FOR_ATTENDED_VERSION_PREPARATION`.

### `ATTENDED_PREPARATION_VERSION_READY`

After one Version submission, independently requires:

- exact original Version bytes still unchanged;
- exactly one additional attended Version;
- attended Version exact reviewed module set and bytes from the approved SHA;
- exact main module, compatibility date, D1 binding and three plain-text bindings;
- exactly two secret bindings by name/type only:
  - `API_FOOTBALL_API_KEY`;
  - `API_FOOTBALL_ATTENDED_TRIGGER_SECRET`;
- no unexpected binding;
- approved-SHA message/tag provenance;
- Deployment 0, Preview off, workers.dev off, Cron/routes/domains 0;
- pristine disabled runtime still `UNPROVISIONED`.

Success classification: `READY_FOR_ATTENDED_CREDENTIAL_PREPARATION`.

### `ATTENDED_PREPARATION_CLOSEOUT`

Requires the exact same two-Version/infrastructure/pristine-history evidence after the bounded credential mutation, but runtime credential state must be `AVAILABLE` while collection remains disabled and no lease exists.

Success classification: `READY_FOR_SEPARATELY_APPROVED_ATTENDED_ACCEPTANCE`.

Any drift produces STOP. Preparation classifications authorize no repair or retry.

## Version mutation domain

The Version mutation job has a closed request allowlist:

- GET the exact Worker Version inventory;
- POST the exact Worker Version-upload endpoint.

It has no shell-create, Deployment, Preview/subdomain, Cron, route/domain, D1 or provider endpoint.

Maximum mutation budget:

- Version creation submissions: **1**;
- Deployment mutations: **0**;
- Preview mutations: **0**;
- Cron/route/domain mutations: **0**;
- D1 mutations: **0**;
- API-Football requests: **0**.

The upload is constructed from the exact reviewed current-main module graph. It carries the production D1 binding, seasons `2026-27` / `2026`, activation `ATTENDED_ONE_SHOT_DISCOVERY`, and the two secret-text bindings.

A definite upload rejection stops. A timeout, unknown transport or malformed mutation response is treated as ambiguous. The helper performs only Version-inventory reconciliation; if exactly one new Version delta can be proved, that identity is passed to an **independent read-only proof**. If the delta is not unique, execution stops. A second upload is never submitted automatically.

## Secret handling

The future live job obtains values only from protected owner-controlled environment secrets. Repository code expects distinct protected credentials for:

- the real `API_FOOTBALL_API_KEY`;
- a temporary high-entropy `API_FOOTBALL_ATTENDED_TRIGGER_SECRET`;
- a narrowly scoped `CLOUDFLARE_ATTENDED_VERSION_UPLOAD_TOKEN`;
- a separately scoped `CLOUDFLARE_ATTENDED_D1_MUTATION_TOKEN`.

The old inactive-staging `CLOUDFLARE_COLLECTOR_WORKER_UPLOAD_TOKEN` is not reused by the preparation workflow.

API key and trigger values must be distinct. Values exist only in process memory / the Cloudflare multipart upload. Reports, artifacts, summaries and console output retain names/types and counters only. Neither secret is placed in a URL or query string.

## Credential mutation domain

Only after independent `ATTENDED_PREPARATION_VERSION_READY` proof may the credential job submit the existing fail-closed lifecycle statement:

```sql
UPDATE api_football_runtime_state
SET credential_state='AVAILABLE'
WHERE provider='api-football'
  AND collection_enabled=0
  AND credential_state='UNPROVISIONED'
  AND in_flight_attempt_id IS NULL
```

Maximum budget:

- D1 calls: **1**;
- D1 statements: **1**;
- rows changed: **1**;
- Version/Deployment/Preview/Cron/route/domain mutations: **0**;
- API-Football requests: **0**.

Exactly one changed row is the definite-success shape. A definite rejection/no-op stops. A transport, HTTP or malformed-response ambiguity never causes resubmission. The separate `data-steward-readonly` closeout is authoritative: if it cannot prove exact `AVAILABLE` state plus all other invariants, the workflow stops with no retry authority.

The preparation workflow never resets `AVAILABLE -> UNPROVISIONED`.

## Workflow protection

`.github/workflows/api-football-attended-preparation.yml` is dormant and:

- `workflow_dispatch` only;
- first run attempt only;
- serialized with non-cancelling concurrency;
- exact current protected `main`;
- exact-head Verify Teamsheet success from the GitHub Actions app and canonical repository Actions URL;
- immutable action SHAs;
- `persist-credentials: false`;
- repeated remote-main and clean-tree checks at protected boundaries;
- separate `data-steward-readonly`, Version-mutation and D1-mutation environments;
- SHA-256-bound sanitized handoff artifacts;
- independent read-only proof after Version upload;
- independent read-only closeout after the credential mutation;
- no schedule, push trigger, Deployment endpoint, Preview mutation, attended HTTP invocation or provider host.

Repository presence or merge does not authorize dispatch.

## Outstanding pre-live security action

Repository evidence still does not prove cleanup/revocation of the earlier temporary environment/token:

- GitHub environment: `api-football-collector-version-upload`;
- secret: `CLOUDFLARE_COLLECTOR_WORKER_UPLOAD_TOKEN`;
- corresponding temporary Cloudflare Workers Scripts Write token.

That cleanup is a **pre-live owner action**. This repository checkpoint does not delete or revoke it and must not claim that cleanup occurred.

## Explicit exclusions

This checkpoint does not:

- upload an attended Version live;
- provision a real API-Football key or attended trigger secret;
- mutate production D1 or change live credential state;
- enable collection or Preview URLs;
- invoke the attended endpoint;
- call API-Football;
- create a Deployment, Cron, route or domain;
- delete either Version;
- revoke the old staging token;
- alter projection, expected-minutes, fixture, captaincy, squad, transfer, rank, Mini-League or UI behaviour.

API-Football remains private/shadow-only and Official FPL remains authoritative.

## Approval gates after repository merge

Merge of this foundation authorizes no live preparation.

A later owner approval is required before **attended preparation** may create the secret-bearing Version or submit the one-row D1 transition. Only after independently reconciled preparation reaches `READY_FOR_SEPARATELY_APPROVED_ATTENDED_ACCEPTANCE` may the already-merged attended acceptance be considered, and the actual five-request acceptance requires a **further separate explicit owner approval**.
