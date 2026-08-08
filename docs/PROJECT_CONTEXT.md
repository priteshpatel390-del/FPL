# PROJECT_CONTEXT.md

Purpose: current product and engineering state. Audience: every session after `CLAUDE.md`. Last reconciled: 8 August 2026.

Related: [Architecture](ARCHITECTURE.md), [Decisions](DECISIONS.md), [Roadmap](ROADMAP.md), [Known Limitations](KNOWN_LIMITATIONS.md), [Teamsheet 2.0 Product Blueprint](TEAMSHEET2-PRODUCT-BLUEPRINT.md), [Historical Records](HISTORICAL_RECORDS.md).

## Outcome

Teamsheet is a healthy, strongly verified FPL decision product. The complete Teamsheet 2.0 migration, owner-controlled Official FPL gateway, exact persistent Transfers work, Team, Player Detail, Fixtures, Leagues pre-season acceptance, Repository Truth A1 and Safe Hygiene A2 are merged. No formula, recommendation or new-provider checkpoint is approved.

The immediate approved work is Refresh-Load R1 on a separate review branch. It changes acquisition cadence only: valid detailed histories, normalised Understat team inputs and key-free derived Odds inputs can be reused without repeating their network requests. Understat parser repair, atomic foreground-state replacement and model/data-source expansion remain separately gated.

## Evidence baseline

| Item | Evidence |
|---|---|
| Repository baseline | GitHub `main` `2eee62b77291af06552e3d1952b6e1a6355ca7e0`, merge of PR #95 |
| Latest substantive application checkpoint | PR #92, merge `6f0501ffc0aff368f9a60aae6de0d552ec2c44a5`; exact reviewed head `130b0a298d4b21c2758e3199b9a82e2e3b0fc58f` |
| Application tree | PR #92 head and merge share `455cc281b5a7528d37884326708a63d22fe54c35` |
| Permanent automated baseline | Verify Teamsheet run `31256999867`: 667 passed, 0 failed, 0 skipped, 0 cancelled on exact PR #95 head `c1ebd7610b9a81f893457b8bb1bb41316de80dc0` |
| Build baseline | Two exact-identity production builds were byte-identical; root `index.html` equalled `dist/index.html`; manifest identity matched the exact PR #95 head |
| Current candidate | Refresh-Load R1 exact source `ac02aca03e3de0fe72e83a332b14abfbe0848a6d`: 679/679 tests passed; deterministic double build, root/deployable equality and manifest identity verified; remote CI remains pending until publication |
| Deployment architecture | Static GitHub Pages single-file app plus a separate owner-controlled Cloudflare Worker for allowlisted read-only Official FPL transport |
| Approval boundary | R1 acquisition policy, tests, docs and draft PR only; physical iPhone acceptance and merge remain separately owner-gated |

## Physical iPhone Safari baseline

Pritesh has physically accepted the tested populated paths for:

- Transfers, including the six-Gameweek exact calculation, result persistence, cancellation/restart, app switching, stale-result protection and **No hit** wording;
- Player Detail scrolling, rotation, background restoration and dock layering;
- Team startup ownership, availability presentation, reserve-goalkeeper bench position and outfield bench order;
- Fixtures horizontal scrolling and remaining-season horizons through GW38;
- the Leagues all-league hub, league selection/switching, primary persistence, back navigation, pre-season standings/exposure states and Official FPL versus manually added league management.

Do not generalise those checks beyond the recorded paths. [Leagues pre-season acceptance](LEAGUES-PRESEASON-ACCEPTANCE.md) is authoritative.

## Deferred live-season acceptance

The following Leagues evidence requires real post-Gameweek Official FPL data and is deliberately deferred:

- published rank and movement;
- populated standings and points gaps;
- nearby-rival selection and pairwise comparison;
- selected-rival squad, captain, vice-captain and chip exposure;
- stale, incomplete and unavailable rival handling against real responses;
- relevant large-league targeted pagination.

These are evidence gaps, not current defects. Any issue found later must be investigated and scoped separately before implementation.

## Product purpose

Teamsheet helps an FPL manager make better decisions about their own complete 15-player squad. It is team-first rather than player-first and decision-first rather than data-first. The ordinary weekly workflow should answer:

1. What is my best XI, captain, vice-captain and bench order?
2. Should I roll, transfer or take a hit?
3. Which fixture runs matter to my current team and transfer plans?
4. Where do I stand in my leagues and how do explicitly selected rivals differ?
5. Is any data limitation material to the decision?

Technical diagnostics, evidence operations and advanced research remain available under Settings without dominating the primary workflow.

## Implemented information architecture

The deployed primary navigation is:

1. **Team**
2. **Transfers**
3. **Fixtures**
4. **Leagues**
5. **Settings**

Player Explorer lives under Settings → Research Tools. Ask Teamsheet has a global/Team route, but hosted AI is disabled because client-side Anthropic keys are prohibited. Free transfers and bank remain visible on Team and are currently manual inputs rather than proven authoritative account values.

## Implemented capability

### Team

- legal 15-player squad gating and a pitch-first connected/manual/restricted experience;
- deterministic best XI, captain, vice-captain and bench order;
- base-XI and captain-uplift forecast presentation;
- one material risk and advisory deadline action;
- session-only decision preview without FPL account writes.

### Transfers

- exact zero-to-three-transfer search over the approved eligible universe;
- mandatory zero-transfer comparison, complete squad legality, affordability, hits, free-transfer utility and roll value;
- application-scoped Web Worker calculation that survives internal navigation;
- independent reduced-pool exhaustive oracle and permanent exactness/performance guards.

### Fixtures

- blanks, doubles, difficulty lenses, run scores and swing windows;
- Official FPL overall-FDR fallback when strength inputs are unavailable;
- user-selected horizons bounded by the remaining season through GW38.

### Leagues

- all-league hub using already-loaded Official FPL membership facts;
- invitational/general/saved grouping and honest unpublished-rank handling;
- selected-league detail, targeted/incremental standings, pairwise rival comparison and at-most-five explicitly selected rival exposure;
- no full-league squad fan-out, projected rank, effective-ownership strategy or protect/chase recommendation.

### Settings and evidence

- Team & Account, Research Tools, Evidence & Performance, Data & Diagnostics and Help & About route groups;
- seven-state Provider Health and consequence-led core-data warnings;
- immutable pre-deadline snapshots, Official FPL outcomes, descriptive metrics and operating review;
- deterministic JSON, Markdown and eight CSV exports; Google Sheets remains a manual downstream destination.

## Engineering foundation

- Vanilla JavaScript ES modules; no framework and zero runtime dependencies.
- Node built-in tests and a custom deterministic bundler.
- `src/` plus `app.html` are canonical; `dist/` and root `index.html` are generated only by `build.mjs`.
- GitHub Pages serves the byte-identical root deployment copy.
- The Cloudflare gateway is transport-only and performs no account write, model computation or secret handling.
- Optional providers fail gracefully; Understat remains team-level and Odds remains direct-only.
- Validated supporting inputs use separate local caches; Understat raw HTML and Odds secrets are never stored in those caches.
- Stage 10 evidence flows one way from frozen prediction to outcome to evaluation to review and cannot feed back into live recommendations.

## Current product gaps

- No single synthesised weekly action across Team, Transfers and Fixtures.
- No validated projected-rank or tactical Mini-League strategy model.
- No cited team-news, predicted-line-up, press-conference, cup-congestion or travel intelligence.
- Bank and free transfers are not yet authoritative account-derived values.
- Hosted Ask Teamsheet remains unavailable.
- Prospective 2026/27 accuracy and calibration evidence has not yet accumulated.
- Google Sheets export is manual and the app cannot run guaranteed work while fully closed on iPhone.

## Current technical risks

- R1 is not yet merged, so deployed live-season minute refresh can still fan out to roughly 80–95 Official FPL requests;
- the flattened bundle depends on an explicit module order that is broader than the direct import graph;
- Team currently layers a decision-first renderer over legacy Team DOM construction;
- tracked build identity semantics can be misunderstood because generated artefacts record their generating source identity, not necessarily the later documentation-only `main` commit;
- browser automation cannot replace physical Safari layout and interaction evidence.

These are roadmap inputs, not authority to change them.

## Current and next

### Approved now

**Refresh-Load R1:** validated revision-aware minute history reuse, active-squad-first delta loading, systemic-outage guard, normalised Understat cache/cadence, key-free derived Odds cache/cadence, manual bypass and separate supporting-data health disclosure. Draft publication is approved; merge is not.

### Required before merge

Exact-commit/full-CI verification plus physical iPhone startup and foreground acceptance across live, cached, stale and offline supporting-data states.

### After real Gameweek data

Perform the deferred Leagues acceptance and begin genuine Stage 10 evidence review. Investigate defects first; do not tune calculations or add football inputs from a small or unavailable sample.

## Non-negotiable limits

Refresh-Load R1 changes acquisition cadence and validated local persistence only. It changes no provider/source/endpoint, model, fixture, scoring, expected-minutes, squad, captaincy, simulation, transfer, rank, Mini-League, strategy, route, navigation, Cloudflare or Pages architecture. Historical aggregate r=0.80 remains method-flattered and is not a validated accuracy claim.
