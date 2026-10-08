// Identity boundary for a POSSIBLE FUTURE corrected Version carrying the Gate C forensic corrections:
//   R1 closed schema-failure diagnostics (http_class, sub-reason, content-type class, size bucket, quota-header state)
//   R2 planner generation isolation (readPlannerFixtures reads the head generation's own membership revisions).
//
// STATE: NOT CREATED, NOT UPLOADED, NOT DEPLOYED. This module only computes and pins the identity of the CURRENT TREE.
// It has no upload form, no Cloudflare request, no Deployment, no D1, no provider path and no secret handling. Creating,
// uploading, deploying or using such a Version needs its own owner-approved gates; nothing here authorises any of them.
//
// BOUNDARY: the existing Version 4171f3cf-953e-452e-9e5f-068df9a3ca47 is immutable and is verified from SHA-256-verified
// historical snapshots (reviewed-remediated-snapshots.mjs). This module deliberately does NOT import those snapshots: the
// historical bytes can never be the source of a corrected Version. Reading them here would be rejected by the pins below,
// because the changed modules differ by design.
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {stableStringify} from '../../src/decision-intelligence/canonical.mjs';
import {ENTRY_MODULE,REVIEWED_MODULE_PATHS,buildUploadModules,resolveModuleGraph} from './stage-inactive-version.mjs';

export const CORRECTED_VERSION_CANDIDATE_CONTRACT='api-football-gate-c-forensic-corrected-version-candidate-v1';
export const CORRECTED_VERSION_CANDIDATE_STATE='NOT_CREATED_NOT_UPLOADED_NOT_DEPLOYED';
// The deployed Version this candidate would eventually supersede. Referenced for provenance only.
export const CORRECTED_VERSION_CANDIDATE_SUPERSEDES_VERSION_ID='4171f3cf-953e-452e-9e5f-068df9a3ca47';

// Reviewed upload-module hashes of the current tree (R1/R2). Any change to any of the 17 modules fails closed until a new
// owner-reviewed pin is committed. These pins describe a candidate only; they are not the deployed Version's pins.
export const CORRECTED_VERSION_CANDIDATE_MODULE_SHA256=Object.freeze({
  'collector.mjs':'55d9d253bb9508960a1df7ee7a20e946cc1da712f6ae5e86b3220bca1e35302a',
  'modules/src/decision-intelligence/api-football-discovery.mjs':'e4da37d8e222223d9e4c34941b03acf4db22940c7bc5d6d44b798b7d650c7d3f',
  'modules/src/decision-intelligence/api-football-foundation.mjs':'75f43d0c467f5375f0743940b762d95df2368f60114d8ae1b49df8ac5eb47474',
  'modules/src/decision-intelligence/api-football-shadow-contracts.mjs':'f403910fb16e149cfcc0ef79b4dd153b0f83ff0feb0846757266da910de0dd72',
  'modules/src/decision-intelligence/canonical.mjs':'097f916793cb683ab630b0d48c065774968219f21237e922476733ab5b034ced',
  'modules/src/decision-intelligence/eia1-safety.mjs':'1b05c9675342ba10a5060cbab1a66b439938c1266eaaaf7cc6d8a0ffd5c9e649',
  'modules/src/decision-intelligence/eia1-workload-contract.mjs':'b7ea0ec26f347a1318dfb521666388e81dac002e3fdf02ab16181283c90306bd',
  'modules/src/decision-intelligence/observation.mjs':'35b4cdb1d4d37f61b38004c08d614e2f0f885c00f8a97cf259eee580b0ff7cd7',
  'modules/src/decision-intelligence/official-fpl-history-canonical.mjs':'8ba323190a4cfa53dd6891ad827fa728326532d4dcc671d0c85e7789f4b38afe',
  'modules/src/decision-intelligence/rights.mjs':'64df6baae041fe286a6845c25c6efd4529795deebe89585c728c82a06f9560ba',
  'modules/workers/api-football-collector/activation-orchestrator.mjs':'c4b01d8a770e9c346d0a9ff6ee6f75f270efc3bc9f54d6b149e70c9dd9857171',
  'modules/workers/api-football-collector/d1-persistence.mjs':'716ec4c14d35ac876eafb6f80f93c3ec57a1ea07009e6785d70a3ae936cb5e0d',
  'modules/workers/api-football-collector/mapping-runtime.mjs':'b99c2c9dbd4a408d35c92a07ccf32af35dc532441bbc6bef4c25195d55314fd6',
  'modules/workers/api-football-collector/planner-orchestrator.mjs':'79e5ee5c70ff6cf8ca1c1c0f8d6bd7d8a24ea770c45b827cb4d436329964cd8a',
  'modules/workers/api-football-collector/runtime-contracts.mjs':'d609b11f350ed188c5108c05b00df55f9fca5d92291e765b67d3805b1d6c98f1',
  'modules/workers/api-football-collector/scheduler.mjs':'ab90effc98e4eac704acfdbebc70828411ab0152b9df7f88ed1654cb56f3a6c8',
  'modules/workers/api-football-collector/semantic-validation.mjs':'9a190abd849961420b92731bd8a79d0fcd77bd6b319977cbf997cf5d1e080ecd'
});
// The only modules that differ from the deployed Version. Everything else is byte-identical.
export const CORRECTED_VERSION_CANDIDATE_CHANGED_FROM_DEPLOYED=Object.freeze([
  'collector.mjs',
  'modules/workers/api-football-collector/activation-orchestrator.mjs',
  'modules/workers/api-football-collector/planner-orchestrator.mjs',
  'modules/workers/api-football-collector/runtime-contracts.mjs',
  'modules/workers/api-football-collector/semantic-validation.mjs'
]);

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const sha256=value=>createHash('sha256').update(value).digest('hex');
const fail=code=>{throw new Error(code);};

// Working-tree reader for reviewed paths only. There is no snapshot indirection.
export function readCorrectedCandidateModuleSource(repoPath){
  if(!REVIEWED_MODULE_PATHS.includes(repoPath))fail('corrected_version_candidate_unreviewed_module');
  return fs.readFileSync(path.join(root,repoPath),'utf8');
}

export function correctedVersionCandidateModuleSha256({readFile=readCorrectedCandidateModuleSource}={}){
  const modules=buildUploadModules(resolveModuleGraph({readFile}));
  return Object.freeze(Object.fromEntries([...modules].sort(([a],[b])=>a.localeCompare(b)).map(([name,source])=>[name,sha256(source)])));
}

export function buildCorrectedVersionCandidateIdentity(options={}){
  const moduleSha256=correctedVersionCandidateModuleSha256(options),pinned=CORRECTED_VERSION_CANDIDATE_MODULE_SHA256;
  const names=Object.keys(moduleSha256);
  if(JSON.stringify(names.slice().sort())!==JSON.stringify(Object.keys(pinned).sort())||names.length!==REVIEWED_MODULE_PATHS.length||
    names.some(name=>moduleSha256[name]!==pinned[name]))fail('corrected_version_candidate_source_drift');
  const graphSha256=sha256(stableStringify({contract:CORRECTED_VERSION_CANDIDATE_CONTRACT,supersedes:CORRECTED_VERSION_CANDIDATE_SUPERSEDES_VERSION_ID,entryModule:ENTRY_MODULE,moduleSha256}));
  return Object.freeze({
    contract:CORRECTED_VERSION_CANDIDATE_CONTRACT,state:CORRECTED_VERSION_CANDIDATE_STATE,
    supersedesVersionId:CORRECTED_VERSION_CANDIDATE_SUPERSEDES_VERSION_ID,entryModule:ENTRY_MODULE,
    moduleSha256,graphSha256,uploadAuthorized:false,deploymentAuthorized:false
  });
}
