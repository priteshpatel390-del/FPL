# API-Football Shadow Collection Restart

Date: 6 October 2026
Status: owner-approved investigation/design and repository closeout only. No live provider request, Cloudflare mutation, D1 mutation, deployment, Cron or model/product influence is authorized by this document.

## Outcome

Teamsheet is returning to the actual API-Football objective: obtain validated private shadow fixture evidence and persist it safely. The replacement-Worker Version-URL recovery sequence is no longer a prerequisite.

The replacement Worker teamsheet-api-football-shadow-collector-v2 is treated as an abandoned recovery resource. Historical recovery evidence stays in the repository. No further Version-content, provenance, Preview-routing or legacy stable-Version remediation is required for product progress.

Before leaving it behind, one final read-only traffic-surface closeout may prove only that the abandoned resource is absent or incapable of receiving production traffic: workers.dev off, Preview off, zero Deployments, zero Cron, zero routes and zero custom domains. Version content is deliberately outside that proof.

## Current necessary work already complete

- API-Football is qualified for private, non-commercial shadow use under the recorded owner-risk boundary.
- The current-season provider to Official FPL team identity gate is GO 20/20.
- Production D1 migrations 0001 through 0006 are live.
- The private exact-20 mapping is durably persisted and independently reconciled.
- The runtime safety model exists: disabled collection by default, credential lifecycle, reservation-before-egress, lease, daily and minute controls, response byte and row ceilings, atomic generation persistence and sanitized failure states.
- The reviewed collector implementation exists and has permanent repository coverage.
- A secret-bearing attended Version exists on the original collector, with API_FOOTBALL_API_KEY and API_FOOTBALL_ATTENDED_TRIGGER_SECRET bindings, while model and UI paths remain isolated.
- Latest exact-main verification on a88512b2f24977f32d378e7b4658864475f72843 passed 2,462/2,462 tests and deterministic production builds.

## Work that is no longer blocking

The following remain historical evidence, not prerequisites for the next product step:

- making replacement-v2 Version URLs routable;
- proving replacement Version module identity again;
- repairing or extending the old one-Version reconciliation;
- reconciling legacy stable-Version detail surfaces;
- further diagnostics whose only purpose is to improve replacement recovery.

A failure in those surfaces does not by itself block shadow collection through the original collector.

## Final abandoned-resource closeout

The topology-only closeout reuses readReplacementState with versionId=null. It therefore reads Worker identity and traffic topology but never calls stable or beta Version-detail endpoints.

PASS means either the replacement Worker is absent with no matching route/domain, or the exact known Worker is present with:

- workers.dev disabled;
- Preview disabled;
- worker deployed_on unset;
- zero Deployments;
- zero Cron schedules;
- zero zone-scoped Workers Routes targeting it;
- zero custom domains.

The route proof must come from the independent zone-scoped Workers Routes scan. Legacy Scripts route metadata remains secondary only.

This closeout makes zero Cloudflare mutations, zero D1 writes, zero API-Football requests and reads no provider secret value. It does not claim that the replacement Version content is correct.

## Next real gate: controlled deployed shadow collection

After the topology closeout passes, the next proposal should use the original collector teamsheet-api-football-shadow-collector and the already-reviewed attended Version, not replacement-v2.

The preferred one-shot design is:

1. fresh exact-main/read-only admission proves migrations 0001-0006, fresh Official FPL authority, committed exact-20 mapping, collection disabled, credential AVAILABLE, no active lease and no prior API-Football collection history;
2. create a Deployment selecting the exact reviewed attended Version;
3. keep Cron, custom routes and custom domains at zero;
4. enable only the Worker workers.dev traffic surface needed for the attended HTTP endpoint;
5. derive the production workers.dev hostname from trusted Cloudflare metadata;
6. enable collection through the existing bounded D1 control;
7. send exactly one trigger-secret authenticated POST to the existing attended one-shot path;
8. the collector may make only the existing five discovery requests and may persist only validated normalized shadow data;
9. disable collection and workers.dev on every exit path;
10. independently reconcile the D1 generation/attempt state and prove no unexpected topology.

The Deployment may remain as inert code after acceptance if workers.dev is disabled and Cron/routes/domains remain zero. That is a normal deployment state, not evidence of active traffic.

## Why this is preferable

It exercises the production Deployment serving path rather than the Version Preview mechanism that caused the recovery detour. It reuses the existing collector, API key binding, trigger-secret guard, persistence code and safety limits. It also leaves a clean path to later scheduled shadow collection: once one-shot acceptance succeeds, Cron can be considered as a separate gate without changing provider or model logic.

## Explicit exclusions

This restart does not approve or implement:

- API-Football influence on expected minutes, projections, fixture difficulty, XI, captaincy, transfers, simulation, rank, Mini Leagues, rivals, strategy or recommendations;
- automatic Cron collection;
- new provider endpoints or workload-detail enrichment;
- new provider/data source;
- any accuracy claim;
- deletion of historical replacement resources;
- broadening provider rights, storage or redistribution;
- weakening tests, deterministic builds, quota controls, D1 atomicity or graceful fallback.

Any later model influence requires prospective shadow evidence, predeclared ablation and separate owner approval.
