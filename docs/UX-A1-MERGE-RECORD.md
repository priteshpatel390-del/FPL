# UX-A1 merge record

Status: **Complete and merged.**

## Authoritative checkpoint status

UX-A1 — Team Resources and Bench Clarity merged through PR #74 on 6 August 2026.

- `main` merge commit: `15aa01a07a5645f5df9ec2f2f429aefa52965c94`
- approved branch head: `3435c1dda12055c72ecab1a28d463b35d4278c09`
- verified source commit: `016c6f2692435432390cefe6e31f27e39ee60dc6`
- generated production commit: `231bf8ef50321721d0b8cc7d452c44ce579212d4`
- automated result: **624 passed, 0 failed, 0 skipped**
- deterministic production builds: passed
- root/deployable equality: passed
- populated physical iPhone Safari acceptance: passed by Pritesh on 6 August 2026

The merge commit and approved branch head have the same repository tree; integration introduced no content drift.

## Delivered behaviour

- one labelled Team resources bar immediately above the pitch;
- exact Free transfers and Money in bank labels with prominent values;
- secondary Entered manually provenance;
- direct editing through the existing Team resource inputs;
- removal of duplicate compact resource chips;
- separate GK, 1st, 2nd and 3rd bench roles;
- two-line bench player names while preserving fixture and projected-points readability;
- unchanged bench array/order and Player Detail behaviour.

## Explicitly unchanged

No projection, expected-minutes, scoring, fixture, captaincy, squad, simulation, transfer/optimiser, rank, Mini-League, provider, persistence, authentication, Cloudflare, API-key, Player Detail or Leagues logic changed.

A2, A3, Track B and every model/provider change remain unapproved.

## VoiceOver decision

VoiceOver testing is not required for Teamsheet and is not an implementation, acceptance or merge gate. Standard accessibility safeguards—semantic controls, useful labels, focus behaviour, reduced motion, contrast, touch targets and keyboard behaviour—remain required where applicable.

## Supersession note

This record and `docs/VOICEOVER-DECISION.md` supersede any pre-merge status wording elsewhere that describes UX-A1 as in review, device acceptance as pending, VoiceOver as pending/accepted-unverified, or PR #74 as unmerged. Historical statements about what was or was not tested at earlier checkpoints remain historical facts rather than current outstanding work.