// HISTORICAL-ONLY, SHA-256-verified byte snapshots of the 17 reviewed modules of the deployed, immutable
// transport-remediated Version 4171f3cf-953e-452e-9e5f-068df9a3ca47 (created by Gate A run 37680114065 from
// creation commit f01ccff5b13a4bbc98d7927cf620f69f46c4c54c; promoted by Gate B run 37688525299).
//
// Purpose: keep Gate A/B/C identity verification bound to the bytes that are actually deployed, independent of
// later working-tree changes. Every snapshot is the verbatim `git show <creation-sha>:<path>` content and is
// verified against a raw-byte SHA-256 on every read; any drift fails closed.
//
// BOUNDARY: this module is for verifying and reproducing the EXISTING Version only. It must never be the source
// of a future corrected Version. A future corrected Version has its own contract, its own current-tree reader and
// its own pins in corrected-version-candidate.mjs, which deliberately does not import this module.
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const REMEDIATED_VERSION_ID='4171f3cf-953e-452e-9e5f-068df9a3ca47';
export const REMEDIATED_VERSION_CREATION_SHA='f01ccff5b13a4bbc98d7927cf620f69f46c4c54c';
export const REMEDIATED_SNAPSHOT_PURPOSE='HISTORICAL_IDENTITY_VERIFICATION_ONLY';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const DIRECTORY='workers/api-football-collector/reviewed-remediated-module-snapshots';
const entry=(repoPath,sha256)=>Object.freeze({file:`${DIRECTORY}/${repoPath.replaceAll('/','__')}.snapshot`,sha256});
const fail=code=>{throw new Error(code);};

// Raw-byte SHA-256 of each module at the creation commit.
export const REVIEWED_REMEDIATED_MODULE_SNAPSHOTS=Object.freeze({
  'src/decision-intelligence/api-football-discovery.mjs':entry('src/decision-intelligence/api-football-discovery.mjs','e4da37d8e222223d9e4c34941b03acf4db22940c7bc5d6d44b798b7d650c7d3f'),
  'src/decision-intelligence/api-football-foundation.mjs':entry('src/decision-intelligence/api-football-foundation.mjs','75f43d0c467f5375f0743940b762d95df2368f60114d8ae1b49df8ac5eb47474'),
  'src/decision-intelligence/api-football-shadow-contracts.mjs':entry('src/decision-intelligence/api-football-shadow-contracts.mjs','f403910fb16e149cfcc0ef79b4dd153b0f83ff0feb0846757266da910de0dd72'),
  'src/decision-intelligence/canonical.mjs':entry('src/decision-intelligence/canonical.mjs','097f916793cb683ab630b0d48c065774968219f21237e922476733ab5b034ced'),
  'src/decision-intelligence/eia1-safety.mjs':entry('src/decision-intelligence/eia1-safety.mjs','1b05c9675342ba10a5060cbab1a66b439938c1266eaaaf7cc6d8a0ffd5c9e649'),
  'src/decision-intelligence/eia1-workload-contract.mjs':entry('src/decision-intelligence/eia1-workload-contract.mjs','b7ea0ec26f347a1318dfb521666388e81dac002e3fdf02ab16181283c90306bd'),
  'src/decision-intelligence/observation.mjs':entry('src/decision-intelligence/observation.mjs','35b4cdb1d4d37f61b38004c08d614e2f0f885c00f8a97cf259eee580b0ff7cd7'),
  'src/decision-intelligence/official-fpl-history-canonical.mjs':entry('src/decision-intelligence/official-fpl-history-canonical.mjs','8ba323190a4cfa53dd6891ad827fa728326532d4dcc671d0c85e7789f4b38afe'),
  'src/decision-intelligence/rights.mjs':entry('src/decision-intelligence/rights.mjs','64df6baae041fe286a6845c25c6efd4529795deebe89585c728c82a06f9560ba'),
  'workers/api-football-collector/activation-orchestrator.mjs':entry('workers/api-football-collector/activation-orchestrator.mjs','bd2afe5f58441086e42f24a6c5b2f811786a84e387c61ba367d2430339828685'),
  'workers/api-football-collector/collector.mjs':entry('workers/api-football-collector/collector.mjs','94c4aacd0f7411e4b5cdd3f83cc10a53873de959a303386905f0ebf33b888c41'),
  'workers/api-football-collector/d1-persistence.mjs':entry('workers/api-football-collector/d1-persistence.mjs','716ec4c14d35ac876eafb6f80f93c3ec57a1ea07009e6785d70a3ae936cb5e0d'),
  'workers/api-football-collector/mapping-runtime.mjs':entry('workers/api-football-collector/mapping-runtime.mjs','b99c2c9dbd4a408d35c92a07ccf32af35dc532441bbc6bef4c25195d55314fd6'),
  'workers/api-football-collector/planner-orchestrator.mjs':entry('workers/api-football-collector/planner-orchestrator.mjs','8e3f2954e9b957b9f1465c1ce0819ad17f204c7f175f7d338cc21b0468c9aa89'),
  'workers/api-football-collector/runtime-contracts.mjs':entry('workers/api-football-collector/runtime-contracts.mjs','b4b4991622c22f0888f88717dee58c4bcad75010c737a01ca5622bcac41eccb6'),
  'workers/api-football-collector/scheduler.mjs':entry('workers/api-football-collector/scheduler.mjs','ab90effc98e4eac704acfdbebc70828411ab0152b9df7f88ed1654cb56f3a6c8'),
  'workers/api-football-collector/semantic-validation.mjs':entry('workers/api-football-collector/semantic-validation.mjs','9e9cdc11aea2c2dd63c700c9f7aa5b7de3e1f5a5794e5fb9fcbcdfbcfd1c0328')
});

const readSnapshotText=file=>fs.readFileSync(path.join(root,file),'utf8');
// `readText` exists only so tests can prove that tampered snapshot bytes are rejected. Module-graph builders call this
// with the repository path alone, so no caller-supplied bytes can reach the verified identity.
export function readReviewedRemediatedModuleSource(repoPath,{readText=readSnapshotText}={}){
  const snapshot=Object.hasOwn(REVIEWED_REMEDIATED_MODULE_SNAPSHOTS,repoPath)?REVIEWED_REMEDIATED_MODULE_SNAPSHOTS[repoPath]:null;
  if(!snapshot)fail('collector_remediated_snapshot_unreviewed_module');
  let source;try{source=readText(snapshot.file);}catch{fail('collector_remediated_snapshot_missing');}
  if(createHash('sha256').update(source).digest('hex')!==snapshot.sha256)fail('collector_remediated_snapshot_drift');
  return source;
}
