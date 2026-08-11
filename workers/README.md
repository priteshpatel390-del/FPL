# Teamsheet Cloudflare Workers

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

The backend foundation received live production acceptance on 11 August 2026. The Teamsheet browser is still not connected to this Worker in GW1-P1; browser sync/outbox integration is the later GW1-P2 checkpoint.

See `docs/GW1-P1-CLOUDFLARE-EVIDENCE-FOUNDATION.md`.

## Allowed origins

Both Workers default to the production GitHub Pages origin `https://priteshpatel390-del.github.io`. Additional review origins, where a checkpoint explicitly allows them, must be supplied as exact origins rather than wildcards.

## Verification

Both Workers are zero-dependency ES modules. Relevant contracts are exercised by Node's built-in test runner, including:

- `tests/fpl-gateway-worker.test.mjs`
- `tests/evidence-archive-worker.test.mjs`
- `tests/evidence-archive-cloudflare.test.mjs`
- `tests/evidence-archive-layout.test.mjs`
