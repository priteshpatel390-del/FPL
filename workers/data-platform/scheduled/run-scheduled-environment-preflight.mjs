// DATA-S2B — protected entry point for the read-only scheduled-environment credential preflight.
//
// Manual and diagnostic. It performs no collection, executes no SQL, issues no D1 query request
// and writes nothing anywhere: two Cloudflare `GET` reads and a sanitized PASS/FAIL label are its
// entire effect. It resolves the environment's identity through the one shared production
// identity module and masks token, account id and database id before either request, then emits
// only a closed-set result. No identifier, credential, URL or response body reaches stdout, the
// workflow summary, `GITHUB_ENV`, `GITHUB_OUTPUT`, a file, a cache or an artifact.
import fs from 'node:fs';
import {maskProductionIdentity,resolveProductionIdentity} from '../production-identity.mjs';
import {preflightFailure,runScheduledEnvironmentPreflight} from './environment-preflight.mjs';

const summary=payload=>{
  const line=`## DATA-S2 scheduled environment preflight\n\n\`${JSON.stringify(payload)}\`\n`;
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,line);
  else process.stdout.write(line);
};

const {accountId,accountFingerprint,databaseId,token}=maskProductionIdentity(resolveProductionIdentity(process.env));

let result;
try{result=await runScheduledEnvironmentPreflight({accountId,accountFingerprint,databaseId,token,fetchImpl:fetch});}
// The rethrow deliberately discards the original error object. Its class carries the sanitized
// reason; its message or stack could otherwise reach the log with a request URL inside it.
catch(error){const classified=preflightFailure(error);summary(classified);throw new Error(classified.reason);}
summary(result);
