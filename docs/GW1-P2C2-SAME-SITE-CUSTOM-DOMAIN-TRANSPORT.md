# GW1-P2C2 — Same-site custom-domain transport

Status: **repository implementation candidate only — draft PR #139; no live infrastructure change authorised or claimed.**

## Evidence that forced the decision

On 21 August 2026, after PR #137 corrected the missing credentialled-CORS response header and that exact Worker revision was deployed, one controlled physical iPhone Safari diagnostic was performed with Prevent Cross-Site Tracking on. The OPTIONS request reached the evidence Worker and returned HTTP 204. The POST never reached the Worker and Teamsheet received no HTTP status. This proves the earlier CORS omission was a real defect and its remediation reached production; it does not prove one remaining browser/Access root cause and provides no evidence against D1/R2 because ingestion was never invoked. Option A (`github.io` → `workers.dev`) is therefore exhausted.

## Repository candidate

- App origin: `https://app.fpltsheet.co.uk`
- Archive origin: `https://archive.fpltsheet.co.uk`
- Ingestion endpoint: `https://archive.fpltsheet.co.uk/v1/evidence/predeadline`
- Browser request: `POST`, `mode: cors`, `credentials: include`, `Content-Type: application/json`
- Archive response: exact approved `Access-Control-Allow-Origin` plus `Access-Control-Allow-Credentials: true`; never wildcard
- Authentication: Cloudflare Access remains in front of archive routes
- Recommendation dependency: none; local Stage 10 capture is authoritative for the client and delivery remains an asynchronous side effect

The sibling hosts share the same site but are different origins. Same-site status is the reason for changing topology; it is **not** permission to remove CORS.

## Hosting representation prepared in the repository

GitHub Pages remains the static application host. The root `CNAME` file contains exactly `app.fpltsheet.co.uk`, so the intended Pages hostname is a reviewed repository change rather than an uncontrolled dashboard-generated commit. No Pages custom-domain setting or DNS record has been changed by this checkpoint.

The evidence Worker keeps its existing service, code and bindings. `workers/evidence-wrangler.jsonc` now declares exactly one future Worker Custom Domain, `archive.fpltsheet.co.uk`, with `custom_domain: true`. That declaration is repository configuration only: it has **not** been deployed, so Cloudflare has not been asked by this checkpoint to create DNS, issue a certificate or attach the hostname. `workers_dev: true` remains during migration for rollback/diagnostic continuity; the production browser candidate does not target the `workers.dev` archive hostname.

Both Worker repository allowlists temporarily contain exactly two application origins: the existing GitHub Pages origin `https://priteshpatel390-del.github.io` and the intended `https://app.fpltsheet.co.uk`. This is an explicit rollback window, not wildcard trust. Removal of the legacy origin is a later evidence-led cleanup after successful custom-domain physical acceptance.

## Selective carry-forward

PR #119 is not merged wholesale. Only its transport-independent browser evidence outbox/delivery behaviour is carried forward: immutable local canonical record, content-hash idempotency, retry/backoff, Access identity-gap classification, fail-closed provider retention, bounded pinning and generic user-facing status. PR #137 remains the single Cloudflare adapter authority for credentialled-CORS response permission; its header is not duplicated into the archive core.

## Migration and rollback

The Official FPL gateway repository configuration accepts exactly two application origins during migration: the existing `https://priteshpatel390-del.github.io` origin and the intended `https://app.fpltsheet.co.uk` origin. This is temporary rollback support. It is not a wildcard and does not change Official FPL provider semantics.

The evidence archive repository configuration uses the same exact two-origin migration allowlist. The generated production candidate emits only the custom-domain archive endpoint in its evidence meta configuration and CSP `connect-src`; the exhausted archive `workers.dev` origin is not retained as a browser archive target.

Rollback before live acceptance is therefore straightforward: do not activate, or remove, the custom-domain infrastructure and continue using the existing deployed `main` plus local Stage 10 capture/export. No D1 or R2 rollback is required because this repository checkpoint changes neither schema nor stored data.

## Security invariants

- no Access token, cookie, JWT, audience, team domain or API secret in browser persistence, UI or logs;
- no wildcard CORS or preview/version hostname trust;
- exact ingestion path only, HTTPS only, no URL credentials/query/hash;
- PR #137 remains the single adapter authority for credential permission;
- Cloudflare Access remains mandatory on non-preflight archive routes;
- D1/R2 bindings, schema and private custody remain unchanged;
- provider archival rights remain fail-closed;
- evidence delivery cannot block or alter recommendations;
- no provider, model or calculation behaviour changes.

## Repository validation

The source candidate completed the normal `./run-tests.sh` before the final Pages/Worker-config hardening. The permanent Verify Teamsheet workflow on the exact final head is the authoritative final count and must pass committed provenance, the complete suite, two deterministic builds, root/deployable equality, exact build identity and production-output preservation. Repository validation cannot establish live DNS/Access routing or physical Safari behaviour.

## Live rollout gate — not approved by this document

After repository review, live work requires separate explicit approval. The later rollout procedure is:

1. verify `main`/approved PR head and the exact reviewed `CNAME` and Wrangler custom-domain configuration;
2. configure GitHub Pages for `app.fpltsheet.co.uk` without causing a direct write to `main`;
3. deploy/attach the reviewed evidence Worker Custom Domain `archive.fpltsheet.co.uk` and preserve Cloudflare Access;
4. verify exact application-origin allowlists and no wildcard CORS;
5. confirm DNS/TLS/Access health without modifying D1/R2;
6. perform one controlled invalid physical iPhone Safari transport probe with normal privacy settings;
7. require observable `Origin: https://app.fpltsheet.co.uk`, expected `Sec-Fetch-Site: same-site`, OPTIONS 204, a matching POST reaching the Worker, deterministic `422 envelope_schema`, and a readable response in Teamsheet.

That later test proves transport only. It must not manufacture prospective evidence or replay/modify the genuine GW1 Stage 10 record. Failure must be recorded from observable request/Worker evidence rather than attributed speculatively. No merge or legacy-origin removal is implied by this design record.
