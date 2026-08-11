import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runRouteRenderMeasurements } from '../scripts/measure-route-rendering.mjs';

const GENERATED=['dist/app.bundle.js','dist/index.html','dist/manifest.json','index.html'];
const digest=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const generatedDigests=()=>Object.fromEntries(GENERATED.map(path=>[path,digest(path)]));
const row=(flow,name)=>flow.byName[name]||{calls:0,inactiveCalls:0,totalMs:0,maxMs:0,domWrites:0,xpCalls:0,runScoreCalls:0};

test('M1 production-bundle probe measures route work without changing production outputs',async()=>{
  const before=generatedDigests();
  const report=await runRouteRenderMeasurements({playerCount:120});
  const after=generatedDigests();
  assert.deepEqual(after,before,'the measurement probe must not rewrite committed production outputs');
  assert.equal(report.environment.kind,'Node stub-DOM production-bundle probe');
  assert.equal(report.environment.playerCount,120);
  assert.match(report.environment.routeTimingPrecision,/not browser or physical-device evidence/);

  const team=report.flows['foreground render on Team'];
  assert.equal(row(team,'renderAll').calls,1);
  assert.ok(row(team,'renderTicker').inactiveCalls>=1,'Fixtures should be observed as inactive work on Team');
  assert.ok(row(team,'renderPlayers').inactiveCalls>=1,'Player Explorer should be observed as inactive work on Team');
  assert.equal(row(team,'renderSquad').inactiveCalls,0,'Team should be the active Team renderer');
  assert.ok(row(team,'renderMiniLeagues').calls>=2,'the global render plus data-rendered fan-out should expose redundant League rendering');
  assert.ok(row(team,'transferPerformanceScores').inactiveCalls>=1,'hidden Transfers projection preparation should be observable');
  assert.ok(team.counters.domWrites>0,'the probe should expose a practical DOM-write proxy');
  assert.ok(team.counters.xpCalls>0,'the probe should expose projection work');

  const toTransfers=report.flows['Team → Transfers'];
  assert.equal(row(toTransfers,'renderAll').calls,0,'ordinary route navigation must not become a global render');
  assert.ok(row(toTransfers,'renderTransfers').calls>=2,'both current Transfers route-render owners should be visible to the probe');

  const toLeagues=report.flows['Transfers → Leagues'];
  assert.equal(row(toLeagues,'renderAll').calls,0);
  assert.ok(row(toLeagues,'renderMiniLeagues').calls>=1);

  const toSettings=report.flows['Leagues → Settings'];
  assert.equal(row(toSettings,'renderAll').calls,0);
  assert.equal(row(toSettings,'renderTicker').calls,0);
  assert.equal(row(toSettings,'renderPlayers').calls,0);
  assert.equal(row(toSettings,'renderSquad').calls,0);

  const manual=report.flows['manual squad data-rendered fan-out'];
  assert.ok(row(manual,'renderManual').calls>=1);
  assert.ok(row(manual,'renderSquad').calls>=1);
  assert.ok(row(manual,'renderMiniLeagues').calls>=1,'manual-squad fan-out should expose unrelated League rendering');
  assert.ok(row(manual,'transferPerformanceScores').inactiveCalls>=1,'manual-squad fan-out should expose hidden Transfers preparation');
});

test('M1 measurement tooling stays outside the deterministic production build inputs',()=>{
  const manifest=JSON.parse(readFileSync('dist/manifest.json','utf8'));
  for(const path of ['scripts/measure-route-rendering.mjs','tests/route-render-performance.test.mjs'])
    assert.equal(manifest.buildInputFiles.includes(path),false,`${path} must remain test/investigation tooling only`);
});
