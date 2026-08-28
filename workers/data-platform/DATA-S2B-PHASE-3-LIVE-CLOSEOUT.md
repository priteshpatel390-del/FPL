# DATA-S2B — Phase 3 Live Candidate Deployment Closeout

Status: **PASS — existing candidate deployed at 100% and postflight accepted**
Recorded: **28 August 2026**

## Outcome

DATA-S2B Phase 3 is complete for its approved production-deployment purpose. The already-created candidate Worker Version `3a2b065a-6527-4887-9bf8-b08e82e81133` is the sole active Version at 100%. The previous production Version `5edbe951-4be4-46bc-b2cf-17b550396105` remains the retained rollback target; rollback was not required.

This acceptance changes only which existing Worker Version serves production traffic. Phase 3 did not upload a new Version and did not change application, provider, model or calculation behaviour.

## Exact repository and run identity

- canonical repository: `priteshpatel390-del/FPL`;
- executed repository SHA: `d48913332bf5df37b29d98b06579f369f338f6e4`;
- workflow: `DATA-S2B Phase 3 Candidate Deployment`;
- trigger: `workflow_dispatch`;
- run number: `4`;
- run ID: `33142804502` — completed **success**;
- repository-gate job `98757162970` — completed **success**;
- protected deployment job `98757181376` — completed **success**;
- protected environment: `data-s2b-phase3-deployment`, released by owner review;
- runtime: exact Node `v24.19.0`;
- required secrets were supplied to the job as masked values.

The repository gate successfully validated the supplied approved SHA, checked out that exact revision, proved it was exact current `main` with a clean tree, and required a successful exact-head `Tests and deterministic build` check before credentials could be released.

## Production state transition

Before Phase 3, production traffic was served by rollback Version:

`5edbe951-4be4-46bc-b2cf-17b550396105`

The accepted postflight state is:

- candidate Version `3a2b065a-6527-4887-9bf8-b08e82e81133` is the sole active Version;
- its traffic allocation is exactly 100%; and
- Version `5edbe951-4be4-46bc-b2cf-17b550396105` remains available as the approved rollback target.

## Mutation accounting

The successful Phase 3 workflow submitted **exactly one** candidate Deployment mutation.

- candidate Deployment mutations: **1**;
- rollback Deployment mutations: **0**;
- Worker Version uploads: **0**;
- Worker Version deletions: **0**;
- Cron mutations: **0**;
- D1 mutations or migrations: **0**;
- route or Custom Domain mutations: **0**;
- Access mutations: **0**;
- Worker or GitHub secret mutations: **0**.

The ordered deployable Version History remained unchanged, which proves Phase 3 created no new Worker Version. No raw Cloudflare response or secret value was persisted by the workflow.

## Preflight and postflight acceptance

The successful run proves the approved Phase 3 contract passed in its bounded execution window:

- old-production immutable invariants passed before deployment;
- authenticated `GET /v1/health` passed through both Cloudflare Access and the Worker bearer boundary before mutation;
- the same old-production invariants passed again before the candidate Deployment became reachable;
- the candidate became the sole active Version at 100%;
- authenticated candidate health returned `ok=true` and `mode=shadow_only`;
- candidate postflight invariants passed on both sides of that authenticated health check;
- exact Version Detail bindings and compatibility remained approved;
- deployable Version History remained unchanged;
- live Cron remained empty;
- the production Custom Domain remained exact and unchanged; and
- Phase 1 D1 migration/governance/count state and the accepted D1 size remained exact, with no collector or ingestion run.

The workflow therefore reported **PHASE 3 PASS** with detail `candidate is sole active version; postflight passed`.

## Sanitized authentication diagnostic and remediation history

Earlier Phase 3 attempts stopped before deployment because authenticated health returned a non-JSON response. Later read-only Cloudflare Access GraphQL diagnostics identified failed requests at `2026-08-27 22:55:31 UTC` and `2026-08-27 23:04:30 UTC`: `isSuccessfulLogin=0`, with empty service-token and approving-policy identifiers. The supported classification was that Cloudflare Access had not recognized the supplied service-token credential pair.

Inspection of the existing policy showed `Service Auth` with a `Service Token` Include rule and no additional Require or Exclude rule affecting the request. Before the successful workflow, the owner manually:

1. created a fresh Access service token named `Teamsheet Phase3 Access — 20260828`;
2. changed the existing Service Auth policy so its Include rule selected only that token; and
3. updated the Phase 3 GitHub environment's Access credentials.

An Access-only request using the replacement credentials, without a Worker bearer, returned HTTP 401 with `application/json`. This proved Access had admitted the request to the Worker boundary. The first tested saved Worker bearer candidate also returned HTTP 401 with JSON. A second saved bearer candidate returned HTTP 200 with the exact health body:

```json
{"ok":true,"platformVersion":"1.0.1","mode":"shadow_only"}
```

The owner then updated the environment's `DATA_S1_HTTP_AUTH_TOKEN` to that proven bearer. No credential value, Client ID, Client Secret, bearer value or API token is recorded here.

These were **manual authentication configuration changes completed before the successful Phase 3 run**. They are separate from the workflow mutation accounting above: run `33142804502` itself performed no Access or secret mutation. The older Access service token was not deliberately deleted during this work, and this closeout makes no claim that obsolete credentials or resources have been cleaned up.

## Acceptance boundary and limitations

- This is production deployment acceptance for **Phase 3** only.
- It is not approval for Phase 4.
- Cron activation remains unapproved.
- Collection remains unapproved; no collector or ingestion request ran.
- No obsolete-credential or obsolete-resource cleanup is claimed.
- No application, provider, model or calculation behaviour changed.
- The workflow did not directly inspect zone routes or Access policy configuration; its approved contract instead proved the exact Custom Domain and authenticated end-to-end health. The separate manual diagnostic history above supplies only the stated sanitized Access evidence.

## Next gate

Phase 4 must remain a separate investigation, design and explicit-approval checkpoint. It must define and review Cron activation, collection acceptance, D1 accounting, unchanged-cycle and changed-fact evidence, Workers Free CPU suitability, and stop/rollback controls before any Phase 4 mutation or collection is authorized.

This closeout does not implement, activate or approve Phase 4.
