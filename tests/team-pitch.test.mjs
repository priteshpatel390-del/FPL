import test from 'node:test';
import assert from 'node:assert/strict';
import { TEAM_PITCH_PATTERNS, teamPitchPalette, teamPitchLines, teamPitchCaptaincy } from '../src/ui/team-pitch.mjs';

test('pitch lines preserve every starter once in football visual order', () => {
  const starters = [
    {p:{id:1,element_type:1}}, {p:{id:2,element_type:2}}, {p:{id:3,element_type:2}},
    {p:{id:4,element_type:3}}, {p:{id:5,element_type:3}}, {p:{id:6,element_type:4}}
  ];
  const lines = teamPitchLines(starters);
  assert.deepEqual(lines.map(line => line.position), [4,3,2,1]);
  assert.deepEqual(lines.flatMap(line => line.players.map(slot => slot.p.id)).sort((a,b)=>a-b), [1,2,3,4,5,6]);
});

test('captaincy uses the first two distinct ranked starters', () => {
  const ranked = [
    {s:{p:{id:10}}}, {s:{p:{id:10}}}, {s:{p:{id:11}}}, {s:{p:{id:12}}}
  ];
  assert.deepEqual(teamPitchCaptaincy(ranked), {captainId:10, viceId:11});
});

test('known club palette is repository owned and stable', () => {
  assert.deepEqual(teamPitchPalette({id:1,short_name:'ARS'}), {
    code:'ARS', primary:'#D71920', secondary:'#FFFFFF', accent:'#162A4C', ink:'#FFFFFF', pattern:'sleeves'
  });
});

test('unknown club palette falls back deterministically to an approved pattern', () => {
  const a = teamPitchPalette({id:77,short_name:'XYZ'});
  const b = teamPitchPalette({id:77,short_name:'XYZ'});
  assert.deepEqual(a,b);
  assert.ok(TEAM_PITCH_PATTERNS.includes(a.pattern));
  assert.match(a.primary,/^#[0-9A-F]{6}$/i);
});
