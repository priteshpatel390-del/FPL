import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { teamDecisionBenchDisplayOrder } from '../src/ui/team-decision-home.mjs';

const teamSource=readFileSync(new URL('../src/ui/team-decision-home.mjs',import.meta.url),'utf8');
const appSource=readFileSync(new URL('../app.html',import.meta.url),'utf8');

function functionSource(name){
  const start=teamSource.indexOf(`function ${name}`);
  assert.notEqual(start,-1,`${name} should exist`);
  const next=teamSource.indexOf('\nfunction ',start+10);
  return teamSource.slice(start,next===-1?teamSource.length:next);
}

test('UX-A1 resource bar is the direct Team-stage predecessor in ready and setup states',()=>{
  assert.match(teamSource,/setChildren\(out,[\s\S]*?teamDecisionResourceBar\(\{ft,bank\}\),[\s\S]*?teamDecisionPlaceholderStage/);
  assert.match(teamSource,/setChildren\(out,header,summary,previewBanner,teamDecisionResourceBar\(\{ft,bank\}\),stage,controls,actions\)/);
});

test('resource bar uses the exact approved labels and prominent value elements',()=>{
  const resource=functionSource('teamDecisionResourceBar');
  assert.match(resource,/item\('Free transfers',String\(ft\)\)/);
  assert.match(resource,/item\('Money in bank',`£\$\{bank\}m`\)/);
  assert.match(resource,/class:'team-resource-value'/);
  assert.match(appSource,/\.team-resource-value\{[^}]*font-size:25px/);
});

test('manual provenance is honest, secondary and paired with the existing edit route',()=>{
  const resource=functionSource('teamDecisionResourceBar');
  assert.match(resource,/Entered manually/);
  assert.match(resource,/team-resource-provenance/);
  assert.match(resource,/onclick:teamDecisionFocusResources/);
  const edit=functionSource('teamDecisionFocusResources');
  assert.match(edit,/\$\('teamContext'\)/);
  assert.match(edit,/\$\('ftCount'\)\|\|\$\('bankIn'\)/);
  assert.match(edit,/scrollIntoView/);
  assert.match(edit,/focus/);
  assert.match(appSource,/\.team-resource-provenance\{[^}]*color:var\(--ink-soft\)/);
});

test('compact FT and bank header chips are removed without duplicating resource labels',()=>{
  const header=functionSource('teamDecisionHeader');
  const resource=functionSource('teamDecisionResourceBar');
  assert.doesNotMatch(teamSource,/FT · manual|bank · manual/);
  assert.doesNotMatch(header,/\bft\b|\bbank\b|manual/);
  assert.equal((resource.match(/Free transfers/g)||[]).length,1);
  assert.equal((resource.match(/Money in bank/g)||[]).length,1);
});

test('bench roles are separate exact elements rather than player-name prefixes',()=>{
  assert.match(teamSource,/Object\.freeze\(\['GK','1st','2nd','3rd'\]\)/);
  const playerNode=functionSource('teamDecisionPlayerNode');
  assert.match(playerNode,/benchRole\?el\('span',\{class:'bench-role'\},benchRole\):null/);
  assert.match(playerNode,/el\('div',\{class:'pitch-name'\},player\.web_name\)/);
  assert.doesNotMatch(playerNode,/pitch-name'\},`\$\{benchRole\}/);
});

test('bench array order remains index-preserving and unsorted',()=>{
  const order=functionSource('teamDecisionBenchDisplayOrder');
  const stage=functionSource('teamDecisionStage');
  assert.match(stage,/orderedBench\.map\(\(slot,index\)=>playerNode\(slot,teamDecisionBenchLabel\(index\)\)\)/);
  assert.doesNotMatch(order,/\.sort\(|\.reverse\(|\.splice\(/);
});

test('bench display puts reserve goalkeeper in GK slot without mutating calculated bench order',()=>{
  const gk={p:{id:1,element_type:1}};
  const defender={p:{id:2,element_type:2}};
  const midfielder={p:{id:3,element_type:3}};
  const forward={p:{id:4,element_type:4}};
  const bench=[defender,midfielder,forward,gk];
  const ordered=teamDecisionBenchDisplayOrder(bench);
  assert.deepEqual(ordered.map(slot=>slot.p.id),[1,2,3,4]);
  assert.deepEqual(bench.map(slot=>slot.p.id),[2,3,4,1]);
  assert.notStrictEqual(ordered,bench);
  const stage=functionSource('teamDecisionStage');
  assert.match(stage,/const orderedBench=teamDecisionBenchDisplayOrder\(xi\.bench\)/);
  assert.doesNotMatch(stage,/bestXI\(|\.sort\(|\.splice\(|\.reverse\(/);
  assert.match(teamSource,/const bench=teamDecisionBenchDisplayOrder\(xi\.bench\)\.map\(\(slot,index\)=>`\$\{teamDecisionBenchLabel\(index\)\} \$\{slot\.p\.web_name\}`\)/);
});

test('bench names receive a two-line treatment before truncation',()=>{
  assert.match(appSource,/\.bench-player \.pitch-name\{[^}]*-webkit-line-clamp:2[^}]*white-space:normal[^}]*overflow-wrap:anywhere/);
});

test('bench fixture and projected-points rows remain visible and readable',()=>{
  assert.match(appSource,/\.bench-player \.pitch-meta\{[^}]*font-size:8px[^}]*line-height:1\.25/);
  assert.match(appSource,/\.bench-player \.pitch-xp\{[^}]*font-size:9px[^}]*line-height:1\.25/);
  assert.match(teamSource,/el\('div',\{class:'pitch-meta'\},fixture\)/);
  assert.match(teamSource,/el\('div',\{class:'pitch-xp'\},`\$\{projected\} xP`\)/);
});

test('complete accessible labels retain the bench role and full player detail',()=>{
  const playerNode=functionSource('teamDecisionPlayerNode');
  assert.match(playerNode,/`\$\{benchRole\?`\$\{benchRole\} bench, `:''\}\$\{player\.web_name\}, \$\{fixture\}, \$\{projected\} expected points/);
  assert.match(playerNode,/if\(availabilityCopy\) aria\+=`, \$\{availabilityCopy\.aria\}`/);
});

test('bench cards remain buttons that open Player Detail',()=>{
  const playerNode=functionSource('teamDecisionPlayerNode');
  assert.match(playerNode,/class:`pitch-player\$\{benchRole\?' bench-player':''\}/);
  assert.match(playerNode,/else openPlayerDetail\(player,gw,1,event\.currentTarget\)/);
});

test('UX-A1 introduces no transfer, scoring, simulation, provider or persistence engine into Team presentation',()=>{
  assert.doesNotMatch(teamSource,/from ['"]\.\.\/model\/(?:simulation|transfers)/);
  assert.doesNotMatch(teamSource,/from ['"]\.\.\/storage\.mjs|localStorage|sessionStorage|fetch\(|optimiseTransfers\(|simulatePlayerGameweek\(/);
  const imports=teamSource.split('\n').filter(line=>line.startsWith('import ')).join('\n');
  assert.doesNotMatch(imports,/transfer-worker|transfer-performance|evidence\/|storage\.mjs/);
});
