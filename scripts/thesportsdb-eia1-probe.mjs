import {readFile,writeFile} from 'node:fs/promises';
import {canonicalise,secretFinding,sha256Hex,stableStringify} from '../src/decision-intelligence/canonical.mjs';

const RAW_KEY=/^(?:raw(?:Responses?|Payloads?|Data)?|responses?|events?|players?|lineups?)$/i;
function rawPayloadFinding(value,path='$'){
  if(Array.isArray(value)){for(let index=0;index<value.length;index++){const found=rawPayloadFinding(value[index],`${path}[${index}]`);if(found)return found;}return null;}
  if(value&&typeof value==='object')for(const [key,child] of Object.entries(value)){
    if(RAW_KEY.test(key)&&(Array.isArray(child)||(child&&typeof child==='object')))return `${path}.${key}:raw_payload`;
    const found=rawPayloadFinding(child,`${path}.${key}`);if(found)return found;
  }
  return null;
}
export async function buildCapabilityReport(input,{cryptoImpl=globalThis.crypto}={}){
  if(secretFinding(input)||rawPayloadFinding(input))throw new Error('eia1_probe_raw_or_secret_forbidden');
  const core=canonicalise({schemaVersion:'eia1-thesportsdb-capability-report-v1',provider:'TheSportsDB',purpose:'local_research_only',sample:input.sample,rights:input.rights,coverage:input.coverage,reliability:input.reliability,qualification:input.qualification,blockedConditions:input.blockedConditions||[],durableRetention:'blocked',productionPromotion:false});
  const report={...core,reportHash:await sha256Hex(stableStringify(core),cryptoImpl)};return `${stableStringify(report)}\n`;
}
if(import.meta.url===`file://${process.argv[1]}`){
  if(process.argv.length!==4)throw new Error('usage: node scripts/thesportsdb-eia1-probe.mjs safe-aggregate-input.json report.json');
  const input=JSON.parse(await readFile(process.argv[2],'utf8'));await writeFile(process.argv[3],await buildCapabilityReport(input),{flag:'wx'});
}
