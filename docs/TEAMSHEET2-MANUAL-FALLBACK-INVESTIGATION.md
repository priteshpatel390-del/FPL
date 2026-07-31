# Teamsheet 2.0 — Manual squad fallback investigation

Status: **Investigation and design only. No provider, catalogue or transport implementation is approved by this document.**

## Outcome

The current manual squad editor is not a first-run offline fallback. It stores a compact list of Official FPL player IDs and bought prices, but it relies on the verified `/bootstrap-static/` player catalogue to resolve each ID into a current player name, club, position, price and status. Player search also reads that same catalogue. When core Official FPL season data is unavailable and no verified cache exists, the editor cannot safely create or render a squad.

Teamsheet 2.0.2 now states this limitation plainly and disables the unavailable controls. A fictional sample-squad route exists only for physical layout review. It is not production data, is storage-isolated, cannot become evidence and must never be offered as an FPL recommendation.

## Existing behaviour and evidence

- Core bootstrap and fixtures are the only critical provider payloads.
- A previously verified cache can keep the application usable, with age and fallback labelling.
- On a first load with no acceptable cache, player identities, teams, positions, prices and fixtures are unavailable.
- Manual records alone are insufficient because they intentionally do not duplicate the changing season catalogue.
- The player search fails closed when `S.boot` is unavailable; this prevents fabricated or stale player identities.

## Options

### A. Same-origin Official FPL transport

Add a small serverless read-only proxy for the existing Official FPL endpoints. This is the recommended primary remedy because it repairs the authoritative source rather than creating a parallel player truth.

Approval evidence required:

- exact endpoints and allowlisted fields;
- no FPL write or authentication capability;
- origin controls, rate limits, timeouts and cache policy;
- schema validation identical to the browser path;
- outage and stale-cache behaviour;
- privacy treatment for Team IDs;
- deployment, monitoring and rollback plan;
- transport and security regression tests.

Trade-off: this introduces hosted infrastructure and operational responsibility, which the current static architecture deliberately avoids.

### B. Bundled Official FPL player catalogue

Ship a pinned build-time catalogue derived from a validated Official FPL bootstrap snapshot. This could permit first-run manual player selection when live transport is down.

Approval evidence required:

- provenance, season identity, generation command and source hash;
- allowlisted fields only: player ID, display name, club, position, price and official availability where justified;
- expiry/staleness labelling and deterministic update process;
- validation against the live schema and duplicate/identity checks;
- clear separation between catalogue browsing and recommendation readiness;
- no fixtures or projections manufactured from a stale catalogue;
- licensing, repository-size and release-maintenance assessment;
- tests proving stale catalogue data cannot be labelled live or official-current.

Trade-off: it can enable editing, but it cannot by itself support trustworthy forecasts because fixtures, deadlines, prices and availability can change.

### C. Existing verified cache only

Preserve the current cached bootstrap and fixtures after a successful prior session. This already provides the safest zero-infrastructure fallback and should remain the first fallback tier.

Limitation: it cannot help a new device or a cleared browser before its first successful verified load.

## Rejected shortcuts

- Do not invent players or use the sample review fixture in production.
- Do not scrape an unapproved third-party player list.
- Do not treat saved manual IDs as enough to calculate a squad when the current catalogue and fixtures are absent.
- Do not silently label stale catalogue values as current Official FPL data.
- Do not add another provider without approved purpose, fields, reliability, validation, fallback, security and tests.

## Recommendation

Investigate option A first: a same-origin, read-only Official FPL transport for the existing endpoints and validators. Option B may be considered as a separately approved editing-only fallback after the serverless design, but it must not unlock forecasts without verified fixtures and deadline context. Option C remains the immediate runtime fallback.

## Next approval gate

Before implementation, present the selected option with exact inputs, source and field allowlist, reliability target, cache/expiry policy, failure states, security boundary, privacy treatment, validation plan, tests, deployment impact and rollback. Model, fixture, captaincy, squad-selection and transfer calculations remain out of scope.
