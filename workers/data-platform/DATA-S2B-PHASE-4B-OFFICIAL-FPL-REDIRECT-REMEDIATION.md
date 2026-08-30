# DATA-S2B Phase 4B — Official FPL Redirect Runtime Remediation

## Outcome and live evidence

The first unconditional daily production opportunity on 30 August 2026 reached the existing `01:00 UTC` daily path. D1 contained exactly one `official_fpl_structured_history` run, started at `2026-08-30T01:00:49.305Z` and completed at `2026-08-30T01:00:49.541Z`, with status `failed`, all record counters zero, and no `shadow_observations` or `observation_heads`. Its sanitized error class began `Invalid_redirect_value__must_be_one_of__follow__or__manual`. This proves the existing Cron activation, genuine scheduled invocation, daily selection and failed-run recording, but not a successful baseline.

## Root cause

The production collector's shared `fetchJson` helper explicitly passed `redirect: "error"` to both fixed Official FPL requests. The scheduled Worker entrypoint calls this helper through `scheduledOfficialFplHistory` and `collectOfficialFplHistory`; the failure therefore occurred at the Workers `fetch` invocation, before HTTP, JSON, validation, comparison or D1 observation writes. It was neither inherited nor introduced by `Request` construction.

The tests supplied permissive fetch doubles that returned payloads without validating `RequestInit.redirect`. Node/browser Fetch accepts `error`, while the observed Workers runtime contract accepts only `follow` or `manual`; consequently repository tests did not emulate the production runtime contract and could not detect the invalid option.

## Narrow remediation

The collector now requests `redirect: "manual"`, the Workers-supported mode already established by this repository's Official FPL gateway, then rejects every 3xx response as `official_fpl_redirect_rejected`. It never follows a redirect, never reads a redirect body, and never accepts a redirected destination. Both fixed collection URLs share this helper, so the remediation covers `bootstrap-static` and `fixtures` without introducing a generic URL surface.

The new end-to-end normal-200 regression also exposed a second baseline-only defect: `sameScalar` dereferenced a missing previous head on the first collection. The null guard is required for the approved first-baseline path; it changes no comparison semantics when a previous row exists.

## Security rationale

The original `redirect: "error"` expresses a reject-all-redirect policy, not automatic following. `manual` plus an explicit 3xx failure is the closest Workers-compatible equivalent. It is safer than `follow` plus final-host checking because no request can be sent to a redirect target, including an unexpected host. Requests remain credential-free JSON GETs to the two compile-time `https://fantasy.premierleague.com` URLs.

## Regression coverage

The production-path fetch double now rejects redirect values exactly as the observed Workers runtime did. Tests prove both requests use `manual`; the only requested origin is the fixed Official FPL origin; a normal pair of 200 JSON responses reaches a populated baseline commit; and a 302 response yields one failed ingestion run, zero accepted observations, zero head changes and no final D1 batch. Existing cadence tests continue to prove the ordinary half-hour safe-skip and unchanged daily selection.

## Exclusions and remaining acceptance

This remediation changes no Cron (`*/30 * * * *`), daily UTC hour, deadline logic, schema, migration, data model, field allowlist, normalisation, write budgets, provider architecture, application behaviour, model/calculation behaviour, Cloudflare setting or production data. It performs no deployment, manual production invocation or D1 mutation.

After owner-approved merge and deployment, DATA-S2B still requires another genuine scheduled daily event. Acceptance requires a completed run with `records_seen > 0`, populated `shadow_observations` and `observation_heads`, internally consistent D1 writes, and no redirect/runtime failure. Later genuine scheduled cycles must still prove unchanged and changed-fact/delta retention behaviour. Until then DATA-S2B is not closed.
