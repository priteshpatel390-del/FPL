// DATA-S2B — committed production run integrity contract.
//
// Pure module: no node built-ins, no I/O, no network, no SQL text and no mutation surface. It
// fixes the one question this diagnostic answers, the bounded shape the answer may take, and the
// strictly read-only resource contract of the proof itself.
//
// THE QUESTION. Scheduled production run 33948145320 fired on 5 September 2026, passed its
// repository gate, fetched Official FPL and committed to D1. Its commit mutation completed —
// `productionMutation: 'definite_completed'` — and the collection then failed at
// `production_d1_budget_exceeded` in phase `postflight_read`, before its synchronous postflight
// could run. The committed state has therefore never been validated against the production
// postflight contract. This diagnostic asks exactly that one question and nothing else: does the
// state that run left behind satisfy the existing `validateProductionPostflight` contract?
//
// WHAT IT IS NOT. It is not a resume, not a repair, not a reconciliation of the FIRST production
// run, and not a collection. It reuses the production postflight read and the production
// postflight validator unchanged rather than defining a competing notion of "valid", and it
// deliberately does not reuse the first-run reconciliation contract, whose whole purpose is to
// prove an UNTOUCHED `started` ledger row and whose pinning to
// `FIRST_PRODUCTION_RUN_SCHEDULED_AT` would be semantically wrong here — the run in question is
// `completed` and owns observations. Repurposing it would have inverted its meaning.
//
// The run identity is repository-owned and derived, never supplied: the scheduled minute is the
// constant below and the run id is `productionRunIdFor` of it, so no workflow input, SQL, table,
// column, statement, timestamp or database identifier reaches this diagnostic.

// The collection identity of run 33948145320. Its `collect` job fixed
// `COLLECTION_SCHEDULED_AT` once from the runner clock at minute precision; GitHub created the
// run at 2026-09-05T05:48:05Z and the collection step began at 05:48:27Z, so the minute it fixed
// was 05:48. A permanent test proves `productionRunIdFor` of this constant is exactly the run id
// the incident record names, so the derivation is pinned rather than asserted.
export const COMMITTED_RUN_SCHEDULED_AT='2026-09-05T05:48:00.000Z';
export const COMMITTED_RUN_WORKFLOW_RUN='33948145320';

export const COMMITTED_STATE_VALID='COMMITTED_STATE_VALID';
export const COMMITTED_STATE_INVALID='COMMITTED_STATE_INVALID_REQUIRES_OWNER_ATTENTION';
export const COMMITTED_STATE_AMBIGUOUS='AMBIGUOUS_REQUIRES_OWNER_ATTENTION';
export const COMMITTED_RUN_INTEGRITY_CLASSIFICATIONS=Object.freeze([
  COMMITTED_STATE_VALID,COMMITTED_STATE_INVALID,COMMITTED_STATE_AMBIGUOUS
]);

// The read-only resource contract for this one diagnostic.
//
// It issues exactly one D1 REST request carrying exactly the one existing production postflight
// statement. That statement's structural cost is the postflight term of the whole-cycle model —
// (H + D) observation visits plus 3(N + D) head visits — which at the population the incident run
// left behind is on the order of 42,000 structural rows. `COMMITTED_RUN_INTEGRITY_MAX_ROWS_READ`
// is set above the conservatively amplified projection of that figure and far below the
// unchanged 125,000 cycle ceiling, so it bounds the diagnostic without reinterpreting any
// collection ceiling. It is an operational guard on Cloudflare's returned `meta.rows_read`, never
// a billing prediction, and the run fails closed rather than assuming a value.
//
// `rows_written` must be exactly zero. A read-only diagnostic that reports any written row is
// never accepted, whatever the rows say.
export const COMMITTED_RUN_INTEGRITY_STATEMENT_COUNT=1;
export const COMMITTED_RUN_INTEGRITY_MAX_D1_API_CALLS=1;
export const COMMITTED_RUN_INTEGRITY_MAX_ROWS_READ=75000;
export const COMMITTED_RUN_INTEGRITY_MAX_ROWS_WRITTEN=0;
export const COMMITTED_RUN_INTEGRITY_MAX_ROWS_PER_STATEMENT=1;

const carry=(code,classification)=>{
  const error=new Error(`committed_run_integrity_${code}`);
  error.integrityClassification=classification;
  error.integrityRetryable=false;
  throw error;
};
const ambiguous=code=>carry(code,COMMITTED_STATE_AMBIGUOUS);
const invalid=code=>carry(code,COMMITTED_STATE_INVALID);

// A null, absent or non-numeric counter is undecidable, never a silent zero.
const counter=(row,key)=>{
  const raw=row?.[key];
  if(typeof raw==='number'?!Number.isSafeInteger(raw):!(typeof raw==='string'&&/^\d{1,15}$/.test(raw)))ambiguous('counter_invalid');
  const value=Number(raw);
  if(!Number.isSafeInteger(value)||value<0)ambiguous('counter_invalid');
  return value;
};

// The counters the production postflight statement returns and this diagnostic reports. Fixed and
// repository-owned; nothing here is derived from a response.
export const COMMITTED_RUN_INTEGRITY_COUNTERS=Object.freeze([
  'observations','run_observations','logical_keys','non_accepted','quarantined_observations',
  'heads','orphan_heads','invalid_heads','rejections'
]);

// Validate the single returned postflight row against the EXISTING production postflight
// contract, unchanged.
//
// The two run-declared values the production validator takes as arguments — `recordsSeen` and
// `changed` — are not knowable independently for an already-committed run, so they are read from
// that run's own ledger row. Two of the validator's comparisons therefore become tautological by
// construction: `records_seen === recordsSeen` and `records_accepted === changed`. Every other
// comparison stays substantive, and the one that matters most is among them:
// `run_observations === changed` becomes `run_observations === records_accepted`, which is the
// real claim that the run owns exactly the observations its ledger says it accepted. The
// tautology is stated here rather than hidden, and `validateProductionPostflight` itself is
// reused byte-for-byte rather than re-implemented, so there is no second, weaker definition of a
// valid committed state anywhere in the repository.
export function validateCommittedRunIntegrity(rows,{runId,validateProductionPostflight}){
  if(typeof runId!=='string'||!runId)ambiguous('run_identity_invalid');
  if(typeof validateProductionPostflight!=='function')ambiguous('validator_missing');
  if(!Array.isArray(rows)||rows.length!==COMMITTED_RUN_INTEGRITY_MAX_ROWS_PER_STATEMENT)ambiguous('row_cardinality_invalid');
  const row=rows[0];
  if(!row||typeof row!=='object'||Array.isArray(row))ambiguous('row_invalid');
  if(row.run_id!==runId)ambiguous('run_identity_mismatch');
  if(typeof row.status!=='string')ambiguous('status_invalid');
  if(row.error_class!==null&&row.error_class!==undefined)invalid('error_class_present');

  const recordsSeen=counter(row,'records_seen');
  const changed=counter(row,'records_accepted');
  const counters=Object.fromEntries(COMMITTED_RUN_INTEGRITY_COUNTERS.map(key=>[key,counter(row,key)]));

  try{validateProductionPostflight([row],{runId,changed,recordsSeen});}
  catch{invalid('postflight_contract_failed');}

  return Object.freeze({
    classification:COMMITTED_STATE_VALID,
    run:Object.freeze({runId,status:row.status,recordsSeen,recordsAccepted:changed}),
    integrity:Object.freeze(counters)
  });
}

// The sanitized failure shape. Numbers and fixed enums only: no SQL, no parameter, no request
// URL, no identifier, no token and no response body ever reaches it.
export function committedRunIntegrityClassification(error){
  const classification=error?.integrityClassification;
  return Object.freeze({
    classification:COMMITTED_RUN_INTEGRITY_CLASSIFICATIONS.includes(classification)?classification:COMMITTED_STATE_AMBIGUOUS,
    phase:typeof error?.integrityPhase==='string'?error.integrityPhase:null,
    code:/^[a-z0-9_]{1,64}$/.test(String(error?.code??error?.message??''))?String(error.code??error.message):'unclassified',
    d1:error?.integrityAccounting??null,
    retryable:false
  });
}
