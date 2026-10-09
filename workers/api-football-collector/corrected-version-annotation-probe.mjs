// Diagnostic ONLY for the already-created corrected Worker Version.
// Importing this module cannot contact Cloudflare, D1 or API-Football.
// It does not qualify Versions or change the existing validator's acceptance rule.
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

export const ANNOTATION_PROBE_CREATION_SHA='073ac6a53d09f004e5ada5b94fb1cea6df3ef228';
export const ANNOTATION_PROBE_VERSION_ID='509f5a98-38fc-4e58-8a26-1b8fc4c9c787';
export const ANNOTATION_PROBE_WORKER='teamsheet-api-football-shadow-collector';
export const ANNOTATION_PROBE_CONTRACT='corrected-version-annotation-proof-v1';
const MESSAGE='workers/message',TAG='workers/tag',SERVER_KEY='workers/triggered_by';
const has=(x,key)=>Object.hasOwn(x,key);
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const sha=x=>createHash('sha256').update(x).digest('hex');

function summariseAnnotations(actual,expected){
  const representation=actual===undefined?'absent':actual===null?'null':Array.isArray(actual)?'array':
    typeof actual==='object'?'object':'primitive';
  const present=representation==='object';
  const names=present?Object.keys(actual):[];
  const extra=names.filter(key=>key!==MESSAGE&&key!==TAG);
  return Object.freeze({
    representation,
    workers_message_present:present&&has(actual,MESSAGE),
    workers_message_exact_match:present&&has(actual,MESSAGE)&&actual[MESSAGE]===expected[MESSAGE],
    workers_tag_present:present&&has(actual,TAG),
    workers_tag_exact_match:present&&has(actual,TAG)&&actual[TAG]===expected[TAG],
    additional_annotation_count:extra.length,
    documented_triggered_by_key_present:extra.includes(SERVER_KEY),
    unrecognised_additional_key_count:extra.filter(key=>key!==SERVER_KEY).length
  });
}

export function diagnoseCorrectedAnnotations({stable,beta,versionId,expected}={}){
  if(!record(expected)||typeof expected[MESSAGE]!=='string'||typeof expected[TAG]!=='string'||
    Object.keys(expected).length!==2||typeof versionId!=='string')
    throw new Error('ANNOTATION_PROBE_EXPECTED_IDENTITY_INVALID');
  const stableAnnotations=summariseAnnotations(stable?.annotations,expected);
  const betaAnnotations=summariseAnnotations(beta?.annotations,expected);
  const stableIdMatches=stable?.id===versionId;
  const betaIdMatches=beta?.id===versionId;
  const idsMatch=stableIdMatches&&betaIdMatches;
  const exactRequired=betaAnnotations.workers_message_exact_match&&betaAnnotations.workers_tag_exact_match;
  const fullObjectStringEqual=betaAnnotations.representation==='object'&&
    JSON.stringify(beta.annotations)===JSON.stringify(expected);
  let classification='EXACT_TWO_FIELD_ANNOTATIONS';
  if(!idsMatch)classification='VERSION_ID_MISMATCH';
  else if(betaAnnotations.representation!=='object')classification='BETA_ANNOTATION_SHAPE_INVALID';
  else if(!betaAnnotations.workers_message_present||!betaAnnotations.workers_tag_present)
    classification='REQUIRED_ANNOTATION_MISSING';
  else if(!exactRequired)classification='REQUIRED_ANNOTATION_VALUE_MISMATCH';
  else if(betaAnnotations.additional_annotation_count!==0)
    classification='REQUIRED_ANNOTATIONS_EXACT_WITH_EXTRA_KEYS';
  else if(!fullObjectStringEqual)classification='REQUIRED_ANNOTATIONS_EXACT_KEY_ORDER_ONLY';
  return Object.freeze({
    contract:ANNOTATION_PROBE_CONTRACT,
    classification,
    stable_version_id_matches:stableIdMatches,
    beta_version_id_matches:betaIdMatches,
    version_id_matches:idsMatch,
    stable_annotations:stableAnnotations,
    beta_annotations:betaAnnotations,
    stable_beta_required_values_agree:stableAnnotations.representation==='object'&&
      betaAnnotations.representation==='object'?
      (stableAnnotations.workers_message_present===betaAnnotations.workers_message_present&&
       stableAnnotations.workers_tag_present===betaAnnotations.workers_tag_present&&
       stableAnnotations.workers_message_exact_match===betaAnnotations.workers_message_exact_match&&
       stableAnnotations.workers_tag_exact_match===betaAnnotations.workers_tag_exact_match):null,
    original_whole_object_comparison_equal:fullObjectStringEqual,
    version_qualified:false
  });
}

async function requestExactVersion(url,token){
  const response=await fetch(url,{method:'GET',redirect:'manual',headers:{
    Authorization:'Bearer '+token,Accept:'application/json'
  },signal:AbortSignal.timeout(15_000)});
  if(!response.ok||response.status>=300)throw new Error('ANNOTATION_PROBE_READ_FAILED');
  const envelope=await response.json();
  if(envelope?.success!==true||!record(envelope.result))
    throw new Error('ANNOTATION_PROBE_RESPONSE_INVALID');
  // Raw Version responses, including beta module bytes, remain in memory only.
  return envelope.result;
}

export async function main({env=process.env}={}){
  const accountId=env.DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID;
  const fingerprint=env.DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT;
  const readToken=env.DATA_STEWARD_CLOUDFLARE_READ_TOKEN;
  const reportPath=env.ANNOTATION_PROBE_REPORT_PATH;
  if(typeof accountId!=='string'||!accountId||typeof fingerprint!=='string'||
    !/^[a-f0-9]{64}$/.test(fingerprint)||sha(accountId)!==fingerprint||
    typeof readToken!=='string'||!readToken||typeof reportPath!=='string'||!reportPath)
    throw new Error('ANNOTATION_PROBE_READ_IDENTITY_INVALID');
  const [{buildCorrectedVersionIdentity},{DEPLOYED_ONE_SHOT_WORKER_ID}]=await Promise.all([
    import('./corrected-version-preparation.mjs'),import('./deployed-one-shot.mjs')
  ]);
  const expected=buildCorrectedVersionIdentity(ANNOTATION_PROBE_CREATION_SHA).metadata.annotations;
  const enc=x=>encodeURIComponent(x);
  const root='https://api.cloudflare.com/client/v4/accounts/'+enc(accountId);
  const stableUrl=root+'/workers/scripts/'+ANNOTATION_PROBE_WORKER+'/versions/'+ANNOTATION_PROBE_VERSION_ID;
  const betaUrl=root+'/workers/workers/'+enc(DEPLOYED_ONE_SHOT_WORKER_ID)+
    '/versions/'+ANNOTATION_PROBE_VERSION_ID+'?include=modules';
  const stable=await requestExactVersion(stableUrl,readToken);
  const beta=await requestExactVersion(betaUrl,readToken);
  const diagnostic=diagnoseCorrectedAnnotations({stable,beta,versionId:ANNOTATION_PROBE_VERSION_ID,expected});
  fs.writeFileSync(reportPath,JSON.stringify(diagnostic,null,2)+'\n',{mode:0o600});
  // A successful probe is NOT a successful Version reconciliation.
  console.log(JSON.stringify({probeRecorded:true,classification:diagnostic.classification,
    versionQualified:false}));
  return diagnostic;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  main().catch(()=>{console.error('ANNOTATION_PROBE_STOP');process.exitCode=1;});
