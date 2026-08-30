import {canonicalise,deepFreeze,sha256Hex,stableStringify} from './canonical.mjs';

export const EIA1_ADAPTER_VERSION='1.0.0';
const SOURCE_REVISION='official-fpl-r1';
const ALLOWLIST=Object.freeze({
  official_fpl_event:new Set(['present','name','deadline_time']),
  official_fpl_team:new Set(['present','name','short_name','strength','strength_overall_home','strength_overall_away','strength_attack_home','strength_attack_away','strength_defence_home','strength_defence_away']),
  official_fpl_player:new Set(['present','team','element_type','web_name','now_cost','status','chance_of_playing_next_round','chance_of_playing_this_round','news','news_added','selected_by_percent']),
  official_fpl_fixture:new Set(['present','event','kickoff_time','team_h','team_a','team_h_difficulty','team_a_difficulty'])
});
const ACCOUNT_KEY=/(?:manager|account|entry|league|rival|bank|free.?transfer|captain|chip|team_id)/i;
function fail(condition,code){if(condition)throw new Error(`eia1_${code}`);}
function iso(value,code){const time=Date.parse(value);fail(!Number.isFinite(time),code);return new Date(time).toISOString();}
function freeze(value){return deepFreeze(canonicalise(value));}

export async function adaptPreDeadlineSnapshot(snapshot,{cutoff,cryptoImpl=globalThis.crypto}={}){
  const at=iso(cutoff,'cutoff_required'),deadline=iso(snapshot?.deadlineTime,'snapshot_deadline');
  fail(snapshot?.recordType!=='preDeadlineSnapshot'||snapshot?.schemaVersion!=='1.0.0','snapshot_schema');
  fail(snapshot.season==null||!Number.isInteger(snapshot.gameweek),'snapshot_identity');
  fail(!snapshot.identity?.snapshotId||!snapshot.identity?.contentHash,'snapshot_hash');
  fail(Date.parse(at)>Date.parse(deadline),'cutoff_after_deadline');
  fail(Date.parse(snapshot.capture?.projectionCompletedAt)>Date.parse(at),'snapshot_after_cutoff');
  const players=(snapshot.outputs?.players||[]).map(row=>({
    subjectId:String(row.playerId),prediction:{expectedMinutes:row.minutes?.minutes??null,pStart:row.minutes?.pStart??null,pAppear:row.minutes?.pAppear??null,p60:row.minutes?.p60??null},
    baselineInputs:{player:(snapshot.modelInputs?.players||[]).find(player=>Number(player.id)===Number(row.playerId))||null,minuteHistory:snapshot.modelInputs?.minuteHistory?.[row.playerId]??null},sourceUsage:row.sourceUsage??null
  })).sort((a,b)=>Number(a.subjectId)-Number(b.subjectId));
  const core=canonicalise({schemaVersion:'eia1-snapshot-input-v1',adapterVersion:EIA1_ADAPTER_VERSION,season:snapshot.season,gameweek:snapshot.gameweek,deadlineTime:deadline,evaluationCutoff:at,snapshot:{id:snapshot.identity.snapshotId,contentHash:snapshot.identity.contentHash},provenance:{build:snapshot.build,versions:snapshot.versions,rules:snapshot.rules,providers:snapshot.providers},players});
  return freeze({...core,adapterHash:await sha256Hex(stableStringify(core),cryptoImpl)});
}

export async function adaptOfficialOutcome(outcome,{snapshotInput,cryptoImpl=globalThis.crypto}={}){
  fail(outcome?.recordType!=='gameweekOutcome'||outcome?.schemaVersion!=='1.0.0','outcome_schema');
  fail(!['provisional','complete','corrected'].includes(outcome.status),'outcome_status');
  fail(outcome.season!==snapshotInput?.season||outcome.gameweek!==snapshotInput?.gameweek,'snapshot_outcome_scope_mismatch');
  fail(iso(outcome.officialDeadlineIdentity?.deadlineTime,'outcome_deadline')!==snapshotInput.deadlineTime,'snapshot_outcome_deadline_mismatch');
  fail(outcome.relatedSnapshot?.snapshotId!==snapshotInput.snapshot.id||outcome.relatedSnapshot?.contentHash!==snapshotInput.snapshot.contentHash,'snapshot_outcome_link_mismatch');
  const players=(outcome.allPlayerOutcomes?.records||[]).map(row=>({subjectId:String(row.playerId),targets:{minutes:row.minutes??null,started:row.starts==null?null:Number(row.starts)>0,appeared:row.appeared??(row.minutes==null?null:Number(row.minutes)>0),reachedSixty:row.reachedSixty??(row.minutes==null?null:Number(row.minutes)>=60)}})).sort((a,b)=>Number(a.subjectId)-Number(b.subjectId));
  const core=canonicalise({schemaVersion:'eia1-outcome-input-v1',adapterVersion:EIA1_ADAPTER_VERSION,season:outcome.season,gameweek:outcome.gameweek,deadlineTime:snapshotInput.deadlineTime,state:{status:outcome.status,complete:Boolean(outcome.completeness?.complete),revision:outcome.identity?.revision,supersedesOutcomeId:outcome.identity?.supersedesOutcomeId??null},identity:{outcomeId:outcome.identity?.outcomeId,outcomeDataHash:outcome.identity?.outcomeDataHash,contentHash:outcome.identity?.contentHash},relatedSnapshot:snapshotInput.snapshot,provenance:outcome.sourceProvenance,players});
  return freeze({...core,adapterHash:await sha256Hex(stableStringify(core),cryptoImpl)});
}

export async function adaptDataS2bOfficialFpl(exportPage,{asOf,deadlineTime,cryptoImpl=globalThis.crypto}={}){
  const cutoff=iso(asOf,'as_of_required'),deadline=iso(deadlineTime,'deadline_required');
  fail(cutoff!==iso(exportPage?.as_of,'export_as_of_mismatch'),'export_as_of_mismatch');fail(Date.parse(cutoff)>Date.parse(deadline),'cutoff_after_deadline');
  const observations=(exportPage?.observations||[]).map(row=>{
    fail(row.source_revision_id!==SOURCE_REVISION,'source_revision');fail(!ALLOWLIST[row.category]?.has(row.metric),'unsupported_fact');
    fail(row.admission_state!=='accepted'||row.mode!=='shadow_only','observation_state');fail(Date.parse(row.fetched_at)>Date.parse(cutoff),'post_cutoff_leakage');
    fail(Object.keys(row).some(key=>ACCOUNT_KEY.test(key)),'account_data');
    return row;
  }).sort((a,b)=>String(a.fetched_at).localeCompare(String(b.fetched_at))||String(a.observation_id).localeCompare(String(b.observation_id)));
  const core=canonicalise({schemaVersion:'eia1-data-s2b-input-v1',adapterVersion:EIA1_ADAPTER_VERSION,sourceRevision:SOURCE_REVISION,asOf:cutoff,deadlineTime:deadline,observations});
  return freeze({...core,adapterHash:await sha256Hex(stableStringify(core),cryptoImpl)});
}
