// DATA-OPS A1.4 — bounded read-only adapter for the isolated A1.3 observer-clock receipt ledger.
// The watchdog may read exactly one receipt for the exact expected opportunity. It cannot mutate
// this database, choose a table, or search for a convenient run.

const RECEIPT_BY_OPPORTUNITY=`SELECT opportunity_at,cron,dispatch_state,github_run_id,reason_code,claimed_at,finalized_at
  FROM observer_dispatch_receipts WHERE opportunity_at=?1`;
const STATES=Object.freeze(['CLAIMED','DISPATCHED','FAILED','AMBIGUOUS']);
const RUN_ID=value=>Number.isSafeInteger(value)&&value>0;

export class ObserverClockReadError extends Error{
  constructor(code){super(code);this.name='ObserverClockReadError';this.code=code;}
}
const fail=code=>{throw new ObserverClockReadError(code);};

export async function readObserverClockReceipt(db,opportunityAt){
  if(!db||typeof db.prepare!=='function')fail('WATCHDOG_CLOCK_DB_UNAVAILABLE');
  if(typeof opportunityAt!=='string'||!Number.isFinite(Date.parse(opportunityAt)))
    fail('WATCHDOG_CLOCK_RECEIPT_INVALID');
  let row;
  try{row=await db.prepare(RECEIPT_BY_OPPORTUNITY).bind(opportunityAt).first();}
  catch{fail('WATCHDOG_CLOCK_DB_UNAVAILABLE');}
  if(row===null||row===undefined)return null;
  if(row.opportunity_at!==opportunityAt||row.cron!=='17 4 * * *'||!STATES.includes(row.dispatch_state))
    fail('WATCHDOG_CLOCK_RECEIPT_INVALID');
  if(typeof row.reason_code!=='string'||typeof row.claimed_at!=='string')
    fail('WATCHDOG_CLOCK_RECEIPT_INVALID');
  if(row.dispatch_state==='DISPATCHED'){
    if(!RUN_ID(row.github_run_id)||typeof row.finalized_at!=='string')fail('WATCHDOG_CLOCK_RECEIPT_INVALID');
  }else if(row.github_run_id!==null&&row.github_run_id!==undefined){
    fail('WATCHDOG_CLOCK_RECEIPT_INVALID');
  }
  return Object.freeze({opportunityAt:row.opportunity_at,state:row.dispatch_state,
    workflowRunId:row.dispatch_state==='DISPATCHED'?row.github_run_id:null,
    reasonCode:row.reason_code,claimedAt:row.claimed_at,finalizedAt:row.finalized_at??null});
}
