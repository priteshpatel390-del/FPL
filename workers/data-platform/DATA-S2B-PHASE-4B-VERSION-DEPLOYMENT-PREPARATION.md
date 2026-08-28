# DATA-S2B — Phase 4B Worker Version / Deployment Preparation

Status: **REPOSITORY-ONLY CANDIDATE — no live action authorized or performed**  
Prepared: **28 August 2026**

## Outcome and boundary

Phase 4B adds two independent, manual-only, fail-closed paths for future separately approved actions: upload one inactive immutable Version from an exact reviewed `main` checkout, and later deploy one explicitly supplied candidate Version at 100% while retaining the exact previously active Version as the sole bounded rollback target. Upload does not invoke deployment; deployment does not invoke upload. Neither helper can intentionally mutate Schedules, Cron, D1, routes/domains, Access or secrets, and neither runs the collector.

Historical Phase 2 and Phase 3 executables remain frozen. In particular, Phase 2 continues to reject the Phase 4A `*/30 * * * *` repository config with `phase2_triggers_drift`.

## Repository identity and credential gates

Both workflows accept an exact 40-character approved SHA, require manual dispatch from canonical `main`, check out that SHA, prove it still equals remote current `main`, require a clean tree, and require a successful canonical GitHub Actions `Tests and deterministic build` check on that exact head. Cloudflare credentials exist only in the downstream protected job. Node is pinned to `24.19.0`.

The upload job reuses `data-s2b-phase2-version-upload` and `CLOUDFLARE_WORKER_UPLOAD_TOKEN`. The deployment job reuses `data-s2b-phase3-deployment`, `CLOUDFLARE_PHASE3_DEPLOY_TOKEN`, the retained Worker bearer, Access service credentials and account identity. No new secret, Worker, D1 database, provider, hostname, route or Access design is introduced.

## Upload contract

Before its sole possible mutation, the upload helper validates the exact Worker/config/module graph, compatibility date `2026-08-22`, season `2026-27`, active Version `3a2b065a-6527-4887-9bf8-b08e82e81133`, retained rollback Version `5edbe951-4be4-46bc-b2cf-17b550396105`, exact D1 and retained secret binding shapes, empty Cron, Phase 1 governance and zero history state, and recorded D1 size `151552` bytes. Its upload metadata pins both inherited bindings—the D1 binding and retained bearer-secret binding—to that exact verified active Version ID while retaining `bindings_inherit=strict`. It computes SHA-256 identity for exact module bytes and deterministic metadata.

Its executable mutation allowlist admits only `POST /accounts/{account}/workers/scripts/teamsheet-data-platform/versions?bindings_inherit=strict`. An ambiguous response is reconciled with a read-only Version-list delta; it is never blindly retried. Postflight requires exactly one new Version, exact Version Detail/bindings/compatibility, unchanged Deployment, empty Cron, unchanged D1 state and size. Cloudflare Version Detail and the script etag, when the upload response supplies one, are captured as evidence about the created artifact; the repository does not claim Cloudflare provides complete recoverable original source.

## Deployment contract

The deployment workflow requires three explicit identities: approved repository SHA, owner-approved candidate Version ID, and expected currently active Version ID. The helper accepts only a percentage body containing one Version at 100%. Its executable mutation allowlist admits only `POST /accounts/{account}/workers/scripts/teamsheet-data-platform/deployments`.

Preflight validates the expected active/rollback identity, candidate and rollback Version Details, immutable Version History, exact production hostname, empty Cron, authenticated `shadow_only` health, Phase 1 governance/zero history and D1 size. Health and immutable reads bracket mutation. Postflight requires the candidate alone at 100%, unchanged Version History/hostname/Cron/D1 and healthy authenticated HTTP.

At most one rollback Deployment may target the exact supplied pre-approved prior Version. Ambiguous Deployment responses are reconciled read-only. Unexpected Cron or D1 mutation is an incident, not a clean rollback success: Worker rollback cannot remove Cron or undo D1, and this tooling performs neither unapproved repair.

## Approval gates and limitations

This repository candidate performs no live Cloudflare verification or mutation. Repository-recorded state can drift before execution, so every future live action requires fresh mutation-free preflight and explicit owner approval. Merge does not authorize upload. Upload success does not authorize deployment. Deployment does not authorize Cron activation. Cron activation, collector execution, real baseline collection, unchanged-cycle/changed-fact proof and D1/CPU acceptance remain later independent gates.


## Mutation-free live-preflight preparation

A separate manual-only repository path now prepares the fresh live-state read required before any future Version-upload approval. `phase4b/preflight.mjs` is a standalone read-only executable: it imports no upload/deployment helper and its API guard admits only the exact Deployments, deployable Versions, Version Detail, Schedules, Workers Domains and D1 metadata GETs plus the D1 query POST after `validateReadOnlySql`. It checks the recorded active/rollback identities, sole-Version 100% traffic, exact Version Detail/bindings/compatibility/season, empty Cron, exact hostname, Phase 1 governance and zero DATA-S2 history, the 151552-byte D1 snapshot and authenticated `shadow_only` health twice across a bounded read.

### Protected-environment selection: two failed attempts and the evidence that settled it

The environment choice was corrected twice. The sequence matters as audit evidence and is recorded here in full, in sanitized form: environment names, secret **names**, run identifiers and the fact of GitHub log masking only. No credential value is recorded anywhere in this repository.

1. **Phase 0 environment attempted.** The first dispatch, run `33170157089` on `9bbcef3044d0cce79289d992b6b094b102e34df0`, passed its repository gate and then failed closed with `phase4b_preflight_required_credentials_or_identity_missing`. Its protected job used `data-s2b-phase0-readonly`, whose job log showed `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` populated and masked but `DATA_S1_HTTP_AUTH_TOKEN`, `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` empty.
2. **Phase 2 environment selected by repository inference.** PR #177 moved the job to `data-s2b-phase2-version-upload` and mapped `CLOUDFLARE_WORKER_UPLOAD_TOKEN` into the helper's `CLOUDFLARE_API_TOKEN` variable. That selection rested on reading secret references in workflow YAML, and this document then asserted that the Phase 2 environment already supplied the Worker bearer and Access service credentials.
3. **Live execution disproved that inference.** The corrected dispatch, run `33171701995` on `fb30645440fe2a2414bf42bf1b53a9e48bc9f4c7`, passed its repository gate and failed closed with the identical error. Its job log showed exactly the same shape as the Phase 0 attempt: API token and account identity populated and masked, and `DATA_S1_HTTP_AUTH_TOKEN`, `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` empty. The earlier claim in step 2 was therefore wrong and is withdrawn: `data-s2b-phase2-version-upload` does **not** supply the health and Access credentials.
4. **Phase 3 environment selected on direct successful-run evidence.** The successful Phase 3 candidate deployment, run `33142804502`, used `data-s2b-phase3-deployment`, and its successful protected job log showed all five required variables — `CLOUDFLARE_PHASE3_DEPLOY_TOKEN`, `DATA_S1_HTTP_AUTH_TOKEN`, `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET` and `CLOUDFLARE_ACCOUNT_ID` — populated and masked as `***`. That is observed live-run credential presence, not a repository inference, and the same masking view rendered the three missing variables in both failed runs as visibly empty.

Both failed runs stopped at the helper's credential-presence gate before its first request. Each therefore performed no Cloudflare API read, no D1 query, no production health request, no Worker Version upload, no Deployment, no Cron change, no collector execution and no D1 write.

The preflight workflow now uses `data-s2b-phase3-deployment` and maps its existing `CLOUDFLARE_PHASE3_DEPLOY_TOKEN` secret into the standalone helper's unchanged `CLOUDFLARE_API_TOKEN` variable; the four retained health, Access and account mappings are unchanged. That Phase 3 credential is broader than the reads this preflight needs. It is acceptable only because `phase4b/preflight.mjs` is itself structurally incapable of issuing a mutation request: it imports no upload or deployment helper, its guard admits only the exact read GETs plus the single D1 query POST after `validateReadOnlySql`, and every Worker, Cron, route/domain, Access, secret and D1-write endpoint is rejected regardless of token scope. The executable is unchanged by this correction. Its repository gate still completes before any credential is available. A PASS summary is sanitized and reports every mutation/execution category as zero; raw API responses are neither persisted nor uploaded.

No successful Phase 4B live preflight is claimed, and no current Cloudflare, Cron, D1, Version or Deployment state is claimed as healthy or reconciled by this correction. Any dispatch requires separate explicit owner approval, and PASS would authorize no Version upload, Deployment, Cron activation or collector execution.
