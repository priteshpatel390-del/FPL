import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { S, SHARED_STATE_KEYS, REFRESH_OWNED_KEYS } from '../src/state.mjs';
import '../src/ui/mini-leagues-state.mjs';

const SRC_ROOT=fileURLToPath(new URL('../src/',import.meta.url));

function sourceModules(root=SRC_ROOT){
  const files=[];
  for(const entry of readdirSync(root,{withFileTypes:true})){
    const path=join(root,entry.name);
    if(entry.isDirectory()) files.push(...sourceModules(path));
    else if(entry.isFile()&&entry.name.endsWith('.mjs')) files.push(path);
  }
  return files.sort();
}

function directSharedStateUsage(){
  const uses=new Map();
  const add=(key,path)=>{
    if(!uses.has(key)) uses.set(key,new Set());
    uses.get(key).add(path.slice(SRC_ROOT.length));
  };
  for(const path of sourceModules()){
    const source=readFileSync(path,'utf8');
    for(const pattern of [/\bS\.([A-Za-z_$][\w$]*)/g,/\bS\[['"]([^'"]+)['"]\]/g]){
      for(const match of source.matchAll(pattern)) add(match[1],path);
    }
  }
  return uses;
}

test('shared application state inventory declares every direct production S slot',()=>{
  const declared=new Set(SHARED_STATE_KEYS),uses=directSharedStateUsage();
  const undeclared=[...uses.keys()].filter(key=>!declared.has(key)).sort();
  const detail=undeclared.map(key=>`${key}: ${[...uses.get(key)].sort().join(', ')}`).join('\n');
  assert.deepEqual(undeclared,[],detail||'all direct shared-state slots are declared');
});

test('shared state inventory matches S and contains every refresh-owned slot',()=>{
  assert.deepEqual([...SHARED_STATE_KEYS].sort(),Object.keys(S).sort(),'state inventory must describe the actual shared object');
  const declared=new Set(SHARED_STATE_KEYS);
  const missing=REFRESH_OWNED_KEYS.filter(key=>!declared.has(key));
  assert.deepEqual(missing,[],'refresh ownership must remain an explicit subset of shared state');
});

test('legacy Mini-League alias cannot replace canonical runtime preferences',()=>{
  const canonical={
    version:3,
    season:'2026-27',
    selectedLeagueId:'123',
    selectedRivalByLeague:{},
    comparisonRivalsByLeague:{},
    saved:[{id:'123',name:'Canonical',primary:false}],
    pinnedRivals:{}
  };
  S.miniLeagues=canonical;
  const legacy=[{id:'999',name:'Legacy',primary:false}];
  S.leagues=legacy;
  assert.equal(S.miniLeagues,canonical,'legacy compatibility writes must not replace the canonical object');
  assert.equal(S.leagues,canonical.saved,'the alias must always read from canonical saved leagues');
  assert.notEqual(S.leagues,legacy,'the attempted legacy write must remain non-authoritative');
});
