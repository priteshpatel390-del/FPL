# DATA-S2B-E1 — Offline D1 REST foundation

Status: **repository-only implementation candidate; future architecture unapproved**
Base: `5aba5add9fda3a73b14c016bf05d54a6836b95cb` (authoritative `main` on 1 September 2026)

## Outcome and exact boundary

E1 adds an offline, fixed-purpose request boundary for a possible later Official FPL collector. `official-fpl-d1-rest-plan.mjs` owns intention-based source-revision, run, current-head, start, fail, unchanged-completion and accepted Worker-parity commit plans. `d1-rest-client.mjs` accepts only authentic immutable plans and exposes only `run(plan)`.

There is no default or production transport: every client requires an explicitly injected function, and permanent tests use fakes only. The modules contain no `fetch`, environment read, filesystem persistence, logging, credential, Official FPL acquisition, retry or clock/identity generation. E1 made no Cloudflare request and adds no workflow, Worker/runtime/configuration, schema, migration, Cron, application, model or provider change.

## Request and security contract

The client constructs exactly `POST https://api.cloudflare.com/client/v4/accounts/<account>/d1/database/<database>/query`, fixes account/database for its lifetime, supplies Bearer authentication at runtime, and requires the future transport to reject redirects. Callers cannot provide a host, base URL, method, pathname or SQL. A module-private `WeakSet` authenticates deeply frozen plans; raw, forged, unknown and tampered plan-like objects fail closed.

All SQL is repository-owned and all dynamic values use bound parameters. REST parameters are deliberately normalized to strings: identifiers, timestamps and text remain strings, counters use canonical non-negative base-10 strings, and bulk rows use deterministic JSON strings. `undefined` and arbitrary parameter objects are rejected. SQLite/D1 affinity for these REST string bindings is **not** inferred from Worker bindings and requires disposable-D1 validation before any production write.

Public errors expose only stable classifications. They never incorporate authorization, token, body, SQL, parameters, raw Cloudflare messages or observation bodies. Read dispatch failures are `d1_transport_failed`; mutation dispatch failures are `d1_mutation_outcome_unknown`. A mutation is called once and is never automatically retried: a future checkpoint must reconcile ambiguous state.

## Provider contract and bounds

First-party Cloudflare documentation was rechecked on 1 September 2026:

* the D1 Database Query API specifies the account/database query endpoint, Bearer token authentication, and single SQL plus optional parameter input;
* the D1 limits page specifies 100,000 bytes per SQL statement, 100 bound parameters per query, 2,000,000 bytes for a string/BLOB/table row, and 30 seconds maximum query duration.

Sources: [D1 Database Query API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/) and [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

E1 enforces the first three measurable construction limits per statement. The trusted commit builder also imports and enforces the canonical `MAX_CHANGED_OBSERVATIONS_PER_RUN = 15000` guard before constructing a plan, preserves Teamsheet's accepted maximum of 40 final statements, and applies a separate **internal** whole-request ceiling of 16 MiB. The 16 MiB value is a Teamsheet safety guard, not a claimed Cloudflare limit. E1 never splits a logical commit across requests.

## Determinism and Worker parity

Identical inputs produce the same method, URL, statement order, parameter order, JSON object form and serialized request bytes. Plans add no time, UUID, random value or sorting. Commit construction preserves input observation order and mirrors `buildOfficialFplCommitPlan()`: 600-observation chunks, 2,000-head chunks, new entities first, immutable observations next, head advances next, and completed-run update last.

The representative accepted shape (38 events, 20 teams, 626 players and 380 fixtures = 9,860 facts) creates one authentic commit request below the 16 MiB guard in permanent fake-transport coverage. No D1 was contacted.

## Explicit limitations and approval gate

* **REST batch atomicity is UNKNOWN.** Worker `db.batch()` semantics are not projected onto REST `{batch:[...]}`. E1 does not depend on an atomicity claim; disposable-D1 proof is a later checkpoint.
* REST parameter affinity remains unproved until disposable-D1 validation.
* Practical REST batch/body behavior still needs measurement without production data.
* A pinned account/database request path does not prove that a future D1 Write token can be restricted to exactly one database. Token blast radius remains unresolved; no token was created or inspected.
* GitHub Actions to D1 REST remains a possible, **unapproved** future architecture. No production transport, credentials, workflow, secret configuration, Cloudflare access or mutation is included.
* Owner review and separate explicit approval are required before any later network, disposable-D1, workflow or production checkpoint.
