// src/providers/registry.mjs — provider quality is six separate attributes
// (adjustment 2), not one vague "reliability". Static descriptors reflect the
// audit; dynamic health reflects runtime observation.
const scale = ['low','medium','high']; // documentation of the vocabulary

export const PROVIDER_QUALITY = {
  fpl: {
    dataAuthority:'high',            // primary source of truth for the game itself
    transportAvailability:'medium',  // no CORS → public-relay dependent until serverless
    schemaStability:'medium',        // undocumented; drifts between seasons
    freshness:'high',                // near-live during gameweeks
    historicalReproducibility:'low', // API is current-state only; history via archive
    licensingConfidence:'medium'     // unofficial but universally tolerated
  },
  understat: {
    dataAuthority:'medium', transportAvailability:'low', schemaStability:'low',
    freshness:'medium', historicalReproducibility:'medium', licensingConfidence:'low'
  },
  odds: {
    dataAuthority:'high', transportAvailability:'high', schemaStability:'high',
    freshness:'high', historicalReproducibility:'low',   // no free historical odds
    licensingConfidence:'high'
  },
  archive: { // vaastav historical dataset
    dataAuthority:'medium', transportAvailability:'high', schemaStability:'medium',
    freshness:'low', historicalReproducibility:'medium', // un-pinned master; pin = high
    licensingConfidence:'high'
  }
};

const health = {}; // name → {ok, note, at, usingFallback}
export function markHealth(name, ok, note = '', usingFallback = false){
  health[name] = { ok, note, at: Date.now(), usingFallback };
}
export function getHealth(name){ return health[name] || null; }
export function healthSummary(){
  return Object.entries(health).map(([n,h]) =>
    `${n}: ${h.ok ? (h.usingFallback ? 'fallback' : 'live') : 'down'}${h.note ? ' — ' + h.note : ''}`);
}
