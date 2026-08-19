# GW1-P2 — Browser evidence delivery and durable outbox

## Status

**Implemented candidate; acceptance incomplete; draft/unmerged.** It is a separate stream from GW1 application readiness and **does not gate GW1**: cloud custody is a one-way side effect the recommendation never depends on, and local Stage 10 capture, recovery and owner-controlled export remain the operating pre-deadline evidence path until this candidate is accepted and merged.

- PR: #119 — `GW1-P2 — Browser evidence delivery and durable outbox`
- Branch: `claude/gw1-p2-evidence-delivery-design-ejsb0d`
- Original base: `58b834a1824c4977a442e7b3e309e2bbf3d05da1`
- Reconciled with current `main` by an ordinary merge commit, so the branch now contains the full current `main` history. Its exact head moves with each reconciliation commit and is read live from PR #119 rather than restated here.
- The reconciled tree passes **955 tests, 955 passed, 0 failed, 0 skipped, 0 cancelled**; deterministic byte-identical production build, root/deployable equality, exact build identity and committed build provenance all pass. The exact-head Verify Teamsheet result is recorded on PR #119 and supersedes the candidate's earlier pre-reconciliation run.

GW1-P2 connects the existing Stage 10 browser capture path to the merged GW1-P1 evidence archive through a durable local outbox. Cloud custody is a one-way side effect: the recommendation never reads, waits for or fails because of the archive. The canonical Stage 10 record is delivered exactly as stored; delivery must not re-canonicalise, re-hash, strip, restamp or regenerate it.

No model, expected-minutes, fixture, simulation, squad, captaincy, transfer, rank, Mini-League or provider-acquisition behaviour is changed or authorised by this record.

## Reconciliation with current `main`

The candidate branched from `main` `58b834a…` and then fell behind while later checkpoints merged. Because the decisive physical acceptance must be performed on a candidate that could later be merged, current `main` was merged into the branch with an ordinary merge commit before that test — the already-reviewed GW1-P2 commits were not rebased or rewritten.

The reconciliation was deliberately narrow. No conflict touched application source: every conflict was in documentation or in generated deployables.

- **Documentation.** `CLAUDE.md`, `docs/ROADMAP.md`, `docs/TESTING.md`, `docs/KNOWN_LIMITATIONS.md`, `docs/SECURITY.md`, `docs/HISTORICAL_RECORDS.md` and `docs/DATA-ARCHITECTURE-D1.md` conflicted because later `main` had already reconciled all of them to describe this candidate. Later `main` is the newer and more accurate record in every case and was kept in full; the branch's superseded prose was dropped rather than reinstated. Nothing from the research programme, the GW1 readiness checkpoint or any later closeout was reverted.
- **This record.** Both lines of history wrote this file. The reconciled file keeps later `main`'s current status, owner-performed preparation, outstanding gate and merge gate as authoritative, and carries the candidate's design and implementation detail forward beneath them as the implementation record. Two statements in that detail were corrected to match the recorded facts: the Cloudflare Access OPTIONS-bypass configuration and the non-destructive device storage reading are both now recorded as performed.
- **Generated deployables.** `index.html`, `dist/index.html`, `dist/app.bundle.js` and `dist/manifest.json` conflicted and were **not** hand-merged. They were regenerated from the reconciled source by `node build.mjs` and committed as a generated-only child of the merge, following the existing source-commit-then-generated-commit provenance pattern.
- **One test correction.** `tests/evidence-delivery.test.mjs` measured its synthetic retry clock from the fixture deadline instant rather than from the real clock the row was enqueued on. That fixed calendar instant silently stopped being "after the bounded backoff" once the real date passed it, so two assertions had become unreachable and no longer proved anything. The retry clock is now measured from the enqueue clock. Both tests were confirmed to fail in the same way on the pre-reconciliation candidate head, so this is a latent defect in the candidate's own test file rather than a consequence of the merge, and no assertion was deleted, skipped or weakened.

No model, expected-minutes, fixture, scoring, squad, captaincy, transfer, optimiser, simulation, rank, Mini-League, provider, Stage 10 canonicalisation/hashing/timing, D1/R2 schema, Access architecture or hosting behaviour was changed by the reconciliation, and the GW1-P2 delivery semantics are unchanged.

## Proven by repository verification

The current candidate has permanent automated coverage for the durable outbox/delivery state machine, content-hash idempotency, retry/recovery behavior, fail-closed provider retention, exact-origin credentialled CORS contract and the existing deterministic/provenance/build-identity requirements. Automated tests cannot prove Safari/Cloudflare Access cookie behavior in the live cross-site context.

## Owner-performed live acceptance preparation

The following live steps are recorded as owner-performed evidence and must not be generalised beyond the paths stated:

1. Cloudflare Zero Trust Access application `teamsheet-evidence-archive` was opened.
2. **Bypass OPTIONS requests to origin** was enabled and saved.
3. No Access-layer allowed-origin response was configured. The intended architecture remains: Access bypasses only unauthenticated OPTIONS to the origin; the Worker owns exact-origin CORS; POST/GET/admin routes remain Access-protected.
4. GitHub Pages was temporarily switched to the PR #119 branch at `/` and independently observed `built`.
5. Teamsheet was opened in normal physical iPhone Safari. Settings → Evidence showed **Evidence not due yet**, no saved evidence snapshots and **Nothing waiting**, which is expected before an eligible Stage 10 record exists.
6. Non-destructive storage telemetry showed approximately **546.2 KB** of current Teamsheet-owned data in that session. A browser estimate also displayed approximately `0 B used of 39,321.6 MB available`; that estimate is **not** evidence of a usable 39 GB Teamsheet quota and must not be used as a durability guarantee.
7. `Connect evidence archive` was used. Top-level Safari Cloudflare Access authentication succeeded.
8. Protected `GET /v1/health` returned `{"ok":true,"archiveVersion":"1.0.0","schemaVersion":"1.0.0","migrationVersion":1}`.
9. After the partial test Teamsheet still correctly showed **Nothing waiting**, because no eligible Stage 10 record existed.
10. GitHub Pages was restored to `main` at `/` and independently observed `built`.

The health response proves only the recorded top-level Access authentication path, protected Worker reachability and configured archive/D1 migration identity. It does **not** prove the decisive GW1-P2 application transport.

## Remaining decisive acceptance gate

The genuine Stage 10 window opens **20 August 2026 at 18:30 BST**. A real pending Stage 10 snapshot does not exist before that configured window, so the decisive live acceptance must wait.

The required physical sequence is:

1. temporarily deploy PR #119 branch to Pages;
2. use normal Safari with **Prevent Cross-Site Tracking ON**;
3. create a genuine Stage 10 snapshot;
4. confirm local custody and `Waiting to archive`;
5. authenticate if needed and return to Teamsheet;
6. perform **no manual upload action**;
7. observe whether the record automatically becomes `Archived`;
8. reload and verify no incorrect duplicate behaviour;
9. verify server-side canonical identity/hash matches the locally captured record.

Until that sequence succeeds, the credentialled cross-site background POST from `priteshpatel390-del.github.io` to `teamsheet-evidence-archive.fpltsheet.workers.dev` using the Cloudflare Access session is **unaccepted**.

If the test fails under normal Safari privacy settings, stop. Do not disable Prevent Cross-Site Tracking as a product requirement. Do not implement Option B or Option C. Return with an evidence-led Option B versus Option C comparison for separate approval.

## Durable-retention limitation

The bounded outbox remains deliberately conservative. Current device evidence establishes the observed Teamsheet-owned data size in one session, not the usable storage ceiling. Any retention-cap change or persistence-technology change requires a separate proposal; no destructive fill-until-quota test should be performed against real evidence.

## Merge gate

PR #119 must remain **draft and unmerged** until the decisive live transport acceptance succeeds, final exact-head repository verification is green, the PR description/current canonical docs agree, and Pritesh explicitly approves merge.

## Implementation record

The sections below are the approved GW1-P2 design and implementation record carried forward from the candidate branch. They describe how the candidate works; the status, owner-performed preparation and outstanding gates above remain the authoritative current position.
### Component boundary

| Component | Responsibility |
|---|---|
| `src/evidence/snapshot.mjs` | **Unchanged.** Capture, canonicalisation and SHA-256 identity. |
| `src/evidence/outbox.mjs` | Pure delivery state machine: row schema, transitions, backoff, response classification, retention pre-check. No DOM, storage, fetch or Cloudflare knowledge. |
| `src/ui/evidence.mjs` | Local custody. Gains one enqueue announcement and pinned-record retention; it never imports the delivery layer. |
| `src/ui/evidence-delivery.mjs` | Storage, transport, scheduling, single-flight and the status surface. |
| `workers/evidence-archive-core.mjs` | GW1-P1 contract, plus credentialled exact-origin CORS. |

`src/ui/evidence.mjs` announces `teamsheet:evidence-stored` and the delivery layer observes it. The dependency runs one way only, so Stage 10 capture cannot be delayed or failed by anything that talks to Cloudflare.

### Outbox contract

One bounded record under `fpl:evidence:outbox:v1`, holding references rather than evidence bytes. The canonical record stays in the single existing `fpl:evidence:snapshot:<id>` store, so the bytes uploaded are exactly the bytes local verification accepted.

`idempotencyKey` is the canonical content hash. A retry is therefore byte-identical to the original request, the GW1-P1 duplicate path absorbs it, and the Worker's `idempotency_conflict` branch is structurally unreachable from this client.

`enqueuedAt` is fixed once and never rewritten. A delayed upload can never present itself as an earlier capture; server custody time comes only from the immutable R2 `uploaded` timestamp recorded by GW1-P1.

#### Lifecycle

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

#### Durable retention — open decision

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

Non-destructive storage evidence has since been read from the physical iPhone and is recorded under the owner-performed preparation above: approximately 546.2 KB of current Teamsheet-owned data, alongside a browser space estimate that is not a quota guarantee. The Settings → Evidence panel reports both read-only. **No destructive fill-until-quota test may ever be run against real Teamsheet data.**

Loss behaviour when the pin limit is exceeded: the **oldest** non-terminal row is released, its backing record becomes eligible for the normal bounded sweep, and the row transitions to `expired_local` with a visible status. Evidence is never discarded without a recorded row, and the newest pending evidence is always the evidence retained.

### Authentication

Cloudflare Access authenticates the browser with the `CF_Authorization` cookie set on the archive hostname. Teamsheet is served from `priteshpatel390-del.github.io` and the archive from `teamsheet-evidence-archive.fpltsheet.workers.dev`. Both `github.io` and `workers.dev` are on the Public Suffix List, so these are different sites and the cookie is a **third-party cookie** on every upload.

Cloudflare documents the consequence directly: browsers that block third-party cookies break XHR to Access applications, and the documented remedy is a user-level tracking-protection exemption for the application hostname and the team domain.

- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/

The flow implemented here is:

1. **Sign in** — a user-initiated top-level navigation to the archive's own `GET /v1/health`. Access can only present sign-in as a first-party page; it is never embedded and never carries evidence.
2. **Deliver** — `fetch(endpoint,{mode:'cors',credentials:'include'})`. No token, cookie or header is read, written or logged by Teamsheet.
3. **Session gap** — classified generically as an identity gap; the row stays pending on the slow schedule and no retry ever prompts.

No permanent Cloudflare service credential exists in the static client, and none may ever be added.

#### Amendment 4 — 403 classification

Two different 403s are separated internally:

- a Worker JSON body carrying `origin_not_allowed`, `origin_required`, `method_not_allowed`, `route_not_allowed`, `auth_not_configured` or `storage_not_configured` is a **configuration** defect and **pauses** the row. A known deployment fault must never sit in an indefinite identity retry loop.
- **no parsable Worker body** is the Cloudflare Access interception case — Access answers ahead of the Worker, so no Worker error exists. That is an identity gap, and it takes the bounded authentication schedule.

User-facing copy stays generic for both. No status code, header, origin, endpoint, policy or identity detail reaches the page; every displayed string is a fixed local literal.

### Deployment gates — amendment 2

Repository configuration is not proof of Cloudflare dashboard state. These are six distinct facts and only the first three are evidenced by this branch:

| # | Gate | Evidenced by |
|---|---|---|
| 1 | Browser CSP permits the archive origin | Repository — `build.mjs` derives `connect-src` from the validated meta tag; permanently tested |
| 2 | Worker returns exact-origin CORS | Repository — `corsHeaders()`; permanently tested |
| 3 | Worker returns `Access-Control-Allow-Credentials: true` | Repository — `corsHeaders()`; permanently tested |
| 4 | **Cloudflare Access handles the unauthenticated `OPTIONS` preflight** | **Cloudflare dashboard — not evidenced by this repository.** Recorded as performed by the owner; see the owner-performed preparation above and the approved configuration below. |
| 5 | Authenticated main request reaches the Worker | Live test only |
| 6 | Live iPhone Safari result under normal privacy settings | **Owner physical acceptance only** |

While configuring or testing gates 4–6, `TEAM_DOMAIN`, `POLICY_AUD`, Access JWTs and cookies must never be printed, pasted, screenshotted or logged.

#### Approved Access CORS configuration (owner action — recorded as performed)

The single required setting is:

> Cloudflare Zero Trust → Access controls → Applications → `teamsheet-evidence-archive` → Configure → Advanced settings → Cross-Origin Resource Sharing (CORS) → enable **“Bypass OPTIONS requests to origin”**

That is the whole change. **No Access-layer allowed-origin response is configured in this mode**, because the Worker is the sole owner of exact allowed-origin CORS enforcement. Configuring both would create a second, divergent origin policy outside the tested contract.

No Access policy for `POST`, `GET` or any other method changes. Only `OPTIONS` passes through Access without authentication.

The arrangement is safe by construction, and the safety is permanently tested rather than assumed. `handleEvidenceArchiveRequest()` answers `OPTIONS` before it authenticates, so a bypassed preflight is served correctly. `tests/evidence-archive-worker.test.mjs` proves, with authentication denied throughout:

- approved exact origin `OPTIONS` → **204**;
- `Access-Control-Allow-Credentials: true` present;
- wildcard `Access-Control-Allow-Origin` never emitted;
- absent or foreign `Origin` → **403** with no CORS headers;
- `POST /v1/evidence/predeadline`, `GET /v1/health`, `GET /v1/evidence/{hash}` and `POST /v1/admin/reconcile` → **403 `unauthorised`**.

So the bypass exposes no data route and never becomes an open cross-origin surface.

**Repository configuration is not proof of the live Cloudflare setting.** The owner has confirmed this configuration as performed, and that confirmation is recorded under the owner-performed preparation above. Any later redeploy or dashboard change must be re-confirmed separately.

### Acceptance gate — amendment 1

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

### Failure behaviour

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

### Provider retention

The fail-closed gate is mirrored read-only on the client so evidence the archive will certainly reject is never uploaded. The Worker's 422 remains authoritative. Neither side may strip provider material to make a record archivable — that would change the canonical hash and destroy the evidence.

Understat archival rights remain unresolved and permanent Odds retention still requires its approved governance position. Both remain `false`.

### Privacy and security

- No FPL Team ID, manager name or league identifier reaches the archive; the existing Stage 10 forbidden-key gate already enforces this on both sides and is tested again here.
- No Access JWT, cookie, endpoint, team domain, policy audience or Odds key is stored, logged or displayed.
- Every user-facing string is a fixed local literal; no server message reaches the page.
- Every stored delivery outcome is one of a closed set of local category strings.
- No permanent service credential exists in the static client.

### Explicitly unchanged

Projection, expected-minutes, scoring, fixture, simulation, squad, best XI, captaincy, transfer optimisation, rank, Mini-League and rival logic; provider acquisition, weighting, caches, keys and fallbacks; Understat and Odds repair; the Official FPL gateway; Stage 10 capture, canonicalisation, hashing and local recovery/journal semantics; routing and rendering performance; Google Sheets; agents and scheduled collectors.

### Limitations

- iPhone Safari behaviour under normal privacy settings is **unknown until the owner tests it**. No device claim is made.
- Cloudflare Access CORS/preflight state is dashboard configuration and is not evidenced by this repository.
- iOS purges script-writable storage for sites without recent user interaction, so a pending record can be lost on a rarely-opened device. That surfaces as `expired_local`; GW1-P1 orphan reconciliation cannot help because nothing reached R2.
- The measured 4.15 MB canonical upload is significant on a cellular connection near a deadline.
- `pinLimit` is provisional pending the owner's durability decision.
