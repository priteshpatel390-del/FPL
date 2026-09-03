// DATA-S2B — one place where a protected production entry point resolves its live identity.
//
// GitHub Actions echoes each step's resolved environment in that step's log header. Values that
// come from `secrets.*` are registered as masks by the runner and print as `***`; values that
// come from `vars.*` are not, so a production identifier declared in a workflow, job or step
// `env:` block is written to the log before any Node process can emit `::add-mask::`. This
// module removes the need for the identifiers to travel that way at all.
//
// The production database id is a reviewed repository constant, so it is taken from the
// repository and never from a workflow variable; a supplied value is only ever accepted when it
// is byte-identical to the constant. The account fingerprint is deliberately still supplied by
// the protected environment, because deriving it from the credential it validates would make the
// check tautological — the workflow pre-registers its mask before the variable is materialised.

import {createHash} from 'node:crypto';
import {PRODUCTION_D1_ID} from './production-collection.mjs';

export const PRODUCTION_IDENTITY_ENVIRONMENT=Object.freeze([
  'CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_D1_TOKEN','CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT'
]);

export function resolveProductionIdentity(env=process.env){
  const required=name=>{
    const value=env?.[name];
    if(typeof value!=='string'||!value)throw new Error(`missing_${name.toLowerCase()}`);
    return value;
  };
  const accountId=required('CLOUDFLARE_ACCOUNT_ID');
  const token=required('CLOUDFLARE_D1_TOKEN');
  const accountFingerprint=required('CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT');
  const supplied=env?.CLOUDFLARE_PRODUCTION_D1_ID;
  if(typeof supplied==='string'&&supplied&&supplied!==PRODUCTION_D1_ID)throw new Error('production_d1_identity_mismatch');
  return Object.freeze({accountId,token,accountFingerprint,databaseId:PRODUCTION_D1_ID});
}

// Runtime masking remains in place as defence in depth for anything a later step prints. It is
// never the primary control: the workflow boundary is.
export function maskProductionIdentity(identity,write=chunk=>process.stdout.write(chunk)){
  write(`::add-mask::${identity.token}\n::add-mask::${identity.accountId}\n::add-mask::${identity.databaseId}\n`);
  return identity;
}

// The value the workflow's first step derives from the already-masked account credential so the
// runner registers the fingerprint mask before the variable carrying it is ever materialised.
export const derivedAccountFingerprint=accountId=>createHash('sha256').update(accountId).digest('hex');
