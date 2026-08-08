# Leagues pre-season acceptance record

Status: accepted pre-season checkpoint, 8 August 2026.

## Outcome

The Leagues pre-season product path has been physically reviewed by Pritesh on deployed iPhone Safari through the merged PR #92 application state (`main` `6f0501ffc0aff368f9a60aae6de0d552ec2c44a5`). The hub-first information architecture and pre-season empty states are accepted for the currently available Official FPL data.

The remaining live standings/rival acceptance is deliberately deferred until Official FPL publishes league positions after completed Gameweek data exists. This record does not treat unavailable standings as tested populated behaviour.

## Accepted deployed behaviour

- `Leagues` opens an all-league hub rather than dropping directly into one selected league.
- Connected classic leagues are visible together and grouped into invitational and general leagues when Official FPL supplies that distinction.
- Pre-season unpublished positions are presented as **Not ranked yet**, not as a real rank.
- The hub intro is compact enough for useful league rows to appear promptly on iPhone.
- Opening a specific league leads to the selected league overview and exposes deeper standings/rival actions.
- The selected-league overview uses an explicit pre-season state rather than inventing position, gap or rival information.
- The standings surface states that standings are not available yet when Official FPL has not published positions.
- Rival exposure explains that candidates depend on loaded standings and does not fabricate rivals.
- `Manage leagues` distinguishes connected Official FPL memberships from manual/local records. Official memberships remain selectable and can be made primary, but do not offer a misleading Remove action.
- Selected and primary league state remains visible.

## Automated evidence inherited from the final Leagues application change

PR #92 head `130b0a298d4b21c2758e3199b9a82e2e3b0fc58f` completed the repository `Verify Teamsheet` workflow successfully. The workflow ran the complete test suite, captured an exact-identity production build, rebuilt and verified deterministic bytes, verified build identity, and preserved the verified production outputs before merge.

This documentation-only reconciliation does not change application code, generated deployables, tests, providers or calculations, so it does not claim a new application test baseline beyond that exact-head verification.

## Deferred live acceptance

After Official FPL publishes league positions, perform populated iPhone Safari acceptance for:

1. Hub rank and movement presentation using real published standings.
2. League overview position and points-gap facts.
3. Standings population and navigation for a real league.
4. Nearby/loaded rival selection from published standings.
5. Pairwise comparison and selected-rival exposure using only public squads explicitly loaded by the user.
6. Large-league targeted pagination behaviour where relevant.

Any defect found during that live acceptance is a separate correction checkpoint. Do not use synthetic success to close these live-data checks.

## Explicit exclusions

No Mini-League calculation, projected rank, effective ownership, rival prediction, protect/chase strategy, transfer, squad, captaincy, fixture, projection, provider, endpoint, gateway, persistence schema or security behaviour changes are authorised or implied by this record.

## Next project step

With the pre-season Leagues UX accepted as far as current Official FPL data permits, the next substantive work is an investigation-only post-Teamsheet-2.0 roadmap audit. It should reconcile completed work, open limitations and pre-GW1 value before proposing another implementation checkpoint. Implementation remains owner-gated.
