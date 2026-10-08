// Gate C workflow hardening. Node built-ins only; no dispatch, provider, Cloudflare or D1 request.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

const root=path.resolve(import.meta.dirname,'..');
const workflowFiles=[
  '.github/workflows/api-football-gate-c-new-day-collection.yml',
  '.github/workflows/api-football-gate-c-readonly-readiness.yml'
];
const load=file=>fs.readFileSync(path.join(root,file),'utf8');
const linesOf=source=>source.split(/\r?\n/);
const indent=line=>line.match(/^ */)[0].length;

test('Gate C workflows have YAML-indented literal script bodies, including heredoc JS',()=>{
  for(const file of workflowFiles){
    const lines=linesOf(load(file));let runBlocks=0;
    for(let i=0;i<lines.length;i++){
      const match=lines[i].match(/^(\s*)run:\s*\|\s*$/);
      if(!match)continue;
      runBlocks++;
      const parentIndent=match[1].length;
      let bodyLines=0;
      for(let j=i+1;j<lines.length;j++){
        const line=lines[j];
        if(!line.trim())continue;
        if(indent(line)<=parentIndent)break;
        assert.ok(indent(line)>=parentIndent+2,`${file}:${j+1} lost YAML literal indentation`);
        bodyLines++;
      }
      assert.ok(bodyLines>0,`${file}:${i+1} empty run block`);
    }
    assert.ok(runBlocks>=2,`${file} missing shell literal blocks`);
  }
});

test('Gate C one-shot inline Node module heredocs parse with pinned Node built-in syntax checker',()=>{
  const source=load(workflowFiles[0]),lines=linesOf(source);
  let checks=0;
  for(let i=0;i<lines.length;i++){
    if(!/node --input-type=module - .*<<['"]?NODE['"]?/.test(lines[i]))continue;
    const opener=indent(lines[i]);let close=-1;
    for(let j=i+1;j<lines.length;j++){
      if(lines[j].trim()==='NODE'){close=j;break;}
    }
    assert.ok(close>i,`unclosed inline Node heredoc at line ${i+1}`);
    const snippet=lines.slice(i+1,close).map(line=>line.slice(opener)).join('\n');
    const result=spawnSync(process.execPath,['--check','--input-type=module'],{input:snippet,encoding:'utf8'});
    assert.equal(result.status,0,`inline JS line ${i+1}: ${result.stderr}`);
    checks++;
    i=close;
  }
  assert.ok(checks>=3,'inline Node guards not examined');
});

test('Gate C live workflow is manual once-ever and read-only workflow is independently repeatable',()=>{
  const live=load(workflowFiles[0]),readOnly=load(workflowFiles[1]);
  for(const [label,source] of [['live',live],['readOnly',readOnly]]){
    assert.match(source,/^on:\s*\n\s+workflow_dispatch:/m,`${label}: manual only`);
    assert.doesNotMatch(source,/\n\s+(?:schedule|push|pull_request|workflow_run):/);
    assert.match(source,/github.run_attempt == 1/);
    assert.match(source,/refs\/heads\/main/);
    assert.match(source,/group: api-football-collector-attended-acceptance/);
    assert.match(source,/cancel-in-progress: false/);
    assert.match(source,/persist-credentials: false/);
    assert.match(source,/name: data-steward-readonly/);
  }
  assert.match(live,/GATE_C_DISPATCH_ALREADY_CONSUMED_OR_UNPROVEN/);
  assert.match(live,/name: api-football-attended-acceptance/);
  assert.match(live,/run-gate-c\.mjs/);
  assert.doesNotMatch(readOnly,/GATE_C_DISPATCH_ALREADY_CONSUMED_OR_UNPROVEN/);
  assert.doesNotMatch(readOnly,/name: api-football-attended-acceptance/);
  assert.doesNotMatch(readOnly,/run-gate-c\.mjs/);
  assert.doesNotMatch(readOnly,/CLOUDFLARE_ATTENDED_MUTATION_TOKEN|API_FOOTBALL_ATTENDED_TRIGGER_SECRET|API_FOOTBALL_API_KEY/);
  assert.doesNotMatch(readOnly,/actions:\s*write|contents:\s*write|\bdeployment:\s*true/);
  assert.match(readOnly,/API_FOOTBALL_GATE_C_MODE: ADMISSION/);
  assert.match(readOnly,/gate-c-readonly\.mjs/);
  assert.match(readOnly,/api-football-gate-c-readonly-readiness\.json/);
});
