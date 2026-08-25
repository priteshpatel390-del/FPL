import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const file='.github/workflows/data-s1c-private-rpc-acceptance.yml';
const workflow=fs.readFileSync(file,'utf8');
const probeSource=workflow.match(/cat >"\$PROBE_DIR\/probe\.mjs" <<'PROBE_SOURCE_END'\n([\s\S]*?)\n\s+PROBE_SOURCE_END/)?.[1]??'';
const acceptedRow=(id,fetched_at)=>({observation_id:id,fetched_at,admission_state:'accepted'});
async function runProbe(queryObservations){
  const url=`data:text/javascript;base64,${Buffer.from(probeSource).toString('base64')}#${Math.random()}`;
  const probe=(await import(url)).default;
  const response=await probe.fetch(new Request('http://127.0.0.1/accept',{method:'POST'}),{CALLER:{
    fetch:async()=>new Response(null,{status:404}),
    health:async()=>({status:200,body:{ok:true,platformVersion:'1.0.1',mode:'shadow_only'}}),
    queryObservations
  }});
  return response.json();
}

test('DATA-S1C acceptance workflow is manual-only, input-free and least-privilege',()=>{
  assert.equal(fs.existsSync(file),true);
  assert.match(workflow,/^on:\n  workflow_dispatch:\n\npermissions:\n  contents: read$/m);
  assert.doesNotMatch(workflow,/^\s+(?:push|pull_request|pull_request_target|schedule):/m);
  assert.doesNotMatch(workflow,/\binputs\s*:/);
  assert.equal(workflow.match(/^permissions:\n(?:  .+\n)+/m)?.[0],'permissions:\n  contents: read\n');
  assert.match(workflow,/runs-on: ubuntu-latest/);
  assert.match(workflow,/timeout-minutes: 15/);
  assert.match(workflow,/name: data-s1c-private-acceptance/);
  assert.doesNotMatch(workflow,/actions\/upload-artifact|artifact/i);
});

test('DATA-S1C workflow binds execution to the immutable exact canonical main SHA',()=>{
  for(const required of ['priteshpatel390-del/FPL','refs/heads/main','${{ github.sha }}','ref: ${{ github.sha }}','git rev-parse HEAD','git ls-remote https://github.com/priteshpatel390-del/FPL.git refs/heads/main','test "$remote_main" = "$RUN_SHA"','git status --porcelain'])assert.ok(workflow.includes(required),required);
  assert.doesNotMatch(workflow,/workflow_dispatch:[\s\S]{0,150}\bref\s*:/);
  assert.ok(workflow.indexOf('Gate exact canonical main before credentials')<workflow.indexOf('CLOUDFLARE_API_TOKEN: ${{ secrets.'));
});

test('DATA-S1C workflow uses only approved secrets and exact temporary toolchain',()=>{
  assert.deepEqual([...new Set([...workflow.matchAll(/secrets\.([A-Z0-9_]+)/g)].map(match=>match[1]))].sort(),['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN']);
  assert.match(workflow,/actions\/checkout@v5/);
  assert.match(workflow,/actions\/setup-node@v5/);
  assert.match(workflow,/node-version: 24\.19\.0/);
  assert.match(workflow,/node --version\)" = v24\.19\.0/);
  assert.match(workflow,/wrangler@4\.125\.0/);
  assert.match(workflow,/wrangler\" --version 2>\/dev\/null\)" = 4\.125\.0/);
  assert.match(workflow,/npm install --prefix "\$TOOL_DIR" --no-save --no-package-lock/);
  assert.doesNotMatch(workflow,/\bcache\s*:|npm install -g|node_modules\/\.cache/);
});

test('DATA-S1C probe is fetch-first, fail-closed, read-only and bounded',()=>{
  const probe=probeSource;
  const fetch=probe.indexOf('env.CALLER.fetch('),health=probe.indexOf('env.CALLER.health('),query=probe.indexOf('env.CALLER.queryObservations(');
  assert.ok(fetch>0&&fetch<health&&health<query);
  assert.match(probe,/if\(transport\.status!==404\|\|transportBody\.byteLength!==0\)return reply\(\)/);
  assert.match(probe,/if\(health\?\.status!==200[\s\S]*?\)return reply\(\)/);
  assert.match(probe,/const limit=2; const maxPages=20/);
  assert.match(probe,/for\(let pageNumber=0;pageNumber<maxPages;pageNumber\+\+\)/);
  assert.match(probe,/admission_state==='accepted'/);
  assert.match(probe,/row\.fetched_at<=as_of/);
  assert.match(probe,/error==='cursor_invalid'/);
  assert.match(probe,/mismatch\?\.status===400&&mismatch\?\.body\?\.error==='cursor_invalid'/);
  assert.match(workflow,/"binding":"CALLER","service":"teamsheet-data-platform-acceptance-caller","remote":true/);
  for(const forbidden of [/d1_databases/i,/r2_buckets/i,/kv_namespaces/i,/ingest/i,/DataPlatformIngestEntrypoint/i,/wrangler\s+dev\s+--remote/i])assert.doesNotMatch(probe,forbidden);
});

test('DATA-S1C query evidence reports zero rows without vacuous property passes',async()=>{
  const result=await runProbe(async()=>({status:200,body:{observations:[],next_cursor:null}}));
  assert.equal(result.query,'PASS');
  for(const key of ['accepted_only','ordering','as_of','pagination','cursor_continuation','cursor_mismatch'])assert.equal(result[key],'NOT PROVABLE',key);
  assert.equal(result.not_provable,'INSUFFICIENT EXISTING ROWS');
});

test('DATA-S1C query evidence proves one-row facts but not ordering or cursor properties',async()=>{
  const result=await runProbe(async()=>({status:200,body:{observations:[acceptedRow('a','2026-08-20T00:00:00.000Z')],next_cursor:null}}));
  assert.equal(result.query,'PASS'); assert.equal(result.accepted_only,'PASS'); assert.equal(result.as_of,'PASS');
  for(const key of ['ordering','pagination','cursor_continuation','cursor_mismatch'])assert.equal(result[key],'NOT PROVABLE',key);
  assert.equal(result.not_provable,'INSUFFICIENT EXISTING ROWS');
});

test('DATA-S1C query evidence proves two-row ordering but never pagination without a cursor',async()=>{
  const rows=[acceptedRow('a','2026-08-20T00:00:00.000Z'),acceptedRow('b','2026-08-20T00:00:01.000Z')];
  const result=await runProbe(async()=>({status:200,body:{observations:rows,next_cursor:null}}));
  assert.equal(result.query,'PASS'); assert.equal(result.accepted_only,'PASS'); assert.equal(result.ordering,'PASS'); assert.equal(result.as_of,'PASS');
  for(const key of ['pagination','cursor_continuation','cursor_mismatch'])assert.equal(result[key],'NOT PROVABLE',key);
  assert.equal(result.not_provable,'INSUFFICIENT EXISTING ROWS');
});

test('DATA-S1C query evidence proves pagination, continuation and HTTP 400 cursor mismatch only after cursor use',async()=>{
  const calls=[];
  const result=await runProbe(async query=>{
    calls.push(query);
    if(calls.length===1)return {status:200,body:{observations:[acceptedRow('a','2026-08-20T00:00:00.000Z')],next_cursor:'opaque'}};
    if(calls.length===2)return {status:200,body:{observations:[acceptedRow('b','2026-08-20T00:00:01.000Z')],next_cursor:null}};
    return {status:400,body:{error:'cursor_invalid'}};
  });
  assert.equal(calls.length,3); assert.equal(calls[1].cursor,'opaque'); assert.equal(calls[1].as_of,calls[0].as_of);
  assert.equal(calls[2].cursor,'opaque'); assert.notEqual(calls[2].as_of,calls[0].as_of);
  assert.equal(result.query,'PASS'); assert.equal(result.pagination,'PASS'); assert.equal(result.cursor_continuation,'PASS'); assert.equal(result.cursor_mismatch,'PASS');
  assert.equal(result.not_provable,'');
});

test('DATA-S1C workflow forbids mutation, debug leakage and retains unconditional cleanup',()=>{
  const executable=workflow.split('      - name: Gate caller and probe capabilities before credentials')[0]+workflow.split('      - name: Set up exact Node')[1];
  for(const forbidden of [/^\s*(?:"?\$?WRANGLER"?|wrangler)\s+(?:deploy|publish|d1|secret|route|domain)\b/im,/^\s*(?:"?\$?WRANGLER"?|wrangler)\s+versions\s+(?:deploy|upload)\b/im,/WRANGLER_LOG=(?:debug|trace)/i,/ACTIONS_STEP_DEBUG/i,/^\s*set -x/m])assert.doesNotMatch(executable,forbidden);
  assert.match(workflow,/"\$WRANGLER" dev --config "\$PROBE_DIR\/wrangler\.jsonc" --ip 127\.0\.0\.1 --port "\$PORT"/);
  assert.match(workflow,/trap stop_local EXIT INT TERM/);
  assert.match(workflow,/name: Clean temporary acceptance files\n        if: always\(\)/);
  assert.match(workflow,/rm -rf "\$RUNNER_TEMP"\/teamsheet-data-s1c-\*/);
  assert.match(workflow,/name: Write sanitized acceptance summary\n        if: always\(\)/);
});

test('DATA-S1C persistent topology PRE-state precedes every functional attempt and POST-state is unconditional',()=>{
  const pre=workflow.indexOf('- name: Capture persistent topology PRE-state');
  const functional=workflow.indexOf('- name: Run bounded private acceptance');
  const post=workflow.indexOf('- name: Verify persistent topology POST-state');
  const cleanup=workflow.indexOf('- name: Clean temporary acceptance files');
  const enforce=workflow.indexOf('- name: Enforce functional and topology results');
  assert.ok(pre>0&&pre<functional&&functional<post&&post<cleanup&&cleanup<enforce);
  assert.match(workflow,/name: Run bounded private acceptance\n        id: acceptance\n        continue-on-error: true/);
  assert.match(workflow,/name: Verify persistent topology POST-state\n        if: always\(\)/);
  assert.match(workflow,/PRE_ESTABLISHED: \$\{\{ steps\.topology_pre\.outputs\.established \}\}/);
  assert.match(workflow,/NOT RUN — PRE-STATE NOT ESTABLISHED/);
  const functionalStep=workflow.slice(functional,post);
  for(const failure of ['Ephemeral probe startup failed.','Private acceptance transport failed.','transport_fetch','health','query'])assert.ok(functionalStep.includes(failure),failure);
});

test('DATA-S1C PRE and POST topology readers use the Workers Scripts deployment-array contract',()=>{
  const pre=workflow.slice(workflow.indexOf('- name: Capture persistent topology PRE-state'),workflow.indexOf('- name: Run bounded private acceptance'));
  const post=workflow.slice(workflow.indexOf('- name: Verify persistent topology POST-state'),workflow.indexOf('- name: Clean temporary acceptance files'));
  const endpoint='workers/scripts/$service/deployments';
  assert.equal((workflow.match(/workers\/scripts\/\$service\/deployments/g)||[]).length,2);
  assert.ok(pre.includes(endpoint)); assert.ok(post.includes(endpoint));
  assert.doesNotMatch(workflow,/workers\/services\/\$service\/deployments/);
  for(const section of [pre,post]){
    assert.match(section,/Array\.isArray\(body\.result\?\.deployments\)/);
    assert.match(section,/const deployments=body\.result\.deployments/);
    assert.match(section,/Date\.parse\(deployment\.created_on\)/);
    assert.match(section,/const latestTime=Math\.max/);
    assert.match(section,/latest\.length!==1/);
    assert.match(section,/const versions=latest\[0\]\.deployment\.versions/);
    assert.match(section,/const active=versions\.filter\(version=>version\?\.percentage===100\)\.map\(version=>version\.version_id\)/);
    assert.match(section,/active\.length!==1\|\|typeof active\[0\]!=='string'/);
    assert.doesNotMatch(section,/deployments\.flatMap/);
  }
  assert.match(pre,/43d28a3a-5720-48b3-950e-b081e33bcc8b/);
  assert.match(pre,/5edbe951-4be4-46bc-b2cf-17b550396105/);
  assert.match(post,/43d28a3a-5720-48b3-950e-b081e33bcc8b/);
  assert.match(post,/5edbe951-4be4-46bc-b2cf-17b550396105/);
  assert.match(workflow,/name: Verify persistent topology POST-state\n        if: always\(\)/);
});

test('DATA-S1C deployment diagnostics safely classify HTTP, JSON, Cloudflare and version failures',()=>{
  const matches=[...workflow.matchAll(/const classifyDeploymentResponse=(\(text,http,expected\)=>\{[\s\S]*?\n\s+\});/g)];
  assert.equal(matches.length,2);
  const classifiers=matches.map(match=>(0,eval)(`(${match[1]})`));
  const version=(version_id='expected-version',percentage=100)=>({version_id,percentage});
  const deployment=(created_on,versions)=>({created_on,versions});
  const wrapped=deployments=>JSON.stringify({success:true,result:{deployments}});
  const current=versions=>wrapped([deployment('2026-08-25T12:00:00.000Z',versions)]);
  for(const classify of classifiers){
    assert.deepEqual(classify(current([version()]),'200','expected-version'),{diagnostic:'PASS',version:'expected-version'});
    assert.equal(classify('{}','401','expected-version').diagnostic,'HTTP_401');
    assert.equal(classify('{}','403','expected-version').diagnostic,'HTTP_403');
    assert.equal(classify('{}','404','expected-version').diagnostic,'HTTP_404');
    assert.equal(classify('{}','429','expected-version').diagnostic,'HTTP_OTHER_429');
    assert.equal(classify('{invalid','200','expected-version').diagnostic,'JSON_PARSE_ERROR');
    const cloudflareError=JSON.stringify({success:false,errors:[{code:10000,message:'must never appear'},{code:9109,message:'also hidden'},{code:10000}]});
    const diagnostic=classify(cloudflareError,'403','expected-version').diagnostic;
    assert.equal(diagnostic,'HTTP_403,CLOUDFLARE_ERROR_CODE_9109,CLOUDFLARE_ERROR_CODE_10000');
    assert.doesNotMatch(diagnostic,/must never appear|also hidden|\{|\}/);
    for(const invalidContract of [
      JSON.stringify({success:true,result:[{versions:[version()]}]}),
      JSON.stringify({success:true,result:{}}),
      JSON.stringify({success:true,result:{deployments:{}}})
    ])assert.equal(classify(invalidContract,'200','expected-version').diagnostic,'RESPONSE_CONTRACT_INVALID');
    for(const invalidVersion of [
      current([]),current([version('a'),version('b')]),current([{percentage:100}]),
      current([version(42)]),current([version('expected-version',99)]),current([version('wrong-version')])
    ])assert.equal(classify(invalidVersion,'200','expected-version').diagnostic,'ACTIVE_VERSION_INVALID');
    assert.equal(classify(JSON.stringify({success:false,errors:[{code:10001}]}),'200','expected-version').diagnostic,'CLOUDFLARE_ERROR_CODE_10001');
    assert.equal(classify(JSON.stringify({success:false}),'200','expected-version').diagnostic,'CLOUDFLARE_SUCCESS_FALSE');
  }
});

test('DATA-S1C deployment parser selects only the unique greatest created_on deployment',()=>{
  const matches=[...workflow.matchAll(/const classifyDeploymentResponse=(\(text,http,expected\)=>\{[\s\S]*?\n\s+\});/g)];
  assert.equal(matches.length,2);
  assert.equal(matches[0][1],matches[1][1]);
  const classifiers=matches.map(match=>(0,eval)(`(${match[1]})`));
  const version=(version_id,percentage=100)=>({version_id,percentage});
  const deployment=(created_on,versions)=>({created_on,versions});
  const body=deployments=>JSON.stringify({success:true,result:{deployments}});
  const old=index=>deployment(`2026-08-${String(index+1).padStart(2,'0')}T00:00:00.000Z`,[version(`historical-${index}`)]);
  for(const classify of classifiers){
    const history=Array.from({length:7},(_,index)=>old(index));
    const latest=deployment('2026-08-25T12:00:00.000Z',[version('expected-version')]);
    assert.deepEqual(classify(body([latest]),'200','expected-version'),{diagnostic:'PASS',version:'expected-version'});
    assert.deepEqual(classify(body([deployment('2026-08-25T12:00:00.000Z',[version('43d28a3a-5720-48b3-950e-b081e33bcc8b')])]),'200','43d28a3a-5720-48b3-950e-b081e33bcc8b'),{diagnostic:'PASS',version:'43d28a3a-5720-48b3-950e-b081e33bcc8b'});
    assert.deepEqual(classify(body([...history,latest]),'200','expected-version'),{diagnostic:'PASS',version:'expected-version'});
    assert.deepEqual(classify(body([old(0),latest,old(6),old(3)]),'200','expected-version'),{diagnostic:'PASS',version:'expected-version'});
    assert.equal(classify(body([deployment('2026-08-25T12:00:00.000Z',[version('different-version')]),...history]),'200','expected-version').diagnostic,'ACTIVE_VERSION_INVALID');
    assert.equal(classify(body([deployment('2026-08-25T12:00:00.000Z',[version('expected-version'),version('second-version')])]),'200','expected-version').diagnostic,'ACTIVE_VERSION_INVALID');
    assert.equal(classify(body([deployment('2026-08-25T12:00:00.000Z',[version('expected-version',50)])]),'200','expected-version').diagnostic,'ACTIVE_VERSION_INVALID');
  }
});

test('DATA-S1C deployment parser fails closed when current history cannot be selected',()=>{
  const matches=[...workflow.matchAll(/const classifyDeploymentResponse=(\(text,http,expected\)=>\{[\s\S]*?\n\s+\});/g)];
  const classifiers=matches.map(match=>(0,eval)(`(${match[1]})`));
  const version={version_id:'expected-version',percentage:100};
  const body=deployments=>JSON.stringify({success:true,result:{deployments}});
  for(const classify of classifiers){
    assert.equal(classify(body([]),'200','expected-version').diagnostic,'DEPLOYMENT_HISTORY_EMPTY');
    assert.equal(classify(body([{versions:[version]}]),'200','expected-version').diagnostic,'DEPLOYMENT_TIMESTAMP_INVALID');
    assert.equal(classify(body([{created_on:'not-a-date',versions:[version]}]),'200','expected-version').diagnostic,'DEPLOYMENT_TIMESTAMP_INVALID');
    assert.equal(classify(body([{created_on:'2026-08-25T12:00:00.000Z',versions:[version]},{created_on:'2026-08-25T12:00:00.000Z',versions:[version]}]),'200','expected-version').diagnostic,'CURRENT_DEPLOYMENT_AMBIGUOUS');
    assert.equal(classify(body([{created_on:'2026-08-25T12:00:00.000Z'}]),'200','expected-version').diagnostic,'CURRENT_DEPLOYMENT_VERSIONS_INVALID');
    assert.equal(classify(body([{created_on:'2026-08-25T12:00:00.000Z',versions:{}}]),'200','expected-version').diagnostic,'CURRENT_DEPLOYMENT_VERSIONS_INVALID');
  }
});

test('DATA-S1C deployment reads map network failure without exposing raw responses or credentials',()=>{
  const pre=workflow.slice(workflow.indexOf('- name: Capture persistent topology PRE-state'),workflow.indexOf('- name: Run bounded private acceptance'));
  const post=workflow.slice(workflow.indexOf('- name: Verify persistent topology POST-state'),workflow.indexOf('- name: Clean temporary acceptance files'));
  for(const section of [pre,post]){
    const reader=section.slice(section.indexOf('          read_version(){'),section.indexOf('          caller_expected='));
    assert.match(section,/curl_status=\$\?/);
    assert.match(section,/if test "\$curl_status" -ne 0; then echo "\$diagnostic_key=NETWORK_ERROR"/);
    assert.match(section,/--write-out '%\{http_code\}'/);
    assert.match(section,/2>\/dev\/null/);
    assert.doesNotMatch(section,/--show-error|console\.|cat "\$STATE_DIR\/\$destination\.json"/);
    assert.doesNotMatch(reader,/(?:echo|printf)[^\n]*(?:CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID)/);
  }
});

test('DATA-S1C PRE failure blocks acceptance and skipped acceptance is summarized as NOT RUN',()=>{
  const pre=workflow.slice(workflow.indexOf('- name: Capture persistent topology PRE-state'),workflow.indexOf('- name: Run bounded private acceptance'));
  assert.doesNotMatch(pre,/continue-on-error/);
  assert.match(pre,/exit 1/);
  assert.match(workflow,/TRANSPORT: \$\{\{ steps\.acceptance\.outcome == 'skipped' && 'NOT RUN' \|\| steps\.acceptance\.outputs\.transport_fetch \|\| 'FAIL' \}\}/);
  assert.match(workflow,/- transport fetch: \$TRANSPORT/);
  assert.match(workflow,/- PRE caller diagnostic: \$PRE_CALLER_DIAGNOSTIC/);
  assert.match(workflow,/- POST target diagnostic: \$POST_TARGET_DIAGNOSTIC/);
});

test('DATA-S1C final enforcement preserves functional failure and independently rejects topology drift',()=>{
  const post=workflow.slice(workflow.indexOf('- name: Verify persistent topology POST-state'),workflow.indexOf('- name: Clean temporary acceptance files'));
  const enforcement=workflow.slice(workflow.indexOf('- name: Enforce functional and topology results'));
  assert.match(post,/result=FAIL/);
  assert.match(post,/caller\" = \"\$PRE_CALLER/);
  assert.match(post,/target\" = \"\$PRE_TARGET/);
  assert.match(post,/topology_result=\$result/);
  assert.match(enforcement,/if: always\(\)/);
  assert.match(enforcement,/FUNCTIONAL_OUTCOME: \$\{\{ steps\.acceptance\.outcome \}\}/);
  assert.match(enforcement,/test \"\$FUNCTIONAL_OUTCOME\" = success/);
  assert.match(enforcement,/test \"\$TOPOLOGY_RESULT\" = PASS/);
  assert.match(enforcement,/test \"\$CLEANUP_RESULT\" = YES/);
});
