# Teamsheet 2.0.4 — Mini Leagues

Status: **Complete and merged through PR #59 at `a2841b0831193f645548cfc4155809b82a520d92`. Verified baseline: 493/493 tests, deterministic exact-identity builds and root/deployable equality.**

## Outcome

Leagues is now an official competitive-context destination rather than a sampled ownership report. It answers where the connected manager stands in a selected public classic league, the official points gaps immediately above and below, which nearby or pinned rivals deserve factual comparison, and how one selected public rival's squad/captain differs.

The first screen does not present a dense full table. It leads with a compact league identity and status card, current position/points, supplied movement, deliberately separated nearest-gap cards, up to three nearby rival rows and direct links to standings and league management.

## Implemented scope

- Discover validated public classic leagues from the connected Official FPL entry.
- Retain manual league-ID entry and optional local labels.
- Select and persist a primary/current league.
- Migrate legacy `fpl:config.leagueId` and `fpl:leagues` data into `fpl:mini-leagues` version 1.
- Persist selected/pinned rival identifiers and labels, capped at five per league.
- Keep fetched standings, scores and rival squads session-only.
- Add semantic ID-free routes:
  - `#/leagues`
  - `#/leagues/standings`
  - `#/leagues/rival`
  - `#/leagues/manage`
- Show official current rank, total points and supplied current/previous-rank movement.
- Calculate simple points gaps from official totals.
- Load page 1 plus pages around the manager's official membership rank; load more sequential pages only on request.
- Suggest up to three visible rivals from pinned, nearest-above, nearest-below and leader context.
- Fetch public picks for one selected rival at a time.
- Show captain, vice-captain, active chip where published, exact overlap, only-user and only-rival player sets.
- Label pre-season, live/provisional, checked-complete, unavailable, incomplete and stale states honestly.
- Preserve central Team and Transfers links without passing hidden strategy inputs.
- Remove the legacy top-10/20/30 rival fan-out, threshold threat/differential tables and unsupported “covered” / “win or lose” wording.

## Official data and derivation boundary

Existing Official FPL endpoints only:
- entry: public classic league membership and official manager summary fields;
- classic standings: league identity, rank, previous rank, total and pagination;
- current-Gameweek picks: public player IDs, multipliers, captain/vice and active chip.

Allowed derivations are limited to subtraction of official point totals and set intersection/difference of official player IDs. These are factual transformations, not prediction or strategy models.

## Privacy and security

League and manager identifiers are absent from routes and Stage 10 evidence. Persistent state contains minimal IDs/labels only. Fetched standings and public squads are session-only. Existing Official FPL read-only transport, retry, endpoint redaction, DOM-builder and CSP boundaries remain unchanged. No authentication, cookie, OAuth flow, private FPL login, new origin, provider or key is introduced.

## Accessibility and mobile contract

- no horizontally scrolling technical table on the landing or rival screen;
- owner-approved compact hierarchy keeps rank, points and movement together while giving the supporting Above / You / Below cards deliberate breathing room;
- standings managers are full-row touch and keyboard targets with a quiet trailing `Open ›` affordance instead of repeated Compare buttons;
- stacked responsive cards and standings rows at iPhone widths;
- 44px primary controls, wrapping league/manager names and 200% text support target;
- programmatic route-heading focus and browser Back/Forward through the central router;
- a League-wide polite live region for loading, success, partial and error messages;
- explicit “Your team”, movement and gap wording independent of colour;
- named Back, Compare, Pin, Remove and picker controls;
- reduced-motion rules for the new surface.

## Tests

Verified source baseline: **493 tests, 493 passed, 0 failed, 0 cancelled, 0 skipped**.

New coverage is in:
- `tests/mini-leagues.test.mjs`
- `tests/mini-leagues-ui.test.mjs`
- expanded `tests/navigation-settings.test.mjs`
- expanded `tests/schema.test.mjs`

The full existing model, provider, evidence, security, build, Team and Transfers suites remain enabled. No golden was regenerated and no test was deleted or weakened.

## Merge and verification record

- PR: #59.
- Merge commit: `a2841b0831193f645548cfc4155809b82a520d92`.
- Verified refined source commit: `70d70055775fb92a47d42f0dd513980fd879a404`.
- Final implementation branch head: `75d46689a508b90066ed03859cd5adf83f467241`.
- Full suite: 493/493 passed.
- Two production builds were byte-identical.
- Root `index.html` matched `dist/index.html`.
- Model version remained `2.4.0`.
- Rules version remained `2026-27.3`.
- Source hash: `4455339527e59f25a722ab93ecfe6266f9349fa7963f22cc4af4aff7fa7a1f21`.
- Root/dist HTML SHA-256: `12d5202a56269218fb9ac68500dd7965272a496bdca81c888a1422285fa31c65`.
- Bundle SHA-256: `c3850974233089828774d9afc8776045203e3c2a2c6ab54ac866fd6d0ad2428c`.
- Manifest SHA-256: `a4bd1a851788761332d8d194d5519e732cf8b5fc58702c321fecf0911ee2dbde`.

## Explicit exclusions

- no global-rank calculation or redesign;
- no projected live/final rank or projected league position;
- no projected rival score or remaining-player simulation;
- no effective-ownership model or league-wide rival scan;
- no meaningful-differential ranking;
- no captaincy gain/loss model;
- no protect, balanced or chase strategy;
- no change to Team or Transfers recommendations;
- no projection, minutes, fixture, scoring, captaincy, squad, transfer or simulation calculation;
- no new provider, endpoint family, origin, authentication or private login;
- no Team Home, Transfers or player-detail redesign;
- no Stage 2.0.5 intelligence pulled forward.

## Remaining limitations and acceptance evidence

- Public FPL transport limitation FPL-1 can block populated-data acceptance.
- Official FPL schemas are undocumented and can reduce coverage under strict validation.
- Large leagues are deliberately partial until the user requests more pages.
- Rival public picks may be absent or incomplete.
- Physical testing of the actual repository build on an iPhone was not separately performed.
- VoiceOver acceptance was not performed.
- Live populated-data acceptance was not performed.
- The approved sample preview established design direction but was not equivalent to full repository-device acceptance.

These limitations do not reopen the successful merge record. They remain evidence and acceptance gaps for later checkpoint-specific review and the final Teamsheet 2.0.7 mobile acceptance stage.

## Next checkpoint

Teamsheet 2.0.5 — Mini-League Intelligence is the next separate investigation, design and approval gate. Projected rank, projected rival scores, remaining-player simulation, effective-ownership strategy and protect/balanced/chase recommendations remain unapproved.
