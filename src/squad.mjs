import { S } from './state.mjs';
import { $, num } from './util.mjs';
import { xpOf } from './model/xp.mjs';
/* ---------------------------------------------------------------------
   SHARED BITS
   --------------------------------------------------------------------- */
function flagsFor(p){
  let h = '';
  if(['i','u','s','n'].includes(p.status))
    h += `<span class="flag out">${p.status==='s'?'SUSP':'OUT'}</span>`;
  else if(p.status === 'd')
    h += `<span class="flag doubt">${p.chance_of_playing_next_round ?? '?'}%</span>`;
  if(p.cost_change_event > 0) h += '<span class="flag rise">▲</span>';
  if(p.cost_change_event < 0) h += '<span class="flag fall">▼</span>';
  const mo = priceMomentum(p);
  if(mo === 'rising') h += '<span class="flag rise">rising</span>';
  if(mo === 'falling') h += '<span class="flag fall">falling</span>';
  return h;
}
function priceMomentum(p){
  const net = num(p.transfers_in_event) - num(p.transfers_out_event);
  if(net > 55000) return 'rising';
  if(net < -55000) return 'falling';
  return null;
}
function newsAge(p){
  if(!p.news || !p.news_added) return '';
  const days = Math.floor((Date.now() - new Date(p.news_added))/86400000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : days + 'd ago';
}
function sellPrice(entry){
  // FPL keeps half of any rise, rounded down to 0.1
  const now = entry.p.now_cost, bought = entry.bought ?? now;
  if(now <= bought) return now;
  return bought + Math.floor((now - bought)/2);
}

function mySquad(){
  if($('useManual').checked || !S.picks || !S.picks.picks){
    return S.manual.map((m,i) => ({p:S.byId[m.id], bought:m.bought, position:i+1, multiplier:1})).filter(x => x.p);
  }
  return S.picks.picks.map(pk => ({p:S.byId[pk.element], bought:null, sellingPrice:pk.selling_price, position:pk.position,
    multiplier:pk.multiplier, is_captain:pk.is_captain})).filter(x => x.p);
}

function bestXI(squad, gw){
  const byPos = {1:[],2:[],3:[],4:[]};
  squad.forEach(s => { if(byPos[s.p.element_type]) byPos[s.p.element_type].push(s); });
  Object.values(byPos).forEach(arr => arr.sort((a,b) => xpOf(b.p,gw,1).total - xpOf(a.p,gw,1).total));
  let best = null;
  for(let d=3; d<=5; d++) for(let m=2; m<=5; m++){
    const f = 10 - d - m;
    if(f < 1 || f > 3) continue;
    if(byPos[1].length < 1 || byPos[2].length < d || byPos[3].length < m || byPos[4].length < f) continue;
    const xi = [byPos[1][0], ...byPos[2].slice(0,d), ...byPos[3].slice(0,m), ...byPos[4].slice(0,f)];
    const tot = xi.reduce((a,s) => a + xpOf(s.p,gw,1).total, 0);
    if(!best || tot > best.tot) best = {tot, xi, shape:`${d}-${m}-${f}`};
  }
  if(!best) return {tot:0, xi:squad.slice(0,11), shape:'—', bench:squad.slice(11)};
  const ids = new Set(best.xi.map(s => s.p.id));
  best.bench = squad.filter(s => !ids.has(s.p.id))
    .sort((a,b) => (a.p.element_type===1?1:0)-(b.p.element_type===1?1:0) || xpOf(b.p,gw,1).total - xpOf(a.p,gw,1).total);
  return best;
}

export { flagsFor, priceMomentum, newsAge, sellPrice, mySquad, bestXI };
