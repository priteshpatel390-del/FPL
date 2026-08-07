import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { teamDecisionAvailabilityPresentation } from '../src/ui/team-decision-home.mjs';

const TEAM_SOURCE=readFileSync(new URL('../src/ui/team-decision-home.mjs',import.meta.url),'utf8');
const APP_SOURCE=readFileSync(new URL('../app.html',import.meta.url),'utf8');

test('flagged Team cards expose explicit Official FPL availability wording',()=>{
  assert.deepEqual(teamDecisionAvailabilityPresentation({status:'d',chance_of_playing_next_round:50}),{
    label:'Doubtful · 50% chance',className:'doubt',aria:'doubtful, 50 percent chance of playing'
  });
  assert.deepEqual(teamDecisionAvailabilityPresentation({status:'d',chance_of_playing_next_round:null}),{
    label:'Doubtful · chance unknown',className:'doubt',aria:'doubtful, chance of playing unknown'
  });
  for(const status of ['i','u','n']){
    assert.deepEqual(teamDecisionAvailabilityPresentation({status}),{
      label:'Unavailable',className:'out',aria:'unavailable'
    });
  }
  assert.deepEqual(teamDecisionAvailabilityPresentation({status:'s'}),{
    label:'Suspended',className:'out',aria:'suspended and unavailable'
  });
  assert.equal(teamDecisionAvailabilityPresentation({status:'a'}),null);
});

test('availability annotation covers both starting and bench cards without changing Team selection',()=>{
  assert.match(TEAM_SOURCE,/const starterSlots=teamPitchLines\(xi\.xi\)\.flatMap\(line=>line\.players\)/);
  assert.match(TEAM_SOURCE,/\.team-pitch \.pitch-player/);
  assert.match(TEAM_SOURCE,/\.team-bench \.bench-grid \.bench-player/);
  assert.match(TEAM_SOURCE,/const benchSlots=teamDecisionBenchDisplayOrder\(xi\.bench\)/);
  assert.match(TEAM_SOURCE,/class:`flag \$\{presentation\.className\} pitch-availability`/);
  assert.match(TEAM_SOURCE,/node\.setAttribute\('aria-label',`\$\{aria\}, \$\{presentation\.aria\}`\)/);
  assert.match(TEAM_SOURCE,/teamDecisionRelabelBench\(stage\);\s*teamDecisionAnnotateAvailability\(stage,xi\);/);
  assert.doesNotMatch(TEAM_SOURCE,/bestXI\s*=|teamPitchCaptaincy\s*=|xpOf\s*=/);
});

test('availability badges cancel generic flag horizontal offset for centred Team cards',()=>{
  assert.match(APP_SOURCE,/\.pitch-availability\{[^}]*display:block[^}]*width:fit-content[^}]*margin:3px auto 0[^}]*overflow-wrap:anywhere[^}]*\}/);
});

test('startup gate owns the application shell until the existing ready event',()=>{
  assert.match(TEAM_SOURCE,/document\.querySelector\('header'\),document\.querySelector\('main'\),document\.querySelector\('nav\.tabs'\)/);
  assert.match(TEAM_SOURCE,/node\.hidden=Boolean\(owned\);\s*node\.inert=Boolean\(owned\);/);
  assert.match(TEAM_SOURCE,/classList\?\.contains\('startup-pending'\)/);
  assert.match(TEAM_SOURCE,/if\(startupPending\) teamDecisionSetStartupShellOwned\(true\)/);
  assert.match(TEAM_SOURCE,/teamsheet:startup-ready/);
  assert.match(TEAM_SOURCE,/teamDecisionSetStartupShellOwned\(false\)/);
  assert.match(TEAM_SOURCE,/\{once:true\}/);
});

test('startup ownership exists in static CSS before application JavaScript runs',()=>{
  assert.match(APP_SOURCE,/body\.startup-pending\s*>\s*header,\s*body\.startup-pending\s*>\s*main,\s*body\.startup-pending\s*>\s*nav\.tabs\s*\{\s*visibility:hidden\s*\}/s);
});
