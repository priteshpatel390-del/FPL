# GW1-P2 — Browser evidence delivery and durable outbox

<!-- GW1-P2C3B-CURRENT-2026-08-22 -->
## Same-site transport closeout — 22 August 2026

Option C sibling-domain transport has now passed its physical browser **transport-only** acceptance. A real iPhone in normal Safari with Prevent Cross-Site Tracking ON directly showed `Sec-Fetch-Site: same-site`; authenticated OPTIONS returned 204, the matching deliberately invalid `{}` POST returned 422, and Safari read `{"error":"envelope_schema"}`. This supersedes older statements below that Option C is unimplemented, undeployed or awaiting physical transport acceptance. No genuine Stage 10 record was sent, so custody, D1/R2 persistence, idempotency and duplicate handling remain unproven. See [GW1-P2C3B Same-site transport closeout](GW1-P2C3B-SAME-SITE-TRANSPORT-CLOSEOUT.md).


<!-- GW1-P2C2-CURRENT-2026-08-21 -->
## 21 August 2026 superseding physical result and next transport checkpoint

The controlled PR #137 diagnostic produced **Outcome B** under normal iPhone Safari privacy settings. The credentialled OPTIONS request reached `teamsheet-evidence-archive.fpltsheet.workers.dev` and the remediated Worker returned **204** with the required credentialled-CORS response; the subsequent POST did **not** reach the Worker, and Teamsheet received no HTTP status. Therefore the earlier CORS defect is closed, but the remaining failure cannot legitimately be assigned to one specific browser/Access cause and says nothing about D1/R2 processing because ingestion was never reached.

Option A (`github.io` → `workers.dev`) is exhausted. The approved next repository checkpoint is GW1-P2C2: preserve the durable outbox and exact credentialled-CORS design while preparing `https://app.fpltsheet.co.uk` → `https://archive.fpltsheet.co.uk/v1/evidence/predeadline`. This is same-site but cross-origin. It remains **unaccepted live architecture** until separately deployed and physically retested with normal privacy settings.


## Status

**Option A physical acceptance failed; PR #119 remains draft/unmerged; Option C same-site transport is the preferred separately gated next architecture.**

GW1-P2 remains a separate stream from GW1 application readiness and **does not gate GW1**. Cloud custody is a one-way side effect: recommendations never read, wait for or fail because of the archive. Local Stage 10 capture, recovery and owner-controlled export remain valid independently of cloud delivery.

- PR: #119 — `GW1-P2 — Browser evidence delivery and durable outbox`
- Branch: `claude/gw1-p2-evidence-delivery-design-ejsb0d`
- Current candidate head at this closeout: `414eb58f6207b3e2a78515a93d0c4c98685b3863`
- Candidate base: `main` `ae1a02c51ed226ff862d549432fce00ee6b256e1`
- Exact-head repository verification recorded on PR #119: **955 tests, 955 passed, 0 failed, 0 skipped, 0 cancelled**; two byte-identical production builds; root/deployable equality; exact build identity; committed provenance verified.
- State: **draft / open / unmerged**.

No model, expected-minutes, fixture, simulation, squad, captaincy, transfer, rank, Mini-League or provider-acquisition behaviour is changed or authorised by this record.

## Option A — canonical meaning

Option A is the implemented PR #119 transport: the existing Stage 10 browser capture path feeds a durable local outbox, which attempts a credentialled cross-site background POST from `priteshpatel390-del.github.io` to the Access-protected `teamsheet-evidence-archive.fpltsheet.workers.dev` Worker.

The canonical Stage 10 record is delivered exactly as stored. Delivery must not re-canonicalise, re-hash, strip provider material, restamp or regenerate evidence. The content hash remains the idempotent server identity. Local custody remains independent of cloud custody.

Repository tests prove the durable outbox/delivery state machine, content-hash idempotency, retry/recovery behaviour, fail-closed provider retention, exact-origin credentialled CORS contract and deterministic/provenance/build-identity requirements. They do not prove live Safari/Cloudflare Access cookie behaviour.

## 20 August 2026 physical iPhone Safari evidence

The decisive Option A acceptance was performed on a real iPhone in normal Safari with **Prevent Cross-Site Tracking ON throughout**. Disabling that setting is not an acceptable product requirement.

### Candidate deployment

GitHub Pages was temporarily changed from `main` to `claude/gw1-p2-evidence-delivery-design-ejsb0d`. Pages deployment #141 was physically observed as successful for candidate commit `414eb58f…`, so the physical test ran against the intended PR #119 candidate.

### Genuine prospective Stage 10 capture

After the genuine GW1 pre-deadline window opened, Teamsheet automatically created:

- `GW1 · Official-eligible`
- captured 20 August 2026 at approximately 18:41 BST
- snapshot ID `predeadline-gw1-3fec5b2f1e134e52`
- UI state `network attested`
- UI confirmation `Evidence secured automatically for GW1.`

This is genuine prospective Stage 10 evidence, not a reconstructed fixture. The record was saved locally on the iPhone. **It must not be deleted, recreated, modified, re-canonicalised, re-hashed, stripped or restamped.**

The Cloud Archive initially showed `Waiting to archive` and `Saved on this device. Teamsheet will keep trying in the background.` The owner did **not** press `Try archiving now`; the decisive acceptance therefore remained an automatic-delivery test.

### Access authentication and health

The owner used `Connect evidence archive`, which performed the intended top-level Safari authentication flow. Cloudflare Access authentication succeeded. At approximately 18:50 BST the protected health endpoint returned:

`{"ok":true,"archiveVersion":"1.0.0","schemaVersion":"1.0.0","migrationVersion":1}`

This establishes successful top-level Safari Access authentication, protected Worker reachability and the reported archive/schema/migration identities. It does **not** establish that the cross-site background POST from Teamsheet carried the Access session successfully.

### Automatic delivery result

After authentication the owner returned to Teamsheet. No manual upload action was taken. Prevent Cross-Site Tracking remained ON. Teamsheet was allowed to continue through its automatic retry/backoff behaviour.

Observed states remained `Waiting to archive` at approximately 18:53, 18:54, 18:57, 19:08 and 19:12 BST. The record did not transition automatically to `Archived`. The test was stopped rather than weakening Safari privacy or extending the test indefinitely.

### Production restore

GitHub Pages was restored to `main`. Pages deployment #142 was physically observed successful for `main` commit `ae1a02c…`. The temporary PR #119 production deployment was therefore removed after the test.

## Physical acceptance finding

**Option A failed its defined physical acceptance criterion under normal iPhone Safari with Prevent Cross-Site Tracking ON.**

The required automatic transition:

`Waiting to archive` → `Archived`

was not observed.

This is a transport-acceptance failure, **not a Teamsheet/GW1 failure**. Genuine Stage 10 local custody succeeded and cloud custody remains non-gating.

## Root-cause boundary

The physical evidence does **not** isolate the precise technical cause. It does not prove that the failure was caused by Safari third-party-cookie blocking, Intelligent Tracking Prevention, Cloudflare Access cookie behaviour, CORS, preflight handling, Worker configuration, networking, retry scheduling or another browser transport mechanism.

The implemented path depends on authenticated cross-site browser transport, and current Apple/WebKit and Cloudflare documentation make cross-site browser session/cookie handling a plausible architectural explanation class. That remains an **inference**, not an experimentally isolated cause.

Further Option A diagnosis is not required before comparing alternatives because the repository's predeclared decision rule was behavioural: if Option A failed under normal Safari privacy settings, stop, preserve Safari privacy and return for an evidence-led Option B versus Option C decision.

## Option B — Worker-origin delivery window

Canonical meaning: move archive delivery into a top-level Worker-origin browser window so Access authentication and the archive request occur in a first-party archive context.

The approach is technically credible and can preserve immutable Stage 10 bytes, existing content-hash idempotency, R2/D1 custody and the no-client-secret rule. Its principal weakness is browser-window lifecycle and product friction: reliable operation may require an owner gesture, secure cross-window transfer/acknowledgement, recovery from a closed or suspended window, and additional replay/origin handling. It is therefore less compatible with genuinely automatic background archival.

**Disposition: retain as fallback; no implementation approved.**

## Option C — same-site hosting

Canonical meaning: place the Teamsheet application hostname and archive Worker hostname beneath the same owner-controlled registrable domain while retaining separate origins, for example conceptually:

- `app.<owner-domain>` → existing GitHub Pages application
- `archive.<owner-domain>` → existing Cloudflare Worker

This topology can preserve GitHub Pages, the vanilla-JavaScript/zero-dependency build, the existing Stage 10 capture, durable outbox, Access-protected Worker, R2 and D1. The request remains cross-origin and therefore retains exact-origin credentialled CORS, but the two browser-facing hosts are same-site rather than the current unrelated `github.io` and `workers.dev` sites.

No Access service token or client-side secret is required. Teamsheet itself need not become Access-protected. Stage 10 bytes, snapshot identity, hash, capture time and provider material remain unchanged. The existing outbox can continue retrying whenever Safari gives Teamsheet execution time; this does not create a background daemon and does not promise delivery while Safari is terminated.

A concrete implementation design must separately specify and test the custom-domain/DNS topology, Access application hostname, cookie policy, exact allowed origin, OPTIONS handling, CSP, disposition of the old `workers.dev` route, HTTPS/certificate behaviour, rollback and physical Safari acceptance.

A suitable registrable domain may introduce a modest recurring domain-registration cost if the owner does not already control one. This is infrastructure cost, not a football-data/API subscription, and no domain purchase is authorised by this closeout.

**Feasibility decision: GO — Option C is the preferred architecture for a separately approved implementation proposal. Option B remains fallback.**

This feasibility decision is not a claim that Option C works on Safari. It has not been implemented or physically accepted.

## Security and privacy invariants for any Option C proposal

Any later implementation proposal must preserve all of the following:

- Prevent Cross-Site Tracking remains ON; no privacy weakening or tracking exemption.
- No client-side Cloudflare Access service credential, token or secret.
- Cloudflare Access continues to protect non-preflight archive routes.
- The Worker remains responsible for exact-origin CORS; wildcard origin is forbidden.
- OPTIONS may bypass Access only so the Worker can enforce the CORS preflight contract.
- Access cookie attributes are not loosened without separate evidence and security review.
- Stage 10 canonical bytes are immutable: no re-canonicalisation, re-hashing, timestamp rewriting or provider stripping.
- Content-addressed/idempotent archive identity remains intact.
- Local custody remains independent of cloud custody.
- Archive failure never gates or changes an FPL recommendation.
- Alternate Worker/preview routes must be explicitly controlled and tested.
- Access credentials, evidence bodies and sensitive provider material must not be logged.

## Required Option C acceptance contract

If implementation is separately approved, completion requires repository and physical evidence rather than architectural assumption.

Repository/integration coverage must include the new exact app origin and archive endpoint, CSP, foreign-origin rejection, unauthenticated POST rejection, OPTIONS behaviour, no browser secret/token, immutable evidence bytes, idempotency, offline/restart recovery, duplicate delivery, authentication expiry, alternate-route controls and all existing deterministic/provenance/build-identity gates.

The decisive physical test must use a real iPhone in normal Safari with **Prevent Cross-Site Tracking ON**. After top-level archive authentication and return to Teamsheet, with no manual upload action, a pending record must automatically transition `Waiting to archive` → `Archived`. Reload/duplicate behaviour and server/local canonical identity/hash must then be verified.

Real evidence must not be destructively modified merely to manufacture test cases.

## Rollback contract

Any later Option C implementation must be reversible at the hosting/transport boundary without changing evidence. Rollback must preserve local Stage 10 records, existing R2 objects and D1 manifests/receipts, and must never mean disabling Safari privacy protection.

## Current approval boundary

This closeout records the owner-approved investigation/design conclusion only. It does **not** authorise application implementation, Cloudflare changes, Access changes, DNS changes, Pages changes, domain purchase, PR #119 modification/merge, Stage 10 changes, D1/R2 schema changes, provider changes or model/calculation changes.

PR #119 remains **draft and unmerged**. A separate explicit owner approval is required before Option C implementation.
