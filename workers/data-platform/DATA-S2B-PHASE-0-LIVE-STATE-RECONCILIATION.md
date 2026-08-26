# DATA-S2B — Phase 0 Live-State Reconciliation

Status: **repository correction candidate after first live read-only execution; no Cloudflare mutation authorised or performed**  
Date: **26 August 2026**  
Execution base: `170f7a0beef4227fa71daf9d5a8b49f9181f6d31`  
Live run: **DATA-S2B Phase 0 Read-Only Preflight #2 / `32987063427`**

## Outcome

The first Phase 0 run to pass the immutable repository gate and receive owner approval reached Cloudflare successfully and then failed closed with:

`worker_binding_set_drift`

The failure was not a credential failure. The protected job received both GitHub environment secrets, checked out the exact approved commit, and reached the Worker settings read. It stopped before the D1 database inspection, so D1 Read permission and the intended D1 schema/migration/count prestate remain unproved by that run.

No Worker deployment, version upload/deploy, Cron change, D1 migration/write, route/domain/Access change, secret change, provider change or model/runtime change occurred.

## Owner-supplied live dashboard evidence

After the safe failure, owner-supplied Cloudflare dashboard evidence showed:

- Worker `teamsheet-data-platform` still has D1 binding `TEAMSHEET_DATA_DB` -> `teamsheet-data`;
- encrypted Worker secret binding `DATA_S1_HTTP_AUTH_TOKEN` is retained;
- `DATA_S2_SEASON` was not visible among live runtime variables/secrets.

The secret value was neither exposed nor requested. The retained DATA-S1 secret is historical/rollback material under the current DATA-S1C-R architecture and is not deleted by DATA-S2B Phase 0.

## Root cause

The merged Phase 0 helper applied the **post-DATA-S2 deployment** binding contract too early. It required exactly:

- `TEAMSHEET_DATA_DB` (`d1`); and
- `DATA_S2_SEASON` (`plain_text`),

while rejecting every additional binding.

That contradicted the DATA-S2B live acceptance plan for Phase 0, which requires inspection of the **pre-mutation** state and specifically expects `DATA_S2_SEASON` not to be live unless previously approved. It also incorrectly rejected the separately retained DATA-S1 rollback secret.

## Corrected phase contracts

The repository correction keeps two explicit contracts rather than weakening the existing post-deployment invariant.

### Phase 0 pre-mutation contract

Required:

- `TEAMSHEET_DATA_DB` with Cloudflare type `d1`.

Permitted retained rollback binding:

- `DATA_S1_HTTP_AUTH_TOKEN` with Cloudflare type `secret_text`.

Required absent:

- `DATA_S2_SEASON`; any live binding with this name stops with `season_var_unexpectedly_live`.

Every unknown extra binding, duplicate name, wrong type or missing D1 binding remains fail-closed as `worker_binding_set_drift`. The helper checks only the retained secret's name/type/presence and never reads or summarizes its value.

### Post-mutation contract

The existing strict post-deployment invariant remains unchanged: exactly `TEAMSHEET_DATA_DB` (`d1`) plus `DATA_S2_SEASON` (`plain_text`) and no additional binding. This contract remains relevant to later separately approved deployment acceptance; Phase 0 no longer pretends it is already live.

## Tests

A dedicated regression suite covers the live-state correction:

- required D1 alone is accepted for Phase 0;
- D1 plus the retained DATA-S1 secret is accepted in either order;
- a throwing getter proves Phase 0 never reads the retained secret value;
- a live `DATA_S2_SEASON` fails closed;
- missing D1, duplicate bindings, wrong types and unknown KV/R2/service/secret bindings fail closed;
- an unknown phase fails closed;
- the executable Phase 0 path is pinned to the pre-mutation contract and safe presence/absence-only summary.

The original Phase 0 suite is retained unchanged so the post-mutation binding contract and all existing SQL, Cloudflare response-shape, redaction, identity, rollback, Cron, migration and no-mutation invariants remain permanent coverage.

Focused local evidence for the correction is **28 tests passed, 0 failed, 0 skipped, 0 cancelled** across the original Phase 0 suite plus the new reconciliation suite. Full repository acceptance still requires the exact branch head to pass `./run-tests.sh`, the production build and deterministic-build/provenance gates in Verify Teamsheet.

## Manual GitHub environment hardening still required

The protected environment was created with required owner review and administrator bypass disabled, but its deployment branch/tag setting remained `No restriction`. The workflow itself separately proved `refs/heads/main`, canonical repository identity and exact current `main`, so this did not cause the live failure. Before the next live Phase 0 dispatch, the environment should nevertheless be restricted to `main` to match the merged implementation record's defense-in-depth requirement.

This is a manual owner setting, not a repository or Cloudflare mutation.

## Next gate

This correction authorises no rerun by itself. Required sequence:

1. review and merge this repository correction only after exact-head Verify Teamsheet passes and the owner explicitly approves the draft PR;
2. verify post-merge `main` and exact-merge Verify Teamsheet;
3. manually restrict the protected GitHub environment to `main`;
4. obtain a separate explicit owner approval for another Phase 0 live read-only dispatch;
5. only if Phase 0 completes and its evidence is reviewed may a later mutation proposal be presented.

Migration 0002, Worker Versions upload/deployment and Cron activation remain separately approval-gated. DATA-S3, provider changes, production enrichment and every model/calculation change remain excluded.
