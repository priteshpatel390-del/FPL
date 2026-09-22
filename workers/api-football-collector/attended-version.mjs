import {createHash} from 'node:crypto';
import {
  ATTENDED_ACTIVATION,ATTENDED_SECRET_BINDINGS,ENTRY_MODULE,EXPECTED_BINDING_NAME,EXPECTED_COMPATIBILITY_DATE,
  EXPECTED_PLAIN_TEXT_VARS,REVIEWED_MODULE_PATHS,WORKER_NAME,buildUploadModules,performVersionUpload,resolveModuleGraph
} from './stage-inactive-version.mjs';
import {EXPECTED_D1_DATABASE_ID} from '../data-platform/phase4b/live-contract.mjs';

export const ORIGINAL_BLOCKED_VERSION_ID='e49ac8f2-4289-46bc-9f0b-87a20cd7be62';
export const ORIGINAL_BLOCKED_VERSION_ACTIVATION='REPOSITORY_ONLY_BLOCKED';
export const ORIGINAL_BLOCKED_VERSION_APPROVED_SHA='302dc21cc4b821ac8b224d176765a29c0724a244';
export const ATTENDED_VERSION_ID='04d79556-3070-429f-9944-b5b53d799842';
export const ATTENDED_VERSION_APPROVED_SHA='69bb84fadbcce94e9fece3ff438d985866cce183';
export const ORIGINAL_BLOCKED_VERSION_MODULE_SHA256=Object.freeze({
  'modules/src/decision-intelligence/api-football-discovery.mjs':'e4da37d8e222223d9e4c34941b03acf4db22940c7bc5d6d44b798b7d650c7d3f',
  'modules/src/decision-intelligence/api-football-foundation.mjs':'fecb1e70137c6a6cfda0a63f91f595497a973806a95e6ff500ac3124c29a2b9d',
  'modules/src/decision-intelligence/api-football-shadow-contracts.mjs':'f403910fb16e149cfcc0ef79b4dd153b0f83ff0feb0846757266da910de0dd72',
  'modules/src/decision-intelligence/canonical.mjs':'097f916793cb683ab630b0d48c065774968219f21237e922476733ab5b034ced',
  'modules/src/decision-intelligence/eia1-safety.mjs':'1b05c9675342ba10a5060cbab1a66b439938c1266eaaaf7cc6d8a0ffd5c9e649',
  'modules/src/decision-intelligence/eia1-workload-contract.mjs':'b7ea0ec26f347a1318dfb521666388e81dac002e3fdf02ab16181283c90306bd',
  'modules/src/decision-intelligence/observation.mjs':'35b4cdb1d4d37f61b38004c08d614e2f0f885c00f8a97cf259eee580b0ff7cd7',
  'modules/src/decision-intelligence/official-fpl-history-canonical.mjs':'8ba323190a4cfa53dd6891ad827fa728326532d4dcc671d0c85e7789f4b38afe',
  'modules/src/decision-intelligence/rights.mjs':'64df6baae041fe286a6845c25c6efd4529795deebe89585c728c82a06f9560ba',
  'modules/workers/api-football-collector/activation-orchestrator.mjs':'bd2afe5f58441086e42f24a6c5b2f811786a84e387c61ba367d2430339828685',
  'collector.mjs':'9c956c37e59a7165533eb98d6face03b0ae2e137a1931bfdd62b67d60895a888',
  'modules/workers/api-football-collector/d1-persistence.mjs':'716ec4c14d35ac876eafb6f80f93c3ec57a1ea07009e6785d70a3ae936cb5e0d',
  'modules/workers/api-football-collector/mapping-runtime.mjs':'b99c2c9dbd4a408d35c92a07ccf32af35dc532441bbc6bef4c25195d55314fd6',
  'modules/workers/api-football-collector/planner-orchestrator.mjs':'8e3f2954e9b957b9f1465c1ce0819ad17f204c7f175f7d338cc21b0468c9aa89',
  'modules/workers/api-football-collector/runtime-contracts.mjs':'b4b4991622c22f0888f88717dee58c4bcad75010c737a01ca5622bcac41eccb6',
  'modules/workers/api-football-collector/scheduler.mjs':'ab90effc98e4eac704acfdbebc70828411ab0152b9df7f88ed1654cb56f3a6c8',
  'modules/workers/api-football-collector/semantic-validation.mjs':'9e9cdc11aea2c2dd63c700c9f7aa5b7de3e1f5a5794e5fb9fcbcdfbcfd1c0328'
});
export const ATTENDED_VERSION_MODULE_SHA256=Object.freeze({...ORIGINAL_BLOCKED_VERSION_MODULE_SHA256,
  'collector.mjs':'7cd42f9fe74a91dbd9eeeb024446409b767e4dd271f6736a8b3bb4c2f865817d'
});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX40=/^[0-9a-f]{40}$/;
const sha256=value=>createHash('sha256').update(value).digest('hex');
const fail=code=>{throw new Error(code);};

export function expectedAttendedBindings(){
  return Object.freeze([
    Object.freeze({name:EXPECTED_BINDING_NAME,type:'d1',database_id:EXPECTED_D1_DATABASE_ID}),
    Object.freeze({name:'API_FOOTBALL_FPL_SEASON',type:'plain_text',text:EXPECTED_PLAIN_TEXT_VARS.API_FOOTBALL_FPL_SEASON}),
    Object.freeze({name:'API_FOOTBALL_PROVIDER_SEASON',type:'plain_text',text:EXPECTED_PLAIN_TEXT_VARS.API_FOOTBALL_PROVIDER_SEASON}),
    Object.freeze({name:'EIA_2I5D_ACTIVATION',type:'plain_text',text:ATTENDED_ACTIVATION}),
    ...ATTENDED_SECRET_BINDINGS.map(name=>Object.freeze({name,type:'secret_text'}))
  ]);
}

export function buildReviewedAttendedIdentity(approvedSha,{readFile}={}){
  if(!HEX40.test(String(approvedSha||'')))fail('collector_attended_approved_sha_invalid');
  const modules=buildUploadModules(resolveModuleGraph(readFile?{readFile}:{}));
  return Object.freeze({
    approvedSha,mainModule:ENTRY_MODULE,compatibilityDate:EXPECTED_COMPATIBILITY_DATE,
    message:'API-Football attended acceptance from '+approvedSha,
    tag:'api-football-attended-'+approvedSha.slice(0,12),
    moduleSha256:Object.freeze(Object.fromEntries([...modules].map(([name,source])=>[name,sha256(source)])))
  });
}

export function buildImmutableAttendedVersionIdentity(versionApprovedSha=ATTENDED_VERSION_APPROVED_SHA){
  if(versionApprovedSha!==ATTENDED_VERSION_APPROVED_SHA)fail('collector_attended_version_provenance_invalid');
  return Object.freeze({
    approvedSha:ATTENDED_VERSION_APPROVED_SHA,mainModule:ENTRY_MODULE,compatibilityDate:EXPECTED_COMPATIBILITY_DATE,
    message:'API-Football attended acceptance from '+ATTENDED_VERSION_APPROVED_SHA,
    tag:'api-football-attended-'+ATTENDED_VERSION_APPROVED_SHA.slice(0,12),moduleSha256:ATTENDED_VERSION_MODULE_SHA256
  });
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

function originalExpectedBindings(){
  return expectedAttendedBindings().slice(0,4).map(binding=>binding.name==='EIA_2I5D_ACTIVATION'?{...binding,text:ORIGINAL_BLOCKED_VERSION_ACTIVATION}:binding);
}

export function validateOriginalBlockedVersion({stableVersion,betaVersion}={}){
  if(stableVersion?.id!==ORIGINAL_BLOCKED_VERSION_ID||stableVersion.resources?.script_runtime?.compatibility_date!==EXPECTED_COMPATIBILITY_DATE||
    !exactBindings(stableVersion.resources?.bindings,originalExpectedBindings()))fail('collector_attended_original_version_not_inert');
  if(!betaVersion||betaVersion.id!==ORIGINAL_BLOCKED_VERSION_ID||betaVersion.main_module!==ENTRY_MODULE||
    betaVersion.compatibility_date!==EXPECTED_COMPATIBILITY_DATE||betaVersion.number!==1||
    betaVersion.annotations?.['workers/message']!=='API-Football collector inactive staging from '+ORIGINAL_BLOCKED_VERSION_APPROVED_SHA||
    betaVersion.annotations?.['workers/tag']!=='api-football-collector-inactive-'+ORIGINAL_BLOCKED_VERSION_APPROVED_SHA.slice(0,12)||
    (Array.isArray(betaVersion.urls)&&betaVersion.urls.length!==0)||
    (Array.isArray(betaVersion.package_dependencies)&&betaVersion.package_dependencies.length!==0)||
    !Array.isArray(betaVersion.modules)||betaVersion.modules.length!==Object.keys(ORIGINAL_BLOCKED_VERSION_MODULE_SHA256).length)fail('collector_attended_original_version_content_drift');
  const seen=new Set();
  for(const module of betaVersion.modules){
    if(!module||typeof module.name!=='string'||seen.has(module.name)||typeof module.content_base64!=='string')fail('collector_attended_original_version_content_drift');
    const expected=ORIGINAL_BLOCKED_VERSION_MODULE_SHA256[module.name];
    if(!expected||sha256(Buffer.from(module.content_base64,'base64'))!==expected)fail('collector_attended_original_version_content_drift');
    seen.add(module.name);
  }
  if(seen.size!==Object.keys(ORIGINAL_BLOCKED_VERSION_MODULE_SHA256).length)fail('collector_attended_original_version_content_drift');
  return true;
}

export function validateOriginalPreparationInventory({versionIds,originalStable,originalBeta}={}){
  if(!Array.isArray(versionIds)||versionIds.length!==1||versionIds[0]!==ORIGINAL_BLOCKED_VERSION_ID)fail('collector_attended_preparation_inventory_invalid');
  validateOriginalBlockedVersion({stableVersion:originalStable,betaVersion:originalBeta});
  return true;
}

export function validateReviewedAttendedVersion({stableVersion,betaVersion,versionId,identity}={}){
  if(!UUID.test(String(versionId||''))||stableVersion?.id!==versionId||betaVersion?.id!==versionId)return fail('collector_attended_version_identity_drift');
  if(!identity||!HEX40.test(String(identity.approvedSha||'')))return fail('collector_attended_review_identity_invalid');
  if(stableVersion.resources?.script_runtime?.compatibility_date!==identity.compatibilityDate)return fail('collector_attended_runtime_drift');
  if(!exactBindings(stableVersion.resources?.bindings,expectedAttendedBindings()))return fail('collector_attended_binding_drift');
  if(betaVersion.main_module!==identity.mainModule||betaVersion.compatibility_date!==identity.compatibilityDate)return fail('collector_attended_runtime_drift');
  if(betaVersion.annotations?.['workers/message']!==identity.message||betaVersion.annotations?.['workers/tag']!==identity.tag)return fail('collector_attended_annotation_drift');
  if(!Array.isArray(betaVersion.modules)||betaVersion.modules.length!==Object.keys(identity.moduleSha256).length)return fail('collector_attended_module_set_drift');
  const seen=new Set();for(const module of betaVersion.modules){
    if(!module||typeof module.name!=='string'||seen.has(module.name)||typeof module.content_base64!=='string'||!identity.moduleSha256[module.name])return fail('collector_attended_module_set_drift');
    if(sha256(Buffer.from(module.content_base64,'base64'))!==identity.moduleSha256[module.name])return fail('collector_attended_module_content_drift');
    seen.add(module.name);
  }
  if(seen.size!==REVIEWED_MODULE_PATHS.length)return fail('collector_attended_module_set_drift');
  return true;
}

export function validateClosedVersionInventory({versionIds,originalStable,attendedVersionId,attendedStable,attendedBeta,identity}={}){
  if(!Array.isArray(versionIds)||versionIds.length!==2||new Set(versionIds).size!==2||
    !versionIds.includes(ORIGINAL_BLOCKED_VERSION_ID)||!versionIds.includes(attendedVersionId))fail('collector_attended_version_inventory_drift');
  if(originalStable?.id!==ORIGINAL_BLOCKED_VERSION_ID||!exactBindings(originalStable?.resources?.bindings,originalExpectedBindings()))fail('collector_attended_original_version_not_inert');
  validateReviewedAttendedVersion({stableVersion:attendedStable,betaVersion:attendedBeta,versionId:attendedVersionId,identity});
  return true;
}

export function deriveVersionPreviewUrl({versionId,previewUrlSuffix,accountSubdomain,path}={}){
  if(!UUID.test(String(versionId||''))||typeof previewUrlSuffix!=='string'||typeof accountSubdomain!=='string'||!/^[a-z0-9-]+$/.test(accountSubdomain))fail('collector_attended_preview_identity_invalid');
  const expectedSuffix='-'+WORKER_NAME+'.'+accountSubdomain+'.workers.dev';
  if(previewUrlSuffix!==expectedSuffix||previewUrlSuffix.includes('/')||previewUrlSuffix.includes('@')||previewUrlSuffix.includes(':'))fail('collector_attended_preview_identity_invalid');
  if(typeof path!=='string'||!path.startsWith('/')||path.includes('?')||path.includes('#'))fail('collector_attended_preview_identity_invalid');
  const url=new URL('https://'+versionId.slice(0,8)+previewUrlSuffix+path);
  if(url.protocol!=='https:'||url.port||url.username||url.password||url.search||url.hash||url.pathname!==path||url.hostname!==versionId.slice(0,8)+previewUrlSuffix)return fail('collector_attended_preview_identity_invalid');
  return url;
}

export function buildAttendedVersionUploadMetadata(approvedSha,{apiKey,triggerSecret}={}){
  const identity=buildReviewedAttendedIdentity(approvedSha);
  if(typeof apiKey!=='string'||!apiKey||typeof triggerSecret!=='string'||triggerSecret.length<32||apiKey===triggerSecret)fail('collector_attended_secret_material_invalid');
  return {
    main_module:ENTRY_MODULE,compatibility_date:EXPECTED_COMPATIBILITY_DATE,
    bindings:expectedAttendedBindings().map(binding=>binding.type==='secret_text'?{...binding,text:binding.name==='API_FOOTBALL_API_KEY'?apiKey:triggerSecret}:{...binding}),
    annotations:{'workers/message':identity.message,'workers/tag':identity.tag}
  };
}

export function buildAttendedVersionUploadForm(approvedSha,secrets,{readFile}={}){
  const metadata=buildAttendedVersionUploadMetadata(approvedSha,secrets),modules=buildUploadModules(resolveModuleGraph(readFile?{readFile}:{}));
  const form=new FormData();form.set('metadata',JSON.stringify(metadata));
  for(const [name,source] of [...modules].sort(([a],[b])=>a.localeCompare(b)))form.set(name,new File([source],name,{type:'application/javascript+module'}));
  return form;
}

export async function prepareFinalAttendedVersion({request,readVersions,accountId,approvedSha,secrets,beforeIds=[ORIGINAL_BLOCKED_VERSION_ID]}={}){
  if(!Array.isArray(beforeIds)||beforeIds.length!==1||beforeIds[0]!==ORIGINAL_BLOCKED_VERSION_ID)fail('collector_attended_preparation_inventory_invalid');
  const result=await performVersionUpload({request,readVersions,accountId,multipart:buildAttendedVersionUploadForm(approvedSha,secrets),beforeIds});
  if(!['definite','reconciled'].includes(result.disposition))fail('collector_attended_preparation_ambiguous_reconciliation_required_no_retry');
  if(result.versionId===ORIGINAL_BLOCKED_VERSION_ID||result.afterIds.length!==2||!result.afterIds.includes(ORIGINAL_BLOCKED_VERSION_ID))fail('collector_attended_preparation_version_delta_invalid');
  return result;
}
