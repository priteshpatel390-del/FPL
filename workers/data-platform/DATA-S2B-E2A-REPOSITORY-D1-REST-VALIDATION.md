# DATA-S2B-E2A — Repository-only disposable D1 REST validation harness

Status: **repository-only review candidate; no live validation or Cloudflare approval**
Base: `3cb59436309bb9485d6617828db4b420cadebdd5`

## Outcome

E2A supplies a deterministic, synthetic-only planning module and fake-transport harness. It is deliberately separate from E1's module-private Official FPL plans. It adds no production transport, URL, authorization construction, environment access, workflow, migration, Wrangler change, deployment or Cloudflare operation.

The production firewall requires exact approved account and database fingerprints, rejects an optionally configured production-account fingerprint, accepts only database names matching `^teamsheet-data-e2-rest-validation-\d{8}-[a-z0-9]{6}$`, explicitly rejects `teamsheet-data`, requires the exact `e2-rest-validation-schema-v1` fingerprint, requires an empty initial schema, and after setup accepts only the five declared `e2_*` tables. Six production table names are always rejected.

## Synthetic plans

Atomicity plans include a three-insert success case, a middle runtime CHECK failure (`valid_value = 2`), and a middle invalid-SQL case. A separately constructed read-only reconciliation classifies `FULL_ROLLBACK`, `PARTIAL_WRITE`, `COMPLETE_SUCCESS`, or `AMBIGUOUS`. These plans make a future experiment precise; they do not prove REST batch atomicity.

Affinity plans bind every direct parameter as a string: `42`, `3.125`, `0042`, `0`, `1`, timestamp text, JSON text, and negative-characterisation strings `true`/`false`. A `json_each(?)` plan inspects JSON integer, real, string, boolean and null extraction. A deterministic large JSON parameter remains below E1's 2,000,000-byte value guard. E2A does not prove real D1 affinity.

The representative statement count is derived from the unchanged E1 mechanics: one entity statement, `ceil(9860/600) = 17` observation statements, `ceil(9860/2000) = 5` head statements and one completion statement, totalling **24**. Read-only profiles cover 1, 10, 24, 35 and 40 statements; 41 is rejected.

Exact serialized read-only body profiles are **922,219**, **1,844,438**, **2,766,656**, **3,688,875**, and **4,611,094** bytes. Larger profiles split deterministic padding across string parameters below the per-value guard. These are Teamsheet test shapes, not discovered or claimed Cloudflare limits.

The full-write analogue contains 1,064 synthetic entities and 9,860 synthetic observations, including string affinity and nulls. Its 24 statements mirror entity insertion, 17 observation JSON chunks, five head/upsert JSON chunks and finalisation. It contains no production table, source/revision identity, provider payload, player/team/fixture name, or migration.

## Outcome safety and evidence

The harness requires an injected function and performs exactly one dispatch. It has no default `fetch`, network address or retry mechanism. Outcomes are classified as success, known SQL/provider failure, mutation outcome unknown, malformed provider response, rate limited, auth failure or transport failure. Mutation ambiguity, 429, malformed response and connection failure are never retried. Reconciliation remains a separate read-only plan.

Evidence contains only fixed metadata, masked SHA-256 fingerprint prefixes, schema fingerprint, statement/body counts, bounded classifications and aggregate counts. It contains no token, Authorization header, raw account/database identity, SQL, request body, provider response or provider error body.

## Explicit limitations and next gate

1. E2A does **not** prove REST batch atomicity.
2. Worker `db.batch()` transactional documentation is not proof for REST `/query` batches.
3. E2A does **not** prove real D1 affinity behaviour.
4. E2A does **not** prove practical REST body-size limits.
5. E2A does **not** approve GitHub Actions to D1 REST as production architecture.
6. E2A does **not** solve Cloudflare's account-level D1 Write blast radius.
7. No Cloudflare account, resource or token was contacted, inspected or created.
8. No production data was read or mutated.
9. No Cron was changed.
10. E2B, E2C and E2D each require separate explicit owner approval.

The exact E2B gate is a new owner-approved investigation/design checkpoint after review and merge of E2A. E2A itself authorises no Cloudflare inspection, credential, workflow or disposable-D1 operation.
