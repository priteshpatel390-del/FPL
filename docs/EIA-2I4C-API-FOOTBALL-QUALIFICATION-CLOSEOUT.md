# EIA-2I4C — API-Football Qualification and Paid-Provider Decision Closeout

Status: **qualified for a separately approved shadow-collector and fixture-identity design checkpoint; no implementation or production use approved**
Baseline: `3f949fdaefdc9445032402c08b9d0717d7c8bffa`
Decision date: 15 September 2026

## Executive decision

API-Football is **QUALIFIED** only to proceed to a separately approved, design-only shadow-collector and fixture-identity checkpoint. This verdict reflects demonstrated current-season factual workload capability; it does not approve a collector, persistence, infrastructure, production activation, model influence, deployment, or any claim of predictive benefit.

Pritesh intends to continue paying for API-Football. API-Football may therefore be considered as a recurring paid external provider for Teamsheet. The previous hard requirement for £0 recurring external workload-provider cost is withdrawn for API-Football; permanent Free operation and EIA-2ALT are no longer release gates. Future reliance on paid entitlement still requires acceptable rights and terms, security, reliability, provenance, validation, quota and rate controls, graceful fallback, storage and retention boundaries, tests, and explicit implementation approval. This decision does not approve a subscription-tier change or another provider.

## Subsequently canonicalized evidence chain

The repository record previously ended at EIA-2I3. This closeout subsequently records the owner-reviewed investigations that followed; it does not imply those intermediate checkpoints were already committed:

1. **EIA-2I4** investigated Free discovery limits.
2. **EIA-2I4R** separated discovery from known-ID enrichment.
3. **EIA-2I4A** attempted current-season closeout but stopped after Free access restrictions and account suspension.
4. **EIA-2I4A-LIVE** used restored paid access for current-season League Cup and Champions League qualification and one season-scoped FPL mapping.
5. **EIA-2I4K** reconciled the Chelsea–Leeds kickoff conflict and concluded that fixture identity remains verified, exact kickoff remains unresolved, fixture-identity contract remediation is required, and EIA-2I4C may resume.
6. **EIA-2I4C** closes provider qualification and records the paid-provider decision and next design gate.

Programme API-Football accounting ended at 78 calls: 67 before EIA-2I4A-LIVE, 10 during it, and one EIA-2I4K known-ID re-fetch. No additional provider call was made for this closeout.

## Historical Free-access evidence

While Free access was functioning, known historical League Cup fixture `1287651` (Nottingham Forest vs Newcastle, 28 August 2024) returned through all four approved endpoint classes: `fixtures?id=1287651`, `fixtures/lineups?fixture=1287651`, `fixtures/players?fixture=1287651`, and `fixtures/events?fixture=1287651`.

That fixture demonstrated known-ID historical fixture retrieval, lineups, player rows with direct minutes, and events. It did not prove permanent contractual Free entitlement. Earlier date and season discovery restrictions were observed runtime behaviour, not permanent provider rules. Free viability is retained as historical operational evidence but is no longer a release gate.

## Paid account and runtime observations

The restored account had paid access, but its exact tier name remains **UNKNOWN**. EIA-2I4A-LIVE observed response headers corresponding to 300 requests per minute and 7,500 requests per day. Those values are runtime observations, not contractual plan entitlements.

## Current-season League Cup evidence

API-Football fixture `1636205`, league `48`, represented Chelsea 6–3 Leeds at Stamford Bridge on 9 September 2026, season 2026, Round of 32, and final status `FT` with elapsed 90. Known-ID retrieval succeeded.

- two lineup records;
- 11 starters and nine bench players per team;
- 40 player rows with stable provider player IDs and direct minutes;
- 21 events: 10 substitutions, nine goals, and two cards;
- no observed player dismissal.

Direct-minute examples were Cole Palmer `152982` (45), Reece James `19545` (45), Wesley Fofana `22094` (14), Levi Colwill `152953` (76), Pedro Neto `1864` (45), and Danny Welbeck `1469` (90). These establish factual provider capability only.

The fixture's consistent `FT` and elapsed 90 normalize under EIA-2I3 to `authoritativeDurationMinutes: 90` and `extraTime: false`. EIA-2I3 remains controlling: provider elapsed is evidence rather than universally authoritative duration; `PEN` alone never proves extra time; ambiguous `PEN` retains null authoritative duration and extra-time state; direct player minutes remain independent facts.

## Unused-substitute variability

League Cup bench player Emiliano Martínez `19599` appeared in the player response with direct `games.minutes: 0` and no substitution-on event. Explicit bench membership plus direct zero minutes plus no sub-on event satisfies `not_used`.

The Champions League sample instead included explicit unused bench player rows with `games.minutes: null`. Direct zero plus confirmed bench plus no sub-on event may establish `not_used`; null minutes remain unknown; bench membership alone does not prove non-appearance; and null is never normalized to zero.

## Season-scoped identity evidence

One 2026/27 player mapping was verified:

| Identity | API-Football | Official FPL |
|---|---:|---:|
| Cole Palmer | player `152982`, Chelsea team `49` | player `154`, Chelsea team `6`, player code `244851` |

Evidence comprised exact full identity, the unique current Official FPL Cole Palmer record, current Chelsea membership on both sides, and elimination of the conflicting Alex Palmer candidate through full identity and club/team context. This is not DOB-based evidence, a universal mapping mechanism, automatic full-squad mapping, or permission for display-name-only matching.

Season-scoped team qualification also established API-Football Chelsea `49` to Official FPL Chelsea `6`, and API-Football Leeds `63` to Official FPL Leeds `13`. No production mapping was persisted.

## Current-season Champions League evidence

API-Football fixture `1635643`, league `2`, represented Club Brugge 2–3 Aston Villa on 8 September 2026 at 16:45 UTC, season 2026, League Stage matchday 1, final status `FT`, elapsed 90. Aston Villa official evidence independently verified competition, season, matchday, date, kickoff, venue, teams, score, and FullTime state.

Known-ID retrieval returned structured lineups and benches, stable player IDs, direct player minutes, events, and substitutions. Club Brugge had 11 starters, 12 bench players, and 23 player rows; Aston Villa had 11 starters, 10 bench players, and 21 player rows. The 21 events comprised five goals, nine substitutions, six cards, and one VAR event. This normal-time sample adds no AET or PEN claim.

## Chelsea–Leeds identity and kickoff conflict

Fixture `1636205` identity is **VERIFIED**. Competition, season, date, home and away teams, venue, completed state, final score, and stable provider fixture ID agree and leave no credible second candidate.

Exact kickoff is an **UNRESOLVED CROSS-SOURCE CONFLICT**:

| Source | Context | Kickoff observation |
|---|---|---:|
| API-Football, EIA-2I4A-LIVE | provider fixture | 19:00 UTC |
| API-Football, EIA-2I4K re-fetch | provider fixture, unchanged | 19:00 UTC |
| Leeds United | official pre-match ticket information | 20:00 BST / 19:00 UTC |
| Chelsea FC | official post-match match centre | 20:15 BST / 19:15 UTC |

The evidence does not establish provider error, Chelsea error, Leeds error, a delayed kickoff, stale scheduling, or scheduled-versus-actual semantics. Exact canonical kickoff remains unresolved. Fixture identity does not require every metadata field to be conflict-free.

EIA-2I4K's design finding is that exact kickoff equality must not be assumed to be an unconditional cross-source identity requirement. Kickoff is important, provenance-bearing, strong corroborating metadata that may be mutable and may conflict. The two times must not be silently treated as equal, and no arbitrary 15-minute tolerance is approved.

## Future fixture-identity remediation gate

**FIXTURE-IDENTITY CONTRACT REMEDIATION REQUIRED — NOT IMPLEMENTED.** A future approved design must distinguish provider-native fixture identity, cross-source qualification, field-level observations and provenance, conflict state, optional canonical values, and correction history.

After qualification, the provider-native fixture ID should remain the durable provider key. Cross-source qualification should use normalized competition, season/effective period, stable mapped home and away identities and orientation, a date/candidate window, and provenance. Completed status and final score may strengthen post-match qualification. Display team names, date, kickoff, score, or round text alone are never sufficient; multiple viable candidates must fail closed.

A bounded post-match correction/re-fetch policy is **RECOMMENDED** for future design: retain provider ID and initial observation, re-fetch near or after completion, compare mutable metadata, preserve provenance, and classify changes as corrected, unchanged, or conflicted. No such policy or conflict state is implemented here.

## Rights, security, and failure boundary

Paying for access does not weaken the existing `owner_risk_accepted_private_use` boundary. Use remains limited to the documented API for one-user private, non-commercial Teamsheet research; only necessary normalized facts may be retained; raw responses remain transient by default; resale, redistribution, public provider feeds, scraping, and bypass are forbidden. Provenance is required, use stops on provider or rightsholder objection, and public or commercial release requires a new rights review.

Credentials remain server-side only, never in client or generated build, logs, UI, relays, or stored facts. Credential-bearing requests remain pinned to the approved HTTPS origin with redirects rejected. Provider failure must degrade gracefully and cannot corrupt existing valid state or alter Official FPL behaviour.

## Model boundary

This qualification covers factual external workload evidence only. It provides no evidence that workload improves `pStart`, `pAppear`, `p60`, `xMins`, `xP`, captaincy, transfers, rank, or Mini-League decisions. No fatigue coefficient or workload penalty is approved. Any future production or model influence requires the existing proposal gate, explicit owner approval, and prospective out-of-sample validation.

## Verdict and next gate

API-Football is **QUALIFIED FOR A SEPARATELY APPROVED SHADOW-COLLECTOR AND FIXTURE-IDENTITY DESIGN CHECKPOINT**. The kickoff conflict is a documented limitation and future contract-design requirement, not a failure of the independently demonstrated XI, bench, player-ID, direct-minute, event, substitution, duration, or season-scoped mapping capability.

The next proposed checkpoint is **EIA-2I5 — API-Football Shadow Collector and Fixture Identity Design**, design only. Its approval proposal should cover target competitions, discovery, provider-native fixture IDs, PL-club filtering, stable team/player mapping, deterministic cross-source qualification, kickoff and metadata conflicts, provenance and correction history, pre-match lifecycle, post-match enrichment, structured workload fields, EIA-2I3 duration semantics, bounded re-fetch and retry policy, quota/rate controls, outage fallback, minimal normalized storage, raw-response transience, security, deterministic tests, and complete isolation from model calculations. It must not implement or deploy the collector without another explicit approval.
