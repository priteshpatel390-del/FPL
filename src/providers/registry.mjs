// src/providers/registry.mjs — static provider quality plus runtime health.
// D-16: runtime state is deliberately descriptive rather than a synthetic
// score. The seven states tell the owner what data is actually being used and
// what consequence follows when a provider is degraded.
const scale = ['low','medium','high']; // documentation of the vocabulary

export const APPROVED_PROVIDER_NAMES = Object.freeze(['fpl','understat','odds','archive']);
export const APPROVED_PROVIDER_SOURCES = Object.freeze({
  fpl:Object.freeze({label:'Official FPL',authority:'official',purpose:'players, teams, fixtures, deadlines, squads and outcomes'}),
  understat:Object.freeze({label:'Understat',authority:'approved_secondary',purpose:'team-level rolling xG only'}),
  odds:Object.freeze({label:'The Odds API',authority:'approved_secondary',purpose:'validated EPL market context'}),
  archive:Object.freeze({label:'Teamsheet archive',authority:'approved_archive',purpose:'versioned historical replay and calibration inputs'})
});

export const PROVIDER_QUALITY = {
  fpl: {
    dataAuthority:'high',
    transportAvailability:'medium',
    schemaStability:'medium',
    freshness:'high',
    historicalReproducibility:'low',
    licensingConfidence:'medium'
  },
  understat: {
    dataAuthority:'medium', transportAvailability:'low', schemaStability:'low',
    freshness:'medium', historicalReproducibility:'medium', licensingConfidence:'low'
  },
  odds: {
    dataAuthority:'high', transportAvailability:'high', schemaStability:'high',
    freshness:'high', historicalReproducibility:'low',
    licensingConfidence:'high'
  },
  archive: {
    dataAuthority:'medium', transportAvailability:'high', schemaStability:'medium',
    freshness:'low', historicalReproducibility:'medium',
    licensingConfidence:'high'
  }
};

export const HEALTH_STATES = Object.freeze({
  LIVE:'Live', CACHED:'Cached', STALE:'Stale', FALLBACK:'Fallback',
  PARTIAL:'Partial', DISABLED:'Disabled', UNAVAILABLE:'Unavailable'
});

export const HEALTH_THRESHOLDS_MS = Object.freeze({
  fplLive:30 * 60 * 1000,
  fplOther:6 * 60 * 60 * 1000,
  understat:24 * 60 * 60 * 1000,
  odds:6 * 60 * 60 * 1000,
  archive:30 * 24 * 60 * 60 * 1000
});

const health = {};

function thresholdFor(name, context = {}){
  if(name === 'fpl') return context.seasonLive ? HEALTH_THRESHOLDS_MS.fplLive : HEALTH_THRESHOLDS_MS.fplOther;
  return HEALTH_THRESHOLDS_MS[name] || HEALTH_THRESHOLDS_MS.fplOther;
}

function setHealth(name, state, {note='', consequence='', lastSuccess=null, at=Date.now(), detail=null} = {}){
  if(!APPROVED_PROVIDER_NAMES.includes(name)) throw new Error(`Provider ${name} is not approved`);
  const previous = health[name] || {};
  const usingFallback = state === HEALTH_STATES.FALLBACK;
  const ok = [HEALTH_STATES.LIVE, HEALTH_STATES.CACHED, HEALTH_STATES.STALE,
    HEALTH_STATES.PARTIAL, HEALTH_STATES.DISABLED].includes(state);
  health[name] = {
    provider:name,
    state,
    note,
    consequence,
    lastSuccess:lastSuccess ?? previous.lastSuccess ?? null,
    at,
    detail:detail || null,
    // Stage-2 compatibility fields. They are derived from the richer state and
    // retained so existing callers/tests do not need a breaking migration.
    ok,
    usingFallback
  };
  return health[name];
}

function markLive(name, note = '', consequence = '', at = Date.now()){
  return setHealth(name, HEALTH_STATES.LIVE, {note, consequence, lastSuccess:at, at});
}
function markCached(name, lastSuccess, note = '', consequence = ''){
  return setHealth(name, HEALTH_STATES.CACHED, {note, consequence, lastSuccess, at:Date.now()});
}
function markFallback(name, note = '', consequence = ''){
  return setHealth(name, HEALTH_STATES.FALLBACK, {note, consequence});
}
function markPartial(name, note = '', consequence = '', lastSuccess = Date.now()){
  return setHealth(name, HEALTH_STATES.PARTIAL, {note, consequence, lastSuccess});
}
function markDisabled(name, note = 'turned off in settings', consequence = ''){
  return setHealth(name, HEALTH_STATES.DISABLED, {note, consequence});
}
function markUnavailable(name, note = '', consequence = ''){
  return setHealth(name, HEALTH_STATES.UNAVAILABLE, {note, consequence});
}

// Compatibility surface for Stage-2 callers. New code should use the explicit
// functions above so Disabled, Partial and Cached are never collapsed into a
// boolean failure.
export function markHealth(name, ok, note = '', usingFallback = false){
  if(usingFallback) return markFallback(name, note);
  return ok ? markLive(name, note) : markUnavailable(name, note);
}

export function refreshStaleness(name, context = {}, now = Date.now()){
  const h = health[name];
  if(!h || !h.lastSuccess) return h || null;
  if([HEALTH_STATES.DISABLED, HEALTH_STATES.FALLBACK, HEALTH_STATES.UNAVAILABLE].includes(h.state)) return h;
  const age = now - h.lastSuccess;
  if(age > thresholdFor(name, context)){
    return setHealth(name, HEALTH_STATES.STALE, {
      note:h.note,
      consequence:h.consequence,
      lastSuccess:h.lastSuccess,
      at:now,
      detail:h.detail
    });
  }
  return h;
}

export function getHealth(name, context = {}, now = Date.now()){
  return refreshStaleness(name, context, now) || null;
}

export function healthRows(context = {}, now = Date.now()){
  return APPROVED_PROVIDER_NAMES
    .map(name => getHealth(name, context, now))
    .filter(Boolean)
    .map(h => ({...h, ageMs:h.lastSuccess ? Math.max(0, now - h.lastSuccess) : null, thresholdMs:thresholdFor(h.provider,context)}));
}


export function providerTrustError(rows, {requireAll=true} = {}){
  if(!Array.isArray(rows)) return 'provider_schema';
  const allowedStates = new Set(Object.values(HEALTH_STATES));
  const seen = new Set();
  for(const row of rows){
    const name = row?.provider;
    if(!APPROVED_PROVIDER_NAMES.includes(name)) return 'provider_unapproved';
    if(seen.has(name)) return 'provider_duplicate';
    seen.add(name);
    if(!allowedStates.has(row?.state)) return 'provider_state';
    if(typeof row?.included !== 'boolean' || typeof row?.didAffectModel !== 'boolean') return 'provider_usage';
    if(row.didAffectModel !== row.included) return 'provider_usage';
    if(!Number.isInteger(row?.acceptedRecordCount) || row.acceptedRecordCount < 0) return 'provider_counts';
    if(!Number.isInteger(row?.rejectedRecordCount) || row.rejectedRecordCount < 0) return 'provider_counts';
    for(const key of ['recordedAt','lastSuccessAt']){
      if(row?.[key] !== null && !Number.isFinite(Date.parse(row?.[key]))) return 'provider_time';
    }
  }
  if(requireAll && (seen.size !== APPROVED_PROVIDER_NAMES.length || APPROVED_PROVIDER_NAMES.some(name=>!seen.has(name)))) return 'provider_missing';
  return null;
}

export function healthSummary(context = {}, now = Date.now()){
  return healthRows(context, now).map(h =>
    `${h.provider}: ${h.state}${h.note ? ' — ' + h.note : ''}${h.consequence ? ' · ' + h.consequence : ''}`);
}

export function resetHealth(){ Object.keys(health).forEach(k => delete health[k]); }

export { setHealth, markLive, markCached, markFallback, markPartial, markDisabled, markUnavailable, thresholdFor };
