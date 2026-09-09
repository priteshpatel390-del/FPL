// Test-only in-memory D1 fake for DATA-OPS-A1.4. It recognizes statements only by exact
// reference to the fixed constants `workers/data-steward-watchdog/persistence/statements.mjs`
// exports, exactly the way the real repository module calls them, and implements each one's real
// semantics (uniqueness, conflict handling, filtering) against plain in-memory Maps rather than a
// generic SQL engine. It exists purely to exercise the repository/orchestrator logic in Node's
// test runner without a live Cloudflare D1 database.
//
// Deliberately synchronous internals: every `run()`/`first()` resolves immediately with no
// internal `await`, so two "concurrent" callers created via `Promise.all` still have their claim
// attempts serialized by Node's single-threaded event loop exactly the way two overlapping D1
// requests would be serialized by D1's own real auto-commit, single-statement atomicity. This is
// what lets the concurrency tests prove a real single-writer outcome without a live database.
import * as S from '../../workers/data-steward-watchdog/persistence/statements.mjs';

export function createFakeWatchdogD1(){
  const bootstrap={row:null};
  const claims=new Map();
  const observations=new Map();
  const attributions=new Map();
  const incidents=new Map();
  const notifications=new Map();

  function execWrite(sql,args){
    if(sql===S.CLAIM_SCHEDULED_EVENT){
      const [scheduled_time,claimed_at]=args;
      if(claims.has(scheduled_time))return {success:true,meta:{changes:0}};
      claims.set(scheduled_time,{scheduled_time,claimed_at});
      return {success:true,meta:{changes:1}};
    }
    if(sql===S.INSERT_BOOTSTRAP){
      const [bootstrapped_at]=args;
      if(bootstrap.row!==null)return {success:true,meta:{changes:0}};
      bootstrap.row={bootstrapped_at};
      return {success:true,meta:{changes:1}};
    }
    if(sql===S.INSERT_OBSERVATION){
      const [observation_id,source_kind,event_type,workflow_run_id,run_attempt,observed_at,
        run_created_at,run_completed_at,opportunity_at,head_sha,health_state,reason_code,evidence_hash,
        created_at]=args;
      if(observations.has(observation_id))return {success:true,meta:{changes:0}};
      observations.set(observation_id,{observation_id,source_kind,event_type,workflow_run_id,
        run_attempt,observed_at,run_created_at,run_completed_at,opportunity_at,head_sha,health_state,reason_code,
        evidence_hash,created_at});
      return {success:true,meta:{changes:1}};
    }
    if(sql===S.INSERT_OPPORTUNITY_ATTRIBUTION){
      const [opportunity_at,workflow_run_id,run_attempt,attributed_at]=args;
      if(attributions.has(opportunity_at)||[...attributions.values()].some(row=>
        row.workflow_run_id===workflow_run_id))
        return {success:true,meta:{changes:0}};
      attributions.set(opportunity_at,{opportunity_at,workflow_run_id,run_attempt,attributed_at});
      return {success:true,meta:{changes:1}};
    }
    if(sql===S.UPSERT_INCIDENT){
      const [fingerprint,problem_class,component,lifecycle_state,reason_code,first_seen_at,
        last_seen_at,recovered_at,occurrence_count,reopened_count,last_evidence_observed_at,
        evidence_observation_id,evidence_workflow_run_id,evidence_run_attempt,evidence_head_sha,
        evidence_source_at,,updated_at]=args;
      const existing=incidents.get(fingerprint);
      incidents.set(fingerprint,{fingerprint,problem_class,component,lifecycle_state,reason_code,
        first_seen_at,last_seen_at,recovered_at,occurrence_count,reopened_count,
        last_evidence_observed_at,evidence_observation_id,evidence_workflow_run_id,
        evidence_run_attempt,evidence_head_sha,evidence_source_at,
        last_notified_at:existing?existing.last_notified_at:null,updated_at});
      return {success:true,meta:{changes:1}};
    }
    if(sql===S.UPDATE_INCIDENT_LAST_NOTIFIED){
      const [last_notified_at,fingerprint]=args;
      const row=incidents.get(fingerprint);
      if(!row)return {success:true,meta:{changes:0}};
      row.last_notified_at=last_notified_at;
      return {success:true,meta:{changes:1}};
    }
    if(sql===S.INSERT_NOTIFICATION){
      const [idempotency_key,fingerprint,transition,decided_at,evidence_observation_id,
        evidence_observed_at,created_at]=args;
      if(notifications.has(idempotency_key))return {success:true,meta:{changes:0}};
      notifications.set(idempotency_key,{idempotency_key,fingerprint,transition,decided_at,
        evidence_observation_id,evidence_observed_at,delivery_status:'PENDING',delivered_at:null,created_at});
      return {success:true,meta:{changes:1}};
    }
    if(sql===S.UPDATE_NOTIFICATION_DELIVERY){
      const [delivery_status,delivered_at,idempotency_key]=args;
      const row=notifications.get(idempotency_key);
      if(!row)return {success:true,meta:{changes:0}};
      row.delivery_status=delivery_status;row.delivered_at=delivered_at;
      return {success:true,meta:{changes:1}};
    }
    if(sql===S.PRUNE_OBSERVATIONS){
      const [cutoff]=args;
      const activeEvidenceIds=new Set([...incidents.values()]
        .filter(row=>row.lifecycle_state==='ACTIVE'&&row.evidence_observation_id)
        .map(row=>row.evidence_observation_id));
      let changes=0;
      for(const [id,row] of [...observations.entries()])
        if(row.observed_at<cutoff&&!activeEvidenceIds.has(id)){observations.delete(id);changes+=1;}
      return {success:true,meta:{changes}};
    }
    if(sql===S.PRUNE_INCIDENTS){
      const [cutoff]=args;
      let changes=0;
      for(const [fp,row] of [...incidents.entries()])
        if(row.lifecycle_state==='RECOVERED'&&row.recovered_at&&row.recovered_at<cutoff){
          incidents.delete(fp);changes+=1;
        }
      return {success:true,meta:{changes}};
    }
    if(sql===S.PRUNE_NOTIFICATIONS){
      const [cutoff]=args;
      let changes=0;
      for(const [key,row] of [...notifications.entries()])
        if(row.decided_at<cutoff){notifications.delete(key);changes+=1;}
      return {success:true,meta:{changes}};
    }
    throw new Error(`fake_watchdog_d1_unhandled_write:${sql}`);
  }

  function execRead(sql,args,single){
    if(sql===S.SELECT_BOOTSTRAP){
      const row=bootstrap.row;
      return single?row:{results:row?[row]:[]};
    }
    if(sql===S.SELECT_LATEST_SCHEDULED_SINCE){
      const [opportunityIso]=args;
      const candidates=[...observations.values()]
        .filter(row=>row.event_type==='schedule'&&row.opportunity_at===opportunityIso)
        .sort((a,b)=>(b.run_attempt??0)-(a.run_attempt??0)
          ||Number(a.health_state==='IN_FLIGHT')-Number(b.health_state==='IN_FLIGHT')
          ||(b.run_completed_at??b.observed_at).localeCompare(a.run_completed_at??a.observed_at)
          ||b.observed_at.localeCompare(a.observed_at)||b.observation_id.localeCompare(a.observation_id));
      const row=candidates[0]??null;
      return single?row:{results:row?[row]:[]};
    }
    if(sql===S.SELECT_RUN_OPPORTUNITY){
      const [workflowRunId]=args;
      const row=[...attributions.values()].find(item=>item.workflow_run_id===workflowRunId);
      const result=row?{opportunity_at:row.opportunity_at}:null;
      return single?result:{results:result?[result]:[]};
    }
    if(sql===S.SELECT_INCIDENT){
      const [fingerprint]=args;
      const row=incidents.get(fingerprint)??null;
      return single?row:{results:row?[row]:[]};
    }
    if(sql===S.SELECT_FAILED_NOTIFICATION){
      const [fingerprint]=args;
      const row=[...notifications.values()].filter(item=>item.fingerprint===fingerprint
        &&item.delivery_status==='FAILED').sort((a,b)=>b.decided_at.localeCompare(a.decided_at)
          ||b.idempotency_key.localeCompare(a.idempotency_key))[0]??null;
      return single?row:{results:row?[row]:[]};
    }
    throw new Error(`fake_watchdog_d1_unhandled_read:${sql}`);
  }

  return {
    prepare(sql){
      return {
        bind(...args){
          return {
            async run(){return execWrite(sql,args);},
            async first(){return execRead(sql,args,true);},
            async all(){return execRead(sql,args,false);}
          };
        }
      };
    },
    _tables:{bootstrap,claims,attributions,observations,incidents,notifications}
  };
}
