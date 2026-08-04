import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TEAMSHEET_ROUTE_TABLE, normaliseTeamsheetRoute, teamsheetRouteMeta, teamsheetRouteParent } from '../src/ui/app-shell.mjs';

const shell=readFileSync(new URL('../src/ui/app-shell.mjs',import.meta.url),'utf8');
const html=readFileSync(new URL('../app.html',import.meta.url),'utf8');
const evidence=readFileSync(new URL('../src/ui/evidence.mjs',import.meta.url),'utf8');
const outcomes=readFileSync(new URL('../src/ui/outcomes.mjs',import.meta.url),'utf8');
const metrics=readFileSync(new URL('../src/ui/metrics.mjs',import.meta.url),'utf8');
const review=readFileSync(new URL('../src/ui/review.mjs',import.meta.url),'utf8');
const warning=readFileSync(new URL('../src/ui/data-warning.mjs',import.meta.url),'utf8');
const transfers=readFileSync(new URL('../src/ui/transfer-optimiser-view.mjs',import.meta.url),'utf8');
const views=readFileSync(new URL('../src/ui/views.mjs',import.meta.url),'utf8');
const leagues=readFileSync(new URL('../src/ui/mini-leagues-view.mjs',import.meta.url),'utf8');
const includesAll=(source,values)=>values.forEach(value=>assert.equal(source.includes(value),true,`Missing ${value}`));
const excludesAll=(source,values)=>values.forEach(value=>assert.equal(source.includes(value),false,`Unexpected ${value}`));

test('approved Settings hierarchy has route-owned landings and child destinations',()=>{
  const routes=Object.keys(TEAMSHEET_ROUTE_TABLE);
  includesAll(routes.join('\n'),[
    '#/settings/team-account/manual-squad','#/settings/team-account/connection',
    '#/settings/research','#/settings/research/players',
    '#/settings/evidence/deadline','#/settings/evidence/outcomes','#/settings/evidence/metrics','#/settings/evidence/review','#/settings/evidence/exports',
    '#/settings/data/providers','#/settings/data/optional-sources','#/settings/data/calibration','#/settings/data/recovery','#/settings/data/storage',
    '#/settings/help/recommendations','#/settings/help/uncertainty','#/settings/help/limitations','#/settings/help/privacy','#/settings/help/about','#/settings/help/operations'
  ]);
  for(const route of routes.filter(value=>value.startsWith('#/settings/'))){
    assert.equal(teamsheetRouteMeta(route).primary,'settings');
    assert.ok(teamsheetRouteParent(route));
  }
});

test('unknown nested Settings routes fail to their nearest approved landing',()=>{
  assert.equal(normaliseTeamsheetRoute('#/settings/evidence/not-real'),'#/settings/evidence');
  assert.equal(normaliseTeamsheetRoute('#/settings/data/not-real'),'#/settings/data');
  assert.equal(normaliseTeamsheetRoute('#/settings/help/not-real'),'#/settings/help');
  assert.equal(normaliseTeamsheetRoute('#/settings/unknown/not-real'),'#/settings');
});

test('evidence modules use explicit hosts instead of sibling or parent DOM inference',()=>{
  includesAll(shell,['outcomesHost','metricsHost','reviewHost','evidenceExportHost','outcomeExportHost','reviewExportHost','evidenceRecoveryHost','outcomeRecoveryHost','stage10DiagnosticsHost','evidenceStorageHost','outcomeStorageHost','metricStorageHost']);
  includesAll(evidence,["$('evidenceExportHost')","$('evidenceRecoveryHost')","$('evidenceStorageHost')","$('stage10DiagnosticsHost')"]);
  includesAll(outcomes,["$('outcomesHost')","$('outcomeExportHost')","$('outcomeRecoveryHost')","$('outcomeStorageHost')"]);
  includesAll(metrics,["$('metricsHost')","$('metricStorageHost')"]);
  includesAll(review,["$('reviewHost')","$('reviewExportHost')"]);
  for(const source of [evidence,outcomes,metrics,review]) excludesAll(source,['parentElement||$(\'evidencePanel\')','outcomeStatus?.parentElement','metrics?.parentElement']);
});

test('exports, recovery and deletion have distinct destinations and scopes',()=>{
  includesAll(shell,['Downloads are generated on demand','Restored files remain recovery-only','Delete one local dataset at a time']);
  includesAll(evidence,['Download latest snapshot JSON','Restore snapshot JSON','Delete local deadline evidence']);
  includesAll(outcomes,['Download latest outcome JSON','Restore outcome JSON','Delete local official outcomes']);
  includesAll(metrics,['Delete local metrics']);
  includesAll(review,['Download JSON','Download Markdown','Download selected CSV']);
});

test('Help and About exposes guidance, limitations, privacy, operations and real build identity',()=>{
  includesAll(shell,['You remain in control','Read the range, not only the headline','Automated tests do not prove physical iPhone usability','Exported JSON files are complete and unencrypted','Live-season operations','info.modelVersion','info.rulesVersion','info.commit','info.sourceHash']);
  excludesAll(shell,['improved accuracy','guaranteed points','guaranteed rank']);
});

test('material warning hierarchy is consequence-led and wired to affected primary routes',()=>{
  includesAll(warning,["visible=model.kind==='saved-data'",'live Official FPL refresh did not complete','#/settings/data/providers']);
  includesAll(transfers,["renderRouteDataWarning('transferDataWarning',{showUnavailable:false})"]);
  includesAll(views,["renderRouteDataWarning('fixtureDataWarning',{showUnavailable:true})"]);
  includesAll(leagues,["renderRouteDataWarning('leagueDataWarning',{showUnavailable:true})"]);
  includesAll(html,['id="transferDataWarning"','id="fixtureDataWarning"','id="leagueDataWarning"']);
  excludesAll(warning,['All live','health score','provider score']);
});

test('Player Explorer keeps ranking logic but uses mobile card metadata',()=>{
  includesAll(views,["class:'player-result-main'","dataset:{label:'Price'}","dataset:{label:'xP / GW'}","dataset:{label:`${span} GW xP`}","class:'num player-result-secondary'"]);
  includesAll(html,['#view-players table.data tr{display:grid','#view-players table.data td:before{content:attr(data-label)','#view-players table.data td.player-result-secondary{display:none}']);
  includesAll(views,['.sort((a,b) => b.x.total - a.x.total).slice(0, 45)','openPlayerDetailView']);
});

test('route focus is owned by exact headings and remembers the opener for Back navigation',()=>{
  includesAll(shell,['teamsheetRouteHeadingId(route)','rememberedFocus.set(activeRoute,link)','document.contains?.(remembered)','remembered.focus?.({preventScroll:true})','Back to ${parentTitle}']);
  excludesAll(shell,["settingsView.querySelector('h2')"]);
});

test('Settings routes and status surfaces never encode private or record identities',()=>{
  for(const route of Object.keys(TEAMSHEET_ROUTE_TABLE)){
    for(const forbidden of ['teamId','leagueId','managerId','entryId','snapshotId','recordId','apiKey']) assert.equal(route.toLowerCase().includes(forbidden.toLowerCase()),false,`${route} contains ${forbidden}`);
  }
  excludesAll(warning,['endpoint','relay','apiKey','entryId','leagueId']);
});
