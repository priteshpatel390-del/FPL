import { $, el, setChildren } from '../util.mjs';
import { reviewUiWeeklyContent,reviewUiSeasonContent } from './review-components.mjs';
import { stableStringify } from '../evidence/snapshot.mjs';
import {
  buildWeeklyOperatingReview,buildSeasonOperatingReview,buildOperatingReviewBundle,
  buildOperatingReviewCsv,buildOperatingReviewMarkdown,operatingReviewFileName,assessOperatingReviewExport
} from '../evidence/review.mjs';
import { loadEvidenceIndex,loadEvidenceRecord } from './evidence.mjs';
import { loadOutcomeIndex,loadOutcomeRecord } from './outcomes.mjs';
import { loadMetricIndex,loadMetricRecord,currentMetricRecords } from './metrics.mjs';

let reviewUiSequence=0;
let reviewUiBusy=false;
let reviewUiCachedInputs=null;

function reviewUiEnsure(){
  if(typeof document==='undefined'||$('operatingReviewPanel')) return;
  const panel=$('evidencePanel');if(!panel) return;
  const mode=el('select',{id:'reviewMode','aria-label':'Operating review mode'},el('option',{value:'weekly'},'One Gameweek'),el('option',{value:'season'},'Season to date'));
  const gameweek=el('select',{id:'reviewGameweek','aria-label':'Operating review Gameweek'});
  const segmentDimension=el('select',{id:'reviewSegmentDimension','aria-label':'Season review segment'},
    el('option',{value:'overall'},'Overall'),el('option',{value:'schedule'},'Schedule status'),el('option',{value:'owned'},'Ownership'),
    el('option',{value:'recommendation'},'Frozen role'),el('option',{value:'position'},'Position'),el('option',{value:'priceBand'},'Frozen price band'),
    el('option',{value:'minutesSource'},'Minutes source'),el('option',{value:'minutesConfidence'},'Minutes confidence'),el('option',{value:'providerState'},'Provider state'),
    el('option',{value:'homeAway'},'Venue'),el('option',{value:'fdrContext'},'FDR context'),el('option',{value:'fixtureClass'},'Fixture class'),
    el('option',{value:'availability'},'Frozen availability'),el('option',{value:'observedRole'},'Observed role'),el('option',{value:'seasonPeriod'},'Season period'));
  const segmentValue=el('select',{id:'reviewSegmentValue','aria-label':'Season review segment value'},el('option',{value:'all'},'All'));
  const exportType=el('select',{id:'reviewExportType','aria-label':'Operating review export format'},
    el('option',{value:'json'},'Evidence bundle JSON'),el('option',{value:'markdown'},'Readable Markdown'),
    el('option',{value:'gameweeks'},'CSV — Gameweeks'),el('option',{value:'players'},'CSV — Players'),el('option',{value:'minute_fixtures'},'CSV — Minute fixtures'),
    el('option',{value:'squad_decisions'},'CSV — Squad decisions'),el('option',{value:'transfer_horizons'},'CSV — Transfer horizons'),
    el('option',{value:'transfer_horizon_gameweeks'},'CSV — Transfer horizon Gameweeks'),el('option',{value:'provider_states'},'CSV — Provider states'),el('option',{value:'revisions'},'CSV — Revisions'));
  const section=el('div',{class:'mt-12',id:'operatingReviewPanel'},
    el('h3',{},'Operating review'),
    el('div',{class:'note plain',id:'reviewStatus'},el('b',{},'Waiting for evaluated evidence'),document.createTextNode(' Reviews use only immutable Stage 10 records.')),
    el('div',{class:'row mt-10'},el('label',{class:'fld'},'View',mode),el('label',{class:'fld'},'Gameweek',gameweek),el('label',{class:'fld'},'Segment',segmentDimension),el('label',{class:'fld'},'Value',segmentValue)),
    el('div',{id:'reviewSummary',class:'mt-10'},el('div',{class:'status'},'No operating review is available yet.')),
    el('details',{class:'mt-12'},el('summary',{},'Export review evidence'),
      el('p',{class:'hint m-hint-top'},'JSON preserves exact available source records and hashes. CSV and Markdown are deterministic convenience files. Google Sheets remains non-authoritative.'),
      el('div',{class:'row mt-10'},el('label',{class:'fld'},'Format',exportType),el('button',{class:'btn ghost',id:'reviewExportBtn',type:'button'},'Download review')),
      el('p',{class:'status evidence-message',id:'reviewMessage'},'Exports exclude account identifiers and secrets and are created on demand.'))
  );
  panel.appendChild(section);
  mode.addEventListener('change',reviewUiRender);
  gameweek.addEventListener('change',reviewUiRender);
  segmentDimension.addEventListener('change',reviewUiRender);
  segmentValue.addEventListener('change',reviewUiRender);
  $('reviewExportBtn')?.addEventListener('click',reviewUiExport);
}
async function reviewUiLoadInputs({refresh=false}={}){
  if(reviewUiCachedInputs&&!refresh) return reviewUiCachedInputs;
  const [snapshotMetadata,outcomeMetadata,metricMetadata,evaluations,transferEvaluations]=await Promise.all([
    loadEvidenceIndex(),loadOutcomeIndex(),loadMetricIndex(),currentMetricRecords('gameweekEvaluation'),currentMetricRecords('transferHorizonEvaluation')
  ]);
  const snapshots=[];
  for(const row of snapshotMetadata){const record=await loadEvidenceRecord(row.snapshotId);if(record)snapshots.push(record);}
  const outcomes=[];
  for(const row of outcomeMetadata.filter(item=>item.hasFullRecord)){const record=await loadOutcomeRecord(row.outcomeId);if(record)outcomes.push(record);}
  const allMetricRecords=[];
  for(const row of metricMetadata.filter(item=>item.hasFullRecord)){const record=await loadMetricRecord(row.recordId);if(record)allMetricRecords.push(record);}
  reviewUiCachedInputs={snapshotMetadata,outcomeMetadata,metricMetadata,snapshots,outcomes,evaluations,transferEvaluations,allMetricRecords};
  return reviewUiCachedInputs;
}
function reviewUiGameweeks(inputs){
  return [...new Set([
    ...inputs.snapshotMetadata.map(row=>Number(row.gameweek)),...inputs.outcomeMetadata.map(row=>Number(row.gameweek)),
    ...inputs.evaluations.map(row=>Number(row.gameweek))
  ].filter(value=>Number.isInteger(value)&&value>=1&&value<=38))].sort((a,b)=>b-a);
}
function reviewUiPopulateGameweeks(gameweeks){
  const select=$('reviewGameweek');if(!select) return null;
  const previous=Number(select.value),selected=gameweeks.includes(previous)?previous:gameweeks[0];
  setChildren(select,gameweeks.map(gameweek=>el('option',{value:String(gameweek)},`GW${gameweek}`)));
  if(selected) select.value=String(selected);select.disabled=!gameweeks.length||$('reviewMode')?.value==='season';return selected||null;
}

function reviewUiSegmentValues(inputs,dimension){
  if(dimension==='overall') return ['all'];
  if(dimension==='schedule') return ['schedule_aligned','schedule_changed'];
  const rows=inputs.evaluations.flatMap(record=>record.observations?.players||[]),values=[];
  if(dimension==='providerState'){
    for(const row of rows) for(const [provider,state] of Object.entries(row.segments?.providerStates||{})) values.push(`${provider}=${state}`);
  }else for(const row of rows) values.push(String(row.segments?.[dimension]??'unknown'));
  return [...new Set(values)].sort((a,b)=>a.localeCompare(b));
}
function reviewUiPopulateSegments(inputs,mode){
  const dimensionNode=$('reviewSegmentDimension'),valueNode=$('reviewSegmentValue');if(!dimensionNode||!valueNode)return {dimension:'overall',value:'all'};
  dimensionNode.disabled=mode!=='season';valueNode.disabled=mode!=='season';
  const dimension=mode==='season'?dimensionNode.value:'overall',values=reviewUiSegmentValues(inputs,dimension),previous=valueNode.value,value=values.includes(previous)?previous:values[0]||'all';
  setChildren(valueNode,values.map(item=>el('option',{value:item},item.replaceAll('_',' ').replace('=',' · '))));valueNode.value=value;
  return {dimension,value};
}

function reviewUiCurrentForGameweek(inputs,gameweek){
  const metadataBySnapshot=new Map(inputs.snapshotMetadata.filter(row=>Number(row.gameweek)===Number(gameweek)).map(row=>[row.snapshotId,row]));
  const snapshot=inputs.snapshots.filter(row=>Number(row.gameweek)===Number(gameweek)).sort((a,b)=>{const am=metadataBySnapshot.get(a.identity?.snapshotId),bm=metadataBySnapshot.get(b.identity?.snapshotId),local=Number(bm?.origin==='local_capture')-Number(am?.origin==='local_capture');if(local)return local;const official=Number(Boolean(bm?.officialEligible))-Number(Boolean(am?.officialEligible));if(official)return official;return Date.parse(b.timing?.captureCompletedAt||0)-Date.parse(a.timing?.captureCompletedAt||0);})[0]||null;
  const outcomeMeta=inputs.outcomeMetadata.filter(row=>row.current&&row.origin==='local_collection'&&Number(row.gameweek)===Number(gameweek)).sort((a,b)=>Number(b.revision)-Number(a.revision))[0]||null;
  const outcome=outcomeMeta?inputs.outcomes.find(row=>row.identity?.outcomeId===outcomeMeta.outcomeId)||null:null;
  const evaluation=inputs.evaluations.find(row=>Number(row.gameweek)===Number(gameweek))||null;
  return {snapshot,outcome,evaluation};
}
async function reviewUiRender(){
  const sequence=++reviewUiSequence;reviewUiEnsure();const inputs=await reviewUiLoadInputs();if(sequence!==reviewUiSequence)return;
  const gameweeks=reviewUiGameweeks(inputs),selected=reviewUiPopulateGameweeks(gameweeks),mode=$('reviewMode')?.value||'weekly',segment=reviewUiPopulateSegments(inputs,mode),status=$('reviewStatus'),summary=$('reviewSummary');
  if(!gameweeks.length){if(status)setChildren(status,el('b',{},'Waiting for evaluated evidence'),document.createTextNode(' An operating review appears after Stage 10 records exist.'));if(summary)setChildren(summary,el('div',{class:'status'},'No Gameweek evidence is available.'));return;}
  if(mode==='season'){
    const review=buildSeasonOperatingReview(inputs.evaluations,inputs.transferEvaluations,segment);if(status)setChildren(status,el('b',{},'Season-to-date operating review'),document.createTextNode(` ${review.status.evaluatedGameweeks} evaluated Gameweeks. Overall and schedule-aligned results remain separate.`));if(summary)setChildren(summary,reviewUiSeasonContent(review));
  }else{
    const records=reviewUiCurrentForGameweek(inputs,selected),review=buildWeeklyOperatingReview({gameweek:selected,...records,snapshotMetadata:inputs.snapshotMetadata,outcomeMetadata:inputs.outcomeMetadata,transferEvaluations:inputs.transferEvaluations,availableEvaluationGameweeks:inputs.evaluations.map(row=>row.gameweek),revisionRows:[...inputs.outcomeMetadata,...inputs.metricMetadata]});
    if(status)setChildren(status,el('b',{},`GW${selected} operating review`),document.createTextNode(` Snapshot ${review.status.snapshot.replaceAll('_',' ')}, outcome ${review.status.outcome}, evaluation ${review.status.evaluation}.`));if(summary)setChildren(summary,reviewUiWeeklyContent(review));
  }
}
async function reviewUiBundleForSelection(){
  const inputs=await reviewUiLoadInputs(),mode=$('reviewMode')?.value||'weekly',gameweeks=reviewUiGameweeks(inputs),selected=Number($('reviewGameweek')?.value||gameweeks[0]),from=mode==='weekly'?selected:Math.min(...gameweeks),to=mode==='weekly'?selected:Math.max(...gameweeks);
  return buildOperatingReviewBundle({profile:mode==='weekly'?'weekly_evidence':'season_review',fromGameweek:from,toGameweek:to,snapshots:inputs.snapshots,outcomes:inputs.outcomes,evaluations:inputs.allMetricRecords.filter(row=>row.recordType==='gameweekEvaluation'),transferEvaluations:inputs.allMetricRecords.filter(row=>row.recordType==='transferHorizonEvaluation'),snapshotMetadata:inputs.snapshotMetadata,outcomeMetadata:inputs.outcomeMetadata,metricMetadata:inputs.metricMetadata});
}
async function reviewUiExport(){
  if(reviewUiBusy)return;reviewUiBusy=true;const message=$('reviewMessage'),button=$('reviewExportBtn');if(button)button.disabled=true;
  try{
    if(message)message.textContent='Preparing deterministic review export…';const bundle=await reviewUiBundleForSelection(),type=$('reviewExportType')?.value||'json';let text,fileName,mimeType;
    if(type==='json'){text=stableStringify(bundle)+'\n';fileName=operatingReviewFileName(bundle,'json');mimeType='application/json';}
    else if(type==='markdown'){text=buildOperatingReviewMarkdown(bundle);fileName=operatingReviewFileName(bundle,'markdown');mimeType='text/markdown;charset=utf-8';}
    else{const csv=buildOperatingReviewCsv(bundle,type);text=csv.text;fileName=operatingReviewFileName(bundle,'csv',type);mimeType=csv.mimeType;}
    const size=assessOperatingReviewExport(text);if(!size.allowed)throw new Error('export exceeds the 25 MB safety limit; choose one Gameweek or a smaller table');
    if(size.warning&&typeof globalThis.confirm==='function'&&!globalThis.confirm(`This export is ${(size.bytes/1024/1024).toFixed(1)} MB. Continue?`)){if(message)message.textContent='Export cancelled.';return;}
    reviewUiDownload(text,fileName,mimeType);if(message)message.textContent=`Exported ${fileName}. Generated files are not retained by Teamsheet.`;
  }catch(error){if(message)message.textContent=`Review export failed: ${error.message}`;}
  finally{reviewUiBusy=false;if(button)button.disabled=false;}
}
function reviewUiInvalidate(){reviewUiCachedInputs=null;void reviewUiRender();}
function initOperatingReviewUi(){
  if(typeof document==='undefined')return;reviewUiEnsure();document.addEventListener('teamsheet:data-rendered',reviewUiInvalidate);document.addEventListener('teamsheet:outcome-stored',reviewUiInvalidate);document.addEventListener('visibilitychange',()=>{if(!document.visibilityState||document.visibilityState==='visible')reviewUiInvalidate();});void reviewUiRender();
}

initOperatingReviewUi();

export { reviewUiEnsure,reviewUiLoadInputs,reviewUiRender,reviewUiExport,initOperatingReviewUi };
