import fs from 'node:fs';import {FIRST_PRODUCTION_RUN_SCHEDULED_AT,runProductionCollection} from './production-collection.mjs';
const required=name=>{const value=process.env[name];if(!value)throw new Error(`missing_${name.toLowerCase()}`);return value;};
if(process.env.GITHUB_RUN_ATTEMPT!=='1')throw new Error('workflow_retry_forbidden');
const result=await runProductionCollection({accountId:required('CLOUDFLARE_ACCOUNT_ID'),accountFingerprint:required('CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT'),databaseId:required('CLOUDFLARE_PRODUCTION_D1_ID'),season:required('DATA_S2_SEASON'),token:required('CLOUDFLARE_D1_TOKEN'),scheduledAt:FIRST_PRODUCTION_RUN_SCHEDULED_AT,resumeStarted:true,transport:request=>fetch(request.url,request),fetchImpl:fetch});
const safe={result:result.result,changed:result.changed,recordsSeen:result.recordsSeen,state:result.state,d1:result.d1};fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`## DATA-S2 first-run resume\n\n\`${JSON.stringify(safe)}\`\n`);
