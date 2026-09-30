# API-Football replacement inactive collector foundation

Status: repository candidate only. Merge does not authorize Cloudflare execution. Live creation requires exact-main verification, protected-environment provisioning and separate owner approval.

## Proven lifecycle cause

Gate C run `36629921145` created clone `7405abc0-8358-4156-8226-b6cc7bcf244f` while the existing collector's visible Version URL setting was enabled. Historical and clone URLs both returned platform 404 responses rather than the reviewed Worker signature. This disproved Version-upload timing as sufficient cause.

Controlled same-account disposable diagnostics then varied Worker-object creation state:

- **FACT:** a Worker created initially with `{enabled:false, previews_enabled:true}` routed its first directly uploaded Version immediately at 0, 1, 3, 6 and 10 seconds with zero Deployments;
- **FACT:** a Worker created initially with both flags false published a Version URL after later Preview enablement but never dispatched to Worker code;
- **FACT:** enabling Preview before its first upload, including a wait before upload, did not repair that initially-disabled Worker object;
- **FACT:** one Deployment alone did not repair it;
- **FACT:** workers.dev enablement alone without a Deployment did not repair it;
- **FACT:** full production topology — Deployment plus workers.dev — bootstrapped routing, but is forbidden as collector remediation;
- **INFERENCE:** Cloudflare does not provision or attach some internal Version URL routing state when this Worker creation path starts with Preview disabled. Repository evidence does not claim knowledge of Cloudflare's internal representation.

The original `teamsheet-api-football-shadow-collector` was created initially with both flags false. It remains an immutable historical object with exactly Versions `e49ac8f2-4289-46bc-9f0b-87a20cd7be62`, `04d79556-3070-429f-9944-b5b53d799842` and `7405abc0-8358-4156-8226-b6cc7bcf244f`; zero Deployments/Cron/routes/domains; workers.dev and Version URLs disabled; and pristine runtime/provider history.

## Replacement identity and creation invariant

The deterministic replacement name is:

```text
teamsheet-api-football-shadow-collector-v2
```

It is a separate Worker object. No replacement-foundation mutation path can address the original collector.

Its first and only shell-create request must contain:

```json
{
  "name": "teamsheet-api-football-shadow-collector-v2",
  "observability": { "enabled": true },
  "subdomain": {
    "enabled": false,
    "previews_enabled": true
  }
}
```

`enabled:false` keeps normal production workers.dev serving off. `previews_enabled:true` at initial object creation provisions the only public path used by the later secret-free routing proof. Later false-to-true toggling is not an accepted bootstrap or recovery mechanism.

## Version contract

The replacement receives exactly one Version. It reuses the immutable reviewed attended module graph and runtime contract:

- 17 exact reviewed modules, including attended HTTP rejection behavior;
- compatibility date `2026-09-16`;
- production `TEAMSHEET_DATA_DB` binding;
- seasons `2026-27` / `2026`;
- activation `ATTENDED_ONE_SHOT_DISCOVERY`;
- secret binding names `API_FOOTBALL_API_KEY` and `API_FOOTBALL_ATTENDED_TRIGGER_SECRET`.

The existing secret values are consumed only inside protected execution and sent only as `secret_text` fields in the one Cloudflare Version upload. They are never written to artifacts, logs, probes or repository files. Replacement annotations identify current approved repository SHA and replacement purpose; the candidate does not impersonate historical Version UUID or historical annotations.

## Routing proof

Only these requests are allowed:

```text
GET /
GET /__teamsheet/api-football/attended-one-shot
```

Both have no custom headers, body, trigger secret or provider credential. Exact success requires:

- HTTP 404;
- body exactly `Not found`;
- `cache-control` exactly `no-store`;
- `content-type` beginning `text/plain`.

Any mismatch stops. It cannot cause a Deployment, workers.dev enablement, route/domain/Cron creation, second Version or provider request. Preview is disabled only after both exact signatures are proved.

## Mutation and ambiguity boundaries

The protected runner permits exactly:

1. one modern Create Worker POST for the replacement name and exact initial body;
2. one stable Scripts Version upload for that replacement;
3. one replacement Script Subdomain POST containing only `{enabled:false, previews_enabled:false}` after successful routing proof.

There is no delete, Deployment, workers.dev enable, route, domain, Cron, Access or D1 mutation primitive. Shell or Version mutation ambiguity is followed by one read-only exact-state reconciliation and never blind resubmission. A pre-existing replacement stops before mutation. Wrong initial Preview state stops and is never repaired by toggle or automatic recreation.

## Workflow and credentials

`.github/workflows/api-football-replacement-inactive-foundation.yml` is manual, first-attempt-only, exact-current-main and exact-head-Verify gated. Admission and final reconciliation use `data-steward-readonly`. Protected execution uses future environment `api-football-replacement-foundation` with distinct credentials:

- `CLOUDFLARE_REPLACEMENT_READ_TOKEN`: read-only Worker inventory/version metadata;
- `CLOUDFLARE_REPLACEMENT_MUTATION_TOKEN`: short-lived, account-scoped credential restricted operationally to replacement Worker create/upload/subdomain-disable endpoints;
- existing API-Football and attended-trigger secret values for Version `secret_text` bindings only.

The repository adapter independently enforces exact method/path/body ceilings even if Cloudflare cannot express name-scoped token permissions. No credential/environment provisioning occurs in this checkpoint.

## Independent final reconciliation

Final read-only reconciliation must prove:

- original collector retains exact ID and three Versions;
- original workers.dev/Preview remain disabled;
- original Deployments/Cron/routes/domains remain zero;
- collection is disabled, credential `AVAILABLE`, no lease and zero request/generation/fixture history;
- replacement has exactly one byte-proved Version;
- replacement workers.dev/Preview are disabled;
- replacement Deployments/Cron/routes/domains are zero;
- execution retained zero provider, D1, Access and production-topology mutations.

No live workflow dispatch is authorized by this repository candidate or its eventual merge.
