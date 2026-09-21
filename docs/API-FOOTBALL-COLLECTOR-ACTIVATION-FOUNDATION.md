# API-Football Collector Activation Foundation

## Approval and outcome

Pritesh approved repository implementation only. This checkpoint adds a dormant, testable execution composition for one attended five-competition discovery generation. It does not authorize or perform provider access, secret access, production D1 access, deployment, binding, Cron, runtime enablement, workload ingestion, or model/product/UI use.

Shipped `wrangler.jsonc` remains inert: `EIA_2I5D_ACTIVATION` is `REPOSITORY_ONLY_BLOCKED`, Cron is empty, the D1 ID is the all-zero placeholder, Workers.dev is false, and preview URLs are false. The future state is named `ATTENDED_ONE_SHOT_DISCOVERY`, but no shipped configuration selects it. `PRELIVE_PLANNER_ONLY` still plans and stops without reading the provider key or calling the provider.

## Execution ordering

The dormant composition is `plan -> STAGING generation -> first-attempt admission -> durable reservation -> transport -> bounded decode -> endpoint semantic validation -> normalized identity/revision/membership persistence -> durable attempt completion`. Only after all five canonical competition requests succeed may the generation become `COMMITTED` and its head advance.

Validation pins endpoint class, exact echoed parameters, league or fixture identity, provider season, paging 1/1, fixture and participant IDs, distinct participants, status, kickoff, competition identity, and the qualified mapping. HTTP 200 is transport evidence only. It cannot complete an attempt before semantic admission and persistence. If persistence is uncertain, the attempt remains conservatively consumed rather than being labeled successful. Failed or partial generations never replace the previous committed head.

## Zero-retry recovery contract

The first attended acceptance is first-attempt-only. No attempt 2 is generated. A missing prior attempt may reserve attempt 1. A succeeded attempt is not reissued. Any definitely failed, timed-out, transport-unknown, quota-blocked, authentication-failed, schema-failed, or HTTP-failed attempt remains consumed. An active reservation blocks egress; an expired reservation is also consumed and requires reconciliation, not blind retry. Existing 401/403 disablement, 429 UTC-day blocking, and quota-uncertainty blocking remain.

## Generation ceiling and write exposure

Attended R7 evidence observed 1,131 rows across five discovery calls. Twice that observation is 2,262. Rounding upward to the next 500 gives a deterministic **2,500-fixture generation ceiling**, leaving 1,369 rows above the observation while preventing five independent 2,000-row response limits from combining into 10,000 rows.

Worst-case accounting does not rely on duplicates or unchanged fixtures:

- identities: at most 2,500 rows written;
- immutable revisions: at most 2,500 rows written;
- generation links: at most 2,500 rows written;
- fixture persistence: at most 7,500 rows written and 10,000 statements including one revision-head read per fixture;
- control state: at most 24 rows/statements for run/generation creation, five two-row reservations, five two-row completions, final generation update, and head upsert;
- total: at most **7,524 D1 rows written** and **10,024 statements**.

Actual unchanged fixtures can avoid revision inserts, but safety assumes every fixture is new or changed. Zero retries prevent multiplication. D1 work must be chunked within platform limits while state remains `STAGING`; only final commit/head work exposes it as current.

## Activation preflight

The collector-activation preflight is separate from historical live-storage preflight. Its closed contract requires exact migrations 0001–0006, zero foreign-key violations, fresh valid Official FPL authority, current committed exact-20 mapping and bijection, disabled runtime, no lease, bounded historical counts, blocked collector inventory, no Cron, placeholder repository binding, secret-binding presence as a boolean only, and zero model/UI imports. Ready classification is `READY_FOR_SEPARATE_ATTENDED_ACTIVATION`. This PR runs no live preflight.

## Preserved boundaries and next gate

API-Football remains shadow-only. Lineups, players, events, enrichment, correction, model influence, recommendations, browser reads, and UI reads remain blocked. Raw provider bodies, URLs, secrets, private mapping pairs, account IDs, and database IDs are not retained or logged.

After owner review and merge, any attended discovery acceptance requires new explicit production approval covering exact-main verification, fresh live activation preflight, secret-presence proof without value disclosure, explicit runtime enablement mutation, exact production D1 binding, one temporary attended invocation of exactly five requests, and subsequent disablement/reconciliation. This checkpoint grants none of those actions.
