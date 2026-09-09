// DATA-OPS-A1.4 — the closed set of reason codes the watchdog may ever report.
//
// Nothing outside this list can leave the watchdog as a reason. That is what keeps a provider
// body, a GitHub error message, a stack trace or a raw log line from ever reaching persisted
// state or an owner email: every decision point in this package selects one of these fixed
// strings, never a caught error's own text.
//
// A1.4 does not invent a new operational-state vocabulary. Where an A1.2/A1.3 reason already
// describes the fact precisely (for example `SENTINEL_EVIDENCE_UNAVAILABLE`), the watchdog may
// carry it through unchanged as informational context; the codes below are the ones specific to
// watchdog-only concerns — heartbeat freshness and the bounded evidence read that feeds it.
import {deepFreeze} from '../../../src/decision-intelligence/canonical.mjs';

export const WATCHDOG_REASON_CODES=deepFreeze([
  'OBSERVER_HEARTBEAT_HEALTHY',
  'OBSERVER_HEARTBEAT_STALE',
  'OBSERVER_HEARTBEAT_MISSING',
  'OBSERVER_HEARTBEAT_INCOMPLETE',
  'OBSERVER_JOB_SKIPPED',
  'OBSERVER_JOB_FAILED',
  'OBSERVER_SUMMARY_INVALID',
  'GITHUB_EVIDENCE_UNAVAILABLE',
  'GITHUB_READ_BOUND_EXHAUSTED'
]);

// The closed problem taxonomy an incident fingerprint may be built over. Each entry is a fixed
// pair the watchdog itself defines; nothing dynamic — no provider text, no reason code, no run id
// — is ever added to this set at runtime, and no caller can register a new one.
export const WATCHDOG_PROBLEMS=deepFreeze({
  OBSERVER_HEARTBEAT:Object.freeze({problemClass:'OBSERVER_HEARTBEAT',component:'data_steward_readonly_observer'}),
  GITHUB_EVIDENCE:Object.freeze({problemClass:'GITHUB_EVIDENCE',component:'data_steward_readonly_observer'})
});

export const isWatchdogReasonCode=value=>WATCHDOG_REASON_CODES.includes(value);
