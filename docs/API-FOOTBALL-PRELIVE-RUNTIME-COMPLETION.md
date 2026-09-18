# API-Football Post-20/20 Pre-Live Runtime Completion

Date: 18 September 2026  
Status: **owner-approved repository candidate only**. No live infrastructure or provider execution is authorized.

## Outcome

The 20-club API-Football ↔ Official FPL team-identity qualification is already **GO 20/20**. This checkpoint prepares the next repository-only layer without activating API-Football.

It adds two narrowly separated capabilities:

1. a durable **private qualified-mapping persistence contract** that can later write the already-approved 20-club crosswalk into the canonical `teamsheet-data` D1 while preserving qualification provenance; and
2. a **pre-egress planner/orchestrator** that converts already-defined scheduler opportunities into the existing closed collector request contracts while still refusing provider execution.

No API-Football request, live D1 mutation, Cloudflare provisioning, Worker secret, Worker deployment, Cron, collection enablement, workload ingestion, expected-minutes/model influence or product/UI path is part of this checkpoint.

## Existing behaviour

Before this checkpoint, team identity was GO 20/20 but not durably persisted; migration 0005 supplied dormant runtime tables; `scheduler.mjs` already defined bounded opportunities; `collector.mjs scheduled()` stopped at `planner_not_activated`; and Wrangler remained inert with no Cron or credential value.

## Qualified mapping persistence

Migration 0006 adds `api_football_team_mapping_qualifications`, `api_football_team_mapping_members` and `api_football_team_mapping_heads`. A plan must re-run the existing owner-approved qualification and still prove exact 20/20 coverage, Chelsea 49→6, Leeds 63→13, the approved crosswalk hash, the approved attended provider universe, fresh Official FPL authority, 20 valid receipts, zero unresolved mappings and zero receipt failures.

The committed provenance binds the accepted attended qualification hash, current re-evaluated qualification hash, crosswalk hash, provider-universe revision/integrity/time, owner review metadata, Official FPL authority digest/time and one receipt-integrity hash per mapping. Public source still contains no private 18-pair crosswalk.

## Pre-egress planner

The existing pure scheduler remains authoritative. The new planner requires fresh Official FPL authority and one committed exact-20 mapping head; reads current discovery state/completed request identities; plans at most 10 request attempts per wake; converts discovery into the existing five allowlisted fixture queries; converts pre-match/finality into the existing known-fixture `fixtures?id=` request; and blocks `FINAL_ENRICHMENT`/`CORRECTION` as `workload_ingestion_not_approved`.

`PRELIVE_PLANNER_ONLY` is an explicit planner mode, but the shipped Wrangler value remains `REPOSITORY_ONLY_BLOCKED`. Even planner-only execution returns `provider_execution_not_approved` after planning and never calls the provider.

## Security and persistence boundary

No secret value or raw provider/Official FPL payload is stored. Mapping rows are normalized identity facts; committed qualification provenance is immutable; a mapping head can reference only a committed exact-20 qualification. Provider names/codes remain non-authoritative. The planner does not need `API_FOOTBALL_API_KEY`; the current blocked config exits before D1 or secret access.

## Preserved fail-closed controls

This checkpoint changes none of the prior runtime limits: 100 attempts/UTC day, 30-second global lease, ≥1s spacing, reservation-before-egress, two attempts/logical request, 15-second timeout, 429 no-retry/day block, 401/403 auth block, fail-closed quota telemetry, 720,896-byte response ceiling, 2,000-row cap and exact origin/method/query contracts.

## Tests and evidence required

Permanent coverage must prove migration 0006 after populated 0001–0005 with zero FK violations; incomplete qualifications cannot commit; committed provenance is immutable; only committed exact-20 qualification can become head; persistence plans remain hash/receipt bound; wrong crosswalk/anchors fail before D1 mutation; planner outputs only closed request contracts; workload detail remains blocked; stale authority/incomplete mapping blocks planning; current Wrangler stops before D1/credential; and production/browser/model imports remain absent. Full `./run-tests.sh`, production build and deterministic identity remain required.

## Still unproven

Production D1 migration 0005/0006, real crosswalk persistence, live Cloudflare transactions/concurrency, Worker secret/deployment, collector provider execution, natural Cron, current-season cup completeness, workload-detail ingestion, contractual provider entitlement and any predictive/model value remain unproven.

## Next owner gate after merge

After merge and exact-main verification, the next proposal should be **live storage foundation only**: verify real D1 binding, apply migrations 0005/0006, privately persist/verify the 20/20 mapping, and keep collection/provider execution/Cron disabled. Secret provisioning, Worker deployment, provider egress, workload ingestion and model influence remain later gates.
