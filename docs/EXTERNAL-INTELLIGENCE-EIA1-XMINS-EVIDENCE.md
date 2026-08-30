# EIA-1 — Expected-Minutes Evidence Activation

## Outcome

EIA-1 establishes a **shadow/evaluation/research-only** boundary. Pure adapters can freeze existing Teamsheet pre-deadline snapshots, Official FPL outcomes and authenticated DATA-S2B observation exports for DI-2. A provider-neutral workload contract keeps schedule-density and player-workload facts separate. No production signal, provider registration, forecast, recommendation or model input is added.

Authoritative source baseline: `3cc39b5c54fd1778ad1b81dc3cf3ce817117ac00`. DATA-S2B remained live-unaccepted at implementation time, so its adapter is fixture-proven only and no live evaluation is claimed.

## Evidence adapters

`eia1-evidence-adapters.mjs` requires an exact cutoff and rejects post-cutoff or post-deadline facts. Snapshot identity, content hash, season, Gameweek, deadline, build/model/rules/provider provenance, expected-minutes predictions and their baseline inputs are retained. Outcome adaptation requires exact season/Gameweek/deadline/snapshot identity and hash agreement; provisional/complete/corrected state and deterministic supersession are explicit. Minutes, start, appearance and 60-minute targets are emitted only from retained Official outcome fields and remain `null` when unavailable.

The DATA-S2B adapter consumes an offline envelope containing every page returned by the existing `/v1/shadow/observations` read. The envelope records the cursor used to request each page. The adapter requires one invariant `as_of`, a chain from a null first request cursor through each preceding `next_cursor`, a terminal null cursor, unique observation identities, and already-strict global `fetched_at, observation_id` order. Missing pages, mixed cutoffs, discontinuities, duplicates, unordered rows and unterminated exports fail closed, so a 50/100-row page cannot masquerade as a complete export. It permits only `official-fpl-r1` and the DATA-S2A event/team/player/fixture category/metric allowlist and preserves complete observation rows. The adapter preserves, rather than independently pins, each accepted row's collector `transform_version` and `validation_version`; permanent fixtures use the real `data-s2a-official-fpl-history-v1` and `data-s2a-official-fpl-validation-v2` values. Manager/account fields fail closed. No Worker, endpoint, D1 table, collector, Cron, Wrangler, Cloudflare or authentication change was needed.

Only finalized existing outcome records cross the outcome adapter. A valid immutable outcome ID, both 64-character hashes and a positive revision are mandatory; the relationship must be `matched_official` for the exact frozen snapshot. Provisional/complete/corrected completeness must agree, while corrected records require revision 2 or later and an explicit superseded outcome. The adapter neither recomputes Official results nor creates a competing identity.

## Workload contract and overlap control

The contract represents source facts, mapping state, fixture/competition identity, kickoff/venue, participation, substitutions, extra time, schedule windows, non-PL workload, bitemporal provenance, correction, missingness and rights. Unknown is never zero. Squad listing is not a start; a start is not 90 minutes; extra time is never inferred. The four future experiment arms are fixed as baseline, schedule density A, player workload B, and A+B. They are design metadata only: no approved workload-to-xMins transform exists, so the experiment is `not_yet_evaluable`.

Overlap graph:

* expected minutes: historical PL minutes ↔ Official availability ↔ non-PL workload ↔ schedule congestion ↔ injury/team news ↔ predicted lineups;
* team expectation: Official FPL strength ↔ Understat recent form ↔ betting odds;
* role: role/set-piece changes ↔ player event-rate changes;
* travel: travel ↔ rest/congestion ↔ market expectation.

EIA-1 adds no signal from the other clusters and creates no fatigue score, congestion penalty, xP modifier or xMins modifier.

## TheSportsDB qualification — FAIL for EIA-1 workload evidence

First-party material was retrieved on **2026-08-30**:

* Terms of Use: <https://www.thesportsdb.com/docs_terms_of_use.php> (page says last updated 2025-07-01).
* API documentation/authentication: <https://www.thesportsdb.com/documentation> and <https://www.thesportsdb.com/api.php>.
* pricing/tiers: <https://www.thesportsdb.com/docs_pricing.php> and <https://www.thesportsdb.com/pricing>.

Concise rights finding: the terms permit copying/modifying content returned by official API endpoints and prohibit website scraping; free API use is framed for development projects, app-store publication requires a paid subscription, paid projects must credit TheSportsDB, trademarks/copyright notices cannot be altered, and third-party content may be used only with the relevant owner's permission or another legal basis. This last caveat prevents a conclusive field-level retention decision for football lineups and event facts. Repository taxonomy: **`local_research_only`**, fail closed. Durable retention of provider sports facts is **blocked**; only this aggregate capability result is retained.

The documentation publishes free v1 key `123` in the request path, premium v1 keys in URLs, and premium-only v2 header authentication. Private keys must therefore remain local/server-side and be redacted from artifacts/logs. The published limits are 30 requests/minute free, 100 premium and 120 business; the free tier also restricts many query result counts (including team/player searches, schedules and season events).

Declared fixed sample `eia1-tsdb-fixed-v1` used official v1 API calls only: Arsenal team mapping and Bukayo Saka player mapping plus documented lineup/timeline capability endpoints. Team and player identity lookups were available, and the API schema advertises event kickoff/venue, lineup and timeline endpoint classes. However, the free tier's bounded results do not support reproducible representative Premier League domestic-and-European schedule coverage, and the documented lineup/timeline contracts do not guarantee complete player minutes, substitution pairs, extra-time semantics, source timestamps or correction revisions. Those are the xMins-critical fields. Consequently competition, event, lineup, minute and correction coverage cannot be accepted from this sample. No uncontrolled crawl, website scrape, raw-response commit or durable provider fact retention occurred. The qualification is **FAIL**, rather than silently adding another provider.

## Evaluation evidence and limits

The repository contains contracts and synthetic test fixtures but no committed legitimate real snapshot/outcome artifact pair suitable for publishing a real baseline report. No historical fact was manufactured and no current provider state was projected backwards. The retained deterministic evidence report therefore records `baseline_not_available` and workload `not_yet_evaluable`; it is contract evidence, not accuracy evidence. A genuine future baseline requires owner-controlled real snapshot/outcome exports. A workload ablation additionally requires prospective pre-deadline workload observations and a separately owner-approved prediction/transform.

No production promotion occurred. `DI3_PARITY_POLICY.allowedProductionSignals` remains empty. Recommendation diff is zero by dependency isolation: none of the EIA-1 modules is imported by the application, models, providers, Team, Transfers or DI-3 runtime.

## Next owner gate

**Stop the TheSportsDB workload signal family for expected-minutes use.** Its current evidence does not establish the required field coverage and third-party field-retention rights remain unresolved. Another provider is explicitly outside EIA-1.
