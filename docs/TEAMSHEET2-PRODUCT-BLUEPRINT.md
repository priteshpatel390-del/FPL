# TEAMSHEET2-PRODUCT-BLUEPRINT.md — Canonical Product Blueprint

Status: **Approved by Pritesh on 30 July 2026; navigation amendments approved 31 July 2026.** This document is the authoritative product direction for Teamsheet 2.0 work.

Purpose: define the product vision, information architecture, decision philosophy, user experience standards and incremental migration checkpoints for Teamsheet — FPL Decision Desk.

Related: `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `ROADMAP.md`, `KNOWN_LIMITATIONS.md`, `STAGE9-DESIGN.md`, `STAGE10-DESIGN.md`.

## 1. Product Vision

Teamsheet exists to help Fantasy Premier League managers maximise the performance of their own team through intelligent, explainable, team-level recommendations.

The product is a decision desk for the manager's complete 15-player squad. It should tell the manager what matters, what action is justified and what can safely be left alone. It is not primarily a player database, data dashboard or collection of disconnected tools.

The intended experience is a polished, fast, mobile-first football application. The manager should be able to open Teamsheet shortly before a deadline, understand the state of the team within seconds and act with confidence without needing to interpret raw model output.

The complete squad is the optimisation unit. Player recommendations are useful only in the context of formation, captaincy, bench order, budget, free transfers, points hits, future flexibility and the manager's competitive position.

## 2. Product Principles

### 2.1 Team-first, not player-first

The primary object is the manager's complete 15-player squad. Individual player analysis supports team decisions rather than leading the product hierarchy.

### 2.2 Decision-first, not data-first

Every primary screen must answer one main user question. Data and evidence should be shown only where they help the user make or understand that decision.

### 2.3 Explainable recommendations

Recommendations must state the action, the main reason, the important trade-off and the material uncertainty. Advanced evidence remains available progressively rather than dominating the first view.

### 2.4 The no-action option is real

Doing nothing, rolling a transfer or retaining the current captain must be treated as valid recommendations. The interface must not imply that activity is automatically better than restraint.

### 2.5 Complete-team consequences

A transfer recommendation must be evaluated against its effect on the starting XI, captaincy, vice-captaincy, bench, squad legality, budget, hits and future flexibility. Low ownership or an isolated player projection is never sufficient by itself.

### 2.6 Official facts and projections remain distinct

Confirmed Official FPL results must never be blended visually or semantically with projected values. Forecasts, descriptive hindsight and official outcomes require clear labels.

### 2.7 Progressive disclosure

Primary destinations show the decision and its immediate evidence. Research, diagnostics, model limitations and operational tooling live behind organised secondary routes.

### 2.8 Mobile-first speed and clarity

The primary experience is designed for an iPhone. Navigation, touch targets, hierarchy, loading behaviour and content density must be tested for a narrow portrait screen before desktop refinement.

### 2.9 Preserve verified engineering

Teamsheet 2.0 is an incremental product migration, not permission for a framework rewrite. Existing tested model, provider, evidence, security, build and deployment boundaries remain authoritative unless separately changed through the approved workflow.

### 2.10 Honest confidence

Teamsheet must not claim validated accuracy, calibration or causal provider value without the required prospective evidence. The historical aggregate r=0.80 remains method-flattered.

## 3. User Personas

### 3.1 The weekly FPL manager

The primary user wants a reliable answer before the deadline: best XI, captain, bench order and whether a transfer is necessary. This user values speed, clarity and direct recommendations more than model detail.

### 3.2 The competitive Mini-League manager

This user is trying to protect a lead, close a gap or understand why rank changed against friends, family or colleagues. The user needs squad overlap, captain exposure, weekly gains and losses, rival threats and meaningful differentials, not generic ownership trivia.

### 3.3 The engaged research user

This user wants to explore players, fixtures, uncertainty and comparisons before accepting a recommendation. Research tools must support the decision workflow without replacing it.

### 3.4 The evidence-conscious owner or reviewer

This user needs provider status, deadline evidence, official outcomes, model metrics, exports, limitations and build identity. These controls are important but should not crowd the ordinary weekly workflow.

The same person may move between these personas during a Gameweek. The information architecture should support that progression without forcing every user through the advanced surfaces.

## 4. Weekly User Journey

### 4.1 Open Teamsheet

The app verifies approved data sources and presents a coherent state. Previously verified content may remain visible during foreground refresh, but decision controls must not act on mixed data.

The Team destination opens by default. The football pitch is visible immediately, including before a squad is connected, so the product purpose is clear from the first screen.

### 4.2 Understand the team

The manager sees the recommended XI, captain, vice-captain and bench order on the pitch. A compact decision summary states projected team performance, the most important risk and the next required action.

### 4.3 Decide whether a transfer is needed

The Transfers destination begins with the zero-transfer baseline. It answers whether to roll, transfer or take a hit, then explains the whole-squad consequences of the best approved plan.

### 4.4 Inspect supporting detail

The manager may open player detail, comparison, fixture or uncertainty information. This detail is subordinate to the active team or transfer decision.

### 4.5 Review competitive context

The Mini Leagues destination explains global-rank movement and private-league performance using confirmed results and clearly labelled supported projections. It identifies captaincy, bench, transfer and player drivers rather than presenting raw tables alone.

### 4.6 Complete deadline actions

The primary screen highlights anything that must be done before the deadline. Teamsheet does not submit actions to FPL; the manager completes them in the official FPL product.

### 4.7 Review the completed Gameweek

After official checking, Teamsheet separates confirmed outcomes from forecasts, explains rank and league movement and updates descriptive evidence. The operating-review and export infrastructure remains available under Settings for advanced review.

## 5. Information Architecture

### 5.1 Approved primary navigation

1. **Team**
2. **Transfers**
3. **Fixtures**
4. **Leagues**
5. **Settings**

This owner-approved 31 July 2026 amendment recognises fixtures as an everyday FPL decision surface and uses the shorter Leagues label for mobile navigation. Ask Teamsheet is a prominent global and Team action with its own route rather than a sixth bottom tab. Players leaves primary navigation and More is replaced by Settings.

### 5.2 Team

The Team destination should answer:

- What is my best starting XI?
- Who should I captain?
- Who should I vice-captain?
- What should my bench order be?
- How is my team projected to perform?
- What is the most important risk?
- What must I do before the deadline?

The pitch is the dominant visual and appears immediately. Free transfers and bank remain visible because they directly affect weekly decisions. Setup states should preserve the pitch and explain the next connection step rather than replacing the product with a form.

### 5.3 Transfers

The Transfers destination should answer:

- Should I make a transfer?
- Should I roll?
- Is a points hit justified?
- What is the best plan for the whole squad?
- How does the move affect XI, captaincy, bench, budget and future flexibility?

The zero-transfer baseline remains visible and meaningful. Player replacement discovery belongs inside the transfer journey rather than in a separate primary Players destination.

No optimiser objective or formula is changed by this blueprint.

### 5.4 Fixtures

Fixtures is a primary destination because fixture runs, blanks, doubles, difficulty lenses and swing windows are routinely used to plan FPL decisions. The destination supports Team and Transfers without changing fixture calculations.

### 5.5 Leagues

Mini Leagues is a flagship primary destination, not a secondary item under More or Settings.

It contains two connected areas:

- global FPL performance;
- private Mini-League performance.

The destination should lead with the user's competitive position, movement and drivers, then progressively reveal rival and differential detail.

### 5.6 Settings

Settings replaces More and is an organised menu, not one long scrolling page.

#### Team & Account

- manual squad
- account and connection guidance
- saved-league guidance and links

#### Research Tools

- player explorer
- watchlist or shortlist
- detailed comparisons

Fixture exploration is a primary Fixtures destination rather than a hidden research tool.

#### Evidence & Performance

- deadline evidence
- official outcomes
- metrics
- operating review
- exports
- model-performance limitations

#### Data & Diagnostics

- optional provider controls
- Provider Health
- backtest and calibration controls
- recovery
- reset and deletion controls

#### Help & About

- recommendation explanations
- expected-points and uncertainty guidance
- known limitations
- privacy and data handling
- version and build identity
- live-season operations

Persistent healthy Provider Health should eventually be removed from the main header. Primary-screen warnings should appear only when a data issue materially affects a recommendation.

## 6. Screen Audit

### 6.1 Current Team surface

**Verified foundation to preserve:** team-pitch renderer, club-shirt palettes, captain and vice treatment, player-detail sheet, best-XI logic, session-only decision previews and mobile-first presentation work.

**Future product gap:** the screen must become a complete decision home rather than mainly a squad visualisation. It needs a concise team forecast, priority risk and deadline action summary while preserving the pitch as the first visual.

### 6.2 Current Players destination

**Verified foundation to preserve:** player search, projection detail, uncertainty presentation and comparison-capable data surfaces.

**Future direction:** remove Players from primary navigation. Replacement discovery moves into Transfers. Broader exploration moves to Settings → Research Tools.

### 6.3 Current Transfers surface

**Verified foundation to preserve:** exact 0–3 transfer optimiser, mandatory zero-transfer baseline, full squad legality, bank/free-transfer/hit handling and session-only preview.

**Future product gap:** translate optimiser output into a clear roll/transfer/hit recommendation with whole-team consequences. The implementation must not change the optimiser formula without a separate approved model item.

### 6.4 Current More and Settings surfaces

**Verified foundation to preserve:** existing settings controls, Provider Health detail, deadline evidence, official outcomes, metrics, operating review, exports, recovery and diagnostics.

**Future direction:** replace More with an organised Settings destination using the approved five-section hierarchy. Avoid an endless mixed-purpose scroll.

### 6.5 Current Mini-League surface

**Verified foundation to preserve:** Official FPL league and rival access, existing effective-ownership and comparison inputs where valid.

**Future product gap:** promote Mini Leagues to primary navigation and redesign it around competitive outcomes, movement, rival exposure and tactical questions. New strategy logic is not authorised by this blueprint.

### 6.6 Header and global status

**Verified foundation to preserve:** seven Provider Health states and fail-safe provider consequences.

**Future direction:** persistent healthy status should not consume prime header space. Material warnings remain visible where they affect a recommendation; full detail lives under Settings → Data & Diagnostics.

## 7. Decision Engine Philosophy

### 7.1 Recommendations operate at squad level

The correct comparison is between complete legal team states, including doing nothing. Player-level expected points are inputs to a team decision, not independent recommendations.

### 7.2 Decision hierarchy

For each relevant surface, Teamsheet should present:

1. the recommended action;
2. the zero-action or current-state baseline;
3. the expected team consequence;
4. the main reason;
5. the principal risk or uncertainty;
6. the relevant supporting detail.

### 7.3 Transfer decisions

Transfer recommendations must consider the complete approved optimiser context: legal 15-player squad, best XI across the stored horizon, free transfers, hits, bank, club quotas and roll value. The interface may explain these fields but must not reinterpret or change their formula without explicit owner approval.

### 7.4 Captaincy and bench decisions

Captain, vice-captain and bench order are team mechanics. Their presentation should explain role, projected value and material availability or uncertainty risk without inventing confidence.

### 7.5 Restraint is a recommendation

The zero-transfer baseline is mandatory. A roll recommendation should be presented positively when it preserves more value or flexibility than an available move.

### 7.6 Evidence and hindsight

Official outcomes and descriptive hindsight oracles may explain what happened after a deadline. They must not be restated as recommendations that were available beforehand.

### 7.7 Competitive strategy gate

Any future protect, balanced or chase strategy model requires a separate design and explicit approval. League position or ownership alone must not silently alter production recommendations.

## 8. Global Rank and Mini-League Vision

### 8.1 Global FPL performance

Future supported capabilities should include:

- overall rank;
- Gameweek rank;
- Gameweek score;
- average Gameweek score;
- points above or below average;
- overall-rank movement;
- remaining players and captain exposure;
- projected final Gameweek score and rank movement where properly supported;
- captaincy gain or loss;
- bench points;
- transfer costs;
- players driving global-rank movement;
- meaningful differential analysis.

Confirmed Official FPL values and supported projections must always be visually and verbally separated.

### 8.2 Private Mini-League performance

Future supported capabilities should include:

- current position;
- points gap;
- projected weekly position;
- captain comparison;
- weekly gains and losses;
- squad overlap;
- rival exposure;
- differential opportunities;
- closing or protecting a gap;
- historical league movement;
- tactical recommendations where an approved strategy model exists.

### 8.3 Meaningful differentials

Low ownership alone does not make a player a good recommendation. A useful differential must have a credible team-level case, suitable expected minutes and a favourable effect on the manager's squad and competitive objective.

### 8.4 Projection boundaries

Projected live rank, final Gameweek score, remaining-player exposure and rival outcomes require reliable source data and a separately reviewed design. Unsupported precision must not be manufactured.

### 8.5 Strategy boundaries

The application may describe whether a manager is leading or chasing and show rival differences. It must not change the recommendation engine into a protect/chase model until the exact behaviour, inputs, fallbacks, assumptions, limitations and tests are separately approved.

## 9. UX Standards

### 9.1 One primary question per screen

Every primary destination has one dominant purpose. Secondary cards and controls must support that question rather than compete with it.

### 9.2 Football application, not technical dashboard

Use the pitch, shirts, role badges, fixtures and football language as the main visual grammar. Technical provenance and diagnostics remain available but subordinate.

### 9.3 Immediate orientation

The default screen must communicate within seconds:

- which team or setup state is active;
- the recommended XI and captaincy;
- whether action is required;
- whether a material data warning exists.

### 9.4 Fast and responsive

Avoid unnecessary startup detail, repeated loading states and expensive blocking work. Preserve verified startup consistency and performance boundaries.

### 9.5 Progressive detail

Compact summaries open into player detail, recommendation explanations, comparisons, evidence and diagnostics. The first screen should not require the user to understand provider states, calibration or model internals.

### 9.6 Clear state language

Use explicit labels for:

- model recommendation;
- user preview;
- current saved squad;
- official result;
- projection;
- recovery-only evidence;
- unavailable or degraded data.

### 9.7 Material warnings only

Primary-screen alerts must explain a concrete recommendation consequence. Healthy provider detail and non-actionable diagnostics belong in Settings.

### 9.8 Mobile acceptance

Each migration checkpoint requires representative narrow-screen tests and physical-device review where visual or interaction behaviour changes. The absence of a persistent screenshot-regression suite remains a limitation.

### 9.9 Accessibility and security

Preserve semantic controls, focus behaviour, DOM-builder boundaries, restricted Markdown, class-only presentation and CSP protections.

### 9.10 No hidden account actions

Teamsheet remains advisory. It must not silently change the user's FPL squad, captain, transfers or league settings.

## 10. Migration Strategy

Teamsheet 2.0 evolves incrementally from the verified engineering foundation. Every checkpoint must be independently designed, approved, tested, reviewed and deployable.

### Teamsheet 2.0.1 — Navigation and Settings architecture

- Replace primary navigation with Team, Transfers, Fixtures, Leagues and Settings.
- Remove Players from primary navigation and replace More with the organised Settings hierarchy.
- Keep Team ID, free transfers and bank visible on Team.
- Make Ask Teamsheet a prominent Team/global action with its own route.
- Add hash routing, browser history, deep links, focus and legacy aliases.
- Preserve access to every existing functional surface without changing formulas or providers.
- Record and test navigation, focus, responsive and no-regression behaviour.

This checkpoint was explicitly approved on 31 July 2026.

### Teamsheet 2.0.2 — Team decision home

Implementation status: **owner-approved presentation scope implemented and verified for review on 31 July 2026.** Existing decision calculations and separately gated data/account/refresh work remain unchanged.

- Make the pitch immediately visible in connected and unconnected states.
- Add concise best-XI, captaincy, bench, forecast, risk and deadline-action summaries.
- Preserve existing best-XI, captaincy, squad and preview logic.

### Teamsheet 2.0.3 — Transfer decision experience

- Lead with roll/transfer/hit guidance and the zero-transfer baseline.
- Integrate replacement discovery and whole-squad consequence explanation.
- Preserve the existing optimiser formula and objective unless separately approved.

### Teamsheet 2.0.4 — Global rank and Mini-League foundation

- Promote Mini Leagues to a complete primary destination.
- Establish confirmed global and private-league facts, movement and comparison foundations.
- Keep official outcomes and projections separate.

### Teamsheet 2.0.5 — Mini-League intelligence

- Add supported rival exposure, overlap, differential and tactical insight.
- Require a separate approved design before any protect, balanced or chase recommendation model.

### Teamsheet 2.0.6 — Research, evidence and diagnostics organisation

- Complete the Research Tools, Evidence & Performance, Data & Diagnostics and Help & About structures.
- Move persistent healthy Provider Health away from the main header while preserving material warnings.

### Teamsheet 2.0.7 — Final mobile polish and acceptance

- Complete visual hierarchy, interaction consistency, performance, accessibility and physical-device acceptance.
- Confirm every primary screen answers one main question.
- Confirm no verified engineering capability was lost during migration.

### Preserved engineering foundation

The migration should preserve as much verified work as practical, including:

- vanilla JavaScript ES modules;
- zero-dependency toolchain;
- deterministic custom build;
- GitHub Pages hosting;
- single-file `dist/index.html` deployment;
- current provider and security boundaries;
- team-pitch renderer;
- shirt palettes;
- player-detail sheet;
- session-only decision previews;
- best-XI logic;
- captaincy logic;
- transfer optimiser;
- Stage 10 evidence, outcomes, metrics and review infrastructure;
- existing test coverage.

A framework rewrite, backend migration or new provider is not implied by this product blueprint.

## 11. Known Limitations

- Prospective model accuracy and probability calibration are not yet established.
- The historical aggregate r=0.80 is method-flattered.
- Static GitHub Pages cannot run guaranteed closed-app collection.
- Provider endpoints are undocumented or operationally fragile in places.
- Provider Health is session-scoped.
- Browser evidence and exports remain owner-controlled, local and unencrypted.
- Mini-League facts depend on available Official FPL public endpoints and schema stability.
- Projected live rank and rival outcomes are not yet designed or validated.
- No protect, balanced or chase strategy model is approved.
- Actual manager transfer identities are not retained in the current Stage 10 outcome contract.
- No persistent screenshot-regression suite exists; physical mobile review remains necessary.
- Current information architecture and screen behaviour remain Stage 9-era until the migration checkpoints are implemented.

## 12. Explicit Non-Goals

This blueprint does not authorise:

- any UI implementation in the blueprint-integration item;
- Teamsheet 2.0.1 implementation before its separate design and approval;
- changes to projection, expected-minutes, scoring, calibration, fixture, uncertainty, best-XI, captaincy, squad, simulation or transfer-optimiser logic;
- changes to Provider Health states, provider transports, validation, retries, fallbacks or source allowlists;
- a framework rewrite or new package dependency;
- a backend, database, OAuth flow or automatic Google Sheets sync;
- FPL account write actions;
- official FPL or club artwork;
- an unapproved live-rank model;
- an unapproved protect, balanced or chase strategy model;
- accuracy, calibration or causal-provider claims unsupported by prospective evidence;
- rewriting historical Stage 9 records as though their approved decisions were incorrect at the time.

## 13. Approved Product Decisions

1. Teamsheet is a team-level FPL decision product centred on the user's complete 15-player squad.
2. The primary navigation is Team, Transfers, Mini Leagues and Settings.
3. More is replaced by Settings.
4. Players is removed from primary navigation.
5. Replacement discovery belongs in Transfers.
6. Advanced player and fixture exploration belongs in Settings → Research Tools.
7. Team is the default destination and the pitch is visible immediately, including before squad connection.
8. Team must answer XI, captaincy, bench, team projection, main risk and deadline-action questions.
9. Transfers must make roll, transfer and hit decisions explicit and retain a meaningful zero-transfer baseline.
10. Mini Leagues is a flagship primary destination covering global and private-league performance.
11. Official results and projected values must remain clearly separated.
12. Low ownership alone is not a recommendation.
13. Any protect, balanced or chase strategy model requires separate design and explicit approval.
14. Settings uses the approved five-section organised hierarchy.
15. Persistent healthy Provider Health should later leave the main header; material recommendation warnings remain visible.
16. The existing seven Provider Health states remain unchanged.
17. Teamsheet 2.0 will migrate through checkpoints 2.0.1–2.0.7, each independently designed, approved, tested, reviewed and deployable.
18. The Stage 9 information architecture is superseded for future development, while the Stage 9 engineering foundation and historical record remain valid.
19. Existing verified model, provider, evidence, security, build and deployment work should be preserved unless a later approved item explicitly changes it.
20. This blueprint records product direction only and authorises no application implementation.

## 2.0.1 physical-review amendment — 31 July 2026

The global shell uses one compact Ask Teamsheet composer at the top of every destination, with an internal claret upward-arrow send control. Data and Evidence are Settings content, not global header controls. The five primary destinations share one fixed safe-area dock and controlled monochrome icons. These presentation decisions do not authorise changes to provider transport, foreground refresh trust boundaries or account-derived bank/free-transfer data.
