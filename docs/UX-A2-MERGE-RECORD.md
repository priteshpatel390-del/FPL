# UX-A2 merge record

Status: **Complete and merged.**

This is the authoritative UX-A2 checkpoint record. It supersedes any earlier wording —
in this repository or in conversation — that described UX-A2 as in review, draft,
awaiting merge or awaiting physical acceptance.

## Authoritative checkpoint status

UX-A2 — Player Detail Scroll and Rotation Correction merged through PR #76 on
6 August 2026.

- `main` merge commit: `bffcba8e9231adfc216125913f8ab83c042c3e10`
- approved branch head: `ad1dd4611c042591a3f03dea77a1a9b59101d9ba`
- verified source commit: `8aa0c6654c4d7dc63da4071edaf3f08e527d28bc`
- generated production commit: `ad1dd4611c042591a3f03dea77a1a9b59101d9ba`
- base `main` before merge: `2738a0500b9be20a723f0940df0a93766b29c05d`
- automated result: **644 passed, 0 failed, 0 skipped, 0 cancelled**
- deterministic production builds: passed
- root/deployable equality: passed
- build identity in `dist/manifest.json`: exactly the verified source commit
- populated physical iPhone Safari acceptance: passed by Pritesh on 6 August 2026

The merge commit and the approved branch head have the identical repository tree
`7ea28a78befb2449665c22db82dd9adcbc5eb447`; integration introduced no content drift.
The merge commit's parents are the previous `main` and the approved branch head, which
is the expected merge-parent metadata and the only difference from the head commit.

### SHA-256 of the merged generated outputs

```
8f8b9a028eb96868541d7260b38fcd96167bc27716d9ade242c2d54c70d5b869  dist/app.bundle.js
513b47e67ce6f38845023196628734d7f7c44180747697b6d7d092b2abb9d6dd  dist/index.html
3aa145c59336aa88158ed34f90da3efc7380611e6508dea1ec10fedf3bbb6230  dist/manifest.json
513b47e67ce6f38845023196628734d7f7c44180747697b6d7d092b2abb9d6dd  index.html
```

## Delivered behaviour

- Player Detail scrolls internally, and its content starts at the top on every open;
- the background page is locked on both the root element and the body while the dialog
  is open, with contained overscroll;
- a normal close — close button, backdrop or Escape — restores the exact underlying
  page position that the user left;
- a route-driven close unlocks the page but deliberately restores neither scroll nor
  focus, because the router already owns the destination route's scroll and focus;
- the panel declares a conventional `vh` viewport fallback before `dvh`;
- a compact-landscape rule keeps the close control and the final sections reachable on
  a rotated phone;
- safe areas are honoured on all four sides;
- focus moves with `preventScroll` on open and on close;
- the root document fixes `-webkit-text-size-adjust` and `text-size-adjust` at `100%`,
  so Safari's automatic orientation-driven text inflation cannot enlarge the text.

## Physical acceptance — passed 6 August 2026

Pritesh completed the populated physical iPhone Safari review. Background locking,
Player Detail internal scrolling, reachability of the final content and the close
control, exact background-position restoration on a normal close, reopening at the top,
backdrop close and both orientations all passed.

The first return to portrait exposed Safari automatically enlarging the text. The root
text-size correction was applied to the production stylesheet, and Pritesh physically
retested the corrected rotation behaviour and confirmed it worked perfectly, with
scrolling and closing still intact.

`UI-13` is closed. VoiceOver testing is not required and is not a Teamsheet acceptance
gate (`VOICEOVER-DECISION.md`).

## Explicitly unchanged

Player Detail's information architecture — player identity, decision summary, expected
minutes, uncertainty and projection breakdown — is untouched. No projection,
expected-minutes, scoring, fixture, captaincy, squad, bench, simulation, transfer, rank,
Mini-League, provider, data-source, persistence, authentication, Cloudflare, API-key,
security-architecture, analytics or service-worker behaviour changed. No routing
architecture change and no framework, package or dependency added.

## Remaining limitation

The compact-landscape breakpoint (`max-height:520px`) is a judgement call rather than a
measured device threshold. It behaved correctly on the owner's handset; a different
device could need that single value adjusted.

## Separate future proposal — not approved

During acceptance the owner asked whether Player Detail shows too much information and
requires too much scrolling. That is an information-density and hierarchy question, not
a scroll or rotation defect. It was deliberately excluded from UX-A2 and requires its
own investigation, exact scope and explicit approval before any work begins.

UX-A3 and Track B remain unapproved and must not start.
