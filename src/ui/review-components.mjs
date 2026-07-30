import { el,setChildren } from '../util.mjs';

function reviewUiFormat(value,digits=2){ return value==null||!Number.isFinite(Number(value))?'—':Number(value).toFixed(digits); }
function reviewUiPercent(value){ return value==null||!Number.isFinite(Number(value))?'—':`${(Number(value)*100).toFixed(1)}%`; }
function reviewUiKpi(label,value){ return el('div',{class:'kpi'},el('div',{class:'k'},label),el('div',{class:'v'},String(value))); }
function reviewUiStatusClass(status){ return ['official','complete','current','corrected'].includes(status)?'rise':['pending','provisional','recorded_only','in_progress'].includes(status)?'doubt':['excluded','unavailable'].includes(status)?'out':'dark'; }
function reviewUiFlag(label,status){ return el('span',{class:`flag ${reviewUiStatusClass(status)}`},label); }
function reviewUiDownload(text,fileName,mimeType){
  const blob=new Blob([text],{type:mimeType}),url=URL.createObjectURL(blob),anchor=document.createElement('a');
  anchor.href=url;anchor.download=fileName;anchor.rel='noopener';document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
}
function reviewUiLazyDetails(summary,builder){
  const details=el('details',{class:'mt-10'},el('summary',{},summary),el('div',{class:'mt-10'},el('div',{class:'status'},'Open to load detail.')));
  details.addEventListener('toggle',()=>{
    if(!details.open||details.dataset.loaded==='true') return;
    details.dataset.loaded='true';setChildren(details.lastElementChild,builder());
  });
  return details;
}
function reviewUiTable(columns,rows){
  if(!rows.length) return el('div',{class:'status'},'No rows are available.');
  const table=el('table',{class:'data data-compact'},el('thead',{},el('tr',{},columns.map(column=>el('th',{class:column.numeric?'num':''},column.label)))),el('tbody',{},rows.map(row=>el('tr',{},columns.map(column=>el('td',{class:column.numeric?'num':''},column.render?column.render(row):row[column.key]??'—'))))));
  return el('div',{class:'scroll'},table);
}

function reviewUiWeeklyContent(review){
  const content=[],headline=review.headline;
  content.push(el('div',{class:'note plain'},
    el('div',{},el('b',{},`GW${review.gameweek} evidence `),reviewUiFlag(review.status.snapshot.replaceAll('_',' '),review.status.snapshot),reviewUiFlag(review.status.outcome,review.status.outcome),reviewUiFlag(review.status.evaluation,review.status.evaluation)),
    el('div',{class:'status'},`Evidence ${review.completeness.status}. ${review.sample.message}`)));
  if(headline) content.push(el('div',{class:'kpis mt-10'},reviewUiKpi('Observations',headline.observations),reviewUiKpi('Player MAE',reviewUiFormat(headline.playerMae)),reviewUiKpi('Bias',reviewUiFormat(headline.playerBias)),reviewUiKpi('Within 2',reviewUiPercent(review.reports?.player?.withinTwo)),reviewUiKpi('Coverage',reviewUiPercent(headline.coverage)),reviewUiKpi('Schedule-aligned',headline.scheduleAlignedPlayers??'—')));
  const squad=review.decisions?.squad,captain=review.decisions?.captaincy,bench=review.decisions?.bench;
  if(squad||captain||bench){
    const cards=[];
    if(squad)cards.push(el('article',{class:'note plain'},el('b',{},'Frozen XI'),el('div',{class:'status'},`Realised ${squad.selectedRealised?.basePoints??'—'} base points · realised rank ${squad.selectedRealisedRank??'—'} · Hindsight oracle ${squad.hindsightOracle?.realisedPoints??'—'} points.`)));
    if(captain)cards.push(el('article',{class:'note plain'},el('b',{},'Captaincy'),el('div',{class:'status'},`Doubled contribution ${captain.selected?.doubledContribution??0}${captain.selected?.viceTookOver?' · vice-captain fallback used':''}. Hindsight remains descriptive only.`)));
    if(bench)cards.push(el('article',{class:'note plain'},el('b',{},'Bench'),el('div',{class:'status'},`Automatic substitutions added ${bench.automaticSubstitutionContribution??0} points · ${bench.pointsLeftOnBench??0} points left on unused bench players.`)));
    content.push(...cards);
  }
  const transfer=review.transferHorizon;
  if(transfer?.status==='complete'){
    const primary=transfer.record?.plans?.[0];content.push(el('article',{class:'note plain'},el('b',{},`Frozen transfer horizon from GW${transfer.record.startGameweek}`),el('div',{class:'status'},primary?`Gross gain ${primary.grossGain} · net after hits ${primary.netGainAfterHits}. Overlapping horizons are not summed.`:'Zero-transfer baseline only.')));
  }else if(transfer?.status==='in_progress') content.push(el('article',{class:'note plain'},el('b',{},'Frozen transfer horizon in progress'),el('div',{class:'status'},`No partial result is calculated. Missing authoritative Gameweeks: ${transfer.missingGameweeks.join(', ')||'none'}.`)));
  content.push(reviewUiLazyDetails(`Player-points detail (${review.players.length})`,()=>reviewUiTable([
    {label:'Player',key:'playerName'},{label:'Pred',key:'predictedPoints',numeric:true,render:row=>reviewUiFormat(row.predictedPoints)},{label:'Actual',key:'observedPoints',numeric:true},{label:'Error',key:'error',numeric:true,render:row=>reviewUiFormat(row.error)},{label:'Band',key:'errorBand'},{label:'Schedule',key:'scheduleAligned',render:row=>row.scheduleAligned?'Aligned':'Changed'}
  ],review.players)));
  content.push(reviewUiLazyDetails(`Expected-minutes detail (${review.minuteFixtures.length})`,()=>reviewUiTable([
    {label:'Player',key:'playerName'},{label:'Fixture',key:'fixtureId',numeric:true},{label:'Expected',key:'predictedMinutes',numeric:true,render:row=>reviewUiFormat(row.predictedMinutes,1)},{label:'Actual',key:'observedMinutes',numeric:true,render:row=>row.observedMinutes==null?'—':row.observedMinutes},{label:'Allocation',key:'allocation'},{label:'Schedule',key:'scheduleAligned',render:row=>row.scheduleAligned?'Aligned':'Changed'}
  ],review.minuteFixtures)));
  content.push(reviewUiLazyDetails('Uncertainty and probabilities',()=>{
    const uncertainty=review.reports?.uncertainty;if(!uncertainty)return el('div',{class:'status'},'Uncertainty evidence is unavailable.');
    return el('div',{class:'kpis'},reviewUiKpi('P10–P90 cover',reviewUiPercent(uncertainty.p10P90?.coverage)),reviewUiKpi('P10–P90 width',reviewUiFormat(uncertainty.p10P90?.width)),reviewUiKpi('P25–P75 cover',reviewUiPercent(uncertainty.p25P75?.coverage)),reviewUiKpi('Blank Brier',reviewUiFormat(uncertainty.blank?.brier,3)),reviewUiKpi('Return Brier',reviewUiFormat(uncertainty.return?.brier,3)),reviewUiKpi('Haul Brier',reviewUiFormat(uncertainty.haul?.brier,3)));
  }));
  content.push(reviewUiLazyDetails('Provider Health at the deadline',()=>reviewUiTable([
    {label:'Provider',key:'provider'},{label:'State',key:'state'},{label:'Affected?',key:'didAffectModel',render:row=>row.didAffectModel?'Yes':'No'},{label:'Accepted',key:'acceptedRecordCount',numeric:true},{label:'Rejected',key:'rejectedRecordCount',numeric:true},{label:'Consequence',key:'consequence'}
  ],review.providerContext)));
  content.push(reviewUiLazyDetails('Corrections, exclusions and identity',()=>el('div',{},
    el('div',{class:'note plain'},`Corrected: ${review.corrections.corrected?'Yes':'No'} · outcome revision ${review.corrections.outcomeRevision??'—'} · evaluation revision ${review.corrections.evaluationRevision??'—'} · superseded metadata ${review.corrections.supersededRevisionCount}.`),
    el('div',{class:'status mono'},`Snapshot ${review.sourceRefs.snapshotId||'—'}\nOutcome ${review.sourceRefs.outcomeId||'—'}\nEvaluation ${review.sourceRefs.evaluationId||'—'}`))));
  for(const warning of review.warnings) content.push(el('div',{class:'note bad'},warning));
  return content;
}
function reviewUiSeasonContent(review){
  const overall=review.overall,schedule=review.scheduleAligned,content=[];
  content.push(el('div',{class:'note plain'},el('b',{},`${review.status.evaluatedGameweeks} evaluated Gameweek${review.status.evaluatedGameweeks===1?'':'s'}`),document.createTextNode(` · ${review.status.correctedGameweeks} corrected. Results remain descriptive.`)));
  content.push(el('div',{class:'kpis mt-10'},reviewUiKpi('Overall MAE',reviewUiFormat(overall.player?.metrics?.mae)),reviewUiKpi('Aligned MAE',reviewUiFormat(schedule.player?.metrics?.mae)),reviewUiKpi('Overall bias',reviewUiFormat(overall.player?.metrics?.bias)),reviewUiKpi('Aligned bias',reviewUiFormat(schedule.player?.metrics?.bias)),reviewUiKpi('Matched rows',overall.coverage?.playerRows??0),reviewUiKpi('Unallocatable minutes',overall.coverage?.unallocatableMinutes??0)));
  content.push(el('div',{class:`note ${overall.player?.sample?.level==='raw_only'?'bad':'plain'}`},overall.player?.sample?.message||review.safeguards.warning));
  content.push(reviewUiLazyDetails('Coverage and missingness by Gameweek',()=>reviewUiTable([
    {label:'GW',key:'gameweek',numeric:true},{label:'Matched',key:'matchedPlayers',numeric:true},{label:'Coverage',key:'coverage',numeric:true,render:row=>reviewUiPercent(row.coverage)},{label:'Aligned',key:'scheduleAlignedPlayers',numeric:true},{label:'Minute gaps',key:'unallocatableMinuteRows',numeric:true},{label:'Outcome',key:'outcomeStatus'},{label:'Corrected',key:'corrected',render:row=>row.corrected?'Yes':'No'}
  ],review.coverageTrend)));
  content.push(reviewUiLazyDetails('Provider-state context',()=>reviewUiTable([
    {label:'Provider',key:'provider'},{label:'State',key:'state'},{label:'Rows',key:'observations',numeric:true},{label:'GWs',key:'gameweeks',numeric:true},{label:'MAE',key:'metrics',numeric:true,render:row=>reviewUiFormat(row.metrics?.mae)},{label:'Sample',key:'sample',render:row=>row.sample?.level||'—'}
  ],review.providerStateContext)));
  content.push(reviewUiLazyDetails(`Completed frozen transfer horizons (${review.transferHorizons.length})`,()=>reviewUiTable([
    {label:'Start',key:'startGameweek',numeric:true},{label:'Horizon',key:'horizon',numeric:true},{label:'Plans',key:'plans',numeric:true,render:row=>row.plans?.length??0},{label:'Revision',key:'revision',numeric:true},{label:'Warning',key:'warning'}
  ],review.transferHorizons)));
  content.push(el('div',{class:'note plain'},review.safeguards.warning));
  return content;
}

export { reviewUiWeeklyContent,reviewUiSeasonContent };
