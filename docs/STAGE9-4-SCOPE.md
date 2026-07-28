# Stage 9.4 — Temporary decision previews

Status: approved by Pritesh and implemented/verified on draft PR #23 on 28 July 2026.

## Scope

- Session-only transfer-plan previews on the Team pitch.
- Session-only captain and vice-captain previews.
- Clear visual separation from model recommendations and persisted squad state.
- Automatic invalidation when the real squad or optimiser inputs/results change.

## Explicit exclusions

- No FPL submission.
- No persisted preview state.
- No projection, expected-minutes, best-XI, captaincy-ranking or optimiser formula changes.
- No custom transfer builder, chip preview, Settings, Provider Health, CSP or dark-mode work.

## Verification

- Verified source: `849ff757c68c35e92744dc96efc34848110fa19e`.
- Verified generated artefacts: `ed275d2a148d90d09836199f8d1485394d72b6f5`.
- Full suite: **304/304 passing**.
- Production build, deterministic two-build comparison and exact build identity passed.
- No golden regeneration.

## Review corrections

- Optimiser result values were added to the preview signature so changed recommendations cannot leave a stale preview active.
- Captain-only previews now clear when optimiser context changes, matching the approved invalidation rule.