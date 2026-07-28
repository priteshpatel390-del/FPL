// Stage 9.2 — visual-only pitch layout and repository-owned shirt palettes.
// No squad selection, projection or captaincy rule lives in this module.

const TEAM_PITCH_VISUAL_ORDER = Object.freeze([4, 3, 2, 1]);
const TEAM_PITCH_PATTERNS = Object.freeze(['solid','sleeves','stripes','halves','hoops','sash','pinstripes']);
const TEAM_PITCH_PRESETS = Object.freeze({
  ARS:{primary:'#D71920',secondary:'#FFFFFF',accent:'#162A4C',ink:'#FFFFFF',pattern:'sleeves'},
  AVL:{primary:'#6A1735',secondary:'#9ED8F5',accent:'#F5D36A',ink:'#FFFFFF',pattern:'sleeves'},
  BOU:{primary:'#D71920',secondary:'#121212',accent:'#FFFFFF',ink:'#FFFFFF',pattern:'stripes'},
  BRE:{primary:'#D71920',secondary:'#FFFFFF',accent:'#111111',ink:'#111111',pattern:'stripes'},
  BHA:{primary:'#1764B0',secondary:'#FFFFFF',accent:'#F4D35E',ink:'#111111',pattern:'stripes'},
  BUR:{primary:'#6A1735',secondary:'#9ED8F5',accent:'#FFFFFF',ink:'#FFFFFF',pattern:'sleeves'},
  CHE:{primary:'#1746A2',secondary:'#1746A2',accent:'#FFFFFF',ink:'#FFFFFF',pattern:'solid'},
  CRY:{primary:'#D71920',secondary:'#1746A2',accent:'#F4D35E',ink:'#FFFFFF',pattern:'stripes'},
  EVE:{primary:'#1746A2',secondary:'#FFFFFF',accent:'#102B5C',ink:'#FFFFFF',pattern:'solid'},
  FUL:{primary:'#FFFFFF',secondary:'#111111',accent:'#D71920',ink:'#111111',pattern:'solid'},
  LEE:{primary:'#FFFFFF',secondary:'#1746A2',accent:'#F4D35E',ink:'#111111',pattern:'solid'},
  LIV:{primary:'#B30D2F',secondary:'#B30D2F',accent:'#F4D35E',ink:'#FFFFFF',pattern:'solid'},
  MCI:{primary:'#7CC7EC',secondary:'#7CC7EC',accent:'#162A4C',ink:'#162A4C',pattern:'solid'},
  MUN:{primary:'#D71920',secondary:'#111111',accent:'#FFFFFF',ink:'#FFFFFF',pattern:'solid'},
  NEW:{primary:'#111111',secondary:'#FFFFFF',accent:'#3D7DB8',ink:'#FFFFFF',pattern:'stripes'},
  NFO:{primary:'#D71920',secondary:'#D71920',accent:'#FFFFFF',ink:'#FFFFFF',pattern:'solid'},
  SUN:{primary:'#D71920',secondary:'#FFFFFF',accent:'#111111',ink:'#111111',pattern:'stripes'},
  TOT:{primary:'#FFFFFF',secondary:'#162A4C',accent:'#F4D35E',ink:'#162A4C',pattern:'solid'},
  WHU:{primary:'#6A1735',secondary:'#9ED8F5',accent:'#FFFFFF',ink:'#FFFFFF',pattern:'sleeves'},
  WOL:{primary:'#F2A900',secondary:'#111111',accent:'#FFFFFF',ink:'#111111',pattern:'solid'},
  LEI:{primary:'#1746A2',secondary:'#FFFFFF',accent:'#F4D35E',ink:'#FFFFFF',pattern:'solid'},
  IPS:{primary:'#1746A2',secondary:'#FFFFFF',accent:'#D71920',ink:'#FFFFFF',pattern:'stripes'},
  SOU:{primary:'#D71920',secondary:'#FFFFFF',accent:'#111111',ink:'#111111',pattern:'stripes'}
});
const TEAM_PITCH_FALLBACKS = Object.freeze([
  {primary:'#315C8C',secondary:'#FFFFFF',accent:'#E6B84A',ink:'#FFFFFF',pattern:'solid'},
  {primary:'#7A1E38',secondary:'#D8EEF8',accent:'#FFFFFF',ink:'#FFFFFF',pattern:'sleeves'},
  {primary:'#1F5C3A',secondary:'#FFFFFF',accent:'#E6B84A',ink:'#FFFFFF',pattern:'halves'},
  {primary:'#20262B',secondary:'#F0C24B',accent:'#FFFFFF',ink:'#FFFFFF',pattern:'sash'},
  {primary:'#6C4BA6',secondary:'#FFFFFF',accent:'#A7E0D1',ink:'#FFFFFF',pattern:'pinstripes'},
  {primary:'#A13A2A',secondary:'#F5E7D4',accent:'#152A40',ink:'#FFFFFF',pattern:'hoops'}
]);

function teamPitchNormaliseCode(team){
  return String(team?.short_name || team?.name || '')
    .toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,3) || 'CLB';
}

function teamPitchPalette(team){
  const code = teamPitchNormaliseCode(team);
  const preset = TEAM_PITCH_PRESETS[code];
  if(preset) return {code, ...preset};
  let seed = Number(team?.id) || 0;
  for(const ch of code) seed = ((seed * 31) + ch.charCodeAt(0)) >>> 0;
  return {code, ...TEAM_PITCH_FALLBACKS[seed % TEAM_PITCH_FALLBACKS.length]};
}

function teamPitchLines(starters){
  const source = Array.isArray(starters) ? starters : [];
  return TEAM_PITCH_VISUAL_ORDER.map(position => ({
    position,
    players: source.filter(slot => Number(slot?.p?.element_type) === position)
  })).filter(line => line.players.length);
}

function teamPitchCaptaincy(ranked){
  const ids = [];
  for(const item of Array.isArray(ranked) ? ranked : []){
    const id = item?.s?.p?.id;
    if(id != null && !ids.includes(id)) ids.push(id);
    if(ids.length === 2) break;
  }
  return {captainId:ids[0] ?? null, viceId:ids[1] ?? null};
}

export { TEAM_PITCH_PATTERNS, teamPitchNormaliseCode, teamPitchPalette, teamPitchLines, teamPitchCaptaincy };
