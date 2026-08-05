# Teamsheet 2.0.7 — Final Mobile Polish and Acceptance

Status: **implemented on the approved branch for automated review; physical iPhone Safari, VoiceOver and live populated-data acceptance remain pending.**
Approval: exact Scope S-2.0.7 approved by Pritesh on 4 August 2026.
Base commit: `0f9e6c879859a2584ab8d7b9d4879a84efbfaf5d`.
Model version: `2.4.0`.
Rules version: `2026-27.3`.
Automated baseline: **530 passed, 0 failed, 0 skipped**.
Reviewed source commit: `3baeb8fd51ea68af353c5097b0e5d2d49837dcf6`.
Generated-build commit: `db48549fe6c527e235615eb7fd057f8a51de4d7a`.

## Implemented scope

- native keyboard-operable Player Detail actions in Player Explorer and Team's All-15 table;
- native manual-squad search and removal controls;
- 44-pixel minimum target contract for active mobile controls;
- coherent no-core-data restricted states across Team, Transfers, Fixtures and Leagues;
- deterministic route heading focus, parent/browser return focus and per-route scroll restoration;
- Player Detail closure before route changes with safe focus fallback;
- honest hosted Ask unavailability, retained failed prompts, Retry, log/live-region semantics and latest-message scrolling;
- isolated Fixture render dependencies;
- table captions and heading scopes;
- exact Transfers no-hit, optimiser-limit and alternative-count wording;
- bounded responsive and safe-area corrections only.

## Preserved boundaries

No provider, endpoint, data source, model, fixture calculation, expected-minutes, scoring, squad, captaincy, simulation, optimiser, rank or Mini-League calculation changed. No framework, package dependency, service worker, backend, authentication or FPL account-write behaviour was introduced. Anthropic keys remain banned client-side.

## Automated verification

- `./run-tests.sh`: **530 passed, 0 failed, 0 skipped**;
- successful exact-source production build;
- two exact-identity builds were byte-identical;
- root `index.html` equals `dist/index.html`;
- manifest model/rules/commit/source identity verified;
- security, CSP, generated-file and no-account-write guards remain green.

## Acceptance still required

Automated and browser-contract evidence cannot prove physical iPhone Safari rendering, one-handed comfort, actual VoiceOver reading order or live public Official FPL transport. These remain explicit owner acceptance gates. The implementation must not be called complete or merged until Pritesh reviews the draft PR and records the required physical/live acceptance or explicitly accepts a remaining external blocker.

## Explicit exclusions retained

No Team or Transfers redesign; no Player Detail data redesign; no new feature programme; no provider remedy; no projected rank, rival prediction, remaining-player simulation, differential strategy or protect/balanced/chase logic; no automatic Google Sheets integration; no calculation changes.
