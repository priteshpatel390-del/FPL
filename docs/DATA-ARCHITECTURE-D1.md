# Data Architecture D1 — historical and live data platform

Status: **approved design; implementation deferred**  
Approved by: Pritesh, 9 August 2026  
Repository baseline investigated: `main` `6e725485564a51ee2a17bc08e5c8bf95e8c2778c`  
Scope: architecture investigation and documentation only

## Outcome

Teamsheet's target persistent platform is:

1. **Cloudflare D1** for structured, queryable records and current-revision pointers.
2. **Private Cloudflare R2** for exact compressed, content-addressed canonical evidence.
3. **A separate authenticated data Worker** for validation, ingestion, authorised reads, exports and later scheduled collection.
4. **Existing browser storage** as the operational fallback and pending-upload/outbox layer.
5. **Google Sheets** only as optional downstream reporting and human analysis.

Cloudflare KV and Durable Objects are not part of the core minimum viable platform. They may be considered later only for a measured cache or coordination requirement.

This decision does not authorise infrastructure or application implementation. Persistence must remain a one-way evidence side effect: the current deterministic calculation path must continue to work when the data Worker, D1 or R2 is unavailable.

## Decision drivers

- Stage 10 already defines allowlisted, hash-verified pre-deadline snapshots, outcomes, evaluations and deterministic exports.
- Browser retention is deliberately recovery-oriented and can be lost through eviction or device replacement.
- Structured historical analysis needs relational identities, joins, unique constraints, transactions and append-only revisions.
- A synthetic complete prediction snapshot is approximately 2.2 MB uncompressed, above D1's 2 MB row/string/BLOB limit. Exact canonical evidence therefore belongs in R2 while queryable fields are normalised into D1.
- Google Sheets prototypes useful information but is unsuitable as runtime authority: external imports can break, schemas are human-mutable, and relational corrections/idempotency are awkward.
- No persistence failure may silently alter a recommendation or be described as a live-data failure.

## Data boundary

### Persist

At the point actually used or decided:

- season, Gameweek, deadline, fixture and official player/team identities;
- point-in-time price, ownership, availability and chance-of-playing fields;
- expected-minutes assumptions, confidence and source;
- accepted normalised provider inputs actually used;
- provider state, observation/data time, age, inclusion/fallback and normalised hash;
- player predictions, approved uncertainty summaries and horizon;
- frozen squad, best XI, bench order, captain and vice;
- owner transfer evidence only after a separate authenticated owner-data approval;
- immutable official outcome revisions and evaluation revisions;
- schema, build, source, model and rules identity;
- content hash and private R2 object identity.

### Derive

- dashboard summaries, rankings and accuracy charts;
- captain/decision display scores that are functions of frozen evidence;
- opponent, venue and presentation labels where stable IDs and effective identities suffice.

### Export only

- wide CSV/Sheet layouts, chart formatting and prose review notes;
- historical workbook season-end rollups unless a later pinned-source migration contract approves import.

### Do not retain

- raw FPL, Understat or Odds payloads and raw HTML;
- Odds keys, keyed URLs, auth tokens or Anthropic/OpenAI secrets;
- Monte Carlo samples and transient optimiser search state;
- unselected rival squads, complete transient standings and UI state.

### Device-only in the minimum viable platform

- FPL manager/team ID;
- manual squad and personal settings;
- league/rival identifiers, labels and selections;
- the Odds key under its existing approved temporary handling.

Global official facts and predictions must be separated from any later owner-specific decision overlay.

## Logical model

The implementation design should cover:

- `schema_migrations`
- `seasons`, `gameweeks`
- `teams`, `players` and effective-dated identities
- `fixtures`, `fixture_revisions`
- `ingestion_runs`, `provider_observations`
- `evidence_records`
- `prediction_snapshots`, `player_input_observations`, `player_predictions`
- `squad_decisions`, `squad_roles`
- `transfer_plans`, `transfer_moves`, `transfer_plan_gameweeks`
- `outcomes`, `fixture_outcomes`, `player_outcomes`
- `evaluations`, `transfer_horizon_evaluations`
- `export_runs`

Official identities are season-scoped. Canonical evidence uses the SHA-256 hash of canonical JSON as immutable identity. Repeated uploads are idempotent. Corrections append a record with `supersedes_record_id`; a transactional pointer selects the current revision without rewriting prior evidence. Every record carries schema/build/model/rules provenance. Season rollover creates new scoped rows.

A proposed R2 key is:

`evidence/v1/{type}/{season}/{gw}/{sha256}.json.gz`

## Cloudflare service boundary

The existing Official FPL Worker remains a narrow, read-only, allowlisted transport gateway. Persistence belongs in a separate service so authentication, writes, schedules or archive faults cannot enlarge the gateway blast radius or interrupt current live acquisition.

Operation classes:

| Operation | Boundary |
|---|---|
| Public Official FPL reads | Existing gateway, unchanged |
| Evidence writes | Owner-authenticated, schema-validated and append-only |
| Correction writes | Stronger owner/admin authority with revision reason |
| Evidence reads | Owner-scoped or redacted allowlisted views |
| Exports | Authenticated downstream operation |
| Scheduled collection | Later system-authorised Cron; global public data first |
| AI/agent access | Later read-only allowlisted API; no arbitrary SQL or database credentials |

Browser writes require short-lived authentication, allowed-origin enforcement, CSRF protection, rate limits and payload limits. Permanent service tokens must not be embedded in the static app. R2 stays private. Server credentials use Worker secrets.

## Failure contract

| Failure | Required behaviour |
|---|---|
| D1 or data Worker unavailable | Keep calculating; retain local evidence for retry; say history was not saved |
| Partial write | Write and verify R2 first, then transact the D1 manifest/rows; reconcile invisible orphan objects |
| Duplicate write | Return the existing hash-identified record |
| Stale record | Preserve its timestamps/state; never overwrite a newer observation |
| Schema or season mismatch | Reject before commit; never silently coerce |
| Outcome correction | Append a revision and transactionally change the current pointer |
| Client offline | Use accepted local fallback, queue evidence, never claim upload |
| Unauthorised access | Return 401/403 without record detail; log only redacted metadata |
| Export failure | Preserve D1/R2; record export failure and retain manual export |

D1 and R2 cannot share one transaction. The R2-first/D1-manifest protocol is recoverable rather than atomic and requires orphan-reconciliation tests and an operating procedure.

## Google Sheets role

Sheets is removed from the critical architecture. It remains:

- a field/reporting prototype;
- a manual CSV/JSON destination initially;
- a possible later one-way automated reporting and chart surface;
- read-only relative to canonical Teamsheet history.

Sheets is not a runtime dependency, source of truth, ingestion path or backup. A failed Sheet export must have no effect on canonical evidence or recommendations.

## Security and privacy

- Manager/team, league and rival identifiers are personally linkable and excluded from the MVP server contract.
- Manager/team names are excluded unless separately justified and approved.
- Provider health retains only state, age, counts, timestamps, hashes and redacted failure class.
- Odds keys and keyed URLs must never be relayed, logged, persisted or included in diagnostics.
- Anthropic/OpenAI secrets must never be client-side.
- Canonical Stage 10 evidence is private and authenticated.
- Future AI access uses audited, field-allowlisted, read-only views.
- Permanent retention of Understat- or Odds-derived records requires a provider-rights review; current technical use does not itself approve archival or redistribution.

## Cost and operations

At current personal-use scale, expected D1 row volume and compressed R2 evidence should fit Cloudflare free allowances. The repository synthetic snapshot compresses to roughly 153 KB, so several personal seasons should be small. This is an estimate, not live-season evidence.

Capacity and cost must be measured in staging before multi-user claims. Global records should be deduplicated; only small owner overlays should multiply by user. Workers execution/authentication may become the first paid requirement at moderate scale.

Normal Gameweek operation must require no database console. Health, last capture and pending/failed writes should be visible in Teamsheet. Migrations, backup/restore and deployments remain reviewed GitHub workflows; direct mobile dashboard editing is not an operating model. D1 Time Travel is recovery protection, not an independent permanent backup.

## Deferred implementation phases

1. **Foundation:** separate staging Worker, D1 migrations, private R2 and health/read-only endpoint.
2. **Canonical ingestion:** Stage 10 validation, hashes, idempotency, R2-first/D1-commit protocol, revisions and owner authentication.
3. **Migration:** dry-run surviving local Stage 10 JSON; do not treat Sheet rows as prospective evidence without timing/provenance.
4. **Automatic capture:** non-blocking local outbox with honest offline/pending/saved/failed states.
5. **Scheduled global collection:** Official FPL global facts after the ingestion contract and live timing are proven.
6. **Sheets reporting:** manual first; optional one-way automated reporting later.
7. **Provider and AI access:** separate rights/security approval and read-only constrained views.

The persistent implementation remains after Atomic Foreground Refresh, cache/persistence resilience, error-boundary separation, production-bundle safeguards, appropriate documentation/state cleanup, Understat repair and Odds repair.

Each implementation checkpoint requires its own branch and approval, migrations and rollback, contract/idempotency/revision/season tests, D1/R2 partial-failure tests, security tests, outage tests proving deterministic recommendations remain available, the full suite, deterministic build verification where relevant, staging backup/restore, and physical iPhone acceptance for affected flows.

## Evidence gates and limitations

This design does not manufacture evidence for:

- completed-Gameweek minute-history behaviour;
- Stage 10 outcome/correction validation;
- transfer-horizon evidence;
- populated Mini-League rank/rival/pagination behaviour;
- recommendation accuracy;
- provider contribution.

Other limitations:

- estimates use synthetic evidence rather than a completed live season;
- D1 query throughput and partitioning require measurement before moderate multi-user use;
- provider archival rights remain unconfirmed;
- D1/R2 cross-product commits are recoverable, not atomic;
- Sheets prototypes are not canonical prospective evidence.

## Approval boundary

Approved now: this architecture decision and documentation closeout only.

Not approved: database creation, R2 bucket creation, Worker or Cron changes, application integration, migration, automatic capture, Sheets automation, provider repair/change, model or recommendation changes, AI migration, agents, deployment or production data collection.

The next engineering checkpoint after this documentation closeout is **Atomic Foreground Refresh**, beginning with investigation and an explicit implementation approval gate.
