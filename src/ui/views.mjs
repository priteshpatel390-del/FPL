// Views import broadly; the bundler flattens everything into one scope.
/* ---------------------------------------------------------------------
   VIEW — FIXTURE TICKER
   --------------------------------------------------------------------- */
function renderTicker(){
  if(!S.fixtures) return;
  const from = clamp(parseInt($('fxFrom').value) || S.nextGW, 1, 38);
  const span = clamp(parseInt($('fxSpan').value) || 6, 3, 12);
  const lens = $('fxLens').value, sort = $('fxSort').value;

  let teams = Object.values(S.teams).map(t => ({t, s:runScore(t.id, from, span, lens)}));
  if(sort === 'ease') teams.sort((a,b) => b.s - a.s);
  else if(sort === 'hard') teams.sort((a,b) => a.s - b.s);
  else teams.sort((a,b) => a.t.name.localeCompare(b.t.name));

  let html = '<table class="ticker"><thead><tr><th class="tm">Team</th>';
  for(let gw = from; gw < from+span; gw++) html += `<th>GW${gw}</th>`;
  html += '</tr></thead><tbody>';

  teams.forEach(({t,s}) => {
    html += `<tr><td class="team">${t.short_name}<span class="ease">${s.toFixed(2)}</span></td>`;
    teamFixtures(t.id, from, span).forEach(games => {
      if(!games.length){ html += `<td><div class="cell blank">—<small>BLANK</small></div></td>`; return; }
      const dbl = games.length > 1 ? ' dbl' : '';
      const diffs = games.map(g => lens === 'official' ? g.officialDiff
        : multToDiff(lens === 'defence' ? g.ctx.def : g.ctx.atk));
      const inner = games.map((g,i) =>
        `${g.opp.short_name}<small>${g.home?'H':'A'} · ${diffs[i]}</small>`).join('<hr style="border:0;height:1px;background:rgba(255,255,255,.45);width:80%;margin:2px 0">');
      html += `<td><div class="cell d${diffs[0]}${dbl}">${inner}</div></td>`;
    });
    html += '</tr>';
  });
  $('ticker').innerHTML = html + '</tbody></table>';

  const swings = Object.values(S.teams).map(t => {
    const now = runScore(t.id, from, 3, lens), later = runScore(t.id, from+3, 3, lens);
    return {t, delta: later - now};
  });
  const up = swings.filter(s => s.delta > .18).sort((a,b)=>b.delta-a.delta).slice(0,4);
  const down = swings.filter(s => s.delta < -.18).sort((a,b)=>a.delta-b.delta).slice(0,4);
  let sh = '';
  if(up.length) sh += `<div class="note good"><b>Turns favourable from GW${from+3}:</b> ${up.map(s=>s.t.name).join(', ')}. Buying a gameweek early usually beats buying late.</div>`;
  if(down.length) sh += `<div class="note bad"><b>Turns hard from GW${from+3}:</b> ${down.map(s=>s.t.name).join(', ')}. Plan exits before the crowd moves.</div>`;

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
  if(flags.length) sh += `<div class="note"><b>Chip windows:</b> ${flags.join(' · ')}</div>`;
  $('swings').innerHTML = sh;
}

/* ---------------------------------------------------------------------
   VIEW — RANKER
   --------------------------------------------------------------------- */
let openRow = null;
function renderPlayers(){
  if(!S.boot) return;
  const from = clamp(parseInt($('fxFrom').value) || S.nextGW, 1, 38);
  const span = +$('plHorizon').value;
  const pos = +$('plPos').value, maxP = num($('plMax').value)*10;
  const hideFlag = $('plFit').checked, onlyMine = $('plOwn').checked;
  const mineIds = new Set(mySquad().map(s => s.p.id));

  $('rankerHint').innerHTML = S.seasonLive
    ? 'Expected points per gameweek, modelled separately for each position — clean sheets and saves for keepers and defenders, expected goal involvement for attackers, plus bonus and defensive actions. Tap a row for the breakdown.'
    : '<b>Pre-season.</b> No match data exists yet, so projections start from the price FPL set (a decent prior for expected output) adjusted by fixture and ownership. Real form, xGI and bonus switch on after GW1. Tap a row for the breakdown.';

  let pool = S.boot.elements.filter(p =>
    (!pos || p.element_type === pos) &&
    p.now_cost <= maxP &&
    (!onlyMine || mineIds.has(p.id)) &&
    (!hideFlag || (p.status === 'a' && (p.chance_of_playing_next_round ?? 100) >= 75)));

  const ranked = pool.map(p => ({p, x:xpOf(p, from, span)}))
    .sort((a,b) => b.x.total - a.x.total).slice(0, 45);
  const maxPer = ranked.length ? ranked[0].x.perGW : 1;

  let h = `<table class="data"><thead><tr><th>Player</th><th class="num">£</th><th class="num">Own%</th>
    <th class="num">Form</th><th class="num">xP/GW</th><th class="num">xP ${span}GW</th><th class="num">per £m</th></tr></thead><tbody>`;
  ranked.forEach(({p,x}) => {
    const t = S.teams[p.team];
    h += `<tr class="clickable" data-pid="${p.id}">
      <td><span class="pname">${p.web_name}${flagsFor(p)}</span>
          <span class="pmeta"><span class="pos">${S.posName[p.element_type]||'?'}</span> ${t?t.short_name:'—'}${x.games!==span?` · ${x.games} games`:''}</span></td>
      <td class="num">${(p.now_cost/10).toFixed(1)}</td>
      <td class="num">${p.selected_by_percent}</td>
      <td class="num">${fmt1(num(p.form))}</td>
      <td class="num"><span class="xp ${x.perGW >= maxPer*0.82 ? 'hot':''}">${fmt1(x.perGW)}</span></td>
      <td class="num">${fmt1(x.total)}</td>
      <td class="num">${fmt1(x.total/(p.now_cost/10))}</td>
    </tr>`;
  });
  $('playerTable').innerHTML = h + '</tbody></table>';

  $('playerTable').querySelectorAll('tr.clickable').forEach(tr => tr.addEventListener('click', () => {
    const pid = +tr.dataset.pid;
    const next = tr.nextElementSibling;
    if(next && next.classList.contains('bd')){ next.remove(); openRow = null; return; }
    document.querySelectorAll('tr.bd').forEach(r => r.remove());
    const p = S.byId[pid], x = xpOf(p, from, span);
    const row = document.createElement('tr');
    row.className = 'bd';
    row.innerHTML = `<td colspan="7" style="padding:0"><div class="drawer">${breakdownHTML(p, x, span)}</div></td>`;
    tr.after(row); openRow = pid;
  }));
}

function breakdownHTML(p, x, span){
  const entries = Object.entries(x.parts).filter(([,v]) => Math.abs(v) > 0.01)
    .sort((a,b) => Math.abs(b[1]) - Math.abs(a[1]));
  const max = Math.max(...entries.map(([,v]) => Math.abs(v)), 0.01);
  let h = `<b>${p.web_name}</b> — ${fmt1(x.total)} projected points over ${span} gameweek${span>1?'s':''} (${x.games} fixture${x.games===1?'':'s'})`;
  if(p.news) h += `<div style="margin-top:6px;color:var(--claret)">${p.news} <span class="flag dark">${newsAge(p)}</span></div>`;
  h += '<div class="bars">';
  entries.forEach(([k,v]) => {
    h += `<div class="bar"><span>${k}</span><span class="track"><span class="fill ${v<0?'neg':''}" style="width:${Math.abs(v)/max*100}%"></span></span><span class="v">${v>0?'+':''}${fmt1(v)}</span></div>`;
  });
  h += '</div>';
  const runs = teamFixtures(p.team, clamp(parseInt($('fxFrom').value)||S.nextGW,1,38), span);
  const fx = runs.map((g,i) => g.length ? g.map(o => `${o.opp.short_name}(${o.home?'H':'A'})`).join('+') : 'blank').join(' · ');
  h += `<div style="margin-top:8px;color:var(--ink-soft)"><b>Fixtures:</b> ${fx}</div>`;
  const mo = priceMomentum(p);
  if(mo) h += `<div style="margin-top:4px;color:var(--ink-soft)"><b>Price:</b> heavy net transfers ${mo==='rising'?'in — a rise looks likely':'out — a fall looks likely'}.</div>`;
  return h;
}

/* ---------------------------------------------------------------------
   VIEW — SQUAD
   --------------------------------------------------------------------- */
function renderSquad(){
  const el = $('squadOut');
  const squad = mySquad();
  if(!squad.length){
    el.innerHTML = `<div class="empty"><strong>No squad yet</strong>
      ${S.entry ? `Team found: <b>${S.entry.name}</b>. FPL only publishes picks once a gameweek is under way — until then, build your 15 by hand below and everything still works.`
                : 'Add your team ID above, or build your 15 by hand below.'}</div>`;
    return;
  }
  const gw = S.nextGW;
  const xi = bestXI(squad, gw);
  const bank = num($('bankIn').value)*10;

  const problems = [];
  squad.forEach(({p}) => {
    if(['i','u','s','n'].includes(p.status)) problems.push(`<b>${p.web_name}</b> unavailable${p.news?` — ${p.news} <span class="flag dark">${newsAge(p)}</span>`:''}`);
    else if(p.status === 'd') problems.push(`<b>${p.web_name}</b> doubtful ${p.chance_of_playing_next_round ?? '?'}%${p.news?` — ${p.news} <span class="flag dark">${newsAge(p)}</span>`:''}`);
    else if(priceMomentum(p) === 'falling') problems.push(`<b>${p.web_name}</b> is being sold heavily — a price fall looks likely`);
  });
  const blanks = squad.filter(({p}) => (teamFixtures(p.team, gw, 1)[0]||[]).length === 0);
  if(blanks.length) problems.push(`<b>${blanks.map(b=>b.p.web_name).join(', ')}</b> ${blanks.length>1?'have':'has'} no fixture in GW${gw}`);

  let h = '';
  h += `<div class="kpis">
    <div class="kpi"><div class="k">Projected GW${gw}</div><div class="v">${fmt1(xi.tot)}</div></div>
    <div class="kpi"><div class="k">Shape</div><div class="v">${xi.shape}</div></div>
    <div class="kpi"><div class="k">Squad value</div><div class="v">£${fmt1(squad.reduce((a,s)=>a+s.p.now_cost,0)/10)}m</div></div>
    <div class="kpi"><div class="k">Free transfers</div><div class="v">${num($('ftCount').value)}</div></div>
  </div>`;
  if(S.entry) h += `<p class="status" style="margin-bottom:10px">${S.entry.name} · ${S.entry.player_first_name||''} ${S.entry.player_last_name||''} · OR ${(S.entry.summary_overall_rank||0).toLocaleString('en-GB')}</p>`;
  h += problems.length ? `<div class="note bad"><b>Needs attention</b><br>${problems.join('<br>')}</div>`
                       : `<div class="note good">No injuries, suspensions, blanks or price falls in your 15. Nothing forces a transfer this week.</div>`;

  // captain
  const capRank = xi.xi.map(s => ({s, x:xpOf(s.p, gw, 1).total, own:num(s.p.selected_by_percent)}))
    .sort((a,b) => b.x - a.x);
  if(capRank.length){
    const c1 = capRank[0], c2 = capRank[1];
    h += `<h3 style="margin:16px 0 6px">Captain</h3><div class="capgrid">`;
    capRank.slice(0,4).forEach((c,i) => {
      const games = teamFixtures(c.s.p.team, gw, 1)[0] || [];
      const why = games.length
        ? games.map(g => `${g.home?'vs':'away to'} ${g.opp.short_name}`).join(' + ') + ` · ${fmt1(c.x)} xP · ${c.own}% owned`
        : 'no fixture';
      h += `<div class="capcard ${i===0?'top':''}"><div class="rank">${i+1}</div>
        <div class="capbody"><span class="pname">${c.s.p.web_name}${flagsFor(c.s.p)}</span><div class="why">${why}</div></div>
        <span class="xp ${i===0?'hot':''}">${fmt1(c.x*2)}</span></div>`;
    });
    h += '</div>';
    if(c2 && (c1.x - c2.x) < 0.6){
      const safer = c1.own >= c2.own ? c1 : c2;
      h += `<div class="note">${c1.s.p.web_name} and ${c2.s.p.web_name} are within half a point — effectively a coin toss. ${safer.s.p.web_name} is the higher-owned pick at ${safer.own}%, so it protects your rank; the other is the rank-climbing play.</div>`;
    }
  }

  // best XI
  h += `<h3 style="margin:18px 0 8px">Best XI by projection</h3>`;
  [1,2,3,4].forEach(pos => {
    const line = xi.xi.filter(s => s.p.element_type === pos);
    if(!line.length) return;
    h += '<div class="pitchrow">' + line.map(s => {
      const bad = availability(s.p) < 1;
      const isCap = capRank[0] && capRank[0].s.p.id === s.p.id;
      return `<div class="pcard ${isCap?'cap':''} ${bad?'warn':''}"><b>${s.p.web_name}${isCap?' (C)':''}</b>
        <span class="x">${fmt1(xpOf(s.p,gw,1).total)}</span></div>`;
    }).join('') + '</div>';
  });
  h += `<div class="benchband"><div class="status" style="margin-bottom:6px">Bench order</div><div class="pitchrow">` +
    xi.bench.map((s,i) => `<div class="pcard"><b>${i+1}. ${s.p.web_name}</b><span class="x">${fmt1(xpOf(s.p,gw,1).total)}</span></div>`).join('') +
    `</div></div>`;

  // full table
  h += `<h3 style="margin:18px 0 6px">All 15 over 6 gameweeks</h3><div class="scroll"><table class="data"><thead><tr>
    <th>Player</th><th class="num">£</th><th class="num">Sell</th><th class="num">Form</th><th class="num">xP GW${gw}</th><th class="num">xP 6GW</th></tr></thead><tbody>`;
  squad.slice().sort((a,b) => a.p.element_type - b.p.element_type || xpOf(b.p,gw,6).total - xpOf(a.p,gw,6).total)
    .forEach(s => {
      h += `<tr><td><span class="pname">${s.p.web_name}${flagsFor(s.p)}</span>
        <span class="pmeta"><span class="pos">${S.posName[s.p.element_type]||'?'}</span> ${S.teams[s.p.team]?.short_name||''}</span></td>
        <td class="num">${(s.p.now_cost/10).toFixed(1)}</td>
        <td class="num">${(sellPrice(s)/10).toFixed(1)}</td>
        <td class="num">${fmt1(num(s.p.form))}</td>
        <td class="num">${fmt1(xpOf(s.p,gw,1).total)}</td>
        <td class="num"><span class="xp">${fmt1(xpOf(s.p,gw,6).total)}</span></td></tr>`;
    });
  h += '</tbody></table></div>';
  if(!$('useManual').checked && S.picks)
    h += `<div class="note plain">Sell prices assume you bought at today's price — the public API doesn't expose purchase prices. Build the squad by hand if you want them exact.</div>`;
  el.innerHTML = h;
}

/* ---------------------------------------------------------------------
   VIEW — TRANSFER PLANNER
   --------------------------------------------------------------------- */
function renderTransfers(){
  const el = $('transferOut');
  const squad = mySquad();
  if(!squad.length){
    el.innerHTML = `<div class="empty"><strong>No squad loaded</strong>Add your 15 on the Squad tab — by hand is fine — and the planner will cost every swap.</div>`;
    return;
  }
  const span = +$('trHorizon').value, topN = +$('trTop').value;
  const gw = S.nextGW, bank = num($('bankIn').value)*10, ft = num($('ftCount').value);
  const mineIds = new Set(squad.map(s => s.p.id));
  const teamCount = {};
  squad.forEach(s => teamCount[s.p.team] = (teamCount[s.p.team]||0)+1);

  const moves = [];
  squad.forEach(out => {
    const budget = sellPrice(out) + bank;
    const outXP = xpOf(out.p, gw, span).total;
    S.boot.elements.forEach(inP => {
      if(mineIds.has(inP.id)) return;
      if(inP.element_type !== out.p.element_type) return;
      if(inP.now_cost > budget) return;
      if(availability(inP) < 0.75) return;
      const cnt = (teamCount[inP.team]||0) - (inP.team === out.p.team ? 1 : 0);
      if(cnt >= 3) return;                                  // 3-per-club rule
      const gain = xpOf(inP, gw, span).total - outXP;
      if(gain <= 0) return;
      moves.push({out, inP, gain, cost:(inP.now_cost - sellPrice(out))/10});
    });
  });
  moves.sort((a,b) => b.gain - a.gain);

  if(!moves.length){
    el.innerHTML = `<div class="note good"><b>No upgrade found.</b> Nothing available within budget projects better than what you already own over the next ${span} gameweek${span>1?'s':''}. Roll the transfer.</div>`;
    return;
  }
  const best = moves[0];
  let h = `<div class="note ${best.gain > 4 ? 'good' : 'plain'}"><b>Top move:</b> ${best.out.p.web_name} → ${best.inP.web_name},
    +${fmt1(best.gain)} projected points over ${span} GW${span>1?'s':''}.
    ${ft >= 1 ? `You have ${ft} free transfer${ft>1?'s':''}, so this costs nothing.`
              : best.gain > 4 ? 'Even after a −4 this clears the bar.'
                              : `After a −4 it nets ${fmt1(best.gain-4)} — not worth it.`}</div>`;
  if(ft >= 2) h += `<div class="note plain">With ${ft} banked, the top ${Math.min(ft,5)} moves below can all be made free — but check they aren't two players from the same fixture swing.</div>`;

  h += `<div class="scroll"><table class="data"><thead><tr><th>Out</th><th>In</th><th class="num">Cost £m</th>
    <th class="num">Gain</th><th class="num">After −4</th><th>Verdict</th></tr></thead><tbody>`;
  moves.slice(0, topN).forEach(m => {
    const net = m.gain - 4;
    const verdict = m.gain > 6 ? '<span class="flag rise">strong</span>'
                  : m.gain > 4 ? '<span class="flag rise">worth a hit</span>'
                  : m.gain > 1.5 ? '<span class="flag info">free only</span>'
                  : '<span class="flag dark">marginal</span>';
    h += `<tr>
      <td><span class="pname">${m.out.p.web_name}</span><span class="pmeta">${S.teams[m.out.p.team]?.short_name||''} · ${fmt1(xpOf(m.out.p,gw,span).total)} xP</span></td>
      <td><span class="pname">${m.inP.web_name}${flagsFor(m.inP)}</span><span class="pmeta">${S.teams[m.inP.team]?.short_name||''} · ${fmt1(xpOf(m.inP,gw,span).total)} xP</span></td>
      <td class="num">${m.cost>0?'+':''}${fmt1(m.cost)}</td>
      <td class="num"><span class="xp ${m.gain>4?'hot':''}">+${fmt1(m.gain)}</span></td>
      <td class="num" style="color:${net>0?'var(--pitch)':'var(--claret)'}">${net>0?'+':''}${fmt1(net)}</td>
      <td>${verdict}</td></tr>`;
  });
  h += `</tbody></table></div>
    <div class="note plain">A hit only pays if the gain clears 4 points across the horizon you chose — over one gameweek that is a high bar, which is why most weeks the honest answer is to roll.</div>`;
  el.innerHTML = h;
}

/* ---------------------------------------------------------------------
   VIEW — MINI-LEAGUE
   --------------------------------------------------------------------- */
/* ---------------------------------------------------------------------
   SAVED LEAGUES — multiple mini-leagues as one-tap buttons. Comparing a
   new ID saves it automatically; the name comes from the API if none given.
   --------------------------------------------------------------------- */
S.leagues = [];
async function saveLeagues(){ await sset('fpl:leagues', S.leagues); }
function renderLeagueChips(){
  const el = $('leagueChips');
  if(!S.leagues.length){ el.innerHTML = ''; return; }
  el.innerHTML = S.leagues.map((l,i) =>
    `<button class="chip" data-lg="${i}">${l.name || l.id}</button>
     <button class="chip" data-lgrm="${i}" aria-label="Remove ${l.name || l.id}" style="padding:6px 9px;color:var(--claret)">×</button>`).join('');
  el.querySelectorAll('[data-lg]').forEach(b => b.addEventListener('click', () => {
    const l = S.leagues[+b.dataset.lg];
    $('leagueId').value = l.id; $('leagueName').value = l.name || '';
    compareLeague();
  }));
  el.querySelectorAll('[data-lgrm]').forEach(b => b.addEventListener('click', async () => {
    S.leagues.splice(+b.dataset.lgrm, 1);
    await saveLeagues(); renderLeagueChips();
  }));
}
async function rememberLeague(id, name){
  const existing = S.leagues.find(l => l.id === id);
  if(existing){ if(name) existing.name = name; }
  else S.leagues.push({id, name: name || ''});
  await saveLeagues(); renderLeagueChips();
}

async function compareLeague(){
  const el = $('leagueOut'), id = $('leagueId').value.replace(/\D/g,'');
  if(!id){ el.innerHTML = `<div class="note bad">Add a league ID first — it's the number in your league's URL.</div>`; return; }
  if(!S.seasonLive || !S.currentGW){
    el.innerHTML = `<div class="empty"><strong>Rival squads aren't published yet</strong>FPL only exposes other managers' picks once a gameweek has finished. This comes alive after GW1.</div>`;
    return;
  }
  el.innerHTML = `<p class="status"><span class="spinner"></span>Reading the league…</p>`;
  await saveCfg();
  try{
    const stV = validateStandings(await api('/leagues-classic/'+id+'/standings/', {optional:true}));
    recordIssues('fpl', '/leagues-classic/standings/', stV.issues);
    const st = stV.value;
    if(!st || !st.standings){ el.innerHTML = `<div class="note bad">League ${id} not found, or it's private.</div>`; return; }
    await rememberLeague(id, $('leagueName').value.trim() || st.league?.name || '');
    const n = +$('lgN').value;
    const rivals = st.standings.results.slice(0, n).filter(r => String(r.entry) !== String(S.teamId));
    el.innerHTML = `<p class="status"><span class="spinner"></span>Reading ${rivals.length} rival squads…</p>`;
    const rawPicks = await pool(rivals, r => api(`/entry/${r.entry}/event/${S.currentGW}/picks/`, {optional:true, timeout:9000}), 4);
    // D-14: each rival squad is validated individually; issues are collapsed so
    // 20 bad responses cannot flood S.dataIssues with near-identical entries.
    const rivalIssues = [];
    const picks = rawPicks.map(pk => {
      const v = validatePicks(pk, '/entry/event/picks/ (rival)');
      if(v.issues.length) rivalIssues.push(...v.issues);
      return v.value;
    });
    recordIssues('fpl', '/entry/event/picks/ (rival)', collapseIssues(rivalIssues));

    const own = {}, cap = {};
    let counted = 0;
    picks.forEach(pk => {
      if(!pk || !pk.picks) return;
      counted++;
      pk.picks.forEach(x => {
        own[x.element] = (own[x.element]||0) + 1;
        if(x.is_captain) cap[x.element] = (cap[x.element]||0) + 1;
      });
    });
    if(!counted){ el.innerHTML = `<div class="note bad">Could not read any rival squads — the relays may be rate limiting. Try a smaller number of rivals.</div>`; return; }

    const mine = new Set(mySquad().map(s => s.p.id));
    const gw = S.nextGW;
    const rows = Object.keys(own).map(pid => {
      const p = S.byId[pid]; if(!p) return null;
      const o = own[pid]/counted*100, c = (cap[pid]||0)/counted*100;
      return {p, own:o, cap:c, eo:o + c, mine:mine.has(+pid), xp:xpOf(p, gw, 6).total};
    }).filter(Boolean);

    const threats = rows.filter(r => !r.mine && r.own >= 35).sort((a,b) => b.eo - a.eo).slice(0,10);
    const diffs   = rows.filter(r =>  r.mine && r.own <= 25).sort((a,b) => b.xp - a.xp).slice(0,10);
    const myOnly  = [...mine].filter(x => !own[x]).map(x => S.byId[x]).filter(Boolean);

    let h = `<div class="kpis">
      <div class="kpi"><div class="k">Rivals read</div><div class="v">${counted}</div></div>
      <div class="kpi"><div class="k">My rank</div><div class="v">${(st.standings.results.find(r=>String(r.entry)===String(S.teamId))||{}).rank ?? '—'}</div></div>
      <div class="kpi"><div class="k">Unique to me</div><div class="v">${myOnly.length}</div></div>
    </div>`;
    h += `<p class="status" style="margin-bottom:12px">${st.league.name} · effective ownership = owned % + captained %.</p>`;

    h += `<h3>Biggest threats you don't own</h3><div class="scroll"><table class="data"><thead><tr>
      <th>Player</th><th class="num">Owned</th><th class="num">Capt</th><th class="num">EO</th><th class="num">xP 6GW</th></tr></thead><tbody>`;
    threats.forEach(r => h += `<tr><td><span class="pname">${r.p.web_name}${flagsFor(r.p)}</span>
      <span class="pmeta"><span class="pos">${S.posName[r.p.element_type]||''}</span> ${S.teams[r.p.team]?.short_name||''} · £${(r.p.now_cost/10).toFixed(1)}m</span></td>
      <td class="num">${r.own.toFixed(0)}%</td><td class="num">${r.cap.toFixed(0)}%</td>
      <td class="num"><span class="xp ${r.eo>80?'hot':''}">${r.eo.toFixed(0)}%</span></td>
      <td class="num">${fmt1(r.xp)}</td></tr>`);
    h += `</tbody></table></div>`;
    if(!threats.length) h += `<div class="note good">Nothing widely owned that you're missing — you're covered on the template.</div>`;

    h += `<h3 style="margin-top:18px">Your differentials</h3>`;
    if(diffs.length){
      h += `<div class="scroll"><table class="data"><thead><tr><th>Player</th><th class="num">Rival own</th><th class="num">xP 6GW</th></tr></thead><tbody>`;
      diffs.forEach(r => h += `<tr><td><span class="pname">${r.p.web_name}</span>
        <span class="pmeta">${S.teams[r.p.team]?.short_name||''}</span></td>
        <td class="num">${r.own.toFixed(0)}%</td><td class="num">${fmt1(r.xp)}</td></tr>`);
      h += `</tbody></table></div>`;
    }
    if(myOnly.length) h += `<div class="note"><b>Owned by nobody else in the league:</b> ${myOnly.map(p=>p.web_name).join(', ')}. These are where you win or lose the league.</div>`;
    el.innerHTML = h;
  }catch(e){
    el.innerHTML = `<div class="note bad">Couldn't read that league — the relays may be busy. Try again, or reduce the number of rivals.</div>`;
  }
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

function renderThread(){
  $('thread').innerHTML = S.thread.map(m =>
    `<div class="answer ${m.role==='user'?'me':''}"><p>${md(m.content)}</p></div>`).join('');
}

async function ask(){
  const q = $('q').value.trim();
  if(!q) return;
  S.thread.push({role:'user', content:q});
  $('q').value = '';
  renderThread();
  const btn = $('askBtn'); btn.disabled = true;
  $('askStatus').innerHTML = '<span class="spinner"></span>Thinking…';
  try{
    const system = `You are an experienced Fantasy Premier League analyst advising one manager. Today is ${new Date().toDateString()}.
Treat the app data as the source of truth for squad, prices, projections and fixtures. Search the web for anything time-sensitive: injuries, press conferences, expected line-ups, transfers, rotation risk.
Be decisive and blunt. Say plainly when the honest answer is to do nothing — a banked transfer usually beats a marginal one, and a -4 needs to clear 4 projected points to be worth it. Never invent statistics you were not given and did not find. Keep answers under 250 words.

APP DATA
${buildContext()}`;
    // D-08 / SEC-3: no Anthropic secret is accepted, stored or sent by this
    // frontend. Claude's artifact preview provides the only approved keyless
    // path. Static hosted builds stop before making any Anthropic request.
    if(!window.storage){
      S.thread.push({role:'assistant', content:"The AI assistant requires the planned serverless migration in this hosted build. For now, the Ask tab is available only inside Claude's artifact preview; this app does not accept or store Anthropic API keys."});
      renderThread(); $('askStatus').textContent = ''; btn.disabled = false; return;
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
      S.thread.push({role:'assistant', content:'The keyless Claude connection is unavailable in this preview. Try again later or use the hosted app without the Ask feature.'});
      renderThread(); $('askStatus').textContent = ''; btn.disabled = false; return;
    }
    const data = await res.json();
    const text = (data.content||[]).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    S.thread.push({role:'assistant', content: text || 'No answer came back — try again.'});
    renderThread();
    $('askStatus').textContent = '';
  }catch(e){
    S.thread.pop();
    renderThread();
    $('askStatus').textContent = 'That request failed — check your connection and try again.';
  }
  btn.disabled = false;
}

/* ---------------------------------------------------------------------
   MANUAL SQUAD BUILDER
   --------------------------------------------------------------------- */
function renderManual(){
  const list = $('manualList');
  list.innerHTML = S.manual.map((m,i) => {
    const p = S.byId[m.id];
    if(!p) return '';
    return `<span class="pill">${p.web_name} <span class="mono" style="color:var(--ink-soft)">${S.posName[p.element_type]||''}</span>
      <button data-rm="${i}" aria-label="Remove ${p.web_name}">×</button></span>`;
  }).join('');
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
  box.innerHTML = hits.map(p => `<div data-add="${p.id}">${p.web_name}
    <span class="pmeta">${S.posName[p.element_type]||''} · ${S.teams[p.team]?.short_name||''} · £${(p.now_cost/10).toFixed(1)}m</span></div>`).join('')
    || '<div>No player by that name</div>';
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
function renderAll(){
  if(!S.boot) return;
  clearXP();
  const ev = S.boot.events.find(e => e.id === S.nextGW);
  const bits = [`<span>Next <b>GW${S.nextGW}</b></span>`];
  if(ev?.deadline_time){
    const dl = new Date(ev.deadline_time), hrs = (dl - Date.now())/3600000;
    const cd = hrs < 0 ? 'closed' : hrs < 48 ? `${Math.floor(hrs)}h ${Math.floor((hrs%1)*60)}m` : `${Math.floor(hrs/24)}d`;
    bits.push(`<span>Deadline <b class="${hrs<48&&hrs>0?'live':''}">${dl.toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} · ${cd}</b></span>`);
  }
  bits.push(`<span>Season <b>${S.seasonLive ? 'live' : 'pre-season'}</b></span>`);
  if(S.entry) bits.push(`<span>Team <b>${S.entry.name}</b></span>`);
  $('gwstrip').innerHTML = bits.join('');
  const srcBits = [];
  if(S.ustatNote) srcBits.push(S.ustatNote);
  if(S.oddsNote) srcBits.push(S.oddsNote);
  if(S.calib) srcBits.push(`Calibrated against ${S.backtest?.season || 'last season'} (r ${S.backtest?.r ?? '—'}).`);
  $('srcStatus').innerHTML = srcBits.length ? srcBits.map(s => `<div>${s}</div>`).join('') : '';
  $('chipState').innerHTML = S.chipsUsed.length
    ? `<div class="note plain"><b>Chips already used:</b> ${S.chipsUsed.join(', ')}.</div>` : '';
  if(!$('fxFrom').value) $('fxFrom').value = S.nextGW;
  renderTicker(); renderPlayers(); renderSquad(); renderTransfers(); renderManual();
}

function debounce(fn, ms){ let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

document.querySelectorAll('.tab').forEach((t, i, all) => {
  t.addEventListener('click', () => {
    all.forEach(x => x.setAttribute('aria-selected', x === t));
    document.querySelectorAll('.view').forEach(v => v.hidden = v.id !== 'view-' + t.dataset.view);
    window.scrollTo({top:0, behavior:'smooth'});
  });
  t.addEventListener('keydown', e => {
    if(e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = all[(i + (e.key === 'ArrowRight' ? 1 : all.length-1)) % all.length];
    next.focus(); next.click();
  });
});
document.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => { $('q').value = c.dataset.q; ask(); }));

const reFixtures = debounce(() => { clearXP(); renderTicker(); renderPlayers(); renderSquad(); renderTransfers(); }, 180);
['fxFrom','fxSpan','fxSort','fxLens'].forEach(id => $(id).addEventListener('input', reFixtures));
['plPos','plMax','plHorizon','plFit','plOwn'].forEach(id => $(id).addEventListener('input', debounce(renderPlayers, 180)));
['trHorizon','trTop'].forEach(id => $(id).addEventListener('input', debounce(renderTransfers, 180)));
['ftCount','bankIn'].forEach(id => $(id).addEventListener('input', debounce(() => { saveCfg(); renderSquad(); renderTransfers(); }, 250)));
// the team and league IDs must persist the moment they're typed — a failed
// data load must never lose them
['teamId','leagueId'].forEach(id => $(id).addEventListener('input', debounce(saveCfg, 300)));
$('useManual').addEventListener('change', () => { saveCfg(); renderAll(); });
$('loadBtn').addEventListener('click', loadAll);
$('lgBtn').addEventListener('click', compareLeague);
$('askBtn').addEventListener('click', ask);
$('btBtn').addEventListener('click', runBacktest);
// The low-value odds key remains client-side temporarily (D-08); save it on
// input so a pasted value is not lost before the field blurs.
$('oddsKey').addEventListener('input', debounce(saveCfg, 300));
$('oddsKey').addEventListener('change', () => { saveCfg(); loadOdds().then(() => { clearXP(); renderAll(); }); });
$('useUstat').addEventListener('change', () => { saveCfg(); loadUnderstat().then(() => { clearXP(); renderAll(); }); });
$('clearThread').addEventListener('click', () => { S.thread = []; renderThread(); });
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
    if(cfg.leagueId) $('leagueId').value = cfg.leagueId;
    if(cfg.useManual) $('useManual').checked = true;
    if(cfg.oddsKey) $('oddsKey').value = cfg.oddsKey;
    if(cfg.useUstat === false) $('useUstat').checked = false;
  }
  const cal = await sget(K_CAL);
  if(cal){
    S.calib = cal.calib; S.backtest = cal.backtest;
    $('btOut').innerHTML = `<div class="note good" style="margin-top:8px">Calibration from ${cal.backtest?.season} is active (r ${cal.backtest?.r}, ±${cal.backtest?.maeGW} pts/GW). Re-run any time.</div>`;
  }
  S.manual = (await sget(K_SQUAD)) || [];
  S.leagues = (await sget('fpl:leagues')) || [];
  renderLeagueChips();
  loadAll();
})();
