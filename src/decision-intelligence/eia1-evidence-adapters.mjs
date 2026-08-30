import {canonicalise,deepFreeze,sha256Hex,stableStringify} from './canonical.mjs';
import {validateOutcomeIntegrity,validateSnapshotIntegrity} from '../evidence/integrity.mjs';

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
function requiredText(value,code){fail(typeof value!=='string'||!value,code);return value;}

export async function adaptPreDeadlineSnapshot(snapshot,{cutoff,cryptoImpl=globalThis.crypto}={}){
  const integrity=await validateSnapshotIntegrity(snapshot,cryptoImpl);fail(!integrity.ok,`snapshot_integrity_${integrity.reason||'invalid'}`);snapshot=integrity.record;
  const at=iso(cutoff,'cutoff_required'),deadline=iso(snapshot?.deadlineTime,'snapshot_deadline');
  fail(snapshot?.recordType!=='preDeadlineSnapshot'||snapshot?.schemaVersion!=='1.0.0','snapshot_schema');
  fail(snapshot.season==null||!Number.isInteger(snapshot.gameweek),'snapshot_identity');
  fail(!snapshot.identity?.snapshotId||!snapshot.identity?.contentHash,'snapshot_hash');
  fail(Date.parse(at)>Date.parse(deadline),'cutoff_after_deadline');
  const projectionCompletedAt=iso(snapshot.capture?.projectionCompletedAt,'projection_completed_at');
  fail(Date.parse(projectionCompletedAt)>Date.parse(at),'snapshot_after_cutoff');
  const players=(snapshot.outputs?.players||[]).map(row=>({
    subjectId:String(row.playerId),prediction:{expectedMinutes:row.minutes?.minutes??null,pStart:row.minutes?.pStart??null,pAppear:row.minutes?.pAppear??null,p60:row.minutes?.p60??null},
    baselineInputs:{player:(snapshot.modelInputs?.players||[]).find(player=>Number(player.id)===Number(row.playerId))||null,minuteHistory:snapshot.modelInputs?.minuteHistory?.[row.playerId]??null},sourceUsage:row.sourceUsage??null
  })).sort((a,b)=>Number(a.subjectId)-Number(b.subjectId));
  const core=canonicalise({schemaVersion:'eia1-snapshot-input-v1',adapterVersion:EIA1_ADAPTER_VERSION,season:snapshot.season,gameweek:snapshot.gameweek,deadlineTime:deadline,evaluationCutoff:at,snapshot:{id:snapshot.identity.snapshotId,contentHash:snapshot.identity.contentHash},provenance:{build:snapshot.build,versions:snapshot.versions,rules:snapshot.rules,providers:snapshot.providers},players});
  return freeze({...core,adapterHash:await sha256Hex(stableStringify(core),cryptoImpl)});
}

export async function adaptOfficialOutcome(outcome,{snapshotInput,cryptoImpl=globalThis.crypto}={}){
  const integrity=await validateOutcomeIntegrity(outcome,cryptoImpl);fail(!integrity.ok,`outcome_integrity_${integrity.reason||'invalid'}`);outcome=integrity.record;
  fail(outcome?.recordType!=='gameweekOutcome'||outcome?.schemaVersion!=='1.0.0','outcome_schema');
  fail(!['provisional','complete','corrected'].includes(outcome.status),'outcome_status');
  fail(outcome.season!==snapshotInput?.season||outcome.gameweek!==snapshotInput?.gameweek,'snapshot_outcome_scope_mismatch');
  fail(iso(outcome.officialDeadlineIdentity?.deadlineTime,'outcome_deadline')!==snapshotInput.deadlineTime,'snapshot_outcome_deadline_mismatch');
  fail(outcome.relatedSnapshot?.status!=='matched_official'||outcome.relatedSnapshot?.snapshotId!==snapshotInput.snapshot.id||outcome.relatedSnapshot?.contentHash!==snapshotInput.snapshot.contentHash,'snapshot_outcome_link_mismatch');
  const identity=outcome.identity||{},revision=Number(identity.revision);
  fail(!/^outcome-\d{4}-\d{2}-gw\d+-r\d+-[0-9a-f]{16}$/.test(requiredText(identity.outcomeId,'outcome_identity')),'outcome_identity');
  fail(!/^[0-9a-f]{64}$/.test(requiredText(identity.outcomeDataHash,'outcome_identity'))||!/^[0-9a-f]{64}$/.test(requiredText(identity.contentHash,'outcome_identity')),'outcome_identity');
  fail(!Number.isInteger(revision)||revision<1,'outcome_revision');
  fail(identity.outcomeId!==`outcome-${outcome.season}-gw${outcome.gameweek}-r${revision}-${identity.contentHash.slice(0,16)}`,'outcome_identity');
  fail(outcome.status==='provisional'&&outcome.completeness?.complete!==false,'outcome_state');
  fail(['complete','corrected'].includes(outcome.status)&&outcome.completeness?.complete!==true,'outcome_state');
  fail(outcome.status==='corrected'&&(revision<2||!/^outcome-\d{4}-\d{2}-gw\d+-r\d+-[0-9a-f]{16}$/.test(identity.supersedesOutcomeId||'')||identity.supersedesOutcomeId===identity.outcomeId),'outcome_correction');
  fail(outcome.status!=='corrected'&&identity.supersedesOutcomeId!=null&&revision===1,'outcome_supersession');
  const players=(outcome.allPlayerOutcomes?.records||[]).map(row=>({subjectId:String(row.playerId),targets:{minutes:row.minutes??null,started:row.starts==null?null:Number(row.starts)>0,appeared:row.appeared??(row.minutes==null?null:Number(row.minutes)>0),reachedSixty:row.reachedSixty??(row.minutes==null?null:Number(row.minutes)>=60)}})).sort((a,b)=>Number(a.subjectId)-Number(b.subjectId));
  const core=canonicalise({schemaVersion:'eia1-outcome-input-v1',adapterVersion:EIA1_ADAPTER_VERSION,season:outcome.season,gameweek:outcome.gameweek,deadlineTime:snapshotInput.deadlineTime,state:{status:outcome.status,complete:Boolean(outcome.completeness?.complete),revision:outcome.identity?.revision,supersedesOutcomeId:outcome.identity?.supersedesOutcomeId??null},identity:{outcomeId:outcome.identity?.outcomeId,outcomeDataHash:outcome.identity?.outcomeDataHash,contentHash:outcome.identity?.contentHash},relatedSnapshot:snapshotInput.snapshot,provenance:outcome.sourceProvenance,players});
  return freeze({...core,adapterHash:await sha256Hex(stableStringify(core),cryptoImpl)});
}

export async function adaptDataS2bOfficialFpl(exportEnvelope,{asOf,deadlineTime,cryptoImpl=globalThis.crypto}={}){
  const cutoff=iso(asOf,'as_of_required'),deadline=iso(deadlineTime,'deadline_required');
  fail(exportEnvelope?.schemaVersion!=='eia1-data-s2b-export-v1'||!Array.isArray(exportEnvelope.pages)||!exportEnvelope.pages.length,'export_envelope');
  fail(cutoff!==iso(exportEnvelope.as_of,'export_as_of_mismatch'),'export_as_of_mismatch');fail(Date.parse(cutoff)>Date.parse(deadline),'cutoff_after_deadline');
  const observations=[],pagination=[],ids=new Set();let expectedCursor=null,previousKey=null;
  for(let index=0;index<exportEnvelope.pages.length;index++){
    const page=exportEnvelope.pages[index];
    fail(cutoff!==iso(page?.as_of,'export_as_of_mismatch'),'export_as_of_mismatch');
    fail((page.request_cursor??null)!==expectedCursor,'cursor_chain');
    fail(!Array.isArray(page.observations),'export_page');
    for(const row of page.observations){
      const fetchedAt=iso(row?.fetched_at,'fetched_at');requiredText(row?.observation_id,'observation_id');
      const key=`${fetchedAt}|${row.observation_id}`;
      fail(previousKey!==null&&key<=previousKey,'observation_order');fail(ids.has(row.observation_id),'duplicate_observation');
      previousKey=key;ids.add(row.observation_id);observations.push({...row,fetched_at:fetchedAt});
    }
    expectedCursor=page.next_cursor??null;
    pagination.push({page:index+1,requestCursor:page.request_cursor??null,nextCursor:expectedCursor,observationCount:page.observations.length});
    if(index<exportEnvelope.pages.length-1)fail(typeof expectedCursor!=='string'||!expectedCursor,'cursor_chain');
  }
  fail(expectedCursor!==null,'export_unterminated');
  const accepted=observations.map(row=>{
    fail(row.source_revision_id!==SOURCE_REVISION,'source_revision');fail(!ALLOWLIST[row.category]?.has(row.metric),'unsupported_fact');
    fail(row.admission_state!=='accepted'||row.mode!=='shadow_only','observation_state');fail(Date.parse(row.fetched_at)>Date.parse(cutoff),'post_cutoff_leakage');
    fail(Object.keys(row).some(key=>ACCOUNT_KEY.test(key)),'account_data');
    return row;
  });
  const core=canonicalise({schemaVersion:'eia1-data-s2b-input-v1',adapterVersion:EIA1_ADAPTER_VERSION,sourceRevision:SOURCE_REVISION,asOf:cutoff,deadlineTime:deadline,pageCount:exportEnvelope.pages.length,pagination,observations:accepted});
  return freeze({...core,adapterHash:await sha256Hex(stableStringify(core),cryptoImpl)});
}
