import { S, recordRetry } from '../state.mjs';
import { policyFor, withRetry, isRetryableStatus, safeEndpoint } from '../providers/retry.mjs';
import { $, num, clamp, el, setChildren } from '../util.mjs';
import { GOAL_PTS, CS_PTS, ASSIST_PTS, DC_THRESH, BASE_GOALS, MODEL_VERSION, RULES_VERSION } from '../config.mjs';
import { fetchT } from '../providers/transport.mjs';
import { validateArchiveHeader, ARCHIVE_REQUIRED_COLUMNS } from '../providers/validate.mjs';
import { evaluateWalkForward } from './walk-forward.mjs';
import { ARCHIVE_DATASET, buildArchiveReplay, sha256Hex } from './archive-replay.mjs';

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

// Retained only for regression coverage and historical comparison. It is not
// used by the UI because it leaks real second-half minutes and calibrates on
// the same sample it reports.
export function computeBacktest(text, meta = {}){
  const season = meta.season || 'unknown';
  const rows = parseCSV(text);
  const head = rows[0];
  const headerV = validateArchiveHeader(head);
  if(headerV.value === null){
    const missing = (headerV.issues[0] && headerV.issues[0].fields) || ARCHIVE_REQUIRED_COLUMNS;
    throw new Error('archive format changed — missing: ' + missing.join(', '));
  }
  const col = {}; head.forEach((h,i) => col[h.trim()] = i);
  const g = (r,k) => col[k] !== undefined ? r[col[k]] : '';
  const POSMAP = {GK:1, GKP:1, DEF:2, MID:3, FWD:4};
  const hasDC = col['defensive_contribution'] !== undefined;
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
  const avgCtx = {xGF:BASE_GOALS, xGA:BASE_GOALS, cs:Math.exp(-BASE_GOALS), atk:1, def:1};
  const preds = [], actuals = [];
  const perPos = {1:{p:0,a:0,n:0,rP:[],rA:[]},2:{p:0,a:0,n:0,rP:[],rA:[]},3:{p:0,a:0,n:0,rP:[],rA:[]},4:{p:0,a:0,n:0,rP:[],rA:[]}};
  Object.entries(players).forEach(([key,p]) => {
    if(!p.pos || p.h1.min < 540 || p.h2.app < 5) return;
    const n90 = p.h1.min/90;
    const per = {xg:p.h1.xg/n90, xa:p.h1.xa/n90, sv:p.h1.sv/n90, bps:p.h1.bps/n90, dc:p.h1.dc/n90, yc:p.h1.yc/n90};
    const expM = p.h2.min/p.h2.app;
    const mF = expM/90, pAny = clamp(expM/28,0,.98), p60 = clamp((expM-18)/55,0,.97);
    let xp = pAny + p60;
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
    preds.push(predicted); actuals.push(actual);
    const pp = perPos[p.pos]; pp.p += predicted; pp.a += actual; pp.n++; pp.rP.push(predicted); pp.rA.push(actual);
  });
  if(preds.length < 50) throw new Error('only ' + preds.length + ' qualifying players — not enough to calibrate');
  const r = pearson(preds, actuals);
  const mae = preds.reduce((a,v,i) => a + Math.abs(v - actuals[i]), 0) / preds.length;
  const posLabel = {1:'GKP',2:'DEF',3:'MID',4:'FWD'};
  const calib = {}, posRows = [];
  [1,2,3,4].forEach(k => {
    const pp = perPos[k]; if(!pp.n) return;
    const ratio = pp.a/pp.p;
    calib[k] = clamp(ratio, 0.7, 1.3);
    posRows.push([posLabel[k],pp.n,pearson(pp.rP,pp.rA).toFixed(2),`${((ratio-1)*100).toFixed(0)}%`,`${calib[k].toFixed(2)}×`]);
  });
  return {calib,backtest:{season,n:preds.length,r:+r.toFixed(3),maeGW:+(mae/19).toFixed(2),top20hit:0,
    bias:Object.fromEntries([1,2,3,4].map(k=>[posLabel[k],perPos[k].n?+((perPos[k].a/perPos[k].p-1)*100).toFixed(1):null])),
    hasDC,provenance:{modelVersion:MODEL_VERSION,rulesVersion:RULES_VERSION,dataset:{url:meta.url||null,season,rows:rows.length,pinned:false},predictedAt:meta.now??Date.now(),method:'legacy H1/H2 diagnostic with future minutes'}},posRows};
}

function fmt(value,digits=2){ return value === null || value === undefined ? '—' : Number(value).toFixed(digits); }

async function runBacktest(){
  const out = $('btOut'), btn = $('btBtn');
  btn.disabled = true;
  setChildren(out,el('p',{class:'status'},el('span',{class:'spinner'}),'Downloading pinned 2025–26 archive (~14MB — best on wi-fi)…'));
  const u = ARCHIVE_DATASET.url;
  const { result, record } = await withRetry(
    async () => {
      let res;
      try{ res = await fetchT(u,60000); }
      catch(e){ return {ok:false,retryable:true,status:'network'}; }
      if(!res.ok) return {ok:false,retryable:isRetryableStatus(res.status),status:res.status};
      try{ return {ok:true,value:await res.text(),status:res.status}; }
      catch(e){ return {ok:false,retryable:false,status:'parse'}; }
    },
    {...policyFor('archive'),endpoint:safeEndpoint(u)}
  );
  recordRetry(record);
  if(!result?.ok){
    setChildren(out,el('div',{class:'note bad'},"Couldn't download the pinned archive — check the connection and try again."));
    btn.disabled=false; return;
  }
  setChildren(out,el('p',{class:'status'},el('span',{class:'spinner'}),'Building deadline-safe walk-forward folds…'));
  await new Promise(resolve=>setTimeout(resolve,30));
  try{
    const checksum=await sha256Hex(result.value);
    const replay=buildArchiveReplay(result.value);
    const evaluation=evaluateWalkForward(replay.observations,{dataset:{
      season:ARCHIVE_DATASET.season,sourceRef:ARCHIVE_DATASET.sourceRef,sha256:checksum,
      rows:replay.rows,malformedRows:replay.malformedRows
    }});
    S.backtest=evaluation;
    const raw=evaluation.ablations.raw?.overall;
    const calibrated=evaluation.ablations.fold_calibrated?.overall;
    const kpi=(key,value)=>el('div',{class:'kpi'},el('div',{class:'k'},key),el('div',{class:'v'},value));
    const rows=[
      ['Raw',raw?.n,fmt(raw?.mae),fmt(raw?.rmse),fmt(raw?.bias),fmt(raw?.r)],
      ['Fold calibrated',calibrated?.n,fmt(calibrated?.mae),fmt(calibrated?.rmse),fmt(calibrated?.bias),fmt(calibrated?.r)]
    ];
    const body=el('tbody');
    rows.forEach(row=>body.appendChild(el('tr',{},...row.map((value,index)=>el('td',index?{class:'num'}:{},value))));
    setChildren(out,[
      el('div',{class:'kpis',style:{marginTop:'10px'}},
        kpi('Season',ARCHIVE_DATASET.season),kpi('Folds',evaluation.folds.length),
        kpi('Holdout rows',raw?.n??0),kpi('Malformed rows',replay.malformedRows)),
      el('div',{class:'scroll'},el('table',{class:'data',style:{minWidth:'520px'}},
        el('thead',{},el('tr',{},...['Variant','n','MAE','RMSE','Bias','r'].map((value,index)=>el('th',index?{class:'num'}:{},value)))),body)),
      el('div',{class:'note good'},el('b',{},'Deadline-safe evaluation complete.'),
        ' Every holdout prediction uses only earlier Gameweeks, and fold calibration is fitted only on the immediately preceding calibration window.'),
      el('div',{class:'note plain'},
        `Pinned source ${ARCHIVE_DATASET.sourceRef.slice(0,12)}… · SHA-256 ${checksum.slice(0,12)}… · historical odds ${evaluation.oddsHistory}.`),
      el('div',{class:'note'},el('b',{},'Coverage limitation. '),
        'This replays the existing archive scoring diagnostic with trailing historical minutes and average-fixture context. Historical deadline snapshots for Understat, odds, detailed minutes inputs and production fixture ratings do not exist, so this is not a full out-of-sample validation of the live production model and does not alter current projections.')
    ]);
  } catch(error){
    setChildren(out,el('div',{class:'note bad'},'The pinned archive could not be evaluated safely: '+error.message));
  }
  btn.disabled=false;
}

export { parseCSV, pearson, runBacktest };
