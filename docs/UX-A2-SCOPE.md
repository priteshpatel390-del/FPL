# UX-A2 — Player Detail Scroll and Rotation Correction

Status: **Implemented for review. Not merged. Populated physical iPhone Safari acceptance pending.**

Purpose: exact scope, behaviour and evidence for the approved UX-A2 correction.
Audience: reviewers and later sessions. Last updated: 2026-08-06.
Related: ROADMAP.md, TESTING.md, KNOWN_LIMITATIONS.md, UX-A1-MERGE-RECORD.md.

Branch `agent/ux-a2-player-detail-scroll-rotation`, draft PR #76, based on verified
`main` `2738a0500b9be20a723f0940df0a93766b29c05d`.

## Problem

Player Detail is a dialog rendered over the current route. Before this change it
locked the background with `body{overflow:hidden}` only, kept no record of where
the page had been scrolled to, never reset its own scroll position between
players, and sized itself with `dvh` alone.

On mobile Safari that produced four separate faults:

1. body-only overflow locking does not reliably stop the background page moving;
2. applying the lock can clamp or discard the page offset, so closing the dialog
   left the underlying route at a different position from the one the user left;
3. the scrolling region had `overflow-y:auto` but no `flex:1 1 auto` and no
   `min-height:0`, so in a short viewport the flex item could refuse to shrink and
   the final sections and the close control became unreachable;
4. `max-height:min(88dvh,780px)` had no conventional viewport fallback, and there
   was no compact-landscape rule, so a rotated phone had very little usable height.

## Delivered behaviour

### Opening

- A **fresh** open records the exact background offset (`scrollX`/`scrollY`, falling
  back through `pageXOffset`/`pageYOffset` and the root element's scroll properties)
  and records the triggering element.
- Every open resets the detail content to `scrollTop = 0`.
- The `player-detail-open` class is applied to **both** the root element and the body.
- Focus moves to the existing close control with `preventScroll:true`.
- Opening a **different player while already open** replaces the content and resets
  the internal scroll, but deliberately does not re-record the background offset or
  the trigger: at that moment the page is locked, so a fresh reading would be wrong.

### Normal close — close button, backdrop, Escape

1. Panel and backdrop are hidden and `aria-hidden` is restored.
2. Both scroll-lock classes are removed.
3. The exact saved coordinates are reapplied through `scrollTo` with `behavior:'auto'`.
4. The original trigger is refocused with `preventScroll:true`, and only when it is
   still attached, visible and focusable.

### Route-driven close

`teamsheet:before-route-change` closes the dialog with **both** restorations
suppressed. The router already owns the destination route's scroll and focus, so
replaying the previous route's coordinates or trigger over the destination would be
stale. The scroll lock is still removed.

This is the one behavioural distinction reviewers should check deliberately:
**normal close restores the background position; route close does not.**

### Browser Back

Unchanged and deliberately so. Player Detail creates no URL, no history entry and no
deep link; browser Back moves the underlying route history and the router's
`before-route-change` event closes the dialog. There is no double-Back step and no
fake modal history state.

### Responsive rules

- Compact portrait keeps the bottom sheet; `min-width:760px` keeps the right-side panel.
- Panel height declares `max-height:min(88vh,780px)` **before** `max-height:min(88dvh,780px)`,
  so browsers without `dvh` get a working conventional fallback and Safari's dynamic
  toolbar is handled by `dvh` where supported.
- New `@media(max-width:759px) and (orientation:landscape) and (max-height:520px)`:
  the panel takes the full viewport height, the grip is hidden and header/section
  padding tightens, so the close control and the final sections stay reachable.
- Safe areas are honoured on all four sides: `top` on the panel and desktop header,
  `left`/`right` on the header and body, `bottom` on the body.
- Rotation is handled entirely by CSS media queries. No `orientationchange` or
  `visualViewport` JavaScript was introduced.
- No runtime inline style is used; all presentation stays in the hash-locked stylesheet.

## Explicitly unchanged

Player Detail's information architecture is untouched — player identity, decision
summary, expected minutes, uncertainty and projection breakdown all render exactly as
before. No projection, expected-minutes, scoring, fixture, captaincy, squad,
simulation, transfer, rank, Mini-League, provider, persistence, authentication,
Cloudflare, analytics or service-worker behaviour changed. No routing architecture was
redesigned. UX-A3 and Track B remain unapproved.

## Files changed

| File | Change |
|---|---|
| `src/ui/player-detail.mjs` | scroll capture/restore, root+body locking, internal scroll reset, route-safe close, `preventScroll` focus |
| `app.html` | root+body lock rule, flex-scroll constraints, `vh` fallback before `dvh`, compact-landscape query, four-sided safe areas |
| `tests/player-detail-scroll-rotation.test.mjs` | new — 19 focused behaviour and CSS-contract tests |
| `docs/` | this record plus ROADMAP, TESTING, KNOWN_LIMITATIONS and PROJECT_CONTEXT status |

## Evidence

- `./run-tests.sh`: **643 passed, 0 failed, 0 skipped** (624 baseline plus 19 new).
- No existing test was deleted, weakened or skipped, and no golden expectation changed.
- Two production builds from the exact reviewed source commit are byte-identical for
  `dist/index.html`, `dist/app.bundle.js` and `dist/manifest.json`.
- Root `index.html` equals `dist/index.html`.
- Build-time CSP hash emission and independent verification pass.

## Not verified

Automated tests prove the controller's state transitions and the presence and ordering
of the CSS contracts. They cannot prove real layout on a physical device. Momentum
scrolling, Safari toolbar expansion and collapse, live rotation, notch insets and
actual reachability of the close control require Pritesh's populated physical iPhone
Safari review — see the UX-A2 device script in `TESTING.md`. VoiceOver is not a
Teamsheet acceptance gate (`VOICEOVER-DECISION.md`).
