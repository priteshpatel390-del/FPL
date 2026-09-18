import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {issueOfficialFplTeamUniverseAuthority} from '../src/decision-intelligence/api-football-shadow-contracts.mjs';
import {
  API_FOOTBALL_OWNER_CROSSWALK_HASH,API_FOOTBALL_OWNER_REVIEW_REFERENCE,API_FOOTBALL_OWNER_REVIEWED_AT,
  API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_EXECUTION_IDENTITY,API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_INTEGRITY_HASH,
  API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_OBSERVED_AT,API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_REVISION,
  OFFICIAL_FPL_2026_27_OWNER_REVIEW_TEAM_LABELS,issueOwnerApprovedTwentyClubMappings,
  validateOwnerApprovedTeamCrosswalk
} from '../src/decision-intelligence/api-football-owner-mapping.mjs';
import {
  API_FOOTBALL_TEAM_MAPPING_RECEIPT_REVISION,runAttendedApiFootballTeamUniverseQualification
} from '../src/decision-intelligence/api-football-prelive-qualification.mjs';

const IDS=Object.freeze(Array.from({length:20},(_,index)=>index+1));
const TEST_PROVIDER_IDS=Object.freeze(IDS.map(id=>String(id===6?49:id===13?63:200+id)));
const TEST_KEY='deliberate-test-key-material';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');

function officialFplWorld(){
  const byId=new Map(OFFICIAL_FPL_2026_27_OWNER_REVIEW_TEAM_LABELS.map(row=>[Number(row.officialFplTeamId),row]));
  const teams=IDS.map((id,index)=>{
    const label=byId.get(id);
    return {
      id,name:label.name,short_name:label.shortName,
      strength:1000+index,strength_overall_home:1001+index,strength_overall_away:999+index,
      strength_attack_home:1002+index,strength_attack_away:998+index,
      strength_defence_home:1003+index,strength_defence_away:997+index
    };
  });
  const events=Array.from({length:38},(_,index)=>({
    id:index+1,name:`Gameweek ${index+1}`,
    deadline_time:new Date(Date.UTC(2026,7,15+index*7,10)).toISOString()
  }));
  const elements=Array.from({length:401},(_,index)=>({
    id:index+1,team:IDS[index%20],element_type:index%4+1,web_name:`Player ${index+1}`,now_cost:45+index%100,status:'a',
    chance_of_playing_next_round:null,chance_of_playing_this_round:null,news:'',news_added:null,
    selected_by_percent:String((index%500)/10)
  }));
  const fixtures=Array.from({length:300},(_,index)=>({
    id:index+1,event:index%38+1,kickoff_time:new Date(Date.UTC(2026,7,15+index,14)).toISOString(),
    team_h:IDS[index%20],team_a:IDS[(index+7)%20],team_h_difficulty:2+index%4,team_a_difficulty:2+(index+1)%4
  }));
  return {
    bootstrap:{events,teams,elements,element_types:[1,2,3,4].map(id=>({id}))},
    fixtures,season:'2026-27',fetchedAt:'2026-09-18T09:30:00.000Z'
  };
}

function ownerCrosswalk(){
  return Object.fromEntries(IDS.map((id,index)=>[String(id),TEST_PROVIDER_IDS[index]]));
}

function providerPayload(){
  return {
    get:'teams',parameters:{league:'39',season:'2026'},errors:{},results:20,paging:{current:1,total:1},
    response:TEST_PROVIDER_IDS.map((providerTeamId,index)=>({
      team:{id:Number(providerTeamId),name:`Synthetic Provider ${index+1}`,code:`S${String(index+1).padStart(2,'0')}`,country:'England',national:false}
    }))
  };
}

function providerResponse(){
  const body=JSON.stringify(providerPayload());
  return new Response(body,{status:200,headers:{
    'content-type':'application/json','content-length':String(Buffer.byteLength(body)),
    'x-ratelimit-requests-limit':'7500','x-ratelimit-requests-remaining':'7499',
    'x-ratelimit-limit':'300','x-ratelimit-remaining':'299'
  }});
}

function hexBuffer(hex){
  return Uint8Array.from(hex.match(/../g),part=>Number.parseInt(part,16)).buffer;
}

function ownerTestCrypto(){
  const native=globalThis.crypto;
  return {
    subtle:{
      async digest(algorithm,data){
        const text=new TextDecoder().decode(data);
        if(text.startsWith('1:201|'))return hexBuffer(API_FOOTBALL_OWNER_CROSSWALK_HASH);
        if(text.includes('"kind":"api-football-team-universe-evidence-v1"'))return hexBuffer(API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_INTEGRITY_HASH);
        return native.subtle.digest(algorithm,data);
      }
    }
  };
}

async function providerUniverse({executionIdentity=API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_EXECUTION_IDENTITY}={}){
  const run=await runAttendedApiFootballTeamUniverseQualification({
    apiKey:TEST_KEY,fetchImpl:async()=>providerResponse(),sleepImpl:async()=>{},
    nowImpl:()=>API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_OBSERVED_AT,executionIdentity,
    cryptoImpl:ownerTestCrypto()
  });
  assert.equal(run.ok,true);
  return run.providerUniverse;
}

test('owner-review mapping contract publishes only hashes, review metadata and Official FPL labels',()=>{
  assert.match(API_FOOTBALL_OWNER_CROSSWALK_HASH,/^[0-9a-f]{64}$/);
  assert.equal(API_FOOTBALL_OWNER_REVIEW_REFERENCE,'owner-approved-crosswalk-2026-09-18');
  assert.ok(Date.parse(API_FOOTBALL_OWNER_REVIEWED_AT)>=Date.parse(API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_OBSERVED_AT));
  assert.equal(API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_REVISION,`api-football-team-universe:${API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_INTEGRITY_HASH}`);
  assert.equal(OFFICIAL_FPL_2026_27_OWNER_REVIEW_TEAM_LABELS.length,20);
  assert.deepEqual(OFFICIAL_FPL_2026_27_OWNER_REVIEW_TEAM_LABELS.map(row=>Number(row.officialFplTeamId)),IDS);
  assert.equal(new Set(OFFICIAL_FPL_2026_27_OWNER_REVIEW_TEAM_LABELS.map(row=>row.shortName)).size,20);
});

test('owner crosswalk is hash-bound, exact-20, bijective and keeps the two legacy anchors',async()=>{
  const crosswalk=ownerCrosswalk();
  assert.equal((await validateOwnerApprovedTeamCrosswalk(crosswalk)).reason,'owner_crosswalk_hash_mismatch');
  const admitted=await validateOwnerApprovedTeamCrosswalk(crosswalk,ownerTestCrypto());
  assert.equal(admitted.ok,true);assert.equal(admitted.rows.length,20);assert.equal(admitted.integrityHash,API_FOOTBALL_OWNER_CROSSWALK_HASH);
  const duplicate={...crosswalk,'20':crosswalk['19']};
  assert.equal((await validateOwnerApprovedTeamCrosswalk(duplicate,ownerTestCrypto())).reason,'owner_crosswalk_invalid');
  assert.equal((await validateOwnerApprovedTeamCrosswalk({...crosswalk,'6':'999'},ownerTestCrypto())).reason,'legacy_anchor_conflict');
  assert.equal((await validateOwnerApprovedTeamCrosswalk({...crosswalk,'13':'999'},ownerTestCrypto())).reason,'legacy_anchor_conflict');
});

test('owner-approved path issues 18 new receipts, reuses two legacy receipts and qualifies exact 20/20',async()=>{
  const authority=issueOfficialFplTeamUniverseAuthority(officialFplWorld());assert.equal(authority.ok,true);
  const universe=await providerUniverse();
  const issued=await issueOwnerApprovedTwentyClubMappings({
    authority,providerUniverse:universe,crosswalk:ownerCrosswalk()
  },ownerTestCrypto());
  assert.equal(issued.ok,true);assert.equal(issued.decision,'GO');
  assert.equal(issued.newReceiptCount,18);assert.equal(issued.legacyReceiptCount,2);assert.equal(issued.mappings.length,20);
  assert.equal(issued.qualification.verifiedPremierLeagueTeamCount,20);
  assert.equal(issued.qualification.completeTwentyClubCoverage,true);
  assert.equal(issued.qualification.unresolved.length,0);assert.equal(issued.qualification.receiptFailures.length,0);
  assert.equal(issued.qualification.providerUniverseRevision,API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_REVISION);
  assert.equal(issued.mappings.filter(row=>row.qualificationEvidenceReceipt?.revision===API_FOOTBALL_TEAM_MAPPING_RECEIPT_REVISION).length,18);
  assert.equal(new Set(issued.mappings.map(row=>row.providerEntityId)).size,20);
  assert.equal(new Set(issued.mappings.map(row=>row.canonicalFplId)).size,20);
});

test('owner-approved path fails closed when current Official FPL identity labels drift',async()=>{
  const world=officialFplWorld();
  world.bootstrap.teams=world.bootstrap.teams.map(team=>team.id===7?{...team,name:'Different Club'}:team);
  const authority=issueOfficialFplTeamUniverseAuthority(world);assert.equal(authority.ok,true);
  const issued=await issueOwnerApprovedTwentyClubMappings({
    authority,providerUniverse:await providerUniverse(),crosswalk:ownerCrosswalk()
  },ownerTestCrypto());
  assert.equal(issued.reason,'owner_review_official_fpl_identity_mismatch');
});

test('owner-approved path rejects valid-but-different attended provider universe provenance',async()=>{
  const authority=issueOfficialFplTeamUniverseAuthority(officialFplWorld());assert.equal(authority.ok,true);
  const different=await providerUniverse({executionIdentity:'github:priteshpatel390-del/FPL:run:99999999999:attempt:1:sha:f3a173362feba67020157f7c81c0fa3aaf2ca94a'});
  const issued=await issueOwnerApprovedTwentyClubMappings({
    authority,providerUniverse:different,crosswalk:ownerCrosswalk()
  },ownerTestCrypto());
  assert.equal(issued.reason,'provider_team_universe_not_owner_reviewed');
});

test('owner-reviewed mapping module remains isolated from provider egress, secrets and production/model paths',()=>{
  const source=fs.readFileSync(path.join(root,'src/decision-intelligence/api-football-owner-mapping.mjs'),'utf8');
  assert.doesNotMatch(source,/process\.env|globalThis\.fetch|x-apisports-key|API_FOOTBALL_API_KEY|v3\.football\.api-sports\.io|collection_enabled\s*=\s*1|wrangler|cron/i);
  for(const file of ['src/model/minutes.mjs','src/model/scoring.mjs','src/squad.mjs','src/model/transfers.mjs','src/main.mjs']){
    assert.doesNotMatch(fs.readFileSync(path.join(root,file),'utf8'),/api-football-owner-mapping/i,file);
  }
});
