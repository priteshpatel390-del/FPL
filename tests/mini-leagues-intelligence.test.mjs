import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { S } from '../src/state.mjs';
import { MAX_COMPARISON_RIVALS, normaliseMiniLeagueState, migrateMiniLeagueState } from '../src/ui/mini-leagues-state.mjs';
import { miniLeaguePickFacts, miniLeagueExposureLabel, miniLeagueExposureSummary } from '../src/ui/mini-leagues-view.mjs';

const byId=Object.fromEntries(Array.from({length:30},(_,i)=>[i+1,{id:i+1,web_name:`P${i+1}`}]))
const picks=(ids,{captain=ids[0],vice=ids[1],active_chip=null}={})=>({
  active_chip,
  picks:ids.map((element,index)=>({element,position:index+1,multiplier:element===captain?2:1,is_captain:element===captain,is_vice_captain:element===vice}))
});
const rival=(id,name,payload,extra={})=>({rival:{id:String(id),name},picks:payload,...extra});

test('comparison state is versioned, bounded and does not seed v1 pins as network selections',()=>{
  const migrated=migrateMiniLeagueState({stored:{version:1,selectedLeagueId:'7',saved:[{id:'7',name:'Friends'}],pinnedRivals:{7:[{id:'1',name:'A'}]}}});
  assert.equal(migrated.version,2);
  assert.deepEqual(migrated.comparisonRivalsByLeague,{});
  const state=normaliseMiniLeagueState({version:2,selectedLeagueId:'7',saved:[{id:'7',name:'Friends'}],comparisonRivalsByLeague:{7:Array.from({length:8},(_,i)=>({id:String(i+1),name:`R${i+1}`}))}});
  assert.equal(state.comparisonRivalsByLeague['7'].length,MAX_COMPARISON_RIVALS);
  assert.equal(MAX_COMPARISON_RIVALS,5);
});

test('pick facts require 15 unique resolved players and positions before aggregate use',()=>{
  const full=picks(Array.from({length:15},(_,i)=>i+1));
  const facts=miniLeaguePickFacts(full.picks,{byId,activeChip:full.active_chip});
  assert.equal(facts.complete,true);
  assert.equal(facts.captainId,1);
  assert.equal(facts.viceId,2);
  const duplicatePosition=full.picks.map(row=>({...row}));
  duplicatePosition[14].position=14;
  assert.equal(miniLeaguePickFacts(duplicatePosition,{byId}).complete,false);
  assert.equal(miniLeaguePickFacts(full.picks.slice(0,14),{byId}).complete,false);
  const unresolved=full.picks.map(row=>({...row}));
  unresolved[14].element=99;
  assert.equal(miniLeaguePickFacts(unresolved,{byId}).complete,false);
});

test('multi-rival exposure uses only complete fresh squads and exact selected-rival counts',()=>{
  S.byId=byId;
  const own=Array.from({length:15},(_,i)=>({p:byId[i+1],position:i+1,multiplier:i===0?2:1,is_captain:i===0}));
  const records=[
    rival(101,'A',picks([...Array.from({length:14},(_,i)=>i+1),16],{captain:16})),
    rival(102,'B',picks([...Array.from({length:13},(_,i)=>i+1),16,17],{captain:16})),
    rival(103,'C',picks([...Array.from({length:12},(_,i)=>i+1),16,17,18],{captain:18,active_chip:'3xc'})),
    rival(104,'Stale',picks(Array.from({length:15},(_,i)=>i+1)),{stale:true}),
    rival(105,'Partial',{active_chip:null,picks:picks(Array.from({length:14},(_,i)=>i+1)).picks})
  ];
  const summary=miniLeagueExposureSummary(own,records,{byId});
  assert.equal(summary.total,3);
  assert.equal(summary.completeCount,3);
  assert.equal(summary.staleCount,1);
  assert.equal(summary.incompleteCount,1);
  const p16=summary.rows.find(row=>row.id===16);
  const p17=summary.rows.find(row=>row.id===17);
  const p18=summary.rows.find(row=>row.id===18);
  assert.equal(p16.count,3);
  assert.equal(p16.captainCount,2);
  assert.equal(p16.label,'All selected rivals');
  assert.equal(p17.count,2);
  assert.equal(p17.label,'Majority of selected rivals');
  assert.equal(p18.count,1);
  assert.equal(p18.label,'One selected rival');
  assert.deepEqual(summary.uniqueToYou,[15]);
  assert.deepEqual(summary.sharedRivalOnly.map(row=>row.id),[16,17]);
  assert.deepEqual(summary.singleRivalOnly.map(row=>row.id),[18]);
});

test('exposure labels are structural and deterministic rather than predictive',()=>{
  assert.equal(miniLeagueExposureLabel(0,0),'No loaded selected rivals');
  assert.equal(miniLeagueExposureLabel(1,1),'One selected rival');
  assert.equal(miniLeagueExposureLabel(2,2),'All selected rivals');
  assert.equal(miniLeagueExposureLabel(2,3),'Majority of selected rivals');
  assert.equal(miniLeagueExposureLabel(2,5),'Multiple selected rivals');
  assert.equal(miniLeagueExposureLabel(1,5),'One selected rival');
});

test('source keeps exposure on demand, concurrency bounded and model-free',()=>{
  const view=readFileSync(new URL('../src/ui/mini-leagues-view.mjs',import.meta.url),'utf8');
  const shell=readFileSync(new URL('../src/ui/app-shell.mjs',import.meta.url),'utf8');
  for(const required of ['#/leagues/exposure','MAX_COMPARISON_RIVALS','pool(group,async row=>','},2)','No public squad request is made until you press Load rival exposure','selected rivals only','excluded from aggregate denominators','membership and rank cannot be confirmed']) assert.equal(view.includes(required)||shell.includes(required),true,required);
  const routeHandler=view.slice(view.indexOf("document.addEventListener('teamsheet:route-change'"),view.indexOf("document.addEventListener('teamsheet:data-rendered'"));
  assert.equal(routeHandler.includes('loadMiniLeagueExposure'),false,'exposure must not preload on route entry');
  for(const forbidden of ['xpOf(','optimiseTransfers(','runSimulation(','projected league position','must protect','must chase','effective ownership']) assert.equal(view.includes(forbidden),false,forbidden);
});

test('stale rival records remain visible but are excluded from the fresh aggregate',()=>{
  S.byId=byId;
  const own=Array.from({length:15},(_,i)=>({p:byId[i+1],position:i+1}));
  const fresh=rival(1,'Fresh',picks(Array.from({length:15},(_,i)=>i+1));
  const stale=rival(2,'Stale',picks([...Array.from({length:14},(_,i)=>i+1),16]),{stale:true});
  const summary=miniLeagueExposureSummary(own,[fresh,stale],{byId});
  assert.equal(summary.total,1);
  assert.equal(summary.staleCount,1);
  assert.equal(summary.rows.some(row=>row.id===16),false);
});
