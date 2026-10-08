// Transport-remediated reviewed Version identity and builder (repository only; no live action).
//
// The immutable attended Version 04d79556 (and the historical clone) are reproduced byte-for-byte from SHA-256-pinned
// snapshots by the HISTORICAL builder in attended-version.mjs / stage-inactive-version.mjs. That path must never be used
// to create a new Version: it would re-upload the old redirect:'error' provider request.
//
// This module is the identity of the DEPLOYED, IMMUTABLE transport-remediated Version 4171f3cf (created from f01ccff5,
// promoted by Gate B). Its default reader is the SHA-256-verified snapshot set in reviewed-remediated-snapshots.mjs, so
// the identity stays bound to the deployed bytes and cannot drift when the working tree moves on. The pins below were
// NOT changed to follow later source edits. The current tree (which now carries the Gate C forensic R1/R2 corrections)
// is a DIFFERENT identity and lives in corrected-version-candidate.mjs, which has no upload or deploy surface.
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {stableStringify} from '../../src/decision-intelligence/canonical.mjs';
import {expectedAttendedBindings} from './attended-version.mjs';
import {
  ENTRY_MODULE,EXPECTED_COMPATIBILITY_DATE,REVIEWED_MODULE_PATHS,WORKER_NAME,buildUploadModules,resolveModuleGraph
} from './stage-inactive-version.mjs';
import {ATTENDED_VERSION_ID,ATTENDED_VERSION_MODULE_SHA256,ORIGINAL_BLOCKED_VERSION_ID} from './attended-version.mjs';
import {GATE_C_CLONE_VERSION_ID} from './replacement-foundation.mjs';
import {readReviewedRemediatedModuleSource} from './reviewed-remediated-snapshots.mjs';

export const TRANSPORT_REMEDIATED_VERSION_CONTRACT='api-football-transport-remediated-version-v1';
export const TRANSPORT_REMEDIATED_VERSION_WORKER=WORKER_NAME;
// Every Version that exists before the remediated candidate is created. The candidate must be none of these.
export const TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS=Object.freeze([ORIGINAL_BLOCKED_VERSION_ID,ATTENDED_VERSION_ID,GATE_C_CLONE_VERSION_ID]);
// Reviewed current-tree module hashes of main 53f94ab (PR #313). Any change to any of the 17 modules fails closed
// until a new owner-reviewed pin is committed. Names are the canonical upload-module names (rewritten specifiers).
export const TRANSPORT_REMEDIATED_VERSION_MODULE_SHA256=Object.freeze({
  'modules/src/decision-intelligence/api-football-discovery.mjs':'e4da37d8e222223d9e4c34941b03acf4db22940c7bc5d6d44b798b7d650c7d3f',
  'modules/src/decision-intelligence/api-football-foundation.mjs':'75f43d0c467f5375f0743940b762d95df2368f60114d8ae1b49df8ac5eb47474',
  'modules/src/decision-intelligence/api-football-shadow-contracts.mjs':'f403910fb16e149cfcc0ef79b4dd153b0f83ff0feb0846757266da910de0dd72',
  'modules/src/decision-intelligence/canonical.mjs':'097f916793cb683ab630b0d48c065774968219f21237e922476733ab5b034ced',
  'modules/src/decision-intelligence/eia1-safety.mjs':'1b05c9675342ba10a5060cbab1a66b439938c1266eaaaf7cc6d8a0ffd5c9e649',
  'modules/src/decision-intelligence/eia1-workload-contract.mjs':'b7ea0ec26f347a1318dfb521666388e81dac002e3fdf02ab16181283c90306bd',
  'modules/src/decision-intelligence/observation.mjs':'35b4cdb1d4d37f61b38004c08d614e2f0f885c00f8a97cf259eee580b0ff7cd7',
  'modules/src/decision-intelligence/official-fpl-history-canonical.mjs':'8ba323190a4cfa53dd6891ad827fa728326532d4dcc671d0c85e7789f4b38afe',
  'modules/src/decision-intelligence/rights.mjs':'64df6baae041fe286a6845c25c6efd4529795deebe89585c728c82a06f9560ba',
  'modules/workers/api-football-collector/activation-orchestrator.mjs':'bd2afe5f58441086e42f24a6c5b2f811786a84e387c61ba367d2430339828685',
  'collector.mjs':'78cf70e84fd247d272ee151c7dbb83794961e06ac413cfae127274f1aba5e6c3',
  'modules/workers/api-football-collector/d1-persistence.mjs':'716ec4c14d35ac876eafb6f80f93c3ec57a1ea07009e6785d70a3ae936cb5e0d',
  'modules/workers/api-football-collector/mapping-runtime.mjs':'b99c2c9dbd4a408d35c92a07ccf32af35dc532441bbc6bef4c25195d55314fd6',
  'modules/workers/api-football-collector/planner-orchestrator.mjs':'8e3f2954e9b957b9f1465c1ce0819ad17f204c7f175f7d338cc21b0468c9aa89',
  'modules/workers/api-football-collector/runtime-contracts.mjs':'b4b4991622c22f0888f88717dee58c4bcad75010c737a01ca5622bcac41eccb6',
  'modules/workers/api-football-collector/scheduler.mjs':'ab90effc98e4eac704acfdbebc70828411ab0152b9df7f88ed1654cb56f3a6c8',
  'modules/workers/api-football-collector/semantic-validation.mjs':'9e9cdc11aea2c2dd63c700c9f7aa5b7de3e1f5a5794e5fb9fcbcdfbcfd1c0328'
});

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const HEX40=/^[0-9a-f]{40}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha256=value=>createHash('sha256').update(value).digest('hex');
const fail=code=>{throw new Error(code);};

// Current-tree reader. It deliberately has no snapshot indirection: it reads the working-tree bytes of reviewed paths only.
// It is NOT the default of this module's identity builders any more: the deployed Version is verified from snapshots.
export function readCurrentTreeModuleSource(repoPath){
  if(!REVIEWED_MODULE_PATHS.includes(repoPath))fail('collector_transport_remediated_unreviewed_module');
  return fs.readFileSync(path.join(root,repoPath),'utf8');
}

export function resolveTransportRemediatedModuleGraph({readFile=readReviewedRemediatedModuleSource}={}){
  return resolveModuleGraph({readFile});
}

// The corrected provider request contract must be present in the exact bytes that would be uploaded.
export function assertTransportRemediatedRequestContract(modules){
  const foundation=modules?.get?.('modules/src/decision-intelligence/api-football-foundation.mjs');
  const collector=modules?.get?.(ENTRY_MODULE);
  if(typeof foundation!=='string'||typeof collector!=='string')fail('collector_transport_remediated_request_contract_invalid');
  if(!/API_FOOTBALL_REQUEST_REDIRECT_MODE='manual'/.test(foundation)||
    !/init:\{method:'GET',redirect:API_FOOTBALL_REQUEST_REDIRECT_MODE,headers:Object\.freeze\(\{'x-apisports-key':apiKey\}\)\}/.test(foundation)||
    !/API_FOOTBALL_REQUEST_HEADER_NAMES=Object\.freeze\(\['x-apisports-key'\]\)/.test(foundation))fail('collector_transport_remediated_request_contract_invalid');
  for(const source of [foundation,collector])
    if(/redirect\s*:\s*'error'/.test(source)||/accept\s*:\s*'application\/json'/i.test(source))fail('collector_transport_remediated_request_contract_invalid');
  return true;
}

export function transportRemediatedModuleSha256(options={}){
  const modules=buildUploadModules(resolveTransportRemediatedModuleGraph(options));
  assertTransportRemediatedRequestContract(modules);
  return Object.freeze(Object.fromEntries([...modules].sort(([a],[b])=>a.localeCompare(b)).map(([name,source])=>[name,sha256(source)])));
}

// Metadata WITHOUT secret values: names and types only. Safe to hash, log and serialize.
export function transportRemediatedPublicMetadata(identityFields){
  return Object.freeze({
    main_module:identityFields.mainModule,compatibility_date:identityFields.compatibilityDate,
    bindings:expectedAttendedBindings().map(binding=>binding.type==='secret_text'?{name:binding.name,type:binding.type}:{...binding}),
    annotations:{'workers/message':identityFields.message,'workers/tag':identityFields.tag}
  });
}

export function buildTransportRemediatedVersionIdentity(approvedSha,options={}){
  if(!HEX40.test(String(approvedSha||'')))fail('collector_transport_remediated_approved_sha_invalid');
  const moduleSha256=transportRemediatedModuleSha256(options);
  const names=Object.keys(moduleSha256),pinned=TRANSPORT_REMEDIATED_VERSION_MODULE_SHA256;
  if(JSON.stringify(names.slice().sort())!==JSON.stringify(Object.keys(pinned).sort())||names.length!==REVIEWED_MODULE_PATHS.length||
    names.some(name=>moduleSha256[name]!==pinned[name]))fail('collector_transport_remediated_source_drift');
  const fields={
    mainModule:ENTRY_MODULE,compatibilityDate:EXPECTED_COMPATIBILITY_DATE,
    message:'API-Football transport-remediated attended Version from '+approvedSha,
    tag:'api-football-transport-remediated-'+approvedSha.slice(0,12)
  };
  const metadataSha256=sha256(stableStringify(transportRemediatedPublicMetadata(fields)));
  const graphSha256=sha256(stableStringify({contract:TRANSPORT_REMEDIATED_VERSION_CONTRACT,approvedSha,entryModule:ENTRY_MODULE,metadataSha256,moduleSha256}));
  return Object.freeze({
    contract:TRANSPORT_REMEDIATED_VERSION_CONTRACT,approvedSha,...fields,
    moduleSha256,metadataSha256,graphSha256
  });
}

export function validateTransportRemediatedSecretMaterial({apiKey,triggerSecret}={}){
  if(typeof apiKey!=='string'||!apiKey||typeof triggerSecret!=='string'||triggerSecret.length<32||apiKey===triggerSecret)fail('collector_transport_remediated_secret_material_invalid');
  return true;
}

export function buildTransportRemediatedVersionUploadMetadata(approvedSha,secrets={},options={}){
  const identity=buildTransportRemediatedVersionIdentity(approvedSha,options);
  validateTransportRemediatedSecretMaterial(secrets);
  return {
    main_module:identity.mainModule,compatibility_date:identity.compatibilityDate,
    bindings:expectedAttendedBindings().map(binding=>binding.type==='secret_text'?{...binding,text:binding.name==='API_FOOTBALL_API_KEY'?secrets.apiKey:secrets.triggerSecret}:{...binding}),
    annotations:{'workers/message':identity.message,'workers/tag':identity.tag}
  };
}

export function buildTransportRemediatedVersionUploadForm(approvedSha,secrets,options={}){
  const metadata=buildTransportRemediatedVersionUploadMetadata(approvedSha,secrets,options);
  const modules=buildUploadModules(resolveTransportRemediatedModuleGraph(options));
  const form=new FormData();form.set('metadata',JSON.stringify(metadata));
  for(const [name,source] of [...modules].sort(([a],[b])=>a.localeCompare(b)))form.set(name,new File([source],name,{type:'application/javascript+module'}));
  return form;
}

function exactBindings(rows,expected){
  if(!Array.isArray(rows)||rows.length!==expected.length)return false;
  const actual=new Map();for(const row of rows){if(!row||actual.has(row.name))return false;actual.set(row.name,row);}
  return expected.every(binding=>{
    const row=actual.get(binding.name);if(!row||row.type!==binding.type)return false;
    if(binding.type==='d1')return row.database_id===binding.database_id;
    if(binding.type==='plain_text')return String(row.text)===String(binding.text);
    return binding.type==='secret_text'&&!Object.hasOwn(row,'text');
  });
}

// Validates a created candidate from Cloudflare stable + beta Version detail. Read-only; exposes no secret value.
export function validateTransportRemediatedVersion({stableVersion,betaVersion,versionId,identity}={}){
  if(!UUID.test(String(versionId||''))||stableVersion?.id!==versionId||betaVersion?.id!==versionId)return fail('collector_transport_remediated_version_identity_drift');
  if(TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS.includes(versionId))return fail('collector_transport_remediated_version_not_new');
  if(identity?.contract!==TRANSPORT_REMEDIATED_VERSION_CONTRACT||!HEX40.test(String(identity.approvedSha||'')))return fail('collector_transport_remediated_identity_invalid');
  if(stableVersion.resources?.script_runtime?.compatibility_date!==identity.compatibilityDate)return fail('collector_transport_remediated_runtime_drift');
  if(!exactBindings(stableVersion.resources?.bindings,expectedAttendedBindings()))return fail('collector_transport_remediated_binding_drift');
  if(betaVersion.main_module!==identity.mainModule||betaVersion.compatibility_date!==identity.compatibilityDate)return fail('collector_transport_remediated_runtime_drift');
  if(betaVersion.annotations?.['workers/message']!==identity.message||betaVersion.annotations?.['workers/tag']!==identity.tag)return fail('collector_transport_remediated_annotation_drift');
  if(betaVersion.urls!==undefined&&(!Array.isArray(betaVersion.urls)||betaVersion.urls.length!==0))return fail('collector_transport_remediated_version_routable');
  if(Array.isArray(betaVersion.package_dependencies)&&betaVersion.package_dependencies.length!==0)return fail('collector_transport_remediated_package_dependency_detected');
  const expected=identity.moduleSha256;
  if(!Array.isArray(betaVersion.modules)||betaVersion.modules.length!==Object.keys(expected).length)return fail('collector_transport_remediated_module_set_drift');
  const seen=new Set();for(const module of betaVersion.modules){
    if(!module||typeof module.name!=='string'||seen.has(module.name)||typeof module.content_base64!=='string'||!expected[module.name])return fail('collector_transport_remediated_module_set_drift');
    if(sha256(Buffer.from(module.content_base64,'base64'))!==expected[module.name])return fail('collector_transport_remediated_module_content_drift');
    seen.add(module.name);
  }
  if(seen.size!==REVIEWED_MODULE_PATHS.length)return fail('collector_transport_remediated_module_set_drift');
  return true;
}

// Historical immutable Version module hashes, exposed so tests and reconciliation can prove the old and new graphs differ.
export const TRANSPORT_REMEDIATED_CHANGED_FROM_ATTENDED=Object.freeze(
  Object.keys(ATTENDED_VERSION_MODULE_SHA256).filter(name=>ATTENDED_VERSION_MODULE_SHA256[name]!==TRANSPORT_REMEDIATED_VERSION_MODULE_SHA256[name])
);
