import {API_FOOTBALL_FPL_SEASON,API_FOOTBALL_PROVIDER_SEASON} from './runtime-contracts.mjs';

const HOUR=60*60*1000;
const due=(kind,at,fixtureId,ordinal=1)=>Object.freeze({logicalId:`${kind}:${fixtureId}:${new Date(at).toISOString()}`,kind,fixtureId:String(fixtureId),ordinal,dueAt:new Date(at).toISOString()});
export function discoveryOpportunity(scheduledTime){const at=new Date(scheduledTime);return due('DISCOVERY',Date.UTC(at.getUTCFullYear(),at.getUTCMonth(),at.getUTCDate()),`${API_FOOTBALL_FPL_SEASON}:${API_FOOTBALL_PROVIDER_SEASON}`);}
export function fixtureOpportunities({providerFixtureId,kickoff,status,finalityChecks=0,changed=false,incomplete=false,conflicted=false}={}){
  const start=Date.parse(kickoff);if(!providerFixtureId||!Number.isFinite(start))return [];
  const rows=[due('PRE_MATCH',start-24*HOUR,providerFixtureId,1),due('PRE_MATCH',start-3*HOUR,providerFixtureId,2)];
  if(['PST','ABD'].includes(status))return rows;
  for(let i=0;i<Math.min(3,Math.max(1,finalityChecks+1));i++)rows.push(due('FINALITY',start+150*60*1000+i*HOUR,providerFixtureId,i+1));
  if(['FT','AET','PEN'].includes(status)){
    rows.push(due('FINAL_ENRICHMENT',start+150*60*1000,providerFixtureId));
    rows.push(due('CORRECTION',start+24*HOUR,providerFixtureId,1));
    if(changed||incomplete||conflicted)rows.push(due('CORRECTION',start+72*HOUR,providerFixtureId,2));
  }
  return Object.freeze(rows);
}
export function dueOpportunities(rows,{now,claimedLogicalIds=[]}={}){const at=Date.parse(now),claimed=new Set(claimedLogicalIds);return Object.freeze(rows.filter(row=>Date.parse(row.dueAt)<=at&&!claimed.has(row.logicalId)).sort((a,b)=>a.dueAt.localeCompare(b.dueAt)||a.logicalId.localeCompare(b.logicalId)));}
