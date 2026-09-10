// DATA-OPS A1.4 — closed reason-code set for owner-visible/runtime outcomes.
import {deepFreeze} from './canonical.mjs';

export const WATCHDOG_REASON_CODES=deepFreeze([
  // Schedule-aware heartbeat over the single 04:17 UTC automatic observer opportunity.
  'OBSERVER_HEARTBEAT_HEALTHY',
  'OBSERVER_HEARTBEAT_PENDING',
  'OBSERVER_HEARTBEAT_MISSING',
  'OBSERVER_HEARTBEAT_INCOMPLETE',
  'OBSERVER_JOB_SKIPPED',
  'OBSERVER_JOB_FAILED',
  'OBSERVER_SUMMARY_INVALID',
  'OBSERVER_SUMMARY_UNHEALTHY',
  'OBSERVER_SUMMARY_CONTRADICTORY',
  'OBSERVER_SUMMARY_NOT_EVALUATED',
  'OBSERVER_OPPORTUNITY_ATTRIBUTION_AMBIGUOUS',
  'GITHUB_EVIDENCE_UNAVAILABLE',
  'GITHUB_READ_BOUND_EXHAUSTED',
  // Watchdog-runtime-only outcomes, never persisted as incident reasons.
  'WATCHDOG_DUPLICATE_SCHEDULED_EVENT',
  'WATCHDOG_ENVIRONMENT_INCOMPLETE',
  'WATCHDOG_CLOCK_DB_UNAVAILABLE',
  'WATCHDOG_CLOCK_RECEIPT_INVALID',
  'WATCHDOG_TRUSTED_ATTRIBUTION_CONFLICT',
  'WATCHDOG_EXECUTION_FAILED'
]);

export const WATCHDOG_PROBLEMS=deepFreeze({
  OBSERVER_HEARTBEAT:Object.freeze({problemClass:'OBSERVER_HEARTBEAT',component:'data_steward_readonly_observer'}),
  GITHUB_EVIDENCE:Object.freeze({problemClass:'GITHUB_EVIDENCE',component:'data_steward_readonly_observer'})
});

export const isWatchdogReasonCode=value=>WATCHDOG_REASON_CODES.includes(value);
