import {apiFootballDiscoveryPlan} from '../../src/decision-intelligence/api-football-discovery.mjs';
import {validateProviderMapping} from '../../src/decision-intelligence/api-football-shadow-contracts.mjs';
import {readOfficialFplAuthority} from './d1-persistence.mjs';
import {readQualifiedTeamMappings} from './mapping-persistence.mjs';
import {discoveryOpportunity,dueOpportunities,fixtureOpportunities} from './scheduler.mjs';
import {
  API_FOOTBALL_FPL_SEASON,API_FOOTBALL_PROVIDER_SEASON,requestAttemptIdentity,validateAuthority,validateCollectorRequest
} from './runtime-contracts.mjs';

export const API_FOOTBALL_PRELIVE_PLANNER_MODE='prelive_planner_only';
export const API_FOOTBALL_MAX_PLANNED_REQUESTS_PER_WAKE=10;

const safe=value=>Object.freeze(value);
const fail=reason=>safe({ok:false,reason:String(reason)});
const canonicalNow=value=>{const ms=Date.parse(value);return Number.isFinite(ms)?new Date(ms).toISOString():null;};

function validateMappingAuthority(mappingAuthority,authority){
  if(!mappingAuthority?.ok||mappingAuthority.completeTwentyClubCoverage!==true||
    mappingAuthority.verifiedPremierLeagueTeamCount!==20||mappingAuthority.mappings?.length!==20)return fail('qualified_mapping_unavailable');
  const authorityIds=(authority.teamIds||[]).slice().sort();
  const mappings=mappingAuthority.mappings.slice().sort((a,b)=>a.canonicalFplId.localeCompare(b.canonicalFplId));
  if(authorityIds.length!==20||authorityIds.join('|')!==mappings.map(row=>row.canonicalFplId).join('|'))return fail('qualified_mapping_authority_mismatch');
  for(const mapping of mappings){
    const valid=validateProviderMapping(mapping,{entityType:'team',season:API_FOOTBALL_FPL_SEASON});
    if(!valid.ok)return fail('qualified_mapping_members_invalid');
  }
  return safe({ok:true,mappings});
}

function requestDescriptor({op,logicalRequestId,operationClass,endpoint,endpointClass,search}){
  const attemptId=requestAttemptIdentity(logicalRequestId,1);
  const request=safe({
    opportunityLogicalId:op.logicalId,logicalRequestId,attemptId,attemptNumber:1,
    operationClass,endpoint,endpointClass,search:safe({...search}),requiresAuthority:true
  });
  const valid=validateCollectorRequest(request);return valid.ok?request:null;
}

export function requestPlanForOpportunity(op){
  if(!op||!op.logicalId||!op.kind)return fail('planner_opportunity_invalid');
  if(op.kind==='DISCOVERY'){
    const plan=apiFootballDiscoveryPlan();if(!plan.ok)return plan;
    const requests=[];
    for(const item of plan.items){
      const logicalRequestId=op.logicalId+':'+item.logicalCompetitionKey;
      const request=requestDescriptor({
        op,logicalRequestId,operationClass:'DISCOVERY',endpoint:'fixtures',endpointClass:'fixtures_discovery',
        search:{league:item.providerLeagueId,season:API_FOOTBALL_PROVIDER_SEASON}
      });
      if(!request)return fail('planner_request_invalid');
      requests.push(request);
    }
    return safe({ok:true,requests:safe(requests),blocked:false});
  }
  if(op.kind==='PRE_MATCH'||op.kind==='FINALITY'){
    const request=requestDescriptor({
      op,logicalRequestId:op.logicalId,operationClass:op.kind,endpoint:'fixtures',endpointClass:'fixture',
      search:{id:String(op.fixtureId)}
    });
    return request?safe({ok:true,requests:safe([request]),blocked:false}):fail('planner_request_invalid');
  }
  if(op.kind==='FINAL_ENRICHMENT'||op.kind==='CORRECTION'){
    return safe({ok:true,requests:safe([]),blocked:true,reason:'workload_ingestion_not_approved'});
  }
  return fail('planner_opportunity_invalid');
}

export function buildScheduledCollectionPlan({now,authority,mappingAuthority,fixtures=[],completedLogicalIds=[]}={}){
  const at=canonicalNow(now);if(!at)return fail('planner_timestamp_invalid');
  const validAuthority=validateAuthority(authority,{now:at});if(!validAuthority.ok)return validAuthority;
  const mappings=validateMappingAuthority(mappingAuthority,authority);if(!mappings.ok)return mappings;
  const opportunities=[discoveryOpportunity(at)];
  for(const fixture of fixtures||[])opportunities.push(...fixtureOpportunities(fixture));
  const due=dueOpportunities(opportunities,{now:at,claimedLogicalIds:completedLogicalIds});
  const requests=[],blockedOperations=[],deferredOperations=[];
  for(const op of due){
    const planned=requestPlanForOpportunity(op);if(!planned.ok)return planned;
    if(planned.blocked){blockedOperations.push(safe({logicalId:op.logicalId,kind:op.kind,reason:planned.reason}));continue;}
    if(requests.length+planned.requests.length>API_FOOTBALL_MAX_PLANNED_REQUESTS_PER_WAKE){
      deferredOperations.push(safe({logicalId:op.logicalId,kind:op.kind,reason:'planner_request_ceiling'}));continue;
    }
    requests.push(...planned.requests);
  }
  return safe({
    ok:true,mode:API_FOOTBALL_PRELIVE_PLANNER_MODE,now:at,
    mappingCoverageCount:20,requestCount:requests.length,
    requests:safe(requests),blockedOperations:safe(blockedOperations),deferredOperations:safe(deferredOperations),
    dueOpportunityCount:due.length
  });
}

export async function readPlannerFixtures(db,{season=API_FOOTBALL_FPL_SEASON}={}){
  if(!db?.prepare)return fail('storage_unavailable');
  const result=await db.prepare(
    "SELECT i.provider_fixture_id,r.provider_kickoff,r.provider_status,r.qualification_state,r.supersedes_revision_id,(SELECT COUNT(DISTINCT a.logical_request_id) FROM api_football_request_attempts a WHERE a.operation_class='FINALITY' AND a.outcome='SUCCEEDED' AND a.logical_request_id LIKE 'FINALITY:'||i.provider_fixture_id||':%') finality_checks FROM api_football_discovery_heads h JOIN api_football_generation_fixtures gf ON gf.generation_id=h.generation_id JOIN provider_fixture_identities i ON i.provider_fixture_identity=gf.provider_fixture_identity JOIN api_football_fixture_revisions r ON r.fixture_revision_id=(SELECT rr.fixture_revision_id FROM api_football_fixture_revisions rr WHERE rr.provider_fixture_identity=i.provider_fixture_identity ORDER BY rr.fetched_at DESC,rr.fixture_revision_id DESC LIMIT 1) WHERE h.fpl_season=? ORDER BY r.provider_kickoff,i.provider_fixture_id"
  ).bind(season).all();
  const fixtures=(result?.results||[]).map(row=>safe({
    providerFixtureId:String(row.provider_fixture_id),kickoff:row.provider_kickoff,status:row.provider_status,
    finalityChecks:Number(row.finality_checks||0),changed:row.supersedes_revision_id!=null,
    incomplete:!['PROVIDER_QUALIFIED','CROSS_SOURCE_VERIFIED'].includes(row.qualification_state),
    conflicted:['CONFLICTED','AMBIGUOUS'].includes(row.qualification_state)
  }));
  return safe({ok:true,fixtures:safe(fixtures)});
}

export async function readCompletedPlannerLogicalIds(db){
  if(!db?.prepare)return fail('storage_unavailable');
  const result=await db.prepare(
    "SELECT logical_request_id logical_id FROM api_football_request_attempts WHERE outcome='SUCCEEDED' AND operation_class IN ('PRE_MATCH','FINALITY') UNION SELECT logical_opportunity logical_id FROM api_football_discovery_generations WHERE state='COMMITTED'"
  ).all();
  return safe({ok:true,logicalIds:safe((result?.results||[]).map(row=>String(row.logical_id)).filter(Boolean))});
}

export async function planScheduledCollection(db,{now}={}){
  const at=canonicalNow(now);if(!at)return fail('planner_timestamp_invalid');
  const official=await readOfficialFplAuthority(db,{now:at});if(!official.ok)return official;
  const authority=official.authority;
  const valid=validateAuthority(authority,{now:at});if(!valid.ok)return valid;
  const mappings=await readQualifiedTeamMappings(db,{season:API_FOOTBALL_FPL_SEASON,authority});if(!mappings.ok)return mappings;
  const fixtures=await readPlannerFixtures(db);if(!fixtures.ok)return fixtures;
  const completed=await readCompletedPlannerLogicalIds(db);if(!completed.ok)return completed;
  const plan=buildScheduledCollectionPlan({now:at,authority,mappingAuthority:mappings,fixtures:fixtures.fixtures,completedLogicalIds:completed.logicalIds});
  return plan.ok?safe({...plan,executionContext:safe({authority,mappings:mappings.mappings})}):plan;
}
