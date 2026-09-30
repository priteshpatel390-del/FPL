# Version URL disposable diagnostic

Status: repository candidate. Merge does not authorize dispatch. Live execution requires a separate explicit owner approval after merge and exact-main verification.

## Why this exists

Gates B (run `36569336154`) and C (run `36629921145`) proved that Cloudflare publishes syntactically valid Version URLs for `teamsheet-api-football-shadow-collector`, but requests to them never reach Worker code. Investigation on 29 September 2026 then established:

- **FACT:** Version URLs work on this account. The owner opened the gateway's Workers Builds Version URL `175583c5-teamsheet-fpl-gateway.fpltsheet.workers.dev` and received `{"error":"route_not_allowed"}`, which is emitted only by `workers/fpl-gateway.mjs`. Account-level settings and the `fpltsheet` subdomain are therefore ruled out.
- **FACT:** The collector differs from the working gateway in three ways: its workers.dev route has been disabled in every experiment (`{enabled:false, previews_enabled:true}`), it has never had a Deployment, and it was created and versioned through the raw Cloudflare API rather than Wrangler/Workers Builds.
- **FACT:** Gate C's protected step ran in about 2.5 seconds, including the Version upload and a single probe per URL. Gate C therefore did not test whether a newly created Version becomes routable after propagation time.
- **FACT:** The collector serves real code through the script-content API despite zero Deployments.
- **INFERENCE:** One of the three differences, or an interaction between them, prevents dispatch. No existing evidence separates them.

## What the diagnostic does

One manual workflow, `.github/workflows/cloudflare-version-url-disposable-diagnostic.yml`, runs `workers/version-url-diagnostic/run-disposable-diagnostic.mjs` against exact current `main`. It creates a throwaway Worker named `teamsheet-version-url-diagnostic` the same way the collector was created: Beta Create Worker API with workers.dev and Version URLs disabled, then Version URLs enabled with workers.dev still disabled, then one Version uploaded through the stable Scripts Versions API. The Worker is `workers/version-url-diagnostic/diagnostic.mjs`: no bindings, no secrets, no imports, no outbound requests, and one fixed signature response (HTTP 200, exact body, custom header).

It then changes one variable at a time and probes the **same** Version URL on the existing seven-attempt, 112-second readiness schedule after each change:

| Phase | workers.dev route | Deployments | If the Version URL dispatches |
|---|---|---|---|
| A | off | 0 | `ZERO_DEPLOYMENT_HYPOTHESIS_REFUTED` — the fault is specific to the collector object |
| B | on | 0 | `WORKERS_DEV_ROUTE_REQUIRED_SUPPORTED` |
| C | on | 1 (100% to the same Version) | `FIRST_DEPLOYMENT_REQUIRED_SUPPORTED` |
| none | — | — | `FAILS_BEYOND_DEPLOYMENT_AND_WORKERS_DEV` |

The run stops at the first phase that dispatches. Settings and Deployment count are read back before each phase's probes. Phase C also probes the disposable Worker's production workers.dev hostname once.

The disposable Worker is always deleted when creation was attempted, including after mid-run failure. Postflight re-reads the collector and every other Worker in the account and requires them to be unchanged.

## Safety contract

- Mutations are restricted by exact path to the disposable Worker: create shell (1), upload Version (1), subdomain toggle (2), Deployment (1), delete (1). Any other method or path, including every collector path, throws before a request is issued.
- Preflight refuses before any mutation unless the collector is present with Worker ID `ae69aec0b6484b8f89b44e96b5eb86b8`, has exactly its three known Versions, zero Deployments, and workers.dev and Version URLs both disabled, and unless the disposable Worker does not already exist.
- No D1, secret, route, custom domain, Cron, Access or API-Football request exists in the module. The collector is read only.
- Retained evidence is closed enums, bounded integers, the disposable Version UUID and format-validated `cf-ray` identifiers. No response body, header value or URL is retained. Cloudflare text error pages are reduced to their numeric code.
- The workflow is manual, first-attempt-only, exact-main and exact-head-Verify gated, and uses its own protected environment.
- No automatic retry. A second run requires a new owner approval.

## Owner prerequisites before any dispatch

Create GitHub environment `cloudflare-version-url-diagnostic`, restricted to `main`, with:

- secret `CLOUDFLARE_ACCOUNT_ID` — the production account that holds the collector;
- variable `CLOUDFLARE_ACCOUNT_FINGERPRINT` — raw 64-character lowercase SHA-256 hex of that account ID;
- secret `CLOUDFLARE_DIAGNOSTIC_TOKEN` — a short-lived API token scoped to that account with **Workers Scripts: Edit**. Revoke it after the run.

Avoid pushing branches while the diagnostic runs: Workers Builds updates to other Workers would make the "every other Worker unchanged" postflight report unsafe.

## What each result would justify

These are proposals only. Each would need its own owner approval for the real collector.

- **Phase A dispatches:** the collector Worker object itself is the fault. The candidate remediation is recreating the collector through the same path, which is a larger, separately gated decision.
- **Phase B dispatches:** the candidate collector fix is enabling its workers.dev route together with Version URLs during the attended window. With zero Deployments, the production workers.dev hostname should serve nothing.
- **Phase C dispatches:** the candidate collector fix is one Deployment. That activates collector code on production traffic and requires a separate security and activation review.
- **Nothing dispatches:** further evidence, such as a Wrangler-created control, is required.
