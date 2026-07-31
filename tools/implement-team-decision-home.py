#!/usr/bin/env python3
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one occurrence in {path}, found {count}: {old[:100]!r}")
    write(path, content.replace(old, new, 1))


def regex_once(path: str, pattern: str, replacement: str, flags: int = 0) -> None:
    content = read(path)
    updated, count = re.subn(pattern, replacement, content, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"Expected one regex occurrence in {path}, found {count}: {pattern}")
    write(path, updated)


def append_once(path: str, marker: str, block: str) -> None:
    content = read(path)
    if marker in content:
        return
    if not content.endswith("\n"):
        content += "\n"
    write(path, content + "\n" + block.strip() + "\n")


def run(command: list[str], *, env: dict[str, str] | None = None, capture: bool = False) -> subprocess.CompletedProcess[str]:
    merged = os.environ.copy()
    if env:
        merged.update(env)
    print("+", " ".join(command), flush=True)
    result = subprocess.run(command, text=True, env=merged, capture_output=capture)
    if capture:
        sys.stdout.write(result.stdout)
        sys.stderr.write(result.stderr)
    if result.returncode:
        raise subprocess.CalledProcessError(result.returncode, command, result.stdout, result.stderr)
    return result


TEAM_HOME_MODULE = r'''import { S } from '../state.mjs';
import { $, num, el, setChildren } from '../util.mjs';
import { mySquad, bestXI } from '../squad.mjs';
import { xpOf } from '../model/xp.mjs';
import { getHealth, HEALTH_STATES } from '../providers/registry.mjs';
import { teamPitchCaptaincy } from './team-pitch.mjs';
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
const TEAM_DECISION_UNAVAILABLE = new Set(['i','u','s','n']);

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

function teamDecisionSourceLabel({manual=false,hasPicks=false,fplState='',cachedAt=null}={}){
  const state=String(fplState||'');
  let label=manual?'User-entered squad':hasPicks?'Official FPL public picks':'Squad unavailable';
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

function teamDecisionAction({hasSquad=false,deadlinePassed=false,previewActive=false,riskKind='none'}={}){
  if(deadlinePassed) return 'The Official FPL deadline has passed. Review this recommendation for context only.';
  if(!hasSquad) return 'Connect a Team ID or complete a legal manual 15-player squad to calculate the decision home.';
  if(previewActive) return 'Review this user preview and reproduce it in Official FPL before the deadline if you choose to act.';
  if(riskKind==='data-unavailable'||riskKind==='data-stale') return 'Check the data warning before acting. Previously verified content is not confirmation of a successful live refresh.';
  if(riskKind.includes('unavailable')||riskKind.includes('doubtful')) return 'Review the affected player. Open Transfers if a replacement is needed, then set the final XI, captaincy and bench in Official FPL.';
  return 'Review and set this XI, captaincy and bench in Official FPL. Use Transfers for the separate roll-or-transfer decision.';
}

function teamDecisionCloseCaptainCopy(firstName,secondName,gap){
  return `${firstName} and ${secondName} are separated by ${Number(gap).toFixed(1)} projected points. This is a close model call; ownership is context only and does not create a protect or chase recommendation.`;
}

function teamDecisionPlaceholderPlayer(label='—'){
  return el('div',{class:'pitch-player team-home-placeholder-player','aria-hidden':'true'},
    el('div',{class:'shirt-wrap'},
      el('span',{class:'club-shirt pattern-solid shirt-palette-fallback-3'},el('span',{class:'club-shirt-code'},'FPL'))),
    el('div',{class:'pitch-copy'},el('div',{class:'pitch-name'},label),el('div',{class:'pitch-meta'},'Awaiting squad'),el('div',{class:'pitch-xp'},'— xP')));
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
    el('div',{class:'bench-grid'},Array.from({length:4},(_,index)=>teamDecisionPlaceholderPlayer(String(index+1)))));
  return el('div',{class:'team-stage'},pitch,bench);
}

function teamDecisionMetaChip(text,kind='plain'){
  return el('span',{class:`team-home-chip ${kind}`},text);
}

function teamDecisionHeader({title,eyebrow,source,deadline,rank,ft,bank}){
  const chips=[teamDecisionMetaChip(source,'source')];
  if(deadline) chips.push(teamDecisionMetaChip(deadline,'deadline'));
  if(rank) chips.push(teamDecisionMetaChip(rank,'official'));
  chips.push(teamDecisionMetaChip(`${ft} FT · manual`,'manual'));
  chips.push(teamDecisionMetaChip(`£${bank}m bank · manual`,'manual'));
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

function teamDecisionSetupStartup(){
  if(typeof document==='undefined') return;
  const pitch=document.querySelector('#startupGate .startup-pitch');
  if(!pitch) return;
  pitch.classList.add('team-startup-lineup');
  pitch.setAttribute('aria-label','Preparing the Team decision pitch');
  const rows=[3,4,3,1].map((count,index)=>el('div',{class:`team-startup-row row-${index+1}`},
    Array.from({length:count},()=>el('span',{'aria-hidden':'true'},'○'))));
  setChildren(pitch,rows);
  const sub=document.querySelector('#startupGate .startup-sub');
  if(sub) sub.textContent='Preparing your decision home';
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
    teamView.insertBefore(context,out.nextSibling);
  }
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
  const source=teamDecisionSourceLabel({manual,hasPicks:Boolean(S.picks?.picks),fplState:dataState,cachedAt:S.cachedAt});
  const ft=Math.max(0,Math.trunc(num($('ftCount')?.value)));
  const bank=Math.max(0,num($('bankIn')?.value)).toFixed(1);
  const rank=Number(S.entry?.summary_overall_rank)>0?`Official OR ${Number(S.entry.summary_overall_rank).toLocaleString('en-GB')}`:'';
  const title=`${S.entry?.name||'Your team'} · GW${S.nextGW}`;

  if(!ready){
    const count=realSquad.length;
    const risk=dataState===HEALTH_STATES.UNAVAILABLE
      ? teamDecisionRisk({dataState})
      : Object.freeze({kind:'squad-unavailable',level:'blocking',text:count?`${count} of 15 players are available. A complete legal squad is required before Teamsheet can recommend an XI.`:'No usable 15-player squad is available.'});
    const action=teamDecisionAction({hasSquad:false,deadlinePassed:deadline.passed,riskKind:risk.kind});
    const header=teamDecisionHeader({title,eyebrow:'Team decision home',source,deadline:deadline.label,rank,ft,bank});
    const summary=teamDecisionSummary({recommendation:'Recommendation unavailable',forecast:'No projection calculated',risk,action});
    const placeholder=teamDecisionPlaceholderStage(S.nextGW,'Empty Team pitch. No valid squad is available, so no XI, captaincy or bench recommendation has been calculated.');
    setChildren(out,header,summary,placeholder);
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
  const bench=xi.bench.map((slot,index)=>`${index+1} ${slot.p.web_name}`).join(' · ');
  const recommendation=`Start ${xi.shape}. ${captain?.web_name||'—'} captain, ${vice?.web_name||'—'} vice. Bench: ${bench}.`;
  const forecastCopy=`${forecast.base.toFixed(1)} xP before captain · +${forecast.uplift.toFixed(1)} captain uplift · ${forecast.total.toFixed(1)} xP including captain.`;
  const header=teamDecisionHeader({title,eyebrow:previewActive?'User preview':'Model recommendation',source,deadline:deadline.label,rank,ft,bank});
  const summary=teamDecisionSummary({recommendation,forecast:forecastCopy,risk,action});

  const children=Array.from(out.children);
  const previewBanner=children.find(node=>node.classList?.contains('decision-preview-banner'))||null;
  const controls=children.find(node=>node.classList?.contains('decision-preview-controls'))||null;
  const stage=children.find(node=>node.classList?.contains('team-stage'))||null;
  const captainHeading=children.find(node=>node.matches?.('h3.section-title')&&node.textContent.trim()==='Captaincy ranking')||null;
  const captainGrid=captainHeading?.nextElementSibling?.classList?.contains('capgrid')?captainHeading.nextElementSibling:null;
  const allHeading=children.find(node=>node.matches?.('h3.section-title')&&node.textContent.trim().startsWith('All 15'))||null;
  const allTable=allHeading?.nextElementSibling?.classList?.contains('scroll')?allHeading.nextElementSibling:null;
  const finalCaveat=allTable?.nextElementSibling?.classList?.contains('note')?allTable.nextElementSibling:null;

  const actions=el('div',{class:'team-home-actions'},
    el('a',{class:'btn ghost',href:'#/transfers'},'Open Transfers'),
    el('a',{class:'btn ghost',href:'#/settings/team-account'},'Edit manual squad'));
  setChildren(out,header,summary,previewBanner,stage,controls,actions);

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
  teamDecisionForecast,
  teamDecisionSquadReady,
  teamDecisionSourceLabel,
  teamDecisionRisk,
  teamDecisionAction,
  teamDecisionCloseCaptainCopy
};
'''

TEAM_HOME_TEST = r'''import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TEAM_DECISION_HOME_VERSION,
  teamDecisionForecast,
  teamDecisionSquadReady,
  teamDecisionSourceLabel,
  teamDecisionRisk,
  teamDecisionAction,
  teamDecisionCloseCaptainCopy
} from '../src/ui/team-decision-home.mjs';
import { HEALTH_STATES } from '../src/providers/registry.mjs';

const player=(id,pos,status='a',chance=100,xp=5)=>({p:{id,element_type:pos,status,chance_of_playing_next_round:chance,web_name:`P${id}`},xp});
const legalSquad=()=>[
  player(1,1),player(2,1),
  ...Array.from({length:5},(_,i)=>player(10+i,2)),
  ...Array.from({length:5},(_,i)=>player(20+i,3)),
  ...Array.from({length:3},(_,i)=>player(30+i,4))
];

test('Team decision home is versioned as the approved checkpoint',()=>{
  assert.equal(TEAM_DECISION_HOME_VERSION,'2.0.2');
});

test('forecast keeps starting-XI points and captain uplift explicit',()=>{
  assert.deepEqual(teamDecisionForecast(54.2,7.4),{base:54.2,uplift:7.4,total:61.6});
});

test('only a complete legal FPL squad can produce the decision home',()=>{
  assert.equal(teamDecisionSquadReady(legalSquad()),true);
  assert.equal(teamDecisionSquadReady(legalSquad().slice(0,14)),false);
  const illegal=legalSquad(); illegal[14]=player(99,3);
  assert.equal(teamDecisionSquadReady(illegal),false);
});

test('source wording separates Official FPL, manual and verified fallback states',()=>{
  assert.equal(teamDecisionSourceLabel({manual:true,hasPicks:true,fplState:HEALTH_STATES.LIVE}),'User-entered squad');
  assert.equal(teamDecisionSourceLabel({hasPicks:true,fplState:HEALTH_STATES.LIVE}),'Official FPL public picks');
  assert.match(teamDecisionSourceLabel({hasPicks:true,fplState:HEALTH_STATES.FALLBACK,cachedAt:1_700_000_000_000}),/Official FPL public picks · verified fallback/);
});

test('risk priority protects data integrity, captaincy and selected starters in that order',()=>{
  assert.equal(teamDecisionRisk({dataState:HEALTH_STATES.UNAVAILABLE}).kind,'data-unavailable');
  assert.equal(teamDecisionRisk({dataState:HEALTH_STATES.FALLBACK}).kind,'data-stale');
  const starters=[player(1,3,'i',0,8),player(2,3,'d',50,9),player(3,3,'a',100,7)];
  assert.equal(teamDecisionRisk({dataState:HEALTH_STATES.LIVE,captain:{id:1},starters}).kind,'captain-unavailable');
  assert.equal(teamDecisionRisk({dataState:HEALTH_STATES.LIVE,captain:{id:3},starters}).kind,'starter-unavailable');
});

test('close captaincy is uncertainty context, not protect or chase strategy',()=>{
  const risk=teamDecisionRisk({dataState:HEALTH_STATES.LIVE,starters:[player(1,3),player(2,3)],closeCaptain:{firstName:'A',secondName:'B',gap:0.4}});
  assert.equal(risk.kind,'close-captaincy');
  const copy=teamDecisionCloseCaptainCopy('A','B',0.4);
  assert.match(copy,/close model call/);
  assert.doesNotMatch(copy,/protects your rank|rank-climbing play/);
});

test('clear Team state does not pretend the transfer optimiser has recommended a roll',()=>{
  const risk=teamDecisionRisk({dataState:HEALTH_STATES.LIVE,starters:[player(1,3)],captain:{id:1}});
  assert.equal(risk.kind,'none');
  assert.doesNotMatch(risk.text,/transfer|roll/i);
  const action=teamDecisionAction({hasSquad:true,riskKind:risk.kind});
  assert.match(action,/Use Transfers for the separate roll-or-transfer decision/);
});

test('deadline actions remain advisory and distinguish user previews',()=>{
  assert.match(teamDecisionAction({hasSquad:true,previewActive:true}),/user preview/);
  assert.match(teamDecisionAction({hasSquad:true,deadlinePassed:true}),/deadline has passed/);
  assert.doesNotMatch(teamDecisionAction({hasSquad:true}),/submitted|changed your FPL/i);
});

test('production wiring wraps the verified renderer without changing model modules or routes',()=>{
  const source=readFileSync(new URL('../src/ui/team-decision-home.mjs',import.meta.url),'utf8');
  const build=readFileSync(new URL('../build.mjs',import.meta.url),'utf8');
  const app=readFileSync(new URL('../app.html',import.meta.url),'utf8');
  assert.match(source,/const legacyRenderSquad=renderSquad/);
  assert.match(source,/legacyRenderSquad\(\)/);
  assert.match(source,/teamDecisionPlaceholderStage/);
  assert.match(source,/Open Transfers/);
  assert.match(source,/User-entered squad|Official FPL public picks/);
  assert.match(build,/src\/ui\/team-decision-home\.mjs/);
  assert.match(app,/Teamsheet 2\.0\.2 — pitch-first Team decision home/);
  assert.doesNotMatch(source,/optimiseTransfers\(|simulatePlayerGameweek\(|localStorage|sessionStorage|sset\(/);
});
'''

TEAM_HOME_CSS = r'''
/* Teamsheet 2.0.2 — pitch-first Team decision home */
#view-squad>.hint{margin:3px 0 8px}
.team-home-header{display:grid;gap:7px;margin:2px 0 10px}
.team-home-header h3{font-size:19px}
.team-home-chips{display:flex;gap:6px;flex-wrap:wrap}
.team-home-chip{display:inline-flex;align-items:center;min-height:26px;padding:4px 8px;border:1px solid var(--line);border-radius:20px;background:#F7F9F5;color:var(--ink-soft);font-family:'IBM Plex Mono',monospace;font-size:9.5px;line-height:1.15}
.team-home-chip.source{background:#EAF0EB;color:var(--pitch)}
.team-home-chip.deadline{background:#FCF8EF;color:#745614}
.team-home-chip.official{background:#E5EEF5;color:var(--info)}
.team-home-chip.manual{background:#F2EDEE;color:var(--claret)}
.team-home-decision{display:grid;border:1px solid var(--line);border-radius:14px;background:#fff;box-shadow:var(--shadow);overflow:hidden;margin-bottom:10px}
.team-home-row{display:grid;grid-template-columns:minmax(92px,112px) minmax(0,1fr);gap:9px;padding:9px 11px;border-bottom:1px solid #EDEFEA;align-items:start}
.team-home-row:last-of-type{border-bottom:0}
.team-home-row-label{font-family:'IBM Plex Mono',monospace;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft)}
.team-home-row-value{font-size:12.5px;font-weight:600;overflow-wrap:anywhere}
.team-home-row.risk-blocking{background:#FBF0F2}.team-home-row.risk-warning{background:#FCF8EF}.team-home-row.risk-clear{background:#EFF6F1}
.team-home-row.deadline-action{background:#F7F9F5}
.team-home-advisory{margin:0;padding:7px 11px;border-top:1px solid var(--line);font-size:10px}
.team-home-ready .team-stage{margin-top:8px}
.team-home-ready .pitch-player{min-height:76px}
.team-home-ready .pitch-name{font-size:10px}
.team-home-ready .pitch-meta{font-size:8px}
.team-home-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0 2px}
.team-home-actions .btn{text-align:center;text-decoration:none;display:grid;place-items:center}
.team-home-support-host{margin-top:12px}
.team-home-support{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--shadow);padding:11px 13px;margin-bottom:10px}
.team-home-support>summary{min-height:44px;display:flex;align-items:center;color:var(--ink);font-family:'Bricolage Grotesque',sans-serif;font-size:14px;font-weight:800}
.team-home-support-body{padding-top:7px}
.team-home-support-body>.section-title:first-child{margin-top:0}
.team-home-placeholder{filter:saturate(.55);opacity:.92}
.team-home-placeholder-player{pointer-events:none;min-height:70px}
.team-home-placeholder-player .pitch-copy{background:rgba(255,255,255,.8)}
.team-home-placeholder-player .club-shirt{opacity:.68}
.team-startup-lineup{width:132px;height:176px;display:grid;grid-template-rows:repeat(4,1fr);align-items:center;padding:13px 10px;margin-top:4px}
.team-startup-row{display:flex;justify-content:space-evenly;align-items:center;color:rgba(255,255,255,.72);font-size:13px;line-height:1}
.team-startup-row span{display:grid;place-items:center;width:16px;height:16px;border:1px solid rgba(255,255,255,.46);border-radius:50%;font-size:0}
.team-startup-row span:after{content:'';width:7px;height:9px;border-radius:3px;background:rgba(255,255,255,.45)}
#teamContext{margin-top:12px;margin-bottom:0}
@media(max-width:420px){
  .team-home-row{grid-template-columns:86px minmax(0,1fr);padding:8px 9px;gap:7px}
  .team-home-row-value{font-size:12px}
  .team-home-actions{grid-template-columns:1fr}
  .team-home-ready .pitch-name{font-size:10px}.team-home-ready .pitch-meta{font-size:8px}.team-home-ready .pitch-xp{font-size:9px}
}
@media(prefers-reduced-motion:reduce){.team-startup-lineup *{animation:none;transition:none}}
'''

ITEM2_DOC = r'''# TEAMSHEET2-ITEM2.md — Team Decision Home

Status: **Owner-approved implementation completed on the dedicated 2.0.2 branch; awaiting physical iPhone review and merge approval.**

Purpose: record the exact Teamsheet 2.0.2 presentation boundary, behaviour, exclusions and verification requirements.

## Outcome

Team is now a pitch-first decision home. The existing legal best XI, captain, vice-captain, bench order, deterministic projections and session-only previews are presented in one compact hierarchy without changing their calculations.

The route leads with:

1. Team identity, Gameweek, data/squad provenance, deadline, overall rank where available, manual free transfers and manual bank.
2. One decision summary covering the recommended XI, captaincy, bench, forecast, main risk and deadline action.
3. The existing football pitch and attached bench.
4. Existing preview controls and links to Transfers or manual squad setup.
5. Team setup/resources and collapsed supporting captaincy/all-15 detail.

## State contract

- A football pitch remains visible for connected, unconnected, invalid, incomplete-manual and unavailable-data states.
- Placeholder shirts are decorative and never imply a calculated XI.
- A recommendation requires a complete legal 15-player squad.
- Squad provenance is labelled as Official FPL public picks, user-entered squad, verified cache/fallback or unavailable.
- Free transfers and bank remain editable manual inputs pending the separate account-authority checkpoint.
- Previously verified core data remains usable under the existing Stage 10.1 fallback boundary; foreground interaction locking is unchanged.

## Decision summary contract

- `Starting XI xP` is the unchanged deterministic legal-XI total before captain doubling.
- `Captain uplift` is the unchanged selected captain next-Gameweek xP.
- `Including captain` is their explicit sum.
- A transfer or captaincy preview is labelled `User preview`; it does not replace or persist the model recommendation.
- The main risk uses a presentation-only priority over existing data state, official availability/blank facts and the existing close-captaincy display boundary.
- A clear Team state does not claim the optimiser recommends rolling. The manager is directed to Transfers for the separate zero-transfer comparison.
- Ownership is context only. No protect, balanced, chase or rank-climbing strategy is inferred.

## Accessibility and mobile contract

- Team route focus remains owned by the 2.0.1 hash router.
- Decision text precedes the pitch in assistive-technology order.
- Pitch players remain real buttons with full captain/vice, fixture, xP and availability labels.
- Empty placeholders are one labelled image rather than fifteen meaningless controls.
- Risk and deadline action do not depend on colour.
- Focus is restored where possible after a rerendered preview interaction.
- Touch targets, safe-area dock behaviour, software-keyboard recovery and reduced-motion behaviour are preserved.

## Explicit exclusions

No projection, expected-minutes, fixture, captaincy, bench, squad, simulation, optimiser, rank, league, provider, authentication, bank/free-transfer authority, foreground-refresh, persistence, route, player-detail, framework or dependency behaviour changes.

## Verification

- `./run-tests.sh`: **__TEST_COUNT__/__TEST_COUNT__ tests passing**.
- Production build successful under the exact verified source commit.
- Two same-identity builds byte-identical for `dist/index.html`, `dist/app.bundle.js` and `dist/manifest.json`.
- Root `index.html` identical to `dist/index.html`.
- Model/rules remain `2.4.0` / `2026-27.3`.
- Physical populated/unconnected/loading iPhone acceptance remains required before merge.
'''


def apply_source_changes() -> list[str]:
    if Path('src/ui/team-decision-home.mjs').exists():
        raise RuntimeError('Teamsheet 2.0.2 source already exists; refusing to apply twice')

    write('src/ui/team-decision-home.mjs', TEAM_HOME_MODULE)
    write('tests/team-decision-home.test.mjs', TEAM_HOME_TEST)
    write('docs/TEAMSHEET2-ITEM2.md', ITEM2_DOC)

    replace_once(
        'build.mjs',
        "  'src/ui/views.mjs', 'src/ui/transfer-optimiser-view.mjs', 'src/ui/backtest-copy.mjs',",
        "  'src/ui/views.mjs', 'src/ui/team-decision-home.mjs', 'src/ui/transfer-optimiser-view.mjs', 'src/ui/backtest-copy.mjs',"
    )

    app = read('app.html')
    if 'Teamsheet 2.0.2 — pitch-first Team decision home' in app:
        raise RuntimeError('2.0.2 stylesheet already present')
    write('app.html', app.replace('\n</style>', TEAM_HOME_CSS + '\n</style>', 1))

    views = read('src/ui/views.mjs')
    views, count = re.subn(
        r"else nodes\.push\(noteNode\('good','No injuries, suspensions, blanks or price falls in your 15\. Nothing forces a transfer this week\.'\)\);",
        "else nodes.push(noteNode('good','No injuries, suspensions or blanks were found in your 15. Use Transfers for the separate roll or transfer decision.'));",
        views,
        count=1
    )
    if count != 1:
        raise RuntimeError('Could not replace unsupported no-transfer wording')
    views, count = re.subn(
        r"if\(c2&&\(c1\.x-c2\.x\)<\.6\)\{ const safer=c1\.own>=c2\.own\?c1:c2; nodes\.push\(noteNode\('',`\$\{c1\.s\.p\.web_name\} and \$\{c2\.s\.p\.web_name\} are within half a point — effectively a coin toss\. \$\{safer\.s\.p\.web_name\} is the higher-owned pick at \$\{safer\.own\}%, so it protects your rank; the other is the rank-climbing play\.`\)\); \}",
        "if(c2&&(c1.x-c2.x)<.6){ nodes.push(noteNode('',teamDecisionCloseCaptainCopy(c1.s.p.web_name,c2.s.p.web_name,c1.x-c2.x))); }",
        views,
        count=1
    )
    if count != 1:
        raise RuntimeError('Could not replace unsupported captain strategy wording')
    write('src/ui/views.mjs', views)

    regex_once(
        'CLAUDE.md',
        r"## Current checkpoint\n.*?\n\n## Non-negotiable rules",
        """## Current checkpoint
Teamsheet 2.0.2 — Team decision home is implemented on the owner-approved presentation-only boundary: immediate pitch, concise XI/captain/bench forecast, one material risk, deadline action, honest setup/degraded states and progressive supporting detail. Existing model, provider, refresh, account and preview contracts remain unchanged. The next separately designed checkpoint is **Teamsheet 2.0.3 — Transfer decision experience**. Stage 10 collection and evaluation infrastructure remains complete; prospective validation is still in progress. The verified Teamsheet 2.0.2 baseline is **__TEST_COUNT__/__TEST_COUNT__ tests** with deterministic exact-identity builds and root/deployable equality.

## Non-negotiable rules""",
        re.S
    )

    project = read('docs/PROJECT_CONTEXT.md')
    needle = '- Teamsheet 2.0.1 implements hash routing, browser history/deep links, Team/Transfers/Fixtures/Leagues/Settings navigation and the five-section Settings hierarchy without changing formulas or providers. Verified baseline: **445/445 tests** with deterministic exact-identity builds and root/deployable equality.\n'
    if needle not in project:
        raise RuntimeError('PROJECT_CONTEXT 2.0.1 baseline bullet not found')
    project = project.replace(needle, needle + '- Teamsheet 2.0.2 implements the pitch-first Team decision home, concise XI/captain/bench forecast, presentation-only priority risk, advisory deadline action, honest placeholder/degraded states and progressive supporting detail. It changes no formula, provider, route, persistence, account or preview contract. Verified baseline: **__TEST_COUNT__/__TEST_COUNT__ tests** with deterministic exact-identity builds and root/deployable equality.\n', 1)
    project = re.sub(r"Next development item: \*\*Teamsheet 2\.0\.2 — Team decision home\.\*\*.*?\n", "Next development item: **Teamsheet 2.0.3 — Transfer decision experience.** Teamsheet 2.0.2 is implemented and verified on its approved presentation-only boundary; later work remains separately gated and must not be pulled forward.\n", project, count=1)
    project = re.sub(r"## Approval and implementation boundary\n.*$", """## Approval and implementation boundary
Teamsheet 2.0.2 changes Team presentation only. It preserves recommendation formulas, provider behaviour, foreground-refresh locking, manual bank/free-transfer inputs, player detail, Transfers, rank and League intelligence. Teamsheet 2.0.3 is the next separate design and approval gate. Prospective validation remains in progress, and the verified engineering baseline is **__TEST_COUNT__/__TEST_COUNT__ tests** with deterministic exact-identity builds.
""", project, count=1, flags=re.S)
    write('docs/PROJECT_CONTEXT.md', project)

    architecture = read('docs/ARCHITECTURE.md')
    architecture = architecture.replace('full current-session detail under More', 'full current-session detail under Settings → Data & Diagnostics')
    architecture = architecture.replace('remains subordinate under the implemented More → Deadline evidence route', 'remains subordinate under Settings → Evidence & Performance')
    write('docs/ARCHITECTURE.md', architecture)
    append_once('docs/ARCHITECTURE.md', '## Teamsheet 2.0.2 Team decision-home boundary', r'''
## Teamsheet 2.0.2 Team decision-home boundary

`ui/team-decision-home.mjs` wraps the existing verified `renderSquad()` output and reorganises its already-calculated nodes. It consumes unchanged `mySquad()`, `bestXI()`, `xpOf()`, team-pitch captaincy and session-preview contracts. It adds no football formula and does not invoke the transfer optimiser or simulation engine.

The wrapper requires a complete legal 15 before exposing a recommendation; otherwise it renders a labelled decorative pitch placeholder. Connected/manual/cache/preview provenance, base-XI xP, captain uplift, total including captain, one presentation-priority risk and an advisory deadline action are explicit. Team setup remains after the immediate pitch, while captaincy and all-15 research are collapsed progressively.

The existing Stage 10.1 verified startup and foreground interaction lock are unchanged. Official FPL transport reliability, authoritative bank/free-transfer retrieval and atomic non-blocking foreground refresh remain separately gated.
''')

    append_once('docs/DECISIONS.md', '**D-30 · 2026-07-31 · Accepted · Teamsheet 2.0.2 pitch-first Team decision home**', r'''
**D-30 · 2026-07-31 · Accepted · Teamsheet 2.0.2 pitch-first Team decision home**
Reason: the verified Team route had a strong pitch, best-XI, captaincy, bench and preview foundation, but setup, forecast and warning blocks pushed the pitch down and no-squad states removed it entirely. Existing copy also overstated the transfer conclusion and inferred protect/chase captain strategy from ownership.

Approach: wrap the unchanged Team renderer with a presentation-only decision hierarchy. Show provenance, recommended XI/captain/vice/bench, explicit base-XI and captain-uplift forecast, one material risk, advisory deadline action and the immediate pitch. Preserve a labelled placeholder pitch when a legal 15 is unavailable. Move setup and supporting detail below the immediate decision. Treat close captaincy as model uncertainty; ownership remains context only. Direct the separate roll/transfer decision to Transfers.

Consequences: no projection, expected-minutes, fixture, squad, captaincy, bench, simulation, optimiser, rank, league, provider, authentication, refresh, persistence, route or player-detail behaviour changes. D-21's historical More placement is superseded by D-29's Settings architecture; its provider-state principle remains valid. Verified baseline: **__TEST_COUNT__/__TEST_COUNT__ tests**, deterministic exact-identity builds, root/deployable equality, model `2.4.0`, rules `2026-27.3`.
''')

    roadmap = read('docs/ROADMAP.md')
    roadmap = re.sub(r"## Current\n.*?\n## Teamsheet 2\.0 migration sequence", """## Current
- **Teamsheet 2.0.1 — Navigation and Settings architecture** · MERGED through PR #48 at `0ed9c89c63852fe9d97d0e1ffcc64660228aeb7b`.
- **Teamsheet 2.0.2 — Team decision home** · IMPLEMENTED AND VERIFIED FOR OWNER REVIEW.
  - Pitch remains immediate in connected, unconnected, incomplete and unavailable states.
  - Existing XI, captaincy, bench, deterministic forecast and session previews are presented through one concise decision hierarchy.
  - Official/manual/cache/preview provenance, one material risk and advisory deadline action are explicit.
  - No formula, provider, refresh, authentication, bank/free-transfer authority, route or persistence change.
  - Verified baseline: **__TEST_COUNT__/__TEST_COUNT__ tests**, deterministic exact-identity builds and root/deployable equality.
- **Live-season readiness and prospective validation** remains operational. Genuine pre-deadline evidence collection begins with the 2026/27 season.
- The next development checkpoint is **Teamsheet 2.0.3 — Transfer decision experience**, requiring separate investigation, design and explicit approval.

## Teamsheet 2.0 migration sequence""", roadmap, count=1, flags=re.S)
    roadmap = roadmap.replace('1. **Teamsheet 2.0.1 — Navigation and Settings architecture** · COMPLETE FOR REVIEW.', '1. **Teamsheet 2.0.1 — Navigation and Settings architecture** · COMPLETE AND MERGED.')
    roadmap = roadmap.replace('2. **Teamsheet 2.0.2 — Team decision home**\n   - Make the pitch immediately visible and add XI, captaincy, bench, projection, risk and deadline-action summaries.', '2. **Teamsheet 2.0.2 — Team decision home** · COMPLETE FOR OWNER REVIEW.\n   - Pitch-first connected/setup/degraded states with unchanged XI, captaincy, bench and projection logic.\n   - Concise forecast, one material risk, advisory deadline action and progressive detail.')
    roadmap = re.sub(r"## Upcoming\n.*?\n## Current blockers and gates", """## Upcoming
1. Owner physical iPhone review and merge decision for Teamsheet 2.0.2.
2. Design Teamsheet 2.0.3 without pulling forward rank, League intelligence, provider or account-authority changes.
3. Operate pre-deadline snapshots and durable owner-controlled exports during the 2026/27 season.
4. Complete checkpoint-specific iPhone checks and the final Teamsheet 2.0.7 end-to-end rehearsal.
5. Collect official outcomes and descriptive metrics prospectively; do not claim accuracy or calibration until approved sample safeguards are met.

## Current blockers and gates""", roadmap, count=1, flags=re.S)
    roadmap = roadmap.replace('1. Teamsheet 2.0.2 has no approved implementation design.', '1. Teamsheet 2.0.3 has no approved implementation design.')
    roadmap = roadmap.replace('3. Teamsheet 2.0.1 automated checks cannot independently prove physical iPhone rendering; owner device acceptance remains required before merge.', '3. Teamsheet 2.0.2 automated checks cannot independently prove pitch position, text scaling, VoiceOver order or thumb comfort on the physical iPhone; owner acceptance remains required before merge.')
    write('docs/ROADMAP.md', roadmap)

    limitations = read('docs/KNOWN_LIMITATIONS.md')
    limitations = re.sub(r"^\| UI-4 \|.*$", '| UI-4 | The Team screen did not provide the complete approved decision-home summary | Pitch-first hierarchy, XI/captain/bench forecast, one material risk, deadline action and honest setup/degraded states are implemented without calculation changes | Teamsheet 2.0.2 | **CLOSED and verified 2026-07-31** |', limitations, count=1, flags=re.M)
    limitations = re.sub(r"^\| UI-6 \|.*$", '| UI-6 | First Teamsheet 2.0.1 physical iPhone review found dock, icon, focus and Settings-header defects | Approved corrections were implemented and merged through PR #48; populated-data transport remains tracked separately by FPL-1 | Teamsheet 2.0.1 | **CLOSED and merged 2026-07-31** |', limitations, count=1, flags=re.M)
    ui6='| UI-6 | First Teamsheet 2.0.1 physical iPhone review found dock, icon, focus and Settings-header defects | Approved corrections were implemented and merged through PR #48; populated-data transport remains tracked separately by FPL-1 | Teamsheet 2.0.1 | **CLOSED and merged 2026-07-31** |'
    ui7='| UI-7 | Teamsheet 2.0.2 physical iPhone acceptance is not yet recorded | Automated contracts cover hierarchy, states, wording, accessibility and build integrity, but physical pitch position, text scaling, VoiceOver order and one-handed comfort require owner review | Teamsheet 2.0.2 review / 2.0.7 | Open (acceptance gate) |'
    if ui7 not in limitations:
        limitations=limitations.replace(ui6,ui6+'\n'+ui7,1)
    write('docs/KNOWN_LIMITATIONS.md', limitations)

    testing = read('docs/TESTING.md')
    testing = re.sub(r"Teamsheet 2\.0\.1 verification completes \*\*445/445 passing tests\*\*.*?Stage 10\.5 428-test baseline\.", "Teamsheet 2.0.2 verification completes **__TEST_COUNT__/__TEST_COUNT__ passing tests**, a successful production build, byte-identical two-build artefact verification, exact build identity and root/deployable equality. It changes Team presentation only; model/provider correctness continues to rely on the preserved suites and the Stage 10.5 428-test baseline.", testing, count=1)
    nav_line="26. `navigation-settings.test.mjs` — primary order, hash normalisation, legacy aliases, safe fallback, Settings hierarchy, Team resource relocation, Fixtures/Leagues promotion, Ask Teamsheet access, shortcut routes and removal of legacy click-to-hide navigation."
    if nav_line not in testing:
        raise RuntimeError('TESTING navigation suite line not found')
    testing=testing.replace(nav_line,nav_line+'\n27. `team-decision-home.test.mjs` — legal-squad gating, Official/manual/cache provenance, explicit base-XI/captain forecast, risk priority, advisory deadline actions, neutral close-captaincy wording, placeholder pitch and presentation-only wiring.',1)
    write('docs/TESTING.md', testing)
    append_once('docs/TESTING.md', '## Teamsheet 2.0.2 Team decision-home verification', r'''
## Teamsheet 2.0.2 Team decision-home verification

The Teamsheet 2.0.2 baseline is **__TEST_COUNT__/__TEST_COUNT__ tests** with zero failures and zero skipped. Coverage verifies legal-15 gating, immediate placeholder/connected pitch structure, explicit provenance, base XI plus captain uplift arithmetic, deterministic material-risk priority, advisory/no-submission deadline wording, preview distinction, neutral ownership context, preserved routes and absence of model/optimiser/persistence calls from the presentation wrapper.

Completion also requires two byte-identical builds using the exact verified source commit, root/deployable equality and the existing CSP/build-identity suites. Automated checks cannot prove physical iPhone pitch position, text scaling, VoiceOver order or thumb comfort.
''')

    item1=read('docs/TEAMSHEET2-ITEM1.md')
    item1=item1.replace('Status: **Approved by Pritesh on 31 July 2026 and implemented for review.**','Status: **Approved by Pritesh, implemented and merged through PR #48 on 31 July 2026.**',1)
    write('docs/TEAMSHEET2-ITEM1.md',item1)

    iphone=read('docs/TEAMSHEET2-ITEM1-IPHONE-REVIEW.md')
    iphone=iphone.replace('Status: **Owner findings recorded 31 July 2026. Interface corrections approved for implementation; data/security items remain investigation only.**','Status: **Owner findings recorded and approved interface corrections merged through PR #48 on 31 July 2026. Data/security items remain separately gated.**',1)
    iphone=re.sub(r"## Remaining acceptance gate\n.*$", """## Post-merge status

The approved dock, icon, focus, Ask and Settings-hierarchy corrections are merged. Populated Official FPL acceptance remains blocked by FPL-1 and is not evidence that PR #48 failed its approved navigation scope. Foreground refresh and authoritative bank/free-transfer behaviour remain separate investigations.
""",iphone,count=1,flags=re.S)
    write('docs/TEAMSHEET2-ITEM1-IPHONE-REVIEW.md',iphone)

    blueprint=read('docs/TEAMSHEET2-PRODUCT-BLUEPRINT.md')
    marker='### Teamsheet 2.0.2 — Team decision home\n'
    if marker not in blueprint:
        raise RuntimeError('Blueprint 2.0.2 marker not found')
    blueprint=blueprint.replace(marker,marker+'\nImplementation status: **owner-approved presentation scope implemented and verified for review on 31 July 2026.** Existing decision calculations and separately gated data/account/refresh work remain unchanged.\n',1)
    write('docs/TEAMSHEET2-PRODUCT-BLUEPRINT.md',blueprint)

    append_once('docs/CHANGELOG.md','## 2026-07-31 — Teamsheet 2.0.2 Team decision home',r'''
## 2026-07-31 — Teamsheet 2.0.2 Team decision home

- Reordered Team around an immediate connected or placeholder football pitch.
- Added explicit squad/data provenance, XI/captain/bench recommendation, base-XI plus captain forecast, one material risk and advisory deadline action.
- Moved setup/resources and captaincy/all-15 detail behind the immediate decision hierarchy.
- Removed unsupported no-transfer and protect/rank-climbing wording.
- Preserved all model, provider, preview, route, persistence and security contracts.
- Verified **__TEST_COUNT__/__TEST_COUNT__ tests**, deterministic exact-identity builds and root/deployable equality.
''')

    return [
        'app.html','build.mjs','src/ui/views.mjs','src/ui/team-decision-home.mjs',
        'tests/team-decision-home.test.mjs','CLAUDE.md','docs/PROJECT_CONTEXT.md',
        'docs/ARCHITECTURE.md','docs/DECISIONS.md','docs/ROADMAP.md',
        'docs/KNOWN_LIMITATIONS.md','docs/TESTING.md','docs/TEAMSHEET2-ITEM1.md',
        'docs/TEAMSHEET2-ITEM1-IPHONE-REVIEW.md','docs/TEAMSHEET2-PRODUCT-BLUEPRINT.md',
        'docs/TEAMSHEET2-ITEM2.md','docs/CHANGELOG.md'
    ]


def replace_test_count(paths: list[str], count: int) -> None:
    for path in paths:
        content=read(path)
        if '__TEST_COUNT__' in content:
            write(path,content.replace('__TEST_COUNT__',str(count)))


def parse_test_count(output: str) -> int:
    matches=re.findall(r"# tests (\d+)",output)
    if not matches:
        raise RuntimeError('Could not determine test count from node:test output')
    return int(matches[-1])


def main() -> None:
    changed=apply_source_changes()

    preflight=run(['./run-tests.sh'],env={'BUILD_COMMIT':'preflight-2.0.2'},capture=True)
    test_count=parse_test_count(preflight.stdout+'\n'+preflight.stderr)
    print(f'Preflight test count: {test_count}')
    replace_test_count(changed,test_count)

    # Generated output from preflight is deliberately excluded from the source commit.
    run(['git','restore','--worktree','--staged','dist','index.html'])
    run(['git','add',*changed])
    run(['git','commit','-m','Implement Teamsheet 2.0.2 Team decision home'])
    source_sha=run(['git','rev-parse','HEAD'],capture=True).stdout.strip().splitlines()[-1]

    verified=run(['./run-tests.sh'],env={'BUILD_COMMIT':source_sha},capture=True)
    verified_count=parse_test_count(verified.stdout+'\n'+verified.stderr)
    if verified_count!=test_count:
        raise RuntimeError(f'Test count changed between preflight ({test_count}) and verified run ({verified_count})')

    first=Path('/tmp/teamsheet-build-a')
    if first.exists(): shutil.rmtree(first)
    first.mkdir(parents=True)
    for path in ['dist/index.html','dist/app.bundle.js','dist/manifest.json','index.html']:
        target=first/path.replace('/','__')
        shutil.copy2(path,target)

    run(['node','build.mjs'],env={'BUILD_COMMIT':source_sha})
    for path in ['dist/index.html','dist/app.bundle.js','dist/manifest.json','index.html']:
        baseline=first/path.replace('/','__')
        if baseline.read_bytes()!=Path(path).read_bytes():
            raise RuntimeError(f'Deterministic rebuild mismatch: {path}')
    if Path('index.html').read_bytes()!=Path('dist/index.html').read_bytes():
        raise RuntimeError('Root index.html does not match dist/index.html')

    run(['git','diff','--exit-code','--',*changed])
    run(['git','add','dist/app.bundle.js','dist/index.html','dist/manifest.json','index.html'])
    run(['git','commit','-m','Build Teamsheet 2.0.2 deployable'])
    generated_sha=run(['git','rev-parse','HEAD'],capture=True).stdout.strip().splitlines()[-1]
    branch=os.environ.get('GITHUB_HEAD_REF') or os.environ.get('GITHUB_REF_NAME')
    if not branch:
        raise RuntimeError('Could not determine branch name')
    run(['git','push','origin',f'HEAD:{branch}'])

    summary=os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary,'a',encoding='utf-8') as handle:
            handle.write(f'''# Teamsheet 2.0.2 verification\n\n- Tests: **{test_count}/{test_count} passed**\n- Verified source: `{source_sha}`\n- Generated commit: `{generated_sha}`\n- Model/rules: `2.4.0` / `2026-27.3`\n- Two exact-identity builds: byte-identical\n- Root/deployable: identical\n''')
    print(f'VERIFIED_SOURCE={source_sha}')
    print(f'GENERATED_COMMIT={generated_sha}')
    print(f'TEST_COUNT={test_count}')


if __name__ == '__main__':
    main()
