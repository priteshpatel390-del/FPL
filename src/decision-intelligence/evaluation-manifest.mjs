import {canonicalise,deepFreeze,sha256Hex,stableStringify} from './canonical.mjs';
import {signalVersionKey} from './registry.mjs';

const ID=/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const VERSION=/^[1-9]\d*\.\d+\.\d+$/;
const MODES=new Set(['exploratory','confirmatory']);
const SPLITS=new Set(['historical_window','later_holdout','rolling_walk_forward']);
const METRICS=new Set(['brier','mae','rmse','calibration']);

function invalid(condition,reason){if(condition)throw new Error(`manifest_${reason}`);}
export async function freezeEvaluationManifest(raw,{registry,cryptoImpl=globalThis.crypto}={}){
  const manifest=canonicalise(raw);
  invalid(manifest.schemaVersion!=='di-experiment-manifest-v1','schema');
  invalid(!ID.test(manifest.experimentId||'')||!VERSION.test(manifest.experimentVersion||'')||!manifest.domain||!manifest.title||!MODES.has(manifest.mode),'identity');
  invalid(!manifest.baseline?.id||!manifest.baseline?.version||!manifest.baseline?.sourceRevision,'baseline');
  invalid(!manifest.cohort?.season||!Array.isArray(manifest.cohort.subjectTypes)||!manifest.cohort.timeSplit||!SPLITS.has(manifest.cohort.timeSplit.type),'cohort');
  invalid(!manifest.pointInTime?.decisionCutoff||!Number.isFinite(Date.parse(manifest.pointInTime.decisionCutoff))||!Array.isArray(manifest.pointInTime.requiredTimingFields),'point_in_time');
  invalid(!manifest.outcomes?.source||!manifest.outcomes?.revision||!manifest.outcomes?.version||!manifest.outcomes?.availabilityPolicy,'outcomes');
  invalid(!Array.isArray(manifest.candidates)||!Array.isArray(manifest.arms)||!Array.isArray(manifest.metrics)||manifest.arms.length===0||manifest.metrics.length===0,'collections');
  const candidateKeys=new Set();
  for(const candidate of manifest.candidates){
    const key=signalVersionKey(candidate.signalId,candidate.version);
    invalid(candidateKeys.has(key),'candidate_duplicate'); candidateKeys.add(key);
    invalid(!registry?.get(candidate.signalId,candidate.version),'unknown_signal_version');
    invalid(!Array.isArray(candidate.dependencies)||!Array.isArray(candidate.overlapRisks),'candidate_declarations');
  }
  const armIds=new Set();
  for(const arm of manifest.arms){
    invalid(!ID.test(arm.armId||'')||armIds.has(arm.armId)||!Array.isArray(arm.signals),'duplicate_arm'); armIds.add(arm.armId);
    const signalKeys=new Set(arm.signals.map(row=>signalVersionKey(row.signalId,row.version)));
    invalid(signalKeys.size!==arm.signals.length||[...signalKeys].some(key=>!candidateKeys.has(key)),'arm_signal');
  }
  invalid(!manifest.arms.some(arm=>arm.signals.length===0),'baseline_arm');
  const metricIds=new Set();
  for(const metric of manifest.metrics){
    invalid(!ID.test(metric.metricId||'')||metricIds.has(metric.metricId)||!METRICS.has(metric.adapter)||metric.version!=='1.0.0'||!['lower','higher'].includes(metric.direction)||!['primary','secondary'].includes(metric.role)||!metric.predictionField||!metric.outcomeField,'metric');
    if(metric.adapter==='calibration')invalid(!Array.isArray(metric.binEdges)||metric.binEdges.length<2||metric.binEdges[0]!==0||metric.binEdges.at(-1)!==1||metric.binEdges.some((edge,index)=>!Number.isFinite(edge)||(index&&edge<=metric.binEdges[index-1])),'calibration_bins');
    metricIds.add(metric.metricId);
  }
  invalid(!manifest.metrics.some(metric=>metric.role==='primary'),'primary_metric');
  invalid(!manifest.reporting?.formatVersion||!Number.isInteger(manifest.reporting.minimumSample)||manifest.reporting.minimumSample<1,'reporting');
  invalid(!manifest.lineage?.sourceCommit||!manifest.lineage?.evaluationCodeVersion||!Array.isArray(manifest.lineage.inputHashes),'lineage');
  const hash=await sha256Hex(stableStringify(manifest),cryptoImpl);
  return deepFreeze({manifest,manifestHash:hash,identity:`${manifest.experimentId}@${manifest.experimentVersion}:${manifest.mode}:${hash}`});
}
