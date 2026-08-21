# Teamsheet Cloudflare Workers

<!-- GW1-P2C2-CURRENT-2026-08-21 -->
## GW1-P2C2 repository target — 21 August 2026

The next repository candidate uses `https://archive.fpltsheet.co.uk/v1/evidence/predeadline` for browser evidence delivery and `https://app.fpltsheet.co.uk` as the intended application origin. These are planned sibling custom domains only; this repository change does **not** prove DNS, Worker Custom Domain, Cloudflare Access or GitHub Pages configuration has been changed. The existing `workers.dev` deployment remains the historical/live record until a separately approved rollout.

The Official FPL gateway repository config temporarily retains the current GitHub Pages origin and adds the new app origin as an exact migration/rollback allowlist. The evidence archive still requires exact-origin credentialled CORS and PR #137 remains the adapter-level authority for `Access-Control-Allow-Credentials: true`. Do not add wildcard origins, expose Access secrets, or treat repository configuration as evidence of deployed Cloudflare state.


This directory contains two deliberately separate Cloudflare service boundaries.

## Official FPL gateway

`fpl-gateway.mjs` with `wrangler.jsonc` is the approved FPL-T1 Worker. It is a narrow, read-only transport to the existing Official FPL API, not a new football-data provider and not a generic CORS proxy.

It is deployed through Pritesh's owner-controlled Cloudflare account at `https://teamsheet-fpl-gateway.fpltsheet.workers.dev`. The application uses `https://teamsheet-fpl-gateway.fpltsheet.workers.dev/fpl`. Do not commit an API token, account token or secret.

Only `GET`, `HEAD` and CORS `OPTIONS` are accepted. Only the endpoint families listed in `docs/FPL-GATEWAY-DESIGN.md` are routed. Browser cookies, authorization headers and arbitrary destination URLs are never forwarded.

## GW1-P1 evidence archive

`evidence-archive.mjs` with `evidence-archive-core.mjs`, `evidence-wrangler.jsonc` and `evidence-migrations/` is the separate authenticated persistence service for the GW1 prospective-evidence critical path.

It does **not** proxy Official FPL and does not change application calculations. It accepts only validated Stage 10 `preDeadlineSnapshot` `local_capture` records in archive v1, writes exact canonical evidence to private R2 first, then commits the D1 manifest/receipt, and exposes a bounded orphan-reconciliation path.

The small `evidence-archive.mjs` entrypoint is the Cloudflare runtime adapter. The archive contract remains in `evidence-archive-core.mjs`; the adapter supplies the Cloudflare Access fetch compatibility required by the production runtime.

Cloudflare Access is mandatory for non-preflight routes. `TEAM_DOMAIN` and `POLICY_AUD` are owner-controlled runtime configuration and must not be guessed or hard-coded. Understat/Odds permanent-retention flags default to false until separately approved.

The evidence Wrangler configuration keeps the accepted Access-protected production `workers.dev` route enabled but explicitly sets `preview_urls` to `false`, so versioned and aliased Preview URL routing is not an alternate service surface. The source config and isolated deployment config must remain byte-identical. After any deployment that changes this setting, verify the live Worker under **Settings -> Domains & Routes** before treating preview-route security as accepted.

GW1-P1 is complete and merged through PR #118 at `main` `58b834a1824c4977a442e7b3e309e2bbf3d05da1`. The backend foundation received live production functional acceptance on 11 August 2026. The Teamsheet browser was deliberately not connected **by GW1-P1 itself**.

GW1-P2 is the separate browser-delivery/outbox candidate in draft PR #119. Its durable-outbox and canonical-byte delivery principles remain the approved browser-delivery semantics, but the original cross-site `github.io -> workers.dev` transport is no longer the target architecture after the 21 August physical diagnostic described below. PR #119 remains stale and must not be merged wholesale.

### GW1-P2D credentialled-CORS remediation

A physical iPhone Safari diagnostic on 20 August 2026 isolated the failed signed-in transport to the preflight boundary: the approved-origin `OPTIONS /v1/evidence/predeadline` reached this Worker and returned `204`, but no corresponding `POST` reached the Worker for the same diagnostic reference. The merged GW1-P1 runtime adapter did not explicitly permit credentials on approved-origin CORS responses.

The P2D-P3 remediation keeps the existing exact origin allowlist and adds `Access-Control-Allow-Credentials: true` only when the core response has already granted that exact approved origin. This is a browser CORS permission, not authentication: Cloudflare Access remains mandatory on non-OPTIONS routes, wildcard origins remain forbidden, and missing or foreign origins receive no credential grant. No Access policy, cookie, route, D1/R2 binding, evidence schema or Stage 10 record changes are part of this repair.

On 21 August 2026 the exact remediated Worker version `301ba53b-0fd1-4174-a4d6-d6f162b3f03c` was deployed for the controlled physical iPhone Safari diagnostic with Prevent Cross-Site Tracking ON. Diagnostic `7e5212a2` produced exactly one matching Worker event: approved-origin `OPTIONS /v1/evidence/predeadline?probe=7e5212a2` requesting `POST` and `content-type`, with `Sec-Fetch-Site: cross-site`; the Worker returned `204`. No corresponding `POST` reached the Worker and Teamsheet received no HTTP response/status. This confirms the credentialled-CORS defect and its preflight correction, but it does **not** prove Safari third-party-cookie behaviour is the sole remaining cause. It also provides no evidence against D1, R2, archive validation, Stage 10 canonicalisation or POST processing because the POST never reached the Worker.

Option A is therefore exhausted for the physical iPhone Safari acceptance target. Further speculative CORS/SameSite changes on the cross-site `github.io -> workers.dev` topology are not approved. The next approved repository checkpoint is GW1-P2C2, preparing the sibling-subdomain same-site/cross-origin design `https://app.fpltsheet.co.uk -> https://archive.fpltsheet.co.uk`; that later design still requires exact-origin credentialled CORS and Cloudflare Access. Repository preparation is not proof that the new live topology works in Safari; live DNS/hosting/Access deployment and a later physical acceptance test remain separate approval gates.

See `docs/GW1-P1-CLOUDFLARE-EVIDENCE-FOUNDATION.md` and `docs/GW1-P2-BROWSER-EVIDENCE-DELIVERY.md`.

## Allowed origins

Both Workers currently default to the production GitHub Pages origin `https://priteshpatel390-del.github.io`. Additional review or migration origins, where a checkpoint explicitly allows them, must be supplied as exact origins rather than wildcards.

## Verification

Both Workers are zero-dependency ES modules. Relevant contracts are exercised by Node's built-in test runner, including:

- `tests/fpl-gateway-worker.test.mjs`
- `tests/evidence-archive-worker.test.mjs`
- `tests/evidence-archive-cloudflare.test.mjs`
- `tests/evidence-archive-layout.test.mjs`
- `tests/gw1-p2d-cors-remediation.test.mjs`
