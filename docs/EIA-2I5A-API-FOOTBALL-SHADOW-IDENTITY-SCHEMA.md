# EIA-2I5A — API-Football shadow identity and D1 schema contracts

Status: owner-approved repository implementation; draft review gate.  
Base: `62865c9735095ca6b51006fadce15e0a84e68800`.

## Outcome

EIA-2I5A adds an offline, shadow-only identity layer. It does not activate API-Football, make a request, add a credential or secret binding, schedule collection, expose provider data, or connect shadow facts to production calculations or UI.

The versioned, season-scoped competition registry covers API-Football league IDs 2, 3, 848, 45 and 48. Provider league IDs remain provider configuration; canonical competition keys remain separate. Every entry has `liveCollectionEnabled: false`.

## Identity and qualification

- Canonical current-Premier-League teams remain season-scoped Official FPL identities. Only one explicit current-season `VERIFIED` mapping qualifies a provider team. Names and fuzzy matching have no admission role.
- A `VERIFIED` label alone proves nothing: target, season, provider ID, approved method, provenance and positive revision must all validate. Contradictory verified targets for one provider team/effective context make fixture qualification `CONFLICTED`.
- Provider players retain stable `api-football:player:<id>` identity across club changes. Exact normalized full name plus verified club creates only `CANDIDATE`; it never verifies automatically. Participation may be stored without an FPL player mapping and linked later by an append-only mapping.
- Non-PL cup opponents retain `<season>:api-football:team:<providerTeamId>` identity. An independent source can verify a PL-versus-non-PL fixture only after both oriented sides resolve through an explicit provenance-bearing identity crosswalk; text names cannot qualify it.
- Provider fixtures use `<season>:api-football:fixture:<providerFixtureId>`. Kickoff, venue, round, status and score are mutable observations, not identity material. Reuse of one provider fixture ID with incompatible core identity becomes `CONFLICTED`.
- `PROVIDER_QUALIFIED` requires an approved competition/season, stable oriented team IDs and at least one current-season verified PL-team mapping. `CROSS_SOURCE_VERIFIED` additionally requires exactly one independent candidate with resolved canonical competition, season, home and away identities in exact orientation. Kickoff and other mutable metadata cannot rescue identity. Multiple candidates remain `AMBIGUOUS`; hard mismatch is `CONFLICTED`.

Chelsea–Leeds fixture 1636205 therefore retains stable verified identity while the 19:00/19:15 kickoff observations form an explicit conflict and canonical kickoff remains null. No time tolerance exists.

## Storage and participation

Migration 0004 rebuilds `data_source_revisions` with its historical classifications intact and adds narrow owner-risk fields and source-consistency triggers directly to the canonical revision path. Cloudflare D1 cannot disable foreign-key enforcement, so the migration uses `defer_foreign_keys` and rebuilds the complete connected dependent-table graph inside the migration transaction; it copies all rows, drops children before parents, renames replacements parent-first, and recreates all five pre-existing indexes. Wrangler 4.37.1 local D1/Miniflare proves migrations 0001–0004 against populated revision, mapping, run, observation, head and rejection rows with zero post-migration foreign-key violations. It also adds `provider_fixture_identities` and `provider_participation_revisions`. No parallel rights table exists. No request-audit, quota, scheduler, queue or collection-state table is added; those need EIA-2I5B lifecycle design.

Participation keeps lineup role (`STARTER`, `BENCH`, `NO_LINEUP_EVIDENCE`, `UNKNOWN`), appearance state (`STARTED`, `SUBBED_ON`, `NOT_USED`, `UNKNOWN`), direct minutes, substitution directions, substitution-evidence completeness and conflict state separately. `NOT_USED` requires explicit bench, direct zero, `COMPLETE` valid event evidence and no sub-on; D1 enforces the same invariant. Missing/invalid/unknown event evidence or null minutes stays `UNKNOWN`. Zero minutes plus sub-on is conflicting, not `NOT_USED`. Provider `player` in a substitution is off and `assist` is on.

## Rights, duration and isolation

`owner_risk_accepted_private_use` is persistable through canonical `data_source_revisions` only for the actual API-Football source, EIA-2I1/EIA-2I5A approval, private non-commercial research, normalized facts only, no redistribution/public/commercial/raw-payload retention, and stop-on-objection. D1 checks and source-consistency triggers reject malformed or unrelated-provider rows; JavaScript admission matches them. Historical classifications remain unchanged.

EIA-2I3 duration behaviour is unchanged: `PEN` plus elapsed 120 does not prove extra time; unresolved authoritative duration and extra-time remain null. Direct player minutes remain independent evidence. No fatigue interpretation or coefficient exists.

No production module imports this contract. No pStart, pAppear, p60, xMins, xP, captaincy, squad, transfer, simulation, rank, Mini-League, rival, strategy, Provider Health or visible UI behaviour changes.

## Next gate

EIA-2I5B — Hardened Provider Request and Fixture Discovery Layer — remains unapproved. No part starts automatically.
