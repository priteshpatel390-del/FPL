# DATA-S2B-E2C-B — disposable live experiment preparation and acceptance hardening

## Outcome and boundary

E2C-B is repository-only preparation. It hardens E2C-A and adds a dormant manual workflow for one future, separately owner-approved experiment. This checkpoint contacted no Cloudflare endpoint, created no resource or credential, configured no GitHub environment/secret, dispatched no workflow, mutated no D1, performed no cleanup and proves no live D1 behaviour.

## Acceptance hardening

* The protected environment supplies independent canonical `sha256:<64 lowercase hex>` fingerprints for the owner-approved disposable account, owner-approved disposable database and production account. Before any request, the runner hashes the runtime raw disposable database UUID and requires it to match the independently approved database fingerprint. The live adapter likewise requires the runtime raw disposable account ID to hash exactly to the approved disposable-account fingerprint and requires that fingerprint to differ from production. The raw production account ID is neither required nor retained.
* P01–P07 acceptance checks the exact repository-owned returned row count, keys, SQLite types, values, binary/numeric comparisons and native JSON/null semantics. `P-STORAGE-READ` checks both exact rows, order, storage classes and values. HTTP success without these semantics is failure.
* Provider metadata preserves `null` when `rows_read`, `rows_written`, `changes`, `duration` or `total_attempts` is absent and preserves genuine zero. Supplied values must be finite, non-negative bounded values. Evidence retains only these bounded aggregates and closed classifications.
* Evidence records the canonical start before execution. Only after the awaited contract succeeds or fails does the runner capture one canonical completion timestamp and finalize every sanitized evidence row with that genuine end; callers cannot pre-supply an end time.
* The existing E2C-A plan order, SQL and single-dispatch mutation/reconciliation rules are unchanged.

## Manual preparation — not performed by this checkpoint

An owner must separately approve and manually perform all preparation:

1. Create a truly disposable, empty D1 database outside the production account and record its exact generated name matching `teamsheet-data-e2-rest-validation-YYYYMMDD-xxxxxx` and UUID without placing either raw value in repository files, logs or discussion evidence.
2. Create a least-privilege, short-lived token limited to the disposable account/database operations needed by the fixed adapter. Do not reuse a production token.
3. Independently compute the approved disposable-account fingerprint, disposable-database UUID fingerprint and production-account fingerprint locally as lowercase SHA-256 in `sha256:<hex>` form. Confirm the account fingerprints differ. Retain the raw production account ID outside GitHub and outside experiment evidence.
4. Create the protected GitHub environment named exactly `data-s2b-e2c-b-live-experiment`, require owner approval, and add secrets `CLOUDFLARE_E2C_DISPOSABLE_TOKEN`, `CLOUDFLARE_E2C_ACCOUNT_ID`, `CLOUDFLARE_E2C_DATABASE_ID`; add variables `CLOUDFLARE_E2C_DATABASE_NAME`, `CLOUDFLARE_E2C_APPROVED_ACCOUNT_FINGERPRINT`, `CLOUDFLARE_E2C_APPROVED_DATABASE_FINGERPRINT` and `CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT`.
5. Re-read current `main`, require its exact Verify Teamsheet check to be successful, obtain explicit approval for that exact SHA, then dispatch once from `main`. Never rerun a run: a new attempt is rejected and any further experiment needs a new owner decision.

The workflow retains for 14 days only the sanitized E2C-B JSON report. It must never retain a token, authorization header, raw account ID, raw database UUID, SQL, params, request/response body or arbitrary provider error.

## Separate manual cleanup — never automated

Cleanup is a later owner-approved manual activity after evidence review. Do not add cleanup to the experiment workflow. Manually delete only the exact disposable D1 database after independently confirming its fingerprint/name, revoke the dedicated token, remove the temporary protected-environment secrets/variables and then record only sanitized completion classifications. Production resources, tokens, routes, Workers, Cron, Access and databases must remain untouched. Ambiguous experiment outcomes do not authorize cleanup; reconcile identity and state separately first.

## Remaining gate

Merge and exact-main verification do not authorize execution. Resource/token/environment preparation, one workflow dispatch, evidence acceptance and cleanup each remain separate manual owner gates. No live experiment may be claimed until sanitized evidence has been reviewed against this contract.
