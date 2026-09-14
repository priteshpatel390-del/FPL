# EIA-2I1 — API-Football Private-Use Shadow Workload Foundation

Status: **repository foundation implemented; live qualification pending; collection disabled**  
Baseline: `ddf467fb9974ace9e247cb5015765e9055679881`  
Decision date: 14 September 2026

## Owner decision and rights boundary

Pritesh accepts residual uncertainty in API-Football's underlying third-party league, federation and data rights for one-user, private, non-commercial Teamsheet research. This supersedes the earlier block only for API-Football and only under `owner_risk_accepted_private_use`. It is not complete underlying-rights proof or legal clearance.

The classification requires exact provider `api-football`, an EIA-2I1 owner approval reference, `private_noncommercial_research`, normalized retention enabled, and redistribution, public use, commercial use and raw-payload retention disabled. Collection/use must stop pending review after any provider or rightsholder objection. Other providers and all existing rights classifications retain their prior semantics. Public or commercial Teamsheet use requires a new rights review.

## Foundation architecture

`api-football-foundation.mjs` is an offline/server-side-capable adapter with injected `fetch`, an `x-apisports-key` header, fixed sanitized failures, an explicit maximum 100-request daily budget and disabled post-match-only mode. It has no environment reader, timer, scheduler, log capability, browser import, Worker binding or production route. Missing credentials leave it disabled. HTTP failure, quota exhaustion, malformed JSON, provider errors and schema drift produce no observation.

Responses are transient. Decoder output is reduced to fixture, competition, team/player/fixture provider IDs, kickoff, final status, confirmed lineup status, direct match minutes, substitution facts, extra-time status and dismissal evidence. No raw-response warehouse or D1 column exists. EIA-2I1 uses direct minutes only; missing minutes remain `null`. It performs no minutes reconstruction.

Competition IDs are supplied through explicit enabled configuration carrying a canonical competition identity, name and provenance. No current provider numeric league ID is embedded as eternal truth. Configuration is prepared for the Champions League, Europa League, Conference League, FA Cup and League Cup, but real 2026/27 coverage remains unproven.

Provider player, team and fixture IDs must resolve through exactly one verified mapping revision to canonical season-scoped FPL identity. Missing and ambiguous mappings fail closed. Display names are never mapping evidence. Mapping revision provenance permits later correction without rewriting historical provider facts.

## Shadow isolation and failure behaviour

No EIA-2I1 module is imported by application, provider-health, projection, expected-minutes, scoring, squad, captaincy, transfer, rank, rival, strategy or Mini-League paths. No signal is registered for production. API-Football failure cannot alter Official FPL behavior. No D1 migration or production write path is added in this checkpoint.

Unsupported fixtures or competitions, incomplete fixtures, malformed minutes, schema drift and identity failure create no accepted observation. Missing lineup evidence preserves lineup status as unknown and never infers a start. Player absence from a response is unknown, never zero. A confirmed substitute is not an appearance. Only direct zero minutes plus confirmed bench status and no substitution-on event supports `not_used`.

## First-party documentation check

The following first-party pages were checked without credentials on 14 September 2026:

- <https://www.api-football.com/documentation-v3>
- <https://www.api-football.com/pricing>
- <https://www.api-football.com/terms>
- <https://api-sports.io/documentation/football/v3>

Cloudflare returned HTTP 403 for direct unauthenticated documentation/pricing access in this environment. Therefore this foundation freezes no empirical coverage claim. Endpoint classes and header authentication follow the repository's prior dated first-party research and are isolated behind injected fixtures. Authentication, fixtures, lineups, events, player match statistics/minutes, competition coverage metadata and response quota headers must all be reconfirmed during attended credentialed qualification before any live collector proposal.

The 100 requests/day value is a conservative working ceiling, not proof that a free plan is sufficient for Teamsheet's five-competition workload. No paid fallback exists.

## Exclusions and next gate

No account, plan, purchase, credential, secret, Worker, D1 migration, Cron trigger, scheduler change, live request, live observation, deployment, production D1 mutation, UI feature, model input, coefficient, fatigue rule, projection change or accuracy claim is included.

Next gate is separate attended API-Football free-account qualification. It must prove current authentication and response contracts, target-competition availability, real 2026/27 field completeness, quota headers and practical request use before any live collection proposal. EIA-2I1 itself remains disabled.
