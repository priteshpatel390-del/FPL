# GW1-P2C3B — Same-site Transport Closeout

Status: **PHYSICAL BROWSER TRANSPORT ACCEPTANCE — PASS**  
Recorded: 22 August 2026  
Decision: `D-GW1P2C3B`

## Decision and scope

GW1-P2C3B closes only the physical browser transport gate for the sibling-domain route:

`https://app.fpltsheet.co.uk` → `https://archive.fpltsheet.co.uk`

This record changes no application behaviour, evidence-delivery source, Worker implementation or configuration, Cloudflare/DNS/Access/D1/R2/Pages state, provider, model, projection, fixture, expected-minutes, squad, captaincy, transfer, simulation, rank or Mini-League behaviour. The repository change normalizes `CNAME` to the existing hostname with exactly one trailing LF and reconciles documentation with already-completed physical evidence.

## Sanitized physical acceptance evidence

The owner performed the accepted invocation on a real physical iPhone using normal Safari with **Prevent Cross-Site Tracking ON** and an authenticated Cloudflare Access session. The deliberately invalid, non-Stage10 request body was `{}`. Correlation marker `6a399dfe4cfc` connected the matching requests without retaining raw logs.

Observed OPTIONS:

- `Origin: https://app.fpltsheet.co.uk`
- requested method `POST`
- requested header `content-type`
- `Sec-Fetch-Mode: cors`
- `Sec-Fetch-Site: same-site`
- Worker response 204

Observed matching POST:

- `Origin: https://app.fpltsheet.co.uk`
- `Content-Type: application/json`
- `Sec-Fetch-Mode: cors`
- `Sec-Fetch-Site: same-site`
- Worker response 422

Safari could read the response:

```text
status: 422
type: cors
body: {"error":"envelope_schema"}
```

The directly observed `same-site` classification, successful preflight, matching POST arrival and readable validation response establish **GW1-P2C3B physical same-site browser transport acceptance: PASS**.

## Mandatory acceptance boundary

The invalid `{}` body was chosen to test transport without performing a genuine Stage 10 operation. Therefore this acceptance does **not** prove:

- genuine Stage 10 evidence custody or valid evidence archival;
- D1 receipt or manifest creation;
- R2 object creation;
- genuine end-to-end persistence;
- genuine idempotency or duplicate genuine-evidence handling;
- any model, projection, expected-minutes, fixture, captaincy, squad, transfer, simulation, rank or Mini-League correctness.

The physical invocation logs did not directly capture the literal returned values of `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials` or `Vary`; this record does not claim otherwise.

## Security and privacy

Only the sanitized facts above are retained. This record contains no IP address, precise location, postcode, coordinates, ISP/network or ASN data, Access JWT, cookie, authenticated email, Access audience, account identifier, authorization header, TLS random/fingerprint data, raw Worker log JSON, secret or token.

## Rollback retention

This closeout intentionally retains:

- migration-period allowlisting for `https://priteshpatel390-del.github.io`;
- `https://teamsheet-evidence-archive.fpltsheet.workers.dev`;
- Cloudflare Access protection on that legacy archive hostname;
- existing rollback deployments and versions.

Rollback cleanup requires a separate future checkpoint.
