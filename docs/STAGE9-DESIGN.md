# Stage 9 — UI Integration Design

Status: **Approved by Pritesh on 28 July 2026.**

Purpose: convert Teamsheet into a polished, mobile-first FPL decision application without changing projection, expected-minutes, scoring, fixture, captaincy, squad-simulation, provider or transfer-optimiser rules.

## Approved product structure

The primary navigation is:

1. **Team** — the default screen and main decision surface.
2. **Players** — player search, comparison and projection detail.
3. **Transfers** — the exact Stage 6 optimiser and temporary plan previews.
4. **More** — fixtures, mini-league, Ask, settings, provider detail and supporting tools.

Setup and provider controls move out of the permanent top-level workflow and into Settings. Provider Health remains globally visible in compact form, with full detail under More.

## Approved visual direction

- Portrait, mobile-first football pitch.
- Simplified repository-owned CSS club shirts; no official FPL or club artwork.
- Clear captain and vice-captain badges directly on the pitch.
- Compact pitch cards showing shirt, surname, fixture and next-Gameweek expected points.
- Repository-owned inline SVG navigation icons.
- Mobile player detail as a bottom sheet and desktop detail as a side panel.
- Dark mode is deferred.

## Approved interaction rules

- The model recommendation remains authoritative and visibly distinct from user previews.
- Users may temporarily preview transfer plans.
- Users may temporarily preview captain and vice-captain choices.
- Preview state must not silently overwrite the model recommendation or persisted squad state.
- Expected minutes and uncertainty appear in player detail rather than overcrowding pitch cards.

## Approved uncertainty presentation

- P25–P75 is the main compact range.
- P10–P90 appears in expanded detail.
- Pritesh approved the presentation labels on 28 July 2026: **Tight** for widths ≤2.0 points, **Moderate** for widths >2.0 and ≤5.0 points, and **Wide** for widths >5.0 points.
- Labels describe modelled spread only; they are not accuracy or calibration claims.
- Descriptive labels are suppressed in pre-season and when Stage 8 reports reduced-quality inputs, while available numeric ranges may still be shown with an explicit warning.

## Security and implementation boundaries

- Existing DOM-builder and restricted-Markdown boundaries remain.
- Stage 9.6 removed inline style attributes and runtime style APIs, then tightened the CSP after source, build and deployable verification.
- No new dependency, framework, provider or hosted service.
- Generated `dist/` files remain build outputs and must never be edited manually.
- The single-file GitHub Pages deployment workflow and deterministic build identity remain mandatory.

## Six implementation checkpoints

### 9.1 — App shell and primary navigation

- Establish the four-section navigation: Team, Players, Transfers and More.
- Make Team the default screen.
- Preserve all existing functional surfaces while reorganising their entry points.
- Add focused navigation/accessibility regression coverage.

Explicit exclusions: no football-pitch redesign, club shirts, player detail sheet, uncertainty display, transfer/captain preview state, settings migration, Provider Health relocation, inline-style migration or CSP change.

### 9.2 — Team pitch and shirts

- Replace the current squad presentation with the approved portrait pitch.
- Add repository-owned CSS shirt representations and captain/vice treatment.
- Keep the existing model-selected XI and squad logic unchanged.

### 9.3 — Player detail and uncertainty

- Add mobile bottom-sheet and desktop side-panel player detail.
- Present expected minutes, confidence and approved uncertainty ranges.
- **Implemented, verified and merged through PR #20:** accessible dialog behaviour, preserved projection breakdown, exact approved labels and pre-season/reduced-quality safeguards; no model formula changed.

### 9.4 — Temporary decision previews

- Add temporary transfer-plan preview on the pitch.
- Add temporary captain and vice-captain previews.
- Keep previews clearly separated from model recommendations and persisted state.
- **Implemented, verified and merged through PR #23:** session-only state, optimiser-final-squad agreement, captain/vice role swapping, model comparison, explicit clearing and stale-preview invalidation; no formula or persistence change.

### 9.5 — More, Settings and Provider Health

- Move setup and provider controls into Settings.
- Add compact global Provider Health and full detail under More.
- Preserve all existing fallback and security behaviour.
- **Implemented, verified and merged through PR #24 at `a5ac5fcc12bb492948365851587d4e1cd2f30301`:** Settings hierarchy, compact global state, full current-session provider rows and accessible jump-to-detail interaction; no provider, fallback, storage or security behaviour changed.

### 9.6 — Style migration, CSP and final polish

- Remove inline style attributes.
- Remove the `style-src-attr 'unsafe-inline'` concession after independent verification.
- Complete responsive, accessibility, deterministic-build and deployable verification.
- **Implemented, verified and merged through PR #25 at `c52f6f08f51bff5bfe7702bfec58265647afe439`:** class-only/static-attribute presentation, progress/SVG dynamic visuals, DOM/build fail-closed guards, CSP concession removal and representative mobile/desktop browser review; verified source `4a4b14c1d0f422088c080e714ee259efbd7cc39d` passes 313/313 tests with deterministic builds.

## Stage-wide explicit exclusions

No change to projection formulas, expected-minutes logic, scoring constants, calibration, fixture ratings, best-XI selection, captain recommendation logic, squad simulation, transfer optimisation, provider weights, transports, cache semantics or prospective-validation claims. No official FPL or club assets. No dark mode. No serverless migration.