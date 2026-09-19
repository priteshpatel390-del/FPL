// API-Football migration 0004 — protected production entry point.
//
// Manual workflow only. It exposes no migration/path/SQL/version input, refuses workflow reruns,
// masks production identity before the first request, writes only a sanitized bounded report, and
// never calls API-Football or changes any Worker/Cron/secret.

import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {maskProductionIdentity,resolveProductionIdentity} from './production-identity.mjs';
import {applyMigration0004} from './migration4/apply-migration-0004.mjs';

function writeReport(report){
  const path=process.env.MIGRATION_0004_REPORT_PATH;
  if(typeof path==='string'&&path)fs.writeFileSync(path,JSON.stringify(report,null,2)+'\n',{mode:0o600});
  if(typeof process.env.GITHUB_STEP_SUMMARY==='string'&&process.env.GITHUB_STEP_SUMMARY){
    const lines=[
      '## API-Football migration 0004',
      '',
      '- Classification: `'+String(report.classification)+'`',
      '- Repository SHA: `'+String(process.env.APPROVED_SHA??'unknown')+'`',
      '- Migration: `'+String(report.migration?.path??'unknown')+'`',
      '- Pinned Git blob: `'+String(report.migration?.gitBlobSha??'unknown')+'`',
      '- Mutation issued: '+String(report.mutationIssued),
      '- Recovery issued: '+String(report.recoveryIssued),
      '- Recovery mechanism: '+String(report.recovery?.mechanism??'none'),
      '- Recovery checkpoint: '+String(report.recovery?.checkpointAt??'not captured'),
      '- Pre-bookmark digest: '+String(report.recovery?.preBookmarkDigest??'not captured'),
      '- Post-bookmark digest: '+String(report.recovery?.postBookmarkDigest??'not captured'),
      '- State before / after: '+String(report.state?.before)+' / '+String(report.state?.after),
      '- Ledger after: '+String(report.ledger?.join(', ')??'unknown'),
      '- API-Football requests: 0',
      '- Worker/Cron/secret changes: 0'
    ];
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
  }
  console.log(JSON.stringify({
    ok:report.ok,classification:report.classification,mutationIssued:report.mutationIssued,
    recoveryIssued:report.recoveryIssued,productionMutationIssued:report.mutationIssued,
    apiFootballRequests:0,workerCronSecretChanges:0
  }));
}

export async function main(){
  if(process.env.GITHUB_RUN_ATTEMPT!=='1')throw new Error('workflow_retry_forbidden');
  const identity=maskProductionIdentity(resolveProductionIdentity(process.env));
  let report;
  try{
    report=await applyMigration0004({
      ...identity,
      transport:request=>fetch(request.url,request)
    });
  }catch(error){
    const mutationIssued=Boolean(error?.mutationIssued);
    const failure=Object.freeze({
      ok:false,classification:mutationIssued?'AMBIGUOUS_REQUIRES_OWNER_ATTENTION':'DEFINITELY_NOT_APPLIED',
      mutationIssued,recoveryIssued:false,note:String(error?.message??'migration_0004_failed').slice(0,96),
      phase:error?.migration0004Phase??'before_mutation_or_unclassified',
      migration:null,recovery:Object.freeze({mechanism:'cloudflare_d1_time_travel',checkpointAt:null,preBookmarkDigest:null,postBookmarkDigest:null}),
      state:Object.freeze({before:null,after:null}),ledger:Object.freeze([]),counts:Object.freeze({before:null,after:null}),
      officialAuthority:Object.freeze({before:null,after:null}),preStateDigest:null,d1:null
    });
    writeReport(failure);
    return 1;
  }
  writeReport(report);
  return report.ok?0:1;
}

if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
