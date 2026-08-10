import { readFileSync, writeFileSync } from 'node:fs';

function replaceExact(path, from, to){
  const source=readFileSync(path,'utf8');
  const count=source.split(from).length-1;
  if(count!==1) throw new Error(`${path}: expected exactly one probe replacement, found ${count}`);
  writeFileSync(path,source.replace(from,to));
}

replaceExact('src/state.mjs',
`import { normaliseFixtures, validateBootstrap, hasFatal } from './providers/validate.mjs';\n\nconst S = {`,
`import { normaliseFixtures, validateBootstrap, hasFatal } from './providers/validate.mjs';\n\n/* Shared cross-module state inventory.\n\n   Declaring a slot here does not make state.mjs its semantic owner. Domain\n   modules still own the values they write (providers, calibration,\n   Mini-Leagues, and so on). This object is only the explicit inventory of\n   mutable values intentionally shared through S; tests reject undeclared\n   direct S.<key> usage so lifecycle ownership cannot silently expand. */\nconst S = {`);
replaceExact('src/state.mjs',`  teams:{}, byId:{}, posName:{}, avg:null,`,`  teams:{}, byId:{}, posName:{}, posFull:{}, avg:null,`);
replaceExact('src/state.mjs',
`  providerApplied:{understat:null, odds:null},\n  __accountKeys:{entry:null,picks:null,history:null},\n  lastOptimiser:null\n};`,
`  providerApplied:{understat:null, odds:null},\n  __accountKeys:{entry:null,picks:null,history:null},\n  lastOptimiser:null,\n\n  // Supporting-provider runtime slices. providers/* remains their owner.\n  ustat:null, ustatNote:'', odds:null, oddsNote:'',\n  // Historical calibration/backtest runtime mirrors. model/backtest.mjs owns\n  // their lifecycle; verified browser persistence remains owned by storage.mjs.\n  calib:null, backtest:null,\n  // Mini-League preferences are owned by mini-leagues-state.mjs; fetched\n  // standings/rival/exposure session data is owned by mini-leagues-view.mjs.\n  miniLeagues:null, leagues:[], miniLeagueData:null\n};\nconst SHARED_STATE_KEYS = Object.freeze(Object.keys(S));`);
replaceExact('src/state.mjs',`  S, KEEP, TEAM_STRENGTH_FIELDS, validTeamStrength, teamStrengthsValid,`,`  S, SHARED_STATE_KEYS, KEEP, TEAM_STRENGTH_FIELDS, validTeamStrength, teamStrengthsValid,`);

replaceExact('src/ui/mini-leagues-state.mjs',
`function syncMiniLeagueAlias(){ S.leagues=S.miniLeagues.saved; }`,
`\n/* \`S.miniLeagues\` is the only writable runtime preference representation.\n   \`S.leagues\` remains as a read-only compatibility bridge for legacy readers;\n   assigning to it cannot replace canonical preferences after initialisation. */\nfunction installMiniLeagueAlias(){\n  Object.defineProperty(S,'leagues',{\n    enumerable:true,\n    configurable:true,\n    get(){ return Array.isArray(S.miniLeagues?.saved) ? S.miniLeagues.saved : []; },\n    set(){ /* legacy compatibility writes are intentionally ignored */ }\n  });\n}\nfunction syncMiniLeagueAlias(){ return S.leagues; }`);
replaceExact('src/ui/mini-leagues-state.mjs',
`S.miniLeagues=emptyMiniLeagueState();\nS.leagues=[];`,
`S.miniLeagues=emptyMiniLeagueState();\ninstallMiniLeagueAlias();`);

console.log('Applied A3 state-ownership source probe to runner workspace');
