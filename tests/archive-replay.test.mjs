import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { ARCHIVE_DATASET, parseArchiveCSV, sha256Hex, buildArchiveReplay } from '../src/model/archive-replay.mjs';
import { evaluateWalkForward } from '../src/model/walk-forward.mjs';

if(!globalThis.crypto) globalThis.crypto=webcrypto;

const header='element,position,GW,minutes,total_points,expected_goals,expected_assists,saves,bps,yellow_cards,defensive_contribution';

function archive(gameweeks=18){
  const rows=[header];
  const positions=['GK','DEF','MID','FWD'];
  for(let gw=1;gw<=gameweeks;gw++) for(let index=0;index<positions.length;index++){
    const id=index+1,position=positions[index],minutes=60+index*10;
    rows.push([id,position,gw,minutes,(gw+id)%9,(index+1)/10,(index+1)/20,index===0?3:0,15+index,gw%8===0?1:0,index+2].join(','));
  }
  return rows.join('\n');
}

test('archive pin uses an immutable final-season commit',()=>{
  assert.match(ARCHIVE_DATASET.sourceRef,/^[0-9a-f]{40}$/);
  assert.ok(ARCHIVE_DATASET.url.includes(ARCHIVE_DATASET.sourceRef));
  assert.ok(!ARCHIVE_DATASET.url.includes('/master/'));
});

test('archive parser handles quoted commas deterministically',()=>{
  const rows=parseArchiveCSV('a,b\n"one,two",3');
  assert.deepEqual(rows,[['a','b'],['one,two','3']]);
});

test('SHA-256 is calculated from exact archive text',async()=>{
  assert.equal(await sha256Hex('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('replay predictions use only earlier gameweeks',()=>{
  const replay=buildArchiveReplay(archive());
  assert.ok(replay.observations.length>0);
  assert.ok(replay.observations.every(row=>row.informationGameweek<row.gameweek));
  assert.ok(replay.observations.every(row=>row.variant==='raw'));
});

test('double-gameweek rows aggregate to one player-gameweek observation',()=>{
  const text=archive(14)+'\n1,GK,14,30,2,0,0,1,8,0,1';
  const replay=buildArchiveReplay(text);
  const rows=replay.observations.filter(row=>row.playerId===1&&row.gameweek===14);
  assert.equal(rows.length,1);
  assert.equal(rows[0].actual,((14+1)%9)+2);
});

test('malformed archive rows are counted rather than manufactured',()=>{
  const replay=buildArchiveReplay(archive()+'\nbad,row');
  assert.equal(replay.malformedRows,1);
});

test('archive replay produces raw and train-only fold-calibrated holdouts',async()=>{
  const text=archive(18);
  const replay=buildArchiveReplay(text);
  const result=evaluateWalkForward(replay.observations,{dataset:{
    season:ARCHIVE_DATASET.season,sourceRef:ARCHIVE_DATASET.sourceRef,
    sha256:await sha256Hex(text),rows:replay.rows,malformedRows:replay.malformedRows
  }});
  assert.ok(result.folds.length>0);
  assert.deepEqual(Object.keys(result.ablations),['fold_calibrated','raw']);
  assert.equal(result.ablations.raw.overall.n,result.ablations.fold_calibrated.overall.n);
  assert.equal(result.oddsHistory,'not_available');
});
