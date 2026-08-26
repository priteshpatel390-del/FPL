# DATA-S2B — Phase 0 Live-State Reconciliation

Status: **second repository correction candidate after live read-only Runs #2 and #3; no Cloudflare mutation authorised or performed**  
Date: **26 August 2026**  
Current correction base: `8e1dbe69b891f51abc8f2a286a5e18da3c0f53aa`  
Latest live run: **DATA-S2B Phase 0 Read-Only Preflight #3 / `32992081282`**

**Supersession note:** for current DATA-S2B Phase 0 status, this record supersedes older wording that says the workflow has never been executed live, that `DATA_S2_SEASON` must already be present during Phase 0, or that the D1 database identity should be established by requiring a name-search list response to contain exactly one record. Dated implementation history remains valid. No mutation gate is advanced by this record.

## Outcome

Two owner-approved live read-only executions have now exposed two separate repository-contract defects while failing closed before any Cloudflare mutation.

### Run #2 — Worker pre-mutation binding contract

Run #2 passed the immutable repository gate and reached Cloudflare, then stopped with:

`worker_binding_set_drift`

Owner-supplied Cloudflare dashboard evidence showed the live pre-mutation Worker legitimately retained:

- D1 binding `TEAMSHEET_DATA_DB` -> `teamsheet-data`;
- encrypted rollback secret binding `DATA_S1_HTTP_AUTH_TOKEN`;
- no live `DATA_S2_SEASON` variable.

The first reconciliation corrected Phase 0 to require the D1 binding, permit the known retained DATA-S1 secret by name/type only, require `DATA_S2_SEASON` to remain absent pre-mutation, and continue to reject unexplained binding drift. PR #163 merged that correction. The exact merge `8e1dbe69b891f51abc8f2a286a5e18da3c0f53aa` subsequently passed Verify Teamsheet #407.

### Run #3 — D1 identity resolution

Run #3 was dispatched only after PR #163 merge verification and after the protected GitHub environment was manually restricted to branch `main`. The run:

- used exact `main` SHA `8e1dbe69b891f51abc8f2a286a5e18da3c0f53aa`;
- passed `repository-gate`;
- passed the corrected pre-mutation Worker binding checks;
- confirmed the expected pre-mutation Cron state far enough to proceed to D1 identity resolution;
- then stopped with:

`database_identity_drift`

The helper had called Cloudflare's D1 database list endpoint with `name=teamsheet-data` and required the returned list to contain exactly one record named `teamsheet-data`. It stopped there before the exact-UUID D1 details request and before any D1 schema/query checks.

No Worker deployment, version upload/deploy, Cron change, D1 migration/write, route/domain/Access change, secret change, provider change or model/runtime change occurred in Run #3.

## Owner-supplied D1 dashboard evidence after Run #3

The owner then inspected Cloudflare manually without editing or querying data.

The account D1 list visibly contained three databases:

- `teamsheet-data`;
- `teamsheet-data-s1b-validation-20260822`;
- `teamsheet-evidence-archive-evidence-db`.

The owner opened the exact `teamsheet-data` database and recorded its dashboard database UUID from the URL. The page showed an existing populated database (11 tables and approximately 152 kB current storage at the time of inspection).

Separately, the owner opened Worker `teamsheet-data-platform` -> **Bindings** -> `TEAMSHEET_DATA_DB`. Cloudflare navigated from that Worker binding directly to a D1 database dashboard URL. The database UUID in that URL was **the same UUID** as the independently opened `teamsheet-data` database.

Therefore the live facts are:

1. `TEAMSHEET_DATA_DB` exists and exposes a concrete `database_id`;
2. the Worker binding points to the genuine `teamsheet-data` D1 database;
3. a separate similarly named validation database also exists;
4. the Run #3 failure occurred before the helper compared/used the bound UUID as the identity source.

The live UUID is intentionally **not** hard-coded into repository configuration or this record. Phase 0 must discover it from the Worker binding on every execution.

## Root cause of Run #3

The list endpoint's `name` parameter was being used as though it were an exact unique identity lookup. That is unnecessarily fragile when the Worker settings response already supplies the D1 binding's `database_id`.

Requiring the search/list response itself to contain exactly one row can produce a false negative when a separate database has a similar searchable name. More importantly, the list search is not needed to establish the identity of the database the Worker will actually use.

This is a repository preflight defect, not evidence of a mis-bound live Worker.

## Corrected D1 identity contract

Phase 0 now uses the stronger provider-native identity chain:

1. read Worker settings;
2. require exactly one valid `TEAMSHEET_DATA_DB` binding with Cloudflare type `d1` and a non-empty `database_id`;
3. treat that binding UUID as the database identity source;
4. call Cloudflare **Get D1 Database** for that exact UUID;
5. require the response UUID to equal the bound UUID;
6. require the response name to equal exactly `teamsheet-data`;
7. only then continue to fixed read-only schema/migration/count queries against that same UUID.

The executable Phase 0 path no longer depends on `GET /d1/database?name=teamsheet-data` returning a uniquely sized search result.

This is fail-closed, not permissive: a missing/invalid Worker database ID, exact-UUID lookup failure, UUID mismatch, or a bound database whose exact name is not `teamsheet-data` still stops Phase 0 before D1 queries.

### Reuse Before Build classification

- **Adopt:** Cloudflare's existing Worker D1 `database_id` binding plus exact Get Database-by-ID contract as the identity mechanism.
- **Adapt:** retain existing fail-closed response validation, redaction and read-only query controls around that provider-native identity.
- **Reject:** custom identity registries, hard-coded live UUIDs, and D1 name-search list cardinality as the authoritative identity check.

## Worker binding contracts remain unchanged

### Phase 0 pre-mutation contract

Required:

- `TEAMSHEET_DATA_DB` with Cloudflare type `d1`.

Permitted retained rollback binding:

- `DATA_S1_HTTP_AUTH_TOKEN` with Cloudflare type `secret_text`.

Required absent:

- `DATA_S2_SEASON`; any live binding with this name stops with `season_var_unexpectedly_live`.

Every unknown extra binding, duplicate name, wrong type or missing D1 binding remains fail-closed as `worker_binding_set_drift`. The helper checks only the retained secret's name/type/presence and never reads or summarizes its value.

### Post-mutation contract

The existing strict post-deployment invariant remains unchanged: exactly `TEAMSHEET_DATA_DB` (`d1`) plus `DATA_S2_SEASON` (`plain_text`) and no additional binding. It remains relevant only to later separately approved deployment acceptance.

## Regression coverage

The permanent Phase 0 tests now pin both live-state corrections.

Worker pre-mutation coverage continues to prove:

- required D1 alone is accepted;
- D1 plus the retained DATA-S1 secret is accepted in either order;
- Phase 0 never reads the retained secret value;
- a live `DATA_S2_SEASON` fails closed;
- missing D1, duplicate bindings, wrong types and unknown bindings fail closed.

D1 identity coverage now proves:

- the executable path takes `databaseId` from the Worker D1 binding;
- the exact Get Database-by-UUID endpoint is used;
- the executable path does not use `?name=teamsheet-data` for identity;
- exact UUID + exact `teamsheet-data` name succeeds;
- UUID mismatch fails closed;
- the similarly named `teamsheet-data-s1b-validation-20260822` database fails the exact-name check even if presented with the expected UUID;
- the database UUID remains excluded from summaries/debug output.

Full repository acceptance still requires the exact branch head to pass Verify Teamsheet, including `./run-tests.sh`, production build, deterministic-build and provenance gates.

## GitHub environment hardening

The protected environment `data-s2b-phase0-readonly` is now manually restricted to deployment branch `main` in addition to its existing required reviewer gate. Administrator bypass remains disabled. This hardening was completed before Run #3 and was not the cause of either live failure.

## Remaining unproved Phase 0 evidence

Run #3 stopped before D1 schema/query inspection. The following live evidence therefore remains unproved by the automated Phase 0 workflow:

- exact live DATA-S1 schema compatibility;
- `schema_migrations` contents;
- migration 0002 pending state;
- source-governance prestate;
- Official FPL history absence/counts;
- observation/head/entity counts;
- database size from the read-only API details path;
- optional domain/metrics evidence that occurs later in the helper.

The manual dashboard inspection proves binding/database identity only; it does not substitute for those later automated acceptance checks.

## Next gate

This repository correction authorises no live rerun or mutation by itself. Required sequence:

1. review the correction on its isolated branch;
2. require exact-head Verify Teamsheet success;
3. open/review the draft PR and merge only with explicit owner approval;
4. verify the resulting exact `main` SHA and exact-merge Verify Teamsheet;
5. obtain a separate explicit owner approval for another Phase 0 live read-only dispatch on that exact `main` SHA;
6. review the complete Phase 0 evidence before presenting any live mutation proposal.

Migration 0002, Worker Versions upload/deployment and Cron activation remain separately approval-gated. DATA-S3, provider changes, production enrichment and every model/calculation change remain excluded.
