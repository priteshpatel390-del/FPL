// Test-only in-memory D1 fake for DATA-OPS-A1.4. It recognizes statements only by exact
// reference to the fixed constants `workers/data-steward-watchdog/persistence/statements.mjs`
// exports, exactly the way the real repository module calls them, and implements each one's real
// semantics (uniqueness, conflict handling, filtering) against plain in-memory Maps rather than a
// generic SQL engine. It exists purely to exercise the repository/orchestrator logic in Node's
// test runner without a live Cloudflare D1 database.
import * as S from '../../workers/data-steward-watchdog/persistence/statements.mjs';

export function createFakeWatchdogD1(){
  const observations=new Map();
  const incidents=new Map();
  const notifications=new Map();

  function execWrite(sql,args){
    if(sql===S.INSERT_OBSERVATION){
      const [observation_id,source_kind,event_type,workflow_run_id,run_attempt,observed_at,
        run_created_at,run_completed_at,head_sha,health_state,reason_code,evidence_hash,created_at]=args;
      if(observations.has(observation_id))return {success:true,meta:{changes:0}};
      observations.set(observation_id,{observation_id,source_kind,event_type,workflow_run_id,
        run_attempt,observed_at,run_created_at,run_completed_at,head_sha,health_state,reason_code,
        evidence_hash,created_at});
      return {success:true,meta:{changes:1}};
    }
    if(sql===S.UPSERT_INCIDENT){
      const [fingerprint,problem_class,component,lifecycle_state,reason_code,first_seen_at,
        last_seen_at,recovered_at,occurrence_count,reopened_count,last_evidence_observed_at,
        last_evidence_observation_id,,updated_at]=args;
      const existing=incidents.get(fingerprint);
      incidents.set(fingerprint,{fingerprint,problem_class,component,lifecycle_state,reason_code,
        first_seen_at,last_seen_at,recovered_at,occurrence_count,reopened_count,
        last_evidence_observed_at,last_evidence_observation_id,
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
      const [idempotency_key,fingerprint,transition,decided_at,evidence_observation_id,created_at]=args;
      if(notifications.has(idempotency_key))return {success:true,meta:{changes:0}};
      notifications.set(idempotency_key,{idempotency_key,fingerprint,transition,decided_at,
        evidence_observation_id,delivery_status:'PENDING',delivered_at:null,created_at});
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
        .filter(row=>row.lifecycle_state==='ACTIVE'&&row.last_evidence_observation_id)
        .map(row=>row.last_evidence_observation_id));
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
    if(sql===S.SELECT_LAST_SCHEDULED_SUCCESS){
      const successes=[...observations.values()]
        .filter(row=>row.event_type==='schedule'&&row.health_state==='SUCCESS'&&row.run_completed_at);
      const max=successes.reduce((best,row)=>best===null||row.run_completed_at>best?row.run_completed_at:best,null);
      return single?{last_success_at:max}:{results:[{last_success_at:max}]};
    }
    if(sql===S.SELECT_INCIDENT){
      const [fingerprint]=args;
      const row=incidents.get(fingerprint)??null;
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
    _tables:{observations,incidents,notifications}
  };
}
