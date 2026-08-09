import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  manualSquadValidation,
  manualSquadAddDecision,
  manualSquadStatusText,
  manualSquadCreateRouteAwareTransferRenderer,
  manualSquadCommitAddition
} from '../src/ui/manual-squad-runtime.mjs';

function player(id,element_type,team,web_name=`P${id}`,now_cost=50){
  return {id,element_type,team,web_name,now_cost};
}

function legalFourteen(){
  const players=[];
  let id=1;
  for(const [position,count] of [[1,2],[2,5],[3,5],[4,2]]){
    for(let index=0;index<count;index++) players.push(player(id++,position,Math.floor(index/2)+position*4));
  }
  return players;
}

function manualFrom(players){ return players.map(p=>({id:p.id,bought:p.now_cost})); }
function byIdFrom(players){ return Object.fromEntries(players.map(p=>[p.id,p])); }

test('the legal fifteenth manual player completes a 2-5-5-3 squad',async()=>{
  const firstFourteen=legalFourteen();
  const fifteenth=player(15,4,19,'Final forward');
  const all=[...firstFourteen,fifteenth];
  const manual=manualFrom(firstFourteen);
  const byId=byIdFrom(all);
  let persisted=0,manualRenders=0,teamRenders=0,optimiserCalls=0;

  const decision=manualSquadAddDecision(manual,fifteenth,byId);
  assert.equal(decision.ok,true);
  const result=await manualSquadCommitAddition({
    manual,
    player:fifteenth,
    byId,
    persist:async value=>{ persisted=value.length; },
    saveConfiguration:async()=>{},
    renderManualView:()=>{ manualRenders++; },
    renderTeamView:()=>{ teamRenders++; },
    dispatchRendered:()=>{}
  });

  assert.equal(result.ok,true);
  assert.equal(result.validation.legal,true);
  assert.equal(manual.length,15);
  assert.equal(persisted,15);
  assert.equal(manualRenders,1);
  assert.equal(teamRenders,1);
  assert.equal(optimiserCalls,0,'manual squad commit must not invoke the transfer optimiser');
});

test('hidden transfer rendering is deferred until Transfers is opened',()=>{
  let route='#/settings/team-account/manual-squad';
  let calls=0;
  const render=manualSquadCreateRouteAwareTransferRenderer(()=>{ calls++; return 'rendered'; },()=>route);

  assert.deepEqual(render(),{deferred:true});
  assert.equal(calls,0);
  route='#/team';
  assert.deepEqual(render(),{deferred:true});
  assert.equal(calls,0);
  route='#/transfers';
  assert.equal(render(),'rendered');
  assert.equal(calls,1);
  route='#/settings';
  assert.equal(render({force:true}),'rendered');
  assert.equal(calls,2);
});

test('manual additions enforce position and three-per-club limits before saving',()=>{
  const squad=[player(1,1,1),player(2,1,2),player(3,2,3),player(4,2,3),player(5,2,3)];
  const manual=manualFrom(squad);
  const fourthClubPlayer=player(6,2,3,'Fourth club player');
  const thirdGoalkeeper=player(7,1,4,'Third goalkeeper');
  const byId=byIdFrom([...squad,fourthClubPlayer,thirdGoalkeeper]);

  assert.match(manualSquadAddDecision(manual,fourthClubPlayer,byId).message,/3 players/);
  assert.match(manualSquadAddDecision(manual,thirdGoalkeeper,byId).message,/maximum 2 GKP/);
});

test('an exact £100.0m manual squad is allowed and reports no budget remaining',()=>{
  const firstFourteen=legalFourteen();
  const fifteenth=player(15,4,19,'Exact-budget forward',300);
  const all=[...firstFourteen,fifteenth];
  const manual=manualFrom(firstFourteen);
  const byId=byIdFrom(all);

  const decision=manualSquadAddDecision(manual,fifteenth,byId);
  assert.equal(decision.ok,true);
  assert.equal(decision.nextCost,1000);
  assert.equal(decision.remainingBudget,0);

  const validation=manualSquadValidation(manualFrom(all),byId);
  assert.equal(validation.legal,true);
  assert.equal(validation.cost,1000);
  assert.equal(validation.budget,1000);
  assert.equal(validation.remainingBudget,0);
  assert.match(manualSquadStatusText(validation),/£100\.0m used · £0\.0m left/);
  assert.match(manualSquadStatusText(validation),/complete and legal/);
});

test('a player taking the manual squad one price step over budget is rejected before saving',()=>{
  const firstFourteen=legalFourteen();
  const fifteenth=player(15,4,19,'Over-budget forward',301);
  const all=[...firstFourteen,fifteenth];
  const manual=manualFrom(firstFourteen);

  const decision=manualSquadAddDecision(manual,fifteenth,byIdFrom(all));
  assert.equal(decision.ok,false);
  assert.match(decision.message,/£100\.1m/);
  assert.match(decision.message,/£100\.0m budget/);
  assert.equal(manual.length,14);
});

test('legacy over-budget saved squads remain visible but are not legal',()=>{
  const firstFourteen=legalFourteen();
  const fifteenth=player(15,4,19,'Over-budget forward',301);
  const all=[...firstFourteen,fifteenth];
  const validation=manualSquadValidation(manualFrom(all),byIdFrom(all));

  assert.equal(validation.complete,true);
  assert.equal(validation.legal,false);
  assert.equal(validation.cost,1001);
  assert.equal(validation.remainingBudget,-1);
  assert.ok(validation.issues.some(issue=>/exceeds the £100\.0m budget/.test(issue)));
  assert.match(manualSquadStatusText(validation),/£0\.1m over/);
});

test('stored manual purchase prices preserve a legal squad after current prices rise',()=>{
  const firstFourteen=legalFourteen();
  const fifteenth=player(15,4,19,'Price-rise forward',350);
  const all=[...firstFourteen,fifteenth];
  const manual=manualFrom(firstFourteen).concat({id:15,bought:300});
  const validation=manualSquadValidation(manual,byIdFrom(all));

  assert.equal(validation.legal,true);
  assert.equal(validation.cost,1000);
  assert.equal(validation.remainingBudget,0);
});

test('legacy invalid saved squads are not labelled complete and legal',()=>{
  const players=legalFourteen();
  const extraDefender=player(15,2,20);
  const all=[...players,extraDefender];
  const validation=manualSquadValidation(manualFrom(all),byIdFrom(all));
  assert.equal(validation.complete,true);
  assert.equal(validation.legal,false);
  assert.ok(validation.issues.some(issue=>/2 GKP, 5 DEF, 5 MID and 3 FWD/.test(issue)));
});

test('direct Team renderer precedes the stable views adapter and manual runtime',()=>{
  const build=readFileSync('build.mjs','utf8');
  const views=build.indexOf("'src/ui/views.mjs'");
  const teamHome=build.indexOf("'src/ui/team-decision-home.mjs'");
  const runtime=build.indexOf("'src/ui/manual-squad-runtime.mjs'");
  assert.ok(teamHome>=0&&views>teamHome&&runtime>views);
});
