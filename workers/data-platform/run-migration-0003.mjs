// DATA-S2B migration 0003 — protected production entry point.
//
// Manual, single-attempt, and fail-closed. It masks every live identifier before any request,
// runs the dedicated migration-0003 runner exactly once, and writes only a bounded sanitized
// summary. Raw Cloudflare payloads are never written to disk and never uploaded as artifacts.
import fs from 'node:fs';
import {applyMigration0003,migration0003FailureClassification} from './migration3/apply-migration-0003.mjs';
import {MIGRATION_0003_NAME,MIGRATION_0003_PATH,MIGRATION_0003_VERSION} from './migration3/migration-0003-contract.mjs';

const required=name=>{const value=process.env[name];if(!value)throw new Error(`missing_${name.toLowerCase()}`);return value;};
const summary=(heading,payload)=>{
  const line=`## ${heading}\n\n- Migration: \`${MIGRATION_0003_PATH}\` (version ${MIGRATION_0003_VERSION}, \`${MIGRATION_0003_NAME}\`)\n- Repository SHA: \`${process.env.APPROVED_SHA??'unknown'}\`\n\n\`${JSON.stringify(payload)}\`\n`;
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,line);else process.stdout.write(line);
};

// A workflow re-run must never re-issue a migration request against an outcome this execution
// could not classify. A retry is only ever a separate owner-approved dispatch.
if(process.env.GITHUB_RUN_ATTEMPT!=='1')throw new Error('workflow_retry_forbidden');

const accountId=required('CLOUDFLARE_ACCOUNT_ID');
const token=required('CLOUDFLARE_D1_TOKEN');
const databaseId=required('CLOUDFLARE_PRODUCTION_D1_ID');
const accountFingerprint=required('CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT');
process.stdout.write(`::add-mask::${token}\n::add-mask::${accountId}\n::add-mask::${databaseId}\n`);

let result;
try{result=await applyMigration0003({accountId,accountFingerprint,databaseId,token,transport:request=>fetch(request.url,request)});}
catch(error){summary('DATA-S2B migration 0003 STOPPED',migration0003FailureClassification(error));throw error;}
summary('DATA-S2B migration 0003',{
  classification:result.classification,mutationIssued:result.mutationIssued,note:result.note,
  state:result.state,ledger:result.ledger,indexes:result.indexes,counts:result.counts,d1:result.d1
});
