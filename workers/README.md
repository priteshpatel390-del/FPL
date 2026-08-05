# Teamsheet Official FPL gateway

This directory contains the approved FPL-T1 Cloudflare Worker. It is a narrow, read-only transport to the existing Official FPL API, not a new football-data provider and not a generic CORS proxy.

## Deployment boundary

The Worker is deployed through Pritesh's owner-controlled Cloudflare account at `https://teamsheet-fpl-gateway.fpltsheet.workers.dev`. The application uses `https://teamsheet-fpl-gateway.fpltsheet.workers.dev/fpl`. Do not commit an API token, account token or secret. Production is public through the stable workers.dev route; preview routing is not required for Teamsheet.

The allowed browser origin defaults to `https://priteshpatel390-del.github.io`. Additional preview origins may be supplied through the Worker `ALLOWED_ORIGINS` variable as a comma-separated exact-origin list.

## Supported traffic

Only `GET`, `HEAD` and CORS `OPTIONS` are accepted. Only the endpoint families listed in `docs/FPL-GATEWAY-DESIGN.md` are routed. Browser cookies, authorization headers and arbitrary destination URLs are never forwarded.

## Local verification

The Worker has no runtime dependency. Its contract is exercised by `tests/fpl-gateway-worker.test.mjs` using Node's built-in test runner.
