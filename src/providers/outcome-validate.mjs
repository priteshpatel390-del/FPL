const OUTCOME_STAT_FIELDS = Object.freeze([
  'total_points','minutes','starts','goals_scored','assists','clean_sheets','goals_conceded',
  'saves','bonus','bps','yellow_cards','red_cards','own_goals','penalties_missed',
  'penalties_saved','defensive_contribution'
]);
const FIXTURE_STAT_IDENTIFIERS = new Set([
  'goals_scored','assists','own_goals','penalties_saved','penalties_missed',
  'yellow_cards','red_cards','saves','bonus','bps','defensive_contribution'
]);
const outcomeIsObj = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const outcomeIsFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);
const outcomeIsInteger = value => Number.isInteger(Number(value));
const outcomeAsInteger = value => outcomeIsInteger(value) ? Number(value) : null;
const outcomeAsBoolean = value => typeof value === 'boolean' ? value : null;
const outcomeIssue = (endpoint,code,severity='partial',count=1,extra={}) => ({provider:'fpl',endpoint,code,severity,count,...extra});

function normaliseFixtureStatSide(value){
  if(!Array.isArray(value)) return [];
  return value.filter(row=>outcomeIsObj(row)&&outcomeAsInteger(row.element)!==null&&outcomeIsFiniteNumber(Number(row.value)))
    .map(row=>({element:outcomeAsInteger(row.element),value:Number(row.value)}))
    .sort((a,b)=>a.element-b.element||a.value-b.value);
}
function normaliseFixtureStats(value,issues,endpoint){
  if(value==null) return [];
  if(!Array.isArray(value)){
    issues.push(outcomeIssue(endpoint,'fixture_stats_not_array'));
    return [];
  }
  const out=[];
  let unknown=0,invalid=0;
  for(const row of value){
    if(!outcomeIsObj(row)||typeof row.identifier!=='string'){ invalid++; continue; }
    if(!FIXTURE_STAT_IDENTIFIERS.has(row.identifier)){ unknown++; continue; }
    out.push({identifier:row.identifier,h:normaliseFixtureStatSide(row.h),a:normaliseFixtureStatSide(row.a)});
  }
  if(invalid) issues.push(outcomeIssue(endpoint,'fixture_stats_invalid_rows','partial',invalid));
  if(unknown) issues.push(outcomeIssue(endpoint,'fixture_stats_unknown_identifiers','partial',unknown));
  return out.sort((a,b)=>a.identifier.localeCompare(b.identifier));
}
function normaliseOutcomeFixture(row,issues,endpoint){
  const id=outcomeAsInteger(row?.id), event=outcomeAsInteger(row?.event), home=outcomeAsInteger(row?.team_h), away=outcomeAsInteger(row?.team_a);
  if(id===null||event===null||home===null||away===null) return null;
  const homeScore=row.team_h_score==null?null:outcomeAsInteger(row.team_h_score);
  const awayScore=row.team_a_score==null?null:outcomeAsInteger(row.team_a_score);
  if((row.team_h_score!=null&&homeScore===null)||(row.team_a_score!=null&&awayScore===null)) return null;
  return {
    fixtureId:id,
    fixtureCode:row.code==null?null:outcomeAsInteger(row.code),
    event,
    kickoffTime:typeof row.kickoff_time==='string'?row.kickoff_time:null,
    homeTeamId:home,
    awayTeamId:away,
    homeScore,
    awayScore,
    started:outcomeAsBoolean(row.started),
    finished:outcomeAsBoolean(row.finished),
    finishedProvisional:outcomeAsBoolean(row.finished_provisional),
    minutes:row.minutes==null?null:outcomeAsInteger(row.minutes),
    provisionalStartTime:outcomeAsBoolean(row.provisional_start_time),
    stats:normaliseFixtureStats(row.stats,issues,endpoint)
  };
}
function validateOutcomeFixtures(payload,gameweek){
  const endpoint='/fixtures/?event={gw}';
  if(!Array.isArray(payload)) return {value:null,issues:[outcomeIssue(endpoint,'outcome_fixtures_not_array','fatal')]};
  const issues=[],seen=new Map(),records=[];
  let invalid=0,outside=0,exact=0,conflicting=0;
  for(const raw of payload){
    const row=normaliseOutcomeFixture(raw,issues,endpoint);
    if(!row){ invalid++; continue; }
    if(row.event!==Number(gameweek)){ outside++; continue; }
    if(seen.has(row.fixtureId)){
      const prior=seen.get(row.fixtureId);
      if(JSON.stringify(prior)===JSON.stringify(row)) exact++;
      else conflicting++;
      continue;
    }
    seen.set(row.fixtureId,row); records.push(row);
  }
  if(invalid) issues.push(outcomeIssue(endpoint,'outcome_fixture_invalid_rows','partial',invalid));
  if(outside) issues.push(outcomeIssue(endpoint,'outcome_fixture_wrong_gameweek','partial',outside));
  if(exact) issues.push(outcomeIssue(endpoint,'outcome_fixture_exact_duplicate','partial',exact));
  if(conflicting) issues.push(outcomeIssue(endpoint,'outcome_fixture_conflicting_duplicate','fatal',conflicting));
  if(conflicting) return {value:null,issues};
  records.sort((a,b)=>a.fixtureId-b.fixtureId);
  return {value:{records,complete:records.every(row=>row.finished===true)},issues};
}
function normaliseExplanationStats(value,issues){
  if(!Array.isArray(value)) return [];
  const out=[]; let invalid=0,unknown=0;
  for(const row of value){
    if(!outcomeIsObj(row)||typeof row.identifier!=='string'||!outcomeIsFiniteNumber(Number(row.points))||!outcomeIsFiniteNumber(Number(row.value))){ invalid++; continue; }
    if(!OUTCOME_STAT_FIELDS.includes(row.identifier)){ unknown++; continue; }
    out.push({identifier:row.identifier,points:Number(row.points),value:Number(row.value)});
  }
  if(invalid) issues.push(outcomeIssue('/event/{gw}/live/','outcome_explain_invalid_stats','partial',invalid));
  if(unknown) issues.push(outcomeIssue('/event/{gw}/live/','outcome_explain_unknown_stats','partial',unknown));
  return out.sort((a,b)=>a.identifier.localeCompare(b.identifier));
}
function normalisePlayerOutcome(row,fixtureIds,issues){
  const playerId=outcomeAsInteger(row?.id);
  if(playerId===null||!outcomeIsObj(row.stats)) return null;
  const stats={};
  for(const field of OUTCOME_STAT_FIELDS){
    if(row.stats[field]===undefined||row.stats[field]===null){ stats[field]=null; continue; }
    if(!outcomeIsFiniteNumber(Number(row.stats[field]))) return null;
    stats[field]=Number(row.stats[field]);
  }
  if(stats.total_points===null||stats.minutes===null) return null;
  const perFixture=[];
  if(Array.isArray(row.explain)){
    for(const detail of row.explain){
      const fixtureId=outcomeAsInteger(detail?.fixture);
      if(fixtureId===null||!fixtureIds.has(fixtureId)){
        issues.push(outcomeIssue('/event/{gw}/live/','outcome_explain_unknown_fixture','partial'));
        continue;
      }
      const officialStats=normaliseExplanationStats(detail.stats,issues);
      perFixture.push({fixtureId,points:officialStats.reduce((sum,item)=>sum+item.points,0),officialStats});
    }
  }
  perFixture.sort((a,b)=>a.fixtureId-b.fixtureId);
  return {
    playerId,
    totalPoints:stats.total_points,
    minutes:stats.minutes,
    starts:stats.starts,
    appeared:stats.minutes>0,
    reachedSixty:stats.minutes>=60,
    goalsScored:stats.goals_scored,
    assists:stats.assists,
    cleanSheets:stats.clean_sheets,
    goalsConceded:stats.goals_conceded,
    saves:stats.saves,
    bonus:stats.bonus,
    bps:stats.bps,
    yellowCards:stats.yellow_cards,
    redCards:stats.red_cards,
    ownGoals:stats.own_goals,
    penaltiesMissed:stats.penalties_missed,
    penaltiesSaved:stats.penalties_saved,
    defensiveContribution:stats.defensive_contribution,
    perFixture
  };
}
function validateOutcomeLive(payload,fixtureIds=[]){
  const endpoint='/event/{gw}/live/';
  if(!outcomeIsObj(payload)||!Array.isArray(payload.elements)) return {value:null,issues:[outcomeIssue(endpoint,'outcome_live_missing_elements','fatal')]};
  const allowed=new Set(fixtureIds.map(Number)),issues=[],records=[],seen=new Set();
  let invalid=0,duplicate=0;
  for(const raw of payload.elements){
    const row=normalisePlayerOutcome(raw,allowed,issues);
    if(!row){ invalid++; continue; }
    if(seen.has(row.playerId)){ duplicate++; continue; }
    seen.add(row.playerId); records.push(row);
  }
  if(invalid) issues.push(outcomeIssue(endpoint,'outcome_live_invalid_players','partial',invalid));
  if(duplicate) issues.push(outcomeIssue(endpoint,'outcome_live_duplicate_player','fatal',duplicate));
  if(duplicate) return {value:null,issues};
  records.sort((a,b)=>a.playerId-b.playerId);
  return {value:{records},issues};
}
function validateOutcomePicks(payload,gameweek){
  const endpoint='/entry/[redacted]/event/{gw}/picks/';
  if(payload==null) return {value:null,issues:[]};
  if(!outcomeIsObj(payload)||!Array.isArray(payload.picks)) return {value:null,issues:[outcomeIssue(endpoint,'outcome_picks_missing_collection','fatal')]};
  const issues=[],records=[],seen=new Set(); let invalid=0,duplicate=0;
  for(const row of payload.picks){
    const playerId=outcomeAsInteger(row?.element),position=outcomeAsInteger(row?.position),multiplier=outcomeAsInteger(row?.multiplier);
    if(playerId===null||position===null||multiplier===null){ invalid++; continue; }
    if(seen.has(playerId)){ duplicate++; continue; }
    seen.add(playerId);
    records.push({playerId,position,multiplier,isCaptain:Boolean(row.is_captain),isViceCaptain:Boolean(row.is_vice_captain)});
  }
  if(invalid) issues.push(outcomeIssue(endpoint,'outcome_picks_invalid_rows','partial',invalid));
  if(duplicate) issues.push(outcomeIssue(endpoint,'outcome_picks_duplicate_player','fatal',duplicate));
  if(duplicate) return {value:null,issues};
  records.sort((a,b)=>a.position-b.position||a.playerId-b.playerId);
  const automaticSubstitutions=[];
  if(Array.isArray(payload.automatic_subs)){
    for(const row of payload.automatic_subs){
      const playerIn=outcomeAsInteger(row?.element_in),playerOut=outcomeAsInteger(row?.element_out);
      if(playerIn!==null&&playerOut!==null) automaticSubstitutions.push({playerIn,playerOut});
      else issues.push(outcomeIssue(endpoint,'outcome_auto_sub_invalid_rows'));
    }
  }
  automaticSubstitutions.sort((a,b)=>a.playerOut-b.playerOut||a.playerIn-b.playerIn);
  const h=outcomeIsObj(payload.entry_history)?payload.entry_history:null;
  const entryHistory=h?{
    event:outcomeAsInteger(h.event),
    points:h.points==null?null:outcomeAsInteger(h.points),
    totalPoints:h.total_points==null?null:outcomeAsInteger(h.total_points),
    eventTransferCount:h.event_transfers==null?null:outcomeAsInteger(h.event_transfers),
    eventTransferCost:h.event_transfers_cost==null?null:outcomeAsInteger(h.event_transfers_cost),
    pointsOnBench:h.points_on_bench==null?null:outcomeAsInteger(h.points_on_bench)
  }:null;
  if(entryHistory?.event!=null&&entryHistory.event!==Number(gameweek)) issues.push(outcomeIssue(endpoint,'outcome_picks_wrong_gameweek','fatal'));
  return {value:{picks:records,automaticSubstitutions,activeChip:payload.active_chip??null,entryHistory},issues};
}
function validateOutcomeHistory(payload){
  const endpoint='/entry/[redacted]/history/';
  if(payload==null) return {value:null,issues:[]};
  if(!outcomeIsObj(payload)||!Array.isArray(payload.current)) return {value:null,issues:[outcomeIssue(endpoint,'outcome_history_missing_current','fatal')]};
  const issues=[],current=[],seen=new Set(); let invalid=0,duplicate=0;
  for(const row of payload.current){
    const event=outcomeAsInteger(row?.event);
    if(event===null){ invalid++; continue; }
    if(seen.has(event)){ duplicate++; continue; }
    seen.add(event);
    current.push({
      event,
      points:row.points==null?null:outcomeAsInteger(row.points),
      totalPoints:row.total_points==null?null:outcomeAsInteger(row.total_points),
      eventTransferCount:row.event_transfers==null?null:outcomeAsInteger(row.event_transfers),
      eventTransferCost:row.event_transfers_cost==null?null:outcomeAsInteger(row.event_transfers_cost),
      pointsOnBench:row.points_on_bench==null?null:outcomeAsInteger(row.points_on_bench)
    });
  }
  if(invalid) issues.push(outcomeIssue(endpoint,'outcome_history_invalid_rows','partial',invalid));
  if(duplicate) issues.push(outcomeIssue(endpoint,'outcome_history_duplicate_gameweek','fatal',duplicate));
  if(duplicate) return {value:null,issues};
  current.sort((a,b)=>a.event-b.event);
  const chips=Array.isArray(payload.chips)?payload.chips.filter(row=>outcomeIsObj(row)&&typeof row.name==='string'&&outcomeAsInteger(row.event)!==null).map(row=>({name:row.name,event:outcomeAsInteger(row.event)})).sort((a,b)=>a.event-b.event||a.name.localeCompare(b.name)):[];
  return {value:{current,chips},issues};
}

export { OUTCOME_STAT_FIELDS, FIXTURE_STAT_IDENTIFIERS, validateOutcomeFixtures, validateOutcomeLive, validateOutcomePicks, validateOutcomeHistory };
