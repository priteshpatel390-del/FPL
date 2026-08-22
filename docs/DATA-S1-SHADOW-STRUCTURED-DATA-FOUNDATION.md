# DATA-S1 — Shadow Structured Data Foundation

Status: **repository implementation; no live deployment**  
Baseline: `a285c5d239d537a47ba0458b71193bd3f52a5889`  
Date: 22 August 2026

## Outcome and boundary

DATA-S1 adds the provider-neutral `teamsheet-data-platform` repository service and its separate future `teamsheet-data` D1 binding, `TEAMSHEET_DATA_DB`. It accepts only `mode = shadow_only`. Neither the application nor any production model/provider module imports this service. It has no browser route, CORS integration, CSP origin, scheduled collector, provider secret, R2 binding, Google API or Sheets path.

The accepted Stage 10 custody system remains separate: `teamsheet-evidence-archive`, evidence D1, private evidence R2, R2-first/D1-second commit protocol, canonical hashes, Access/CORS, reconciliation and retention controls are unchanged.

## Schema

Migration `0001_shadow_data_foundation.sql` creates repository migration identity, sources and immutable governance revisions, controlled ingestion runs, season-scoped canonical entities, versioned explicit mappings, append-only normalised observations, append-only relations, transactional current heads, and safe rejection metadata. Database checks allow only the five rights classifications and only `shadow_only`; typed observations contain exactly one scalar. Idempotency is `(source_revision_id, logical_key, input_revision)`. No raw provider payload column exists.

Official FPL IDs are canonical where equivalents exist, for example `2026-27:fpl:player:351`. Verified mappings require a stable provider ID and either `provider_id_crosswalk` or `manually_verified`; display-name-only mapping cannot verify. Superseded mappings and observations remain stored. Conflicts coexist without an automatic winner.

## Rights, retention and security

Durable observation admission permits `durable_allowed`, and `attribution_required` only with attribution text. `local_research_only`, `durable_blocked`, and `unknown_fail_closed` fail closed. Rejections contain reason/category/subject/fingerprint metadata only, never forbidden raw payloads.

Recursive guards reject credential-shaped keys, bearer/secret values, keyed or credential-bearing URLs, account/manager/team/league/rival identifiers, cookies and Access assertions. Requests and pages are bounded; routes and SQL are allowlisted; storage errors return fixed safe classes. There is no generic SQL/query endpoint.

## Replay and non-influence

Point-in-time reads require an `as_of` time and query `fetched_at <= as_of`. `observed_at`, `effective_at`, and `fetched_at` remain distinct. Later corrections cannot erase earlier knowledge; immutable rows and relations preserve supersession and conflict history. Stale evidence remains labelled historical evidence.

Permanent tests pin that production source has no DATA-S1 dependency; production/CSP/provider state remains unchanged under absent, fresh, stale, malformed, conflicting and failing-shadow scenarios; C5 files remain byte-identical to authoritative `main`; rights and secrets fail closed; stable identities/mapping rules hold; and replay excludes later-fetched corrections.

## Cost-policy supersession

Effective **22 August 2026**, the owner superseded the blanket £0 recurring-cost constraint. Free remains preferred where genuinely comparable; a small recurring paid provider may be considered only after explicit price, rights, value/cost and trial/shadow justification. Trial/shadow evaluation is preferred, and expensive enterprise assumptions are excluded. This does not activate or approve any provider and does not rewrite the dated conclusions reached under the earlier policy.

## Exclusions and next gates

No live Worker/database/migration/Access/DNS/R2 action occurred. No provider was contacted, subscribed or acquired. No browser, production model, Provider Health, Official FPL gateway, evidence custody, Google Sheets or application behavior changed. The intended separately approved sequence is DATA-S2 Official FPL structured history, DATA-S3 automated Official outcomes, DATA-S4 provider trials/evaluation, DATA-S5 downstream Sheets automation, later production/provider/model approvals, then deferred real-team product acceptance.

## Independent-review remediation

Before migration 0001 was deployed, PR #145 was hardened to canonicalise every supplied timestamp to UTC ISO-8601 while leaving unknown optional event/source times null; derive immutable observation IDs from a stable, allowlisted normalised-field SHA-256 contract; distinguish inserted, exact-existing and conflicting idempotency outcomes; require run/source consistency and verified mapping provenance (with an explicit canonical-native Official FPL path); provide accepted-only keyset replay pagination; enforce rights-row consistency; broaden recursive credential detection; and record only server-generated, minimal rejection metadata when safe run/source identity exists. The accepted query never exposes quarantined rows.
