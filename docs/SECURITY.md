# SECURITY.md
Purpose: security posture record. Audience: all sessions; Stage 3 implementers especially.
Last updated: 2026-07-26. Related: STAGE3-DESIGN.md (authoritative current design — §§1–8),
KNOWN_LIMITATIONS (SEC-2/SEC-3/CSP-1/XSS-1/VAL-1/FRAME-1), DECISIONS D-06/D-07/D-08, AUDIT §3.

## Current architecture (deployed build, pre-Stage-3)
Static single file on GitHub Pages. SEC-1 enforced: odds key direct-only, never relayed (tested).
Persistence: localStorage/window.storage wrapper. No serverless component. Relays carry only
key-free FPL/Understat traffic. Frontend Anthropic key field still present (SEC-3 — removal is
Stage 3's first task).

## Known risks & mitigations
- XSS via API/user strings in innerHTML (XSS-1) → Stage 3 DOM-builder rewrite per inventory in
  STAGE3-DESIGN §5; AI output gets its own escape-first restricted-Markdown pipeline + adversarial
  battery.
- No CSP (CSP-1) → Stage 3 hash-based policy; documented narrow concession style-src-attr
  'unsafe-inline' until Stage 9; frame-ancestors ineffective on Pages (FRAME-1) → frame-buster now,
  real header at serverless.
- Schema drift / malformed providers (VAL-1) → Stage 3 per-endpoint validation, fatal vs degraded
  vs unknown-field classes, no raw payloads or keyed URLs in errors.
- Secrets: Anthropic client-side BANNED (D-08; Stage 3 deletes field + wipes stored value); odds
  key accepted-temporary → never logged, scrub() on all outbound strings, "Forget API key" action,
  absent from manifest/BUILD_INFO (verified).
- Retry policy (Stage 3): transient-only (timeout/network/429 w. Retry-After/5xx), exponential
  backoff + full jitter, max 3, relay cascade = one attempt; never retry auth/schema failures;
  odds-via-relay structurally impossible.
- Health monitoring: seven states (Live/Cached/Stale/Fallback/Partial/Disabled/Unavailable) with
  age + consequence lines; Disabled is user choice, never styled as failure.

## Deferred (with triggers)
Serverless proxies, env-var secrets, origin checks, server rate limiting, real headers → triggered
by hosted-AI requirement (D-08). Until then STAGE3-DESIGN §1 defines the /api/<provider> switch
points so migration touches no model/UI code.
