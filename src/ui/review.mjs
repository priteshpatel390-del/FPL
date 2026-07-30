import { $, el, setChildren } from '../util.mjs';
import {
  REVIEW_RULES, buildOperatingReviewBundle, serialiseOperatingReviewBundle,
  buildOperatingReviewCsv, buildOperatingReviewMarkdown
} from '../evidence/review.mjs';
import { loadMetricIndex, loadMetricRecord } from './metrics.mjs';
import { loadEvidenceIndex, loadEvidenceRecord } from './evidence.mjs';
import { loadOutcomeIndex, loadOutcomeRecord } from './outcomes.mjs';

let reviewUiSequence=0;
let reviewUiBundlePromise=null;
let reviewUiBundleScope=null;

function reviewUiFormat(value,digits=2){return value==null||!Number.isFinite(Number(value))?'—':Number(value).toFixed(digits);}
function reviewUiPercent(value){return value==null||!Number.isFinite(Number(value))?'—':`${(Number(value)*100).toFixed(1)}%`;}
function reviewUiKpi(label,value){return el('div',{class:'kpi'},el('div',{class:'k'},label),el('div',{class:'v'},String(value)));}
function reviewUiDownload(filename,text,type){
  const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),anchor=document.createElement('a');
  anchor.href=url;anchor.download=filename;anchor.rel='noopener';document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
}
async function reviewUiFullMetricRecords(){
  const index=await loadMetricIndex(),records=[];
  for(const row of index.filter(item=>item.hasFullRecord)){
    const record=await loadMetricRecord(row.recordId);if(record) records.push(record);
  }
  return records;
}
async function reviewUiSourceRecords(evaluations,outcomeIndex=[]){
  const snapshotIds=[...new Set((evaluations||[]).map(record=>record.sources?.snapshotId).filter(Boolean))],gameweeks=new Set((evaluations||[]).map(record=>Number(record.gameweek))),season=evaluations?.[0]?.season,snapshots=[],outcomes=[];
  for(const id of snapshotIds){const record=await loadEvidenceRecord(id);if(record) snapshots.push(record);}
  const rows=(outcomeIndex||[]).filter(row=>row.season===season&&gameweeks.has(Number(row.gameweek))&&row.hasFullRecord);
  for(const row of rows){const record=await loadOutcomeRecord(row.outcomeId);if(record) outcomes.push(record);}
  return {snapshots,outcomes};
}
function reviewUiBuildInfo(){
  const value=typeof BUILD_INFO!=='undefined'?BUILD_INFO:globalThis.BUILD_INFO;
  return value&&typeof value==='object'?value:null;
}
async function reviewUiLoadBundle(scopeValue=null){
  const scopeKey=String(scopeValue||'season');
  if(reviewUiBundlePromise&&reviewUiBundleScope===scopeKey) return reviewUiBundlePromise;
  reviewUiBundleScope=scopeKey;
  const task=(async()=>{
    const [records,metricIndex,evidenceIndex,outcomeIndex]=await Promise.all([reviewUiFullMetricRecords(),loadMetricIndex(),loadEvidenceIndex(),loadOutcomeIndex()]),evaluations=records.filter(record=>record.recordType==='gameweekEvaluation'),transferEvaluations=records.filter(record=>record.recordType==='transferHorizonEvaluation');
    if(!evaluations.length) return null;
    const currentByGameweek=new Map();
    for(const record of evaluations){const gw=Number(record.gameweek),prior=currentByGameweek.get(gw);if(!prior||Number(record.identity?.revision)>Number(prior.identity?.revision)) currentByGameweek.set(gw,record);}
    const current=[...currentByGameweek.values()].sort((a,b)=>a.gameweek-b.gameweek),season=current.at(-1)?.season,gameweek=scopeValue&&scopeValue!=='season'?Number(scopeValue):null,selected=current.filter(record=>!gameweek||Number(record.gameweek)===gameweek),sources=await reviewUiSourceRecords(selected,outcomeIndex),sourceMetadata=[...evidenceIndex,...outcomeIndex,...metricIndex];
    return buildOperatingReviewBundle({snapshots:sources.snapshots,outcomes:sources.outcomes,evaluations,transferEvaluations,sourceMetadata,scope:{season,gameweek},build:reviewUiBuildInfo()});
  })();
  reviewUiBundlePromise=task;
  try{return await task;}finally{if(reviewUiBundlePromise===task){reviewUiBundlePromise=null;reviewUiBundleScope=null;}}
}
function reviewUiEnsure(){
  if(typeof document==='undefined'||$('operatingReviewPanel')) return;
  const metrics=$('metricsPanel'),container=metrics?.parentElement||$('evidencePanel');if(!container) return;
  const scope=el('select',{id:'reviewScope','aria-label':'Operating review scope'},el('option',{value:'season'},'Season review'));
  const csv=el('select',{id:'reviewCsvTable','aria-label':'CSV export table'},
    el('option',{value:'gameweeks'},'Gameweeks'),el('option',{value:'players'},'Players'),el('option',{value:'minute_fixtures'},'Minute fixtures'),el('option',{value:'squad_decisions'},'Squad decisions'),
    el('option',{value:'transfer_horizons'},'Transfer horizons'),el('option',{value:'transfer_horizon_gameweeks'},'Transfer horizon Gameweeks'),el('option',{value:'provider_states'},'Provider states'),el('option',{value:'revisions'},'Revisions'));
  const section=el('section',{class:'mt-12',id:'operatingReviewPanel'},
    el('h3',{},'Operating review'),
    el('div',{class:'note plain',id:'reviewStatus'},el('b',{},'Waiting for evaluated Gameweeks'),document.createTextNode(' Weekly and season reviews use immutable local evidence only.')),
    el('div',{class:'field mt-10'},el('label',{for:'reviewScope'},'Review'),scope),
    el('div',{id:'reviewSummary',class:'mt-10'},el('div',{class:'status'},'No operating review is available on this device.')),
    el('details',{class:'mt-10',id:'reviewDetails'},el('summary',{},'Review details'),el('div',{id:'reviewDetailContent',class:'mt-10'})),
    el('details',{class:'mt-10'},el('summary',{},'Exports and recovery'),
      el('p',{class:'hint m-hint-top'},'Downloads are deterministic and owner-controlled. Google Sheets import remains manual in Stage 10.4.'),
      el('div',{class:'actions mt-10'},el('button',{class:'btn ghost',id:'reviewJsonBtn',type:'button'},'Download JSON'),el('button',{class:'btn ghost',id:'reviewMarkdownBtn',type:'button'},'Download Markdown')),
      el('div',{class:'field mt-10'},el('label',{for:'reviewCsvTable'},'CSV table'),csv),
      el('button',{class:'btn ghost',id:'reviewCsvBtn',type:'button'},'Download selected CSV'),
      el('p',{class:'status evidence-message',id:'reviewMessage'},'No export is retained automatically.')));
  if(metrics?.nextSibling) container.insertBefore(section,metrics.nextSibling);else container.appendChild(section);
  scope.addEventListener('change',reviewUiRender);$('reviewJsonBtn')?.addEventListener('click',reviewUiExportJson);$('reviewMarkdownBtn')?.addEventListener('click',reviewUiExportMarkdown);$('reviewCsvBtn')?.addEventListener('click',reviewUiExportCsv);
}
function reviewUiScopeOptions(select,evaluations){
  const current=String(select?.value||'season'),gameweeks=[...new Set((evaluations||[]).map(record=>Number(record.gameweek)).filter(Number.isFinite))].sort((a,b)=>b-a);
  setChildren(select,el('option',{value:'season'},'Season review'),...gameweeks.map(gw=>el('option',{value:String(gw)},`GW${gw} review`)));
  select.value=gameweeks.includes(Number(current))?current:'season';
}
function reviewUiPlayerExceptions(bundle){
  const evaluation=bundle.records?.evaluations?.filter(record=>record.recordType==='gameweekEvaluation').sort((a,b)=>Number(b.identity?.revision)-Number(a.identity?.revision))[0];
  return (evaluation?.observations?.players||[]).slice().sort((a,b)=>Number(b.absError)-Number(a.absError)||Number(a.playerId)-Number(b.playerId)).slice(0,10);
}
function reviewUiWeeklyDetails(bundle,weekly){
  const playerRows=reviewUiPlayerExceptions(bundle),decision=weekly.decisions||{},providers=weekly.providers||[],nodes=[];
  nodes.push(el('article',{class:'note plain'},el('b',{},'Player points'),el('div',{class:'status'},`MAE ${reviewUiFormat(weekly.points?.mae)} · RMSE ${reviewUiFormat(weekly.points?.rmse)} · bias ${reviewUiFormat(weekly.points?.bias)} · within 2 points ${reviewUiPercent(weekly.points?.withinTwo)}.`)));
  nodes.push(el('article',{class:'note plain'},el('b',{},'Minutes and probability coverage'),el('div',{class:'status'},`Minutes MAE ${reviewUiFormat(weekly.minutes?.continuous?.mae)} · ${weekly.headline.unallocatableMinuteRows} unallocatable row${weekly.headline.unallocatableMinuteRows===1?'':'s'}. Missing values remain blank, never zero.`)));
  nodes.push(el('article',{class:'note plain'},el('b',{},'Uncertainty'),el('div',{class:'status'},`P10–P90 coverage ${reviewUiPercent(weekly.uncertainty?.p10P90?.coverage)} · mean width ${reviewUiFormat(weekly.uncertainty?.p10P90?.width)}. One Gameweek is never described as calibrated or uncalibrated.`)));
  if(decision.squad) nodes.push(el('article',{class:'note plain'},el('b',{},'Frozen decisions'),el('div',{class:'status'},`Selected XI ${decision.squad.selectedRealised?.basePoints??'—'} pts · Hindsight oracle ${decision.squad.hindsightOracle?.realisedPoints??'—'} pts. Hindsight oracle is a descriptive upper bound, not a recommendation.`)));
  if(weekly.transfer?.status==='complete') nodes.push(el('article',{class:'note plain'},el('b',{},'Frozen transfer horizon'),el('div',{class:'status'},`Complete across ${weekly.transfer.horizon} Gameweeks. Plan gains are alternatives and are not added together.`)));
  else if(weekly.transfer?.status==='horizon_in_progress') nodes.push(el('article',{class:'note plain'},el('b',{},'Frozen transfer horizon'),el('div',{class:'status'},'In progress. No interim gain is displayed.')));
  if(playerRows.length) nodes.push(el('details',{class:'mt-10'},
    el('summary',{},'Largest player errors'),
    el('div',{class:'mt-10'},...playerRows.map(row=>el('div',{class:'status'},`Player ${row.playerId}: predicted ${reviewUiFormat(row.predictedPoints)} · observed ${reviewUiFormat(row.observedPoints)} · absolute error ${reviewUiFormat(row.absError)}.`)))
  ));
  if(providers.length) nodes.push(el('details',{class:'mt-10'},
    el('summary',{},'Provider states'),
    el('div',{class:'mt-10'},...providers.map(row=>el('div',{class:'status'},`${row.provider}: ${row.state}${row.didAffectModel?' · affected model':' · did not affect model'}.`)))
  ));
  if(weekly.warnings?.length) nodes.push(el('details',{class:'mt-10'},
    el('summary',{},'Completeness and warnings'),
    el('div',{class:'mt-10'},...weekly.warnings.map(value=>el('div',{class:'status'},value)))
  ));
  return nodes;
}
function reviewUiSeasonDetails(bundle){
  const cumulative=bundle.cumulativeReview,overall=cumulative?.overall?.player?.metrics||{},aligned=cumulative?.scheduleAligned?.player?.metrics||{};
  const coverageNodes=(cumulative?.coverageTrend||[]).map(row=>
    el('div',{class:'status'},`GW${row.gameweek}: ${row.matchedPlayers}/${row.eligiblePredictions} matched · ${row.unallocatableMinuteRows} unallocatable minute rows.`)
  );
  const providerNodes=cumulative?.providerStates?.length
    ? cumulative.providerStates.map(row=>el('div',{class:'status'},`${row.provider} ${row.state}: ${row.gameweeks} Gameweek${row.gameweeks===1?'':'s'} · affected model in ${row.affectedGameweeks}.`))
    : [el('div',{class:'status'},'Provider source records are not available in current browser recovery.')];
  return [
    el('article',{class:'note plain'},
      el('b',{},'Overall and schedule-aligned'),
      el('div',{class:'status'},`Overall MAE ${reviewUiFormat(overall.mae)} · schedule-aligned MAE ${reviewUiFormat(aligned.mae)}. Both views remain visible because structural blank zeroes can flatter overall results.`)
    ),
    el('article',{class:'note plain'},
      el('b',{},'Coverage'),
      el('div',{class:'status'},`${cumulative?.gameweeks?.length||0} evaluated Gameweeks · ${cumulative?.overall?.coverage?.playerRows||0} matched player rows · ${cumulative?.overall?.coverage?.unallocatableMinutes||0} unallocatable minute rows.`)
    ),
    el('article',{class:'note plain'},
      el('b',{},'Frozen decisions'),
      el('div',{class:'status'},`${cumulative?.decisions?.squadDecisions||0} squad decisions · ${cumulative?.decisions?.captainDecisions||0} captain decisions · ${cumulative?.decisions?.transferHorizons?.length||0} completed transfer horizons. Overlapping horizons are not summed.`)
    ),
    el('details',{class:'mt-10'},el('summary',{},'Gameweek coverage trend'),el('div',{class:'mt-10'},...coverageNodes)),
    el('details',{class:'mt-10'},el('summary',{},'Provider-state observations'),el('div',{class:'mt-10'},...providerNodes)),
    el('article',{class:'note plain'},'No composite score, significance claim, calibration claim or automatic model update is produced.')
  ];
}
async function reviewUiRender(){
  const sequence=++reviewUiSequence;reviewUiEnsure();const status=$('reviewStatus'),summary=$('reviewSummary'),details=$('reviewDetailContent'),scope=$('reviewScope');
  const records=await reviewUiFullMetricRecords(),evaluations=records.filter(record=>record.recordType==='gameweekEvaluation');if(sequence!==reviewUiSequence) return;
  reviewUiScopeOptions(scope,evaluations);
  if(!evaluations.length){if(status)setChildren(status,el('b',{},'Waiting for evaluated Gameweeks'),document.createTextNode(' Operating review starts after an official snapshot and authoritative outcome create a metric record.'));if(summary)setChildren(summary,el('div',{class:'status'},'No operating review is available on this device.'));if(details)setChildren(details);for(const id of ['reviewJsonBtn','reviewMarkdownBtn','reviewCsvBtn'])if($(id))$(id).disabled=true;return;}
  for(const id of ['reviewJsonBtn','reviewMarkdownBtn','reviewCsvBtn'])if($(id))$(id).disabled=false;
  try{
    const bundle=await reviewUiLoadBundle(scope?.value||'season');if(sequence!==reviewUiSequence||!bundle)return;const weekly=bundle.weeklyReviews?.[0],season=bundle.profile==='season',cumulative=bundle.cumulativeReview;
    if(status){setChildren(status,el('b',{},season?`${cumulative.gameweeks.length} evaluated Gameweek${cumulative.gameweeks.length===1?'':'s'}`:`GW${weekly.gameweek} operating review`),document.createTextNode(` ${bundle.completeness.status==='complete'?'Exact source records included.':'Partial source bundle — derived metrics remain available.'}`));status.className=`note ${bundle.completeness.status==='complete'?'plain':'bad'}`;}
    if(summary){
      const p=season?cumulative.overall.player.metrics:weekly.points;
      setChildren(
        summary,
        el('div',{class:'kpis mt-10'},reviewUiKpi('Player MAE',reviewUiFormat(p?.mae)),reviewUiKpi('Bias',reviewUiFormat(p?.bias)),reviewUiKpi('Within 2',reviewUiPercent(p?.withinTwo)),reviewUiKpi('Rows',season?cumulative.overall.coverage.playerRows:weekly.headline.playerRows)),
        el('div',{class:'note plain'},season?cumulative.overall.player.sample.message:weekly.status.sample.message)
      );
    }
    if(details)setChildren(details,season?reviewUiSeasonDetails(bundle):reviewUiWeeklyDetails(bundle,weekly));
    const serialised=serialiseOperatingReviewBundle(bundle),message=$('reviewMessage');if(message)message.textContent=serialised.warning==='large_export'?'This export is larger than 10 MB. Keep Teamsheet open while Safari prepares the file.':'Exports are generated on demand and are not retained automatically.';
  }catch(error){if(status)setChildren(status,el('b',{},'Operating review unavailable'),document.createTextNode(` ${error.message}`));if(summary)setChildren(summary);if(details)setChildren(details);}
}
async function reviewUiExportJson(){
  const message=$('reviewMessage');try{const bundle=await reviewUiLoadBundle($('reviewScope')?.value||'season');if(!bundle)throw new Error('No operating review is available');const output=serialiseOperatingReviewBundle(bundle);reviewUiDownload(`teamsheet-${bundle.scope.season}-${bundle.scope.label}-operating-review.json`,output.text,'application/json');if(message)message.textContent=`Downloaded ${bundle.identity.bundleId}.`; }catch(error){if(message)message.textContent=`JSON export failed: ${error.message}`;}
}
async function reviewUiExportMarkdown(){
  const message=$('reviewMessage');try{const bundle=await reviewUiLoadBundle($('reviewScope')?.value||'season');if(!bundle)throw new Error('No operating review is available');const output=buildOperatingReviewMarkdown(bundle);reviewUiDownload(output.filename,output.text,'text/markdown;charset=utf-8');if(message)message.textContent=`Downloaded ${output.filename}.`; }catch(error){if(message)message.textContent=`Markdown export failed: ${error.message}`;}
}
async function reviewUiExportCsv(){
  const message=$('reviewMessage');try{const bundle=await reviewUiLoadBundle($('reviewScope')?.value||'season');if(!bundle)throw new Error('No operating review is available');const table=$('reviewCsvTable')?.value||REVIEW_RULES.csvTables[0],output=buildOperatingReviewCsv(bundle,table);reviewUiDownload(output.filename,output.text,'text/csv;charset=utf-8');if(message)message.textContent=`Downloaded ${output.filename} with ${output.rows} data row${output.rows===1?'':'s'}.`; }catch(error){if(message)message.textContent=`CSV export failed: ${error.message}`;}
}
function initOperatingReviewUi(){
  if(typeof document==='undefined') return;reviewUiEnsure();document.addEventListener('teamsheet:outcome-stored',()=>setTimeout(()=>void reviewUiRender(),0));document.addEventListener('teamsheet:data-rendered',reviewUiRender);document.addEventListener('teamsheet:data-verified',()=>setTimeout(()=>void reviewUiRender(),2500));document.addEventListener('visibilitychange',()=>{if(!document.visibilityState||document.visibilityState==='visible')void reviewUiRender();});void reviewUiRender();
}

initOperatingReviewUi();

export {
  reviewUiFormat,reviewUiPercent,reviewUiFullMetricRecords,reviewUiSourceRecords,reviewUiLoadBundle,reviewUiEnsure,reviewUiRender,
  reviewUiExportJson,reviewUiExportMarkdown,reviewUiExportCsv,initOperatingReviewUi
};
