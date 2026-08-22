# Cloudflare Data P1 — Structured Evidence Projection Foundation

Status: implementation in progress on an isolated branch. No production deployment or migration has been performed.

## Outcome

Cloudflare remains the durable data platform selected by Data Architecture D1. This checkpoint adds the first queryable D1 projection of already-accepted canonical Stage 10 pre-deadline evidence. It does not create a second browser upload path and does not change Teamsheet recommendations.

The canonical record remains the private R2 object plus its existing `evidence_records` D1 manifest. New structured rows are a replayable projection of that immutable evidence, never a replacement for it.

## Scope

P1 may add:

- an additive D1 migration for season, Gameweek, team, player, fixture, provider-observation, prediction-snapshot and player-prediction projection tables;
- deterministic projection code that accepts only a server-validated canonical `preDeadlineSnapshot`;
- idempotent/replayable structured projection keyed back to the canonical evidence content hash;
- projection status sufficient to distinguish complete, pending and failed structured projection without changing archive acceptance;
- tests proving projection cannot change model/provider/application state and that duplicate projection is idempotent;
- documentation and migration instructions.

## Explicit exclusions

This checkpoint does not:

- change projection, expected-minutes, fixture, scoring, squad, captaincy, transfer, simulation, rank or Mini-League calculations;
- add, repair, replace or reweight any provider;
- change Understat or Odds acquisition or retention policy;
- persist manager/team IDs, manual squads, league/rival identifiers or other owner-specific overlays;
- add Google Sheets automation;
- add automatic Official outcome collection;
- expose a generic SQL API or public D1 read route;
- change Cloudflare Access, DNS, CORS, custom-domain or R2 security configuration;
- deploy a Worker or apply a production D1 migration without a separate reviewed deployment step.

## Data trust boundary

Only fields already present inside a canonical Stage 10 record that passes the existing server validator and provider-retention gate may enter the structured projection. The projection must preserve the source evidence `content_hash`, season/Gameweek identity, build/model/rules provenance and observation timestamps.

If structured projection fails, canonical R2 evidence and the existing D1 manifest remain accepted and unchanged. Projection is recoverable by replay from R2.

## Google Sheets

Google Sheets remains downstream reporting only. A later checkpoint may export approved structured D1 data one way into the existing Teamsheet seasonal workbook. Sheets is not a runtime dependency, ingestion source, canonical database or backup.
