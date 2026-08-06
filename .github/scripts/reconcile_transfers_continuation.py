from pathlib import Path
import json
import sys


def replace_once(path, old, new):
    target=Path(path)
    text=target.read_text()
    count=text.count(old)
    if count!=1:
        raise SystemExit(f"{path}: expected one match, found {count}")
    target.write_text(text.replace(old,new,1))


def append_once(path, marker, section):
    target=Path(path)
    text=target.read_text()
    if marker in text:
        raise SystemExit(f"{path}: marker already exists")
    target.write_text(text.rstrip()+"\n\n"+section.strip()+"\n")


def source():
    replace_once(
        'src/ui/transfer-performance.mjs',
        """function transferPerformanceYield(){
  return new Promise(resolve=>{
    if(typeof globalThis.requestAnimationFrame==='function') globalThis.requestAnimationFrame(()=>resolve());
    else globalThis.setTimeout?.(resolve,0);
  });
}
""",
        """function transferPerformanceYield(){
  return new Promise(resolve=>{
    if(typeof globalThis.requestAnimationFrame==='function') globalThis.requestAnimationFrame(()=>resolve());
    else globalThis.setTimeout?.(resolve,0);
  });
}

function transferPerformanceAbortError(){
  const error=new Error('Cancelled');
  error.name='AbortError';
  return error;
}
""",
    )
    replace_once(
        'src/ui/transfer-performance.mjs',
        """    if(token!==transferPerformanceToken){
      const error=new Error('Cancelled'); error.name='AbortError'; throw error;
    }
""",
        """    if(token!==transferPerformanceToken) throw transferPerformanceAbortError();
""",
    )
    replace_once(
        'src/ui/transfer-performance.mjs',
        """  transferPerformanceActive={signature:snapshot.signature,detail,promise:null};
""",
        """  transferPerformanceActive={signature:snapshot.signature,detail,promise:null,token,cancel:null};
""",
    )
    replace_once(
        'src/ui/transfer-performance.mjs',
        """      const result=await new Promise((resolve,reject)=>{
        worker.onmessage=event=>{
          const payload=event.data||{};
          if(payload.requestId!==token||token!==transferPerformanceToken) return;
          if(payload.type==='progress'){
            transferPerformanceUpdateBusy(transferPerformanceSearchingDetail(payload));
            return;
          }
          if(payload.type==='result') resolve(payload.result);
          else reject(new Error('worker_failed'));
        };
        worker.onerror=()=>reject(new Error('worker_failed'));
        worker.postMessage({type:'calculate',requestId:token,args:snapshot.args,scoreRows:prepared.rows});
      });
""",
        """      const result=await new Promise((resolve,reject)=>{
        let settled=false;
        const settle=(callback,value)=>{
          if(settled) return;
          settled=true;
          if(transferPerformanceActive?.token===token) transferPerformanceActive.cancel=null;
          callback(value);
        };
        const cancel=()=>settle(reject,transferPerformanceAbortError());
        if(transferPerformanceActive?.token===token) transferPerformanceActive.cancel=cancel;
        else { cancel(); return; }
        worker.onmessage=event=>{
          const payload=event.data||{};
          if(payload.requestId!==token||token!==transferPerformanceToken) return;
          if(payload.type==='progress'){
            transferPerformanceUpdateBusy(transferPerformanceSearchingDetail(payload));
            return;
          }
          if(payload.type==='result') settle(resolve,payload.result);
          else settle(reject,new Error('worker_failed'));
        };
        worker.onerror=()=>settle(reject,new Error('worker_failed'));
        worker.postMessage({type:'calculate',requestId:token,args:snapshot.args,scoreRows:prepared.rows});
      });
""",
    )
    replace_once(
        'src/ui/transfer-performance.mjs',
        """function transferPerformanceCancel(message='Calculation cancelled.',{render=true,explicit=false}={}){
  const activeSignature=transferPerformanceActive?.signature||transferPerformanceSnapshot()?.signature||'';
  transferPerformanceToken++;
  transferPerformanceWorker?.terminate?.();
""",
        """function transferPerformanceCancel(message='Calculation cancelled.',{render=true,explicit=false}={}){
  const active=transferPerformanceActive;
  const activeSignature=active?.signature||transferPerformanceSnapshot()?.signature||'';
  transferPerformanceToken++;
  active?.cancel?.();
  transferPerformanceWorker?.terminate?.();
""",
    )

    replace_once(
        'src/model/transfers.mjs',
        """  return {
    bankAfter:ctx.bank+sellTotal-cost-cheapestRest,
    doubtfulIncoming:chosen.filter(p=>p.status==='d').length+minimumRemainingDoubtful(byPosition,remainingNeed,usedIds),
    signature:optimisticSignatureLower(outgoing,chosen,remainingNeed,byPositionId)
  };
""",
        """  const hasRemaining=Object.values(remainingNeed).some(Boolean);
  return {
    bankAfter:ctx.bank+sellTotal-cost-cheapestRest,
    doubtfulIncoming:chosen.filter(p=>p.status==='d').length+minimumRemainingDoubtful(byPosition,remainingNeed,usedIds),
    // Every real transfer signature is non-empty. The empty string is therefore
    // universally optimistic for a partial node, without assuming numeric player-ID
    // order is the same as locale string order for mixed-width identifiers.
    signature:hasRemaining?'':optimisticSignatureLower(outgoing,chosen,remainingNeed,byPositionId)
  };
""",
    )

    replace_once(
        'tests/transfer-performance-runtime.test.mjs',
        """// Runtime contracts for the background Transfers calculation, exercised against the
// production bundle with a controllable Worker. These cover the behaviour the earlier
// implementation could not prove: route rendering never calculates, calculation is
// explicit, cancellation terminates real work, stale results cannot land, and the session
// cache returns an exact earlier result without recalculating.
""",
        """// Runtime contracts for the automatic background Transfers calculation, exercised
// against the production bundle with a controllable Worker. These cover automatic start,
// cancellation and supersession settlement, stale-result rejection, route persistence and
// exact session reuse without a synchronous UI-thread fallback.
""",
    )
    runtime=Path('tests/transfer-performance-runtime.test.mjs')
    runtime.write_text(runtime.read_text().rstrip()+"""

test('explicit cancellation settles the pending calculation promise instead of retaining an orphaned job',async()=>{
  const {T,workers}=openTransfers();
  T.renderTransfers();
  const pending=T.transferPerformanceStart();
  await settle();
  assert.equal(workers.length,1);
  T.transferPerformanceCancel('Calculation cancelled.',{render:false,explicit:true});
  const outcome=await Promise.race([
    pending.then(()=> 'settled',()=> 'settled'),
    new Promise(resolve=>setTimeout(()=>resolve('timeout'),100))
  ]);
  assert.equal(outcome,'settled');
  assert.equal(workers[0].terminated,true);
});

test('force-starting a replacement settles the superseded worker promise',async()=>{
  const {T,workers}=openTransfers();
  T.renderTransfers();
  const first=T.transferPerformanceStart();
  await settle();
  assert.equal(workers.length,1);
  const second=T.transferPerformanceStart(T.transferPerformanceSnapshot(),{force:true});
  await settle();
  assert.equal(workers.length,2);
  assert.equal(workers[0].terminated,true);
  const firstOutcome=await Promise.race([
    first.then(()=> 'settled',()=> 'settled'),
    new Promise(resolve=>setTimeout(()=>resolve('timeout'),100))
  ]);
  assert.equal(firstOutcome,'settled');
  T.transferPerformanceCancel('',{render:false,explicit:false});
  const secondOutcome=await Promise.race([
    second.then(()=> 'settled',()=> 'settled'),
    new Promise(resolve=>setTimeout(()=>resolve('timeout'),100))
  ]);
  assert.equal(secondOutcome,'settled');
});
"""+"\n")

    correction=Path('tests/transfer-exact-correction.test.mjs')
    correction.write_text(correction.read_text().rstrip()+"""

test('partial tie bounds remain exact for mixed-width player IDs and reversed input order',()=>{
  const args=differentialCase(5,'ties');
  const mixedIds=[20,99,100,101,109,110,999,1000,1001,10000];
  const candidates=args.players.filter(p=>Number(p.id)>=200);
  candidates.forEach((p,index)=>{ p.id=mixedIds[index]; });
  args.players=args.players.slice().reverse();
  args.squad=args.squad.slice().reverse();
  args.maxResults=3;
  assert.deepEqual(transferResultSummary(optimiseTransfers(args)),
    transferResultSummary(exhaustiveTransferSearch(args)));
});
"""+"\n")


def docs(test_count, profile):
    count=str(test_count)
    evaluations=f"{int(profile['evaluations']):,}"
    nodes=f"{int(profile['outgoingBranches']):,}"
    current=[
        'CLAUDE.md','docs/PROJECT_CONTEXT.md','docs/ROADMAP.md','docs/TESTING.md',
        'docs/TRANSFERS-EXACT-PERFORMANCE.md'
    ]
    replacements={
        '606 passed, 0 failed, 0 skipped':f'{count} passed, 0 failed, 0 skipped',
        '**606 passed, 0 failed, 0 skipped**':f'**{count} passed, 0 failed, 0 skipped**',
    }
    for raw in current:
        path=Path(raw); text=path.read_text()
        for old,new in replacements.items(): text=text.replace(old,new)
        path.write_text(text)

    marker='## 2026-08-06 — Concurrent continuation reconciliation'
    append_once('CLAUDE.md',marker,f"""
{marker}

- Claude's corrected exact-search commits landed on PR #70 while a separate continuation audit was in progress. The reconciliation preserves Claude's position-pool, price-capped and stopping-rule architecture.
- The app-scoped controller now settles the pending Worker result promise on explicit cancellation, material invalidation and force-start supersession, preventing orphaned in-session calculation chains.
- Partial-node signature ties now use the universally optimistic empty string; exact canonical signatures remain unchanged and are evaluated only for complete branches.
- Mixed-width player IDs, explicit cancellation settlement and supersession settlement are permanent regressions.
- Automated verification: {count} passed, zero failed or skipped, deterministic builds. Physical iPhone Safari retest remains required.
""")
    append_once('docs/PROJECT_CONTEXT.md',marker,f"""
{marker}

Claude's substantive exact-search correction was pushed concurrently and is retained in full. Reconciliation added two complementary Track A safeguards: intentional Worker cancellation now settles the associated pending promise, and partial-node signature bounds no longer depend on numeric and locale string ordering being equivalent.

The final combined repository gate is {count} passing tests. A deterministic Official-scale seed-7 profile completed with {evaluations} exact leaf evaluations across {nodes} outgoing branches. This is automated search evidence, not physical-device acceptance.
""")
    append_once('docs/ARCHITECTURE.md',marker,f"""
{marker}

The reconciled architecture keeps Claude's exact position-pool prefix sums, admissible price-capped completion, joint-budget bounds and descending-gain stopping rules.

The app-scoped controller additionally owns a one-shot cancellation settlement callback for the currently awaited Worker result. Cancel, material invalidation and force-start replacement settle that wait with an internal `AbortError`; the existing outer controller treats it as intentional cancellation and releases the superseded job's retained data.

For comparator ties, a partial search node uses `''` as its optimistic signature because every real transfer signature is non-empty. The exact unchanged canonical signature is used once the branch is complete. This is more conservative pruning and cannot alter final ordering.
""")
    append_once('docs/DECISIONS.md',marker,f"""
{marker}

**Decision:** preserve Claude's corrected exact-search architecture and add explicit Worker-wait settlement plus universally optimistic partial signatures.

**Reason:** Worker termination alone does not guarantee promise settlement, and numeric player-ID order is not universally equivalent to locale string order for mixed-width IDs.

**Consequence:** cancellation remains a paused/non-failure state, stale results remain rejected, the final comparator is unchanged and partial tie pruning is deliberately conservative. Permanent runtime and exhaustive-oracle regressions enforce the decision.
""")
    append_once('docs/ROADMAP.md',marker,f"""
{marker}

- [x] Assess and retain Claude's concurrent exact-search correction.
- [x] Reconcile explicit cancellation and force-start promise settlement.
- [x] Harden partial signature bounds for mixed-width IDs.
- [x] Pass {count} tests and deterministic build verification on the combined branch.
- [ ] Publish the combined preview and repeat the physical iPhone Safari checklist.
- [ ] Record device duration, responsiveness, memory pressure, cancellation, persistence, cache reuse and VoiceOver evidence.
- [ ] Obtain explicit approval before the stacked PR integration sequence.
""")
    append_once('docs/KNOWN_LIMITATIONS.md',marker,f"""
{marker}

The unresolved-promise risk for cancelled or superseded transfer Workers is closed by explicit settlement and runtime tests. Mixed-width player-ID tie handling is covered against the independent exhaustive oracle.

Physical iPhone Safari performance remains unverified for the combined build. CI cannot establish real device memory pressure, thermal behaviour, cancellation latency, backgrounding or VoiceOver announcements.
""")
    append_once('docs/TESTING.md',marker,f"""
{marker}

The reconciled branch passes **{count} tests**. Added contracts prove that explicit cancellation and force-start supersession settle their pending calculation promises, and that mixed-width player IDs with reversed input order preserve exact production-versus-exhaustive results.

Claude's controlled-shape, fixed-depth, re-score, prefix-sum, tied-comparator and Official-scale suites remain intact. The seed-7 automated profile completed with **{evaluations} exact leaf evaluations** across **{nodes} outgoing branches**. Automated timing is not physical-iPhone evidence.
""")
    append_once('docs/CHANGELOG.md',marker,f"""
{marker}

### Reconciled
- Retained Claude's corrected exact position-pool and budget-bound search architecture.
- Settled cancelled and superseded Worker waits to release old in-session calculation chains.
- Made partial signature bounds universally optimistic for mixed-width player IDs.

### Verification
- {count} tests pass with zero failures or skips.
- Existing independent exhaustive-oracle and Official-scale coverage remains intact.
- Deterministic production builds and root/deployable equality retained.
- Physical iPhone Safari retest remains pending.
""")
    append_once('docs/TRANSFERS-EXACT-PERFORMANCE.md',marker,f"""
{marker}

Claude's position-pool prefix sums, per-formation/final-slot bounds, price-capped completion tables, joint-budget caps and descending identity-gain stopping rules are retained unchanged.

Two lifecycle/exactness safeguards were added during reconciliation:

1. cancelling, invalidating or superseding a Worker settles the Promise awaiting its result with an internal `AbortError`, allowing the old snapshot, score rows and handlers to be released;
2. a partial node uses the empty string as its optimistic signature, avoiding any assumption that numeric player-ID order matches locale string order. Complete plans still use the unchanged canonical signature and comparator.

The combined build passes {count} tests. Mixed-width IDs match the independent exhaustive oracle, and cancellation/supersession promises are proven to settle. A deterministic seed-7 Official-scale profile completed with {evaluations} exact leaf evaluations across {nodes} outgoing branches. Physical iPhone acceptance remains outstanding.
""")


def main():
    mode=sys.argv[1]
    if mode=='source': source(); return
    if mode=='docs':
        docs(int(sys.argv[2]),json.loads(Path(sys.argv[3]).read_text())); return
    raise SystemExit(mode)


if __name__=='__main__': main()
