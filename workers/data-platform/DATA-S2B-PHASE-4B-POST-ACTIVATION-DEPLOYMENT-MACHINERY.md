# DATA-S2B Phase 4B — post-activation deployment machinery remediation

**Checkpoint:** repository-only review candidate. **No Cloudflare or D1 mutation is authorised or performed.**

## Why the machinery was stale

Cron activation and the first genuine daily attempts changed the legitimate production baseline after the earlier Phase 4B helpers were prepared. Production now has Deployment `06135b20-2508-4046-a21d-143077149825`, Version `733093ef-e01f-43a8-828a-0c8c67e7626f` at 100%, Cron `*/30 * * * *`, and failed ingestion history. The active Version derives from source `14e15a9a2b1220270fb414ab17cb051bd158f9ff`; it predates the merged redirect/manual and first-baseline fixes. The older Version `3a2b065a-6527-4887-9bf8-b08e82e81133` remains retained.

The old helpers instead pinned the prior active/rollback Versions, required no Cron, an exact pre-collection D1 size, and zero ingestion runs. Dispatching them unchanged would therefore fail for legitimate state and would not express the required rollback target.

## Reconciled live contract

The shared fail-closed contract pins:

- active Deployment `06135b20-2508-4046-a21d-143077149825` and active/immediate-rollback Version `733093ef-e01f-43a8-828a-0c8c67e7626f`;
- retained older Version `3a2b065a-6527-4887-9bf8-b08e82e81133`;
- D1 UUID `01e2b4f9-313a-4a14-8ce6-86c5aecc50d7`, database name `teamsheet-data`, compatibility date `2026-08-22`, season `2026-27`, and sole domain `data.fpltsheet.co.uk`;
- exactly one Cron expression, `*/30 * * * *`; missing, different, duplicate, or additional schedules fail;
- exactly the three binding names/types already live. The secret binding is checked only by name/type and any returned `text` field fails closed.

D1 file size is no longer pinned because legitimate failed scheduled rows can grow it. Migration and governance identity remain exact. The pre-deployment history contract permits two or more rows only when every row is an Official-FPL structured-history, `shadow_only`, failed run with zero seen/accepted/quarantined/rejected records and the known redirect-runtime failure class. It requires zero observations and zero heads. A completed run, accepted/partial data, unknown source/revision/run type/error, contradictory counts, or migration/governance drift fails closed. Existing rows are never rewritten or deleted.

## Future bundled flow

After merge, exact-main CI, a fresh protected read-only preflight, and separate owner approval, the existing controlled architecture remains:

1. upload one inactive Version through only `POST .../versions?bindings_inherit=strict`, containing the four approved modules and exact source annotations;
2. reconcile the returned distinct Version, module hashes, bindings, compatibility, Cron, domain, D1 identity, health, and unchanged Deployment; never retry an ambiguous upload;
3. promote that exact candidate once at 100%, with no upload capability in the deployment helper;
4. require authenticated HTTP 200 health with `ok=true` and `mode=shadow_only`, then repeat configuration and read-only D1 acceptance;
5. on candidate postflight failure only, submit exactly one rollback Deployment to `733093ef-e01f-43a8-828a-0c8c67e7626f` at 100%, verify restored health/invariants, and leave the failed candidate inactive for diagnosis.

The protected workflows require the Worker bearer plus the Cloudflare Access service-token pair and mask all credentials. They never print a secret binding value. Upload and deployment remain manual dispatches gated to exact approved `main`, exact checked-out head, successful deterministic CI, and the protected environment. Neither helper imports or calls the collector; acceptance waits for the next genuine scheduled event.

## Explicit exclusions and remaining acceptance

This checkpoint does not upload or deploy a Worker, roll back, mutate Cron/D1/bindings/secrets/domain/Access, invoke collection, change collector/provider/application/model behaviour, or change cadence. Live state can evolve while review is open: additional rows pass only if they satisfy the narrow known failed-run contract; every other evolution stops the machinery for reconciliation. After a future approved deployment, DATA-S2B still requires a genuine scheduled completed populated baseline and consistent observations/heads before live acceptance can close.

## Failed-run contract correction

Protected mutation-free preflight run `33415356489` ran on exact main `cd14dea2782e321ee4394055594ec0f8b9257edc`. Its repository gate passed and its Cloudflare read-only step failed closed with `phase4b_unknown_failed_run_contract`. It performed no Version upload, Deployment, Cron/D1/binding/domain/Access mutation or collector invocation.

The collector sanitizes an error message with `.replace(/[^a-z0-9_-]/gi,'_').slice(0,64)`. The two 30 and 31 August rows therefore store the evidenced redirect-runtime class `Invalid_redirect_value__must_be_one_of__follow__or__manual_`, not the broad `TypeError` prefix anticipated by the first post-activation validator. The corrected predicate accepts exactly that stored class; `collection_failed`, arbitrary `TypeError` values and every other error class fail closed. All source, revision, run-type, mode, status, zero-record, zero-observation/head, migration, governance, D1, binding and Cron invariants remain unchanged. After merge, the exact same protected mutation-free preflight must be rerun on exact current main before any upload/deployment decision.

Protected mutation-free preflight run `33419563072` on exact main `29195f1399d0c9caf41c5738968c62a5ec7f5100` passed its repository gate but again failed in the Cloudflare read-only job at `phase4b_unknown_failed_run_contract`. PR #190's exact error-class assumption was therefore insufficient; the actual mismatching field remains unproven. The diagnostic-only follow-up preserves every acceptance rule and still throws, while appending one deterministic bounded object containing only the run index, mismatching field names, and allowlisted structural fields. Unsafe strings become `[invalid]`; arbitrary row fields, raw responses, authentication material and unsanitized exceptions are never included. No production mutation occurred. After merge, another execution of the same mutation-free preflight remains separately owner-approved; Version upload and Deployment remain later separate owner decisions.
