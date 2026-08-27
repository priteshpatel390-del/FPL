# DATA-S2B — Phase 3 Existing-Candidate Deployment Gating

Status: **REPOSITORY SUPPORT IMPLEMENTED — NOT DISPATCHED; LIVE DEPLOYMENT REQUIRES SEPARATE OWNER APPROVAL**  
Prepared: **27 August 2026**

## Outcome and authority

This checkpoint adds the repository-controlled path for the separately approved Phase 3 design. It performs no live Cloudflare action. Latest GitHub `main` remains authoritative; the implementation must be merged, exact-main verified, and then separately approved before anyone dispatches the manual workflow.

The Phase 2 identities were reverified from the current-main closeout records and are pinned in executable tests:

- Worker: `teamsheet-data-platform`;
- current deployment: `10f7a065-3d82-4b34-9fb1-dc6c3a0be524`;
- old active/rollback Version: `5edbe951-4be4-46bc-b2cf-17b550396105`;
- existing inactive candidate: `3a2b065a-6527-4887-9bf8-b08e82e81133`.

Phase 3 creates a Cloudflare **Deployment**, not a Worker Version. Its only forward mutation body references the existing candidate at 100%. It has no percentage-canary or 0% deployment option, no `force=true`, no normal Wrangler deployment, and no mutation retry.

## Protected workflow and credential separation

`.github/workflows/data-s2b-phase3-deployment.yml` is manual-only and accepts one 40-character `approved_sha`. The first job has repository read/check permissions but no Cloudflare credentials. It requires:

1. dispatch from `refs/heads/main` in the canonical repository;
2. checkout identity equal to the supplied SHA;
3. the supplied SHA equal to current remote `main`;
4. a clean checkout; and
5. an exact-head successful `Tests and deterministic build` check from GitHub Actions.

Only after that job passes can the `data-s2b-phase3-deployment` protected environment release the deployment token, account ID, retained Worker bearer token and Access service-token credentials. The environment must require owner review. Its Cloudflare API token must be limited to the read surfaces used by pre/postflight plus Workers Deployments write; it must not have Worker Script edit/version upload, D1 write, route/domain, Access, secret or trigger write permissions.

## Fail-closed preflight

Before any mutation, the helper requires in one bounded live read:

- the exact old deployment/version remains active;
- the candidate is latest, exists, and is inactive; the rollback version remains in deployable history;
- active identity comes from Deployments and its bindings from exact Version Detail, never `/settings`;
- active Version Detail contains exactly the same D1 binding and retained `secret_text`, with no season variable;
- candidate Version Detail contains exactly that D1 and retained secret plus `DATA_S2_SEASON=2026-27`;
- candidate compatibility date is `2026-08-22`;
- both versions reference the same D1 UUID;
- Cron is empty;
- Phase 1 migrations, Official FPL governance and revision state are exact;
- `ingestion_runs=0`, `shadow_observations=0`, `observation_heads=0`, and `canonical_entities=0`;
- D1 size is exactly the accepted `151552`-byte current-main baseline;
- the only Custom Domain assigned to this Worker is `data.fpltsheet.co.uk`.

Any failure produces **PHASE 3 FAIL** before mutation. Zone route inspection is not claimed because the established credential contract has no zone identifier/scope. Access policy configuration is not read directly; successful authenticated production health after activation proves the existing Access/service-token path remains usable, while exact Custom Domain reads prove the account-level Worker-domain surface available to this token. These are explicit limitations, not silent passes.

## Mutation and postflight

The forward mutation submits one `POST /accounts/{account}/workers/scripts/teamsheet-data-platform/deployments` with percentage strategy containing only candidate `3a2…1133` at `100`.

After reconciliation, postflight requires twice (with authenticated health between the reads):

- the candidate is the sole 100% active Version;
- ordered deployable Version History is byte-for-byte unchanged, proving no Worker Version was created;
- candidate bindings and compatibility remain exact;
- Cron remains empty;
- Custom Domain state remains exact and unchanged;
- Phase 1 D1 logical state and the 151552-byte size remain exact;
- authenticated `GET https://data.fpltsheet.co.uk/v1/health` succeeds through Access plus the retained Worker bearer boundary and returns `ok=true`, `mode=shadow_only`.

No collector or POST ingestion request runs. A successful sequence reports **PHASE 3 PASS**.

## One-shot rollback and ambiguous responses

Any required postflight invariant failure after candidate activation triggers one rollback Deployment referencing only `5edb…6105` at 100%. The helper then re-runs the immutable Version, binding, Cron, domain and D1 checks. It performs no D1 restore. A verified restore reports **ROLLBACK PASS** and deliberately leaves the workflow failed so candidate acceptance cannot be mistaken for success.

A transport failure, invalid response or server error from a Deployment mutation is treated as ambiguous. The helper performs a read-only Deployments reconciliation and never blindly repeats that mutation. It continues only if the intended target is already active. Previous, mixed, inaccessible or unexpected state produces **UNRESOLVED/STOP**. At most one candidate Deployment and one rollback Deployment can be submitted.

## Outcome definitions

- **PHASE 3 PASS** — candidate alone is active at 100% and every required postflight invariant passed.
- **PHASE 3 FAIL** — preflight or a definite submission failed without candidate activation; no accepted Phase 3 deployment is claimed.
- **ROLLBACK PASS** — candidate postflight failed, the single rollback ran, and the old Version is again the sole active Version with rollback invariants intact.
- **UNRESOLVED/STOP** — mutation/state is ambiguous, unexpected or cannot be proven; do not retry or continue automatically.

## Explicit exclusions and next gate

This implementation has no path for Version upload/deletion, Cron mutation, D1 write/migration/restore, collector execution, POST ingestion, route/domain/Access/secret mutation, provider/data-source change, application change, or model/calculation change. Phase 4 Cron activation and collection remain separately unapproved.

The exact next approval required is: after this draft PR is reviewed, exact-head green, explicitly approved and merged, and the merge commit has an exact-main Verify Teamsheet success, the owner must separately approve **one manual Phase 3 workflow dispatch for that exact main SHA and release of the protected `data-s2b-phase3-deployment` environment**. No dispatch is approved by repository implementation or merge alone.
