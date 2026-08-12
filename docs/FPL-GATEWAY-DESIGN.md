# FPL-T1 — Official FPL gateway design and implementation

Status: **historical record — complete and merged.** FPL-T1 merged through PR #69 at `00a35bacd2396a125a8a914bff9980b4f18b257f`, and the owner-controlled allowlisted gateway is the live Official FPL transport. The wording that follows was written while the PR was draft and is not current state: **implemented and deployed for review on then-draft PR #69; live bootstrap transport verified on physical iPhone Safari; full populated application acceptance pending at that checkpoint.**

## Outcome

Teamsheet keeps Official FPL as its authoritative foundation but replaces the unreliable browser-side anonymous relay cascade for Official FPL traffic with one owner-controlled Cloudflare Worker. The Worker is transport infrastructure, not a new football-data provider.

## Approved endpoint capabilities

The gateway allowlist covers season bootstrap, fixtures with an optional valid Gameweek filter, public entry metadata, public picks for one valid Gameweek, public entry history, paged classic-league standings, one player's element summary and one Gameweek's live outcome facts. Exact path and query patterns are enforced in the Worker source and permanent tests rather than reproduced with account-shaped examples in documentation.

## Client behaviour

The exact gateway `/fpl` base `https://teamsheet-fpl-gateway.fpltsheet.workers.dev/fpl` is declared in the built document's `teamsheet-fpl-gateway` meta tag. The build permits only an exact HTTPS `/fpl` URL and adds only `https://teamsheet-fpl-gateway.fpltsheet.workers.dev` to `connect-src`. Malformed or absent configuration fails closed rather than returning to anonymous FPL relays.

Official FPL responses still pass through the existing endpoint validators. A gateway `200` does not establish validity by itself. Existing verified device cache remains the first fallback; without usable live or cached core data, decision surfaces remain restricted.

## Caching

Only unfiltered bootstrap and fixture responses are eligible for a five-minute shared edge cache. Manager, picks, history, league, player-history, filtered-fixture and live-outcome paths are `no-store` initially.

## Preserved boundaries

No provider, source fields, model, expected-minutes, fixture calculation, scoring, squad, captaincy, simulation, optimiser, rank or Mini-League calculation changes. Understat remains team-level and keeps its existing optional relay/fallback path. Odds remains direct-only and no key enters the gateway.

## Deployment and acceptance status
The Worker was deployed through Pritesh's owner-controlled Cloudflare/GitHub connection without sharing or committing a token. Cloudflare production serves `https://teamsheet-fpl-gateway.fpltsheet.workers.dev` and the application is pinned to `https://teamsheet-fpl-gateway.fpltsheet.workers.dev/fpl`. Cloudflare's unsupported `redirect: "error"` mode was replaced with `manual` plus explicit 3xx rejection, preserving the no-redirect security boundary. A physical iPhone Safari request returned live 2026/27 bootstrap JSON.

Remaining gate: test the configured Pages review build with populated Team, Transfers, Fixtures, Player Detail and Leagues data, including app switching, manual refresh, verified-cache fallback and honest restricted behaviour. PR #69 remains draft and unmerged until explicit owner approval.

## Populated-data correction
Physical iPhone acceptance found two pre-season gaps after transport succeeded. Public manager picks are now requested from the valid current Gameweek or, before GW1, the explicit next Gameweek. Missing/incomplete public picks remain unavailable and direct the owner to manual setup; no account credentials or alternate-Gameweek squad is invented. Missing Official FPL team-strength fields now produce a documented partial state: player projections use neutral fixture multipliers and the Fixtures view/sort uses Official FPL's supplied 1–5 difficulty until every required strength field is finite. Normal valid-strength calculations are unchanged.

## Truthful Official FDR presentation
Physical iPhone acceptance showed that one overall Official FPL 1–5 difficulty rating was being presented under separate attacker and defender labels and transformed into an opaque normalised score. In the missing-strength state, the Fixtures surface now exposes only **Overall FPL difficulty**, displays the direct average FDR, states that lower is easier, and applies the correct sorting/trend direction. Separate attacker/defender lenses remain available only when genuine valid team-strength inputs exist. Player projections remain neutral in this fallback; no historical prior is activated by this correction.
