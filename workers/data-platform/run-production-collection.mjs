import fs from 'node:fs';import {maskProductionIdentity,resolveProductionIdentity} from './production-identity.mjs';import {runProductionCollection} from './production-collection.mjs';
const required=name=>{const value=process.env[name];if(!value)throw new Error(`missing_${name.toLowerCase()}`);return value;};
if(process.env.GITHUB_RUN_ATTEMPT!=='1')throw new Error('workflow_retry_forbidden');
const {accountId,accountFingerprint,databaseId,token}=maskProductionIdentity(resolveProductionIdentity(process.env));
const result=await runProductionCollection({accountId,accountFingerprint,databaseId,season:required('DATA_S2_SEASON'),token,scheduledAt:required('COLLECTION_SCHEDULED_AT'),transport:request=>fetch(request.url,request),fetchImpl:fetch});
const safe={result:result.result,changed:result.changed,d1:result.d1};fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`## DATA-S2 production collection\n\n\`${JSON.stringify(safe)}\`\n`);
