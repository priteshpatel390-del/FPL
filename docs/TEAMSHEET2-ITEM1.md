# TEAMSHEET2-ITEM1.md — Navigation and Settings Architecture

Status: **Approved by Pritesh on 31 July 2026 and implemented for review.**

Purpose: record the exact Teamsheet 2.0.1 behaviour, exclusions, route contract, relocation map and verification requirements.

## Outcome

Teamsheet now has five primary destinations:

1. Team
2. Transfers
3. Fixtures
4. Leagues
5. Settings

Players leaves primary navigation. More is removed. Ask Teamsheet remains a full destination but is reached through prominent Team and global actions rather than a cramped sixth bottom tab.

## Owner-approved amendments to the original blueprint

- Free transfers and bank are core weekly FPL information and remain visible on Team.
- Fixtures is a primary destination because fixture runs, blanks, doubles and swings are routinely used by an FPL manager.
- The shorter primary label is Leagues; the underlying product area remains focused on FPL mini leagues.
- Ask Teamsheet is regularly used and must be accessible from Team and the global header.
- The old standalone Stage 10.5 physical rehearsal is superseded by checkpoint-specific iPhone checks and a final Teamsheet 2.0 end-to-end rehearsal.

## Route contract

Teamsheet uses a hash router because it remains a single-file GitHub Pages application. Hash routes survive direct opening and refresh without requiring server rewrite rules.

Primary routes:

- `#/team`
- `#/transfers`
- `#/fixtures`
- `#/leagues`
- `#/settings`

Secondary routes:

- `#/ask`
- `#/settings/team-account`
- `#/settings/research/players`
- `#/settings/evidence`
- `#/settings/data`
- `#/settings/help`

Legacy aliases are retained for `#players`, `#fixtures`, `#league`, `#more`, `#settings` and `#ask`. Unknown routes fail safely to Team. Routes contain no Team ID, league ID, provider key, manager reference or evidence identity.

The router owns active-screen visibility, `aria-current`, document title, top-of-screen positioning, focus after navigation and browser Back/Forward behaviour. The previous click handler that directly hid `.view` elements is removed.

## Relocation map

### Team

- Team ID and load control
- free transfers
- bank
- manual-mode switch
- load/source/chip status
- existing squad pitch and recommendations
- prominent Ask Teamsheet action

This checkpoint does not redesign the Team decision home; that remains 2.0.2.

### Transfers

The existing transfer planner remains functionally unchanged.

### Fixtures

The existing fixture ticker, Gameweek range, lens, sort, blanks, doubles and swing notes become a dedicated primary destination. Fixture calculations are unchanged.

### Leagues

The existing saved-league and rival comparison surface becomes a primary destination. It is honestly labelled as the current comparison foundation; rank movement and new intelligence remain 2.0.4–2.0.5.

### Settings

Settings has five purpose-led sections:

1. Team & Account — manual squad editing and setup guidance.
2. Research Tools — Player Explorer.
3. Evidence & Performance — deadline evidence, outcomes, metrics, operating review and exports.
4. Data & Diagnostics — Provider Health, optional providers, calibration and recovery detail.
5. Help & About — advisory boundary, limitations, privacy and build identity.

Existing stateful controls are moved as DOM nodes rather than cloned. Their IDs, listeners, persistence and model/provider consumers are preserved.

### Ask Teamsheet

Ask Teamsheet remains `#/ask`. It is linked from Team and the header. Its provider and hosted-build limitation are unchanged.

## Explicit exclusions

- no Team home redesign;
- no Transfers redesign;
- no new fixture calculation;
- no global-rank or Gameweek-rank calculation;
- no new Mini-League intelligence, projections or strategy logic;
- no player-detail redesign or player URL deep links;
- no provider, data-source, security or persistence change;
- no projection, expected-minutes, scoring, captaincy, squad, simulation or optimiser change;
- no deletion or reset-all action;
- no framework, dependency, build or deployment change.

## Accessibility and mobile contract

- primary navigation is a labelled navigation landmark using real links and `aria-current`;
- all five labels remain visible at narrow iPhone widths;
- touch targets retain the existing minimum sizes and safe-area padding;
- Settings subroutes provide a clear back link;
- browser Back/Forward and deep links work;
- route headings receive focus after user navigation;
- inactive routes are hidden from interaction and assistive technology;
- player-detail dialog focus and Escape behaviour remain unchanged.

Physical-device evidence remains an owner acceptance step. Automated tests cannot prove exact iPhone rendering, browser chrome behaviour or thumb comfort.

## Verification

Completion requires the full existing suite plus route, hierarchy, relocation and shortcut tests; a production build; two byte-identical builds using the same exact source commit; root/deployable equality; CSP/build-identity verification; updated canonical documentation; a separate branch and draft PR.
