const ARCHIVE_VERSION='1.0.0';
const SNAPSHOT_SCHEMA_VERSION='1.0.0';
const DEFAULT_ALLOWED_ORIGINS=Object.freeze(['https://priteshpatel390-del.github.io']);
const APPROVED_PROVIDER_NAMES=Object.freeze(['fpl','understat','odds','archive']);
const HEALTH_STATES=Object.freeze(['Live','Cached','Stale','Fallback','Partial','Disabled','Unavailable']);
const R2_PREFIX='evidence/v1/preDeadlineSnapshot/';
const MAX_REQUEST_BYTES=25*1024*1024;
const DEFAULT_RATE_LIMIT=30;
const CLOCK_TOLERANCE_SECONDS=30;
const EVIDENCE_RULES=Object.freeze({captureWindowMs:24*60*60*1000,safetyCutoffMs:2*60*1000,maxClockSkewMs:60*1000});
const FORBIDDEN_KEY=/^(?:api[-_]?key|odds[-_]?key|claude[-_]?key|anthropic[-_]?key|authorization|password|secret|access[-_]?token|refresh[-_]?token|token|team[-_]?id|entry(?:[-_]?id)?|league[-_]?id|manager[-_]?name|email|phone)$/i;
const RESTRICTED_SECRET_PREFIX=['sk','ant'].join('-')+'-';
const FORBIDDEN_VALUE=/(?:api[_-]?key\s*[:=]|authorization\s*[:=]\s*bearer)/i;
let jwksCache=null;

function canonicalise(value){
  if(value===null||typeof value==='string'||typeof value==='boolean') return value;
  if(typeof value==='number'){
    if(!Number.isFinite(value)) throw new Error('Evidence records cannot contain non-finite numbers');
    return Object.is(value,-0)?0:value;
  }
  if(Array.isArray(value)) return value.map(canonicalise);
  if(typeof value==='object'){
    const out={};
    Object.keys(value).sort().forEach(key=>{
      if(['__proto__','prototype','constructor'].includes(key)) throw new Error(`Evidence records cannot contain unsafe object key: ${key}`);
      if(value[key]!==undefined) out[key]=canonicalise(value[key]);
    });
    return out;
  }
  throw new Error('Evidence records contain an unsupported value');
}
function stableStringify(value){return JSON.stringify(canonicalise(value));}
function bytesToHex(bytes){return Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');}
async function sha256BytesHex(value,cryptoImpl=globalThis.crypto){
  if(!cryptoImpl?.subtle) throw new Error('SHA-256 is unavailable');
  const bytes=value instanceof Uint8Array?value:new Uint8Array(value);
  return bytesToHex(await cryptoImpl.subtle.digest('SHA-256',bytes));
}
async function sha256Hex(text,cryptoImpl=globalThis.crypto){return sha256BytesHex(new TextEncoder().encode(String(text)),cryptoImpl);}
function findForbiddenEvidence(value,path='$',findings=[]){
  if(value===null||value===undefined) return findings;
  if(typeof value==='string'){
    if(value.includes(RESTRICTED_SECRET_PREFIX)||FORBIDDEN_VALUE.test(value)) findings.push(`${path}:secret_value`);
    return findings;
  }
  if(Array.isArray(value)){value.forEach((entry,index)=>findForbiddenEvidence(entry,`${path}[${index}]`,findings));return findings;}
  if(typeof value==='object') Object.entries(value).forEach(([key,entry])=>{
    if(FORBIDDEN_KEY.test(key)) findings.push(`${path}.${key}:secret_key`);
    findForbiddenEvidence(entry,`${path}.${key}`,findings);
  });
  return findings;
}
function assertEvidenceSafe(value){
  const findings=findForbiddenEvidence(value);
  if(findings.length) throw new Error(`Evidence safety check failed: ${findings.join(', ')}`);
  return true;
}
function iso(value){
  const ms=value instanceof Date?value.getTime():Date.parse(value);
  return Number.isFinite(ms)?new Date(ms).toISOString():null;
}
function clockSampleUsable(sample){return sample?.status==='available'&&Number.isFinite(Number(sample.serverAt))&&Number.isFinite(Number(sample.skewMs));}
function assessDeadlineTiming({deadlineTime,captureStartedAt,captureCompletedAt,networkBefore,networkAfter,providers=[],complete=false}={}){
  const deadlineMs=Date.parse(deadlineTime),startedMs=Number(captureStartedAt),completedMs=Number(captureCompletedAt);
  if(!Number.isFinite(deadlineMs)||!Number.isFinite(startedMs)||!Number.isFinite(completedMs)) throw new Error('Deadline timing inputs are invalid');
  const cutoffMs=deadlineMs-EVIDENCE_RULES.safetyCutoffMs;
  const beforeUsable=clockSampleUsable(networkBefore),afterUsable=clockSampleUsable(networkAfter);
  const skewConflict=(beforeUsable&&Math.abs(networkBefore.skewMs)>EVIDENCE_RULES.maxClockSkewMs)||(afterUsable&&Math.abs(networkAfter.skewMs)>EVIDENCE_RULES.maxClockSkewMs);
  const referenceCompletedAt=afterUsable?Number(networkAfter.serverAt):completedMs;
  const includedProviders=(providers||[]).filter(row=>row.included);
  const lateProvider=includedProviders.find(row=>{const at=Date.parse(row.recordedAt);return !Number.isFinite(at)||at>=cutoffMs;});
  const reasons=[];
  if(referenceCompletedAt>deadlineMs) reasons.push('after_deadline');
  if(referenceCompletedAt>=cutoffMs) reasons.push('inside_safety_cutoff');
  if(deadlineMs-referenceCompletedAt>EVIDENCE_RULES.captureWindowMs) reasons.push('outside_capture_window');
  if(!complete) reasons.push('snapshot_incomplete');
  if(lateProvider) reasons.push(`provider_after_cutoff:${lateProvider.provider}`);
  if(!beforeUsable||!afterUsable) reasons.push('network_time_unavailable');
  if(skewConflict) reasons.push('clock_conflict');
  let grade='network_attested';
  if(referenceCompletedAt>=cutoffMs) grade='late';
  else if(skewConflict) grade='clock_conflict';
  else if(!beforeUsable||!afterUsable) grade='client_recorded';
  const officialEligible=grade==='network_attested'&&reasons.length===0;
  return canonicalise({
    grade,officialEligible,reasons,deadlineTime:new Date(deadlineMs).toISOString(),safetyCutoffTime:new Date(cutoffMs).toISOString(),
    captureStartedAt:new Date(startedMs).toISOString(),captureCompletedAt:new Date(completedMs).toISOString(),
    networkBefore:networkBefore||{status:'unavailable'},networkAfter:networkAfter||{status:'unavailable'},
    referenceCompletedAt:new Date(referenceCompletedAt).toISOString(),includedProviderCount:includedProviders.length,
    allIncludedProvidersBeforeCutoff:!lateProvider,
    withinCaptureWindow:deadlineMs-referenceCompletedAt<=EVIDENCE_RULES.captureWindowMs&&referenceCompletedAt<deadlineMs,
    beforeSafetyCutoff:referenceCompletedAt<cutoffMs
  });
}
function providerTrustError(rows){
  if(!Array.isArray(rows)) return 'provider_schema';
  const seen=new Set();
  for(const row of rows){
    const name=row?.provider;
    if(!APPROVED_PROVIDER_NAMES.includes(name)) return 'provider_unapproved';
    if(seen.has(name)) return 'provider_duplicate';
    seen.add(name);
    if(!HEALTH_STATES.includes(row?.state)) return 'provider_state';
    if(typeof row?.included!=='boolean'||typeof row?.didAffectModel!=='boolean'||row.didAffectModel!==row.included) return 'provider_usage';
    if(!Number.isInteger(row?.acceptedRecordCount)||row.acceptedRecordCount<0||!Number.isInteger(row?.rejectedRecordCount)||row.rejectedRecordCount<0) return 'provider_counts';
    for(const key of ['recordedAt','lastSuccessAt']) if(row?.[key]!==null&&!Number.isFinite(Date.parse(row?.[key]))) return 'provider_time';
  }
  if(seen.size!==APPROVED_PROVIDER_NAMES.length||APPROVED_PROVIDER_NAMES.some(name=>!seen.has(name))) return 'provider_missing';
  return null;
}
async function computeSectionHashes(payload,cryptoImpl=globalThis.crypto){
  const players=payload.outputs?.players||[];
  const sections={
    modelInputs:payload.modelInputs||null,
    playerProjections:players.map(row=>({playerId:row.playerId,nextGameweek:row.nextGameweek,perGameweek:row.perGameweek,aggregate:row.aggregate,sourceUsage:row.sourceUsage})),
    minutes:players.map(row=>({playerId:row.playerId,minutes:row.minutes})),
    uncertainty:players.map(row=>({playerId:row.playerId,uncertainty:row.uncertainty})),
    decisions:payload.outputs?.squad||null,
    providers:payload.providers||[],
    fplInputs:{events:payload.modelInputs?.events||[],teams:payload.modelInputs?.teams||[],players:payload.modelInputs?.players||[],fixtures:payload.modelInputs?.fixtures||[],minuteHistory:payload.modelInputs?.minuteHistory||{}},
    understatInputs:payload.modelInputs?.understat??null,
    oddsInputs:payload.modelInputs?.odds??null,
    archiveInputs:payload.modelInputs?.calibration??null,
    ruleConfiguration:payload.rules||null
  };
  return canonicalise(Object.fromEntries(await Promise.all(Object.entries(sections).map(async([name,value])=>[name,await sha256Hex(stableStringify(value),cryptoImpl)]))));
}
function recordHashMaterial(record){
  const copy=canonicalise(record);
  if(copy.identity){delete copy.identity.contentHash;delete copy.identity.snapshotId;}
  return copy;
}
function recordShapeError(record){
  const required=['build','capture','completeness','deadlineTime','gameweek','identity','issues','managerRef','metricVersion','modelInputs','outputs','providers','quality','recordType','retries','rules','schemaVersion','season','segmentationVersion','timing','versions'];
  if(stableStringify(Object.keys(record||{}).sort())!==stableStringify(required.slice().sort())) return 'top_level_schema';
  if(!/^mgr-[0-9a-f]{32}$/.test(record.managerRef||'')) return 'manager_ref';
  if(!/^\d{4}-\d{2}$/.test(record.season||'')) return 'season';
  if(!Number.isInteger(record.gameweek)||record.gameweek<1||record.gameweek>38) return 'gameweek';
  if(!iso(record.deadlineTime)) return 'deadline';
  if(!record.build||typeof record.build!=='object'||typeof record.build.sourceHash!=='string'||!record.build.sourceHash) return 'build_identity';
  if(!record.versions||typeof record.versions!=='object'||!['model','rules','simulation'].every(key=>typeof record.versions[key]==='string'&&record.versions[key])) return 'build_identity';
  if(!Array.isArray(record.providers)||!Array.isArray(record.retries)||!Array.isArray(record.issues)) return 'provider_schema';
  const providerError=providerTrustError(record.providers);if(providerError)return providerError;
  if(!record.modelInputs||typeof record.modelInputs!=='object'||!record.outputs||typeof record.outputs!=='object'||!Array.isArray(record.outputs.players)) return 'payload_schema';
  if(!record.completeness||typeof record.completeness.complete!=='boolean') return 'completeness_schema';
  if(!record.timing||!['network_attested','client_recorded','clock_conflict','late'].includes(record.timing.grade)||typeof record.timing.officialEligible!=='boolean'||!Array.isArray(record.timing.reasons)) return 'timing_schema';
  if(!record.identity||!/^predeadline-gw\d+-[0-9a-f]{16}$/.test(record.identity.snapshotId||'')||!/^[0-9a-f]{64}$/.test(record.identity.contentHash||'')) return 'identity_schema';
  if(!record.identity.sectionHashes||typeof record.identity.sectionHashes!=='object'||!record.identity.ruleHashes||typeof record.identity.ruleHashes!=='object') return 'identity_schema';
  return null;
}
async function validateSnapshotRecord(record,cryptoImpl=globalThis.crypto){
  try{
    if(!record||record.recordType!=='preDeadlineSnapshot') return {ok:false,reason:'record_type'};
    if(record.schemaVersion!==SNAPSHOT_SCHEMA_VERSION) return {ok:false,reason:'schema_version'};
    const shapeError=recordShapeError(record);if(shapeError)return {ok:false,reason:shapeError};
    assertEvidenceSafe(record);
    const sectionHashes=await computeSectionHashes(record,cryptoImpl);
    if(stableStringify(sectionHashes)!==stableStringify(record.identity.sectionHashes)) return {ok:false,reason:'section_hash'};
    if(record.identity.ruleHashes.configuration!==sectionHashes.ruleConfiguration) return {ok:false,reason:'rule_hash'};
    const expectedDuplicateKey=[record.season,`gw${record.gameweek}`,record.deadlineTime,record.build.sourceHash||'unknown',record.versions.model,record.versions.rules].join('|');
    if(record.identity.duplicateKey!==expectedDuplicateKey) return {ok:false,reason:'duplicate_key'};
    const expectedTiming=assessDeadlineTiming({deadlineTime:record.deadlineTime,captureStartedAt:Date.parse(record.timing.captureStartedAt),captureCompletedAt:Date.parse(record.timing.captureCompletedAt),networkBefore:record.timing.networkBefore,networkAfter:record.timing.networkAfter,providers:record.providers,complete:record.completeness.complete});
    if(stableStringify(expectedTiming)!==stableStringify(record.timing)) return {ok:false,reason:'timing_evidence'};
    const expected=await sha256Hex(stableStringify(recordHashMaterial(record)),cryptoImpl);
    if(expected!==record.identity.contentHash) return {ok:false,reason:'content_hash'};
    if(record.identity.snapshotId!==`predeadline-gw${record.gameweek}-${expected.slice(0,16)}`) return {ok:false,reason:'snapshot_id'};
    return {ok:true,record:canonicalise(record)};
  }catch(error){return {ok:false,reason:'invalid_record'};}
}
function booleanEnv(value){return /^(?:1|true|yes|on)$/i.test(String(value||''));}
function providerWasIncluded(record,name){return Boolean(record.providers?.find(row=>row?.provider===name)?.included);}
function hasRetainedProviderData(record,name){
  const value=record.modelInputs?.[name];
  if(value===null||value===undefined) return false;
  if(Array.isArray(value)) return value.length>0;
  if(typeof value==='object') return Object.keys(value).length>0;
  return true;
}
function providerRetentionRequired(record,name){return providerWasIncluded(record,name)||hasRetainedProviderData(record,name);}
function retentionPolicyError(record,env={}){
  if(providerRetentionRequired(record,'understat')&&!booleanEnv(env.ALLOW_UNDERSTAT_RETENTION)) return 'understat_retention_not_approved';
  if(providerRetentionRequired(record,'odds')&&!booleanEnv(env.ALLOW_ODDS_RETENTION)) return 'odds_retention_not_approved';
  return null;
}
function validateEnvelope(value){
  if(!value||typeof value!=='object'||Array.isArray(value)) return {ok:false,reason:'envelope_schema'};
  const exact=['archiveVersion','enqueuedAt','idempotencyKey','origin','record'].sort();
  if(stableStringify(Object.keys(value).sort())!==stableStringify(exact)) return {ok:false,reason:'envelope_schema'};
  if(value.archiveVersion!==ARCHIVE_VERSION) return {ok:false,reason:'archive_version'};
  if(value.origin!=='local_capture') return {ok:false,reason:'origin_not_allowed'};
  if(typeof value.idempotencyKey!=='string'||!/^[A-Za-z0-9._:-]{16,128}$/.test(value.idempotencyKey)) return {ok:false,reason:'idempotency_key'};
  if(!iso(value.enqueuedAt)) return {ok:false,reason:'enqueued_at'};
  return {ok:true,envelope:canonicalise(value)};
}
async function gzipText(text){
  const stream=new Blob([String(text)]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function gunzipBytes(bytes){
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}
function r2KeyFor(record){return `${R2_PREFIX}${record.season}/gw${record.gameweek}/${record.identity.contentHash}.json.gz`;}
function safeErrorDiagnostic(error){
  const clean=(value,limit)=>String(value||'').replace(/(?:sk|ant)-[A-Za-z0-9_-]{8,}/gi,'[redacted]').replace(/https?:\/\/\S+/gi,'[url]').replace(/\d+/g,'[number]').replace(/[\r\n\t]+/g,' ').slice(0,limit);
  return {name:clean(error?.name||'Error',40),code:clean(error?.code||error?.cause?.code||'',60),message:clean(error?.message||'No message',180)};
}
function allowedOrigins(env={}){
  const values=new Set(DEFAULT_ALLOWED_ORIGINS);
  for(const origin of String(env.ALLOWED_ORIGINS||'').split(',')){
    const value=origin.trim();if(!value)continue;
    try{const parsed=new URL(value);if(parsed.origin===value&&['https:','http:'].includes(parsed.protocol))values.add(value);}catch(error){}
  }
  return values;
}
function corsHeaders(origin){
  const headers=new Headers({'Vary':'Origin','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store'});
  if(origin){headers.set('Access-Control-Allow-Origin',origin);headers.set('Access-Control-Expose-Headers','X-Teamsheet-Content-Hash');}
  return headers;
}
function jsonResponse(body,status=200,origin=null,extra={}){
  const headers=corsHeaders(origin);headers.set('Content-Type','application/json; charset=utf-8');
  Object.entries(extra).forEach(([key,value])=>headers.set(key,String(value)));
  return new Response(JSON.stringify(body),{status,headers});
}
function base64UrlBytes(value){
  const base64=String(value).replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(String(value).length/4)*4,'=');
  const binary=atob(base64),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;
}
function parseJwtPart(value){return JSON.parse(new TextDecoder().decode(base64UrlBytes(value)));}
function accessConfig(env={}){
  const rawDomain=String(env.TEAM_DOMAIN||'').replace(/\/$/,'');
  const audience=String(env.POLICY_AUD||'');
  if(!rawDomain||!audience) throw Object.assign(new Error('Access authentication is not configured'),{code:'auth_not_configured'});
  let url;try{url=new URL(rawDomain);}catch(error){throw Object.assign(new Error('Access team domain is invalid'),{code:'auth_not_configured'});}
  if(url.protocol!=='https:'||url.origin!==rawDomain||!url.hostname.endsWith('.cloudflareaccess.com')) throw Object.assign(new Error('Access team domain is invalid'),{code:'auth_not_configured'});
  return {teamDomain:rawDomain,audience};
}
async function loadAccessJwks(teamDomain,{fetchFn=globalThis.fetch,nowFn=Date.now}={}){
  const now=nowFn();
  if(jwksCache?.teamDomain===teamDomain&&jwksCache.expiresAt>now) return jwksCache.keys;
  const response=await fetchFn(`${teamDomain}/cdn-cgi/access/certs`,{headers:{Accept:'application/json'},redirect:'error'});
  if(!response?.ok) throw Object.assign(new Error('Access signing keys are unavailable'),{code:'auth_keys_unavailable'});
  const body=await response.json();
  if(!Array.isArray(body?.keys)||!body.keys.length) throw Object.assign(new Error('Access signing keys are invalid'),{code:'auth_keys_unavailable'});
  jwksCache={teamDomain,expiresAt:now+5*60*1000,keys:body.keys};
  return body.keys;
}
function publicRsaJwk(jwk){
  if(typeof jwk?.n!=='string'||!jwk.n||typeof jwk?.e!=='string'||!jwk.e) throw new Error('invalid RSA JWK');
  return {kty:'RSA',n:jwk.n,e:jwk.e,alg:'RS256',ext:true,key_ops:['verify']};
}
async function verifyAccessJwt(token,env={},deps={}){
  const {teamDomain,audience}=accessConfig(env),cryptoImpl=deps.cryptoImpl||globalThis.crypto,nowFn=deps.nowFn||Date.now;
  if(typeof token!=='string'||token.length<32||token.length>16384) throw Object.assign(new Error('Access token is missing or invalid'),{code:'unauthorised'});
  const parts=token.split('.');if(parts.length!==3) throw Object.assign(new Error('Access token is malformed'),{code:'unauthorised'});
  let header,payload;try{header=parseJwtPart(parts[0]);payload=parseJwtPart(parts[1]);}catch(error){throw Object.assign(new Error('Access token is malformed'),{code:'unauthorised'});}
  if(header?.alg!=='RS256'||typeof header?.kid!=='string'||!header.kid) throw Object.assign(new Error('Access token algorithm is invalid'),{code:'unauthorised'});
  const keys=await loadAccessJwks(teamDomain,{fetchFn:deps.fetchFn||globalThis.fetch,nowFn});
  const jwk=keys.find(candidate=>candidate?.kid===header.kid&&candidate?.kty==='RSA'&&(!candidate.alg||candidate.alg==='RS256')&&(!candidate.use||candidate.use==='sig'));
  if(!jwk) throw Object.assign(new Error('Access signing key was not found'),{code:'unauthorised'});
  let key;try{key=await cryptoImpl.subtle.importKey('jwk',publicRsaJwk(jwk),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);}catch(error){throw Object.assign(new Error('Access signing key is invalid'),{code:'unauthorised'});}
  const verified=await cryptoImpl.subtle.verify({name:'RSASSA-PKCS1-v1_5'},key,base64UrlBytes(parts[2]),new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if(!verified) throw Object.assign(new Error('Access token signature is invalid'),{code:'unauthorised'});
  const now=Math.floor(nowFn()/1000),aud=Array.isArray(payload.aud)?payload.aud:[payload.aud];
  if(payload.iss!==teamDomain||!aud.includes(audience)||typeof payload.sub!=='string'||!payload.sub) throw Object.assign(new Error('Access token claims are invalid'),{code:'unauthorised'});
  if(!Number.isFinite(Number(payload.exp))||Number(payload.exp)<now-CLOCK_TOLERANCE_SECONDS) throw Object.assign(new Error('Access token is expired'),{code:'unauthorised'});
  if(payload.nbf!=null&&Number(payload.nbf)>now+CLOCK_TOLERANCE_SECONDS) throw Object.assign(new Error('Access token is not active'),{code:'unauthorised'});
  return {sub:payload.sub};
}
async function authenticateRequest(request,env,deps={}){
  if(deps.authVerifier) return deps.authVerifier(request,env,deps);
  return verifyAccessJwt(request.headers.get('Cf-Access-Jwt-Assertion'),env,deps);
}
function maxRequestBytes(env={}){
  const configured=Number(env.MAX_REQUEST_BYTES);return Number.isFinite(configured)?Math.max(1024,Math.min(MAX_REQUEST_BYTES,Math.trunc(configured))):MAX_REQUEST_BYTES;
}
function rateLimit(env={}){
  const configured=Number(env.MAX_REQUESTS_PER_MINUTE);return Number.isFinite(configured)?Math.max(1,Math.min(300,Math.trunc(configured))):DEFAULT_RATE_LIMIT;
}
async function consumeRateLimit(db,subjectHash,nowMs,limit){
  const windowStart=Math.floor(nowMs/60000)*60000;
  const row=await db.prepare(`INSERT INTO rate_limit_windows(subject_hash,window_start,request_count) VALUES(?,?,1) ON CONFLICT(subject_hash,window_start) DO UPDATE SET request_count=request_count+1 RETURNING request_count`).bind(subjectHash,windowStart).first();
  return Number(row?.request_count||0)<=limit;
}
async function findReceipt(db,idempotencyKey){return db.prepare(`SELECT idempotency_key,content_hash,received_at,result FROM ingest_receipts WHERE idempotency_key=?`).bind(idempotencyKey).first();}
async function findManifest(db,contentHash){return db.prepare(`SELECT content_hash,record_type,stage10_record_id,schema_version,season,gameweek,logical_key,deadline_time,capture_completed_at,origin,timing_grade,client_official_eligible,server_predeadline_received,build_commit,build_source_hash,model_version,rules_version,simulation_version,r2_key,r2_uploaded_at,canonical_bytes,stored_bytes,stored_sha256,created_at FROM evidence_records WHERE content_hash=?`).bind(contentHash).first();}
function manifestFor(record,{origin,r2Key,r2UploadedAt,canonicalBytes,storedBytes,storedSha256,nowIso}){
  const uploadMs=Date.parse(r2UploadedAt),cutoffMs=Date.parse(record.timing.safetyCutoffTime);
  return canonicalise({
    content_hash:record.identity.contentHash,record_type:record.recordType,stage10_record_id:record.identity.snapshotId,schema_version:record.schemaVersion,
    season:record.season,gameweek:record.gameweek,logical_key:record.identity.duplicateKey,deadline_time:record.deadlineTime,
    capture_completed_at:record.timing.captureCompletedAt,origin,timing_grade:record.timing.grade,client_official_eligible:record.timing.officialEligible?1:0,
    server_predeadline_received:record.timing.officialEligible&&Number.isFinite(uploadMs)&&Number.isFinite(cutoffMs)&&uploadMs<cutoffMs?1:0,
    build_commit:String(record.build?.commit||'unversioned'),build_source_hash:String(record.build?.sourceHash||'unknown'),model_version:String(record.versions?.model||''),
    rules_version:String(record.versions?.rules||''),simulation_version:String(record.versions?.simulation||''),r2_key:r2Key,r2_uploaded_at:r2UploadedAt,
    canonical_bytes:canonicalBytes,stored_bytes:storedBytes,stored_sha256:storedSha256,created_at:nowIso
  });
}
function insertEvidenceStatement(db,m){return db.prepare(`INSERT INTO evidence_records(content_hash,record_type,stage10_record_id,schema_version,season,gameweek,logical_key,deadline_time,capture_completed_at,origin,timing_grade,client_official_eligible,server_predeadline_received,build_commit,build_source_hash,model_version,rules_version,simulation_version,r2_key,r2_uploaded_at,canonical_bytes,stored_bytes,stored_sha256,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(content_hash) DO NOTHING`).bind(m.content_hash,m.record_type,m.stage10_record_id,m.schema_version,m.season,m.gameweek,m.logical_key,m.deadline_time,m.capture_completed_at,m.origin,m.timing_grade,m.client_official_eligible,m.server_predeadline_received,m.build_commit,m.build_source_hash,m.model_version,m.rules_version,m.simulation_version,m.r2_key,m.r2_uploaded_at,m.canonical_bytes,m.stored_bytes,m.stored_sha256,m.created_at);}
function insertReceiptStatement(db,{idempotencyKey,contentHash,receivedAt,result,subjectHash}){return db.prepare(`INSERT INTO ingest_receipts(idempotency_key,content_hash,received_at,result,subject_hash) VALUES(?,?,?,?,?)`).bind(idempotencyKey,contentHash,receivedAt,result,subjectHash);}
function manifestsEquivalent(a,b){return a&&b&&['content_hash','record_type','stage10_record_id','schema_version','season','gameweek','logical_key','deadline_time','capture_completed_at','origin','timing_grade','client_official_eligible','server_predeadline_received','build_commit','build_source_hash','model_version','rules_version','simulation_version','r2_key','r2_uploaded_at','canonical_bytes','stored_bytes','stored_sha256'].every(key=>String(a[key]??'')===String(b[key]??''));}
async function commitManifest(db,manifest,receipt){
  try{await db.batch([insertEvidenceStatement(db,manifest),insertReceiptStatement(db,receipt)]);}catch(error){
    const existingReceipt=await findReceipt(db,receipt.idempotencyKey).catch(()=>null);
    if(existingReceipt&&existingReceipt.content_hash===receipt.contentHash){
      const existingManifest=await findManifest(db,receipt.contentHash).catch(()=>null);
      if(manifestsEquivalent(existingManifest,manifest)) return {duplicate:true,manifest:existingManifest};
    }
    if(existingReceipt&&existingReceipt.content_hash!==receipt.contentHash) throw Object.assign(new Error('Idempotency key already belongs to different evidence'),{code:'idempotency_conflict'});
    throw error;
  }
  const storedReceipt=await findReceipt(db,receipt.idempotencyKey),storedManifest=await findManifest(db,receipt.contentHash);
  if(!storedReceipt||storedReceipt.content_hash!==receipt.contentHash||!manifestsEquivalent(storedManifest,manifest)) throw Object.assign(new Error('D1 manifest verification failed'),{code:'d1_verification_failed'});
  return {duplicate:false,manifest:storedManifest};
}
async function verifyR2Object(object,record,canonicalText,storedSha256){
  if(!object) throw Object.assign(new Error('R2 evidence object is missing'),{code:'r2_verification_failed'});
  const metadata=object.customMetadata||{};
  if(metadata.canonicalHash!==record.identity.contentHash||metadata.stage10Id!==record.identity.snapshotId||metadata.storedSha256!==storedSha256||metadata.origin!=='local_capture') throw Object.assign(new Error('R2 evidence metadata mismatch'),{code:'r2_verification_failed'});
  const bytes=new Uint8Array(await object.arrayBuffer());
  if(await sha256BytesHex(bytes)!==storedSha256) throw Object.assign(new Error('R2 stored checksum mismatch'),{code:'r2_verification_failed'});
  const text=await gunzipBytes(bytes);
  if(text!==canonicalText) throw Object.assign(new Error('R2 canonical evidence mismatch'),{code:'r2_verification_failed'});
  return object;
}
async function ensureR2Evidence(bucket,record,canonicalText,subjectHash){
  const r2Key=r2KeyFor(record),storedBytesValue=await gzipText(canonicalText),storedSha256=await sha256BytesHex(storedBytesValue);
  const metadata={canonicalHash:record.identity.contentHash,storedSha256,recordType:record.recordType,stage10Id:record.identity.snapshotId,schemaVersion:record.schemaVersion,season:record.season,gameweek:String(record.gameweek),origin:'local_capture',subjectHash};
  const created=await bucket.put(r2Key,storedBytesValue,{onlyIf:new Headers({'If-None-Match':'*'}),httpMetadata:{contentType:'application/json',contentEncoding:'gzip',cacheControl:'no-store'},customMetadata:metadata,sha256:storedSha256});
  const object=await bucket.get(r2Key);
  const verified=await verifyR2Object(object,record,canonicalText,storedSha256);
  const uploaded=verified.uploaded instanceof Date?verified.uploaded:new Date(verified.uploaded);
  if(!Number.isFinite(uploaded.getTime())) throw Object.assign(new Error('R2 upload timestamp is invalid'),{code:'r2_verification_failed'});
  return {created:Boolean(created),r2Key,r2UploadedAt:uploaded.toISOString(),storedBytes:storedBytesValue.byteLength,storedSha256};
}
function publicManifest(row){
  if(!row)return null;
  return {contentHash:row.content_hash,recordType:row.record_type,stage10RecordId:row.stage10_record_id,schemaVersion:row.schema_version,season:row.season,gameweek:Number(row.gameweek),deadlineTime:row.deadline_time,captureCompletedAt:row.capture_completed_at,origin:row.origin,timingGrade:row.timing_grade,clientOfficialEligible:Boolean(row.client_official_eligible),serverPredeadlineReceived:Boolean(row.server_predeadline_received),buildCommit:row.build_commit,buildSourceHash:row.build_source_hash,modelVersion:row.model_version,rulesVersion:row.rules_version,simulationVersion:row.simulation_version,r2Key:row.r2_key,r2UploadedAt:row.r2_uploaded_at,canonicalBytes:Number(row.canonical_bytes),storedBytes:Number(row.stored_bytes),storedSha256:row.stored_sha256};
}
async function archiveEnvelope(envelope,env,{subjectHash,nowFn=Date.now}={}){
  const checkedEnvelope=validateEnvelope(envelope);if(!checkedEnvelope.ok) throw Object.assign(new Error(checkedEnvelope.reason),{code:checkedEnvelope.reason,status:422});
  const checked=await validateSnapshotRecord(checkedEnvelope.envelope.record);if(!checked.ok) throw Object.assign(new Error(checked.reason),{code:`snapshot_${checked.reason}`,status:422});
  const policyError=retentionPolicyError(checked.record,env);if(policyError) throw Object.assign(new Error(policyError),{code:policyError,status:422});
  const existingReceipt=await findReceipt(env.EVIDENCE_DB,checkedEnvelope.envelope.idempotencyKey);
  if(existingReceipt&&existingReceipt.content_hash!==checked.record.identity.contentHash) throw Object.assign(new Error('Idempotency conflict'),{code:'idempotency_conflict',status:409});
  const canonicalText=stableStringify(checked.record),canonicalBytes=new TextEncoder().encode(canonicalText).byteLength;
  const r2=await ensureR2Evidence(env.EVIDENCE_BUCKET,checked.record,canonicalText,subjectHash);
  const nowIso=new Date(nowFn()).toISOString();
  const manifest=manifestFor(checked.record,{origin:'local_capture',r2Key:r2.r2Key,r2UploadedAt:r2.r2UploadedAt,canonicalBytes,storedBytes:r2.storedBytes,storedSha256:r2.storedSha256,nowIso});
  if(existingReceipt){
    const existingManifest=await findManifest(env.EVIDENCE_DB,checked.record.identity.contentHash);
    if(!manifestsEquivalent(existingManifest,manifest)) throw Object.assign(new Error('Existing manifest does not match evidence'),{code:'d1_verification_failed'});
    return {duplicate:true,manifest:existingManifest,r2Created:r2.created};
  }
  const committed=await commitManifest(env.EVIDENCE_DB,manifest,{idempotencyKey:checkedEnvelope.envelope.idempotencyKey,contentHash:checked.record.identity.contentHash,receivedAt:nowIso,result:'accepted',subjectHash});
  return {duplicate:committed.duplicate,manifest:committed.manifest,r2Created:r2.created};
}
async function readRequestJson(request,env){
  const limit=maxRequestBytes(env),length=Number(request.headers.get('Content-Length'));
  if(Number.isFinite(length)&&length>limit) throw Object.assign(new Error('Request too large'),{code:'payload_too_large',status:413});
  const text=await request.text();
  if(new TextEncoder().encode(text).byteLength>limit) throw Object.assign(new Error('Request too large'),{code:'payload_too_large',status:413});
  try{return JSON.parse(text);}catch(error){throw Object.assign(new Error('Invalid JSON'),{code:'invalid_json',status:400});}
}
async function reconcileOrphans(env,{limit=100,cursor=null,nowFn=Date.now}={}){
  const options={prefix:R2_PREFIX,limit:Math.max(1,Math.min(100,Number(limit)||100)),include:['customMetadata']};if(cursor)options.cursor=cursor;
  const listed=await env.EVIDENCE_BUCKET.list(options);let reconciled=0,existing=0,quarantined=0;
  for(const object of listed.objects||[]){
    const hash=object?.customMetadata?.canonicalHash;
    if(!/^[0-9a-f]{64}$/.test(hash||'')){quarantined++;continue;}
    if(await findManifest(env.EVIDENCE_DB,hash)){existing++;continue;}
    try{
      const full=await env.EVIDENCE_BUCKET.get(object.key);if(!full)throw new Error('missing');
      const bytes=new Uint8Array(await full.arrayBuffer()),text=await gunzipBytes(bytes),record=JSON.parse(text),checked=await validateSnapshotRecord(record);
      if(!checked.ok||checked.record.identity.contentHash!==hash||full.customMetadata?.origin!=='local_capture') throw new Error('invalid');
      const policyError=retentionPolicyError(checked.record,env);if(policyError)throw new Error(policyError);
      const storedSha256=await sha256BytesHex(bytes);
      if(full.customMetadata?.storedSha256!==storedSha256)throw new Error('checksum');
      const uploaded=full.uploaded instanceof Date?full.uploaded:new Date(full.uploaded);if(!Number.isFinite(uploaded.getTime()))throw new Error('uploaded');
      const manifest=manifestFor(checked.record,{origin:'local_capture',r2Key:object.key,r2UploadedAt:uploaded.toISOString(),canonicalBytes:new TextEncoder().encode(stableStringify(checked.record)).byteLength,storedBytes:bytes.byteLength,storedSha256,nowIso:new Date(nowFn()).toISOString()});
      await insertEvidenceStatement(env.EVIDENCE_DB,manifest).run();
      const verified=await findManifest(env.EVIDENCE_DB,hash);if(!manifestsEquivalent(verified,manifest))throw new Error('manifest');
      reconciled++;
    }catch(error){quarantined++;}
  }
  return {reconciled,existing,quarantined,truncated:Boolean(listed.truncated),cursor:listed.truncated?listed.cursor||null:null};
}
async function handleEvidenceArchiveRequest(request,env={},deps={}){
  const logger=deps.logger||console,origin=request.headers.get('Origin'),allowed=allowedOrigins(env);
  if(origin&&!allowed.has(origin)) return jsonResponse({error:'origin_not_allowed'},403,null);
  const corsOrigin=origin&&allowed.has(origin)?origin:null;
  if(request.method==='OPTIONS'){
    if(!corsOrigin)return jsonResponse({error:'origin_required'},403,null);
    const requested=request.headers.get('Access-Control-Request-Method');if(requested&&!['GET','POST'].includes(requested))return jsonResponse({error:'method_not_allowed'},405,corsOrigin);
    const headers=corsHeaders(corsOrigin);headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');headers.set('Access-Control-Allow-Headers','Content-Type');headers.set('Access-Control-Max-Age','600');return new Response(null,{status:204,headers});
  }
  const url=new URL(request.url);
  if(!['GET','POST'].includes(request.method))return jsonResponse({error:'method_not_allowed'},405,corsOrigin,{Allow:'GET, POST, OPTIONS'});
  let auth;
  try{auth=await authenticateRequest(request,env,deps);}catch(error){const code=error?.code==='auth_not_configured'||error?.code==='auth_keys_unavailable'?error.code:'unauthorised';return jsonResponse({error:code},code==='auth_not_configured'||code==='auth_keys_unavailable'?503:403,corsOrigin);}
  const nowFn=deps.nowFn||Date.now;
  let subjectHash;
  try{subjectHash=await sha256Hex(`access-sub:${auth.sub}`,deps.cryptoImpl||globalThis.crypto);}catch(error){return jsonResponse({error:'internal_error'},500,corsOrigin);}
  try{
    if(!env.EVIDENCE_DB||!env.EVIDENCE_BUCKET) throw Object.assign(new Error('Storage bindings are not configured'),{code:'storage_not_configured',status:503});
    if(!(await consumeRateLimit(env.EVIDENCE_DB,subjectHash,nowFn(),rateLimit(env)))) return jsonResponse({error:'rate_limited'},429,corsOrigin,{'Retry-After':'60'});
    if(request.method==='GET'&&url.pathname==='/v1/health'){
      const migration=await env.EVIDENCE_DB.prepare(`SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1`).first();
      await env.EVIDENCE_BUCKET.list({prefix:R2_PREFIX,limit:1});
      return jsonResponse({ok:true,archiveVersion:ARCHIVE_VERSION,schemaVersion:SNAPSHOT_SCHEMA_VERSION,migrationVersion:migration?.version??null},200,corsOrigin);
    }
    const manifestMatch=/^\/v1\/evidence\/([0-9a-f]{64})$/.exec(url.pathname);
    if(request.method==='GET'&&manifestMatch){
      const row=await findManifest(env.EVIDENCE_DB,manifestMatch[1]);
      return row?jsonResponse({manifest:publicManifest(row)},200,corsOrigin):jsonResponse({error:'not_found'},404,corsOrigin);
    }
    if(request.method==='POST'&&url.pathname==='/v1/evidence/predeadline'){
      const envelope=await readRequestJson(request,env),result=await archiveEnvelope(envelope,env,{subjectHash,nowFn});
      return jsonResponse({ok:true,duplicate:result.duplicate,r2Created:result.r2Created,manifest:publicManifest(result.manifest)},result.duplicate?200:201,corsOrigin,{'X-Teamsheet-Content-Hash':result.manifest.content_hash});
    }
    if(request.method==='POST'&&url.pathname==='/v1/admin/reconcile'){
      const body=await readRequestJson(request,env);const keys=Object.keys(body||{});if(keys.some(key=>!['cursor','limit'].includes(key)))throw Object.assign(new Error('Invalid reconcile request'),{code:'reconcile_schema',status:422});
      const result=await reconcileOrphans(env,{limit:body?.limit,cursor:body?.cursor,nowFn});return jsonResponse({ok:true,...result},200,corsOrigin);
    }
    return jsonResponse({error:'route_not_allowed'},404,corsOrigin);
  }catch(error){
    const code=String(error?.code||'archive_failed'),status=Number(error?.status)||(['idempotency_conflict'].includes(code)?409:500);
    if(status>=500)logger.error?.('Evidence archive operation failed',safeErrorDiagnostic(error));
    return jsonResponse({error:code},status,corsOrigin);
  }
}

export {
  ARCHIVE_VERSION,SNAPSHOT_SCHEMA_VERSION,DEFAULT_ALLOWED_ORIGINS,R2_PREFIX,MAX_REQUEST_BYTES,
  canonicalise,stableStringify,sha256Hex,findForbiddenEvidence,assertEvidenceSafe,assessDeadlineTiming,
  computeSectionHashes,recordHashMaterial,validateSnapshotRecord,retentionPolicyError,validateEnvelope,
  allowedOrigins,safeErrorDiagnostic,verifyAccessJwt,r2KeyFor,manifestFor,publicManifest,
  archiveEnvelope,reconcileOrphans,handleEvidenceArchiveRequest
};

export default {fetch:handleEvidenceArchiveRequest};
