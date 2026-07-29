# Stage 9.5 — More, Settings and Provider Health

Status: approved by Pritesh through the Stage 9 design; implemented and verified on draft PR #24 on 29 July 2026.

## Scope

- Present existing team/setup and optional provider controls as Settings under More.
- Keep a compact Provider Health control visible from every primary destination.
- Open full current-session provider state, age, note and consequence detail under More.
- Preserve the existing seven Provider Health states and all fallback/security behaviour.

## Explicit exclusions

- No provider-state, threshold, transport, retry, validation, cache or fallback changes.
- No odds-key or persisted-configuration behaviour changes.
- No projection, expected-minutes, scoring, best-XI, captaincy, simulation or optimiser changes.
- No inline-style migration, CSP tightening, final visual polish or dark mode.

## Verification

- Verified source: `da8258df25e196af1f1521c025edefde23612abd`.
- Verified generated artefacts: `5401f2882f72b70c7034157c2e3a686dab966c64`.
- Full suite: **310/310 passing**.
- Production build, deterministic two-build comparison and exact build identity passed.
- No golden regeneration.

## Judgement calls

- The compact control shows the most consequential currently active state rather than inventing a numeric health score.
- Full provider rows remain authoritative and show the existing note and consequence text.
- Existing controls are relabelled/reorganised rather than rewritten, minimising regression and security risk.
