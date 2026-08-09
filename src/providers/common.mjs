import { S } from '../state.mjs';
/* ---------------------------------------------------------------------
   TEAM NAME MAPPING — Understat and the odds feed use full club names;
   FPL uses its own short forms.
   --------------------------------------------------------------------- */
const NAME_ALIASES = {
  'manchester united':'Man Utd','manchester city':'Man City','tottenham':'Spurs',
  'tottenham hotspur':'Spurs','wolverhampton wanderers':'Wolves','wolverhampton':'Wolves',
  'nottingham forest':"Nott'm Forest",'brighton and hove albion':'Brighton',
  'brighton & hove albion':'Brighton','west ham united':'West Ham','newcastle united':'Newcastle',
  'sheffield united':'Sheffield Utd','leeds united':'Leeds','coventry city':'Coventry',
  'hull city':'Hull','ipswich town':'Ipswich','luton town':'Luton','leicester city':'Leicester',
  'afc bournemouth':'Bournemouth','crystal palace':'Crystal Palace'
};
/* R3 A3 — the team list is an explicit argument so provider computation maps
   against the STAGED core rather than whatever S happens to hold mid-refresh.
   Defaulting to S.boot.teams keeps every existing caller working unchanged. */
function mapTeamName(external, teams = S.boot?.teams){
  if(!Array.isArray(teams)) return null;
  const low = external.toLowerCase().trim();
  const target = (NAME_ALIASES[low] || external).toLowerCase();
  let hit = teams.find(t => t.name.toLowerCase() === target);
  if(!hit) hit = teams.find(t => target.startsWith(t.name.toLowerCase()) || t.name.toLowerCase().startsWith(target.split(' ')[0]));
  return hit ? hit.id : null;
}

export { NAME_ALIASES, mapTeamName };
