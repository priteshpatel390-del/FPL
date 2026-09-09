// Set-based, order-independent attribution for A1.3's overlapping schedule windows.
import {deepFreeze} from './canonical.mjs';

export const ATTRIBUTION_ASSIGNED='ASSIGNED';
export const ATTRIBUTION_AMBIGUOUS='AMBIGUOUS';

export class OpportunityAttributionError extends Error{
  constructor(code){super(code);this.name='OpportunityAttributionError';this.code=code;}
}
const fail=code=>{throw new OpportunityAttributionError(code);};

const validRun=run=>run&&Number.isSafeInteger(run.workflowRunId)&&run.workflowRunId>0
  &&Array.isArray(run.candidates)&&run.candidates.length<=2
  &&run.candidates.every(value=>typeof value==='string'&&Number.isFinite(Date.parse(value)));

// Enumerate opportunity owners, not run iteration orders. A1.3 has only two opportunities per
// overlapping component, so this is bounded to (runs + 1)^2 choices even with a full 100-run page.
export function resolveOpportunityAttributions({runs,persisted=[],occupied=[]}){
  if(!Array.isArray(runs)||!runs.every(validRun)||!Array.isArray(persisted)||!Array.isArray(occupied))
    fail('opportunity_attribution_input_invalid');
  const byId=new Map();
  for(const run of runs){
    if(byId.has(run.workflowRunId))fail('opportunity_attribution_run_duplicate');
    byId.set(run.workflowRunId,{...run,candidates:[...new Set(run.candidates)].sort()});
  }
  const assigned=new Map();
  const owned=new Map();
  for(const row of occupied){
    if(typeof row?.opportunityAt!=='string'||!Number.isSafeInteger(row.workflowRunId)
      ||owned.has(row.opportunityAt))fail('opportunity_attribution_occupied_invalid');
    owned.set(row.opportunityAt,row.workflowRunId);
  }
  for(const row of persisted){
    const run=byId.get(row?.workflowRunId);
    if(!run||typeof row.opportunityAt!=='string'||!run.candidates.includes(row.opportunityAt)
      ||assigned.has(row.workflowRunId)||owned.has(row.opportunityAt))
      fail('opportunity_attribution_persisted_invalid');
    assigned.set(row.workflowRunId,row.opportunityAt);owned.set(row.opportunityAt,row.workflowRunId);
  }
  const unresolved=[...byId.values()].filter(run=>!assigned.has(run.workflowRunId));
  const forced=[];
  const ambiguousRuns=[];
  const ambiguousOpportunities=[];
  const remaining=new Set(unresolved.map(run=>run.workflowRunId));
  while(remaining.size){
    const seed=remaining.values().next().value;
    const componentRuns=[];const componentOpportunities=new Set();let changed=true;
    componentRuns.push(byId.get(seed));remaining.delete(seed);
    for(const value of byId.get(seed).candidates)if(!owned.has(value))componentOpportunities.add(value);
    while(changed){
      changed=false;
      for(const runId of [...remaining]){
        const run=byId.get(runId);
        if(run.candidates.some(value=>componentOpportunities.has(value))){
          componentRuns.push(run);remaining.delete(runId);changed=true;
          for(const value of run.candidates)if(!owned.has(value))componentOpportunities.add(value);
        }
      }
    }
    const opportunities=[...componentOpportunities].sort();
    const mappings=[];
    function visit(index,current,used){
      if(index===opportunities.length){mappings.push(new Map(current));return;}
      const opportunity=opportunities[index];visit(index+1,current,used);
      for(const run of componentRuns){
        if(used.has(run.workflowRunId)||!run.candidates.includes(opportunity))continue;
        current.set(run.workflowRunId,opportunity);used.add(run.workflowRunId);
        visit(index+1,current,used);used.delete(run.workflowRunId);current.delete(run.workflowRunId);
      }
    }
    visit(0,new Map(),new Set());
    const maximum=Math.max(0,...mappings.map(mapping=>mapping.size));
    const best=mappings.filter(mapping=>mapping.size===maximum);
    const forcedIds=new Set();
    for(const run of componentRuns){
      const values=new Set(best.map(mapping=>mapping.get(run.workflowRunId)??null));
      if(values.size===1&&!values.has(null)){
        forced.push({workflowRunId:run.workflowRunId,opportunityAt:[...values][0],status:ATTRIBUTION_ASSIGNED});
        forcedIds.add(run.workflowRunId);
      }
    }
    ambiguousRuns.push(...componentRuns.filter(run=>!forcedIds.has(run.workflowRunId)
      &&best.some(mapping=>mapping.has(run.workflowRunId))).map(run=>run.workflowRunId));
    ambiguousOpportunities.push(...opportunities.filter(opportunity=>{
      const owners=new Set(best.map(mapping=>[...mapping].find(([,value])=>value===opportunity)?.[0]??null));
      return owners.size>1;
    }));
  }
  return deepFreeze({assignments:deepFreeze([...persisted.map(row=>({...row,status:ATTRIBUTION_ASSIGNED})),
    ...forced].sort((a,b)=>a.workflowRunId-b.workflowRunId)),
  ambiguousRuns:deepFreeze(ambiguousRuns.sort((a,b)=>a-b)),
  ambiguousOpportunities:deepFreeze(ambiguousOpportunities.sort())});
}
