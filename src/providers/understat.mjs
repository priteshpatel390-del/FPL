import { S } from '../state.mjs';
import { $, num } from '../util.mjs';
import { fetchVia } from './transport.mjs';
import { mapTeamName } from './common.mjs';
import { markHealth } from './registry.mjs';
/* ---------------------------------------------------------------------
   UNDERSTAT LAYER — rolling actual xG replaces trusting FPL's slow-moving
   strength ratings. Parses the teamsData JSON embedded in the league page.
   --------------------------------------------------------------------- */
S.ustat = null; S.ustatNote = '';
function parseUnderstat(html){
  const m = html.match(/teamsData\s*=\s*JSON\.parse\('([^']+)'\)/);
  if(!m) return null;
  const json = m[1].replace(/\\x([0-9A-Fa-f]{2})/g, (_,h) => String.fromCharCode(parseInt(h,16)))
                   .replace(/\\'/g,"'").replace(/\\\\/g,'\\');
  try{ return JSON.parse(json); }catch(e){ return null; }
}
async function loadUnderstat(){
  S.ustat = null; S.ustatNote = '';
  if(!$('useUstat').checked || !S.boot) return;
  const html = await fetchVia('https://understat.com/league/EPL', {asText:true});
  let data = html ? parseUnderstat(html) : null;
  let label = 'current season';
  const matchCount = data ? Object.values(data).reduce((a,t) => a + (t.history||[]).length, 0) : 0;
  if(!data || matchCount < 40){
    // too few games this season to be meaningful — use last season's closing form
    const prevYear = new Date().getMonth() >= 6 ? new Date().getFullYear() - 1 : new Date().getFullYear() - 2;
    const prev = await fetchVia('https://understat.com/league/EPL/' + prevYear, {asText:true});
    const pd = prev ? parseUnderstat(prev) : null;
    if(pd){ data = pd; label = `last season's closing form`; }
  }
  if(!data){ S.ustatNote = 'Understat unreachable — using FPL strength ratings only.'; markHealth('understat', false, 'unreachable', true); return; }

  const map = {}; let sumA = 0, sumD = 0, n = 0;
  Object.values(data).forEach(t => {
    const hist = (t.history || []).slice(-6);
    if(!hist.length) return;
    const xg  = hist.reduce((a,h) => a + num(h.xG), 0) / hist.length;
    const xga = hist.reduce((a,h) => a + num(h.xGA), 0) / hist.length;
    const id = mapTeamName(t.title);
    if(id){ map[id] = {xg, xga}; sumA += xg; sumD += xga; n++; }
  });
  if(!n){ S.ustatNote = 'Understat team names could not be matched.'; return; }
  const avgXg = sumA/n, avgXga = sumD/n;
  Object.values(map).forEach(v => { v.atk = v.xg/avgXg; v.def = avgXga/v.xga; });
  S.ustat = map;
  markHealth('understat', true, label);
  const missing = S.boot.teams.filter(t => !map[t.id]).map(t => t.short_name);
  S.ustatNote = `Understat: last-6 xG loaded (${label})` + (missing.length ? `; no data for ${missing.join(', ')} — FPL ratings used for them` : '') + '.';
}

export { parseUnderstat, loadUnderstat };
