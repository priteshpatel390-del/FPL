// Season-specific rules and model configuration (Stage 2: values verbatim from
// the monolith; Stage 5 moves the full FPL rulebook here).
const GOAL_PTS   = {1:6, 2:6, 3:5, 4:4};
const CS_PTS     = {1:4, 2:4, 3:1, 4:0};
const ASSIST_PTS = 3;
const DC_THRESH  = {2:10, 3:12, 4:12};      // defensive contribution thresholds
const BASE_GOALS = 1.42;                     // league average goals per team per game
const HOME_TILT  = 1.10;

export const SCHEMA_VERSION = 2;          // cache envelope; bump invalidates cached snapshots
export const MODEL_VERSION  = '2.0.0';    // projection engine
export const RULES_VERSION  = '2025-26.1';// FPL scoring rules encoded

// Adjustment-5 market rules — DEFINED here before any formula change (Stage 5+
// may consume more of these; today they gate inclusion/staleness only).
export const ODDS_RULES = {
  minH2hBooks: 2,            // events with fewer h2h books are skipped (thin market)
  minTotalsBooks: 1,
  outlierProbDeviation: 0.15,// drop books whose devigged prob deviates >15% from median
  maxQuoteAgeHours: 24,      // bookmaker last_update older than this is stale → excluded
  kickoffMatchWindowHours: 72,// fixture↔event matching tolerance
  lowConfidenceBooks: 3      // below this many books, mark confidence 'low'
};

export { GOAL_PTS, CS_PTS, ASSIST_PTS, DC_THRESH, BASE_GOALS, HOME_TILT };
