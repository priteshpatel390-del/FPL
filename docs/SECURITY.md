# SECURITY.md
Purpose: security posture record. Audience: all sessions; Stage 3 implementers especially.
Last updated: 2026-07-28. Related: STAGE3-DESIGN.md (authoritative current design — §§1–8),
KNOWN_LIMITATIONS (SEC-2/SEC-3/CSP-1/XSS-1/VAL-1/FRAME-1), DECISIONS D-06/D-07/D-08, AUDIT §3.

## Current architecture (Stage 3 in progress)
Static single file on GitHub Pages. SEC-1 enforced: odds key direct-only, never relayed (tested).
Persistence: localStorage/window.storage wrapper. No serverless component. Relays carry only
key-free FPL/Understat traffic. SEC-3 is closed: no Anthropic key field, persistence or keyed
browser request exists; a one-time migration deletes any legacy stored value. Hosted Ask fails
before network access, while Claude artifact preview retains the approved keyless path.

## Known risks & mitigations
- API/provider/user-string XSS (XSS-1) is closed by the Stage 3.5 DOM-builder rewrite. Dynamic
  values across the approved inventory are text nodes; five adversarial tests cover representative
  player, team, entry, league and provider payloads. Ask remains at its Stage 3.4 baseline pending
  the separately designed Stage 3.6 AI/Markdown sanitisation work.
- No CSP (CSP-1) → Stage 3 hash-based policy; documented narrow concession style-src-attr
  'unsafe-inline' until Stage 9; frame-ancestors ineffective on Pages (FRAME-1) → frame-buster now,
  real header at serverless.
- Schema drift / malformed providers (VAL-1) → closed by D-14 per-endpoint validation; fatal
  payloads are rejected atomically, partial rows degrade safely, and issue metadata carries no raw
  payloads or keyed URLs.
- Secrets: Anthropic client-side BANNED (D-08; field/keyed path removed and legacy stored value wiped); odds
  key accepted-temporary → never logged, scrub() on all outbound strings, "Forget API key" action,
  absent from manifest/BUILD_INFO (verified).
- Retry policy (D-15): transient-only with per-provider attempt and elapsed-time ceilings, capped
  exponential half-jitter, and one relay cascade per attempt. Odds 401/429 and schema/parse failures
  are permanent; odds-via-relay remains structurally impossible.
- Health monitoring: seven states (Live/Cached/Stale/Fallback/Partial/Disabled/Unavailable) with
  age + consequence lines; Disabled is user choice, never styled as failure.

## Deferred (with triggers)
Serverless proxies, env-var secrets, origin checks, server rate limiting, real headers → triggered
by hosted-AI requirement (D-08). Until then STAGE3-DESIGN §1 defines the /api/<provider> switch
points so migration touches no model/UI code.
