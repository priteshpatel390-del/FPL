// DATA-OPS-A1.4 — the closed set of reason codes the watchdog may ever report.
//
// Nothing outside this list can leave the watchdog as a reason. That is what keeps a provider
// body, a GitHub error message, a stack trace or a raw log line from ever reaching persisted
// state or an owner email: every decision point in this package selects one of these fixed
// strings, never a caught error's own text.
import {deepFreeze} from './canonical.mjs';

export const WATCHDOG_REASON_CODES=deepFreeze([
  // Schedule-aware heartbeat over A1.3's own two declared opportunities (04:17, 08:17 UTC).
  'OBSERVER_HEARTBEAT_HEALTHY',
  'OBSERVER_HEARTBEAT_PENDING',
  'OBSERVER_HEARTBEAT_MISSING',
  'OBSERVER_HEARTBEAT_INCOMPLETE',
  // First-class execution-outcome evidence for one expected opportunity.
  'OBSERVER_JOB_SKIPPED',
  'OBSERVER_JOB_FAILED',
  // Semantic contract over A1.3's sanitized summary line, not merely its JSON shape.
  'OBSERVER_SUMMARY_INVALID',
  'OBSERVER_SUMMARY_UNHEALTHY',
  'OBSERVER_SUMMARY_CONTRADICTORY',
  'OBSERVER_SUMMARY_NOT_EVALUATED',
  // Bounded GitHub evidence read, as its own independent problem.
  'GITHUB_EVIDENCE_UNAVAILABLE',
  'GITHUB_READ_BOUND_EXHAUSTED',
  // Watchdog-runtime-only outcomes, never persisted as an incident reason.
  'WATCHDOG_DUPLICATE_SCHEDULED_EVENT',
  'WATCHDOG_ENVIRONMENT_INCOMPLETE',
  'WATCHDOG_EXECUTION_FAILED'
]);

// The closed problem taxonomy an incident fingerprint may be built over. Each entry is a fixed
// pair the watchdog itself defines; nothing dynamic — no provider text, no reason code, no run id
// — is ever added to this set at runtime, and no caller can register a new one.
export const WATCHDOG_PROBLEMS=deepFreeze({
  OBSERVER_HEARTBEAT:Object.freeze({problemClass:'OBSERVER_HEARTBEAT',component:'data_steward_readonly_observer'}),
  GITHUB_EVIDENCE:Object.freeze({problemClass:'GITHUB_EVIDENCE',component:'data_steward_readonly_observer'})
});

export const isWatchdogReasonCode=value=>WATCHDOG_REASON_CODES.includes(value);
