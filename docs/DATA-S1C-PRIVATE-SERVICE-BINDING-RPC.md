# DATA-S1C — private Service Binding and RPC architecture

Status: live caller/target registered; permanent manual acceptance workflow added but not executed
Date: 25 August 2026
Authoritative implementation base: `5c115225c7e2ae03408213daf32e1f484328658c`

## Outcome and boundary

DATA-S1C prepares a private Worker-to-Worker path without changing Cloudflare. `teamsheet-data-platform` remains the sole validation, provenance, rights, mapping, idempotency, `shadow_only`, rejection and D1 owner. Its existing Access-protected HTTP surface and bearer-first application authentication remain intact during migration.

The target service exports two least-privilege named `WorkerEntrypoint` capabilities:

- `DataPlatformReadEntrypoint`: `health()` and `queryObservations(query)`;
- `DataPlatformIngestEntrypoint`: `ingestObservation(observation)`.

Both return `{ status, body }`, preserving the existing HTTP status and JSON contract without manufacturing HTTP requests. The HTTP adapter and RPC entrypoints delegate to the same `healthOperation`, `queryObservationsOperation` and `ingestObservationOperation` functions. There is no RPC `fetch`, generic dispatch, proxy, arbitrary SQL or binding-return method.

The provisional `teamsheet-data-platform-acceptance-caller` is an internal architecture caller, not DATA-S2, a collector, provider, API gateway, model or AI service. Its sole Service Binding targets `DataPlatformReadEntrypoint`; it has no D1, R2, secret, browser credential, provider configuration, Custom Domain, route, `workers.dev` hostname or Preview URL. Read and ingest are split because the additional configuration is small and prevents a read-only acceptance caller from acquiring write capability. A future separately reviewed ingestion caller would have to bind explicitly to the ingest entrypoint.

The first live caller upload was rejected before a version was created with Cloudflare HTTP 400 / error `10068`, `The uploaded script has no registered event handlers.` Current Cloudflare Service Bindings guidance requires a registered handler for this deployment shape even though the dedicated RPC documentation shows a handlerless `WorkerEntrypoint`. The repository remediation therefore adds one deliberately inert default `fetch()` handler which always returns an empty HTTP 404. This is not a caller HTTP API: the handler ignores the request, never forwards to DATA-S1 and never calls either read RPC method. The only useful caller capability remains the private `health()` and `queryObservations(query)` RPC surface. Privacy continues to depend on `workers_dev: false`, `preview_urls: false` and the absence of routes and Custom Domains. This repository change claims no successful caller deployment; any live retry and its topology verification remain separately gated.

## Security invariants

- Only `teamsheet-data-platform` binds `TEAMSHEET_DATA_DB`; its binding name, database name and migration remain unchanged.
- Callers receive named methods, never the D1 binding or arbitrary SQL capability.
- The Service Binding is the machine capability. No shared secret, bearer token, Access token or API key is added for RPC.
- Private RPC bypasses neither HTTP authentication nor routing: it is a separate runtime entrypoint. Existing unauthenticated HTTP requests still fail before routing, parsing or D1 access.
- No production test bypass, provider integration, schedule, R2 path, browser path or recommendation dependency exists.

## Future live acceptance — separate approval required

The permanent `.github/workflows/data-s1c-private-rpc-acceptance.yml` is the narrow fallback for final read-only acceptance. Codex Cloud was unsuitable because Wrangler's remote-preview/WebSocket transport failed with `ENETUNREACH` before the caller was reached. The manual workflow is exact-current-`main` only, references the dedicated `data-s1c-private-acceptance` GitHub environment, and accepts no input. It requires environment secrets named exactly `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; values are never repository content. It uses ordinary local `wrangler dev` with one `remote: true` Service Binding, so Wrangler may establish expected temporary Cloudflare edge-preview infrastructure without creating a persistent production deployment. The probe has no direct D1, write or ingest capability.

Repository inclusion is not execution approval. Once a valid persistent PRE-state exists, the workflow runs its read-only POST-state comparison unconditionally after the functional attempt, including failure; local cleanup is also unconditional, and final enforcement preserves either functional failure or topology drift as job failure without attempting production remediation. A successful query RPC does not imply that every row-dependent property was proved: absent cursors or insufficient existing production rows are reported as `NOT PROVABLE — INSUFFICIENT EXISTING ROWS`, no synthetic production write is made to manufacture pagination evidence, and an exercised cursor with a changed `as_of` must return HTTP 400 `cursor_invalid`. The environment and secrets were not configured here, the workflow was not run, and no successful GitHub Actions private RPC acceptance is claimed. Owner approval remains required before every manual execution.

There must never be an accidental-public period. A future approved execution must proceed in this order:

1. Keep Access ON for all public traffic.
2. Deploy the reviewed target Worker with RPC support.
3. Verify the existing public HTTP path remains Access protected.
4. Deploy the narrow caller with its named read Service Binding and no D1.
5. Prove private Worker-to-Worker health.
6. Prove private query, `as_of`, ordering, pagination, cursor and accepted-only semantics.
7. Obtain separate approval before any production write test or ingest-capable caller binding.
8. Only after successful private acceptance may removal of `data.fpltsheet.co.uk` be considered.
9. After any later hostname removal, verify no Custom Domain, no Workers Route, `workers.dev` disabled, Preview URLs disabled and the private binding still operational.
10. Treat bearer code/secret, Access resources, Service Token and password-record cleanup as a later separately approved checkpoint.

Repository tests do not prove Cloudflare Free-plan RPC availability, live entrypoint resolution, binding propagation, deployment compatibility, live D1 behaviour, Access enforcement or hostname state. Those remain live acceptance evidence requirements.

## Rollback design — do not execute in this checkpoint

Before public-hostname removal, stop or roll back the caller; the existing Access-protected DATA-S1 HTTP path remains available. The bearer path must not be described as a proven production fallback because valid-bearer live acceptance previously failed. Access is the proven outer rollback protection.

After a future hostname removal but before cleanup, restore the existing Custom Domain to the known-good DATA-S1 Worker and verify Access protects all traffic before declaring rollback complete.

## Explicit exclusions

This checkpoint performs no Worker deployment, Service Binding activation, Access/policy/service-token change, DNS or domain change, route or hostname change, secret creation/rotation/deletion, production D1 migration or data mutation, synthetic production write, Phase 5B, DATA-S2, provider, collector, schedule, AI, model, fixture, expected-minutes, captaincy, squad, transfer, simulation, rank, Mini-League or application-behaviour change.
