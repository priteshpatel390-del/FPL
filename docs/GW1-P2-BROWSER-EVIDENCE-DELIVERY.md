# GW1-P2 — Browser evidence delivery and durable outbox

Status: **implemented; Option A approved as the transport feasibility implementation only; physical iPhone Safari acceptance and live Cloudflare Access CORS confirmation are outstanding**
Approved scope: Pritesh, 11 August 2026, with amendments
Base: `main` `58b834a1824c4977a442e7b3e309e2bbf3d05da1`
Branch: `claude/gw1-p2-evidence-delivery-design-ejsb0d`

## Outcome

GW1-P2 connects the existing Stage 10 browser capture path to the GW1-P1 Cloudflare evidence archive through a durable local outbox.

The delivery path is:

`existing local_capture store -> outbox row -> authenticated cross-origin POST -> archive acknowledgement -> terminal outbox state`

Cloud custody is a one-way side effect. The FPL recommendation does not read, wait for, or fail because of any part of this path. No model, expected-minutes, fixture, simulation, squad, captaincy, transfer, rank, Mini-League or provider-acquisition behaviour changes.

The canonical Stage 10 record is delivered exactly as it was stored. Nothing in this checkpoint re-canonicalises, re-hashes, strips, restamps or regenerates evidence.

## Component boundary

| Component | Responsibility |
|---|---|
| `src/evidence/snapshot.mjs` | **Unchanged.** Capture, canonicalisation and SHA-256 identity. |
| `src/evidence/outbox.mjs` | Pure delivery state machine: row schema, transitions, backoff, response classification, retention pre-check. No DOM, storage, fetch or Cloudflare knowledge. |
| `src/ui/evidence.mjs` | Local custody. Gains one enqueue announcement and pinned-record retention; it never imports the delivery layer. |
| `src/ui/evidence-delivery.mjs` | Storage, transport, scheduling, single-flight and the status surface. |
| `workers/evidence-archive-core.mjs` | GW1-P1 contract, plus credentialled exact-origin CORS. |

`src/ui/evidence.mjs` announces `teamsheet:evidence-stored` and the delivery layer observes it. The dependency runs one way only, so Stage 10 capture cannot be delayed or failed by anything that talks to Cloudflare.

## Outbox contract

One bounded record under `fpl:evidence:outbox:v1`, holding references rather than evidence bytes. The canonical record stays in the single existing `fpl:evidence:snapshot:<id>` store, so the bytes uploaded are exactly the bytes local verification accepted.

`idempotencyKey` is the canonical content hash. A retry is therefore byte-identical to the original request, the GW1-P1 duplicate path absorbs it, and the Worker's `idempotency_conflict` branch is structurally unreachable from this client.

`enqueuedAt` is fixed once and never rewritten. A delayed upload can never present itself as an earlier capture; server custody time comes only from the immutable R2 `uploaded` timestamp recorded by GW1-P1.

### Lifecycle

| State | Terminal | Automatic retry |
|---|---|---|
| `pending` | no | yes, bounded backoff |
| `paused` | no | no — owner action only |
| `sent` (201) / `duplicate` (200) | yes | no |
| `rejected` (400/404/405/409/413/422) | yes | no |
| `blocked_retention` (retention 422 or local pre-check) | yes for automatic delivery | explicit owner request only |
| `expired_local` | yes | no |

Transient failures back off from 60 s, doubling to a 6 hour ceiling with ±20 % jitter, bounded at 10 attempts before `paused`. `Retry-After` is honoured when the archive sends it. Authentication gaps use a separate 30-minute schedule and a separate counter, so a signed-out period never consumes the transient budget.

Rows are dropped rather than migrated when `outboxVersion`, `archiveVersion`, `snapshotSchemaVersion`, `origin` or season does not match this build. A corrupt store degrades to empty with a recovery diagnostic.

### Durable retention — open decision

Measured on this branch, at full-season scale (700 players, 380 fixtures, 38 Gameweeks of minute history, horizon 6):

| Quantity | Measured |
|---|---|
| Canonical JSON actually posted | **4150.1 KB** |
| gzip | 363.6 KB |
| gzip + base64, as stored locally | **484.8 KB per record** |
| Existing `fpl:cache` at full season | 655.5 KB |
| Existing `fpl:minutes-history` at full season | 956.8 KB |

Pinning six pending records would place ~2908 KB of evidence beside ~1614 KB of existing supporting stores — about 4.5 MB before the Stage 10 outcome, metric and review stores are counted at all. Those stores are bounded but real: each keeps a current record plus up to six superseded full records at up to 3 MB each.

**What is evidenced and what is not.** The record and supporting-store sizes above are measured on this branch and are valid evidence. **The usable browser-storage ceiling on the owner's current iPhone is not evidenced.** Commonly quoted per-origin `localStorage` figures are not a measurement of this device, this iOS version or this origin, and iOS additionally evicts script-writable storage for sites without recent user interaction. No number in this document should be read as a proven quota.

`OUTBOX_RULES.pinLimit` is therefore set to **4** as a deliberately conservative bounded-outbox policy for the first acceptance cycle, giving ~1939 KB of evidence and ~3553 KB total against the same baseline. It is **not** claimed to be proven safe, because the ceiling it would have to be safe against is unmeasured. It is the smallest change that keeps more than the pre-GW1-P2 two-record guarantee while leaving room for the other Stage 10 stores. It must not be raised to 5 or 6 in this checkpoint.

Before final PR readiness, non-destructive storage evidence is to be read from the physical iPhone: current Teamsheet storage usage and `navigator.storage.estimate()` where the browser supports it. The Settings → Evidence panel reports both read-only. **No destructive fill-until-quota test may ever be run against real Teamsheet data.**

Loss behaviour when the pin limit is exceeded: the **oldest** non-terminal row is released, its backing record becomes eligible for the normal bounded sweep, and the row transitions to `expired_local` with a visible status. Evidence is never discarded without a recorded row, and the newest pending evidence is always the evidence retained.

## Authentication

Cloudflare Access authenticates the browser with the `CF_Authorization` cookie set on the archive hostname. Teamsheet is served from `priteshpatel390-del.github.io` and the archive from `teamsheet-evidence-archive.fpltsheet.workers.dev`. Both `github.io` and `workers.dev` are on the Public Suffix List, so these are different sites and the cookie is a **third-party cookie** on every upload.

Cloudflare documents the consequence directly: browsers that block third-party cookies break XHR to Access applications, and the documented remedy is a user-level tracking-protection exemption for the application hostname and the team domain.

- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/

The flow implemented here is:

1. **Sign in** — a user-initiated top-level navigation to the archive's own `GET /v1/health`. Access can only present sign-in as a first-party page; it is never embedded and never carries evidence.
2. **Deliver** — `fetch(endpoint,{mode:'cors',credentials:'include'})`. No token, cookie or header is read, written or logged by Teamsheet.
3. **Session gap** — classified generically as an identity gap; the row stays pending on the slow schedule and no retry ever prompts.

No permanent Cloudflare service credential exists in the static client, and none may ever be added.

### Amendment 4 — 403 classification

Two different 403s are separated internally:

- a Worker JSON body carrying `origin_not_allowed`, `origin_required`, `method_not_allowed`, `route_not_allowed`, `auth_not_configured` or `storage_not_configured` is a **configuration** defect and **pauses** the row. A known deployment fault must never sit in an indefinite identity retry loop.
- **no parsable Worker body** is the Cloudflare Access interception case — Access answers ahead of the Worker, so no Worker error exists. That is an identity gap, and it takes the bounded authentication schedule.

User-facing copy stays generic for both. No status code, header, origin, endpoint, policy or identity detail reaches the page; every displayed string is a fixed local literal.

## Deployment gates — amendment 2

Repository configuration is not proof of Cloudflare dashboard state. These are six distinct facts and only the first three are evidenced by this branch:

| # | Gate | Evidenced by |
|---|---|---|
| 1 | Browser CSP permits the archive origin | Repository — `build.mjs` derives `connect-src` from the validated meta tag; permanently tested |
| 2 | Worker returns exact-origin CORS | Repository — `corsHeaders()`; permanently tested |
| 3 | Worker returns `Access-Control-Allow-Credentials: true` | Repository — `corsHeaders()`; permanently tested |
| 4 | **Cloudflare Access handles the unauthenticated `OPTIONS` preflight** | **Cloudflare dashboard — not evidenced by this repository, and not confirmed as performed.** See the approved configuration below. |
| 5 | Authenticated main request reaches the Worker | Live test only |
| 6 | Live iPhone Safari result under normal privacy settings | **Owner physical acceptance only** |

While configuring or testing gates 4–6, `TEAM_DOMAIN`, `POLICY_AUD`, Access JWTs and cookies must never be printed, pasted, screenshotted or logged.

### Approved Access CORS configuration (owner action — not yet confirmed performed)

For the Access application protecting the evidence Worker:

- **bypass Access authentication for `OPTIONS` requests only**;
- let the Worker enforce its own exact-origin CORS policy;
- keep `POST`/`GET` and every non-`OPTIONS` evidence route Access protected;
- do not widen the allowed origin;
- do not set a wildcard `Access-Control-Allow-Origin` anywhere;
- expose no `TEAM_DOMAIN`, `POLICY_AUD`, cookie, JWT or other secret.

This arrangement is safe by construction and the safety is permanently tested rather than assumed. `handleEvidenceArchiveRequest()` answers `OPTIONS` before it authenticates, so a bypassed preflight is served correctly; `tests/evidence-archive-worker.test.mjs` proves that with authentication denied the preflight still returns 204 with exact-origin credentialled headers, while `POST /v1/evidence/predeadline`, `GET /v1/health`, `GET /v1/evidence/{hash}` and `POST /v1/admin/reconcile` all still return 403 `unauthorised`. A foreign or absent `Origin` is refused at the preflight itself, so the bypass never becomes an open cross-origin surface.

**Repository configuration is not proof of the live Cloudflare setting.** This configuration must not be described as performed until the owner confirms it.

## Acceptance gate — amendment 1

Option A is approved as the **transport feasibility implementation**, not as the accepted permanent iPhone transport. Automated tests passing does not complete this checkpoint.

Primary acceptance condition, to be performed by the owner on a physical iPhone:

- **Prevent Cross-Site Tracking ON** (normal default privacy setting);
- authenticate to the evidence archive;
- return to Teamsheet;
- automatically archive a genuine eligible Stage 10 record;
- confirm the acknowledgement and the durable outbox transition.

Testing with Prevent Cross-Site Tracking OFF is a diagnostic comparison only. **Disabling it must never become a product requirement.**

If Option A fails under normal Safari privacy settings, work stops at this gate and returns with a revised comparison of Option B (a Worker-origin delivery window) against Option C (same-site hosting). Neither may be implemented without separate approval.

The outbox and delivery components are deliberately transport-independent and survive that outcome unchanged: only the request issued inside `postEvidence()` would be replaced.

## Failure behaviour

| Condition | User sees | Local state | Retry | Recommendation |
|---|---|---|---|---|
| Offline / DNS / network error | "Waiting to archive" | record + `pending` | bounded backoff | unaffected |
| Access unauthenticated or expired | "Sign-in needed" | `pending` | slow schedule | unaffected |
| Worker configuration/origin defect | "Archiving paused" | `paused` | owner action | unaffected |
| 4xx contract rejection | "Not accepted" | `rejected` | never | unaffected |
| Retention not approved | "Archiving not approved" | `blocked_retention` | owner action | unaffected |
| 429 | "Waiting to archive" | `pending` | honours `Retry-After` | unaffected |
| 5xx / 503 / R2 / D1-after-R2 | "Waiting to archive" | `pending` | bounded backoff | unaffected |
| Corrupt outbox | recovery diagnostic | store degrades to empty | n/a | unaffected |
| Storage write failure or quota | recovery diagnostic | record still saved locally | not attempted | unaffected |
| Pin limit exceeded | "No longer stored" | `expired_local` | never | unaffected |
| Closed mid-upload | nothing | `pending` | next start | unaffected |
| Duplicate submission | "Archived" | `duplicate` + receipt | never | unaffected |

## Provider retention

The fail-closed gate is mirrored read-only on the client so evidence the archive will certainly reject is never uploaded. The Worker's 422 remains authoritative. Neither side may strip provider material to make a record archivable — that would change the canonical hash and destroy the evidence.

Understat archival rights remain unresolved and permanent Odds retention still requires its approved governance position. Both remain `false`.

## Privacy and security

- No FPL Team ID, manager name or league identifier reaches the archive; the existing Stage 10 forbidden-key gate already enforces this on both sides and is tested again here.
- No Access JWT, cookie, endpoint, team domain, policy audience or Odds key is stored, logged or displayed.
- Every user-facing string is a fixed local literal; no server message reaches the page.
- Every stored delivery outcome is one of a closed set of local category strings.
- No permanent service credential exists in the static client.

## Explicitly unchanged

Projection, expected-minutes, scoring, fixture, simulation, squad, best XI, captaincy, transfer optimisation, rank, Mini-League and rival logic; provider acquisition, weighting, caches, keys and fallbacks; Understat and Odds repair; the Official FPL gateway; Stage 10 capture, canonicalisation, hashing and local recovery/journal semantics; routing and rendering performance; Google Sheets; agents and scheduled collectors.

## Limitations

- iPhone Safari behaviour under normal privacy settings is **unknown until the owner tests it**. No device claim is made.
- Cloudflare Access CORS/preflight state is dashboard configuration and is not evidenced by this repository.
- iOS purges script-writable storage for sites without recent user interaction, so a pending record can be lost on a rarely-opened device. That surfaces as `expired_local`; GW1-P1 orphan reconciliation cannot help because nothing reached R2.
- The measured 4.15 MB canonical upload is significant on a cellular connection near a deadline.
- `pinLimit` is provisional pending the owner's durability decision.
- GW1-P2 is evidence custody and reliability infrastructure. It improves no prediction and makes no accuracy claim.
