import { readFileSync, writeFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const write = (path, content) => writeFileSync(path, content);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const replaceOnce = (source, pattern, replacement, label) => {
  const next = source.replace(pattern, replacement);
  assert(next !== source, `No replacement made for ${label}`);
  return next;
};
const appendOnce = (source, marker, addition) => source.includes(marker) ? source : `${source.trimEnd()}\n\n${addition.trim()}\n`;

const iconHelper = `function teamsheetNavIcon(name){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('class','nav-icon');
  svg.setAttribute('viewBox','0 0 24 24');
  svg.setAttribute('aria-hidden','true');
  svg.setAttribute('focusable','false');
  const shapes={
    team:[['path',{d:'M12 3 19 8 12 13 5 8Z'}],['path',{d:'m5 12 7 5 7-5'}],['path',{d:'m5 16 7 5 7-5'}]],
    transfers:[['path',{d:'M4 7h13'}],['path',{d:'m14 4 3 3-3 3'}],['path',{d:'M20 17H7'}],['path',{d:'m10 14-3 3 3 3'}]],
    fixtures:[['rect',{x:'4',y:'5',width:'16',height:'15',rx:'2'}],['path',{d:'M8 3v4M16 3v4M4 10h16M8 14h2M14 14h2M8 17h2M14 17h2'}]],
    leagues:[['path',{d:'M6 21V4'}],['path',{d:'M6 5h11l-2 4 2 4H6'}]],
    settings:[['circle',{cx:'12',cy:'12',r:'3'}],['path',{d:'M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1'}]]
  };
  (shapes[name]||shapes.team).forEach(([tag,attrs])=>{
    const shape=document.createElementNS('http://www.w3.org/2000/svg',tag);
    Object.entries(attrs).forEach(([key,value])=>shape.setAttribute(key,value));
    svg.appendChild(shape);
  });
  return svg;
}
`;

let shell = read('src/ui/app-shell.mjs');
shell = shell
  .replace("Object.freeze({route:'#/team',key:'team',icon:'◈',label:'Team'})", "Object.freeze({route:'#/team',key:'team',icon:'team',label:'Team'})")
  .replace("Object.freeze({route:'#/transfers',key:'transfers',icon:'⇄',label:'Transfers'})", "Object.freeze({route:'#/transfers',key:'transfers',icon:'transfers',label:'Transfers'})")
  .replace("Object.freeze({route:'#/fixtures',key:'fixtures',icon:'▦',label:'Fixtures'})", "Object.freeze({route:'#/fixtures',key:'fixtures',icon:'fixtures',label:'Fixtures'})")
  .replace("Object.freeze({route:'#/leagues',key:'leagues',icon:'⚑',label:'Leagues'})", "Object.freeze({route:'#/leagues',key:'leagues',icon:'leagues',label:'Leagues'})")
  .replace("Object.freeze({route:'#/settings',key:'settings',icon:'⚙',label:'Settings'})", "Object.freeze({route:'#/settings',key:'settings',icon:'settings',label:'Settings'})");
assert(!shell.includes("icon:'⚙'"), 'Settings emoji icon remained');

shell = replaceOnce(
  shell,
  /function teamsheetRouteHeader\(eyebrow,title,hint\)\{[\s\S]*?\n\}\n\nfunction teamsheetSettingsCard/,
  `function teamsheetRouteHeader(title,hint){
  return teamsheetElement('div',{class:'route-header'},
    teamsheetElement('a',{class:'route-back',href:'#/settings','aria-label':'Back to Settings'},
      teamsheetElement('span',{'aria-hidden':'true'},'←')),
    teamsheetElement('h2',{tabindex:'-1'},title),
    teamsheetElement('p',{class:'hint'},hint));
}

function teamsheetSettingsCard`,
  'arrow-only Settings route header');

shell = replaceOnce(shell, /\nfunction teamsheetRouteHeader/, `\n${iconHelper}\nfunction teamsheetRouteHeader`, 'controlled SVG icon helper');

shell = replaceOnce(
  shell,
  /const link=teamsheetElement\('a',\{class:'tab',href:item\.route,'data-primary':item\.key\},\n\s*teamsheetElement\('span',\{class:'ic','aria-hidden':'true'\},item\.icon\),/,
  `const link=teamsheetElement('a',{class:'tab',href:item.route,'data-primary':item.key},
      teamsheetElement('span',{class:'ic','aria-hidden':'true'},teamsheetNavIcon(item.icon)),`,
  'runtime navigation SVG');

shell = replaceOnce(
  shell,
  /\n  const askCallout=teamsheetElement\('aside',[\s\S]*?\n  else teamView\.appendChild\(askCallout\);\n/,
  '\n',
  'Team Ask callout removal');

shell = replaceOnce(
  shell,
  /askView\.insertBefore\(teamsheetElement\('a',\{class:'route-back',href:'#\/team'\},'← Team'\),askView\.firstChild\);/,
  `const askRouteBack=teamsheetElement('a',{id:'askRouteBack',class:'route-back',href:'#/team','aria-label':'Back to Team'},
    teamsheetElement('span',{'aria-hidden':'true'},'←'));
  askView.insertBefore(askRouteBack,askView.firstChild);`,
  'Ask origin back arrow');

shell = shell
  .replace("teamsheetRouteHeader('Settings','Team & Account'", "teamsheetRouteHeader('Team & Account'")
  .replace("teamsheetRouteHeader('Settings · Research Tools','Player Explorer'", "teamsheetRouteHeader('Player Explorer'")
  .replace("teamsheetRouteHeader('Settings','Evidence & Performance'", "teamsheetRouteHeader('Evidence & Performance'")
  .replace("teamsheetRouteHeader('Settings','Data & Diagnostics'", "teamsheetRouteHeader('Data & Diagnostics'")
  .replace("teamsheetRouteHeader('Settings','Help & About'", "teamsheetRouteHeader('Help & About'");
assert(!shell.includes("teamsheetRouteHeader('Settings'"), 'Duplicate Settings eyebrow route headers remained');

const globalAskBlock = `  const globalAsk=header?teamsheetElement('form',{id:'askTeamsheetGlobal',class:'global-ask',role:'search'}):null;
  const globalAskInput=globalAsk?teamsheetElement('input',{id:'askTeamsheetGlobalInput',type:'search',placeholder:'Ask Teamsheet…',autocomplete:'off','aria-label':'Ask Teamsheet'}):null;
  const globalAskSend=globalAsk?teamsheetElement('button',{id:'askTeamsheetGlobalSend',class:'global-ask-send',type:'submit','aria-label':'Send question',disabled:'disabled'},
    teamsheetElement('span',{'aria-hidden':'true'},'↑')):null;
  if(globalAsk&&globalAskInput&&globalAskSend){
    globalAsk.append(globalAskInput,globalAskSend);
    header.appendChild(globalAsk);
    globalAskInput.addEventListener('input',()=>{ globalAskSend.disabled=!globalAskInput.value.trim(); });
    globalAsk.addEventListener('submit',event=>{
      event.preventDefault();
      const question=globalAskInput.value.trim();
      if(!question) return;
      const current=normaliseTeamsheetRoute(globalThis.location?.hash||'#/team');
      const origin=current==='#/ask'?'#/team':current;
      const originMeta=teamsheetRouteMeta(origin);
      askRouteBack.setAttribute('href',origin);
      askRouteBack.setAttribute('aria-label',\`Back to \${originMeta.title}\`);
      askView.dataset.originRoute=origin;
      const fullQuestion=document.getElementById('q');
      if(fullQuestion) fullQuestion.value=question;
      navigateTeamsheetRoute('#/ask');
      setTimeout(()=>document.getElementById('askBtn')?.click?.(),0);
      globalAskInput.value='';
      globalAskSend.disabled=true;
    });
  }

  const updateKeyboardState=()=>{
    const viewport=globalThis.visualViewport;
    const keyboardOpen=Boolean(viewport&&globalThis.innerHeight-viewport.height>160);
    document.documentElement.classList.toggle('keyboard-open',keyboardOpen);
  };
  globalThis.visualViewport?.addEventListener?.('resize',updateKeyboardState);
  globalThis.visualViewport?.addEventListener?.('scroll',updateKeyboardState);
  globalThis.addEventListener?.('pageshow',updateKeyboardState);
  document.addEventListener?.('focusin',updateKeyboardState);
  document.addEventListener?.('focusout',()=>setTimeout(updateKeyboardState,0));
  updateKeyboardState();

`;

shell = replaceOnce(
  shell,
  /\n  const headerActions=header\?teamsheetElement[\s\S]*?\n  const topLevelViews=/,
  `\n${globalAskBlock}  const topLevelViews=`,
  'header pills replacement with global Ask composer');

shell = replaceOnce(
  shell,
  /const heading=activeNode\.querySelector\('h2'\);\n\s*heading\?\.focus\?\.\(\{preventScroll:true\}\);/,
  `const heading=activeNode.querySelector('h2');
      heading?.setAttribute?.('tabindex','-1');
      heading?.focus?.({preventScroll:true});`,
  'accessible route focus without visible outline');

assert(shell.includes('askTeamsheetGlobalInput'), 'Global Ask input missing');
assert(!shell.includes('providerHealthCompact'), 'Provider compact remained in shell');
assert(!shell.includes('askTeamsheetCompact'), 'Ask compact pill remained in shell');
assert(!shell.includes('askCallout'), 'Ask callout remained in shell');
write('src/ui/app-shell.mjs', shell);

let evidence = read('src/ui/evidence.mjs');
evidence = replaceOnce(
  evidence,
  /function ensureEvidenceCompact\(\)\{[\s\S]*?\n\}\nfunction ensureStage10OperationsUi/,
  `function ensureEvidenceCompact(){
  $('evidenceCompact')?.remove?.();
}
function ensureStage10OperationsUi`,
  'Evidence header compact removal');
write('src/ui/evidence.mjs', evidence);

const cssBlock = `/* Teamsheet 2.0.1 — route hierarchy, stable iPhone dock and global Ask composer */
html{min-height:100%;min-height:100dvh}
body{min-height:100%;min-height:100dvh;padding-bottom:calc(82px + env(safe-area-inset-bottom,0px))}
.global-ask{position:relative;width:min(100%,620px);margin-top:12px}
.global-ask input{width:100%;min-height:48px;padding:10px 52px 10px 15px;border:1px solid rgba(255,255,255,.32);border-radius:24px;background:rgba(255,255,255,.12);color:#fff;font-size:15px;box-shadow:none}
.global-ask input::placeholder{color:#C7D3CC}.global-ask input:focus-visible{outline:2.5px solid #fff;outline-offset:2px}
.global-ask-send{position:absolute;right:5px;top:50%;transform:translateY(-50%);display:grid;place-items:center;width:38px;height:38px;padding:0;border:0;border-radius:50%;background:var(--claret);color:#fff;font-size:23px;line-height:1;font-weight:700}
.global-ask-send:disabled{background:rgba(255,255,255,.18);color:#AEBBB4;cursor:default}.global-ask-send:not(:disabled):active{transform:translateY(-50%) scale(.96)}
nav.tabs{position:fixed;inset:auto 0 0 0;z-index:1000;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));min-height:calc(64px + env(safe-area-inset-bottom,0px));padding:4px 4px env(safe-area-inset-bottom,0px);box-sizing:border-box;transform:translate3d(0,0,0);backface-visibility:hidden;isolation:isolate}
.tab{height:56px;min-width:0;padding:6px 2px;justify-content:center;box-sizing:border-box;text-decoration:none}
.tab .ic{display:grid;place-items:center;width:22px;height:22px;font-size:0;line-height:1}.nav-icon{display:block;width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
html.keyboard-open nav.tabs{opacity:0;visibility:hidden;pointer-events:none}
h2[tabindex="-1"]:focus{outline:none}
.team-context{border:1px solid var(--line);border-radius:var(--r);background:#F7F9F5;padding:14px;margin:14px 0}
.team-context-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:10px}
.team-context-head h3{font-size:16px}.team-context-head>.status{max-width:300px;text-align:right}
.settings-header{margin-bottom:12px}.settings-grid{display:grid;gap:10px}
.settings-card{display:grid;grid-template-columns:40px minmax(0,1fr) 18px;align-items:center;gap:10px;min-height:82px;padding:14px;border:1px solid var(--line);border-radius:var(--r);background:var(--panel);box-shadow:var(--shadow);color:var(--ink);text-decoration:none}
.settings-card:hover{background:#F7F9F5;border-color:#BFC7BC}.settings-card:focus-visible{outline:2.5px solid var(--info);outline-offset:2px}
.settings-card-icon{display:grid;place-items:center;width:40px;height:40px;border-radius:10px;background:#EAF0EB;color:var(--pitch);font-size:19px;font-weight:800}
.settings-card-copy{min-width:0}.settings-card h3{font-size:15px;margin:0}.settings-card-description{display:block;color:var(--ink-soft);font-size:12.5px;margin-top:2px}
.settings-card-arrow{font-size:25px;color:var(--ink-soft)}
.route-header{position:relative;margin-bottom:12px;padding-top:2px}.route-header h2{font-size:20px;margin-top:0}.route-header .hint{margin:3px 0 0;color:var(--ink-soft);font-size:13px}
.route-back{display:grid;place-items:center;width:44px;height:44px;min-height:44px;margin:0 0 4px;color:var(--claret);font-size:27px;font-weight:700;line-height:1;text-decoration:none;border-radius:50%}
.route-back:hover{background:#F7EEF0;text-decoration:none}.route-back:focus-visible{outline:2.5px solid var(--info);outline-offset:2px}
.settings-subview>.panel:last-child{margin-bottom:0}
@media(min-width:720px){.settings-grid{grid-template-columns:1fr 1fr}.settings-card:last-child{grid-column:1/-1}}
`;

const staticIcons = {
  team:'<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3 19 8 12 13 5 8Z"></path><path d="m5 12 7 5 7-5"></path><path d="m5 16 7 5 7-5"></path></svg>',
  transfers:'<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h13"></path><path d="m14 4 3 3-3 3"></path><path d="M20 17H7"></path><path d="m10 14-3 3 3 3"></path></svg>',
  fixtures:'<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="4" y="5" width="16" height="15" rx="2"></rect><path d="M8 3v4M16 3v4M4 10h16M8 14h2M14 14h2M8 17h2M14 17h2"></path></svg>',
  leagues:'<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 21V4"></path><path d="M6 5h11l-2 4 2 4H6"></path></svg>',
  settings:'<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3"></circle><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"></path></svg>'
};
const staticNav = `<nav class="tabs" aria-label="Primary">
  <a class="tab" href="#/team"><span class="ic" aria-hidden="true">${staticIcons.team}</span><span class="tab-label">Team</span></a>
  <a class="tab" href="#/transfers"><span class="ic" aria-hidden="true">${staticIcons.transfers}</span><span class="tab-label">Transfers</span></a>
  <a class="tab" href="#/fixtures"><span class="ic" aria-hidden="true">${staticIcons.fixtures}</span><span class="tab-label">Fixtures</span></a>
  <a class="tab" href="#/leagues"><span class="ic" aria-hidden="true">${staticIcons.leagues}</span><span class="tab-label">Leagues</span></a>
  <a class="tab" href="#/settings"><span class="ic" aria-hidden="true">${staticIcons.settings}</span><span class="tab-label">Settings</span></a>
</nav>`;

let appHtml = read('app.html');
appHtml = replaceOnce(
  appHtml,
  /\/\* Teamsheet 2\.0\.1 — route hierarchy, five-tab navigation and Settings menu \*\/[\s\S]*?(?=@media\(max-width:520px\)\{)/,
  cssBlock,
  'Teamsheet 2.0.1 CSS block');
appHtml = appHtml
  .replace(/\s*nav\.tabs\{padding-left:2px;padding-right:2px\}\.tab\{font-size:9px;padding-left:0;padding-right:0\}\.tab \.ic\{font-size:15px\}/, '\n  .tab{font-size:9px}.tab-label{max-width:68px}')
  .replace(/\.team-context-head>\.status\{text-align:left\}\.ask-callout\{align-items:stretch;flex-direction:column\}\.ask-callout \.btn\{text-align:center\}/, '.team-context-head>.status{text-align:left}.global-ask{width:100%}');
appHtml = replaceOnce(appHtml, /<nav class="tabs" aria-label="Primary">[\s\S]*?<\/nav>/, staticNav, 'static controlled-SVG navigation');
assert(!appHtml.includes('ask-callout'), 'Ask callout CSS remained');
assert(!appHtml.includes('providerHealthCompact'), 'Provider compact CSS remained');
assert(!appHtml.includes('⚙'), 'Settings emoji remained in app.html');
write('app.html', appHtml);

const navigationTests = `import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TEAMSHEET_PRIMARY_ROUTES, normaliseTeamsheetRoute, teamsheetRouteMeta } from '../src/ui/app-shell.mjs';

const shellSource=readFileSync(new URL('../src/ui/app-shell.mjs',import.meta.url),'utf8');
const appHtml=readFileSync(new URL('../app.html',import.meta.url),'utf8');
const viewsSource=readFileSync(new URL('../src/ui/views.mjs',import.meta.url),'utf8');
const evidenceSource=readFileSync(new URL('../src/ui/evidence.mjs',import.meta.url),'utf8');

const staticNav=/<nav class="tabs"[\\s\\S]*?<\\/nav>/.exec(appHtml)?.[0]||'';

test('primary navigation follows the approved five-destination order',()=>{
  assert.deepEqual(TEAMSHEET_PRIMARY_ROUTES.map(item=>item.label),['Team','Transfers','Fixtures','Leagues','Settings']);
  assert.deepEqual(TEAMSHEET_PRIMARY_ROUTES.map(item=>item.route),['#/team','#/transfers','#/fixtures','#/leagues','#/settings']);
});

test('legacy hashes resolve to the new information architecture',()=>{
  assert.equal(normaliseTeamsheetRoute('#players'),'#/settings/research/players');
  assert.equal(normaliseTeamsheetRoute('#league'),'#/leagues');
  assert.equal(normaliseTeamsheetRoute('#more'),'#/settings');
  assert.equal(normaliseTeamsheetRoute('#fixtures'),'#/fixtures');
});

test('unknown and empty destinations fail safely to Team',()=>{
  assert.equal(normaliseTeamsheetRoute(''),'#/team');
  assert.equal(normaliseTeamsheetRoute('#/not-a-real-screen'),'#/team');
});

test('Settings subroutes keep Settings as the active primary destination',()=>{
  assert.deepEqual(teamsheetRouteMeta('#/settings/evidence'),{route:'#/settings/evidence',title:'Evidence & Performance',primary:'settings',settings:'evidence'});
  assert.equal(teamsheetRouteMeta('#/ask').primary,null);
});

test('route addresses never encode account, provider-key or evidence identities',()=>{
  const routes=TEAMSHEET_PRIMARY_ROUTES.map(item=>item.route).concat(['#/ask','#/settings/team-account','#/settings/research/players','#/settings/evidence','#/settings/data','#/settings/help']);
  routes.forEach(route=>assert.doesNotMatch(route,/teamId|leagueId|odds|key|record|snapshot|manager/i));
});

test('static deployable navigation uses exactly five real links',()=>{
  assert.match(staticNav,/aria-label="Primary"/);
  assert.equal((staticNav.match(/class="tab"/g)||[]).length,5);
  ['team','transfers','fixtures','leagues','settings'].forEach(route=>assert.match(staticNav,new RegExp('href="#\\/'+route+'"')));
  assert.doesNotMatch(staticNav,/>Players<|>More<|>Ask</);
  assert.doesNotMatch(staticNav,/role="tablist"|role="tab"/);
});

test('bottom navigation uses controlled monochrome SVG icons rather than emoji glyphs',()=>{
  assert.equal((staticNav.match(/class="nav-icon"/g)||[]).length,5);
  assert.match(shellSource,/createElementNS\('http:\\/\\/www\\.w3\\.org\\/2000\\/svg','svg'\)/);
  assert.doesNotMatch(staticNav,/⚙|◈|⇄|▦|⚑/);
  assert.doesNotMatch(shellSource,/icon:'⚙'/);
});

test('router owns history and active navigation instead of legacy click-to-hide wiring',()=>{
  assert.match(shellSource,/addEventListener\?\.\('hashchange'/);
  assert.match(shellSource,/replaceState/);
  assert.match(shellSource,/aria-current/);
  assert.doesNotMatch(viewsSource,/document\.querySelectorAll\('\.tab'\)/);
  assert.doesNotMatch(viewsSource,/behavior:'smooth'/);
});

test('global Ask Teamsheet composer replaces header Data and Evidence controls',()=>{
  assert.match(shellSource,/askTeamsheetGlobalInput/);
  assert.match(shellSource,/askTeamsheetGlobalSend/);
  assert.match(shellSource,/placeholder:'Ask Teamsheet…'/);
  assert.match(shellSource,/'aria-label':'Send question'/);
  assert.match(shellSource,/>?['\"]↑['\"]/);
  assert.doesNotMatch(shellSource,/providerHealthCompact|askTeamsheetCompact|askCallout|headerActions/);
  assert.match(evidenceSource,/evidenceCompact'\)\?\.remove/);
});

test('global Ask carries the typed question into the full Ask route and preserves origin',()=>{
  assert.match(shellSource,/fullQuestion\.value=question/);
  assert.match(shellSource,/askView\.dataset\.originRoute=origin/);
  assert.match(shellSource,/Back to \\${originMeta\.title}/);
  assert.match(shellSource,/document\.getElementById\('askBtn'\)\?\.click/);
});

test('Settings headings retain programmatic focus without a visible blue outline',()=>{
  assert.match(shellSource,/heading\?\.setAttribute\?\.\('tabindex','-1'\)/);
  assert.match(appHtml,/h2\[tabindex="-1"\]:focus\{outline:none\}/);
});

test('Settings subsections use one accessible arrow-only back control',()=>{
  assert.match(shellSource,/'aria-label':'Back to Settings'/);
  assert.doesNotMatch(shellSource,/← Settings|teamsheetRouteHeader\('Settings'/);
  assert.doesNotMatch(shellSource,/teamsheetRouteHeader\('Settings · Research Tools'/);
});

test('iPhone dock has one fixed safe-area grid and keyboard recovery contract',()=>{
  assert.match(appHtml,/nav\.tabs\{position:fixed;inset:auto 0 0 0/);
  assert.match(appHtml,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(appHtml,/env\(safe-area-inset-bottom,0px\)/);
  assert.match(appHtml,/html\.keyboard-open nav\.tabs/);
  assert.match(shellSource,/visualViewport/);
});

test('Team keeps the current free-transfer and bank controls pending the separate FPL authority gate',()=>{
  assert.match(shellSource,/teamContext/);
  assert.match(appHtml,/id="ftCount"/);
  assert.match(appHtml,/id="bankIn"/);
});

test('Settings remains an organised five-section menu',()=>{
  ['Team & Account','Research Tools','Evidence & Performance','Data & Diagnostics','Help & About'].forEach(label=>assert.match(shellSource,new RegExp(label)));
  assert.doesNotMatch(shellSource,/id:'view-more'|>More</);
});

test('Fixtures and Leagues remain primary while Player Explorer stays under Research Tools',()=>{
  assert.match(shellSource,/#\\/fixtures/);
  assert.match(shellSource,/#\\/leagues/);
  assert.match(shellSource,/#\\/settings\\/research\\/players/);
  assert.match(shellSource,/playersView\.classList\.remove\('view'\)/);
});

test('Evidence and Provider Health detail remain available through Settings only',()=>{
  assert.match(evidenceSource,/#\\/settings\\/evidence/);
  assert.match(shellSource,/#\\/settings\\/data/);
  assert.match(shellSource,/providerHealthDetail/);
  assert.doesNotMatch(evidenceSource,/data-view="more"/);
});
`;
write('tests/navigation-settings.test.mjs', navigationTests);

let providerTest = read('tests/provider-health-ui.test.mjs');
providerTest = providerTest
  .replace("test('app shell exposes global compact health and full Settings data detail',()=>{", "test('Provider Health detail remains under Settings without a global header pill',()=>{")
  .replace("  assert.match(source,/providerHealthCompact/);\n", "  assert.doesNotMatch(source,/providerHealthCompact/);\n");
write('tests/provider-health-ui.test.mjs', providerTest);

const reviewDoc = `# TEAMSHEET2-ITEM1-IPHONE-REVIEW.md — Physical iPhone review follow-up

Status: **Owner findings recorded 31 July 2026. Interface corrections approved for implementation; data/security items remain investigation only.**

## Physical evidence

Pritesh opened the first-party GitHub Pages preview from an iPhone Home Screen installation and reviewed every static route. This produced direct evidence of inconsistent dock positioning, emoji/icon mismatch, visible route-heading focus rings, duplicated Settings hierarchy and an over-prominent diagnostic header. Populated Team, Transfers, Fixtures, Player Explorer and Leagues behaviour could not be accepted because Official FPL data did not load in the preview.

## Approved interface corrections

- Data and Evidence are removed from the global header; their complete detail remains under Settings.
- Every route receives one compact Ask Teamsheet text field with an internal claret upward-arrow send control.
- Ask draft text persists while moving through routes because the composer is one persistent shell element.
- Sending carries the question into the full Ask route and provides an accessible return arrow to the originating route.
- The bottom navigation is one fixed five-column safe-area dock with controlled monochrome SVG icons.
- The dock is hidden while the iPhone software keyboard materially reduces the visual viewport, then restored when the viewport returns.
- Route headings retain programmatic focus for assistive technology while non-interactive headings suppress Safari's visible focus outline.
- Settings subsections use one accessible claret back arrow, without repeated red or grey Settings labels.

## Investigation only — no implementation authority

### Foreground refresh

Existing behaviour deliberately blocks decision controls while a complete approved-provider cycle settles, preventing a visible mixture of old and new verified state. Physical review shows that repeated foreground returns make the app feel frozen. The proposed direction is a separately approved double-buffer/stale-while-revalidate design: keep the last complete verified state interactive, build the next complete state off-screen, then swap atomically. This changes the Stage 10.1 trust boundary and is not implemented in this patch.

### First-party preview data failure

The preview reached explicit restricted mode after Official FPL relay requests failed or timed out. The static GitHub Pages app still depends on public CORS relays whose recorded availability is medium. A populated acceptance run requires a reliable first-party transport design—most likely the already-deferred same-origin serverless proxy—but no provider, endpoint, relay or CSP change is authorised here.

### Bank and free transfers

The owner requires both values to be read-only and authoritative from the connected FPL account. The current application retains manual fields. The repository has not yet proven a public Official FPL response that reliably supplies the manager's current available free transfers and bank without authentication or inference. No guessed or derived value may be labelled authoritative. Endpoint, authentication, privacy, fallback and transfer-planner consequences require a separate proposal and approval.

## Remaining acceptance gate

The corrected preview must be reviewed again on the physical iPhone. Full 2.0.1 acceptance also remains blocked until a populated first-party preview permits review of the squad, player, transfer, fixture and league surfaces.
`;
write('docs/TEAMSHEET2-ITEM1-IPHONE-REVIEW.md', reviewDoc);

let item = read('docs/TEAMSHEET2-ITEM1.md');
item = item
  .replace('Ask Teamsheet remains a full destination but is reached through prominent Team and global actions rather than a cramped sixth bottom tab.', 'Ask Teamsheet remains a full destination but is reached through one compact global composer rather than a cramped sixth bottom tab.')
  .replace('- Ask Teamsheet is regularly used and must be accessible from Team and the global header.', '- Ask Teamsheet is regularly used and is available as the same compact text field at the top of every route, with an internal claret upward-arrow send control.')
  .replace('- prominent Ask Teamsheet action\n', '- persistent global Ask Teamsheet composer\n')
  .replace('Ask Teamsheet remains `#/ask`. It is linked from Team and the header. Its provider and hosted-build limitation are unchanged.', 'Ask Teamsheet remains `#/ask`. The persistent shell composer carries a question into the full route and records an accessible return destination. Data and Evidence no longer occupy the global header; their detail remains under Settings. Ask provider and hosted-build limitations are unchanged.')
  .replace('- all five labels remain visible at narrow iPhone widths;', '- all five labels share one fixed safe-area dock and controlled monochrome SVG icons at narrow iPhone widths;')
  .replace('- Settings subroutes provide a clear back link;', '- Settings subroutes provide one arrow-only accessible back link;')
  .replace('- route headings receive focus after user navigation;', '- route headings receive programmatic focus after user navigation without a visible outline on non-interactive headings;');
item = appendOnce(item, '## Physical iPhone review amendment', `## Physical iPhone review amendment

The first physical review is recorded in \`docs/TEAMSHEET2-ITEM1-IPHONE-REVIEW.md\`. Interface corrections are part of 2.0.1. Foreground-refresh behaviour, populated-preview transport, and authoritative read-only bank/free-transfer values remain separately gated investigation items. The current manual bank and free-transfer controls are deliberately unchanged by this interface patch.`);
write('docs/TEAMSHEET2-ITEM1.md', item);

const limitationRows = `| UI-6 | First Teamsheet 2.0.1 physical iPhone review found dock, icon, focus and Settings-header defects | Approved interface corrections are implemented on the draft branch; a repeat physical review is still required | Teamsheet 2.0.1 review | Open (retest gate) |
| REFRESH-1 | Qualifying foreground return temporarily locks the app while a complete verified provider cycle settles | Trust consistency is preserved, but switching apps repeatedly feels frozen; non-blocking atomic refresh requires separate security design | Separate approved investigation | Open (gated) |
| FPL-1 | The first-party Pages preview could not load core Official FPL data through the public relay cascade | Populated squad, transfer, fixture, player and league iPhone acceptance is blocked | Separate transport investigation | Open (acceptance blocker) |
| ACCOUNT-1 | Bank and available free transfers remain manual inputs rather than proven authoritative account values | Values can be entered but are not yet verified from the connected FPL account; no inference may be labelled authoritative | Separate data/security design | Open (gated) |
`;
let limitations = read('docs/KNOWN_LIMITATIONS.md');
limitations = limitations.includes('| UI-6 |') ? limitations : limitations.replace('| AI-1 |', `${limitationRows}| AI-1 |`);
write('docs/KNOWN_LIMITATIONS.md', limitations);

for (const path of ['CLAUDE.md','docs/PROJECT_CONTEXT.md','docs/ROADMAP.md','docs/TESTING.md','docs/TEAMSHEET2-ITEM1.md']) {
  let content=read(path);
  content=content.replace(/440\/440/g,'__TEST_COUNT__/__TEST_COUNT__');
  write(path,content);
}

let architecture = read('docs/ARCHITECTURE.md');
architecture = appendOnce(architecture, '## Teamsheet 2.0.1 iPhone shell amendment', `## Teamsheet 2.0.1 iPhone shell amendment

The global shell owns one persistent Ask composer, one fixed five-column safe-area navigation dock, controlled SVG navigation icons, route focus presentation and keyboard-viewport recovery. Data and Evidence remain full Settings destinations rather than global header controls. Provider transport and foreground-refresh orchestration are unchanged.`);
write('docs/ARCHITECTURE.md', architecture);

let decisions = read('docs/DECISIONS.md');
decisions = appendOnce(decisions, '## Teamsheet 2.0.1 physical-review decisions — 31 July 2026', `## Teamsheet 2.0.1 physical-review decisions — 31 July 2026

- Use one compact Ask Teamsheet field with an internal claret upward arrow on every route; do not use separate Data, Evidence or Ask header pills.
- Use a fixed five-column iPhone safe-area dock with controlled monochrome SVG icons.
- Preserve programmatic route-heading focus but suppress the visible focus outline on non-interactive headings.
- Use one arrow-only Settings back control without duplicate Settings labels.
- Treat foreground refresh, populated-preview transport and authoritative bank/free-transfer retrieval as separate investigation gates; this approval does not authorise their implementation.`);
write('docs/DECISIONS.md', decisions);

let blueprint = read('docs/TEAMSHEET2-PRODUCT-BLUEPRINT.md');
blueprint = appendOnce(blueprint, '## 2.0.1 physical-review amendment — 31 July 2026', `## 2.0.1 physical-review amendment — 31 July 2026

The global shell uses one compact Ask Teamsheet composer at the top of every destination, with an internal claret upward-arrow send control. Data and Evidence are Settings content, not global header controls. The five primary destinations share one fixed safe-area dock and controlled monochrome icons. These presentation decisions do not authorise changes to provider transport, foreground refresh trust boundaries or account-derived bank/free-transfer data.`);
write('docs/TEAMSHEET2-PRODUCT-BLUEPRINT.md', blueprint);

let roadmap = read('docs/ROADMAP.md');
roadmap = appendOnce(roadmap, '## Teamsheet 2.0.1 physical iPhone follow-up', `## Teamsheet 2.0.1 physical iPhone follow-up

- **Approved interface correction:** global Ask composer, stable dock/icons, focus presentation and simplified Settings back hierarchy.
- **Investigation only:** non-blocking foreground refresh, reliable populated preview transport, and authoritative read-only bank/free-transfer retrieval.
- **Merge gate:** full tests/build/reproducibility, refreshed preview, repeat physical iPhone review, populated-data acceptance and explicit owner approval.`);
write('docs/ROADMAP.md', roadmap);

let testing = read('docs/TESTING.md');
testing = appendOnce(testing, '## Teamsheet 2.0.1 physical-review regression coverage', `## Teamsheet 2.0.1 physical-review regression coverage

The navigation suite now verifies the persistent global Ask composer and internal arrow, absence of global Data/Evidence pills, controlled SVG dock icons, one fixed five-column safe-area contract, keyboard visual-viewport recovery, invisible focus presentation for programmatically focused headings, and arrow-only Settings subsection navigation. Automated checks still cannot prove physical iPhone placement or populated FPL behaviour.`);
write('docs/TESTING.md', testing);

console.log('Applied Teamsheet 2.0.1 iPhone review interface patch.');
