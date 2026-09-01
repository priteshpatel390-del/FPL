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
* The closed future composition accepts only authority, credential, fake/future fetch, exact source identity and canonical UTC timestamps. Every D1 query—including the 21-statement semantic-schema inspection—is a repository-authentic plan serialized by the adapter, decoded from strict Cloudflare-shaped HTTP/JSON by a repository-owned decoder, and interpreted by the orchestrator; no workflow-side SQL, body, classification, provider parsing or schema interpretation is required.
* The decoder requires exact result cardinality and per-statement booleans, distinguishes success, known SQL/provider failure, auth, rate, malformed, transport and unknown-mutation outcomes, and extracts only bounded aggregate metadata. W01 completion uses the last statement's decoded `meta.changes` and still requires exactly one affected row.
* CHECK canonicalisation is quote-aware: insignificant case/whitespace outside literals is normalized, while single-quoted contents and doubled quote escapes are preserved exactly. Evidence timestamps must be valid canonical `YYYY-MM-DDTHH:mm:ss.sssZ` values.
* Before the first mutation, the closed HTTP composition must decode the exact-database metadata GET and match its returned UUID/name, then execute the authentic schema-inspection plan against the untouched database and accept only the closed INITIAL object allowlist. After setup, the same inspection rejects every extra table, index, view, trigger or unknown system-looking object in addition to enforcing the five-table semantic contract.

## Next gate

Owner review and merge approval are required. Any live disposable resource, credential, workflow/environment, Cloudflare request or experiment requires a new explicit approval after exact-main verification. Cleanup remains separately manual and approved.

## E2C-B successor note

E2C-B supersedes E2C-A only at the live acceptance boundary: production-account fingerprint presence is mandatory, affinity/storage returned values require exact semantic acceptance, absent provider metadata remains distinct from zero, and bounded `total_attempts` may be retained. E2C-A ordering and SQL plans remain unchanged. See [E2C-B preparation](DATA-S2B-E2C-B-DISPOSABLE-LIVE-EXPERIMENT-PREPARATION.md).
