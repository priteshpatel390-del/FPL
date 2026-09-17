import {canonicalise,deepFreeze,sha256Hex,stableStringify} from './canonical.mjs';
import {eia1SecretFinding} from './eia1-safety.mjs';
import {
  API_FOOTBALL_DAILY_REQUEST_LIMIT,API_FOOTBALL_ENDPOINTS,API_FOOTBALL_ORIGIN,API_FOOTBALL_REQUEST_TIMEOUT_MS,
  apiFootballRequestInit,buildPinnedApiFootballUrl,decodeApiFootballResponse,normalizeApiFootballQuotaHeaders,
  sendApiFootballRequest
} from './api-football-foundation.mjs';
import {
  API_FOOTBALL_DISCOVERY_ATTEMPT_GAP_MS,API_FOOTBALL_FPL_SEASON,API_FOOTBALL_PROVIDER_SEASON,
  buildApiFootballDiscoveryRequest,mappingCoverage
} from './api-football-discovery.mjs';
import {
  currentSeasonOfficialFplTeamIdentities,issueOfficialFplTeamUniverseAuthority,officialFplTeamIdentity,
  validateProviderMapping
} from './api-football-shadow-contracts.mjs';

export const EIA_2I5E_CHECKPOINT='EIA-2I5E';
export const EIA_2I5E_PRODUCTION_BYTE_CEILING=null;
export const EIA_2I5E_MAX_ATTEMPTS=16;
export const EIA_2I5E_MIN_GAP_MS=API_FOOTBALL_DISCOVERY_ATTEMPT_GAP_MS;
export const EIA_2I5E_MEASUREMENT_ABORT_BYTES=8*1024*1024;
export const EIA_2I5E_BYTE_CEILING_MULTIPLIER=2;
export const EIA_2I5E_BYTE_CEILING_QUANTUM_BYTES=64*1024;
export const EIA_2I5E_BYTE_CEILING_HARD_CAP_BYTES=2*1024*1024;
export const OFFICIAL_FPL_BOOTSTRAP_URL='https://fantasy.premierleague.com/api/bootstrap-static/';
export const OFFICIAL_FPL_FIXTURES_URL='https://fantasy.premierleague.com/api/fixtures/';
const ENDPOINT_CLASSES=Object.freeze(['fixtures_discovery','fixture','lineups','players','events']);
const REQUIRED_CLASSES=ENDPOINT_CLASSES;
const KNOWN_ID_PARAMETER=Object.freeze({fixtures:'id','fixtures/lineups':'fixture','fixtures/players':'fixture','fixtures/events':'fixture'});
const DISCOVERY_LEAGUES=Object.freeze(['2','3','848','45','48']);
const MAPPING_RECEIPT_KIND='eia-2i5e-team-mapping-evidence-v1';
const MAPPING_RECEIPT_REVISION='eia-2i5e-r1';
const fail=reason=>deepFreeze({ok:false,reason:String(reason)});
const positiveId=value=>{const text=String(value??'');return /^\d+$/.test(text)&&Number(text)>0?text:null;};
const iso=value=>{const ms=Date.parse(value);return Number.isFinite(ms)?new Date(ms).toISOString():null;};
const secret=value=>eia1SecretFinding(value)?fail('secret_material'):null;

export const PREVIOUSLY_QUALIFIED_PL_TEAMS=deepFreeze([
  {club:'Chelsea',providerTeamId:'49',officialFplTeamId:'6',expectedName:'Chelsea',expectedShortName:'CHE',fixtureId:'1636205',evidenceDate:'2026-09-09',evidenceType:'eia-2i4c-current-season-league-cup-fixture',provenance:'EIA-2I4C verified Chelsea API-Football 49 → Official FPL 6 on fixture 1636205'},
  {club:'Leeds',providerTeamId:'63',officialFplTeamId:'13',expectedName:'Leeds',expectedShortName:'LEE',fixtureId:'1636205',evidenceDate:'2026-09-09',evidenceType:'eia-2i4c-current-season-league-cup-fixture',provenance:'EIA-2I4C verified Leeds API-Football 63 → Official FPL 13 on fixture 1636205'}
]);

export function eia2i5eRequestPlan(){
  const discovery=DISCOVERY_LEAGUES.map(league=>({
    id:`discovery-${league}`,operationClass:'DISCOVERY',endpointClass:'fixtures_discovery',endpoint:'fixtures',
    search:{league,season:String(API_FOOTBALL_PROVIDER_SEASON)},competition:league,highWaterCandidate:league==='48'||league==='2',
    rationale:league==='48'||league==='2'?'current-season discovery likely to contain many fixtures':'approved discovery coverage'
  }));
  const known=(id,endpointClass,endpoint,highWaterCandidate,rationale)=>({
    id:`${endpointClass}-${id}`,operationClass:'FINAL_ENRICHMENT',endpointClass,endpoint,
    search:endpoint==='fixtures'?{id:String(id)}:{fixture:String(id)},competition:id==='1636205'?'48':'2',
    highWaterCandidate,rationale
  });
  return deepFreeze({
    ok:true,checkpoint:EIA_2I5E_CHECKPOINT,maxAttempts:EIA_2I5E_MAX_ATTEMPTS,minGapMs:EIA_2I5E_MIN_GAP_MS,
    timeoutMs:API_FOOTBALL_REQUEST_TIMEOUT_MS,origin:API_FOOTBALL_ORIGIN,dailySafetyCeiling:API_FOOTBALL_DAILY_REQUEST_LIMIT,
    productionByteCeiling:EIA_2I5E_PRODUCTION_BYTE_CEILING,items:[
      ...discovery,
      known('1636205','fixture','fixtures',false,'previously qualified completed League Cup fixture'),
      known('1636205','lineups','fixtures/lineups',false,'structured XI/bench on a completed match'),
      known('1636205','players','fixtures/players',true,'/fixtures/players is the expected high-water class'),
      known('1636205','events','fixtures/events',true,'substitutions/goals/cards produce a non-trivial events payload'),
      known('1635643','fixture','fixtures',false,'previously qualified completed Champions League fixture'),
      known('1635643','players','fixtures/players',true,'second completed-match players payload for comparison')
    ]
  });
}

function requestIdentity(item){
  return stableStringify({endpointClass:item.endpointClass,endpoint:item.endpoint,search:item.search});
}

function receiptBasis(mapping,evidence,authorityDigest){
  return canonicalise({
    kind:MAPPING_RECEIPT_KIND,revision:MAPPING_RECEIPT_REVISION,provider:'api-football',
    providerTeamId:String(mapping.providerEntityId),canonicalFplId:mapping.canonicalFplId,season:mapping.season,
    evidenceType:evidence.evidenceType,stableEvidenceId:String(evidence.stableEvidenceId),source:evidence.source,
    sourceRevision:evidence.sourceRevision,observedAt:iso(evidence.observedAt),provenance:evidence.provenance,
    qualificationMethod:evidence.qualificationMethod,officialFplAuthorityDigest:authorityDigest
  });
}

export async function issueQualificationMappingReceipt({mapping,evidence,authority}={},cryptoImpl=globalThis.crypto){
  const clubs=currentSeasonOfficialFplTeamIdentities(API_FOOTBALL_FPL_SEASON,authority);
  const valid=validateProviderMapping(mapping,{entityType:'team',season:API_FOOTBALL_FPL_SEASON});
  if(!clubs.ok)return clubs;if(!valid.ok)return valid;
  if(!clubs.identities.includes(mapping.canonicalFplId))return fail('mapping_target_not_authoritative');
  if(!evidence||!['provider_fixture_participant','trusted_eia_2i4c_fixture'].includes(evidence.evidenceType)||
    !positiveId(evidence.stableEvidenceId)||!String(evidence.source||'').trim()||!String(evidence.sourceRevision||'').trim()||
    !iso(evidence.observedAt)||!String(evidence.provenance||'').trim()||
    !['attended_provider_evidence','trusted_legacy_adapter'].includes(evidence.qualificationMethod))return fail('mapping_evidence_invalid');
  if(evidence.evidenceType==='trusted_eia_2i4c_fixture'&&evidence.qualificationMethod!=='trusted_legacy_adapter')return fail('mapping_evidence_invalid');
  if(evidence.evidenceType==='provider_fixture_participant'&&evidence.qualificationMethod!=='attended_provider_evidence')return fail('mapping_evidence_invalid');
  const authorityDigestHash=await sha256Hex(clubs.digest,cryptoImpl);
  const basis=receiptBasis(mapping,evidence,authorityDigestHash);
  return deepFreeze({...basis,integrityHash:await sha256Hex(stableStringify(basis),cryptoImpl)});
}

async function validateQualificationMappingReceipt(mapping,receipt,authority,cryptoImpl=globalThis.crypto){
  const clubs=currentSeasonOfficialFplTeamIdentities(API_FOOTBALL_FPL_SEASON,authority);if(!clubs.ok)return clubs;
  if(!receipt||receipt.kind!==MAPPING_RECEIPT_KIND||receipt.revision!==MAPPING_RECEIPT_REVISION)return fail('mapping_evidence_receipt_missing');
  const evidence={evidenceType:receipt.evidenceType,stableEvidenceId:receipt.stableEvidenceId,source:receipt.source,sourceRevision:receipt.sourceRevision,observedAt:receipt.observedAt,provenance:receipt.provenance,qualificationMethod:receipt.qualificationMethod};
  const expected=await issueQualificationMappingReceipt({mapping,evidence,authority},cryptoImpl);if(!expected.ok&&expected.ok!==undefined)return expected;
  if(stableStringify(expected)!==stableStringify(receipt))return fail('mapping_evidence_receipt_invalid');
  return deepFreeze({ok:true,receipt});
}

export function validateQualificationPlanItem(item){
  if(!item||!ENDPOINT_CLASSES.includes(item.endpointClass)||!API_FOOTBALL_ENDPOINTS.includes(item.endpoint))return fail('request_contract_invalid');
  if(item.endpointClass==='fixtures_discovery'){
    const built=buildApiFootballDiscoveryRequest({parameters:item.search});
    if(!built.ok)return built;
    if(item.endpoint!=='fixtures')return fail('endpoint_class_mismatch');
    return deepFreeze({ok:true,url:built.url,search:built.search});
  }
  const parameter=KNOWN_ID_PARAMETER[item.endpoint];
  const entries=Object.entries(item.search||{});
  if(item.endpointClass!=={fixtures:'fixture','fixtures/lineups':'lineups','fixtures/players':'players','fixtures/events':'events'}[item.endpoint])return fail('endpoint_class_mismatch');
  if(entries.length!==1||entries[0][0]!==parameter||!positiveId(entries[0][1]))return fail('parameters_invalid');
  const pinned=buildPinnedApiFootballUrl(item.endpoint,{[parameter]:String(entries[0][1])});
  if(!pinned.ok)return pinned;
  return deepFreeze({ok:true,url:String(pinned.url),search:{[parameter]:String(entries[0][1])}});
}

export function resolveAttendedCredential(apiKey){
  if(typeof apiKey!=='string'||!apiKey.length)return fail('credential_unavailable');
  const init=apiFootballRequestInit(apiKey);if(!init.ok)return init;
  return deepFreeze({ok:true,available:true});
}

function headerMap(headers){
  if(!headers)return {};
  if(typeof headers.get==='function'){
    const names=typeof headers.keys==='function'?[...headers.keys()]:['content-length','x-ratelimit-requests-limit','x-ratelimit-requests-remaining','x-ratelimit-limit','x-ratelimit-remaining'];
    return Object.fromEntries(names.map(name=>[String(name).toLowerCase(),headers.get(name)]).filter(([,value])=>value!=null&&value!==''));
  }
  return Object.fromEntries(Object.entries(headers).filter(([,value])=>typeof value!=='function'&&value!=null&&value!=='').map(([key,value])=>[String(key).toLowerCase(),String(value)]));
}

function extractProviderTeamIds(endpoint,rows){
  const ids=new Set();
  for(const row of rows||[]){
    if(endpoint==='fixtures'){
      const home=positiveId(row?.teams?.home?.id),away=positiveId(row?.teams?.away?.id);
      if(home)ids.add(home);if(away)ids.add(away);
    }else{
      const id=positiveId(row?.team?.id);if(id)ids.add(id);
    }
  }
  return [...ids].sort((a,b)=>Number(a)-Number(b));
}

function extractFixtureIds(rows){
  return [...new Set((rows||[]).map(row=>positiveId(row?.fixture?.id)).filter(Boolean))];
}

export async function measureDiscardingBody(response,{logicalRequestId=null,requestIdentity:boundRequestIdentity=null,endpoint,endpointClass,competition=null,fixtureId=null,highWaterCandidate=false,now=()=>new Date().toISOString(),maxBytes=EIA_2I5E_MEASUREMENT_ABORT_BYTES}={}){
  const fetchedAt=iso(typeof now==='function'?now():now);if(!fetchedAt)return fail('timestamp_invalid');
  if(!API_FOOTBALL_ENDPOINTS.includes(endpoint)||!ENDPOINT_CLASSES.includes(endpointClass))return fail('request_contract_invalid');
  if(!Number.isInteger(maxBytes)||maxBytes<1)return fail('response_limit_unqualified');
  const status=Number(response?.status);
  const headers=headerMap(response?.headers);
  const declared=Number(headers['content-length']);
  const quota=normalizeApiFootballQuotaHeaders(response?.headers||headers);
  const base={
    logicalRequestId,requestIdentity:boundRequestIdentity,attempted:true,endpointClass,endpoint,competition,fixtureId:fixtureId?String(fixtureId):null,fetchedAt,
    httpClass:Number.isInteger(status)?(status===401||status===403?'auth':status===429?'quota':status>=200&&status<300?'2xx':status>=300&&status<400?'3xx':status>=400&&status<500?'4xx':status>=500?'5xx':'unknown'):'transport',
    status:Number.isInteger(status)?status:null,contentLengthHeader:Number.isFinite(declared)?declared:null,
    quota:quota.ok?{state:quota.state,requestsLimit:quota.requestsLimit,requestsRemaining:quota.requestsRemaining,rateLimit:quota.rateLimit,remaining:quota.remaining}:null
  };
  if(status===401||status===403)return deepFreeze({ok:false,reason:'provider_authentication_failed',...base,bodyRetained:false});
  if(status===429)return deepFreeze({ok:false,reason:'quota_exhausted',...base,bodyRetained:false});
  if(status>=300&&status<400)return deepFreeze({ok:false,reason:'redirect_rejected',...base,bodyRetained:false});
  if(!(status>=200&&status<300))return deepFreeze({ok:false,reason:'provider_unavailable',...base,bodyRetained:false});
  if(Number.isFinite(declared)&&declared>maxBytes)return deepFreeze({ok:false,reason:'provider_response_too_large',...base,actualBytes:null,bodyRetained:false});
  if(!response?.body?.getReader)return fail('provider_body_unreadable');
  const reader=response.body.getReader();const chunks=[];let size=0;
  while(true){
    const {done,value}=await reader.read();if(done)break;
    size+=value.byteLength;
    if(size>maxBytes){await reader.cancel();return deepFreeze({ok:false,reason:'provider_response_too_large',...base,actualBytes:size,bodyRetained:false});}
    chunks.push(value);
  }
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  let payload;try{payload=JSON.parse(new TextDecoder().decode(bytes));}catch{return deepFreeze({ok:false,reason:'provider_schema_invalid',...base,actualBytes:size,bodyRetained:false});}
  const decoded=decodeApiFootballResponse(payload,{endpoint});
  const paging=payload?.paging&&typeof payload.paging==='object'?{current:payload.paging.current??null,total:payload.paging.total??null}:null;
  const paginationPresent=Number(paging?.total)>1||Number(paging?.current)>1;
  const rowCount=Array.isArray(payload?.response)?payload.response.length:null;
  const providerTeamIds=decoded.ok?extractProviderTeamIds(endpoint,decoded.response):[];
  const providerFixtureIds=decoded.ok&&endpoint==='fixtures'?extractFixtureIds(decoded.response):[];
  payload=null;
  const measurement={
    ok:decoded.ok,reason:decoded.ok?null:decoded.reason,...base,actualBytes:size,rowCount,paging,paginationPresent,
    schemaMatched:decoded.ok===true,highWaterCandidate:highWaterCandidate===true,providerTeamIds,providerFixtureIds,
    bodyRetained:false
  };
  const blocked=secret(measurement);return blocked||deepFreeze(measurement);
}

export function recommendResponseByteCeiling(measurements,plan=eia2i5eRequestPlan()){
  if(EIA_2I5E_PRODUCTION_BYTE_CEILING!==null)return fail('production_byte_ceiling_already_set');
  if(!plan?.ok||!Array.isArray(plan.items)||plan.items.length!==11)return deepFreeze({ok:false,decision:'NO-GO',reason:'qualification_plan_invalid',observedMaximum:null,proposedCeiling:null,productionConstant:EIA_2I5E_PRODUCTION_BYTE_CEILING});
  const measurementsById=new Map();for(const row of measurements||[]){const id=String(row?.logicalRequestId||'');if(!measurementsById.has(id))measurementsById.set(id,[]);measurementsById.get(id).push(row);}
  const manifest=plan.items.map(item=>{
    const matches=measurementsById.get(item.id)||[];const row=matches.length===1?matches[0]:null;
    const identityMatches=row?.requestIdentity===requestIdentity(item);
    const succeeded=matches.length===1&&row?.attempted===true&&row?.ok===true&&row?.schemaMatched===true&&row?.quota?.state==='known'&&Number.isInteger(row?.actualBytes)&&row.actualBytes>=0&&row.paginationPresent!==true&&identityMatches;
    return {logicalRequestId:item.id,required:true,attempted:matches.some(value=>value?.attempted===true),succeeded,failed:matches.length>0&&!succeeded,skipped:matches.length===0,stoppedBySafety:matches.some(value=>value?.stoppedBySafety===true),identityMatches,duplicateMeasurements:matches.length>1};
  });
  const rows=(measurements||[]).filter(row=>manifest.some(state=>state.logicalRequestId===row?.logicalRequestId&&state.succeeded));
  if(manifest.some(row=>!row.succeeded))return deepFreeze({ok:false,decision:'NO-GO',reason:'required_sample_manifest_incomplete',requiredManifest:manifest,observedMaximum:rows.length?Math.max(...rows.map(row=>row.actualBytes)):null,proposedCeiling:null,productionConstant:EIA_2I5E_PRODUCTION_BYTE_CEILING});
  const byClass=new Map();
  for(const row of rows){
    const current=byClass.get(row.endpointClass)||[];
    current.push(row);
    byClass.set(row.endpointClass,current);
  }
  const missing=REQUIRED_CLASSES.filter(name=>!byClass.has(name));
  if(missing.length)return deepFreeze({ok:false,decision:'NO-GO',reason:'endpoint_class_coverage_incomplete',missingEndpointClasses:missing,observedMaximum:Math.max(...rows.map(row=>row.actualBytes)),proposedCeiling:null,productionConstant:EIA_2I5E_PRODUCTION_BYTE_CEILING});
  if(rows.some(row=>row.paginationPresent===true))return deepFreeze({ok:false,decision:'NO-GO',reason:'required_sample_pagination_unresolved',observedMaximum:Math.max(...rows.map(row=>row.actualBytes)),proposedCeiling:null,productionConstant:EIA_2I5E_PRODUCTION_BYTE_CEILING});
  const classMaxima=Object.fromEntries(REQUIRED_CLASSES.map(name=>[name,Math.max(...byClass.get(name).map(row=>row.actualBytes))]));
  const observedMaximum=Math.max(...Object.values(classMaxima));
  const playersHighWater=(byClass.get('players')||[]).some(row=>row.highWaterCandidate===true);
  const discoveryHighWater=(byClass.get('fixtures_discovery')||[]).some(row=>row.highWaterCandidate===true&&row.paginationPresent!==true);
  if(!playersHighWater||!discoveryHighWater)return deepFreeze({ok:false,decision:'NO-GO',reason:'high_water_sample_incomplete',classMaxima,observedMaximum,proposedCeiling:null,productionConstant:EIA_2I5E_PRODUCTION_BYTE_CEILING});
  const doubled=observedMaximum*EIA_2I5E_BYTE_CEILING_MULTIPLIER;
  if(doubled>EIA_2I5E_BYTE_CEILING_HARD_CAP_BYTES)return deepFreeze({ok:false,decision:'NO-GO',reason:'observed_maximum_too_large_to_bound',classMaxima,observedMaximum,proposedCeiling:null,productionConstant:EIA_2I5E_PRODUCTION_BYTE_CEILING});
  const proposedCeiling=Math.ceil(doubled/EIA_2I5E_BYTE_CEILING_QUANTUM_BYTES)*EIA_2I5E_BYTE_CEILING_QUANTUM_BYTES;
  return deepFreeze({
    ok:true,decision:'GO',reason:null,requiredManifest:manifest,classMaxima,observedMaximum,proposedCeiling,marginBytes:proposedCeiling-observedMaximum,
    multiplier:EIA_2I5E_BYTE_CEILING_MULTIPLIER,quantumBytes:EIA_2I5E_BYTE_CEILING_QUANTUM_BYTES,
    productionConstant:EIA_2I5E_PRODUCTION_BYTE_CEILING,implemented:false,
    rationale:'twice the observed valid maximum, rounded up to the next 64KiB, remaining below a 2MiB amplification cap',
    residualRisk:'a later fixture with unusually large player-stat rows, unexpected pagination, or a provider schema expansion could still exceed the sample'
  });
}

export async function confirmPreviouslyQualifiedTeamMappings(authority,cryptoImpl=globalThis.crypto){
  const clubs=currentSeasonOfficialFplTeamIdentities(API_FOOTBALL_FPL_SEASON,authority);
  if(!clubs.ok)return clubs;
  const byId=new Map((authority.teams||[]).map(row=>[String(row.id),row]));
  const mappings=[];
  const rejected=[];
  for(const row of PREVIOUSLY_QUALIFIED_PL_TEAMS){
    const team=byId.get(row.officialFplTeamId);
    const identity=officialFplTeamIdentity({season:API_FOOTBALL_FPL_SEASON,teamId:row.officialFplTeamId});
    const nameOk=team&&team.name===row.expectedName&&team.short_name===row.expectedShortName;
    const idOk=identity.ok&&identity.canonicalFplId===`${API_FOOTBALL_FPL_SEASON}:fpl:team:${row.officialFplTeamId}`&&clubs.identities.includes(identity.canonicalFplId);
    if(!nameOk||!idOk){
      rejected.push({...row,status:'CONFLICTED',qualificationStatus:'NOT_REUSED',conflict:'current_official_fpl_identity_mismatch'});
      continue;
    }
    const mapping={
      provider:'api-football',entityType:'team',providerEntityId:row.providerTeamId,canonicalFplId:identity.canonicalFplId,
      mappingRevision:'eia-2i4c-1636205',revision:1,status:'VERIFIED',season:API_FOOTBALL_FPL_SEASON,method:'manually_verified',
      provenance:row.provenance,club:row.club,evidenceDate:row.evidenceDate,evidenceType:row.evidenceType,evidenceSources:['EIA-2I4C','current-official-fpl-authority']
    };
    const valid=validateProviderMapping(mapping,{entityType:'team',season:API_FOOTBALL_FPL_SEASON});
    if(!valid.ok){rejected.push({...row,status:'CONFLICTED',qualificationStatus:'NOT_REUSED',conflict:valid.reason});continue;}
    const evidence={evidenceType:'trusted_eia_2i4c_fixture',stableEvidenceId:row.fixtureId,source:'EIA-2I4C',sourceRevision:'eia-2i4c-canonical-2026-09-15',observedAt:`${row.evidenceDate}T23:59:59.000Z`,provenance:row.provenance,qualificationMethod:'trusted_legacy_adapter'};
    const qualificationEvidenceReceipt=await issueQualificationMappingReceipt({mapping,evidence,authority},cryptoImpl);
    if(qualificationEvidenceReceipt.ok===false){rejected.push({...row,status:'CONFLICTED',qualificationStatus:'NOT_REUSED',conflict:qualificationEvidenceReceipt.reason});continue;}
    mappings.push({...mapping,qualificationEvidenceReceipt});
  }
  return deepFreeze({ok:rejected.length===0,mappings,rejected,authoritySeason:clubs.season,authorityFetchedAt:clubs.fetchedAt,authorityDigestPresent:typeof clubs.digest==='string'});
}

function mappingRow(club,providerTeamId,officialFplTeamId,status,evidence,conflict=null){
  return {
    club,apiFootballTeamId:providerTeamId,officialFplTeamId,canonicalFplId:officialFplTeamId?`${API_FOOTBALL_FPL_SEASON}:fpl:team:${officialFplTeamId}`:null,
    evidence,qualificationStatus:status,conflict,nameOnlyCertified:false
  };
}

export async function qualifyTwentyClubMapping({authority,mappings=[]}={},cryptoImpl=globalThis.crypto){
  const clubs=currentSeasonOfficialFplTeamIdentities(API_FOOTBALL_FPL_SEASON,authority);
  if(!clubs.ok)return deepFreeze({ok:false,decision:'NO-GO',reason:clubs.reason,completeTwentyClubCoverage:false,verifiedPremierLeagueTeamCount:0,table:[],nameOnlyCertified:false});
  for(const row of mappings){
    if(row?.method&&!['provider_id_crosswalk','manually_verified'].includes(row.method))return deepFreeze({ok:false,decision:'NO-GO',reason:'name_only_mapping_forbidden',completeTwentyClubCoverage:false,verifiedPremierLeagueTeamCount:0,table:[],nameOnlyCertified:false});
  }
  const admitted=[];const receiptFailures=[];
  for(const row of mappings){const receipt=await validateQualificationMappingReceipt(row,row?.qualificationEvidenceReceipt,authority,cryptoImpl);if(receipt.ok)admitted.push(row);else receiptFailures.push({providerEntityId:String(row?.providerEntityId||''),reason:receipt.reason});}
  const coverage=mappingCoverage(admitted,API_FOOTBALL_FPL_SEASON,{officialFplAuthority:authority});
  const verified=new Map();
  for(const row of admitted){
    const valid=validateProviderMapping(row,{entityType:'team',season:API_FOOTBALL_FPL_SEASON});
    if(!valid.ok)continue;
    verified.set(valid.canonicalFplId,{providerTeamId:String(row.providerEntityId),club:row.club||null,provenance:row.provenance||null,evidenceDate:row.evidenceDate||null,evidenceType:row.evidenceType||null,evidenceSources:row.evidenceSources||[]});
  }
  const table=(authority.teams||[]).map(team=>{
    const canonical=`${API_FOOTBALL_FPL_SEASON}:fpl:team:${team.id}`;
    const hit=verified.get(canonical);
    if(!hit)return mappingRow(team.name,null,String(team.id),'UNMAPPED','current Official FPL authority only; no verified API-Football provider ID','missing_provider_mapping');
    return mappingRow(team.name,hit.providerTeamId,String(team.id),'VERIFIED',hit.provenance,null);
  });
  const decision=coverage.completeTwentyClubCoverage===true&&table.length===20&&table.every(row=>row.qualificationStatus==='VERIFIED')?'GO':'NO-GO';
  const result={
    ok:decision==='GO',decision,reason:decision==='GO'?null:(coverage.limitation||'current_season_pl_team_mapping_incomplete'),
    completeTwentyClubCoverage:coverage.completeTwentyClubCoverage===true,verifiedPremierLeagueTeamCount:coverage.verifiedPremierLeagueTeamCount,
    table,unresolved:table.filter(row=>row.qualificationStatus!=='VERIFIED'),nameOnlyCertified:false,
    season:clubs.season,fetchedAt:clubs.fetchedAt,receiptFailures
  };
  const blocked=secret(result);return blocked||deepFreeze(result);
}

export function sanitizeOfficialFplAuthority(authority){
  if(!authority?.ok)return authority;
  return deepFreeze({
    ok:true,kind:authority.kind,sourceKey:authority.sourceKey,sourceKind:authority.sourceKind,
    sourceRevisionId:authority.sourceRevisionId,schemaVersion:authority.schemaVersion,validationVersion:authority.validationVersion,
    transformVersion:authority.transformVersion,season:authority.season,fetchedAt:authority.fetchedAt,identities:authority.identities,
    teams:authority.teams,counts:authority.counts
  });
}

export async function fetchOfficialFplAuthority({fetchImpl,now=()=>new Date().toISOString(),timeoutSignal=AbortSignal.timeout}={}){
  if(typeof fetchImpl!=='function'||typeof timeoutSignal!=='function')return fail('provider_disabled_configuration_invalid');
  const fetchedAt=iso(typeof now==='function'?now():now);if(!fetchedAt)return fail('timestamp_invalid');
  const get=async url=>{
    let signal;try{signal=timeoutSignal(API_FOOTBALL_REQUEST_TIMEOUT_MS);}catch{return fail('provider_disabled_configuration_invalid');}
    const response=await fetchImpl(url,{method:'GET',redirect:'error',headers:Object.freeze({accept:'application/json'}),signal});
    const status=Number(response?.status);
    if(status>=300&&status<400)return fail('official_fpl_redirect_rejected');
    if(!(status>=200&&status<300))return fail('official_fpl_http_failed');
    try{return {ok:true,payload:await response.json()};}catch{return fail('official_fpl_json_invalid');}
  };
  const bootstrap=await get(OFFICIAL_FPL_BOOTSTRAP_URL);if(!bootstrap.ok)return bootstrap;
  const fixtures=await get(OFFICIAL_FPL_FIXTURES_URL);if(!fixtures.ok)return fixtures;
  const issued=issueOfficialFplTeamUniverseAuthority({bootstrap:bootstrap.payload,fixtures:fixtures.payload,season:API_FOOTBALL_FPL_SEASON,fetchedAt});
  bootstrap.payload=null;fixtures.payload=null;
  if(!issued.ok)return issued;
  const clubs=currentSeasonOfficialFplTeamIdentities(API_FOOTBALL_FPL_SEASON,issued);
  if(!clubs.ok)return clubs;
  return issued;
}

export async function runAttendedApiFootballQualification({apiKey,fetchImpl,sleep,now=()=>new Date().toISOString(),timeoutSignal=AbortSignal.timeout,plan=eia2i5eRequestPlan()}={}){
  if(EIA_2I5E_MAX_ATTEMPTS>=API_FOOTBALL_DAILY_REQUEST_LIMIT)return fail('attempt_budget_unsafe');
  const credential=resolveAttendedCredential(apiKey);
  const empty={
    ok:false,checkpoint:EIA_2I5E_CHECKPOINT,attempts:0,measurements:[],stoppedReason:credential.ok?null:credential.reason,
    responseLimit:recommendResponseByteCeiling([]),mapping:null,productionByteCeiling:EIA_2I5E_PRODUCTION_BYTE_CEILING,implementedCeiling:false
  };
  if(!credential.ok)return deepFreeze({...empty,reason:credential.reason});
  if(typeof fetchImpl!=='function'||typeof sleep!=='function'||typeof timeoutSignal!=='function'||!plan?.ok)return fail('provider_disabled_configuration_invalid');
  const init=apiFootballRequestInit(apiKey);if(!init.ok)return init;
  const measurements=[];
  let attempts=0,stoppedReason=null;
  for(const item of plan.items){
    if(attempts>=EIA_2I5E_MAX_ATTEMPTS){stoppedReason='attempt_budget_exhausted';break;}
    const valid=validateQualificationPlanItem(item);if(!valid.ok)return valid;
    if(attempts>0)await sleep(EIA_2I5E_MIN_GAP_MS);
    attempts+=1;
    const pinned=buildPinnedApiFootballUrl(item.endpoint,item.search);
    if(!pinned.ok)return pinned;
    const sent=await sendApiFootballRequest({fetchImpl,url:pinned.url,init:init.init,timeoutSignal});
    if(!sent.ok){
      measurements.push(deepFreeze({ok:false,reason:sent.reason,logicalRequestId:item.id,requestIdentity:requestIdentity(item),attempted:true,stoppedBySafety:sent.reason!=='provider_timeout',endpointClass:item.endpointClass,endpoint:item.endpoint,httpClass:sent.reason==='provider_timeout'?'timeout':'transport',actualBytes:null,bodyRetained:false,fetchedAt:iso(typeof now==='function'?now():now)}));
      if(sent.reason==='provider_timeout')continue;
      stoppedReason=sent.reason;break;
    }
    const measured=await measureDiscardingBody(sent.response,{
      logicalRequestId:item.id,requestIdentity:requestIdentity(item),endpoint:item.endpoint,endpointClass:item.endpointClass,competition:item.competition,
      fixtureId:item.search.id||item.search.fixture||null,highWaterCandidate:item.highWaterCandidate===true,now
    });
    measurements.push(measured);
    if(measured.reason==='provider_authentication_failed'||measured.reason==='quota_exhausted'){stoppedReason=measured.reason;break;}
    if(measured.ok&&(!measured.quota||measured.quota.state!=='known')){stoppedReason='quota_headers_uncertain';break;}
  }
  const responseLimit=recommendResponseByteCeiling(measurements,plan);
  const result={
    ok:stoppedReason==null,checkpoint:EIA_2I5E_CHECKPOINT,attempts,measurements,stoppedReason,responseLimit,
    productionByteCeiling:EIA_2I5E_PRODUCTION_BYTE_CEILING,implementedCeiling:false,origin:API_FOOTBALL_ORIGIN
  };
  const blocked=secret(result);if(blocked)return blocked;
  if(JSON.stringify(result).includes(apiKey)||eia1SecretFinding(result))return fail('secret_material');
  return deepFreeze(result);
}

export function eia2i5eActivationBlocks(){
  return deepFreeze({
    collectorDeployed:false,migration0005Live:false,credentialProvisioned:false,cronActive:false,
    collectionEnabled:false,providerShadowRuntimeLiveAccepted:false,modelOrUiInfluence:false,
    productionByteCeiling:EIA_2I5E_PRODUCTION_BYTE_CEILING,responseLimitUnqualified:EIA_2I5E_PRODUCTION_BYTE_CEILING===null
  });
}
