# DATA-S2 Backend Reuse Audit

Status: **Research complete; owner-approved DATA-S2A-R1 closeout only.**  
Research date: **26 August 2026**  
PR baseline inspected: **#160 head `2eef58d7f59fcbafb1a9145da1df6af735dd902c`**  
Production effect of this record: **None**  

This audit applies the canonical [Reuse Before Build](../../REUSE-BEFORE-BUILD.md) principle to DATA-S2 and the surrounding backend. It does not approve a new runtime provider, data source, dependency, model, calculation, Cloudflare deployment or live D1 mutation.

## 1. Question

Has Teamsheet rebuilt backend/data-history capabilities that mature public FPL projects already solve better, and should that change whether PR #160 merges?

## 2. Conclusion

**Keep PR #160. Do not replace it with an external backend.**

No reviewed project provides the same combination of Teamsheet-specific requirements:

`Official FPL -> strict allowlist -> rights/governance gate -> season-scoped canonical identities -> change detection -> append-only observations -> atomic current heads -> point-in-time D1 history -> Free-tier bounded writes -> structural production separation`.

PR #160's D1 observation/head model, source-revision governance, atomic commit boundary and change-only write strategy are therefore genuine Teamsheet-specific infrastructure rather than needless reinvention.

The audit did identify one proven edge case that Teamsheet should **Port** before merge: season rollover protection. `TopMarx/fpl` derives the active season from Official FPL's first Gameweek deadline and refuses to write when the configured season disagrees with the season actually served by the API. DATA-S2A had only validated the configured `DATA_S2_SEASON` format. DATA-S2A-R1 independently implements the same fail-closed principle in Teamsheet's JavaScript/Cloudflare design.

No external project becomes a Teamsheet dependency or provider as a result.

## 3. Reuse matrix

| Teamsheet requirement | Current PR #160 approach | Strongest prior art | Decision | What Teamsheet still owns |
|---|---|---|---|---|
| Official FPL scheduled collection | Hourly Worker Cron candidate | `TopMarx/fpl` | **Port / Reference** | Cloudflare/D1-native collection and Teamsheet validation |
| Season rollover safety | Configured season only before audit | `TopMarx/fpl` | **Port now** | Fail-closed API-season check and run evidence |
| Transient HTTP retries/backoff | Hourly schedule supplies later retry opportunity | `TopMarx/fpl`, AIFPL | **Reference / defer** | Add only if DATA-S2B evidence justifies it |
| Duplicate-run protection | Deterministic run ID + `INSERT OR IGNORE` | Several collectors/manifests | **Keep ours** | D1-native idempotency |
| Failed-run record | `ingestion_runs` | TopMarx manifest, AIFPL artifacts | **Keep / Reference** | D1-native run state and safe error classes |
| Change-only structured history | Diff against `observation_heads` | No direct equivalent reviewed | **Keep ours** | Append-only facts with bounded Free-tier writes |
| Point-in-time/as-of history | Immutable observations + heads/replay | FPL Lens, historical stores | **Keep / Reference** | Teamsheet provenance and query semantics |
| Raw immutable payload snapshots | Explicitly excluded | TopMarx, AIFPL | **Reference; not DATA-S2A** | Separate rights/storage approval if ever needed |
| Hashing / lineage manifests | Observation identities and run/source versions | AIFPL | **Reference** | Extend only where evidence requires source-artifact replay |
| NULL vs zero vs missing | Explicit-null sentinel + fail-closed missing fields | FPL Lens | **Keep / Reference** | Teamsheet scalar contract |
| Historical schema drift | Current-season allowlist | FPL Lens, vaastav | **Reference for backfill/DATA-S3+** | Versioned historical ingestion rules |
| Provisional/corrected GW outcomes | Outside DATA-S2A | `TopMarx/fpl` | **Reference for DATA-S3** | Official-outcome acceptance policy |
| Historical backfill/validation | Existing pinned vaastav use | `vaastav/Fantasy-Premier-League` | **Adopt as evidence source only** | Official FPL remains live authority |
| API wrapper | Direct fixed endpoints | `amosbastian/fpl` | **Reference only** | No Python/runtime dependency |
| Broad auditable agent backend | Not part of DATA-S2A | AIFPL | **Reference only** | Teamsheet-specific contracts and zero-dependency architecture |
| Optimisation / automated decisions | Later checkpoints | AIrsenal, AIFPL | **Future reuse gate** | Independent validation under Teamsheet objectives |
| Cup/Europe/workload/Elo enrichment | Excluded | FPL Core Insights | **Reject for DATA-S2; future research only** | Provider/rights/evidence gate if later proposed |

## 4. Candidate findings

### 4.1 `TopMarx/fpl` — strongest DATA-S2 collection reference

Repository: <https://github.com/TopMarx/fpl>

Observed on 26 August 2026 as an active Python Official FPL collector. Its code/tooling is MIT licensed, with a separate notice that FPL data remains subject to the FPL/Premier League data position.

Useful proven patterns include:

- fixed Official FPL bootstrap/fixtures collection;
- retry/backoff;
- Gameweek state checks distinguishing live, unprocessed, provisional and confirmed data;
- re-fetches to catch provisional/stat corrections;
- failed-player recording;
- persistent fetch manifests;
- season rollover derived from Official FPL deadline evidence rather than the calendar;
- explicit handling of data it regards as separately licensed.

**Classification:** Port selected behaviours; Reference the rest. Do not adopt the Python collector or its GitHub-data storage architecture.

### 4.2 `vaastav/Fantasy-Premier-League` — strongest historical dataset/reference

Repository: <https://github.com/vaastav/Fantasy-Premier-League>

Long-running MIT-licensed software/data-pipeline project with a separate statement that underlying FPL/Understat data belongs to its source providers. It remains valuable for historical backfill, schema-change examples and independent validation, not as Teamsheet's current-season canonical feed.

**Classification:** Adopt as an approved/pinned historical evidence source where already governed; Reference its schema-drift handling. Official FPL remains canonical for live/current facts.

### 4.3 `amosbastian/fpl` — API-wrapper prior art

Repository: <https://github.com/amosbastian/fpl>

MIT-licensed asynchronous Python FPL API wrapper. Useful for endpoint/schema/error-handling ideas, but its Python/package architecture is incompatible with Teamsheet's zero-dependency JavaScript/Worker constraints and its last observed code push predates the current season.

**Classification:** Reference only.

### 4.4 AIFPL — broad auditable backend reference

Repository: <https://github.com/khaled-yousef-TV/AIFPL>

Contains current-data normalisation, immutable artifacts, SHA-256 integrity/manifests, historical/replay components, health, projections, calibration, optimisation and a substantial test surface. Its architecture demonstrates that much of the broader auditable-FPL-backend problem has prior art.

However, no explicit repository licence was established during this audit, and its Python/FastAPI/Pydantic/OR-Tools dependency stack is incompatible with Teamsheet's production constraints.

**Classification:** Reference only. Do not copy code or make it a dependency without a separately established licence/approval.

### 4.5 FPL Lens — strong historical-schema and independent-verification reference

Repository: <https://github.com/meckgalen/fpl-lens>

MIT-licensed TypeScript/Node/Postgres application maintaining many seasons of FPL history. Particularly useful lessons:

- coverage is not monotonic across seasons;
- fields can become available partway through a season;
- NULL, zero and not-measured are different states;
- historical FPL round numbering is not always a simple 1..38 sequence;
- independent read-only verification against source data is stronger than testing a transformation only against itself.

**Classification:** Reference / Port validation patterns. Do not adopt its React/Postgres/Docker architecture.

### 4.6 AIrsenal — future optimisation/model reference

Repository: <https://github.com/alan-turing-institute/AIrsenal>

MIT-licensed, actively maintained broad FPL modelling/optimisation project. It is not a DATA-S2 dependency, but future Teamsheet work on squad/transfer/chip/multi-week optimisation should inspect it before designing from scratch.

**Classification:** Reference now; future gate required for any exact adoption.

### 4.7 FPL Core Insights — potential later enrichment reference

Repository: <https://github.com/olbauday/FPL-Core-Insights>

Current public project combining Official FPL with wider football context such as Elo and non-league workload. No repository licence was established during this audit, and its additional sources/rights are outside DATA-S2A.

**Classification:** Reject for DATA-S2 runtime use; future research candidate only.

## 5. DATA-S2A-R1 approved port: season rollover guard

The accepted port is behavioural, independently implemented in Teamsheet's codebase rather than copied line-for-line from an external project.

Required behaviour:

1. Fetch the fixed Official FPL bootstrap and fixtures payloads.
2. Find Official FPL event/Gameweek `id = 1` in bootstrap.
3. Derive the served season from that event's `deadline_time` in UTC, e.g. a 2026 GW1 deadline implies `2026-27`.
4. Compare the derived season with configured `DATA_S2_SEASON`.
5. If they differ, fail with `season_mismatch` before reading `observation_heads`, writing any `shadow_observations`, or moving any heads.
6. The already-created `ingestion_runs` row may be marked failed with the safe `season_mismatch` error class so the attempted check remains auditable.
7. No provider, endpoint, field allowlist, data retention position, application behaviour or model changes.

The validation-version identifier must advance because this adds a new acceptance rule. Schema and transform versions remain unchanged.

## 6. Patterns deliberately not pulled into PR #160

- raw immutable Official FPL payload retention;
- GitHub-committed data snapshots;
- Python/FastAPI/Postgres/OR-Tools dependencies;
- per-request retry/backoff beyond the existing hourly retry opportunity;
- outcome/provisional-data logic reserved for DATA-S3;
- new historical backfill ingestion;
- FPL Core Insights enrichment;
- any model, expected-minutes, fixture-difficulty, optimisation, captaincy, rank or Mini-League logic.

These remain separate future questions. Their existence in prior art is not approval.

## 7. Validation required for this closeout

Permanent repository evidence must prove:

- `2026` GW1 deadline evidence derives `2026-27` and previous-season evidence derives the corresponding previous season;
- a configured/served mismatch returns `season_mismatch`;
- mismatch performs no `observation_heads` read and no D1 batch/observation/head write;
- the run failure records the safe mismatch class;
- the existing exact 6,825 baseline remains unchanged;
- Reuse Before Build and this audit remain documented as process/evidence only;
- full tests/build/determinism/provenance/identity gates remain green on the exact PR head.

## 8. Merge recommendation

Subject to the DATA-S2A-R1 guard and final exact-head repository verification, the reuse audit recommendation is:

**KEEP PR #160 AND MERGE ONLY AFTER OWNER APPROVAL.**

The audit found no external backend whose adoption would materially simplify Teamsheet without discarding Teamsheet-specific governance, D1 history, Free-tier controls or production separation. The useful reuse is targeted: port hardened edge-case behaviours and validation patterns while keeping the smallest Teamsheet-native infrastructure.
