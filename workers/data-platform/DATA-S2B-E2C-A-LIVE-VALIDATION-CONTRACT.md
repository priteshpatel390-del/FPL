# DATA-S2B-E2C-A — repository-only live-validation contract

## Checkpoint

E2C-A implements permanent, inert machinery for a later separately approved disposable-D1 experiment. It does not execute the experiment and proves no live REST atomicity, affinity, request-size, or production architecture behaviour.

## Contracts

* W00 separately inserts the exact `e2-run-full-write` started row; read-only reconciliation is mandatory before unchanged 24-statement W01. W01's actual serialized mutation is 2,378,752 bytes. The separate 3,688,875-byte constant is the 100% read-only body-limit profile (with 4,611,094 bytes as 125%); these metrics are intentionally not interchangeable.
* W01 reconciliation requires 1,064 entities, 9,860 observations, 9,860 heads, zero orphan heads, one completed run accepting 9,860 records, and one affected completion row.
* Direct binding, numeric conversion, binary text ordering, numeric ordering, native JSON types and controlled existing-schema storage affinity have repository-owned plans.
* Repository DDL identity remains distinct from both the repository-owned expected semantic-schema fingerprint and the observed live semantic-schema fingerprint. Setup accepts only equality of the latter two across ordered columns, types, nullability, defaults, PK positions, indexes/uniqueness/collations, foreign keys/actions and normalized CHECK expressions.
* Initial objects use a closed allowlist. Exact source, account, production-account deny, disposable name, database fingerprint and schema gates fail closed.
* The inert HTTP adapter exposes only exact-database metadata GET and authentic repository-plan query POST. It validates the disposable identity, binds exact raw IDs to approved fingerprints, and serializes trusted plans internally; callers cannot provide SQL or request bodies. It has no discovery, creation, deletion, deployment, Worker, Access, secret, domain or route authority.
* The state machine orders all read gates before A01/A02/A03, isolated affinity mutation, W00 and W01. A01 requires successful execution plus `COMPLETE_SUCCESS`; deliberately failing A02/A03 require known provider/SQL failure plus `FULL_ROLLBACK`. Every mutation is dispatched at most once; ambiguity performs its predetermined read-only reconciliation exactly once for evidence and then stops.
* Evidence stores hashes, masks, allowlisted bounded counts and closed classifications, never credentials, raw identifiers, SQL, parameters, request/response bodies, arbitrary provider objects or provider errors. Cleanup is always `NOT_PERFORMED_BY_E2C_A`.

## Next gate

Owner review and merge approval are required. Any live disposable resource, credential, workflow/environment, Cloudflare request or experiment requires a new explicit approval after exact-main verification. Cleanup remains separately manual and approved.
