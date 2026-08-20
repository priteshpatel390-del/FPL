# GW1-P2D-P1 — Diagnostic transport probe

## Status

**Diagnostic instrumentation only. No transport fix, no replacement architecture and no physical result is claimed by this checkpoint.**

- Branch: `claude/gw1-p2d-diagnostic-probe-22czjn`
- Base: `main` `4b478550353d754cacd32e400a23ebcea25b7b32` (the merge of PR #134, the Option A failure and Option C feasibility closeout)
- State: **draft / open / unmerged**, pending the owner's physical iPhone diagnostic test
- PR #119 is untouched by this work and remains draft, unmerged and acceptance-incomplete

This checkpoint changes no model, expected-minutes, fixture, scoring, squad, captaincy, transfer, optimiser, simulation, rank, Mini-League, provider-acquisition or provider-retention behaviour, and authorises none.

## FACT — what this checkpoint adds

It adds one owner-initiated diagnostic surface and the client code behind it. Nothing else.

- A new route, `Settings → Data & Diagnostics → Connection check`, separate from every evidence surface.
- Two single-shot request actions and one sign-in action.
- An in-memory result log rendered as fixed safe copy plus a bounded non-sensitive technical line.
- A validated `connect-src` origin for the archive host, admitted by the build only from one strictly checked meta tag.

It adds **no** evidence delivery, outbox, scheduler, retry, backoff or persistence. It writes nothing to browser storage. `main` contains no evidence delivery path, and this checkpoint does not introduce one.

## PROPOSAL / TEST — what the diagnostic is for

Option A failed its physical acceptance on 20 August 2026 and the root cause was not isolated. The recorded evidence establishes that Cloudflare Access top-level authentication succeeded and that protected `GET /v1/health` answered, but not that the cross-site background POST ever left the browser, reached Access, or reached the Worker.

The probe is the smallest safe experiment that separates those stages. It reproduces the exact request shape that failed — same origin, same Access-protected endpoint, same method, same `Content-Type`, same credentialled CORS mode — and changes exactly one thing: the body is a fixed, deliberately invalid, non-evidence payload.

```
{"probe":"teamsheet-transport-check"}
```

The deployed Worker rejects that body in `validateEnvelope()`, which runs before record validation, before R2 and before any evidence or receipt table. A successful transport therefore produces a deterministic, controlled `422 {"error":"envelope_schema"}`.

### Why the existing ingestion route, and no new Worker route

No Worker source changed in this checkpoint, and none needs to. That is deliberate and load-bearing: a new diagnostic route would require redeploying the Worker, after which the probe would be testing a *different* Worker from the one that failed. Probing the already-deployed route is the only way to obtain evidence about the deployment that actually failed acceptance.

### The two checks, and why there are two

Both address the same endpoint with the same invalid payload. They differ only in the session layer.

| Check | Session cookie | Redirects | Purpose |
|---|---|---|---|
| Signed-in check | sent (`credentials:'include'`) | followed | Exact replica of the request that failed acceptance |
| Sign-in-free control check | not sent (`credentials:'omit'`) | surfaced (`redirect:'manual'`) | Exercises browser preflight and CORS without depending on any cookie |

Comparing the pair is the measurement. One check alone cannot separate "the browser refused the credentialled response" from "the preflight or network failed".

## Leading hypothesis this probe was built to test

This is an **inference from repository source**, not a proven cause, and the probe exists precisely because it is unproven.

The Worker lineage deployed to Cloudflare — the `main` lineage, merged through GW1-P1/PR #118 — sets `Access-Control-Allow-Origin` for an exact allowed origin but **does not set `Access-Control-Allow-Credentials`**. Under the Fetch standard a cross-site request made with `credentials:'include'` is failed by the browser unless the response carries `Access-Control-Allow-Credentials: true`, on the preflight and on the response alike. If the deployed Worker never sent that header, every credentialled cross-site POST would fail the browser CORS check deterministically, on any browser, with any privacy setting.

The unmerged PR #119 candidate **does** add that header to the Worker. GitHub Pages was pointed at the PR #119 branch for the physical test, but a Cloudflare Worker is deployed separately from GitHub Pages, and this repository holds no evidence that the PR #119 Worker change was ever deployed.

That makes the following the sharpest open question, and the probe's A/B pair answers it directly:

- Signed-in check blocked **and** control check answered or redirected → preflight and CORS work in general; the credentialled response specifically was refused. The missing `Access-Control-Allow-Credentials` becomes the prime suspect, and the failure is Worker configuration rather than Safari privacy.
- Both blocked → the failure sits below the session layer: preflight bypass, Worker route, or network.

Neither outcome proves a cause on its own, and no Worker change is made or authorised here. Correcting the header would be a production transport change requiring separate approval, a Wrangler redeployment and its own acceptance.

## LIMITATION — what implementation alone proves

Nothing about live Safari, Cloudflare Access, cookie policy or the physical outcome. The repository tests prove the probe's safety boundary and its request contract. They cannot prove that the probe succeeds, and no physical success may be claimed until Pritesh performs the physical test and reports the evidence.

The probe also cannot see a preflight result, an Access decision made at the Cloudflare edge, or any response that fails the browser CORS check. Those appear to script only as one honest category, `blocked_before_response`, and must be correlated against Cloudflare Access and Worker logs.

## BOUNDARY — safety rules this checkpoint holds

### The genuine GW1 record is untouched

`predeadline-gw1-3fec5b2f1e134e52`, captured on 20 August 2026 at approximately 18:41 BST, is immutable authoritative local evidence. It is not used, uploaded, replayed, mutated, regenerated, rehashed, restamped or deleted. No fake prospective Stage 10 record is created either.

The probe module imports no evidence module at all. It cannot read, serialise, enqueue, hash or transmit a Stage 10 record, and permanent tests pin that import boundary, the absence of every evidence storage key, and the absence of the record identity from the diagnostic path and the generated bundle.

### No custody, no persistence, no scheduling

- No R2 object and no `evidence_records` or `ingest_receipts` row can be created; the payload cannot pass the envelope gate that precedes them. The only D1 write on the request path is the pre-existing per-subject rate-limit counter, which behaves identically for the `GET /v1/health` request the owner has already performed.
- Attempt results live in memory only. Nothing is persisted, so no storage key, journal, index or outbox row is created or modified.
- There is no scheduler, retry, backoff or automatic attempt. One owner tap performs exactly one request, immediately, with no delivery deadline to wait for. Because `main` carries no outbox, there is no `nextAttemptAt` to bypass and no normal delivery semantics to weaken.

### Nothing sensitive is read, rendered, stored or logged

No cookie, JWT, Access identity, team domain, policy audience, account identifier, provider payload or response body is observed. Only the numeric HTTP status, the Worker's short error code drawn from a fixed allow-list, and local timings are recorded. Owner-visible strings are fixed literals; raw exception text is never inspected or displayed, because it can contain the request URL.

The correlation reference is four random bytes generated per attempt. It carries no user, device or evidence identity, never reaches storage, and is never used as an archive or idempotency identity. It travels as a query parameter rather than a header because the Worker's preflight contract allows only `Content-Type`: a custom header would fail the preflight and destroy the measurement.

### Security posture is unchanged

Exact-origin CORS is unchanged and no wildcard is introduced. Foreign origins are still refused without CORS headers. Unauthenticated requests to protected routes are still rejected. Access policies, service tokens, client-side secrets, D1 schema, R2 format and evidence schemas are untouched. The archive origin reaches `connect-src` only through a build-time meta tag validated for exact HTTPS scheme, exact path and no wildcard or Cloudflare preview hostname.

### Explicitly not implemented

Storage Access API bridge, iframe transport, `postMessage` bridge, Option B top-level delivery window, same-site Cloudflare hosting, custom-domain Option C, DNS changes, Pages migration, Access weakening, service tokens, client secrets, D1 or R2 changes, new evidence schemas, real evidence replay, provider changes and model changes. None of these is approved and none is present.

## Result interpretation

The probe distinguishes these and no more. None of them should be over-read.

| Observation | Supported conclusion |
|---|---|
| No attempt recorded at all | Client, UI or scheduler defect |
| Attempt recorded, no readable response, no Access or Worker log entry | Browser, network, preflight or CORS stage remains implicated |
| Access logs a rejected protected request, Worker sees nothing | Authentication, cookie or Access boundary isolated |
| Worker returns `422 envelope_schema` | Credentialled cross-site Safari → Access → Worker transport is viable in that physical test |
| Worker returns an unexpected infrastructure or configuration response | Investigate Worker/Access configuration, not Safari |

A `2xx` must never be read as success: it would mean the archive accepted a payload that cannot be evidence, and the diagnostic classifies it as an unexpected reply.

## Physical acceptance plan

The owner's procedure is recorded in the pull request and must be followed without disabling Prevent Cross-Site Tracking. Repeated blind attempts are not part of it.

### The URL that serves Teamsheet

Teamsheet is a GitHub **project** site, so the only address that serves it is:

`https://priteshpatel390-del.github.io/FPL/`

The user-site root `https://priteshpatel390-del.github.io/` returns a GitHub Pages 404 and must never be used as the Teamsheet URL. Nothing in the application depends on this: the app is hash-routed and its assets are inlined into one file, so it is agnostic to the `/FPL/` base path. This is a procedure correction only and was not connected to the navigation defect below.

### Which build identity the phone shows

`Settings → Help & About → About this build` renders `BUILD_INFO.commit`, which is the `commit` field of `dist/manifest.json`. Generated output cannot contain its own commit hash, so the repository's provenance design builds from a **source commit** and then commits the generated files as a child of it. Two different identities are therefore both correct:

| Identity | Where it is read | What it means |
|---|---|---|
| **Source commit** | On the phone, `About this build` → `Commit` | The exact reviewed source that produced the deployed bytes |
| **Final PR head** | On GitHub, the pull-request head | The generated-only child commit that carries those bytes |

**The owner compares the source commit**, because that is what the phone can show. To find the expected value for any candidate, read the `commit` field of `dist/manifest.json` at the pull-request head; the pull request states it explicitly. `scripts/verify-build-provenance.mjs` independently proves that this commit is a reachable ancestor of the head and reproduces the committed bytes exactly, so matching it is a complete identity check.

An earlier version of this procedure told the owner to expect the final PR head on the phone. That was a defect in the instructions, not in the application, and build-provenance semantics were not changed to accommodate it.

## Physical UI defect found on 20 August 2026, and fixed

The first physical attempt never reached the transport experiment. On the deployed candidate, tapping `Settings → Data & Diagnostics → Connection check` did nothing visible.

**Cause, reproduced by executing the real shell:** the checkpoint added the Connection check card and its destination section, but never registered `#/settings/data/connection-check` in `TEAMSHEET_ROUTE_TABLE`. `normaliseTeamsheetRoute()` deliberately collapses any unregistered `#/settings/<section>/...` path back to that section's menu, so the tap re-activated `#/settings/data`, the hash was rewritten back, and the destination section stayed hidden — indistinguishable from nothing happening.

**Fix:** one route-table entry. No change to the diagnostic request shape, payload, credentials mode, redirect mode, endpoint, CORS, Access, Worker, Stage 10 behaviour or evidence storage.

**This was a client-side route-registry omission and nothing more.** It is not evidence about Safari, ITP, cookies, CORS, Cloudflare Access or the Worker. The transport experiment had not started when it occurred, so it supports no transport conclusion whatsoever.

## Current approval boundary

This checkpoint authorises diagnostic observability only. It does not authorise a transport fix, a Worker redeployment, an Access or Cloudflare change, a hosting or DNS change, PR #119 modification or merge, any Stage 10 change, or any provider or model change. Choosing a replacement architecture remains a separate, separately approved decision informed by the physical result.
