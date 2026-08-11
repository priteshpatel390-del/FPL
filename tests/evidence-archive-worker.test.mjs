import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { finaliseSnapshotRecord } from '../src/evidence/snapshot.mjs';
import {
  validateSnapshotRecord, retentionPolicyError, archiveEnvelope, reconcileOrphans,
  verifyAccessJwt, handleEvidenceArchiveRequest, R2_PREFIX
} from '../workers/evidence-archive.mjs';

const ORIGIN='https://priteshpatel390-del.github.io';
const deadline=Date.parse('2026-08-15T10:00:00.000Z');
const completed=deadline-20*60*1000;
const network=at=>({status:'available',serverAt:at,clientMidpointAt:at,skewMs:0,requestStartedAt:at-20,responseReceivedAt:at+20,roundTripMs:40,source:'same_origin_http_date'});
const provider=(name,at,included=false)=>({provider:name,state:included?'Live':'Disabled',included,didAffectModel:included,acceptedRecordCount:included?1:0,rejectedRecordCount:0,recordedAt:new Date(at).toISOString(),lastSuccessAt:included?new Date(at).toISOString():null,ageMs:included?0:null,thresholdMs:null,note:'',consequence:''});
const providers=(active=['fpl'])=>['fpl','understat','odds','archive'].map(name=>provider(name,completed-2000,active.includes(name)));
function basePayload(overrides={}){
  return {
    recordType:'preDeadlineSnapshot',schemaVersion:'1.0.0',metricVersion:'1.0.0',segmentationVersion:'1.0.0',
    managerRef:'mgr-0123456789abcdef0123456789abcdef',season:'2026-27',gameweek:1,deadlineTime:new Date(deadline).toISOString(),
    build:{modelVersion:'2.4.0',rulesVersion:'2026-27.3',sourceHash:'abc',commit:'def',moduleOrder:[]},
    versions:{model:'2.4.0',rules:'2026-27.3',simulation:'1.0.0',snapshot:'1.0.0'},
    rules:{fpl:{season:'2026-27'},minutes:{},scoring:{},transfer:{},simulation:{version:'1.0.0'},odds:{},fixture:{baseGoals:1.42,homeTilt:1.1}},
    providers:providers(),
    completeness:{complete:true,sections:{coreInputs:'complete',playerProjections:'complete'},fatalFplIssue:false,playerCount:1,expectedPlayerCount:1},
    capture:{startedAt:new Date(completed-1000).toISOString(),projectionStartedAt:new Date(completed-900).toISOString(),projectionCompletedAt:new Date(completed-800).toISOString(),horizon:6},
    modelInputs:{players:[{id:1}],teams:[],events:[],fixtures:[],minuteHistory:{},calibration:null,understat:null,odds:null},
    outputs:{players:[{playerId:1}],squad:{status:'not_available'}},retries:[],issues:[],
    quality:{projectionDurationMs:1,simulationSamplesPerAvailablePlayer:5000,seasonLive:true},...overrides
  };
}
async function snapshot(overrides={}){
  return finaliseSnapshotRecord(basePayload(overrides),{captureStartedAt:completed-1000,captureCompletedAt:completed,networkBefore:network(completed-900),networkAfter:network(completed)});
}
function envelope(record,idempotencyKey='gw1-local-capture-0001'){
  return {archiveVersion:'1.0.0',origin:'local_capture',idempotencyKey,enqueuedAt:new Date(completed+1000).toISOString(),record};
}
class MockStatement{
  constructor(db,sql,args=[]){this.db=db;this.sql=sql;this.args=args;}
  bind(...args){return new MockStatement(this.db,this.sql,args);}
  first(){return this.db.first(this.sql,this.args);}
  run(){return this.db.run(this.sql,this.args);}
}
class MockD1{
  constructor(events=[]){this.events=events;this.records=new Map();this.receipts=new Map();this.rates=new Map();this.failBatch=false;}
  prepare(sql){return new MockStatement(this,sql);}
  async first(sql,args){
    if(sql.includes('INSERT INTO rate_limit_windows')){const key=`${args[0]}|${args[1]}`,count=(this.rates.get(key)||0)+1;this.rates.set(key,count);return {request_count:count};}
    if(sql.includes('FROM ingest_receipts'))return this.receipts.get(args[0])||null;
    if(sql.includes('FROM evidence_records'))return this.records.get(args[0])||null;
    if(sql.includes('FROM schema_migrations'))return {version:1};
    throw new Error('Unexpected first SQL');
  }
  row(args){const keys=['content_hash','record_type','stage10_record_id','schema_version','season','gameweek','logical_key','deadline_time','capture_completed_at','origin','timing_grade','client_official_eligible','server_predeadline_received','build_commit','build_source_hash','model_version','rules_version','simulation_version','r2_key','r2_uploaded_at','canonical_bytes','stored_bytes','stored_sha256','created_at'];return Object.fromEntries(keys.map((key,i)=>[key,args[i]]));}
  async run(sql,args){
    if(sql.includes('INSERT INTO evidence_records')){const row=this.row(args);if(this.records.has(row.content_hash))return {success:true};for(const value of this.records.values())if(value.stage10_record_id===row.stage10_record_id||value.r2_key===row.r2_key)throw new Error('UNIQUE constraint failed');this.records.set(row.content_hash,row);return {success:true};}
    if(sql.includes('INSERT INTO ingest_receipts')){const [idempotency_key,content_hash,received_at,result,subject_hash]=args;if(this.receipts.has(idempotency_key))throw new Error('UNIQUE constraint failed');if(!this.records.has(content_hash))throw new Error('FOREIGN KEY constraint failed');this.receipts.set(idempotency_key,{idempotency_key,content_hash,received_at,result,subject_hash});return {success:true};}
    throw new Error('Unexpected run SQL');
  }
  async batch(statements){this.events.push('d1.batch');const records=new Map(this.records),receipts=new Map(this.receipts);try{if(this.failBatch)throw new Error('D1 unavailable');for(const statement of statements)await this.run(statement.sql,statement.args);return statements.map(()=>({success:true}));}catch(error){this.records=records;this.receipts=receipts;throw error;}}
}
class MockR2Object{
  constructor(key,entry){this.key=key;this.uploaded=entry.uploaded;this.customMetadata=entry.customMetadata;this.httpMetadata=entry.httpMetadata;this.entry=entry;}
  async arrayBuffer(){return this.entry.bytes.buffer.slice(this.entry.bytes.byteOffset,this.entry.bytes.byteOffset+this.entry.bytes.byteLength);}
}
class MockR2{
  constructor(events=[]){this.events=events;this.objects=new Map();this.failPut=false;this.uploadedAt=new Date('2026-08-15T09:40:00.000Z');}
  async put(key,value,options={}){this.events.push('r2.put');if(this.failPut)throw new Error('R2 unavailable');if(options.onlyIf instanceof Headers&&options.onlyIf.get('If-None-Match')==='*'&&this.objects.has(key))return null;const bytes=new Uint8Array(value);const actual=createHash('sha256').update(bytes).digest('hex');if(options.sha256&&actual!==options.sha256)throw new Error('checksum mismatch');this.objects.set(key,{bytes,uploaded:new Date(this.uploadedAt),customMetadata:{...(options.customMetadata||{})},httpMetadata:{...(options.httpMetadata||{})}});return new MockR2Object(key,this.objects.get(key));}
  async get(key){this.events.push('r2.get');const entry=this.objects.get(key);return entry?new MockR2Object(key,entry):null;}
  async list({prefix='',limit=100}={}){this.events.push('r2.list');const objects=[...this.objects.entries()].filter(([key])=>key.startsWith(prefix)).slice(0,limit).map(([key,entry])=>({key,uploaded:entry.uploaded,customMetadata:entry.customMetadata}));return {objects,truncated:false,cursor:null};}
}
function env(events=[]){return {EVIDENCE_DB:new MockD1(events),EVIDENCE_BUCKET:new MockR2(events),ALLOW_UNDERSTAT_RETENTION:'false',ALLOW_ODDS_RETENTION:'false',MAX_REQUESTS_PER_MINUTE:'30'};}

test('server validator accepts a client-finalised Stage 10 snapshot and rejects mutation',async()=>{const record=await snapshot();assert.equal((await validateSnapshotRecord(record)).ok,true);const mutated=JSON.parse(JSON.stringify(record));mutated.outputs.players[0].playerId=99;assert.equal((await validateSnapshotRecord(mutated)).ok,false);});

test('provider retention blocks included or retained derived data but allows empty unused containers',async()=>{
  const unused=await snapshot({modelInputs:{...basePayload().modelInputs,understat:{},odds:{}}});
  assert.equal(retentionPolicyError(unused,{}),null);
  const understatRetained=await snapshot({modelInputs:{...basePayload().modelInputs,understat:{1:{xg:1.2}}}});
  assert.equal(retentionPolicyError(understatRetained,{}),'understat_retention_not_approved');
  assert.equal(retentionPolicyError(understatRetained,{ALLOW_UNDERSTAT_RETENTION:'true'}),null);
  const understatIncluded=await snapshot({providers:providers(['fpl','understat']),modelInputs:{...basePayload().modelInputs,understat:{}}});
  assert.equal(retentionPolicyError(understatIncluded,{}),'understat_retention_not_approved');
  const oddsRetained=await snapshot({modelInputs:{...basePayload().modelInputs,odds:{'1|2':{home:1.4}}}});
  assert.equal(retentionPolicyError(oddsRetained,{}),'odds_retention_not_approved');
  assert.equal(retentionPolicyError(oddsRetained,{ALLOW_ODDS_RETENTION:'true'}),null);
  const oddsIncluded=await snapshot({providers:providers(['fpl','odds']),modelInputs:{...basePayload().modelInputs,odds:{}}});
  assert.equal(retentionPolicyError(oddsIncluded,{}),'odds_retention_not_approved');
});

test('R2 is verified before D1 and duplicate retry preserves first custody time',async()=>{
  const events=[],storage=env(events),record=await snapshot(),item=envelope(record);const first=await archiveEnvelope(item,storage,{subjectHash:'a'.repeat(64),nowFn:()=>completed+2000});
  assert.ok(events.indexOf('r2.put')<events.indexOf('d1.batch'));assert.ok(events.indexOf('r2.get')<events.indexOf('d1.batch'));assert.equal(first.manifest.server_predeadline_received,1);
  storage.EVIDENCE_BUCKET.uploadedAt=new Date('2026-08-15T10:30:00.000Z');const second=await archiveEnvelope(item,storage,{subjectHash:'a'.repeat(64),nowFn:()=>completed+5000});
  assert.equal(second.duplicate,true);assert.equal(second.manifest.r2_uploaded_at,first.manifest.r2_uploaded_at);assert.equal(storage.EVIDENCE_BUCKET.objects.size,1);
});

test('idempotency conflict is rejected',async()=>{const storage=env(),first=await snapshot();await archiveEnvelope(envelope(first,'same-idempotency-key-0001'),storage,{subjectHash:'a'.repeat(64)});const other=await snapshot({build:{...basePayload().build,commit:'other'}});await assert.rejects(()=>archiveEnvelope(envelope(other,'same-idempotency-key-0001'),storage,{subjectHash:'a'.repeat(64)}),error=>error.code==='idempotency_conflict');});

test('R2 failure creates no D1 record',async()=>{const storage=env(),record=await snapshot();storage.EVIDENCE_BUCKET.failPut=true;await assert.rejects(()=>archiveEnvelope(envelope(record),storage,{subjectHash:'a'.repeat(64)}),/R2 unavailable/);assert.equal(storage.EVIDENCE_DB.records.size,0);assert.equal(storage.EVIDENCE_DB.receipts.size,0);});

test('D1 failure leaves a recoverable R2 orphan',async()=>{const storage=env(),record=await snapshot();storage.EVIDENCE_DB.failBatch=true;await assert.rejects(()=>archiveEnvelope(envelope(record),storage,{subjectHash:'a'.repeat(64)}),/D1 unavailable/);assert.equal(storage.EVIDENCE_BUCKET.objects.size,1);assert.equal(storage.EVIDENCE_DB.records.size,0);storage.EVIDENCE_DB.failBatch=false;const result=await reconcileOrphans(storage);assert.equal(result.reconciled,1);assert.equal([...storage.EVIDENCE_DB.records.values()][0].content_hash,record.identity.contentHash);});

test('archive v1 refuses recovery-import promotion',async()=>{const storage=env(),item=envelope(await snapshot());item.origin='recovery_import';await assert.rejects(()=>archiveEnvelope(item,storage,{subjectHash:'a'.repeat(64)}),error=>error.code==='origin_not_allowed');assert.equal(storage.EVIDENCE_BUCKET.objects.size,0);});

function b64url(value){return Buffer.from(value).toString('base64url');}
async function accessToken({issuer='https://team.cloudflareaccess.com',audience='aud',subject='owner',now=Date.parse('2026-08-11T10:00:00Z'),expiresIn=300}={}){
  const pair=await webcrypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const jwk=await webcrypto.subtle.exportKey('jwk',pair.publicKey);Object.assign(jwk,{kid:'kid-1',alg:'RS256',use:'sig'});
  const head=b64url(JSON.stringify({alg:'RS256',kid:'kid-1',typ:'JWT'})),body=b64url(JSON.stringify({iss:issuer,aud:audience,sub:subject,exp:Math.floor(now/1000)+expiresIn}));
  const signature=await webcrypto.subtle.sign({name:'RSASSA-PKCS1-v1_5'},pair.privateKey,new TextEncoder().encode(`${head}.${body}`));
  return {token:`${head}.${body}.${Buffer.from(signature).toString('base64url')}`,jwk,now};
}

test('Cloudflare Access validation verifies RS256 signature, issuer, audience and expiry',async()=>{
  const {token,jwk,now}=await accessToken();const fetchFn=async()=>new Response(JSON.stringify({keys:[jwk]}),{status:200,headers:{'Content-Type':'application/json'}});const deps={fetchFn,nowFn:()=>now,cryptoImpl:webcrypto};
  const auth=await verifyAccessJwt(token,{TEAM_DOMAIN:'https://team.cloudflareaccess.com',POLICY_AUD:'aud'},deps);assert.equal(auth.sub,'owner');
  await assert.rejects(()=>verifyAccessJwt(token,{TEAM_DOMAIN:'https://team.cloudflareaccess.com',POLICY_AUD:'wrong'},deps),/claims/);
  await assert.rejects(()=>verifyAccessJwt(token,{TEAM_DOMAIN:'https://team.cloudflareaccess.com',POLICY_AUD:'aud'},{...deps,nowFn:()=>now+10*60*1000}),/expired/);
});

function request(path,{method='GET',body=null,origin=ORIGIN}={}){const headers=new Headers();if(origin)headers.set('Origin',origin);if(body!=null)headers.set('Content-Type','application/json');return new Request('https://evidence.example'+path,{method,headers,body:body==null?undefined:JSON.stringify(body)});}

test('Worker fails closed on origin, auth, methods and unknown routes',async()=>{const storage=env(),authVerifier=async()=>({sub:'owner'});assert.equal((await handleEvidenceArchiveRequest(request('/v1/health',{origin:'https://evil.example'}),storage,{authVerifier})).status,403);assert.equal((await handleEvidenceArchiveRequest(request('/v1/health'),storage,{authVerifier:async()=>{const e=new Error('no');e.code='unauthorised';throw e;}})).status,403);assert.equal((await handleEvidenceArchiveRequest(request('/v1/health',{method:'DELETE'}),storage,{authVerifier})).status,405);assert.equal((await handleEvidenceArchiveRequest(request('/v1/unknown'),storage,{authVerifier})).status,404);});

test('Worker archives safe manifest and rate limits authenticated subject',async()=>{const storage=env();storage.MAX_REQUESTS_PER_MINUTE='2';const authVerifier=async()=>({sub:'owner'}),record=await snapshot();let response=await handleEvidenceArchiveRequest(request('/v1/evidence/predeadline',{method:'POST',body:envelope(record)}),storage,{authVerifier,nowFn:()=>completed+2000,cryptoImpl:webcrypto});assert.equal(response.status,201);const body=await response.json();assert.equal(body.manifest.contentHash,record.identity.contentHash);assert.equal(body.manifest.subjectHash,undefined);response=await handleEvidenceArchiveRequest(request(`/v1/evidence/${record.identity.contentHash}`),storage,{authVerifier,nowFn:()=>completed+3000,cryptoImpl:webcrypto});assert.equal(response.status,200);response=await handleEvidenceArchiveRequest(request('/v1/health'),storage,{authVerifier,nowFn:()=>completed+4000,cryptoImpl:webcrypto});assert.equal(response.status,429);});

test('deployment config keeps evidence service separate and provider retention fail-closed',()=>{
  const config=JSON.parse(readFileSync('workers/evidence-wrangler.jsonc','utf8'));assert.equal(config.name,'teamsheet-evidence-archive');assert.equal(config.main,'evidence-archive.mjs');
  assert.equal(config.d1_databases[0].binding,'EVIDENCE_DB');assert.equal(config.r2_buckets[0].binding,'EVIDENCE_BUCKET');assert.equal(config.vars.ALLOW_UNDERSTAT_RETENTION,'false');assert.equal(config.vars.ALLOW_ODDS_RETENTION,'false');
  assert.equal('POLICY_AUD' in config.vars,false);assert.equal('TEAM_DOMAIN' in config.vars,false);assert.notEqual(config.main,'fpl-gateway.mjs');
  const sql=readFileSync('workers/evidence-migrations/0001_evidence_foundation.sql','utf8');for(const table of ['schema_migrations','evidence_records','ingest_receipts','rate_limit_windows'])assert.match(sql,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));assert.match(sql,/content_hash TEXT PRIMARY KEY/);assert.match(sql,/FOREIGN KEY/);
});
