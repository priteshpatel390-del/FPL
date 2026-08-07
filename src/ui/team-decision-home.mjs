import { S } from '../state.mjs';
import { $, num, el, setChildren } from '../util.mjs';
import { mySquad, bestXI } from '../squad.mjs';
import { xpOf } from '../model/xp.mjs';
import { getHealth, HEALTH_STATES } from '../providers/registry.mjs';
import { teamPitchCaptaincy, teamPitchLines } from './team-pitch.mjs';
import {
  decisionPreviewSnapshot,
  decisionPreviewApplyTransferPlan,
  decisionPreviewEffectiveCaptaincy,
  decisionPreviewCaptainTotal
} from './decision-preview.mjs';

// Teamsheet 2.0.2 — presentation-only Team decision home.
// This module wraps the existing verified renderer. It does not own or alter
// best-XI, captaincy, bench, projection, simulation or optimiser behaviour.

const TEAM_DECISION_HOME_VERSION = '2.0.2';
const TEAM_RESOURCES_BENCH_CLARITY_VERSION = 'UX-A1';
const TEAM_DECISION_UNAVAILABLE = new Set(['i','u','s','n']);
const TEAM_DECISION_BENCH_LABELS = Object.freeze(['GK','1st','2nd','3rd']);

function teamDecisionForecast(xiTotal, captainXp){
  const base = Number.isFinite(Number(xiTotal)) ? Number(xiTotal) : 0;
  const uplift = Number.isFinite(Number(captainXp)) ? Number(captainXp) : 0;
  return Object.freeze({base,uplift,total:base+uplift});
}

function teamDecisionSquadReady(squad=[]){
  const source=Array.isArray(squad)?squad:[];
  if(source.length!==15) return false;
  const counts={1:0,2:0,3:0,4:0};
  for(const entry of source){
    const pos=Number(entry?.p?.element_type);
    if(!Object.prototype.hasOwnProperty.call(counts,pos)) return false;
    counts[pos]++;
  }
  return counts[1]===2&&counts[2]===5&&counts[3]===5&&counts[4]===3;
}

function teamDecisionSourceLabel({manual=false,hasPicks=false,picksGameweek=0,picksStatus='',fplState='',cachedAt=null}={}){
  const state=String(fplState||'');
  const gw=Number(picksGameweek);
  let label=manual?'User-entered squad':hasPicks
    ? `Official FPL public picks${gw>=1&&gw<=38?` · locked GW${gw}`:''}`
    : picksStatus==='unavailable'&&gw>=1&&gw<=38?`Public GW${gw} squad unavailable`:'Squad unavailable';
  if([HEALTH_STATES.CACHED,HEALTH_STATES.STALE,HEALTH_STATES.FALLBACK].includes(state)){
    label += state===HEALTH_STATES.FALLBACK?' · verified fallback':' · verified cache';
    if(Number.isFinite(Number(cachedAt))) label += ` · ${new Date(Number(cachedAt)).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}`;
  }
  return label;
}

function teamDecisionRisk({dataState='',captain=null,starters=[],blankIds=[],closeCaptain=null}={}){
  const state=String(dataState||'');
  const blanks=new Set((blankIds||[]).map(Number));
  if(state===HEALTH_STATES.UNAVAILABLE)
    return Object.freeze({kind:'data-unavailable',level:'blocking',text:'Official FPL data is unavailable, so no recommendation can be verified.'});
  if([HEALTH_STATES.FALLBACK,HEALTH_STATES.STALE,HEALTH_STATES.CACHED].includes(state))
    return Object.freeze({kind:'data-stale',level:'warning',text:'This recommendation uses previously verified data because the live Official FPL refresh did not complete.'});

  const rows=(Array.isArray(starters)?starters:[]).map(item=>({
    ...item,
    id:Number(item?.p?.id),
    status:String(item?.p?.status||''),
    chance:item?.p?.chance_of_playing_next_round,
    name:item?.p?.web_name||'A selected player',
    xp:Number(item?.xp)||0
  }));
  const captainId=Number(captain?.id);
  const cap=rows.find(row=>row.id===captainId)||null;
  const unavailable=row=>TEAM_DECISION_UNAVAILABLE.has(row.status)||blanks.has(row.id);
  const doubtful=row=>row.status==='d';
  const byImportance=(a,b)=>b.xp-a.xp||a.id-b.id;

  if(cap&&unavailable(cap))
    return Object.freeze({kind:'captain-unavailable',level:'blocking',playerId:cap.id,text:`Captain ${cap.name} is unavailable or has no fixture in this Gameweek.`});
  const unavailableStarter=rows.filter(row=>row.id!==captainId&&unavailable(row)).sort(byImportance)[0];
  if(unavailableStarter)
    return Object.freeze({kind:'starter-unavailable',level:'blocking',playerId:unavailableStarter.id,text:`Recommended starter ${unavailableStarter.name} is unavailable or has no fixture.`});
  if(cap&&doubtful(cap))
    return Object.freeze({kind:'captain-doubtful',level:'warning',playerId:cap.id,text:`Captain ${cap.name} is officially doubtful${cap.chance!=null?` (${cap.chance}% chance of playing)`:''}.`});
  const doubtfulStarter=rows.filter(row=>row.id!==captainId&&doubtful(row)).sort(byImportance)[0];
  if(doubtfulStarter)
    return Object.freeze({kind:'starter-doubtful',level:'warning',playerId:doubtfulStarter.id,text:`Recommended starter ${doubtfulStarter.name} is officially doubtful${doubtfulStarter.chance!=null?` (${doubtfulStarter.chance}% chance of playing)`:''}.`});
  if(closeCaptain&&Number(closeCaptain.gap)<0.6)
    return Object.freeze({kind:'close-captaincy',level:'info',text:`Captaincy is a close model call: ${closeCaptain.firstName} leads ${closeCaptain.secondName} by ${Number(closeCaptain.gap).toFixed(1)} projected points.`});
  return Object.freeze({kind:'none',level:'clear',text:'No material Team-selection risk is identified from the currently verified inputs.'});
}

function teamDecisionAction({hasSquad=false,deadlinePassed=false,previewActive=false,riskKind='none',squadStatus='',squadGameweek=0}={}){
  if(riskKind==='data-unavailable') return 'Official FPL season data is unavailable. Manual squad editing also needs the verified player list, so retry the data load before building a squad.';
  if(deadlinePassed) return 'The Official FPL deadline has passed. Review this recommendation for context only.';
  if(!hasSquad && squadStatus==='gameweek-unavailable') return 'Use Load data again when Official FPL identifies the current or next Gameweek, or build your squad manually in Settings → Team & Account.';
  if(!hasSquad && squadStatus==='unavailable') return `Use Load data again when Official FPL publishes the public${Number(squadGameweek)?` GW${Number(squadGameweek)}`:''} squad, or build your squad manually in Settings → Team & Account.`;
  if(!hasSquad && squadStatus==='incomplete') return 'The public squad response was incomplete. Retry Load data, or build the complete squad manually in Settings → Team & Account.';
  if(!hasSquad) return 'Enter your Team ID in Team setup below, or open Settings → Team & Account to build a manual squad.';
  if(previewActive) return 'Review this user preview and reproduce it in Official FPL before the deadline if you choose to act.';
  if(riskKind==='data-stale') return 'Check the data warning before acting. Previously verified content is not confirmation of a successful live refresh.';
  if(riskKind.includes('unavailable')||riskKind.includes('doubtful')) return 'Review the affected player. Open Transfers if a replacement is needed, then set the final XI, captaincy and bench in Official FPL.';
  return 'Review and set this XI, captaincy and bench in Official FPL. Use Transfers for the separate roll-or-transfer decision.';
}

function teamDecisionCloseCaptainCopy(firstName,secondName,gap){
  return `${firstName} and ${secondName} are separated by ${Number(gap).toFixed(1)} projected points. This is a close model call; ownership is context only and does not create a protect or chase recommendation.`;
}

function teamDecisionBenchLabel(index){
  return TEAM_DECISION_BENCH_LABELS[Number(index)]||`Sub ${Number(index)+1}`;
}

function teamDecisionBenchDisplayOrder(bench=[]){
  const source=Array.isArray(bench)?bench:[];
  const reserveGoalkeeper=source.find(slot=>Number(slot?.p?.element_type)===1)||null;
  if(!reserveGoalkeeper) return source.slice();
  return [reserveGoalkeeper,...source.filter(slot=>slot!==reserveGoalkeeper)];
}

function teamDecisionOrderBenchDisplay(stage,xi){
  if(!stage?.querySelector||!xi) return;
  const grid=stage.querySelector('.team-bench .bench-grid');
  if(!grid) return;
  const source=Array.isArray(xi.bench)?xi.bench:[];
  const nodes=Array.from(grid.querySelectorAll('.bench-player'));
  if(nodes.length!==source.length) return;
  const nodeBySlot=new Map(source.map((slot,index)=>[slot,nodes[index]]));
  for(const slot of teamDecisionBenchDisplayOrder(source)){
    const node=nodeBySlot.get(slot);
    if(node) grid.appendChild(node);
  }
}

function teamDecisionRelabelBench(stage){
  if(!stage?.querySelectorAll) return;
  const players=Array.from(stage.querySelectorAll('.team-bench .bench-grid .bench-player'));
  const rolePrefix=/^(?:(?:Reserve goalkeeper|[123](?:st|nd|rd) sub|GK|1st|2nd|3rd)(?: bench)?[,·]\s*)/;
  players.forEach((player,index)=>{
    const label=teamDecisionBenchLabel(index);
    const nameNode=player.querySelector('.pitch-name');
    const oldRole=player.querySelector('.bench-role');
    if(oldRole?.remove) oldRole.remove();
    if(nameNode){
      const playerName=String(nameNode.textContent||'').replace(/^\d+\.\s*/, '').replace(rolePrefix,'');
      nameNode.textContent=playerName;
      nameNode.parentNode?.insertBefore(el('span',{class:'bench-role'},label),nameNode);
    }
    const aria=player.getAttribute('aria-label');
    if(aria){
      const detail=aria.replace(/^\d+\.\s*/, '').replace(rolePrefix,'');
      player.setAttribute('aria-label',`${label} bench, ${detail}`);
    }
  });
}

function teamDecisionAvailabilityPresentation(player){
  const status=String(player?.status||'');
  if(status==='d'){
    const chance=player?.chance_of_playing_next_round;
    const chanceLabel=chance==null?'chance unknown':`${chance}% chance`;
    const chanceAria=chance==null?'chance of playing unknown':`${chance} percent chance of playing`;
    return Object.freeze({label:`Doubtful · ${chanceLabel}`,className:'doubt',aria:`doubtful, ${chanceAria}`});
  }
  if(status==='s') return Object.freeze({label:'Suspended',className:'out',aria:'suspended and unavailable'});
  if(TEAM_DECISION_UNAVAILABLE.has(status)) return Object.freeze({label:'Unavailable',className:'out',aria:'unavailable'});
  return null;
}

function teamDecisionAnnotateAvailability(stage,xi){
  if(!stage?.querySelectorAll||!xi) return;
  const starterSlots=teamPitchLines(xi.xi).flatMap(line=>line.players);
  const starterNodes=Array.from(stage.querySelectorAll('.team-pitch .pitch-player'));
  const benchSlots=teamDecisionBenchDisplayOrder(xi.bench);
  const benchNodes=Array.from(stage.querySelectorAll('.team-bench .bench-grid .bench-player'));
  const annotate=(node,slot)=>{
    if(!node||!slot?.p) return;
    const presentation=teamDecisionAvailabilityPresentation(slot.p);
    node.querySelector('.pitch-availability')?.remove?.();
    if(!presentation) return;
    const copy=node.querySelector('.pitch-copy');
    const nameNode=copy?.querySelector?.('.pitch-name');
    const badge=el('span',{class:`flag ${presentation.className} pitch-availability`},presentation.label);
    if(copy&&nameNode) copy.insertBefore(badge,nameNode.nextSibling);
    else copy?.appendChild?.(badge);
    const aria=String(node.getAttribute?.('aria-label')||'');
    if(aria) node.setAttribute('aria-label',`${aria}, ${presentation.aria}`);
  };
  starterNodes.forEach((node,index)=>annotate(node,starterSlots[index]));
  benchNodes.forEach((node,index)=>annotate(node,benchSlots[index]));
}

function teamDecisionPlaceholderPlayer(label='—',benchRole=''){
  return el('div',{class:'pitch-player team-home-placeholder-player','aria-hidden':'true'},
    el('div',{class:'shirt-wrap'},
      el('span',{class:'club-shirt pattern-solid shirt-palette-fallback-3'},el('span',{class:'club-shirt-code'},'FPL'))),
    el('div',{class:'pitch-copy'},benchRole?el('span',{class:'bench-role'},benchRole):null,
      el('div',{class:'pitch-name'},label),el('div',{class:'pitch-meta'},'Awaiting squad'),el('div',{class:'pitch-xp'},'— xP')));
}

function teamDecisionPlaceholderStage(gw,message){
  const line=(position,count)=>el('div',{class:`pitch-line position-${position}`},Array.from({length:count},()=>teamDecisionPlaceholderPlayer()));
  const pitch=el('section',{class:'team-pitch team-home-placeholder','aria-label':message,role:'img'},
    el('span',{class:'pitch-mark pitch-centre-circle','aria-hidden':'true'}),
    el('span',{class:'pitch-mark pitch-box pitch-box-top','aria-hidden':'true'}),
    el('span',{class:'pitch-mark pitch-box pitch-box-bottom','aria-hidden':'true'}),
    el('div',{class:'pitch-formation'},line(4,3),line(3,4),line(2,3),line(1,1)));
  const bench=el('section',{class:'team-bench','aria-label':'Bench unavailable'},
    el('div',{class:'bench-head'},el('strong',{},'Bench'),el('span',{},'Auto-sub order')),
    el('div',{class:'bench-grid'},Array.from({length:4},(_,index)=>teamDecisionPlaceholderPlayer('—',teamDecisionBenchLabel(index)))));
  return el('div',{class:'team-stage'},pitch,bench);
}

function teamDecisionMetaChip(text,kind='plain'){
  return el('span',{class:`team-home-chip ${kind}`},text);
}

function teamDecisionFocusResources(){
  const context=$('teamContext');
  const firstInput=$('ftCount')||$('bankIn');
  context?.scrollIntoView?.({block:'start'});
  firstInput?.focus?.();
}

function teamDecisionResourceBar({ft=0,bank='0.0'}={}){
  const item=(label,value)=>el('div',{class:'team-resource-item'},
    el('span',{class:'team-resource-label'},label),
    el('strong',{class:'team-resource-value'},value));
  return el('section',{class:'team-resource-bar','aria-label':'Team resources'},
    el('div',{class:'team-resource-bar-head'},
      el('div',{class:'team-resource-heading'},
        el('span',{class:'eyebrow'},'Team resources'),
        el('span',{class:'team-resource-provenance'},'Entered manually')),
      el('button',{type:'button',class:'btn ghost sm team-resource-edit',onclick:teamDecisionFocusResources,
        'aria-label':'Edit free transfers and money in bank'},'Edit resources')),
    el('div',{class:'team-resource-values'},
      item('Free transfers',String(ft)),
      item('Money in bank',`£${bank}m`)));
}

function teamDecisionHeader({title,eyebrow,source,deadline,rank}){
  const chips=[teamDecisionMetaChip(source,'source')];
  if(deadline) chips.push(teamDecisionMetaChip(deadline,'deadline'));
  if(rank) chips.push(teamDecisionMetaChip(rank,'official'));
  return el('section',{class:'team-home-header','aria-labelledby':'teamDecisionTitle'},
    el('span',{class:'eyebrow'},eyebrow),
    el('h3',{id:'teamDecisionTitle'},title),
    el('div',{class:'team-home-chips'},chips));
}

function teamDecisionSummary({recommendation,forecast,risk,action}){
  const row=(label,value,kind='')=>el('div',{class:`team-home-row${kind?' '+kind:''}`},
    el('span',{class:'team-home-row-label'},label),el('span',{class:'team-home-row-value'},value));
  return el('section',{class:'team-home-decision','aria-label':'Team decision summary'},
    row('Recommendation',recommendation),
    row('Forecast',forecast),
    row('Main risk',risk.text,`risk-${risk.level}`),
    row('Before deadline',action,'deadline-action'),
    el('p',{class:'status team-home-advisory'},'Teamsheet is advisory and does not submit squad, captaincy or transfer changes to Official FPL.'));
}

function teamDecisionDeadlineModel(){
  const event=S.boot?.events?.find?.(item=>Number(item.id)===Number(S.nextGW));
  if(!event?.deadline_time) return {label:'Deadline unavailable',passed:false};
  const deadline=new Date(event.deadline_time);
  return {
    label:`Deadline ${deadline.toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}`,
    passed:deadline.getTime()<=Date.now()
  };
}

function teamDecisionCaptureFocus(out){
  const active=typeof document!=='undefined'?document.activeElement:null;
  if(!active||!out?.contains?.(active)) return null;
  return {aria:active.getAttribute?.('aria-label')||'',text:active.textContent?.trim()||''};
}

function teamDecisionRestoreFocus(out,focus){
  if(!focus||!out) return;
  const controls=Array.from(out.querySelectorAll('button,a,input,select,textarea'));
  const match=controls.find(node=>focus.aria&&node.getAttribute('aria-label')===focus.aria)||
    controls.find(node=>focus.text&&node.textContent?.trim()===focus.text);
  match?.focus?.({preventScroll:true});
}

function teamDecisionSetStartupShellOwned(owned){
  if(typeof document==='undefined') return;
  [document.querySelector('header'),document.querySelector('main'),document.querySelector('nav.tabs')].filter(Boolean).forEach(node=>{
    node.hidden=Boolean(owned);
    node.inert=Boolean(owned);
  });
}

function teamDecisionSetupStartup(){
  if(typeof document==='undefined') return;
  const startupPending=Boolean(document.body?.classList?.contains('startup-pending'));
  if(startupPending) teamDecisionSetStartupShellOwned(true);
  document.addEventListener?.('teamsheet:startup-ready',()=>teamDecisionSetStartupShellOwned(false),{once:true});
  const pitch=document.querySelector('#startupGate .startup-pitch');
  if(!pitch) return;
  pitch.classList.add('team-startup-lineup');
  pitch.setAttribute('aria-label','Loading your team');
  const rows=[3,4,3,1].map((count,index)=>el('div',{class:`team-startup-row row-${index+1}`},
    Array.from({length:count},()=>el('span',{'aria-hidden':'true'},'○'))));
  setChildren(pitch,rows);
  const sub=document.querySelector('#startupGate .startup-sub');
  if(sub) sub.textContent='Loading your team';
}

function teamDecisionUpdateManualAvailability(){
  const available=Boolean(S.boot);
  const manualToggle=$('useManual'),manualSearch=$('pSearch'),manualLink=$('manualSquadLink');
  if(manualToggle){
    manualToggle.disabled=!available;
    manualToggle.setAttribute('aria-describedby','manualModeAvailability manualEditorAvailability');
  }
  if(manualSearch){
    manualSearch.disabled=!available;
    manualSearch.setAttribute('aria-describedby','manualEditorAvailability');
  }
  ['manualModeAvailability','manualEditorAvailability'].map(id=>$(id)).filter(Boolean).forEach(node=>{
    node.textContent=available
      ? 'Manual squad editing is available in Settings → Team & Account.'
      : 'Manual squad editing is unavailable until verified Official FPL player data loads.';
  });
  if(manualLink) manualLink.hidden=!available;
}

function teamDecisionSetupShell(){
  if(typeof document==='undefined') return null;
  const teamView=$('view-squad'),out=$('squadOut'),context=$('teamContext');
  if(!teamView||!out) return null;
  const hint=teamView.querySelector('.hint');
  if(hint) hint.textContent='Your recommended XI, captaincy, bench, forecast and the one issue that matters before the deadline.';
  if(context){
    const heading=context.querySelector('h3');
    if(heading) heading.textContent='Team setup and weekly resources';
    const contextStatus=context.querySelector('.team-context-head > .status');
    if(contextStatus) contextStatus.textContent='Bank and free transfers remain manual until separate account integration is approved.';
    const relabel=(id,text)=>{
      const input=$(id),label=input?.closest?.('label');
      const first=label?.childNodes?.[0];
      if(first?.nodeType===3) first.nodeValue=text;
    };
    relabel('ftCount','Free transfers (manual)');
    relabel('bankIn','Bank £m (manual)');
    const manualToggle=$('useManual'),manualCopy=manualToggle?.parentElement;
    const manualText=Array.from(manualCopy?.childNodes||[]).find(node=>node.nodeType===3);
    if(manualText) manualText.nodeValue=' Use my manually entered squad';
    const manualStatus=el('p',{id:'manualModeAvailability',class:'status'});
    const manualLink=el('a',{id:'manualSquadLink',class:'btn ghost sm',href:'#/settings/team-account'},'Open manual squad editor');
    context.append(manualStatus,manualLink);
    teamView.insertBefore(context,out.nextSibling);
  }
  teamDecisionUpdateManualAvailability();
  let support=$('teamHomeSupport');
  if(!support){
    support=el('div',{id:'teamHomeSupport',class:'team-home-support-host'});
    if(context) teamView.insertBefore(support,context.nextSibling);
    else teamView.appendChild(support);
  }
  return support;
}

function teamDecisionEnhanceRenderedTeam(){
  if(typeof document==='undefined') return;
  teamDecisionUpdateManualAvailability();
  const out=$('squadOut'),support=$('teamHomeSupport');
  if(!out||!support) return;
  const realSquad=mySquad();
  const ready=teamDecisionSquadReady(realSquad);
  out.classList.toggle('team-home-ready',ready);
  support.textContent='';
  const health=getHealth('fpl',{seasonLive:S.seasonLive});
  const dataState=health?.state||(!S.boot?HEALTH_STATES.UNAVAILABLE:HEALTH_STATES.LIVE);
  const deadline=teamDecisionDeadlineModel();
  const manual=Boolean($('useManual')?.checked);
  const source=teamDecisionSourceLabel({manual,hasPicks:Boolean(S.picks?.picks),
    picksGameweek:S.picksGameweek,picksStatus:S.picksStatus,fplState:dataState,cachedAt:S.cachedAt});
  const ft=Math.max(0,Math.trunc(num($('ftCount')?.value)));
  const bank=Math.max(0,num($('bankIn')?.value)).toFixed(1);
  const rank=Number(S.entry?.summary_overall_rank)>0?`Official OR ${Number(S.entry.summary_overall_rank).toLocaleString('en-GB')}`:'';
  const title=`${S.entry?.name||'Your team'} · GW${S.nextGW}`;

  if(!ready){
    const count=realSquad.length;
    let risk;
    if(dataState===HEALTH_STATES.UNAVAILABLE) risk=teamDecisionRisk({dataState});
    else if(S.picksStatus==='gameweek-unavailable') risk=Object.freeze({kind:'squad-unavailable',level:'blocking',
      text:'Official FPL has not identified a valid current or next Gameweek, so Teamsheet cannot request public squad picks.'});
    else if(S.picksStatus==='unavailable'&&S.entry) risk=Object.freeze({kind:'squad-unavailable',level:'blocking',
      text:`Official FPL has not exposed a complete public GW${S.picksGameweek} squad for this Team ID yet. Teamsheet will not invent or reuse a different Gameweek squad.`});
    else if(S.picksStatus==='incomplete') risk=Object.freeze({kind:'squad-unavailable',level:'blocking',
      text:`${count} of 15 public GW${S.picksGameweek} picks were usable. A complete legal squad is required before Teamsheet can recommend an XI.`});
    else risk=Object.freeze({kind:'squad-unavailable',level:'blocking',text:count?`${count} of 15 players are available. A complete legal squad is required before Teamsheet can recommend an XI.`:'No usable 15-player squad is available.'});
    const action=teamDecisionAction({hasSquad:false,deadlinePassed:deadline.passed,riskKind:risk.kind,
      squadStatus:S.picksStatus,squadGameweek:S.picksGameweek});
    const header=teamDecisionHeader({title,eyebrow:'Team decision home',source,deadline:deadline.label,rank});
    const summary=teamDecisionSummary({recommendation:'Recommendation unavailable',forecast:'No projection calculated',risk,action});
    const placeholder=teamDecisionPlaceholderStage(S.nextGW,'Empty Team pitch. No valid squad is available, so no XI, captaincy or bench recommendation has been calculated.');
    const resourceBar=teamDecisionResourceBar({ft,bank});
    setChildren(out,header,summary,resourceBar,placeholder);
    return;
  }

  let previewState=decisionPreviewSnapshot();
  const applied=previewState.transfer?decisionPreviewApplyTransferPlan(realSquad,previewState.transfer,S.byId):{ok:true,squad:realSquad};
  const squad=applied.ok?applied.squad:realSquad;
  const gw=S.nextGW,xi=bestXI(squad,gw);
  const capRank=xi.xi.map(slot=>({s:slot,x:xpOf(slot.p,gw,1).total,own:num(slot.p.selected_by_percent)})).sort((a,b)=>b.x-a.x||Number(a.s.p.id)-Number(b.s.p.id));
  const modelCaptaincy=teamPitchCaptaincy(capRank);
  const xiIds=xi.xi.map(slot=>Number(slot.p.id));
  const effectiveCaptaincy=decisionPreviewEffectiveCaptaincy(modelCaptaincy,xiIds);
  const scoreById=Object.fromEntries(xi.xi.map(slot=>[slot.p.id,xpOf(slot.p,gw,1).total]));
  const captainTotal=decisionPreviewCaptainTotal(xi.tot,effectiveCaptaincy.captainId,scoreById);
  const forecast=teamDecisionForecast(xi.tot,captainTotal.uplift);
  const captain=S.byId[effectiveCaptaincy.captainId];
  const vice=S.byId[effectiveCaptaincy.viceId];
  const blankIds=xi.xi.filter(slot=>(teamFixtures(slot.p.team,gw,1)[0]||[]).length===0).map(slot=>slot.p.id);
  const close=capRank[1]&&capRank[0].x-capRank[1].x<0.6?{
    firstName:capRank[0].s.p.web_name,
    secondName:capRank[1].s.p.web_name,
    gap:capRank[0].x-capRank[1].x
  }:null;
  const risk=teamDecisionRisk({
    dataState,
    captain,
    starters:xi.xi.map(slot=>({p:slot.p,xp:xpOf(slot.p,gw,1).total})),
    blankIds,
    closeCaptain:close
  });
  previewState=decisionPreviewSnapshot();
  const previewActive=Boolean(previewState.transfer||effectiveCaptaincy.isPreview);
  const action=teamDecisionAction({hasSquad:true,deadlinePassed:deadline.passed,previewActive,riskKind:risk.kind});
  const bench=teamDecisionBenchDisplayOrder(xi.bench).map((slot,index)=>`${teamDecisionBenchLabel(index)} ${slot.p.web_name}`).join(' · ');
  const recommendation=`Start ${xi.shape}. ${captain?.web_name||'—'} captain, ${vice?.web_name||'—'} vice. Bench: ${bench}.`;
  const forecastCopy=`${forecast.base.toFixed(1)} xP before captain · +${forecast.uplift.toFixed(1)} captain uplift · ${forecast.total.toFixed(1)} xP including captain.`;
  const header=teamDecisionHeader({title,eyebrow:previewActive?'User preview':'Model recommendation',source,deadline:deadline.label,rank});
  const summary=teamDecisionSummary({recommendation,forecast:forecastCopy,risk,action});
  const resourceBar=teamDecisionResourceBar({ft,bank});

  const children=Array.from(out.children);
  const previewBanner=children.find(node=>node.classList?.contains('decision-preview-banner'))||null;
  const controls=children.find(node=>node.classList?.contains('decision-preview-controls'))||null;
  const stage=children.find(node=>node.classList?.contains('team-stage'))||null;
  teamDecisionOrderBenchDisplay(stage,xi);
  teamDecisionRelabelBench(stage);
  teamDecisionAnnotateAvailability(stage,xi);
  const captainHeading=children.find(node=>node.matches?.('h3.section-title')&&node.textContent.trim()==='Captaincy ranking')||null;
  const captainGrid=captainHeading?.nextElementSibling?.classList?.contains('capgrid')?captainHeading.nextElementSibling:null;
  const allHeading=children.find(node=>node.matches?.('h3.section-title')&&node.textContent.trim().startsWith('All 15'))||null;
  const allTable=allHeading?.nextElementSibling?.classList?.contains('scroll')?allHeading.nextElementSibling:null;
  const finalCaveat=allTable?.nextElementSibling?.classList?.contains('note')?allTable.nextElementSibling:null;

  const actions=el('div',{class:'team-home-actions'},
    el('a',{class:'btn ghost',href:'#/transfers'},'Open Transfers'),
    el('a',{class:'btn ghost',href:'#/settings/team-account'},'Edit manual squad'));
  setChildren(out,header,summary,previewBanner,resourceBar,stage,controls,actions);

  const why=el('details',{class:'team-home-support'},
    el('summary',{},'Why this XI and captaincy'),
    el('div',{class:'team-home-support-body'},captainHeading,captainGrid,
      close?noteNode('',teamDecisionCloseCaptainCopy(close.firstName,close.secondName,close.gap)):null));
  const all=el('details',{class:'team-home-support'},
    el('summary',{},'All 15 over six Gameweeks'),
    el('div',{class:'team-home-support-body'},allHeading,allTable,finalCaveat));
  setChildren(support,why,all);
}

function teamDecisionInstall(){
  if(typeof document==='undefined'||typeof BUILD_INFO==='undefined') return;
  teamDecisionSetupStartup();
  teamDecisionSetupShell();
  const legacyRenderSquad=renderSquad;
  renderSquad=function renderSquadTeamDecisionHome(){
    const out=$('squadOut'),focus=teamDecisionCaptureFocus(out);
    legacyRenderSquad();
    teamDecisionEnhanceRenderedTeam();
    teamDecisionRestoreFocus(out,focus);
  };
}

teamDecisionInstall();

export {
  TEAM_DECISION_HOME_VERSION,
  TEAM_RESOURCES_BENCH_CLARITY_VERSION,
  TEAM_DECISION_BENCH_LABELS,
  teamDecisionForecast,
  teamDecisionSquadReady,
  teamDecisionSourceLabel,
  teamDecisionRisk,
  teamDecisionAction,
  teamDecisionCloseCaptainCopy,
  teamDecisionBenchLabel,
  teamDecisionBenchDisplayOrder,
  teamDecisionOrderBenchDisplay,
  teamDecisionAvailabilityPresentation,
  teamDecisionAnnotateAvailability,
  teamDecisionFocusResources,
  teamDecisionResourceBar,
  teamDecisionRelabelBench,
  teamDecisionSetStartupShellOwned
};