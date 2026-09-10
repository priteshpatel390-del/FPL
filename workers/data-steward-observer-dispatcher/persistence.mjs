// DATA-OPS A1.3 — the observer dispatcher's only D1 access surface.
// This database contains dispatch receipts only; it has no production-data or watchdog-incident authority.

const CLAIM=`INSERT INTO observer_dispatch_receipts
  (opportunity_at,cron,dispatch_state,github_run_id,reason_code,claimed_at,finalized_at)
  VALUES (?1,?2,'CLAIMED',NULL,'observer_dispatch_claimed',?3,NULL)
  ON CONFLICT(opportunity_at) DO NOTHING`;
const FINALIZE=`UPDATE observer_dispatch_receipts
  SET dispatch_state=?2,github_run_id=?3,reason_code=?4,finalized_at=?5
  WHERE opportunity_at=?1 AND dispatch_state='CLAIMED'`;

export class ObserverClockPersistenceError extends Error{
  constructor(code){super(code);this.name='ObserverClockPersistenceError';this.code=code;}
}
const fail=code=>{throw new ObserverClockPersistenceError(code);};
const dbValid=db=>db&&typeof db.prepare==='function';

export async function claimObserverOpportunity(db,{opportunityAt,cron,claimedAt}){
  if(!dbValid(db))fail('observer_clock_db_missing');
  let result;
  try{result=await db.prepare(CLAIM).bind(opportunityAt,cron,claimedAt).run();}
  catch{fail('observer_clock_claim_failed');}
  if(!result?.success)fail('observer_clock_claim_failed');
  return Object.freeze({claimed:(result.meta?.changes??0)>0});
}

export async function finalizeObserverOpportunity(db,{opportunityAt,state,runId,reason,finalizedAt}){
  if(!dbValid(db))fail('observer_clock_db_missing');
  let result;
  try{result=await db.prepare(FINALIZE).bind(opportunityAt,state,runId,reason,finalizedAt).run();}
  catch{fail('observer_clock_finalize_failed');}
  if(!result?.success||(result.meta?.changes??0)!==1)fail('observer_clock_finalize_failed');
}
