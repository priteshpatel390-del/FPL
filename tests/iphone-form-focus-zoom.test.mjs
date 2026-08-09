import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app=readFileSync(new URL('../app.html',import.meta.url),'utf8');
const shell=readFileSync(new URL('../src/ui/app-shell.mjs',import.meta.url),'utf8');
const security=readFileSync(new URL('../src/ui/security-wiring.mjs',import.meta.url),'utf8');

function ruleBody(selector){
  const escaped=selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const match=new RegExp(`${escaped}\\{([^}]*)\\}`).exec(app);
  assert.ok(match,`expected CSS rule for ${selector}`);
  return match[1];
}

test('all current text-entry control families render at the iPhone-safe 16px minimum',()=>{
  const ordinary=ruleBody('input[type=text],input[type=number],input[type=search],input[type=password],select');
  assert.match(ordinary,/(?:^|;)font:inherit(?:;|$)/);
  assert.match(ordinary,/(?:^|;)font-size:16px(?:;|$)/);
  assert.match(ruleBody('textarea'),/(?:^|;)font-size:16px(?:;|$)/);
  assert.match(ruleBody('.global-ask input'),/(?:^|;)font-size:16px(?:;|$)/);

  const staticTypes=[...app.matchAll(/<input\b[^>]*\btype="([^"]+)"/g)].map(match=>match[1]);
  assert.ok(staticTypes.includes('text'));
  assert.ok(staticTypes.includes('number'));
  assert.match(app,/<select\b/);
  assert.match(app,/<textarea\b/);
  assert.match(shell,/type:'search'/);
  assert.match(security,/oddsFieldForSecurity\.type\s*=\s*'password'/);
});

test('zoom prevention does not disable browser magnification or resize non-text controls',()=>{
  const viewport=/<meta name="viewport" content="([^"]+)">/.exec(app)?.[1]||'';
  assert.match(viewport,/width=device-width/);
  assert.doesNotMatch(viewport,/maximum-scale|user-scalable\s*=\s*no/i);

  const ordinarySelector='input[type=text],input[type=number],input[type=search],input[type=password],select';
  assert.doesNotMatch(ordinarySelector,/checkbox|file|range/);
  assert.match(app,/input type="checkbox"/);
  assert.match(app,/input\[type=range\]/);
});
