import fs from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import {createSignalRegistry} from '../src/decision-intelligence/registry.mjs';
import {freezeEvaluationManifest} from '../src/decision-intelligence/evaluation-manifest.mjs';
import {runEvaluation} from '../src/decision-intelligence/evaluation-runner.mjs';

const root=new URL('../',import.meta.url),dir=new URL('experiments/di2-synthetic/',root);
const read=async name=>JSON.parse(await fs.readFile(new URL(name,dir),'utf8'));
const registry=createSignalRegistry(['a','b'].map(id=>({signalId:`synthetic.${id}`,version:'1.0.0',domain:'availability',sourceKey:'synthetic',subjectType:'player',requiredTimingFields:['sourcePublishedAt','observedAt','fetchedAt'],rightsClassification:'durable_allowed',persistenceAllowed:true,expectedEvidenceType:'structured_fact',upstreamDependencies:[],overlapRisks:[],evaluationDomain:'availability',productionStatus:'shadow_only'})));
const frozen=await freezeEvaluationManifest(await read('manifest.json'),{registry,cryptoImpl:webcrypto});
const report=await runEvaluation(frozen,await read('input.json'),webcrypto);
await fs.writeFile(new URL('report.json',dir),report.json);await fs.writeFile(new URL('report.md',dir),report.markdown);
console.log(`DI-2 reference ${report.result.runIdentity}`);
