import {readFile,writeFile} from 'node:fs/promises';
import {canonicalise,sha256Hex,stableStringify} from '../src/decision-intelligence/canonical.mjs';

const SECRET=/(?:api.?key|authorization|bearer|token|password|secret)/i;
export async function buildCapabilityReport(input,{cryptoImpl=globalThis.crypto}={}){
  if(input?.rawResponses||input?.events||input?.players||Object.keys(input||{}).some(key=>SECRET.test(key)))throw new Error('eia1_probe_raw_or_secret_forbidden');
  const core=canonicalise({schemaVersion:'eia1-thesportsdb-capability-report-v1',provider:'TheSportsDB',purpose:'local_research_only',sample:input.sample,rights:input.rights,coverage:input.coverage,reliability:input.reliability,qualification:input.qualification,blockedConditions:input.blockedConditions||[],durableRetention:'blocked',productionPromotion:false});
  const report={...core,reportHash:await sha256Hex(stableStringify(core),cryptoImpl)};return `${stableStringify(report)}\n`;
}
if(import.meta.url===`file://${process.argv[1]}`){
  if(process.argv.length!==4)throw new Error('usage: node scripts/thesportsdb-eia1-probe.mjs safe-aggregate-input.json report.json');
  const input=JSON.parse(await readFile(process.argv[2],'utf8'));await writeFile(process.argv[3],await buildCapabilityReport(input),{flag:'wx'});
}
