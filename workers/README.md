# Teamsheet Cloudflare Workers

## DATA-S1C private acceptance procedure

The permanent manual workflow at `.github/workflows/data-s1c-private-rpc-acceptance.yml` generates its probe only under runner temporary storage. Its Option 2 functional path binds only `DATA_PLATFORM_READ -> teamsheet-data-platform -> DataPlatformReadEntrypoint` with `remote: true`, starts ordinary localhost-only `wrangler dev`, and invokes direct read-only `health()` before bounded `queryObservations()`. It never binds D1 or an ingest entrypoint and contains no production deployment or storage mutation command. The deployed acceptance caller remains separate, unchanged topology evidence: its exact version and the target version are checked before and after functional testing, but direct-target success is explicitly not caller-forwarding proof. Once PRE-state is established, POST-state verification and local cleanup run unconditionally; final enforcement preserves functional failure or topology drift without automatic remediation. Execution remains separately owner-approved and no successful workflow acceptance is claimed.

## DATA-S1C private RPC repository target

`data-platform/data-platform-rpc.mjs` preserves the bearer-protected HTTP adapter and adds separate named read and ingest `WorkerEntrypoint` capabilities that delegate to the same DATA-S1 operations. `data-platform-acceptance-caller/` is a provisional private, read-only architecture caller bound only to `DataPlatformReadEntrypoint`; it owns no D1/R2, secret, public route or hostname. Its registered HTTP handler exists only to satisfy Cloudflare deployment validation and always returns an empty 404 without invoking DATA-S1; useful access remains RPC-only. Its two read forwarders explicitly await the downstream RPC custom thenable before returning the resolved structured value and propagate rejection without adding a fallback or write path. Repository configuration is not live deployment evidence. See `docs/DATA-S1C-PRIVATE-SERVICE-BINDING-RPC.md`.

The awaited-forwarding caller is deployed as version `cf9c150d-84b0-46f9-a166-530b7243e863` with 100% allocation. Deployment verification retained disabled `workers.dev` and Preview URLs, zero Custom Domains and exactly the existing read Service Binding; the target remained version `5edbe951-4be4-46bc-b2cf-17b550396105`. No caller method was invoked during deployment, and a separately approved acceptance run is still required.

<!-- GW1-P2C3B-CURRENT-2026-08-22 -->
## GW1-P2C3B transport closeout

The sibling origins are live and their physical browser transport gate has passed: real iPhone Safari with Prevent Cross-Site Tracking ON directly reported `Sec-Fetch-Site: same-site`; OPTIONS returned 204 and the matching deliberately invalid `{}` POST returned readable 422 `envelope_schema`. This proves transport only, not genuine Stage 10 custody or D1/R2 persistence. No Worker implementation/configuration or live infrastructure changes in this closeout. The GitHub Pages migration origin, legacy `workers.dev` archive hostname, its Access protection and existing deployments/versions remain retained for rollback.


<!-- GW1-P2C2-CURRENT-2026-08-21 -->
## GW1-P2C2 repository target — 21 August 2026

The repository candidate targets `https://app.fpltsheet.co.uk` for the GitHub Pages application and `https://archive.fpltsheet.co.uk/v1/evidence/predeadline` for browser evidence delivery. These sibling hosts are same-site but cross-origin, so exact-origin CORS and credential permission remain required. This repository state does **not** prove the custom domains, DNS, certificates, Cloudflare Access or GitHub Pages settings are live.

`workers/evidence-wrangler.jsonc` declares the future Worker Custom Domain `archive.fpltsheet.co.uk` with `custom_domain: true`, while retaining `workers_dev: true` for migration/diagnostic continuity and `preview_urls: false`. That declaration has **not** been deployed in this checkpoint. Both Worker repository configurations temporarily allow exactly `https://priteshpatel390-del.github.io` and `https://app.fpltsheet.co.uk`; no wildcard origin is permitted. The old application origin is retained only as a rollback path until later physical custom-domain acceptance.

The root repository `CNAME` prepares `app.fpltsheet.co.uk` through normal review. Do not use the GitHub Pages dashboard in a way that causes an uncontrolled commit to `main`.

## Service boundaries

This directory contains two deliberately separate Cloudflare services.

### Official FPL gateway

`fpl-gateway.mjs` with `wrangler.jsonc` is the approved FPL-T1 Worker. It is a narrow, read-only transport to the existing Official FPL API, not a new football-data provider and not a generic CORS proxy.

The current live service remains `https://teamsheet-fpl-gateway.fpltsheet.workers.dev`, and the application continues to use its exact `/fpl` base. Only `GET`, `HEAD` and CORS `OPTIONS` are accepted, and only the endpoint families in `docs/FPL-GATEWAY-DESIGN.md` are routed. Browser cookies, authorization headers and arbitrary destination URLs are never forwarded. GW1-P2C2 changes only the exact application-origin allowlist; provider routes, validation, caching, retry and recommendation semantics are unchanged.

### GW1-P1 evidence archive

`evidence-archive.mjs` with `evidence-archive-core.mjs`, `evidence-wrangler.jsonc` and `evidence-migrations/` is the separate authenticated persistence service for prospective evidence.

It does **not** proxy Official FPL and does not change application calculations. It accepts only validated Stage 10 `preDeadlineSnapshot` `local_capture` records in archive v1, writes exact canonical evidence to private R2 first, then commits the D1 manifest/receipt, and exposes the bounded orphan-reconciliation path. D1/R2 bindings and schemas are unchanged by GW1-P2C2.

The small `evidence-archive.mjs` entrypoint is the Cloudflare runtime adapter. The archive contract remains in `evidence-archive-core.mjs`; PR #137 keeps credentialled-CORS permission in the adapter rather than duplicating it in the core.

Cloudflare Access is mandatory for non-preflight routes. `TEAM_DOMAIN` and `POLICY_AUD` are owner-controlled runtime configuration and must not be guessed or hard-coded. Understat/Odds permanent-retention flags remain false until separately approved. No Access token, cookie, JWT, audience, team-domain detail or API secret may be persisted, rendered or logged by Teamsheet.

## GW1-P2D physical CORS evidence

A physical iPhone Safari diagnostic on 20 August 2026 isolated the failed signed-in transport to the preflight boundary: the approved-origin `OPTIONS /v1/evidence/predeadline` reached the Worker and returned `204`, but no corresponding `POST` reached the Worker. The merged GW1-P1 adapter did not explicitly permit credentials on approved-origin CORS responses.

PR #137's P2D-P3 remediation preserved the exact origin allowlist and added `Access-Control-Allow-Credentials: true` only when the core response had already granted that exact `Access-Control-Allow-Origin`. This is a browser CORS permission, not authentication; Cloudflare Access remains mandatory on non-OPTIONS routes.

On 21 August 2026 the exact remediated Worker version `301ba53b-0fd1-4174-a4d6-d6f162b3f03c` was deployed for the controlled physical iPhone Safari diagnostic with Prevent Cross-Site Tracking ON. Diagnostic `7e5212a2` produced exactly one matching Worker event: approved-origin `OPTIONS /v1/evidence/predeadline?probe=7e5212a2`, requesting `POST` and `content-type`, with `Sec-Fetch-Site: cross-site`; the Worker returned `204`. No corresponding `POST` reached the Worker and Teamsheet received no HTTP response/status.

This confirms the original credentialled-CORS defect and its preflight correction. It does **not** prove Safari third-party-cookie behaviour is the sole remaining cause, and it provides no evidence against D1, R2, archive validation, Stage 10 canonicalisation or POST processing because POST processing was never invoked. Option A (`github.io -> workers.dev`) is therefore exhausted for the physical acceptance target.

## GW1-P2C2 migration policy

The approved repository candidate prepares `app.fpltsheet.co.uk -> archive.fpltsheet.co.uk`. PR #119 is not merged wholesale; only its durable local outbox, immutable canonical-byte delivery, content-hash idempotency, bounded retry, separate authentication scheduling and fail-closed retention semantics are carried forward. Cloud custody remains a one-way side effect and the recommendation never waits for it.

The two exact application origins temporarily admitted by both Workers are:

- `https://priteshpatel390-del.github.io` — migration rollback only;
- `https://app.fpltsheet.co.uk` — intended custom Pages origin.

The evidence browser target is only `https://archive.fpltsheet.co.uk/v1/evidence/predeadline`. The exhausted archive `workers.dev` hostname is not admitted into the generated evidence meta configuration or CSP `connect-src`. `workers_dev: true` is retained at the Worker infrastructure level only so the existing service is not removed before the new path has passed its later live acceptance gate.

## Verification and live gate

Both Workers are zero-dependency ES modules. Relevant contracts are exercised by Node's built-in test runner, including:

- `tests/fpl-gateway-worker.test.mjs`
- `tests/evidence-archive-worker.test.mjs`
- `tests/evidence-archive-cloudflare.test.mjs`
- `tests/evidence-archive-layout.test.mjs`
- `tests/gw1-p2d-cors-remediation.test.mjs`
- `tests/gw1-p2c2-same-site-transport.test.mjs`
- `tests/evidence-delivery.test.mjs`

`tests/gw1-p2c2-same-site-transport.test.mjs` builds its Worker environment from the Wrangler `vars` in this directory, so a configuration that stopped carrying the exact application origin fails on behaviour rather than passing as unexercised text.

Repository tests can prove exact configuration, CORS contracts, build/CSP output, Worker mirror parity and unchanged bindings. They cannot prove live DNS/TLS, Access cookie behaviour or physical Safari transmission. No Worker deployment, Custom Domain activation, DNS change, Access change, D1/R2 change or physical iPhone test is authorised or performed by GW1-P2C2 repository preparation.

See `docs/GW1-P1-CLOUDFLARE-EVIDENCE-FOUNDATION.md`, `docs/GW1-P2-BROWSER-EVIDENCE-DELIVERY.md` and `docs/GW1-P2C2-SAME-SITE-CUSTOM-DOMAIN-TRANSPORT.md`.

## DATA-S1 data platform (repository only)

`data-platform/` is the separate provider-neutral `teamsheet-data-platform` service. Live handover evidence records its Worker, `teamsheet-data` D1, `TEAMSHEET_DATA_DB` binding and Custom Domain as existing; Access remains the proven outer protection. It permits only `shadow_only`, has no browser/CORS/R2/scheduled/provider integration, and must never be folded into the evidence archive or imported by the production application/model. DATA-S1C's RPC and caller configuration are repository candidates and have not been deployed.
