import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const file='.github/workflows/data-s1c-private-rpc-acceptance.yml';
const workflow=fs.readFileSync(file,'utf8');

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
  assert.deepEqual([...workflow.matchAll(/secrets\.([A-Z0-9_]+)/g)].map(match=>match[1]).sort(),['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN']);
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
  const probe=workflow.match(/cat >"\$PROBE_DIR\/probe\.mjs" <<'PROBE_SOURCE_END'\n([\s\S]*?)\n\s+PROBE_SOURCE_END/)?.[1]??'';
  const fetch=probe.indexOf('env.CALLER.fetch('),health=probe.indexOf('env.CALLER.health('),query=probe.indexOf('env.CALLER.queryObservations(');
  assert.ok(fetch>0&&fetch<health&&health<query);
  assert.match(probe,/if\(transport\.status!==404\|\|transportBody\.byteLength!==0\)return reply\(\)/);
  assert.match(probe,/if\(health\?\.status!==200[\s\S]*?\)return reply\(\)/);
  assert.match(probe,/const limit=2; const maxPages=20/);
  assert.match(probe,/for\(let pageNumber=0;pageNumber<maxPages;pageNumber\+\+\)/);
  assert.match(probe,/admission_state==='accepted'/);
  assert.match(probe,/row\.fetched_at<=as_of/);
  assert.match(probe,/error==='cursor_invalid'/);
  assert.match(workflow,/"binding":"CALLER","service":"teamsheet-data-platform-acceptance-caller","remote":true/);
  for(const forbidden of [/d1_databases/i,/r2_buckets/i,/kv_namespaces/i,/ingest/i,/DataPlatformIngestEntrypoint/i,/wrangler\s+dev\s+--remote/i])assert.doesNotMatch(probe,forbidden);
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
