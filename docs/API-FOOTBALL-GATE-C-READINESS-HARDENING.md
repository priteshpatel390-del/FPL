# Gate C readiness hardening — repository-only review candidate

Date: 8 October 2026
Status: **owner-approved repository-only hardening; draft PR required; no live dispatch authorised**.

## Baseline and evidence

PR #317 merged into main at `f8c9820e290007e1d611ea4adf58a2709714a683`. Exact-main Verify Teamsheet run [37770135682](https://github.com/priteshpatel390-del/FPL/actions/runs/37770135682) passed 2,592 of 2,592 tests, with deterministic production builds and exact build identity. The Gate C *collection* workflow is still dormant; no new corrected-Version provider call, fixture collection or committed generation has been proven. Gate A/B and the historical continuation remain consumed.

Earlier branch-created, automatic `push` checks labelled with the Gate C workflow name reported failures with **zero jobs**: at least one earlier workflow revision had misindented inline JavaScript inside a YAML `run: |` scalar. Commit `84b756b6009faf6d3e33620eac3fb5791566005a` corrected that indentation, already included in #317. The earlier failed runs do not establish a failed Gate C *live* dispatch; they were `push` events and created no jobs. However the merged workflow has never been executed via `workflow_dispatch`; static and application CI do not establish live workflow acceptance.

Data Steward Read-Only Observer run [37726769550](https://github.com/priteshpatel390-del/FPL/actions/runs/37726769550) remains **UNHEALTHY**, with `D1_GOVERNANCE_MISMATCH`. Its migration-3 expectation is separate from Gate C's six-migration admission; neither inference of corruption nor inference of readiness is allowed. Cloudflare/D1 state was last independently reconciled for Gate B on 7 October, not for this hardening work.

## Scope

1. **No-consuming read-only readiness path.** Add a distinctly named, dormant `workflow_dispatch` file `.github/workflows/api-football-gate-c-readonly-readiness.yml` that runs existing Gate C `ADMISSION` on protected `data-steward-readonly`; it requires owner-selected exact current main SHA and keeps the established shared non-cancelling concurrency group. It may run again if separately authorised because it does not invoke or consume Gate C's one-time collection workflow. It accesses Cloudflare/D1 read inventory only: Cloudflare GETs and D1 `POST /query` with **SELECT-only SQL**; zero D1 mutation, Worker invocation, workers.dev/Deployment/Version change or provider request. It has no attended mutation token, trigger secret or provider API key. This new workflow is NOT dispatched by the current repository approval.
2. **Workflow validation.** Add permanent Node built-in regression checks for the live workflow and the separate read-only workflow: YAML literal indentation, JavaScript `NODE` heredoc syntax, manual-only triggering, exact-main verification, protected environment, dispatch consumption only in the live workflow, no mutation-bearing secrets in the read-only workflow. These are offline structural checks, not a substitute for GitHub Actions' own workflow parser.
3. **Synthetic integration coverage.** Exercise the actual Gate C executor using entirely mocked Cloudflare/Worker responses, asserting one trigger, the two D1 control writes, both cleanup actions, no Deployment POST, rejected-trigger fail-closed behaviour, no extra writes on topology drift, rerun refusal, and UTC-day binding. Existing injected readers and an injected clock default to the unchanged production functions and `new Date()`; collection logic, request budget and live network flow remain unchanged. Also exercise the existing read-only admission/reconciliation composition with synthetic state.
4. **Documentation.** Record #317's merged status and exact-main test result, identify the workflow-validation caveat, preserve the unresolved Data Steward sentinel, and explicitly retain the separate live approval boundary.

## Exclusions and approval gates

No one-shot live dispatch, no read-only workflow dispatch, no Cloudflare read or write, D1 access, provider request, secret handling, Worker invocation, route/Preview/Cron/domain change, version/deployment upload, mapping/schema/model/product change, provider scope expansion, fixture scoring or historical retry is authorised by this work.

An owner-approved **merge** and successful exact-main CI are separate from any later read-only workflow dispatch and from a one-time Gate C collection dispatch. A fresh independently recorded Cloudflare/D1 inventory and a working protected GitHub execution path are prerequisites for proposing live collection. Workflow parsing and runtime acceptance remain unproven until separately evidenced. No material improvement or model accuracy claim is made.
