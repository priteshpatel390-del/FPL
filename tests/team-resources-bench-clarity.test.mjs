import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { teamDecisionBenchDisplayOrder } from '../src/ui/team-decision-home.mjs';

const teamSource=readFileSync(new URL('../src/ui/team-decision-home.mjs',import.meta.url),'utf8');
const viewsSource=readFileSync(new URL('../src/ui/views.mjs',import.meta.url),'utf8');
const appSource=readFileSync(new URL('../app.html',import.meta.url),'utf8');

function functionSource(name){
  const start=teamSource.indexOf(`function ${name}`);
  assert.notEqual(start,-1,`${name} should exist`);
  const next=teamSource.indexOf('\nfunction ',start+10);
  return teamSource.slice(start,next===-1?teamSource.length:next);
}

test('UX-A1 resource bar is the direct Team-stage predecessor in ready and setup states',()=>{
  assert.match(teamSource,/setChildren\(out,header,summary,resourceBar,placeholder\)/);
  assert.match(teamSource,/setChildren\(out,header,summary,previewBanner,resourceBar,stage,controls,actions\)/);
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
  const relabel=functionSource('teamDecisionRelabelBench');
  assert.match(relabel,/class:'bench-role'/);
  assert.match(relabel,/insertBefore\(el\('span',\{class:'bench-role'\},label\),nameNode\)/);
  assert.match(relabel,/nameNode\.textContent=playerName/);
  assert.doesNotMatch(relabel,/nameNode\.textContent=`\$\{label\}/);
});

test('bench array order remains index-preserving and unsorted',()=>{
  const relabel=functionSource('teamDecisionRelabelBench');
  assert.match(relabel,/players\.forEach\(\(player,index\)=>/);
  assert.match(relabel,/teamDecisionBenchLabel\(index\)/);
  assert.doesNotMatch(relabel,/\.sort\(|\.reverse\(|\.splice\(/);
  assert.match(viewsSource,/xi\.bench\.map\(\(slot,index\)=>playerNode\(slot,index\+1\)\)/);
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
  const reorder=functionSource('teamDecisionOrderBenchDisplay');
  assert.match(reorder,/teamDecisionBenchDisplayOrder\(source\)/);
  assert.match(reorder,/grid\.appendChild\(node\)/);
  assert.doesNotMatch(reorder,/bestXI\(|xpOf\(|\.sort\(|\.splice\(|\.reverse\(/);
  assert.match(teamSource,/teamDecisionOrderBenchDisplay\(stage,xi\);\s*teamDecisionRelabelBench\(stage\);\s*teamDecisionAnnotateAvailability\(stage,xi\);/);
  assert.match(teamSource,/const bench=teamDecisionBenchDisplayOrder\(xi\.bench\)\.map\(\(slot,index\)=>`\$\{teamDecisionBenchLabel\(index\)\} \$\{slot\.p\.web_name\}`\)/);
});

test('bench names receive a two-line treatment before truncation',()=>{
  assert.match(appSource,/\.bench-player \.pitch-name\{[^}]*-webkit-line-clamp:2[^}]*white-space:normal[^}]*overflow-wrap:anywhere/);
});

test('bench fixture and projected-points rows remain visible and readable',()=>{
  assert.match(appSource,/\.bench-player \.pitch-meta\{[^}]*font-size:8px[^}]*line-height:1\.25/);
  assert.match(appSource,/\.bench-player \.pitch-xp\{[^}]*font-size:9px[^}]*line-height:1\.25/);
  assert.match(viewsSource,/elNode\('div',\{class:'pitch-meta'\},fixture\)/);
  assert.match(viewsSource,/elNode\('div',\{class:'pitch-xp'\},`\$\{projected\} xP`\)/);
});

test('complete accessible labels retain the bench role and full player detail',()=>{
  const relabel=functionSource('teamDecisionRelabelBench');
  assert.match(relabel,/player\.setAttribute\('aria-label',`\$\{label\} bench, \$\{detail\}`\)/);
  assert.match(viewsSource,/`\$\{label\}, \$\{fixture\}, \$\{projected\} expected points/);
});

test('bench cards remain buttons that open Player Detail',()=>{
  assert.match(viewsSource,/class:`pitch-player\$\{benchIndex==null\?'':' bench-player'\}/);
  assert.match(viewsSource,/else openPlayerDetailView\(p,gw,1,event\.currentTarget\)/);
});

test('UX-A1 introduces no transfer, scoring, simulation, provider or persistence engine into Team presentation',()=>{
  assert.doesNotMatch(teamSource,/from ['"]\.\.\/model\/(?:scoring|simulation|transfers)/);
  assert.doesNotMatch(teamSource,/from ['"]\.\.\/storage\.mjs|localStorage|sessionStorage|fetch\(|optimiseTransfers\(|simulatePlayerGameweek\(/);
  const imports=teamSource.split('\n').filter(line=>line.startsWith('import ')).join('\n');
  assert.doesNotMatch(imports,/transfer-worker|transfer-performance|evidence\/|storage\.mjs/);
});
