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

Before its sole possible mutation, the upload helper validates the exact Worker/config/module graph, compatibility date `2026-08-22`, season `2026-27`, active Version `3a2b065a-6527-4887-9bf8-b08e82e81133`, retained rollback Version `5edbe951-4be4-46bc-b2cf-17b550396105`, exact D1 and retained secret binding shapes, empty Cron, Phase 1 governance and zero history state, and recorded D1 size `151552` bytes. It computes SHA-256 identity for exact module bytes and deterministic metadata.

Its executable mutation allowlist admits only `POST /accounts/{account}/workers/scripts/teamsheet-data-platform/versions?bindings_inherit=strict`. An ambiguous response is reconciled with a read-only Version-list delta; it is never blindly retried. Postflight requires exactly one new Version, exact Version Detail/bindings/compatibility, unchanged Deployment, empty Cron, unchanged D1 state and size. Cloudflare Version Detail and the script etag, when the upload response supplies one, are captured as evidence about the created artifact; the repository does not claim Cloudflare provides complete recoverable original source.

## Deployment contract

The deployment workflow requires three explicit identities: approved repository SHA, owner-approved candidate Version ID, and expected currently active Version ID. The helper accepts only a percentage body containing one Version at 100%. Its executable mutation allowlist admits only `POST /accounts/{account}/workers/scripts/teamsheet-data-platform/deployments`.

Preflight validates the expected active/rollback identity, candidate and rollback Version Details, immutable Version History, exact production hostname, empty Cron, authenticated `shadow_only` health, Phase 1 governance/zero history and D1 size. Health and immutable reads bracket mutation. Postflight requires the candidate alone at 100%, unchanged Version History/hostname/Cron/D1 and healthy authenticated HTTP.

At most one rollback Deployment may target the exact supplied pre-approved prior Version. Ambiguous Deployment responses are reconciled read-only. Unexpected Cron or D1 mutation is an incident, not a clean rollback success: Worker rollback cannot remove Cron or undo D1, and this tooling performs neither unapproved repair.

## Approval gates and limitations

This repository candidate performs no live Cloudflare verification or mutation. Repository-recorded state can drift before execution, so every future live action requires fresh mutation-free preflight and explicit owner approval. Merge does not authorize upload. Upload success does not authorize deployment. Deployment does not authorize Cron activation. Cron activation, collector execution, real baseline collection, unchanged-cycle/changed-fact proof and D1/CPU acceptance remain later independent gates.
