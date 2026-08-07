import { renderRouteDataWarning } from './data-warning.mjs';
// Views import broadly; the bundler flattens everything into one scope.
const elNode = el;
const svgNode = svgEl;
const flagNodes = p => {
  const nodes = [];
  if(['i','u','s','n'].includes(p.status)) nodes.push(elNode('span',{class:'flag out'},p.status==='s'?'SUSP':'OUT'));
  else if(p.status === 'd') nodes.push(elNode('span',{class:'flag doubt'},`${p.chance_of_playing_next_round ?? '?'}%`));
  if(p.cost_change_event > 0) nodes.push(elNode('span',{class:'flag rise'},'▲'));
  if(p.cost_change_event < 0) nodes.push(elNode('span',{class:'flag fall'},'▼'));
  const mo = priceMomentum(p);
  if(mo) nodes.push(elNode('span',{class:`flag ${mo === 'rising' ? 'rise' : 'fall'}`},mo));
  return nodes;
};
const cell = (text, cls = '') => elNode('td', cls ? {class:cls} : {}, text);
const head = (text, cls = '', scope='col') => elNode('th', cls ? {class:cls,scope} : {scope}, text);
const noteNode = (kind, ...children) => elNode('div',{class:`note${kind ? ' '+kind : ''}`},children);
/* ---------------------------------------------------------------------
   VIEW — FIXTURE TICKER
   --------------------------------------------------------------------- */
function renderTicker(){
  const warning=renderRouteDataWarning('fixtureDataWarning',{showUnavailable:true});
  if(!S.fixtures){
    setChildren($('fixtureModeNote'));
    if(warning.kind==='unavailable') setChildren($('ticker'),elNode('div',{class:'empty'},elNode('strong',{},'Fixtures are unavailable'),'Refresh Official FPL data before using the fixture view.'));
    return;
  }
  const from = clamp(parseInt($('fxFrom').value) || S.nextGW, 1, 38);
  const requestedSpan = clamp(parseInt($('fxSpan').value) || 6, 1, 38);
  const span = Math.min(requestedSpan, 39 - from);
  $('fxFrom').value = String(from);
  $('fxSpan').max = String(39 - from);
  $('fxSpan').value = String(span);
  const lensControl = $('fxLens'), sort = $('fxSort').value;
  const lensState = fixtureLensState(lensControl.value);
  for(const option of Array.from(lensControl.options || [])){
    if(!option) continue;
    const separated = option.value === 'attack' || option.value === 'defence';
    option.hidden = lensState.fallback && separated;
    option.disabled = lensState.fallback && separated;
    if(option.value === 'official') option.textContent = lensState.fallback ? 'Overall FPL difficulty' : 'Official FDR';
  }
  if(lensState.fallback) lensControl.value = 'official';
  const lens = lensState.lens;

  let teams = Object.values(S.teams).map(t => ({t, s:runScore(t.id, from, span, lens)}));
  if(sort === 'ease' || sort === 'hard') teams.sort((a,b) => compareFixtureRunScores(a.s,b.s,sort,lens));
  else teams.sort((a,b) => a.t.name.localeCompare(b.t.name));

  const header = elNode('tr',{},head('Team','tm team'));
  for(let gw = from; gw < from+span; gw++) header.appendChild(head(`GW${gw}`));
  const body = elNode('tbody');
  teams.forEach(({t,s}) => {
    const scoreLabel=Number.isFinite(s)?s.toFixed(2):'—';
    const row = elNode('tr',{},elNode('th',{class:'team',scope:'row'},t.short_name,elNode('span',{class:'ease'},scoreLabel)));
    teamFixtures(t.id, from, span).forEach(games => {
      if(!games.length){ row.appendChild(elNode('td',{},elNode('div',{class:'cell blank'},'—',elNode('small',{},'BLANK')))); return; }
      const diffs = games.map(g => fixtureDifficulty(g,lens));
      const contents = [];
      games.forEach((g,i) => {
        if(i) contents.push(elNode('hr',{class:'fixture-divider'}));
        contents.push(g.opp.short_name,elNode('small',{},`${g.home?'H':'A'} · ${diffs[i]}`));
      });
      row.appendChild(elNode('td',{},elNode('div',{class:`cell d${diffs[0]}${games.length > 1 ? ' dbl' : ''}`},contents)));
    });
    body.appendChild(row);
  });
  if(lensState.fallback) setChildren($('fixtureModeNote'),noteNode('plain',
    elNode('b',{},'Overall FPL difficulty.'),
    ' Lower is easier. Official FPL currently supplies one overall 1–5 rating, so separate attacker and defender lenses are hidden until genuine team-strength inputs are available.'));
  else setChildren($('fixtureModeNote'));
  setChildren($('ticker'),elNode('table',{class:'ticker'},elNode('caption',{class:'sr-only'},`Fixture difficulty from GW${from} across ${span} Gameweeks`),elNode('thead',{},header),body));

  const canCompareSwings = from + 5 <= 38;
  const swings = canCompareSwings ? Object.values(S.teams).map(t => {
    const now = runScore(t.id, from, 3, lens), later = runScore(t.id, from+3, 3, lens);
    return {t, delta: later - now};
  }) : [];
  const favourable = lensState.lowerIsEasier
    ? swings.filter(s => s.delta < -.18).sort((a,b)=>a.delta-b.delta).slice(0,4)
    : swings.filter(s => s.delta > .18).sort((a,b)=>b.delta-a.delta).slice(0,4);
  const harder = lensState.lowerIsEasier
    ? swings.filter(s => s.delta > .18).sort((a,b)=>b.delta-a.delta).slice(0,4)
    : swings.filter(s => s.delta < -.18).sort((a,b)=>a.delta-b.delta).slice(0,4);
  const swingNodes = [];
  if(lensState.fallback)
    swingNodes.push(noteNode('plain',elNode('b',{},'Projection fallback.'),' Player projections use neutral fixture multipliers until separate, validated attack and defence strengths are available.'));
  if(favourable.length) swingNodes.push(noteNode('good',elNode('b',{},`Turns favourable from GW${from+3}:`),` ${favourable.map(s=>s.t.name).join(', ')}. Buying a gameweek early usually beats buying late.`));
  if(harder.length) swingNodes.push(noteNode('bad',elNode('b',{},`Turns hard from GW${from+3}:`),` ${harder.map(s=>s.t.name).join(', ')}. Plan exits before the crowd moves.`));

  const perGW = {};
  S.fixtures.filter(f => f.event >= from && f.event < from+span).forEach(f => {
    perGW[f.event] = perGW[f.event] || {};
    [f.team_h, f.team_a].forEach(id => perGW[f.event][id] = (perGW[f.event][id]||0)+1);
  });
  const flags = [];
  Object.keys(perGW).sort((a,b)=>a-b).forEach(gw => {
    const teamsIn = Object.keys(perGW[gw]).length;
    const dbls = Object.entries(perGW[gw]).filter(([,c]) => c>1).map(([id]) => S.teams[id]?.short_name).filter(Boolean);
    if(teamsIn < 20) flags.push(`GW${gw}: ${20-teamsIn} teams blank`);
    if(dbls.length) flags.push(`GW${gw} double: ${dbls.join(', ')}`);
  });
  if(flags.length) swingNodes.push(noteNode('',elNode('b',{},'Chip windows:'),` ${flags.join(' · ')}`));
  setChildren($('swings'),swingNodes);
}

/* ---------------------------------------------------------------------
   VIEW — RANKER
   --------------------------------------------------------------------- */
function renderPlayers(){
  if(!S.boot) return;
  const from = clamp(parseInt($('fxFrom').value) || S.nextGW, 1, 38);
  const span = +$('plHorizon').value;
  const pos = +$('plPos').value, maxP = num($('plMax').value)*10;
  const hideFlag = $('plFit').checked, onlyMine = $('plOwn').checked;
  const mineIds = new Set(mySquad().map(s => s.p.id));

  setChildren($('rankerHint'),S.seasonLive
    ? 'Expected points per gameweek, modelled separately for each position — clean sheets and saves for keepers and defenders, expected goal involvement for attackers, plus bonus and defensive actions. Tap a player for full detail.'
    : [elNode('b',{},'Pre-season.'),' No match data exists yet, so projections start from the price FPL set (a decent prior for expected output) adjusted by fixture and ownership. Real form, xGI and bonus switch on after GW1. Tap a player for full detail.']);

  let pool = S.boot.elements.filter(p =>
    (!pos || p.element_type === pos) &&
    p.now_cost <= maxP &&
    (!onlyMine || mineIds.has(p.id)) &&
    (!hideFlag || (p.status === 'a' && (p.chance_of_playing_next_round ?? 100) >= 75)));

  const ranked = pool.map(p => ({p, x:xpOf(p, from, span)}))
    .sort((a,b) => b.x.total - a.x.total).slice(0, 45);
  const maxPer = ranked.length ? ranked[0].x.perGW : 1;

  const playerBody = elNode('tbody');
  ranked.forEach(({p,x}) => {
    const t = S.teams[p.team];
    const openButton=elNode('button',{type:'button',class:'player-row-action','aria-label':`Open ${p.web_name} player details`,onclick:event=>openPlayerDetailView(p,from,span,event.currentTarget)},
      elNode('span',{class:'pname'},p.web_name,flagNodes(p)),
      elNode('span',{class:'pmeta'},elNode('span',{class:'pos'},S.posName[p.element_type]||'?'),` ${t?t.short_name:'—'}${x.games!==span?` · ${x.games} games`:''}`));
    playerBody.appendChild(elNode('tr',{dataset:{pid:p.id}},
      elNode('td',{class:'player-result-main'},openButton),
      elNode('td',{class:'num',dataset:{label:'Price'}},(p.now_cost/10).toFixed(1)),
      elNode('td',{class:'num player-result-secondary',dataset:{label:'Ownership'}},p.selected_by_percent),
      elNode('td',{class:'num player-result-secondary',dataset:{label:'Form'}},fmt1(num(p.form))),
      elNode('td',{class:'num',dataset:{label:'xP / GW'}},elNode('span',{class:`xp ${x.perGW >= maxPer*0.82 ? 'hot':''}`},fmt1(x.perGW))),
      elNode('td',{class:'num',dataset:{label:`${span} GW xP`}},fmt1(x.total)),
      elNode('td',{class:'num',dataset:{label:'xP / £m'}},fmt1(x.total/(p.now_cost/10)))));
  });
  setChildren($('playerTable'),elNode('table',{class:'data'},elNode('caption',{class:'sr-only'},`Player projections over ${span} Gameweeks`),elNode('thead',{},elNode('tr',{},head('Player'),head('£','num'),head('Own%','num'),head('Form','num'),head('xP/GW','num'),head(`xP ${span}GW`,'num'),head('per £m','num'))),playerBody));
}

function breakdownNode(p, x, span){
  const entries = Object.entries(x.parts).filter(([,v]) => Math.abs(v) > 0.01)
    .sort((a,b) => Math.abs(b[1]) - Math.abs(a[1]));
  const max = Math.max(...entries.map(([,v]) => Math.abs(v)), 0.01);
  const nodes = [elNode('b',{},p.web_name),` — ${fmt1(x.total)} projected points over ${span} gameweek${span>1?'s':''} (${x.games} fixture${x.games===1?'':'s'})`];
  if(p.news) nodes.push(elNode('div',{class:'breakdown-news'},p.news,' ',elNode('span',{class:'flag dark'},newsAge(p))));
  const bars = elNode('div',{class:'bars'});
  entries.forEach(([k,v]) => {
    bars.appendChild(elNode('div',{class:'bar'},elNode('span',{},k),elNode('progress',{class:`projection-progress${v<0?' neg':''}`,max:'100',value:(Math.abs(v)/max*100).toFixed(2),'aria-label':`${k} ${v>0?'+':''}${fmt1(v)}`}),elNode('span',{class:'v'},`${v>0?'+':''}${fmt1(v)}`)));
  });
  nodes.push(bars);
  const runs = teamFixtures(p.team, clamp(parseInt($('fxFrom').value)||S.nextGW,1,38), span);
  const fx = runs.map((g,i) => g.length ? g.map(o => `${o.opp.short_name}(${o.home?'H':'A'})`).join('+') : 'blank').join(' · ');
  nodes.push(elNode('div',{class:'breakdown-meta breakdown-meta-primary'},elNode('b',{},'Fixtures:'),` ${fx}`));
  const mo = priceMomentum(p);
  if(mo) nodes.push(elNode('div',{class:'breakdown-meta'},elNode('b',{},'Price:'),` heavy net transfers ${mo==='rising'?'in — a rise looks likely':'out — a fall looks likely'}.`));
  return nodes;
}

function playerDetailSection(title,...children){
  return elNode('section',{class:'player-detail-section'},elNode('h3',{},title),children);
}
function playerDetailMetric(label,value,meta=''){
  return elNode('div',{class:'player-detail-metric'},
    elNode('span',{class:'label'},label),
    elNode('strong',{},value),
    meta ? elNode('span',{class:'meta'},meta) : null);
}
function playerDetailPercent(value){ return `${Math.round(clamp(num(value),0,1)*100)}%`; }

function openPlayerDetailView(p,from,span,trigger){
  const team=S.teams[p.team], x=xpOf(p,from,span), next=xpOf(p,S.nextGW,1);
  const mins=minutesEstimate(p), simulation=simulatePlayerGameweek(p,S.nextGW);
  const palette=teamPitchPalette(team), paletteClass=teamPitchPaletteClass(team), detail=[];
  const fixtures=teamFixtures(p.team,S.nextGW,1)[0]||[];
  const fixtureLabel=fixtures.length?fixtures.map(g=>`${g.opp.short_name} ${g.home?'H':'A'}`).join(' + '):'Blank';
  const identity=elNode('div',{class:'player-detail-identity'},
    elNode('span',{class:`club-shirt detail-shirt pattern-${palette.pattern} ${paletteClass}`,'aria-hidden':'true'},
      elNode('span',{class:'club-shirt-code'},palette.code)),
    elNode('div',{class:'player-detail-identity-copy'},
      elNode('div',{class:'player-detail-name'},p.web_name,flagNodes(p)),
      elNode('div',{class:'player-detail-meta'},
        [S.posName[p.element_type]||'Player',team?.name,`£${(p.now_cost/10).toFixed(1)}m`,fixtureLabel].filter(Boolean).join(' · ')),
      p.news?elNode('div',{class:'player-detail-news'},p.news,' ',elNode('span',{class:'flag dark'},newsAge(p))):null));
  detail.push(identity);

  detail.push(playerDetailSection('Decision summary',
    elNode('div',{class:'player-detail-grid'},
      playerDetailMetric(`GW${S.nextGW} xP`,fmt1(next.total),fixtureLabel),
      playerDetailMetric(`${span} GW xP`,fmt1(x.total),`${x.games} fixture${x.games===1?'':'s'}`),
      playerDetailMetric('Form',fmt1(num(p.form)),`${p.selected_by_percent}% owned`),
      playerDetailMetric('Availability',playerDetailAvailabilityLabel(p),p.status==='a'?'Official status clear':p.news||'Check latest team news'))));

  detail.push(playerDetailSection('Expected minutes',
    elNode('div',{class:'player-detail-grid minutes-grid'},
      playerDetailMetric('Expected',`${fmt1(mins.expMin)} min`,`${mins.confidenceLabel} confidence · ${mins.source}`),
      playerDetailMetric('Starts',playerDetailPercent(mins.pStart)),
      playerDetailMetric('Appears',playerDetailPercent(mins.pAppear)),
      playerDetailMetric('Reaches 60',playerDetailPercent(mins.p60))),
    elNode('p',{class:'player-detail-help'},'Expected minutes are model estimates, not confirmed team news.')));

  const uncertaintyNodes=[];
  if(!simulation.available){
    uncertaintyNodes.push(noteNode('plain',elNode('b',{},'Unavailable in pre-season.'),' Detailed ranges switch on once live Gameweek event data exists; Teamsheet will not invent precise distributions from the price baseline.'));
  } else {
    const spread=playerDetailSpread(simulation);
    const low=num(simulation.p10), high=num(simulation.p90);
    const left=playerDetailRangePosition(simulation.p25,low,high);
    const right=playerDetailRangePosition(simulation.p75,low,high);
    const middle=playerDetailRangePosition(simulation.median,low,high);
    uncertaintyNodes.push(elNode('div',{class:'player-detail-range'},
      elNode('div',{class:'player-detail-range-head'},
        elNode('div',{},elNode('span',{class:'eyebrow'},'Likely middle range'),elNode('strong',{},`${fmt1(simulation.p25)}–${fmt1(simulation.p75)} pts`)),
        spread.label?elNode('span',{class:`range-label ${spread.label.toLowerCase()}`},`${spread.label} range`):null),
      elNode('div',{class:'player-detail-range-track',role:'img','aria-label':`P10 ${fmt1(low)}, P25 ${fmt1(simulation.p25)}, median ${fmt1(simulation.median)}, P75 ${fmt1(simulation.p75)}, P90 ${fmt1(high)}`},
        svgNode('svg',{class:'player-detail-range-svg',viewBox:'0 0 100 12','aria-hidden':'true',focusable:'false'},
          svgNode('line',{class:'player-detail-range-rail',x1:'0',y1:'6',x2:'100',y2:'6'}),
          svgNode('line',{class:'player-detail-range-core',x1:left.toFixed(2),y1:'6',x2:right.toFixed(2),y2:'6'}),
          svgNode('line',{class:'player-detail-range-median',x1:middle.toFixed(2),y1:'1',x2:middle.toFixed(2),y2:'11'}))),
      elNode('div',{class:'player-detail-range-scale'},elNode('span',{},`P10 ${fmt1(low)}`),elNode('span',{},`P90 ${fmt1(high)}`))));
    if(spread.quality==='reduced')
      uncertaintyNodes.push(noteNode('bad',elNode('b',{},'Reduced input quality.'),' The numeric range is shown, but the Tight/Moderate/Wide label is suppressed because the minutes inputs required bounding.'));
    uncertaintyNodes.push(elNode('details',{class:'player-detail-expand'},
      elNode('summary',{},'Full range and outcome probabilities'),
      elNode('div',{class:'player-detail-grid detail-percentiles'},
        playerDetailMetric('P10',fmt1(simulation.p10),'lower-tail outcome'),
        playerDetailMetric('Median',fmt1(simulation.median),'middle outcome'),
        playerDetailMetric('P90',fmt1(simulation.p90),'upside outcome')),
      elNode('div',{class:'player-detail-grid probability-grid'},
        playerDetailMetric('Blank',playerDetailPercent(simulation.blankProbability),'2 points or fewer'),
        playerDetailMetric('Return',playerDetailPercent(simulation.returnProbability),'5+ points'),
        playerDetailMetric('Haul',playerDetailPercent(simulation.haulProbability),'10+ points'),
        playerDetailMetric('Mega-haul',playerDetailPercent(simulation.megaHaulProbability),'15+ points')),
      elNode('p',{class:'player-detail-help'},'These are model-conditional simulations, not externally calibrated probabilities.')));
  }
  detail.push(playerDetailSection('Uncertainty',uncertaintyNodes));

  detail.push(playerDetailSection('How the projection is built',
    elNode('div',{class:'player-detail-breakdown'},breakdownNode(p,x,span))));

  playerDetailOpen({title:`${p.web_name} details`,body:detail,trigger});
}

/* ---------------------------------------------------------------------
   VIEW — SQUAD
   --------------------------------------------------------------------- */
function renderSquad(){
  const out = $('squadOut'), realSquad = mySquad();
  if(!realSquad.length){
    decisionPreviewClearAll();
    setChildren(out,elNode('div',{class:'empty'},elNode('strong',{},'No squad yet'),
      S.entry ? ['Team found: ',elNode('b',{},S.entry.name),'. FPL only publishes picks once a gameweek is under way — until then, build your 15 by hand below and everything still works.']
        : 'Add your team ID above, or build your 15 by hand below.'));
    return;
  }
  decisionPreviewSyncSquad(realSquad);
  let previewState=decisionPreviewSnapshot();
  let applied=previewState.transfer?decisionPreviewApplyTransferPlan(realSquad,previewState.transfer,S.byId):{ok:true,squad:realSquad,incomingIds:[],outgoingIds:[]};
  if(previewState.transfer&&!applied.ok){
    decisionPreviewClearTransfer();
    previewState=decisionPreviewSnapshot();
    applied={ok:true,squad:realSquad,incomingIds:[],outgoingIds:[]};
  }
  const squad=applied.squad, incomingIds=new Set(applied.incomingIds), gw=S.nextGW, xi=bestXI(squad,gw), nodes=[];
  const currentXi=previewState.transfer?bestXI(realSquad,gw):xi;
  nodes.push(elNode('div',{class:'team-summary'},
    elNode('div',{class:'team-score'},elNode('span',{class:'label'},`${previewState.transfer?'Preview':'Projected'} GW${gw}`),elNode('span',{class:'value'},fmt1(xi.tot)),elNode('span',{class:'unit'},'expected points')),
    elNode('div',{class:'team-facts'},
      elNode('div',{class:'team-fact'},elNode('span',{class:'label'},'Shape'),elNode('span',{class:'value'},xi.shape)),
      elNode('div',{class:'team-fact'},elNode('span',{class:'label'},'Value'),elNode('span',{class:'value'},`£${fmt1(squad.reduce((a,s)=>a+s.p.now_cost,0)/10)}m`)),
      elNode('div',{class:'team-fact'},elNode('span',{class:'label'},'Free transfers'),elNode('span',{class:'value'},num($('ftCount').value))))));
  if(previewState.transfer){
    const moves=previewState.transfer.transfers.map(t=>`${S.byId[t.outPlayerId]?.web_name||t.outPlayerId} → ${S.byId[t.inPlayerId]?.web_name||t.inPlayerId}`).join(' · ');
    nodes.push(elNode('section',{class:'decision-preview-banner transfer-preview','aria-label':'Temporary transfer preview'},
      elNode('div',{},elNode('span',{class:'eyebrow'},'Preview only'),elNode('strong',{},moves),
        elNode('p',{},`Current squad ${fmt1(currentXi.tot)} xP → preview ${fmt1(xi.tot)} xP for GW${gw}. Optimiser net ${previewState.transfer.netGain>=0?'+':''}${fmt1(previewState.transfer.netGain)} over ${previewState.transfer.previewHorizon||1} GW${(previewState.transfer.previewHorizon||1)>1?'s':''} · hit −${previewState.transfer.hitCost} · £${fmt1(previewState.transfer.bankAfter/10)}m left · ${previewState.transfer.freeTransfersNextGW} FT next GW.`)),
      elNode('button',{type:'button',class:'btn ghost sm',onclick:()=>{decisionPreviewClearTransfer();renderSquad();renderTransfers();}},'Clear preview')));
  }
  if(S.entry) nodes.push(elNode('p',{class:'status team-entry'},`${S.entry.name} · ${S.entry.player_first_name||''} ${S.entry.player_last_name||''} · OR ${(S.entry.summary_overall_rank||0).toLocaleString('en-GB')}`));

  const problems=[];
  squad.forEach(({p})=>{
    let tail=null;
    if(['i','u','s','n'].includes(p.status)) tail=[' unavailable'];
    else if(p.status==='d') tail=[` doubtful ${p.chance_of_playing_next_round ?? '?'}%`];
    else if(priceMomentum(p)==='falling') tail=[' is being sold heavily — a price fall looks likely'];
    if(tail){ if(p.news) tail.push(` — ${p.news} `,elNode('span',{class:'flag dark'},newsAge(p))); problems.push([elNode('b',{},p.web_name),tail]); }
  });
  const blanks=squad.filter(({p})=>(teamFixtures(p.team,gw,1)[0]||[]).length===0);
  if(blanks.length) problems.push([elNode('b',{},blanks.map(b=>b.p.web_name).join(', ')),` ${blanks.length>1?'have':'has'} no fixture in GW${gw}`]);
  if(problems.length){ const n=noteNode('bad',elNode('b',{},'Needs attention')); problems.forEach(p=>n.append(elNode('br'),...p)); nodes.push(n); }
  else nodes.push(noteNode('good','No injuries, suspensions or blanks were found in your 15. Use Transfers for the separate roll or transfer decision.'));

  const capRank=xi.xi.map(s=>({s,x:xpOf(s.p,gw,1).total,own:num(s.p.selected_by_percent)})).sort((a,b)=>b.x-a.x);
  const captaincy=teamPitchCaptaincy(capRank);
  const xiIds=xi.xi.map(s=>Number(s.p.id));
  previewState=decisionPreviewSnapshot();
  const effectiveCaptaincy=decisionPreviewEffectiveCaptaincy(captaincy,xiIds);
  const scoreById=Object.fromEntries(xi.xi.map(s=>[s.p.id,xpOf(s.p,gw,1).total]));
  const captainTotal=decisionPreviewCaptainTotal(xi.tot,effectiveCaptaincy.captainId,scoreById);
  const modelCaptain=S.byId[captaincy.captainId]?.web_name||'—', modelVice=S.byId[captaincy.viceId]?.web_name||'—';
  const previewCaptain=S.byId[effectiveCaptaincy.captainId]?.web_name||'—', previewVice=S.byId[effectiveCaptaincy.viceId]?.web_name||'—';
  nodes.push(elNode('section',{class:'decision-preview-controls','aria-label':'Captain and vice-captain preview controls'},
    elNode('div',{class:'decision-preview-copy'},elNode('span',{class:'eyebrow'},'Captaincy'),
      elNode('strong',{},`Model: ${modelCaptain} C · ${modelVice} VC`),
      effectiveCaptaincy.isPreview?elNode('p',{},`Preview: ${previewCaptain} C · ${previewVice} VC · captain uplift ${fmt1(captainTotal.uplift)} · total ${fmt1(captainTotal.total)}.`):elNode('p',{},`Captain uplift ${fmt1(captainTotal.uplift)} · total with captain ${fmt1(captainTotal.total)}.`)),
    elNode('div',{class:'decision-preview-actions'},
      elNode('button',{type:'button',class:`btn ghost sm${previewState.selectionMode==='captain'?' active':''}`,'aria-pressed':previewState.selectionMode==='captain',onclick:()=>{decisionPreviewBeginRole('captain',captaincy);renderSquad();}},'Choose captain'),
      elNode('button',{type:'button',class:`btn ghost sm${previewState.selectionMode==='vice'?' active':''}`,'aria-pressed':previewState.selectionMode==='vice',onclick:()=>{decisionPreviewBeginRole('vice',captaincy);renderSquad();}},'Choose vice-captain'),
      effectiveCaptaincy.isPreview?elNode('button',{type:'button',class:'btn ghost sm',onclick:()=>{decisionPreviewClearCaptaincy();renderSquad();}},'Reset captaincy'):null),
    previewState.selectionMode?elNode('p',{class:'selection-help',role:'status'},`Tap a starting player to choose ${previewState.selectionMode==='captain'?'captain':'vice-captain'}.`):null));
  const fixtureLabel=p=>{
    const games=teamFixtures(p.team,gw,1)[0]||[];
    return games.length ? games.map(g=>`${g.opp.short_name} ${g.home?'H':'A'}`).join(' + ') : 'Blank';
  };
  const playerNode=(slot,benchIndex=null)=>{
    const p=slot.p, team=S.teams[p.team], palette=teamPitchPalette(team), paletteClass=teamPitchPaletteClass(team);
    const role=p.id===effectiveCaptaincy.captainId?'captain':p.id===effectiveCaptaincy.viceId?'vice':null;
    const bad=availability(p)<1, incoming=incomingIds.has(Number(p.id));
    const selectable=benchIndex==null&&!!previewState.selectionMode;
    const fixture=fixtureLabel(p), projected=fmt1(xpOf(p,gw,1).total);
    const label=benchIndex==null?p.web_name:`${benchIndex}. ${p.web_name}`;
    return elNode('button',{type:'button',class:`pitch-player${benchIndex==null?'':' bench-player'}${bad?' warn':''}${incoming?' incoming':''}${selectable?' selection-target':''}`,
      onclick:event=>{
        if(selectable){ decisionPreviewChooseRole(previewState.selectionMode,p.id,xiIds); renderSquad(); }
        else openPlayerDetailView(p,gw,1,event.currentTarget);
      },
      'aria-label':selectable?`Select ${label} as ${previewState.selectionMode==='captain'?'captain':'vice-captain'}`:`${label}, ${fixture}, ${projected} expected points${role==='captain'?', captain':role==='vice'?', vice-captain':''}${incoming?', incoming transfer preview':''}`},
      elNode('div',{class:'shirt-wrap'},
        elNode('span',{class:`club-shirt pattern-${palette.pattern} ${paletteClass}`,'aria-hidden':'true'},elNode('span',{class:'club-shirt-code'},palette.code)),
        role?elNode('span',{class:`captain-badge${role==='vice'?' vice':''}${effectiveCaptaincy.isPreview?' preview':''}`},role==='captain'?'C':'VC'):null,
        incoming?elNode('span',{class:'incoming-badge'},'IN'):null),
      elNode('div',{class:'pitch-copy'},elNode('div',{class:'pitch-name'},label),elNode('div',{class:'pitch-meta'},fixture),elNode('div',{class:'pitch-xp'},`${projected} xP`)));
  };
  const formation=elNode('div',{class:'pitch-formation'},teamPitchLines(xi.xi).map(line=>
    elNode('div',{class:`pitch-line position-${line.position}`},line.players.map(slot=>playerNode(slot)))));
  const pitch=elNode('section',{class:'team-pitch','aria-label':`Model-selected starting eleven for Gameweek ${gw}`},
    elNode('span',{class:'pitch-mark pitch-centre-circle','aria-hidden':'true'}),
    elNode('span',{class:'pitch-mark pitch-box pitch-box-top','aria-hidden':'true'}),
    elNode('span',{class:'pitch-mark pitch-box pitch-box-bottom','aria-hidden':'true'}),formation);
  const bench=elNode('section',{class:'team-bench','aria-label':'Bench order'},
    elNode('div',{class:'bench-head'},elNode('strong',{},'Bench'),elNode('span',{},'Auto-sub order')),
    elNode('div',{class:'bench-grid'},xi.bench.map((slot,index)=>playerNode(slot,index+1))));
  nodes.push(elNode('div',{class:'team-stage'},pitch,bench));

  if(capRank.length){
    const c1=capRank[0], c2=capRank[1], grid=elNode('div',{class:'capgrid'});
    nodes.push(elNode('h3',{class:'section-title'},'Captaincy ranking'),grid);
    capRank.slice(0,4).forEach((c,i)=>{
      const games=teamFixtures(c.s.p.team,gw,1)[0]||[];
      const why=games.length?games.map(g=>`${g.home?'vs':'away to'} ${g.opp.short_name}`).join(' + ')+` · ${fmt1(c.x)} xP · ${c.own}% owned`:'no fixture';
      grid.appendChild(elNode('div',{class:`capcard ${i===0?'top':''}`},elNode('div',{class:'rank'},i+1),
        elNode('div',{class:'capbody'},elNode('span',{class:'pname'},c.s.p.web_name,flagNodes(c.s.p)),elNode('div',{class:'why'},why)),
        elNode('span',{class:`xp ${i===0?'hot':''}`},fmt1(c.x*2))));
    });
    if(c2&&(c1.x-c2.x)<.6){ nodes.push(noteNode('',teamDecisionCloseCaptainCopy(c1.s.p.web_name,c2.s.p.web_name,c1.x-c2.x))); }
  }
  nodes.push(elNode('h3',{class:'section-title'},'All 15 over 6 gameweeks'));
  const tbody=elNode('tbody');
  squad.slice().sort((a,b)=>a.p.element_type-b.p.element_type||xpOf(b.p,gw,6).total-xpOf(a.p,gw,6).total).forEach(s=>{
    const openButton=elNode('button',{type:'button',class:'player-row-action','aria-label':`Open ${s.p.web_name} player details`,onclick:event=>openPlayerDetailView(s.p,gw,6,event.currentTarget)},
      elNode('span',{class:'pname'},s.p.web_name,flagNodes(s.p)),
      elNode('span',{class:'pmeta'},elNode('span',{class:'pos'},S.posName[s.p.element_type]||'?'),` ${S.teams[s.p.team]?.short_name||''}`));
    tbody.appendChild(elNode('tr',{},
      elNode('td',{},openButton),
      cell((s.p.now_cost/10).toFixed(1),'num'),cell((sellPrice(s)/10).toFixed(1),'num'),cell(fmt1(num(s.p.form)),'num'),cell(fmt1(xpOf(s.p,gw,1).total),'num'),elNode('td',{class:'num'},elNode('span',{class:'xp'},fmt1(xpOf(s.p,gw,6).total)))));
  });
  nodes.push(elNode('div',{class:'scroll'},elNode('table',{class:'data'},elNode('caption',{class:'sr-only'},`Current squad projections from GW${gw}`),elNode('thead',{},elNode('tr',{},head('Player'),head('£','num'),head('Sell','num'),head('Form','num'),head(`xP GW${gw}`,'num'),head('xP 6GW','num'))),tbody)));
  if(!$('useManual').checked&&S.picks) nodes.push(noteNode('plain',"Sell prices assume you bought at today's price — the public API doesn't expose purchase prices. Build the squad by hand if you want them exact."));
  setChildren(out,nodes);
}

/* ---------------------------------------------------------------------
   VIEW — ASK
   --------------------------------------------------------------------- */
function md(t){
  return t
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/^### (.*)$/gm,'<h4>$1</h4>')
    .replace(/^## (.*)$/gm,'<h4>$1</h4>')
    .replace(/\*\*(.+?)\*\*/g,'<b>$1</b>')
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g,'<i>$1</i>')
    .replace(/^[-•] (.*)$/gm,'<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g,'<ul>$1</ul>')
    .replace(/\n{2,}/g,'</p><p>')
    .replace(/\n/g,'<br>');
}

function buildContext(){
  if(!S.boot) return 'No FPL data is loaded in the app.';
  const gw = S.nextGW, squad = mySquad();
  const line = s => {
    const p = s.p, x = xpOf(p, gw, 6);
    return `${p.web_name} (${S.posName[p.element_type]}, ${S.teams[p.team]?.short_name}, £${(p.now_cost/10).toFixed(1)}m, form ${p.form}, ${p.selected_by_percent}% owned, status ${p.status}, projected ${fmt1(xpOf(p,gw,1).total)} next GW / ${fmt1(x.total)} over 6${p.news? `, news: ${p.news}`:''})`;
  };
  let c = `SEASON: next gameweek ${gw}. Season under way: ${S.seasonLive ? 'yes' : 'NO — pre-season, no match data exists, so all projections are price-implied priors and should be treated as rough'}.\n`;
  c += `DATA LAYERS ACTIVE: FPL API${S.ustat ? ' + Understat rolling xG' : ''}${S.odds ? ' + bookmaker odds (market-implied goals, weighted 65%)' : ''}.\n`;
  if(S.backtest) c += `MODEL VALIDATION: backtested on ${S.backtest.season} (${S.backtest.n} players): correlation ${S.backtest.r}, mean error ±${S.backtest.maeGW} pts/GW, per-position bias before correction ${JSON.stringify(S.backtest.bias)} (percent, negative = model over-predicted). Corrections are now applied to all projections.\n`;
  c += `FREE TRANSFERS: ${num($('ftCount').value)}. BANK: £${num($('bankIn').value).toFixed(1)}m. CHIPS USED: ${S.chipsUsed.length ? S.chipsUsed.join(', ') : 'none recorded'}.\n\n`;
  if(squad.length){
    const xi = bestXI(squad, gw);
    const xiIds = new Set(xi.xi.map(s=>s.p.id));
    c += `MY SQUAD (projected ${fmt1(xi.tot)} points in GW${gw}, best shape ${xi.shape}):\n`;
    squad.forEach(s => c += `- ${xiIds.has(s.p.id)?'XI':'BENCH'} ${line(s)}\n`);
  } else c += `MY SQUAD: not entered yet.\n`;

  const ease = Object.values(S.teams).map(t => ({n:t.short_name, a:runScore(t.id,gw,6,'attack'), d:runScore(t.id,gw,6,'defence')}));
  c += `\nFIXTURES next 6 GWs (higher = easier).\nBest for attackers: ${ease.slice().sort((a,b)=>b.a-a.a).slice(0,6).map(x=>`${x.n} ${x.a.toFixed(2)}`).join(', ')}`;
  c += `\nBest for defences: ${ease.slice().sort((a,b)=>b.d-a.d).slice(0,6).map(x=>`${x.n} ${x.d.toFixed(2)}`).join(', ')}`;
  c += `\nWorst overall: ${ease.slice().sort((a,b)=>a.a-b.a).slice(0,5).map(x=>x.n).join(', ')}\n`;

  const top = S.boot.elements.filter(p => availability(p) >= 0.75)
    .map(p => ({p, x:xpOf(p,gw,6).total})).sort((a,b)=>b.x-a.x).slice(0,18);
  c += `\nHIGHEST PROJECTED (6 GW, app model): ${top.map(t=>`${t.p.web_name} ${fmt1(t.x)}`).join(', ')}\n`;
  return c;
}

let lastAskQuestion='';
function renderThread(){
  const thread=$('thread');
  thread.innerHTML = S.thread.map(m =>
    `<div class="answer ${m.role==='user'?'me':''}"><p>${md(m.content)}</p></div>`).join('');
  if(globalThis.location?.hash==='#/ask') globalThis.requestAnimationFrame?.(()=>thread.lastElementChild?.scrollIntoView?.({block:'nearest'}));
}
function configureAskAvailability(){
  const available=Boolean(globalThis.window?.storage);
  const hosted=$('askHostedStatus'),question=$('q'),askButton=$('askBtn'),retry=$('retryAsk');
  if(hosted) hosted.hidden=available;
  if(question){question.disabled=!available;question.setAttribute('aria-describedby','askHostedStatus');}
  if(askButton) askButton.disabled=!available;
  if(retry&&!available) retry.hidden=true;
  document.querySelectorAll('[data-q]').forEach(button=>{button.disabled=!available;});
  return available;
}

async function ask(){
  const askAvailable=configureAskAvailability();
  const q = $('q').value.trim();
  if(!q) return;
  if(!askAvailable){
    lastAskQuestion=q;
    S.thread.push({role:'user',content:q});
    $('q').value='';
    S.thread.push({role:'assistant',content:"The AI assistant requires the planned serverless migration in this hosted build. Ask Teamsheet is available only inside Claude's artifact preview; this app does not accept or store Anthropic API keys."});
    renderThread();
    $('askStatus').textContent='';
    if($('retryAsk')) $('retryAsk').hidden=true;
    return;
  }
  lastAskQuestion=q;
  if($('retryAsk')) $('retryAsk').hidden=true;
  S.thread.push({role:'user', content:q});
  $('q').value = '';
  renderThread();
  const btn = $('askBtn'); btn.disabled = true;
  setChildren($('askStatus'),elNode('span',{class:'spinner'}),'Thinking…');
  try{
    const system = `You are an experienced Fantasy Premier League analyst advising one manager. Today is ${new Date().toDateString()}.
Treat the app data as the source of truth for squad, prices, projections and fixtures. Search the web for anything time-sensitive: injuries, press conferences, expected line-ups, transfers, rotation risk.
Be decisive and blunt. Say plainly when the honest answer is to do nothing — a banked transfer usually beats a marginal one, and a -4 needs to clear 4 projected points to be worth it. Never invent statistics you were not given and did not find. Keep answers under 250 words.

APP DATA
${buildContext()}`;
    // D-08 / SEC-3: no Anthropic secret is accepted, stored or sent by this
    // frontend. Claude's artifact preview provides the only approved keyless
    // path. Static hosted builds stop before making any Anthropic request.
    if(!globalThis.window?.storage){
      S.thread.push({role:'assistant', content:"The AI assistant requires the planned serverless migration in this hosted build. For now, Ask Teamsheet is available only inside Claude's artifact preview; this app does not accept or store Anthropic API keys."});
      renderThread(); $('askStatus').textContent = ''; if($('retryAsk')) $('retryAsk').hidden=false; btn.disabled = false; return;
    }
    const msgs = S.thread.slice(-8).map(m => ({role:m.role, content:m.content}));
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        model:'claude-sonnet-4-6', max_tokens:1000, system,
        messages: msgs,
        tools:[{type:'web_search_20250305', name:'web_search'}]
      })
    });
    if(!res.ok){
      S.thread.push({role:'assistant', content:'The keyless Claude connection is unavailable in this preview. Your question has been kept so you can retry.'});
      renderThread(); $('askStatus').textContent = ''; if($('retryAsk')) $('retryAsk').hidden=false; btn.disabled = false; return;
    }
    const data = await res.json();
    const text = (data.content||[]).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    S.thread.push({role:'assistant', content: text || 'No answer came back — try again.'});
    renderThread();
    $('askStatus').textContent = '';
    if($('retryAsk')) $('retryAsk').hidden=true;
  }catch(e){
    S.thread.push({role:'assistant',content:'That request failed — your question has been kept. Check your connection and try again.'});
    renderThread();
    $('askStatus').textContent = 'Request failed. Your question is still in the conversation.';
    if($('retryAsk')) $('retryAsk').hidden=false;
  }
  btn.disabled = !Boolean(globalThis.window?.storage);
}

/* ---------------------------------------------------------------------
   MANUAL SQUAD BUILDER
   --------------------------------------------------------------------- */
function renderManual(){
  const list = $('manualList');
  setChildren(list, S.manual.map((m,i) => {
    const p = S.byId[m.id];
    if(!p) return null;
    return elNode('span', {class:'pill'}, p.web_name, ' ',
      elNode('span', {class:'mono muted'}, S.posName[p.element_type]||''),
      elNode('button', {type:'button',class:'pill-remove',dataset:{rm:i}, 'aria-label':`Remove ${p.web_name}`}, '×'));
  }));
  const counts = {1:0,2:0,3:0,4:0};
  S.manual.forEach(m => { const p = S.byId[m.id]; if(p && counts[p.element_type]!==undefined) counts[p.element_type]++; });
  $('manualCount').textContent = `${S.manual.length}/15 · ${counts[1]} GKP, ${counts[2]} DEF, ${counts[3]} MID, ${counts[4]} FWD`
    + (S.manual.length === 15 ? ' — complete' : '');
  list.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', async () => {
    S.manual.splice(+b.dataset.rm, 1);
    await sset(K_SQUAD, S.manual); renderManual(); renderAll();
  }));
}
function searchPlayers(term){
  const box = $('pResults');
  if(!S.boot || term.length < 2){ box.hidden = true; return; }
  const t = term.toLowerCase();
  const hits = S.boot.elements.filter(p => p.web_name.toLowerCase().includes(t)).slice(0,12);
  setChildren(box, hits.length ? hits.map(p => elNode('button', {type:'button',class:'manual-player-result',dataset:{add:p.id},'aria-label':`Add ${p.web_name} to manual squad`}, p.web_name,
    elNode('span', {class:'pmeta'}, `${S.posName[p.element_type]||''} · ${S.teams[p.team]?.short_name||''} · £${(p.now_cost/10).toFixed(1)}m`)))
    : elNode('div', {}, 'No player by that name'));
  box.hidden = false;
  box.querySelectorAll('[data-add]').forEach(d => d.addEventListener('click', async () => {
    const id = +d.dataset.add;
    if(S.manual.length >= 15) return;
    if(!S.manual.some(m => m.id === id)) S.manual.push({id, bought:S.byId[id].now_cost});
    await sset(K_SQUAD, S.manual);
    $('pSearch').value = ''; box.hidden = true;
    $('useManual').checked = true; await saveCfg();
    renderManual(); renderAll();
  }));
}

/* ---------------------------------------------------------------------
   RENDER + WIRING
   --------------------------------------------------------------------- */
function renderRestrictedAppState(){
  setChildren($('gwstrip'),elNode('span',{},'Official FPL data unavailable'));
  renderTicker();
  renderTransfers();
  renderSquad();
  renderManual();
  setChildren($('playerTable'),elNode('div',{class:'empty'},elNode('strong',{},'Player Explorer unavailable'),'Verified Official FPL player data is required before players can be researched.'));
  renderMiniLeagues(globalThis.location?.hash||'#/leagues');
  configureAskAvailability();
  if(typeof document!=='undefined'&&typeof document.dispatchEvent==='function'&&typeof CustomEvent==='function')
    document.dispatchEvent(new CustomEvent('teamsheet:data-rendered'));
}

function renderAll(){
  if(!S.boot) return;
  clearXP();
  const ev = S.boot.events.find(e => e.id === S.nextGW);
  const bits = [elNode('span',{},'Next ',elNode('b',{},`GW${S.nextGW}`))];
  if(ev?.deadline_time){
    const dl = new Date(ev.deadline_time), hrs = (dl - Date.now())/3600000;
    const cd = hrs < 0 ? 'closed' : hrs < 48 ? `${Math.floor(hrs)}h ${Math.floor((hrs%1)*60)}m` : `${Math.floor(hrs/24)}d`;
    bits.push(elNode('span',{},'Deadline ',elNode('b',{class:hrs<48&&hrs>0?'live':''},`${dl.toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} · ${cd}`)));
  }
  bits.push(elNode('span',{},'Season ',elNode('b',{},S.seasonLive ? 'live' : 'pre-season')));
  if(S.entry) bits.push(elNode('span',{},'Team ',elNode('b',{},S.entry.name)));
  setChildren($('gwstrip'),bits);
  const srcBits = [];
  if(S.ustatNote) srcBits.push(S.ustatNote);
  if(S.oddsNote) srcBits.push(S.oddsNote);
  if(S.calib) srcBits.push(`Calibrated against ${S.backtest?.season || 'last season'} (r ${S.backtest?.r ?? '—'}).`);
  setChildren($('srcStatus'),srcBits.map(s=>elNode('div',{},s)));
  setChildren($('chipState'),S.chipsUsed.length ? noteNode('plain',elNode('b',{},'Chips already used:'),` ${S.chipsUsed.join(', ')}.`) : null);
  if(!$('fxFrom').value) $('fxFrom').value = S.nextGW;
  renderTicker(); renderPlayers(); renderSquad(); renderTransfers(); renderManual(); renderMiniLeagues();
  if(typeof document!=='undefined' && typeof document.dispatchEvent==='function' && typeof CustomEvent==='function')
    document.dispatchEvent(new CustomEvent('teamsheet:data-rendered'));
}

function debounce(fn, ms){ let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// Teamsheet 2.0.1: app-shell.mjs owns hash routing, history and focus.
configureAskAvailability();
document.querySelectorAll('[data-q]').forEach(c => c.addEventListener('click', () => { if(c.disabled) return; $('q').value = c.dataset.q; ask(); }));
document.addEventListener('teamsheet:preview-change',()=>renderSquad());
document.addEventListener('teamsheet:restricted',renderRestrictedAppState);

const reFixtureDisplay = debounce(() => { renderTicker(); }, 180);
const reFixtureWindow = debounce(() => { clearXP(); renderTicker(); renderPlayers(); }, 180);
['fxSort','fxLens'].forEach(id => $(id).addEventListener('input', reFixtureDisplay));
['fxFrom','fxSpan'].forEach(id => $(id).addEventListener('input', reFixtureWindow));
['plPos','plMax','plHorizon','plFit','plOwn'].forEach(id => $(id).addEventListener('input', debounce(renderPlayers, 180)));
['ftCount','bankIn'].forEach(id => $(id).addEventListener('input', debounce(() => { saveCfg(); renderSquad(); renderTransfers(); }, 250)));
// The Team ID persists as it is typed; Mini-League choices use their own versioned state.
$('teamId').addEventListener('input', debounce(saveCfg, 300));
$('useManual').addEventListener('change', () => { saveCfg(); renderAll(); });
$('loadBtn').addEventListener('click', () => runVerifiedRefresh({reason:'manual',force:true}));
$('askBtn').addEventListener('click', ask);
$('retryAsk')?.addEventListener('click',()=>{ if(!lastAskQuestion) return; $('q').value=lastAskQuestion; ask(); });
$('btBtn').addEventListener('click', runBacktest);
// The low-value odds key remains client-side temporarily (D-08); save it on
// input so a pasted value is not lost before the field blurs.
$('oddsKey').addEventListener('input', debounce(saveCfg, 300));
$('oddsKey').addEventListener('change', () => { saveCfg(); loadOdds().then(() => { clearXP(); renderAll(); }); });
$('useUstat').addEventListener('change', () => { saveCfg(); loadUnderstat().then(() => { clearXP(); renderAll(); }); });
$('clearThread').addEventListener('click', () => { S.thread = []; lastAskQuestion=''; if($('retryAsk')) $('retryAsk').hidden=true; renderThread(); });
$('pSearch').addEventListener('input', debounce(e => searchPlayers(e.target.value.trim()), 160));
document.addEventListener('click', e => {
  if(!e.target.closest('.searchbox')) $('pResults').hidden = true;
});

(async function init(){
  const cfg = await loadCfg();
  if(cfg){
    if(cfg.teamId) $('teamId').value = cfg.teamId;
    if(cfg.ft != null) $('ftCount').value = cfg.ft;
    if(cfg.bank != null) $('bankIn').value = cfg.bank;
    if(cfg.transferHorizon != null) $('trHorizon').value = String(cfg.transferHorizon);
    if(cfg.transferResults != null) $('trTop').value = String(cfg.transferResults);
    if(cfg.useManual) $('useManual').checked = true;
    if(cfg.oddsKey) $('oddsKey').value = cfg.oddsKey;
    if(cfg.useUstat === false) $('useUstat').checked = false;
  }
  const cal = await sget(K_CAL);
  if(cal){
    S.calib = cal.calib; S.backtest = cal.backtest;
    setChildren($('btOut'),elNode('div',{class:'note good mt-8'},`Calibration from ${cal.backtest?.season} is active (r ${cal.backtest?.r}, ±${cal.backtest?.maeGW} pts/GW). Re-run any time.`));
  }
  S.manual = (await sget(K_SQUAD)) || [];
  await initMiniLeagues(cfg||{});
  await runVerifiedRefresh({reason:'startup',startup:true,force:true});
  installVerifiedRefreshTriggers();
})();
