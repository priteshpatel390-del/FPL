import { S } from '../state.mjs';
import { $, num, clamp } from '../util.mjs';
import { GOAL_PTS, CS_PTS, ASSIST_PTS, DC_THRESH, BASE_GOALS, MODEL_VERSION, RULES_VERSION } from '../config.mjs';
import { sset } from '../storage.mjs';
import { fetchT } from '../providers/transport.mjs';
import { clearXP } from './xp.mjs';
/* ---------------------------------------------------------------------
   BACKTEST — fetches last season gameweek-by-gameweek from the vaastav
   archive, builds each player's first-half per-90 profile, projects the
   second half with the exact production formulas, and compares to what
   actually happened. Derives per-position calibration multipliers.
   --------------------------------------------------------------------- */
S.calib = null; S.backtest = null;

function parseCSV(text){
  const rows = []; let row = [], cell = '', inQ = false;
  for(let i=0; i<text.length; i++){
    const ch = text[i];
    if(inQ){
      if(ch === '"'){ if(text[i+1] === '"'){ cell += '"'; i++; } else inQ = false; }
      else cell += ch;
    } else {
      if(ch === '"') inQ = true;
      else if(ch === ',') { row.push(cell); cell = ''; }
      else if(ch === '\n'){ row.push(cell); rows.push(row); row = []; cell = ''; }
      else if(ch !== '\r') cell += ch;
    }
  }
  if(cell.length || row.length){ row.push(cell); rows.push(row); }
  return rows;
}
function pearson(xs, ys){
  const n = xs.length; if(n < 3) return 0;
  const mx = xs.reduce((a,b)=>a+b,0)/n, my = ys.reduce((a,b)=>a+b,0)/n;
  let sxy=0, sxx=0, syy=0;
  for(let i=0;i<n;i++){ const dx=xs[i]-mx, dy=ys[i]-my; sxy+=dx*dy; sxx+=dx*dx; syy+=dy*dy; }
  return sxx && syy ? sxy/Math.sqrt(sxx*syy) : 0;
}

// Pure engine (adjustment 8: directly importable/testable, no DOM, no network).
// Provenance (adjustment 6): every result carries model/rules versions + dataset ref.
export function computeBacktest(text, meta = {}){
  const season = meta.season || 'unknown';
  const rows = parseCSV(text);
  const head = rows[0], col = {}; head.forEach((h,i) => col[h.trim()] = i);
  const need = ['name','position','minutes','total_points','GW'];
  if(need.some(k => col[k] === undefined)){
    throw new Error('archive format changed — missing: ' + need.filter(k=>col[k]===undefined).join(', '));
  }
  const g = (r,k) => col[k] !== undefined ? r[col[k]] : '';
  const POSMAP = {GK:1, GKP:1, DEF:2, MID:3, FWD:4};
  const hasDC = col['defensive_contribution'] !== undefined;

  // aggregate halves per player
  const players = {};
  for(let i=1; i<rows.length; i++){
    const r = rows[i]; if(!r || r.length < head.length-2) continue;
    const gw = parseInt(g(r,'GW')); if(!gw) continue;
    const key = g(r,'name') + '|' + g(r,'position');
    const p = players[key] || (players[key] = {pos:POSMAP[g(r,'position')] || 0, h1:{min:0,xg:0,xa:0,sv:0,bps:0,dc:0,yc:0,app:0}, h2:{min:0,pts:0,app:0}});
    const mins = num(g(r,'minutes'));
    if(gw <= 19){
      if(mins > 0){
        p.h1.min += mins; p.h1.app++;
        p.h1.xg += num(g(r,'expected_goals')); p.h1.xa += num(g(r,'expected_assists'));
        p.h1.sv += num(g(r,'saves')); p.h1.bps += num(g(r,'bps'));
        p.h1.yc += num(g(r,'yellow_cards'));
        if(hasDC) p.h1.dc += num(g(r,'defensive_contribution'));
      }
    } else if(mins > 0){
      p.h2.min += mins; p.h2.pts += num(g(r,'total_points')); p.h2.app++;
    }
  }

  // project H2 with the production formulas under an average fixture
  const avgCtx = {xGF:BASE_GOALS, xGA:BASE_GOALS, cs:Math.exp(-BASE_GOALS), atk:1, def:1};
  const preds = [], actuals = [], poss = [], names = [];
  const perPos = {1:{p:0,a:0,n:0,rP:[],rA:[]},2:{p:0,a:0,n:0,rP:[],rA:[]},3:{p:0,a:0,n:0,rP:[],rA:[]},4:{p:0,a:0,n:0,rP:[],rA:[]}};

  Object.entries(players).forEach(([key,p]) => {
    if(!p.pos || p.h1.min < 540 || p.h2.app < 5) return;
    const n90 = p.h1.min/90;
    const per = {xg:p.h1.xg/n90, xa:p.h1.xa/n90, sv:p.h1.sv/n90, bps:p.h1.bps/n90, dc:p.h1.dc/n90, yc:p.h1.yc/n90};
    const expM = p.h2.min/p.h2.app;                          // real H2 minutes — isolates scoring calibration
    const mF = expM/90, pAny = clamp(expM/28,0,.98), p60 = clamp((expM-18)/55,0,.97);

    let xp = pAny + p60;                                     // appearance
    xp += per.xg * mF * (GOAL_PTS[p.pos] ?? 4);
    xp += per.xa * mF * ASSIST_PTS;
    if(CS_PTS[p.pos]) xp += avgCtx.cs * CS_PTS[p.pos] * p60;
    if(p.pos <= 2) xp -= (avgCtx.xGA/2) * mF * 0.72;
    if(p.pos === 1) xp += (per.sv / 3) * mF;
    const thr = DC_THRESH[p.pos];
    if(thr && per.dc) xp += 2 * (1/(1+Math.exp(-(per.dc-thr)/2.2))) * p60;
    xp += clamp((per.bps-16)/20, 0, 1.8) * mF;
    xp -= per.yc * mF;

    const predicted = xp * p.h2.app, actual = p.h2.pts;
    preds.push(predicted); actuals.push(actual); poss.push(p.pos); names.push(key.split('|')[0]);
    const pp = perPos[p.pos]; pp.p += predicted; pp.a += actual; pp.n++; pp.rP.push(predicted); pp.rA.push(actual);
  });

  if(preds.length < 50){
    throw new Error('only ' + preds.length + ' qualifying players — not enough to calibrate');
  }

  const r = pearson(preds, actuals);
  const mae = preds.reduce((a,v,i) => a + Math.abs(v - actuals[i]), 0) / preds.length;
  const maeGW = mae / 19;
  const posLabel = {1:'GKP',2:'DEF',3:'MID',4:'FWD'};
  const calib = {};
  let posHTML = '';
  [1,2,3,4].forEach(k => {
    const pp = perPos[k]; if(!pp.n) return;
    const ratio = pp.a/pp.p;
    calib[k] = clamp(ratio, 0.7, 1.3);
    posHTML += `<tr><td>${posLabel[k]}</td><td class="num">${pp.n}</td>
      <td class="num">${pearson(pp.rP, pp.rA).toFixed(2)}</td>
      <td class="num">${((ratio-1)*100).toFixed(0)}%</td>
      <td class="num">${calib[k].toFixed(2)}×</td></tr>`;
  });

  // captain check: of the 20 highest predicted, how did their actual ranks land?
  const idx = preds.map((v,i)=>i).sort((a,b)=>preds[b]-preds[a]).slice(0,20);
  const actRank = preds.map((_,i)=>i).sort((a,b)=>actuals[b]-actuals[a]);
  const rankOf = {}; actRank.forEach((i,r2)=>rankOf[i]=r2+1);
  const top20hit = idx.filter(i => rankOf[i] <= 30).length;

  return { calib,
    backtest: { season, n: preds.length, r:+r.toFixed(3), maeGW:+maeGW.toFixed(2), top20hit,
      bias: Object.fromEntries([1,2,3,4].map(k => [posLabel[k], perPos[k].n ? +((perPos[k].a/perPos[k].p-1)*100).toFixed(1) : null])),
      hasDC,
      provenance: {
        modelVersion: MODEL_VERSION, rulesVersion: RULES_VERSION,
        dataset: { url: meta.url || null, season, rows: rows.length,
          pinned: false /* TODO: pin to commit SHA — tracked in AUDIT BT-1 */ },
        predictedAt: meta.now ?? Date.now(),
        method: 'H1-per90 → H2 projection, real H2 minutes, average fixture'
      } },
    posHTML };
}

async function runBacktest(){
  const out = $('btOut'), btn = $('btBtn');
  btn.disabled = true;
  out.innerHTML = `<p class="status"><span class="spinner"></span>Downloading last season (~14MB — best on wi-fi)…</p>`;
  const seasons = ['2025-26','2024-25'];
  let text = null, season = null, url = null;
  for(const s of seasons){
    try{
      const u = 'https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/master/data/'+s+'/gws/merged_gw.csv';
      const res = await fetchT(u, 60000);
      if(res.ok){ text = await res.text(); season = s; url = u; break; }
    }catch(e){}
  }
  if(!text){ out.innerHTML = `<div class="note bad">Couldn't download the archive — check the connection and try again.</div>`; btn.disabled = false; return; }
  out.innerHTML = `<p class="status"><span class="spinner"></span>Replaying ${season} through the model…</p>`;
  await new Promise(r => setTimeout(r, 30));
  let result;
  try{ result = computeBacktest(text, { season, url }); }
  catch(err){
    out.innerHTML = `<div class="note bad">${String(err.message || err)}</div>`;
    btn.disabled = false; return;
  }
  const { calib, backtest, posHTML } = result;
  const r = { toFixed: d => backtest.r.toFixed(d) }, maeGW = backtest.maeGW, top20hit = backtest.top20hit,
        hasDC = backtest.hasDC, preds = { length: backtest.n };
  S.calib = calib;
  S.backtest = backtest;
  await sset(K_CAL, {calib, backtest});
  clearXP();
  out.innerHTML = `
    <div class="kpis" style="margin-top:10px">
      <div class="kpi"><div class="k">Season</div><div class="v">${season}</div></div>
      <div class="kpi"><div class="k">Players</div><div class="v">${preds.length}</div></div>
      <div class="kpi"><div class="k">Correlation</div><div class="v">${r.toFixed(2)}</div></div>
      <div class="kpi"><div class="k">Error /GW</div><div class="v">±${maeGW.toFixed(1)}</div></div>
    </div>
    <div class="scroll"><table class="data" style="min-width:420px"><thead><tr><th>Pos</th><th class="num">n</th><th class="num">r</th><th class="num">Model bias</th><th class="num">Correction</th></tr></thead><tbody>${posHTML}</tbody></table></div>
    <div class="note good"><b>Calibration applied.</b> Every projection in the app is now multiplied by the per-position corrections above (negative bias = the model was over-predicting that position). ${top20hit}/20 of the model's top picks finished inside the actual top 30.</div>
    ${!hasDC ? `<div class="note plain">This season file has no defensive-contribution column, so the DEF/MID corrections also absorb those points — expect them to run above 1.0×.</div>` : ''}
    <div class="note plain">Method: first-half per-90 profiles project the second half under an average fixture, using each player's real second-half minutes — this isolates the scoring model from minutes prediction, which is judged separately. Ask tab can analyse these numbers for you.</div>`;
  btn.disabled = false;
  renderAll();
}

export { parseCSV, pearson, runBacktest };
