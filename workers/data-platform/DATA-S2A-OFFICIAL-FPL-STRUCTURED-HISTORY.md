# DATA-S2A — Official FPL Structured History Repository Candidate

Status: **repository implementation candidate only; no live deployment or D1 mutation approved**  
Design/implementation date: **26 August 2026**  
Implementation base: `b58aa829b201043abf6eba8e2b22d82e4fc27744`

## Outcome

DATA-S2A prepares a shadow-only collector for a bounded allowlist of Official FPL facts. It does not replace the existing live Official FPL gateway used by Teamsheet and it does not create a production application dependency on D1.

The proposed live path, if separately approved in DATA-S2B, is:

`Cloudflare hourly Cron -> existing teamsheet-data-platform Worker -> Official FPL public API -> existing TEAMSHEET_DATA_DB binding`

No RPC, custom machine-authenticated HTTPS read API, browser credential, GitHub write token or second database is required for collection.

## Core storage rule: changes only

The collector fetches and validates the current Official FPL bootstrap and fixture payloads, reconstructs the allowlisted scalar state, and compares each logical fact with `observation_heads`.

- The first accepted run writes the complete allowlisted baseline.
- A later run whose Official FPL state is identical writes **zero `shadow_observations` and zero `observation_heads` changes**.
- A later run writes only facts whose values genuinely changed.
- The small `ingestion_runs` record still records that a scheduled check happened and whether it completed.
- Historical facts are append-only: a changed value creates a new observation rather than overwriting the previous historical value.

This is deliberate. Updating one mutable row would save some storage but would destroy the point-in-time question DATA-S2 exists to answer: “what did Official FPL say before this deadline?”

## Allowlisted data contract

DATA-S2A stores no raw Official FPL payload. Only the following normalised facts are candidates for durable shadow history.

### Events / Gameweeks

- lifecycle `present`;
- `name`;
- `deadline_time`.

### Teams

- lifecycle `present`;
- `name` and `short_name`;
- `strength`;
- `strength_overall_home` / `strength_overall_away`;
- `strength_attack_home` / `strength_attack_away`;
- `strength_defence_home` / `strength_defence_away`.

### Players

- lifecycle `present`;
- canonical current team assignment;
- Official FPL element/position type;
- `web_name`;
- `now_cost` in Official FPL tenths-of-a-pound representation;
- status;
- chance of playing this/next round where supplied;
- Official FPL news text and `news_added` timestamp where supplied;
- `selected_by_percent`.

### Fixtures

- lifecycle `present`;
- Gameweek/event assignment;
- kickoff time;
- home and away canonical team IDs;
- Official FPL home/away fixture difficulty.

DATA-S2A deliberately excludes realised player points, minutes, BPS, scores and final outcome facts reserved for DATA-S3; manager/account/picks/bank/free-transfer/captain/chip/Mini-League/rival state; external provider information; derived projections; and production recommendation fields.

## Explicit null versus missing

The DATA-S1 scalar schema has no dedicated `null` value type. DATA-S2A therefore uses the reserved text sentinel `__teamsheet_explicit_null__` for a field that Official FPL explicitly supplies as null. This is required for real fixture lifecycle changes such as:

`GW23 -> unassigned -> GW27`

or:

`scheduled kickoff -> null -> rescheduled kickoff`.

A required field that is absent is not converted to this sentinel. Missing required structure fails validation.

## Identity and lifecycle

Canonical entity identity is season-scoped and based on Official FPL IDs, for example:

- `2026-27:fpl:player:351`;
- `2026-27:fpl:team:7`;
- `2026-27:fpl:fixture:184`;
- `2026-27:fpl:event:23`.

Every tracked entity has a `present` boolean fact. If a previously present Official FPL entity disappears from a later complete payload, DATA-S2A appends one `present=false` change; it does not delete the canonical entity or its historical observations. Reappearance can append `present=true` again.

A player transfer therefore keeps the same player identity and appends a changed team-assignment fact. Fixture postponement/rescheduling likewise retains the Official FPL fixture identity while event/kickoff facts evolve.

## Validation and fail-closed population guards

Both Official FPL payloads must be fetched and valid before a generation can complete. The candidate expects:

- `bootstrap-static` to contain arrays for events, teams, elements and element types;
- exactly 20 current Premier League teams;
- at least 30 events and 400 players;
- at least 300 fixture rows;
- unique positive Official FPL IDs;
- valid player-to-team and player-to-element-type references;
- valid fixture team references;
- a fixture event to be either a known event ID or explicit null;
- all allowlisted required fields to exist and have compatible scalar/timestamp types.

These are corruption/collapse guards, not assumptions about model quality. A failed validation writes no observation/head generation and cannot affect Teamsheet.

## Generation atomicity

A collection run is first recorded as `started`. After both payloads validate, the collector reads the current Official FPL observation heads and computes the complete delta in memory.

For a changed generation, canonical entities, new observations, head movements and the transition of the run to `completed` are submitted together through one bounded D1 `batch()`. Cloudflare documents D1 batch execution as ordered and transactional: if a statement fails, the batch aborts/rolls back. A partially committed generation must therefore never advance current heads.

If collection fails before the final transaction, the previous completed heads remain unchanged and the run is marked failed where D1 remains available.

## D1 Free-plan controls

Current Cloudflare documentation reviewed on 26 August 2026 states that Workers Free permits 50 D1 queries per Worker invocation and D1 Free permits 100,000 rows written per day. DATA-S2A is structured around those constraints rather than assuming a paid tier.

A baseline can contain roughly ten-to-twelve thousand scalar observations. One statement per row would exceed the invocation query ceiling. DATA-S2A therefore uses bounded JSON arrays with SQLite `json_each(?)` to bulk-insert observations and head changes. The permanent test models a 12,000-observation baseline and requires the final transactional batch to stay below 40 statements, leaving room for the source/run/head preflight operations within the 50-query Free ceiling.

A hard `MAX_CHANGED_OBSERVATIONS_PER_RUN = 15000` guard rejects an implausibly large delta before final storage. Normal hourly runs are expected to be much smaller because unchanged facts create no observation/head writes. Actual D1 rows-written accounting, including index effects, remains a live DATA-S2B acceptance item rather than a repository-only claim.

## Important Free-plan CPU limitation

Cloudflare’s current Workers limits document a 10 ms CPU limit for Cron Triggers on the Free plan. DATA-S2A can test logic and batching in the repository, but it **cannot prove** that a real first baseline — including validation, diffing and deterministic SHA-256 observation identities — stays inside that live CPU ceiling.

Therefore DATA-S2A does not approve or claim Free-plan operational fit. DATA-S2B must deploy the exact accepted candidate under a separately approved gate and prove the first baseline plus a subsequent unchanged/change cycle. If the exact Free-plan Cron exceeds the CPU ceiling, activation stops. The project must then redesign/split the collector or separately approve a paid Workers decision; no paid upgrade is implicit here.

## Security and rights

Migration `0002_official_fpl_structured_history.sql` creates a governed Official FPL source revision for this private shadow history purpose with:

- durable internal retention allowed for the approved allowlist;
- redistribution disabled;
- `shadow_ingest_allowed = 1`;
- no provider secret or browser credential;
- no raw provider payload column or storage path;
- no manager/account/league/rival identifiers.

This checkpoint does not claim a general public redistribution right for Official FPL data. Production publication/use remains separately gated.

The collector calls only the fixed public Official FPL `bootstrap-static` and `fixtures` URLs and persists only normalised allowlisted facts. It contains no generic upstream URL input, arbitrary SQL surface, credential relay or logging of provider payloads.

## Scheduling candidate

`workers/data-platform/wrangler.jsonc` declares:

- `DATA_S2_SEASON = "2026-27"` as non-secret season configuration;
- Cron `0 * * * *`, meaning once per hour in UTC.

These declarations do not change Cloudflare until a later deployment. DATA-S2A must stop at a draft PR.

## Production non-influence

DATA-S2A changes no file under `src/`, no application CSP or static asset, no FPL gateway route, and no model/fixture/minutes/captaincy/squad/transfer/simulation/rank/Mini-League logic.

The live application continues to use the existing Official FPL gateway and verified client cache/fallback. D1 or collector failure has no production-app consequence.

## Acceptance for DATA-S2A

Repository acceptance requires:

1. existing full test suite passes without weakening or deleting tests;
2. new tests prove explicit null handling, fail-closed structure, delta-only writes, precise player/team/fixture changes, lifecycle disappearance, append-only materialisation, write cap, bounded bulk query plan, no production dependency, source governance and scheduled direct-D1 wiring;
3. production build succeeds;
4. deterministic byte-identical rebuild, root/deployable equality and committed provenance checks pass;
5. branch diff contains no live credential, provider change, production model change or generated deployable drift beyond normal verification behaviour;
6. draft PR only.

## DATA-S2B — separately gated live acceptance

DATA-S2B is not approved by this record. A later explicit owner approval is required before any Cloudflare mutation.

The proposed DATA-S2B acceptance must at minimum:

1. preflight the live D1 migration/source state and fail closed on unexpected governance conflicts;
2. deploy the exact reviewed `main` Worker/config/migration;
3. activate the hourly Cron;
4. prove one real complete baseline in D1;
5. prove a second identical collection creates zero observation/head changes;
6. where naturally available or by a controlled non-production fixture, prove one changed Official FPL fact appends only the expected delta;
7. confirm no partial run advances heads;
8. inspect actual D1 rows read/written and Free-plan CPU evidence;
9. stop/rollback activation if limits or validation fail;
10. make no claim that DATA-S2 changes production recommendation quality.
