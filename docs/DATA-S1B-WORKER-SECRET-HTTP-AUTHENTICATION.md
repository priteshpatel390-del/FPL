# DATA-S1B — Worker-secret HTTP authentication

Status: repository implementation candidate only; not deployed
Date: 24 August 2026
Authoritative implementation base: `10c43c916fc8216a4a35a253cfaba73069b4772f`

## Purpose

DATA-S1 machine authentication is moving away from Cloudflare Access Service Token authentication after controlled production evidence showed that an owner-confirmed valid Service Token still received HTTP 403 under both Worker-level Access and a normal hostname Access application.

This record defines the approved replacement: every DATA-S1 application request must present `Authorization: Bearer <token>`, and the Worker must verify it against the encrypted server-side Worker secret binding `DATA_S1_HTTP_AUTH_TOKEN` before URL routing, request parsing, D1 binding checks, D1 reads, D1 writes, or rejection-record writes.

## Current live state

The production `teamsheet-data-platform` Worker, production `teamsheet-data` D1 database, binding `TEAMSHEET_DATA_DB`, and custom domain `data.fpltsheet.co.uk` already exist. Worker-level Cloudflare Access remains the live outer protection at this repository checkpoint.

The bearer-authentication code in this branch has not been deployed. No production `DATA_S1_HTTP_AUTH_TOKEN` has been created. No live bearer-authentication success is claimed. No Phase 5B production synthetic record has been created by this checkpoint.

## Authentication contract

The client supplies `Authorization: Bearer <token>`.

The server secret is available only through `DATA_S1_HTTP_AUTH_TOKEN`. It must not be committed to GitHub, placed in `wrangler.jsonc`, logged, persisted, reflected in responses, passed in query strings, or exposed to browser code.

Authentication is the first application boundary in the Worker fetch handler.

Missing or incorrect client credentials return:

- HTTP `401`
- `{"error":"unauthorized"}`
- `Cache-Control: no-store`
- `WWW-Authenticate: Bearer`

Missing, empty, non-string, whitespace-containing, or cryptographically unusable server configuration fails closed with:

- HTTP `503`
- `{"error":"service_unavailable"}`
- `Cache-Control: no-store`

The server response does not disclose the secret, binding name, presented credential, or detailed configuration failure.

## Timing-safe verification

The Worker hashes both the presented token and the configured secret with Web Crypto SHA-256, producing fixed 32-byte values, then compares those values with Cloudflare Workers' `crypto.subtle.timingSafeEqual`. If either `digest` or `timingSafeEqual` is unavailable, authentication fails closed.

## Unchanged DATA-S1 behaviour

After successful authentication, existing DATA-S1 behaviour remains unchanged, including `shadow_only`, schema and migrations, D1 binding semantics, observation identity, idempotency, exact-existing behaviour, conflicts, replay, pagination, `as_of`, rights and retention handling, mapping, provenance, timestamps, secret/keyed-URL input protections, and independence from production FPL calculations.

No CORS, browser authentication, OAuth, mTLS, Access JWT verification, API Shield, rate limiting, KV, Durable Objects, generic SQL route, external dependency, provider change, model change, fixture change, captaincy change, squad change, transfer change, rank change, or Mini-League calculation change is part of this checkpoint.

## Test contract

Permanent automated coverage must prove that missing and incorrect bearer credentials are rejected before any D1 operation; unusable server configuration fails closed; unauthenticated health, query/replay, and POST requests cannot read or write D1; unauthorized POSTs cannot create rejection rows or observations; authenticated health remains exactly `{"ok":true,"platformVersion":"1.0.1","mode":"shadow_only"}`; and authenticated insert, existing, conflict, replay, pagination, rights, mapping, and provenance behaviour remains intact.

Synthetic test credentials must pass through the real production authentication path. Production code must contain no test bypass.

## Future production cutover — separately approved only

This repository checkpoint does not authorize live changes.

The intended later sequence is:

1. Retain Worker-level Cloudflare Access while deploying the reviewed authentication-enabled Worker and creating the encrypted `DATA_S1_HTTP_AUTH_TOKEN` secret under a separate production approval.
2. Verify the intended Worker version, binding, custom domain, disabled `workers.dev`, disabled preview URLs, and unchanged D1 state.
3. Under a separate cutover approval, disable Worker-level Access so requests can reach the new Worker authentication boundary.
4. Immediately run one consolidated health acceptance covering missing bearer credential, deliberately invalid bearer credential, and valid bearer credential.
5. Require missing and invalid credentials to be rejected and the valid credential to return HTTP 200 with the exact canonical health JSON.
6. If bearer acceptance fails, re-enable Worker-level Access immediately. Roll back the Worker deployment as well if the Worker implementation itself is defective.
7. Keep obsolete Access and Service Token resources until a later explicit cleanup approval.

Worker-secret bearer authentication is intended to replace Access as the DATA-S1 machine-authentication mechanism after successful production acceptance. Access is retained during deployment and as immediate rollback protection, not as a permanent required outer authentication layer.

## Explicit exclusions

This checkpoint performs no Worker deployment, Worker-secret creation, `wrangler secret put`, Access disable/delete, Service Token rotation or deletion, policy deletion, DNS or Custom Domain change, D1 migration or mutation, production synthetic insertion, Phase 5B execution, provider/model/calculation change, or unrelated Cloudflare cleanup.
