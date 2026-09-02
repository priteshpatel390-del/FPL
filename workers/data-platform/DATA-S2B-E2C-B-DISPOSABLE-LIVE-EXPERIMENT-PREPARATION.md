# DATA-S2B-E2C-B — disposable live experiment preparation and acceptance hardening

## Outcome and boundary

E2C-B is repository-only preparation. It hardens E2C-A and adds a dormant manual workflow for one future, separately owner-approved experiment. This checkpoint contacted no Cloudflare endpoint, created no resource or credential, configured no GitHub environment/secret, dispatched no workflow, mutated no D1, performed no cleanup and proves no live D1 behaviour.

## Acceptance hardening

* The protected environment supplies independent canonical `sha256:<64 lowercase hex>` fingerprints for the owner-approved disposable account, owner-approved disposable database and production account. Before any request, the runner hashes the runtime raw disposable database UUID and requires it to match the independently approved database fingerprint. The live adapter likewise requires the runtime raw disposable account ID to hash exactly to the approved disposable-account fingerprint and requires that fingerprint to differ from production. The raw production account ID is neither required nor retained.
* P01–P07 acceptance checks the exact repository-owned returned row count, keys, SQLite types, values, binary/numeric comparisons and native JSON/null semantics. `P-STORAGE-READ` checks both exact rows, order, storage classes and values. HTTP success without these semantics is failure.
* Provider metadata preserves `null` when `rows_read`, `rows_written`, `changes`, `duration` or `total_attempts` is absent and preserves genuine zero. Supplied values must be finite, non-negative bounded values. Evidence retains only these bounded aggregates and closed classifications.
* Evidence records the canonical start before execution. Only after the awaited contract succeeds or fails does the runner capture one canonical completion timestamp and finalize every sanitized evidence row with that genuine end; callers cannot pre-supply an end time.
* The existing E2C-A plan order, SQL and single-dispatch mutation/reconciliation rules are unchanged.

### Pre-mutation diagnostic hardening

The first live attempt (`33590874792`) passed identity and metadata validation but stopped at `e2_initial_schema_inspection_failed` before semantic schema validation or mutation. Its deliberately narrow report retained no underlying decoder classification. A future separately approved attempt therefore retains exactly one closed pre-mutation diagnostic when metadata or initial-schema decoding fails. The diagnostic has only these fields: `stage` (`metadata` or `initial_schema`); `reason` (one of `success`, `transport_exception`, `http_status`, `json_parse`, `malformed_envelope`, `top_level_failure`, `result_count`, `result_success`, `unsuccessful_result`, `invalid_results`, `malformed_meta`, `identity_mismatch`); the existing closed response `classification`; nullable HTTP status from 100 through 599; three boolean/nullable top-level parsing fields; expected and nullable observed result counts bounded to 0 through 40; four failure counts bounded to 0 through 40; and a nullable first failing result index bounded to 0 through 20. Unknown keys, values, types and ranges are rejected before serialization.

The diagnostic never retains headers, URLs, tokens, account/database identifiers, SQL, parameters, request or response bodies, provider messages, arbitrary JSON, stack traces, unrestricted strings, unrestricted numbers or arbitrary nested objects. It changes no endpoint, request, SQL, response acceptance or schema semantics. Ordering remains metadata, initial inspection, semantic initial-schema validation, then setup. An unexpected schema object remains `e2_initial_schema_rejected`, not a decoder diagnostic failure.

Run `33590874792` is frozen evidence and must not be rerun. Its database remains quarantined and its token remains retained but unused pending separately approved closeout. Any future experiment requires a fresh disposable database, a new independently approved fingerprint, explicit owner approval and a new attempt-1 dispatch.

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

## Attempt 2 initial-inspection compatibility correction

The separately approved attempt 2 stopped on the untouched disposable database with HTTP 400 for the 21-statement INITIAL request. Offline reconstruction showed that its REST envelope and 21-statement size conform to Cloudflare's current D1 API schema, but 15 introspection statements passed table names as bound arguments to `pragma_table_xinfo(?)`, `pragma_index_list(?)`, and `pragma_foreign_key_list(?)`. Cloudflare's current D1 SQL documentation instead documents literal-name PRAGMA forms, while Cloudflare's own D1 observability query demonstrates that table-valued PRAGMA functions and correlated literal/column arguments are supported. The compatibility correction therefore retains the same table-valued read queries and cardinality but embeds quote-safe SQL string literals generated exclusively from the five fixed `E2_APPROVED_TABLES`; it removes only those 15 pragma parameters.

This does not broaden SQL authority or schema acceptance. The literal helper rejects every value outside the repository allowlist, all 21 statements remain read-only, the object/column/index/collation/foreign-key/CHECK validator is unchanged, and metadata → INITIAL → semantic validation → setup ordering is unchanged. The HTTP 400 remains a fail-closed transport classification and is not tolerated. This correction was derived without a Cloudflare request; it requires owner review, merge, exact-main verification, and a separate decision before any further live activity.

### Attempt 2 follow-up: D1 `/query` multi-statement envelope

Attempt 2 (`33599682380`) proved the literal PRAGMA correction did not change the INITIAL HTTP 400. Inspection then isolated a request-envelope incompatibility shared by the E2 adapter and the offline E1 client: multi-statement `/query` calls were serialized as `{batch:[...]}`, whereas the D1 REST query endpoint accepts a top-level array of query objects (and a single query object for one statement). The provider rejected the envelope before evaluating any of the 21 repository-owned read-only statements, so no mutation occurred.

The narrow correction changes only multi-statement serialization to the top-level array. It preserves the single-statement request, SQL, parameters, order, 21-result INITIAL contract, semantic validation and every mutation/reconciliation rule. Removing the wrapper changes deterministic serialized profiles by exactly ten bytes: the representative request is `3,688,865` bytes and W01 is `2,378,742` bytes. Permanent tests require the array shape and continue to prove deterministic statement and parameter order.
