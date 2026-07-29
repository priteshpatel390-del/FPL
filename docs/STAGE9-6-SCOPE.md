# Stage 9.6 — Style migration, CSP and final polish

Status: implemented, verified and merged through PR #25 at `c52f6f08f51bff5bfe7702bfec58265647afe439` on 29 July 2026; Stage 9 is complete.

## Scope

- Remove static inline style attributes and runtime style assignments.
- Replace dynamic shirt, projection-bar and uncertainty-range presentation with deterministic classes, native progress elements and safe SVG geometry attributes.
- Remove `style-src-attr` and every `unsafe-inline` token from the generated CSP after independent source/build/deployable verification.
- Complete responsive, touch-target, accessibility and representative mobile/desktop browser review.
- Preserve deterministic single-file GitHub Pages deployment.

## Explicit exclusions

- No projection, expected-minutes, scoring, simulation, best-XI, captaincy or transfer-optimiser changes.
- No provider, transport, retry, validation, cache, fallback, storage or odds-key changes.
- No framework, dependency, provider, hosted service, official club/FPL artwork or dark mode.
- No claim that representative browser review is a persistent screenshot-regression suite.

## Verification

- Verified source: `4a4b14c1d0f422088c080e714ee259efbd7cc39d`.
- Verified generated artefacts: `7fb09142156a8061adc375a72bf3d7e2a1b25985`.
- Full suite: **313/313 passing**.
- Production build, deterministic two-build comparison and exact build identity passed.
- Source and generated deployables contain no application style attributes or runtime style APIs.
- Emitted CSP contains no `style-src-attr` and no `unsafe-inline`.
- Representative mobile/desktop browser review passed with no console errors.
- No golden regeneration.

## Judgement calls

- Repository-owned shirt colours remain deterministic through static palette classes rather than per-element CSS variables.
- Projection component bars use semantic progress elements, preserving values without dynamic widths.
- The P10–P90 uncertainty range uses SVG line geometry attributes, which are safe element attributes rather than CSS style attributes.
- A persistent screenshot-regression dependency was not introduced into the zero-dependency toolchain; manual browser review remains required for future visual changes.
