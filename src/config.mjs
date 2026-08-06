// Season-specific rules and model configuration.
const FPL_RULES = Object.freeze({
  season:'2026-27',
  appearance:Object.freeze({any:1,sixtyMinutes:1}),
  goals:Object.freeze({1:6,2:6,3:5,4:4}),
  assists:3,
  cleanSheets:Object.freeze({1:4,2:4,3:1,4:0}),
  saves:Object.freeze({groupSize:3,pointsPerGroup:1}),
  goalsConceded:Object.freeze({positions:Object.freeze([1,2]),groupSize:2,pointsPerGroup:-1}),
  defensiveContribution:Object.freeze({thresholds:Object.freeze({2:10,3:12,4:12}),points:2,maximum:2}),
  cards:Object.freeze({yellow:-1,red:-3}),
  ownGoal:-2,
  penaltyMiss:-2,
  penaltySave:5,
  bonus:Object.freeze([3,2,1])
});

const GOAL_PTS   = FPL_RULES.goals;
const CS_PTS     = FPL_RULES.cleanSheets;
const ASSIST_PTS = FPL_RULES.assists;
const DC_THRESH  = FPL_RULES.defensiveContribution.thresholds;
const BASE_GOALS = 1.42;
const HOME_TILT  = 1.10;

export const SCHEMA_VERSION = 3;
export const MODEL_VERSION  = '2.4.0';
export const RULES_VERSION  = '2026-27.3';

export const MINUTES_RULES = Object.freeze({
  detailedCohort:80,
  historyWindow:8,
  recencyDecay:0.90,
  priorMatches:4,
  prior:{pStart:0.50,pAppear:0.70,p60:0.40,expMin:45,confidence:0.20},
  confidence:{high:0.75,medium:0.45},
  cacheMaxAgeMs:7 * 24 * 60 * 60 * 1000
});

export const SCORING_RULES = Object.freeze({
  rareEventPriorMatches:10,
  bonusPriorAppearances:8,
  minimumExposure90:0.5,
  penaltyRoleOrders:Object.freeze([1,2])
});

export const TRANSFER_RULES = Object.freeze({
  maxTransfers:3,
  maxFreeTransfers:5,
  pointsPerPaidTransfer:4,
  rollValue:0.5,
  squadBudget:1000,
  maxPerClub:3,
  positionQuotas:Object.freeze({1:2,2:5,3:5,4:3}),
  unavailableStatuses:Object.freeze(['i','u','s','n']),
  maxHorizon:8,
  maxEvaluations:2000000
});

export const SIMULATION_RULES = Object.freeze({
  version:'1.0.0',
  productionSamples:5000,
  maxSamples:25000,
  blankMaximum:2,
  returnMinimum:5,
  haulMinimum:10,
  megaHaulMinimum:15,
  floorPercentile:0.25,
  upsidePercentile:0.90,
  preSeasonMode:'disabled'
});

// Adjustment-5 market rules — configuration remains unvalidated until Stage 7.
export const ODDS_RULES = {
  minH2hBooks: 2,
  minTotalsBooks: 1,
  outlierProbDeviation: 0.15,
  maxQuoteAgeHours: 24,
  kickoffMatchWindowHours: 72,
  lowConfidenceBooks: 3
};

export { FPL_RULES, GOAL_PTS, CS_PTS, ASSIST_PTS, DC_THRESH, BASE_GOALS, HOME_TILT };
