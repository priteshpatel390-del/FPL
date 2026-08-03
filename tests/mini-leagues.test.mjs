import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { S } from '../src/state.mjs';
import { MINI_LEAGUE_STATE_VERSION, MAX_COMPARISON_RIVALS, miniLeagueId, normaliseMiniLeagueState, migrateMiniLeagueState, entryClassicLeagues } from '../src/ui/mini-leagues-state.mjs';
import { miniLeagueOrdinal, miniLeagueMovement, miniLeagueNearestRows, miniLeagueCompareSquads, miniLeagueStatusCopy } from '../src/ui/mini-leagues-view.mjs';
import { validateEntry, validateStandings } from '../src/providers/validate.mjs';

const row=(entry,rank,total,last_rank=rank,name=`Team ${entry}`)=>({entry,rank,total,last_rank,entry_name:name,player_name:`Manager ${entry}`});

test('league identifiers are numeric, bounded and never manufactured',()=>{
  assert.equal(miniLeagueId(' league 00123 '),'00123');
  assert.equal(miniLeagueId('0'),'');
  assert.equal(miniLeagueId('1234567890123'),'');
  assert.equal(miniLeagueId(null),'');
});

test('legacy saved leagues migrate deterministically with configured selection',()=>{
  const state=migrateMiniLeagueState({legacyConfig:{leagueId:'22'},legacyLeagues:[{id:'11',name:'Friends'},{id:'22',name:'Work'},{id:'11',name:'Duplicate'}]});
  assert.equal(state.version,MINI_LEAGUE_STATE_VERSION);
  assert.equal(state.selectedLeagueId,'22');
  assert.deepEqual(state.saved.map(x=>x.id),['11','22']);
  assert.equal(state.saved[0].name,'Friends');
});

test('versioned state deduplicates leagues and caps pinned rivals',()=>{
  const state=normaliseMiniLeagueState({version:1,selectedLeagueId:'7',saved:[{id:'7',name:'A'},{id:'7',name:'B'}],pinnedRivals:{7:Array.from({length:9},(_,i)=>({id:String(i+1),name:`R${i+1}`}))}});
  assert.equal(state.saved.length,1);
  assert.equal(state.saved[0].name,'A');
  assert.equal(state.pinnedRivals['7'].length,5);
});

test('entry classic leagues are the only automatically discovered competition rows',()=>{
  const entry={leagues:{classic:[{id:1,name:'Family'},{id:2,name:'Work'}],h2h:[{id:3,name:'Cup'}]}};
  assert.deepEqual(entryClassicLeagues(entry).map(x=>x.name),['Family','Work']);
});

test('official movement and ordinal wording is deterministic',()=>{
  assert.equal(miniLeagueOrdinal(12),'12th');
  assert.equal(miniLeagueOrdinal(21),'21st');
  assert.deepEqual(miniLeagueMovement(4,7),{delta:3,label:'Up 3 places',direction:'up'});
  assert.deepEqual(miniLeagueMovement(8,6),{delta:-2,label:'Down 2 places',direction:'down'});
  assert.equal(miniLeagueMovement(2,null).label,'Previous position unavailable');
});

test('nearest rivals use official ordering around the connected manager',()=>{
  const rows=[row(1,1,110),row(2,2,105),row(3,3,100),row(4,4,99)];
  const nearest=miniLeagueNearestRows(rows,'3');
  assert.equal(nearest.above.entry,2);
  assert.equal(nearest.below.entry,4);
  assert.equal(nearest.leader.entry,1);
});

test('squad comparison is exact set arithmetic rather than a differential score',()=>{
  const own=[1,2,3].map(id=>({p:{id}}));
  const rival=[{element:2},{element:3},{element:4}];
  assert.deepEqual(miniLeagueCompareSquads(own,rival),{overlap:[2,3],onlyOwn:[1],onlyRival:[4],ownCount:3,rivalCount:3});
});

test('season state labels official provisional and checked outcomes honestly',()=>{
  S.seasonLive=false; S.currentGW=0; S.boot={events:[]};
  assert.equal(miniLeagueStatusCopy().label,'Pre-season');
  S.seasonLive=true; S.currentGW=2; S.boot={events:[{id:2,finished:false,data_checked:false}]};
  assert.equal(miniLeagueStatusCopy().label,'Official FPL — provisional');
  S.boot.events[0]={id:2,finished:true,data_checked:true};
  assert.equal(miniLeagueStatusCopy().label,'Official FPL — GW2 complete');
});

test('entry validator retains only valid public classic league membership',()=>{
  const result=validateEntry({name:'My Team',leagues:{classic:[{id:1,name:'Friends'},null,{id:2},{id:1,name:'Duplicate'}]}});
  assert.deepEqual(result.value.leagues.classic.map(x=>x.id),[1]);
  assert.equal(result.issues.some(x=>x.code==='entry_invalid_classic_leagues'),true);
  assert.equal(result.issues.some(x=>x.code==='entry_duplicate_classic_leagues'),true);
});

test('standings validator requires the fields displayed by the product',()=>{
  const valid=row(1,1,100,2,'Alpha');
  const result=validateStandings({league:{name:'Friends'},standings:{has_next:false,results:[valid,{entry:2,rank:2}]}});
  assert.deepEqual(result.value.standings.results,[valid]);
  assert.equal(result.issues.some(x=>x.code==='standings_invalid_rows'),true);
});

test('source keeps official and factual boundaries and removes unsupported tactical claims',()=>{
  const source=readFileSync(new URL('../src/ui/mini-leagues-view.mjs',import.meta.url),'utf8');
  for(const required of ['Official FPL — provisional','Load more standings','Refresh failed. Showing the last standings loaded in this session','Low ownership alone is not a recommendation','factual squad differences','#/leagues/standings','#/leagues/rival']) assert.equal(source.includes(required),true,required);
  for(const forbidden of ['covered on the template','win or lose the league','Biggest threats','projected league position','must chase','must protect']) assert.equal(source.includes(forbidden),false,forbidden);
});

test('version 1 state migrates to an empty explicit comparison group',()=>{
  const state=migrateMiniLeagueState({stored:{version:1,selectedLeagueId:'7',saved:[{id:'7',name:'A'}],pinnedRivals:{7:[{id:'2',name:'Pinned'}]}}});
  assert.equal(state.version,MINI_LEAGUE_STATE_VERSION);
  assert.deepEqual(state.comparisonRivalsByLeague,{});
  assert.equal(MAX_COMPARISON_RIVALS,5);
});
