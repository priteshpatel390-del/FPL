import { S } from '../state.mjs';
import { $, num, fmt1, el, setChildren } from '../util.mjs';
import { mySquad, bestXI, sellPrice } from '../squad.mjs';
import { xpOf } from '../model/xp.mjs';
import { availability } from '../model/scoring.mjs';
import { teamFixtures } from '../model/fixtures.mjs';
import { getHealth, HEALTH_STATES } from '../providers/registry.mjs';
import { teamPitchCaptaincy, teamPitchLines, teamPitchPalette, teamPitchPaletteClass } from './team-pitch.mjs';
import {
  decisionPreviewSnapshot,
  decisionPreviewApplyTransferPlan,
  decisionPreviewClearAll,
  decisionPreviewClearTransfer,
  decisionPreviewClearCaptaincy,
  decisionPreviewSyncSquad,
  decisionPreviewBeginRole,
  decisionPreviewChooseRole,
  decisionPreviewEffectiveCaptaincy,
  decisionPreviewCaptainTotal
} from './decision-preview.mjs';

// Teamsheet 2.0.2 — presentation-only Team decision home.
// DTR-1 builds the accepted Team DOM directly. It does not own or alter
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

function teamDecisionNoteNode(kind,...children){
  return el('div',{class:`note${kind?' '+kind:''}`},children);
}

function teamDecisionFixtureLabel(player,gw){
  const games=teamFixtures(player.team,gw,1)[0]||[];
  return games.length?games.map(game=>`${game.opp.short_name} ${game.home?'H':'A'}`).join(' + '):'Blank';
}

function teamDecisionPlayerNode({slot,gw,effectiveCaptaincy,incomingIds,previewState,xiIds,benchRole='',openPlayerDetail,rerenderTeam}){
  const player=slot.p,team=S.teams[player.team],palette=teamPitchPalette(team),paletteClass=teamPitchPaletteClass(team);
  const role=player.id===effectiveCaptaincy.captainId?'captain':player.id===effectiveCaptaincy.viceId?'vice':null;
  const bad=availability(player)<1,incoming=incomingIds.has(Number(player.id));
  const selectable=!benchRole&&Boolean(previewState.selectionMode);
  const fixture=teamDecisionFixtureLabel(player,gw),projected=fmt1(xpOf(player,gw,1).total);
  const availabilityCopy=teamDecisionAvailabilityPresentation(player);
  let aria=selectable
    ?`Select ${player.web_name} as ${previewState.selectionMode==='captain'?'captain':'vice-captain'}`
    :`${benchRole?`${benchRole} bench, `:''}${player.web_name}, ${fixture}, ${projected} expected points${role==='captain'?', captain':role==='vice'?', vice-captain':''}${incoming?', incoming transfer preview':''}`;
  if(availabilityCopy) aria+=`, ${availabilityCopy.aria}`;
  return el('button',{type:'button',class:`pitch-player${benchRole?' bench-player':''}${bad?' warn':''}${incoming?' incoming':''}${selectable?' selection-target':''}`,
    onclick:event=>{
      if(selectable){
        decisionPreviewChooseRole(previewState.selectionMode,player.id,xiIds);
        rerenderTeam();
      }else openPlayerDetail(player,gw,1,event.currentTarget);
    },'aria-label':aria},
    el('div',{class:'shirt-wrap'},
      el('span',{class:`club-shirt pattern-${palette.pattern} ${paletteClass}`,'aria-hidden':'true'},el('span',{class:'club-shirt-code'},palette.code)),
      role?el('span',{class:`captain-badge${role==='vice'?' vice':''}${effectiveCaptaincy.isPreview?' preview':''}`},role==='captain'?'C':'VC'):null,
      incoming?el('span',{class:'incoming-badge'},'IN'):null),
    el('div',{class:'pitch-copy'},
      benchRole?el('span',{class:'bench-role'},benchRole):null,
      el('div',{class:'pitch-name'},player.web_name),
      availabilityCopy?el('span',{class:`flag ${availabilityCopy.className} pitch-availability`},availabilityCopy.label):null,
      el('div',{class:'pitch-meta'},fixture),
      el('div',{class:'pitch-xp'},`${projected} xP`)));
}

function teamDecisionStage({xi,gw,effectiveCaptaincy,incomingIds,previewState,openPlayerDetail,rerenderTeam}){
  const xiIds=xi.xi.map(slot=>Number(slot.p.id));
  const playerNode=(slot,benchRole='')=>teamDecisionPlayerNode({slot,gw,effectiveCaptaincy,incomingIds,previewState,xiIds,benchRole,openPlayerDetail,rerenderTeam});
  const formation=el('div',{class:'pitch-formation'},teamPitchLines(xi.xi).map(line=>
    el('div',{class:`pitch-line position-${line.position}`},line.players.map(slot=>playerNode(slot)))));
  const pitch=el('section',{class:'team-pitch','aria-label':`Model-selected starting eleven for Gameweek ${gw}`},
    el('span',{class:'pitch-mark pitch-centre-circle','aria-hidden':'true'}),
    el('span',{class:'pitch-mark pitch-box pitch-box-top','aria-hidden':'true'}),
    el('span',{class:'pitch-mark pitch-box pitch-box-bottom','aria-hidden':'true'}),formation);
  const orderedBench=teamDecisionBenchDisplayOrder(xi.bench);
  const bench=el('section',{class:'team-bench','aria-label':'Bench order'},
    el('div',{class:'bench-head'},el('strong',{},'Bench'),el('span',{},'Auto-sub order')),
    el('div',{class:'bench-grid'},orderedBench.map((slot,index)=>playerNode(slot,teamDecisionBenchLabel(index)))));
  return el('div',{class:'team-stage'},pitch,bench);
}

function teamDecisionPreviewBanner({previewState,realSquad,xi,gw,rerenderTeam,renderTransfers}){
  if(!previewState.transfer) return null;
  const currentXi=bestXI(realSquad,gw);
  const moves=previewState.transfer.transfers.map(move=>`${S.byId[move.outPlayerId]?.web_name||move.outPlayerId} → ${S.byId[move.inPlayerId]?.web_name||move.inPlayerId}`).join(' · ');
  return el('section',{class:'decision-preview-banner transfer-preview','aria-label':'Temporary transfer preview'},
    el('div',{},el('span',{class:'eyebrow'},'Preview only'),el('strong',{},moves),
      el('p',{},`Current squad ${fmt1(currentXi.tot)} xP → preview ${fmt1(xi.tot)} xP for GW${gw}. Optimiser net ${previewState.transfer.netGain>=0?'+':''}${fmt1(previewState.transfer.netGain)} over ${previewState.transfer.previewHorizon||1} GW${(previewState.transfer.previewHorizon||1)>1?'s':''} · hit −${previewState.transfer.hitCost} · £${fmt1(previewState.transfer.bankAfter/10)}m left · ${previewState.transfer.freeTransfersNextGW} FT next GW.`)),
    el('button',{type:'button',class:'btn ghost sm',onclick:()=>{
      decisionPreviewClearTransfer();
      rerenderTeam();
      renderTransfers();
    }},'Clear preview'));
}

function teamDecisionCaptainControls({previewState,modelCaptaincy,effectiveCaptaincy,captainTotal,xiIds,rerenderTeam}){
  const modelCaptain=S.byId[modelCaptaincy.captainId]?.web_name||'—',modelVice=S.byId[modelCaptaincy.viceId]?.web_name||'—';
  const previewCaptain=S.byId[effectiveCaptaincy.captainId]?.web_name||'—',previewVice=S.byId[effectiveCaptaincy.viceId]?.web_name||'—';
  return el('section',{class:'decision-preview-controls','aria-label':'Captain and vice-captain preview controls'},
    el('div',{class:'decision-preview-copy'},el('span',{class:'eyebrow'},'Captaincy'),
      el('strong',{},`Model: ${modelCaptain} C · ${modelVice} VC`),
      effectiveCaptaincy.isPreview
        ?el('p',{},`Preview: ${previewCaptain} C · ${previewVice} VC · captain uplift ${fmt1(captainTotal.uplift)} · total ${fmt1(captainTotal.total)}.`)
        :el('p',{},`Captain uplift ${fmt1(captainTotal.uplift)} · total with captain ${fmt1(captainTotal.total)}.`)),
    el('div',{class:'decision-preview-actions'},
      el('button',{type:'button',class:`btn ghost sm${previewState.selectionMode==='captain'?' active':''}`,'aria-pressed':previewState.selectionMode==='captain',onclick:()=>{
        decisionPreviewBeginRole('captain',modelCaptaincy); rerenderTeam();
      }},'Choose captain'),
      el('button',{type:'button',class:`btn ghost sm${previewState.selectionMode==='vice'?' active':''}`,'aria-pressed':previewState.selectionMode==='vice',onclick:()=>{
        decisionPreviewBeginRole('vice',modelCaptaincy); rerenderTeam();
      }},'Choose vice-captain'),
      effectiveCaptaincy.isPreview?el('button',{type:'button',class:'btn ghost sm',onclick:()=>{
        decisionPreviewClearCaptaincy(); rerenderTeam();
      }},'Reset captaincy'):null),
    previewState.selectionMode?el('p',{class:'selection-help',role:'status'},`Tap a starting player to choose ${previewState.selectionMode==='captain'?'captain':'vice-captain'}.`):null);
}

function teamDecisionCaptainSupport(capRank,gw,flagNodes){
  const heading=el('h3',{class:'section-title'},'Captaincy ranking');
  const grid=el('div',{class:'capgrid'});
  capRank.slice(0,4).forEach((candidate,index)=>{
    const games=teamFixtures(candidate.s.p.team,gw,1)[0]||[];
    const why=games.length?games.map(game=>`${game.home?'vs':'away to'} ${game.opp.short_name}`).join(' + ')+` · ${fmt1(candidate.x)} xP · ${candidate.own}% owned`:'no fixture';
    grid.appendChild(el('div',{class:`capcard ${index===0?'top':''}`},el('div',{class:'rank'},index+1),
      el('div',{class:'capbody'},el('span',{class:'pname'},candidate.s.p.web_name,flagNodes(candidate.s.p)),el('div',{class:'why'},why)),
      el('span',{class:`xp ${index===0?'hot':''}`},fmt1(candidate.x*2))));
  });
  return {heading,grid};
}

function teamDecisionAllSquadSupport(squad,gw,flagNodes,openPlayerDetail){
  const heading=el('h3',{class:'section-title'},'All 15 over 6 gameweeks');
  const tbody=el('tbody');
  const cell=(text,className='')=>el('td',className?{class:className}:{},text);
  const head=(text,className='')=>el('th',className?{class:className,scope:'col'}:{scope:'col'},text);
  squad.slice().sort((a,b)=>a.p.element_type-b.p.element_type||xpOf(b.p,gw,6).total-xpOf(a.p,gw,6).total).forEach(slot=>{
    const player=slot.p;
    const openButton=el('button',{type:'button',class:'player-row-action','aria-label':`Open ${player.web_name} player details`,onclick:event=>openPlayerDetail(player,gw,6,event.currentTarget)},
      el('span',{class:'pname'},player.web_name,flagNodes(player)),
      el('span',{class:'pmeta'},el('span',{class:'pos'},S.posName[player.element_type]||'?'),` ${S.teams[player.team]?.short_name||''}`));
    tbody.appendChild(el('tr',{},el('td',{},openButton),cell((player.now_cost/10).toFixed(1),'num'),cell((sellPrice(slot)/10).toFixed(1),'num'),
      cell(fmt1(num(player.form)),'num'),cell(fmt1(xpOf(player,gw,1).total),'num'),el('td',{class:'num'},el('span',{class:'xp'},fmt1(xpOf(player,gw,6).total)))));
  });
  const table=el('div',{class:'scroll'},el('table',{class:'data'},el('caption',{class:'sr-only'},`Current squad projections from GW${gw}`),
    el('thead',{},el('tr',{},head('Player'),head('£','num'),head('Sell','num'),head('Form','num'),head(`xP GW${gw}`,'num'),head('xP 6GW','num'))),tbody));
  const caveat=!$('useManual')?.checked&&S.picks
    ?teamDecisionNoteNode('plain',"Sell prices assume you bought at today's price — the public API doesn't expose purchase prices. Build the squad by hand if you want them exact.")
    :null;
  return {heading,table,caveat};
}

function renderTeamDecisionHome({openPlayerDetail=()=>{},flagNodes=()=>[],rerenderTeam=()=>{},renderTransfers=()=>{}}={}){
  if(typeof document==='undefined') return;
  teamDecisionUpdateManualAvailability();
  const out=$('squadOut'),support=$('teamHomeSupport')||teamDecisionSetupShell();
  if(!out||!support) return;
  const focus=teamDecisionCaptureFocus(out);
  const realSquad=mySquad();
  if(!realSquad.length) decisionPreviewClearAll();
  else decisionPreviewSyncSquad(realSquad);
  let previewState=decisionPreviewSnapshot();
  let applied=previewState.transfer?decisionPreviewApplyTransferPlan(realSquad,previewState.transfer,S.byId):{ok:true,squad:realSquad,incomingIds:[],outgoingIds:[]};
  if(previewState.transfer&&!applied.ok){
    decisionPreviewClearTransfer();
    previewState=decisionPreviewSnapshot();
    applied={ok:true,squad:realSquad,incomingIds:[],outgoingIds:[]};
  }
  const ready=teamDecisionSquadReady(realSquad);
  out.classList.toggle('team-home-ready',ready);
  setChildren(support);
  const health=getHealth('fpl',{seasonLive:S.seasonLive});
  const dataState=health?.state||(!S.boot?HEALTH_STATES.UNAVAILABLE:HEALTH_STATES.LIVE);
  const deadline=teamDecisionDeadlineModel();
  const manual=Boolean($('useManual')?.checked);
  const source=teamDecisionSourceLabel({manual,hasPicks:Boolean(S.picks?.picks),picksGameweek:S.picksGameweek,
    picksStatus:S.picksStatus,fplState:dataState,cachedAt:S.cachedAt});
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
    const action=teamDecisionAction({hasSquad:false,deadlinePassed:deadline.passed,riskKind:risk.kind,squadStatus:S.picksStatus,squadGameweek:S.picksGameweek});
    setChildren(out,
      teamDecisionHeader({title,eyebrow:'Team decision home',source,deadline:deadline.label,rank}),
      teamDecisionSummary({recommendation:'Recommendation unavailable',forecast:'No projection calculated',risk,action}),
      teamDecisionResourceBar({ft,bank}),
      teamDecisionPlaceholderStage(S.nextGW,'Empty Team pitch. No valid squad is available, so no XI, captaincy or bench recommendation has been calculated.'));
    teamDecisionRestoreFocus(out,focus);
    return;
  }

  const squad=applied.squad,incomingIds=new Set(applied.incomingIds),gw=S.nextGW,xi=bestXI(squad,gw);
  const visualCapRank=xi.xi.map(slot=>({s:slot,x:xpOf(slot.p,gw,1).total,own:num(slot.p.selected_by_percent)})).sort((a,b)=>b.x-a.x);
  const decisionCapRank=xi.xi.map(slot=>({s:slot,x:xpOf(slot.p,gw,1).total,own:num(slot.p.selected_by_percent)})).sort((a,b)=>b.x-a.x||Number(a.s.p.id)-Number(b.s.p.id));
  const visualModelCaptaincy=teamPitchCaptaincy(visualCapRank),decisionModelCaptaincy=teamPitchCaptaincy(decisionCapRank);
  const xiIds=xi.xi.map(slot=>Number(slot.p.id));
  const visualEffectiveCaptaincy=decisionPreviewEffectiveCaptaincy(visualModelCaptaincy,xiIds);
  const decisionEffectiveCaptaincy=decisionPreviewEffectiveCaptaincy(decisionModelCaptaincy,xiIds);
  const scoreById=Object.fromEntries(xi.xi.map(slot=>[slot.p.id,xpOf(slot.p,gw,1).total]));
  const visualCaptainTotal=decisionPreviewCaptainTotal(xi.tot,visualEffectiveCaptaincy.captainId,scoreById);
  const decisionCaptainTotal=decisionPreviewCaptainTotal(xi.tot,decisionEffectiveCaptaincy.captainId,scoreById);
  const forecast=teamDecisionForecast(xi.tot,decisionCaptainTotal.uplift);
  const captain=S.byId[decisionEffectiveCaptaincy.captainId],vice=S.byId[decisionEffectiveCaptaincy.viceId];
  const blankIds=xi.xi.filter(slot=>(teamFixtures(slot.p.team,gw,1)[0]||[]).length===0).map(slot=>slot.p.id);
  const close=decisionCapRank[1]&&decisionCapRank[0].x-decisionCapRank[1].x<0.6?{
    firstName:decisionCapRank[0].s.p.web_name,secondName:decisionCapRank[1].s.p.web_name,gap:decisionCapRank[0].x-decisionCapRank[1].x
  }:null;
  const risk=teamDecisionRisk({dataState,captain,starters:xi.xi.map(slot=>({p:slot.p,xp:xpOf(slot.p,gw,1).total})),blankIds,closeCaptain:close});
  previewState=decisionPreviewSnapshot();
  const previewActive=Boolean(previewState.transfer||decisionEffectiveCaptaincy.isPreview);
  const action=teamDecisionAction({hasSquad:true,deadlinePassed:deadline.passed,previewActive,riskKind:risk.kind});
  const bench=teamDecisionBenchDisplayOrder(xi.bench).map((slot,index)=>`${teamDecisionBenchLabel(index)} ${slot.p.web_name}`).join(' · ');
  const recommendation=`Start ${xi.shape}. ${captain?.web_name||'—'} captain, ${vice?.web_name||'—'} vice. Bench: ${bench}.`;
  const orderedBench=teamDecisionBenchDisplayOrder(xi.bench),event=S.boot?.events?.find(row=>Number(row.id)===Number(gw));
  if(event?.deadline_time&&globalThis.DI3_PARITY_RUNTIME){
    const deadline=new Date(event.deadline_time).toISOString(),bankTenths=Math.round(Number(bank)*10);
    void globalThis.DI3_PARITY_RUNTIME.recordTeam({basis:{season:FPL_RULES.season,gameweek:gw,eventId:gw,deadline,evaluationCutoff:deadline,sourceCommit:BUILD_INFO.commit,modelVersion:BUILD_INFO.modelVersion,rulesVersion:BUILD_INFO.rulesVersion,squadHash:`squad:${squad.map(slot=>Number(slot.p.id)).sort((a,b)=>a-b).join(',')}`,bank:bankTenths,freeTransfers:ft,priceBasis:squad.every(slot=>slot.bought!=null)?'exact':'estimated'},formation:xi.shape,xiPlayerIds:xi.xi.map(slot=>Number(slot.p.id)),benchPlayerIds:orderedBench.map(slot=>Number(slot.p.id)),xiExpectedPoints:Number(xi.tot),benchExpectedPoints:orderedBench.reduce((sum,slot)=>sum+Number(xpOf(slot.p,gw,1).total),0),captainId:Number(captain.id),captainExpectedPoints:Number(scoreById[captain.id]),viceId:Number(vice.id),viceExpectedPoints:Number(scoreById[vice.id])});
  }
  const forecastCopy=`${forecast.base.toFixed(1)} xP before captain · +${forecast.uplift.toFixed(1)} captain uplift · ${forecast.total.toFixed(1)} xP including captain.`;
  const header=teamDecisionHeader({title,eyebrow:previewActive?'User preview':'Model recommendation',source,deadline:deadline.label,rank});
  const summary=teamDecisionSummary({recommendation,forecast:forecastCopy,risk,action});
  const previewBanner=teamDecisionPreviewBanner({previewState,realSquad,xi,gw,rerenderTeam,renderTransfers});
  const stage=teamDecisionStage({xi,gw,effectiveCaptaincy:visualEffectiveCaptaincy,incomingIds,previewState,openPlayerDetail,rerenderTeam});
  const controls=teamDecisionCaptainControls({previewState,modelCaptaincy:visualModelCaptaincy,effectiveCaptaincy:visualEffectiveCaptaincy,
    captainTotal:visualCaptainTotal,xiIds,rerenderTeam});
  const actions=el('div',{class:'team-home-actions'},el('a',{class:'btn ghost',href:'#/transfers'},'Open Transfers'),
    el('a',{class:'btn ghost',href:'#/settings/team-account'},'Edit manual squad'));
  setChildren(out,header,summary,previewBanner,teamDecisionResourceBar({ft,bank}),stage,controls,actions);

  const captainSupport=teamDecisionCaptainSupport(visualCapRank,gw,flagNodes);
  const allSupport=teamDecisionAllSquadSupport(squad,gw,flagNodes,openPlayerDetail);
  const why=el('details',{class:'team-home-support'},el('summary',{},'Why this XI and captaincy'),
    el('div',{class:'team-home-support-body'},captainSupport.heading,captainSupport.grid,
      close?teamDecisionNoteNode('',teamDecisionCloseCaptainCopy(close.firstName,close.secondName,close.gap)):null));
  const all=el('details',{class:'team-home-support'},el('summary',{},'All 15 over six Gameweeks'),
    el('div',{class:'team-home-support-body'},allSupport.heading,allSupport.table,allSupport.caveat));
  setChildren(support,why,all);
  teamDecisionRestoreFocus(out,focus);
}

function teamDecisionInitialise(){
  if(typeof document==='undefined'||typeof BUILD_INFO==='undefined') return;
  teamDecisionSetupStartup();
  teamDecisionSetupShell();
}

teamDecisionInitialise();

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
  teamDecisionAvailabilityPresentation,
  teamDecisionFocusResources,
  teamDecisionResourceBar,
  teamDecisionSetStartupShellOwned,
  renderTeamDecisionHome
};
