import test from 'node:test';
import assert from 'node:assert/strict';
import { optimiseTransfers, exhaustiveTransferSearch, createPoolLevel, seedPoolLevel, poolHorizonTotal,
  scoreSquadAcrossHorizon } from '../src/model/transfers.mjs';
import { buildOfficialScaleCase, transferResultSummary } from './fixtures/transfer-scale-fixture.mjs';

/* -----------------------------------------------------------------------------
   Track A correction — exactness evidence.

   Two independent forms of evidence are kept apart deliberately:

   1. controlled pools, where every retained plan is compared against the
      independent `exhaustiveTransferSearch()` oracle;
   2. the Official-scale pool, where an exhaustive comparison is not tractable and
      the claim is only that the exact search completes below the unchanged
      evaluation ceiling and returns `status: 'ok'`.
   ----------------------------------------------------------------------------- */

function deterministic(seed){
  let state=seed>>>0;
  return ()=>{
    state=(state+0x6D2B79F5)>>>0;
    let t=Math.imul(state^(state>>>15),1|state);
    t=(t+Math.imul(t^(t>>>7),61|t))^t;
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}

function player(id,pos,team,cost,scores,status='a'){
  return {id,element_type:pos,team,now_cost:cost,web_name:`P${id}`,status,scores};
}

const QUOTAS={1:2,2:5,3:5,4:3};

/* Controlled differential case. `shape` deliberately steers the generator at the
   parts of the comparator that pruning could otherwise break: exact price
   boundaries, inherited club excess, repeated scores, cheap enablers, doubtful
   players and pools where every alternative ties on net gain. */
function differentialCase(seed,shape='mixed'){
  const next=deterministic(seed),pick=(min,max)=>min+Math.floor(next()*(max-min+1));
  const horizon=shape==='ties'?3:pick(1,6);
  const squad=[]; let id=1;
  const inheritedClub=shape==='clubs';
  for(const pos of [1,2,3,4]) for(let index=0;index<QUOTAS[pos];index++){
    const team=inheritedClub&&pos===3?1:pick(1,shape==='clubs'?4:12);
    const scores=Array.from({length:horizon},()=>shape==='ties'?2:+(next()*7-1).toFixed(4));
    const p=player(id++,pos,team,40+pick(0,60),scores);
    squad.push({p,bought:shape==='prices'?p.now_cost+pick(0,8):p.now_cost});
  }
  const players=squad.map(entry=>entry.p);
  const extra=shape==='ties'?10:pick(10,22);
  for(let index=0;index<extra;index++){
    const pos=shape==='keepers'?1:shape==='enablers'?pick(1,2):pick(1,4);
    const cost=shape==='enablers'?38+pick(0,4):shape==='prices'?40+pick(0,40):40+pick(0,70);
    const scores=Array.from({length:horizon},()=>shape==='ties'?2:+(next()*8-1).toFixed(4));
    const status=shape==='doubtful'?(index%2?'d':'a'):next()<0.12?'d':next()<0.05?'i':'a';
    players.push(player(200+index,pos,inheritedClub?pick(1,3):pick(1,12),cost,scores,status));
  }
  return {squad,players,bank:shape==='prices'?pick(0,6):pick(0,40),freeTransfers:pick(0,3),startGW:1,horizon,
    maxTransfers:pick(1,3),maxResults:shape==='ties'?8:pick(1,12),scorePlayer:(p,gw)=>p.scores[gw-1]};
}

const SHAPES=['mixed','keepers','enablers','doubtful','prices','clubs','ties'];

test('corrected exact search matches the independent exhaustive oracle across every controlled shape',()=>{
  for(const shape of SHAPES) for(let seed=1;seed<=45;seed++){
    const args=differentialCase(seed,shape);
    assert.deepEqual(transferResultSummary(optimiseTransfers(args)),
      transferResultSummary(exhaustiveTransferSearch(args)),`${shape} seed ${seed}`);
  }
});

test('corrected exact search matches the oracle at each fixed transfer depth',()=>{
  for(const maxTransfers of [1,2,3]) for(let seed=1;seed<=40;seed++){
    const args={...differentialCase(seed,'mixed'),maxTransfers};
    assert.deepEqual(transferResultSummary(optimiseTransfers(args)),
      transferResultSummary(exhaustiveTransferSearch(args)),`depth ${maxTransfers} seed ${seed}`);
  }
});

test('every retained plan survives an exact re-score of its own final squad',()=>{
  for(let seed=1;seed<=40;seed++){
    const args=differentialCase(seed,'mixed');
    const result=optimiseTransfers(args);
    const byId=new Map(args.players.map(p=>[Number(p.id),p]));
    for(const plan of result.plans||[]){
      const squad=plan.finalSquadIds.map(playerId=>({p:byId.get(Number(playerId))}));
      const rescored=scoreSquadAcrossHorizon(squad,args.startGW,args.horizon,args.scorePlayer);
      assert.equal(rescored.total,plan.grossBestXIPoints,`seed ${seed} ${plan.signature}`);
    }
  }
});

test('prefix-sum pool totals equal the reviewed best-XI scoring of the same squad',()=>{
  for(let seed=1;seed<=40;seed++){
    const args=differentialCase(seed,'mixed');
    const scoreRows=new Map(args.players.map(p=>[Number(p.id),
      Array.from({length:args.horizon},(_,offset)=>Number(args.scorePlayer(p,args.startGW+offset)))]));
    const level=createPoolLevel(args.horizon);
    seedPoolLevel(level,args.squad,scoreRows,args.horizon);
    const expected=scoreSquadAcrossHorizon(args.squad,args.startGW,args.horizon,args.scorePlayer).total;
    assert.ok(Math.abs(poolHorizonTotal(level,args.horizon)-expected)<1e-9,`seed ${seed}`);
  }
});

test('a fully tied pool still returns the oracle top-K by bank, doubtful count and canonical signature',()=>{
  const args=differentialCase(5,'ties');
  const prepared=optimiseTransfers(args),oracle=exhaustiveTransferSearch(args);
  assert.deepEqual(transferResultSummary(prepared),transferResultSummary(oracle));
  const netGains=new Set((prepared.plans||[]).filter(plan=>plan.transferCount>0).map(plan=>plan.netGain));
  assert.ok(netGains.size<=2,'tie shape should collapse net gain');
});

test('the zero-transfer baseline is retained first whenever the comparator requires it',()=>{
  let sawBaselineFirst=false;
  for(let seed=1;seed<=60;seed++){
    const args=differentialCase(seed,'mixed');
    const prepared=optimiseTransfers(args),oracle=exhaustiveTransferSearch(args);
    assert.equal(prepared.plans[0].signature,oracle.plans[0].signature,`seed ${seed}`);
    if(prepared.plans[0].transferCount===0) sawBaselineFirst=true;
    assert.ok((prepared.plans||[]).some(plan=>plan.transferCount===0)||prepared.plans.length===args.maxResults);
  }
  assert.ok(sawBaselineFirst,'at least one case must rank no transfer first');
});

test('Official-scale six-Gameweek search completes below the unchanged evaluation ceiling',()=>{
  for(const seed of [3,7,11]){
    const args=buildOfficialScaleCase({seed});
    const owned=new Set(args.squad.map(entry=>Number(entry.p.id)));
    const eligible=args.players.filter(p=>!owned.has(Number(p.id))&&!['i','u','s','n'].includes(p.status));
    assert.ok(eligible.length>500,`seed ${seed} pool ${eligible.length}`);
    assert.ok(eligible.some(p=>Number(p.now_cost)<=40),'cheap enablers must remain eligible');
    assert.ok(eligible.some(p=>p.status==='d'),'doubtful players must remain eligible');
    assert.equal(args.horizon,6);
    assert.equal(args.maxTransfers,3);
    assert.equal(args.maxResults,8);
    assert.equal(args.maxEvaluations,2000000);

    const result=optimiseTransfers(args);
    assert.equal(result.status,'ok');
    assert.equal(result.issues.length,0);
    assert.ok(result.evaluations<2000000,`seed ${seed} evaluations ${result.evaluations}`);
    assert.equal(result.plans.length,8);
    assert.ok(result.profile.outgoingBranches>500);
    assert.ok(result.profile.boundPruned>0);
    assert.ok(result.profile.orderedBreaks>0);
    assert.ok(result.profile.materialisedPlans<=result.profile.leafEvaluations);
  }
});

test('Official-scale profiling is deterministic across repeated runs',()=>{
  const first=optimiseTransfers(buildOfficialScaleCase({seed:7}));
  const second=optimiseTransfers(buildOfficialScaleCase({seed:7}));
  assert.deepEqual(first.profile,second.profile);
  assert.deepEqual(transferResultSummary(first),transferResultSummary(second));
});

test('Official-scale search still fails closed when the ceiling is genuinely exceeded',()=>{
  const result=optimiseTransfers(buildOfficialScaleCase({seed:7,maxEvaluations:5}));
  assert.equal(result.status,'search-incomplete');
  assert.deepEqual(result.issues,['evaluation_limit']);
  assert.equal(result.plans.length,1);
  assert.equal(result.plans[0].transferCount,0);
});

test('partial tie bounds remain exact for mixed-width player IDs and reversed input order',()=>{
  const args=differentialCase(5,'ties');
  const mixedIds=[20,99,100,101,109,110,999,1000,1001,10000];
  const candidates=args.players.filter(p=>Number(p.id)>=200);
  candidates.forEach((p,index)=>{ p.id=mixedIds[index]; });
  args.players=args.players.slice().reverse();
  args.squad=args.squad.slice().reverse();
  args.maxResults=3;
  assert.deepEqual(transferResultSummary(optimiseTransfers(args)),
    transferResultSummary(exhaustiveTransferSearch(args)));
});

