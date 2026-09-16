# EIA-2I5A — API-Football shadow identity and D1 schema contracts

Status: owner-approved repository implementation; draft review gate.  
Base: `62865c9735095ca6b51006fadce15e0a84e68800`.

## Outcome

EIA-2I5A adds an offline, shadow-only identity layer. It does not activate API-Football, make a request, add a credential or secret binding, schedule collection, expose provider data, or connect shadow facts to production calculations or UI.

The versioned, season-scoped competition registry covers API-Football league IDs 2, 3, 848, 45 and 48. Provider league IDs remain provider configuration; canonical competition keys remain separate. Every entry has `liveCollectionEnabled: false`.

## Identity and qualification

- Canonical current-Premier-League teams remain season-scoped Official FPL identities. Only one explicit current-season `VERIFIED` mapping qualifies a provider team. Names and fuzzy matching have no admission role.
- Provider players retain stable `api-football:player:<id>` identity across club changes. Exact normalized full name plus verified club creates only `CANDIDATE`; it never verifies automatically. Participation may be stored without an FPL player mapping and linked later by an append-only mapping.
- Provider fixtures use `<season>:api-football:fixture:<providerFixtureId>`. Kickoff, venue, round, status and score are mutable observations, not identity material. Reuse of one provider fixture ID with incompatible core identity becomes `CONFLICTED`.
- `PROVIDER_QUALIFIED` requires an approved competition/season, stable oriented team IDs and at least one current-season verified PL-team mapping. `CROSS_SOURCE_VERIFIED` additionally requires exactly one independent candidate with resolved canonical competition, season, home and away identities in exact orientation. Kickoff and other mutable metadata cannot rescue identity. Multiple candidates remain `AMBIGUOUS`; hard mismatch is `CONFLICTED`.

Chelsea–Leeds fixture 1636205 therefore retains stable verified identity while the 19:00/19:15 kickoff observations form an explicit conflict and canonical kickoff remains null. No time tolerance exists.

## Storage and participation

Migration 0004 adds only `provider_rights_admissions`, `provider_fixture_identities`, and `provider_participation_revisions`. No request-audit, quota, scheduler, queue or collection-state table is added; those need EIA-2I5B lifecycle design.

Participation keeps lineup role (`STARTER`, `BENCH`, `NO_LINEUP_EVIDENCE`, `UNKNOWN`), appearance state (`STARTED`, `SUBBED_ON`, `NOT_USED`, `UNKNOWN`), direct minutes, substitution directions and conflict state separately. Bench plus direct zero plus valid no-sub-on evidence may produce `NOT_USED`; null minutes stay unknown. Provider `player` in a substitution is off and `assist` is on. Direct/event disagreement remains explicit.

## Rights, duration and isolation

`owner_risk_accepted_private_use` is admitted only for API-Football, EIA-2I1/EIA-2I5A approval, private non-commercial research, durable normalized facts, no redistribution/public/commercial/raw-payload retention, and stop-on-objection. Unknown or inconsistent rights fail closed.

EIA-2I3 duration behaviour is unchanged: `PEN` plus elapsed 120 does not prove extra time; unresolved authoritative duration and extra-time remain null. Direct player minutes remain independent evidence. No fatigue interpretation or coefficient exists.

No production module imports this contract. No pStart, pAppear, p60, xMins, xP, captaincy, squad, transfer, simulation, rank, Mini-League, rival, strategy, Provider Health or visible UI behaviour changes.

## Next gate

EIA-2I5B — Hardened Provider Request and Fixture Discovery Layer — remains unapproved. No part starts automatically.
