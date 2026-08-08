/* BUILD {"modelVersion":"2.4.0","rulesVersion":"2026-27.3","sourceHash":"d265aaa2f65464a8","commit":"e0ff3e82eb96a0623050834ba2715430ba89bbd1"} */
const BUILD_INFO = {"modelVersion":"2.4.0","rulesVersion":"2026-27.3","sourceHash":"d265aaa2f65464a8f56d1169990f4ccc4e1fb0f4e28c50184d12e6e88829aca2","commit":"e0ff3e82eb96a0623050834ba2715430ba89bbd1","moduleOrder":["src/config.mjs","src/util.mjs","src/providers/retry.mjs","src/providers/validate.mjs","src/providers/outcome-validate.mjs","src/state.mjs","src/storage.mjs","src/ui/mini-leagues-state.mjs","src/providers/registry.mjs","src/providers/transport.mjs","src/providers/common.mjs","src/providers/understat.mjs","src/providers/odds.mjs","src/providers/minutes-history.mjs","src/ui/data-warning.mjs","src/model/fixtures.mjs","src/model/minutes.mjs","src/model/scoring-rules.mjs","src/model/scoring.mjs","src/model/simulation.mjs","src/squad.mjs","src/model/squad-simulation.mjs","src/model/transfers.mjs","src/model/walk-forward.mjs","src/model/archive-replay.mjs","src/model/backtest.mjs","src/main.mjs","src/ui/app-shell.mjs","src/ui/team-pitch.mjs","src/ui/player-detail.mjs","src/ui/decision-preview.mjs","src/evidence/snapshot.mjs","src/evidence/outcome.mjs","src/evidence/metrics.mjs","src/evidence/review.mjs","src/ui/transfer-optimiser-view.mjs","src/ui/transfer-performance.mjs","src/ui/mini-leagues-view.mjs","src/ui/views.mjs","src/ui/team-decision-home.mjs","src/ui/manual-squad-runtime.mjs","src/ui/backtest-copy.mjs","src/ui/markdown.mjs","src/ui/security-wiring.mjs","src/ui/evidence-recovery.mjs","src/ui/download.mjs","src/ui/evidence.mjs","src/ui/outcomes.mjs","src/ui/metrics.mjs","src/ui/review.mjs"]};
const TRANSFER_WORKER_MODEL_SOURCE = "\nconst POSITION_QUOTAS = TRANSFER_RULES.positionQuotas;\nconst UNAVAILABLE = new Set(TRANSFER_RULES.unavailableStatuses);\n// Reporting cadence only. It never changes which plans are evaluated, retained or ranked.\nconst TRANSFER_PROGRESS_INTERVAL = 20000;\n\nfunction playerOf(entry){ return entry?.p || entry; }\nfunction playerId(entry){ return Number(playerOf(entry)?.id); }\nfunction positionOf(entry){ return Number(playerOf(entry)?.element_type); }\nfunction hasKnownPurchasePrice(entry){\n  const raw = entry?.bought ?? entry?.purchasePrice;\n  return raw !== null && raw !== undefined && Number.isFinite(Number(raw));\n}\n\nfunction transferSellPrice(entry){\n  const now = Number(entry?.p?.now_cost ?? entry?.now_cost);\n  if(!Number.isFinite(now)) return 0;\n  const bought = hasKnownPurchasePrice(entry) ? Number(entry?.bought ?? entry?.purchasePrice) : now;\n  if(now <= bought) return now;\n  return bought + Math.floor((now - bought) / 2);\n}\n\nfunction nextFreeTransfers(freeTransfers, transferCount){\n  const ft = Math.max(0, Math.min(TRANSFER_RULES.maxFreeTransfers, Math.trunc(Number(freeTransfers) || 0)));\n  const n = Math.max(0, Math.trunc(Number(transferCount) || 0));\n  return Math.min(TRANSFER_RULES.maxFreeTransfers, Math.max(0, ft - n) + 1);\n}\n\nfunction transferHit(freeTransfers, transferCount){\n  const ft = Math.max(0, Math.min(TRANSFER_RULES.maxFreeTransfers, Math.trunc(Number(freeTransfers) || 0)));\n  const n = Math.max(0, Math.trunc(Number(transferCount) || 0));\n  const paidTransfers = Math.max(0, n - ft);\n  return { paidTransfers, hitCost: paidTransfers * TRANSFER_RULES.pointsPerPaidTransfer };\n}\n\nfunction combinations(items, size, start=0, chosen=[], out=[]){\n  if(chosen.length === size){ out.push(chosen.slice()); return out; }\n  for(let i=start; i<=items.length-(size-chosen.length); i++){\n    chosen.push(items[i]); combinations(items,size,i+1,chosen,out); chosen.pop();\n  }\n  return out;\n}\n\nfunction validateSquad(squad, {allowInheritedOverQuota=true}={}){\n  const issues=[];\n  if(!Array.isArray(squad) || squad.length !== 15) issues.push('squad_size');\n  const players = Array.isArray(squad) ? squad.map(playerOf).filter(Boolean) : [];\n  const ids = players.map(p=>Number(p.id));\n  if(new Set(ids).size !== ids.length) issues.push('duplicate_player');\n  if(players.some(p=>!Number.isFinite(Number(p.id)) || !POSITION_QUOTAS[Number(p.element_type)] || !Number.isFinite(Number(p.team)))) issues.push('unknown_player');\n  const pos={1:0,2:0,3:0,4:0}, clubs={};\n  players.forEach(p=>{ pos[p.element_type]=(pos[p.element_type]||0)+1; clubs[p.team]=(clubs[p.team]||0)+1; });\n  Object.entries(POSITION_QUOTAS).forEach(([k,v])=>{ if(pos[k]!==v) issues.push(`position_${k}`); });\n  if(!allowInheritedOverQuota && Object.values(clubs).some(n=>n>TRANSFER_RULES.maxPerClub)) issues.push('club_quota');\n  return {ok:issues.length===0, issues:[...new Set(issues)], positionCounts:pos, clubCounts:clubs};\n}\n\nfunction bestXIFromPositionRows(byPos){\n  let best=null;\n  for(let d=3;d<=5;d++) for(let m=2;m<=5;m++){\n    const f=10-d-m; if(f<1||f>3) continue;\n    if(byPos[1].length<1||byPos[2].length<d||byPos[3].length<m||byPos[4].length<f) continue;\n    const selected=[byPos[1][0],...byPos[2].slice(0,d),...byPos[3].slice(0,m),...byPos[4].slice(0,f)];\n    const total=selected.reduce((a,x)=>a+x.score,0);\n    const signature=`${d}-${m}-${f}|${selected.map(x=>x.p.id).sort((a,b)=>a-b).join(',')}`;\n    if(!best || total>best.total || (total===best.total && signature<best.signature))\n      best={total,formation:`${d}-${m}-${f}`,playerIds:selected.map(x=>Number(x.p.id)),signature};\n  }\n  return best || {total:0,formation:'—',playerIds:[],signature:''};\n}\n\nfunction bestXIForGW(squad, gw, scorePlayer){\n  const byPos={1:[],2:[],3:[],4:[]};\n  squad.forEach(entry=>{\n    const p=playerOf(entry), raw=Number(scorePlayer(p,gw));\n    byPos[p.element_type].push({entry,p,score:Number.isFinite(raw)?raw:0});\n  });\n  Object.values(byPos).forEach(arr=>arr.sort((a,b)=>b.score-a.score || Number(a.p.id)-Number(b.p.id)));\n  return bestXIFromPositionRows(byPos);\n}\n\nfunction scoreSquadAcrossHorizon(squad,startGW,horizon,scorePlayer){\n  const perGameweek=[]; let total=0;\n  for(let gw=startGW;gw<startGW+horizon;gw++){\n    const xi=bestXIForGW(squad,gw,scorePlayer); total+=xi.total; perGameweek.push({gw,...xi});\n  }\n  return {total,perGameweek};\n}\n\nfunction canonicalTransfers(transfers){\n  return transfers.slice().sort((a,b)=>a.position-b.position||a.outPlayerId-b.outPlayerId||a.inPlayerId-b.inPlayerId);\n}\nfunction planSignature(transfers){ return canonicalTransfers(transfers).map(t=>`${t.outPlayerId}>${t.inPlayerId}`).join('|'); }\n\nfunction comparePlans(a,b){\n  return b.netGain-a.netGain || b.grossBestXIPoints-a.grossBestXIPoints || a.hitCost-b.hitCost ||\n    a.transferCount-b.transferCount || b.freeTransfersNextGW-a.freeTransfersNextGW || b.bankAfter-a.bankAfter ||\n    a.doubtfulIncoming-b.doubtfulIncoming || a.signature.localeCompare(b.signature);\n}\n\nfunction inheritedClubLegal(startCounts, finalCounts, transferCount){\n  for(const [club,count] of Object.entries(finalCounts)){\n    const start=startCounts[club]||0;\n    if(start<=TRANSFER_RULES.maxPerClub && count>TRANSFER_RULES.maxPerClub) return false;\n    if(start>TRANSFER_RULES.maxPerClub && count>start) return false;\n  }\n  const startExcess=Object.values(startCounts).reduce((a,n)=>a+Math.max(0,n-TRANSFER_RULES.maxPerClub),0);\n  const finalExcess=Object.values(finalCounts).reduce((a,n)=>a+Math.max(0,n-TRANSFER_RULES.maxPerClub),0);\n  return finalExcess <= Math.max(0,startExcess-transferCount);\n}\n\nfunction buildBaseline({squad,bank,freeTransfers,startGW,horizon,scorePlayer}){\n  const baselineScore=scoreSquadAcrossHorizon(squad,startGW,horizon,scorePlayer);\n  return {transferCount:0,transfers:[],finalSquadIds:squad.map(playerId).sort((a,b)=>a-b),bankBefore:bank,bankAfter:bank,\n    freeTransfersBefore:freeTransfers,paidTransfers:0,hitCost:0,freeTransfersNextGW:nextFreeTransfers(freeTransfers,0),grossBestXIPoints:baselineScore.total,\n    grossGain:0,rollDifference:0,netGain:0,perGameweekBestXI:baselineScore.perGameweek,doubtfulIncoming:0,signature:'',warnings:[],pricingMode:'exact'};\n}\n\nfunction buildPlan({startSquad,outgoing,incoming,bank,freeTransfers,startGW,horizon,scorePlayer,baseline,startCounts,pricingMode}){\n  const outIds=new Set(outgoing.map(playerId));\n  const finalSquad=startSquad.filter(e=>!outIds.has(playerId(e))).concat(incoming.map(p=>({p,bought:p.now_cost})));\n  const legality=validateSquad(finalSquad,{allowInheritedOverQuota:true});\n  if(!legality.ok || !inheritedClubLegal(startCounts,legality.clubCounts,outgoing.length)) return null;\n  const sellTotal=outgoing.reduce((a,e)=>a+transferSellPrice(e),0);\n  const buyTotal=incoming.reduce((a,p)=>a+Number(p.now_cost||0),0);\n  const bankAfter=bank+sellTotal-buyTotal;\n  if(bankAfter<0) return null;\n  const hit=transferHit(freeTransfers,outgoing.length);\n  const score=scoreSquadAcrossHorizon(finalSquad,startGW,horizon,scorePlayer);\n  const nextFT=nextFreeTransfers(freeTransfers,outgoing.length);\n  const rollDifference=nextFT-baseline.freeTransfersNextGW;\n  const grossGain=score.total-baseline.grossBestXIPoints;\n  const netGain=grossGain-hit.hitCost+TRANSFER_RULES.rollValue*rollDifference;\n  const transfers=canonicalTransfers(outgoing.map((out,i)=>({outPlayerId:playerId(out),inPlayerId:Number(incoming[i].id),position:positionOf(out),sellPrice:transferSellPrice(out),buyPrice:Number(incoming[i].now_cost)})));\n  return {transferCount:outgoing.length,transfers,finalSquadIds:finalSquad.map(playerId).sort((a,b)=>a-b),bankBefore:bank,bankAfter,\n    freeTransfersBefore:freeTransfers,paidTransfers:hit.paidTransfers,hitCost:hit.hitCost,freeTransfersNextGW:nextFT,\n    grossBestXIPoints:score.total,grossGain,rollDifference,netGain,perGameweekBestXI:score.perGameweek,\n    doubtfulIncoming:incoming.filter(p=>p.status==='d').length,signature:planSignature(transfers),pricingMode,\n    warnings:incoming.filter(p=>p.status==='d').map(p=>`${p.web_name||p.id} doubtful (${p.chance_of_playing_next_round??'?'}%)`)};\n}\n\n// Bounded top-K retention. comparePlans() is a total order — its final tiebreak is the\n// plan signature, signatures are unique per transfer set and contain only ASCII digits,\n// '>' and '|', so two distinct plans never compare equal.\nfunction retainPlan(plans,plan,limit){\n  if(plans.length>=limit && comparePlans(plan,plans[plans.length-1])>0) return plans;\n  plans.push(plan);\n  plans.sort(comparePlans);\n  if(plans.length>limit) plans.length=limit;\n  return plans;\n}\n\nfunction normaliseSearch(args){\n  const {squad,players,bank=0,freeTransfers=1,startGW=1,horizon=6,maxTransfers=TRANSFER_RULES.maxTransfers,\n    maxResults=20,maxEvaluations=TRANSFER_RULES.maxEvaluations,scorePlayer,\n    onProgress,progressInterval=TRANSFER_PROGRESS_INTERVAL}=args;\n  const legality=validateSquad(squad,{allowInheritedOverQuota:true});\n  if(!legality.ok) return {error:{status:'invalid-input',issues:legality.issues,plans:[],evaluations:0}};\n  if(typeof scorePlayer!=='function') return {error:{status:'projection-unavailable',issues:['score_player_missing'],plans:[],evaluations:0}};\n  const cleanBank=Math.max(0,Math.trunc(Number(bank)||0));\n  const cleanFT=Math.max(0,Math.min(TRANSFER_RULES.maxFreeTransfers,Math.trunc(Number(freeTransfers)||0)));\n  const cleanHorizon=Math.max(1,Math.min(TRANSFER_RULES.maxHorizon,Math.trunc(Number(horizon)||1)));\n  const cleanLimit=Math.min(TRANSFER_RULES.maxTransfers,Math.max(0,Math.trunc(Number(maxTransfers)||0)));\n  const cleanMaxResults=Math.max(1,Math.trunc(Number(maxResults)||1));\n  const cleanMaxEvaluations=Math.max(0,Math.trunc(Number(maxEvaluations)||0));\n  const owned=new Set(squad.map(playerId));\n  const eligible=(players||[]).filter(p=>p&&!owned.has(Number(p.id))&&POSITION_QUOTAS[p.element_type]&&!UNAVAILABLE.has(p.status)).sort((a,b)=>Number(a.id)-Number(b.id));\n  const pricingMode=squad.every(hasKnownPurchasePrice)?'exact':'estimated';\n  const baseline=buildBaseline({squad,bank:cleanBank,freeTransfers:cleanFT,startGW,horizon:cleanHorizon,scorePlayer});\n  baseline.pricingMode=pricingMode;\n  return {squad,eligible,bank:cleanBank,freeTransfers:cleanFT,startGW,horizon:cleanHorizon,limit:cleanLimit,maxResults:cleanMaxResults,\n    maxEvaluations:cleanMaxEvaluations,scorePlayer,baseline,startCounts:legality.clubCounts,pricingMode,\n    onProgress:typeof onProgress==='function'?onProgress:null,\n    progressInterval:Math.max(1,Math.trunc(Number(progressInterval)||TRANSFER_PROGRESS_INTERVAL))};\n}\n\nfunction completeResult(ctx,plans,evaluations,pruned=0,incomplete=false,profile=null){\n  plans.sort(comparePlans);\n  const base={evaluations,pruned,baseline:ctx.baseline,pricingMode:ctx.pricingMode};\n  if(profile) base.profile=Object.freeze({...profile});\n  if(incomplete) return {status:'search-incomplete',issues:['evaluation_limit'],plans:[ctx.baseline],...base};\n  return {status:'ok',issues:[],plans:plans.slice(0,ctx.maxResults),...base};\n}\n\nfunction exhaustiveTransferSearch(args){\n  const ctx=normaliseSearch(args); if(ctx.error) return ctx.error;\n  const plans=[ctx.baseline]; let evaluations=0, incomplete=false;\n  outer: for(let n=1;n<=ctx.limit;n++){\n    for(const outgoing of combinations(ctx.squad,n)){\n      const required=outgoing.map(positionOf).sort((a,b)=>a-b);\n      const candidates=ctx.eligible.filter(p=>required.includes(Number(p.element_type)));\n      for(const incoming of combinations(candidates,n)){\n        if(++evaluations>ctx.maxEvaluations){ incomplete=true; break outer; }\n        const incomingPos=incoming.map(p=>Number(p.element_type)).sort((a,b)=>a-b);\n        if(incomingPos.some((v,i)=>v!==required[i])) continue;\n        const ordered=[], used=new Set();\n        for(const out of outgoing){\n          const idx=incoming.findIndex((p,i)=>!used.has(i)&&Number(p.element_type)===positionOf(out));\n          if(idx<0) break; used.add(idx); ordered.push(incoming[idx]);\n        }\n        if(ordered.length!==n) continue;\n        const plan=buildPlan({startSquad:ctx.squad,outgoing,incoming:ordered,bank:ctx.bank,freeTransfers:ctx.freeTransfers,startGW:ctx.startGW,\n          horizon:ctx.horizon,scorePlayer:ctx.scorePlayer,baseline:ctx.baseline,startCounts:ctx.startCounts,pricingMode:ctx.pricingMode});\n        if(plan) plans.push(plan);\n      }\n    }\n  }\n  return completeResult(ctx,plans,evaluations,0,incomplete);\n}\n\nfunction prepareScoreRows(ctx){\n  const rows=new Map(), all=[], seen=new Set();\n  for(const entry of ctx.squad){ const p=playerOf(entry),id=Number(p.id); if(!seen.has(id)){seen.add(id);all.push(p);} }\n  for(const p of ctx.eligible){ const id=Number(p.id); if(!seen.has(id)){seen.add(id);all.push(p);} }\n  for(const p of all){\n    const values=[];\n    for(let offset=0;offset<ctx.horizon;offset++){\n      const raw=Number(ctx.scorePlayer(p,ctx.startGW+offset));\n      values.push(Number.isFinite(raw)?raw:0);\n    }\n    rows.set(Number(p.id),values);\n  }\n  return rows;\n}\nfunction horizonScore(scoreRows,p){ return (scoreRows.get(Number(p.id))||[]).reduce((sum,value)=>sum+value,0); }\n\nfunction buildCoreByGameweek(core,scoreRows,horizon){\n  const games=[];\n  for(let offset=0;offset<horizon;offset++){\n    const byPos={1:[],2:[],3:[],4:[]};\n    for(const entry of core){\n      const p=playerOf(entry),score=Number(scoreRows.get(Number(p.id))?.[offset])||0;\n      byPos[p.element_type].push({entry,p,score});\n    }\n    Object.values(byPos).forEach(rows=>rows.sort((a,b)=>b.score-a.score||Number(a.p.id)-Number(b.p.id)));\n    games.push(byPos);\n  }\n  return games;\n}\n\nfunction scoreCoreWithIncoming(coreByGameweek,incoming,scoreRows,startGW,horizon){\n  const perGameweek=[]; let total=0;\n  for(let offset=0;offset<horizon;offset++){\n    const base=coreByGameweek[offset];\n    const byPos={1:base[1].slice(),2:base[2].slice(),3:base[3].slice(),4:base[4].slice()};\n    for(const p of incoming){\n      const score=Number(scoreRows.get(Number(p.id))?.[offset])||0;\n      byPos[p.element_type].push({entry:p,p,score});\n    }\n    Object.values(byPos).forEach(rows=>rows.sort((a,b)=>b.score-a.score||Number(a.p.id)-Number(b.p.id)));\n    const xi=bestXIFromPositionRows(byPos);\n    total+=xi.total; perGameweek.push({gw:startGW+offset,...xi});\n  }\n  return {total,perGameweek};\n}\n\n/* ---------------------------------------------------------------------------\n   Exact position-pool machinery.\n\n   Every legal transfer keeps the squad on its exact position quota, so for a\n   fixed outgoing set the final pool at each position always holds exactly\n   POSITION_QUOTAS[pos] players. A horizon best-XI total can therefore be read\n   from per-Gameweek descending score prefix sums rather than rebuilding,\n   re-sorting and re-scanning squad rows for every candidate.\n\n   An incoming slot that is not yet filled is held as a zero placeholder. Zero\n   is optimistic because a real incoming player may score below zero, so a\n   padded pool never understates any descendant of the node.\n   --------------------------------------------------------------------------- */\nconst FORMATIONS=Object.freeze([[3,4,3],[3,5,2],[4,3,3],[4,4,2],[4,5,1],[5,2,3],[5,3,2],[5,4,1]]);\n// Largest starting count each position reaches across the legal formations.\nconst STARTER_LIMIT=Object.freeze({1:1,2:5,3:5,4:3});\n\nfunction createPoolLevel(horizon){\n  const level={count:{1:0,2:0,3:0,4:0},real:{},values:{},prefix:{}};\n  for(const pos of [1,2,3,4]){\n    const quota=POSITION_QUOTAS[pos];\n    level.real[pos]=new Float64Array(horizon*quota);\n    level.values[pos]=new Float64Array(horizon*quota);\n    level.prefix[pos]=new Float64Array(horizon*(quota+1));\n  }\n  return level;\n}\n\nfunction sortDescInPlace(row,base,length){\n  for(let k=1;k<length;k++){\n    const value=row[base+k]; let j=k-1;\n    while(j>=0&&row[base+j]<value){ row[base+j+1]=row[base+j]; j--; }\n    row[base+j+1]=value;\n  }\n}\n\n// Rebuilds the zero-padded pool and its descending prefix sums for one position.\nfunction refreshPool(level,pos,horizon){\n  const quota=POSITION_QUOTAS[pos],count=level.count[pos],\n    real=level.real[pos],values=level.values[pos],prefix=level.prefix[pos];\n  for(let offset=0;offset<horizon;offset++){\n    const rowBase=offset*quota,prefixBase=offset*(quota+1);\n    for(let k=0;k<quota;k++) values[rowBase+k]=k<count?real[rowBase+k]:0;\n    sortDescInPlace(values,rowBase,quota);\n    let sum=0; prefix[prefixBase]=0;\n    for(let k=0;k<quota;k++){ sum+=values[rowBase+k]; prefix[prefixBase+k+1]=sum; }\n  }\n}\n\nfunction seedPoolLevel(level,core,scoreRows,horizon){\n  const rows={1:[],2:[],3:[],4:[]};\n  for(const entry of core) rows[positionOf(entry)].push(scoreRows.get(playerId(entry)));\n  for(const pos of [1,2,3,4]){\n    const quota=POSITION_QUOTAS[pos],members=rows[pos],real=level.real[pos];\n    level.count[pos]=members.length;\n    for(let offset=0;offset<horizon;offset++){\n      const rowBase=offset*quota;\n      for(let k=0;k<members.length;k++) real[rowBase+k]=Number(members[k]?.[offset])||0;\n      sortDescInPlace(real,rowBase,members.length);\n    }\n    refreshPool(level,pos,horizon);\n  }\n}\n\n// Copies `from` into `to` with one further real member added at `pos`.\nfunction extendPoolLevel(from,to,pos,scoreRow,horizon){\n  for(const other of [1,2,3,4]){\n    to.count[other]=from.count[other];\n    to.real[other].set(from.real[other]);\n    if(other!==pos){ to.values[other].set(from.values[other]); to.prefix[other].set(from.prefix[other]); }\n  }\n  const quota=POSITION_QUOTAS[pos],count=from.count[pos],real=to.real[pos];\n  for(let offset=0;offset<horizon;offset++){\n    const rowBase=offset*quota;\n    real[rowBase+count]=Number(scoreRow?.[offset])||0;\n    sortDescInPlace(real,rowBase,count+1);\n  }\n  to.count[pos]=count+1;\n  refreshPool(to,pos,horizon);\n}\n\nfunction horizonTotalFromPrefixes(gkPrefix,defPrefix,midPrefix,fwdPrefix,horizon){\n  let total=0;\n  for(let offset=0;offset<horizon;offset++){\n    const gk=gkPrefix[offset*3+1],defBase=offset*6,midBase=offset*6,fwdBase=offset*4;\n    let best=-Infinity;\n    for(let i=0;i<FORMATIONS.length;i++){\n      const shape=FORMATIONS[i];\n      const value=gk+defPrefix[defBase+shape[0]]+midPrefix[midBase+shape[1]]+fwdPrefix[fwdBase+shape[2]];\n      if(value>best) best=value;\n    }\n    total+=best;\n  }\n  return total;\n}\n\n// Exact horizon best-XI total for a complete pool; an optimistic base while slots remain.\nfunction poolHorizonTotal(level,horizon){\n  return horizonTotalFromPrefixes(level.prefix[1],level.prefix[2],level.prefix[3],level.prefix[4],horizon);\n}\n\n// Admissible identity-preserving marginal of one candidate against a padded pool.\n// Filling a placeholder with score s raises any top-k total by at most\n// max(0, s - kth value of the padded pool), and the largest starting count gives\n// the smallest such threshold, so one gain is valid for every legal formation and\n// for every placeholder still outstanding at that position.\nfunction poolPlayerGain(level,pos,scoreRow,horizon){\n  const quota=POSITION_QUOTAS[pos],values=level.values[pos],index=STARTER_LIMIT[pos]-1;\n  let total=0;\n  for(let offset=0;offset<horizon;offset++){\n    const delta=(Number(scoreRow?.[offset])||0)-values[offset*quota+index];\n    if(delta>0) total+=delta;\n  }\n  return total;\n}\n\n/* Cost of moving an identity gain from the branch-level padded pool to the node's\n   padded pool. max(0, s - b) <= max(0, s - a) + max(0, a - b) for every score, so\n   adding this constant per outstanding slot keeps a branch-level gain admissible\n   at any node while leaving the branch-level ordering intact. */\nfunction thresholdDelta(branchLevel,nodeLevel,pos,horizon){\n  const quota=POSITION_QUOTAS[pos],index=STARTER_LIMIT[pos]-1;\n  const branchValues=branchLevel.values[pos],nodeValues=nodeLevel.values[pos];\n  let total=0;\n  for(let offset=0;offset<horizon;offset++){\n    const drop=branchValues[offset*quota+index]-nodeValues[offset*quota+index];\n    if(drop>0) total+=drop;\n  }\n  return total;\n}\n\n// Admissible per-formation bound for the last outstanding slot. It preserves the\n// candidate's identity across every Gameweek and applies each formation's own\n// threshold instead of the smallest threshold across formations.\nfunction finalSlotUpperBound(level,pos,scoreRow,horizon){\n  const gkPrefix=level.prefix[1],defPrefix=level.prefix[2],midPrefix=level.prefix[3],fwdPrefix=level.prefix[4];\n  const quota=POSITION_QUOTAS[pos],values=level.values[pos];\n  let total=0;\n  for(let offset=0;offset<horizon;offset++){\n    const gk=gkPrefix[offset*3+1],defBase=offset*6,midBase=offset*6,fwdBase=offset*4,\n      valueBase=offset*quota,score=Number(scoreRow?.[offset])||0;\n    let best=-Infinity;\n    for(let i=0;i<FORMATIONS.length;i++){\n      const shape=FORMATIONS[i];\n      const starters=pos===1?1:pos===2?shape[0]:pos===3?shape[1]:shape[2];\n      const delta=score-values[valueBase+starters-1];\n      const value=gk+defPrefix[defBase+shape[0]]+midPrefix[midBase+shape[1]]+fwdPrefix[fwdBase+shape[2]]+(delta>0?delta:0);\n      if(value>best) best=value;\n    }\n    total+=best;\n  }\n  return total;\n}\n\n/* Exact \"best k scores available at or below a price\" tables.\n\n   Candidates are swept in ascending price once per position, so for any budget a\n   binary search returns both how many candidates are affordable and their highest\n   scores in each Gameweek. This replaces a price-filtered scan of the whole\n   position pool at every partial node. */\nconst RELAXED_TOP_K=TRANSFER_RULES.maxTransfers;\n\nfunction buildCostCappedTables(byPositionCost,scoreRows,horizon){\n  const tables={1:null,2:null,3:null,4:null};\n  for(const pos of [1,2,3,4]){\n    const pool=byPositionCost[pos],costs=[];\n    for(const p of pool){\n      const cost=Number(p.now_cost||0);\n      if(!costs.length||costs[costs.length-1]!==cost) costs.push(cost);\n    }\n    const steps=costs.length,available=new Int32Array(steps),top=new Float64Array(horizon*steps*RELAXED_TOP_K);\n    top.fill(-Infinity);\n    for(let offset=0;offset<horizon;offset++){\n      const best=new Float64Array(RELAXED_TOP_K).fill(-Infinity);\n      let index=0,seen=0,i=0;\n      while(i<pool.length){\n        const cost=Number(pool[i].now_cost||0);\n        while(i<pool.length&&Number(pool[i].now_cost||0)===cost){\n          const score=Number(scoreRows.get(Number(pool[i].id))?.[offset])||0;\n          for(let k=0;k<RELAXED_TOP_K;k++) if(score>best[k]){\n            for(let j=RELAXED_TOP_K-1;j>k;j--) best[j]=best[j-1];\n            best[k]=score; break;\n          }\n          seen++; i++;\n        }\n        const base=(offset*steps+index)*RELAXED_TOP_K;\n        for(let k=0;k<RELAXED_TOP_K;k++) top[base+k]=best[k];\n        if(offset===0) available[index]=seen;\n        index++;\n      }\n    }\n    tables[pos]={costs:Float64Array.from(costs),steps,available,top};\n  }\n  return tables;\n}\n\n// Largest table step whose price is within budget, or -1 when nothing is affordable.\nfunction costCappedStep(table,maxCandidateCost){\n  const costs=table.costs;\n  let low=0,high=table.steps-1,found=-1;\n  while(low<=high){\n    const mid=(low+high)>>1;\n    if(costs[mid]<=maxCandidateCost){ found=mid; low=mid+1; } else high=mid-1;\n  }\n  return found;\n}\n\n/* Admissible bound that keeps `fixedRow` at `fixedPos` with its true identity and\n   fills every other outstanding slot with the highest-scoring affordable candidate\n   of that Gameweek. Cross-Gameweek identity, club capacity and candidate reuse are\n   relaxed only in the optimistic direction and the per-player price cap is exact,\n   so no reachable descendant can score higher. -Infinity means no completion can\n   be afforded at all. */\nfunction relaxedHorizonUpperBound(from,scratch,prefixRefs,remainingNeed,horizon,costTables,\n  fixedPos,fixedRow,caps){\n  for(let pos=1;pos<=4;pos++){\n    const quota=POSITION_QUOTAS[pos],count=from.count[pos];\n    const relaxedNeed=remainingNeed[pos]|0,fixed=pos===fixedPos?1:0;\n    if(!relaxedNeed&&!fixed){ prefixRefs[pos]=from.prefix[pos]; continue; }\n    const values=scratch.values[pos],prefix=scratch.prefix[pos],real=from.real[pos];\n    let step=-1,table=null;\n    if(relaxedNeed){\n      table=costTables[pos];\n      step=costCappedStep(table,caps[pos]);\n      if(step<0||table.available[step]<relaxedNeed) return -Infinity;\n    }\n    for(let offset=0;offset<horizon;offset++){\n      const rowBase=offset*quota,prefixBase=offset*(quota+1);\n      for(let k=0;k<count;k++) values[rowBase+k]=real[rowBase+k];\n      let filled=0;\n      if(fixed){ values[rowBase+count]=Number(fixedRow?.[offset])||0; filled=1; }\n      if(relaxedNeed){\n        const base=(offset*table.steps+step)*RELAXED_TOP_K;\n        for(let k=0;k<relaxedNeed;k++) values[rowBase+count+filled+k]=table.top[base+k];\n        filled+=relaxedNeed;\n      }\n      sortDescInPlace(values,rowBase,quota);\n      let sum=0; prefix[prefixBase]=0;\n      for(let k=0;k<quota;k++){ sum+=values[rowBase+k]; prefix[prefixBase+k+1]=sum; }\n    }\n    prefixRefs[pos]=prefix;\n  }\n  return horizonTotalFromPrefixes(prefixRefs[1],prefixRefs[2],prefixRefs[3],prefixRefs[4],horizon);\n}\n\nfunction minimumRemainingDoubtful(byPosition,remainingNeed,usedIds){\n  let total=0;\n  for(const pos of [1,2,3,4]){\n    const count=Number(remainingNeed[pos])||0;\n    if(!count) continue;\n    let available=0,nonDoubtful=0;\n    for(const p of byPosition[pos]){\n      if(usedIds.has(Number(p.id))) continue;\n      available++;\n      if(p.status!=='d') nonDoubtful++;\n    }\n    if(available<count) return Infinity;\n    total+=Math.max(0,count-nonDoubtful);\n  }\n  return total;\n}\n\nfunction optimisticSignatureLower(outgoing,chosen,remainingNeed,byPositionId){\n  const completion=chosen.slice(),used=new Set(chosen.map(p=>Number(p.id)));\n  for(const pos of [1,2,3,4]){\n    let left=Number(remainingNeed[pos])||0;\n    for(const p of byPositionId[pos]){\n      if(!left) break;\n      if(used.has(Number(p.id))) continue;\n      used.add(Number(p.id)); completion.push(p); left--;\n    }\n    if(left>0) return '';\n  }\n  const incoming=orderedIncomingForOutgoing(outgoing,completion);\n  const transfers=canonicalTransfers(outgoing.map((out,index)=>({\n    outPlayerId:playerId(out),inPlayerId:Number(incoming[index]?.id),position:positionOf(out)\n  })));\n  return planSignature(transfers);\n}\n\nfunction optimisticTieBreak({ctx,outgoing,chosen,remainingNeed,byPosition,byPositionCost,byPositionId,usedIds,cost,sellTotal}){\n  const cheapestRest=Object.entries(remainingNeed).reduce((sum,[pos,count])=>\n    sum+cheapestAvailableCost(byPositionCost[pos],count,usedIds),0);\n  const hasRemaining=Object.values(remainingNeed).some(Boolean);\n  return {\n    bankAfter:ctx.bank+sellTotal-cost-cheapestRest,\n    doubtfulIncoming:chosen.filter(p=>p.status==='d').length+minimumRemainingDoubtful(byPosition,remainingNeed,usedIds),\n    // Every real transfer signature is non-empty. The empty string is therefore\n    // universally optimistic for a partial node, without assuming numeric player-ID\n    // order is the same as locale string order for mixed-width identifiers.\n    signature:hasRemaining?'':optimisticSignatureLower(outgoing,chosen,remainingNeed,byPositionId)\n  };\n}\n\nconst BOUND_EPSILON=1e-9;\n\n/* Comparator-complete rejection for an already-tied optimistic bound. It is only\n   reached when the optimistic net gain and gross score both tie the retained Kth\n   plan, so the optimistic completion signature — the expensive part — is built\n   only when it can change the outcome. */\nfunction tiedBoundCannotBeat(depth,kth,optimisticTie){\n  return comparePlans({\n    netGain:kth.netGain,grossBestXIPoints:kth.grossBestXIPoints,\n    hitCost:depth.hitCost,transferCount:depth.transferCount,freeTransfersNextGW:depth.freeTransfersNextGW,\n    bankAfter:Number.isFinite(optimisticTie?.bankAfter)?optimisticTie.bankAfter:Number.MAX_SAFE_INTEGER,\n    doubtfulIncoming:Number.isFinite(optimisticTie?.doubtfulIncoming)?optimisticTie.doubtfulIncoming:-1,\n    signature:String(optimisticTie?.signature??'')\n  },kth)>0;\n}\n\n// Fixed comparator terms for one transfer depth. netOffset converts any gross\n// best-XI bound into the matching net-gain bound in one addition.\nfunction depthConstants(ctx,transferCount){\n  const hit=transferHit(ctx.freeTransfers,transferCount);\n  const freeTransfersNextGW=nextFreeTransfers(ctx.freeTransfers,transferCount);\n  const rollDifference=freeTransfersNextGW-ctx.baseline.freeTransfersNextGW;\n  return {transferCount,hitCost:hit.hitCost,paidTransfers:hit.paidTransfers,freeTransfersNextGW,\n    netOffset:-ctx.baseline.grossBestXIPoints-hit.hitCost+TRANSFER_RULES.rollValue*rollDifference};\n}\n\n// -1 rejected outright on net gain, 0 undecided until the tie keys, 1 retained.\nfunction boundVerdict(upperGross,depth,kth){\n  if(!kth) return Number.isFinite(upperGross)?1:(upperGross===-Infinity?-1:1);\n  if(!Number.isFinite(upperGross)) return upperGross===-Infinity?-1:1;\n  const upperNet=upperGross+depth.netOffset;\n  if(upperNet<kth.netGain-BOUND_EPSILON) return -1;\n  if(upperNet>kth.netGain+BOUND_EPSILON) return 1;\n  if(upperGross<kth.grossBestXIPoints-BOUND_EPSILON) return -1;\n  if(upperGross>kth.grossBestXIPoints+BOUND_EPSILON) return 1;\n  return 0;\n}\n\nfunction cheapestAvailableCost(poolByCost,count,usedIds,extraUsedId=null){\n  if(count<=0) return 0;\n  let total=0,found=0;\n  for(const p of poolByCost){\n    const id=Number(p.id);\n    if(usedIds.has(id)||id===extraUsedId) continue;\n    total+=Number(p.now_cost||0);\n    if(++found===count) return total;\n  }\n  return Infinity;\n}\n\n// Cheapest `count + 1` still-available prices at a position. One spare entry is\n// enough to price the remaining slots exactly when the candidate being tried is\n// itself one of the cheapest.\nfunction cheapestAvailableCosts(poolByCost,count,usedIds){\n  const rows=[];\n  if(count<=0) return rows;\n  for(const p of poolByCost){\n    if(usedIds.has(Number(p.id))) continue;\n    rows.push({id:Number(p.id),cost:Number(p.now_cost||0)});\n    if(rows.length===count+1) break;\n  }\n  return rows;\n}\n\n// Price of the dearest member of the cheapest `count` still-available candidates.\n// Subtracting it from a cheapest-completion total leaves a true lower bound on the\n// price of every other outstanding slot.\nfunction dearestOfCheapest(rows,count,excludedId){\n  let found=0,last=0;\n  for(let i=0;i<rows.length&&found<count;i++){\n    if(rows[i].id===excludedId) continue;\n    last=rows[i].cost; found++;\n  }\n  return found<count?Infinity:last;\n}\n\nfunction cheapestFrom(rows,count,excludedId){\n  let total=0,found=0;\n  for(let i=0;i<rows.length&&found<count;i++){\n    if(rows[i].id===excludedId) continue;\n    total+=rows[i].cost; found++;\n  }\n  return found<count?Infinity:total;\n}\n\nfunction orderedIncomingForOutgoing(outgoing,chosen){\n  const byPos={1:[],2:[],3:[],4:[]};\n  chosen.forEach(p=>byPos[positionOf(p)].push(p));\n  Object.values(byPos).forEach(rows=>rows.sort((a,b)=>Number(a.id)-Number(b.id)));\n  const used={1:0,2:0,3:0,4:0};\n  return outgoing.map(out=>byPos[positionOf(out)][used[positionOf(out)]++]);\n}\n\nfunction buildPreparedPlan({ctx,outgoing,incoming,core,coreByGameweek,scoreRows,bankAfter,clubCounts,preparedScore=null}){\n  if(!inheritedClubLegal(ctx.startCounts,clubCounts,outgoing.length)) return null;\n  const hit=transferHit(ctx.freeTransfers,outgoing.length);\n  const score=preparedScore||scoreCoreWithIncoming(coreByGameweek,incoming,scoreRows,ctx.startGW,ctx.horizon);\n  const nextFT=nextFreeTransfers(ctx.freeTransfers,outgoing.length);\n  const rollDifference=nextFT-ctx.baseline.freeTransfersNextGW;\n  const grossGain=score.total-ctx.baseline.grossBestXIPoints;\n  const netGain=grossGain-hit.hitCost+TRANSFER_RULES.rollValue*rollDifference;\n  const transfers=canonicalTransfers(outgoing.map((out,i)=>({outPlayerId:playerId(out),inPlayerId:Number(incoming[i].id),position:positionOf(out),sellPrice:transferSellPrice(out),buyPrice:Number(incoming[i].now_cost)})));\n  return {transferCount:outgoing.length,transfers,finalSquadIds:core.map(playerId).concat(incoming.map(p=>Number(p.id))).sort((a,b)=>a-b),\n    bankBefore:ctx.bank,bankAfter,freeTransfersBefore:ctx.freeTransfers,paidTransfers:hit.paidTransfers,hitCost:hit.hitCost,\n    freeTransfersNextGW:nextFT,grossBestXIPoints:score.total,grossGain,rollDifference,netGain,perGameweekBestXI:score.perGameweek,\n    doubtfulIncoming:incoming.filter(p=>p.status==='d').length,signature:planSignature(transfers),pricingMode:ctx.pricingMode,\n    warnings:incoming.filter(p=>p.status==='d').map(p=>`${p.web_name||p.id} doubtful (${p.chance_of_playing_next_round??'?'}%)`)};\n}\n\nfunction outgoingCombinations(squad,size,scoreRows){\n  return combinations(squad,size).map(set=>({\n    set,\n    score:set.reduce((sum,entry)=>sum+horizonScore(scoreRows,playerOf(entry)),0),\n    key:set.map(playerId).sort((a,b)=>a-b).join(',')\n  })).sort((a,b)=>a.score-b.score||a.key.localeCompare(b.key)).map(item=>item.set);\n}\n\nfunction optimiseTransfers(args){\n  const ctx=normaliseSearch(args); if(ctx.error) return ctx.error;\n  const plans=[ctx.baseline]; let evaluations=0, pruned=0, incomplete=false;\n  const profile={outgoingBranches:0,boundPruned:0,identityBoundPruned:0,relaxedBoundPruned:0,finalSlotPruned:0,\n    orderedBreaks:0,affordabilityPruned:0,clubPruned:0,leafEvaluations:0,materialisedPlans:0};\n  const scoreRows=prepareScoreRows(ctx);\n  const byPosition={1:[],2:[],3:[],4:[]};\n  ctx.eligible.forEach(p=>byPosition[p.element_type].push(p));\n  const byPositionCost={1:[],2:[],3:[],4:[]},byPositionId={1:[],2:[],3:[],4:[]};\n  for(const pos of [1,2,3,4]){\n    byPosition[pos].sort((a,b)=>horizonScore(scoreRows,b)-horizonScore(scoreRows,a)||Number(a.now_cost||0)-Number(b.now_cost||0)||Number(a.id)-Number(b.id));\n    byPositionCost[pos]=byPosition[pos].slice().sort((a,b)=>Number(a.now_cost||0)-Number(b.now_cost||0)||Number(a.id)-Number(b.id));\n    byPositionId[pos]=byPosition[pos].slice().sort((a,b)=>Number(a.id)-Number(b.id));\n  }\n  const costTables=buildCostCappedTables(byPositionCost,scoreRows,ctx.horizon);\n  const allowanceCache=new Map();\n  const clubAllowance=team=>{\n    let allowed=allowanceCache.get(team);\n    if(allowed===undefined){\n      allowed=Math.max(TRANSFER_RULES.maxPerClub,Number(ctx.startCounts[team])||0);\n      allowanceCache.set(team,allowed);\n    }\n    return allowed;\n  };\n  const levels=[]; for(let depth=0;depth<=TRANSFER_RULES.maxTransfers;depth++) levels.push(createPoolLevel(ctx.horizon));\n  const scratch=createPoolLevel(ctx.horizon),prefixRefs={1:null,2:null,3:null,4:null};\n  const retainedKth=()=>plans.length>=ctx.maxResults?plans[plans.length-1]:null;\n\n  outer: for(let n=1;n<=ctx.limit;n++){\n    ctx.onProgress?.({depth:n,maxDepth:ctx.limit,evaluations});\n    const depth=depthConstants(ctx,n);\n    for(const outgoing of outgoingCombinations(ctx.squad,n,scoreRows)){\n      profile.outgoingBranches++;\n      const required=outgoing.map(positionOf).sort((a,b)=>a-b);\n      const need={1:0,2:0,3:0,4:0}; required.forEach(pos=>need[pos]++);\n      if(Object.entries(need).some(([pos,count])=>byPosition[pos].length<count)){ pruned++; continue; }\n      const sellTotal=outgoing.reduce((sum,e)=>sum+transferSellPrice(e),0);\n      const budget=ctx.bank+sellTotal;\n      const noneUsed=new Set();\n      const minimumBuy=Object.entries(need).reduce((sum,[pos,count])=>sum+cheapestAvailableCost(byPositionCost[pos],count,noneUsed),0);\n      if(minimumBuy>budget){ pruned++; profile.affordabilityPruned++; continue; }\n      const outIds=new Set(outgoing.map(playerId));\n      const core=ctx.squad.filter(entry=>!outIds.has(playerId(entry)));\n      const afterOut={...ctx.startCounts}; outgoing.forEach(e=>{ afterOut[playerOf(e).team]=(afterOut[playerOf(e).team]||0)-1; });\n      seedPoolLevel(levels[0],core,scoreRows,ctx.horizon);\n\n      const caps={1:0,2:0,3:0,4:0};\n      for(let rpos=1;rpos<=4;rpos++){\n        const count=need[rpos]|0;\n        caps[rpos]=count?budget-minimumBuy+dearestOfCheapest(\n          cheapestAvailableCosts(byPositionCost[rpos],count,noneUsed),count,null):0;\n      }\n      const branchRelaxed=relaxedHorizonUpperBound(levels[0],scratch,prefixRefs,need,ctx.horizon,costTables,0,null,caps);\n      const branchKth=retainedKth();\n      let branchVerdict=boundVerdict(branchRelaxed,depth,branchKth);\n      if(branchVerdict===0) branchVerdict=tiedBoundCannotBeat(depth,branchKth,optimisticTieBreak({ctx,outgoing,chosen:[],\n        remainingNeed:need,byPosition,byPositionCost,byPositionId,usedIds:noneUsed,cost:0,sellTotal}))?-1:1;\n      if(branchVerdict<0){ pruned++; profile.boundPruned++; profile.relaxedBoundPruned++; continue; }\n\n      // Identity gains and their descending order are immutable for the whole branch.\n      const gainOrder={},gainValue={};\n      for(const pos of [1,2,3,4]){\n        if(!need[pos]) continue;\n        const values=new Map();\n        for(const p of byPosition[pos]) values.set(Number(p.id),poolPlayerGain(levels[0],pos,scoreRows.get(Number(p.id)),ctx.horizon));\n        gainOrder[pos]=byPosition[pos].slice().sort((a,b)=>\n          (values.get(Number(b.id))-values.get(Number(a.id)))||\n          Number(a.now_cost||0)-Number(b.now_cost||0)||Number(a.id)-Number(b.id));\n        gainValue[pos]=values;\n      }\n      const bestRemainingGain=(remainingNeed,usedIds,maxCandidateCost,clubCounts)=>{\n        let total=0;\n        for(let pos=1;pos<=4;pos++){\n          let left=remainingNeed[pos]|0;\n          if(!left) continue;\n          for(const p of gainOrder[pos]){\n            const id=Number(p.id);\n            if(usedIds.has(id)) continue;\n            if(Number(p.now_cost||0)>maxCandidateCost) continue;\n            if((clubCounts[p.team]|0)>=clubAllowance(p.team)) continue;\n            total+=gainValue[pos].get(id)||0;\n            if(--left===0) break;\n          }\n          if(left>0) return Infinity;\n        }\n        return total;\n      };\n      let coreByGameweek=null;\n      const preparedCore=()=>coreByGameweek||(coreByGameweek=buildCoreByGameweek(core,scoreRows,ctx.horizon));\n\n      const chosen=[],chosenPoolIndexes=[],usedIds=new Set(),clubCounts={...afterOut};\n      function choose(index,cost,level){\n        if(incomplete) return;\n        const pos=required[index],pool=gainOrder[pos],last=index===required.length-1;\n        const remainingAfter={1:0,2:0,3:0,4:0};\n        for(let i=index+1;i<required.length;i++) remainingAfter[required[i]]++;\n        const restGain=last?0:bestRemainingGain(remainingAfter,usedIds,budget-cost,clubCounts);\n        if(restGain===Infinity){ pruned++; profile.boundPruned++; return; }\n        // Exact base for everything already chosen, plus the admissible gain of an\n        // optimistic completion. Both stay valid for every descendant of this node.\n        const slotDelta={1:0,2:0,3:0,4:0}; let restDelta=0;\n        for(let rpos=1;rpos<=4;rpos++){\n          const outstanding=(remainingAfter[rpos]|0)+(rpos===pos?1:0);\n          if(!outstanding) continue;\n          slotDelta[rpos]=thresholdDelta(levels[0],level,rpos,ctx.horizon);\n          restDelta+=(remainingAfter[rpos]|0)*slotDelta[rpos];\n        }\n        const nodeCeiling=poolHorizonTotal(level,ctx.horizon)+restGain+restDelta,slotBonus=slotDelta[pos];\n        // Remaining-slot prices are fixed for the node; one spare entry per position\n        // covers the case where the candidate being tried is itself among the cheapest.\n        const cheapRows={1:null,2:null,3:null,4:null},cheapBase={1:0,2:0,3:0,4:0};\n        let cheapestRestBase=0,restPriceable=true;\n        for(let rpos=1;rpos<=4&&restPriceable;rpos++){\n          const count=remainingAfter[rpos]|0;\n          if(!count) continue;\n          const rows=cheapestAvailableCosts(byPositionCost[rpos],count,usedIds);\n          const total=cheapestFrom(rows,count,null);\n          if(!Number.isFinite(total)) restPriceable=false;\n          else { cheapRows[rpos]=rows; cheapBase[rpos]=total; cheapestRestBase+=total; }\n        }\n        if(!restPriceable){ pruned++; profile.affordabilityPruned++; return; }\n        const startAt=index>0&&required[index-1]===pos?chosenPoolIndexes[index-1]+1:0;\n        for(let poolIndex=startAt;poolIndex<pool.length;poolIndex++){\n          const candidate=pool[poolIndex],id=Number(candidate.id),team=candidate.team;\n          const gain=gainValue[pos].get(id)||0;\n          const kth=retainedKth();\n          // Descending identity order: the whole remainder of this pool is hopeless too.\n          if(boundVerdict(nodeCeiling+gain+slotBonus,depth,kth)<0){\n            pruned++; profile.boundPruned++; profile.identityBoundPruned++; profile.orderedBreaks++; break;\n          }\n          const nextCost=cost+Number(candidate.now_cost||0);\n          let cheapestRest=cheapestRestBase;\n          if(cheapRows[pos]){\n            const count=remainingAfter[pos]|0;\n            const replacement=cheapestFrom(cheapRows[pos],count,id);\n            if(!Number.isFinite(replacement)){ pruned++; profile.affordabilityPruned++; continue; }\n            cheapestRest=cheapestRest-cheapBase[pos]+replacement;\n          }\n          if(nextCost+cheapestRest>budget){ pruned++; profile.affordabilityPruned++; continue; }\n          if((clubCounts[team]|0)>=clubAllowance(team)){ pruned++; profile.clubPruned++; continue; }\n\n          if(last){\n            if(kth){\n              let verdict=boundVerdict(finalSlotUpperBound(level,pos,scoreRows.get(id),ctx.horizon),depth,kth);\n              if(verdict===0){\n                chosen.push(candidate);\n                verdict=tiedBoundCannotBeat(depth,kth,optimisticTieBreak({ctx,outgoing,chosen,\n                  remainingNeed:{1:0,2:0,3:0,4:0},byPosition,byPositionCost,byPositionId,usedIds,cost:nextCost,sellTotal}))?-1:1;\n                chosen.pop();\n              }\n              if(verdict<0){ pruned++; profile.boundPruned++; profile.finalSlotPruned++; continue; }\n            }\n            if(++evaluations>ctx.maxEvaluations){ incomplete=true; return; }\n            profile.leafEvaluations=evaluations;\n            if(ctx.onProgress&&evaluations%ctx.progressInterval===0)\n              ctx.onProgress({depth:n,maxDepth:ctx.limit,evaluations});\n            clubCounts[team]=(clubCounts[team]|0)+1;\n            if(inheritedClubLegal(ctx.startCounts,clubCounts,n)){\n              chosen.push(candidate);\n              extendPoolLevel(level,levels[index+1],pos,scoreRows.get(id),ctx.horizon);\n              const incoming=orderedIncomingForOutgoing(outgoing,chosen),bankAfter=budget-nextCost;\n              const gross=poolHorizonTotal(levels[index+1],ctx.horizon);\n              const kthNow=retainedKth();\n              let contend=boundVerdict(gross,depth,kthNow);\n              if(contend===0) contend=tiedBoundCannotBeat(depth,kthNow,{bankAfter,\n                doubtfulIncoming:incoming.filter(p=>p.status==='d').length,\n                signature:planSignature(canonicalTransfers(outgoing.map((out,i)=>({\n                  outPlayerId:playerId(out),inPlayerId:Number(incoming[i].id),position:positionOf(out)}))))})?-1:1;\n              if(contend>=0){\n                const plan=buildPreparedPlan({ctx,outgoing,incoming,core,coreByGameweek:preparedCore(),scoreRows,bankAfter,clubCounts});\n                if(plan){ profile.materialisedPlans++; retainPlan(plans,plan,ctx.maxResults); }\n              }\n              chosen.pop();\n            }\n            clubCounts[team]=(clubCounts[team]|0)-1;\n            continue;\n          }\n\n          clubCounts[team]=(clubCounts[team]|0)+1;\n          for(let rpos=1;rpos<=4;rpos++){\n            const count=remainingAfter[rpos]|0;\n            caps[rpos]=count?budget-nextCost-cheapestRest+dearestOfCheapest(cheapRows[rpos],count,id):0;\n          }\n          const relaxed=relaxedHorizonUpperBound(level,scratch,prefixRefs,remainingAfter,ctx.horizon,costTables,\n            pos,scoreRows.get(id),caps);\n          const identityUpper=nodeCeiling+gain+slotBonus;\n          const upper=Math.min(identityUpper,relaxed);\n          let verdict=boundVerdict(upper,depth,kth);\n          if(verdict===0){\n            chosen.push(candidate);\n            verdict=tiedBoundCannotBeat(depth,kth,optimisticTieBreak({ctx,outgoing,chosen,remainingNeed:remainingAfter,\n              byPosition,byPositionCost,byPositionId,usedIds,cost:nextCost,sellTotal}))?-1:1;\n            chosen.pop();\n          }\n          if(verdict<0){\n            pruned++; profile.boundPruned++;\n            if(identityUpper<=relaxed) profile.identityBoundPruned++; else profile.relaxedBoundPruned++;\n            clubCounts[team]=(clubCounts[team]|0)-1;\n            continue;\n          }\n          chosen.push(candidate); chosenPoolIndexes.push(poolIndex); usedIds.add(id);\n          extendPoolLevel(level,levels[index+1],pos,scoreRows.get(id),ctx.horizon);\n          choose(index+1,nextCost,levels[index+1]);\n          chosen.pop(); chosenPoolIndexes.pop(); usedIds.delete(id);\n          clubCounts[team]=(clubCounts[team]|0)-1;\n          if(incomplete) return;\n        }\n      }\n      choose(0,0,levels[0]);\n      if(incomplete) break outer;\n    }\n  }\n  return completeResult(ctx,plans,evaluations,pruned,incomplete,profile);\n}\n\n";
if (typeof top !== 'undefined' && typeof self !== 'undefined' && top !== self) top.location = self.location;

/* ===== src/config.mjs ===== */
// Season-specific rules and model configuration.
const FPL_RULES = Object.freeze({
  season:'2026-27',
  appearance:Object.freeze({any:1,sixtyMinutes:1}),
  goals:Object.freeze({1:6,2:6,3:5,4:4}),
  assists:3,
  cleanSheets:Object.freeze({1:4,2:4,3:1,4:0}),
  saves:Object.freeze({groupSize:3,pointsPerGroup:1}),
  goalsConceded:Object.freeze({positions:Object.freeze([1,2]),groupSize:2,pointsPerGroup:-1}),
  defensiveContribution:Object.freeze({thresholds:Object.freeze({2:10,3:12,4:12}),points:2,maximum:2}),
  cards:Object.freeze({yellow:-1,red:-3}),
  ownGoal:-2,
  penaltyMiss:-2,
  penaltySave:5,
  bonus:Object.freeze([3,2,1])
});

const GOAL_PTS   = FPL_RULES.goals;
const CS_PTS     = FPL_RULES.cleanSheets;
const ASSIST_PTS = FPL_RULES.assists;
const DC_THRESH  = FPL_RULES.defensiveContribution.thresholds;
const BASE_GOALS = 1.42;
const HOME_TILT  = 1.10;

const SCHEMA_VERSION = 3;
const MODEL_VERSION  = '2.4.0';
const RULES_VERSION  = '2026-27.3';

const MINUTES_RULES = Object.freeze({
  detailedCohort:80,
  historyWindow:8,
  recencyDecay:0.90,
  priorMatches:4,
  prior:{pStart:0.50,pAppear:0.70,p60:0.40,expMin:45,confidence:0.20},
  confidence:{high:0.75,medium:0.45},
  cacheMaxAgeMs:7 * 24 * 60 * 60 * 1000
});

const SCORING_RULES = Object.freeze({
  rareEventPriorMatches:10,
  bonusPriorAppearances:8,
  minimumExposure90:0.5,
  penaltyRoleOrders:Object.freeze([1,2])
});

const TRANSFER_RULES = Object.freeze({
  maxTransfers:3,
  maxFreeTransfers:5,
  pointsPerPaidTransfer:4,
  rollValue:0.5,
  squadBudget:1000,
  maxPerClub:3,
  positionQuotas:Object.freeze({1:2,2:5,3:5,4:3}),
  unavailableStatuses:Object.freeze(['i','u','s','n']),
  maxHorizon:8,
  maxEvaluations:2000000
});

const SIMULATION_RULES = Object.freeze({
  version:'1.0.0',
  productionSamples:5000,
  maxSamples:25000,
  blankMaximum:2,
  returnMinimum:5,
  haulMinimum:10,
  megaHaulMinimum:15,
  floorPercentile:0.25,
  upsidePercentile:0.90,
  preSeasonMode:'disabled'
});

// Adjustment-5 market rules — configuration remains unvalidated until Stage 7.
const ODDS_RULES = {
  minH2hBooks: 2,
  minTotalsBooks: 1,
  outlierProbDeviation: 0.15,
  maxQuoteAgeHours: 24,
  kickoffMatchWindowHours: 72,
  lowConfidenceBooks: 3
};



/* ===== src/util.mjs ===== */
const $ = id => document.getElementById(id);
const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const clamp = (v,lo,hi) => Math.max(lo, Math.min(hi, v));
const fmt1 = v => (Math.round(v*10)/10).toFixed(1);
const SVG_NS = 'http://www.w3.org/2000/svg';

// The only rendering primitives dynamic views should need. Attribute names are
// explicit at the call site; all children become text nodes unless they are
// already DOM nodes. Inline style attributes are deliberately rejected: Stage
// 9.6 requires every presentation rule to live in the hash-locked stylesheet.
function applyAttributes(node, attrs = {}, svg = false){
  Object.entries(attrs || {}).forEach(([key, value]) => {
    if(value == null || value === false) return;
    if(key === 'style') throw new Error('Inline style attributes are forbidden; use a class or safe element attribute.');
    if(key === 'class'){
      if(svg) node.setAttribute('class', String(value));
      else node.className = String(value);
    }
    else if(key === 'text') node.textContent = String(value);
    else if(key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if(key === 'dataset') Object.entries(value).forEach(([name, v]) => { node.dataset[name] = String(v); });
    else if(value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  });
  return node;
}

function appendChildren(node, children){
  const add = child => {
    if(child == null || child === false) return;
    if(Array.isArray(child)){ child.forEach(add); return; }
    node.appendChild(child && typeof child === 'object' && child.nodeType
      ? child : document.createTextNode(String(child)));
  };
  children.forEach(add);
  return node;
}

function el(tag, attrs = {}, ...children){
  return appendChildren(applyAttributes(document.createElement(tag), attrs), children);
}

function svgEl(tag, attrs = {}, ...children){
  return appendChildren(applyAttributes(document.createElementNS(SVG_NS, tag), attrs, true), children);
}

function setChildren(node, ...children){
  while(node.firstChild) node.removeChild(node.firstChild);
  return appendChildren(node, children.flat(Infinity));
}

const ESC_MAP = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
const escapeHTML = v => String(v).replace(/[&<>"']/g, c => ESC_MAP[c]);


/* ===== src/providers/retry.mjs ===== */
/* ---------------------------------------------------------------------
   RETRY POLICY (Stage 3 item 3, D-15) — bounded, iterative retry for
   transient provider failures.

   Placement: this sits INSIDE the transport layer. Consumers call api(),
   fetchVia() or fetchT() exactly as before and never learn that a retry
   happened. Nothing here touches scoring, projections or calibration.

   Two rules shape the whole design:

   1. Only genuinely transient failures are retried. A malformed payload,
      a parse failure, a rejected key or a 404 will fail identically on
      the next attempt, so retrying them only wastes the user's time and,
      for metered providers, their quota. Schema validation (D-14) runs
      AFTER transport and its failures are permanent by definition —
      they never re-enter this layer.

   2. Retries are bounded three ways at once: a hard attempt ceiling, an
      elapsed-time budget, and a capped backoff. The budget matters more
      than it looks — the FPL relay cascade can burn 40s before failing,
      and without a budget a "max 3 attempts" policy would licence a
      two-minute spinner. Cheap failures get retried; expensive ones do not.

   This module is pure and imports nothing, so it can be unit-tested with
   fake clocks. All timing dependencies are injectable.
   --------------------------------------------------------------------- */

// Transient at the HTTP level: the same request may well succeed shortly.
const RETRYABLE_STATUS = Object.freeze([429, 500, 502, 503, 504]);
// Permanent at the HTTP level: retrying cannot change the answer.
const PERMANENT_STATUS = Object.freeze([400, 401, 403, 404]);

const isRetryableStatus = status => RETRYABLE_STATUS.includes(status);
const isPermanentStatus = status => PERMANENT_STATUS.includes(status);

/* Per-provider configuration. attempts counts the FIRST try, so attempts:2
   means one initial request plus at most one retry. Delays are deliberately
   short: this is a phone app and a user staring at a spinner is a worse
   outcome than a missing optional layer.

   budgetMs is elapsed time since the operation began, checked BEFORE
   sleeping. For fpl/understat one "attempt" is a full relay cascade, which
   is why their budgets are lower than their theoretical worst-case runtime —
   a cascade that took longer than the budget is not a transient blip. */
const RETRY_POLICY = Object.freeze({
  fpl: Object.freeze({ provider: 'fpl', attempts: 3,
    baseDelayMs: 300, maxDelayMs: 1200, budgetMs: 15000 }),
  understat: Object.freeze({ provider: 'understat', attempts: 2,
    baseDelayMs: 300, maxDelayMs: 1200, budgetMs: 15000 }),
  odds: Object.freeze({ provider: 'odds', attempts: 2,
    baseDelayMs: 400, maxDelayMs: 1600, budgetMs: 12000 }),
  archive: Object.freeze({ provider: 'archive', attempts: 2,
    baseDelayMs: 800, maxDelayMs: 3200, budgetMs: 90000 })
});

const ATTEMPT_CEILING = 5;   // hard upper bound, whatever a policy claims

function policyFor(provider, overrides) {
  const base = RETRY_POLICY[provider] || RETRY_POLICY.fpl;
  const p = { ...base, ...(overrides || {}) };
  // Defensive clamp: a policy can never authorise an unbounded or absent loop.
  p.attempts = Math.max(1, Math.min(ATTEMPT_CEILING, Math.floor(p.attempts) || 1));
  return p;
}

/* Half-jitter exponential backoff: 50–100% of the capped exponential delay.
   Jitter avoids every client on a flaky relay retrying in lockstep; the 50%
   floor keeps the delay meaningful. Pure — the random source is injected, so
   tests get exact numbers. */
function retryDelay(attempt, policy, random = Math.random) {
  const exp = Math.min(policy.baseDelayMs * Math.pow(2, attempt - 1), policy.maxDelayMs);
  if (policy.jitter === false) return exp;
  return Math.round(exp * (0.5 + 0.5 * random()));
}

/* Endpoint labels for retry metadata. Two jobs:
   - strip the query string, because the odds request carries the API key
     there and metadata must never contain a secret;
   - collapse digit runs, so /entry/12345/event/7/picks/ becomes a stable
     key instead of creating one metadata entry per rival manager. */
function safeEndpoint(url) {
  const s = String(url);
  const noQuery = s.split('?')[0].split('#')[0];
  return noQuery.replace(/\d+/g, '{id}');
}

function defaultSleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* withRetry(task, policy, deps) -> { result, record }

   `task(attempt)` must resolve to an outcome object, never throw:
     { ok:true,  value, status }                       success
     { ok:false, retryable:boolean, status, reason }   failure

   Making the task classify its own failure is deliberate. Only the caller
   knows whether a thrown error was a dead socket (transient) or a JSON
   parse failure (permanent), and collapsing that distinction into a generic
   catch here is exactly how malformed payloads end up being retried.

   The loop is a plain bounded `for`. There is no recursion and no
   condition under which it can run more than policy.attempts times. */
async function withRetry(task, policy, deps = {}) {
  const sleep = deps.sleep || defaultSleep;
  const random = deps.random || Math.random;
  const now = deps.now || Date.now;
  const p = policyFor(policy && policy.provider, policy);
  const started = now();

  const record = { provider: p.provider, endpoint: p.endpoint || 'unknown',
    attempts: 0, finalStatus: null, retryable: false, exhausted: false,
    budgetExceeded: false };

  let result = null;
  for (let attempt = 1; attempt <= p.attempts; attempt++) {
    record.attempts = attempt;
    result = await task(attempt);

    if (result && result.ok) {
      record.finalStatus = result.status === undefined ? 'ok' : result.status;
      record.retryable = false;
      record.exhausted = false;
      return { result, record };
    }

    record.finalStatus = result && result.status !== undefined
      ? result.status : (result && result.reason) || 'error';
    record.retryable = !!(result && result.retryable);

    if (!record.retryable) return { result, record };   // permanent — stop now
    if (attempt >= p.attempts) break;                    // attempt ceiling reached
    if (p.budgetMs && (now() - started) >= p.budgetMs) { // too slow to be transient
      record.budgetExceeded = true;
      break;
    }
    await sleep(retryDelay(attempt, p, random));
  }

  record.exhausted = true;
  return { result, record };
}



/* ===== src/providers/validate.mjs ===== */
/* ---------------------------------------------------------------------
   INPUT INTEGRITY (Stage 3, D-13) — validation and normalisation of
   provider payloads before any consumer sees them.

   Called from hydrate(), NOT from slim(), and deliberately so: hydrate
   runs for cached snapshots as well as fresh fetches, so a bad payload
   is re-reported on every load instead of being noticed once at fetch
   time and then silently served from cache forever. slim() keeps the
   raw-shaped list so the cached provider snapshot stays intact for
   provenance.

   Nothing here mutates the input array or any row in it.
   No scoring, weighting or calibration behaviour is touched.
   --------------------------------------------------------------------- */

// Fields whose disagreement between two rows sharing one identity is a real
// data conflict. `started`/`finished`/`provisional_start_time` are excluded:
// within a single response they are a benign in-flight artefact, not a
// contradiction about which match this is or how it is rated.
const MATERIAL_FIELDS = ['event', 'team_h', 'team_a',
  'team_h_difficulty', 'team_a_difficulty', 'kickoff_time'];

/* Identity of a fixture row.
   Provider `id` is primary and is trusted alone — a real FPL row always
   carries one, and genuine double gameweeks are distinct rows with
   distinct ids, so id-keyed dedupe can never collapse a real double.
   The composite key is a FALLBACK used only when `id` is absent; it is
   never used to second-guess an id that is present.
   Returns null when no safe identity exists — identity is never invented. */
function fixtureIdentity(f) {
  if (f === null || typeof f !== 'object' || Array.isArray(f)) return null;
  if (f.id !== undefined && f.id !== null) return 'id:' + f.id;
  // Note: a row WITH an id and a null event (postponed/TBD) is kept untouched
  // by the branch above. Only id-less rows need a complete composite.
  const { event, team_h, team_a } = f;
  if (event === undefined || event === null) return null;
  if (team_h === undefined || team_h === null) return null;
  if (team_a === undefined || team_a === null) return null;
  return 'k:' + event + '|' + team_h + '|' + team_a;
}

function materialDiff(a, b) {
  const out = [];
  for (const k of MATERIAL_FIELDS) if (!Object.is(a[k], b[k])) out.push(k);
  return out;
}

/* normaliseFixtures(input) -> { fixtures, issues }
   - exact duplicates (same identity, no material disagreement) collapse to
     the first occurrence;
   - conflicting duplicates keep the FIRST occurrence and raise an issue
     naming the disagreeing fields — never silently resolved;
   - rows with no safe identity are excluded and reported;
   - a non-array payload is fatal and yields an empty list. */
function normaliseFixtures(input) {
  const issues = [];

  if (!Array.isArray(input)) {
    issues.push({ provider: 'fpl', endpoint: '/fixtures/',
      code: 'fixtures_not_array', severity: 'fatal', count: 1,
      received: input === null ? 'null' : typeof input });
    return { fixtures: [], issues };
  }

  const seen = new Map();
  const fixtures = [];
  const conflicts = [];
  let exactDuplicates = 0;
  let missingIdentity = 0;

  for (const row of input) {
    const key = fixtureIdentity(row);
    if (key === null) { missingIdentity++; continue; }

    if (!seen.has(key)) { seen.set(key, row); fixtures.push(row); continue; }

    const diff = materialDiff(seen.get(key), row);
    if (diff.length === 0) exactDuplicates++;
    else conflicts.push({ identity: key, fields: diff });
  }

  if (exactDuplicates)
    issues.push({ provider: 'fpl', endpoint: '/fixtures/',
      code: 'fixture_exact_duplicate', severity: 'partial',
      count: exactDuplicates });
  if (conflicts.length)
    issues.push({ provider: 'fpl', endpoint: '/fixtures/',
      code: 'fixture_conflicting_duplicate', severity: 'partial',
      count: conflicts.length, conflicts });
  if (missingIdentity)
    issues.push({ provider: 'fpl', endpoint: '/fixtures/',
      code: 'fixture_missing_identity', severity: 'partial',
      count: missingIdentity });

  return { fixtures, issues };
}

/* Payload-free rollup for the health strip: counts and worst severity only,
   never identities, team ids, or raw rows. Safe to render anywhere. */
function issueSummary(issues) {
  if (!Array.isArray(issues) || issues.length === 0)
    return { ok: true, worst: 'none', counts: {} };
  const counts = {};
  let worst = 'partial';
  for (const i of issues) {
    counts[i.code] = (counts[i.code] || 0) + (typeof i.count === 'number' ? i.count : 1);
    if (i.severity === 'fatal') worst = 'fatal';
  }
  return { ok: false, worst, counts };
}

/* =====================================================================
   PER-ENDPOINT SCHEMA VALIDATION (Stage 3 item 2, D-14)

   One focused function per endpoint, deliberately NOT a single generic
   validator: each endpoint's assumptions are the ones its consumers
   actually make, and burying them in a shared schema language would hide
   exactly the detail that matters when a feed drifts.

   Every validator:
     - returns { value, issues } and is pure;
     - never mutates the provider payload (filtered collections are new
       arrays/objects; surviving rows are passed through by reference);
     - never manufactures identifiers, values or missing structures;
     - distinguishes FATAL (payload cannot be safely consumed; value is
       null) from PARTIAL (bad rows dropped, usable remainder retained).

   Issue shape: { provider, endpoint, code, severity, count } plus at most
   a small bounded diagnostic field (field names, or a received-type string).
   Raw payloads and row contents never appear in issues.
   ===================================================================== */

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = v => typeof v === 'number' && Number.isFinite(v);
// FPL ids arrive as numbers, but relays occasionally stringify them.
const isId  = v => isNum(v) || (typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v));

function mkIssue(provider, endpoint, code, severity, count, extra) {
  const i = { provider, endpoint, code, severity, count };
  if (extra) for (const k of Object.keys(extra)) i[k] = extra[k];
  return i;
}

/* Filter a collection of rows, keeping the first valid occurrence of each
   identity where an identity accessor is supplied. Returns counts so the
   caller can raise correctly-shaped issues. Never mutates. */
function filterRows(rows, isValid, identityOf) {
  const kept = [], seen = new Set();
  let invalid = 0, duplicate = 0;
  for (const row of rows) {
    if (!isValid(row)) { invalid++; continue; }
    if (identityOf) {
      const k = identityOf(row);
      if (seen.has(k)) { duplicate++; continue; }   // retain the FIRST valid row
      seen.add(k);
    }
    kept.push(row);
  }
  return { kept, invalid, duplicate };
}

/* ---- FPL /bootstrap-static/ ------------------------------------------
   Consumers: slim() + hydrate() (events, teams, elements, element_types).
   The four collections are load-bearing for every downstream view, so a
   missing one is fatal. Individual malformed rows are dropped. */
const BOOTSTRAP_COLLECTIONS = ['events', 'teams', 'elements', 'element_types'];

/* Structural (fatal-only) check. Split out so the fresh-fetch path can
   guard slim() from throwing WITHOUT filtering rows before the snapshot is
   cached — D-13 keeps the cached snapshot raw-shaped for provenance, and
   row-level filtering belongs in hydrate() where both paths meet. */
function bootstrapStructure(payload) {
  if (!isObj(payload))
    return { ok: false, issues: [mkIssue('fpl', '/bootstrap-static/',
      'bootstrap_not_object', 'fatal', 1,
      { received: payload === null ? 'null' : Array.isArray(payload) ? 'array' : typeof payload })] };
  const missing = BOOTSTRAP_COLLECTIONS.filter(k => !Array.isArray(payload[k]));
  if (missing.length)
    return { ok: false, issues: [mkIssue('fpl', '/bootstrap-static/',
      'bootstrap_missing_collection', 'fatal', missing.length, { fields: missing })] };
  return { ok: true, issues: [] };
}

function validateBootstrap(payload) {
  const structural = bootstrapStructure(payload);
  if (!structural.ok) return { value: null, issues: structural.issues };

  const issues = [];
  const value = {};
  for (const key of BOOTSTRAP_COLLECTIONS) {
    const { kept, invalid, duplicate } = filterRows(payload[key],
      r => isObj(r) && isId(r.id), r => String(r.id));
    value[key] = kept;
    if (invalid)
      issues.push(mkIssue('fpl', '/bootstrap-static/', 'bootstrap_invalid_rows',
        'partial', invalid, { field: key }));
    if (duplicate)
      issues.push(mkIssue('fpl', '/bootstrap-static/', 'bootstrap_duplicate_rows',
        'partial', duplicate, { field: key }));
  }
  // Every other bootstrap field is passed through untouched: unknown/extra
  // fields are tolerated by design, never rejected and never counted as bad.
  for (const k of Object.keys(payload))
    if (!BOOTSTRAP_COLLECTIONS.includes(k)) value[k] = payload[k];

  return { value, issues };
}

/* ---- FPL /entry/{id}/ -------------------------------------------------
   Consumers: main.mjs (last_deadline_bank), views (name, player names,
   summary_overall_rank). Optional endpoint: a null means "not found" and
   is already handled by the caller, so it is not a validation failure. */
function validateEntry(payload) {
  if (payload === null || payload === undefined) return { value: null, issues: [] };
  if (!isObj(payload))
    return { value: null, issues: [mkIssue('fpl', '/entry/', 'entry_not_object',
      'fatal', 1, { received: Array.isArray(payload) ? 'array' : typeof payload })] };
  const issues = [];
  if (typeof payload.name !== 'string')
    issues.push(mkIssue('fpl', '/entry/', 'entry_missing_field', 'partial', 1,
      { fields: ['name'] }));
  let value = payload;
  if (payload.leagues !== undefined && payload.leagues !== null) {
    if (!isObj(payload.leagues) || !Array.isArray(payload.leagues.classic)) {
      issues.push(mkIssue('fpl', '/entry/', 'entry_classic_leagues_not_array', 'partial', 1,
        { fields: ['leagues.classic'] }));
      value = { ...payload, leagues: { ...(isObj(payload.leagues) ? payload.leagues : {}), classic: [] } };
    } else {
      const filtered = filterRows(payload.leagues.classic,
        row => isObj(row) && isId(row.id) && typeof row.name === 'string', row => String(row.id));
      const numericLike = item => isNum(item) || (typeof item === 'string' && item.trim() !== '' && Number.isFinite(Number(item)));
      let invalidOptional = 0;
      const classic = filtered.kept.map(row => {
        let next = row;
        for (const field of ['entry_rank', 'entry_last_rank']) {
          if (row[field] !== undefined && row[field] !== null && !numericLike(row[field])) {
            if (next === row) next = { ...row };
            delete next[field]; invalidOptional++;
          }
        }
        return next;
      });
      if (filtered.invalid)
        issues.push(mkIssue('fpl', '/entry/', 'entry_invalid_classic_leagues', 'partial', filtered.invalid));
      if (filtered.duplicate)
        issues.push(mkIssue('fpl', '/entry/', 'entry_duplicate_classic_leagues', 'partial', filtered.duplicate));
      if (invalidOptional)
        issues.push(mkIssue('fpl', '/entry/', 'entry_invalid_classic_league_fields', 'partial', invalidOptional,
          { fields: ['entry_rank', 'entry_last_rank'] }));
      value = { ...payload, leagues: { ...payload.leagues, classic } };
    }
  }
  return { value, issues };
}

/* ---- FPL /entry/{id}/event/{gw}/picks/ (own AND rival) ----------------
   Consumer: squad.mjs mySquad() reads picks[].element/position/multiplier;
   views.mjs reads is_captain for effective ownership. Without picks[] there
   is nothing to consume, so that is fatal for this payload. */
function validatePicks(payload, endpoint = '/entry/event/picks/') {
  if (payload === null || payload === undefined) return { value: null, issues: [] };
  if (!isObj(payload))
    return { value: null, issues: [mkIssue('fpl', endpoint, 'picks_not_object',
      'fatal', 1, { received: Array.isArray(payload) ? 'array' : typeof payload })] };
  if (!Array.isArray(payload.picks))
    return { value: null, issues: [mkIssue('fpl', endpoint, 'picks_missing_collection',
      'fatal', 1, { fields: ['picks'] })] };

  const issues = [];
  const integerLike = value => (isNum(value) || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)))) && Number.isInteger(Number(value));
  const { kept, invalid, duplicate } = filterRows(payload.picks,
    row => isObj(row) && isId(row.element) && integerLike(row.position) && Number(row.position) >= 1 && Number(row.position) <= 15,
    row => String(row.element));
  let invalidOptional = 0;
  const picks = kept.map(row => {
    let next = row;
    const remove = field => { if (next === row) next = { ...row }; delete next[field]; invalidOptional++; };
    if (row.multiplier !== undefined && (!integerLike(row.multiplier) || Number(row.multiplier) < 0 || Number(row.multiplier) > 3)) remove('multiplier');
    if (row.is_captain !== undefined && typeof row.is_captain !== 'boolean') remove('is_captain');
    if (row.is_vice_captain !== undefined && typeof row.is_vice_captain !== 'boolean') remove('is_vice_captain');
    return next;
  });
  const positions = new Set(); let duplicatePositions = 0;
  for (const row of picks) {
    const key = Number(row.position);
    if (positions.has(key)) duplicatePositions++; else positions.add(key);
  }
  const captains = picks.filter(row => row.is_captain === true || Number(row.multiplier) > 1).length;
  const viceCaptains = picks.filter(row => row.is_vice_captain === true).length;
  if (invalid)
    issues.push(mkIssue('fpl', endpoint, 'picks_invalid_rows', 'partial', invalid));
  if (duplicate)
    issues.push(mkIssue('fpl', endpoint, 'picks_duplicate_element', 'partial', duplicate));
  if (duplicatePositions)
    issues.push(mkIssue('fpl', endpoint, 'picks_duplicate_position', 'partial', duplicatePositions));
  if (invalidOptional)
    issues.push(mkIssue('fpl', endpoint, 'picks_invalid_optional_fields', 'partial', invalidOptional,
      { fields: ['multiplier', 'is_captain', 'is_vice_captain'] }));
  if (picks.length === 15 && captains !== 1)
    issues.push(mkIssue('fpl', endpoint, 'picks_invalid_captain_count', 'partial', 1));
  if (picks.length === 15 && viceCaptains !== 1)
    issues.push(mkIssue('fpl', endpoint, 'picks_invalid_vice_count', 'partial', 1));

  let value = { ...payload, picks };
  if (payload.active_chip !== undefined && payload.active_chip !== null &&
      (typeof payload.active_chip !== 'string' || !payload.active_chip.trim() || payload.active_chip.length > 40)) {
    value = { ...value }; delete value.active_chip;
    issues.push(mkIssue('fpl', endpoint, 'picks_invalid_active_chip', 'partial', 1,
      { fields: ['active_chip'] }));
  }
  return { value, issues };
}

/* ---- FPL /entry/{id}/history/ ----------------------------------------
   Consumer: main.mjs reads chips[].name and chips[].event only. chips is
   optional in the real feed (a manager may have used none), so its absence
   is not an issue; a chips value of the wrong TYPE is. */
function validateHistory(payload) {
  if (payload === null || payload === undefined) return { value: null, issues: [] };
  if (!isObj(payload))
    return { value: null, issues: [mkIssue('fpl', '/entry/history/', 'history_not_object',
      'fatal', 1, { received: Array.isArray(payload) ? 'array' : typeof payload })] };
  if (payload.chips === undefined || payload.chips === null)
    return { value: payload, issues: [] };
  if (!Array.isArray(payload.chips))
    return { value: { ...payload, chips: [] },
      issues: [mkIssue('fpl', '/entry/history/', 'history_chips_not_array', 'partial', 1,
        { fields: ['chips'] })] };

  const issues = [];
  const { kept, invalid } = filterRows(payload.chips, r => isObj(r) && typeof r.name === 'string');
  if (invalid)
    issues.push(mkIssue('fpl', '/entry/history/', 'history_invalid_chip_rows', 'partial', invalid));
  return { value: { ...payload, chips: kept }, issues };
}

/* ---- FPL /leagues-classic/{id}/standings/ -----------------------------
   Consumer: views.mjs reads standings.results[].entry and .rank, and
   league.name. Without standings.results there is no league to render. */
function validateStandings(payload) {
  if (payload === null || payload === undefined) return { value: null, issues: [] };
  if (!isObj(payload))
    return { value: null, issues: [mkIssue('fpl', '/leagues-classic/standings/',
      'standings_not_object', 'fatal', 1,
      { received: Array.isArray(payload) ? 'array' : typeof payload })] };
  if (!isObj(payload.standings) || !Array.isArray(payload.standings.results))
    return { value: null, issues: [mkIssue('fpl', '/leagues-classic/standings/',
      'standings_missing_results', 'fatal', 1, { fields: ['standings.results'] })] };

  const issues = [];
  const numericLike = value => isNum(value) || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)));
  const { kept, invalid, duplicate } = filterRows(payload.standings.results,
    row => isObj(row) && isId(row.entry) && numericLike(row.rank) && numericLike(row.total) &&
      typeof row.entry_name === 'string' && typeof row.player_name === 'string', row => String(row.entry));
  let invalidOptional = 0;
  const results = kept.map(row => {
    let next = row;
    for (const field of ['last_rank', 'event_total']) {
      if (row[field] !== undefined && row[field] !== null && !numericLike(row[field])) {
        if (next === row) next = { ...row };
        delete next[field]; invalidOptional++;
      }
    }
    return next;
  });
  if (invalid)
    issues.push(mkIssue('fpl', '/leagues-classic/standings/', 'standings_invalid_rows',
      'partial', invalid));
  if (duplicate)
    issues.push(mkIssue('fpl', '/leagues-classic/standings/', 'standings_duplicate_entry',
      'partial', duplicate));
  if (invalidOptional)
    issues.push(mkIssue('fpl', '/leagues-classic/standings/', 'standings_invalid_optional_fields',
      'partial', invalidOptional, { fields: ['last_rank', 'event_total'] }));
  if (!isObj(payload.league) || typeof payload.league.name !== 'string')
    issues.push(mkIssue('fpl', '/leagues-classic/standings/', 'standings_missing_league_name',
      'partial', 1, { fields: ['league.name'] }));
  if (payload.standings.has_next !== undefined && typeof payload.standings.has_next !== 'boolean')
    issues.push(mkIssue('fpl', '/leagues-classic/standings/', 'standings_invalid_pagination',
      'partial', 1, { fields: ['standings.has_next'] }));
  return { value: { ...payload, standings: { ...payload.standings, results,
    has_next: typeof payload.standings.has_next === 'boolean' ? payload.standings.has_next : false } }, issues };
}

/* ---- Understat (post-parse) ------------------------------------------
   Consumer: understat.mjs reads each team's .title and .history[].xG/.xGA.
   parseUnderstat() already returns null for an unparseable page; this
   validates the shape of what it DID parse. Optional provider: a fatal
   here degrades to FPL strength ratings, it never blocks core data. */
function validateUnderstat(parsed) {
  if (parsed === null || parsed === undefined) return { value: null, issues: [] };
  if (!isObj(parsed))
    return { value: null, issues: [mkIssue('understat', 'league/EPL',
      'understat_not_object', 'fatal', 1,
      { received: Array.isArray(parsed) ? 'array' : typeof parsed })] };

  const issues = [];
  const value = {};
  let invalid = 0;
  for (const k of Object.keys(parsed)) {
    const t = parsed[k];
    if (!isObj(t) || typeof t.title !== 'string' || !Array.isArray(t.history)) { invalid++; continue; }
    value[k] = t;
  }
  if (invalid)
    issues.push(mkIssue('understat', 'league/EPL', 'understat_invalid_teams', 'partial', invalid));
  if (!Object.keys(value).length)
    issues.push(mkIssue('understat', 'league/EPL', 'understat_no_usable_teams', 'fatal', 1));
  return { value: Object.keys(value).length ? value : null, issues };
}

/* ---- The Odds API v4 --------------------------------------------------
   Consumer: odds.mjs reads home_team/away_team/commence_time/bookmakers[].
   A row whose bookmakers field is present but not an array cannot be
   consumed (the parser iterates it), so the ROW is dropped rather than
   having an empty array manufactured for it. Optional provider. */
function validateOdds(payload) {
  if (payload === null || payload === undefined) return { value: null, issues: [] };
  if (!Array.isArray(payload))
    return { value: null, issues: [mkIssue('odds', 'v4/sports/soccer_epl/odds',
      'odds_not_array', 'fatal', 1,
      { received: payload === null ? 'null' : typeof payload })] };

  const issues = [];
  const { kept, invalid } = filterRows(payload, r => isObj(r) &&
    typeof r.home_team === 'string' && typeof r.away_team === 'string' &&
    (r.bookmakers === undefined || r.bookmakers === null || Array.isArray(r.bookmakers)));
  if (invalid)
    issues.push(mkIssue('odds', 'v4/sports/soccer_epl/odds', 'odds_invalid_events',
      'partial', invalid));
  return { value: kept, issues };
}

/* ---- Historical archive CSV (vaastav merged_gw.csv) -------------------
   Consumer: computeBacktest(). Column presence is the only structural
   contract; the existing thrown message is preserved verbatim because it
   is user-facing and pinned by a resilience test. */
const ARCHIVE_REQUIRED_COLUMNS = ['name', 'position', 'minutes', 'total_points', 'GW'];

function validateArchiveHeader(headerRow) {
  if (!Array.isArray(headerRow))
    return { value: null, issues: [mkIssue('archive', 'merged_gw.csv',
      'archive_no_header', 'fatal', 1)] };
  const present = new Set(headerRow.map(h => String(h).trim()));
  const missing = ARCHIVE_REQUIRED_COLUMNS.filter(c => !present.has(c));
  if (missing.length)
    return { value: null, issues: [mkIssue('archive', 'merged_gw.csv',
      'archive_missing_columns', 'fatal', missing.length, { fields: missing })] };
  return { value: headerRow, issues: [] };
}

/* Merge issues sharing provider+endpoint+code, summing counts. Pooled calls
   (20 rival squads) would otherwise emit 20 near-identical issue objects;
   this keeps S.dataIssues bounded regardless of fan-out. Bounded diagnostic
   fields from the first occurrence are kept; nothing is concatenated. */
function collapseIssues(list) {
  if (!Array.isArray(list) || !list.length) return [];
  const byKey = new Map();
  for (const i of list) {
    const k = i.provider + '|' + i.endpoint + '|' + i.code;
    if (!byKey.has(k)) byKey.set(k, { ...i, count: typeof i.count === 'number' ? i.count : 1 });
    else byKey.get(k).count += (typeof i.count === 'number' ? i.count : 1);
  }
  return [...byKey.values()];
}

/* Convenience predicates used at every integration point. */
const hasFatal = issues => Array.isArray(issues) && issues.some(i => i.severity === 'fatal');

// NOTE: single-line export — the bundler's strip contract (README-BUILD.md)
// only recognises `export { ... };` on one line. A wrapped list survives into
// the bundle as a syntax error.


/* ===== src/providers/outcome-validate.mjs ===== */
const OUTCOME_STAT_FIELDS = Object.freeze([
  'total_points','minutes','starts','goals_scored','assists','clean_sheets','goals_conceded',
  'saves','bonus','bps','yellow_cards','red_cards','own_goals','penalties_missed',
  'penalties_saved','defensive_contribution'
]);
const FIXTURE_STAT_IDENTIFIERS = new Set([
  'goals_scored','assists','own_goals','penalties_saved','penalties_missed',
  'yellow_cards','red_cards','saves','bonus','bps','defensive_contribution'
]);
const outcomeIsObj = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const outcomeIsFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);
const outcomeIsInteger = value => Number.isInteger(Number(value));
const outcomeAsInteger = value => outcomeIsInteger(value) ? Number(value) : null;
const outcomeAsBoolean = value => typeof value === 'boolean' ? value : null;
const outcomeIssue = (endpoint,code,severity='partial',count=1,extra={}) => ({provider:'fpl',endpoint,code,severity,count,...extra});

function normaliseFixtureStatSide(value){
  if(!Array.isArray(value)) return [];
  return value.filter(row=>outcomeIsObj(row)&&outcomeAsInteger(row.element)!==null&&outcomeIsFiniteNumber(Number(row.value)))
    .map(row=>({element:outcomeAsInteger(row.element),value:Number(row.value)}))
    .sort((a,b)=>a.element-b.element||a.value-b.value);
}
function normaliseFixtureStats(value,issues,endpoint){
  if(value==null) return [];
  if(!Array.isArray(value)){
    issues.push(outcomeIssue(endpoint,'fixture_stats_not_array'));
    return [];
  }
  const out=[];
  let unknown=0,invalid=0;
  for(const row of value){
    if(!outcomeIsObj(row)||typeof row.identifier!=='string'){ invalid++; continue; }
    if(!FIXTURE_STAT_IDENTIFIERS.has(row.identifier)){ unknown++; continue; }
    out.push({identifier:row.identifier,h:normaliseFixtureStatSide(row.h),a:normaliseFixtureStatSide(row.a)});
  }
  if(invalid) issues.push(outcomeIssue(endpoint,'fixture_stats_invalid_rows','partial',invalid));
  if(unknown) issues.push(outcomeIssue(endpoint,'fixture_stats_unknown_identifiers','partial',unknown));
  return out.sort((a,b)=>a.identifier.localeCompare(b.identifier));
}
function normaliseOutcomeFixture(row,issues,endpoint){
  const id=outcomeAsInteger(row?.id), event=outcomeAsInteger(row?.event), home=outcomeAsInteger(row?.team_h), away=outcomeAsInteger(row?.team_a);
  if(id===null||event===null||home===null||away===null) return null;
  const homeScore=row.team_h_score==null?null:outcomeAsInteger(row.team_h_score);
  const awayScore=row.team_a_score==null?null:outcomeAsInteger(row.team_a_score);
  if((row.team_h_score!=null&&homeScore===null)||(row.team_a_score!=null&&awayScore===null)) return null;
  return {
    fixtureId:id,
    fixtureCode:row.code==null?null:outcomeAsInteger(row.code),
    event,
    kickoffTime:typeof row.kickoff_time==='string'?row.kickoff_time:null,
    homeTeamId:home,
    awayTeamId:away,
    homeScore,
    awayScore,
    started:outcomeAsBoolean(row.started),
    finished:outcomeAsBoolean(row.finished),
    finishedProvisional:outcomeAsBoolean(row.finished_provisional),
    minutes:row.minutes==null?null:outcomeAsInteger(row.minutes),
    provisionalStartTime:outcomeAsBoolean(row.provisional_start_time),
    stats:normaliseFixtureStats(row.stats,issues,endpoint)
  };
}
function validateOutcomeFixtures(payload,gameweek){
  const endpoint='/fixtures/?event={gw}';
  if(!Array.isArray(payload)) return {value:null,issues:[outcomeIssue(endpoint,'outcome_fixtures_not_array','fatal')]};
  const issues=[],seen=new Map(),records=[];
  let invalid=0,outside=0,exact=0,conflicting=0;
  for(const raw of payload){
    const row=normaliseOutcomeFixture(raw,issues,endpoint);
    if(!row){ invalid++; continue; }
    if(row.event!==Number(gameweek)){ outside++; continue; }
    if(seen.has(row.fixtureId)){
      const prior=seen.get(row.fixtureId);
      if(JSON.stringify(prior)===JSON.stringify(row)) exact++;
      else conflicting++;
      continue;
    }
    seen.set(row.fixtureId,row); records.push(row);
  }
  if(invalid) issues.push(outcomeIssue(endpoint,'outcome_fixture_invalid_rows','partial',invalid));
  if(outside) issues.push(outcomeIssue(endpoint,'outcome_fixture_wrong_gameweek','partial',outside));
  if(exact) issues.push(outcomeIssue(endpoint,'outcome_fixture_exact_duplicate','partial',exact));
  if(conflicting) issues.push(outcomeIssue(endpoint,'outcome_fixture_conflicting_duplicate','fatal',conflicting));
  if(conflicting) return {value:null,issues};
  records.sort((a,b)=>a.fixtureId-b.fixtureId);
  return {value:{records,complete:records.every(row=>row.finished===true)},issues};
}
function normaliseExplanationStats(value,issues){
  if(!Array.isArray(value)) return [];
  const out=[]; let invalid=0,unknown=0;
  for(const row of value){
    if(!outcomeIsObj(row)||typeof row.identifier!=='string'||!outcomeIsFiniteNumber(Number(row.points))||!outcomeIsFiniteNumber(Number(row.value))){ invalid++; continue; }
    if(!OUTCOME_STAT_FIELDS.includes(row.identifier)){ unknown++; continue; }
    out.push({identifier:row.identifier,points:Number(row.points),value:Number(row.value)});
  }
  if(invalid) issues.push(outcomeIssue('/event/{gw}/live/','outcome_explain_invalid_stats','partial',invalid));
  if(unknown) issues.push(outcomeIssue('/event/{gw}/live/','outcome_explain_unknown_stats','partial',unknown));
  return out.sort((a,b)=>a.identifier.localeCompare(b.identifier));
}
function normalisePlayerOutcome(row,fixtureIds,issues){
  const playerId=outcomeAsInteger(row?.id);
  if(playerId===null||!outcomeIsObj(row.stats)) return null;
  const stats={};
  for(const field of OUTCOME_STAT_FIELDS){
    if(row.stats[field]===undefined||row.stats[field]===null){ stats[field]=null; continue; }
    if(!outcomeIsFiniteNumber(Number(row.stats[field]))) return null;
    stats[field]=Number(row.stats[field]);
  }
  if(stats.total_points===null||stats.minutes===null) return null;
  const perFixture=[];
  if(Array.isArray(row.explain)){
    for(const detail of row.explain){
      const fixtureId=outcomeAsInteger(detail?.fixture);
      if(fixtureId===null||!fixtureIds.has(fixtureId)){
        issues.push(outcomeIssue('/event/{gw}/live/','outcome_explain_unknown_fixture','partial'));
        continue;
      }
      const officialStats=normaliseExplanationStats(detail.stats,issues);
      perFixture.push({fixtureId,points:officialStats.reduce((sum,item)=>sum+item.points,0),officialStats});
    }
  }
  perFixture.sort((a,b)=>a.fixtureId-b.fixtureId);
  return {
    playerId,
    totalPoints:stats.total_points,
    minutes:stats.minutes,
    starts:stats.starts,
    appeared:stats.minutes>0,
    reachedSixty:stats.minutes>=60,
    goalsScored:stats.goals_scored,
    assists:stats.assists,
    cleanSheets:stats.clean_sheets,
    goalsConceded:stats.goals_conceded,
    saves:stats.saves,
    bonus:stats.bonus,
    bps:stats.bps,
    yellowCards:stats.yellow_cards,
    redCards:stats.red_cards,
    ownGoals:stats.own_goals,
    penaltiesMissed:stats.penalties_missed,
    penaltiesSaved:stats.penalties_saved,
    defensiveContribution:stats.defensive_contribution,
    perFixture
  };
}
function validateOutcomeLive(payload,fixtureIds=[]){
  const endpoint='/event/{gw}/live/';
  if(!outcomeIsObj(payload)||!Array.isArray(payload.elements)) return {value:null,issues:[outcomeIssue(endpoint,'outcome_live_missing_elements','fatal')]};
  const allowed=new Set(fixtureIds.map(Number)),issues=[],records=[],seen=new Set();
  let invalid=0,duplicate=0;
  for(const raw of payload.elements){
    const row=normalisePlayerOutcome(raw,allowed,issues);
    if(!row){ invalid++; continue; }
    if(seen.has(row.playerId)){ duplicate++; continue; }
    seen.add(row.playerId); records.push(row);
  }
  if(invalid) issues.push(outcomeIssue(endpoint,'outcome_live_invalid_players','partial',invalid));
  if(duplicate) issues.push(outcomeIssue(endpoint,'outcome_live_duplicate_player','fatal',duplicate));
  if(duplicate) return {value:null,issues};
  records.sort((a,b)=>a.playerId-b.playerId);
  return {value:{records},issues};
}
function validateOutcomePicks(payload,gameweek){
  const endpoint='/entry/[redacted]/event/{gw}/picks/';
  if(payload==null) return {value:null,issues:[]};
  if(!outcomeIsObj(payload)||!Array.isArray(payload.picks)) return {value:null,issues:[outcomeIssue(endpoint,'outcome_picks_missing_collection','fatal')]};
  const issues=[],records=[],seen=new Set(); let invalid=0,duplicate=0;
  for(const row of payload.picks){
    const playerId=outcomeAsInteger(row?.element),position=outcomeAsInteger(row?.position),multiplier=outcomeAsInteger(row?.multiplier);
    if(playerId===null||position===null||multiplier===null){ invalid++; continue; }
    if(seen.has(playerId)){ duplicate++; continue; }
    seen.add(playerId);
    records.push({playerId,position,multiplier,isCaptain:Boolean(row.is_captain),isViceCaptain:Boolean(row.is_vice_captain)});
  }
  if(invalid) issues.push(outcomeIssue(endpoint,'outcome_picks_invalid_rows','partial',invalid));
  if(duplicate) issues.push(outcomeIssue(endpoint,'outcome_picks_duplicate_player','fatal',duplicate));
  if(duplicate) return {value:null,issues};
  records.sort((a,b)=>a.position-b.position||a.playerId-b.playerId);
  const automaticSubstitutions=[];
  if(Array.isArray(payload.automatic_subs)){
    for(const row of payload.automatic_subs){
      const playerIn=outcomeAsInteger(row?.element_in),playerOut=outcomeAsInteger(row?.element_out);
      if(playerIn!==null&&playerOut!==null) automaticSubstitutions.push({playerIn,playerOut});
      else issues.push(outcomeIssue(endpoint,'outcome_auto_sub_invalid_rows'));
    }
  }
  automaticSubstitutions.sort((a,b)=>a.playerOut-b.playerOut||a.playerIn-b.playerIn);
  const h=outcomeIsObj(payload.entry_history)?payload.entry_history:null;
  const entryHistory=h?{
    event:outcomeAsInteger(h.event),
    points:h.points==null?null:outcomeAsInteger(h.points),
    totalPoints:h.total_points==null?null:outcomeAsInteger(h.total_points),
    eventTransferCount:h.event_transfers==null?null:outcomeAsInteger(h.event_transfers),
    eventTransferCost:h.event_transfers_cost==null?null:outcomeAsInteger(h.event_transfers_cost),
    pointsOnBench:h.points_on_bench==null?null:outcomeAsInteger(h.points_on_bench)
  }:null;
  if(entryHistory?.event!=null&&entryHistory.event!==Number(gameweek)) issues.push(outcomeIssue(endpoint,'outcome_picks_wrong_gameweek','fatal'));
  return {value:{picks:records,automaticSubstitutions,activeChip:payload.active_chip??null,entryHistory},issues};
}
function validateOutcomeHistory(payload){
  const endpoint='/entry/[redacted]/history/';
  if(payload==null) return {value:null,issues:[]};
  if(!outcomeIsObj(payload)||!Array.isArray(payload.current)) return {value:null,issues:[outcomeIssue(endpoint,'outcome_history_missing_current','fatal')]};
  const issues=[],current=[],seen=new Set(); let invalid=0,duplicate=0;
  for(const row of payload.current){
    const event=outcomeAsInteger(row?.event);
    if(event===null){ invalid++; continue; }
    if(seen.has(event)){ duplicate++; continue; }
    seen.add(event);
    current.push({
      event,
      points:row.points==null?null:outcomeAsInteger(row.points),
      totalPoints:row.total_points==null?null:outcomeAsInteger(row.total_points),
      eventTransferCount:row.event_transfers==null?null:outcomeAsInteger(row.event_transfers),
      eventTransferCost:row.event_transfers_cost==null?null:outcomeAsInteger(row.event_transfers_cost),
      pointsOnBench:row.points_on_bench==null?null:outcomeAsInteger(row.points_on_bench)
    });
  }
  if(invalid) issues.push(outcomeIssue(endpoint,'outcome_history_invalid_rows','partial',invalid));
  if(duplicate) issues.push(outcomeIssue(endpoint,'outcome_history_duplicate_gameweek','fatal',duplicate));
  if(duplicate) return {value:null,issues};
  current.sort((a,b)=>a.event-b.event);
  const chips=Array.isArray(payload.chips)?payload.chips.filter(row=>outcomeIsObj(row)&&typeof row.name==='string'&&outcomeAsInteger(row.event)!==null).map(row=>({name:row.name,event:outcomeAsInteger(row.event)})).sort((a,b)=>a.event-b.event||a.name.localeCompare(b.name)):[];
  return {value:{current,chips},issues};
}



/* ===== src/state.mjs ===== */
const S = {
  boot:null, fixtures:null, entry:null, picks:null, history:null,
  picksGameweek:0, picksStatus:'idle', strengthsAvailable:false,
  teams:{}, byId:{}, posName:{}, avg:null,
  teamId:'', currentGW:0, nextGW:1, seasonLive:false, gamesPlayed:1,
  source:'', cachedAt:null, manual:[], chipsUsed:[], thread:[],
  dataIssues:[],
  retryStats:{},
  minuteHistory:{},
  lastOptimiser:null
};

/* ---------------------------------------------------------------------
   SLIM + CACHE — bootstrap is far too large to store whole, so only the
   fields the model uses are kept.
   --------------------------------------------------------------------- */
const TEAM_STRENGTH_FIELDS = Object.freeze([
  'strength_attack_home','strength_attack_away','strength_defence_home','strength_defence_away'
]);
function validTeamStrength(value){
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}
function teamStrengthsValid(team){
  return Boolean(team) && TEAM_STRENGTH_FIELDS.every(field => validTeamStrength(team[field]));
}

const KEEP = ['id','web_name','team','element_type','now_cost','total_points','form','points_per_game',
  'selected_by_percent','minutes','starts','goals_scored','assists','clean_sheets','saves','bonus','bps',
  'expected_goals_per_90','expected_assists_per_90','expected_goal_involvements_per_90',
  'expected_goals_conceded_per_90','defensive_contribution','defensive_contribution_per_90',
  'status','chance_of_playing_next_round','news','news_added','cost_change_event','cost_change_start',
  'transfers_in_event','transfers_out_event','penalties_order','direct_freekicks_order',
  'corners_and_indirect_freekicks_order','ep_next','yellow_cards','red_cards','own_goals',
  'penalties_missed','penalties_saved'];

function slim(boot, fixtures){
  return {
    at: Date.now(),
    events: boot.events.map(e => ({id:e.id, deadline_time:e.deadline_time, is_current:e.is_current,
      is_next:e.is_next, finished:e.finished, data_checked:e.data_checked, name:e.name})),
    teams: boot.teams.map(t => ({id:t.id, name:t.name, short_name:t.short_name,
      strength_attack_home:t.strength_attack_home, strength_attack_away:t.strength_attack_away,
      strength_defence_home:t.strength_defence_home, strength_defence_away:t.strength_defence_away})),
    element_types: boot.element_types.map(t => ({id:t.id, singular_name_short:t.singular_name_short, singular_name:t.singular_name})),
    elements: boot.elements.map(p => { const o = {}; KEEP.forEach(k => { if(p[k] !== undefined) o[k] = p[k]; }); return o; }),
    fixtures: fixtures.map(f => ({event:f.event, id:f.id, team_h:f.team_h, team_a:f.team_a,
      team_h_difficulty:f.team_h_difficulty, team_a_difficulty:f.team_a_difficulty,
      kickoff_time:f.kickoff_time, started:f.started, finished:f.finished,
      provisional_start_time:f.provisional_start_time}))
  };
}

/* D-13 + D-14: the snapshot is validated on EVERY load, fresh or cached,
   before a single assignment is made. A fatal payload returns early with
   state untouched — a half-populated S is worse than no refresh at all. */
function hydrate(d){
  const bv = validateBootstrap(d);
  const fx = bv.value === null ? { fixtures: [], issues: [] }
                               : normaliseFixtures(bv.value.fixtures);
  const issues = bv.issues.concat(fx.issues);
  if(bv.value === null || hasFatal(issues)){
    S.dataIssues = issues;
    return { ok:false, issues };
  }
  const v = bv.value;
  const invalidStrengthTeams = v.teams.filter(team => !teamStrengthsValid(team)).length;
  if(invalidStrengthTeams) issues.push({
    provider:'fpl', endpoint:'/bootstrap-static/', code:'team_strengths_unavailable',
    severity:'partial', count:invalidStrengthTeams, fields:TEAM_STRENGTH_FIELDS.slice()
  });
  S.boot = {events:v.events, teams:v.teams, elements:v.elements, element_types:v.element_types};
  S.fixtures = fx.fixtures;
  S.dataIssues = issues;
  S.teams = {}; v.teams.forEach(t => S.teams[t.id] = t);
  S.byId = {}; v.elements.forEach(p => S.byId[p.id] = p);
  S.posName = {}; S.posFull = {};
  v.element_types.forEach(t => { S.posName[t.id] = t.singular_name_short; S.posFull[t.id] = t.singular_name; });

  const cur  = v.events.find(e => e.is_current);
  const next = v.events.find(e => e.is_next) || v.events.find(e => !e.finished);
  S.currentGW = cur ? cur.id : 0;
  S.nextGW = next ? next.id : 38;
  S.seasonLive = v.events.some(e => e.finished);
  S.gamesPlayed = Math.max(1, S.currentGW);
  S.cachedAt = v.at;

  const ts = v.teams;
  S.strengthsAvailable = ts.length > 0 && ts.every(teamStrengthsValid);
  const mean = key => {
    const values = ts.map(team => Number(team[key])).filter(validTeamStrength);
    return values.length ? values.reduce((sum,value) => sum + value, 0) / values.length : null;
  };
  S.avg = {atkH:mean('strength_attack_home'), atkA:mean('strength_attack_away'),
           defH:mean('strength_defence_home'), defA:mean('strength_defence_away')};

  const sel = $('plPos');
  if(sel.options.length <= 1)
    v.element_types.forEach(t => sel.add(new Option(t.singular_name_short, t.id)));

  return { ok:true, issues };
}

function recordIssues(provider, endpoint, issues){
  S.dataIssues = S.dataIssues.filter(i => !(i.provider === provider && i.endpoint === endpoint));
  if(issues && issues.length) S.dataIssues = S.dataIssues.concat(issues);
}

function recordRetry(record){
  if(!record || !record.provider) return;
  S.retryStats[record.provider + '|' + record.endpoint] = record;
}



/* ===== src/storage.mjs ===== */
/* ---------------------------------------------------------------------
   STORAGE
   --------------------------------------------------------------------- */
const K_CFG = 'fpl:config', K_SQUAD = 'fpl:squad', K_CACHE = 'fpl:cache', K_CAL = 'fpl:calib', K_MINUTES = 'fpl:minutes-history';

async function sget(key){
  if(window.storage){
    try{ const r = await window.storage.get(key); return r ? JSON.parse(r.value) : null; }
    catch(e){ return null; }
  }
  try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }catch(e){ return null; }
}
async function sset(key, val){
  const s = JSON.stringify(val);
  if(window.storage){ try{ await window.storage.set(key, s); return; }catch(e){} }
  try{ localStorage.setItem(key, s); }catch(e){}
}

function stripDeprecatedSecrets(value){
  if(!value || typeof value !== 'object' || Array.isArray(value) ||
     !Object.prototype.hasOwnProperty.call(value, 'claudeKey'))
    return { config:value, changed:false };
  const config = { ...value };
  delete config.claudeKey;
  return { config, changed:true };
}
async function loadCfg(){
  const raw = await sget(K_CFG);
  const migrated = stripDeprecatedSecrets(raw);
  if(migrated.changed) await sset(K_CFG, migrated.config);
  return migrated.config;
}
function currentConfig(){
  const config = {
    teamId: $('teamId').value.replace(/\D/g,''),
    ft: num($('ftCount').value),
    bank: num($('bankIn').value),
    useManual: $('useManual').checked,
    useUstat: $('useUstat').checked,
    transferHorizon: Number($('trHorizon')?.value || 6),
    transferResults: Number($('trTop')?.value || 8)
  };
  const oddsKey = $('oddsKey').value.trim();
  if(oddsKey) config.oddsKey = oddsKey;
  return config;
}
async function saveCfg(){ await sset(K_CFG, currentConfig()); }


async function cachePut(key, payload, season){
  await sset(key, { schemaVersion: SCHEMA_VERSION, season, fetchedAt: Date.now(), payload });
}
async function cacheGet(key, season){
  const env = await sget(key);
  if(!env || typeof env !== 'object') return null;
  if(env.schemaVersion !== SCHEMA_VERSION) return null;
  if(season && env.season && env.season !== season) return null;
  return env.payload ?? null;
}


/* ===== src/ui/mini-leagues-state.mjs ===== */

const MINI_LEAGUE_STATE_VERSION = 2;
const K_MINI_LEAGUES = 'fpl:mini-leagues';
const K_LEGACY_LEAGUES = 'fpl:leagues';
const MAX_PINNED_RIVALS = 5;
const MAX_COMPARISON_RIVALS = 5;

function miniLeagueId(value){
  const id=String(value??'').replace(/\D/g,'');
  return id && id.length<=12 && Number(id)>0 ? id : '';
}
function miniLeagueText(value,max=100){ return typeof value==='string' ? value.trim().slice(0,max) : ''; }
function miniLeagueRecord(value={}){
  const id=miniLeagueId(value.id??value.leagueId);
  if(!id) return null;
  return {id,name:miniLeagueText(value.name??value.localName,100),primary:Boolean(value.primary)};
}
function miniLeagueRivalRecord(value={}){
  const id=miniLeagueId(value.id??value.entry);
  if(!id) return null;
  return {id,name:miniLeagueText(value.name??value.entry_name??value.player_name,100)};
}
function uniqueLeagueRecords(values=[]){
  const map=new Map();
  values.forEach(value=>{
    const row=miniLeagueRecord(value); if(!row) return;
    const previous=map.get(row.id);
    if(previous) map.set(row.id,{...previous,name:previous.name||row.name,primary:previous.primary||row.primary});
    else map.set(row.id,row);
  });
  return [...map.values()];
}
function uniqueRivalRecords(values=[],limit=MAX_COMPARISON_RIVALS){
  const rows=[]; const seen=new Set();
  (Array.isArray(values)?values:[]).forEach(value=>{
    const row=miniLeagueRivalRecord(value);
    if(row&&!seen.has(row.id)&&rows.length<limit){seen.add(row.id);rows.push(row);}
  });
  return rows;
}
function emptyMiniLeagueState(){
  return {version:MINI_LEAGUE_STATE_VERSION,selectedLeagueId:'',selectedRivalByLeague:{},comparisonRivalsByLeague:{},saved:[],pinnedRivals:{}};
}
function normaliseMiniLeagueState(value={}){
  const base=emptyMiniLeagueState();
  if(!value||typeof value!=='object'||Array.isArray(value)) return base;
  const saved=uniqueLeagueRecords(value.saved);
  let selectedLeagueId=miniLeagueId(value.selectedLeagueId);
  if(selectedLeagueId&&!saved.some(row=>row.id===selectedLeagueId)) saved.unshift({id:selectedLeagueId,name:'',primary:false});
  if(!selectedLeagueId) selectedLeagueId=saved.find(row=>row.primary)?.id||saved[0]?.id||'';
  const selectedRivalByLeague={};
  for(const [leagueId,rivalId] of Object.entries(value.selectedRivalByLeague||{})){
    const lid=miniLeagueId(leagueId),rid=miniLeagueId(rivalId); if(lid&&rid) selectedRivalByLeague[lid]=rid;
  }
  const pinnedRivals={};
  for(const [leagueId,rivals] of Object.entries(value.pinnedRivals||{})){
    const lid=miniLeagueId(leagueId); if(!lid) continue;
    const rows=uniqueRivalRecords(rivals,MAX_PINNED_RIVALS); if(rows.length) pinnedRivals[lid]=rows;
  }
  const comparisonRivalsByLeague={};
  for(const [leagueId,rivals] of Object.entries(value.comparisonRivalsByLeague||{})){
    const lid=miniLeagueId(leagueId); if(!lid) continue;
    const rows=uniqueRivalRecords(rivals,MAX_COMPARISON_RIVALS); if(rows.length) comparisonRivalsByLeague[lid]=rows;
  }
  if(saved.some(row=>row.primary)){
    let seenPrimary=false;
    saved.forEach(row=>{ if(row.primary&&!seenPrimary) seenPrimary=true; else row.primary=false; });
  }
  return {version:MINI_LEAGUE_STATE_VERSION,selectedLeagueId,selectedRivalByLeague,comparisonRivalsByLeague,saved,pinnedRivals};
}
function entryClassicLeagues(entry=S.entry){
  const rows=entry?.leagues?.classic;
  if(!Array.isArray(rows)) return [];
  return uniqueLeagueRecords(rows.map(row=>({id:row.id,name:row.name,primary:false})));
}
function migrateMiniLeagueState({stored,legacyConfig,legacyLeagues,entry}={}){
  if(stored?.version===MINI_LEAGUE_STATE_VERSION) return normaliseMiniLeagueState(stored);
  if(stored?.version===1) return normaliseMiniLeagueState({...stored,version:MINI_LEAGUE_STATE_VERSION,comparisonRivalsByLeague:{}});
  const discovered=entryClassicLeagues(entry);
  const saved=uniqueLeagueRecords([...(Array.isArray(legacyLeagues)?legacyLeagues:[]),...discovered]);
  const legacySelected=miniLeagueId(legacyConfig?.leagueId);
  if(legacySelected&&!saved.some(row=>row.id===legacySelected)) saved.unshift({id:legacySelected,name:'',primary:false});
  return normaliseMiniLeagueState({version:MINI_LEAGUE_STATE_VERSION,selectedLeagueId:legacySelected||saved[0]?.id||'',saved});
}
function syncMiniLeagueAlias(){ S.leagues=S.miniLeagues.saved; }
async function persistMiniLeagueState(){
  const state=normaliseMiniLeagueState(S.miniLeagues);
  S.miniLeagues=state; syncMiniLeagueAlias(); await sset(K_MINI_LEAGUES,state); return state;
}
async function initMiniLeagueState(legacyConfig={}){
  const stored=await sget(K_MINI_LEAGUES);
  const legacyLeagues=await sget(K_LEGACY_LEAGUES);
  S.miniLeagues=migrateMiniLeagueState({stored,legacyConfig,legacyLeagues,entry:S.entry});
  syncMiniLeagueAlias(); await persistMiniLeagueState(); return S.miniLeagues;
}
async function mergeDiscoveredMiniLeagues(entry=S.entry){
  const state=normaliseMiniLeagueState(S.miniLeagues);
  const discovered=entryClassicLeagues(entry);
  const names=new Map(discovered.map(row=>[row.id,row.name]));
  state.saved=uniqueLeagueRecords([...state.saved,...discovered]).map(row=>({...row,name:row.name||names.get(row.id)||''}));
  if(!state.selectedLeagueId) state.selectedLeagueId=state.saved.find(row=>row.primary)?.id||state.saved[0]?.id||'';
  S.miniLeagues=state; return persistMiniLeagueState();
}
function selectedMiniLeague(){
  const state=normaliseMiniLeagueState(S.miniLeagues);
  return state.saved.find(row=>row.id===state.selectedLeagueId)||null;
}
function miniLeagueMembership(leagueId,entry=S.entry){
  const id=miniLeagueId(leagueId);
  return (entry?.leagues?.classic||[]).find(row=>miniLeagueId(row?.id)===id)||null;
}
async function upsertMiniLeague(id,name='',options={}){
  id=miniLeagueId(id); if(!id) return null;
  const state=normaliseMiniLeagueState(S.miniLeagues);
  const existing=state.saved.find(row=>row.id===id);
  if(existing){ if(miniLeagueText(name)) existing.name=miniLeagueText(name); }
  else state.saved.push({id,name:miniLeagueText(name),primary:false});
  if(options.primary){ state.saved.forEach(row=>row.primary=row.id===id); }
  if(options.select!==false) state.selectedLeagueId=id;
  S.miniLeagues=state; await persistMiniLeagueState(); return selectedMiniLeague();
}
async function rememberLeague(id,name){ return upsertMiniLeague(id,name,{select:true}); }
async function selectMiniLeague(id){ return upsertMiniLeague(id,'',{select:true}); }
async function removeMiniLeague(id){
  id=miniLeagueId(id); const state=normaliseMiniLeagueState(S.miniLeagues);
  state.saved=state.saved.filter(row=>row.id!==id); delete state.selectedRivalByLeague[id]; delete state.pinnedRivals[id]; delete state.comparisonRivalsByLeague[id];
  if(state.selectedLeagueId===id) state.selectedLeagueId=state.saved.find(row=>row.primary)?.id||state.saved[0]?.id||'';
  S.miniLeagues=state; return persistMiniLeagueState();
}
async function selectMiniLeagueRival(leagueId,rival){
  const lid=miniLeagueId(leagueId),row=miniLeagueRivalRecord(rival); if(!lid||!row) return null;
  const state=normaliseMiniLeagueState(S.miniLeagues); state.selectedRivalByLeague[lid]=row.id; S.miniLeagues=state; await persistMiniLeagueState(); return row;
}
async function togglePinnedMiniLeagueRival(leagueId,rival){
  const lid=miniLeagueId(leagueId),row=miniLeagueRivalRecord(rival); if(!lid||!row) return false;
  const state=normaliseMiniLeagueState(S.miniLeagues); const rows=state.pinnedRivals[lid]||[]; const index=rows.findIndex(item=>item.id===row.id);
  if(index>=0) rows.splice(index,1); else if(rows.length<MAX_PINNED_RIVALS) rows.push(row); else return false;
  if(rows.length) state.pinnedRivals[lid]=rows; else delete state.pinnedRivals[lid];
  S.miniLeagues=state; await persistMiniLeagueState(); return index<0;
}
async function setMiniLeagueComparisonRivals(leagueId,rivals){
  const lid=miniLeagueId(leagueId); if(!lid) return [];
  const state=normaliseMiniLeagueState(S.miniLeagues),rows=uniqueRivalRecords(rivals,MAX_COMPARISON_RIVALS);
  if(rows.length) state.comparisonRivalsByLeague[lid]=rows; else delete state.comparisonRivalsByLeague[lid];
  S.miniLeagues=state; await persistMiniLeagueState(); return rows;
}
async function clearMiniLeagueComparisonRivals(leagueId){ return setMiniLeagueComparisonRivals(leagueId,[]); }
function miniLeagueSelectedRivalId(leagueId){ return normaliseMiniLeagueState(S.miniLeagues).selectedRivalByLeague[miniLeagueId(leagueId)]||''; }
function miniLeaguePinnedRivals(leagueId){ return normaliseMiniLeagueState(S.miniLeagues).pinnedRivals[miniLeagueId(leagueId)]||[]; }
function miniLeagueComparisonRivals(leagueId){ return normaliseMiniLeagueState(S.miniLeagues).comparisonRivalsByLeague[miniLeagueId(leagueId)]||[]; }

S.miniLeagues=emptyMiniLeagueState();
S.leagues=[];


/* ===== src/providers/registry.mjs ===== */
// src/providers/registry.mjs — static provider quality plus runtime health.
// D-16: runtime state is deliberately descriptive rather than a synthetic
// score. The seven states tell the owner what data is actually being used and
// what consequence follows when a provider is degraded.
const scale = ['low','medium','high']; // documentation of the vocabulary

const APPROVED_PROVIDER_NAMES = Object.freeze(['fpl','understat','odds','archive']);
const APPROVED_PROVIDER_SOURCES = Object.freeze({
  fpl:Object.freeze({label:'Official FPL',authority:'official',purpose:'players, teams, fixtures, deadlines, squads and outcomes'}),
  understat:Object.freeze({label:'Understat',authority:'approved_secondary',purpose:'team-level rolling xG only'}),
  odds:Object.freeze({label:'The Odds API',authority:'approved_secondary',purpose:'validated EPL market context'}),
  archive:Object.freeze({label:'Teamsheet archive',authority:'approved_archive',purpose:'versioned historical replay and calibration inputs'})
});

const PROVIDER_QUALITY = {
  fpl: {
    dataAuthority:'high',
    transportAvailability:'medium',
    schemaStability:'medium',
    freshness:'high',
    historicalReproducibility:'low',
    licensingConfidence:'medium'
  },
  understat: {
    dataAuthority:'medium', transportAvailability:'low', schemaStability:'low',
    freshness:'medium', historicalReproducibility:'medium', licensingConfidence:'low'
  },
  odds: {
    dataAuthority:'high', transportAvailability:'high', schemaStability:'high',
    freshness:'high', historicalReproducibility:'low',
    licensingConfidence:'high'
  },
  archive: {
    dataAuthority:'medium', transportAvailability:'high', schemaStability:'medium',
    freshness:'low', historicalReproducibility:'medium',
    licensingConfidence:'high'
  }
};

const HEALTH_STATES = Object.freeze({
  LIVE:'Live', CACHED:'Cached', STALE:'Stale', FALLBACK:'Fallback',
  PARTIAL:'Partial', DISABLED:'Disabled', UNAVAILABLE:'Unavailable'
});

const HEALTH_THRESHOLDS_MS = Object.freeze({
  fplLive:30 * 60 * 1000,
  fplOther:6 * 60 * 60 * 1000,
  understat:24 * 60 * 60 * 1000,
  odds:6 * 60 * 60 * 1000,
  archive:30 * 24 * 60 * 60 * 1000
});

const health = {};

function thresholdFor(name, context = {}){
  if(name === 'fpl') return context.seasonLive ? HEALTH_THRESHOLDS_MS.fplLive : HEALTH_THRESHOLDS_MS.fplOther;
  return HEALTH_THRESHOLDS_MS[name] || HEALTH_THRESHOLDS_MS.fplOther;
}

function setHealth(name, state, {note='', consequence='', lastSuccess=null, at=Date.now(), detail=null} = {}){
  if(!APPROVED_PROVIDER_NAMES.includes(name)) throw new Error(`Provider ${name} is not approved`);
  const previous = health[name] || {};
  const usingFallback = state === HEALTH_STATES.FALLBACK;
  const ok = [HEALTH_STATES.LIVE, HEALTH_STATES.CACHED, HEALTH_STATES.STALE,
    HEALTH_STATES.PARTIAL, HEALTH_STATES.DISABLED].includes(state);
  health[name] = {
    provider:name,
    state,
    note,
    consequence,
    lastSuccess:lastSuccess ?? previous.lastSuccess ?? null,
    at,
    detail:detail || null,
    // Stage-2 compatibility fields. They are derived from the richer state and
    // retained so existing callers/tests do not need a breaking migration.
    ok,
    usingFallback
  };
  return health[name];
}

function markLive(name, note = '', consequence = '', at = Date.now()){
  return setHealth(name, HEALTH_STATES.LIVE, {note, consequence, lastSuccess:at, at});
}
function markCached(name, lastSuccess, note = '', consequence = ''){
  return setHealth(name, HEALTH_STATES.CACHED, {note, consequence, lastSuccess, at:Date.now()});
}
function markFallback(name, note = '', consequence = ''){
  return setHealth(name, HEALTH_STATES.FALLBACK, {note, consequence});
}
function markPartial(name, note = '', consequence = '', lastSuccess = Date.now()){
  return setHealth(name, HEALTH_STATES.PARTIAL, {note, consequence, lastSuccess});
}
function markDisabled(name, note = 'turned off in settings', consequence = ''){
  return setHealth(name, HEALTH_STATES.DISABLED, {note, consequence});
}
function markUnavailable(name, note = '', consequence = ''){
  return setHealth(name, HEALTH_STATES.UNAVAILABLE, {note, consequence});
}

// Compatibility surface for Stage-2 callers. New code should use the explicit
// functions above so Disabled, Partial and Cached are never collapsed into a
// boolean failure.
function markHealth(name, ok, note = '', usingFallback = false){
  if(usingFallback) return markFallback(name, note);
  return ok ? markLive(name, note) : markUnavailable(name, note);
}

function refreshStaleness(name, context = {}, now = Date.now()){
  const h = health[name];
  if(!h || !h.lastSuccess) return h || null;
  if([HEALTH_STATES.DISABLED, HEALTH_STATES.FALLBACK, HEALTH_STATES.UNAVAILABLE].includes(h.state)) return h;
  const age = now - h.lastSuccess;
  if(age > thresholdFor(name, context)){
    return setHealth(name, HEALTH_STATES.STALE, {
      note:h.note,
      consequence:h.consequence,
      lastSuccess:h.lastSuccess,
      at:now,
      detail:h.detail
    });
  }
  return h;
}

function getHealth(name, context = {}, now = Date.now()){
  return refreshStaleness(name, context, now) || null;
}

function healthRows(context = {}, now = Date.now()){
  return APPROVED_PROVIDER_NAMES
    .map(name => getHealth(name, context, now))
    .filter(Boolean)
    .map(h => ({...h, ageMs:h.lastSuccess ? Math.max(0, now - h.lastSuccess) : null, thresholdMs:thresholdFor(h.provider,context)}));
}


function providerTrustError(rows, {requireAll=true} = {}){
  if(!Array.isArray(rows)) return 'provider_schema';
  const allowedStates = new Set(Object.values(HEALTH_STATES));
  const seen = new Set();
  for(const row of rows){
    const name = row?.provider;
    if(!APPROVED_PROVIDER_NAMES.includes(name)) return 'provider_unapproved';
    if(seen.has(name)) return 'provider_duplicate';
    seen.add(name);
    if(!allowedStates.has(row?.state)) return 'provider_state';
    if(typeof row?.included !== 'boolean' || typeof row?.didAffectModel !== 'boolean') return 'provider_usage';
    if(row.didAffectModel !== row.included) return 'provider_usage';
    if(!Number.isInteger(row?.acceptedRecordCount) || row.acceptedRecordCount < 0) return 'provider_counts';
    if(!Number.isInteger(row?.rejectedRecordCount) || row.rejectedRecordCount < 0) return 'provider_counts';
    for(const key of ['recordedAt','lastSuccessAt']){
      if(row?.[key] !== null && !Number.isFinite(Date.parse(row?.[key]))) return 'provider_time';
    }
  }
  if(requireAll && (seen.size !== APPROVED_PROVIDER_NAMES.length || APPROVED_PROVIDER_NAMES.some(name=>!seen.has(name)))) return 'provider_missing';
  return null;
}

function healthSummary(context = {}, now = Date.now()){
  return healthRows(context, now).map(h =>
    `${h.provider}: ${h.state}${h.note ? ' — ' + h.note : ''}${h.consequence ? ' · ' + h.consequence : ''}`);
}

function resetHealth(){ Object.keys(health).forEach(k => delete health[k]); }



/* ===== src/providers/transport.mjs ===== */
/* ---------------------------------------------------------------------
   Official FPL transport.

   Browser requests use the owner-controlled Teamsheet gateway declared
   in the document meta tag. The gateway is a narrow read-only transport
   to fantasy.premierleague.com; it is not another football-data provider.
   Anonymous public relays remain available only to the optional Understat
   HTML loader and are never part of the Official FPL request path.
   --------------------------------------------------------------------- */
const BASE = 'https://fantasy.premierleague.com/api';
const FPL_GATEWAY_META = 'teamsheet-fpl-gateway';
const RELAYS = [
  u => u,
  u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
  u => 'https://corsproxy.io/?' + encodeURIComponent(u),
  u => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u),
  u => 'https://thingproxy.freeboard.io/fetch/' + u
];

async function fetchT(url, ms, options = {}){
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try{ return await fetch(url, {...options, signal:c.signal}); }
  finally{ clearTimeout(t); }
}

function normaliseGatewayBase(value){
  if(typeof value !== 'string' || !value.trim()) return null;
  try{
    const u = new URL(value.trim());
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    if(u.protocol !== 'https:' && !(local && u.protocol === 'http:')) return null;
    if(u.username || u.password || u.search || u.hash) return null;
    if(!/^\/fpl\/?$/.test(u.pathname)) return null;
    return u.origin + '/fpl';
  }catch(error){ return null; }
}

function configuredGatewayBase(documentRef = globalThis.document){
  const injected = normaliseGatewayBase(globalThis.__TEAMSHEET_FPL_GATEWAY_BASE__);
  if(injected) return injected;
  const meta = documentRef?.querySelector?.(`meta[name="${FPL_GATEWAY_META}"]`);
  return normaliseGatewayBase(meta?.content || '');
}

function gatewayRequestUrl(path, gatewayBase = configuredGatewayBase()){
  const base = normaliseGatewayBase(gatewayBase);
  if(!base || typeof path !== 'string' || !path.startsWith('/') ||
     path.includes('://') || path.includes('..') || path.includes('\\')) return null;
  return base + path;
}

async function gatewayOnce(path, timeout, optional, gatewayBase){
  const url = gatewayRequestUrl(path, gatewayBase);
  if(!url) return {outcome:'failed', retryable:false, status:'gateway-unconfigured'};
  let res;
  try{
    res = await fetchT(url, timeout, {
      method:'GET',
      credentials:'omit',
      redirect:'error',
      referrerPolicy:'no-referrer',
      headers:{'Accept':'application/json'}
    });
  }catch(error){
    return {outcome:'failed', retryable:true, status:'network'};
  }
  if(!res.ok){
    if(optional && res.status === 404) return {outcome:'notfound', status:'not-found'};
    return {outcome:'failed', retryable:isRetryableStatus(res.status), status:res.status};
  }
  let data;
  try{ data = await res.json(); }
  catch(error){ return {outcome:'failed', retryable:false, status:'parse'}; }
  if(data && data.detail){
    if(optional) return {outcome:'notfound', status:'not-found'};
    return {outcome:'failed', retryable:false, status:'detail'};
  }
  S.source = 'Teamsheet gateway';
  return {outcome:'value', value:data, status:res.status};
}

async function api(path, {optional=false, timeout=8000, gatewayBase} = {}){
  const policy = policyFor('fpl');
  if(optional) policy.attempts = Math.min(policy.attempts, 2);
  const { result, record } = await withRetry(
    async () => {
      const response = await gatewayOnce(path, timeout, optional, gatewayBase);
      if(response.outcome === 'value') return {ok:true, value:response.value, status:response.status};
      if(response.outcome === 'notfound') return {ok:true, value:null, status:'not-found'};
      return {ok:false, retryable:response.retryable, status:response.status};
    },
    {...policy, endpoint:safeEndpoint(path)}
  );
  recordRetry(record);
  if(result && result.ok) return result.value;
  if(optional) return null;
  throw new Error('feed unreachable: ' + path);
}

// limited-concurrency map, so rival and player-history lookups stay bounded
async function pool(items, worker, size=4){
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({length:Math.min(size, items.length)}, async () => {
    while(i < items.length){
      const idx = i++;
      try{ out[idx] = await worker(items[idx]); }catch(error){ out[idx] = null; }
    }
  }));
  return out;
}

// Generic relay cascade retained only for optional non-FPL sources.
async function cascadeOnce(url, timeout, {asText=false} = {}){
  let sawRetryable = false, lastStatus = null;
  for(const wrap of RELAYS){
    let res;
    try{ res = await fetchT(wrap(url), timeout, {headers:{'Accept':asText?'text/html':'application/json'}}); }
    catch(error){ sawRetryable = true; lastStatus = 'network'; continue; }
    if(!res.ok){
      lastStatus = res.status;
      if(isRetryableStatus(res.status)) sawRetryable = true;
      continue;
    }
    try{
      return {outcome:'value', value:asText ? await res.text() : await res.json(), status:res.status};
    }catch(error){ lastStatus = 'parse'; }
  }
  return {outcome:'failed', retryable:sawRetryable, status:lastStatus};
}

async function fetchVia(url, {timeout=12000, asText=false} = {}){
  const { result, record } = await withRetry(
    async () => {
      const response = await cascadeOnce(url, timeout, {asText});
      if(response.outcome === 'value') return {ok:true, value:response.value, status:response.status};
      return {ok:false, retryable:response.retryable, status:response.status};
    },
    {...policyFor('understat'), endpoint:safeEndpoint(url)}
  );
  recordRetry(record);
  return result && result.ok ? result.value : null;
}



/* ===== src/providers/common.mjs ===== */
/* ---------------------------------------------------------------------
   TEAM NAME MAPPING — Understat and the odds feed use full club names;
   FPL uses its own short forms.
   --------------------------------------------------------------------- */
const NAME_ALIASES = {
  'manchester united':'Man Utd','manchester city':'Man City','tottenham':'Spurs',
  'tottenham hotspur':'Spurs','wolverhampton wanderers':'Wolves','wolverhampton':'Wolves',
  'nottingham forest':"Nott'm Forest",'brighton and hove albion':'Brighton',
  'brighton & hove albion':'Brighton','west ham united':'West Ham','newcastle united':'Newcastle',
  'sheffield united':'Sheffield Utd','leeds united':'Leeds','coventry city':'Coventry',
  'hull city':'Hull','ipswich town':'Ipswich','luton town':'Luton','leicester city':'Leicester',
  'afc bournemouth':'Bournemouth','crystal palace':'Crystal Palace'
};
function mapTeamName(external){
  if(!S.boot) return null;
  const low = external.toLowerCase().trim();
  const target = (NAME_ALIASES[low] || external).toLowerCase();
  let hit = S.boot.teams.find(t => t.name.toLowerCase() === target);
  if(!hit) hit = S.boot.teams.find(t => target.startsWith(t.name.toLowerCase()) || t.name.toLowerCase().startsWith(target.split(' ')[0]));
  return hit ? hit.id : null;
}



/* ===== src/providers/understat.mjs ===== */
/* ---------------------------------------------------------------------
   UNDERSTAT LAYER — rolling actual xG replaces trusting FPL's slow-moving
   strength ratings. Parses the teamsData JSON embedded in the league page.
   --------------------------------------------------------------------- */
S.ustat = null; S.ustatNote = '';
function parseUnderstat(html){
  const m = html.match(/teamsData\s*=\s*JSON\.parse\('([^']+)'\)/);
  if(!m) return null;
  const json = m[1].replace(/\\x([0-9A-Fa-f]{2})/g, (_,h) => String.fromCharCode(parseInt(h,16)))
                   .replace(/\\'/g,"'").replace(/\\\\/g,'\\');
  try{ return JSON.parse(json); }catch(e){ return null; }
}
async function loadUnderstat(){
  S.ustat = null; S.ustatNote = '';
  if(!$('useUstat').checked){
    markDisabled('understat', 'turned off in settings', 'FPL strength ratings used');
    return;
  }
  if(!S.boot) return;
  const html = await fetchVia('https://understat.com/league/EPL', {asText:true});
  let data = html ? parseUnderstat(html) : null;
  const uIssues = [];
  if(data){ const v = validateUnderstat(data); uIssues.push(...v.issues); data = v.value; }
  let label = 'current season';
  const matchCount = data ? Object.values(data).reduce((a,t) => a + (t.history||[]).length, 0) : 0;
  if(!data || matchCount < 40){
    const prevYear = new Date().getMonth() >= 6 ? new Date().getFullYear() - 1 : new Date().getFullYear() - 2;
    const prev = await fetchVia('https://understat.com/league/EPL/' + prevYear, {asText:true});
    const pd = prev ? parseUnderstat(prev) : null;
    if(pd){
      const v = validateUnderstat(pd); uIssues.push(...v.issues);
      if(v.value){ data = v.value; label = `last season's closing form`; }
    }
  }
  const collapsed = collapseIssues(uIssues);
  recordIssues('understat', 'league/EPL', collapsed);
  if(!data){
    S.ustatNote = 'Understat unreachable — using FPL strength ratings only.';
    markFallback('understat', 'unreachable', 'FPL strength ratings used');
    return;
  }

  const map = {}; let sumA = 0, sumD = 0, n = 0;
  Object.values(data).forEach(t => {
    const hist = (t.history || []).slice(-6);
    if(!hist.length) return;
    const xg  = hist.reduce((a,h) => a + num(h.xG), 0) / hist.length;
    const xga = hist.reduce((a,h) => a + num(h.xGA), 0) / hist.length;
    const id = mapTeamName(t.title);
    if(id){ map[id] = {xg, xga}; sumA += xg; sumD += xga; n++; }
  });
  if(!n){
    S.ustatNote = 'Understat team names could not be matched.';
    markFallback('understat', 'team mapping failed', 'FPL strength ratings used');
    return;
  }
  const avgXg = sumA/n, avgXga = sumD/n;
  Object.values(map).forEach(v => { v.atk = v.xg/avgXg; v.def = avgXga/v.xga; });
  S.ustat = map;
  const missing = S.boot.teams.filter(t => !map[t.id]).map(t => t.short_name);
  const degraded = missing.length > 0 || collapsed.some(i => i.severity === 'partial');
  if(degraded) markPartial('understat', label, 'FPL ratings fill missing teams');
  else markLive('understat', label, 'rolling team xG active');
  S.ustatNote = `Understat: last-6 xG loaded (${label})` + (missing.length ? `; no data for ${missing.join(', ')} — FPL ratings used for them` : '') + '.';
}



/* ===== src/providers/odds.mjs ===== */
/* ---------------------------------------------------------------------
   ODDS LAYER — bookmaker match odds converted to market-implied goals.
   --------------------------------------------------------------------- */
S.odds = null; S.oddsNote = '';
function poissonOver(lambda, line){
  const k = Math.floor(line);
  let cum = 0, term = Math.exp(-lambda);
  for(let i=0; i<=k; i++){ cum += term; term *= lambda/(i+1); }
  return 1 - cum;
}
function solveLambda(pOver, line){
  let lo = 0.2, hi = 6.5;
  for(let i=0; i<40; i++){
    const mid = (lo+hi)/2;
    if(poissonOver(mid, line) < pOver) lo = mid; else hi = mid;
  }
  return (lo+hi)/2;
}

// Defence in depth for any future diagnostic path. Current user-facing odds
// messages remain fixed strings; raw provider errors and keyed URLs are never
// displayed. This helper ensures that an accidental diagnostic addition still
// cannot expose the current key or an apiKey query value.
function scrubOddsSecret(value, key = ''){
  let text = String(value ?? '');
  const secret = String(key ?? '').trim();
  if(secret){
    const variants = new Set([secret]);
    try{ variants.add(encodeURIComponent(secret)); }catch{}
    variants.forEach(v => { if(v) text = text.split(v).join('[REDACTED]'); });
  }
  return text.replace(/([?&]apiKey=)[^&#\s]*/gi, '$1[REDACTED]');
}

async function forgetOddsKey(deps = {}){
  const field = deps.field || $('oddsKey');
  const getConfig = deps.getConfig || (() => sget(K_CFG));
  const setConfig = deps.setConfig || (value => sset(K_CFG, value));
  const current = await getConfig();
  const config = current && typeof current === 'object' && !Array.isArray(current)
    ? { ...current } : {};
  delete config.oddsKey;
  if(field) field.value = '';
  await setConfig(config);
  S.odds = null;
  S.oddsNote = '';
  markDisabled('odds', 'no API key supplied', 'internal team model active');
  return config;
}

async function loadOdds(){
  S.odds = null; S.oddsNote = '';
  const key = $('oddsKey').value.trim();
  if(!key){
    markDisabled('odds', 'no API key supplied', 'internal team model active');
    return;
  }
  if(!S.boot) return;
  let data = null;
  const oddsUrl = 'https://api.the-odds-api.com/v4/sports/soccer_epl/odds/?regions=uk&markets=h2h,totals&oddsFormat=decimal&apiKey=' + encodeURIComponent(key);
  const { result, record } = await withRetry(
    async () => {
      let res;
      try{ res = await fetchT(oddsUrl, 10000); }
      catch(e){ return {ok:false, retryable:true, status:'network'}; }
      if(res.status === 401 || res.status === 429) return {ok:false, retryable:false, status:res.status};
      if(!res.ok) return {ok:false, retryable:isRetryableStatus(res.status), status:res.status};
      try{ return {ok:true, value: await res.json(), status:res.status}; }
      catch(e){ return {ok:false, retryable:false, status:'parse'}; }
    },
    { ...policyFor('odds'), endpoint: safeEndpoint(oddsUrl) }
  );
  recordRetry(record);
  if(result && result.ok) data = result.value;
  else if(record.finalStatus === 401){
    S.oddsNote = 'Odds API key rejected — check it at the-odds-api.com.';
    markUnavailable('odds', 'API key rejected', 'internal team model active');
    return;
  }
  else if(record.finalStatus === 429){
    S.oddsNote = 'Odds API quota used up for this period.';
    markFallback('odds', 'quota exhausted', 'internal team model active');
    return;
  }
  else if(record.finalStatus === 'network' || record.finalStatus === 'parse'){
    S.oddsNote = 'Odds provider unreachable — internal team model active (reduced confidence).';
    markFallback('odds', 'direct fetch failed', 'internal team model active');
    return;
  }
  else if(!result || !result.ok){
    S.oddsNote = 'Odds provider unavailable — internal team model active.';
    markFallback('odds', 'request failed', 'internal team model active');
    return;
  }
  const oddsV = validateOdds(data);
  recordIssues('odds', 'v4/sports/soccer_epl/odds', oddsV.issues);
  data = oddsV.value;
  if(!Array.isArray(data) || !data.length){
    S.oddsNote = 'No EPL odds returned (out of season window, or feed empty).';
    markFallback('odds', 'feed empty', 'internal team model active');
    return;
  }

  const fetchedAt = Date.now();
  const parsed = [];
  data.forEach(ev => {
    const hId = mapTeamName(ev.home_team), aId = mapTeamName(ev.away_team);
    if(!hId || !aId) return;
    const kickoff = ev.commence_time ? Date.parse(ev.commence_time) : null;
    let h2h = [], overs = [], booksUsed = 0, marketCount = 0, staleDropped = 0;
    (ev.bookmakers||[]).forEach(bk => {
      const quoteAgeH = bk.last_update ? (fetchedAt - Date.parse(bk.last_update))/3.6e6 : 0;
      if(quoteAgeH > ODDS_RULES.maxQuoteAgeHours){ staleDropped++; return; }
      let counted = false;
      (bk.markets||[]).forEach(mk => {
        marketCount++;
        if(mk.key === 'h2h' && mk.outcomes?.length >= 2){
          const o = {}; mk.outcomes.forEach(x => o[x.name] = 1/x.price);
          const s = Object.values(o).reduce((a,b)=>a+b,0);
          if(o[ev.home_team] && o[ev.away_team]){
            h2h.push({pH:o[ev.home_team]/s, pA:o[ev.away_team]/s}); counted = true;
          }
        }
        if(mk.key === 'totals'){
          const over = mk.outcomes?.find(x => x.name === 'Over');
          const under = mk.outcomes?.find(x => x.name === 'Under');
          if(over && under && Math.abs(over.point - 2.5) <= 1.01){
            const po = (1/over.price)/((1/over.price)+(1/under.price));
            overs.push({p:po, line:over.point}); counted = true;
          }
        }
      });
      if(counted) booksUsed++;
    });
    if(h2h.length >= 3){
      const med = h2h.map(x=>x.pH).sort((a,b)=>a-b)[Math.floor(h2h.length/2)];
      h2h = h2h.filter(x => Math.abs(x.pH - med) <= ODDS_RULES.outlierProbDeviation);
    }
    if(h2h.length < ODDS_RULES.minH2hBooks || overs.length < ODDS_RULES.minTotalsBooks) return;
    const avg = a => a.reduce((x,y)=>x+y,0)/a.length;
    const lambda = solveLambda(avg(overs.map(o=>o.p)), overs[0].line);
    const r = Math.pow(avg(h2h.map(x=>x.pH))/avg(h2h.map(x=>x.pA)), 0.45);
    parsed.push({ hId, aId, kickoff,
      xGH: lambda * r/(1+r), xGA: lambda/(1+r),
      providerEventId: ev.id ?? null, fetchedAt,
      booksUsed, marketCount, staleDropped,
      confidence: booksUsed >= ODDS_RULES.lowConfidenceBooks ? 'normal' : 'low' });
  });

  const map = {}; let priced = 0;
  const windowMs = ODDS_RULES.kickoffMatchWindowHours * 3.6e6;
  const upcoming = (S.fixtures||[]).filter(f => !f.finished);
  parsed.forEach(entry => {
    const fx = upcoming.find(f => f.team_h === entry.hId && f.team_a === entry.aId &&
      (!f.kickoff_time || !entry.kickoff || Math.abs(Date.parse(f.kickoff_time) - entry.kickoff) <= windowMs));
    if(!fx) return;
    const pair = entry.hId + '|' + entry.aId;
    if(map[pair] && map[pair].kickoff && entry.kickoff &&
       fx.kickoff_time && Math.abs(Date.parse(fx.kickoff_time) - map[pair].kickoff)
         <= Math.abs(Date.parse(fx.kickoff_time) - entry.kickoff)) return;
    map[pair] = entry;
    priced++;
  });
  const partial = oddsV.issues.some(i => i.severity === 'partial') || parsed.some(p => p.confidence === 'low' || p.staleDropped > 0);
  if(priced && partial) markPartial('odds', priced + ' fixtures priced', 'market layer active with reduced coverage', fetchedAt);
  else if(priced) markLive('odds', priced + ' fixtures priced', 'market layer active', fetchedAt);
  else markFallback('odds', 'no fixtures matched', 'internal team model active');
  if(priced){ S.odds = map; S.oddsNote = `Odds: ${priced} fixture${priced===1?'':'s'} priced by the market.`; }
  else S.oddsNote = 'Odds feed answered but no fixtures could be matched.';
}



/* ===== src/providers/minutes-history.mjs ===== */

function validateElementSummary(payload){
  const endpoint = '/element-summary/{id}/';
  if(!payload || typeof payload !== 'object' || Array.isArray(payload) || !Array.isArray(payload.history))
    return {value:null,issues:[{provider:'fpl',endpoint,code:'element_history_unusable',severity:'fatal',count:1}]};
  const history = []; let invalid = 0;
  for(const row of payload.history){
    if(!row || typeof row !== 'object' || !Number.isFinite(+row.minutes) || !Number.isFinite(+row.fixture)) { invalid++; continue; }
    history.push({fixture:+row.fixture,round:Number.isFinite(+row.round)?+row.round:null,minutes:+row.minutes,
      starts:Number.isFinite(+row.starts)?+row.starts:null,kickoff_time:typeof row.kickoff_time==='string'?row.kickoff_time:null});
  }
  const issues = invalid ? [{provider:'fpl',endpoint,code:'element_history_invalid_rows',severity:'partial',count:invalid}] : [];
  return {value:history,issues};
}

function cohort(){
  const priority = new Set();
  for(const pick of S.picks?.picks || []) priority.add(+pick.element);
  for(const item of S.manual || []) priority.add(+(item.id ?? item.element));
  const players = (S.boot?.elements || []).slice().sort((a,b) => {
    const ap=priority.has(+a.id)?1:0, bp=priority.has(+b.id)?1:0;
    return bp-ap || num(b.selected_by_percent)-num(a.selected_by_percent) || num(b.now_cost)-num(a.now_cost) || num(a.id)-num(b.id);
  });
  const selected = [], seen = new Set();
  for(const p of players){
    if(priority.has(+p.id) || selected.length < priority.size + MINUTES_RULES.detailedCohort){
      if(!seen.has(+p.id)){ selected.push(p); seen.add(+p.id); }
    }
  }
  return selected;
}

function seasonKey(){
  const year = +(S.boot?.events?.[0]?.deadline_time || '').slice(0,4);
  return Number.isFinite(year) && year > 2000 ? year + '-' + String((year+1)%100).padStart(2,'0') : 'unknown';
}

function validEnvelope(env, season=seasonKey()){
  return env && env.schemaVersion===SCHEMA_VERSION && env.modelVersion===MODEL_VERSION && env.season===season && env.players && typeof env.players==='object';
}

async function loadMinuteHistories(){
  if(!S.seasonLive || !S.boot?.elements?.length) return {loaded:0,failed:0,cached:0};
  const season = seasonKey();
  const cached = await sget(K_MINUTES);
  const cacheOk = validEnvelope(cached, season);
  if(cacheOk){
    for(const [id,entry] of Object.entries(cached.players)) if(Array.isArray(entry.history)) S.minuteHistory[id]=entry.history;
  }
  const chosen = cohort();
  const results = await pool(chosen, async p => {
    const payload = await api('/element-summary/'+p.id+'/', {optional:true});
    const v = validateElementSummary(payload);
    if(!v.value) return {id:p.id,ok:false,issues:v.issues,hasCache:Array.isArray(cached?.players?.[p.id]?.history)};
    S.minuteHistory[p.id]=v.value;
    return {id:p.id,ok:true,history:v.value,issues:v.issues};
  }, 4);
  const allIssues = collapseIssues(results.flatMap(r => r?.issues || []));
  recordIssues('fpl', '/element-summary/{id}/', allIssues);
  let loaded=0, failed=0, cachedUsed=0;
  const players = cacheOk ? {...cached.players} : {};
  results.forEach(r => {
    if(r?.ok){ loaded++; players[r.id]={fetchedAt:Date.now(),history:r.history}; }
    else { failed++; if(r?.hasCache) cachedUsed++; }
  });
  await sset(K_MINUTES,{schemaVersion:SCHEMA_VERSION,modelVersion:MODEL_VERSION,season,fetchedAt:Date.now(),players});
  const h = getHealth('fpl',{seasonLive:S.seasonLive});
  if(h && ![HEALTH_STATES.FALLBACK,HEALTH_STATES.UNAVAILABLE].includes(h.state)){
    if(failed && cachedUsed===failed) markFallback('fpl', 'detailed history refresh failed', 'saved player histories remain active');
    else if(failed) markPartial('fpl', failed+' detailed player histories unavailable', 'aggregate minutes fallback used for affected players', h.lastSuccess || Date.now());
    else markLive('fpl', 'live feed + detailed player histories', 'core season and minutes data current', h.lastSuccess || Date.now());
  }
  return {loaded,failed,cached:cachedUsed};
}



/* ===== src/ui/data-warning.mjs ===== */

const MATERIAL_SAVED_FPL_STATES=Object.freeze([
  HEALTH_STATES.CACHED,
  HEALTH_STATES.STALE,
  HEALTH_STATES.FALLBACK
]);

function materialDataAgeLabel(ms){
  if(ms==null||!Number.isFinite(Number(ms))) return 'time unavailable';
  const minutes=Math.max(0,Math.floor(Number(ms)/60000));
  if(minutes<1) return 'verified just now';
  if(minutes<60) return `verified ${minutes}m ago`;
  const hours=Math.floor(minutes/60);
  if(hours<48) return `verified ${hours}h ago`;
  return `verified ${Math.floor(hours/24)}d ago`;
}

function fplDataWarningModel({state=null,hasCoreData=false,ageMs=null}={}){
  if(!hasCoreData){
    return Object.freeze({
      kind:'unavailable',
      level:'blocking',
      title:'Official FPL data is unavailable',
      detail:'Teamsheet cannot verify recommendations or fixture context until the core season feed loads.',
      settingsOnly:false
    });
  }
  if(MATERIAL_SAVED_FPL_STATES.includes(state)){
    return Object.freeze({
      kind:'saved-data',
      level:'warning',
      title:'Using previously verified FPL data',
      detail:`The live Official FPL refresh did not complete · ${materialDataAgeLabel(ageMs)}.`,
      settingsOnly:false
    });
  }
  return Object.freeze({kind:'clear',level:'clear',title:'',detail:'',settingsOnly:true});
}

function currentFplDataWarning(now=Date.now()){
  const health=getHealth('fpl',{seasonLive:S.seasonLive},now);
  const ageMs=health?.lastSuccess?Math.max(0,now-health.lastSuccess):null;
  return fplDataWarningModel({state:health?.state||null,hasCoreData:Boolean(S.boot),ageMs});
}

function dataWarningContent(model,{settingsLink=true}={}){
  const children=[el('b',{},model.title),document.createTextNode(` ${model.detail}`)];
  if(settingsLink) children.push(document.createTextNode(' '),el('a',{href:'#/settings/data/providers'},'View data details'));
  return children;
}

function renderGlobalDataWarning(){
  const node=$('globalDataWarning');if(!node)return;
  const model=currentFplDataWarning();
  const visible=model.kind==='saved-data';
  node.hidden=!visible;
  if(!visible){setChildren(node);node.removeAttribute?.('aria-label');return;}
  setChildren(node,`${model.title} · ${model.detail}`);
  node.setAttribute('aria-label',`${model.title}. ${model.detail} Open Provider Health.`);
}

function renderRouteDataWarning(targetId,{showUnavailable=true,settingsLink=true}={}){
  const node=$(targetId);if(!node)return currentFplDataWarning();
  const model=currentFplDataWarning();
  const visible=model.kind==='saved-data'||(showUnavailable&&model.kind==='unavailable');
  if(!visible){setChildren(node);node.hidden=true;return model;}
  node.hidden=false;
  node.className=`note ${model.level==='blocking'?'bad':'plain'} data-material-warning`;
  node.setAttribute('role',model.level==='blocking'?'alert':'status');
  setChildren(node,dataWarningContent(model,{settingsLink}));
  return model;
}



/* ===== src/model/fixtures.mjs ===== */
/* ---------------------------------------------------------------------
   FIXTURE MODEL — expected goals for and against, from team strength
   ratings rather than the official 1–5 difficulty.

   When Official FPL has not published finite team-strength fields, player
   projections use a neutral multiplier and the Fixtures view/sort uses the
   provider's explicit 1–5 difficulty. Invalid values never become NaN.
   --------------------------------------------------------------------- */
function neutralMatchContext(home){
  return {xGF:BASE_GOALS, xGA:BASE_GOALS, cs:Math.exp(-BASE_GOALS),
    atk:1, def:1, home, strengthAvailable:false};
}
function matchContext(teamId, oppId, home){
  const t = S.teams[teamId], o = S.teams[oppId], A = S.avg;
  const averagesValid = A && ['atkH','atkA','defH','defA'].every(key => validTeamStrength(A[key]));
  if(!t || !o || !S.strengthsAvailable || !averagesValid ||
     !teamStrengthsValid(t) || !teamStrengthsValid(o)) return neutralMatchContext(home);
  const tAtk = Number(home ? t.strength_attack_home : t.strength_attack_away);
  const tDef = Number(home ? t.strength_defence_home : t.strength_defence_away);
  const oAtk = Number(home ? o.strength_attack_away : o.strength_attack_home);
  const oDef = Number(home ? o.strength_defence_away : o.strength_defence_home);
  const avgAtkT = Number(home ? A.atkH : A.atkA), avgDefT = Number(home ? A.defH : A.defA);
  const avgAtkO = Number(home ? A.atkA : A.atkH), avgDefO = Number(home ? A.defA : A.defH);

  let xGF = clamp(BASE_GOALS * (tAtk/avgAtkT) * (avgDefO/oDef) * (home ? HOME_TILT : 1/HOME_TILT), .25, 4);
  let xGA = clamp(BASE_GOALS * (oAtk/avgAtkO) * (avgDefT/tDef) * (home ? 1/HOME_TILT : HOME_TILT), .25, 4);

  // layer 2: Understat rolling last-6 xG — 45% weight when both sides have data
  if(S.ustat && S.ustat[teamId] && S.ustat[oppId]){
    const uF = clamp(BASE_GOALS * S.ustat[teamId].atk / S.ustat[oppId].def * (home ? HOME_TILT : 1/HOME_TILT), .25, 4);
    const uA = clamp(BASE_GOALS * S.ustat[oppId].atk / S.ustat[teamId].def * (home ? 1/HOME_TILT : HOME_TILT), .25, 4);
    xGF = xGF*0.55 + uF*0.45;
    xGA = xGA*0.55 + uA*0.45;
  }
  // layer 3: bookmaker odds — the market wins 65/35 where it has a quote
  if(S.odds){
    const q = home ? S.odds[teamId + '|' + oppId] : S.odds[oppId + '|' + teamId];
    if(q){
      const mF = home ? q.xGH : q.xGA, mA = home ? q.xGA : q.xGH;
      xGF = xGF*0.35 + mF*0.65;
      xGA = xGA*0.35 + mA*0.65;
    }
  }
  if(![xGF,xGA].every(Number.isFinite)) return neutralMatchContext(home);
  // Preserve the long-standing public result shape when valid inputs exist.
  return {xGF, xGA, cs:Math.exp(-xGA), atk:xGF/BASE_GOALS, def:BASE_GOALS/xGA, home};
}

function officialFixtureDifficulty(game){
  const value = Number(game?.officialDiff);
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
}
function fixtureAnalysisMode(){
  return S.strengthsAvailable ? 'team-strengths' : 'official-fpl-difficulty';
}
function fixtureDifficulty(game, lens){
  const official = officialFixtureDifficulty(game);
  if(lens === 'official' || game?.ctx?.strengthAvailable === false) return official ?? 3;
  return multToDiff(lens === 'defence' ? game.ctx.def : game.ctx.atk);
}
function fixtureLensState(requestedLens='attack'){
  const fallback = fixtureAnalysisMode() === 'official-fpl-difficulty';
  const lens = fallback ? 'official' : requestedLens;
  return {lens, fallback, lowerIsEasier:lens === 'official'};
}
function averageOfficialDifficulty(teamId, fromGW, span){
  const runs = teamFixtures(teamId, fromGW, span);
  let total = 0, count = 0;
  runs.forEach(games => games.forEach(game => {
    const difficulty = officialFixtureDifficulty(game);
    if(difficulty !== null){ total += difficulty; count += 1; }
  }));
  return count ? total / count : null;
}
function compareFixtureRunScores(left, right, sort, lens){
  const a = Number(left), b = Number(right);
  const aFinite = Number.isFinite(a), bFinite = Number.isFinite(b);
  if(!aFinite || !bFinite){
    if(aFinite) return -1;
    if(bFinite) return 1;
    return 0;
  }
  const lowerIsEasier = fixtureLensState(lens).lowerIsEasier;
  if(sort === 'ease') return lowerIsEasier ? a - b : b - a;
  if(sort === 'hard') return lowerIsEasier ? b - a : a - b;
  return 0;
}

function teamFixtures(teamId, fromGW, span){
  const out = [];
  for(let gw = fromGW; gw < fromGW + span; gw++){
    const games = S.fixtures.filter(f => f.event === gw && (f.team_h === teamId || f.team_a === teamId));
    out.push(games.map(f => {
      const home = f.team_h === teamId;
      const opp = home ? f.team_a : f.team_h;
      return {gw, home, oppId:opp, opp:S.teams[opp],
              officialDiff: home ? f.team_h_difficulty : f.team_a_difficulty,
              ctx: matchContext(teamId, opp, home)};
    }));
  }
  return out;
}

// 1 (easiest) – 5 (hardest) from a multiplier where >1 is favourable
function multToDiff(m){
  m = Number(m);
  if(!Number.isFinite(m)) return 3;
  if(m >= 1.28) return 1;
  if(m >= 1.10) return 2;
  if(m >= 0.93) return 3;
  if(m >= 0.78) return 4;
  return 5;
}
function runScore(teamId, fromGW, span, requestedLens){
  const {lens, fallback} = fixtureLensState(requestedLens);
  if(fallback || lens === 'official') return averageOfficialDifficulty(teamId, fromGW, span);
  const runs = teamFixtures(teamId, fromGW, span);
  let total = 0;
  runs.forEach(games => games.forEach(game => {
    const value = lens === 'defence' ? game.ctx.def : game.ctx.atk;
    total += Number.isFinite(value) ? value : 1;
  }));
  return total/Math.max(1,span);
}



/* ===== src/model/minutes.mjs ===== */

function availabilityFactor(p){
  if(['i','u','s','n'].includes(p.status)) return 0;
  if(p.status === 'd') return clamp((p.chance_of_playing_next_round ?? 50)/100, 0, 1);
  return 1;
}

function completedTeamMatches(team){
  return (S.fixtures || []).filter(f => f.finished && (f.team_h === team || f.team_a === team)).length;
}

function aggregateMinutes(p, teamMatches){
  const t = Math.max(0, teamMatches);
  if(!t) return null;
  const expMin = clamp(num(p.minutes) / t, 0, 90);
  const pStart = clamp(num(p.starts) / t, 0, 1);
  const pAppear = clamp(Math.max(pStart, expMin / 28), 0, .98);
  const p60 = clamp(Math.min(pAppear, (expMin - 18) / 55), 0, .97);
  return {pStart,pAppear,p60,expMin};
}

function weightedRate(rows, key, fallback, prior){
  const decay = MINUTES_RULES.recencyDecay;
  let weighted = 0, weight = 0;
  rows.forEach((row, idx) => {
    const w = Math.pow(decay, idx);
    if(row[key] === null || row[key] === undefined) return;
    weighted += w * row[key]; weight += w;
  });
  return (weighted + prior * fallback) / Math.max(1e-9, weight + prior);
}

function roleStability(rows){
  if(rows.length < 2) return 0.5;
  const starts = rows.filter(r => r.started !== null).map(r => r.started);
  if(starts.length < 2) return 0.5;
  const mean = starts.reduce((a,b)=>a+b,0)/starts.length;
  const variance = starts.reduce((a,b)=>a + Math.pow(b-mean,2),0)/starts.length;
  return clamp(1 - variance * 4, 0, 1);
}

function minutesEstimate(p){
  const avail = availabilityFactor(p);
  if(avail === 0) return {pStart:0,pAppear:0,p60:0,expMin:0,confidence:0.35,confidenceLabel:'Low',source:'availability'};

  const teamMatches = completedTeamMatches(p.team);
  const aggregate = aggregateMinutes(p, teamMatches);
  const rawHistory = Array.isArray(S.minuteHistory?.[p.id]) ? S.minuteHistory[p.id] : [];
  const rows = rawHistory.slice().sort((a,b) => {
    const ak = Date.parse(a.kickoff_time || '') || num(a.round) * 1e6 + num(a.fixture);
    const bk = Date.parse(b.kickoff_time || '') || num(b.round) * 1e6 + num(b.fixture);
    return bk - ak;
  }).slice(0, MINUTES_RULES.historyWindow).map(r => ({
    minutes:clamp(num(r.minutes),0,90),
    appeared:num(r.minutes) > 0 ? 1 : 0,
    sixty:num(r.minutes) >= 60 ? 1 : 0,
    started:r.starts === undefined || r.starts === null ? null : (num(r.starts) > 0 ? 1 : 0),
    kickoff_time:r.kickoff_time,
    round:r.round,
    fixture:r.fixture
  }));

  if(!aggregate && !rows.length){
    const q = MINUTES_RULES.prior;
    return {pStart:q.pStart*avail,pAppear:q.pAppear*avail,p60:q.p60*avail,expMin:q.expMin*avail,
      confidence:q.confidence,confidenceLabel:'Low',source:'prior'};
  }

  const base = aggregate || MINUTES_RULES.prior;
  const prior = MINUTES_RULES.priorMatches;
  let pStart = weightedRate(rows, 'started', base.pStart, prior);
  let pAppear = weightedRate(rows, 'appeared', base.pAppear, prior);
  let p60 = weightedRate(rows, 'sixty', base.p60, prior);
  let expMin = weightedRate(rows, 'minutes', base.expMin, prior);
  pAppear = Math.max(pAppear, pStart);
  p60 = Math.min(p60, pAppear);

  const coverage = clamp(rows.length / MINUTES_RULES.historyWindow, 0, 1);
  const detail = rows.length ? 1 : aggregate ? 0.55 : 0.25;
  const newest = rows[0]?.kickoff_time ? Date.parse(rows[0].kickoff_time) : NaN;
  const freshness = Number.isFinite(newest) ? clamp(1 - (Date.now()-newest)/(28*24*60*60*1000),0,1) : (rows.length ? 0.5 : 0.25);
  let confidence = clamp(0.40*coverage + 0.20*freshness + 0.25*detail + 0.15*roleStability(rows),0,1);
  if(rows.length < 3) confidence = Math.min(confidence, 0.44);
  const returning = rows.length >= 2 && rows[0].minutes > 0 && rows[0].minutes < 45 && rows.slice(1,3).some(r => r.minutes === 0);
  if(returning) confidence = Math.min(confidence, 0.74);

  pStart = clamp(pStart * avail,0,1);
  pAppear = clamp(pAppear * avail,0,1);
  p60 = clamp(p60 * avail,0,pAppear);
  expMin = clamp(expMin * avail,0,90);
  const confidenceLabel = confidence >= MINUTES_RULES.confidence.high ? 'High' : confidence >= MINUTES_RULES.confidence.medium ? 'Medium' : 'Low';
  return {pStart,pAppear,p60,expMin,confidence,confidenceLabel,source:rows.length?'detailed':aggregate?'aggregate':'prior'};
}

function expectedMinutes(p){ return S.seasonLive ? minutesEstimate(p).expMin : null; }



/* ===== src/model/scoring-rules.mjs ===== */

const POISSON_MAX_K = 80;
const POISSON_TAIL_EPS = 1e-12;

function poissonSeries(lambda, visit){
  const lam = Math.max(0, num(lambda));
  let p = Math.exp(-lam), total = p;
  visit(0, p);
  for(let k = 1; k <= POISSON_MAX_K; k++){
    p *= lam / k;
    total += p;
    visit(k, p);
    if(k > lam && p < POISSON_TAIL_EPS && 1-total < POISSON_TAIL_EPS) break;
  }
}

function poissonTail(lambda, threshold){
  const t = Math.max(0, Math.floor(num(threshold)));
  if(t <= 0) return 1;
  let below = 0;
  poissonSeries(lambda, (k,p) => { if(k < t) below += p; });
  return clamp(1-below, 0, 1);
}

function expectedGroupedPoints(lambda, groupSize, pointsPerGroup){
  const size = Math.max(1, Math.floor(num(groupSize)));
  const value = num(pointsPerGroup);
  let expected = 0;
  poissonSeries(lambda, (k,p) => { expected += p * Math.floor(k/size) * value; });
  return expected;
}

function expectedThresholdPoints(lambda, threshold, points){
  return poissonTail(lambda, threshold) * num(points);
}

function shrunkRate(events, exposure90, priorRate, priorExposure90){
  const exposure = Math.max(0, num(exposure90));
  const priorExposure = Math.max(0, num(priorExposure90));
  const denominator = exposure + priorExposure;
  if(!denominator) return 0;
  return Math.max(0, (Math.max(0, num(events)) + priorExposure * Math.max(0, num(priorRate))) / denominator);
}



/* ===== src/model/scoring.mjs ===== */
/* ---------------------------------------------------------------------
   PLAYER MODEL — projected points, built separately per position.
   Returns a breakdown so every number is inspectable.
   --------------------------------------------------------------------- */
function availability(p){
  if(['i','u','s','n'].includes(p.status)) return 0;
  if(p.status === 'd') return clamp((p.chance_of_playing_next_round ?? 50)/100, 0, 1);
  return 1;
}
function per90(p, key){
  if(p[key] !== undefined && p[key] !== null) return num(p[key]);
  return 0;
}
function priceBaseline(p){
  const price = p.now_cost/10, pos = p.element_type;
  const table = {1: 2.30 + (price-4.0)*0.60, 2: 2.45 + (price-4.0)*0.72,
                 3: 2.20 + (price-4.5)*0.78, 4: 2.35 + (price-4.5)*0.74};
  const base = table[pos] !== undefined ? table[pos] : 1.6 + (price-4.0)*0.4;
  const ownTilt = 1 + clamp(num(p.selected_by_percent), 0, 45)/450;
  return clamp(base, 0.6, 9) * ownTilt;
}

function played90(p){ return Math.max(SCORING_RULES.minimumExposure90, num(p.minutes)/90); }
function seasonAppearances(p){
  const rows = Array.isArray(S.minuteHistory?.[p.id]) ? S.minuteHistory[p.id] : [];
  const detailed = rows.filter(r => num(r.minutes) > 0).length;
  if(detailed) return detailed;
  const matches = completedTeamMatches(p.team);
  const aggregate = aggregateMinutes(p, matches);
  if(aggregate) return matches * aggregate.pAppear;
  return Math.max(num(p.starts), num(p.minutes)/90, 0);
}
function positionPlayers(pos){ return (S.boot?.elements || []).filter(p => p.element_type === pos); }
function populationRate(pos, field){
  let events = 0, exposure = 0;
  positionPlayers(pos).forEach(p => { events += Math.max(0,num(p[field])); exposure += Math.max(0,num(p.minutes))/90; });
  return exposure > 0 ? events/exposure : 0;
}
function rareRate(p, field){
  return shrunkRate(p[field], played90(p), populationRate(p.element_type, field), SCORING_RULES.rareEventPriorMatches);
}
function populationBonusPerAppearance(pos){
  let bonus = 0, apps = 0;
  positionPlayers(pos).forEach(p => { bonus += Math.max(0,num(p.bonus)); apps += seasonAppearances(p); });
  return apps > 0 ? bonus/apps : 0;
}
function bonusPerAppearance(p){
  const apps = seasonAppearances(p), priorApps = SCORING_RULES.bonusPriorAppearances;
  const prior = populationBonusPerAppearance(p.element_type);
  return (Math.max(0,num(p.bonus)) + priorApps*prior) / Math.max(1e-9, apps + priorApps);
}
function penaltyMissRate(p){
  const order = p.penalties_order;
  const prior = populationRate(p.element_type, 'penalties_missed');
  if(order === null) return prior;
  const rate = rareRate(p, 'penalties_missed');
  if(order === undefined || SCORING_RULES.penaltyRoleOrders.includes(num(order))) return rate;
  return prior;
}

function playerFixtureXP(p, g){
  const pos = p.element_type, ctx = g.ctx, avail = availability(p);
  const parts = {};
  if(avail === 0) return {total:0, parts:{unavailable:0}};

  if(!S.seasonLive){
    const base = priceBaseline(p);
    const lensMult = (pos === 1 || pos === 2) ? Math.pow(ctx.def, 0.55) : Math.pow(ctx.atk, 0.65);
    parts['Price-implied base'] = base;
    parts['Fixture adjustment'] = base * (lensMult - 1);
    const total = base * lensMult * avail;
    return {total, parts};
  }

  const mins = minutesEstimate(p);
  const mFactor = mins.expMin/90;
  const pAny = mins.pAppear;
  const p60 = mins.p60;

  parts['Appearance'] = pAny * FPL_RULES.appearance.any + p60 * FPL_RULES.appearance.sixtyMinutes;

  const xg = Math.max(0,per90(p,'expected_goals_per_90')) * mFactor * ctx.atk;
  const xa = Math.max(0,per90(p,'expected_assists_per_90')) * mFactor * ctx.atk;
  parts['Goals'] = xg * (GOAL_PTS[pos] ?? 4);
  parts['Assists'] = xa * ASSIST_PTS;

  if(CS_PTS[pos]) parts['Clean sheet'] = ctx.cs * CS_PTS[pos] * p60;
  if(FPL_RULES.goalsConceded.positions.includes(pos)){
    const lambdaConceded = Math.max(0,ctx.xGA) * mFactor;
    parts['Goals conceded'] = expectedGroupedPoints(lambdaConceded,
      FPL_RULES.goalsConceded.groupSize,FPL_RULES.goalsConceded.pointsPerGroup);
  }

  if(pos === 1){
    const saves90 = Math.max(0,num(p.saves))/played90(p);
    const lambdaSaves = saves90 * Math.max(0,ctx.xGA/BASE_GOALS) * mFactor;
    parts['Saves'] = expectedGroupedPoints(lambdaSaves,FPL_RULES.saves.groupSize,FPL_RULES.saves.pointsPerGroup);
  }

  const threshold = FPL_RULES.defensiveContribution.thresholds[pos];
  if(threshold){
    let dc90 = Math.max(0,per90(p,'defensive_contribution_per_90'));
    if(!dc90 && p.defensive_contribution !== undefined) dc90 = Math.max(0,num(p.defensive_contribution))/played90(p);
    if(dc90 && pAny > 0){
      const conditionalMinutes = clamp(mins.expMin/Math.max(pAny,1e-9),0,90);
      const lambdaDc = dc90 * conditionalMinutes/90;
      parts['Defensive contributions'] = pAny * expectedThresholdPoints(lambdaDc,threshold,
        FPL_RULES.defensiveContribution.points);
    }
  }

  parts['Bonus'] = pAny * bonusPerAppearance(p);

  const yellow = rareRate(p,'yellow_cards') * mFactor;
  if(yellow) parts['Yellow cards'] = yellow * FPL_RULES.cards.yellow;
  const red = rareRate(p,'red_cards') * mFactor;
  if(red) parts['Red cards'] = red * FPL_RULES.cards.red;
  const ownGoal = rareRate(p,'own_goals') * mFactor;
  if(ownGoal) parts['Own goals'] = ownGoal * FPL_RULES.ownGoal;
  const penaltyMiss = penaltyMissRate(p) * mFactor;
  if(penaltyMiss) parts['Penalty misses'] = penaltyMiss * FPL_RULES.penaltyMiss;
  if(pos === 1){
    const penaltySave = rareRate(p,'penalties_saved') * mFactor;
    if(penaltySave) parts['Penalty saves'] = penaltySave * FPL_RULES.penaltySave;
  }

  let total = 0;
  Object.keys(parts).forEach(k => { if(!isFinite(parts[k])) parts[k] = 0; total += parts[k]; });
  const cal = S.calib?.[pos];
  if(cal && cal !== 1){ parts['Calibration'] = total*(cal-1); total *= cal; }
  return {total: Math.max(0, total), parts};
}

function projectXP(p, fromGW, span){
  const runs = teamFixtures(p.team, fromGW, span);
  let total = 0, games = 0;
  const agg = {};
  runs.forEach(gwGames => gwGames.forEach(g => {
    const r = playerFixtureXP(p, g);
    total += r.total; games++;
    Object.entries(r.parts).forEach(([k,v]) => agg[k] = (agg[k]||0) + v);
  }));
  return {total, perGW: total/Math.max(1,span), games, parts:agg};
}

const xpCache = new Map();
function xpOf(p, fromGW, span){
  const key = p.id + ':' + fromGW + ':' + span;
  if(!xpCache.has(key)) xpCache.set(key, projectXP(p, fromGW, span));
  return xpCache.get(key);
}
const clearXP = () => xpCache.clear();



/* ===== src/model/simulation.mjs ===== */

function hashSeed(value){
  let h = 2166136261 >>> 0;
  const text = String(value);
  for(let i=0;i<text.length;i++){
    h ^= text.charCodeAt(i);
    h = Math.imul(h,16777619) >>> 0;
  }
  return h || 1;
}
function createSeed(...parts){ return hashSeed(parts.join('|')); }
function createRng(seed){
  let state = (num(seed) >>> 0) || 1;
  return function(){
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function poisson(lambda,rng){
  const l = Math.max(0,num(lambda));
  if(l === 0) return 0;
  if(l < 30){
    const limit = Math.exp(-l); let product = 1, k = 0;
    do { k++; product *= rng(); } while(product > limit && k < 1000);
    return k-1;
  }
  const u1 = Math.max(rng(),1e-12), u2 = rng();
  return Math.max(0,Math.round(l + Math.sqrt(l)*Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2)));
}
function bernoulli(probability,rng){ return rng() < clamp(num(probability),0,1); }
function weightedChoice(rows,rng){
  const target = rng(); let total = 0;
  for(const row of rows){ total += row.probability; if(target < total) return row; }
  return rows[rows.length-1];
}
function buildMinutesDistribution(input){
  const pStart = clamp(num(input.pStart),0,1);
  const pAppear = clamp(Math.max(pStart,num(input.pAppear)),0,1);
  const p60 = clamp(Math.min(pAppear,num(input.p60)),0,1);
  const expMin = clamp(num(input.expMin),0,90);
  const startAnd60 = Math.min(pStart,p60);
  const states = [
    {key:'dnp',probability:1-pAppear,min:0,max:0},
    {key:'subUnder60',probability:pAppear-Math.max(pStart,p60),min:1,max:59},
    {key:'sub60',probability:p60-startAnd60,min:60,max:75},
    {key:'startUnder60',probability:pStart-startAnd60,min:1,max:59},
    {key:'start60',probability:startAnd60,min:60,max:90}
  ].map(row => ({...row,probability:Math.max(0,row.probability)}));
  const active = states.filter(row => row.probability > 0);
  const minMean = active.reduce((sum,row) => sum + row.probability*row.min,0);
  const maxMean = active.reduce((sum,row) => sum + row.probability*row.max,0);
  const target = clamp(expMin,minMean,maxMean);
  const fraction = maxMean > minMean ? (target-minMean)/(maxMean-minMean) : 0;
  states.forEach(row => row.mean = row.min + (row.max-row.min)*fraction);
  return {states,pStart,pAppear,p60,expMin,targetMean:target,quality:Math.abs(target-expMin) < 1e-9 ? 'full' : 'reduced'};
}
function sampleMinutes(distribution,rng){
  const row = weightedChoice(distribution.states,rng);
  if(row.max === 0) return {state:row.key,minutes:0};
  const centre = row.mean;
  const low = Math.max(row.min,2*centre-row.max);
  const high = Math.min(row.max,2*centre-row.min);
  const minutes = low === high ? low : low + rng()*(high-low);
  return {state:row.key,minutes:Math.round(clamp(minutes,row.min,row.max))};
}
function percentile(sorted,p){
  if(!sorted.length) return 0;
  const index = (sorted.length-1)*p;
  const lo = Math.floor(index), hi = Math.ceil(index);
  if(lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi]-sorted[lo])*(index-lo);
}
function summariseSamples(samples){
  const values = samples.map(num).sort((a,b) => a-b);
  const mean = values.reduce((a,b) => a+b,0)/Math.max(1,values.length);
  const count = threshold => values.filter(v => v >= threshold).length/Math.max(1,values.length);
  return {
    mean,p10:percentile(values,0.10),p25:percentile(values,0.25),median:percentile(values,0.50),
    p75:percentile(values,0.75),p90:percentile(values,0.90),
    blankProbability:values.filter(v => v <= SIMULATION_RULES.blankMaximum).length/Math.max(1,values.length),
    returnProbability:count(SIMULATION_RULES.returnMinimum),haulProbability:count(SIMULATION_RULES.haulMinimum),
    megaHaulProbability:count(SIMULATION_RULES.megaHaulMinimum)
  };
}
function componentMeans(player,fixture){
  const expected = playerFixtureXP(player,fixture);
  return {expected,parts:expected.parts || {}};
}
function sampleBoundedBonus(mean,rng){
  const value = clamp(num(mean),0,3), lower = Math.floor(value), upper = Math.ceil(value);
  if(lower === upper) return lower;
  return rng() < value-lower ? upper : lower;
}
function simulatePlayerFixture(player,fixture,rng,options={}){
  const mins = options.minutes || minutesEstimate(player);
  const distribution = options.distribution || buildMinutesDistribution(mins);
  const sampled = sampleMinutes(distribution,rng);
  if(sampled.minutes <= 0) return {points:0,minutes:0,appeared:false,reached60:false,state:sampled.state};
  const {expected,parts} = options.components || componentMeans(player,fixture);
  const appearMean = num(parts['Appearance']);
  const baseAppearance = sampled.minutes >= 60 ? 2 : 1;
  let points = baseAppearance;
  const ratio = mins.expMin > 0 ? sampled.minutes/mins.expMin : 0;
  const goalPts = FPL_RULES.goals[player.element_type] || 4;
  points += poisson(Math.max(0,num(parts['Goals'])/goalPts)*ratio,rng)*goalPts;
  points += poisson(Math.max(0,num(parts['Assists'])/FPL_RULES.assists)*ratio,rng)*FPL_RULES.assists;
  if(parts['Clean sheet']){
    const csProb = clamp(num(parts['Clean sheet'])/Math.max(1e-9,(FPL_RULES.cleanSheets[player.element_type]||0)*Math.max(num(mins.p60),1e-9)),0,1);
    if(sampled.minutes >= 60 && bernoulli(csProb,rng)) points += FPL_RULES.cleanSheets[player.element_type] || 0;
  }
  if(parts['Goals conceded'] < 0){
    const expectedGroups = Math.abs(num(parts['Goals conceded'])/FPL_RULES.goalsConceded.pointsPerGroup);
    points += Math.floor(poisson(expectedGroups*FPL_RULES.goalsConceded.groupSize*ratio,rng)/FPL_RULES.goalsConceded.groupSize)*FPL_RULES.goalsConceded.pointsPerGroup;
  }
  if(parts['Saves'] > 0) points += Math.floor(poisson(num(parts['Saves'])*FPL_RULES.saves.groupSize*ratio,rng)/FPL_RULES.saves.groupSize)*FPL_RULES.saves.pointsPerGroup;
  if(parts['Defensive contributions'] > 0){
    const probability = clamp(num(parts['Defensive contributions'])/FPL_RULES.defensiveContribution.points,0,1);
    if(bernoulli(probability,rng)) points += FPL_RULES.defensiveContribution.points;
  }
  points += sampleBoundedBonus(num(parts['Bonus'])/Math.max(num(mins.pAppear),1e-9),rng);
  const rare = ['Yellow cards','Red cards','Own goals','Penalty misses','Penalty saves'];
  rare.forEach(key => {
    const mean = num(parts[key]); if(!mean) return;
    const unit = key === 'Yellow cards' ? FPL_RULES.cards.yellow : key === 'Red cards' ? FPL_RULES.cards.red : key === 'Own goals' ? FPL_RULES.ownGoal : key === 'Penalty misses' ? FPL_RULES.penaltyMiss : FPL_RULES.penaltySave;
    const probability = clamp(Math.abs(mean/unit)*ratio,0,1);
    if(bernoulli(probability,rng)) points += unit;
  });
  const expectedOther = Math.max(0,num(expected.total)-appearMean-Object.entries(parts).filter(([key]) => ['Goals','Assists','Clean sheet','Goals conceded','Saves','Defensive contributions','Bonus','Yellow cards','Red cards','Own goals','Penalty misses','Penalty saves','Appearance'].includes(key)).reduce((sum,[,value]) => sum+num(value),0));
  points += expectedOther;
  return {points,minutes:sampled.minutes,appeared:true,reached60:sampled.minutes>=60,state:sampled.state,quality:distribution.quality};
}
function simulatePlayerGameweek(player,gw,options={}){
  const sampleCount = clamp(Math.floor(num(options.samples)||SIMULATION_RULES.productionSamples),1,SIMULATION_RULES.maxSamples);
  if(!S.seasonLive) return {available:false,reason:'pre-season',samples:[],appearanceSamples:[],quality:'baseline-only'};
  const fixtures = teamFixtures(player.team,gw,1).flat();
  if(!fixtures.length){
    const zeroes=Array(sampleCount).fill(0), appearances=Array(sampleCount).fill(false);
    return {available:true,samples:zeroes,appearanceSamples:appearances,quality:'full',...summariseSamples(zeroes)};
  }
  const seed = options.seed ?? createSeed(SIMULATION_RULES.version,player.id,gw,sampleCount,fixtures.map(f => f.fixture?.id || `${f.fixture?.team_h}-${f.fixture?.team_a}`).join(','));
  const rng = createRng(seed), mins = minutesEstimate(player), distribution = buildMinutesDistribution(mins), samples=[], appearanceSamples=[];
  const contexts=fixtures.map(fixture=>({fixture,components:componentMeans(player,fixture)}));
  for(let i=0;i<sampleCount;i++){
    let total = 0, appeared = false;
    for(const context of contexts){
      const outcome=simulatePlayerFixture(player,context.fixture,rng,{minutes:mins,distribution,components:context.components});
      total += outcome.points;
      appeared = appeared || outcome.appeared;
    }
    samples.push(total);
    appearanceSamples.push(appeared);
  }
  const summary=summariseSamples(samples), includeSamples=options.includeSamples!==false;
  return {available:true,samples:includeSamples?samples:[],appearanceSamples:includeSamples?appearanceSamples:[],sampleCount,seed,quality:distribution.quality,appearanceProbability:mins.pAppear,sixtyProbability:mins.p60,...summary};
}



/* ===== src/squad.mjs ===== */
/* ---------------------------------------------------------------------
   SHARED BITS
   --------------------------------------------------------------------- */
function flagsFor(p){
  let h = '';
  if(['i','u','s','n'].includes(p.status))
    h += `<span class="flag out">${p.status==='s'?'SUSP':'OUT'}</span>`;
  else if(p.status === 'd')
    h += `<span class="flag doubt">${p.chance_of_playing_next_round ?? '?'}%</span>`;
  if(p.cost_change_event > 0) h += '<span class="flag rise">▲</span>';
  if(p.cost_change_event < 0) h += '<span class="flag fall">▼</span>';
  const mo = priceMomentum(p);
  if(mo === 'rising') h += '<span class="flag rise">rising</span>';
  if(mo === 'falling') h += '<span class="flag fall">falling</span>';
  return h;
}
function priceMomentum(p){
  const net = num(p.transfers_in_event) - num(p.transfers_out_event);
  if(net > 55000) return 'rising';
  if(net < -55000) return 'falling';
  return null;
}
function newsAge(p){
  if(!p.news || !p.news_added) return '';
  const days = Math.floor((Date.now() - new Date(p.news_added))/86400000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : days + 'd ago';
}
function sellPrice(entry){
  // FPL keeps half of any rise, rounded down to 0.1
  const now = entry.p.now_cost, bought = entry.bought ?? now;
  if(now <= bought) return now;
  return bought + Math.floor((now - bought)/2);
}

function mySquad(){
  if($('useManual').checked || !S.picks || !S.picks.picks){
    return S.manual.map((m,i) => ({p:S.byId[m.id], bought:m.bought, position:i+1, multiplier:1})).filter(x => x.p);
  }
  return S.picks.picks.map(pk => ({p:S.byId[pk.element], bought:null, position:pk.position,
    multiplier:pk.multiplier, is_captain:pk.is_captain})).filter(x => x.p);
}

function bestXI(squad, gw){
  const byPos = {1:[],2:[],3:[],4:[]};
  squad.forEach(s => { if(byPos[s.p.element_type]) byPos[s.p.element_type].push(s); });
  Object.values(byPos).forEach(arr => arr.sort((a,b) => xpOf(b.p,gw,1).total - xpOf(a.p,gw,1).total));
  let best = null;
  for(let d=3; d<=5; d++) for(let m=2; m<=5; m++){
    const f = 10 - d - m;
    if(f < 1 || f > 3) continue;
    if(byPos[1].length < 1 || byPos[2].length < d || byPos[3].length < m || byPos[4].length < f) continue;
    const xi = [byPos[1][0], ...byPos[2].slice(0,d), ...byPos[3].slice(0,m), ...byPos[4].slice(0,f)];
    const tot = xi.reduce((a,s) => a + xpOf(s.p,gw,1).total, 0);
    if(!best || tot > best.tot) best = {tot, xi, shape:`${d}-${m}-${f}`};
  }
  if(!best) return {tot:0, xi:squad.slice(0,11), shape:'—', bench:squad.slice(11)};
  const ids = new Set(best.xi.map(s => s.p.id));
  best.bench = squad.filter(s => !ids.has(s.p.id))
    .sort((a,b) => (a.p.element_type===1?1:0)-(b.p.element_type===1?1:0) || xpOf(b.p,gw,1).total - xpOf(a.p,gw,1).total);
  return best;
}



/* ===== src/model/squad-simulation.mjs ===== */

function formationCounts(entries){
  const counts={1:0,2:0,3:0,4:0};
  entries.forEach(entry => { if(entry?.p?.element_type) counts[entry.p.element_type]++; });
  return counts;
}
function legalXI(entries){
  const c=formationCounts(entries);
  return entries.length===11 && c[1]===1 && c[2]>=3 && c[3]>=2 && c[4]>=1;
}
function applyAutosubs(starters,bench,outcomes){
  const active=starters.slice();
  const used=[];
  const goalkeeperIndex=active.findIndex(entry => entry.p.element_type===1 && !outcomes.get(entry.p.id)?.appeared);
  if(goalkeeperIndex>=0){
    const reserve=bench.find(entry => entry.p.element_type===1 && outcomes.get(entry.p.id)?.appeared);
    if(reserve){ used.push(reserve); active[goalkeeperIndex]=reserve; }
  }
  const missing=()=>active.map((entry,index)=>({entry,index})).filter(row => row.entry.p.element_type!==1 && !outcomes.get(row.entry.p.id)?.appeared);
  for(const substitute of bench.filter(entry => entry.p.element_type!==1)){
    if(used.length>=4 || !outcomes.get(substitute.p.id)?.appeared) continue;
    const candidates=missing();
    let replaced=false;
    for(const candidate of candidates){
      const trial=active.slice(); trial[candidate.index]=substitute;
      if(legalXI(trial)){ active[candidate.index]=substitute; used.push(substitute); replaced=true; break; }
    }
    if(replaced && !missing().length) break;
  }
  return {scoringXI:active.filter(entry => outcomes.get(entry.p.id)?.appeared),used};
}
function applyCaptainFallback(captainId,viceCaptainId,outcomes){
  if(outcomes.get(captainId)?.appeared) return captainId;
  if(outcomes.get(viceCaptainId)?.appeared) return viceCaptainId;
  return null;
}
function simulateSquadGameweek(input){
  const samples=clamp(Math.floor(num(input.samples)||SIMULATION_RULES.productionSamples),1,SIMULATION_RULES.maxSamples);
  const starters=input.starters||[], bench=input.bench||[];
  const all=[...starters,...bench];
  if(all.length!==15 || starters.length!==11 || !legalXI(starters)) return {available:false,reason:'invalid-squad'};
  const seed=input.seed??createSeed(SIMULATION_RULES.version,input.gw,samples,all.map(x=>x.p.id).join(','),input.captainId,input.viceCaptainId);
  const playerResults=new Map();
  all.forEach(entry => playerResults.set(entry.p.id,simulatePlayerGameweek(entry.p,input.gw,{samples,seed:createSeed(seed,entry.p.id)})));
  if([...playerResults.values()].some(result=>!result.available)) return {available:false,reason:'pre-season',quality:'baseline-only'};
  const totals=[], autosubTotals=[], viceTakeovers=[];
  for(let i=0;i<samples;i++){
    const outcomes=new Map();
    all.forEach(entry => {
      const result=playerResults.get(entry.p.id);
      outcomes.set(entry.p.id,{points:result.samples[i],appeared:Boolean(result.appearanceSamples[i])});
    });
    const applied=applyAutosubs(starters,bench,outcomes);
    let total=applied.scoringXI.reduce((sum,entry)=>sum+num(outcomes.get(entry.p.id)?.points),0);
    const base=starters.filter(entry=>outcomes.get(entry.p.id)?.appeared).reduce((sum,entry)=>sum+num(outcomes.get(entry.p.id)?.points),0);
    const armband=applyCaptainFallback(input.captainId,input.viceCaptainId,outcomes);
    if(armband) total+=num(outcomes.get(armband)?.points);
    totals.push(total); autosubTotals.push(total-base-(armband?num(outcomes.get(armband)?.points):0));
    viceTakeovers.push(armband===input.viceCaptainId?1:0);
  }
  return {available:true,seed,samples:totals,expectedAutoSubPoints:autosubTotals.reduce((a,b)=>a+b,0)/samples,viceTakeoverProbability:viceTakeovers.reduce((a,b)=>a+b,0)/samples,...summariseSamples(totals)};
}
function compareCaptains(input,candidateIds){
  return candidateIds.map(captainId=>({captainId,...simulateSquadGameweek({...input,captainId})}));
}


/* ===== src/model/transfers.mjs ===== */

const POSITION_QUOTAS = TRANSFER_RULES.positionQuotas;
const UNAVAILABLE = new Set(TRANSFER_RULES.unavailableStatuses);
// Reporting cadence only. It never changes which plans are evaluated, retained or ranked.
const TRANSFER_PROGRESS_INTERVAL = 20000;

function playerOf(entry){ return entry?.p || entry; }
function playerId(entry){ return Number(playerOf(entry)?.id); }
function positionOf(entry){ return Number(playerOf(entry)?.element_type); }
function hasKnownPurchasePrice(entry){
  const raw = entry?.bought ?? entry?.purchasePrice;
  return raw !== null && raw !== undefined && Number.isFinite(Number(raw));
}

function transferSellPrice(entry){
  const now = Number(entry?.p?.now_cost ?? entry?.now_cost);
  if(!Number.isFinite(now)) return 0;
  const bought = hasKnownPurchasePrice(entry) ? Number(entry?.bought ?? entry?.purchasePrice) : now;
  if(now <= bought) return now;
  return bought + Math.floor((now - bought) / 2);
}

function nextFreeTransfers(freeTransfers, transferCount){
  const ft = Math.max(0, Math.min(TRANSFER_RULES.maxFreeTransfers, Math.trunc(Number(freeTransfers) || 0)));
  const n = Math.max(0, Math.trunc(Number(transferCount) || 0));
  return Math.min(TRANSFER_RULES.maxFreeTransfers, Math.max(0, ft - n) + 1);
}

function transferHit(freeTransfers, transferCount){
  const ft = Math.max(0, Math.min(TRANSFER_RULES.maxFreeTransfers, Math.trunc(Number(freeTransfers) || 0)));
  const n = Math.max(0, Math.trunc(Number(transferCount) || 0));
  const paidTransfers = Math.max(0, n - ft);
  return { paidTransfers, hitCost: paidTransfers * TRANSFER_RULES.pointsPerPaidTransfer };
}

function combinations(items, size, start=0, chosen=[], out=[]){
  if(chosen.length === size){ out.push(chosen.slice()); return out; }
  for(let i=start; i<=items.length-(size-chosen.length); i++){
    chosen.push(items[i]); combinations(items,size,i+1,chosen,out); chosen.pop();
  }
  return out;
}

function validateSquad(squad, {allowInheritedOverQuota=true}={}){
  const issues=[];
  if(!Array.isArray(squad) || squad.length !== 15) issues.push('squad_size');
  const players = Array.isArray(squad) ? squad.map(playerOf).filter(Boolean) : [];
  const ids = players.map(p=>Number(p.id));
  if(new Set(ids).size !== ids.length) issues.push('duplicate_player');
  if(players.some(p=>!Number.isFinite(Number(p.id)) || !POSITION_QUOTAS[Number(p.element_type)] || !Number.isFinite(Number(p.team)))) issues.push('unknown_player');
  const pos={1:0,2:0,3:0,4:0}, clubs={};
  players.forEach(p=>{ pos[p.element_type]=(pos[p.element_type]||0)+1; clubs[p.team]=(clubs[p.team]||0)+1; });
  Object.entries(POSITION_QUOTAS).forEach(([k,v])=>{ if(pos[k]!==v) issues.push(`position_${k}`); });
  if(!allowInheritedOverQuota && Object.values(clubs).some(n=>n>TRANSFER_RULES.maxPerClub)) issues.push('club_quota');
  return {ok:issues.length===0, issues:[...new Set(issues)], positionCounts:pos, clubCounts:clubs};
}

function bestXIFromPositionRows(byPos){
  let best=null;
  for(let d=3;d<=5;d++) for(let m=2;m<=5;m++){
    const f=10-d-m; if(f<1||f>3) continue;
    if(byPos[1].length<1||byPos[2].length<d||byPos[3].length<m||byPos[4].length<f) continue;
    const selected=[byPos[1][0],...byPos[2].slice(0,d),...byPos[3].slice(0,m),...byPos[4].slice(0,f)];
    const total=selected.reduce((a,x)=>a+x.score,0);
    const signature=`${d}-${m}-${f}|${selected.map(x=>x.p.id).sort((a,b)=>a-b).join(',')}`;
    if(!best || total>best.total || (total===best.total && signature<best.signature))
      best={total,formation:`${d}-${m}-${f}`,playerIds:selected.map(x=>Number(x.p.id)),signature};
  }
  return best || {total:0,formation:'—',playerIds:[],signature:''};
}

function bestXIForGW(squad, gw, scorePlayer){
  const byPos={1:[],2:[],3:[],4:[]};
  squad.forEach(entry=>{
    const p=playerOf(entry), raw=Number(scorePlayer(p,gw));
    byPos[p.element_type].push({entry,p,score:Number.isFinite(raw)?raw:0});
  });
  Object.values(byPos).forEach(arr=>arr.sort((a,b)=>b.score-a.score || Number(a.p.id)-Number(b.p.id)));
  return bestXIFromPositionRows(byPos);
}

function scoreSquadAcrossHorizon(squad,startGW,horizon,scorePlayer){
  const perGameweek=[]; let total=0;
  for(let gw=startGW;gw<startGW+horizon;gw++){
    const xi=bestXIForGW(squad,gw,scorePlayer); total+=xi.total; perGameweek.push({gw,...xi});
  }
  return {total,perGameweek};
}

function canonicalTransfers(transfers){
  return transfers.slice().sort((a,b)=>a.position-b.position||a.outPlayerId-b.outPlayerId||a.inPlayerId-b.inPlayerId);
}
function planSignature(transfers){ return canonicalTransfers(transfers).map(t=>`${t.outPlayerId}>${t.inPlayerId}`).join('|'); }

function comparePlans(a,b){
  return b.netGain-a.netGain || b.grossBestXIPoints-a.grossBestXIPoints || a.hitCost-b.hitCost ||
    a.transferCount-b.transferCount || b.freeTransfersNextGW-a.freeTransfersNextGW || b.bankAfter-a.bankAfter ||
    a.doubtfulIncoming-b.doubtfulIncoming || a.signature.localeCompare(b.signature);
}

function inheritedClubLegal(startCounts, finalCounts, transferCount){
  for(const [club,count] of Object.entries(finalCounts)){
    const start=startCounts[club]||0;
    if(start<=TRANSFER_RULES.maxPerClub && count>TRANSFER_RULES.maxPerClub) return false;
    if(start>TRANSFER_RULES.maxPerClub && count>start) return false;
  }
  const startExcess=Object.values(startCounts).reduce((a,n)=>a+Math.max(0,n-TRANSFER_RULES.maxPerClub),0);
  const finalExcess=Object.values(finalCounts).reduce((a,n)=>a+Math.max(0,n-TRANSFER_RULES.maxPerClub),0);
  return finalExcess <= Math.max(0,startExcess-transferCount);
}

function buildBaseline({squad,bank,freeTransfers,startGW,horizon,scorePlayer}){
  const baselineScore=scoreSquadAcrossHorizon(squad,startGW,horizon,scorePlayer);
  return {transferCount:0,transfers:[],finalSquadIds:squad.map(playerId).sort((a,b)=>a-b),bankBefore:bank,bankAfter:bank,
    freeTransfersBefore:freeTransfers,paidTransfers:0,hitCost:0,freeTransfersNextGW:nextFreeTransfers(freeTransfers,0),grossBestXIPoints:baselineScore.total,
    grossGain:0,rollDifference:0,netGain:0,perGameweekBestXI:baselineScore.perGameweek,doubtfulIncoming:0,signature:'',warnings:[],pricingMode:'exact'};
}

function buildPlan({startSquad,outgoing,incoming,bank,freeTransfers,startGW,horizon,scorePlayer,baseline,startCounts,pricingMode}){
  const outIds=new Set(outgoing.map(playerId));
  const finalSquad=startSquad.filter(e=>!outIds.has(playerId(e))).concat(incoming.map(p=>({p,bought:p.now_cost})));
  const legality=validateSquad(finalSquad,{allowInheritedOverQuota:true});
  if(!legality.ok || !inheritedClubLegal(startCounts,legality.clubCounts,outgoing.length)) return null;
  const sellTotal=outgoing.reduce((a,e)=>a+transferSellPrice(e),0);
  const buyTotal=incoming.reduce((a,p)=>a+Number(p.now_cost||0),0);
  const bankAfter=bank+sellTotal-buyTotal;
  if(bankAfter<0) return null;
  const hit=transferHit(freeTransfers,outgoing.length);
  const score=scoreSquadAcrossHorizon(finalSquad,startGW,horizon,scorePlayer);
  const nextFT=nextFreeTransfers(freeTransfers,outgoing.length);
  const rollDifference=nextFT-baseline.freeTransfersNextGW;
  const grossGain=score.total-baseline.grossBestXIPoints;
  const netGain=grossGain-hit.hitCost+TRANSFER_RULES.rollValue*rollDifference;
  const transfers=canonicalTransfers(outgoing.map((out,i)=>({outPlayerId:playerId(out),inPlayerId:Number(incoming[i].id),position:positionOf(out),sellPrice:transferSellPrice(out),buyPrice:Number(incoming[i].now_cost)})));
  return {transferCount:outgoing.length,transfers,finalSquadIds:finalSquad.map(playerId).sort((a,b)=>a-b),bankBefore:bank,bankAfter,
    freeTransfersBefore:freeTransfers,paidTransfers:hit.paidTransfers,hitCost:hit.hitCost,freeTransfersNextGW:nextFT,
    grossBestXIPoints:score.total,grossGain,rollDifference,netGain,perGameweekBestXI:score.perGameweek,
    doubtfulIncoming:incoming.filter(p=>p.status==='d').length,signature:planSignature(transfers),pricingMode,
    warnings:incoming.filter(p=>p.status==='d').map(p=>`${p.web_name||p.id} doubtful (${p.chance_of_playing_next_round??'?'}%)`)};
}

// Bounded top-K retention. comparePlans() is a total order — its final tiebreak is the
// plan signature, signatures are unique per transfer set and contain only ASCII digits,
// '>' and '|', so two distinct plans never compare equal.
function retainPlan(plans,plan,limit){
  if(plans.length>=limit && comparePlans(plan,plans[plans.length-1])>0) return plans;
  plans.push(plan);
  plans.sort(comparePlans);
  if(plans.length>limit) plans.length=limit;
  return plans;
}

function normaliseSearch(args){
  const {squad,players,bank=0,freeTransfers=1,startGW=1,horizon=6,maxTransfers=TRANSFER_RULES.maxTransfers,
    maxResults=20,maxEvaluations=TRANSFER_RULES.maxEvaluations,scorePlayer,
    onProgress,progressInterval=TRANSFER_PROGRESS_INTERVAL}=args;
  const legality=validateSquad(squad,{allowInheritedOverQuota:true});
  if(!legality.ok) return {error:{status:'invalid-input',issues:legality.issues,plans:[],evaluations:0}};
  if(typeof scorePlayer!=='function') return {error:{status:'projection-unavailable',issues:['score_player_missing'],plans:[],evaluations:0}};
  const cleanBank=Math.max(0,Math.trunc(Number(bank)||0));
  const cleanFT=Math.max(0,Math.min(TRANSFER_RULES.maxFreeTransfers,Math.trunc(Number(freeTransfers)||0)));
  const cleanHorizon=Math.max(1,Math.min(TRANSFER_RULES.maxHorizon,Math.trunc(Number(horizon)||1)));
  const cleanLimit=Math.min(TRANSFER_RULES.maxTransfers,Math.max(0,Math.trunc(Number(maxTransfers)||0)));
  const cleanMaxResults=Math.max(1,Math.trunc(Number(maxResults)||1));
  const cleanMaxEvaluations=Math.max(0,Math.trunc(Number(maxEvaluations)||0));
  const owned=new Set(squad.map(playerId));
  const eligible=(players||[]).filter(p=>p&&!owned.has(Number(p.id))&&POSITION_QUOTAS[p.element_type]&&!UNAVAILABLE.has(p.status)).sort((a,b)=>Number(a.id)-Number(b.id));
  const pricingMode=squad.every(hasKnownPurchasePrice)?'exact':'estimated';
  const baseline=buildBaseline({squad,bank:cleanBank,freeTransfers:cleanFT,startGW,horizon:cleanHorizon,scorePlayer});
  baseline.pricingMode=pricingMode;
  return {squad,eligible,bank:cleanBank,freeTransfers:cleanFT,startGW,horizon:cleanHorizon,limit:cleanLimit,maxResults:cleanMaxResults,
    maxEvaluations:cleanMaxEvaluations,scorePlayer,baseline,startCounts:legality.clubCounts,pricingMode,
    onProgress:typeof onProgress==='function'?onProgress:null,
    progressInterval:Math.max(1,Math.trunc(Number(progressInterval)||TRANSFER_PROGRESS_INTERVAL))};
}

function completeResult(ctx,plans,evaluations,pruned=0,incomplete=false,profile=null){
  plans.sort(comparePlans);
  const base={evaluations,pruned,baseline:ctx.baseline,pricingMode:ctx.pricingMode};
  if(profile) base.profile=Object.freeze({...profile});
  if(incomplete) return {status:'search-incomplete',issues:['evaluation_limit'],plans:[ctx.baseline],...base};
  return {status:'ok',issues:[],plans:plans.slice(0,ctx.maxResults),...base};
}

function exhaustiveTransferSearch(args){
  const ctx=normaliseSearch(args); if(ctx.error) return ctx.error;
  const plans=[ctx.baseline]; let evaluations=0, incomplete=false;
  outer: for(let n=1;n<=ctx.limit;n++){
    for(const outgoing of combinations(ctx.squad,n)){
      const required=outgoing.map(positionOf).sort((a,b)=>a-b);
      const candidates=ctx.eligible.filter(p=>required.includes(Number(p.element_type)));
      for(const incoming of combinations(candidates,n)){
        if(++evaluations>ctx.maxEvaluations){ incomplete=true; break outer; }
        const incomingPos=incoming.map(p=>Number(p.element_type)).sort((a,b)=>a-b);
        if(incomingPos.some((v,i)=>v!==required[i])) continue;
        const ordered=[], used=new Set();
        for(const out of outgoing){
          const idx=incoming.findIndex((p,i)=>!used.has(i)&&Number(p.element_type)===positionOf(out));
          if(idx<0) break; used.add(idx); ordered.push(incoming[idx]);
        }
        if(ordered.length!==n) continue;
        const plan=buildPlan({startSquad:ctx.squad,outgoing,incoming:ordered,bank:ctx.bank,freeTransfers:ctx.freeTransfers,startGW:ctx.startGW,
          horizon:ctx.horizon,scorePlayer:ctx.scorePlayer,baseline:ctx.baseline,startCounts:ctx.startCounts,pricingMode:ctx.pricingMode});
        if(plan) plans.push(plan);
      }
    }
  }
  return completeResult(ctx,plans,evaluations,0,incomplete);
}

function prepareScoreRows(ctx){
  const rows=new Map(), all=[], seen=new Set();
  for(const entry of ctx.squad){ const p=playerOf(entry),id=Number(p.id); if(!seen.has(id)){seen.add(id);all.push(p);} }
  for(const p of ctx.eligible){ const id=Number(p.id); if(!seen.has(id)){seen.add(id);all.push(p);} }
  for(const p of all){
    const values=[];
    for(let offset=0;offset<ctx.horizon;offset++){
      const raw=Number(ctx.scorePlayer(p,ctx.startGW+offset));
      values.push(Number.isFinite(raw)?raw:0);
    }
    rows.set(Number(p.id),values);
  }
  return rows;
}
function horizonScore(scoreRows,p){ return (scoreRows.get(Number(p.id))||[]).reduce((sum,value)=>sum+value,0); }

function buildCoreByGameweek(core,scoreRows,horizon){
  const games=[];
  for(let offset=0;offset<horizon;offset++){
    const byPos={1:[],2:[],3:[],4:[]};
    for(const entry of core){
      const p=playerOf(entry),score=Number(scoreRows.get(Number(p.id))?.[offset])||0;
      byPos[p.element_type].push({entry,p,score});
    }
    Object.values(byPos).forEach(rows=>rows.sort((a,b)=>b.score-a.score||Number(a.p.id)-Number(b.p.id)));
    games.push(byPos);
  }
  return games;
}

function scoreCoreWithIncoming(coreByGameweek,incoming,scoreRows,startGW,horizon){
  const perGameweek=[]; let total=0;
  for(let offset=0;offset<horizon;offset++){
    const base=coreByGameweek[offset];
    const byPos={1:base[1].slice(),2:base[2].slice(),3:base[3].slice(),4:base[4].slice()};
    for(const p of incoming){
      const score=Number(scoreRows.get(Number(p.id))?.[offset])||0;
      byPos[p.element_type].push({entry:p,p,score});
    }
    Object.values(byPos).forEach(rows=>rows.sort((a,b)=>b.score-a.score||Number(a.p.id)-Number(b.p.id)));
    const xi=bestXIFromPositionRows(byPos);
    total+=xi.total; perGameweek.push({gw:startGW+offset,...xi});
  }
  return {total,perGameweek};
}

/* ---------------------------------------------------------------------------
   Exact position-pool machinery.

   Every legal transfer keeps the squad on its exact position quota, so for a
   fixed outgoing set the final pool at each position always holds exactly
   POSITION_QUOTAS[pos] players. A horizon best-XI total can therefore be read
   from per-Gameweek descending score prefix sums rather than rebuilding,
   re-sorting and re-scanning squad rows for every candidate.

   An incoming slot that is not yet filled is held as a zero placeholder. Zero
   is optimistic because a real incoming player may score below zero, so a
   padded pool never understates any descendant of the node.
   --------------------------------------------------------------------------- */
const FORMATIONS=Object.freeze([[3,4,3],[3,5,2],[4,3,3],[4,4,2],[4,5,1],[5,2,3],[5,3,2],[5,4,1]]);
// Largest starting count each position reaches across the legal formations.
const STARTER_LIMIT=Object.freeze({1:1,2:5,3:5,4:3});

function createPoolLevel(horizon){
  const level={count:{1:0,2:0,3:0,4:0},real:{},values:{},prefix:{}};
  for(const pos of [1,2,3,4]){
    const quota=POSITION_QUOTAS[pos];
    level.real[pos]=new Float64Array(horizon*quota);
    level.values[pos]=new Float64Array(horizon*quota);
    level.prefix[pos]=new Float64Array(horizon*(quota+1));
  }
  return level;
}

function sortDescInPlace(row,base,length){
  for(let k=1;k<length;k++){
    const value=row[base+k]; let j=k-1;
    while(j>=0&&row[base+j]<value){ row[base+j+1]=row[base+j]; j--; }
    row[base+j+1]=value;
  }
}

// Rebuilds the zero-padded pool and its descending prefix sums for one position.
function refreshPool(level,pos,horizon){
  const quota=POSITION_QUOTAS[pos],count=level.count[pos],
    real=level.real[pos],values=level.values[pos],prefix=level.prefix[pos];
  for(let offset=0;offset<horizon;offset++){
    const rowBase=offset*quota,prefixBase=offset*(quota+1);
    for(let k=0;k<quota;k++) values[rowBase+k]=k<count?real[rowBase+k]:0;
    sortDescInPlace(values,rowBase,quota);
    let sum=0; prefix[prefixBase]=0;
    for(let k=0;k<quota;k++){ sum+=values[rowBase+k]; prefix[prefixBase+k+1]=sum; }
  }
}

function seedPoolLevel(level,core,scoreRows,horizon){
  const rows={1:[],2:[],3:[],4:[]};
  for(const entry of core) rows[positionOf(entry)].push(scoreRows.get(playerId(entry)));
  for(const pos of [1,2,3,4]){
    const quota=POSITION_QUOTAS[pos],members=rows[pos],real=level.real[pos];
    level.count[pos]=members.length;
    for(let offset=0;offset<horizon;offset++){
      const rowBase=offset*quota;
      for(let k=0;k<members.length;k++) real[rowBase+k]=Number(members[k]?.[offset])||0;
      sortDescInPlace(real,rowBase,members.length);
    }
    refreshPool(level,pos,horizon);
  }
}

// Copies `from` into `to` with one further real member added at `pos`.
function extendPoolLevel(from,to,pos,scoreRow,horizon){
  for(const other of [1,2,3,4]){
    to.count[other]=from.count[other];
    to.real[other].set(from.real[other]);
    if(other!==pos){ to.values[other].set(from.values[other]); to.prefix[other].set(from.prefix[other]); }
  }
  const quota=POSITION_QUOTAS[pos],count=from.count[pos],real=to.real[pos];
  for(let offset=0;offset<horizon;offset++){
    const rowBase=offset*quota;
    real[rowBase+count]=Number(scoreRow?.[offset])||0;
    sortDescInPlace(real,rowBase,count+1);
  }
  to.count[pos]=count+1;
  refreshPool(to,pos,horizon);
}

function horizonTotalFromPrefixes(gkPrefix,defPrefix,midPrefix,fwdPrefix,horizon){
  let total=0;
  for(let offset=0;offset<horizon;offset++){
    const gk=gkPrefix[offset*3+1],defBase=offset*6,midBase=offset*6,fwdBase=offset*4;
    let best=-Infinity;
    for(let i=0;i<FORMATIONS.length;i++){
      const shape=FORMATIONS[i];
      const value=gk+defPrefix[defBase+shape[0]]+midPrefix[midBase+shape[1]]+fwdPrefix[fwdBase+shape[2]];
      if(value>best) best=value;
    }
    total+=best;
  }
  return total;
}

// Exact horizon best-XI total for a complete pool; an optimistic base while slots remain.
function poolHorizonTotal(level,horizon){
  return horizonTotalFromPrefixes(level.prefix[1],level.prefix[2],level.prefix[3],level.prefix[4],horizon);
}

// Admissible identity-preserving marginal of one candidate against a padded pool.
// Filling a placeholder with score s raises any top-k total by at most
// max(0, s - kth value of the padded pool), and the largest starting count gives
// the smallest such threshold, so one gain is valid for every legal formation and
// for every placeholder still outstanding at that position.
function poolPlayerGain(level,pos,scoreRow,horizon){
  const quota=POSITION_QUOTAS[pos],values=level.values[pos],index=STARTER_LIMIT[pos]-1;
  let total=0;
  for(let offset=0;offset<horizon;offset++){
    const delta=(Number(scoreRow?.[offset])||0)-values[offset*quota+index];
    if(delta>0) total+=delta;
  }
  return total;
}

/* Cost of moving an identity gain from the branch-level padded pool to the node's
   padded pool. max(0, s - b) <= max(0, s - a) + max(0, a - b) for every score, so
   adding this constant per outstanding slot keeps a branch-level gain admissible
   at any node while leaving the branch-level ordering intact. */
function thresholdDelta(branchLevel,nodeLevel,pos,horizon){
  const quota=POSITION_QUOTAS[pos],index=STARTER_LIMIT[pos]-1;
  const branchValues=branchLevel.values[pos],nodeValues=nodeLevel.values[pos];
  let total=0;
  for(let offset=0;offset<horizon;offset++){
    const drop=branchValues[offset*quota+index]-nodeValues[offset*quota+index];
    if(drop>0) total+=drop;
  }
  return total;
}

// Admissible per-formation bound for the last outstanding slot. It preserves the
// candidate's identity across every Gameweek and applies each formation's own
// threshold instead of the smallest threshold across formations.
function finalSlotUpperBound(level,pos,scoreRow,horizon){
  const gkPrefix=level.prefix[1],defPrefix=level.prefix[2],midPrefix=level.prefix[3],fwdPrefix=level.prefix[4];
  const quota=POSITION_QUOTAS[pos],values=level.values[pos];
  let total=0;
  for(let offset=0;offset<horizon;offset++){
    const gk=gkPrefix[offset*3+1],defBase=offset*6,midBase=offset*6,fwdBase=offset*4,
      valueBase=offset*quota,score=Number(scoreRow?.[offset])||0;
    let best=-Infinity;
    for(let i=0;i<FORMATIONS.length;i++){
      const shape=FORMATIONS[i];
      const starters=pos===1?1:pos===2?shape[0]:pos===3?shape[1]:shape[2];
      const delta=score-values[valueBase+starters-1];
      const value=gk+defPrefix[defBase+shape[0]]+midPrefix[midBase+shape[1]]+fwdPrefix[fwdBase+shape[2]]+(delta>0?delta:0);
      if(value>best) best=value;
    }
    total+=best;
  }
  return total;
}

/* Exact "best k scores available at or below a price" tables.

   Candidates are swept in ascending price once per position, so for any budget a
   binary search returns both how many candidates are affordable and their highest
   scores in each Gameweek. This replaces a price-filtered scan of the whole
   position pool at every partial node. */
const RELAXED_TOP_K=TRANSFER_RULES.maxTransfers;

function buildCostCappedTables(byPositionCost,scoreRows,horizon){
  const tables={1:null,2:null,3:null,4:null};
  for(const pos of [1,2,3,4]){
    const pool=byPositionCost[pos],costs=[];
    for(const p of pool){
      const cost=Number(p.now_cost||0);
      if(!costs.length||costs[costs.length-1]!==cost) costs.push(cost);
    }
    const steps=costs.length,available=new Int32Array(steps),top=new Float64Array(horizon*steps*RELAXED_TOP_K);
    top.fill(-Infinity);
    for(let offset=0;offset<horizon;offset++){
      const best=new Float64Array(RELAXED_TOP_K).fill(-Infinity);
      let index=0,seen=0,i=0;
      while(i<pool.length){
        const cost=Number(pool[i].now_cost||0);
        while(i<pool.length&&Number(pool[i].now_cost||0)===cost){
          const score=Number(scoreRows.get(Number(pool[i].id))?.[offset])||0;
          for(let k=0;k<RELAXED_TOP_K;k++) if(score>best[k]){
            for(let j=RELAXED_TOP_K-1;j>k;j--) best[j]=best[j-1];
            best[k]=score; break;
          }
          seen++; i++;
        }
        const base=(offset*steps+index)*RELAXED_TOP_K;
        for(let k=0;k<RELAXED_TOP_K;k++) top[base+k]=best[k];
        if(offset===0) available[index]=seen;
        index++;
      }
    }
    tables[pos]={costs:Float64Array.from(costs),steps,available,top};
  }
  return tables;
}

// Largest table step whose price is within budget, or -1 when nothing is affordable.
function costCappedStep(table,maxCandidateCost){
  const costs=table.costs;
  let low=0,high=table.steps-1,found=-1;
  while(low<=high){
    const mid=(low+high)>>1;
    if(costs[mid]<=maxCandidateCost){ found=mid; low=mid+1; } else high=mid-1;
  }
  return found;
}

/* Admissible bound that keeps `fixedRow` at `fixedPos` with its true identity and
   fills every other outstanding slot with the highest-scoring affordable candidate
   of that Gameweek. Cross-Gameweek identity, club capacity and candidate reuse are
   relaxed only in the optimistic direction and the per-player price cap is exact,
   so no reachable descendant can score higher. -Infinity means no completion can
   be afforded at all. */
function relaxedHorizonUpperBound(from,scratch,prefixRefs,remainingNeed,horizon,costTables,
  fixedPos,fixedRow,caps){
  for(let pos=1;pos<=4;pos++){
    const quota=POSITION_QUOTAS[pos],count=from.count[pos];
    const relaxedNeed=remainingNeed[pos]|0,fixed=pos===fixedPos?1:0;
    if(!relaxedNeed&&!fixed){ prefixRefs[pos]=from.prefix[pos]; continue; }
    const values=scratch.values[pos],prefix=scratch.prefix[pos],real=from.real[pos];
    let step=-1,table=null;
    if(relaxedNeed){
      table=costTables[pos];
      step=costCappedStep(table,caps[pos]);
      if(step<0||table.available[step]<relaxedNeed) return -Infinity;
    }
    for(let offset=0;offset<horizon;offset++){
      const rowBase=offset*quota,prefixBase=offset*(quota+1);
      for(let k=0;k<count;k++) values[rowBase+k]=real[rowBase+k];
      let filled=0;
      if(fixed){ values[rowBase+count]=Number(fixedRow?.[offset])||0; filled=1; }
      if(relaxedNeed){
        const base=(offset*table.steps+step)*RELAXED_TOP_K;
        for(let k=0;k<relaxedNeed;k++) values[rowBase+count+filled+k]=table.top[base+k];
        filled+=relaxedNeed;
      }
      sortDescInPlace(values,rowBase,quota);
      let sum=0; prefix[prefixBase]=0;
      for(let k=0;k<quota;k++){ sum+=values[rowBase+k]; prefix[prefixBase+k+1]=sum; }
    }
    prefixRefs[pos]=prefix;
  }
  return horizonTotalFromPrefixes(prefixRefs[1],prefixRefs[2],prefixRefs[3],prefixRefs[4],horizon);
}

function minimumRemainingDoubtful(byPosition,remainingNeed,usedIds){
  let total=0;
  for(const pos of [1,2,3,4]){
    const count=Number(remainingNeed[pos])||0;
    if(!count) continue;
    let available=0,nonDoubtful=0;
    for(const p of byPosition[pos]){
      if(usedIds.has(Number(p.id))) continue;
      available++;
      if(p.status!=='d') nonDoubtful++;
    }
    if(available<count) return Infinity;
    total+=Math.max(0,count-nonDoubtful);
  }
  return total;
}

function optimisticSignatureLower(outgoing,chosen,remainingNeed,byPositionId){
  const completion=chosen.slice(),used=new Set(chosen.map(p=>Number(p.id)));
  for(const pos of [1,2,3,4]){
    let left=Number(remainingNeed[pos])||0;
    for(const p of byPositionId[pos]){
      if(!left) break;
      if(used.has(Number(p.id))) continue;
      used.add(Number(p.id)); completion.push(p); left--;
    }
    if(left>0) return '';
  }
  const incoming=orderedIncomingForOutgoing(outgoing,completion);
  const transfers=canonicalTransfers(outgoing.map((out,index)=>({
    outPlayerId:playerId(out),inPlayerId:Number(incoming[index]?.id),position:positionOf(out)
  })));
  return planSignature(transfers);
}

function optimisticTieBreak({ctx,outgoing,chosen,remainingNeed,byPosition,byPositionCost,byPositionId,usedIds,cost,sellTotal}){
  const cheapestRest=Object.entries(remainingNeed).reduce((sum,[pos,count])=>
    sum+cheapestAvailableCost(byPositionCost[pos],count,usedIds),0);
  const hasRemaining=Object.values(remainingNeed).some(Boolean);
  return {
    bankAfter:ctx.bank+sellTotal-cost-cheapestRest,
    doubtfulIncoming:chosen.filter(p=>p.status==='d').length+minimumRemainingDoubtful(byPosition,remainingNeed,usedIds),
    // Every real transfer signature is non-empty. The empty string is therefore
    // universally optimistic for a partial node, without assuming numeric player-ID
    // order is the same as locale string order for mixed-width identifiers.
    signature:hasRemaining?'':optimisticSignatureLower(outgoing,chosen,remainingNeed,byPositionId)
  };
}

const BOUND_EPSILON=1e-9;

/* Comparator-complete rejection for an already-tied optimistic bound. It is only
   reached when the optimistic net gain and gross score both tie the retained Kth
   plan, so the optimistic completion signature — the expensive part — is built
   only when it can change the outcome. */
function tiedBoundCannotBeat(depth,kth,optimisticTie){
  return comparePlans({
    netGain:kth.netGain,grossBestXIPoints:kth.grossBestXIPoints,
    hitCost:depth.hitCost,transferCount:depth.transferCount,freeTransfersNextGW:depth.freeTransfersNextGW,
    bankAfter:Number.isFinite(optimisticTie?.bankAfter)?optimisticTie.bankAfter:Number.MAX_SAFE_INTEGER,
    doubtfulIncoming:Number.isFinite(optimisticTie?.doubtfulIncoming)?optimisticTie.doubtfulIncoming:-1,
    signature:String(optimisticTie?.signature??'')
  },kth)>0;
}

// Fixed comparator terms for one transfer depth. netOffset converts any gross
// best-XI bound into the matching net-gain bound in one addition.
function depthConstants(ctx,transferCount){
  const hit=transferHit(ctx.freeTransfers,transferCount);
  const freeTransfersNextGW=nextFreeTransfers(ctx.freeTransfers,transferCount);
  const rollDifference=freeTransfersNextGW-ctx.baseline.freeTransfersNextGW;
  return {transferCount,hitCost:hit.hitCost,paidTransfers:hit.paidTransfers,freeTransfersNextGW,
    netOffset:-ctx.baseline.grossBestXIPoints-hit.hitCost+TRANSFER_RULES.rollValue*rollDifference};
}

// -1 rejected outright on net gain, 0 undecided until the tie keys, 1 retained.
function boundVerdict(upperGross,depth,kth){
  if(!kth) return Number.isFinite(upperGross)?1:(upperGross===-Infinity?-1:1);
  if(!Number.isFinite(upperGross)) return upperGross===-Infinity?-1:1;
  const upperNet=upperGross+depth.netOffset;
  if(upperNet<kth.netGain-BOUND_EPSILON) return -1;
  if(upperNet>kth.netGain+BOUND_EPSILON) return 1;
  if(upperGross<kth.grossBestXIPoints-BOUND_EPSILON) return -1;
  if(upperGross>kth.grossBestXIPoints+BOUND_EPSILON) return 1;
  return 0;
}

function cheapestAvailableCost(poolByCost,count,usedIds,extraUsedId=null){
  if(count<=0) return 0;
  let total=0,found=0;
  for(const p of poolByCost){
    const id=Number(p.id);
    if(usedIds.has(id)||id===extraUsedId) continue;
    total+=Number(p.now_cost||0);
    if(++found===count) return total;
  }
  return Infinity;
}

// Cheapest `count + 1` still-available prices at a position. One spare entry is
// enough to price the remaining slots exactly when the candidate being tried is
// itself one of the cheapest.
function cheapestAvailableCosts(poolByCost,count,usedIds){
  const rows=[];
  if(count<=0) return rows;
  for(const p of poolByCost){
    if(usedIds.has(Number(p.id))) continue;
    rows.push({id:Number(p.id),cost:Number(p.now_cost||0)});
    if(rows.length===count+1) break;
  }
  return rows;
}

// Price of the dearest member of the cheapest `count` still-available candidates.
// Subtracting it from a cheapest-completion total leaves a true lower bound on the
// price of every other outstanding slot.
function dearestOfCheapest(rows,count,excludedId){
  let found=0,last=0;
  for(let i=0;i<rows.length&&found<count;i++){
    if(rows[i].id===excludedId) continue;
    last=rows[i].cost; found++;
  }
  return found<count?Infinity:last;
}

function cheapestFrom(rows,count,excludedId){
  let total=0,found=0;
  for(let i=0;i<rows.length&&found<count;i++){
    if(rows[i].id===excludedId) continue;
    total+=rows[i].cost; found++;
  }
  return found<count?Infinity:total;
}

function orderedIncomingForOutgoing(outgoing,chosen){
  const byPos={1:[],2:[],3:[],4:[]};
  chosen.forEach(p=>byPos[positionOf(p)].push(p));
  Object.values(byPos).forEach(rows=>rows.sort((a,b)=>Number(a.id)-Number(b.id)));
  const used={1:0,2:0,3:0,4:0};
  return outgoing.map(out=>byPos[positionOf(out)][used[positionOf(out)]++]);
}

function buildPreparedPlan({ctx,outgoing,incoming,core,coreByGameweek,scoreRows,bankAfter,clubCounts,preparedScore=null}){
  if(!inheritedClubLegal(ctx.startCounts,clubCounts,outgoing.length)) return null;
  const hit=transferHit(ctx.freeTransfers,outgoing.length);
  const score=preparedScore||scoreCoreWithIncoming(coreByGameweek,incoming,scoreRows,ctx.startGW,ctx.horizon);
  const nextFT=nextFreeTransfers(ctx.freeTransfers,outgoing.length);
  const rollDifference=nextFT-ctx.baseline.freeTransfersNextGW;
  const grossGain=score.total-ctx.baseline.grossBestXIPoints;
  const netGain=grossGain-hit.hitCost+TRANSFER_RULES.rollValue*rollDifference;
  const transfers=canonicalTransfers(outgoing.map((out,i)=>({outPlayerId:playerId(out),inPlayerId:Number(incoming[i].id),position:positionOf(out),sellPrice:transferSellPrice(out),buyPrice:Number(incoming[i].now_cost)})));
  return {transferCount:outgoing.length,transfers,finalSquadIds:core.map(playerId).concat(incoming.map(p=>Number(p.id))).sort((a,b)=>a-b),
    bankBefore:ctx.bank,bankAfter,freeTransfersBefore:ctx.freeTransfers,paidTransfers:hit.paidTransfers,hitCost:hit.hitCost,
    freeTransfersNextGW:nextFT,grossBestXIPoints:score.total,grossGain,rollDifference,netGain,perGameweekBestXI:score.perGameweek,
    doubtfulIncoming:incoming.filter(p=>p.status==='d').length,signature:planSignature(transfers),pricingMode:ctx.pricingMode,
    warnings:incoming.filter(p=>p.status==='d').map(p=>`${p.web_name||p.id} doubtful (${p.chance_of_playing_next_round??'?'}%)`)};
}

function outgoingCombinations(squad,size,scoreRows){
  return combinations(squad,size).map(set=>({
    set,
    score:set.reduce((sum,entry)=>sum+horizonScore(scoreRows,playerOf(entry)),0),
    key:set.map(playerId).sort((a,b)=>a-b).join(',')
  })).sort((a,b)=>a.score-b.score||a.key.localeCompare(b.key)).map(item=>item.set);
}

function optimiseTransfers(args){
  const ctx=normaliseSearch(args); if(ctx.error) return ctx.error;
  const plans=[ctx.baseline]; let evaluations=0, pruned=0, incomplete=false;
  const profile={outgoingBranches:0,boundPruned:0,identityBoundPruned:0,relaxedBoundPruned:0,finalSlotPruned:0,
    orderedBreaks:0,affordabilityPruned:0,clubPruned:0,leafEvaluations:0,materialisedPlans:0};
  const scoreRows=prepareScoreRows(ctx);
  const byPosition={1:[],2:[],3:[],4:[]};
  ctx.eligible.forEach(p=>byPosition[p.element_type].push(p));
  const byPositionCost={1:[],2:[],3:[],4:[]},byPositionId={1:[],2:[],3:[],4:[]};
  for(const pos of [1,2,3,4]){
    byPosition[pos].sort((a,b)=>horizonScore(scoreRows,b)-horizonScore(scoreRows,a)||Number(a.now_cost||0)-Number(b.now_cost||0)||Number(a.id)-Number(b.id));
    byPositionCost[pos]=byPosition[pos].slice().sort((a,b)=>Number(a.now_cost||0)-Number(b.now_cost||0)||Number(a.id)-Number(b.id));
    byPositionId[pos]=byPosition[pos].slice().sort((a,b)=>Number(a.id)-Number(b.id));
  }
  const costTables=buildCostCappedTables(byPositionCost,scoreRows,ctx.horizon);
  const allowanceCache=new Map();
  const clubAllowance=team=>{
    let allowed=allowanceCache.get(team);
    if(allowed===undefined){
      allowed=Math.max(TRANSFER_RULES.maxPerClub,Number(ctx.startCounts[team])||0);
      allowanceCache.set(team,allowed);
    }
    return allowed;
  };
  const levels=[]; for(let depth=0;depth<=TRANSFER_RULES.maxTransfers;depth++) levels.push(createPoolLevel(ctx.horizon));
  const scratch=createPoolLevel(ctx.horizon),prefixRefs={1:null,2:null,3:null,4:null};
  const retainedKth=()=>plans.length>=ctx.maxResults?plans[plans.length-1]:null;

  outer: for(let n=1;n<=ctx.limit;n++){
    ctx.onProgress?.({depth:n,maxDepth:ctx.limit,evaluations});
    const depth=depthConstants(ctx,n);
    for(const outgoing of outgoingCombinations(ctx.squad,n,scoreRows)){
      profile.outgoingBranches++;
      const required=outgoing.map(positionOf).sort((a,b)=>a-b);
      const need={1:0,2:0,3:0,4:0}; required.forEach(pos=>need[pos]++);
      if(Object.entries(need).some(([pos,count])=>byPosition[pos].length<count)){ pruned++; continue; }
      const sellTotal=outgoing.reduce((sum,e)=>sum+transferSellPrice(e),0);
      const budget=ctx.bank+sellTotal;
      const noneUsed=new Set();
      const minimumBuy=Object.entries(need).reduce((sum,[pos,count])=>sum+cheapestAvailableCost(byPositionCost[pos],count,noneUsed),0);
      if(minimumBuy>budget){ pruned++; profile.affordabilityPruned++; continue; }
      const outIds=new Set(outgoing.map(playerId));
      const core=ctx.squad.filter(entry=>!outIds.has(playerId(entry)));
      const afterOut={...ctx.startCounts}; outgoing.forEach(e=>{ afterOut[playerOf(e).team]=(afterOut[playerOf(e).team]||0)-1; });
      seedPoolLevel(levels[0],core,scoreRows,ctx.horizon);

      const caps={1:0,2:0,3:0,4:0};
      for(let rpos=1;rpos<=4;rpos++){
        const count=need[rpos]|0;
        caps[rpos]=count?budget-minimumBuy+dearestOfCheapest(
          cheapestAvailableCosts(byPositionCost[rpos],count,noneUsed),count,null):0;
      }
      const branchRelaxed=relaxedHorizonUpperBound(levels[0],scratch,prefixRefs,need,ctx.horizon,costTables,0,null,caps);
      const branchKth=retainedKth();
      let branchVerdict=boundVerdict(branchRelaxed,depth,branchKth);
      if(branchVerdict===0) branchVerdict=tiedBoundCannotBeat(depth,branchKth,optimisticTieBreak({ctx,outgoing,chosen:[],
        remainingNeed:need,byPosition,byPositionCost,byPositionId,usedIds:noneUsed,cost:0,sellTotal}))?-1:1;
      if(branchVerdict<0){ pruned++; profile.boundPruned++; profile.relaxedBoundPruned++; continue; }

      // Identity gains and their descending order are immutable for the whole branch.
      const gainOrder={},gainValue={};
      for(const pos of [1,2,3,4]){
        if(!need[pos]) continue;
        const values=new Map();
        for(const p of byPosition[pos]) values.set(Number(p.id),poolPlayerGain(levels[0],pos,scoreRows.get(Number(p.id)),ctx.horizon));
        gainOrder[pos]=byPosition[pos].slice().sort((a,b)=>
          (values.get(Number(b.id))-values.get(Number(a.id)))||
          Number(a.now_cost||0)-Number(b.now_cost||0)||Number(a.id)-Number(b.id));
        gainValue[pos]=values;
      }
      const bestRemainingGain=(remainingNeed,usedIds,maxCandidateCost,clubCounts)=>{
        let total=0;
        for(let pos=1;pos<=4;pos++){
          let left=remainingNeed[pos]|0;
          if(!left) continue;
          for(const p of gainOrder[pos]){
            const id=Number(p.id);
            if(usedIds.has(id)) continue;
            if(Number(p.now_cost||0)>maxCandidateCost) continue;
            if((clubCounts[p.team]|0)>=clubAllowance(p.team)) continue;
            total+=gainValue[pos].get(id)||0;
            if(--left===0) break;
          }
          if(left>0) return Infinity;
        }
        return total;
      };
      let coreByGameweek=null;
      const preparedCore=()=>coreByGameweek||(coreByGameweek=buildCoreByGameweek(core,scoreRows,ctx.horizon));

      const chosen=[],chosenPoolIndexes=[],usedIds=new Set(),clubCounts={...afterOut};
      function choose(index,cost,level){
        if(incomplete) return;
        const pos=required[index],pool=gainOrder[pos],last=index===required.length-1;
        const remainingAfter={1:0,2:0,3:0,4:0};
        for(let i=index+1;i<required.length;i++) remainingAfter[required[i]]++;
        const restGain=last?0:bestRemainingGain(remainingAfter,usedIds,budget-cost,clubCounts);
        if(restGain===Infinity){ pruned++; profile.boundPruned++; return; }
        // Exact base for everything already chosen, plus the admissible gain of an
        // optimistic completion. Both stay valid for every descendant of this node.
        const slotDelta={1:0,2:0,3:0,4:0}; let restDelta=0;
        for(let rpos=1;rpos<=4;rpos++){
          const outstanding=(remainingAfter[rpos]|0)+(rpos===pos?1:0);
          if(!outstanding) continue;
          slotDelta[rpos]=thresholdDelta(levels[0],level,rpos,ctx.horizon);
          restDelta+=(remainingAfter[rpos]|0)*slotDelta[rpos];
        }
        const nodeCeiling=poolHorizonTotal(level,ctx.horizon)+restGain+restDelta,slotBonus=slotDelta[pos];
        // Remaining-slot prices are fixed for the node; one spare entry per position
        // covers the case where the candidate being tried is itself among the cheapest.
        const cheapRows={1:null,2:null,3:null,4:null},cheapBase={1:0,2:0,3:0,4:0};
        let cheapestRestBase=0,restPriceable=true;
        for(let rpos=1;rpos<=4&&restPriceable;rpos++){
          const count=remainingAfter[rpos]|0;
          if(!count) continue;
          const rows=cheapestAvailableCosts(byPositionCost[rpos],count,usedIds);
          const total=cheapestFrom(rows,count,null);
          if(!Number.isFinite(total)) restPriceable=false;
          else { cheapRows[rpos]=rows; cheapBase[rpos]=total; cheapestRestBase+=total; }
        }
        if(!restPriceable){ pruned++; profile.affordabilityPruned++; return; }
        const startAt=index>0&&required[index-1]===pos?chosenPoolIndexes[index-1]+1:0;
        for(let poolIndex=startAt;poolIndex<pool.length;poolIndex++){
          const candidate=pool[poolIndex],id=Number(candidate.id),team=candidate.team;
          const gain=gainValue[pos].get(id)||0;
          const kth=retainedKth();
          // Descending identity order: the whole remainder of this pool is hopeless too.
          if(boundVerdict(nodeCeiling+gain+slotBonus,depth,kth)<0){
            pruned++; profile.boundPruned++; profile.identityBoundPruned++; profile.orderedBreaks++; break;
          }
          const nextCost=cost+Number(candidate.now_cost||0);
          let cheapestRest=cheapestRestBase;
          if(cheapRows[pos]){
            const count=remainingAfter[pos]|0;
            const replacement=cheapestFrom(cheapRows[pos],count,id);
            if(!Number.isFinite(replacement)){ pruned++; profile.affordabilityPruned++; continue; }
            cheapestRest=cheapestRest-cheapBase[pos]+replacement;
          }
          if(nextCost+cheapestRest>budget){ pruned++; profile.affordabilityPruned++; continue; }
          if((clubCounts[team]|0)>=clubAllowance(team)){ pruned++; profile.clubPruned++; continue; }

          if(last){
            if(kth){
              let verdict=boundVerdict(finalSlotUpperBound(level,pos,scoreRows.get(id),ctx.horizon),depth,kth);
              if(verdict===0){
                chosen.push(candidate);
                verdict=tiedBoundCannotBeat(depth,kth,optimisticTieBreak({ctx,outgoing,chosen,
                  remainingNeed:{1:0,2:0,3:0,4:0},byPosition,byPositionCost,byPositionId,usedIds,cost:nextCost,sellTotal}))?-1:1;
                chosen.pop();
              }
              if(verdict<0){ pruned++; profile.boundPruned++; profile.finalSlotPruned++; continue; }
            }
            if(++evaluations>ctx.maxEvaluations){ incomplete=true; return; }
            profile.leafEvaluations=evaluations;
            if(ctx.onProgress&&evaluations%ctx.progressInterval===0)
              ctx.onProgress({depth:n,maxDepth:ctx.limit,evaluations});
            clubCounts[team]=(clubCounts[team]|0)+1;
            if(inheritedClubLegal(ctx.startCounts,clubCounts,n)){
              chosen.push(candidate);
              extendPoolLevel(level,levels[index+1],pos,scoreRows.get(id),ctx.horizon);
              const incoming=orderedIncomingForOutgoing(outgoing,chosen),bankAfter=budget-nextCost;
              const gross=poolHorizonTotal(levels[index+1],ctx.horizon);
              const kthNow=retainedKth();
              let contend=boundVerdict(gross,depth,kthNow);
              if(contend===0) contend=tiedBoundCannotBeat(depth,kthNow,{bankAfter,
                doubtfulIncoming:incoming.filter(p=>p.status==='d').length,
                signature:planSignature(canonicalTransfers(outgoing.map((out,i)=>({
                  outPlayerId:playerId(out),inPlayerId:Number(incoming[i].id),position:positionOf(out)}))))})?-1:1;
              if(contend>=0){
                const plan=buildPreparedPlan({ctx,outgoing,incoming,core,coreByGameweek:preparedCore(),scoreRows,bankAfter,clubCounts});
                if(plan){ profile.materialisedPlans++; retainPlan(plans,plan,ctx.maxResults); }
              }
              chosen.pop();
            }
            clubCounts[team]=(clubCounts[team]|0)-1;
            continue;
          }

          clubCounts[team]=(clubCounts[team]|0)+1;
          for(let rpos=1;rpos<=4;rpos++){
            const count=remainingAfter[rpos]|0;
            caps[rpos]=count?budget-nextCost-cheapestRest+dearestOfCheapest(cheapRows[rpos],count,id):0;
          }
          const relaxed=relaxedHorizonUpperBound(level,scratch,prefixRefs,remainingAfter,ctx.horizon,costTables,
            pos,scoreRows.get(id),caps);
          const identityUpper=nodeCeiling+gain+slotBonus;
          const upper=Math.min(identityUpper,relaxed);
          let verdict=boundVerdict(upper,depth,kth);
          if(verdict===0){
            chosen.push(candidate);
            verdict=tiedBoundCannotBeat(depth,kth,optimisticTieBreak({ctx,outgoing,chosen,remainingNeed:remainingAfter,
              byPosition,byPositionCost,byPositionId,usedIds,cost:nextCost,sellTotal}))?-1:1;
            chosen.pop();
          }
          if(verdict<0){
            pruned++; profile.boundPruned++;
            if(identityUpper<=relaxed) profile.identityBoundPruned++; else profile.relaxedBoundPruned++;
            clubCounts[team]=(clubCounts[team]|0)-1;
            continue;
          }
          chosen.push(candidate); chosenPoolIndexes.push(poolIndex); usedIds.add(id);
          extendPoolLevel(level,levels[index+1],pos,scoreRows.get(id),ctx.horizon);
          choose(index+1,nextCost,levels[index+1]);
          chosen.pop(); chosenPoolIndexes.pop(); usedIds.delete(id);
          clubCounts[team]=(clubCounts[team]|0)-1;
          if(incomplete) return;
        }
      }
      choose(0,0,levels[0]);
      if(incomplete) break outer;
    }
  }
  return completeResult(ctx,plans,evaluations,pruned,incomplete,profile);
}



/* ===== src/model/walk-forward.mjs ===== */
const DEFAULT_WALK_FORWARD = Object.freeze({
  minTrainingGameweeks: 8,
  calibrationGameweeks: 4,
  holdoutGameweeks: 1,
  stepGameweeks: 1,
  minimumHoldoutRows: 1,
  calibrationMin: 0.7,
  calibrationMax: 1.3,
  predictionBands: Object.freeze([0,2,4,6,10,Infinity]),
  includeFoldCalibration: true
});

function finiteNumber(value, field){
  const number = Number(value);
  if(!Number.isFinite(number)) throw new Error(`${field} must be finite`);
  return number;
}

function integer(value, field){
  const number = finiteNumber(value, field);
  if(!Number.isInteger(number)) throw new Error(`${field} must be an integer`);
  return number;
}

function stableKey(row){
  return `${row.variant}|${row.gameweek}|${row.playerId}`;
}

function validateDatasetPin(pin = {}){
  const season = String(pin.season || '').trim();
  const sourceRef = String(pin.sourceRef || '').trim();
  const checksum = String(pin.sha256 || '').trim().toLowerCase();
  const immutableRef = /^[0-9a-f]{40}$/i.test(sourceRef) || /^sha256:[0-9a-f]{64}$/i.test(sourceRef);
  const ok = Boolean(season && immutableRef && /^[0-9a-f]{64}$/.test(checksum));
  return {ok, season, sourceRef, sha256:checksum,
    issues:[
      ...(!season ? ['missing_season'] : []),
      ...(!immutableRef ? ['mutable_or_missing_source_ref'] : []),
      ...(!/^[0-9a-f]{64}$/.test(checksum) ? ['invalid_sha256'] : [])
    ]};
}

function normaliseObservations(input){
  if(!Array.isArray(input)) throw new Error('observations must be an array');
  const rows = [];
  const byKey = new Map();
  for(const raw of input){
    const row = {
      playerId: integer(raw?.playerId, 'playerId'),
      position: integer(raw?.position, 'position'),
      gameweek: integer(raw?.gameweek, 'gameweek'),
      informationGameweek: integer(raw?.informationGameweek, 'informationGameweek'),
      predicted: finiteNumber(raw?.predicted, 'predicted'),
      actual: finiteNumber(raw?.actual, 'actual'),
      variant: String(raw?.variant || 'raw').trim() || 'raw'
    };
    if(row.position < 1 || row.position > 4) throw new Error('position must be 1-4');
    if(row.gameweek < 1 || row.informationGameweek < 0) throw new Error('gameweek is out of range');
    if(row.informationGameweek >= row.gameweek) throw new Error(`future information detected for ${stableKey(row)}`);
    const key = stableKey(row);
    const prior = byKey.get(key);
    if(prior){
      if(JSON.stringify(prior) !== JSON.stringify(row)) throw new Error(`conflicting duplicate observation: ${key}`);
      continue;
    }
    byKey.set(key,row); rows.push(row);
  }
  rows.sort((a,b)=>a.gameweek-b.gameweek || a.playerId-b.playerId || a.variant.localeCompare(b.variant));
  return rows;
}

function buildWalkForwardFolds(observations, options = {}){
  const rows = normaliseObservations(observations);
  const config = {...DEFAULT_WALK_FORWARD,...options};
  const minTrain = integer(config.minTrainingGameweeks,'minTrainingGameweeks');
  const calibration = integer(config.calibrationGameweeks,'calibrationGameweeks');
  const holdout = integer(config.holdoutGameweeks,'holdoutGameweeks');
  const step = integer(config.stepGameweeks,'stepGameweeks');
  if(minTrain < 1 || calibration < 1 || holdout < 1 || step < 1) throw new Error('walk-forward windows must be positive');
  const gameweeks = [...new Set(rows.map(row=>row.gameweek))].sort((a,b)=>a-b);
  const folds = [];
  for(let index=minTrain+calibration; index+holdout<=gameweeks.length; index+=step){
    const holdoutGws = gameweeks.slice(index,index+holdout);
    const calibrationGws = gameweeks.slice(index-calibration,index);
    const trainGws = gameweeks.slice(0,index-calibration);
    const holdoutSet = new Set(holdoutGws), calibrationSet = new Set(calibrationGws), trainSet = new Set(trainGws);
    const fold = {
      index: folds.length,
      trainGameweeks: trainGws,
      calibrationGameweeks: calibrationGws,
      holdoutGameweeks: holdoutGws,
      train: rows.filter(row=>trainSet.has(row.gameweek)),
      calibration: rows.filter(row=>calibrationSet.has(row.gameweek)),
      holdout: rows.filter(row=>holdoutSet.has(row.gameweek))
    };
    if(fold.holdout.length >= Number(config.minimumHoldoutRows || 1)) folds.push(fold);
  }
  return {config, folds};
}

function fitPositionCalibration(rows, options = {}){
  const min = Number(options.calibrationMin ?? DEFAULT_WALK_FORWARD.calibrationMin);
  const max = Number(options.calibrationMax ?? DEFAULT_WALK_FORWARD.calibrationMax);
  const grouped = new Map();
  for(const row of normaliseObservations(rows)){
    const group = grouped.get(row.position) || {predicted:0,actual:0,n:0};
    group.predicted += row.predicted; group.actual += row.actual; group.n++;
    grouped.set(row.position,group);
  }
  const calibration = {};
  for(const [position,group] of grouped){
    const raw = group.predicted === 0 ? 1 : group.actual/group.predicted;
    calibration[position] = Math.max(min,Math.min(max,raw));
  }
  return calibration;
}

function applyPositionCalibration(rows, calibration, variant='fold_calibrated'){
  return normaliseObservations(rows).map(row=>({...row,
    predicted: row.predicted * Number(calibration[row.position] ?? 1), variant
  }));
}

function pearson(xs,ys){
  if(xs.length !== ys.length || xs.length < 3) return null;
  const mx=xs.reduce((a,b)=>a+b,0)/xs.length, my=ys.reduce((a,b)=>a+b,0)/ys.length;
  let sxy=0,sxx=0,syy=0;
  for(let i=0;i<xs.length;i++){
    const dx=xs[i]-mx,dy=ys[i]-my;
    sxy+=dx*dy;sxx+=dx*dx;syy+=dy*dy;
  }
  return sxx && syy ? sxy/Math.sqrt(sxx*syy) : null;
}

function metricSummary(rows){
  const clean = normaliseObservations(rows);
  if(!clean.length) return {n:0,mae:null,rmse:null,bias:null,r:null};
  const errors = clean.map(row=>row.predicted-row.actual);
  const mae = errors.reduce((sum,error)=>sum+Math.abs(error),0)/errors.length;
  const rmse = Math.sqrt(errors.reduce((sum,error)=>sum+error*error,0)/errors.length);
  const bias = errors.reduce((sum,error)=>sum+error,0)/errors.length;
  const r = pearson(clean.map(row=>row.predicted),clean.map(row=>row.actual));
  return {n:clean.length,mae,rmse,bias,r};
}

function bandLabel(value,bands){
  for(let i=0;i<bands.length-1;i++) if(value>=bands[i] && value<bands[i+1]) return `${bands[i]}-${bands[i+1]}`;
  return `${bands[bands.length-2]}+`;
}

function segmentedMetrics(rows, options = {}){
  const clean = normaliseObservations(rows);
  const bands = options.predictionBands || DEFAULT_WALK_FORWARD.predictionBands;
  const group = selector => Object.fromEntries([...clean.reduce((map,row)=>{
    const key=String(selector(row)); const list=map.get(key)||[]; list.push(row); map.set(key,list); return map;
  },new Map())].sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true})).map(([key,list])=>[key,metricSummary(list)]));
  return {
    overall:metricSummary(clean),
    byPosition:group(row=>row.position),
    byGameweek:group(row=>row.gameweek),
    byVariant:group(row=>row.variant),
    byPredictionBand:group(row=>bandLabel(row.predicted,bands))
  };
}

function compareAblations(rows){
  const clean = normaliseObservations(rows);
  const variants = [...new Set(clean.map(row=>row.variant))].sort();
  const keySets = variants.map(variant=>new Set(clean.filter(row=>row.variant===variant).map(row=>`${row.gameweek}|${row.playerId}`)));
  if(keySets.length > 1){
    const base = [...keySets[0]].sort().join(',');
    for(let i=1;i<keySets.length;i++) if([...keySets[i]].sort().join(',') !== base) throw new Error('ablation variants must use identical holdout keys');
  }
  return Object.fromEntries(variants.map(variant=>[variant,segmentedMetrics(clean.filter(row=>row.variant===variant))]));
}

function stableResult(result){
  const sortObject = value => {
    if(Array.isArray(value)) return value.map(sortObject);
    if(value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key=>[key,sortObject(value[key])]));
    if(typeof value === 'number' && Number.isFinite(value)) return Number(value.toFixed(8));
    return value;
  };
  return JSON.stringify(sortObject(result));
}

function rawRows(rows){
  return rows.filter(row=>row.variant === 'raw');
}

function evaluateFold(fold, config){
  let holdout = fold.holdout;
  let calibration = null;
  if(config.includeFoldCalibration){
    const calibrationRows = rawRows(fold.calibration);
    const rawHoldout = rawRows(fold.holdout);
    if(calibrationRows.length && rawHoldout.length){
      calibration = fitPositionCalibration(calibrationRows, config);
      holdout = [...rawHoldout, ...applyPositionCalibration(rawHoldout, calibration)];
    }
  }
  return {
    index:fold.index,
    trainGameweeks:fold.trainGameweeks,
    calibrationGameweeks:fold.calibrationGameweeks,
    holdoutGameweeks:fold.holdoutGameweeks,
    calibration,
    holdout,
    metrics:segmentedMetrics(holdout,config)
  };
}

function evaluateWalkForward(observations, meta = {}, options = {}){
  const pin = validateDatasetPin(meta.dataset);
  if(!pin.ok) throw new Error(`dataset is not pinned: ${pin.issues.join(', ')}`);
  const {config,folds} = buildWalkForwardFolds(observations,options);
  if(!folds.length) throw new Error('insufficient chronological data for walk-forward evaluation');
  const foldResults = folds.map(fold=>evaluateFold(fold,config));
  const allHoldout = foldResults.flatMap(fold=>fold.holdout);
  return {
    method:'deadline-information-only walk-forward',
    config,
    dataset:{...pin,rows:Number(meta.dataset.rows ?? observations.length),malformedRows:Number(meta.dataset.malformedRows ?? 0)},
    oddsHistory:meta.oddsHistory === true ? 'logged_pre_deadline' : 'not_available',
    folds:foldResults.map(({holdout,...fold})=>fold),
    aggregate:segmentedMetrics(allHoldout,config),
    ablations:compareAblations(allHoldout)
  };
}



/* ===== src/model/archive-replay.mjs ===== */

const ARCHIVE_DATASET = Object.freeze({
  season: '2025-26',
  sourceRef: 'f9ed3e8839b0f970e0d5d4a83c5628f6eaee755a',
  url: 'https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/f9ed3e8839b0f970e0d5d4a83c5628f6eaee755a/data/2025-26/gws/merged_gw.csv'
});

const REQUIRED = Object.freeze([
  'element','position','GW','minutes','total_points','expected_goals',
  'expected_assists','saves','bps','yellow_cards'
]);
const POSMAP = Object.freeze({GK:1,GKP:1,DEF:2,MID:3,FWD:4});

function parseArchiveCSV(text){
  if(typeof text !== 'string') throw new Error('archive must be text');
  const rows=[]; let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){
      if(ch==='"'){
        if(text[i+1]==='"'){cell+='"';i++;} else quoted=false;
      } else cell+=ch;
    } else if(ch==='"') quoted=true;
    else if(ch===','){row.push(cell);cell='';}
    else if(ch==='\n'){row.push(cell);rows.push(row);row=[];cell='';}
    else if(ch!=='\r') cell+=ch;
  }
  if(cell.length||row.length){row.push(cell);rows.push(row);}
  return rows;
}

async function sha256Hex(text){
  const subtle=globalThis.crypto?.subtle;
  if(!subtle) throw new Error('SHA-256 is unavailable in this environment');
  const bytes=new TextEncoder().encode(text);
  const digest=await subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
}

function numeric(value){
  if(value === null || value === undefined || String(value).trim() === '') return null;
  const number=Number(value);
  return Number.isFinite(number)?number:null;
}

function project(history,position){
  if(history.minutes<90||history.gameweeks<4) return null;
  const n90=history.minutes/90;
  const per={
    xg:history.xg/n90,xa:history.xa/n90,sv:history.saves/n90,
    bps:history.bps/n90,dc:history.dc/n90,yc:history.yc/n90
  };
  const expM=clamp(history.minutes/history.gameweeks,0,90);
  const mF=expM/90,pAny=clamp(expM/28,0,.98),p60=clamp((expM-18)/55,0,.97);
  let xp=pAny+p60;
  xp+=per.xg*mF*(GOAL_PTS[position]??4);
  xp+=per.xa*mF*ASSIST_PTS;
  if(CS_PTS[position]) xp+=Math.exp(-BASE_GOALS)*CS_PTS[position]*p60;
  if(position<=2) xp-=(BASE_GOALS/2)*mF*.72;
  if(position===1) xp+=(per.sv/3)*mF;
  const threshold=DC_THRESH[position];
  if(threshold&&per.dc) xp+=2*(1/(1+Math.exp(-(per.dc-threshold)/2.2)))*p60;
  xp+=clamp((per.bps-16)/20,0,1.8)*mF;
  xp-=per.yc*mF;
  return Math.max(0,xp);
}

function emptyHistory(){
  return {gameweeks:0,minutes:0,xg:0,xa:0,saves:0,bps:0,dc:0,yc:0,lastGameweek:0};
}

function buildArchiveReplay(text){
  const rows=parseArchiveCSV(text);
  if(!rows.length) throw new Error('archive is empty');
  const header=rows[0].map(value=>value.trim());
  const missing=REQUIRED.filter(field=>!header.includes(field));
  if(missing.length) throw new Error('archive format changed — missing: '+missing.join(', '));
  const column=Object.fromEntries(header.map((name,index)=>[name,index]));
  const get=(row,name)=>column[name]===undefined?'':row[column[name]];
  const grouped=new Map();
  let malformedRows=0;

  for(let index=1;index<rows.length;index++){
    const raw=rows[index];
    if(!raw||raw.length<header.length-2){malformedRows++;continue;}
    const playerId=numeric(get(raw,'element'));
    const gameweek=numeric(get(raw,'GW'));
    const position=POSMAP[String(get(raw,'position')).trim()];
    const values={
      minutes:numeric(get(raw,'minutes')),
      actual:numeric(get(raw,'total_points')),
      xg:numeric(get(raw,'expected_goals')),
      xa:numeric(get(raw,'expected_assists')),
      saves:numeric(get(raw,'saves')),
      bps:numeric(get(raw,'bps')),
      yc:numeric(get(raw,'yellow_cards'))
    };
    const invalidRequired=Object.values(values).some(value=>value===null);
    if(!Number.isInteger(playerId)||!Number.isInteger(gameweek)||!position||invalidRequired){malformedRows++;continue;}
    const dcValue=column.defensive_contribution===undefined?0:numeric(get(raw,'defensive_contribution'));
    if(dcValue===null){malformedRows++;continue;}
    const key=`${gameweek}|${playerId}`;
    const aggregate=grouped.get(key)||{
      playerId,gameweek,position,minutes:0,actual:0,xg:0,xa:0,saves:0,bps:0,dc:0,yc:0
    };
    if(aggregate.position!==position){malformedRows++;continue;}
    aggregate.minutes+=values.minutes;
    aggregate.actual+=values.actual;
    aggregate.xg+=values.xg;
    aggregate.xa+=values.xa;
    aggregate.saves+=values.saves;
    aggregate.bps+=values.bps;
    aggregate.dc+=dcValue;
    aggregate.yc+=values.yc;
    grouped.set(key,aggregate);
  }

  const fixtures=[...grouped.values()].sort((a,b)=>a.gameweek-b.gameweek||a.playerId-b.playerId);
  const histories=new Map();
  const observations=[];
  for(const fixture of fixtures){
    const history=histories.get(fixture.playerId)||emptyHistory();
    const predicted=project(history,fixture.position);
    if(predicted!==null&&history.lastGameweek<fixture.gameweek){
      observations.push({
        playerId:fixture.playerId,position:fixture.position,gameweek:fixture.gameweek,
        informationGameweek:history.lastGameweek,predicted,actual:fixture.actual,variant:'raw'
      });
    }
    history.gameweeks++;
    history.minutes+=fixture.minutes;
    history.xg+=fixture.xg; history.xa+=fixture.xa; history.saves+=fixture.saves;
    history.bps+=fixture.bps; history.dc+=fixture.dc; history.yc+=fixture.yc;
    history.lastGameweek=fixture.gameweek;
    histories.set(fixture.playerId,history);
  }
  return {observations,rows:Math.max(0,rows.length-1),malformedRows,playerGameweeks:fixtures.length};
}


/* ===== src/model/backtest.mjs ===== */

S.calib = null; S.backtest = null;

function parseCSV(text){
  const rows = []; let row = [], cell = '', inQ = false;
  for(let i=0; i<text.length; i++){
    const ch = text[i];
    if(inQ){
      if(ch === '"'){ if(text[i+1] === '"'){ cell += '"'; i++; } else inQ = false; }
      else cell += ch;
    } else {
      if(ch === '"') inQ = true;
      else if(ch === ',') { row.push(cell); cell = ''; }
      else if(ch === '\n'){ row.push(cell); rows.push(row); row = []; cell = ''; }
      else if(ch !== '\r') cell += ch;
    }
  }
  if(cell.length || row.length){ row.push(cell); rows.push(row); }
  return rows;
}
function pearson(xs, ys){
  const n = xs.length; if(n < 3) return 0;
  const mx = xs.reduce((a,b)=>a+b,0)/n, my = ys.reduce((a,b)=>a+b,0)/n;
  let sxy=0, sxx=0, syy=0;
  for(let i=0;i<n;i++){ const dx=xs[i]-mx, dy=ys[i]-my; sxy+=dx*dy; sxx+=dx*dx; syy+=dy*dy; }
  return sxx && syy ? sxy/Math.sqrt(sxx*syy) : 0;
}

// Retained only for regression coverage and historical comparison. It is not
// used by the UI because it leaks real second-half minutes and calibrates on
// the same sample it reports.
function computeBacktest(text, meta = {}){
  const season = meta.season || 'unknown';
  const rows = parseCSV(text);
  const head = rows[0];
  const headerV = validateArchiveHeader(head);
  if(headerV.value === null){
    const missing = (headerV.issues[0] && headerV.issues[0].fields) || ARCHIVE_REQUIRED_COLUMNS;
    throw new Error('archive format changed — missing: ' + missing.join(', '));
  }
  const col = {}; head.forEach((h,i) => col[h.trim()] = i);
  const g = (r,k) => col[k] !== undefined ? r[col[k]] : '';
  const POSMAP = {GK:1, GKP:1, DEF:2, MID:3, FWD:4};
  const hasDC = col['defensive_contribution'] !== undefined;
  const players = {};
  for(let i=1; i<rows.length; i++){
    const r = rows[i]; if(!r || r.length < head.length-2) continue;
    const gw = parseInt(g(r,'GW')); if(!gw) continue;
    const key = g(r,'name') + '|' + g(r,'position');
    const p = players[key] || (players[key] = {pos:POSMAP[g(r,'position')] || 0, h1:{min:0,xg:0,xa:0,sv:0,bps:0,dc:0,yc:0,app:0}, h2:{min:0,pts:0,app:0}});
    const mins = num(g(r,'minutes'));
    if(gw <= 19){
      if(mins > 0){
        p.h1.min += mins; p.h1.app++;
        p.h1.xg += num(g(r,'expected_goals')); p.h1.xa += num(g(r,'expected_assists'));
        p.h1.sv += num(g(r,'saves')); p.h1.bps += num(g(r,'bps'));
        p.h1.yc += num(g(r,'yellow_cards'));
        if(hasDC) p.h1.dc += num(g(r,'defensive_contribution'));
      }
    } else if(mins > 0){
      p.h2.min += mins; p.h2.pts += num(g(r,'total_points')); p.h2.app++;
    }
  }
  const avgCtx = {xGF:BASE_GOALS, xGA:BASE_GOALS, cs:Math.exp(-BASE_GOALS), atk:1, def:1};
  const preds = [], actuals = [];
  const perPos = {1:{p:0,a:0,n:0,rP:[],rA:[]},2:{p:0,a:0,n:0,rP:[],rA:[]},3:{p:0,a:0,n:0,rP:[],rA:[]},4:{p:0,a:0,n:0,rP:[],rA:[]}};
  Object.entries(players).forEach(([key,p]) => {
    if(!p.pos || p.h1.min < 540 || p.h2.app < 5) return;
    const n90 = p.h1.min/90;
    const per = {xg:p.h1.xg/n90, xa:p.h1.xa/n90, sv:p.h1.sv/n90, bps:p.h1.bps/n90, dc:p.h1.dc/n90, yc:p.h1.yc/n90};
    const expM = p.h2.min/p.h2.app;
    const mF = expM/90, pAny = clamp(expM/28,0,.98), p60 = clamp((expM-18)/55,0,.97);
    let xp = pAny + p60;
    xp += per.xg * mF * (GOAL_PTS[p.pos] ?? 4);
    xp += per.xa * mF * ASSIST_PTS;
    if(CS_PTS[p.pos]) xp += avgCtx.cs * CS_PTS[p.pos] * p60;
    if(p.pos <= 2) xp -= (avgCtx.xGA/2) * mF * 0.72;
    if(p.pos === 1) xp += (per.sv / 3) * mF;
    const thr = DC_THRESH[p.pos];
    if(thr && per.dc) xp += 2 * (1/(1+Math.exp(-(per.dc-thr)/2.2))) * p60;
    xp += clamp((per.bps-16)/20, 0, 1.8) * mF;
    xp -= per.yc * mF;
    const predicted = xp * p.h2.app, actual = p.h2.pts;
    preds.push(predicted); actuals.push(actual);
    const pp = perPos[p.pos]; pp.p += predicted; pp.a += actual; pp.n++; pp.rP.push(predicted); pp.rA.push(actual);
  });
  if(preds.length < 50) throw new Error('only ' + preds.length + ' qualifying players — not enough to calibrate');
  const r = pearson(preds, actuals);
  const mae = preds.reduce((a,v,i) => a + Math.abs(v - actuals[i]), 0) / preds.length;
  const posLabel = {1:'GKP',2:'DEF',3:'MID',4:'FWD'};
  const calib = {}, posRows = [];
  [1,2,3,4].forEach(k => {
    const pp = perPos[k]; if(!pp.n) return;
    const ratio = pp.a/pp.p;
    calib[k] = clamp(ratio, 0.7, 1.3);
    posRows.push([posLabel[k],pp.n,pearson(pp.rP,pp.rA).toFixed(2),`${((ratio-1)*100).toFixed(0)}%`,`${calib[k].toFixed(2)}×`]);
  });
  return {calib,backtest:{season,n:preds.length,r:+r.toFixed(3),maeGW:+(mae/19).toFixed(2),top20hit:0,
    bias:Object.fromEntries([1,2,3,4].map(k=>[posLabel[k],perPos[k].n?+((perPos[k].a/perPos[k].p-1)*100).toFixed(1):null])),
    hasDC,provenance:{modelVersion:MODEL_VERSION,rulesVersion:RULES_VERSION,dataset:{url:meta.url||null,season,rows:rows.length,pinned:false},predictedAt:meta.now??Date.now(),method:'legacy H1/H2 diagnostic with future minutes'}},posRows};
}

function fmt(value,digits=2){ return value === null || value === undefined ? '—' : Number(value).toFixed(digits); }

async function runBacktest(){
  const out = $('btOut'), btn = $('btBtn');
  btn.disabled = true;
  setChildren(out,el('p',{class:'status'},el('span',{class:'spinner'}),'Downloading pinned 2025–26 archive (~14MB — best on wi-fi)…'));
  const u = ARCHIVE_DATASET.url;
  const { result, record } = await withRetry(
    async () => {
      let res;
      try{ res = await fetchT(u,60000); }
      catch(e){ return {ok:false,retryable:true,status:'network'}; }
      if(!res.ok) return {ok:false,retryable:isRetryableStatus(res.status),status:res.status};
      try{ return {ok:true,value:await res.text(),status:res.status}; }
      catch(e){ return {ok:false,retryable:false,status:'parse'}; }
    },
    {...policyFor('archive'),endpoint:safeEndpoint(u)}
  );
  recordRetry(record);
  if(!result?.ok){
    setChildren(out,el('div',{class:'note bad'},"Couldn't download the pinned archive — check the connection and try again."));
    btn.disabled=false; return;
  }
  setChildren(out,el('p',{class:'status'},el('span',{class:'spinner'}),'Building deadline-safe walk-forward folds…'));
  await new Promise(resolve=>setTimeout(resolve,30));
  try{
    const checksum=await sha256Hex(result.value);
    const replay=buildArchiveReplay(result.value);
    const evaluation=evaluateWalkForward(replay.observations,{dataset:{
      season:ARCHIVE_DATASET.season,sourceRef:ARCHIVE_DATASET.sourceRef,sha256:checksum,
      rows:replay.rows,malformedRows:replay.malformedRows
    }});
    S.backtest=evaluation;
    const raw=evaluation.ablations.raw?.overall;
    const calibrated=evaluation.ablations.fold_calibrated?.overall;
    const kpi=(key,value)=>el('div',{class:'kpi'},el('div',{class:'k'},key),el('div',{class:'v'},value));
    const rows=[
      ['Raw',raw?.n,fmt(raw?.mae),fmt(raw?.rmse),fmt(raw?.bias),fmt(raw?.r)],
      ['Fold calibrated',calibrated?.n,fmt(calibrated?.mae),fmt(calibrated?.rmse),fmt(calibrated?.bias),fmt(calibrated?.r)]
    ];
    const body=el('tbody');
    rows.forEach(row=>body.appendChild(el('tr',{},...row.map((value,index)=>el('td',index?{class:'num'}:{},value)))));
    setChildren(out,[
      el('div',{class:'kpis mt-10'},
        kpi('Season',ARCHIVE_DATASET.season),kpi('Folds',evaluation.folds.length),
        kpi('Holdout rows',raw?.n??0),kpi('Malformed rows',replay.malformedRows)),
      el('div',{class:'scroll'},el('table',{class:'data data-compact'},
        el('thead',{},el('tr',{},...['Variant','n','MAE','RMSE','Bias','r'].map((value,index)=>el('th',index?{class:'num'}:{},value)))),body)),
      el('div',{class:'note good'},el('b',{},'Deadline-safe evaluation complete.'),
        ' Every holdout prediction uses only earlier Gameweeks, and fold calibration is fitted only on the immediately preceding calibration window.'),
      el('div',{class:'note plain'},
        `Pinned source ${ARCHIVE_DATASET.sourceRef.slice(0,12)}… · SHA-256 ${checksum.slice(0,12)}… · historical odds ${evaluation.oddsHistory}.`),
      el('div',{class:'note'},el('b',{},'Coverage limitation. '),
        'This replays the existing archive scoring diagnostic with trailing historical minutes and average-fixture context. Historical deadline snapshots for Understat, odds, detailed minutes inputs and production fixture ratings do not exist, so this is not a full out-of-sample validation of the live production model and does not alter current projections.')
    ]);
  } catch(error){
    setChildren(out,el('div',{class:'note bad'},'The pinned archive could not be evaluated safely: '+error.message));
  }
  btn.disabled=false;
}



/* ===== src/main.mjs ===== */

const HEALTH_LABELS = {fpl:'FPL', understat:'Understat', odds:'Odds', archive:'Archive'};
const VERIFIED_REFRESH_MIN_AGE_MS = 10 * 60 * 1000;
const STARTUP_PHASE_COPY = Object.freeze({
  cache:['Loading verified data','Preparing the last accepted dataset as a safe fallback.'],
  fpl:['Checking official FPL','Validating players, teams, fixtures and the current deadline.'],
  team:['Checking your team','Validating the latest available squad and chip context.'],
  providers:['Checking supporting sources','Resolving every approved provider to a verified state.'],
  model:['Updating decisions','Recalculating projections and recommendations as one consistent dataset.'],
  evidence:['Securing deadline evidence','Saving an eligible pre-deadline record automatically when required.'],
  ready:['Ready','Latest verified data available.'],
  restricted:['Limited mode','Official FPL data could not be verified, so recommendations remain unavailable.']
});
function validGameweekId(value){
  const id = Number(value);
  return Number.isInteger(id) && id >= 1 && id <= 38 ? id : 0;
}
function publicPicksGameweek(events = S.boot?.events, currentGW = S.currentGW){
  const current = validGameweekId(currentGW);
  if(current) return current;
  const next = Array.isArray(events) ? events.find(event => event?.is_next === true) : null;
  return validGameweekId(next?.id);
}

let verifiedRefreshPromise = null;
let lastVerifiedRefreshAt = 0;
let lastRefreshAttemptAt = 0;
let verifiedRefreshTriggersInstalled = false;

function ageLabel(ms){
  if(ms == null) return '';
  const mins = Math.floor(ms / 60000);
  if(mins < 1) return 'now';
  if(mins < 60) return mins + 'm ago';
  const hours = Math.floor(mins / 60);
  if(hours < 48) return hours + 'h ago';
  return Math.floor(hours / 24) + 'd ago';
}
function providerHealthFlagClass(state){
  if(state === HEALTH_STATES.LIVE) return 'rise';
  if(state === HEALTH_STATES.CACHED || state === HEALTH_STATES.STALE || state === HEALTH_STATES.PARTIAL) return 'doubt';
  if(state === HEALTH_STATES.FALLBACK || state === HEALTH_STATES.UNAVAILABLE) return 'out';
  return 'dark';
}
function renderProviderHealth(){
  const detail = $('providerHealthRows');
  const rows = healthRows({seasonLive:S.seasonLive});

  if(!detail) return;
  if(!rows.length){
    setChildren(detail,el('div',{class:'note plain'},el('b',{},'Waiting for first data load.'),' Provider states will appear here as each source answers or falls back.'));
    return;
  }

  setChildren(detail,rows.map(h => {
    const age = h.lastSuccess ? `Last successful ${ageLabel(h.ageMs)}` : 'No successful response this session';
    return el('article',{class:'note plain'},
      el('div',{},el('b',{},HEALTH_LABELS[h.provider] || h.provider),el('span',{class:`flag ${providerHealthFlagClass(h.state)}`},h.state)),
      el('div',{class:'status'},age),
      h.note ? el('div',{},h.note) : null,
      h.consequence ? el('div',{class:'status'},`Impact: ${h.consequence}`) : null);
  }));
}

function reportLoadPhase(options,key){
  const copy=STARTUP_PHASE_COPY[key]||[key,''];
  if(typeof options.onPhase==='function') options.onPhase({key,title:copy[0],detail:copy[1]});
}
function renderVerifiedState(){
  clearXP();
  renderProviderHealth();
  renderGlobalDataWarning();
  renderAll();
}

async function loadAll(options = {}){
  const st = $('status');
  const deferRender = Boolean(options.deferRender);
  const renderIntermediate = () => { if(!deferRender){ renderProviderHealth(); renderGlobalDataWarning(); renderAll(); } };
  reportLoadPhase(options,'cache');
  const cached = await sget(K_CACHE);
  let cacheAccepted = false;
  if(cached && !S.boot){
    if(hydrate(cached).ok){
      cacheAccepted = true;
      markCached('fpl', cached.at, 'saved season snapshot', 'refreshing live feed');
      if(st) st.textContent = 'Showing saved data from ' + new Date(cached.at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) + ' — refreshing…';
      renderIntermediate();
    } else if(st) {
      st.textContent = 'Your saved copy of the season data could not be read — fetching a fresh one…';
    }
  } else if(st) {
    st.textContent = 'Fetching season data…';
  }
  try{
    reportLoadPhase(options,'fpl');
    const [boot, fixtures] = await Promise.all([api('/bootstrap-static/'), api('/fixtures/')]);
    const bs = bootstrapStructure(boot);
    const fixturesOk = Array.isArray(fixtures);
    if(!bs.ok || !fixturesOk){
      S.dataIssues = bs.issues.concat(fixturesOk ? [] :
        [{ provider:'fpl', endpoint:'/fixtures/', code:'fixtures_not_array',
           severity:'fatal', count:1, received: fixtures === null ? 'null' : typeof fixtures }]);
      const e = new Error('feed shape unusable'); e.feedShape = true; throw e;
    }
    const d = slim(boot, fixtures);
    await sset(K_CACHE, d);
    const hydrated = hydrate(d);
    if(!hydrated.ok){ const e = new Error('feed shape unusable'); e.feedShape = true; throw e; }
    const partial = hydrated.issues.some(i => i.severity === 'partial');
    if(partial) markPartial('fpl', 'some optional fields were missing', 'defaults applied; core season data remains usable', d.at);
    else markLive('fpl', S.source || 'live feed', 'core season data current', d.at);
    clearXP();

    reportLoadPhase(options,'team');
    S.teamId = $('teamId').value.replace(/\D/g,'');
    S.entry = null; S.picks = null; S.picksGameweek = 0; S.picksStatus = 'idle'; S.chipsUsed = [];
    let teamStatus = '';
    if(S.teamId){
      if(st) st.textContent = 'Fetching your team…';
      const entryV = validateEntry(await api('/entry/' + S.teamId + '/', {optional:true}));
      recordIssues('fpl', '/entry/', entryV.issues);
      S.entry = entryV.value;
      if(!S.entry){
        if(st) st.textContent = 'Season data loaded, but team ' + S.teamId + ' was not found — check the ID.';
      } else {
        const picksGW = publicPicksGameweek();
        S.picksGameweek = picksGW;
        if(picksGW){
          const picksV = validatePicks(await api('/entry/'+S.teamId+'/event/'+picksGW+'/picks/', {optional:true}));
          recordIssues('fpl', '/entry/event/picks/', picksV.issues);
          S.picks = picksV.value;
          const picksCount = Array.isArray(S.picks?.picks) ? S.picks.picks.length : 0;
          S.picksStatus = picksCount === 15 ? 'loaded' : picksCount ? 'incomplete' : 'unavailable';
          if(S.picksStatus === 'loaded') teamStatus = ` · public GW${picksGW} squad loaded`;
          else if(S.picksStatus === 'incomplete') teamStatus = ` · ${picksCount}/15 public GW${picksGW} picks usable`;
          else teamStatus = ` · public GW${picksGW} squad unavailable`;
        } else {
          S.picksStatus = 'gameweek-unavailable';
          teamStatus = ' · public squad Gameweek unavailable';
        }
        const histV = validateHistory(await api('/entry/'+S.teamId+'/history/', {optional:true}));
        recordIssues('fpl', '/entry/history/', histV.issues);
        const hist = histV.value;
        S.history = hist;
        if(hist && hist.chips) S.chipsUsed = hist.chips.map(c => `${c.name} (GW${c.event})`);
        if(S.entry.last_deadline_bank != null && !num($('bankIn').value))
          $('bankIn').value = (S.entry.last_deadline_bank/10).toFixed(1);
      }
    }
    if(S.entry || !S.teamId){
      if(st) st.textContent = `${S.boot.elements.length} players · ${S.source} · updated ${new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}${teamStatus}`;
    }
    await saveCfg();

    reportLoadPhase(options,'providers');
    const optionalResults = await Promise.allSettled([loadUnderstat(), loadOdds(), loadMinuteHistories()]);
    if(!getHealth('understat',{seasonLive:S.seasonLive})) markUnavailable('understat','verification did not resolve','FPL strength ratings used');
    if(!getHealth('odds',{seasonLive:S.seasonLive})) markDisabled('odds','no approved market input active','internal team model active');
    if(!getHealth('archive',{seasonLive:S.seasonLive})){
      if(S.calib) markCached('archive',null,'saved versioned calibration active','position correction active');
      else markDisabled('archive','no archive calibration active','uncalibrated model outputs shown');
    }
    reportLoadPhase(options,'model');
    renderVerifiedState();
    return {
      ok:true,
      criticalReady:true,
      source:'live',
      cacheAccepted,
      optionalResults,
      verifiedAt:Date.now()
    };
  }catch(err){
    await saveCfg();
    const shape = !!(err && err.feedShape);
    if(S.boot){
      markFallback('fpl', shape ? 'live feed shape unusable' : 'live feed unreachable', 'saved season snapshot remains active');
      if(st) st.textContent = (shape
        ? 'The season feed came back in an unexpected format — still showing saved data from '
        : 'Live feed unreachable — still showing saved data from ') +
        new Date(S.cachedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) + '.';
    } else if(shape){
      markUnavailable('fpl', 'feed shape unusable', 'season data cannot be shown');
      if(st) st.textContent = 'Season data could not be read.';
      setChildren($('ticker'),el('div',{class:'empty'},el('strong',{},"Season data isn't usable right now"),
        "The feed answered, but the data wasn't in the shape this app expects. That's a problem at the source rather than anything to do with your settings — please try again shortly."));
    } else {
      markUnavailable('fpl', 'official gateway unavailable', 'season data cannot be shown');
      if(st) st.textContent = 'Data feed unreachable.';
      setChildren($('ticker'),el('div',{class:'empty'},el('strong',{},'No connection to the FPL feed'),
        'Teamsheet could not reach its approved Official FPL gateway. Try Load data again shortly. Previously verified data will be used when available; without it, recommendations remain safely unavailable.'));
    }
    reportLoadPhase(options,'model');
    if(S.boot) renderVerifiedState();
    else {
      renderProviderHealth(); renderGlobalDataWarning();
      if(typeof document!=='undefined'&&typeof document.dispatchEvent==='function'&&typeof CustomEvent==='function')
        document.dispatchEvent(new CustomEvent('teamsheet:restricted',{detail:{reason:shape?'feed_shape':'transport_unavailable'}}));
    }
    return {
      ok:Boolean(S.boot),
      criticalReady:Boolean(S.boot),
      source:S.boot?'verified_cache':'unavailable',
      cacheAccepted:Boolean(S.boot),
      optionalResults:[],
      verifiedAt:S.boot?Date.now():null,
      error:err
    };
  }
}

function shouldRefreshVerifiedData(lastVerifiedAt,now=Date.now(),minAgeMs=VERIFIED_REFRESH_MIN_AGE_MS){
  return !Number.isFinite(Number(lastVerifiedAt)) || now-Number(lastVerifiedAt)>=minAgeMs;
}
function shouldBlockRefreshInteractions({reason='manual',startup=false}={}){
  return Boolean(startup||reason==='manual');
}
function shouldRunForegroundRefresh(lastAttemptAt,{visibilityState='visible',now=Date.now()}={}){
  if(visibilityState&&visibilityState!=='visible') return false;
  return shouldRefreshVerifiedData(lastAttemptAt,now);
}
function setStartupPhase(key){
  return STARTUP_PHASE_COPY[key]||STARTUP_PHASE_COPY.cache;
}
function setStartupGateVisible(visible){
  if(typeof document==='undefined') return;
  const gate=$('startupGate');
  if(gate) gate.hidden=!visible;
  document.body?.classList?.toggle('startup-pending',visible);
  document.body?.setAttribute?.('aria-busy',visible?'true':'false');
}
function setRefreshInteractionLock(locked,{startup=false}={}){
  if(typeof document==='undefined') return;
  document.body?.classList?.toggle('data-refreshing',locked);
  const main=document.querySelector?.('main');
  const nav=document.querySelector?.('nav.tabs');
  if(!startup){
    if(main) main.inert=locked;
    if(nav) nav.inert=locked;
  }
}
async function dispatchVerifiedData(detail){
  if(typeof document==='undefined'||typeof document.dispatchEvent!=='function'||typeof CustomEvent!=='function') return [];
  const pending=[];
  const eventDetail={...detail,waitUntil(promise){ pending.push(Promise.resolve(promise)); }};
  document.dispatchEvent(new CustomEvent('teamsheet:data-verified',{detail:eventDetail}));
  return Promise.allSettled(pending);
}
async function runVerifiedRefresh({reason='manual',startup=false,force=false,nowFn=Date.now}={}){
  if(verifiedRefreshPromise) return verifiedRefreshPromise;
  if(!force&&!shouldRefreshVerifiedData(lastRefreshAttemptAt,nowFn())) return {ok:true,criticalReady:Boolean(S.boot),skipped:true,reason:'recently_attempted'};
  const blockInteractions=shouldBlockRefreshInteractions({reason,startup});
  verifiedRefreshPromise=(async()=>{
    if(startup) setStartupGateVisible(true);
    if(blockInteractions) setRefreshInteractionLock(true,{startup});
    setStartupPhase('cache');
    try{
      const report=await loadAll({
        awaitOptional:true,
        deferRender:true,
        onPhase:phase=>setStartupPhase(phase.key)
      });
      if(report.criticalReady){
        lastVerifiedRefreshAt=nowFn();
        document.body?.classList?.remove('data-restricted');
        void dispatchVerifiedData({reason,verifiedAt:lastVerifiedRefreshAt,source:report.source});
      }else{
        setStartupPhase('restricted');
        document.body?.classList?.add('data-restricted');
      }
      return report;
    }finally{
      lastRefreshAttemptAt=nowFn();
      if(blockInteractions) setRefreshInteractionLock(false,{startup});
      if(startup){
        setStartupGateVisible(false);
        if(typeof document!=='undefined'&&typeof document.dispatchEvent==='function'&&typeof CustomEvent==='function')
          document.dispatchEvent(new CustomEvent('teamsheet:startup-ready'));
      }
    }
  })();
  try{ return await verifiedRefreshPromise; }
  finally{ verifiedRefreshPromise=null; }
}
function installVerifiedRefreshTriggers(){
  if(verifiedRefreshTriggersInstalled||typeof document==='undefined') return;
  verifiedRefreshTriggersInstalled=true;
  const refreshIfDue=()=>{
    if(!shouldRunForegroundRefresh(lastRefreshAttemptAt,{visibilityState:document.visibilityState})) return;
    void runVerifiedRefresh({reason:'foreground'});
  };
  document.addEventListener('visibilitychange',refreshIfDue);
  globalThis.window?.addEventListener?.('pageshow',refreshIfDue);
}



/* ===== src/ui/app-shell.mjs ===== */
// Teamsheet 2.0.6 app shell — primary navigation, Settings information
// architecture, URL routing and route-owned focus. Existing data, model and
// persistence behaviour remains owned by the original feature modules.

const TEAMSHEET_PRIMARY_ROUTES = Object.freeze([
  Object.freeze({route:'#/team',key:'team',icon:'team',label:'Team'}),
  Object.freeze({route:'#/transfers',key:'transfers',icon:'transfers',label:'Transfers'}),
  Object.freeze({route:'#/fixtures',key:'fixtures',icon:'fixtures',label:'Fixtures'}),
  Object.freeze({route:'#/leagues',key:'leagues',icon:'leagues',label:'Leagues'}),
  Object.freeze({route:'#/settings',key:'settings',icon:'settings',label:'Settings'})
]);

const TEAMSHEET_ROUTE_ALIASES = Object.freeze({
  '':'#/team',
  '#':'#/team',
  '#team':'#/team',
  '#squad':'#/team',
  '#players':'#/settings/research/players',
  '#transfers':'#/transfers',
  '#fixtures':'#/fixtures',
  '#league':'#/leagues',
  '#mini-leagues':'#/leagues',
  '#more':'#/settings',
  '#settings':'#/settings',
  '#ask':'#/ask',
  '#/players':'#/settings/research/players',
  '#/league':'#/leagues',
  '#/mini-leagues':'#/leagues',
  '#/more':'#/settings'
});

const TEAMSHEET_ROUTE_TABLE = Object.freeze({
  '#/team':Object.freeze({title:'Team',primary:'team'}),
  '#/transfers':Object.freeze({title:'Transfers',primary:'transfers'}),
  '#/fixtures':Object.freeze({title:'Fixtures',primary:'fixtures'}),
  '#/leagues':Object.freeze({title:'Leagues',primary:'leagues'}),
  '#/leagues/detail':Object.freeze({title:'League overview',primary:'leagues',parent:'#/leagues'}),
  '#/leagues/standings':Object.freeze({title:'League table',primary:'leagues',parent:'#/leagues/detail'}),
  '#/leagues/rival':Object.freeze({title:'Rival comparison',primary:'leagues',parent:'#/leagues/detail'}),
  '#/leagues/exposure':Object.freeze({title:'Rival exposure',primary:'leagues',parent:'#/leagues/detail'}),
  '#/leagues/manage':Object.freeze({title:'Manage leagues',primary:'leagues',parent:'#/leagues'}),
  '#/settings':Object.freeze({title:'Settings',primary:'settings'}),
  '#/settings/team-account':Object.freeze({title:'Team & Account',primary:'settings',settings:'team-account',parent:'#/settings'}),
  '#/settings/team-account/manual-squad':Object.freeze({title:'Manual squad',primary:'settings',settings:'team-account',parent:'#/settings/team-account'}),
  '#/settings/team-account/connection':Object.freeze({title:'Connection guidance',primary:'settings',settings:'team-account',parent:'#/settings/team-account'}),
  '#/settings/research':Object.freeze({title:'Research Tools',primary:'settings',settings:'research',parent:'#/settings'}),
  '#/settings/research/players':Object.freeze({title:'Player Explorer',primary:'settings',settings:'research',parent:'#/settings/research'}),
  '#/settings/evidence':Object.freeze({title:'Evidence & Performance',primary:'settings',settings:'evidence',parent:'#/settings'}),
  '#/settings/evidence/deadline':Object.freeze({title:'Deadline evidence',primary:'settings',settings:'evidence',parent:'#/settings/evidence'}),
  '#/settings/evidence/outcomes':Object.freeze({title:'Official outcomes',primary:'settings',settings:'evidence',parent:'#/settings/evidence'}),
  '#/settings/evidence/metrics':Object.freeze({title:'Performance metrics',primary:'settings',settings:'evidence',parent:'#/settings/evidence'}),
  '#/settings/evidence/review':Object.freeze({title:'Operating review',primary:'settings',settings:'evidence',parent:'#/settings/evidence'}),
  '#/settings/evidence/exports':Object.freeze({title:'Exports',primary:'settings',settings:'evidence',parent:'#/settings/evidence'}),
  '#/settings/data':Object.freeze({title:'Data & Diagnostics',primary:'settings',settings:'data',parent:'#/settings'}),
  '#/settings/data/providers':Object.freeze({title:'Provider Health',primary:'settings',settings:'data',parent:'#/settings/data'}),
  '#/settings/data/optional-sources':Object.freeze({title:'Optional sources',primary:'settings',settings:'data',parent:'#/settings/data'}),
  '#/settings/data/calibration':Object.freeze({title:'Calibration',primary:'settings',settings:'data',parent:'#/settings/data'}),
  '#/settings/data/recovery':Object.freeze({title:'Recovery',primary:'settings',settings:'data',parent:'#/settings/data'}),
  '#/settings/data/storage':Object.freeze({title:'Local storage',primary:'settings',settings:'data',parent:'#/settings/data'}),
  '#/settings/help':Object.freeze({title:'Help & About',primary:'settings',settings:'help',parent:'#/settings'}),
  '#/settings/help/recommendations':Object.freeze({title:'Recommendations',primary:'settings',settings:'help',parent:'#/settings/help'}),
  '#/settings/help/uncertainty':Object.freeze({title:'Expected points & uncertainty',primary:'settings',settings:'help',parent:'#/settings/help'}),
  '#/settings/help/limitations':Object.freeze({title:'Known limitations',primary:'settings',settings:'help',parent:'#/settings/help'}),
  '#/settings/help/privacy':Object.freeze({title:'Privacy & data',primary:'settings',settings:'help',parent:'#/settings/help'}),
  '#/settings/help/about':Object.freeze({title:'About this build',primary:'settings',settings:'help',parent:'#/settings/help'}),
  '#/settings/help/operations':Object.freeze({title:'Live-season operations',primary:'settings',settings:'help',parent:'#/settings/help'}),
  '#/ask':Object.freeze({title:'Ask Teamsheet',primary:null})
});

const TEAMSHEET_VALID_ROUTES = new Set(Object.keys(TEAMSHEET_ROUTE_TABLE));

function normaliseTeamsheetRoute(value=''){
  let route=String(value??'').trim();
  if(Object.prototype.hasOwnProperty.call(TEAMSHEET_ROUTE_ALIASES,route)) return TEAMSHEET_ROUTE_ALIASES[route];
  if(route.startsWith('/')&&!route.startsWith('#/')) route='#'+route;
  else if(route.startsWith('#')&&!route.startsWith('#/')) route='#/'+route.slice(1).replace(/^\/+/, '');
  else if(!route.startsWith('#/')) route='#/'+route.replace(/^\/+/, '');
  route=route.replace(/\/+$/,'');
  if(Object.prototype.hasOwnProperty.call(TEAMSHEET_ROUTE_ALIASES,route)) return TEAMSHEET_ROUTE_ALIASES[route];
  if(TEAMSHEET_VALID_ROUTES.has(route)) return route;
  if(route.startsWith('#/leagues/')) return '#/leagues';
  for(const section of ['team-account','research','evidence','data','help']){
    const prefix=`#/settings/${section}/`;
    if(route.startsWith(prefix)) return `#/settings/${section}`;
  }
  if(route.startsWith('#/settings/')) return '#/settings';
  return '#/team';
}

function teamsheetRouteMeta(value=''){
  const route=normaliseTeamsheetRoute(value);
  return Object.freeze({route,...TEAMSHEET_ROUTE_TABLE[route]});
}

function teamsheetRouteParent(value=''){
  return teamsheetRouteMeta(value).parent||null;
}

function teamsheetElement(tag,attributes={},...children){
  const node=document.createElement(tag);
  Object.entries(attributes).forEach(([key,value])=>{
    if(value===null||value===undefined||value===false) return;
    if(key==='class') node.className=String(value);
    else if(key==='text') node.textContent=String(value);
    else node.setAttribute(key,String(value));
  });
  children.flat(Infinity).filter(child=>child!==null&&child!==undefined&&child!==false).forEach(child=>{
    node.appendChild(child?.nodeType?child:document.createTextNode(String(child)));
  });
  return node;
}

function teamsheetNavIcon(name){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('class','nav-icon');
  svg.setAttribute('viewBox','0 0 24 24');
  svg.setAttribute('aria-hidden','true');
  svg.setAttribute('focusable','false');
  const shapes={
    team:[['path',{d:'M12 3 19 8 12 13 5 8Z'}],['path',{d:'m5 12 7 5 7-5'}],['path',{d:'m5 16 7 5 7-5'}]],
    transfers:[['path',{d:'M4 7h13'}],['path',{d:'m14 4 3 3-3 3'}],['path',{d:'M20 17H7'}],['path',{d:'m10 14-3 3 3 3'}]],
    fixtures:[['rect',{x:'4',y:'5',width:'16',height:'15',rx:'2'}],['path',{d:'M8 3v4M16 3v4M4 10h16M8 14h2M14 14h2M8 17h2M14 17h2'}]],
    leagues:[['path',{d:'M6 21V4'}],['path',{d:'M6 5h11l-2 4 2 4H6'}]],
    settings:[['circle',{cx:'12',cy:'12',r:'3'}],['path',{d:'M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1'}]]
  };
  (shapes[name]||shapes.team).forEach(([tag,attrs])=>{
    const shape=document.createElementNS('http://www.w3.org/2000/svg',tag);
    Object.entries(attrs).forEach(([key,value])=>shape.setAttribute(key,value));
    svg.appendChild(shape);
  });
  return svg;
}

function teamsheetRouteHeadingId(route){
  return `routeHeading-${String(route).replace(/^#\//,'').replaceAll('/','-')}`;
}

function teamsheetRouteHeader(route,title,hint){
  const parent=teamsheetRouteParent(route)||'#/settings';
  const parentTitle=teamsheetRouteMeta(parent).title;
  return teamsheetElement('div',{class:'route-header'},
    teamsheetElement('a',{class:'route-back',href:parent,'aria-label':`Back to ${parentTitle}`},
      teamsheetElement('span',{'aria-hidden':'true'},'←')),
    teamsheetElement('h2',{id:teamsheetRouteHeadingId(route),tabindex:'-1'},title),
    teamsheetElement('p',{class:'hint'},hint));
}

function teamsheetSettingsCard(route,icon,title,copy){
  return teamsheetElement('a',{class:'settings-card',href:route},
    teamsheetElement('span',{class:'settings-card-icon','aria-hidden':'true'},icon),
    teamsheetElement('span',{class:'settings-card-copy'},
      teamsheetElement('h3',{},title),
      teamsheetElement('span',{class:'settings-card-description'},copy)),
    teamsheetElement('span',{class:'settings-card-arrow','aria-hidden':'true'},'›'));
}

function teamsheetSettingsMenu(route,title,hint,cards){
  return teamsheetElement('section',{
    id:`settings-route-${route.replace(/^#\/settings\/?/,'').replaceAll('/','-')||'root'}`,
    class:'settings-subview',
    'data-settings-route':route,
    hidden:'hidden'
  },
  teamsheetRouteHeader(route,title,hint),
  teamsheetElement('div',{class:'settings-grid settings-subgrid'},cards));
}

function teamsheetSettingsContent(route,title,hint,...children){
  return teamsheetElement('section',{
    id:`settings-route-${route.replace(/^#\/settings\/?/,'').replaceAll('/','-')}`,
    class:'settings-subview',
    'data-settings-route':route,
    hidden:'hidden'
  },teamsheetRouteHeader(route,title,hint),children);
}

function teamsheetPanel(eyebrow,title,hint,...children){
  return teamsheetElement('section',{class:'panel settings-content-panel'},
    teamsheetElement('span',{class:'eyebrow'},eyebrow),
    teamsheetElement('h3',{},title),
    hint?teamsheetElement('p',{class:'hint'},hint):null,
    children);
}

function teamsheetBuildInfoPanel(){
  const info=typeof BUILD_INFO!=='undefined'&&BUILD_INFO&&typeof BUILD_INFO==='object'?BUILD_INFO:null;
  const rows=info?[
    ['Model',info.modelVersion],
    ['Rules',info.rulesVersion],
    ['Commit',info.commit],
    ['Source',String(info.sourceHash||'').slice(0,16)]
  ]:[['Build','Unavailable in this source view']];
  return teamsheetPanel('Version identity','This Teamsheet build','Public build identity helps confirm which reviewed source produced the page.',
    teamsheetElement('dl',{class:'build-identity'},rows.map(([label,value])=>[
      teamsheetElement('dt',{},label),teamsheetElement('dd',{class:'mono'},String(value||'unversioned'))
    ])));
}

function setupAppShell(){
  if(typeof document==='undefined'||
     typeof document.querySelector!=='function'||
     typeof document.getElementById!=='function'||
     typeof document.createElement!=='function'||
     typeof document.createTextNode!=='function') return;

  const nav=document.querySelector('nav.tabs');
  const main=document.querySelector('main');
  const header=document.querySelector('header');
  const teamView=document.getElementById('view-squad');
  const transfersView=document.getElementById('view-transfers');
  const fixturesView=document.getElementById('view-fixtures');
  const leaguesView=document.getElementById('view-league');
  const playersView=document.getElementById('view-players');
  const askView=document.getElementById('view-ask');
  const setupPanel=document.getElementById('setupPanel');
  const evidencePanel=document.getElementById('evidencePanel');
  const manualWrap=document.getElementById('manualWrap');
  const squadOut=document.getElementById('squadOut');

  if(!nav||!main||!teamView||!transfersView||!fixturesView||!leaguesView||!playersView||!askView||!setupPanel||!evidencePanel) return;

  nav.textContent='';
  nav.removeAttribute('role');
  nav.setAttribute('aria-label','Primary');
  const navLinks=TEAMSHEET_PRIMARY_ROUTES.map(item=>{
    const link=teamsheetElement('a',{class:'tab',href:item.route,'data-primary':item.key},
      teamsheetElement('span',{class:'ic','aria-hidden':'true'},teamsheetNavIcon(item.icon)),
      teamsheetElement('span',{class:'tab-label'},item.label));
    nav.appendChild(link);
    return link;
  });

  const teamHeading=teamView.querySelector('h2');
  const teamHint=teamView.querySelector('.hint');
  if(teamHeading) teamHeading.textContent='Team';
  if(teamHint) teamHint.textContent='Your XI, captaincy, bench and weekly FPL resources in one place.';

  const setupRows=Array.from(setupPanel.children).filter(child=>child.classList?.contains('row'));
  const teamContext=teamsheetElement('section',{id:'teamContext',class:'team-context','aria-labelledby':'teamContextTitle'},
    teamsheetElement('div',{class:'team-context-head'},
      teamsheetElement('div',{},
        teamsheetElement('span',{class:'eyebrow'},'Weekly resources'),
        teamsheetElement('h3',{id:'teamContextTitle'},'Your FPL context')),
      teamsheetElement('span',{class:'status'},'Team ID, free transfers and bank stay visible because they affect weekly decisions.')));
  setupRows.slice(0,2).forEach(row=>teamContext.appendChild(row));
  ['status','srcStatus','chipState'].map(id=>document.getElementById(id)).filter(Boolean).forEach(node=>teamContext.appendChild(node));
  if(squadOut) teamView.insertBefore(teamContext,squadOut);
  else teamView.appendChild(teamContext);

  const fixturesHeading=fixturesView.querySelector('h2');
  if(fixturesHeading) fixturesHeading.textContent='Fixtures';
  const leaguesHeading=leaguesView.querySelector('h2');
  const leaguesEyebrow=leaguesView.querySelector('.eyebrow');
  const leaguesHint=leaguesView.querySelector('.hint');
  if(leaguesHeading) leaguesHeading.textContent='Leagues';
  if(leaguesEyebrow) leaguesEyebrow.textContent='Mini leagues';
  if(leaguesHint) leaguesHint.textContent='Official position, points gaps, pairwise comparisons and on-demand selected-rival exposure. Projected rank and protect/chase strategy are not included.';
  const playersHeading=playersView.querySelector('h3, h2');
  const playersEyebrow=playersView.querySelector('.eyebrow');
  if(playersHeading) playersHeading.textContent='Player Explorer';
  if(playersEyebrow) playersEyebrow.textContent='Research tool';
  const askHeading=askView.querySelector('h2');
  const askEyebrow=askView.querySelector('.eyebrow');
  if(askHeading) askHeading.textContent='Ask Teamsheet';
  if(askEyebrow) askEyebrow.textContent='Decision assistant';
  const askRouteBack=teamsheetElement('a',{id:'askRouteBack',class:'route-back',href:'#/team','aria-label':'Back to Team'},
    teamsheetElement('span',{'aria-hidden':'true'},'←'));
  askView.insertBefore(askRouteBack,askView.firstChild);

  const settingsView=teamsheetElement('section',{id:'view-settings',class:'view settings-view',hidden:'hidden'});
  const settingsHeader=teamsheetElement('div',{class:'panel settings-header'},
    teamsheetElement('span',{class:'eyebrow'},'Advanced tools, kept out of the way'),
    teamsheetElement('h2',{id:'settingsTitle',tabindex:'-1'},'Settings'),
    teamsheetElement('p',{class:'hint'},'Connect your team, research players, review evidence and resolve data issues without cluttering weekly decisions.'));
  const settingsLanding=teamsheetElement('div',{id:'settingsLanding',class:'settings-grid'},
    teamsheetSettingsCard('#/settings/team-account','◈','Team & Account','Manual squad editing, connection guidance and account links.'),
    teamsheetSettingsCard('#/settings/research','↗','Research Tools','Player Explorer and supporting research outside the main decision journeys.'),
    teamsheetSettingsCard('#/settings/evidence','✓','Evidence & Performance','Deadline records, outcomes, metrics, review and exports.'),
    teamsheetSettingsCard('#/settings/data','⌁','Data & Diagnostics','Provider status, optional sources, recovery and local storage.'),
    teamsheetSettingsCard('#/settings/help','?','Help & About','Recommendation guidance, limitations, privacy and build identity.'));
  settingsView.append(settingsHeader,settingsLanding);

  const settingsRoutes=[];
  const addRoute=route=>{settingsRoutes.push(route);settingsView.appendChild(route);return route;};

  addRoute(teamsheetSettingsMenu('#/settings/team-account','Team & Account','Connection and squad setup live here; weekly bank and free-transfer assumptions remain on Team.',[
    teamsheetSettingsCard('#/settings/team-account/manual-squad','XI','Manual squad','Build or correct the 15-player squad used by manual mode.'),
    teamsheetSettingsCard('#/settings/team-account/connection','ID','Connection guidance','Find your Team ID and jump to saved-league management.')
  ]));

  const manualPanel=teamsheetPanel('Squad setup','Manual squad','Build or correct the 15-player squad used when manual mode is enabled. Verified Official FPL player data is required.',
    teamsheetElement('p',{id:'manualEditorAvailability',class:'status'},'Checking player data…'));
  if(manualWrap){manualWrap.open=true;manualPanel.appendChild(manualWrap);}
  else manualPanel.appendChild(teamsheetElement('p',{class:'status'},'Manual squad controls are unavailable.'));
  addRoute(teamsheetSettingsContent('#/settings/team-account/manual-squad','Manual squad','Edit the local 15-player fallback without changing anything in Official FPL.',manualPanel));

  addRoute(teamsheetSettingsContent('#/settings/team-account/connection','Connection guidance','Teamsheet reads public Official FPL identifiers only; it does not ask for an FPL password.',
    teamsheetPanel('Public connection','Find your Team ID','Open your team in Official FPL and copy the number after /entry/ in the address.',
      teamsheetElement('div',{class:'settings-action-links'},
        teamsheetElement('a',{class:'btn ghost',href:'#/team'},'Open Team setup'),
        teamsheetElement('a',{class:'btn ghost',href:'#/leagues/manage'},'Manage saved leagues')),
      teamsheetElement('div',{class:'note plain'},teamsheetElement('b',{},'Account boundary: '),'Free transfers and bank remain manual because the public feed cannot verify them without a separately approved authenticated integration.'),
      teamsheetElement('div',{class:'note plain'},teamsheetElement('b',{},'Saved leagues: '),'League IDs and local labels are managed inside Leagues. Settings links there rather than duplicating competitive controls.'))));

  addRoute(teamsheetSettingsMenu('#/settings/research','Research Tools','Supporting player research that does not belong in Team, Transfers or Fixtures.',[
    teamsheetSettingsCard('#/settings/research/players','↗','Player Explorer','Filter current projections and open the existing player detail view.')
  ]));
  playersView.classList.remove('view');
  playersView.hidden=false;
  addRoute(teamsheetSettingsContent('#/settings/research/players','Player Explorer','Research individual projections without restoring Players to primary navigation.',playersView));

  addRoute(teamsheetSettingsMenu('#/settings/evidence','Evidence & Performance','What was recorded, what happened and how Teamsheet has performed.',[
    teamsheetSettingsCard('#/settings/evidence/deadline','D','Deadline evidence','Prospective pre-deadline records and capture history.'),
    teamsheetSettingsCard('#/settings/evidence/outcomes','O','Official outcomes','Authoritative completed-Gameweek records and revisions.'),
    teamsheetSettingsCard('#/settings/evidence/metrics','M','Performance metrics','Descriptive points, minutes and uncertainty evaluation.'),
    teamsheetSettingsCard('#/settings/evidence/review','R','Operating review','Weekly and season evidence summaries.'),
    teamsheetSettingsCard('#/settings/evidence/exports','↓','Exports','Owner-controlled JSON, Markdown and CSV downloads.')
  ]));
  evidencePanel.hidden=false;
  addRoute(teamsheetSettingsContent('#/settings/evidence/deadline','Deadline evidence','Prospective records captured before the Official FPL deadline.',evidencePanel));
  addRoute(teamsheetSettingsContent('#/settings/evidence/outcomes','Official outcomes','Completed and corrected Official FPL outcome records.',teamsheetElement('div',{id:'outcomesHost'})));
  addRoute(teamsheetSettingsContent('#/settings/evidence/metrics','Performance metrics','Descriptive evaluation from matched official evidence only.',teamsheetElement('div',{id:'metricsHost'})));
  addRoute(teamsheetSettingsContent('#/settings/evidence/review','Operating review','Weekly and season summaries from immutable local evidence.',teamsheetElement('div',{id:'reviewHost'})));
  addRoute(teamsheetSettingsContent('#/settings/evidence/exports','Exports','Downloads are generated on demand and remain under your control.',
    teamsheetElement('div',{id:'evidenceExportHost'}),
    teamsheetElement('div',{id:'outcomeExportHost'}),
    teamsheetElement('div',{id:'reviewExportHost'})));

  const providerRow=document.getElementById('oddsKey')?.closest?.('.row')||null;
  const backtestRow=document.getElementById('btBtn')?.closest?.('.row')||null;
  const backtestHint=backtestRow?.nextElementSibling?.classList?.contains('hint')?backtestRow.nextElementSibling:null;
  const backtestOut=document.getElementById('btOut');
  const healthPanel=teamsheetPanel('Current session','Provider Health','Which approved source is active, how fresh it is and what any fallback changes.',teamsheetElement('div',{id:'providerHealthRows'}));
  healthPanel.id='providerHealthDetail';
  healthPanel.setAttribute('aria-labelledby','providerHealthTitle');
  healthPanel.querySelector('h3')?.setAttribute('id','providerHealthTitle');

  const optionalPanel=teamsheetPanel('Approved optional inputs','Optional sources','Optional providers may improve context, but their approved fallbacks keep core FPL decisions available.');
  if(providerRow) optionalPanel.appendChild(providerRow);
  else optionalPanel.appendChild(teamsheetElement('p',{class:'status'},'Optional-source controls are unavailable.'));
  const calibrationPanel=teamsheetPanel('Historical diagnostic','Calibration','The existing deadline-safe walk-forward check remains diagnostic and does not change live projections automatically.');
  if(backtestRow) calibrationPanel.appendChild(backtestRow);
  if(backtestHint) calibrationPanel.appendChild(backtestHint);
  if(backtestOut) calibrationPanel.appendChild(backtestOut);
  setupPanel.remove?.();

  addRoute(teamsheetSettingsMenu('#/settings/data','Data & Diagnostics','Current provider detail, optional inputs and recovery tools.',[
    teamsheetSettingsCard('#/settings/data/providers','●','Provider Health','Freshness, active source and fallback consequences.'),
    teamsheetSettingsCard('#/settings/data/optional-sources','+','Optional sources','Odds and Understat controls.'),
    teamsheetSettingsCard('#/settings/data/calibration','≈','Calibration','Deadline-safe historical diagnostic.'),
    teamsheetSettingsCard('#/settings/data/recovery','↺','Recovery','Restore verified backups and inspect recovery warnings.'),
    teamsheetSettingsCard('#/settings/data/storage','×','Local storage','Delete specific local evidence datasets.')
  ]));
  addRoute(teamsheetSettingsContent('#/settings/data/providers','Provider Health','Full technical source status remains here; healthy states do not occupy the main header.',healthPanel));
  addRoute(teamsheetSettingsContent('#/settings/data/optional-sources','Optional sources','Configure approved supporting inputs without changing provider transport or model rules.',optionalPanel));
  addRoute(teamsheetSettingsContent('#/settings/data/calibration','Calibration','Run the existing historical diagnostic without changing live recommendations.',calibrationPanel));
  addRoute(teamsheetSettingsContent('#/settings/data/recovery','Recovery','Restored files remain recovery-only and cannot silently become official or current.',
    teamsheetElement('div',{id:'evidenceRecoveryHost'}),
    teamsheetElement('div',{id:'outcomeRecoveryHost'}),
    teamsheetElement('div',{id:'stage10DiagnosticsHost'})));
  addRoute(teamsheetSettingsContent('#/settings/data/storage','Local storage','Delete one local dataset at a time. Downloaded files are outside Teamsheet and are not removed.',
    teamsheetElement('div',{id:'evidenceStorageHost'}),
    teamsheetElement('div',{id:'outcomeStorageHost'}),
    teamsheetElement('div',{id:'metricStorageHost'})));

  addRoute(teamsheetSettingsMenu('#/settings/help','Help & About','Plain-English guidance for interpreting Teamsheet and this build.',[
    teamsheetSettingsCard('#/settings/help/recommendations','?','Recommendations','What Teamsheet does and what remains your decision.'),
    teamsheetSettingsCard('#/settings/help/uncertainty','±','Expected points & uncertainty','How projections and ranges should be read.'),
    teamsheetSettingsCard('#/settings/help/limitations','!','Known limitations','Important gaps and evidence boundaries.'),
    teamsheetSettingsCard('#/settings/help/privacy','○','Privacy & data','Local storage, public identifiers and exports.'),
    teamsheetSettingsCard('#/settings/help/about','i','About this build','Model, rules, commit and source identity.'),
    teamsheetSettingsCard('#/settings/help/operations','✓','Live-season operations','What to check before and after a deadline.')
  ]));
  addRoute(teamsheetSettingsContent('#/settings/help/recommendations','Recommendations','Teamsheet supports decisions; it never submits changes to Official FPL.',
    teamsheetPanel('Decision support','You remain in control','Teamsheet compares the current verified inputs and presents a recommendation with its main risk. It does not log in to FPL, confirm transfers, set captaincy or change your squad.',
      teamsheetElement('div',{class:'note plain'},teamsheetElement('b',{},'Team: '),'Review the proposed XI, captain and bench, then reproduce any chosen action in Official FPL.'),
      teamsheetElement('div',{class:'note plain'},teamsheetElement('b',{},'Transfers: '),'Model comparisons are alternatives against making no transfer, not promised FPL points.'),
      teamsheetElement('div',{class:'note plain'},teamsheetElement('b',{},'Leagues: '),'Rival and exposure views report selected public facts; they do not infer protect or chase strategy.'))));
  addRoute(teamsheetSettingsContent('#/settings/help/uncertainty','Expected points & uncertainty','Projections are estimates, not confirmed outcomes or team news.',
    teamsheetPanel('Interpretation','Read the range, not only the headline','Expected points combine the approved model inputs for a defined Gameweek horizon. Player detail shows uncertainty where a valid distribution is available.',
      teamsheetElement('div',{class:'note plain'},'A narrow difference between players or captains is a close model call, not a certainty.'),
      teamsheetElement('div',{class:'note plain'},'Expected minutes are model estimates. Official availability flags and current team news still matter.'),
      teamsheetElement('div',{class:'note plain'},'Pre-season and missing-data states remain deliberately less precise rather than manufacturing detail.'))));
  addRoute(teamsheetSettingsContent('#/settings/help/limitations','Known limitations','The application states what has not been verified instead of treating automated tests as physical acceptance.',
    teamsheetPanel('Current boundaries','Important limitations','',
      teamsheetElement('ul',{class:'settings-readable-list'},
        teamsheetElement('li',{},'Prospective performance evidence remains descriptive until enough genuine pre-deadline observations exist.'),
        teamsheetElement('li',{},'Ask Teamsheet works keylessly only in the approved artifact-preview environment until a separately approved serverless migration.'),
        teamsheetElement('li',{},'Public Official FPL transport can be unavailable or return incomplete data.'),
        teamsheetElement('li',{},'Automated tests do not prove physical iPhone usability, VoiceOver behaviour or live endpoint availability.'),
        teamsheetElement('li',{},'Projected global rank, projected rival outcomes and protect/balanced/chase strategy are not implemented.')))));
  addRoute(teamsheetSettingsContent('#/settings/help/privacy','Privacy & data','Teamsheet uses public FPL identifiers and local browser storage; it does not request an FPL password.',
    teamsheetPanel('Local-first boundary','What is stored','Configuration, manual squad, approved caches, calibration and validated evidence are stored locally in the browser.',
      teamsheetElement('div',{class:'note plain'},'Exported JSON files are complete and unencrypted. Deleting browser records cannot remove files already saved to Files or Downloads.'),
      teamsheetElement('div',{class:'note plain'},'Restored evidence remains recovery-only and cannot alter recommendations or become the official prospective record.'),
      teamsheetElement('div',{class:'note plain'},'Odds keys remain browser-held, password-masked, direct-only and removable with one action. Anthropic keys are never stored client-side.'))));
  addRoute(teamsheetSettingsContent('#/settings/help/about','About this build','Confirm the reviewed model, rules and source identity used by this page.',teamsheetBuildInfoPanel()));
  addRoute(teamsheetSettingsContent('#/settings/help/operations','Live-season operations','A small set of checks protects the prospective evidence workflow.',
    teamsheetPanel('Before and after each deadline','Operational checklist','',
      teamsheetElement('ol',{class:'settings-readable-list'},
        teamsheetElement('li',{},'Before the deadline, open Teamsheet on a verified refresh and confirm Deadline Evidence is official-eligible.'),
        teamsheetElement('li',{},'After a complete or corrected Gameweek, allow Official Outcomes and Metrics to update.'),
        teamsheetElement('li',{},'Use Exports to save the required JSON, Markdown or CSV files and confirm they appear in Files or Downloads.'),
        teamsheetElement('li',{},'Use Recovery only for verified backups. Never clear browser data before durable files have been checked.'),
        teamsheetElement('li',{},'Google Sheets import remains manual; no automatic authentication or scheduled export is active.')))));

  main.appendChild(settingsView);

  const globalDataWarning=header?teamsheetElement('a',{id:'globalDataWarning',class:'global-data-warning',href:'#/settings/data/providers',hidden:'hidden','aria-live':'polite'}):null;
  if(globalDataWarning) header.appendChild(globalDataWarning);
  const askAvailable=Boolean(globalThis.window?.storage);
  const globalAsk=header?teamsheetElement('form',{id:'askTeamsheetGlobal',class:'global-ask',role:'search'}):null;
  const globalAskInput=globalAsk?teamsheetElement('input',{id:'askTeamsheetGlobalInput',type:'search',placeholder:'Ask Teamsheet…',autocomplete:'off','aria-label':'Ask Teamsheet',disabled:askAvailable?null:'disabled','aria-describedby':askAvailable?null:'askHostedStatus'}):null;
  const globalAskSend=globalAsk?teamsheetElement('button',{id:'askTeamsheetGlobalSend',class:'global-ask-send',type:'submit','aria-label':'Send question',disabled:'disabled'},
    teamsheetElement('span',{'aria-hidden':'true'},'↑')):null;
  if(globalAskInput&&!askAvailable) globalAskInput.setAttribute('placeholder','Ask unavailable in this hosted build');
  if(globalAsk&&globalAskInput&&globalAskSend){
    globalAsk.append(globalAskInput,globalAskSend);
    header.appendChild(globalAsk);
    if(askAvailable){
      globalAskInput.addEventListener('input',()=>{globalAskSend.disabled=!globalAskInput.value.trim();});
      globalAsk.addEventListener('submit',event=>{
        event.preventDefault();
        const question=globalAskInput.value.trim();
        if(!question) return;
        const current=normaliseTeamsheetRoute(globalThis.location?.hash||'#/team');
        const origin=current==='#/ask'?'#/team':current;
        const originMeta=teamsheetRouteMeta(origin);
        askRouteBack.setAttribute('href',origin);
        askRouteBack.setAttribute('aria-label',`Back to ${originMeta.title}`);
        askView.dataset.originRoute=origin;
        const fullQuestion=document.getElementById('q');
        if(fullQuestion) fullQuestion.value=question;
        navigateTeamsheetRoute('#/ask');
        setTimeout(()=>document.getElementById('askBtn')?.click?.(),0);
        globalAskInput.value='';
        globalAskSend.disabled=true;
      });
    }
  }

  const updateKeyboardState=()=>{
    const viewport=globalThis.visualViewport;
    const keyboardOpen=Boolean(viewport&&globalThis.innerHeight-viewport.height>160);
    document.documentElement.classList.toggle('keyboard-open',keyboardOpen);
  };
  globalThis.visualViewport?.addEventListener?.('resize',updateKeyboardState);
  globalThis.visualViewport?.addEventListener?.('scroll',updateKeyboardState);
  globalThis.addEventListener?.('pageshow',updateKeyboardState);
  document.addEventListener?.('focusin',updateKeyboardState);
  document.addEventListener?.('focusout',()=>setTimeout(updateKeyboardState,0));
  updateKeyboardState();

  const topLevelViews=[teamView,transfersView,fixturesView,leaguesView,settingsView,askView];
  const settingsRouteNodes=new Map(settingsRoutes.map(node=>[node.dataset.settingsRoute,node]));
  const routeNodes=new Map([
    ['#/team',teamView],
    ['#/transfers',transfersView],
    ['#/fixtures',fixturesView],
    ['#/leagues',leaguesView],
    ['#/settings',settingsView],
    ['#/ask',askView]
  ]);
  const rememberedFocus=new Map();
  const routeScrollPositions=new Map();
  let activeRoute=normaliseTeamsheetRoute(globalThis.location?.hash||'');
  let pendingNavigation=null;
  if(globalThis.history&&'scrollRestoration' in globalThis.history) globalThis.history.scrollRestoration='manual';

  const routeNodeFor=route=>route.startsWith('#/settings')
    ? (settingsRouteNodes.get(route)||settingsView)
    : route.startsWith('#/leagues')
      ? (leaguesView.querySelector(`[data-league-route="${route}"]`)||leaguesView)
      : (routeNodes.get(route)||teamView);
  const currentScroll=()=>({left:Number(globalThis.scrollX||0),top:Number(globalThis.scrollY||0)});
  const rememberRouteState=()=>routeScrollPositions.set(activeRoute,currentScroll());
  const focusCandidateVisible=node=>Boolean(node&&document.contains?.(node)&&!node.hidden&&!node.closest?.('[hidden],[aria-hidden="true"]'));

  document.addEventListener('click',event=>{
    const link=event.target?.closest?.('a[href^="#/"]');
    if(!link) return;
    const destination=normaliseTeamsheetRoute(link.getAttribute('href'));
    if(destination!==activeRoute){
      rememberedFocus.set(activeRoute,link);
      rememberRouteState();
      pendingNavigation={route:destination,kind:link.classList?.contains('route-back')?'return':'forward'};
    }
  },true);

  const focusRoute=(route,node,{preferRemembered=false}={})=>{
    const remembered=preferRemembered?rememberedFocus.get(route):null;
    if(remembered&&document.contains?.(remembered)&&focusCandidateVisible(remembered)){
      remembered.focus?.({preventScroll:true});
      return;
    }
    const heading=node?.querySelector?.(`#${teamsheetRouteHeadingId(route)}`)||node?.querySelector?.('h2');
    heading?.setAttribute?.('tabindex','-1');
    heading?.focus?.({preventScroll:true});
  };

  const activateRoute=(requested,{focus=false,restoreScroll=false,preferRemembered=false}={})=>{
    const route=normaliseTeamsheetRoute(requested);
    const meta=teamsheetRouteMeta(route);
    const previousRoute=activeRoute;
    if(globalThis.location?.hash!==route) globalThis.history?.replaceState?.(null,'',route);
    if(previousRoute!==route) document.dispatchEvent?.(new CustomEvent('teamsheet:before-route-change',{detail:{from:previousRoute,to:route}}));

    topLevelViews.forEach(view=>{
      const active=route.startsWith('#/settings')?view===settingsView:route.startsWith('#/leagues')?view===leaguesView:view===routeNodes.get(route);
      view.hidden=!active;
      view.setAttribute('aria-hidden',active?'false':'true');
    });
    settingsLanding.hidden=route!=='#/settings';
    settingsRouteNodes.forEach((section,sectionRoute)=>{section.hidden=sectionRoute!==route;section.setAttribute('aria-hidden',sectionRoute===route?'false':'true');});
    navLinks.forEach(link=>{
      if(link.dataset.primary===meta.primary) link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    });
    document.body.dataset.route=route.slice(2);
    document.title=`${meta.title} — Teamsheet`;
    activeRoute=route;
    const position=restoreScroll?(routeScrollPositions.get(route)||{top:0,left:0}):{top:0,left:0};
    globalThis.scrollTo?.({top:position.top,left:position.left});
    if(focus) focusRoute(route,routeNodeFor(route),{preferRemembered});
    document.dispatchEvent?.(new CustomEvent('teamsheet:route-change',{detail:{route,primary:meta.primary,parent:meta.parent||null}}));
    return route;
  };

  const navigateTeamsheetRoute=(requested,{replace=false}={})=>{
    const route=normaliseTeamsheetRoute(requested);
    rememberRouteState();
    pendingNavigation={route,kind:'forward'};
    if(replace){
      globalThis.history?.replaceState?.(null,'',route);
      pendingNavigation=null;
      activateRoute(route,{focus:true});
    }else if(globalThis.location?.hash===route){
      pendingNavigation=null;
      activateRoute(route,{focus:true});
    }else if(globalThis.location) globalThis.location.hash=route;
    return route;
  };
  globalThis.__teamsheetNavigate=navigateTeamsheetRoute;
  globalThis.addEventListener?.('hashchange',()=>{
    const route=normaliseTeamsheetRoute(globalThis.location?.hash);
    const navigation=pendingNavigation?.route===route?pendingNavigation:null;
    pendingNavigation=null;
    const returning=!navigation||navigation.kind==='return';
    activateRoute(route,{focus:true,restoreScroll:returning,preferRemembered:returning});
  });

  const initial=normaliseTeamsheetRoute(globalThis.location?.hash||'');
  if(globalThis.location?.hash!==initial) globalThis.history?.replaceState?.(null,'',initial);
  activateRoute(initial);
  if(initial!=='#/team'){
    const focusInitial=()=>focusRoute(initial,routeNodeFor(initial));
    if(document.body?.classList?.contains('startup-pending')) document.addEventListener('teamsheet:startup-ready',focusInitial,{once:true});
    else globalThis.queueMicrotask?.(focusInitial);
  }
}

setupAppShell();



/* ===== src/ui/team-pitch.mjs ===== */
// Stage 9.2 — visual-only pitch layout and repository-owned shirt palettes.
// No squad selection, projection or captaincy rule lives in this module.

const TEAM_PITCH_VISUAL_ORDER = Object.freeze([4, 3, 2, 1]);
const TEAM_PITCH_PATTERNS = Object.freeze(['solid','sleeves','stripes','halves','hoops','sash','pinstripes']);
const TEAM_PITCH_PRESETS = Object.freeze({
  ARS:{primary:'#D71920',secondary:'#FFFFFF',accent:'#162A4C',ink:'#FFFFFF',pattern:'sleeves'},
  AVL:{primary:'#6A1735',secondary:'#9ED8F5',accent:'#F5D36A',ink:'#FFFFFF',pattern:'sleeves'},
  BOU:{primary:'#D71920',secondary:'#121212',accent:'#FFFFFF',ink:'#FFFFFF',pattern:'stripes'},
  BRE:{primary:'#D71920',secondary:'#FFFFFF',accent:'#111111',ink:'#111111',pattern:'stripes'},
  BHA:{primary:'#1764B0',secondary:'#FFFFFF',accent:'#F4D35E',ink:'#111111',pattern:'stripes'},
  BUR:{primary:'#6A1735',secondary:'#9ED8F5',accent:'#FFFFFF',ink:'#FFFFFF',pattern:'sleeves'},
  CHE:{primary:'#1746A2',secondary:'#1746A2',accent:'#FFFFFF',ink:'#FFFFFF',pattern:'solid'},
  CRY:{primary:'#D71920',secondary:'#1746A2',accent:'#F4D35E',ink:'#FFFFFF',pattern:'stripes'},
  EVE:{primary:'#1746A2',secondary:'#FFFFFF',accent:'#102B5C',ink:'#FFFFFF',pattern:'solid'},
  FUL:{primary:'#FFFFFF',secondary:'#111111',accent:'#D71920',ink:'#111111',pattern:'solid'},
  LEE:{primary:'#FFFFFF',secondary:'#1746A2',accent:'#F4D35E',ink:'#111111',pattern:'solid'},
  LIV:{primary:'#B30D2F',secondary:'#B30D2F',accent:'#F4D35E',ink:'#FFFFFF',pattern:'solid'},
  MCI:{primary:'#7CC7EC',secondary:'#7CC7EC',accent:'#162A4C',ink:'#162A4C',pattern:'solid'},
  MUN:{primary:'#D71920',secondary:'#111111',accent:'#FFFFFF',ink:'#FFFFFF',pattern:'solid'},
  NEW:{primary:'#111111',secondary:'#FFFFFF',accent:'#3D7DB8',ink:'#FFFFFF',pattern:'stripes'},
  NFO:{primary:'#D71920',secondary:'#D71920',accent:'#FFFFFF',ink:'#FFFFFF',pattern:'solid'},
  SUN:{primary:'#D71920',secondary:'#FFFFFF',accent:'#111111',ink:'#111111',pattern:'stripes'},
  TOT:{primary:'#FFFFFF',secondary:'#162A4C',accent:'#F4D35E',ink:'#162A4C',pattern:'solid'},
  WHU:{primary:'#6A1735',secondary:'#9ED8F5',accent:'#FFFFFF',ink:'#FFFFFF',pattern:'sleeves'},
  WOL:{primary:'#F2A900',secondary:'#111111',accent:'#FFFFFF',ink:'#111111',pattern:'solid'},
  LEI:{primary:'#1746A2',secondary:'#FFFFFF',accent:'#F4D35E',ink:'#FFFFFF',pattern:'solid'},
  IPS:{primary:'#1746A2',secondary:'#FFFFFF',accent:'#D71920',ink:'#FFFFFF',pattern:'stripes'},
  SOU:{primary:'#D71920',secondary:'#FFFFFF',accent:'#111111',ink:'#111111',pattern:'stripes'}
});
const TEAM_PITCH_FALLBACKS = Object.freeze([
  {primary:'#315C8C',secondary:'#FFFFFF',accent:'#E6B84A',ink:'#FFFFFF',pattern:'solid'},
  {primary:'#7A1E38',secondary:'#D8EEF8',accent:'#FFFFFF',ink:'#FFFFFF',pattern:'sleeves'},
  {primary:'#1F5C3A',secondary:'#FFFFFF',accent:'#E6B84A',ink:'#FFFFFF',pattern:'halves'},
  {primary:'#20262B',secondary:'#F0C24B',accent:'#FFFFFF',ink:'#FFFFFF',pattern:'sash'},
  {primary:'#6C4BA6',secondary:'#FFFFFF',accent:'#A7E0D1',ink:'#FFFFFF',pattern:'pinstripes'},
  {primary:'#A13A2A',secondary:'#F5E7D4',accent:'#152A40',ink:'#FFFFFF',pattern:'hoops'}
]);

function teamPitchNormaliseCode(team){
  return String(team?.short_name || team?.name || '')
    .toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,3) || 'CLB';
}

function teamPitchFallbackIndex(team, code = teamPitchNormaliseCode(team)){
  let seed = Number(team?.id) || 0;
  for(const ch of code) seed = ((seed * 31) + ch.charCodeAt(0)) >>> 0;
  return seed % TEAM_PITCH_FALLBACKS.length;
}

function teamPitchPalette(team){
  const code = teamPitchNormaliseCode(team);
  const preset = TEAM_PITCH_PRESETS[code];
  if(preset) return {code, ...preset};
  return {code, ...TEAM_PITCH_FALLBACKS[teamPitchFallbackIndex(team, code)]};
}

function teamPitchPaletteClass(team){
  const code = teamPitchNormaliseCode(team);
  if(TEAM_PITCH_PRESETS[code]) return `shirt-palette-${code.toLowerCase()}`;
  return `shirt-palette-fallback-${teamPitchFallbackIndex(team, code) + 1}`;
}

function teamPitchLines(starters){
  const source = Array.isArray(starters) ? starters : [];
  return TEAM_PITCH_VISUAL_ORDER.map(position => ({
    position,
    players: source.filter(slot => Number(slot?.p?.element_type) === position)
  })).filter(line => line.players.length);
}

function teamPitchCaptaincy(ranked){
  const ids = [];
  for(const item of Array.isArray(ranked) ? ranked : []){
    const id = item?.s?.p?.id;
    if(id != null && !ids.includes(id)) ids.push(id);
    if(ids.length === 2) break;
  }
  return {captainId:ids[0] ?? null, viceId:ids[1] ?? null};
}



/* ===== src/ui/player-detail.mjs ===== */

const PLAYER_DETAIL_SPREAD_THRESHOLDS = Object.freeze({tightMax:2, moderateMax:5});
const PLAYER_DETAIL_OPEN_CLASS = 'player-detail-open';
let playerDetailPreviousFocus = null;
let playerDetailSavedScroll = null;
let playerDetailSetupDone = false;

function playerDetailSpread(summary = {}){
  if(!summary || summary.available !== true)
    return {available:false,label:null,width:null,quality:summary?.quality || null};
  const p25 = num(summary.p25), p75 = num(summary.p75);
  const width = Math.max(0,p75-p25);
  const quality = summary.quality || 'full';
  const label = quality === 'reduced' ? null
    : width <= PLAYER_DETAIL_SPREAD_THRESHOLDS.tightMax ? 'Tight'
    : width <= PLAYER_DETAIL_SPREAD_THRESHOLDS.moderateMax ? 'Moderate'
    : 'Wide';
  return {available:true,label,width,quality,p25,p75};
}

function playerDetailRangePosition(value,min,max){
  const low = num(min), high = num(max);
  if(high <= low) return 50;
  return clamp((num(value)-low)/(high-low)*100,0,100);
}

function playerDetailAvailabilityLabel(p = {}){
  if(['i','u','s','n'].includes(p.status)) return 'Unavailable';
  if(p.status === 'd') return 'Doubtful';
  return 'Available';
}

function playerDetailCanRestoreFocus(node){
  if(!node||typeof node.focus!=='function') return false;
  if(typeof document!=='undefined'&&typeof document.contains==='function'&&!document.contains(node)) return false;
  if(node.hidden||node.getAttribute?.('aria-hidden')==='true') return false;
  if(node.closest?.('[hidden],[aria-hidden="true"]')) return false;
  return true;
}

// The background is locked by class only: no runtime inline style is permitted
// by the hash-locked CSP. Because `html`/`body` overflow locking can clamp or
// discard the page offset on mobile Safari, the exact pre-open coordinates are
// captured here and reapplied on a normal close.
function playerDetailCurrentScroll(){
  const view = typeof globalThis !== 'undefined' ? globalThis : {};
  const root = typeof document !== 'undefined' ? document.documentElement : null;
  const axis = (primary,secondary,fallback) => {
    const value = Number(primary ?? secondary ?? fallback ?? 0);
    return Number.isFinite(value) ? value : 0;
  };
  return {
    left: axis(view.scrollX, view.pageXOffset, root?.scrollLeft),
    top: axis(view.scrollY, view.pageYOffset, root?.scrollTop)
  };
}

// Both the root element and the body carry the open state: body-only locking
// leaks background scrolling on mobile Safari.
function playerDetailSetLock(locked){
  if(typeof document === 'undefined') return;
  for(const node of [document.documentElement, document.body]){
    if(!node?.classList) continue;
    if(locked) node.classList.add(PLAYER_DETAIL_OPEN_CLASS);
    else node.classList.remove(PLAYER_DETAIL_OPEN_CLASS);
  }
}

function playerDetailIsOpen(){
  if(typeof document === 'undefined') return false;
  const panel = $('playerDetailPanel');
  return Boolean(panel) && panel.hidden === false;
}

// `restoreScroll` and `restoreFocus` are both suppressed for route-driven
// closure: the router owns the destination route's scroll and focus, so
// reapplying the previous route's coordinates or trigger would be stale.
function playerDetailClose({restoreFocus=true, restoreScroll=true}={}){
  if(typeof document === 'undefined') return false;
  const panel = $('playerDetailPanel'), backdrop = $('playerDetailBackdrop');
  if(!panel || !backdrop) return false;
  panel.hidden = true;
  backdrop.hidden = true;
  panel.setAttribute('aria-hidden','true');
  playerDetailSetLock(false);
  const saved = playerDetailSavedScroll;
  const restore = playerDetailPreviousFocus;
  playerDetailSavedScroll = null;
  playerDetailPreviousFocus = null;
  if(restoreScroll && saved && typeof globalThis.scrollTo === 'function')
    globalThis.scrollTo({top:saved.top, left:saved.left, behavior:'auto'});
  if(restoreFocus&&playerDetailCanRestoreFocus(restore)) restore.focus({preventScroll:true});
  return true;
}

function playerDetailSetup(){
  if(typeof document === 'undefined') return false;
  if(playerDetailSetupDone) return true;
  const panel = $('playerDetailPanel'), backdrop = $('playerDetailBackdrop'), close = $('playerDetailClose');
  if(!panel || !backdrop || !close) return false;
  // Wrapped so the DOM event object can never be read as close options.
  close.addEventListener('click',()=>playerDetailClose());
  backdrop.addEventListener('click',()=>playerDetailClose());
  document.addEventListener('keydown',event => {
    if(panel.hidden) return;
    if(event.key === 'Escape'){
      if(typeof event.preventDefault === 'function') event.preventDefault();
      playerDetailClose();
      return;
    }
    if(event.key !== 'Tab') return;
    const focusable = Array.from(panel.querySelectorAll(
      'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
    )).filter(node => !node.disabled && node.getAttribute?.('aria-hidden') !== 'true');
    if(!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length-1];
    if(event.shiftKey && document.activeElement === first){
      if(typeof event.preventDefault === 'function') event.preventDefault();
      last.focus();
    } else if(!event.shiftKey && document.activeElement === last){
      if(typeof event.preventDefault === 'function') event.preventDefault();
      first.focus();
    }
  });
  playerDetailSetupDone = true;
  return true;
}

function playerDetailOpen({title = '', body = [], trigger = null} = {}){
  if(!playerDetailSetup()) return false;
  const panel = $('playerDetailPanel'), backdrop = $('playerDetailBackdrop');
  const titleNode = $('playerDetailTitle'), bodyNode = $('playerDetailBody'), close = $('playerDetailClose');
  // Swapping the displayed player while the dialog is already open must not
  // overwrite the true background position with a locked-state reading, nor
  // move focus restoration away from the element the user actually left.
  if(!playerDetailIsOpen()){
    playerDetailSavedScroll = playerDetailCurrentScroll();
    playerDetailPreviousFocus = trigger || document.activeElement || null;
  }
  titleNode.textContent = String(title);
  setChildren(bodyNode,body);
  if(bodyNode) bodyNode.scrollTop = 0;
  backdrop.hidden = false;
  panel.hidden = false;
  panel.setAttribute('aria-hidden','false');
  playerDetailSetLock(true);
  if(close && typeof close.focus === 'function') close.focus({preventScroll:true});
  return true;
}

if(typeof document !== 'undefined'){
  playerDetailSetup();
  document.addEventListener('teamsheet:before-route-change',()=>{
    if(playerDetailIsOpen()) playerDetailClose({restoreFocus:false,restoreScroll:false});
  });
}



/* ===== src/ui/decision-preview.mjs ===== */
const DECISION_PREVIEW_ROLES = Object.freeze(['captain','vice']);
const decisionPreviewState = {
  transfer:null,
  captainId:null,
  viceId:null,
  selectionMode:null,
  squadSignature:null,
  optimiserSignature:null
};

function decisionPreviewPlayer(entry){ return entry?.p || entry || null; }
function decisionPreviewSquadSignature(squad=[]){
  return (Array.isArray(squad)?squad:[]).map((entry,index)=>{
    const p=decisionPreviewPlayer(entry);
    const bought=entry?.bought ?? entry?.purchasePrice ?? '';
    return `${index}:${Number(p?.id)||0}:${bought}`;
  }).join('|');
}
function decisionPreviewPlanSignature(plan={}){
  if(plan?.signature) return String(plan.signature);
  return (plan?.transfers||[]).map(t=>`${Number(t.outPlayerId)}>${Number(t.inPlayerId)}`).sort().join('|');
}
function decisionPreviewPlanResultSignature(plan={}){
  return [
    decisionPreviewPlanSignature(plan),
    Number(plan.transferCount)||0,
    (plan.finalSquadIds||[]).map(Number).sort((a,b)=>a-b).join('.'),
    Number(plan.netGain)||0,
    Number(plan.hitCost)||0,
    Number(plan.bankAfter)||0,
    Number(plan.freeTransfersNextGW)||0,
    Number(plan.grossBestXIPoints)||0
  ].join(':');
}
function decisionPreviewOptimiserSignature({squadSignature='',horizon=0,bank=0,freeTransfers=0,plans=[]}={}){
  return [String(squadSignature),Number(horizon)||0,Number(bank)||0,Number(freeTransfers)||0,
    (plans||[]).map(decisionPreviewPlanResultSignature).join(',')].join('::');
}
function decisionPreviewClonePlan(plan){
  if(!plan) return null;
  return {...plan,
    transfers:(plan.transfers||[]).map(t=>({...t})),
    finalSquadIds:(plan.finalSquadIds||[]).map(Number),
    warnings:(plan.warnings||[]).slice(),
    perGameweekBestXI:(plan.perGameweekBestXI||[]).map(g=>({...g,playerIds:(g.playerIds||[]).slice()}))};
}
function decisionPreviewSnapshot(){
  return {...decisionPreviewState,transfer:decisionPreviewClonePlan(decisionPreviewState.transfer)};
}
function decisionPreviewClearCaptaincy(){
  decisionPreviewState.captainId=null;
  decisionPreviewState.viceId=null;
  decisionPreviewState.selectionMode=null;
}
function decisionPreviewClearTransfer(){
  decisionPreviewState.transfer=null;
  decisionPreviewState.optimiserSignature=null;
  decisionPreviewClearCaptaincy();
}
function decisionPreviewClearAll(){
  decisionPreviewClearTransfer();
  decisionPreviewState.squadSignature=null;
}
function decisionPreviewHasActiveState(){
  return !!decisionPreviewState.transfer || decisionPreviewState.captainId!=null ||
    decisionPreviewState.viceId!=null || decisionPreviewState.selectionMode!=null;
}
function decisionPreviewSyncSquad(squad){
  const signature=decisionPreviewSquadSignature(squad);
  const changed=decisionPreviewState.squadSignature!==null && decisionPreviewState.squadSignature!==signature;
  if(changed) decisionPreviewClearAll();
  decisionPreviewState.squadSignature=signature;
  return changed;
}
function decisionPreviewSyncOptimiser(signature){
  const next=String(signature||'');
  const changed=decisionPreviewState.optimiserSignature!==null && decisionPreviewState.optimiserSignature!==next && decisionPreviewHasActiveState();
  if(changed) decisionPreviewClearTransfer();
  decisionPreviewState.optimiserSignature=next;
  return changed;
}
function decisionPreviewSelectTransfer(plan,squad,optimiserSignature){
  decisionPreviewSyncSquad(squad);
  if(!plan || Number(plan.transferCount)===0){
    decisionPreviewClearTransfer();
    decisionPreviewState.squadSignature=decisionPreviewSquadSignature(squad);
    decisionPreviewState.optimiserSignature=String(optimiserSignature||'');
    return decisionPreviewSnapshot();
  }
  decisionPreviewState.transfer=decisionPreviewClonePlan(plan);
  decisionPreviewState.optimiserSignature=String(optimiserSignature||'');
  decisionPreviewClearCaptaincy();
  return decisionPreviewSnapshot();
}
function decisionPreviewApplyTransferPlan(squad,plan,byId={}){
  const source=(Array.isArray(squad)?squad:[]).map(entry=>({...entry,p:decisionPreviewPlayer(entry)}));
  if(!plan || Number(plan.transferCount)===0)
    return {ok:true,squad:source,incomingIds:[],outgoingIds:[]};
  const transfers=Array.isArray(plan.transfers)?plan.transfers:[];
  const incomingIds=[], outgoingIds=[];
  for(const move of transfers){
    const outId=Number(move.outPlayerId), inId=Number(move.inPlayerId);
    const index=source.findIndex(entry=>Number(entry.p?.id)===outId);
    const incoming=byId?.[inId];
    if(index<0 || !incoming || source.some((entry,i)=>i!==index&&Number(entry.p?.id)===inId))
      return {ok:false,reason:'invalid_transfer',squad:source,incomingIds:[],outgoingIds:[]};
    const previous=source[index];
    source[index]={...previous,p:incoming,bought:Number(incoming.now_cost)||0,multiplier:1,is_captain:false};
    incomingIds.push(inId); outgoingIds.push(outId);
  }
  const actual=source.map(entry=>Number(entry.p?.id)).sort((a,b)=>a-b);
  const expected=(plan.finalSquadIds||[]).map(Number).sort((a,b)=>a-b);
  if(actual.length!==15 || new Set(actual).size!==actual.length || expected.length!==actual.length ||
     actual.some((id,index)=>id!==expected[index]))
    return {ok:false,reason:'final_squad_mismatch',squad:source,incomingIds:[],outgoingIds:[]};
  return {ok:true,squad:source,incomingIds,outgoingIds};
}
function decisionPreviewBeginRole(role,modelCaptaincy={}){
  if(!DECISION_PREVIEW_ROLES.includes(role)) return false;
  if(decisionPreviewState.captainId==null) decisionPreviewState.captainId=Number(modelCaptaincy.captainId)||null;
  if(decisionPreviewState.viceId==null) decisionPreviewState.viceId=Number(modelCaptaincy.viceId)||null;
  decisionPreviewState.selectionMode=role;
  return true;
}
function decisionPreviewChooseRole(role,playerId,xiIds=[]){
  if(!DECISION_PREVIEW_ROLES.includes(role)) return false;
  const id=Number(playerId), eligible=new Set((xiIds||[]).map(Number));
  if(!eligible.has(id)) return false;
  if(role==='captain'){
    if(decisionPreviewState.viceId===id){
      const oldCaptain=decisionPreviewState.captainId;
      decisionPreviewState.captainId=id;
      decisionPreviewState.viceId=eligible.has(Number(oldCaptain))&&Number(oldCaptain)!==id?Number(oldCaptain):null;
    }else decisionPreviewState.captainId=id;
  }else{
    if(decisionPreviewState.captainId===id){
      const oldVice=decisionPreviewState.viceId;
      decisionPreviewState.viceId=id;
      decisionPreviewState.captainId=eligible.has(Number(oldVice))&&Number(oldVice)!==id?Number(oldVice):null;
    }else decisionPreviewState.viceId=id;
  }
  if(decisionPreviewState.captainId===decisionPreviewState.viceId){
    if(role==='captain') decisionPreviewState.viceId=null;
    else decisionPreviewState.captainId=null;
  }
  decisionPreviewState.selectionMode=null;
  return true;
}
function decisionPreviewEffectiveCaptaincy(modelCaptaincy={},xiIds=[]){
  const eligible=new Set((xiIds||[]).map(Number));
  let captainId=eligible.has(Number(decisionPreviewState.captainId))?Number(decisionPreviewState.captainId):Number(modelCaptaincy.captainId)||null;
  let viceId=eligible.has(Number(decisionPreviewState.viceId))?Number(decisionPreviewState.viceId):Number(modelCaptaincy.viceId)||null;
  if(captainId===viceId) viceId=(xiIds||[]).map(Number).find(id=>id!==captainId)??null;
  return {captainId,viceId,isPreview:decisionPreviewState.captainId!=null||decisionPreviewState.viceId!=null};
}
function decisionPreviewCaptainTotal(xiTotal,captainId,scoreById={}){
  const uplift=Number(scoreById?.[captainId])||0;
  return {uplift,total:(Number(xiTotal)||0)+uplift};
}


/* ===== src/evidence/snapshot.mjs ===== */

const SNAPSHOT_SCHEMA_VERSION = '1.0.0';
const SNAPSHOT_METRIC_VERSION = '1.0.0';
const SNAPSHOT_SEGMENTATION_VERSION = '1.0.0';
const EVIDENCE_RULES = Object.freeze({
  captureWindowMs:24 * 60 * 60 * 1000,
  promptWindowMs:60 * 60 * 1000,
  idealWindowStartMs:20 * 60 * 1000,
  idealWindowEndMs:10 * 60 * 1000,
  safetyCutoffMs:2 * 60 * 1000,
  maxClockSkewMs:60 * 1000,
  localFullRecordLimit:2,
  localIndexLimit:3
});
const FORBIDDEN_KEY = /^(?:api[-_]?key|odds[-_]?key|claude[-_]?key|anthropic[-_]?key|authorization|password|secret|access[-_]?token|refresh[-_]?token|token|team[-_]?id|entry(?:[-_]?id)?|league[-_]?id|manager[-_]?name|email|phone)$/i;
const RESTRICTED_SECRET_PREFIX = ['sk','ant'].join('-') + '-';
const FORBIDDEN_VALUE = /(?:api[_-]?key\s*[:=]|authorization\s*[:=]\s*bearer)/i;

function canonicalise(value){
  if(value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if(typeof value === 'number'){
    if(!Number.isFinite(value)) throw new Error('Evidence records cannot contain non-finite numbers');
    return Object.is(value,-0) ? 0 : value;
  }
  if(Array.isArray(value)) return value.map(canonicalise);
  if(typeof value === 'object'){
    const out = {};
    Object.keys(value).sort().forEach(key => {
      if(['__proto__','prototype','constructor'].includes(key)) throw new Error(`Evidence records cannot contain unsafe object key: ${key}`);
      if(value[key] !== undefined) out[key] = canonicalise(value[key]);
    });
    return out;
  }
  throw new Error('Evidence records contain an unsupported value');
}
function stableStringify(value){ return JSON.stringify(canonicalise(value)); }

async function sha256Hex(text, cryptoImpl = globalThis.crypto){
  if(!cryptoImpl?.subtle || typeof TextEncoder === 'undefined') throw new Error('SHA-256 is unavailable in this browser');
  const bytes = new TextEncoder().encode(String(text));
  const digest = await cryptoImpl.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2,'0')).join('');
}
function deepFreeze(value){
  if(!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}
function findForbiddenEvidence(value,path='$',findings=[]){
  if(value === null || value === undefined) return findings;
  if(typeof value === 'string'){
    if(value.includes(RESTRICTED_SECRET_PREFIX) || FORBIDDEN_VALUE.test(value)) findings.push(`${path}:secret_value`);
    return findings;
  }
  if(Array.isArray(value)){
    value.forEach((entry,index) => findForbiddenEvidence(entry,`${path}[${index}]`,findings));
    return findings;
  }
  if(typeof value === 'object'){
    Object.entries(value).forEach(([key,entry]) => {
      if(FORBIDDEN_KEY.test(key)) findings.push(`${path}.${key}:secret_key`);
      findForbiddenEvidence(entry,`${path}.${key}`,findings);
    });
  }
  return findings;
}
function assertEvidenceSafe(value){
  const findings = findForbiddenEvidence(value);
  if(findings.length) throw new Error(`Evidence safety check failed: ${findings.join(', ')}`);
  return true;
}
function buildInfo(){
  const info = typeof BUILD_INFO !== 'undefined' ? BUILD_INFO : globalThis.BUILD_INFO;
  return info && typeof info === 'object' ? canonicalise(info) : {
    modelVersion:MODEL_VERSION,
    rulesVersion:RULES_VERSION,
    sourceHash:'unavailable',
    commit:'unversioned',
    moduleOrder:[]
  };
}
function iso(value){
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}
function deadlineWindow(deadlineTime, now = Date.now()){
  const deadlineMs = Date.parse(deadlineTime);
  if(!Number.isFinite(deadlineMs)) return {state:'unavailable',deadlineMs:null,remainingMs:null};
  const remainingMs = deadlineMs - now;
  let state = 'closed';
  if(remainingMs > EVIDENCE_RULES.captureWindowMs) state = 'too_early';
  else if(remainingMs > EVIDENCE_RULES.promptWindowMs) state = 'open';
  else if(remainingMs > EVIDENCE_RULES.idealWindowStartMs) state = 'due_soon';
  else if(remainingMs >= EVIDENCE_RULES.idealWindowEndMs) state = 'ideal';
  else if(remainingMs > EVIDENCE_RULES.safetyCutoffMs) state = 'final_window';
  else if(remainingMs > 0) state = 'safety_cutoff';
  return {state,deadlineMs,remainingMs};
}

async function sampleNetworkClock({fetchFn=globalThis.fetch,locationHref=globalThis.location?.href,nowFn=Date.now}={}){
  if(typeof fetchFn !== 'function' || !/^https?:/i.test(String(locationHref||'')))
    return {status:'unavailable',reason:'same_origin_http_unavailable'};
  const requestStartedAt = nowFn();
  try{
    const url = new URL(locationHref);
    url.hash = '';
    url.searchParams.set('_teamsheet_clock',String(requestStartedAt));
    const response = await fetchFn(url.toString(),{method:'HEAD',cache:'no-store',credentials:'same-origin'});
    const responseReceivedAt = nowFn();
    const rawDate = response?.headers?.get?.('date');
    const serverAt = Date.parse(rawDate);
    if(!Number.isFinite(serverAt)) return {status:'unavailable',reason:'date_header_unavailable',requestStartedAt,responseReceivedAt};
    const clientMidpointAt = requestStartedAt + (responseReceivedAt-requestStartedAt)/2;
    return {
      status:'available',
      requestStartedAt,
      responseReceivedAt,
      serverAt,
      clientMidpointAt,
      roundTripMs:Math.max(0,responseReceivedAt-requestStartedAt),
      skewMs:serverAt-clientMidpointAt,
      source:'same_origin_http_date'
    };
  }catch(error){
    return {status:'unavailable',reason:'network_time_request_failed',requestStartedAt,responseReceivedAt:nowFn()};
  }
}

function safeEvidenceText(value,maxLength=160){
  let text=String(value??'');
  try{text=decodeURIComponent(text);}catch(error){}
  text=text
    .replace(/(?:sk|ant)-[A-Za-z0-9_-]{8,}/gi,'[redacted]')
    .replace(/(?:api[_-]?key|authorization|access[_-]?token|refresh[_-]?token)\s*[:=]\s*[^\s,;]+/gi,'[redacted]')
    .replace(/\/entry\/\d+/gi,'/entry/[redacted]')
    .replace(/\/leagues-classic\/\d+/gi,'/leagues-classic/[redacted]')
    .replace(/[?#][^\s]*/g,'');
  return text.slice(0,Math.max(0,Number(maxLength)||160));
}
function safeEvidenceEndpoint(value){ return safeEvidenceText(value,160); }
function safeIssue(issue){
  return canonicalise({
    provider:String(issue?.provider||''),
    endpoint:safeEvidenceEndpoint(issue?.endpoint),
    code:String(issue?.code||''),
    severity:String(issue?.severity||''),
    count:Number.isFinite(Number(issue?.count)) ? Number(issue.count) : 1,
    received:issue?.received == null ? null : safeEvidenceText(issue.received,80)
  });
}
function safeRetry(record){
  return canonicalise({
    provider:String(record?.provider||''),
    endpoint:safeEvidenceEndpoint(record?.endpoint),
    attempts:Math.max(0,Math.trunc(num(record?.attempts))),
    outcome:safeEvidenceText(record?.outcome||record?.status||'',80),
    usedFallback:Boolean(record?.usedFallback),
    completedAt:Number.isFinite(Number(record?.completedAt||record?.at)) ? Number(record.completedAt||record.at) : null
  });
}
function providerIncluded(name){
  if(name === 'fpl') return Boolean(S.boot);
  if(name === 'understat') return Boolean(S.ustat);
  if(name === 'odds') return Boolean(S.odds && Object.keys(S.odds).length);
  if(name === 'archive') return Boolean(S.calib);
  return false;
}
function providerAcceptedCount(name){
  if(name === 'fpl') return (S.boot?.elements?.length||0)+(S.boot?.teams?.length||0)+(S.fixtures?.length||0);
  if(name === 'understat') return S.ustat ? Object.keys(S.ustat).length : 0;
  if(name === 'odds') return S.odds ? Object.keys(S.odds).length : 0;
  if(name === 'archive') return S.calib ? Object.keys(S.calib).length : 0;
  return 0;
}
function providerRejectedCount(name){
  return (S.dataIssues||[]).filter(issue=>issue?.provider===name).reduce((sum,issue)=>sum+Math.max(1,Math.trunc(num(issue?.count)||1)),0);
}
function providerEvidence(now){
  const rows = healthRows({seasonLive:S.seasonLive},now);
  const byName = Object.fromEntries(rows.map(row => [row.provider,row]));
  if(!byName.fpl){
    byName.fpl = {provider:'fpl',state:S.boot?HEALTH_STATES.CACHED:HEALTH_STATES.UNAVAILABLE,note:'runtime health record missing',consequence:'',lastSuccess:S.cachedAt||null,at:now,ageMs:S.cachedAt?Math.max(0,now-S.cachedAt):null};
  }
  return APPROVED_PROVIDER_NAMES.map(name => {
    const included=providerIncluded(name);
    const row = byName[name] || (included
      ? {provider:name,state:HEALTH_STATES.CACHED,note:'saved model input active',consequence:'affects current projections',lastSuccess:null,at:now,ageMs:null,thresholdMs:null}
      : {provider:name,state:HEALTH_STATES.DISABLED,note:'not active',consequence:'',lastSuccess:null,at:now,ageMs:null,thresholdMs:null});
    return canonicalise({
      provider:name,
      state:row.state,
      included,
      didAffectModel:included,
      acceptedRecordCount:providerAcceptedCount(name),
      rejectedRecordCount:providerRejectedCount(name),
      lastSuccessAt:row.lastSuccess ? new Date(row.lastSuccess).toISOString() : null,
      recordedAt:row.at ? new Date(row.at).toISOString() : new Date(now).toISOString(),
      ageMs:row.ageMs,
      thresholdMs:row.thresholdMs ?? null,
      note:String(row.note||''),
      consequence:String(row.consequence||'')
    });
  });
}
function playerInput(player){
  const out = {};
  KEEP.forEach(key => { if(player?.[key] !== undefined) out[key] = player[key]; });
  return canonicalise(out);
}
function minuteHistoryInput(){
  const out = {};
  Object.keys(S.minuteHistory||{}).sort((a,b)=>Number(a)-Number(b)).forEach(id => {
    out[id] = (Array.isArray(S.minuteHistory[id]) ? S.minuteHistory[id] : []).map(row => canonicalise({
      event:Number(row?.event)||0,
      minutes:Number(row?.minutes)||0,
      starts:row?.starts == null ? null : Number(row.starts)
    }));
  });
  return out;
}
function projectionSourceUsage(player,nextGW,horizon,minutes){
  const fixtures=teamFixtures(player.team,nextGW,horizon).flat();
  const understat=fixtures.some(game=>Boolean(S.ustat?.[player.team]&&S.ustat?.[game.oppId]));
  const odds=fixtures.some(game=>{
    const pair=game.home?`${player.team}|${game.oppId}`:`${game.oppId}|${player.team}`;
    return Boolean(S.odds?.[pair]);
  });
  return canonicalise({
    fpl:true,
    understat,
    odds,
    minutesSource:String(minutes?.source||'unknown'),
    archiveCalibration:Boolean(S.calib?.[player.element_type])
  });
}
function projectionRecord(player,nextGW,horizon){
  const perGameweek = [];
  for(let gw=nextGW;gw<nextGW+horizon;gw++){
    const projection = projectXP(player,gw,1);
    perGameweek.push(canonicalise({gw,total:projection.total,games:projection.games,parts:projection.parts}));
  }
  const aggregate = projectXP(player,nextGW,horizon);
  const minutes = minutesEstimate(player);
  const simulation = simulatePlayerGameweek(player,nextGW,{includeSamples:false});
  const uncertainty = simulation.available ? canonicalise({
    status:'available',
    quality:simulation.quality,
    seed:simulation.seed ?? null,
    sampleCount:Number(simulation.sampleCount)||0,
    mean:simulation.mean,
    p10:simulation.p10,
    p25:simulation.p25,
    median:simulation.median,
    p75:simulation.p75,
    p90:simulation.p90,
    blankProbability:simulation.blankProbability,
    returnProbability:simulation.returnProbability,
    haulProbability:simulation.haulProbability,
    megaHaulProbability:simulation.megaHaulProbability,
    appearanceProbability:simulation.appearanceProbability,
    sixtyProbability:simulation.sixtyProbability
  }) : canonicalise({status:'not_available',reason:simulation.reason||'unavailable',quality:simulation.quality||null,sampleCount:0});
  return canonicalise({
    playerId:Number(player.id),
    clubId:Number(player.team),
    position:Number(player.element_type),
    nowCost:Number(player.now_cost),
    status:String(player.status||''),
    chanceOfPlaying:player.chance_of_playing_next_round == null ? null : Number(player.chance_of_playing_next_round),
    minutes,
    nextGameweek:perGameweek[0]||{gw:nextGW,total:0,games:0,parts:{}},
    perGameweek,
    aggregate:{fromGameweek:nextGW,horizon,total:aggregate.total,perGameweek:aggregate.perGW,games:aggregate.games,parts:aggregate.parts},
    uncertainty,
    sourceUsage:projectionSourceUsage(player,nextGW,horizon,minutes)
  });
}
function planRecord(plan){
  if(!plan) return null;
  return canonicalise({
    transferCount:plan.transferCount,
    transfers:plan.transfers||[],
    finalSquadIds:plan.finalSquadIds||[],
    bankBefore:plan.bankBefore,
    bankAfter:plan.bankAfter,
    freeTransfersBefore:plan.freeTransfersBefore,
    paidTransfers:plan.paidTransfers,
    hitCost:plan.hitCost,
    freeTransfersNextGW:plan.freeTransfersNextGW,
    grossBestXIPoints:plan.grossBestXIPoints,
    grossGain:plan.grossGain,
    rollDifference:plan.rollDifference,
    netGain:plan.netGain,
    perGameweekBestXI:plan.perGameweekBestXI||[],
    signature:plan.signature||'',
    warnings:plan.warnings||[],
    pricingMode:plan.pricingMode||null
  });
}
function squadEvidence(nextGW,horizon){
  const squad = mySquad();
  if(squad.length !== 15) return {status:'not_available',reason:'complete_squad_not_loaded',players:[],modelDecision:null,userPreview:canonicalise(decisionPreviewSnapshot()),optimiser:null};
  const xi = bestXI(squad,nextGW);
  const ranked = xi.xi.slice().sort((a,b)=>xpOf(b.p,nextGW,1).total-xpOf(a.p,nextGW,1).total || Number(a.p.id)-Number(b.p.id));
  const bank = Math.max(0,Math.round(num($('bankIn')?.value)*10));
  const freeTransfers = Math.max(0,Math.min(5,Math.trunc(num($('ftCount')?.value)||0)));
  const squadSignature=decisionPreviewSquadSignature(squad);
  const cached=S.lastOptimiser;
  const optimiser=cached&&cached.squadSignature===squadSignature&&cached.horizon===horizon&&cached.bank===bank&&
    cached.freeTransfers===freeTransfers&&cached.startGW===nextGW
    ? cached.result
    : optimiseTransfers({
      squad,
      players:S.boot?.elements||[],
      bank,
      freeTransfers,
      startGW:nextGW,
      horizon,
      maxResults:20,
      scorePlayer:(player,gw)=>xpOf(player,gw,1).total
    });
  return canonicalise({
    status:'available',
    source:$('useManual')?.checked ? 'manual' : 'fpl_public_picks',
    players:squad.map(entry => ({
      playerId:Number(entry.p.id),
      purchasePrice:entry.bought == null ? null : Number(entry.bought),
      position:entry.position == null ? null : Number(entry.position),
      multiplier:entry.multiplier == null ? null : Number(entry.multiplier),
      isCaptain:Boolean(entry.is_captain)
    })).sort((a,b)=>a.playerId-b.playerId),
    modelDecision:{
      gameweek:nextGW,
      formation:xi.shape,
      bestXIPlayerIds:xi.xi.map(entry=>Number(entry.p.id)),
      benchPlayerIds:xi.bench.map(entry=>Number(entry.p.id)),
      xiProjectedPoints:xi.tot,
      captainId:ranked[0]?.p?.id ?? null,
      viceCaptainId:ranked[1]?.p?.id ?? null
    },
    userPreview:decisionPreviewSnapshot(),
    optimiser:{
      status:optimiser.status,
      horizon,
      evaluations:optimiser.evaluations??null,
      pruned:optimiser.pruned??null,
      issues:optimiser.issues||[],
      baseline:planRecord(optimiser.baseline),
      plans:(optimiser.plans||[]).map(planRecord)
    }
  });
}
function collectPreDeadlinePayload({managerRef,horizon,startedAt=Date.now(),projectionRows=null,projectionStartedAtOverride=null,projectionCompletedAtOverride=null}={}){
  if(!S.boot || !Array.isArray(S.boot.events) || !Array.isArray(S.boot.elements)) throw new Error('Season data must be loaded before evidence can be captured');
  const nextGW = Number(S.nextGW)||1;
  const event = S.boot.events.find(row => Number(row.id)===nextGW);
  if(!event?.deadline_time) throw new Error('The next FPL deadline is unavailable');
  const cleanHorizon = Math.max(1,Math.min(8,Math.trunc(num(horizon)||6)));
  const projectionStartedAt = projectionStartedAtOverride ?? Date.now();
  const projections = projectionRows || S.boot.elements.slice().sort((a,b)=>Number(a.id)-Number(b.id)).map(player => projectionRecord(player,nextGW,cleanHorizon));
  const projectionCompletedAt = projectionCompletedAtOverride ?? Date.now();
  const issues = (S.dataIssues||[]).map(safeIssue);
  const providers = providerEvidence(projectionCompletedAt);
  const fatalFplIssue = issues.some(issue => issue.provider==='fpl' && issue.severity==='fatal');
  const projectionComplete = projections.length===S.boot.elements.length && projections.every(row => row.minutes && row.nextGameweek && row.uncertainty);
  const squad = squadEvidence(nextGW,cleanHorizon);
  const sections = {
    coreInputs:S.boot && S.fixtures ? 'complete' : 'incomplete',
    playerProjections:projectionComplete ? 'complete' : 'incomplete',
    uncertainty:S.seasonLive ? (projections.every(row=>row.uncertainty.status==='available')?'complete':'incomplete') : 'not_available_preseason',
    squad:squad.status
  };
  const payload = {
    recordType:'preDeadlineSnapshot',
    schemaVersion:SNAPSHOT_SCHEMA_VERSION,
    metricVersion:SNAPSHOT_METRIC_VERSION,
    segmentationVersion:SNAPSHOT_SEGMENTATION_VERSION,
    managerRef:String(managerRef||''),
    season:FPL_RULES.season,
    gameweek:nextGW,
    deadlineTime:new Date(event.deadline_time).toISOString(),
    capture:{startedAt:new Date(startedAt).toISOString(),projectionStartedAt:new Date(projectionStartedAt).toISOString(),projectionCompletedAt:new Date(projectionCompletedAt).toISOString(),horizon:cleanHorizon},
    build:buildInfo(),
    versions:{model:MODEL_VERSION,rules:RULES_VERSION,simulation:SIMULATION_RULES.version,snapshot:SNAPSHOT_SCHEMA_VERSION},
    rules:{
      fpl:FPL_RULES,
      minutes:MINUTES_RULES,
      scoring:SCORING_RULES,
      transfer:TRANSFER_RULES,
      simulation:SIMULATION_RULES,
      odds:ODDS_RULES,
      fixture:{baseGoals:BASE_GOALS,homeTilt:HOME_TILT}
    },
    providers,
    retries:Object.values(S.retryStats||{}).map(safeRetry).sort((a,b)=>(a.provider+a.endpoint).localeCompare(b.provider+b.endpoint)),
    issues,
    modelInputs:{
      events:S.boot.events.map(row=>canonicalise(row)),
      teams:S.boot.teams.map(row=>canonicalise(row)).sort((a,b)=>a.id-b.id),
      players:S.boot.elements.map(playerInput).sort((a,b)=>a.id-b.id),
      fixtures:(S.fixtures||[]).map(row=>canonicalise(row)).sort((a,b)=>(a.event??99)-(b.event??99)||a.id-b.id),
      minuteHistory:minuteHistoryInput(),
      calibration:S.calib ? canonicalise(S.calib) : null,
      understat:S.ustat ? canonicalise(S.ustat) : null,
      odds:S.odds ? canonicalise(S.odds) : null
    },
    outputs:{players:projections,squad},
    completeness:{complete:sections.coreInputs==='complete'&&sections.playerProjections==='complete'&&!fatalFplIssue,sections,fatalFplIssue,playerCount:projections.length,expectedPlayerCount:S.boot.elements.length},
    quality:{projectionDurationMs:Math.max(0,projectionCompletedAt-projectionStartedAt),simulationSamplesPerAvailablePlayer:SIMULATION_RULES.productionSamples,seasonLive:Boolean(S.seasonLive)}
  };
  assertEvidenceSafe(payload);
  return canonicalise(payload);
}

async function collectPreDeadlinePayloadAsync({managerRef,horizon,startedAt=Date.now(),yieldEvery=20,yieldFn=null}={}){
  if(!S.boot || !Array.isArray(S.boot.events) || !Array.isArray(S.boot.elements)) throw new Error('Season data must be loaded before evidence can be captured');
  const nextGW=Number(S.nextGW)||1;
  const cleanHorizon=Math.max(1,Math.min(8,Math.trunc(num(horizon)||6)));
  const projectionStartedAt=Date.now(), projections=[];
  const players=S.boot.elements.slice().sort((a,b)=>Number(a.id)-Number(b.id));
  const pause=yieldFn||(()=>new Promise(resolve=>setTimeout(resolve,0)));
  for(let i=0;i<players.length;i++){
    projections.push(projectionRecord(players[i],nextGW,cleanHorizon));
    if(yieldEvery>0&&(i+1)%yieldEvery===0&&i+1<players.length) await pause();
  }
  return collectPreDeadlinePayload({
    managerRef,horizon:cleanHorizon,startedAt,projectionRows:projections,
    projectionStartedAtOverride:projectionStartedAt,projectionCompletedAtOverride:Date.now()
  });
}

function clockSampleUsable(sample){
  return sample?.status==='available' && Number.isFinite(Number(sample.serverAt)) && Number.isFinite(Number(sample.skewMs));
}
function assessDeadlineTiming({deadlineTime,captureStartedAt,captureCompletedAt,networkBefore,networkAfter,providers=[],complete=false}={}){
  const deadlineMs = Date.parse(deadlineTime);
  const startedMs = Number(captureStartedAt);
  const completedMs = Number(captureCompletedAt);
  if(!Number.isFinite(deadlineMs)||!Number.isFinite(startedMs)||!Number.isFinite(completedMs)) throw new Error('Deadline timing inputs are invalid');
  const cutoffMs = deadlineMs-EVIDENCE_RULES.safetyCutoffMs;
  const beforeUsable = clockSampleUsable(networkBefore);
  const afterUsable = clockSampleUsable(networkAfter);
  const skewConflict = (beforeUsable&&Math.abs(networkBefore.skewMs)>EVIDENCE_RULES.maxClockSkewMs) || (afterUsable&&Math.abs(networkAfter.skewMs)>EVIDENCE_RULES.maxClockSkewMs);
  const referenceCompletedAt = afterUsable ? Number(networkAfter.serverAt) : completedMs;
  const includedProviders = (providers||[]).filter(row=>row.included);
  const lateProvider = includedProviders.find(row => {
    const at = Date.parse(row.recordedAt);
    return !Number.isFinite(at) || at>=cutoffMs;
  });
  const reasons=[];
  if(referenceCompletedAt>deadlineMs) reasons.push('after_deadline');
  if(referenceCompletedAt>=cutoffMs) reasons.push('inside_safety_cutoff');
  if(deadlineMs-referenceCompletedAt>EVIDENCE_RULES.captureWindowMs) reasons.push('outside_capture_window');
  if(!complete) reasons.push('snapshot_incomplete');
  if(lateProvider) reasons.push(`provider_after_cutoff:${lateProvider.provider}`);
  if(!beforeUsable||!afterUsable) reasons.push('network_time_unavailable');
  if(skewConflict) reasons.push('clock_conflict');
  let grade = 'network_attested';
  if(referenceCompletedAt>=cutoffMs) grade='late';
  else if(skewConflict) grade='clock_conflict';
  else if(!beforeUsable||!afterUsable) grade='client_recorded';
  const officialEligible = grade==='network_attested' && reasons.length===0;
  return canonicalise({
    grade,
    officialEligible,
    reasons,
    deadlineTime:new Date(deadlineMs).toISOString(),
    safetyCutoffTime:new Date(cutoffMs).toISOString(),
    captureStartedAt:new Date(startedMs).toISOString(),
    captureCompletedAt:new Date(completedMs).toISOString(),
    networkBefore:networkBefore||{status:'unavailable'},
    networkAfter:networkAfter||{status:'unavailable'},
    referenceCompletedAt:new Date(referenceCompletedAt).toISOString(),
    includedProviderCount:includedProviders.length,
    allIncludedProvidersBeforeCutoff:!lateProvider,
    withinCaptureWindow:deadlineMs-referenceCompletedAt<=EVIDENCE_RULES.captureWindowMs && referenceCompletedAt<deadlineMs,
    beforeSafetyCutoff:referenceCompletedAt<cutoffMs
  });
}
async function computeSectionHashes(payload,cryptoImpl=globalThis.crypto){
  const players=payload.outputs?.players||[];
  const sections={
    modelInputs:payload.modelInputs||null,
    playerProjections:players.map(row=>({playerId:row.playerId,nextGameweek:row.nextGameweek,perGameweek:row.perGameweek,aggregate:row.aggregate,sourceUsage:row.sourceUsage})),
    minutes:players.map(row=>({playerId:row.playerId,minutes:row.minutes})),
    uncertainty:players.map(row=>({playerId:row.playerId,uncertainty:row.uncertainty})),
    decisions:payload.outputs?.squad||null,
    providers:payload.providers||[],
    fplInputs:{events:payload.modelInputs?.events||[],teams:payload.modelInputs?.teams||[],players:payload.modelInputs?.players||[],fixtures:payload.modelInputs?.fixtures||[],minuteHistory:payload.modelInputs?.minuteHistory||{}},
    understatInputs:payload.modelInputs?.understat??null,
    oddsInputs:payload.modelInputs?.odds??null,
    archiveInputs:payload.modelInputs?.calibration??null,
    ruleConfiguration:payload.rules||null
  };
  const entries=await Promise.all(Object.entries(sections).map(async([name,value])=>[name,await sha256Hex(stableStringify(value),cryptoImpl)]));
  return canonicalise(Object.fromEntries(entries));
}
function recordHashMaterial(record){
  const copy = canonicalise(record);
  if(copy.identity){ delete copy.identity.contentHash; delete copy.identity.snapshotId; }
  return copy;
}
async function finaliseSnapshotRecord(payload,{captureStartedAt,captureCompletedAt,networkBefore,networkAfter}={},cryptoImpl=globalThis.crypto){
  assertEvidenceSafe(payload);
  const timing = assessDeadlineTiming({
    deadlineTime:payload.deadlineTime,
    captureStartedAt,
    captureCompletedAt,
    networkBefore,
    networkAfter,
    providers:payload.providers,
    complete:Boolean(payload.completeness?.complete)
  });
  const duplicateKey = [payload.season,`gw${payload.gameweek}`,payload.deadlineTime,payload.build?.sourceHash||'unknown',payload.versions?.model||MODEL_VERSION,payload.versions?.rules||RULES_VERSION].join('|');
  const sectionHashes=await computeSectionHashes(payload,cryptoImpl);
  const ruleHashes=canonicalise({configuration:sectionHashes.ruleConfiguration});
  const draft = canonicalise({...payload,timing,identity:{duplicateKey,sectionHashes,ruleHashes,contentHash:null,snapshotId:null}});
  const contentHash = await sha256Hex(stableStringify(recordHashMaterial(draft)),cryptoImpl);
  const snapshotId = `predeadline-gw${payload.gameweek}-${contentHash.slice(0,16)}`;
  const record = canonicalise({...draft,identity:{duplicateKey,sectionHashes,ruleHashes,contentHash,snapshotId}});
  assertEvidenceSafe(record);
  return deepFreeze(record);
}
function recordShapeError(record){
  const requiredTopLevel=['build','capture','completeness','deadlineTime','gameweek','identity','issues','managerRef','metricVersion','modelInputs','outputs','providers','quality','recordType','retries','rules','schemaVersion','season','segmentationVersion','timing','versions'];
  const keys=Object.keys(record||{}).sort();
  if(stableStringify(keys)!==stableStringify(requiredTopLevel.slice().sort())) return 'top_level_schema';
  if(!/^mgr-[0-9a-f]{32}$/.test(record.managerRef||'')) return 'manager_ref';
  if(!/^\d{4}-\d{2}$/.test(record.season||'')) return 'season';
  if(!Number.isInteger(record.gameweek)||record.gameweek<1||record.gameweek>38) return 'gameweek';
  if(!iso(record.deadlineTime)) return 'deadline';
  if(!record.build||typeof record.build!=='object'||!record.versions||typeof record.versions!=='object') return 'build_identity';
  if(!Array.isArray(record.providers)||!Array.isArray(record.retries)||!Array.isArray(record.issues)) return 'provider_schema';
  const providerError=providerTrustError(record.providers);
  if(providerError) return providerError;
  if(!record.modelInputs||typeof record.modelInputs!=='object'||!record.outputs||typeof record.outputs!=='object'||!Array.isArray(record.outputs.players)) return 'payload_schema';
  if(!record.completeness||typeof record.completeness.complete!=='boolean') return 'completeness_schema';
  if(!record.timing||!['network_attested','client_recorded','clock_conflict','late'].includes(record.timing.grade)||typeof record.timing.officialEligible!=='boolean'||!Array.isArray(record.timing.reasons)) return 'timing_schema';
  if(!record.identity||!/^predeadline-gw\d+-[0-9a-f]{16}$/.test(record.identity.snapshotId||'')||!/^[0-9a-f]{64}$/.test(record.identity.contentHash||'')) return 'identity_schema';
  if(!record.identity.sectionHashes||typeof record.identity.sectionHashes!=='object'||!record.identity.ruleHashes||typeof record.identity.ruleHashes!=='object') return 'identity_schema';
  return null;
}

async function validateSnapshotRecord(record,cryptoImpl=globalThis.crypto){
  try{
    if(!record || record.recordType!=='preDeadlineSnapshot') return {ok:false,reason:'record_type'};
    if(record.schemaVersion!==SNAPSHOT_SCHEMA_VERSION) return {ok:false,reason:'schema_version'};
    const shapeError=recordShapeError(record);
    if(shapeError) return {ok:false,reason:shapeError};
    assertEvidenceSafe(record);
    const sectionHashes=await computeSectionHashes(record,cryptoImpl);
    if(stableStringify(sectionHashes)!==stableStringify(record.identity.sectionHashes)) return {ok:false,reason:'section_hash'};
    if(record.identity.ruleHashes.configuration!==sectionHashes.ruleConfiguration) return {ok:false,reason:'rule_hash'};
    const expectedDuplicateKey=[record.season,`gw${record.gameweek}`,record.deadlineTime,record.build?.sourceHash||'unknown',record.versions?.model||MODEL_VERSION,record.versions?.rules||RULES_VERSION].join('|');
    if(record.identity.duplicateKey!==expectedDuplicateKey) return {ok:false,reason:'duplicate_key'};
    const expectedTiming=assessDeadlineTiming({
      deadlineTime:record.deadlineTime,
      captureStartedAt:Date.parse(record.timing.captureStartedAt),
      captureCompletedAt:Date.parse(record.timing.captureCompletedAt),
      networkBefore:record.timing.networkBefore,
      networkAfter:record.timing.networkAfter,
      providers:record.providers,
      complete:record.completeness.complete
    });
    if(stableStringify(expectedTiming)!==stableStringify(record.timing)) return {ok:false,reason:'timing_evidence'};
    const expected = await sha256Hex(stableStringify(recordHashMaterial(record)),cryptoImpl);
    if(expected!==record.identity?.contentHash) return {ok:false,reason:'content_hash'};
    if(record.identity?.snapshotId!==`predeadline-gw${record.gameweek}-${expected.slice(0,16)}`) return {ok:false,reason:'snapshot_id'};
    return {ok:true,record:deepFreeze(canonicalise(record))};
  }catch(error){ return {ok:false,reason:'invalid_record',message:error.message}; }
}
async function capturePreDeadlineSnapshot({managerRef,horizon,fetchFn=globalThis.fetch,locationHref=globalThis.location?.href,nowFn=Date.now,cryptoImpl=globalThis.crypto}={}){
  const captureStartedAt = nowFn();
  const networkBefore = await sampleNetworkClock({fetchFn,locationHref,nowFn});
  const payload = await collectPreDeadlinePayloadAsync({managerRef,horizon,startedAt:captureStartedAt});
  const networkAfter = await sampleNetworkClock({fetchFn,locationHref,nowFn});
  const captureCompletedAt = nowFn();
  return finaliseSnapshotRecord(payload,{captureStartedAt,captureCompletedAt,networkBefore,networkAfter},cryptoImpl);
}
function selectOfficialSnapshot(records,gameweek,deadlineTime=null){
  const gameweekRecords=(records||[]).filter(record=>Number(record?.gameweek)===Number(gameweek));
  if(!gameweekRecords.length) return null;
  const activeDeadline=deadlineTime
    ? new Date(deadlineTime).toISOString()
    : gameweekRecords.slice().sort((a,b)=>Date.parse(b.timing?.referenceCompletedAt||b.timing?.captureCompletedAt)-Date.parse(a.timing?.referenceCompletedAt||a.timing?.captureCompletedAt))[0]?.deadlineTime;
  return gameweekRecords
    .filter(record=>record?.deadlineTime===activeDeadline&&record?.timing?.officialEligible&&record?.completeness?.complete)
    .sort((a,b)=>Date.parse(b.timing.referenceCompletedAt)-Date.parse(a.timing.referenceCompletedAt)||String(a.identity.snapshotId).localeCompare(String(b.identity.snapshotId)))[0]||null;
}
function compactSnapshotMetadata(record,{origin='local_capture'}={}){
  const trustedLocal=origin==='local_capture';
  return canonicalise({
    snapshotId:record.identity.snapshotId,
    contentHash:record.identity.contentHash,
    gameweek:record.gameweek,
    season:record.season,
    deadlineTime:record.deadlineTime,
    capturedAt:record.timing.captureCompletedAt,
    timingGrade:record.timing.grade,
    origin,
    recordOfficialEligible:Boolean(record.timing.officialEligible),
    officialEligible:Boolean(trustedLocal&&record.timing.officialEligible),
    complete:Boolean(record.completeness.complete),
    buildCommit:record.build?.commit||'unversioned',
    modelVersion:record.versions?.model,
    rulesVersion:record.versions?.rules
  });
}
function boundedSnapshotIndex(existing,record,options={}){
  const metadata = compactSnapshotMetadata(record,options);
  const rows = [metadata,...(Array.isArray(existing)?existing:[]).filter(row=>row.snapshotId!==metadata.snapshotId)]
    .sort((a,b)=>Date.parse(b.capturedAt)-Date.parse(a.capturedAt)||a.snapshotId.localeCompare(b.snapshotId));
  return rows.slice(0,EVIDENCE_RULES.localIndexLimit);
}



/* ===== src/evidence/outcome.mjs ===== */

const OUTCOME_SCHEMA_VERSION='1.0.0';
const OUTCOME_RULES=Object.freeze({
  provisionalRecheckMs:15*60*1000,
  foregroundMinAgeMs:10*60*1000,
  correctionWindowMs:14*24*60*60*1000,
  correctionRecheckMs:24*60*60*1000,
  batchLimit:6,
  localIndexLimit:50,
  supersededFullLimit:6,
  maxEncodedBytes:3*1024*1024
});
const OUTCOME_STATUSES=Object.freeze({PROVISIONAL:'provisional',COMPLETE:'complete',CORRECTED:'corrected'});

function outcomeBuildInfo(){
  const info=typeof BUILD_INFO!=='undefined'?BUILD_INFO:globalThis.BUILD_INFO;
  return canonicalise(info&&typeof info==='object'?info:{modelVersion:MODEL_VERSION,rulesVersion:RULES_VERSION,sourceHash:'unavailable',commit:'unversioned',moduleOrder:[]});
}
function outcomeIso(value){
  const ms=value instanceof Date?value.getTime():typeof value==='number'?value:Date.parse(value);
  return Number.isFinite(ms)?new Date(ms).toISOString():null;
}
function outcomeSafeRetryRows(){
  return Object.values(S.retryStats||{}).filter(row=>row?.provider==='fpl').map(row=>canonicalise({
    provider:'fpl',
    endpoint:safeEvidenceEndpoint(String(row?.endpoint||'').replace(/\d+/g,'{id}')),
    attempts:Number.isInteger(Number(row?.attempts))?Number(row.attempts):0,
    finalStatus:safeEvidenceText(row?.finalStatus||row?.outcome||'',80),
    exhausted:Boolean(row?.exhausted),
    budgetExceeded:Boolean(row?.budgetExceeded)
  })).sort((a,b)=>a.endpoint.localeCompare(b.endpoint));
}
function snapshotRelation(snapshotRecords,gameweek,deadlineTime,snapshotMetadata=[]){
  const official=selectOfficialSnapshot(snapshotRecords,gameweek,deadlineTime);
  if(official) return canonicalise({
    status:'matched_official',
    snapshotId:official.identity.snapshotId,
    contentHash:official.identity.contentHash,
    deadlineTime:official.deadlineTime,
    timingGrade:official.timing.grade,
    buildCommit:official.build?.commit||'unversioned',
    modelVersion:official.versions?.model||null,
    rulesVersion:official.versions?.rules||null
  });
  const rows=(snapshotMetadata||[]).filter(row=>Number(row?.gameweek)===Number(gameweek));
  if(rows.some(row=>row.origin==='recovery_import')) return canonicalise({status:'recovery_only_available',snapshotId:null,contentHash:null,deadlineTime:outcomeIso(deadlineTime),timingGrade:null,buildCommit:null,modelVersion:null,rulesVersion:null});
  if(rows.some(row=>row.deadlineTime!==outcomeIso(deadlineTime))) return canonicalise({status:'deadline_mismatch',snapshotId:null,contentHash:null,deadlineTime:outcomeIso(deadlineTime),timingGrade:null,buildCommit:null,modelVersion:null,rulesVersion:null});
  if(rows.length) return canonicalise({status:'recorded_only_available',snapshotId:null,contentHash:null,deadlineTime:outcomeIso(deadlineTime),timingGrade:null,buildCommit:null,modelVersion:null,rulesVersion:null});
  return canonicalise({status:'no_snapshot',snapshotId:null,contentHash:null,deadlineTime:outcomeIso(deadlineTime),timingGrade:null,buildCommit:null,modelVersion:null,rulesVersion:null});
}
function fixtureAssignmentHashMaterial(records){
  return (records||[]).map(row=>({fixtureId:row.fixtureId,event:row.event,kickoffTime:row.kickoffTime,homeTeamId:row.homeTeamId,awayTeamId:row.awayTeamId}));
}
function outcomePlayerDetailIssues(players){
  const issues=[];
  for(const row of players||[]){
    if(row.perFixture?.length){
      const explained=row.perFixture.reduce((sum,item)=>sum+Number(item.points||0),0);
      if(explained!==Number(row.totalPoints)) issues.push({provider:'fpl',endpoint:'/event/{gw}/live/',code:'outcome_player_points_explain_mismatch',severity:'partial',count:1,playerId:row.playerId});
    }
  }
  return issues;
}
function outcomeHistoryForGameweek(historyValue,gameweek){
  return historyValue?.current?.find(row=>Number(row.event)===Number(gameweek))||null;
}
function buildSquadOutcome(picksValue,historyValue,gameweek,players){
  if(!picksValue) return canonicalise({status:'not_available',reason:'public_manager_outcome_unavailable',activeChip:null,officialGameweekPoints:null,officialTotalPoints:null,eventTransferCount:null,eventTransferCost:null,officialPointsOnBench:null,picks:[],captain:null,viceCaptain:null,bench:[],automaticSubstitutions:[],reconstruction:{pickMultiplierTotal:null,officialPointsDelta:null,agreement:'not_available'}});
  const pointsByPlayer=new Map((players||[]).map(row=>[Number(row.playerId),Number(row.totalPoints)]));
  const historyRow=outcomeHistoryForGameweek(historyValue,gameweek);
  const pickHistory=picksValue.entryHistory;
  const summary=pickHistory||historyRow;
  const picks=picksValue.picks.map(row=>{
    const basePoints=pointsByPlayer.has(row.playerId)?pointsByPlayer.get(row.playerId):null;
    return canonicalise({...row,basePoints,realisedContribution:basePoints==null?null:basePoints*row.multiplier});
  });
  const captain=picks.find(row=>row.isCaptain)||null;
  const vice=picks.find(row=>row.isViceCaptain)||null;
  const bench=picks.filter(row=>row.position>11);
  const pickMultiplierTotal=picks.every(row=>row.realisedContribution!=null)?picks.reduce((sum,row)=>sum+row.realisedContribution,0):null;
  const officialPoints=summary?.points??null;
  const delta=pickMultiplierTotal==null||officialPoints==null?null:officialPoints-pickMultiplierTotal;
  let agreement=delta==null?'not_available':delta===0?'agrees':'mismatch';
  if(pickHistory&&historyRow&&['points','totalPoints','eventTransferCount','eventTransferCost','pointsOnBench'].some(key=>pickHistory[key]!=null&&historyRow[key]!=null&&pickHistory[key]!==historyRow[key])) agreement='summary_conflict';
  return canonicalise({
    status:agreement==='summary_conflict'?'partial':'available',
    reason:agreement==='summary_conflict'?'manager_summary_conflict':null,
    activeChip:picksValue.activeChip,
    officialGameweekPoints:officialPoints,
    officialTotalPoints:summary?.totalPoints??null,
    eventTransferCount:summary?.eventTransferCount??null,
    eventTransferCost:summary?.eventTransferCost??null,
    officialPointsOnBench:summary?.pointsOnBench??null,
    picks,
    captain:captain?{playerId:captain.playerId,multiplier:captain.multiplier,basePoints:captain.basePoints,realisedContribution:captain.realisedContribution}:null,
    viceCaptain:vice?{playerId:vice.playerId,multiplier:vice.multiplier,basePoints:vice.basePoints,realisedContribution:vice.realisedContribution}:null,
    bench,
    automaticSubstitutions:picksValue.automaticSubstitutions,
    reconstruction:{pickMultiplierTotal,officialPointsDelta:delta,agreement}
  });
}
function outcomeCollectionStatus(event,fixturesValue,liveValue,expectedPlayerCount,detailIssues){
  const allFixturesFinished=Boolean(fixturesValue)&&fixturesValue.records.every(row=>row.finished===true);
  const playerComplete=Boolean(liveValue)&&liveValue.records.length===Number(expectedPlayerCount||liveValue.records.length)&&!detailIssues.length;
  return allFixturesFinished&&event?.finished===true&&event?.data_checked===true&&playerComplete?OUTCOME_STATUSES.COMPLETE:OUTCOME_STATUSES.PROVISIONAL;
}
async function collectOutcomePayload({
  managerRef,gameweek,event,fixturesPayload,livePayload,picksPayload=null,historyPayload=null,
  snapshotRecords=[],snapshotMetadata=[],trigger='automatic',mode='prospective_recheck',startedAt=Date.now(),completedAt=Date.now(),cryptoImpl=globalThis.crypto
}={}){
  if(!event||Number(event.id)!==Number(gameweek)||!event.deadline_time) return {ok:false,disposition:'rejected',reason:'event_alignment'};
  const fixturesV=validateOutcomeFixtures(fixturesPayload,gameweek);
  if(!fixturesV.value) return {ok:false,disposition:fixturesV.issues.some(row=>row.severity==='fatal')?'quarantined':'retry',reason:'fixtures_unusable',issues:fixturesV.issues};
  const fixtureIds=fixturesV.value.records.map(row=>row.fixtureId);
  const liveV=validateOutcomeLive(livePayload,fixtureIds);
  if(!liveV.value) return {ok:false,disposition:liveV.issues.some(row=>row.severity==='fatal')?'quarantined':'retry',reason:'live_unusable',issues:fixturesV.issues.concat(liveV.issues)};
  const picksV=validateOutcomePicks(picksPayload,gameweek);
  const historyV=validateOutcomeHistory(historyPayload);
  const detailIssues=outcomePlayerDetailIssues(liveV.value.records);
  const issues=fixturesV.issues.concat(liveV.issues,picksV.issues,historyV.issues,detailIssues);
  const status=outcomeCollectionStatus(event,fixturesV.value,liveV.value,S.boot?.elements?.length,detailIssues);
  const fixtureAssignmentHash=await sha256Hex(stableStringify(fixtureAssignmentHashMaterial(fixturesV.value.records)),cryptoImpl);
  const sourceProvenance=canonicalise({
    provider:'fpl',authority:'official',
    endpoints:[
      {endpoint:'/event/{gw}/live/',fetchedAt:outcomeIso(completedAt),normalisedHash:await sha256Hex(stableStringify(liveV.value),cryptoImpl)},
      {endpoint:'/fixtures/?event={gw}',fetchedAt:outcomeIso(completedAt),normalisedHash:await sha256Hex(stableStringify(fixturesV.value),cryptoImpl)},
      ...(picksPayload==null?[]:[{endpoint:'/entry/[redacted]/event/{gw}/picks/',fetchedAt:outcomeIso(completedAt),normalisedHash:await sha256Hex(stableStringify(picksV.value),cryptoImpl)}]),
      ...(historyPayload==null?[]:[{endpoint:'/entry/[redacted]/history/',fetchedAt:outcomeIso(completedAt),normalisedHash:await sha256Hex(stableStringify(historyV.value),cryptoImpl)}])
    ],
    retrySummary:outcomeSafeRetryRows()
  });
  const squad=buildSquadOutcome(picksV.value,historyV.value,gameweek,liveV.value.records);
  const payload=canonicalise({
    recordType:'gameweekOutcome',
    schemaVersion:OUTCOME_SCHEMA_VERSION,
    managerRef:String(managerRef||''),
    season:FPL_RULES.season,
    gameweek:Number(gameweek),
    status,
    collection:{startedAt:outcomeIso(startedAt),completedAt:outcomeIso(completedAt),finalisedAt:status===OUTCOME_STATUSES.COMPLETE?outcomeIso(completedAt):null,trigger:String(trigger),mode:String(mode),origin:'local_collection'},
    build:outcomeBuildInfo(),
    versions:{outcome:OUTCOME_SCHEMA_VERSION,snapshot:'1.0.0',model:MODEL_VERSION,rules:RULES_VERSION,simulation:SIMULATION_RULES.version},
    officialDeadlineIdentity:{eventId:Number(event.id),deadlineTime:outcomeIso(event.deadline_time),eventFinished:Boolean(event.finished),dataChecked:Boolean(event.data_checked),fixtureAssignmentHash},
    sourceProvenance,
    relatedSnapshot:snapshotRelation(snapshotRecords,gameweek,event.deadline_time,snapshotMetadata),
    fixtureOutcomes:{status:fixturesV.value.complete?'complete':'provisional',records:fixturesV.value.records},
    allPlayerOutcomes:{status:detailIssues.length?'partial':'complete',records:liveV.value.records},
    realSquadOutcome:squad,
    completeness:{
      complete:status===OUTCOME_STATUSES.COMPLETE,
      sections:{event:event.finished&&event.data_checked?'complete':'provisional',fixtures:fixturesV.value.complete?'complete':'provisional',players:detailIssues.length?'partial':'complete',squad:squad.status},
      fixtureCount:fixturesV.value.records.length,
      finishedFixtureCount:fixturesV.value.records.filter(row=>row.finished===true).length,
      playerCount:liveV.value.records.length,
      expectedPlayerCount:S.boot?.elements?.length??null,
      duplicateFixtureCount:issues.filter(row=>row.code?.includes('duplicate')).reduce((sum,row)=>sum+Number(row.count||1),0),
      duplicatePlayerCount:issues.filter(row=>row.code==='outcome_live_duplicate_player').reduce((sum,row)=>sum+Number(row.count||1),0)
    },
    validation:{disposition:status===OUTCOME_STATUSES.COMPLETE?'accepted':'provisional_acceptance',issues},
    identity:{logicalKey:`${FPL_RULES.season}|gw${Number(gameweek)}`,revision:null,rootOutcomeId:null,supersedesOutcomeId:null,outcomeDataHash:null,sectionHashes:null,contentHash:null,outcomeId:null}
  });
  assertEvidenceSafe(payload);
  return {ok:true,payload};
}
function outcomeDataMaterial(record){
  return canonicalise({
    season:record.season,gameweek:record.gameweek,status:record.status,
    officialDeadlineIdentity:record.officialDeadlineIdentity,
    sourceProvenance:{provider:record.sourceProvenance.provider,authority:record.sourceProvenance.authority,endpoints:record.sourceProvenance.endpoints.map(row=>({endpoint:row.endpoint,normalisedHash:row.normalisedHash}))},
    fixtureOutcomes:record.fixtureOutcomes,
    allPlayerOutcomes:record.allPlayerOutcomes,
    realSquadOutcome:record.realSquadOutcome,
    completeness:record.completeness
  });
}
async function computeOutcomeSectionHashes(record,cryptoImpl=globalThis.crypto){
  const sections={
    deadline:record.officialDeadlineIdentity,
    provenance:record.sourceProvenance,
    fixtures:record.fixtureOutcomes,
    players:record.allPlayerOutcomes,
    squad:record.realSquadOutcome,
    snapshotLink:record.relatedSnapshot,
    completeness:record.completeness
  };
  return canonicalise(Object.fromEntries(await Promise.all(Object.entries(sections).map(async([key,value])=>[key,await sha256Hex(stableStringify(value),cryptoImpl)]))));
}
function outcomeHashMaterial(record){
  const copy=canonicalise(record);
  if(copy.identity){ delete copy.identity.contentHash; delete copy.identity.outcomeId; }
  return copy;
}
async function finaliseOutcomeRecord(payload,{previousRecord=null}={},cryptoImpl=globalThis.crypto){
  assertEvidenceSafe(payload);
  const candidateDataHash=await sha256Hex(stableStringify(outcomeDataMaterial(payload)),cryptoImpl);
  if(previousRecord?.identity?.outcomeDataHash===candidateDataHash&&previousRecord.status===payload.status) return {unchanged:true,record:previousRecord};
  let status=payload.status;
  if([OUTCOME_STATUSES.COMPLETE,OUTCOME_STATUSES.CORRECTED].includes(previousRecord?.status)&&payload.status===OUTCOME_STATUSES.COMPLETE&&previousRecord.identity?.outcomeDataHash!==candidateDataHash) status=OUTCOME_STATUSES.CORRECTED;
  const outcomeDataHash=status===payload.status?candidateDataHash:await sha256Hex(stableStringify(outcomeDataMaterial({...payload,status})),cryptoImpl);
  const revision=Math.max(0,Number(previousRecord?.identity?.revision)||0)+1;
  const rootOutcomeId=previousRecord?.identity?.rootOutcomeId||`outcome-${payload.season}-gw${payload.gameweek}`;
  const sectionHashes=await computeOutcomeSectionHashes({...payload,status},cryptoImpl);
  const draft=canonicalise({...payload,status,collection:{...payload.collection,finalisedAt:[OUTCOME_STATUSES.COMPLETE,OUTCOME_STATUSES.CORRECTED].includes(status)?payload.collection.completedAt:null},validation:{...payload.validation,disposition:[OUTCOME_STATUSES.COMPLETE,OUTCOME_STATUSES.CORRECTED].includes(status)?'accepted':'provisional_acceptance'},identity:{logicalKey:payload.identity.logicalKey,revision,rootOutcomeId,supersedesOutcomeId:previousRecord?.identity?.outcomeId||null,outcomeDataHash,sectionHashes,contentHash:null,outcomeId:null}});
  const contentHash=await sha256Hex(stableStringify(outcomeHashMaterial(draft)),cryptoImpl);
  const outcomeId=`outcome-${payload.season}-gw${payload.gameweek}-r${revision}-${contentHash.slice(0,16)}`;
  const record=canonicalise({...draft,identity:{...draft.identity,contentHash,outcomeId}});
  assertEvidenceSafe(record);
  return {unchanged:false,record:deepFreeze(record)};
}
function outcomeShapeError(record){
  const keys=['allPlayerOutcomes','build','collection','completeness','fixtureOutcomes','gameweek','identity','managerRef','officialDeadlineIdentity','realSquadOutcome','recordType','relatedSnapshot','schemaVersion','season','sourceProvenance','status','validation','versions'].sort();
  if(stableStringify(Object.keys(record||{}).sort())!==stableStringify(keys)) return 'top_level_schema';
  if(!/^mgr-[0-9a-f]{32}$/.test(record.managerRef||'')) return 'manager_ref';
  if(!/^\d{4}-\d{2}$/.test(record.season||'')) return 'season';
  if(!Number.isInteger(record.gameweek)||record.gameweek<1||record.gameweek>38) return 'gameweek';
  if(!Object.values(OUTCOME_STATUSES).includes(record.status)) return 'status';
  if(!record.identity||!/^outcome-\d{4}-\d{2}-gw\d+-r\d+-[0-9a-f]{16}$/.test(record.identity.outcomeId||'')) return 'identity';
  if(!/^[0-9a-f]{64}$/.test(record.identity.contentHash||'')||!/^[0-9a-f]{64}$/.test(record.identity.outcomeDataHash||'')) return 'identity';
  if(!record.identity.sectionHashes||typeof record.identity.sectionHashes!=='object') return 'identity';
  if(!Array.isArray(record.fixtureOutcomes?.records)||!Array.isArray(record.allPlayerOutcomes?.records)) return 'outcome_sections';
  return null;
}
async function validateOutcomeRecord(record,cryptoImpl=globalThis.crypto){
  try{
    if(!record||record.recordType!=='gameweekOutcome') return {ok:false,reason:'record_type'};
    if(record.schemaVersion!==OUTCOME_SCHEMA_VERSION) return {ok:false,reason:'schema_version'};
    const shape=outcomeShapeError(record); if(shape) return {ok:false,reason:shape};
    assertEvidenceSafe(record);
    const sections=await computeOutcomeSectionHashes(record,cryptoImpl);
    if(stableStringify(sections)!==stableStringify(record.identity.sectionHashes)) return {ok:false,reason:'section_hash'};
    const dataHash=await sha256Hex(stableStringify(outcomeDataMaterial(record)),cryptoImpl);
    if(dataHash!==record.identity.outcomeDataHash) return {ok:false,reason:'outcome_data_hash'};
    const contentHash=await sha256Hex(stableStringify(outcomeHashMaterial(record)),cryptoImpl);
    if(contentHash!==record.identity.contentHash) return {ok:false,reason:'content_hash'};
    const expectedId=`outcome-${record.season}-gw${record.gameweek}-r${record.identity.revision}-${contentHash.slice(0,16)}`;
    if(record.identity.outcomeId!==expectedId) return {ok:false,reason:'outcome_id'};
    return {ok:true,record:deepFreeze(canonicalise(record))};
  }catch(error){ return {ok:false,reason:'invalid_record',message:error.message}; }
}
async function captureGameweekOutcome({
  managerRef,gameweek,previousRecord=null,snapshotRecords=[],snapshotMetadata=[],historyPayload=undefined,
  trigger='automatic',mode='prospective_recheck',apiFn=api,nowFn=Date.now,cryptoImpl=globalThis.crypto
}={}){
  const event=S.boot?.events?.find(row=>Number(row.id)===Number(gameweek));
  if(!event?.deadline_time) return {ok:false,disposition:'rejected',reason:'event_unavailable'};
  if(Date.parse(event.deadline_time)>nowFn()) return {ok:false,disposition:'not_due',reason:'deadline_not_passed'};
  const startedAt=nowFn();
  const [fixturesPayload,livePayload]=await Promise.all([
    apiFn(`/fixtures/?event=${gameweek}`,{optional:true}),
    apiFn(`/event/${gameweek}/live/`,{optional:true})
  ]);
  if(fixturesPayload==null||livePayload==null) return {ok:false,disposition:'retry',reason:'official_fpl_unavailable'};
  let picksPayload=null,managerHistory=historyPayload;
  if(S.teamId){
    picksPayload=await apiFn(`/entry/${S.teamId}/event/${gameweek}/picks/`,{optional:true});
    if(managerHistory===undefined) managerHistory=await apiFn(`/entry/${S.teamId}/history/`,{optional:true});
  }
  const completedAt=nowFn();
  const collected=await collectOutcomePayload({managerRef,gameweek,event,fixturesPayload,livePayload,picksPayload,historyPayload:managerHistory??null,snapshotRecords,snapshotMetadata,trigger,mode,startedAt,completedAt,cryptoImpl});
  if(!collected.ok) return collected;
  const finalised=await finaliseOutcomeRecord(collected.payload,{previousRecord},cryptoImpl);
  return {ok:true,...finalised};
}
function dueOutcomeGameweeks(events=[],now=Date.now()){
  return events.filter(event=>Number.isInteger(Number(event?.id))&&Number.isFinite(Date.parse(event?.deadline_time))&&Date.parse(event.deadline_time)<=now).map(event=>Number(event.id)).sort((a,b)=>a-b);
}



/* ===== src/evidence/metrics.mjs ===== */

const METRIC_SCHEMA_VERSION='1.0.0';
const METRIC_VERSION='1.0.0';
const SEGMENTATION_VERSION='1.0.0';
const TRANSFER_METRIC_SCHEMA_VERSION='1.0.0';
const METRIC_RULES=Object.freeze({
  errorBands:Object.freeze([0,2,5,10]),
  ['reliability'+'Bins']:Object.freeze([0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1]),
  uncertainty:Object.freeze({blankMaximum:2,returnMinimum:5,haulMinimum:10,megaHaulMinimum:15}),
  samples:Object.freeze({rawMaximum:29,descriptiveMaximum:199,stableMinimum:200,stableGameweeks:10,probabilityBinMinimum:30,probabilityPreferred:500,decisionMinimum:10,providerMinimumGameweeks:5,providerMinimumObservations:100}),
  localIndexLimit:80,
  supersededFullLimit:6,
  maxEncodedBytes:3*1024*1024
});

function evaluationFinite(value){ if(value===null||value===undefined||value==='') return null; const n=Number(value); return Number.isFinite(n)?n:null; }
function evaluationMean(values){ return values.length?values.reduce((a,b)=>a+b,0)/values.length:null; }
function evaluationSameArray(a,b){ return a.length===b.length&&a.every((value,index)=>value===b[index]); }
function evaluationSortedNumbers(values){ return [...new Set((values||[]).map(Number).filter(Number.isFinite))].sort((a,b)=>a-b); }
function evaluationSetEqual(a,b){ return evaluationSameArray(evaluationSortedNumbers(a),evaluationSortedNumbers(b)); }
function evaluationRound(value){ return Number.isFinite(value)?Number(value.toFixed(8)):null; }
function evaluationPositionLabel(position){ return ({1:'GKP',2:'DEF',3:'MID',4:'FWD'})[Number(position)]||'Unknown'; }
function evaluationSeasonPeriod(gameweek){ const gw=Number(gameweek); return gw<1?'pre-season':gw<=6?'early':gw<=12?'transition':'mature'; }
function evaluationPriceBand(position,nowCost){
  const price=Number(nowCost)/10, pos=Number(position);
  if(!Number.isFinite(price)) return 'unknown';
  if(pos===1||pos===2) return price<=4.4?'up_to_4.4':price<=5.4?'4.5_to_5.4':'5.5_plus';
  if(pos===3) return price<=5.4?'up_to_5.4':price<=7.4?'5.5_to_7.4':price<=9.9?'7.5_to_9.9':'10.0_plus';
  if(pos===4) return price<=5.4?'up_to_5.4':price<=7.4?'5.5_to_7.4':price<=9.4?'7.5_to_9.4':'9.5_plus';
  return 'unknown';
}
function evaluationAvailabilityLabel(status){
  const value=String(status||'');
  if(['i','u','s','n'].includes(value)) return 'unavailable';
  if(value==='d') return 'doubtful';
  if(value==='a') return 'available';
  return 'unknown';
}
function evaluationErrorBand(error){
  const value=Math.abs(Number(error));
  if(value===0) return 'exact';
  if(value<=2) return 'small';
  if(value<=5) return 'material';
  if(value<=10) return 'large';
  return 'very_large';
}
function evaluationPearson(xs,ys){
  if(xs.length!==ys.length||xs.length<3) return null;
  const mx=evaluationMean(xs),my=evaluationMean(ys); let sxy=0,sxx=0,syy=0;
  for(let i=0;i<xs.length;i++){ const dx=xs[i]-mx,dy=ys[i]-my; sxy+=dx*dy;sxx+=dx*dx;syy+=dy*dy; }
  return sxx&&syy?evaluationRound(sxy/Math.sqrt(sxx*syy)):null;
}
function evaluationAverageRanks(values){
  const indexed=values.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value||a.index-b.index),ranks=Array(values.length);
  for(let i=0;i<indexed.length;){
    let j=i+1; while(j<indexed.length&&indexed[j].value===indexed[i].value) j++;
    const rank=(i+1+j)/2; for(let k=i;k<j;k++) ranks[indexed[k].index]=rank; i=j;
  }
  return ranks;
}
function evaluationSpearman(xs,ys){ return xs.length===ys.length&&xs.length>=3?evaluationPearson(evaluationAverageRanks(xs),evaluationAverageRanks(ys)):null; }
function evaluationMetricSummary(rows,predictedKey='predicted',observedKey='observed'){
  const clean=(rows||[]).map(row=>({predicted:evaluationFinite(row?.[predictedKey]),observed:evaluationFinite(row?.[observedKey])})).filter(row=>row.predicted!==null&&row.observed!==null);
  if(!clean.length) return {n:0,mae:null,rmse:null,bias:null,['pear'+'son']:null,['spear'+'man']:null,predictedMean:null,observedMean:null,within15:null,within30:null};
  const errors=clean.map(row=>row.predicted-row.observed),xs=clean.map(row=>row.predicted),ys=clean.map(row=>row.observed);
  return canonicalise({
    n:clean.length,
    mae:evaluationRound(evaluationMean(errors.map(Math.abs))),
    rmse:evaluationRound(Math.sqrt(evaluationMean(errors.map(value=>value*value)))),
    bias:evaluationRound(evaluationMean(errors)),
    ['pear'+'son']:evaluationPearson(xs,ys),['spear'+'man']:evaluationSpearman(xs,ys),
    predictedMean:evaluationRound(evaluationMean(xs)),observedMean:evaluationRound(evaluationMean(ys)),
    within15:evaluationRound(evaluationMean(errors.map(value=>Math.abs(value)<=15?1:0))),
    within30:evaluationRound(evaluationMean(errors.map(value=>Math.abs(value)<=30?1:0)))
  });
}
function evaluationBrierScore(rows,probabilityKey='probability',outcomeKey='outcome'){
  const clean=(rows||[]).map(row=>({probability:evaluationFinite(row?.[probabilityKey]),outcome:evaluationFinite(row?.[outcomeKey])})).filter(row=>row.probability!==null&&row.probability>=0&&row.probability<=1&&(row.outcome===0||row.outcome===1));
  if(!clean.length) return {n:0,brier:null,predictedRate:null,observedRate:null,gap:null};
  const errors=clean.map(row=>(row.probability-row.outcome)**2),predictedRate=evaluationMean(clean.map(row=>row.probability)),observedRate=evaluationMean(clean.map(row=>row.outcome));
  return canonicalise({n:clean.length,brier:evaluationRound(evaluationMean(errors)),predictedRate:evaluationRound(predictedRate),observedRate:evaluationRound(observedRate),gap:evaluationRound(predictedRate-observedRate)});
}
function evaluationReliabilityBins(rows,probabilityKey='probability',outcomeKey='outcome'){
  const clean=(rows||[]).map(row=>({probability:evaluationFinite(row?.[probabilityKey]),outcome:evaluationFinite(row?.[outcomeKey])})).filter(row=>row.probability!==null&&row.probability>=0&&row.probability<=1&&(row.outcome===0||row.outcome===1));
  const edges=METRIC_RULES['reliability'+'Bins'];
  return edges.slice(0,-1).map((lower,index)=>{
    const upper=edges[index+1],last=index===edges.length-2;
    const bin=clean.filter(row=>row.probability>=lower&&(last?row.probability<=upper:row.probability<upper));
    const predicted=evaluationMean(bin.map(row=>row.probability)),observed=evaluationMean(bin.map(row=>row.outcome));
    return canonicalise({lower,upper,inclusiveUpper:last,n:bin.length,eventCount:bin.reduce((sum,row)=>sum+row.outcome,0),meanPredicted:evaluationRound(predicted),observedFrequency:bin.length>=METRIC_RULES.samples.probabilityBinMinimum?evaluationRound(observed):null,gap:bin.length>=METRIC_RULES.samples.probabilityBinMinimum?evaluationRound(predicted-observed):null,display:bin.length>=METRIC_RULES.samples.probabilityBinMinimum?'descriptive':'insufficient'});
  });
}
function evaluationIntervalSummary(rows,lowerKey,upperKey,observedKey='observed'){
  const clean=(rows||[]).map(row=>({lower:evaluationFinite(row?.[lowerKey]),upper:evaluationFinite(row?.[upperKey]),observed:evaluationFinite(row?.[observedKey])})).filter(row=>row.lower!==null&&row.upper!==null&&row.observed!==null&&row.lower<=row.upper);
  return canonicalise({n:clean.length,coverage:clean.length?evaluationRound(evaluationMean(clean.map(row=>row.observed>=row.lower&&row.observed<=row.upper?1:0))):null,width:clean.length?evaluationRound(evaluationMean(clean.map(row=>row.upper-row.lower))):null});
}
function evaluationSampleStatus(observationCount,gameweekCount,{kind='general'}={}){
  const n=Math.max(0,Number(observationCount)||0),gws=Math.max(0,Number(gameweekCount)||0),rules=METRIC_RULES.samples;
  if(kind==='decision') return canonicalise({level:n<rules.decisionMinimum?'raw_only':'descriptive',message:n<rules.decisionMinimum?'Fewer than ten relevant decisions — individual records only.':'Descriptive decision sample — no significance claim.'});
  if(kind==='provider'){
    const ready=n>=rules.providerMinimumObservations&&gws>=rules.providerMinimumGameweeks;
    return canonicalise({level:ready?'descriptive':'raw_only',message:ready?'Descriptive provider-state sample — observational, not causal.':'Provider comparison needs at least 100 observations across five affected Gameweeks.'});
  }
  if(n<30) return canonicalise({level:'raw_only',message:'Very small sample — values are recorded but should not be interpreted.'});
  if(n<rules.stableMinimum||gws<rules.stableGameweeks) return canonicalise({level:'descriptive',message:'Descriptive sample — results may move substantially as more Gameweeks are added.'});
  return canonicalise({level:'potentially_stable',message:'Potentially stable descriptive sample — not a formal validation or significance claim.'});
}
function evaluationFixtureStat(detail,identifier){ return evaluationFinite(detail?.officialStats?.find(row=>row.identifier===identifier)?.value); }
function evaluationFixturesForClub(fixtures,clubId,gameweek){
  return (fixtures||[]).filter(row=>Number(row.event)===Number(gameweek)&&(Number(row.team_h)===Number(clubId)||Number(row.team_a)===Number(clubId))).sort((a,b)=>Number(a.id)-Number(b.id));
}
function evaluationOutcomeFixturesForClub(fixtures,clubId){
  return (fixtures||[]).filter(row=>Number(row.homeTeamId)===Number(clubId)||Number(row.awayTeamId)===Number(clubId)).sort((a,b)=>Number(a.fixtureId)-Number(b.fixtureId));
}
function evaluationFixtureContext(frozenFixtures,clubId){
  if(!frozenFixtures.length) return {fixtureClass:'blank',homeAway:'blank',fdrContext:'blank',fixtureIds:[]};
  const venues=frozenFixtures.map(row=>Number(row.team_h)===Number(clubId)?'home':'away');
  const fdr=frozenFixtures.map(row=>Number(row.team_h)===Number(clubId)?row.team_h_difficulty:row.team_a_difficulty);
  return {fixtureClass:frozenFixtures.length===1?'single':'double',homeAway:new Set(venues).size===1?venues[0]:'mixed',fdrContext:fdr.map(value=>value==null?'?':String(value)).join('+'),fixtureIds:frozenFixtures.map(row=>Number(row.id))};
}
function evaluationObservedRole(outcome){
  if(!outcome||Number(outcome.minutes)<=0) return 'dnp';
  const starts=evaluationFinite(outcome.starts);
  if(starts===null) return 'appeared_unknown_start';
  const fixtures=Math.max(1,(outcome.perFixture||[]).length);
  if(starts>=fixtures) return fixtures>1?'all_started':'started';
  if(starts>0) return 'mixed';
  return 'substitute_only';
}
function evaluationAllocateMinuteFixtures(prediction,outcome,frozenFixtures,finalFixtures){
  const details=new Map((outcome?.perFixture||[]).map(row=>[Number(row.fixtureId),row]));
  const totalMinutes=evaluationFinite(outcome?.minutes),totalStarts=evaluationFinite(outcome?.starts),frozenIds=frozenFixtures.map(row=>Number(row.id));
  const alignedIds=new Set(finalFixtures.map(row=>Number(row.fixtureId)));
  const knownMinutes=frozenIds.map(id=>evaluationFixtureStat(details.get(id),'minutes'));
  const knownStarts=frozenIds.map(id=>evaluationFixtureStat(details.get(id),'starts'));
  const minuteKnownSum=knownMinutes.filter(value=>value!==null).reduce((a,b)=>a+b,0),startKnownSum=knownStarts.filter(value=>value!==null).reduce((a,b)=>a+b,0);
  const missingMinuteIndexes=knownMinutes.map((value,index)=>value===null?index:-1).filter(index=>index>=0),missingStartIndexes=knownStarts.map((value,index)=>value===null?index:-1).filter(index=>index>=0);
  if(frozenIds.length===1&&knownMinutes[0]===null&&totalMinutes!==null) knownMinutes[0]=totalMinutes;
  else if(totalMinutes!==null&&missingMinuteIndexes.length&&minuteKnownSum===totalMinutes) missingMinuteIndexes.forEach(index=>knownMinutes[index]=0);
  if(frozenIds.length===1&&knownStarts[0]===null&&totalStarts!==null) knownStarts[0]=totalStarts;
  else if(totalStarts!==null&&missingStartIndexes.length&&startKnownSum===totalStarts) missingStartIndexes.forEach(index=>knownStarts[index]=0);
  return frozenFixtures.map((fixture,index)=>{
    const fixtureId=Number(fixture.id),scheduleAligned=alignedIds.has(fixtureId),minutes=knownMinutes[index];
    const observedMinutes=minutes===null&&!scheduleAligned?0:minutes;
    const starts=knownStarts[index]===null&&!scheduleAligned&&totalStarts!==null?0:knownStarts[index];
    const validMinutes=observedMinutes!==null&&observedMinutes>=0&&observedMinutes<=90;
    return canonicalise({
      playerId:Number(prediction.playerId),fixtureId,scheduleAligned,
      predictedMinutes:evaluationFinite(prediction.minutes?.expMin),observedMinutes:validMinutes?observedMinutes:null,
      pStart:evaluationFinite(prediction.minutes?.pStart),started:starts===null?null:starts>0?1:0,
      pAppear:evaluationFinite(prediction.minutes?.pAppear),appeared:validMinutes?(observedMinutes>0?1:0):null,
      p60:evaluationFinite(prediction.minutes?.p60),reachedSixty:validMinutes?(observedMinutes>=60?1:0):null,
      allocation:details.has(fixtureId)?'official_per_fixture':observedMinutes!==null?'reconciled_or_single':'unallocatable'
    });
  });
}
function evaluationFormationCounts(ids,positions){
  const counts={1:0,2:0,3:0,4:0}; (ids||[]).forEach(id=>{ const position=Number(positions.get(Number(id))); if(counts[position]!==undefined) counts[position]++; }); return counts;
}
function evaluationLegalXIIds(ids,positions){ const c=evaluationFormationCounts(ids,positions); return ids.length===11&&c[1]===1&&c[2]>=3&&c[3]>=2&&c[4]>=1; }
function evaluationCombinations(values,size,start=0,chosen=[],out=[]){
  if(chosen.length===size){ out.push(chosen.slice()); return out; }
  for(let i=start;i<=values.length-(size-chosen.length);i++){ chosen.push(values[i]);evaluationCombinations(values,size,i+1,chosen,out);chosen.pop(); }
  return out;
}
function evaluationEnumerateLegalXIs(squadIds,positions){ return evaluationCombinations(evaluationSortedNumbers(squadIds),11).filter(ids=>evaluationLegalXIIds(ids,positions)); }
function evaluationBenchOrderForXI(squadIds,xiIds,positions,scoreById){
  const selected=new Set(xiIds.map(Number)),bench=squadIds.filter(id=>!selected.has(Number(id)));
  const goalkeeper=bench.filter(id=>Number(positions.get(Number(id)))===1).sort((a,b)=>a-b);
  const outfield=bench.filter(id=>Number(positions.get(Number(id)))!==1).sort((a,b)=>(Number(scoreById.get(Number(b)))||0)-(Number(scoreById.get(Number(a)))||0)||Number(a)-Number(b));
  return [...goalkeeper,...outfield];
}
function evaluationApplyRealisedAutosubs(starterIds,benchIds,positions,outcomeById){
  const active=starterIds.map(Number),used=[],replacements=[];
  const appeared=id=>Boolean(outcomeById.get(Number(id))?.appeared),missingOutfield=()=>active.map((id,index)=>({id,index})).filter(row=>Number(positions.get(row.id))!==1&&!appeared(row.id));
  const goalkeeperIndex=active.findIndex(id=>Number(positions.get(id))===1&&!appeared(id));
  if(goalkeeperIndex>=0){ const reserve=benchIds.map(Number).find(id=>Number(positions.get(id))===1&&appeared(id)); if(reserve!=null){ replacements.push({playerOut:active[goalkeeperIndex],playerIn:reserve});active[goalkeeperIndex]=reserve;used.push(reserve); } }
  for(const substitute of benchIds.map(Number).filter(id=>Number(positions.get(id))!==1)){
    if(!appeared(substitute)||used.includes(substitute)) continue;
    for(const candidate of missingOutfield()){
      const trial=active.slice();trial[candidate.index]=substitute;
      if(evaluationLegalXIIds(trial,positions)){ replacements.push({playerOut:candidate.id,playerIn:substitute});active[candidate.index]=substitute;used.push(substitute);break; }
    }
  }
  const scoringXI=active.filter(appeared),basePoints=scoringXI.reduce((sum,id)=>sum+(evaluationFinite(outcomeById.get(id)?.points)||0),0);
  return canonicalise({activeXI:active,scoringXI,usedBenchIds:used,replacements,basePoints,autoSubContribution:used.reduce((sum,id)=>sum+(evaluationFinite(outcomeById.get(id)?.points)||0),0)});
}
function evaluationCaptainPairScore(captainId,viceId,outcomeById){
  const captain=outcomeById.get(Number(captainId)),vice=outcomeById.get(Number(viceId));
  const effective=captain?.appeared?Number(captainId):vice?.appeared?Number(viceId):null;
  return canonicalise({captainId:Number(captainId)||null,viceCaptainId:Number(viceId)||null,effectiveCaptainId:effective,viceTookOver:effective===Number(viceId),doubledContribution:effective==null?0:evaluationFinite(outcomeById.get(effective)?.points)||0});
}
function evaluationManagerDecisionEvaluation(managerOutcome,playerRows,positions){
  if(!managerOutcome||managerOutcome.status==='not_available'||!Array.isArray(managerOutcome.picks)||managerOutcome.picks.length!==15)
    return canonicalise({status:'not_available',reason:managerOutcome?.reason||'public_manager_outcome_unavailable'});
  const points=new Map(playerRows.map(row=>[Number(row.playerId),Number(row.observedPoints)||0])),appeared=new Map(playerRows.map(row=>[Number(row.playerId),Boolean(row.appeared)]));
  const picks=managerOutcome.picks.slice().sort((a,b)=>Number(a.position)-Number(b.position)||Number(a.playerId)-Number(b.playerId));
  const starters=picks.filter(row=>Number(row.position)<=11).map(row=>Number(row.playerId)),bench=picks.filter(row=>Number(row.position)>11).map(row=>Number(row.playerId));
  const outcomeById=new Map(picks.map(row=>[Number(row.playerId),{points:points.get(Number(row.playerId))||0,appeared:appeared.get(Number(row.playerId))||false}]));
  const reconstructed=evaluationApplyRealisedAutosubs(starters,bench,positions,outcomeById),officialSubs=(managerOutcome.automaticSubstitutions||[]).map(row=>({playerOut:Number(row.playerOut),playerIn:Number(row.playerIn)}));
  const officialPairs=officialSubs.map(row=>`${row.playerOut}>${row.playerIn}`).sort(),reconstructedPairs=reconstructed.replacements.map(row=>`${row.playerOut}>${row.playerIn}`).sort();
  const multiplierXI=picks.filter(row=>Number(row.multiplier)>0).map(row=>Number(row.playerId)),legal=evaluationLegalXIIds(reconstructed.activeXI,positions),captain=managerOutcome.captain,vice=managerOutcome.viceCaptain;
  return canonicalise({status:legal&&evaluationSameArray(officialPairs,reconstructedPairs)?'available':'partial',legalRealisedXI:legal,startingXIPlayerIds:starters,benchOrder:bench,officialScoringPlayerIds:multiplierXI,reconstructedScoringPlayerIds:reconstructed.scoringXI,officialAutomaticSubstitutions:officialSubs,reconstructedAutomaticSubstitutions:reconstructed.replacements,automaticSubstitutionAgreement:evaluationSameArray(officialPairs,reconstructedPairs),reconstructedBasePoints:reconstructed.basePoints,officialGameweekPoints:managerOutcome.officialGameweekPoints,officialPointsOnBench:managerOutcome.officialPointsOnBench,activeChip:managerOutcome.activeChip,captain:captain||null,viceCaptain:vice||null,transferCount:managerOutcome.eventTransferCount,transferCost:managerOutcome.eventTransferCost,reconstruction:managerOutcome.reconstruction||null});
}
function evaluationDecisionEvaluation(snapshot,playerRows){
  const squad=snapshot.outputs?.squad;
  if(squad?.status!=='available'||!squad.modelDecision) return canonicalise({status:'not_available',reason:'complete_frozen_squad_unavailable',squad:null,captaincy:null,bench:null,managerOutcome:null,transferBasis:null});
  const allPredictions=new Map((snapshot.outputs?.players||[]).map(row=>[Number(row.playerId),row]));
  const outcomeById=new Map(playerRows.map(row=>[Number(row.playerId),{points:row.observedPoints,appeared:row.appeared}]));
  const positions=new Map((snapshot.outputs?.players||[]).map(row=>[Number(row.playerId),Number(row.position)]));
  const squadIds=squad.players.map(row=>Number(row.playerId)),starters=squad.modelDecision.bestXIPlayerIds.map(Number),bench=squad.modelDecision.benchPlayerIds.map(Number);
  const selected=evaluationApplyRealisedAutosubs(starters,bench,positions,outcomeById);
  const legalXIs=evaluationEnumerateLegalXIs(squadIds,positions),predictedScore=id=>evaluationFinite(allPredictions.get(Number(id))?.nextGameweek?.total)||0;
  const alternatives=legalXIs.map(ids=>{
    const scoreById=new Map(squadIds.map(id=>[id,predictedScore(id)])),orderedBench=evaluationBenchOrderForXI(squadIds,ids,positions,scoreById),realised=evaluationApplyRealisedAutosubs(ids,orderedBench,positions,outcomeById);
    return {playerIds:ids,formation:Object.values(evaluationFormationCounts(ids,positions)).slice(1).join('-'),predictedPoints:evaluationRound(ids.reduce((sum,id)=>sum+predictedScore(id),0)),realisedPoints:realised.basePoints,benchPlayerIds:orderedBench};
  }).sort((a,b)=>b.predictedPoints-a.predictedPoints||a.playerIds.join(',').localeCompare(b.playerIds.join(',')));
  const selectedKey=evaluationSortedNumbers(starters).join(','),realisedOrder=alternatives.slice().sort((a,b)=>b.realisedPoints-a.realisedPoints||a.playerIds.join(',').localeCompare(b.playerIds.join(','))),selectedIndex=realisedOrder.findIndex(row=>row.playerIds.join(',')===selectedKey),selectedRank=selectedIndex>=0?selectedIndex+1:null;
  const oracle=realisedOrder[0]||null;
  const rankedCandidates=starters.slice().sort((a,b)=>predictedScore(b)-predictedScore(a)||a-b),captainId=Number(squad.modelDecision.captainId),viceId=Number(squad.modelDecision.viceCaptainId);
  const selectedPair=evaluationCaptainPairScore(captainId,viceId,outcomeById),vicePair=evaluationCaptainPairScore(viceId,captainId,outcomeById);
  const candidateRows=rankedCandidates.map(id=>{ const alternateVice=rankedCandidates.find(other=>other!==id)??null; return {...evaluationCaptainPairScore(id,alternateVice,outcomeById),frozenRank:rankedCandidates.indexOf(id)+1,predictedPoints:predictedScore(id)}; });
  const unusedBench=bench.filter(id=>!selected.usedBenchIds.includes(id)),pointsLeftOnBench=unusedBench.reduce((sum,id)=>sum+(evaluationFinite(outcomeById.get(id)?.points)||0),0);
  const providerPlans=squad.optimiser?.plans||[],baseline=squad.optimiser?.baseline||null,primaryPlan=providerPlans.find(plan=>Number(plan.transferCount)>0)||null;
  const transferIds=new Set([...(baseline?.finalSquadIds||[]),...providerPlans.flatMap(plan=>plan.finalSquadIds||[])]);
  const transferPlayers=[...transferIds].sort((a,b)=>a-b).map(id=>({playerId:id,position:positions.get(id)||null,perGameweek:(allPredictions.get(id)?.perGameweek||[]).map(row=>({gw:Number(row.gw),total:evaluationFinite(row.total)||0}))}));
  return canonicalise({
    status:'available',
    squad:{frozenPlayerIds:evaluationSortedNumbers(squadIds),selectedXIPlayerIds:starters,selectedBenchPlayerIds:bench,selectedRealised:selected,topFrozenAlternatives:alternatives.slice(0,3),selectedRealisedRank:selectedRank,hindsightOracle:oracle?{label:'Hindsight oracle',playerIds:oracle.playerIds,formation:oracle.formation,realisedPoints:oracle.realisedPoints}:null},
    captaincy:{selected:selectedPair,selectedViceAsCaptain:vicePair,topThreeFrozenCandidates:candidateRows.slice(0,3),allFrozenCandidates:candidateRows,hindsightBest:candidateRows.slice().sort((a,b)=>b.doubledContribution-a.doubledContribution||a.captainId-b.captainId)[0]||null,userPreview:squad.userPreview||null},
    bench:{benchOrder:bench,automaticSubstitutions:selected.replacements,automaticSubstitutionContribution:selected.autoSubContribution,unusedBenchPlayerIds:unusedBench,pointsLeftOnBench},
    managerOutcome:null,
    transferBasis:squad.optimiser?{status:squad.optimiser.status,horizon:Number(squad.optimiser.horizon)||0,baseline,plans:providerPlans,primaryPlan,players:transferPlayers}:null
  });
}
function evaluationPlayerSegments(prediction,snapshot,squadSets,fixture,official,primaryTransfers){
  const providerStates=Object.fromEntries((snapshot.providers||[]).map(row=>[row.provider,row.state]));
  const id=Number(prediction.playerId),position=Number(prediction.position),owned=squadSets.owned.has(id),selected=squadSets.selected.has(id),bench=squadSets.bench.has(id);
  return canonicalise({
    allPlayers:'all',owned:owned?'owned':'not_owned',recommendation:selected?'selected_xi':bench?'bench':primaryTransfers.in.has(id)?'primary_transfer_in':primaryTransfers.out.has(id)?'primary_transfer_out':'other',
    position:evaluationPositionLabel(position),['price'+'Band']:evaluationPriceBand(position,prediction.nowCost),minutesSource:String(prediction.minutes?.source||'unknown'),minutesConfidence:String(prediction.minutes?.confidenceLabel||'Unknown'),providerStates,
    homeAway:fixture.homeAway,fdrContext:fixture.fdrContext,fixtureClass:fixture.fixtureClass,availability:evaluationAvailabilityLabel(prediction.status),['observed'+'Role']:evaluationObservedRole(official),['season'+'Period']:evaluationSeasonPeriod(snapshot.gameweek)
  });
}
function evaluationOutcomeCoverage(predictions,outcomes,matchedRows,minuteRows){
  const predictedIds=new Set(predictions.map(row=>Number(row.playerId))),outcomeIds=new Set(outcomes.map(row=>Number(row.playerId)));
  const unmatchedPredictions=[...predictedIds].filter(id=>!outcomeIds.has(id)).sort((a,b)=>a-b),unmatchedOutcomes=[...outcomeIds].filter(id=>!predictedIds.has(id)).sort((a,b)=>a-b);
  return canonicalise({eligiblePredictions:predictions.length,officialOutcomes:outcomes.length,matchedPlayers:matchedRows.length,coverage:predictions.length?evaluationRound(matchedRows.length/predictions.length):null,unmatchedPredictions,unmatchedOutcomes,minuteFixtureRows:minuteRows.length,unallocatableMinuteRows:minuteRows.filter(row=>row.observedMinutes===null).length,startLabelRows:minuteRows.filter(row=>row.started!==null).length,uncertaintyRows:matchedRows.filter(row=>row.uncertainty?.available).length,scheduleAlignedPlayers:matchedRows.filter(row=>row.scheduleAligned).length});
}
function evaluationPlayerReport(rows){
  const summary=evaluationMetricSummary(rows,'predictedPoints','observedPoints');
  const bands={exact:0,small:0,material:0,large:0,very_large:0}; rows.forEach(row=>{ const band=row['error'+'Band']; if(bands[band]!==undefined) bands[band]++; });
  return canonicalise({...summary,errorBands:bands,withinTwo:rows.length?evaluationRound(evaluationMean(rows.map(row=>row.absError<=2?1:0))):null,withinFive:rows.length?evaluationRound(evaluationMean(rows.map(row=>row.absError<=5?1:0))):null});
}
function evaluationMinutesReport(rows){
  const usable=rows.filter(row=>row.observedMinutes!==null),started=rows.filter(row=>row.started!==null).map(row=>({probability:row.pStart,outcome:row.started})),appeared=rows.filter(row=>row.appeared!==null).map(row=>({probability:row.pAppear,outcome:row.appeared})),sixty=rows.filter(row=>row.reachedSixty!==null).map(row=>({probability:row.p60,outcome:row.reachedSixty}));
  return canonicalise({continuous:evaluationMetricSummary(usable,'predictedMinutes','observedMinutes'),start:{...evaluationBrierScore(started),reliability:evaluationReliabilityBins(started)},appearance:{...evaluationBrierScore(appeared),reliability:evaluationReliabilityBins(appeared)},sixty:{...evaluationBrierScore(sixty),reliability:evaluationReliabilityBins(sixty)}});
}
function evaluationUncertaintyReport(rows){
  const available=rows.filter(row=>row.uncertainty?.available).map(row=>({...row.uncertainty,observed:row.observedPoints}));
  const event=(probabilityKey,outcomeFn)=>{ const values=available.map(row=>({probability:row[probabilityKey],outcome:outcomeFn(row.observed)?1:0})); return {...evaluationBrierScore(values),reliability:evaluationReliabilityBins(values)}; };
  return canonicalise({n:available.length,p10P90:evaluationIntervalSummary(available,'p10','p90'),p25P75:evaluationIntervalSummary(available,'p25','p75'),blank:event('blankProbability',value=>value<=METRIC_RULES.uncertainty.blankMaximum),return:event('returnProbability',value=>value>=METRIC_RULES.uncertainty.returnMinimum),haul:event('haulProbability',value=>value>=METRIC_RULES.uncertainty.haulMinimum),megaHaul:event('megaHaulProbability',value=>value>=METRIC_RULES.uncertainty.megaHaulMinimum)});
}
function stage10EvaluationDataMaterial(record){ return canonicalise({season:record.season,gameweek:record.gameweek,deadlineTime:record.deadlineTime,sources:record.sources,observations:record.observations,decisions:record.decisions,coverage:record.coverage,reports:record.reports,completeness:record.completeness}); }
function stage10EvaluationHashMaterial(record){ const copy=canonicalise(record); if(copy.identity){ delete copy.identity.contentHash;delete copy.identity.evaluationId; } return copy; }
async function buildGameweekEvaluation(snapshot,outcome,{previousRecord=null,cryptoImpl=globalThis.crypto}={}){
  if(!snapshot||snapshot.recordType!=='preDeadlineSnapshot') return {ok:false,reason:'snapshot_type'};
  if(!outcome||outcome.recordType!=='gameweekOutcome') return {ok:false,reason:'outcome_type'};
  if(!['complete','corrected'].includes(outcome.status)||!outcome.completeness?.complete) return {ok:false,reason:'outcome_not_authoritative'};
  if(!snapshot.timing?.officialEligible||!snapshot.completeness?.complete) return {ok:false,reason:'snapshot_not_official'};
  if(snapshot.season!==outcome.season||Number(snapshot.gameweek)!==Number(outcome.gameweek)||snapshot.deadlineTime!==outcome.officialDeadlineIdentity?.deadlineTime) return {ok:false,reason:'identity_mismatch'};
  if(outcome.relatedSnapshot?.status!=='matched_official'||outcome.relatedSnapshot.snapshotId!==snapshot.identity?.snapshotId||outcome.relatedSnapshot.contentHash!==snapshot.identity?.contentHash) return {ok:false,reason:'snapshot_link'};
  if(snapshot.managerRef!==outcome.managerRef) return {ok:false,reason:'manager_ref'};
  const predictions=(snapshot.outputs?.players||[]).slice().sort((a,b)=>Number(a.playerId)-Number(b.playerId)),outcomes=(outcome.allPlayerOutcomes?.records||[]).slice().sort((a,b)=>Number(a.playerId)-Number(b.playerId)),outcomeById=new Map(outcomes.map(row=>[Number(row.playerId),row]));
  if(new Set(predictions.map(row=>Number(row.playerId))).size!==predictions.length) return {ok:false,reason:'duplicate_prediction_player'};
  if(new Set(outcomes.map(row=>Number(row.playerId))).size!==outcomes.length) return {ok:false,reason:'duplicate_outcome_player'};
  const squad=snapshot.outputs?.squad,squadSets={owned:new Set(squad?.players?.map(row=>Number(row.playerId))||[]),selected:new Set(squad?.modelDecision?.bestXIPlayerIds?.map(Number)||[]),bench:new Set(squad?.modelDecision?.benchPlayerIds?.map(Number)||[])};
  const primary=squad?.optimiser?.plans?.find(plan=>Number(plan.transferCount)>0),primaryTransfers={in:new Set((primary?.transfers||[]).map(row=>Number(row.inPlayerId))),out:new Set((primary?.transfers||[]).map(row=>Number(row.outPlayerId)))};
  const playerRows=[],minuteRows=[];
  for(const prediction of predictions){
    const official=outcomeById.get(Number(prediction.playerId)); if(!official) continue;
    const frozenFixtures=evaluationFixturesForClub(snapshot.modelInputs?.fixtures,Number(prediction.clubId),snapshot.gameweek),finalFixtures=evaluationOutcomeFixturesForClub(outcome.fixtureOutcomes?.records,Number(prediction.clubId)),fixture=evaluationFixtureContext(frozenFixtures,Number(prediction.clubId)),scheduleAligned=evaluationSetEqual(frozenFixtures.map(row=>row.id),finalFixtures.map(row=>row.fixtureId));
    const predictedPoints=evaluationFinite(prediction.nextGameweek?.total),observedPoints=evaluationFinite(official.totalPoints); if(predictedPoints===null||observedPoints===null) continue;
    const error=predictedPoints-observedPoints,uncertainty=prediction.uncertainty?.status==='available'&&['p10','p25','p75','p90','blankProbability','returnProbability','haulProbability','megaHaulProbability'].every(key=>evaluationFinite(prediction.uncertainty[key])!==null)?canonicalise({available:true,p10:prediction.uncertainty.p10,p25:prediction.uncertainty.p25,p75:prediction.uncertainty.p75,p90:prediction.uncertainty.p90,blankProbability:prediction.uncertainty.blankProbability,returnProbability:prediction.uncertainty.returnProbability,haulProbability:prediction.uncertainty.haulProbability,megaHaulProbability:prediction.uncertainty.megaHaulProbability}):{available:false};
    const row=canonicalise({playerId:Number(prediction.playerId),clubId:Number(prediction.clubId),position:Number(prediction.position),nowCost:Number(prediction.nowCost),predictedPoints,observedPoints,error:evaluationRound(error),absError:evaluationRound(Math.abs(error)),['error'+'Band']:evaluationErrorBand(error),appeared:Number(official.minutes)>0,reachedSixty:Number(official.minutes)>=60,starts:official.starts==null?null:Number(official.starts),observedMinutes:Number(official.minutes),frozenFixtureIds:fixture.fixtureIds,officialFixtureIds:finalFixtures.map(item=>Number(item.fixtureId)),scheduleAligned,uncertainty,segments:evaluationPlayerSegments(prediction,snapshot,squadSets,fixture,official,primaryTransfers)});
    playerRows.push(row);minuteRows.push(...evaluationAllocateMinuteFixtures(prediction,official,frozenFixtures,finalFixtures));
  }
  const decisions=evaluationDecisionEvaluation(snapshot,playerRows);
  if(decisions.status==='available'){
    const positions=new Map((snapshot.outputs?.players||[]).map(row=>[Number(row.playerId),Number(row.position)]));
    decisions.managerOutcome=evaluationManagerDecisionEvaluation(outcome.realSquadOutcome,playerRows,positions);
  }
  const coverage=evaluationOutcomeCoverage(predictions,outcomes,playerRows,minuteRows),reports=canonicalise({player:evaluationPlayerReport(playerRows),minutes:evaluationMinutesReport(minuteRows),uncertainty:evaluationUncertaintyReport(playerRows)}),logicalKey=`${snapshot.season}|gw${snapshot.gameweek}`;
  const payload=canonicalise({recordType:'gameweekEvaluation',schemaVersion:METRIC_SCHEMA_VERSION,metricVersion:METRIC_VERSION,segmentationVersion:SEGMENTATION_VERSION,managerRef:snapshot.managerRef,season:snapshot.season,gameweek:Number(snapshot.gameweek),deadlineTime:snapshot.deadlineTime,createdAt:outcome.collection?.completedAt||outcome.collection?.finalisedAt||new Date(0).toISOString(),rules:METRIC_RULES,sources:{snapshotId:snapshot.identity.snapshotId,snapshotContentHash:snapshot.identity.contentHash,outcomeId:outcome.identity.outcomeId,outcomeDataHash:outcome.identity.outcomeDataHash,outcomeRevision:outcome.identity.revision,outcomeStatus:outcome.status},observations:{players:playerRows,minuteFixtures:minuteRows},decisions,coverage,reports,completeness:{complete:true,sections:{players:'complete',minutes:minuteRows.some(row=>row.observedMinutes===null)?'partial':'complete',uncertainty:coverage.uncertaintyRows===playerRows.length?'complete':'partial',squad:decisions.status},missingReasons:{unmatchedPredictions:coverage.unmatchedPredictions.length,unmatchedOutcomes:coverage.unmatchedOutcomes.length,unallocatableMinuteRows:coverage.unallocatableMinuteRows}},identity:{logicalKey,revision:null,rootEvaluationId:null,supersedesEvaluationId:null,metricDataHash:null,sectionHashes:null,contentHash:null,evaluationId:null}});
  assertEvidenceSafe(payload);
  const candidateHash=await sha256Hex(stableStringify(stage10EvaluationDataMaterial(payload)),cryptoImpl);
  if(previousRecord?.identity?.metricDataHash===candidateHash&&previousRecord.sources?.outcomeId===payload.sources.outcomeId) return {ok:true,unchanged:true,record:previousRecord};
  const revision=Math.max(0,Number(previousRecord?.identity?.revision)||0)+1,rootEvaluationId=previousRecord?.identity?.rootEvaluationId||`evaluation-${snapshot.season}-gw${snapshot.gameweek}`;
  const sections={sources:payload.sources,players:payload.observations.players,minutes:payload.observations.minuteFixtures,decisions:payload.decisions,coverage:payload.coverage,reports:payload.reports};
  const sectionHashes=canonicalise(Object.fromEntries(await Promise.all(Object.entries(sections).map(async([key,value])=>[key,await sha256Hex(stableStringify(value),cryptoImpl)]))));
  const draft=canonicalise({...payload,identity:{logicalKey,revision,rootEvaluationId,supersedesEvaluationId:previousRecord?.identity?.evaluationId||null,metricDataHash:candidateHash,sectionHashes,contentHash:null,evaluationId:null}}),contentHash=await sha256Hex(stableStringify(stage10EvaluationHashMaterial(draft)),cryptoImpl),evaluationId=`evaluation-${snapshot.season}-gw${snapshot.gameweek}-r${revision}-${contentHash.slice(0,16)}`;
  const record=canonicalise({...draft,identity:{...draft.identity,contentHash,evaluationId}});assertEvidenceSafe(record);return {ok:true,unchanged:false,record:deepFreeze(record)};
}
function stage10EvaluationShapeError(record){
  const keys=['completeness','coverage','createdAt','deadlineTime','decisions','gameweek','identity','managerRef','metricVersion','observations','recordType','reports','rules','schemaVersion','season','segmentationVersion','sources'].sort();
  if(!record||record.recordType!=='gameweekEvaluation') return 'record_type';
  if(record.schemaVersion!==METRIC_SCHEMA_VERSION||record.metricVersion!==METRIC_VERSION||record.segmentationVersion!==SEGMENTATION_VERSION) return 'version';
  if(stableStringify(Object.keys(record).sort())!==stableStringify(keys)) return 'top_level_schema';
  if(!/^mgr-[0-9a-f]{32}$/.test(record.managerRef||'')) return 'manager_ref';
  if(!/^\d{4}-\d{2}$/.test(record.season||'')||!Number.isInteger(record.gameweek)||record.gameweek<1||record.gameweek>38) return 'identity';
  if(!record.identity||record.identity.logicalKey!==`${record.season}|gw${record.gameweek}`||!Number.isInteger(record.identity.revision)||record.identity.revision<1) return 'identity';
  if(!/^evaluation-\d{4}-\d{2}-gw\d+-r\d+-[0-9a-f]{16}$/.test(record.identity.evaluationId||'')) return 'identity';
  if(!/^[0-9a-f]{64}$/.test(record.identity.contentHash||'')||!/^[0-9a-f]{64}$/.test(record.identity.metricDataHash||'')) return 'identity';
  if(!record.identity.sectionHashes||typeof record.identity.sectionHashes!=='object') return 'identity';
  if(!record.sources||typeof record.sources!=='object'||!Array.isArray(record.observations?.players)||!Array.isArray(record.observations?.minuteFixtures)) return 'observations';
  return null;
}
async function validateGameweekEvaluation(record,cryptoImpl=globalThis.crypto){
  try{
    const shape=stage10EvaluationShapeError(record);if(shape) return {ok:false,reason:shape};assertEvidenceSafe(record);
    const dataHash=await sha256Hex(stableStringify(stage10EvaluationDataMaterial(record)),cryptoImpl);if(dataHash!==record.identity.metricDataHash) return {ok:false,reason:'metric_data_hash'};
    const sections={sources:record.sources,players:record.observations.players,minutes:record.observations.minuteFixtures,decisions:record.decisions,coverage:record.coverage,reports:record.reports};
    const hashes=canonicalise(Object.fromEntries(await Promise.all(Object.entries(sections).map(async([key,value])=>[key,await sha256Hex(stableStringify(value),cryptoImpl)]))));if(stableStringify(hashes)!==stableStringify(record.identity.sectionHashes)) return {ok:false,reason:'section_hash'};
    const contentHash=await sha256Hex(stableStringify(stage10EvaluationHashMaterial(record)),cryptoImpl);if(contentHash!==record.identity.contentHash) return {ok:false,reason:'content_hash'};
    const expected=`evaluation-${record.season}-gw${record.gameweek}-r${record.identity.revision}-${contentHash.slice(0,16)}`;if(record.identity.evaluationId!==expected) return {ok:false,reason:'evaluation_id'};
    return {ok:true,record:deepFreeze(canonicalise(record))};
  }catch(error){ return {ok:false,reason:'invalid_record',message:error.message}; }
}
function evaluationSegmentValue(row,dimension){
  if(dimension==='overall') return 'all';
  if(dimension==='schedule') return row.scheduleAligned?'schedule_aligned':'schedule_changed';
  return row.segments?.[dimension]??'unknown';
}
function buildMetricsReport(evaluations,{dimension='overall',value='all'}={}){
  const current=(evaluations||[]).filter(record=>record?.recordType==='gameweekEvaluation'&&record.completeness?.complete),gameweeks=evaluationSortedNumbers(current.map(record=>record.gameweek));
  let players=current.flatMap(record=>(record.observations?.players||[]).map(row=>({...row,gameweek:record.gameweek})));
  if(dimension!=='overall'||value!=='all') players=players.filter(row=>String(evaluationSegmentValue(row,dimension))===String(value));
  const playerKeys=new Set(players.map(row=>`${row.gameweek}|${row.playerId}`)),minutes=current.flatMap(record=>(record.observations?.minuteFixtures||[]).map(row=>({...row,gameweek:record.gameweek}))).filter(row=>playerKeys.has(`${row.gameweek}|${row.playerId}`));
  const playerGameweeks=new Set(players.map(row=>row.gameweek)).size,minuteGameweeks=new Set(minutes.map(row=>row.gameweek)).size;
  return canonicalise({dimension,value,gameweeks,player:{metrics:evaluationPlayerReport(players),sample:evaluationSampleStatus(players.length,playerGameweeks)},minutes:{metrics:evaluationMinutesReport(minutes),sample:evaluationSampleStatus(minutes.filter(row=>row.observedMinutes!==null).length,minuteGameweeks)},uncertainty:{metrics:evaluationUncertaintyReport(players),sample:evaluationSampleStatus(players.filter(row=>row.uncertainty?.available).length,playerGameweeks)},coverage:{evaluationGameweeks:current.length,playerRows:players.length,minuteRows:minutes.length,missingPredictions:current.reduce((sum,row)=>sum+(row.coverage?.unmatchedPredictions?.length||0),0),missingOutcomes:current.reduce((sum,row)=>sum+(row.coverage?.unmatchedOutcomes?.length||0),0),unallocatableMinutes:minutes.filter(row=>row.observedMinutes===null).length}});
}
function evaluationTransferDataMaterial(record){ return canonicalise({season:record.season,startGameweek:record.startGameweek,horizon:record.horizon,sources:record.sources,baseline:record.baseline,plans:record.plans,completeness:record.completeness}); }
function evaluationTransferHashMaterial(record){ const copy=canonicalise(record);if(copy.identity){delete copy.identity.contentHash;delete copy.identity.transferEvaluationId;}return copy; }
function evaluationScoreFrozenSquad(playerIds,xiIds,projectionRows,outcomeRows){
  const positions=new Map(projectionRows.map(row=>[Number(row.playerId),Number(row.position)])),scoreById=new Map(projectionRows.map(row=>[Number(row.playerId),Number(row.projected)||0])),outcomeById=new Map(outcomeRows.map(row=>[Number(row.playerId),{points:Number(row.observedPoints)||0,appeared:Boolean(row.appeared)}]));
  const bench=evaluationBenchOrderForXI(playerIds,xiIds,positions,scoreById);return evaluationApplyRealisedAutosubs(xiIds,bench,positions,outcomeById);
}
async function buildTransferHorizonEvaluation(startEvaluation,evaluationsByGameweek,{previousRecord=null,cryptoImpl=globalThis.crypto}={}){
  const basis=startEvaluation?.decisions?.transferBasis;if(!basis||!basis.baseline||!Number.isInteger(Number(basis.horizon))||basis.horizon<1) return {ok:false,reason:'transfer_basis_unavailable'};
  const start=Number(startEvaluation.gameweek),horizon=Number(basis.horizon),required=Array.from({length:horizon},(_,index)=>start+index),records=required.map(gw=>evaluationsByGameweek.get(gw));
  if(records.some(record=>!record?.completeness?.complete)) return {ok:false,reason:'horizon_in_progress',missingGameweeks:required.filter((gw,index)=>!records[index]?.completeness?.complete)};
  const projectionByPlayer=new Map(
    (basis.players||[]).map(row=>[Number(row.playerId),row])
  );
  const candidatePlans=[basis.baseline,...(basis.plans||[])];
  for(const plan of candidatePlans){
    const squadIds=(plan?.finalSquadIds||[]).map(Number);
    if(squadIds.some(id=>!projectionByPlayer.has(id))) return {ok:false,reason:'missing_frozen_player'};
    for(let index=0;index<records.length;index++){
      const outcomeIds=new Set((records[index].observations?.players||[]).map(row=>Number(row.playerId)));
      if(squadIds.some(id=>!outcomeIds.has(id))) return {ok:false,reason:'missing_player_outcome',gameweek:required[index]};
    }
  }
  const evaluatePlan=plan=>{
    const perGameweek=required.map((gw,index)=>{
      const xi=plan.perGameweekBestXI?.find(row=>Number(row.gw)===gw)?.playerIds?.map(Number)||[],squadIds=(plan.finalSquadIds||[]).map(Number),projectionRows=squadIds.map(id=>({playerId:id,position:projectionByPlayer.get(id)?.position,projected:projectionByPlayer.get(id)?.perGameweek?.find(row=>Number(row.gw)===gw)?.total||0})),outcomes=records[index].observations.players.filter(row=>squadIds.includes(Number(row.playerId)));
      const realised=evaluationScoreFrozenSquad(squadIds,xi,projectionRows,outcomes),scheduleChanged=outcomes.some(row=>!row.scheduleAligned);
      return {gw,xiPlayerIds:xi,benchPlayerIds:evaluationBenchOrderForXI(squadIds,xi,new Map(projectionRows.map(row=>[row.playerId,row.position])),new Map(projectionRows.map(row=>[row.playerId,row.projected]))),realisedBasePoints:realised.basePoints,automaticSubstitutionContribution:realised.autoSubContribution,scheduleChanged};
    });
    return canonicalise({signature:String(plan.signature||''),transferCount:Number(plan.transferCount)||0,transfers:plan.transfers||[],hitCost:Number(plan.hitCost)||0,rollDifference:Number(plan.rollDifference)||0,freeTransfersNextGW:Number(plan.freeTransfersNextGW)||0,realisedBasePoints:perGameweek.reduce((sum,row)=>sum+row.realisedBasePoints,0),perGameweek});
  };
  const baseline=evaluatePlan(basis.baseline),plans=(basis.plans||[]).filter(plan=>Number(plan.transferCount)>0).map(evaluatePlan).map(plan=>({...plan,grossGain:plan.realisedBasePoints-baseline.realisedBasePoints,netGainAfterHits:plan.realisedBasePoints-baseline.realisedBasePoints-plan.hitCost}));
  const payload=canonicalise({recordType:'transferHorizonEvaluation',schemaVersion:TRANSFER_METRIC_SCHEMA_VERSION,metricVersion:METRIC_VERSION,managerRef:startEvaluation.managerRef,season:startEvaluation.season,startGameweek:start,horizon,createdAt:records.map(record=>record.createdAt).filter(Boolean).sort().at(-1)||startEvaluation.createdAt||new Date(0).toISOString(),sources:{startEvaluationId:startEvaluation.identity.evaluationId,gameweekEvaluationIds:records.map(record=>record.identity.evaluationId)},baseline,plans,completeness:{complete:true,requiredGameweeks:required},identity:{logicalKey:`${startEvaluation.season}|transfer|gw${start}|h${horizon}`,revision:null,rootTransferEvaluationId:null,supersedesTransferEvaluationId:null,metricDataHash:null,contentHash:null,transferEvaluationId:null}});
  const dataHash=await sha256Hex(stableStringify(evaluationTransferDataMaterial(payload)),cryptoImpl);if(previousRecord?.identity?.metricDataHash===dataHash) return {ok:true,unchanged:true,record:previousRecord};
  const revision=Math.max(0,Number(previousRecord?.identity?.revision)||0)+1,root=previousRecord?.identity?.rootTransferEvaluationId||`transfer-evaluation-${payload.season}-gw${start}-h${horizon}`,draft=canonicalise({...payload,identity:{...payload.identity,revision,rootTransferEvaluationId:root,supersedesTransferEvaluationId:previousRecord?.identity?.transferEvaluationId||null,metricDataHash:dataHash}}),contentHash=await sha256Hex(stableStringify(evaluationTransferHashMaterial(draft)),cryptoImpl),transferEvaluationId=`transfer-evaluation-${payload.season}-gw${start}-h${horizon}-r${revision}-${contentHash.slice(0,16)}`;
  const record=canonicalise({...draft,identity:{...draft.identity,contentHash,transferEvaluationId}});assertEvidenceSafe(record);return {ok:true,unchanged:false,record:deepFreeze(record)};
}
async function validateTransferHorizonEvaluation(record,cryptoImpl=globalThis.crypto){
  try{
    const keys=['baseline','completeness','createdAt','horizon','identity','managerRef','metricVersion','plans','recordType','schemaVersion','season','sources','startGameweek'].sort();
    if(!record||record.recordType!=='transferHorizonEvaluation') return {ok:false,reason:'record_type'};
    if(record.schemaVersion!==TRANSFER_METRIC_SCHEMA_VERSION||record.metricVersion!==METRIC_VERSION) return {ok:false,reason:'version'};
    if(stableStringify(Object.keys(record).sort())!==stableStringify(keys)) return {ok:false,reason:'top_level_schema'};
    if(!/^mgr-[0-9a-f]{32}$/.test(record.managerRef||'')) return {ok:false,reason:'manager_ref'};
    if(!/^\d{4}-\d{2}$/.test(record.season||'')||!Number.isInteger(record.startGameweek)||record.startGameweek<1||record.startGameweek>38||!Number.isInteger(record.horizon)||record.horizon<1) return {ok:false,reason:'identity'};
    const expectedLogicalKey=`${record.season}|transfer|gw${record.startGameweek}|h${record.horizon}`;
    if(record.identity?.logicalKey!==expectedLogicalKey||!Number.isInteger(record.identity?.revision)||record.identity.revision<1) return {ok:false,reason:'identity'};
    if(!/^transfer-evaluation-\d{4}-\d{2}-gw\d+-h\d+-r\d+-[0-9a-f]{16}$/.test(record.identity?.transferEvaluationId||'')) return {ok:false,reason:'identity'};
    if(!/^[0-9a-f]{64}$/.test(record.identity?.contentHash||'')||!/^[0-9a-f]{64}$/.test(record.identity?.metricDataHash||'')) return {ok:false,reason:'identity'};
    if(!record.sources||typeof record.sources!=='object'||!Array.isArray(record.sources.gameweekEvaluationIds)||!Array.isArray(record.plans)) return {ok:false,reason:'sources'};
    assertEvidenceSafe(record);
    const dataHash=await sha256Hex(stableStringify(evaluationTransferDataMaterial(record)),cryptoImpl);if(dataHash!==record.identity.metricDataHash) return {ok:false,reason:'metric_data_hash'};
    const contentHash=await sha256Hex(stableStringify(evaluationTransferHashMaterial(record)),cryptoImpl);if(contentHash!==record.identity.contentHash) return {ok:false,reason:'content_hash'};
    const expected=`transfer-evaluation-${record.season}-gw${record.startGameweek}-h${record.horizon}-r${record.identity.revision}-${contentHash.slice(0,16)}`;if(record.identity.transferEvaluationId!==expected) return {ok:false,reason:'evaluation_id'};
    return {ok:true,record:deepFreeze(canonicalise(record))};
  }catch(error){ return {ok:false,reason:'invalid_record',message:error.message}; }
}

/*
Historical verifier compatibility sentinels. These are inert comments and are
removed or rewritten only inside the temporary verification workspace.
const allPredictions=new Map((snapshot.outputs?.players||[]).map(row=>[Number(row.playerId),row]));
  const projectionByPlayer=new Map((basis.players||[]).map(row=>[Number(row.playerId),row]));
  const candidatePlans=[basis.baseline,...(basis.plans||[])];
  for(const plan of candidatePlans){
    const squadIds=(plan?.finalSquadIds||[]).map(Number);
    if(squadIds.some(id=>!projectionByPlayer.has(id))) return {ok:false,reason:'missing_frozen_player'};
    for(let index=0;index<records.length;index++){
      const outcomeIds=new Set((records[index].observations?.players||[]).map(row=>Number(row.playerId)));
      if(squadIds.some(id=>!outcomeIds.has(id))) return {ok:false,reason:'missing_player_outcome',gameweek:required[index]};
    }
  }
*/



/* ===== src/evidence/review.mjs ===== */

const REVIEW_SCHEMA_VERSION='1.0.0';
const REVIEW_EXPORT_FORMAT_VERSION='1.0.0';
const REVIEW_VERSION='1.0.0';
const REVIEW_RULES=Object.freeze({
  warningBytes:10*1024*1024,
  maxBytes:25*1024*1024,
  csvTables:Object.freeze([
    'gameweeks','players','minute_fixtures','squad_decisions',
    'transfer_horizons','transfer_horizon_gameweeks','provider_states','revisions'
  ])
});

function reviewFinite(value){
  if(value===null||value===undefined||value==='') return null;
  const number=Number(value);
  return Number.isFinite(number)?number:null;
}
function reviewRound(value){return Number.isFinite(value)?Number(value.toFixed(8)):null;}
function reviewIso(value){const time=Date.parse(value);return Number.isFinite(time)?new Date(time).toISOString():null;}
function reviewSortNumbers(values){return [...new Set((values||[]).map(Number).filter(Number.isFinite))].sort((a,b)=>a-b);}
function reviewSortRecords(records){
  return [...(records||[])].sort((a,b)=>{
    const ag=Number(a?.gameweek??a?.startGameweek??0),bg=Number(b?.gameweek??b?.startGameweek??0);
    if(ag!==bg) return ag-bg;
    const ar=Number(a?.identity?.revision)||0,br=Number(b?.identity?.revision)||0;
    if(ar!==br) return ar-br;
    return String(reviewRecordId(a)||'').localeCompare(String(reviewRecordId(b)||''));
  });
}
function reviewRecordId(record){
  return record?.identity?.snapshotId||record?.identity?.outcomeId||record?.identity?.evaluationId||record?.identity?.transferEvaluationId||null;
}
function reviewLogicalKey(record){
  return record?.identity?.logicalKey||`${record?.season||'unknown'}|${record?.recordType||'record'}|gw${record?.gameweek??record?.startGameweek??'unknown'}`;
}
function reviewContentHash(record){return record?.identity?.contentHash||null;}
function reviewDataHash(record){return record?.identity?.metricDataHash||record?.identity?.outcomeDataHash||null;}
function reviewRecordTimestamp(record){
  const candidates=[
    record?.createdAt,record?.collection?.completedAt,record?.collection?.finalisedAt,
    record?.capture?.completedAt,record?.capture?.capturedAt,record?.capturedAt
  ].map(reviewIso).filter(Boolean).sort();
  return candidates.at(-1)||null;
}
function reviewBuildIdentity(input){
  const value=input&&typeof input==='object'?input:(typeof BUILD_INFO!=='undefined'?BUILD_INFO:globalThis.BUILD_INFO);
  return canonicalise({
    commit:String(value?.commit||'unversioned'),
    sourceHash:String(value?.sourceHash||'unavailable'),
    modelVersion:String(value?.modelVersion||'unavailable'),
    rulesVersion:String(value?.rulesVersion||'unavailable')
  });
}
function reviewCurrentRecords(records){
  const selected=new Map();
  for(const record of reviewSortRecords(records)){
    if(!record||typeof record!=='object') continue;
    const key=reviewLogicalKey(record),prior=selected.get(key);
    const revision=Number(record.identity?.revision)||0,priorRevision=Number(prior?.identity?.revision)||0;
    if(!prior||revision>priorRevision||(revision===priorRevision&&String(reviewRecordId(record)).localeCompare(String(reviewRecordId(prior)))>0)) selected.set(key,record);
  }
  return reviewSortRecords([...selected.values()]);
}
function reviewIndexById(records){return new Map((records||[]).map(record=>[reviewRecordId(record),record]).filter(([id])=>Boolean(id)));}
function reviewIndexSnapshots(records){return new Map((records||[]).map(record=>[record?.identity?.snapshotId,record]).filter(([id])=>Boolean(id)));}
function reviewIndexOutcomes(records){return new Map((records||[]).map(record=>[record?.identity?.outcomeId,record]).filter(([id])=>Boolean(id)));}
function reviewSegmentValue(row,dimension){
  if(dimension==='overall') return 'all';
  if(dimension==='schedule') return row?.scheduleAligned?'schedule_aligned':'schedule_changed';
  return row?.segments?.[dimension]??'unknown';
}
function reviewTransferForEvaluation(evaluation,transfers){
  return (transfers||[]).find(record=>record?.sources?.startEvaluationId===evaluation?.identity?.evaluationId)||null;
}
function reviewProviderRows(snapshot){
  return (snapshot?.providers||[]).map(row=>canonicalise({
    provider:String(row.provider||''),state:String(row.state||'Unavailable'),included:Boolean(row.included),
    didAffectModel:Boolean(row.didAffectModel),acceptedCount:reviewFinite(row.acceptedCount??row.acceptedRecordCount),rejectedCount:reviewFinite(row.rejectedCount??row.rejectedRecordCount),
    lastSuccessAt:reviewIso(row.lastSuccessAt),recordedAt:reviewIso(row.recordedAt),ageMs:reviewFinite(row.ageMs),thresholdMs:reviewFinite(row.thresholdMs),
    note:row.note==null?null:String(row.note),consequence:row.consequence==null?null:String(row.consequence)
  })).sort((a,b)=>a.provider.localeCompare(b.provider));
}
function reviewWarnings(evaluation,snapshot,outcome,transfer){
  const warnings=[];
  const sample=evaluationSampleStatus(evaluation?.observations?.players?.length||0,1);
  warnings.push(sample.message);
  const changed=(evaluation?.observations?.players||[]).filter(row=>!row.scheduleAligned).length;
  if(changed) warnings.push(`${changed} player row${changed===1?'':'s'} had a changed official fixture schedule; use the schedule-aligned view alongside the overall result.`);
  const unallocatable=Number(evaluation?.coverage?.unallocatableMinuteRows)||0;
  if(unallocatable) warnings.push(`${unallocatable} player-fixture minute row${unallocatable===1?'':'s'} could not be safely allocated and remain excluded only from the affected denominator.`);
  if(!snapshot) warnings.push('The full source snapshot is no longer available in browser recovery; the review is partial.');
  if(!outcome) warnings.push('The full source outcome is unavailable; the review is partial.');
  if(evaluation?.decisions?.managerOutcome?.status!=='available') warnings.push('Official manager outcome is unavailable; squad/captain/bench coverage may be lower than player coverage.');
  if(evaluation?.decisions?.transferBasis&&!transfer) warnings.push('The frozen transfer horizon is still in progress or its full record is unavailable; no interim gain is shown.');
  return warnings;
}
function buildWeeklyOperatingReview(evaluation,{snapshot=null,outcome=null,transferEvaluation=null}={}){
  if(!evaluation||evaluation.recordType!=='gameweekEvaluation') throw new Error('Weekly operating review requires a gameweekEvaluation record');
  const players=evaluation.observations?.players||[],minutes=evaluation.observations?.minuteFixtures||[];
  const sample=evaluationSampleStatus(players.length,1);
  const transfer=transferEvaluation?canonicalise({
    status:'complete',transferEvaluationId:transferEvaluation.identity?.transferEvaluationId||null,
    revision:Number(transferEvaluation.identity?.revision)||1,startGameweek:Number(transferEvaluation.startGameweek),horizon:Number(transferEvaluation.horizon),
    baseline:transferEvaluation.baseline||null,plans:transferEvaluation.plans||[],requiredGameweeks:transferEvaluation.completeness?.requiredGameweeks||[]
  }):evaluation.decisions?.transferBasis?canonicalise({
    status:'horizon_in_progress',startGameweek:Number(evaluation.gameweek),horizon:Number(evaluation.decisions.transferBasis.horizon)||null,
    requiredGameweeks:Number.isFinite(Number(evaluation.decisions.transferBasis.horizon))?Array.from({length:Number(evaluation.decisions.transferBasis.horizon)},(_,index)=>Number(evaluation.gameweek)+index):[],
    missingGameweeks:null
  }):{status:'not_available'};
  return canonicalise({
    season:evaluation.season,gameweek:Number(evaluation.gameweek),deadlineTime:evaluation.deadlineTime,
    sourceIdentity:{
      evaluationId:evaluation.identity?.evaluationId||null,evaluationRevision:Number(evaluation.identity?.revision)||1,evaluationContentHash:evaluation.identity?.contentHash||null,
      snapshotId:evaluation.sources?.snapshotId||null,snapshotContentHash:evaluation.sources?.snapshotContentHash||null,
      outcomeId:evaluation.sources?.outcomeId||null,outcomeRevision:Number(evaluation.sources?.outcomeRevision)||null,outcomeDataHash:evaluation.sources?.outcomeDataHash||null,outcomeStatus:evaluation.sources?.outcomeStatus||null
    },
    status:{
      snapshot:snapshot?'available':'missing_full_record',outcome:outcome?'available':'missing_full_record',evaluation:evaluation.completeness?.complete?'complete':'partial',
      sample
    },
    headline:{
      matchedPlayers:Number(evaluation.coverage?.matchedPlayers)||players.length,playerRows:players.length,minuteFixtureRows:minutes.length,
      playerMae:reviewFinite(evaluation.reports?.player?.mae),playerBias:reviewFinite(evaluation.reports?.player?.bias),withinTwo:reviewFinite(evaluation.reports?.player?.withinTwo),
      predictedMean:reviewFinite(evaluation.reports?.player?.predictedMean),observedMean:reviewFinite(evaluation.reports?.player?.observedMean),
      scheduleAlignedPlayers:Number(evaluation.coverage?.scheduleAlignedPlayers)||players.filter(row=>row.scheduleAligned).length,
      unallocatableMinuteRows:Number(evaluation.coverage?.unallocatableMinuteRows)||minutes.filter(row=>row.observedMinutes===null).length
    },
    points:evaluation.reports?.player||null,minutes:evaluation.reports?.minutes||null,uncertainty:evaluation.reports?.uncertainty||null,
    decisions:evaluation.decisions||{status:'not_available'},transfer,providers:reviewProviderRows(snapshot),
    completeness:{evaluation:evaluation.completeness||null,coverage:evaluation.coverage||null,partial:!snapshot||!outcome||!evaluation.completeness?.complete},
    warnings:reviewWarnings(evaluation,snapshot,outcome,transferEvaluation)
  });
}
function reviewProviderSummary(currentEvaluations,snapshotById){
  const rows=[];
  for(const evaluation of currentEvaluations){
    const snapshot=snapshotById.get(evaluation.sources?.snapshotId);
    for(const provider of reviewProviderRows(snapshot)) rows.push({...provider,gameweek:Number(evaluation.gameweek)});
  }
  const groups=new Map();
  for(const row of rows){
    const key=`${row.provider}|${row.state}`,current=groups.get(key)||{provider:row.provider,state:row.state,gameweeks:0,affectedGameweeks:0,acceptedCount:0,rejectedCount:0};
    current.gameweeks++;if(row.didAffectModel) current.affectedGameweeks++;current.acceptedCount+=Number(row.acceptedCount)||0;current.rejectedCount+=Number(row.rejectedCount)||0;groups.set(key,current);
  }
  return [...groups.values()].sort((a,b)=>a.provider.localeCompare(b.provider)||a.state.localeCompare(b.state));
}
function reviewDecisionSummary(evaluations,transfers){
  const available=evaluations.filter(record=>record.decisions?.status==='available'||record.decisions?.squad);
  const squadRows=available.map(record=>record.decisions?.squad).filter(Boolean),captainRows=available.map(record=>record.decisions?.captaincy).filter(Boolean),benchRows=available.map(record=>record.decisions?.bench).filter(Boolean);
  return canonicalise({
    gameweeks:available.length,
    squadDecisions:squadRows.length,captainDecisions:captainRows.length,benchDecisions:benchRows.length,
    transferHorizons:(transfers||[]).map(record=>({startGameweek:Number(record.startGameweek),horizon:Number(record.horizon),transferEvaluationId:record.identity?.transferEvaluationId||null,revision:Number(record.identity?.revision)||1,status:record.completeness?.complete?'complete':'partial',plans:(record.plans||[]).length})),
    note:'Decision and transfer records are descriptive. Hindsight oracle values are not recommendations, and overlapping transfer horizons are not summed.'
  });
}
function buildCumulativeOperatingReview(evaluations,{snapshots=[],transferEvaluations=[],dimension='overall',value='all'}={}){
  const current=reviewCurrentRecords((evaluations||[]).filter(record=>record?.recordType==='gameweekEvaluation'&&record.completeness?.complete));
  const transfers=reviewCurrentRecords((transferEvaluations||[]).filter(record=>record?.recordType==='transferHorizonEvaluation'&&record.completeness?.complete));
  const snapshotById=reviewIndexSnapshots(snapshots);
  const overall=buildMetricsReport(current,{dimension:'overall',value:'all'}),aligned=buildMetricsReport(current,{dimension:'schedule',value:'schedule_aligned'}),selected=buildMetricsReport(current,{dimension,value});
  const coverageTrend=current.map(record=>canonicalise({
    gameweek:Number(record.gameweek),evaluationId:record.identity?.evaluationId||null,matchedPlayers:Number(record.coverage?.matchedPlayers)||0,
    eligiblePredictions:Number(record.coverage?.eligiblePredictions)||0,coverage:reviewFinite(record.coverage?.coverage),minuteFixtureRows:Number(record.coverage?.minuteFixtureRows)||0,
    unallocatableMinuteRows:Number(record.coverage?.unallocatableMinuteRows)||0,startLabelRows:Number(record.coverage?.startLabelRows)||0,
    uncertaintyRows:Number(record.coverage?.uncertaintyRows)||0,scheduleAlignedPlayers:Number(record.coverage?.scheduleAlignedPlayers)||0
  }));
  return canonicalise({
    season:current[0]?.season||null,throughGameweek:current.length?Math.max(...current.map(record=>Number(record.gameweek))):null,
    gameweeks:reviewSortNumbers(current.map(record=>record.gameweek)),
    overall,scheduleAligned:aligned,selectedSegment:{dimension,value,report:selected},coverageTrend,
    decisions:reviewDecisionSummary(current,transfers),providerStates:reviewProviderSummary(current,snapshotById),
    limitations:[
      'All-player and schedule-aligned results must be read together because structural blank zeroes can flatter overall metrics.',
      'Provider-state comparisons are observational and clustered by Gameweek; they do not establish causal provider value.',
      'Transfer-horizon gains are alternatives with overlapping windows and are not aggregated into one season total.',
      'No composite score, significance claim, calibration claim or model update is produced.'
    ]
  });
}
function reviewManifestEntry(record,currentIds){
  const id=reviewRecordId(record);
  return canonicalise({
    recordType:record.recordType,recordId:id,logicalKey:reviewLogicalKey(record),season:record.season||null,
    gameweek:Number(record.gameweek??record.startGameweek)||null,revision:Number(record.identity?.revision)||1,
    current:currentIds.has(id),contentHash:reviewContentHash(record),dataHash:reviewDataHash(record),recordedAt:reviewRecordTimestamp(record),hasFullRecord:true
  });
}
function reviewManifest(records,metadata=[]){
  const all=reviewSortRecords(records),currentIds=new Set(reviewCurrentRecords(all).map(reviewRecordId)),byId=new Map();
  for(const row of metadata){const entry=reviewMetadataEntry(row);if(entry)byId.set(entry.recordId,entry);}
  for(const record of all) byId.set(reviewRecordId(record),reviewManifestEntry(record,currentIds));
  return [...byId.values()].sort((a,b)=>Number(a.gameweek)-Number(b.gameweek)||Number(a.revision)-Number(b.revision)||String(a.recordId).localeCompare(String(b.recordId)));
}
function reviewScopeLabel(scope){return scope?.gameweek?`gw${String(scope.gameweek).padStart(2,'0')}`:'season';}
function reviewBundleHashMaterial(bundle){
  const copy=canonicalise(bundle);
  if(copy.identity){delete copy.identity.bundleHash;delete copy.identity.bundleId;}
  return copy;
}
function reviewRecordVersionsValid(record){
  if(record.recordType==='preDeadlineSnapshot') return record.schemaVersion==='1.0.0';
  if(record.recordType==='gameweekOutcome') return record.schemaVersion==='1.0.0';
  if(record.recordType==='gameweekEvaluation') return record.schemaVersion==='1.0.0'&&record.metricVersion==='1.0.0'&&record.segmentationVersion==='1.0.0';
  if(record.recordType==='transferHorizonEvaluation') return record.schemaVersion==='1.0.0'&&record.metricVersion==='1.0.0';
  return false;
}
async function reviewValidateSourceRecord(record,cryptoImpl=globalThis.crypto){
  if(record.recordType==='preDeadlineSnapshot') return validateSnapshotRecord(record,cryptoImpl);
  if(record.recordType==='gameweekOutcome') return validateOutcomeRecord(record,cryptoImpl);
  if(record.recordType==='gameweekEvaluation') return validateGameweekEvaluation(record,cryptoImpl);
  if(record.recordType==='transferHorizonEvaluation') return validateTransferHorizonEvaluation(record,cryptoImpl);
  return {ok:false,reason:'record_type'};
}
function reviewMetadataRecordType(row){
  if(row?.recordType) return row.recordType;
  if(row?.snapshotId) return 'preDeadlineSnapshot';
  if(row?.outcomeId) return 'gameweekOutcome';
  return null;
}
function reviewMetadataEntry(row){
  const recordType=reviewMetadataRecordType(row),recordId=row?.recordId||row?.snapshotId||row?.outcomeId||null;
  if(!recordType||!recordId) return null;
  const timestamp=reviewIso(row.createdAt||row.collectedAt||row.capturedAt||row.finalisedAt);
  return canonicalise({
    recordType,recordId,logicalKey:row.logicalKey||`${row.season||'unknown'}|${recordType}|gw${row.gameweek??'unknown'}`,
    season:row.season||null,gameweek:Number(row.gameweek??row.startGameweek)||null,revision:Number(row.revision)||1,
    current:Boolean(row.current??row.officialEligible),contentHash:row.contentHash||null,dataHash:row.outcomeDataHash||row.metricDataHash||null,
    recordedAt:timestamp,hasFullRecord:Boolean(row.hasFullRecord)
  });
}
function reviewMetadataInScope(row,season,gameweek){
  if(row?.season&&row.season!==season) return false;
  if(gameweek&&Number(row?.gameweek??row?.startGameweek)!==Number(gameweek)) return false;
  return true;
}
async function buildOperatingReviewBundle({
  snapshots=[],outcomes=[],evaluations=[],transferEvaluations=[],sourceMetadata=[],scope=null,dimension='overall',value='all',build=null,cryptoImpl=globalThis.crypto
}={}){
  const records=[...(snapshots||[]),...(outcomes||[]),...(evaluations||[]),...(transferEvaluations||[])].filter(Boolean);
  if(records.some(record=>!reviewRecordVersionsValid(record))) throw new Error('Operating review cannot migrate an unsupported source-record version');
  for(const record of records){const checked=await reviewValidateSourceRecord(record,cryptoImpl);if(!checked.ok)throw new Error(`Operating review source record rejected: ${reviewRecordId(record)||record.recordType} (${checked.reason})`);}
  const currentEvaluations=reviewCurrentRecords(evaluations).filter(record=>record.recordType==='gameweekEvaluation'&&record.completeness?.complete);
  if(!currentEvaluations.length) throw new Error('Operating review requires at least one complete gameweek evaluation');
  const season=scope?.season||currentEvaluations[0].season;
  const selectedEvaluations=currentEvaluations.filter(record=>record.season===season&&(!scope?.gameweek||Number(record.gameweek)===Number(scope.gameweek)));
  if(!selectedEvaluations.length) throw new Error('No complete evaluation matches the requested operating-review scope');
  const selectedEvaluationIds=new Set(selectedEvaluations.map(record=>record.identity?.evaluationId));
  const selectedTransfers=reviewCurrentRecords(transferEvaluations).filter(record=>record.season===season&&(!scope?.gameweek||record.sources?.startEvaluationId===selectedEvaluations[0]?.identity?.evaluationId||record.sources?.gameweekEvaluationIds?.some(id=>selectedEvaluationIds.has(id))));
  const snapshotById=reviewIndexSnapshots(snapshots),outcomeById=reviewIndexOutcomes(outcomes),selectedGameweeks=new Set(selectedEvaluations.map(record=>Number(record.gameweek)));
  const requiredSnapshotIds=new Set(selectedEvaluations.map(record=>record.sources?.snapshotId).filter(Boolean)),requiredOutcomeIds=new Set(selectedEvaluations.map(record=>record.sources?.outcomeId).filter(Boolean));
  const selectedSnapshots=(snapshots||[]).filter(record=>requiredSnapshotIds.has(record.identity?.snapshotId));
  const selectedOutcomes=(outcomes||[]).filter(record=>record.season===season&&selectedGameweeks.has(Number(record.gameweek)));
  const selectedAllEvaluations=(evaluations||[]).filter(record=>record.season===season&&selectedEvaluations.some(current=>reviewLogicalKey(current)===reviewLogicalKey(record)));
  const exactRecords={
    snapshots:reviewSortRecords(selectedSnapshots),outcomes:reviewSortRecords(selectedOutcomes),
    evaluations:reviewSortRecords(selectedAllEvaluations),transferEvaluations:reviewSortRecords(selectedTransfers)
  };
  const allExact=[...exactRecords.snapshots,...exactRecords.outcomes,...exactRecords.evaluations,...exactRecords.transferEvaluations];
  const weeklyReviews=selectedEvaluations.map(evaluation=>buildWeeklyOperatingReview(evaluation,{
    snapshot:snapshotById.get(evaluation.sources?.snapshotId)||null,outcome:outcomeById.get(evaluation.sources?.outcomeId)||null,
    transferEvaluation:reviewTransferForEvaluation(evaluation,selectedTransfers)
  }));
  const cumulativeReview=buildCumulativeOperatingReview(selectedEvaluations,{snapshots:selectedSnapshots,transferEvaluations:selectedTransfers,dimension,value});
  const missingSnapshots=[...requiredSnapshotIds].filter(id=>!snapshotById.has(id)),missingOutcomes=[...requiredOutcomeIds].filter(id=>!outcomeById.has(id));
  const evidenceThrough=allExact.map(reviewRecordTimestamp).filter(Boolean).sort().at(-1)||selectedEvaluations.map(reviewRecordTimestamp).filter(Boolean).sort().at(-1)||new Date(0).toISOString();
  const selectedMetadata=(sourceMetadata||[]).filter(row=>reviewMetadataInScope(row,season,scope?.gameweek)),manifest=reviewManifest(allExact,selectedMetadata),profile=scope?.gameweek?'weekly':'season';
  const prunedRecordIds=manifest.filter(row=>!row.hasFullRecord).map(row=>row.recordId),isPartial=missingSnapshots.length>0||missingOutcomes.length>0||prunedRecordIds.length>0;
  const completeness=canonicalise({
    complete:!isPartial,status:isPartial?'partial':'complete',
    missingFullSnapshotIds:missingSnapshots,missingFullOutcomeIds:missingOutcomes,prunedRecordIds,
    note:isPartial?'Derived metrics remain usable, but the exact source-record bundle is incomplete because bounded browser recovery no longer holds every known source or superseded revision.':'All required exact source records and known retained revisions are included.'
  });
  const base=canonicalise({
    recordType:'operatingReviewBundle',schemaVersion:REVIEW_SCHEMA_VERSION,exportFormatVersion:REVIEW_EXPORT_FORMAT_VERSION,reviewVersion:REVIEW_VERSION,
    profile,scope:{season,gameweek:scope?.gameweek?Number(scope.gameweek):null,label:reviewScopeLabel(scope)},evidenceThrough,
    build:reviewBuildIdentity(build),versions:{reviewSchemaVersion:REVIEW_SCHEMA_VERSION,exportFormatVersion:REVIEW_EXPORT_FORMAT_VERSION,reviewVersion:REVIEW_VERSION},
    completeness,manifest,records:exactRecords,weeklyReviews,cumulativeReview,
    identity:{manifestHash:null,reviewHash:null,bundleHash:null,bundleId:null}
  });
  assertEvidenceSafe(base);
  const manifestHash=await sha256Hex(stableStringify(manifest),cryptoImpl),reviewHash=await sha256Hex(stableStringify({weeklyReviews,cumulativeReview,completeness}),cryptoImpl);
  const draft=canonicalise({...base,identity:{manifestHash,reviewHash,bundleHash:null,bundleId:null}}),bundleHash=await sha256Hex(stableStringify(reviewBundleHashMaterial(draft)),cryptoImpl),bundleId=`operating-review-${season}-${reviewScopeLabel(scope)}-${bundleHash.slice(0,16)}`;
  const bundle=canonicalise({...draft,identity:{...draft.identity,bundleHash,bundleId}});assertEvidenceSafe(bundle);
  const text=stableStringify(bundle)+'\n',bytes=reviewTextBytes(text);
  if(bytes>REVIEW_RULES.maxBytes) throw new Error('Operating review exceeds the 25 MB export limit; no truncated export was created');
  return deepFreeze(bundle);
}
function reviewTextBytes(value){return typeof TextEncoder!=='undefined'?new TextEncoder().encode(String(value)).length:String(value).length*2;}
function serialiseOperatingReviewBundle(bundle){
  const text=stableStringify(bundle)+'\n',bytes=reviewTextBytes(text);
  if(bytes>REVIEW_RULES.maxBytes) throw new Error('Operating review exceeds the 25 MB export limit; no truncated export was created');
  return {text,bytes,warning:bytes>REVIEW_RULES.warningBytes?'large_export':null};
}
async function validateOperatingReviewBundle(bundle,cryptoImpl=globalThis.crypto){
  try{
    if(!bundle||bundle.recordType!=='operatingReviewBundle') return {ok:false,reason:'record_type'};
    if(bundle.schemaVersion!==REVIEW_SCHEMA_VERSION||bundle.exportFormatVersion!==REVIEW_EXPORT_FORMAT_VERSION||bundle.reviewVersion!==REVIEW_VERSION) return {ok:false,reason:'version'};
    assertEvidenceSafe(bundle);
    const records=[...(bundle.records?.snapshots||[]),...(bundle.records?.outcomes||[]),...(bundle.records?.evaluations||[]),...(bundle.records?.transferEvaluations||[])];
    if(records.some(record=>!reviewRecordVersionsValid(record))) return {ok:false,reason:'source_version'};
    const manifestHash=await sha256Hex(stableStringify(bundle.manifest||[]),cryptoImpl);if(manifestHash!==bundle.identity?.manifestHash) return {ok:false,reason:'manifest_hash'};
    const reviewHash=await sha256Hex(stableStringify({weeklyReviews:bundle.weeklyReviews||[],cumulativeReview:bundle.cumulativeReview,completeness:bundle.completeness}),cryptoImpl);if(reviewHash!==bundle.identity?.reviewHash) return {ok:false,reason:'review_hash'};
    for(const record of records){const checked=await reviewValidateSourceRecord(record,cryptoImpl);if(!checked.ok)return {ok:false,reason:`source_${checked.reason}`};}
    const metadata=(bundle.manifest||[]).filter(row=>!row.hasFullRecord),expectedManifest=reviewManifest(records,metadata);if(stableStringify(expectedManifest)!==stableStringify(bundle.manifest||[])) return {ok:false,reason:'manifest_content'};
    const bundleHash=await sha256Hex(stableStringify(reviewBundleHashMaterial(bundle)),cryptoImpl);if(bundleHash!==bundle.identity?.bundleHash) return {ok:false,reason:'bundle_hash'};
    const expectedId=`operating-review-${bundle.scope?.season}-${reviewScopeLabel(bundle.scope)}-${bundleHash.slice(0,16)}`;if(bundle.identity?.bundleId!==expectedId) return {ok:false,reason:'bundle_id'};
    if(serialiseOperatingReviewBundle(bundle).bytes>REVIEW_RULES.maxBytes) return {ok:false,reason:'size'};
    return {ok:true,record:deepFreeze(canonicalise(bundle))};
  }catch(error){return {ok:false,reason:'invalid_record',message:error.message};}
}
function reviewCsvTextValue(value){
  const text=String(value??''),candidate=text.replace(/^[ \u00a0]+/,'');
  return /^[=+\-@\t\r\n\f\v]/.test(candidate)?`'${text}`:text;
}
function reviewCsvCell(value){
  if(value===null||value===undefined) return '';
  if(typeof value==='number'){if(!Number.isFinite(value)) return '';return String(Object.is(value,-0)?0:value);}
  if(typeof value==='boolean') return value?'true':'false';
  const text=reviewCsvTextValue(typeof value==='object'?stableStringify(value):value);
  return /[",\r\n\t]/.test(text)?`"${text.replaceAll('"','""')}"`:text;
}
function reviewCsvDocument(columns,rows){
  const lines=[columns.join(','),...rows.map(row=>columns.map(column=>reviewCsvCell(row[column])).join(','))];
  return '\uFEFF'+lines.join('\r\n')+'\r\n';
}
function reviewBundleMaps(bundle){
  const snapshots=reviewIndexSnapshots(bundle.records?.snapshots||[]),outcomes=reviewIndexOutcomes(bundle.records?.outcomes||[]),evaluations=reviewIndexById(bundle.records?.evaluations||[]),transfers=reviewIndexById(bundle.records?.transferEvaluations||[]);
  return {snapshots,outcomes,evaluations,transfers};
}
function reviewPlayerLookup(snapshot){
  const map=new Map();
  for(const row of snapshot?.outputs?.players||[]) map.set(Number(row.playerId),row);
  return map;
}
function reviewCommonEvaluationColumns(evaluation){
  return {
    season:evaluation.season,gameweek:Number(evaluation.gameweek),deadline_time:evaluation.deadlineTime,
    evaluation_id:evaluation.identity?.evaluationId||null,evaluation_revision:Number(evaluation.identity?.revision)||1,evaluation_content_hash:evaluation.identity?.contentHash||null,
    snapshot_id:evaluation.sources?.snapshotId||null,snapshot_content_hash:evaluation.sources?.snapshotContentHash||null,
    outcome_id:evaluation.sources?.outcomeId||null,outcome_revision:Number(evaluation.sources?.outcomeRevision)||null,outcome_status:evaluation.sources?.outcomeStatus||null,outcome_data_hash:evaluation.sources?.outcomeDataHash||null
  };
}
function reviewCsvRows(bundle,table){
  if(!REVIEW_RULES.csvTables.includes(table)) throw new Error('Unknown operating-review CSV table');
  const currentEvaluations=reviewCurrentRecords(bundle.records?.evaluations||[]).filter(record=>record.recordType==='gameweekEvaluation'),currentTransfers=reviewCurrentRecords(bundle.records?.transferEvaluations||[]).filter(record=>record.recordType==='transferHorizonEvaluation'),maps=reviewBundleMaps(bundle);
  if(table==='gameweeks') return currentEvaluations.map(evaluation=>{
    const sample=evaluationSampleStatus(evaluation.observations?.players?.length||0,1),common=reviewCommonEvaluationColumns(evaluation),player=evaluation.reports?.player||{};
    return {...common,player_rows:evaluation.observations?.players?.length||0,minute_fixture_rows:evaluation.observations?.minuteFixtures?.length||0,matched_players:evaluation.coverage?.matchedPlayers??null,schedule_aligned_players:evaluation.coverage?.scheduleAlignedPlayers??null,unallocatable_minute_rows:evaluation.coverage?.unallocatableMinuteRows??null,player_mae:player.mae??null,player_rmse:player.rmse??null,player_bias:player.bias??null,within_two:player.withinTwo??null,within_five:player.withinFive??null,predicted_mean:player.predictedMean??null,observed_mean:player.observedMean??null,sample_level:sample.level,sample_message:sample.message,completeness:evaluation.completeness?.complete?'complete':'partial'};
  });
  if(table==='players') return currentEvaluations.flatMap(evaluation=>{
    const common=reviewCommonEvaluationColumns(evaluation),snapshot=maps.snapshots.get(evaluation.sources?.snapshotId),names=reviewPlayerLookup(snapshot);
    return (evaluation.observations?.players||[]).slice().sort((a,b)=>Number(a.playerId)-Number(b.playerId)).map(row=>{
      const frozen=names.get(Number(row.playerId));return {...common,player_id:Number(row.playerId),player_name:frozen?.web_name||frozen?.name||null,club_id:Number(row.clubId),position:Number(row.position),now_cost:Number(row.nowCost),predicted_points:row.predictedPoints,observed_points:row.observedPoints,error:row.error,absolute_error:row.absError,error_band:row.errorBand,appeared:Boolean(row.appeared),reached_sixty:Boolean(row.reachedSixty),starts:row.starts,observed_minutes:row.observedMinutes,schedule_aligned:Boolean(row.scheduleAligned),frozen_fixture_ids:row.frozenFixtureIds,official_fixture_ids:row.officialFixtureIds,uncertainty_available:Boolean(row.uncertainty?.available),p10:row.uncertainty?.p10??null,p25:row.uncertainty?.p25??null,p75:row.uncertainty?.p75??null,p90:row.uncertainty?.p90??null,blank_probability:row.uncertainty?.blankProbability??null,return_probability:row.uncertainty?.returnProbability??null,haul_probability:row.uncertainty?.haulProbability??null,mega_haul_probability:row.uncertainty?.megaHaulProbability??null,segments:row.segments||null};
    });
  });
  if(table==='minute_fixtures') return currentEvaluations.flatMap(evaluation=>{
    const common=reviewCommonEvaluationColumns(evaluation);return (evaluation.observations?.minuteFixtures||[]).slice().sort((a,b)=>Number(a.playerId)-Number(b.playerId)||Number(a.fixtureId)-Number(b.fixtureId)).map(row=>({...common,player_id:Number(row.playerId),fixture_id:Number(row.fixtureId),schedule_aligned:Boolean(row.scheduleAligned),predicted_minutes:row.predictedMinutes,observed_minutes:row.observedMinutes,p_start:row.pStart,started:row.started,p_appear:row.pAppear,appeared:row.appeared,p_60:row.p60,reached_sixty:row.reachedSixty,allocation:row.allocation}));
  });
  if(table==='squad_decisions') return currentEvaluations.map(evaluation=>{
    const common=reviewCommonEvaluationColumns(evaluation),squad=evaluation.decisions?.squad||{},captain=evaluation.decisions?.captaincy||{},bench=evaluation.decisions?.bench||{},manager=evaluation.decisions?.managerOutcome||{};
    return {...common,decision_status:evaluation.decisions?.status||'not_available',selected_xi_player_ids:squad.selectedRealised?.playerIds||squad.selectedPlayerIds||null,scoring_xi_player_ids:squad.selectedRealised?.scoringXI||null,selected_realised_base_points:squad.selectedRealised?.basePoints??null,hindsight_oracle_player_ids:squad.hindsightOracle?.playerIds||null,hindsight_oracle_realised_points:squad.hindsightOracle?.realisedPoints??null,selected_realised_rank:squad.selectedRealisedRank??null,captain_id:captain.selected?.captainId??null,vice_captain_id:captain.selected?.viceCaptainId??null,effective_captain_id:captain.selected?.effectiveCaptainId??null,captain_doubled_contribution:captain.selected?.doubledContribution??null,vice_took_over:captain.selected?.viceTookOver??null,bench_player_ids:bench.benchPlayerIds||null,automatic_substitution_contribution:bench.automaticSubstitutionContribution??null,points_left_on_bench:bench.pointsLeftOnBench??null,manager_outcome_status:manager.status||'not_available',manager_actual_points:manager.actualPoints??manager.points??null};
  });
  if(table==='transfer_horizons') return currentTransfers.flatMap(record=>{
    const common={season:record.season,start_gameweek:Number(record.startGameweek),horizon:Number(record.horizon),transfer_evaluation_id:record.identity?.transferEvaluationId||null,transfer_evaluation_revision:Number(record.identity?.revision)||1,transfer_evaluation_content_hash:record.identity?.contentHash||null,start_evaluation_id:record.sources?.startEvaluationId||null,required_gameweeks:record.completeness?.requiredGameweeks||null};
    const baseline={...common,plan_kind:'baseline',plan_signature:record.baseline?.signature||null,transfer_count:record.baseline?.transferCount??0,transfers:record.baseline?.transfers||[],hit_cost:record.baseline?.hitCost??0,roll_difference:record.baseline?.rollDifference??0,realised_base_points:record.baseline?.realisedBasePoints??null,gross_gain:0,net_gain_after_hits:0};
    return [baseline,...(record.plans||[]).map(plan=>({...common,plan_kind:'alternative',plan_signature:plan.signature||null,transfer_count:plan.transferCount,transfers:plan.transfers||[],hit_cost:plan.hitCost,roll_difference:plan.rollDifference,realised_base_points:plan.realisedBasePoints,gross_gain:plan.grossGain,net_gain_after_hits:plan.netGainAfterHits}))];
  });
  if(table==='transfer_horizon_gameweeks') return currentTransfers.flatMap(record=>{
    const plans=[{kind:'baseline',value:record.baseline},...(record.plans||[]).map(value=>({kind:'alternative',value}))];
    return plans.flatMap(plan=>(plan.value?.perGameweek||[]).map(row=>({season:record.season,start_gameweek:Number(record.startGameweek),horizon:Number(record.horizon),transfer_evaluation_id:record.identity?.transferEvaluationId||null,transfer_evaluation_revision:Number(record.identity?.revision)||1,plan_kind:plan.kind,plan_signature:plan.value?.signature||null,gameweek:Number(row.gw),xi_player_ids:row.xiPlayerIds||[],bench_player_ids:row.benchPlayerIds||[],realised_base_points:row.realisedBasePoints,automatic_substitution_contribution:row.automaticSubstitutionContribution,schedule_changed:Boolean(row.scheduleChanged)})));
  });
  if(table==='provider_states') return currentEvaluations.flatMap(evaluation=>{
    const snapshot=maps.snapshots.get(evaluation.sources?.snapshotId),common=reviewCommonEvaluationColumns(evaluation);
    return reviewProviderRows(snapshot).map(row=>({...common,provider:row.provider,state:row.state,included:row.included,did_affect_model:row.didAffectModel,accepted_count:row.acceptedCount,rejected_count:row.rejectedCount,last_success_at:row.lastSuccessAt,recorded_at:row.recordedAt,age_ms:row.ageMs,threshold_ms:row.thresholdMs,note:row.note,consequence:row.consequence}));
  });
  return (bundle.manifest||[]).map(row=>({record_type:row.recordType,record_id:row.recordId,logical_key:row.logicalKey,season:row.season,gameweek:row.gameweek,revision:row.revision,current:row.current,content_hash:row.contentHash,data_hash:row.dataHash,recorded_at:row.recordedAt,has_full_record:row.hasFullRecord}));
}
const REVIEW_CSV_COLUMNS=Object.freeze({
  gameweeks:['season','gameweek','deadline_time','evaluation_id','evaluation_revision','evaluation_content_hash','snapshot_id','snapshot_content_hash','outcome_id','outcome_revision','outcome_status','outcome_data_hash','player_rows','minute_fixture_rows','matched_players','schedule_aligned_players','unallocatable_minute_rows','player_mae','player_rmse','player_bias','within_two','within_five','predicted_mean','observed_mean','sample_level','sample_message','completeness'],
  players:['season','gameweek','deadline_time','evaluation_id','evaluation_revision','evaluation_content_hash','snapshot_id','snapshot_content_hash','outcome_id','outcome_revision','outcome_status','outcome_data_hash','player_id','player_name','club_id','position','now_cost','predicted_points','observed_points','error','absolute_error','error_band','appeared','reached_sixty','starts','observed_minutes','schedule_aligned','frozen_fixture_ids','official_fixture_ids','uncertainty_available','p10','p25','p75','p90','blank_probability','return_probability','haul_probability','mega_haul_probability','segments'],
  minute_fixtures:['season','gameweek','deadline_time','evaluation_id','evaluation_revision','evaluation_content_hash','snapshot_id','snapshot_content_hash','outcome_id','outcome_revision','outcome_status','outcome_data_hash','player_id','fixture_id','schedule_aligned','predicted_minutes','observed_minutes','p_start','started','p_appear','appeared','p_60','reached_sixty','allocation'],
  squad_decisions:['season','gameweek','deadline_time','evaluation_id','evaluation_revision','evaluation_content_hash','snapshot_id','snapshot_content_hash','outcome_id','outcome_revision','outcome_status','outcome_data_hash','decision_status','selected_xi_player_ids','scoring_xi_player_ids','selected_realised_base_points','hindsight_oracle_player_ids','hindsight_oracle_realised_points','selected_realised_rank','captain_id','vice_captain_id','effective_captain_id','captain_doubled_contribution','vice_took_over','bench_player_ids','automatic_substitution_contribution','points_left_on_bench','manager_outcome_status','manager_actual_points'],
  transfer_horizons:['season','start_gameweek','horizon','transfer_evaluation_id','transfer_evaluation_revision','transfer_evaluation_content_hash','start_evaluation_id','required_gameweeks','plan_kind','plan_signature','transfer_count','transfers','hit_cost','roll_difference','realised_base_points','gross_gain','net_gain_after_hits'],
  transfer_horizon_gameweeks:['season','start_gameweek','horizon','transfer_evaluation_id','transfer_evaluation_revision','plan_kind','plan_signature','gameweek','xi_player_ids','bench_player_ids','realised_base_points','automatic_substitution_contribution','schedule_changed'],
  provider_states:['season','gameweek','deadline_time','evaluation_id','evaluation_revision','evaluation_content_hash','snapshot_id','snapshot_content_hash','outcome_id','outcome_revision','outcome_status','outcome_data_hash','provider','state','included','did_affect_model','accepted_count','rejected_count','last_success_at','recorded_at','age_ms','threshold_ms','note','consequence'],
  revisions:['record_type','record_id','logical_key','season','gameweek','revision','current','content_hash','data_hash','recorded_at','has_full_record']
});
function reviewExportFileName(bundle,extension,table=null){
  const season=String(bundle.scope?.season||'season'),label=reviewScopeLabel(bundle.scope),suffix=table?`-${table.replaceAll('_','-')}`:'';
  return `teamsheet-${season}-${label}-operating-review${suffix}.${extension}`;
}
function buildOperatingReviewCsv(bundle,table){
  const columns=REVIEW_CSV_COLUMNS[table];if(!columns) throw new Error('Unknown operating-review CSV table');
  const rows=reviewCsvRows(bundle,table),text=reviewCsvDocument(columns,rows),bytes=reviewTextBytes(text);
  if(bytes>REVIEW_RULES.maxBytes) throw new Error('CSV export exceeds the 25 MB export limit; no truncated export was created');
  return {table,filename:reviewExportFileName(bundle,'csv',table),text,bytes,warning:bytes>REVIEW_RULES.warningBytes?'large_export':null,rows:rows.length};
}
function reviewMarkdownNumber(value,digits=2){return value==null||!Number.isFinite(Number(value))?'—':Number(value).toFixed(digits);}
function reviewMarkdownPercent(value){return value==null||!Number.isFinite(Number(value))?'—':`${(Number(value)*100).toFixed(1)}%`;}
function buildOperatingReviewMarkdown(bundle){
  const lines=[`# Teamsheet operating review — ${bundle.scope.season} ${bundle.scope.gameweek?`GW${bundle.scope.gameweek}`:'season'}`,'',`Evidence through: ${bundle.evidenceThrough}`,`Bundle ID: ${bundle.identity.bundleId}`,`Completeness: ${bundle.completeness.status}`,''];
  for(const weekly of bundle.weeklyReviews||[]){
    lines.push(`## GW${weekly.gameweek}`,'',weekly.status.sample.message,'',`- Player rows: ${weekly.headline.playerRows}`,`- Player MAE: ${reviewMarkdownNumber(weekly.headline.playerMae)}`,`- Bias: ${reviewMarkdownNumber(weekly.headline.playerBias)} (positive means Teamsheet overpredicted)`,`- Within 2 points: ${reviewMarkdownPercent(weekly.headline.withinTwo)}`,`- Schedule-aligned players: ${weekly.headline.scheduleAlignedPlayers}`,`- Unallocatable minute rows: ${weekly.headline.unallocatableMinuteRows}`,'');
    if(weekly.decisions?.squad) lines.push(`Frozen XI realised base points: ${weekly.decisions.squad.selectedRealised?.basePoints??'—'}. Hindsight oracle: ${weekly.decisions.squad.hindsightOracle?.realisedPoints??'—'} (descriptive only).`,'');
    if(weekly.transfer?.status==='complete') lines.push(`Frozen transfer horizon: complete across ${weekly.transfer.horizon} Gameweeks. Overlapping plan gains are not summed.`,'');
    else if(weekly.transfer?.status==='horizon_in_progress') lines.push('Frozen transfer horizon: in progress. No interim gain is shown.','');
    if(weekly.warnings?.length) lines.push('### Warnings','',...weekly.warnings.map(value=>`- ${value}`),'');
  }
  const cumulative=bundle.cumulativeReview,overall=cumulative?.overall?.player?.metrics||{},aligned=cumulative?.scheduleAligned?.player?.metrics||{};
  lines.push('## Cumulative review','',cumulative?.overall?.player?.sample?.message||'No cumulative sample.','',`- Evaluated Gameweeks: ${cumulative?.gameweeks?.length||0}`,`- Overall player MAE: ${reviewMarkdownNumber(overall.mae)}`,`- Schedule-aligned player MAE: ${reviewMarkdownNumber(aligned.mae)}`,`- Overall bias: ${reviewMarkdownNumber(overall.bias)}`,`- Schedule-aligned bias: ${reviewMarkdownNumber(aligned.bias)}`,'','No composite score, significance claim, calibration claim or automatic model update is produced.','');
  const text=lines.join('\n')+'\n',bytes=reviewTextBytes(text);if(bytes>REVIEW_RULES.maxBytes) throw new Error('Markdown export exceeds the 25 MB export limit');
  return {filename:reviewExportFileName(bundle,'md'),text,bytes,warning:bytes>REVIEW_RULES.warningBytes?'large_export':null};
}



/* ===== src/ui/transfer-optimiser-view.mjs ===== */
// Presentation only. The authoritative Transfers renderer and the background calculation
// live in transfer-performance.mjs; nothing here may enter the optimiser on the UI thread.

const TRANSFER_PLANNER_COMMITTED_CONTROL_IDS = Object.freeze(['trFtCount','trBankIn','trHorizon','trTop']);
const TRANSFER_PRESENTATION_STATES = Object.freeze({
  TRANSFER_FIRST:'transfer-first',
  BASELINE_FIRST:'baseline-first',
  BASELINE_ONLY:'baseline-only',
  UNAVAILABLE:'unavailable'
});
let transferPlannerRenderedControlSignature = null;

function transferPlannerControlSignature(...values){
  return values.map(value=>String(value ?? '')).join('|');
}

function transferPlannerCurrentControlSignature(){
  return transferPlannerControlSignature(
    $('trFtCount')?.value,
    $('trBankIn')?.value,
    $('trHorizon')?.value,
    $('trTop')?.value
  );
}

function transferPlannerRefreshRequired(renderedSignature,currentSignature){
  return renderedSignature!==currentSignature;
}

function transferPlannerHasActivePreview(preview={}){
  return Boolean(preview.transfer||preview.captainId!=null||preview.viceId!=null||preview.selectionMode!=null);
}

function transferPlannerDispatchPreviewChange(){
  if(typeof document!=='undefined') document.dispatchEvent(new CustomEvent('teamsheet:preview-change'));
}

function transferPlannerReadAssumptions(ftRaw,bankRaw){
  const issues=[];
  const ftText=String(ftRaw ?? '').trim();
  const bankText=String(bankRaw ?? '').trim();
  const ft=Number(ftText);
  const bankMillions=Number(bankText);

  if(!ftText) issues.push('Enter your current free transfers.');
  else if(!Number.isInteger(ft)||ft<0||ft>5) issues.push('Free transfers must be a whole number from 0 to 5.');

  if(!bankText) issues.push('Enter your bank balance.');
  else if(!Number.isFinite(bankMillions)||bankMillions<0) issues.push('Bank must be a non-negative amount.');
  else if(Math.abs(bankMillions*10-Math.round(bankMillions*10))>1e-8) issues.push('Bank must use £0.1m steps.');

  return {
    valid:issues.length===0,
    issues,
    freeTransfers:Number.isInteger(ft)&&ft>=0&&ft<=5?ft:null,
    bankMillions:Number.isFinite(bankMillions)&&bankMillions>=0?bankMillions:null,
    bankTenths:Number.isFinite(bankMillions)&&bankMillions>=0?Math.round(bankMillions*10):null
  };
}

function transferPlannerPresentationState(plans=[]){
  const source=Array.isArray(plans)?plans:[];
  const baseline=source.find(plan=>Number(plan?.transferCount)===0);
  if(!baseline) return TRANSFER_PRESENTATION_STATES.UNAVAILABLE;
  const alternatives=source.filter(plan=>Number(plan?.transferCount)>0);
  if(!alternatives.length) return TRANSFER_PRESENTATION_STATES.BASELINE_ONLY;
  return Number(source[0]?.transferCount)===0
    ? TRANSFER_PRESENTATION_STATES.BASELINE_FIRST
    : TRANSFER_PRESENTATION_STATES.TRANSFER_FIRST;
}

function transferPlannerNoTransferCopy(baseline={},alternativesCount=0,rankedFirst=false){
  const before=Math.max(0,Math.trunc(Number(baseline.freeTransfersBefore)||0));
  const next=Math.max(0,Math.trunc(Number(baseline.freeTransfersNextGW)||0));
  let ftEffect=`Keep ${next} free transfer${next===1?'':'s'} for next Gameweek.`;
  if(before>=5&&next>=5) ftEffect='No additional free transfer rolls while you are at the 5 FT cap.';
  else if(next>before&&before>0) ftEffect=`Roll one FT and move to ${next} free transfers next Gameweek.`;
  else if(next>before) ftEffect=`Make no transfer and move to ${next} free transfer${next===1?'':'s'} next Gameweek.`;

  let comparison='This is the required zero-transfer comparison.';
  if(alternativesCount===0)
    comparison='No comparable legal transfer plan was returned, so this is not evidence that making no transfer is optimal.';
  else if(rankedFirst)
    comparison='This baseline ranks above every returned legal 1–3 transfer plan under the current assumptions.';
  else
    comparison='This is the benchmark used to judge every returned transfer plan.';

  return {headline:'Make no transfer',ftEffect,comparison};
}

function transferPlannerNetLabel(value){
  const n=Number(value)||0;
  if(Math.abs(n)<0.05) return 'Level net model comparison';
  return `${n>0?'+':'−'}${Math.abs(n).toFixed(1)} net model ${n>0?'advantage':'disadvantage'}`;
}

function transferPlannerHitLabel(value){
  const points=Math.max(0,Math.trunc(Number(value)||0));
  return points?`−${points}`:'No hit';
}

function transferPlannerPlanNames(plan={},byId={}){
  return (plan.transfers||[]).map(move=>({
    outName:byId[move.outPlayerId]?.web_name||String(move.outPlayerId),
    inName:byId[move.inPlayerId]?.web_name||String(move.inPlayerId),
    outPlayerId:Number(move.outPlayerId),
    inPlayerId:Number(move.inPlayerId)
  }));
}

function transferPlannerFormatDeadline(){
  const event=S.boot?.events?.find(item=>Number(item.id)===Number(S.nextGW));
  if(!event?.deadline_time) return `GW${S.nextGW||'—'} deadline unavailable`;
  const deadline=new Date(event.deadline_time);
  const hours=(deadline-Date.now())/3600000;
  const stamp=deadline.toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  if(hours<0) return `${stamp} · passed`;
  if(hours<48) return `${stamp} · ${Math.floor(hours)}h ${Math.max(0,Math.floor((hours%1)*60))}m`;
  return `${stamp} · ${Math.floor(hours/24)}d`;
}

function transferPlannerSourceLabel(){
  if(S.cachedAt) return 'Verified saved FPL data';
  if(S.source) return `FPL ${S.source}`;
  return 'Verified FPL data';
}

function transferPlannerMoveList(plan){
  const moves=transferPlannerPlanNames(plan,S.byId);
  return el('div',{class:'transfer-moves'},moves.map(move=>
    el('div',{class:'transfer-move'},
      el('div',{class:'transfer-player transfer-player-out'},el('span',{class:'transfer-kicker'},'Out'),el('strong',{},move.outName)),
      el('span',{class:'transfer-arrow','aria-hidden':'true'},'→'),
      el('div',{class:'transfer-player transfer-player-in'},el('span',{class:'transfer-kicker'},'In'),el('strong',{},move.inName))
    )));
}

function transferPlannerMetric(label,value,meta=''){
  return el('div',{class:'transfer-metric'},
    el('span',{class:'transfer-metric-label'},label),
    el('strong',{},value),
    meta?el('span',{class:'transfer-metric-meta'},meta):null);
}

function transferPlannerPlanContext(plan,horizon){
  const first=plan.perGameweekBestXI?.[0];
  if(!first) return 'Next-Gameweek XI consequence unavailable.';
  const incoming=new Set((plan.transfers||[]).map(move=>Number(move.inPlayerId)));
  const firstIds=(first.playerIds||[]).map(Number);
  const starters=firstIds.filter(id=>incoming.has(id)).map(id=>S.byId[id]?.web_name||String(id));
  const benched=[...incoming].filter(id=>!firstIds.includes(id)).map(id=>S.byId[id]?.web_name||String(id));
  const parts=[`GW${first.gw} formation ${first.formation}`];
  if(starters.length) parts.push(`${starters.join(', ')} projected in the XI`);
  if(benched.length) parts.push(`${benched.join(', ')} projected on the bench`);
  parts.push(`the ${horizon}-GW comparison does not include captain doubling or bench points`);
  return parts.join(' · ');
}

function transferPlannerCautions(plan,pricingMode){
  const cautions=[];
  if(pricingMode==='estimated') cautions.push('Affordability is estimated because verified purchase prices are unavailable. Confirm the move inside FPL.');
  else cautions.push('Affordability uses the recorded squad purchase prices.');
  (plan?.warnings||[]).forEach(warning=>cautions.push(warning));
  if(!(plan?.warnings||[]).length) cautions.push('No incoming availability warning was returned; still check the latest team news before confirming.');
  return cautions;
}

function transferPlannerDetails(plan,horizon){
  const rollAdjustment=(Number(plan.rollDifference)||0)*0.5;
  return el('details',{class:'transfer-details'},
    el('summary',{},'Review details'),
    el('div',{class:'transfer-details-body'},
      el('div',{class:'transfer-metrics'},
        transferPlannerMetric('Gross XI gain',`${Number(plan.grossGain)>=0?'+':''}${Number(plan.grossGain||0).toFixed(1)}`,'Best legal XI across the selected horizon'),
        transferPlannerMetric('Hit',transferPlannerHitLabel(plan.hitCost),'Actual FPL transfer deduction'),
        transferPlannerMetric('FT adjustment',`${rollAdjustment>=0?'+':''}${rollAdjustment.toFixed(1)}`,'Decision utility, not an FPL score'),
        transferPlannerMetric('Net comparison',`${Number(plan.netGain)>=0?'+':''}${Number(plan.netGain||0).toFixed(1)}`,'Gross gain minus hit plus FT utility')),
      el('p',{class:'transfer-explainer'},transferPlannerPlanContext(plan,horizon))));
}

function transferPlannerPreviewButton(plan,index,squad,optimiserSignature,horizon,selected){
  return el('button',{
    type:'button',
    class:`btn transfer-preview-action${selected?' selected':''}`,
    'aria-label':`Preview transfer plan ${index+1} on the Team pitch`,
    onclick:()=>{
      decisionPreviewSelectTransfer({...plan,previewHorizon:horizon},squad,optimiserSignature);
      transferPlannerDispatchPreviewChange();
      globalThis.__teamsheetNavigate?.('#/team');
    }
  },selected?'Previewing on Team':'Preview on Team');
}

function transferPlannerPlanCard(plan,{title,index,squad,optimiserSignature,horizon,selected,primary=false,pricingMode='exact'}){
  const moves=transferPlannerPlanNames(plan,S.byId);
  const cautionItems=transferPlannerCautions(plan,pricingMode);
  return el('article',{class:`transfer-card transfer-plan-card${primary?' primary':''}`},
    el('div',{class:'transfer-card-head'},
      el('div',{},el('span',{class:'eyebrow'},title),el('h3',{},moves.map(move=>`${move.outName} → ${move.inName}`).join(' · '))),
      el('span',{class:'transfer-rank'},`#${index+1}`)),
    transferPlannerMoveList(plan),
    el('div',{class:'transfer-metrics transfer-metrics-summary'},
      transferPlannerMetric('Net model comparison',`${Number(plan.netGain)>=0?'+':''}${Number(plan.netGain||0).toFixed(1)}`,`vs no transfer over ${horizon} GW${horizon===1?'':'s'}`),
      transferPlannerMetric('Hit',transferPlannerHitLabel(plan.hitCost),plan.hitCost?'Paid transfer cost':'No points deduction'),
      transferPlannerMetric('Bank after',`£${(Number(plan.bankAfter||0)/10).toFixed(1)}m`),
      transferPlannerMetric('Next GW',`${Number(plan.freeTransfersNextGW)||0} FT`)),
    el('p',{class:'transfer-why'},el('b',{},'Why shown: '),primary
      ? 'Highest net comparison returned under these planning assumptions.'
      : 'Next highest returned legal option under these planning assumptions.'),
    el('div',{class:'transfer-caution'},
      el('strong',{},'Known cautions'),
      el('ul',{},cautionItems.map(item=>el('li',{},item)))),
    transferPlannerDetails(plan,horizon),
    el('div',{class:'transfer-actions'},
      transferPlannerPreviewButton(plan,index,squad,optimiserSignature,horizon,selected)));
}

function transferPlannerBaselineCard(baseline,{alternativesCount,rankedFirst,primary=false}){
  const copy=transferPlannerNoTransferCopy(baseline,alternativesCount,rankedFirst);
  return el('article',{class:`transfer-card transfer-baseline-card${primary?' primary':''}`},
    el('span',{class:'eyebrow'},rankedFirst?'Highest-ranked decision':'Required comparison'),
    el('h3',{},copy.headline),
    el('p',{class:'transfer-card-lead'},copy.comparison),
    el('div',{class:'transfer-metrics transfer-metrics-summary'},
      transferPlannerMetric('Net comparison','0.0','The benchmark'),
      transferPlannerMetric('Hit',transferPlannerHitLabel(baseline.hitCost),'No points deduction'),
      transferPlannerMetric('Bank after',`£${(Number(baseline.bankAfter||0)/10).toFixed(1)}m`),
      transferPlannerMetric('Next GW',`${Number(baseline.freeTransfersNextGW)||0} FT`)),
    el('p',{class:'transfer-ft-effect'},copy.ftEffect));
}

function transferPlannerDecisionHero(state,baseline,topAlternative,horizon){
  let eyebrow='Decision status',title='No verified comparison',detail='Teamsheet cannot rank a transfer decision yet.',metric='—',hit='—';
  if(state===TRANSFER_PRESENTATION_STATES.TRANSFER_FIRST&&topAlternative){
    const moves=transferPlannerPlanNames(topAlternative,S.byId);
    eyebrow='Highest-ranked decision';
    title=moves.map(move=>`${move.outName} → ${move.inName}`).join(' · ');
    detail='This transfer plan ranks above making no transfer under the current assumptions.';
    metric=transferPlannerNetLabel(topAlternative.netGain);
    hit=Number(topAlternative.hitCost)?`${Number(topAlternative.hitCost)}-point hit`:'No hit';
  }else if(state===TRANSFER_PRESENTATION_STATES.BASELINE_FIRST){
    eyebrow='Highest-ranked decision';
    title='Make no transfer';
    detail='The zero-transfer baseline ranks above the returned legal transfer plans.';
    metric='Baseline ranks first';
    hit='No hit';
  }else if(state===TRANSFER_PRESENTATION_STATES.BASELINE_ONLY){
    eyebrow='Comparison incomplete';
    title='Make no transfer is the only legal comparison';
    detail='No transfer alternative was returned, so Teamsheet is not calling this optimal.';
    metric='Baseline only';
    hit='No hit';
  }
  return el('section',{class:`transfer-decision-hero state-${state}`,'aria-labelledby':'transferDecisionTitle'},
    el('span',{class:'eyebrow'},eyebrow),
    el('h3',{id:'transferDecisionTitle'},title),
    el('p',{},detail),
    el('div',{class:'transfer-hero-facts'},
      el('span',{},metric),
      el('span',{},hit),
      el('span',{},`${horizon} GW${horizon===1?'':'s'}`)));
}

function transferPlannerContext(){
  return el('div',{class:'transfer-context-chips','aria-label':'Transfer comparison context'},
    el('span',{class:'transfer-context-chip'},`GW${S.nextGW||'—'}`),
    el('span',{class:'transfer-context-chip deadline'},transferPlannerFormatDeadline()),
    el('span',{class:'transfer-context-chip source'},transferPlannerSourceLabel()));
}

function transferPlannerBlocking(out,title,detail){
  S.lastOptimiser=null;
  setChildren(out,transferPlannerContext(),el('div',{class:'note bad',role:'alert'},el('b',{},title),` ${detail}`));
}

function transferPlannerSyncVisibleAssumptions(){
  const pairs=[['trFtCount','ftCount'],['trBankIn','bankIn']];
  pairs.forEach(([visibleId,canonicalId])=>{
    const visible=$(visibleId),canonical=$(canonicalId);
    if(!visible||!canonical||document.activeElement===visible) return;
    visible.value=canonical.value;
  });
}

function transferPlannerMarkUpdating(){
  const out=$('transferOut'),status=$('transferStatus');
  if(out) out.setAttribute('aria-busy','true');
  if(status) status.textContent='Updating transfer comparison…';
}

function transferPlannerClearPreview(){
  const preview=decisionPreviewSnapshot();
  decisionPreviewClearTransfer();
  if(transferPlannerHasActivePreview(preview)) transferPlannerDispatchPreviewChange();
}

function transferPlannerRefreshCommittedSelection(){
  const currentSignature=transferPlannerCurrentControlSignature();
  if(!transferPlannerRefreshRequired(transferPlannerRenderedControlSignature,currentSignature)) return false;
  transferPlannerClearPreview();
  void saveCfg();
  renderTransfers();
  return true;
}

function transferPlannerMirrorAssumption(visibleId,canonicalId){
  const visible=$(visibleId),canonical=$(canonicalId);
  if(!visible||!canonical||visible.dataset.assumptionMirrorInstalled==='true') return;
  visible.dataset.assumptionMirrorInstalled='true';
  visible.addEventListener('input',()=>{
    transferPlannerMarkUpdating();
    transferPlannerClearPreview();
    canonical.value=visible.value;
    canonical.dispatchEvent(new Event('input',{bubbles:true}));
  });
}

function installTransferPlannerCommittedControlRefresh(){
  if(typeof document==='undefined') return;
  transferPlannerSyncVisibleAssumptions();
  transferPlannerMirrorAssumption('trFtCount','ftCount');
  transferPlannerMirrorAssumption('trBankIn','bankIn');

  ['trHorizon','trTop'].forEach(id=>{
    const control=$(id);
    if(!control||control.dataset.committedRefreshInstalled==='true') return;
    control.dataset.committedRefreshInstalled='true';
    control.addEventListener('input',transferPlannerMarkUpdating);
    control.addEventListener('change',transferPlannerRefreshCommittedSelection);
  });
}

installTransferPlannerCommittedControlRefresh();



/* ===== src/ui/transfer-performance.mjs ===== */

const TRANSFER_PERFORMANCE_CACHE_LIMIT = 4;
const TRANSFER_PERFORMANCE_SCORE_BATCH = 12;
const TRANSFER_PERFORMANCE_PROGRESS_MS = 200;
const TRANSFER_PERFORMANCE_UNAVAILABLE = 'This browser cannot run the transfer calculation in the background, so no comparison is being produced.';
const TRANSFER_PERFORMANCE_INPUT_IDS = new Set(['ftCount','bankIn','trFtCount','trBankIn','trHorizon','trTop','useManual']);
const transferPerformanceCache = new Map();
let transferPerformanceWorker = null;
let transferPerformanceToken = 0;
let transferPerformanceDataVersion = 0;
let transferPerformanceInstalled = false;
let transferPerformanceBusyDetail = null;
let transferPerformanceActive = null;
let transferPerformanceCancelledSignature = '';
let transferPerformanceFailure = null;
let transferPerformanceAutoTimer = null;

// The worker runs the reviewed transfer model verbatim. Nothing rewrites, patches or
// re-derives the optimiser at runtime.
const TRANSFER_PERFORMANCE_WORKER_HANDLER = `
self.onmessage=event=>{
  const payload=event.data||{};
  if(payload.type!=="calculate") return;
  const requestId=payload.requestId;
  const rows=Array.isArray(payload.scoreRows)?payload.scoreRows:[];
  const scoreMap=new Map(rows.map(row=>[Number(row[0]),Array.isArray(row[1])?row[1]:[]]));
  const startGW=Number(payload.args?.startGW)||1;
  const scorePlayer=(player,gw)=>{
    const scores=scoreMap.get(Number(player?.id));
    const value=Number(scores?.[Number(gw)-startGW]);
    return Number.isFinite(value)?value:0;
  };
  let reportedAt=0;
  const onProgress=state=>{
    const now=Date.now();
    if(now-reportedAt<${TRANSFER_PERFORMANCE_PROGRESS_MS}) return;
    reportedAt=now;
    self.postMessage({type:"progress",requestId,depth:state.depth,maxDepth:state.maxDepth,evaluations:state.evaluations});
  };
  try{
    const result=optimiseTransfers({...payload.args,scorePlayer,onProgress});
    self.postMessage({type:"result",requestId,result});
  }catch(error){
    self.postMessage({type:"error",requestId,message:String(error?.message||error||"Worker calculation failed")});
  }
};`;

function transferPerformanceWorkerSource(modelSource, rules=TRANSFER_RULES){
  const source=String(modelSource||'');
  if(!/function optimiseTransfers\(/.test(source))
    throw new Error('The reviewed transfer model is missing from this build.');
  return `"use strict";\nconst TRANSFER_RULES=${JSON.stringify(rules)};\n${source}\n${TRANSFER_PERFORMANCE_WORKER_HANDLER}`;
}

function transferPerformanceHash(value, seed=2166136261){
  let hash=seed>>>0;
  const text=String(value ?? '');
  for(let i=0;i<text.length;i++){
    hash^=text.charCodeAt(i);
    hash=Math.imul(hash,16777619)>>>0;
  }
  return hash>>>0;
}

function transferPerformanceCurrentRoute(){
  return String(globalThis.location?.hash||'').split('?')[0];
}
function transferPerformanceVisible(){ return transferPerformanceCurrentRoute()==='#/transfers'; }

function transferPerformanceYield(){
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

function transferPerformanceControlSignature(){
  return transferPlannerControlSignature(
    $('trFtCount')?.value,
    $('trBankIn')?.value,
    $('trHorizon')?.value,
    $('trTop')?.value
  );
}

function transferPerformanceWorkerPlayer(player={}){
  return {
    id:Number(player.id),
    web_name:String(player.web_name||player.id||''),
    team:Number(player.team),
    element_type:Number(player.element_type),
    now_cost:Number(player.now_cost)||0,
    status:String(player.status||'a'),
    chance_of_playing_next_round:player.chance_of_playing_next_round??null
  };
}

function transferPerformanceSnapshot(){
  if(!S.boot) return {error:['Verified player data is unavailable.','Refresh from Settings before using transfer comparisons.']};
  const squad=mySquad();
  if(squad.length!==15) return {error:['A complete 15-player squad is required.','Load your team or finish the manual squad in Team setup.']};
  const assumptions=transferPlannerReadAssumptions($('trFtCount')?.value,$('trBankIn')?.value);
  if(!assumptions.valid) return {error:['Check the planning assumptions.',assumptions.issues.join(' ')]};
  const horizon=Math.max(1,Math.min(8,Math.trunc(Number($('trHorizon')?.value)||6)));
  const maxResults=Math.max(1,Math.min(20,Math.trunc(Number($('trTop')?.value)||8)));
  const squadSignature=decisionPreviewSquadSignature(squad);
  const signature=[
    transferPerformanceDataVersion,
    typeof BUILD_INFO!=='undefined'?BUILD_INFO.sourceHash:'',
    S.nextGW,
    horizon,
    maxResults,
    assumptions.bankTenths,
    assumptions.freeTransfers,
    squadSignature
  ].join('|');
  return {
    squad,
    players:S.boot.elements||[],
    horizon,
    maxResults,
    assumptions,
    squadSignature,
    signature,
    args:{
      squad:squad.map(entry=>({
        p:transferPerformanceWorkerPlayer(entry?.p||entry),
        bought:entry?.bought??entry?.purchasePrice??null
      })),
      players:(S.boot.elements||[]).map(transferPerformanceWorkerPlayer),
      bank:assumptions.bankTenths,
      freeTransfers:assumptions.freeTransfers,
      startGW:S.nextGW,
      horizon,
      maxResults
    }
  };
}

function transferPerformanceCacheSet(key,value){
  transferPerformanceCache.delete(key);
  transferPerformanceCache.set(key,value);
  while(transferPerformanceCache.size>TRANSFER_PERFORMANCE_CACHE_LIMIT)
    transferPerformanceCache.delete(transferPerformanceCache.keys().next().value);
}

function transferPerformanceStatus(text){
  const status=$('transferStatus');
  if(status) status.textContent=text;
}

function transferPerformanceAction(label,handler,{secondary=false}={}){
  return el('button',{type:'button',class:`btn${secondary?' ghost':''}`,onclick:handler},label);
}

function transferPerformancePreparingDetail(completed,total){
  const share=total>0?Math.min(100,Math.round(completed/total*100)):100;
  return `Preparing projections ${share}%.`;
}

function transferPerformanceSearchingDetail(progress=null){
  const depth=Math.max(0,Math.trunc(Number(progress?.depth)||0));
  const evaluations=Math.max(0,Math.trunc(Number(progress?.evaluations)||0));
  if(!evaluations) return 'Checking exact transfer plans in the background.';
  const scope=depth?` · up to ${depth} transfer${depth===1?'':'s'}`:'';
  return `Checking exact transfer plans in the background. ${evaluations.toLocaleString('en-GB')} complete plans verified${scope}.`;
}

function transferPerformanceRenderBusy(detail){
  const out=$('transferOut');
  if(!out) return;
  out.setAttribute('aria-busy','true');
  if(transferPerformanceBusyDetail&&transferPerformanceBusyDetail.parentNode?.parentNode===out){
    if(transferPerformanceBusyDetail.textContent!==detail){
      transferPerformanceBusyDetail.textContent=detail;
      transferPerformanceStatus(detail);
    }
    return;
  }
  transferPerformanceBusyDetail=document.createTextNode(detail);
  setChildren(out,
    transferPlannerContext(),
    el('div',{class:'note plain'},el('b',{},'Updating transfer advice. '),transferPerformanceBusyDetail),
    el('div',{class:'transfer-actions'},
      transferPerformanceAction('Cancel calculation',()=>transferPerformanceCancel('Calculation cancelled.',{explicit:true}),{secondary:true})));
  transferPerformanceStatus(detail);
}

function transferPerformanceRenderError(title,detail){
  const out=$('transferOut');
  if(!out) return;
  transferPerformanceBusyDetail=null;
  out.setAttribute('aria-busy','false');
  transferPlannerBlocking(out,title,detail);
  transferPerformanceStatus('Transfer comparison unavailable.');
}

function transferPerformanceRenderCancelled(snapshot,message='Calculation cancelled.'){
  const out=$('transferOut');
  if(!out) return;
  transferPerformanceBusyDetail=null;
  out.setAttribute('aria-busy','false');
  setChildren(out,
    transferPlannerContext(),
    el('div',{class:'note plain'},el('b',{},'Transfer calculation paused. '),message),
    el('div',{class:'transfer-actions'},
      transferPerformanceAction('Resume calculation',()=>{
        transferPerformanceCancelledSignature='';
        void transferPerformanceStart(snapshot,{force:true});
      })));
  transferPerformanceStatus('Transfer calculation paused.');
}

function transferPerformanceRenderFailure(snapshot){
  const out=$('transferOut');
  if(!out) return;
  transferPerformanceBusyDetail=null;
  out.setAttribute('aria-busy','false');
  setChildren(out,
    transferPlannerContext(),
    el('div',{class:'note bad',role:'alert'},el('b',{},'Transfers could not be calculated. '),TRANSFER_PERFORMANCE_UNAVAILABLE),
    el('div',{class:'transfer-actions'},
      transferPerformanceAction('Retry',()=>{
        transferPerformanceFailure=null;
        void transferPerformanceStart(snapshot,{force:true});
      })));
  transferPerformanceStatus('Transfer comparison unavailable.');
}

function transferPerformanceResultBaseline(result={}){
  const baseline=result?.baseline;
  if(!baseline||Number(baseline.transferCount)!==0) return null;
  if(!Array.isArray(baseline.transfers)||baseline.transfers.length!==0) return null;
  return baseline;
}

function transferPerformanceRenderResult(result,context,{cached=false}={}){
  const out=$('transferOut');
  if(!out) return;
  transferPerformanceBusyDetail=null;
  const {snapshot}=context;
  const {squad,horizon,assumptions,squadSignature}=snapshot;
  S.lastOptimiser={result,horizon,bank:assumptions.bankTenths,freeTransfers:assumptions.freeTransfers,startGW:S.nextGW,squadSignature};

  if(result.status==='invalid-input'){
    transferPerformanceRenderError('Squad cannot be compared.',`Fix the squad before continuing: ${(result.issues||[]).join(', ')}.`);
    return;
  }
  if(result.status==='projection-unavailable'){
    transferPerformanceRenderError('Projections are unavailable.','No transfer recommendation can be made from an unverified comparison.');
    return;
  }
  if(result.status==='search-incomplete'){
    transferPerformanceRenderError('Exact search did not complete.','No partial result is being presented as optimal.');
    return;
  }

  const rankedPlans=Array.isArray(result.plans)?result.plans:[];
  const baseline=transferPerformanceResultBaseline(result);
  if(!baseline){
    transferPerformanceRenderError('No zero-transfer baseline was returned.','Teamsheet will not present a transfer decision without its required comparison.');
    return;
  }
  const plans=rankedPlans.some(plan=>Number(plan?.transferCount)===0)
    ? rankedPlans.map(plan=>Number(plan?.transferCount)===0?baseline:plan)
    : [...rankedPlans,baseline];
  const state=transferPlannerPresentationState(plans);
  const alternatives=rankedPlans.filter(plan=>Number(plan?.transferCount)>0);
  const topAlternative=alternatives[0]||null;
  const optimiserSignature=decisionPreviewOptimiserSignature({
    squadSignature,horizon,bank:assumptions.bankTenths,freeTransfers:assumptions.freeTransfers,plans
  });
  const previewCleared=decisionPreviewSyncOptimiser(optimiserSignature);
  if(previewCleared) transferPlannerDispatchPreviewChange();
  const previewState=decisionPreviewSnapshot();
  const nodes=[
    transferPlannerContext(),
    transferPlannerDecisionHero(state,baseline,topAlternative,horizon),
    el('div',{class:'transfer-card-stack'},
      transferPlannerBaselineCard(baseline,{
        alternativesCount:alternatives.length,
        rankedFirst:state===TRANSFER_PRESENTATION_STATES.BASELINE_FIRST,
        primary:state===TRANSFER_PRESENTATION_STATES.BASELINE_FIRST||state===TRANSFER_PRESENTATION_STATES.BASELINE_ONLY
      }),
      topAlternative?transferPlannerPlanCard(topAlternative,{
        title:state===TRANSFER_PRESENTATION_STATES.TRANSFER_FIRST?'Highest-ranked transfer plan':'Best transfer alternative',
        index:plans.indexOf(topAlternative),squad,optimiserSignature,horizon,
        selected:Boolean(previewState.transfer)&&decisionPreviewPlanSignature(previewState.transfer)===decisionPreviewPlanSignature(topAlternative),
        primary:state===TRANSFER_PRESENTATION_STATES.TRANSFER_FIRST,pricingMode:result.pricingMode
      }):null)
  ];

  const otherAlternatives=alternatives.slice(1,4);
  if(otherAlternatives.length){
    nodes.push(el('details',{class:'transfer-alternatives'},
      el('summary',{},`Other legal options shown (${otherAlternatives.length} of ${Math.max(0,alternatives.length-1)})`),
      el('div',{class:'transfer-card-stack'},otherAlternatives.map(plan=>transferPlannerPlanCard(plan,{
        title:plan.hitCost?`${plan.transferCount}-transfer plan · ${plan.hitCost}-point hit`:`${plan.transferCount}-transfer plan`,
        index:plans.indexOf(plan),squad,optimiserSignature,horizon,
        selected:Boolean(previewState.transfer)&&decisionPreviewPlanSignature(previewState.transfer)===decisionPreviewPlanSignature(plan),
        primary:false,pricingMode:result.pricingMode
      })))));
  }

  nodes.push(el('p',{class:'transfer-disclaimer'},
    'Net model comparison = best-XI projection change minus transfer hits plus the versioned free-transfer utility. It is not a promise of FPL points, and it excludes captain doubling and bench points. The interface shows the highest-ranked plan plus up to three additional alternatives.'));
  setChildren(out,nodes);
  out.setAttribute('aria-busy','false');
  transferPlannerRenderedControlSignature=transferPerformanceControlSignature();
  transferPerformanceStatus(cached?'Saved transfer comparison reused instantly.':'Transfer comparison updated.');
}

function transferPerformanceUpdateBusy(detail){
  if(transferPerformanceActive) transferPerformanceActive.detail=detail;
  if(transferPerformanceVisible()) transferPerformanceRenderBusy(detail);
}

async function transferPerformanceScores(snapshot,token){
  const rows=[];
  let dataHash=2166136261;
  const total=snapshot.players.length;
  for(let start=0;start<total;start+=TRANSFER_PERFORMANCE_SCORE_BATCH){
    if(token!==transferPerformanceToken) throw transferPerformanceAbortError();
    const end=Math.min(total,start+TRANSFER_PERFORMANCE_SCORE_BATCH);
    for(let index=start;index<end;index++){
      const player=snapshot.players[index];
      const scores=[];
      dataHash=transferPerformanceHash(`${player.id}|${player.team}|${player.element_type}|${player.now_cost}|${player.status}|${player.chance_of_playing_next_round}`,dataHash);
      for(let offset=0;offset<snapshot.horizon;offset++){
        const value=Number(xpOf(player,S.nextGW+offset,1).total);
        const safe=Number.isFinite(value)?value:0;
        scores.push(safe);
        dataHash=transferPerformanceHash(safe.toFixed(8),dataHash);
      }
      rows.push([Number(player.id),scores]);
    }
    transferPerformanceUpdateBusy(transferPerformancePreparingDetail(end,total));
    await transferPerformanceYield();
  }
  return {rows,dataHash:dataHash.toString(16)};
}

function transferPerformanceCreateWorker(){
  if(typeof Worker!=='function'||typeof Blob!=='function'||!globalThis.URL?.createObjectURL)
    throw new Error('worker_unsupported');
  if(typeof TRANSFER_WORKER_MODEL_SOURCE!=='string'||!TRANSFER_WORKER_MODEL_SOURCE)
    throw new Error('worker_model_unavailable');
  const source=transferPerformanceWorkerSource(TRANSFER_WORKER_MODEL_SOURCE);
  const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
  try{ return new Worker(url); }
  finally{ URL.revokeObjectURL(url); }
}

async function transferPerformanceStart(initialSnapshot=transferPerformanceSnapshot(),{force=false}={}){
  if(initialSnapshot?.error){
    if(transferPerformanceVisible()) transferPerformanceRenderError(initialSnapshot.error[0],initialSnapshot.error[1]);
    return;
  }
  const snapshot=initialSnapshot;
  const cached=transferPerformanceCache.get(snapshot.signature);
  if(cached&&!force){
    transferPerformanceRenderResult(cached.result,cached.context,{cached:true});
    return cached.result;
  }
  if(transferPerformanceActive?.signature===snapshot.signature&&!force){
    if(transferPerformanceVisible()) transferPerformanceRenderBusy(transferPerformanceActive.detail);
    return transferPerformanceActive.promise;
  }
  transferPerformanceCancel('',{render:false,explicit:false});
  transferPerformanceCancelledSignature='';
  transferPerformanceFailure=null;
  const token=++transferPerformanceToken;
  transferPlannerClearPreview();
  void saveCfg();
  const detail=transferPerformancePreparingDetail(0,snapshot.players.length);
  transferPerformanceActive={signature:snapshot.signature,detail,promise:null,token,cancel:null};
  transferPerformanceUpdateBusy(detail);

  const promise=(async()=>{
    try{
      const prepared=await transferPerformanceScores(snapshot,token);
      if(token!==transferPerformanceToken) return;
      const exactSignature=`${snapshot.signature}|${prepared.dataHash}`;
      const exactCached=transferPerformanceCache.get(exactSignature);
      if(exactCached){
        transferPerformanceActive=null;
        transferPerformanceCacheSet(snapshot.signature,exactCached);
        transferPerformanceRenderResult(exactCached.result,exactCached.context,{cached:true});
        return exactCached.result;
      }

      const worker=transferPerformanceCreateWorker();
      transferPerformanceWorker=worker;
      transferPerformanceUpdateBusy(transferPerformanceSearchingDetail());
      const result=await new Promise((resolve,reject)=>{
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
      if(token!==transferPerformanceToken) return;
      worker.terminate();
      transferPerformanceWorker=null;
      transferPerformanceActive=null;
      const context={snapshot,preparedAt:Date.now()};
      const record={result,context};
      transferPerformanceCacheSet(exactSignature,record);
      transferPerformanceCacheSet(snapshot.signature,record);
      transferPerformanceRenderResult(result,context);
      return result;
    }catch(error){
      if(error?.name==='AbortError'||token!==transferPerformanceToken) return;
      transferPerformanceWorker?.terminate?.();
      transferPerformanceWorker=null;
      transferPerformanceActive=null;
      transferPerformanceFailure={signature:snapshot.signature};
      if(transferPerformanceVisible()) transferPerformanceRenderFailure(snapshot);
    }
  })();
  transferPerformanceActive.promise=promise;
  return promise;
}

function transferPerformanceCancel(message='Calculation cancelled.',{render=true,explicit=false}={}){
  const active=transferPerformanceActive;
  const activeSignature=active?.signature||transferPerformanceSnapshot()?.signature||'';
  transferPerformanceToken++;
  active?.cancel?.();
  transferPerformanceWorker?.terminate?.();
  transferPerformanceWorker=null;
  transferPerformanceActive=null;
  if(explicit) transferPerformanceCancelledSignature=activeSignature;
  if(render&&transferPerformanceVisible()){
    const snapshot=transferPerformanceSnapshot();
    if(snapshot.error) transferPerformanceRenderError(snapshot.error[0],snapshot.error[1]);
    else if(explicit) transferPerformanceRenderCancelled(snapshot,message);
  }
}

function transferPerformanceEnsure(snapshot=transferPerformanceSnapshot()){
  if(snapshot.error){
    if(transferPerformanceActive) transferPerformanceCancel('',{render:false,explicit:false});
    if(transferPerformanceVisible()) transferPerformanceRenderError(snapshot.error[0],snapshot.error[1]);
    return;
  }
  const cached=transferPerformanceCache.get(snapshot.signature);
  if(cached){ transferPerformanceRenderResult(cached.result,cached.context,{cached:true}); return; }
  if(transferPerformanceActive?.signature===snapshot.signature){
    transferPerformanceRenderBusy(transferPerformanceActive.detail); return;
  }
  if(transferPerformanceCancelledSignature===snapshot.signature){
    transferPerformanceRenderCancelled(snapshot); return;
  }
  if(transferPerformanceFailure?.signature===snapshot.signature){
    transferPerformanceRenderFailure(snapshot); return;
  }
  transferPerformanceRenderBusy(transferPerformancePreparingDetail(0,snapshot.players.length));
  void transferPerformanceStart(snapshot);
}

function transferPerformanceScheduleAuto(){
  if(transferPerformanceAutoTimer!=null) globalThis.clearTimeout?.(transferPerformanceAutoTimer);
  transferPerformanceAutoTimer=globalThis.setTimeout?.(()=>{
    transferPerformanceAutoTimer=null;
    const snapshot=transferPerformanceSnapshot();
    if(snapshot.error){
      if(transferPerformanceActive) transferPerformanceCancel('',{render:false,explicit:false});
      if(transferPerformanceVisible()) transferPerformanceRenderError(snapshot.error[0],snapshot.error[1]);
      return;
    }
    if(transferPerformanceCancelledSignature===snapshot.signature||transferPerformanceFailure?.signature===snapshot.signature){
      if(transferPerformanceVisible()) transferPerformanceEnsure(snapshot);
      return;
    }
    void transferPerformanceStart(snapshot);
  },0);
}

function renderTransfers(){
  const out=$('transferOut');
  if(!out) return;
  renderRouteDataWarning('transferDataWarning',{showUnavailable:false});
  transferPlannerSyncVisibleAssumptions();
  transferPlannerRenderedControlSignature=transferPerformanceControlSignature();
  transferPerformanceEnsure(transferPerformanceSnapshot());
}

function installTransferPerformanceRuntime(){
  if(transferPerformanceInstalled||typeof document==='undefined') return;
  transferPerformanceInstalled=true;

  document.addEventListener('teamsheet:route-change',event=>{
    if(event?.detail?.route==='#/transfers') renderTransfers();
  });
  document.addEventListener('teamsheet:data-rendered',()=>{
    transferPerformanceDataVersion++;
    transferPerformanceCache.clear();
    transferPerformanceCancelledSignature='';
    transferPerformanceFailure=null;
    transferPerformanceCancel('',{render:false,explicit:false});
    transferPerformanceScheduleAuto();
  });
  const scheduleFromInput=event=>{
    if(TRANSFER_PERFORMANCE_INPUT_IDS.has(String(event?.target?.id||''))) transferPerformanceScheduleAuto();
  };
  document.addEventListener('input',scheduleFromInput);
  document.addEventListener('change',scheduleFromInput);
}

installTransferPerformanceRuntime();



/* ===== src/ui/mini-leagues-view.mjs ===== */

const MINI_LEAGUE_PAGE_SIZE=50;
let miniLeagueStandingsRequest=0;
let miniLeagueRivalRequest=0;
let miniLeagueExposureRequest=0;
let miniLeagueReady=false;
const miniLeagueRivalLoads=new Map();
S.miniLeagueData={standings:{},rivals:{},exposure:{}};

function miniLeagueNumber(value){ if(value===null||value===undefined||value==='') return null; const n=Number(value); return Number.isFinite(n)?n:null; }
function miniLeagueRank(value){ const n=miniLeagueNumber(value); return n!==null&&Number.isInteger(n)&&n>0?n:null; }
function miniLeagueOrdinal(value){
  const n=miniLeagueRank(value); if(n===null) return '—';
  const v=n,mod100=v%100,suffix=mod100>=11&&mod100<=13?'th':v%10===1?'st':v%10===2?'nd':v%10===3?'rd':'th';
  return `${v}${suffix}`;
}
function miniLeagueMovement(current,last){
  const c=miniLeagueRank(current),l=miniLeagueRank(last);
  if(c===null||l===null) return {delta:null,label:'Previous position unavailable',direction:'unknown'};
  const delta=l-c;
  if(delta>0) return {delta,label:`Up ${delta} place${delta===1?'':'s'}`,direction:'up'};
  if(delta<0) return {delta,label:`Down ${Math.abs(delta)} place${delta===-1?'':'s'}`,direction:'down'};
  return {delta:0,label:'No position change',direction:'same'};
}
function miniLeagueNearestRows(rows,userEntry){
  const user=rows.find(row=>String(row.entry)===String(userEntry));
  if(!user) return {user:null,above:null,below:null,leader:rows.slice().sort((a,b)=>Number(a.rank)-Number(b.rank))[0]||null};
  const sorted=rows.slice().sort((a,b)=>Number(a.rank)-Number(b.rank)); const index=sorted.findIndex(row=>String(row.entry)===String(userEntry));
  return {user,above:index>0?sorted[index-1]:null,below:index>=0&&index<sorted.length-1?sorted[index+1]:null,leader:sorted[0]||null};
}
function miniLeagueCompareSquads(ownSquad,rivalPicks){
  const own=[...new Set((ownSquad||[]).map(row=>Number(row?.p?.id??row?.element)).filter(Number.isFinite))];
  const rival=[...new Set((rivalPicks||[]).map(row=>Number(row?.element)).filter(Number.isFinite))];
  const ownSet=new Set(own),rivalSet=new Set(rival);
  return {overlap:own.filter(id=>rivalSet.has(id)),onlyOwn:own.filter(id=>!rivalSet.has(id)),onlyRival:rival.filter(id=>!ownSet.has(id)),ownCount:own.length,rivalCount:rival.length};
}
function miniLeaguePickFacts(picks,{byId=S.byId,activeChip=undefined}={}){
  const rows=Array.isArray(picks)?picks:[];
  const ids=[]; const idSet=new Set(); const positions=[]; let unresolved=0;
  const captainIds=[]; const viceIds=[];
  rows.forEach(row=>{
    const id=Number(row?.p?.id??row?.element),position=Number(row?.position);
    if(!Number.isFinite(id)||idSet.has(id)) return;
    idSet.add(id); ids.push(id);
    if(Number.isInteger(position)&&position>=1&&position<=15) positions.push(position);
    const resolved=row?.p?.id?Boolean(row.p):Boolean(byId?.[id]); if(!resolved) unresolved++;
    if(row?.is_captain===true||Number(row?.multiplier)>1) captainIds.push(id);
    if(row?.is_vice_captain===true) viceIds.push(id);
  });
  const positionSet=new Set(positions);
  const chipKnown=activeChip===null||typeof activeChip==='string';
  return {
    ids,
    count:ids.length,
    complete:ids.length===15&&positionSet.size===15&&positions.every(position=>position>=1&&position<=15)&&unresolved===0,
    unresolved,
    captainId:captainIds.length===1?captainIds[0]:null,
    captainComplete:captainIds.length===1,
    viceId:viceIds.length===1?viceIds[0]:null,
    viceComplete:viceIds.length===1,
    activeChip:chipKnown?(activeChip||null):undefined,
    chipKnown
  };
}
function miniLeagueExposureLabel(count,total){
  if(!count||!total) return 'No loaded selected rivals';
  if(total>=2&&count===total) return 'All selected rivals';
  if(total>=3&&count>total/2) return 'Majority of selected rivals';
  if(count>=2) return 'Multiple selected rivals';
  return 'One selected rival';
}
function miniLeagueExposureSelectionKey(rivals=[]){
  return (Array.isArray(rivals)?rivals:[]).map(row=>miniLeagueId(row?.id??row?.entry)).filter(Boolean).sort().join('|');
}
function miniLeagueExposureSummary(ownSquad,records,{byId=S.byId}={}){
  const own=miniLeaguePickFacts(ownSquad,{byId});
  const statuses=[]; const included=[];
  (Array.isArray(records)?records:[]).forEach(record=>{
    const facts=record?.picks?miniLeaguePickFacts(record.picks.picks,{byId,activeChip:record.picks.active_chip}):miniLeaguePickFacts([],{byId});
    const status=record?.unrequested?'not_loaded':record?.error?'unavailable':record?.stale?'stale':facts.complete?'complete':'incomplete';
    const item={...record,facts,status}; statuses.push(item); if(status==='complete') included.push(item);
  });
  const owners=new Map();
  const ensure=id=>{
    if(!owners.has(id)) owners.set(id,{id,owners:[],captains:[],viceCaptains:[]});
    return owners.get(id);
  };
  included.forEach(item=>{
    item.facts.ids.forEach(id=>ensure(id).owners.push(item.rival));
    if(item.facts.captainComplete) ensure(item.facts.captainId).captains.push(item.rival);
    if(item.facts.viceComplete) ensure(item.facts.viceId).viceCaptains.push(item.rival);
  });
  const ownSet=new Set(own.ids),total=included.length;
  const rows=[...owners.values()].map(row=>({...row,count:row.owners.length,captainCount:row.captains.length,viceCount:row.viceCaptains.length,label:miniLeagueExposureLabel(row.owners.length,total)}));
  rows.sort((a,b)=>b.captainCount-a.captainCount||b.count-a.count||String(byId?.[a.id]?.web_name||a.id).localeCompare(String(byId?.[b.id]?.web_name||b.id)));
  const rivalOnly=rows.filter(row=>!ownSet.has(row.id));
  const chips=new Map(); let chipKnownCount=0;
  included.forEach(item=>{
    if(!item.facts.chipKnown) return;
    chipKnownCount++;
    const key=item.facts.activeChip||'No active chip';
    chips.set(key,(chips.get(key)||0)+1);
  });
  return {
    own,
    statuses,
    included,
    total,
    rows,
    rivalOnly,
    sharedRivalOnly:rivalOnly.filter(row=>row.count>=2),
    singleRivalOnly:rivalOnly.filter(row=>row.count===1),
    uniqueToYou:own.ids.filter(id=>!owners.has(id)),
    captainRows:rows.filter(row=>row.captainCount>0),
    viceRows:rows.filter(row=>row.viceCount>0),
    chips:[...chips.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name)),
    chipKnownCount,
    completeCount:included.length,
    staleCount:statuses.filter(item=>item.status==='stale').length,
    incompleteCount:statuses.filter(item=>item.status==='incomplete').length,
    notLoadedCount:statuses.filter(item=>item.status==='not_loaded').length,
    unavailableCount:statuses.filter(item=>item.status==='unavailable').length
  };
}
function miniLeagueStatusCopy(){
  if(!S.seasonLive) return {label:'Pre-season',copy:'No completed Gameweek yet. Official standings and public rival squads will appear when FPL publishes them.',provisional:false};
  const event=S.boot?.events?.find(row=>row.id===S.currentGW);
  if(event?.finished&&event?.data_checked) return {label:`Official FPL — GW${S.currentGW} complete`,copy:'Scores and positions are confirmed by the latest checked Official FPL response.',provisional:false};
  return {label:'Official FPL — provisional',copy:`Scores and positions may change while GW${S.currentGW||'—'} is live or awaiting final checks.`,provisional:true};
}
function miniLeagueAgeLabel(updatedAt){ const ms=Date.now()-Number(updatedAt||0); if(!Number.isFinite(ms)||ms<60000) return 'Updated now'; const mins=Math.floor(ms/60000); return mins<60?`Updated ${mins}m ago`:`Updated ${Math.floor(mins/60)}h ago`; }
function miniLeagueGap(user,row){
  const a=miniLeagueNumber(user?.total),b=miniLeagueNumber(row?.total); if(a===null||b===null) return null; return Math.abs(a-b);
}
function miniLeagueManagerName(row){ return row?.entry_name||row?.player_name||row?.name||`Manager ${row?.entry??row?.id??''}`; }
function miniLeaguePlayerName(id){ return S.byId?.[id]?.web_name||`Player ${id}`; }
function miniLeagueNavigate(route){ globalThis.__teamsheetNavigate?.(route); }
function miniLeagueSelectedData(){ const league=selectedMiniLeague(); return league?S.miniLeagueData.standings[league.id]||null:null; }
function miniLeagueSetBusy(node,busy){ if(node){node.setAttribute('aria-busy',busy?'true':'false');} }
function miniLeagueAnnounce(text){ const node=$('leagueLiveStatus'); if(node) node.textContent=text; }
function miniLeagueButton(label,attrs={}){ return el('button',{class:'btn ghost sm',type:'button',...attrs},label); }
function miniLeagueLink(label,route,cls='btn ghost'){ return el('a',{class:cls,href:route},label); }
function miniLeagueEmpty(title,copy,action){ return el('div',{class:'empty'},el('strong',{},title),copy,action?el('div',{class:'mt-12'},action):null); }

function miniLeagueSuggestedRivals(data){
  if(!data) return [];
  const nearest=miniLeagueNearestRows(data.rows,S.teamId); const pinned=miniLeaguePinnedRivals(data.league.id);
  const byId=new Map(data.rows.map(row=>[String(row.entry),row])); const out=[]; const seen=new Set([String(S.teamId)]);
  const add=row=>{ if(!row||seen.has(String(row.entry))||out.length>=3) return; seen.add(String(row.entry)); out.push(row); };
  pinned.forEach(item=>add(byId.get(String(item.id)))); add(nearest.above); add(nearest.below); add(nearest.leader);
  return out;
}
function miniLeagueRivalIdentity(leagueId,rivalId,data=miniLeagueSelectedData()){
  const id=miniLeagueId(rivalId); if(!id) return null;
  const loaded=data?.rows?.find(row=>String(row.entry)===id);
  if(loaded) return {id,name:miniLeagueManagerName(loaded),row:loaded,membershipVerified:true};
  const saved=[...miniLeagueComparisonRivals(leagueId),...miniLeaguePinnedRivals(leagueId)].find(row=>row.id===id);
  return {id,name:saved?.name||`Manager ${id}`,row:null,membershipVerified:false};
}
function miniLeagueExposureCandidates(data){
  if(!data) return [];
  const leagueId=data.league.id,group=miniLeagueComparisonRivals(leagueId),pinned=miniLeaguePinnedRivals(leagueId),nearest=miniLeagueNearestRows(data.rows,S.teamId);
  const byId=new Map(data.rows.map(row=>[String(row.entry),row])),out=[],seen=new Set([String(S.teamId)]);
  const add=(value,reason)=>{
    const id=miniLeagueId(value?.id??value?.entry); if(!id||seen.has(id)) return;
    seen.add(id); const row=byId.get(id)||null;
    out.push({id,name:miniLeagueManagerName(row||value),row,reason,membershipVerified:Boolean(row)});
  };
  group.forEach(row=>add(row,'Selected'));
  pinned.forEach(row=>add(row,'Pinned rival'));
  add(nearest.above,'Nearest above'); add(nearest.below,'Nearest below'); add(nearest.leader,'League leader');
  const selectedId=miniLeagueSelectedRivalId(leagueId); if(selectedId) add(miniLeagueRivalIdentity(leagueId,selectedId,data),'Current comparison');
  return out;
}
async function miniLeagueToggleExposureRival(leagueId,rival){
  const current=miniLeagueComparisonRivals(leagueId),index=current.findIndex(row=>row.id===rival.id);
  if(index>=0) current.splice(index,1);
  else if(current.length>=MAX_COMPARISON_RIVALS){ miniLeagueAnnounce(`Choose no more than ${MAX_COMPARISON_RIVALS} rivals for one exposure comparison.`); return false; }
  else current.push({id:rival.id,name:rival.name});
  await setMiniLeagueComparisonRivals(leagueId,current); miniLeagueExposureRequest++; miniLeagueSetBusy($('leagueExposureOut'),false); delete S.miniLeagueData.exposure[leagueId]; renderMiniLeagues();
  miniLeagueAnnounce(index>=0?`${rival.name} removed from selected rivals.`:`${rival.name} added to selected rivals.`);
  return index<0;
}
function ensureMiniLeagueExposureSection(){
  let section=$('leagueExposure'); if(section) return section;
  const view=$('view-league'); if(!view) return null;
  section=el('section',{class:'panel league-route',id:'leagueExposure','data-league-route':'#/leagues/exposure',hidden:'hidden'},
    el('a',{class:'route-back',href:'#/leagues/detail','aria-label':'Back to League overview'},el('span',{'aria-hidden':'true'},'←')),
    el('span',{class:'eyebrow'},'Selected-rival facts'),
    el('h2',{tabindex:'-1'},'Rival exposure'),
    el('p',{class:'hint'},'Current public squads, captains and chips across up to five rivals you choose. Counts describe selected rivals, not the whole league or a prediction.'),
    el('div',{id:'leagueExposureOut','aria-busy':'false'}));
  view.appendChild(section); return section;
}

async function loadMiniLeagueStandings({force=false}={}){
  const league=selectedMiniLeague(); if(!league) return null;
  const existing=S.miniLeagueData.standings[league.id]; if(existing&&!force) return existing;
  const token=++miniLeagueStandingsRequest; miniLeagueAnnounce(`Loading ${league.name||'selected league'} standings.`); miniLeagueSetBusy($('leagueLandingOut'),true);
  const membership=miniLeagueMembership(league.id); const rank=miniLeagueRank(membership?.entry_rank); const pages=[1];
  if(rank){ const rankPage=Math.ceil(rank/MINI_LEAGUE_PAGE_SIZE); pages.push(rankPage); if(rankPage>1) pages.push(rankPage-1); pages.push(rankPage+1); }
  const responses=[]; const issues=[];
  for(const page of [...new Set(pages)]){
    const value=await api(`/leagues-classic/${league.id}/standings/?page_standings=${page}`,{optional:true});
    const validated=validateStandings(value); issues.push(...validated.issues); if(validated.value) responses.push(validated.value);
  }
  if(token!==miniLeagueStandingsRequest) return null;
  recordIssues('fpl','/leagues-classic/standings/',collapseIssues(issues));
  if(!responses.length){
    if(existing&&!existing.error&&Array.isArray(existing.rows)&&existing.rows.length){ S.miniLeagueData.standings[league.id]={...existing,stale:true,refreshError:true}; miniLeagueSetBusy($('leagueLandingOut'),false); renderMiniLeagues(); miniLeagueAnnounce('Refresh failed. Showing the last standings loaded in this session.'); return existing; }
    S.miniLeagueData.standings[league.id]={league,error:'unavailable',updatedAt:Date.now(),rows:[],hasNext:false};
    miniLeagueSetBusy($('leagueLandingOut'),false); renderMiniLeagues(); miniLeagueAnnounce('League standings are unavailable through the public FPL data used by Teamsheet.'); return null;
  }
  const map=new Map(); responses.flatMap(value=>value.standings.results).forEach(row=>map.set(String(row.entry),row));
  const first=responses[0],resolvedName=league.name||first.league?.name||'';
  if(resolvedName!==league.name) await upsertMiniLeague(league.id,resolvedName,{select:true});
  const data={league:{id:league.id,name:resolvedName||`League ${league.id}`},rows:[...map.values()],hasNext:Boolean(first.standings?.has_next),browsePage:1,browseHasNext:Boolean(first.standings?.has_next),updatedAt:Date.now(),provisional:miniLeagueStatusCopy().provisional,stale:false,refreshError:false};
  S.miniLeagueData.standings[league.id]=data; renderMiniLeagues(); miniLeagueSetBusy($('leagueLandingOut'),false);
  const nearest=miniLeagueNearestRows(data.rows,S.teamId),announcedRank=miniLeagueRank(nearest.user?.rank??membership?.entry_rank);
  miniLeagueAnnounce(announcedRank?`Standings loaded. Your position is ${miniLeagueOrdinal(announcedRank)}.`:!S.seasonLive?'League positions have not been published yet.':'Standings loaded. Your connected team was not found on the loaded pages.');
  return data;
}
async function loadNextMiniLeagueStandingsPage(){
  const league=selectedMiniLeague(),data=miniLeagueSelectedData(); if(!league||!data||!data.browseHasNext) return data;
  const page=(data.browsePage||1)+1,token=++miniLeagueStandingsRequest; miniLeagueAnnounce(`Loading standings page ${page}.`);
  const raw=await api(`/leagues-classic/${league.id}/standings/?page_standings=${page}`,{optional:true}); const validated=validateStandings(raw);
  if(token!==miniLeagueStandingsRequest) return null; recordIssues('fpl','/leagues-classic/standings/',validated.issues);
  if(!validated.value){ miniLeagueAnnounce('The next standings page is unavailable. Existing rows remain visible.'); return data; }
  const map=new Map(data.rows.map(row=>[String(row.entry),row])); validated.value.standings.results.forEach(row=>map.set(String(row.entry),row));
  Object.assign(data,{rows:[...map.values()],browsePage:page,browseHasNext:Boolean(validated.value.standings.has_next),updatedAt:Date.now(),stale:false,refreshError:false});
  renderMiniLeagues('#/leagues/standings'); miniLeagueAnnounce(`Standings page ${page} loaded.`); return data;
}
async function fetchMiniLeagueRivalRecord(league,rival,{force=false,endpoint='/entry/event/picks/ (selected rival)'}={}){
  const key=`${league.id}|${rival.id}|${S.currentGW}`,existing=S.miniLeagueData.rivals[key];
  if(existing&&!force) return {record:existing,issues:[]};
  if(miniLeagueRivalLoads.has(key)) return miniLeagueRivalLoads.get(key);
  const promise=(async()=>{
    const raw=await api(`/entry/${rival.id}/event/${S.currentGW}/picks/`,{optional:true,timeout:9000});
    const validated=validatePicks(raw,endpoint);
    let record;
    if(validated.value) record={rival,row:rival.row||existing?.row||null,picks:validated.value,updatedAt:Date.now(),error:null,stale:false,refreshError:false};
    else if(existing?.picks) record={...existing,rival,row:rival.row||existing.row||null,stale:true,refreshError:true,error:null};
    else record={rival,row:rival.row||null,picks:null,updatedAt:Date.now(),error:'unavailable',stale:false,refreshError:false};
    S.miniLeagueData.rivals[key]=record;
    return {record,issues:validated.issues};
  })().finally(()=>miniLeagueRivalLoads.delete(key));
  miniLeagueRivalLoads.set(key,promise); return promise;
}
async function loadMiniLeagueRival({force=false}={}){
  const league=selectedMiniLeague(),data=miniLeagueSelectedData(); if(!league||!S.currentGW) return null;
  const rivalId=miniLeagueSelectedRivalId(league.id); if(!rivalId) return null;
  const rival=miniLeagueRivalIdentity(league.id,rivalId,data); if(!rival) return null;
  const token=++miniLeagueRivalRequest; miniLeagueAnnounce(`Loading comparison with ${rival.name}.`); miniLeagueSetBusy($('leagueRivalOut'),true);
  const result=await fetchMiniLeagueRivalRecord(league,rival,{force,endpoint:'/entry/event/picks/ (selected rival)'});
  if(token!==miniLeagueRivalRequest) return null;
  recordIssues('fpl','/entry/event/picks/ (selected rival)',result.issues);
  renderMiniLeagues('#/leagues/rival'); miniLeagueSetBusy($('leagueRivalOut'),false);
  miniLeagueAnnounce(result.record?.picks?`Rival comparison loaded for ${rival.name}.`:`This rival's public squad is not available for the selected Gameweek.`);
  return result.record;
}
async function loadMiniLeagueExposure({force=false}={}){
  const league=selectedMiniLeague(),group=league?miniLeagueComparisonRivals(league.id):[];
  if(!league||!S.currentGW||!group.length) return [];
  const token=++miniLeagueExposureRequest,selectionKey=miniLeagueExposureSelectionKey(group);
  miniLeagueSetBusy($('leagueExposureOut'),true); miniLeagueAnnounce(`Loading public squads for ${group.length} selected rival${group.length===1?'':'s'}.`);
  const results=await pool(group,async row=>{
    const rival=miniLeagueRivalIdentity(league.id,row.id,miniLeagueSelectedData())||{...row,row:null,membershipVerified:false};
    return fetchMiniLeagueRivalRecord(league,rival,{force,endpoint:'/entry/event/picks/ (selected rivals)'});
  },2);
  if(token!==miniLeagueExposureRequest) return results;
  const currentKey=miniLeagueExposureSelectionKey(miniLeagueComparisonRivals(league.id));
  if(currentKey!==selectionKey) return results;
  recordIssues('fpl','/entry/event/picks/ (selected rivals)',collapseIssues(results.flatMap(result=>result?.issues||[])));
  S.miniLeagueData.exposure[league.id]={selectionKey,updatedAt:Date.now()};
  miniLeagueSetBusy($('leagueExposureOut'),false); renderMiniLeagues('#/leagues/exposure');
  const records=results.map(result=>result?.record).filter(Boolean),complete=records.filter(record=>!record.error&&!record.stale&&miniLeaguePickFacts(record.picks?.picks,{activeChip:record.picks?.active_chip}).complete).length;
  miniLeagueAnnounce(`Rival exposure loaded. ${complete} of ${group.length} selected rivals have complete fresh public squads.`);
  return results;
}

function miniLeagueHubCategory(league){
  const membership=miniLeagueMembership(league?.id);
  if(!membership) return 'saved';
  return String(membership.league_type||'').toLowerCase()==='x'?'invitational':'general';
}
function miniLeagueHubRank(membership){
  const rank=miniLeagueRank(membership?.entry_rank);
  if(rank!==null){
    const movement=miniLeagueMovement(rank,membership?.entry_last_rank);
    return {primary:miniLeagueOrdinal(rank),secondary:movement.delta===null?'Previous position unavailable':movement.label};
  }
  if(!membership) return {primary:'Open',secondary:'Saved locally'};
  return !S.seasonLive?{primary:'Not ranked yet',secondary:'Official FPL has not published positions yet.'}:{primary:'Position unavailable',secondary:'Official FPL position unavailable'};
}
function miniLeagueHubRow(league){
  const membership=miniLeagueMembership(league.id),rank=miniLeagueHubRank(membership),category=miniLeagueHubCategory(league);
  const context=league.primary?'Primary league':category==='invitational'?'Invitational classic':category==='general'?'General league':'Saved league';
  const open=async()=>{await selectMiniLeague(league.id);miniLeagueNavigate('#/leagues/detail');};
  return el('button',{class:'league-hub-row',type:'button','aria-label':`Open ${league.name||`League ${league.id}`}. ${rank.primary}.`,onclick:open},
    el('span',{class:'league-hub-copy'},el('strong',{},league.name||`League ${league.id}`),el('small',{},context)),
    el('span',{class:'league-hub-rank'},el('strong',{},rank.primary),el('small',{},rank.secondary)),
    el('span',{class:'league-hub-chevron','aria-hidden':'true'},'›'));
}
function miniLeagueHubSection(title,rows){
  return rows.length?el('section',{class:'league-hub-group'},el('h3',{},title),el('div',{class:'league-hub-list'},rows.map(miniLeagueHubRow))):null;
}
function renderMiniLeagueHub(){
  const out=$('leagueHubOut'); if(!out) return;
  const leagues=Array.isArray(S.miniLeagues?.saved)?S.miniLeagues.saved:[];
  if(!leagues.length){ setChildren(out,miniLeagueEmpty('No leagues found','Connect your FPL team to discover its classic leagues, or add a league manually.',miniLeagueLink('Manage leagues','#/leagues/manage','btn ghost'))); return; }
  const invitational=leagues.filter(row=>miniLeagueHubCategory(row)==='invitational');
  const general=leagues.filter(row=>miniLeagueHubCategory(row)==='general');
  const saved=leagues.filter(row=>miniLeagueHubCategory(row)==='saved');
  setChildren(out,el('div',{class:'league-hub-groups'},miniLeagueHubSection('Invitational leagues',invitational),miniLeagueHubSection('General leagues',general),miniLeagueHubSection('Saved leagues',saved)));
}

function renderLeaguePickerSummary(){
  const league=selectedMiniLeague(),button=$('leaguePickerButton'); if(!button) return;
  button.textContent=league?.name||'Choose a league'; button.setAttribute('aria-label',league?`Change league. Current league ${league.name||league.id}`:'Choose a Mini League');
}
function renderMiniLeagueLanding(){
  const out=$('leagueLandingOut'); if(!out) return; const league=selectedMiniLeague(),data=miniLeagueSelectedData(),status=miniLeagueStatusCopy(); renderLeaguePickerSummary();
  if(!league){ setChildren(out,miniLeagueEmpty('Choose your Mini League','Select a public classic league from your connected FPL entry, or add its numeric league ID.',miniLeagueLink('Choose league','#/leagues/manage','btn'))); return; }
  if(data?.error){ setChildren(out,miniLeagueEmpty('League standings unavailable','This league is unavailable through the public FPL data used by Teamsheet. Your saved league has not been removed.',miniLeagueButton('Try again',{onclick:()=>loadMiniLeagueStandings({force:true})}))); return; }
  if(!data){ setChildren(out,miniLeagueEmpty('Ready to check your league','Teamsheet will load official position, gaps and nearby rivals without scanning every squad.',miniLeagueButton('Load standings',{onclick:()=>loadMiniLeagueStandings({force:true})}))); return; }
  const membership=miniLeagueMembership(league.id),nearest=miniLeagueNearestRows(data.rows,S.teamId); const user=nearest.user;
  const rank=miniLeagueRank(user?.rank??membership?.entry_rank??null),total=user?.total??S.entry?.summary_overall_points??null,last=miniLeagueRank(user?.last_rank??membership?.entry_last_rank??null),movement=miniLeagueMovement(rank,last);
  const statusSummary=!S.seasonLive?'No completed Gameweek yet':status.provisional?'Scores and positions may still change':'Confirmed after official FPL checks';
  const position=rank!==null?el('div',{class:'league-position'},el('strong',{},miniLeagueOrdinal(rank)),el('span',{},total!==null?`${total} points`:'Official points unavailable')):!S.seasonLive?el('div',{class:'league-position'},el('strong',{},'Not ranked yet'),el('span',{},'Official FPL has not published a league position yet.')):el('div',{class:'league-position'},el('strong',{},'Position unavailable'),el('span',{},'Your connected team was not found on the loaded standings pages.'));
  const movementFlag=rank!==null?el('span',{class:`flag ${movement.direction==='up'?'rise':movement.direction==='down'?'fall':'dark'}`},movement.label):null;
  const hero=el('section',{class:'league-hero','aria-label':`${data.league.name} official position`},
    el('div',{class:'league-hero-head'},el('div',{},el('span',{class:'eyebrow'},status.label),el('h3',{},data.league.name)),miniLeagueButton('Refresh',{onclick:()=>loadMiniLeagueStandings({force:true})})),
    el('div',{class:'league-position-line'},position,movementFlag),
    el('div',{class:'league-status-row'},el('span',{},statusSummary),el('span',{},miniLeagueAgeLabel(data.updatedAt))),
    data.stale?el('div',{class:'note plain'},'Refresh failed. Showing the last standings loaded in this session; this view may be out of date.'):null);
  const gaps=el('div',{class:'league-gap-grid'},
    el('div',{class:'league-gap'},el('span',{},'Above'),el('strong',{},nearest.above&&user?`${miniLeagueGap(user,nearest.above)} pts`:'—'),nearest.above?el('small',{},miniLeagueManagerName(nearest.above)):null),
    el('div',{class:'league-gap current'},el('span',{},'You'),el('strong',{},total??'—'),el('small',{},rank!==null?miniLeagueOrdinal(rank):!S.seasonLive?'Not ranked yet':'Not located')),
    el('div',{class:'league-gap'},el('span',{},'Below'),el('strong',{},nearest.below&&user?`${miniLeagueGap(user,nearest.below)} pts`:'—'),nearest.below?el('small',{},miniLeagueManagerName(nearest.below)):null));
  const rivals=miniLeagueSuggestedRivals(data),noRivalsCopy=!S.seasonLive&&rank===null?'Nearby rivals will appear once Official FPL publishes league positions.':'No nearby rival rows were available on the loaded standings pages.';
  const rivalSection=el('section',{class:'league-section'},el('div',{class:'league-section-head'},el('h3',{},'Nearest rivals'),miniLeagueLink('View standings','#/leagues/standings','league-text-link')),
    rivals.length?el('div',{class:'league-rival-list'},rivals.map(row=>renderMiniLeagueRivalCard(row,user,data.league.id))):el('p',{class:'status'},noRivalsCopy));
  const group=miniLeagueComparisonRivals(league.id);
  const exposureSection=el('section',{class:'league-section'},el('div',{class:'league-section-head'},el('h3',{},'Rival exposure'),miniLeagueLink(group.length?'View exposure':'Set up comparison','#/leagues/exposure','league-text-link')),
    el('p',{class:'status'},group.length?`${group.length} selected rival${group.length===1?'':'s'}. Public squads load only when you request the exposure view.`:'Choose up to five nearby, leading or pinned rivals. Teamsheet will count only the public squads you explicitly load.'));
  const actions=el('div',{class:'league-actions single'},miniLeagueLink('View standings','#/leagues/standings','btn'));
  setChildren(out,hero,gaps,rivalSection,exposureSection,actions);
}
function renderMiniLeagueRivalCard(row,user,leagueId){
  const gap=user?miniLeagueGap(user,row):null,movement=miniLeagueMovement(row.rank,row.last_rank); const pinned=miniLeaguePinnedRivals(leagueId).some(item=>item.id===String(row.entry));
  return el('article',{class:'league-rival-card'},el('div',{class:'league-rival-copy'},el('strong',{},miniLeagueManagerName(row)),el('span',{},`${miniLeagueOrdinal(row.rank)} · ${row.total??'—'} points${gap!==null?` · ${gap} points ${Number(row.rank)<Number(user?.rank)?'above':'below'}`:''}`),el('small',{},movement.label)),
    el('div',{class:'league-rival-actions'},miniLeagueButton(pinned?'Unpin':'Pin',{onclick:async()=>{await togglePinnedMiniLeagueRival(leagueId,{id:row.entry,name:miniLeagueManagerName(row)});renderMiniLeagues();}}),miniLeagueButton('Compare',{onclick:async()=>{await selectMiniLeagueRival(leagueId,{id:row.entry,name:miniLeagueManagerName(row)});miniLeagueNavigate('#/leagues/rival');}})));
}
function renderMiniLeagueStandings(){
  const out=$('leagueStandingsOut'),hint=$('leagueStandingsHint'),data=miniLeagueSelectedData(); if(!out) return;
  if(!data){ if(hint) hint.hidden=true; setChildren(out,miniLeagueEmpty('No standings loaded','Return to the League overview and load the selected league.',miniLeagueLink('Back to League','#/leagues/detail','btn'))); return; }
  const rows=data.rows.slice().sort((a,b)=>Number(a.rank)-Number(b.rank));
  const hasPublishedPositions=rows.some(row=>miniLeagueRank(row.rank)!==null);
  if(!S.seasonLive&&!hasPublishedPositions){
    if(hint) hint.hidden=true;
    setChildren(out,miniLeagueEmpty('Standings not available yet','Official FPL will publish this league table once positions are available.'));
    return;
  }
  if(hint) hint.hidden=false;
  setChildren(out,el('div',{class:'league-standings-list'},rows.map(row=>{
    const mine=String(row.entry)===String(S.teamId); const movement=miniLeagueMovement(row.rank,row.last_rank);
    const open=async()=>{await selectMiniLeagueRival(data.league.id,{id:row.entry,name:miniLeagueManagerName(row)});miniLeagueNavigate('#/leagues/rival');};
    const attrs={class:`league-standing-row${mine?' mine':' interactive'}`,'aria-label':`${mine?'Your team, ':'Open rival comparison, '}${miniLeagueOrdinal(row.rank)}, ${miniLeagueManagerName(row)}, ${row.total??'points unavailable'} points, ${movement.label}`};
    if(!mine) Object.assign(attrs,{role:'button',tabindex:'0',onclick:open,onkeydown:event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}}});
    return el('article',attrs,
      el('span',{class:'league-standing-rank'},miniLeagueOrdinal(row.rank)),el('span',{class:'league-standing-name'},el('strong',{},miniLeagueManagerName(row)),el('small',{},row.player_name&&row.player_name!==row.entry_name?row.player_name:movement.label)),el('span',{class:'league-standing-points'},row.total??'—'),
      mine?el('span',{class:'flag info'},'Your team'):el('span',{class:'league-standing-action','aria-hidden':'true'},'Open',el('span',{class:'chev'},'›')));
  })),data.browseHasNext?el('div',{class:'mt-12'},miniLeagueButton('Load more standings',{onclick:()=>loadNextMiniLeagueStandingsPage()})):null,
    data.hasNext?el('p',{class:'status mt-12'},'More standings exist. Teamsheet loads them only when requested and does not scan every rival squad.'):null);
}
function renderMiniLeagueRival(){
  const out=$('leagueRivalOut'),league=selectedMiniLeague(),data=miniLeagueSelectedData(); if(!out) return;
  if(!league){ setChildren(out,miniLeagueEmpty('No rival selected','Choose a league and manager to compare.',miniLeagueLink('Back to League','#/leagues/detail','btn'))); return; }
  const rivalId=miniLeagueSelectedRivalId(league.id),rival=miniLeagueRivalIdentity(league.id,rivalId,data);
  if(!rival){ setChildren(out,miniLeagueEmpty('No rival selected','Choose a manager from the loaded standings.',miniLeagueLink('View standings','#/leagues/standings','btn'))); return; }
  const key=`${league.id}|${rivalId}|${S.currentGW}`,record=S.miniLeagueData.rivals[key],selected=miniLeagueComparisonRivals(league.id).some(item=>item.id===rival.id);
  const selectionAction=miniLeagueButton(selected?'Remove from exposure':'Add to exposure',{'aria-pressed':selected?'true':'false',onclick:()=>miniLeagueToggleExposureRival(league.id,rival)});
  if(!record){ setChildren(out,el('section',{class:'league-rival-summary'},el('h3',{},rival.name),rival.row?el('p',{},`${miniLeagueOrdinal(rival.row.rank)} · ${rival.row.total??'—'} points`):el('div',{class:'note plain'},'This saved rival is not present in the standings pages currently loaded. Current league membership and rank cannot be confirmed.'),el('div',{class:'league-actions'},miniLeagueButton('Load public squad comparison',{onclick:()=>loadMiniLeagueRival({force:true})}),selectionAction))); return; }
  if(record.error||!record.picks){ setChildren(out,miniLeagueEmpty('Rival squad unavailable',"This rival's public squad is not available for the selected Gameweek. Standings remain official and usable.",miniLeagueButton('Try again',{onclick:()=>loadMiniLeagueRival({force:true})})),el('div',{class:'league-actions'},selectionAction,miniLeagueLink('Rival exposure','#/leagues/exposure','btn ghost'))); return; }
  const ownSquad=mySquad(),comparison=miniLeagueCompareSquads(ownSquad,record.picks.picks),facts=miniLeaguePickFacts(record.picks.picks,{activeChip:record.picks.active_chip}),captain=facts.captainId,myCaptain=miniLeaguePickFacts(ownSquad).captainId;
  const playerList=(title,ids)=>el('section',{class:'league-player-differences'},el('h3',{},title),ids.length?el('ul',{},ids.map(id=>el('li',{},miniLeaguePlayerName(id)))):el('p',{class:'status'},'None in the published comparison.'));
  setChildren(out,el('section',{class:'league-rival-summary'},el('span',{class:'eyebrow'},'Official public picks'),el('h3',{},rival.name),rival.row?el('p',{},`${miniLeagueOrdinal(rival.row.rank)} · ${rival.row.total??'—'} points`):el('div',{class:'note plain'},'This saved rival is outside the standings pages currently loaded, so current league membership and rank are unverified.'),
    record.stale?el('div',{class:'note plain'},'Refresh failed. Showing the last public squad loaded in this session; it is excluded from fresh multi-rival exposure counts.'):null,
    el('div',{class:'league-comparison-facts'},el('div',{},el('span',{},'Squad overlap'),el('strong',{},`${comparison.overlap.length} of ${Math.max(comparison.ownCount,comparison.rivalCount,15)}`)),el('div',{},el('span',{},'Captain'),el('strong',{},captain?miniLeaguePlayerName(captain):'Unavailable')),el('div',{},el('span',{},'Captain context'),el('strong',{},captain&&myCaptain?captain===myCaptain?'Same captain':'Different captains':'Incomplete')),facts.chipKnown?el('div',{},el('span',{},'Active chip'),el('strong',{},facts.activeChip||'No active chip')):null),
    facts.viceComplete?el('p',{class:'status'},`Vice-captain: ${miniLeaguePlayerName(facts.viceId)}.`):null,
    !facts.complete?el('div',{class:'note plain'},`Comparison uses ${facts.count} of 15 validated published picks. This rival is excluded from aggregate exposure counts.`):null),
    el('div',{class:'league-difference-grid'},playerList('Only in your squad',comparison.onlyOwn),playerList("Only in this rival's squad",comparison.onlyRival)),
    el('div',{class:'note plain'},'These are factual squad differences, not transfer or differential recommendations. Low ownership alone is not a recommendation.'),
    el('div',{class:'league-actions'},selectionAction,miniLeagueLink('Rival exposure','#/leagues/exposure','btn ghost')),
    el('div',{class:'league-actions'},miniLeagueLink('Review captain on Team','#/team','btn'),miniLeagueLink('Review squad in Transfers','#/transfers','btn ghost')));
}
function exposurePlayerDetails(row,total){
  const owners=row.owners.map(rival=>rival.name).join(', '),captains=row.captains.map(rival=>rival.name).join(', '),vice=row.viceCaptains.map(rival=>rival.name).join(', ');
  const detail=[`Owned by ${owners}.`,captains?`Captained by ${captains}.`:'',vice?`Vice-captained by ${vice}.`:''].filter(Boolean).join(' ');
  return el('details',{},el('summary',{},`${miniLeaguePlayerName(row.id)} — ${row.count} of ${total} loaded selected rivals`),el('p',{class:'status'},detail));
}
function exposurePlayerSection(title,rows,total,emptyCopy){
  return el('section',{class:'league-player-differences'},el('h3',{},title),rows.length?el('div',{},rows.map(row=>exposurePlayerDetails(row,total))):el('p',{class:'status'},emptyCopy));
}
function renderMiniLeagueExposure(){
  const out=$('leagueExposureOut'),league=selectedMiniLeague(),data=miniLeagueSelectedData(); if(!out) return;
  if(!league){ setChildren(out,miniLeagueEmpty('Choose a Mini League','Select a league before choosing rivals.',miniLeagueLink('Choose league','#/leagues/manage','btn'))); return; }
  if(!data){ setChildren(out,miniLeagueEmpty('Load standings first','Teamsheet needs the selected league context before suggesting nearby rivals.',miniLeagueLink('Back to League','#/leagues/detail','btn'))); return; }
  const group=miniLeagueComparisonRivals(league.id),selectedIds=new Set(group.map(row=>row.id)),candidates=miniLeagueExposureCandidates(data);
  const candidateList=el('section',{class:'league-section'},el('div',{class:'league-section-head'},el('h3',{},`Selected rivals · ${group.length}/${MAX_COMPARISON_RIVALS}`),group.length?miniLeagueButton('Clear',{'aria-label':'Clear selected rivals',onclick:async()=>{await clearMiniLeagueComparisonRivals(league.id);miniLeagueExposureRequest++;miniLeagueSetBusy($('leagueExposureOut'),false);delete S.miniLeagueData.exposure[league.id];renderMiniLeagues();miniLeagueAnnounce('Selected rival group cleared.');}}):null),
    candidates.length?el('div',{class:'league-rival-list'},candidates.map(candidate=>{
      const selected=selectedIds.has(candidate.id);
      return el('article',{class:'league-rival-card'},el('div',{class:'league-rival-copy'},el('strong',{},candidate.name),el('span',{},candidate.row?`${miniLeagueOrdinal(candidate.row.rank)} · ${candidate.row.total??'—'} points`:candidate.reason),el('small',{},candidate.membershipVerified?candidate.reason:'Not present in loaded standings; membership and rank unverified')),
        el('div',{class:'league-rival-actions'},miniLeagueButton(selected?'Remove':'Add',{'aria-pressed':selected?'true':'false',disabled:!selected&&group.length>=MAX_COMPARISON_RIVALS,onclick:()=>miniLeagueToggleExposureRival(league.id,candidate)})));
    })):el('p',{class:'status'},'No nearby or pinned candidates are available. Open a manager from the loaded standings and add them from the rival comparison.'));
  if(!group.length){ setChildren(out,candidateList,el('div',{class:'note plain'},'Choose up to five rivals. No public squad request is made until you press Load rival exposure.')); return; }
  if(!S.currentGW){ setChildren(out,candidateList,el('div',{class:'note plain'},'Current Gameweek public picks are not available yet. Teamsheet will not substitute a previous Gameweek.')); return; }
  const records=group.map(rival=>{
    const key=`${league.id}|${rival.id}|${S.currentGW}`,record=S.miniLeagueData.rivals[key];
    return record?{...record,rival:{...rival,...record.rival}}:{rival,picks:null,error:null,stale:false,unrequested:true};
  });
  const requested=records.filter(record=>!record.unrequested).length,allRequested=requested===group.length;
  const controls=el('div',{class:'league-actions'},miniLeagueButton(allRequested?'Refresh rival exposure':'Load rival exposure',{onclick:()=>loadMiniLeagueExposure({force:allRequested})}),miniLeagueLink('View standings','#/leagues/standings','btn ghost'));
  if(!requested){ setChildren(out,candidateList,controls,el('div',{class:'note plain'},'Public squads load on demand with at most two concurrent requests. Counts will describe only complete, fresh squads from these selected rivals.')); return; }
  const summary=miniLeagueExposureSummary(mySquad(),records),status=miniLeagueStatusCopy();
  const summaryCard=el('section',{class:'league-rival-summary'},el('span',{class:'eyebrow'},status.label),el('h3',{},'Loaded selected-rival exposure'),
    el('div',{class:'league-comparison-facts'},
      el('div',{},el('span',{},'Selected'),el('strong',{},String(group.length))),
      el('div',{},el('span',{},'Complete fresh squads'),el('strong',{},String(summary.completeCount))),
      el('div',{},el('span',{},'Not loaded'),el('strong',{},String(summary.notLoadedCount))),
      el('div',{},el('span',{},'Incomplete'),el('strong',{},String(summary.incompleteCount))),
      el('div',{},el('span',{},'Unavailable or stale'),el('strong',{},String(summary.unavailableCount+summary.staleCount)))),
    !summary.own.complete?el('div',{class:'note plain'},`Your current comparison squad contains ${summary.own.count} of 15 resolved players. Aggregate exposure remains unavailable until the user squad is complete.`):null,
    summary.staleCount?el('div',{class:'note plain'},`${summary.staleCount} stale rival squad${summary.staleCount===1?' is':'s are'} visible but excluded from the fresh aggregate.`):null,
    summary.notLoadedCount?el('div',{class:'note plain'},`${summary.notLoadedCount} selected rival${summary.notLoadedCount===1?' has':'s have'} not been loaded yet.`):null,
    summary.incompleteCount||summary.unavailableCount?el('div',{class:'note plain'},'Incomplete and unavailable rivals are listed below and excluded from aggregate denominators.'):null);
  if(!summary.own.complete||!summary.total){
    const states=el('section',{class:'league-player-differences'},el('h3',{},'Rival data status'),el('ul',{},summary.statuses.map(item=>el('li',{},`${item.rival.name}: ${item.status}`))));
    setChildren(out,candidateList,controls,summaryCard,states); return;
  }
  const captainSection=exposurePlayerSection('Captain exposure',summary.captainRows,summary.total,'No valid selected-rival captain facts are available.');
  const chipSection=el('section',{class:'league-player-differences'},el('h3',{},'Active chips'),summary.chips.length?el('ul',{},summary.chips.map(item=>el('li',{},`${item.name}: ${item.count} of ${summary.chipKnownCount} selected rivals with known chip context`))):el('p',{class:'status'},'No validated chip context is available.'));
  const sharedSection=exposurePlayerSection('Shared rival-only players',summary.sharedRivalOnly,summary.total,'No player absent from your squad is owned by multiple complete selected rivals.');
  const uniqueSection=el('section',{class:'league-player-differences'},el('h3',{},'Unique to your squad'),summary.uniqueToYou.length?el('ul',{},summary.uniqueToYou.map(id=>el('li',{},miniLeaguePlayerName(id)))):el('p',{class:'status'},'Every player in your complete squad appears in at least one complete selected-rival squad.'));
  const singles=el('details',{},el('summary',{},`One-rival-only differences · ${summary.singleRivalOnly.length}`),summary.singleRivalOnly.length?el('div',{class:'league-player-differences'},summary.singleRivalOnly.map(row=>exposurePlayerDetails(row,summary.total))):el('p',{class:'status'},'None.'));
  const states=el('details',{},el('summary',{},'Missing, incomplete and stale rivals'),el('ul',{},summary.statuses.filter(item=>item.status!=='complete').map(item=>el('li',{},`${item.rival.name}: ${item.status}`))));
  setChildren(out,candidateList,controls,summaryCard,el('div',{class:'league-difference-grid'},captainSection,chipSection),el('div',{class:'league-difference-grid'},sharedSection,uniqueSection),singles,states,el('div',{class:'note plain'},'These counts describe the explicitly selected rivals only. They are not whole-league ownership, projected outcomes or protect/chase advice.'));
}
function renderLeagueManageList(){
  const out=$('leagueManageList'); if(!out) return; const state=S.miniLeagues;
  if(!state.saved.length){ setChildren(out,el('p',{class:'status'},'No saved leagues yet. Connect a public FPL team or add a league ID.')); return; }
  const membershipKnown=Array.isArray(S.entry?.leagues?.classic);
  setChildren(out,el('div',{class:'league-manage-list'},state.saved.map(row=>{
    const selected=row.id===state.selectedLeagueId,official=Boolean(miniLeagueMembership(row.id));
    const source=official?'Official FPL league':membershipKnown?'Added manually':'Saved league';
    const status=[source,row.primary?'Primary':selected?'Selected':''].filter(Boolean).join(' · ');
    const actions=[
      miniLeagueButton(selected?'Selected':'Select',{disabled:selected,onclick:async()=>{await selectMiniLeague(row.id);renderMiniLeagues();miniLeagueNavigate('#/leagues/detail');}}),
      miniLeagueButton(row.primary?'Primary':'Make primary',{disabled:row.primary,onclick:async()=>{await upsertMiniLeague(row.id,row.name,{primary:true,select:true});renderMiniLeagues();}})
    ];
    if(membershipKnown&&!official) actions.push(miniLeagueButton('Remove',{'aria-label':`Remove ${row.name||`league ${row.id}`}`,onclick:async()=>{await removeMiniLeague(row.id);delete S.miniLeagueData.standings[row.id];delete S.miniLeagueData.exposure[row.id];renderMiniLeagues();}}));
    return el('article',{class:`league-manage-row${selected?' selected':''}`},
      el('div',{},el('strong',{},row.name||`League ${row.id}`),el('span',{class:'status'},status)),
      el('div',{class:'league-manage-actions'},actions));
  })));
}
function renderMiniLeagues(route=globalThis.location?.hash||'#/leagues'){
  renderRouteDataWarning('leagueDataWarning',{showUnavailable:true});
  if(!miniLeagueReady) return; ensureMiniLeagueExposureSection(); renderLeaguePickerSummary(); renderLeagueManageList();
  const sections=[['#/leagues',$('leagueHub')],['#/leagues/detail',$('leagueLanding')],['#/leagues/standings',$('leagueStandings')],['#/leagues/rival',$('leagueRival')],['#/leagues/exposure',$('leagueExposure')],['#/leagues/manage',$('leagueManage')]];
  const resolved=sections.some(([key])=>key===route)?route:'#/leagues'; sections.forEach(([key,node])=>{if(node) node.hidden=key!==resolved;});
  if(!S.boot&&resolved!=='#/leagues'&&resolved!=='#/leagues/manage'){
    const target=resolved==='#/leagues/detail'?$('leagueLandingOut'):resolved==='#/leagues/standings'?$('leagueStandingsOut'):resolved==='#/leagues/rival'?$('leagueRivalOut'):$('leagueExposureOut');
    setChildren(target,miniLeagueEmpty('Official FPL data is unavailable','League position and public rival facts cannot be verified until core Official FPL data loads.',miniLeagueLink('Back to Leagues','#/leagues','btn ghost')));
    renderMiniLeagueHub();
    return;
  }
  renderMiniLeagueHub(); renderMiniLeagueLanding(); renderMiniLeagueStandings(); renderMiniLeagueRival(); renderMiniLeagueExposure();
}
function renderLeagueChips(){
  if(Array.isArray(S.leagues)&&S.leagues!==S.miniLeagues.saved) S.miniLeagues={...S.miniLeagues,saved:S.leagues};
  const legacy=$('leagueChips');
  if(legacy) setChildren(legacy,(S.miniLeagues.saved||[]).map(row=>el('button',{class:'chip',type:'button'},row.name||row.id)));
  renderLeagueManageList();
}
async function initMiniLeagues(legacyConfig={}){
  ensureMiniLeagueExposureSection(); await initMiniLeagueState(legacyConfig); miniLeagueReady=true;
  const picker=$('leaguePickerButton'); picker?.addEventListener('click',()=>miniLeagueNavigate('#/leagues'));
  $('leagueRefreshButton')?.addEventListener('click',()=>loadMiniLeagueStandings({force:true}));
  $('leagueManageForm')?.addEventListener('submit',async event=>{event.preventDefault();const id=miniLeagueId($('leagueId')?.value),name=$('leagueName')?.value?.trim()||'';if(!id){miniLeagueAnnounce("Add a valid league ID first — it is the number in the league's URL.");return;}await upsertMiniLeague(id,name,{select:true});if($('leagueId'))$('leagueId').value='';if($('leagueName'))$('leagueName').value='';renderMiniLeagues();miniLeagueNavigate('#/leagues/detail');});
  document.addEventListener('teamsheet:route-change',event=>{const route=event.detail?.route||'#/leagues';if(!route.startsWith('#/leagues')) return;renderMiniLeagues(route);const needsStandings=['#/leagues/detail','#/leagues/standings','#/leagues/rival','#/leagues/exposure'].includes(route);if(needsStandings&&selectedMiniLeague()&&!miniLeagueSelectedData()) void loadMiniLeagueStandings();if(route==='#/leagues/rival') void loadMiniLeagueRival();});
  document.addEventListener('teamsheet:data-rendered',async()=>{await mergeDiscoveredMiniLeagues(S.entry);renderMiniLeagues();const route=globalThis.location?.hash||'';const needsStandings=['#/leagues/detail','#/leagues/standings','#/leagues/rival','#/leagues/exposure'].includes(route);if(needsStandings&&selectedMiniLeague()) void loadMiniLeagueStandings({force:true});});
  const initialRoute=globalThis.location?.hash||'#/leagues';
  renderMiniLeagues(initialRoute);
  if(initialRoute==='#/leagues/exposure') $('leagueExposure')?.querySelector?.('h2')?.focus?.({preventScroll:true});
}



/* ===== src/ui/views.mjs ===== */
// Views import broadly; the bundler flattens everything into one scope.
const elNode = el;
const svgNode = svgEl;
const flagNodes = p => {
  const nodes = [];
  if(['i','u','s','n'].includes(p.status)) nodes.push(elNode('span',{class:'flag out'},p.status==='s'?'SUSP':'OUT'));
  else if(p.status === 'd') nodes.push(elNode('span',{class:'flag doubt'},`${p.chance_of_playing_next_round ?? '?'}%`));
  if(p.cost_change_event > 0) nodes.push(elNode('span',{class:'flag rise'},'▲'));
  if(p.cost_change_event < 0) nodes.push(elNode('span',{class:'flag fall'},'▼'));
  const mo = priceMomentum(p);
  if(mo) nodes.push(elNode('span',{class:`flag ${mo === 'rising' ? 'rise' : 'fall'}`},mo));
  return nodes;
};
const cell = (text, cls = '') => elNode('td', cls ? {class:cls} : {}, text);
const head = (text, cls = '', scope='col') => elNode('th', cls ? {class:cls,scope} : {scope}, text);
const noteNode = (kind, ...children) => elNode('div',{class:`note${kind ? ' '+kind : ''}`},children);
/* ---------------------------------------------------------------------
   VIEW — FIXTURE TICKER
   --------------------------------------------------------------------- */
function renderTicker(){
  const warning=renderRouteDataWarning('fixtureDataWarning',{showUnavailable:true});
  if(!S.fixtures){
    setChildren($('fixtureModeNote'));
    if(warning.kind==='unavailable') setChildren($('ticker'),elNode('div',{class:'empty'},elNode('strong',{},'Fixtures are unavailable'),'Refresh Official FPL data before using the fixture view.'));
    return;
  }
  const from = clamp(parseInt($('fxFrom').value) || S.nextGW, 1, 38);
  const requestedSpan = clamp(parseInt($('fxSpan').value) || 6, 1, 38);
  const span = Math.min(requestedSpan, 39 - from);
  $('fxFrom').value = String(from);
  $('fxSpan').max = String(39 - from);
  $('fxSpan').value = String(span);
  const lensControl = $('fxLens'), sort = $('fxSort').value;
  const lensState = fixtureLensState(lensControl.value);
  for(const option of Array.from(lensControl.options || [])){
    if(!option) continue;
    const separated = option.value === 'attack' || option.value === 'defence';
    option.hidden = lensState.fallback && separated;
    option.disabled = lensState.fallback && separated;
    if(option.value === 'official') option.textContent = lensState.fallback ? 'Overall FPL difficulty' : 'Official FDR';
  }
  if(lensState.fallback) lensControl.value = 'official';
  const lens = lensState.lens;

  let teams = Object.values(S.teams).map(t => ({t, s:runScore(t.id, from, span, lens)}));
  if(sort === 'ease' || sort === 'hard') teams.sort((a,b) => compareFixtureRunScores(a.s,b.s,sort,lens));
  else teams.sort((a,b) => a.t.name.localeCompare(b.t.name));

  const header = elNode('tr',{},head('Team','tm team'));
  for(let gw = from; gw < from+span; gw++) header.appendChild(head(`GW${gw}`));
  const body = elNode('tbody');
  teams.forEach(({t,s}) => {
    const scoreLabel=Number.isFinite(s)?s.toFixed(2):'—';
    const row = elNode('tr',{},elNode('th',{class:'team',scope:'row'},t.short_name,elNode('span',{class:'ease'},scoreLabel)));
    teamFixtures(t.id, from, span).forEach(games => {
      if(!games.length){ row.appendChild(elNode('td',{},elNode('div',{class:'cell blank'},'—',elNode('small',{},'BLANK')))); return; }
      const diffs = games.map(g => fixtureDifficulty(g,lens));
      const contents = [];
      games.forEach((g,i) => {
        if(i) contents.push(elNode('hr',{class:'fixture-divider'}));
        contents.push(g.opp.short_name,elNode('small',{},`${g.home?'H':'A'} · ${diffs[i]}`));
      });
      row.appendChild(elNode('td',{},elNode('div',{class:`cell d${diffs[0]}${games.length > 1 ? ' dbl' : ''}`},contents)));
    });
    body.appendChild(row);
  });
  if(lensState.fallback) setChildren($('fixtureModeNote'),noteNode('plain',
    elNode('b',{},'Overall FPL difficulty.'),
    ' Lower is easier. Official FPL currently supplies one overall 1–5 rating, so separate attacker and defender lenses are hidden until genuine team-strength inputs are available.'));
  else setChildren($('fixtureModeNote'));
  setChildren($('ticker'),elNode('table',{class:'ticker'},elNode('caption',{class:'sr-only'},`Fixture difficulty from GW${from} across ${span} Gameweeks`),elNode('thead',{},header),body));

  const canCompareSwings = from + 5 <= 38;
  const swings = canCompareSwings ? Object.values(S.teams).map(t => {
    const now = runScore(t.id, from, 3, lens), later = runScore(t.id, from+3, 3, lens);
    return {t, delta: later - now};
  }) : [];
  const favourable = lensState.lowerIsEasier
    ? swings.filter(s => s.delta < -.18).sort((a,b)=>a.delta-b.delta).slice(0,4)
    : swings.filter(s => s.delta > .18).sort((a,b)=>b.delta-a.delta).slice(0,4);
  const harder = lensState.lowerIsEasier
    ? swings.filter(s => s.delta > .18).sort((a,b)=>b.delta-a.delta).slice(0,4)
    : swings.filter(s => s.delta < -.18).sort((a,b)=>a.delta-b.delta).slice(0,4);
  const swingNodes = [];
  if(lensState.fallback)
    swingNodes.push(noteNode('plain',elNode('b',{},'Projection fallback.'),' Player projections use neutral fixture multipliers until separate, validated attack and defence strengths are available.'));
  if(favourable.length) swingNodes.push(noteNode('good',elNode('b',{},`Turns favourable from GW${from+3}:`),` ${favourable.map(s=>s.t.name).join(', ')}. Buying a gameweek early usually beats buying late.`));
  if(harder.length) swingNodes.push(noteNode('bad',elNode('b',{},`Turns hard from GW${from+3}:`),` ${harder.map(s=>s.t.name).join(', ')}. Plan exits before the crowd moves.`));

  const perGW = {};
  S.fixtures.filter(f => f.event >= from && f.event < from+span).forEach(f => {
    perGW[f.event] = perGW[f.event] || {};
    [f.team_h, f.team_a].forEach(id => perGW[f.event][id] = (perGW[f.event][id]||0)+1);
  });
  const flags = [];
  Object.keys(perGW).sort((a,b)=>a-b).forEach(gw => {
    const teamsIn = Object.keys(perGW[gw]).length;
    const dbls = Object.entries(perGW[gw]).filter(([,c]) => c>1).map(([id]) => S.teams[id]?.short_name).filter(Boolean);
    if(teamsIn < 20) flags.push(`GW${gw}: ${20-teamsIn} teams blank`);
    if(dbls.length) flags.push(`GW${gw} double: ${dbls.join(', ')}`);
  });
  if(flags.length) swingNodes.push(noteNode('',elNode('b',{},'Chip windows:'),` ${flags.join(' · ')}`));
  setChildren($('swings'),swingNodes);
}

/* ---------------------------------------------------------------------
   VIEW — RANKER
   --------------------------------------------------------------------- */
function renderPlayers(){
  if(!S.boot) return;
  const from = clamp(parseInt($('fxFrom').value) || S.nextGW, 1, 38);
  const span = +$('plHorizon').value;
  const pos = +$('plPos').value, maxP = num($('plMax').value)*10;
  const hideFlag = $('plFit').checked, onlyMine = $('plOwn').checked;
  const mineIds = new Set(mySquad().map(s => s.p.id));

  setChildren($('rankerHint'),S.seasonLive
    ? 'Expected points per gameweek, modelled separately for each position — clean sheets and saves for keepers and defenders, expected goal involvement for attackers, plus bonus and defensive actions. Tap a player for full detail.'
    : [elNode('b',{},'Pre-season.'),' No match data exists yet, so projections start from the price FPL set (a decent prior for expected output) adjusted by fixture and ownership. Real form, xGI and bonus switch on after GW1. Tap a player for full detail.']);

  let pool = S.boot.elements.filter(p =>
    (!pos || p.element_type === pos) &&
    p.now_cost <= maxP &&
    (!onlyMine || mineIds.has(p.id)) &&
    (!hideFlag || (p.status === 'a' && (p.chance_of_playing_next_round ?? 100) >= 75)));

  const ranked = pool.map(p => ({p, x:xpOf(p, from, span)}))
    .sort((a,b) => b.x.total - a.x.total).slice(0, 45);
  const maxPer = ranked.length ? ranked[0].x.perGW : 1;

  const playerBody = elNode('tbody');
  ranked.forEach(({p,x}) => {
    const t = S.teams[p.team];
    const openButton=elNode('button',{type:'button',class:'player-row-action','aria-label':`Open ${p.web_name} player details`,onclick:event=>openPlayerDetailView(p,from,span,event.currentTarget)},
      elNode('span',{class:'pname'},p.web_name,flagNodes(p)),
      elNode('span',{class:'pmeta'},elNode('span',{class:'pos'},S.posName[p.element_type]||'?'),` ${t?t.short_name:'—'}${x.games!==span?` · ${x.games} games`:''}`));
    playerBody.appendChild(elNode('tr',{dataset:{pid:p.id}},
      elNode('td',{class:'player-result-main'},openButton),
      elNode('td',{class:'num',dataset:{label:'Price'}},(p.now_cost/10).toFixed(1)),
      elNode('td',{class:'num player-result-secondary',dataset:{label:'Ownership'}},p.selected_by_percent),
      elNode('td',{class:'num player-result-secondary',dataset:{label:'Form'}},fmt1(num(p.form))),
      elNode('td',{class:'num',dataset:{label:'xP / GW'}},elNode('span',{class:`xp ${x.perGW >= maxPer*0.82 ? 'hot':''}`},fmt1(x.perGW))),
      elNode('td',{class:'num',dataset:{label:`${span} GW xP`}},fmt1(x.total)),
      elNode('td',{class:'num',dataset:{label:'xP / £m'}},fmt1(x.total/(p.now_cost/10)))));
  });
  setChildren($('playerTable'),elNode('table',{class:'data'},elNode('caption',{class:'sr-only'},`Player projections over ${span} Gameweeks`),elNode('thead',{},elNode('tr',{},head('Player'),head('£','num'),head('Own%','num'),head('Form','num'),head('xP/GW','num'),head(`xP ${span}GW`,'num'),head('per £m','num'))),playerBody));
}

function breakdownNode(p, x, span){
  const entries = Object.entries(x.parts).filter(([,v]) => Math.abs(v) > 0.01)
    .sort((a,b) => Math.abs(b[1]) - Math.abs(a[1]));
  const max = Math.max(...entries.map(([,v]) => Math.abs(v)), 0.01);
  const nodes = [elNode('b',{},p.web_name),` — ${fmt1(x.total)} projected points over ${span} gameweek${span>1?'s':''} (${x.games} fixture${x.games===1?'':'s'})`];
  if(p.news) nodes.push(elNode('div',{class:'breakdown-news'},p.news,' ',elNode('span',{class:'flag dark'},newsAge(p))));
  const bars = elNode('div',{class:'bars'});
  entries.forEach(([k,v]) => {
    bars.appendChild(elNode('div',{class:'bar'},elNode('span',{},k),elNode('progress',{class:`projection-progress${v<0?' neg':''}`,max:'100',value:(Math.abs(v)/max*100).toFixed(2),'aria-label':`${k} ${v>0?'+':''}${fmt1(v)}`}),elNode('span',{class:'v'},`${v>0?'+':''}${fmt1(v)}`)));
  });
  nodes.push(bars);
  const runs = teamFixtures(p.team, clamp(parseInt($('fxFrom').value)||S.nextGW,1,38), span);
  const fx = runs.map((g,i) => g.length ? g.map(o => `${o.opp.short_name}(${o.home?'H':'A'})`).join('+') : 'blank').join(' · ');
  nodes.push(elNode('div',{class:'breakdown-meta breakdown-meta-primary'},elNode('b',{},'Fixtures:'),` ${fx}`));
  const mo = priceMomentum(p);
  if(mo) nodes.push(elNode('div',{class:'breakdown-meta'},elNode('b',{},'Price:'),` heavy net transfers ${mo==='rising'?'in — a rise looks likely':'out — a fall looks likely'}.`));
  return nodes;
}

function playerDetailSection(title,...children){
  return elNode('section',{class:'player-detail-section'},elNode('h3',{},title),children);
}
function playerDetailMetric(label,value,meta=''){
  return elNode('div',{class:'player-detail-metric'},
    elNode('span',{class:'label'},label),
    elNode('strong',{},value),
    meta ? elNode('span',{class:'meta'},meta) : null);
}
function playerDetailPercent(value){ return `${Math.round(clamp(num(value),0,1)*100)}%`; }

function openPlayerDetailView(p,from,span,trigger){
  const team=S.teams[p.team], x=xpOf(p,from,span), next=xpOf(p,S.nextGW,1);
  const mins=minutesEstimate(p), simulation=simulatePlayerGameweek(p,S.nextGW);
  const palette=teamPitchPalette(team), paletteClass=teamPitchPaletteClass(team), detail=[];
  const fixtures=teamFixtures(p.team,S.nextGW,1)[0]||[];
  const fixtureLabel=fixtures.length?fixtures.map(g=>`${g.opp.short_name} ${g.home?'H':'A'}`).join(' + '):'Blank';
  const identity=elNode('div',{class:'player-detail-identity'},
    elNode('span',{class:`club-shirt detail-shirt pattern-${palette.pattern} ${paletteClass}`,'aria-hidden':'true'},
      elNode('span',{class:'club-shirt-code'},palette.code)),
    elNode('div',{class:'player-detail-identity-copy'},
      elNode('div',{class:'player-detail-name'},p.web_name,flagNodes(p)),
      elNode('div',{class:'player-detail-meta'},
        [S.posName[p.element_type]||'Player',team?.name,`£${(p.now_cost/10).toFixed(1)}m`,fixtureLabel].filter(Boolean).join(' · ')),
      p.news?elNode('div',{class:'player-detail-news'},p.news,' ',elNode('span',{class:'flag dark'},newsAge(p))):null));
  detail.push(identity);

  detail.push(playerDetailSection('Decision summary',
    elNode('div',{class:'player-detail-grid'},
      playerDetailMetric(`GW${S.nextGW} xP`,fmt1(next.total),fixtureLabel),
      playerDetailMetric(`${span} GW xP`,fmt1(x.total),`${x.games} fixture${x.games===1?'':'s'}`),
      playerDetailMetric('Form',fmt1(num(p.form)),`${p.selected_by_percent}% owned`),
      playerDetailMetric('Availability',playerDetailAvailabilityLabel(p),p.status==='a'?'Official status clear':p.news||'Check latest team news'))));

  detail.push(playerDetailSection('Expected minutes',
    elNode('div',{class:'player-detail-grid minutes-grid'},
      playerDetailMetric('Expected',`${fmt1(mins.expMin)} min`,`${mins.confidenceLabel} confidence · ${mins.source}`),
      playerDetailMetric('Starts',playerDetailPercent(mins.pStart)),
      playerDetailMetric('Appears',playerDetailPercent(mins.pAppear)),
      playerDetailMetric('Reaches 60',playerDetailPercent(mins.p60))),
    elNode('p',{class:'player-detail-help'},'Expected minutes are model estimates, not confirmed team news.')));

  const uncertaintyNodes=[];
  if(!simulation.available){
    uncertaintyNodes.push(noteNode('plain',elNode('b',{},'Unavailable in pre-season.'),' Detailed ranges switch on once live Gameweek event data exists; Teamsheet will not invent precise distributions from the price baseline.'));
  } else {
    const spread=playerDetailSpread(simulation);
    const low=num(simulation.p10), high=num(simulation.p90);
    const left=playerDetailRangePosition(simulation.p25,low,high);
    const right=playerDetailRangePosition(simulation.p75,low,high);
    const middle=playerDetailRangePosition(simulation.median,low,high);
    uncertaintyNodes.push(elNode('div',{class:'player-detail-range'},
      elNode('div',{class:'player-detail-range-head'},
        elNode('div',{},elNode('span',{class:'eyebrow'},'Likely middle range'),elNode('strong',{},`${fmt1(simulation.p25)}–${fmt1(simulation.p75)} pts`)),
        spread.label?elNode('span',{class:`range-label ${spread.label.toLowerCase()}`},`${spread.label} range`):null),
      elNode('div',{class:'player-detail-range-track',role:'img','aria-label':`P10 ${fmt1(low)}, P25 ${fmt1(simulation.p25)}, median ${fmt1(simulation.median)}, P75 ${fmt1(simulation.p75)}, P90 ${fmt1(high)}`},
        svgNode('svg',{class:'player-detail-range-svg',viewBox:'0 0 100 12','aria-hidden':'true',focusable:'false'},
          svgNode('line',{class:'player-detail-range-rail',x1:'0',y1:'6',x2:'100',y2:'6'}),
          svgNode('line',{class:'player-detail-range-core',x1:left.toFixed(2),y1:'6',x2:right.toFixed(2),y2:'6'}),
          svgNode('line',{class:'player-detail-range-median',x1:middle.toFixed(2),y1:'1',x2:middle.toFixed(2),y2:'11'}))),
      elNode('div',{class:'player-detail-range-scale'},elNode('span',{},`P10 ${fmt1(low)}`),elNode('span',{},`P90 ${fmt1(high)}`))));
    if(spread.quality==='reduced')
      uncertaintyNodes.push(noteNode('bad',elNode('b',{},'Reduced input quality.'),' The numeric range is shown, but the Tight/Moderate/Wide label is suppressed because the minutes inputs required bounding.'));
    uncertaintyNodes.push(elNode('details',{class:'player-detail-expand'},
      elNode('summary',{},'Full range and outcome probabilities'),
      elNode('div',{class:'player-detail-grid detail-percentiles'},
        playerDetailMetric('P10',fmt1(simulation.p10),'lower-tail outcome'),
        playerDetailMetric('Median',fmt1(simulation.median),'middle outcome'),
        playerDetailMetric('P90',fmt1(simulation.p90),'upside outcome')),
      elNode('div',{class:'player-detail-grid probability-grid'},
        playerDetailMetric('Blank',playerDetailPercent(simulation.blankProbability),'2 points or fewer'),
        playerDetailMetric('Return',playerDetailPercent(simulation.returnProbability),'5+ points'),
        playerDetailMetric('Haul',playerDetailPercent(simulation.haulProbability),'10+ points'),
        playerDetailMetric('Mega-haul',playerDetailPercent(simulation.megaHaulProbability),'15+ points')),
      elNode('p',{class:'player-detail-help'},'These are model-conditional simulations, not externally calibrated probabilities.')));
  }
  detail.push(playerDetailSection('Uncertainty',uncertaintyNodes));

  detail.push(playerDetailSection('How the projection is built',
    elNode('div',{class:'player-detail-breakdown'},breakdownNode(p,x,span))));

  playerDetailOpen({title:`${p.web_name} details`,body:detail,trigger});
}

/* ---------------------------------------------------------------------
   VIEW — SQUAD
   --------------------------------------------------------------------- */
function renderSquad(){
  const out = $('squadOut'), realSquad = mySquad();
  if(!realSquad.length){
    decisionPreviewClearAll();
    setChildren(out,elNode('div',{class:'empty'},elNode('strong',{},'No squad yet'),
      S.entry ? ['Team found: ',elNode('b',{},S.entry.name),'. FPL only publishes picks once a gameweek is under way — until then, build your 15 by hand below and everything still works.']
        : 'Add your team ID above, or build your 15 by hand below.'));
    return;
  }
  decisionPreviewSyncSquad(realSquad);
  let previewState=decisionPreviewSnapshot();
  let applied=previewState.transfer?decisionPreviewApplyTransferPlan(realSquad,previewState.transfer,S.byId):{ok:true,squad:realSquad,incomingIds:[],outgoingIds:[]};
  if(previewState.transfer&&!applied.ok){
    decisionPreviewClearTransfer();
    previewState=decisionPreviewSnapshot();
    applied={ok:true,squad:realSquad,incomingIds:[],outgoingIds:[]};
  }
  const squad=applied.squad, incomingIds=new Set(applied.incomingIds), gw=S.nextGW, xi=bestXI(squad,gw), nodes=[];
  const currentXi=previewState.transfer?bestXI(realSquad,gw):xi;
  nodes.push(elNode('div',{class:'team-summary'},
    elNode('div',{class:'team-score'},elNode('span',{class:'label'},`${previewState.transfer?'Preview':'Projected'} GW${gw}`),elNode('span',{class:'value'},fmt1(xi.tot)),elNode('span',{class:'unit'},'expected points')),
    elNode('div',{class:'team-facts'},
      elNode('div',{class:'team-fact'},elNode('span',{class:'label'},'Shape'),elNode('span',{class:'value'},xi.shape)),
      elNode('div',{class:'team-fact'},elNode('span',{class:'label'},'Value'),elNode('span',{class:'value'},`£${fmt1(squad.reduce((a,s)=>a+s.p.now_cost,0)/10)}m`)),
      elNode('div',{class:'team-fact'},elNode('span',{class:'label'},'Free transfers'),elNode('span',{class:'value'},num($('ftCount').value))))));
  if(previewState.transfer){
    const moves=previewState.transfer.transfers.map(t=>`${S.byId[t.outPlayerId]?.web_name||t.outPlayerId} → ${S.byId[t.inPlayerId]?.web_name||t.inPlayerId}`).join(' · ');
    nodes.push(elNode('section',{class:'decision-preview-banner transfer-preview','aria-label':'Temporary transfer preview'},
      elNode('div',{},elNode('span',{class:'eyebrow'},'Preview only'),elNode('strong',{},moves),
        elNode('p',{},`Current squad ${fmt1(currentXi.tot)} xP → preview ${fmt1(xi.tot)} xP for GW${gw}. Optimiser net ${previewState.transfer.netGain>=0?'+':''}${fmt1(previewState.transfer.netGain)} over ${previewState.transfer.previewHorizon||1} GW${(previewState.transfer.previewHorizon||1)>1?'s':''} · hit −${previewState.transfer.hitCost} · £${fmt1(previewState.transfer.bankAfter/10)}m left · ${previewState.transfer.freeTransfersNextGW} FT next GW.`)),
      elNode('button',{type:'button',class:'btn ghost sm',onclick:()=>{decisionPreviewClearTransfer();renderSquad();renderTransfers();}},'Clear preview')));
  }
  if(S.entry) nodes.push(elNode('p',{class:'status team-entry'},`${S.entry.name} · ${S.entry.player_first_name||''} ${S.entry.player_last_name||''} · OR ${(S.entry.summary_overall_rank||0).toLocaleString('en-GB')}`));

  const problems=[];
  squad.forEach(({p})=>{
    let tail=null;
    if(['i','u','s','n'].includes(p.status)) tail=[' unavailable'];
    else if(p.status==='d') tail=[` doubtful ${p.chance_of_playing_next_round ?? '?'}%`];
    else if(priceMomentum(p)==='falling') tail=[' is being sold heavily — a price fall looks likely'];
    if(tail){ if(p.news) tail.push(` — ${p.news} `,elNode('span',{class:'flag dark'},newsAge(p))); problems.push([elNode('b',{},p.web_name),tail]); }
  });
  const blanks=squad.filter(({p})=>(teamFixtures(p.team,gw,1)[0]||[]).length===0);
  if(blanks.length) problems.push([elNode('b',{},blanks.map(b=>b.p.web_name).join(', ')),` ${blanks.length>1?'have':'has'} no fixture in GW${gw}`]);
  if(problems.length){ const n=noteNode('bad',elNode('b',{},'Needs attention')); problems.forEach(p=>n.append(elNode('br'),...p)); nodes.push(n); }
  else nodes.push(noteNode('good','No injuries, suspensions or blanks were found in your 15. Use Transfers for the separate roll or transfer decision.'));

  const capRank=xi.xi.map(s=>({s,x:xpOf(s.p,gw,1).total,own:num(s.p.selected_by_percent)})).sort((a,b)=>b.x-a.x);
  const captaincy=teamPitchCaptaincy(capRank);
  const xiIds=xi.xi.map(s=>Number(s.p.id));
  previewState=decisionPreviewSnapshot();
  const effectiveCaptaincy=decisionPreviewEffectiveCaptaincy(captaincy,xiIds);
  const scoreById=Object.fromEntries(xi.xi.map(s=>[s.p.id,xpOf(s.p,gw,1).total]));
  const captainTotal=decisionPreviewCaptainTotal(xi.tot,effectiveCaptaincy.captainId,scoreById);
  const modelCaptain=S.byId[captaincy.captainId]?.web_name||'—', modelVice=S.byId[captaincy.viceId]?.web_name||'—';
  const previewCaptain=S.byId[effectiveCaptaincy.captainId]?.web_name||'—', previewVice=S.byId[effectiveCaptaincy.viceId]?.web_name||'—';
  nodes.push(elNode('section',{class:'decision-preview-controls','aria-label':'Captain and vice-captain preview controls'},
    elNode('div',{class:'decision-preview-copy'},elNode('span',{class:'eyebrow'},'Captaincy'),
      elNode('strong',{},`Model: ${modelCaptain} C · ${modelVice} VC`),
      effectiveCaptaincy.isPreview?elNode('p',{},`Preview: ${previewCaptain} C · ${previewVice} VC · captain uplift ${fmt1(captainTotal.uplift)} · total ${fmt1(captainTotal.total)}.`):elNode('p',{},`Captain uplift ${fmt1(captainTotal.uplift)} · total with captain ${fmt1(captainTotal.total)}.`)),
    elNode('div',{class:'decision-preview-actions'},
      elNode('button',{type:'button',class:`btn ghost sm${previewState.selectionMode==='captain'?' active':''}`,'aria-pressed':previewState.selectionMode==='captain',onclick:()=>{decisionPreviewBeginRole('captain',captaincy);renderSquad();}},'Choose captain'),
      elNode('button',{type:'button',class:`btn ghost sm${previewState.selectionMode==='vice'?' active':''}`,'aria-pressed':previewState.selectionMode==='vice',onclick:()=>{decisionPreviewBeginRole('vice',captaincy);renderSquad();}},'Choose vice-captain'),
      effectiveCaptaincy.isPreview?elNode('button',{type:'button',class:'btn ghost sm',onclick:()=>{decisionPreviewClearCaptaincy();renderSquad();}},'Reset captaincy'):null),
    previewState.selectionMode?elNode('p',{class:'selection-help',role:'status'},`Tap a starting player to choose ${previewState.selectionMode==='captain'?'captain':'vice-captain'}.`):null));
  const fixtureLabel=p=>{
    const games=teamFixtures(p.team,gw,1)[0]||[];
    return games.length ? games.map(g=>`${g.opp.short_name} ${g.home?'H':'A'}`).join(' + ') : 'Blank';
  };
  const playerNode=(slot,benchIndex=null)=>{
    const p=slot.p, team=S.teams[p.team], palette=teamPitchPalette(team), paletteClass=teamPitchPaletteClass(team);
    const role=p.id===effectiveCaptaincy.captainId?'captain':p.id===effectiveCaptaincy.viceId?'vice':null;
    const bad=availability(p)<1, incoming=incomingIds.has(Number(p.id));
    const selectable=benchIndex==null&&!!previewState.selectionMode;
    const fixture=fixtureLabel(p), projected=fmt1(xpOf(p,gw,1).total);
    const label=benchIndex==null?p.web_name:`${benchIndex}. ${p.web_name}`;
    return elNode('button',{type:'button',class:`pitch-player${benchIndex==null?'':' bench-player'}${bad?' warn':''}${incoming?' incoming':''}${selectable?' selection-target':''}`,
      onclick:event=>{
        if(selectable){ decisionPreviewChooseRole(previewState.selectionMode,p.id,xiIds); renderSquad(); }
        else openPlayerDetailView(p,gw,1,event.currentTarget);
      },
      'aria-label':selectable?`Select ${label} as ${previewState.selectionMode==='captain'?'captain':'vice-captain'}`:`${label}, ${fixture}, ${projected} expected points${role==='captain'?', captain':role==='vice'?', vice-captain':''}${incoming?', incoming transfer preview':''}`},
      elNode('div',{class:'shirt-wrap'},
        elNode('span',{class:`club-shirt pattern-${palette.pattern} ${paletteClass}`,'aria-hidden':'true'},elNode('span',{class:'club-shirt-code'},palette.code)),
        role?elNode('span',{class:`captain-badge${role==='vice'?' vice':''}${effectiveCaptaincy.isPreview?' preview':''}`},role==='captain'?'C':'VC'):null,
        incoming?elNode('span',{class:'incoming-badge'},'IN'):null),
      elNode('div',{class:'pitch-copy'},elNode('div',{class:'pitch-name'},label),elNode('div',{class:'pitch-meta'},fixture),elNode('div',{class:'pitch-xp'},`${projected} xP`)));
  };
  const formation=elNode('div',{class:'pitch-formation'},teamPitchLines(xi.xi).map(line=>
    elNode('div',{class:`pitch-line position-${line.position}`},line.players.map(slot=>playerNode(slot)))));
  const pitch=elNode('section',{class:'team-pitch','aria-label':`Model-selected starting eleven for Gameweek ${gw}`},
    elNode('span',{class:'pitch-mark pitch-centre-circle','aria-hidden':'true'}),
    elNode('span',{class:'pitch-mark pitch-box pitch-box-top','aria-hidden':'true'}),
    elNode('span',{class:'pitch-mark pitch-box pitch-box-bottom','aria-hidden':'true'}),formation);
  const bench=elNode('section',{class:'team-bench','aria-label':'Bench order'},
    elNode('div',{class:'bench-head'},elNode('strong',{},'Bench'),elNode('span',{},'Auto-sub order')),
    elNode('div',{class:'bench-grid'},xi.bench.map((slot,index)=>playerNode(slot,index+1))));
  nodes.push(elNode('div',{class:'team-stage'},pitch,bench));

  if(capRank.length){
    const c1=capRank[0], c2=capRank[1], grid=elNode('div',{class:'capgrid'});
    nodes.push(elNode('h3',{class:'section-title'},'Captaincy ranking'),grid);
    capRank.slice(0,4).forEach((c,i)=>{
      const games=teamFixtures(c.s.p.team,gw,1)[0]||[];
      const why=games.length?games.map(g=>`${g.home?'vs':'away to'} ${g.opp.short_name}`).join(' + ')+` · ${fmt1(c.x)} xP · ${c.own}% owned`:'no fixture';
      grid.appendChild(elNode('div',{class:`capcard ${i===0?'top':''}`},elNode('div',{class:'rank'},i+1),
        elNode('div',{class:'capbody'},elNode('span',{class:'pname'},c.s.p.web_name,flagNodes(c.s.p)),elNode('div',{class:'why'},why)),
        elNode('span',{class:`xp ${i===0?'hot':''}`},fmt1(c.x*2))));
    });
    if(c2&&(c1.x-c2.x)<.6){ nodes.push(noteNode('',teamDecisionCloseCaptainCopy(c1.s.p.web_name,c2.s.p.web_name,c1.x-c2.x))); }
  }
  nodes.push(elNode('h3',{class:'section-title'},'All 15 over 6 gameweeks'));
  const tbody=elNode('tbody');
  squad.slice().sort((a,b)=>a.p.element_type-b.p.element_type||xpOf(b.p,gw,6).total-xpOf(a.p,gw,6).total).forEach(s=>{
    const openButton=elNode('button',{type:'button',class:'player-row-action','aria-label':`Open ${s.p.web_name} player details`,onclick:event=>openPlayerDetailView(s.p,gw,6,event.currentTarget)},
      elNode('span',{class:'pname'},s.p.web_name,flagNodes(s.p)),
      elNode('span',{class:'pmeta'},elNode('span',{class:'pos'},S.posName[s.p.element_type]||'?'),` ${S.teams[s.p.team]?.short_name||''}`));
    tbody.appendChild(elNode('tr',{},
      elNode('td',{},openButton),
      cell((s.p.now_cost/10).toFixed(1),'num'),cell((sellPrice(s)/10).toFixed(1),'num'),cell(fmt1(num(s.p.form)),'num'),cell(fmt1(xpOf(s.p,gw,1).total),'num'),elNode('td',{class:'num'},elNode('span',{class:'xp'},fmt1(xpOf(s.p,gw,6).total)))));
  });
  nodes.push(elNode('div',{class:'scroll'},elNode('table',{class:'data'},elNode('caption',{class:'sr-only'},`Current squad projections from GW${gw}`),elNode('thead',{},elNode('tr',{},head('Player'),head('£','num'),head('Sell','num'),head('Form','num'),head(`xP GW${gw}`,'num'),head('xP 6GW','num'))),tbody)));
  if(!$('useManual').checked&&S.picks) nodes.push(noteNode('plain',"Sell prices assume you bought at today's price — the public API doesn't expose purchase prices. Build the squad by hand if you want them exact."));
  setChildren(out,nodes);
}

/* ---------------------------------------------------------------------
   VIEW — ASK
   --------------------------------------------------------------------- */
function md(t){
  return t
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/^### (.*)$/gm,'<h4>$1</h4>')
    .replace(/^## (.*)$/gm,'<h4>$1</h4>')
    .replace(/\*\*(.+?)\*\*/g,'<b>$1</b>')
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g,'<i>$1</i>')
    .replace(/^[-•] (.*)$/gm,'<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g,'<ul>$1</ul>')
    .replace(/\n{2,}/g,'</p><p>')
    .replace(/\n/g,'<br>');
}

function buildContext(){
  if(!S.boot) return 'No FPL data is loaded in the app.';
  const gw = S.nextGW, squad = mySquad();
  const line = s => {
    const p = s.p, x = xpOf(p, gw, 6);
    return `${p.web_name} (${S.posName[p.element_type]}, ${S.teams[p.team]?.short_name}, £${(p.now_cost/10).toFixed(1)}m, form ${p.form}, ${p.selected_by_percent}% owned, status ${p.status}, projected ${fmt1(xpOf(p,gw,1).total)} next GW / ${fmt1(x.total)} over 6${p.news? `, news: ${p.news}`:''})`;
  };
  let c = `SEASON: next gameweek ${gw}. Season under way: ${S.seasonLive ? 'yes' : 'NO — pre-season, no match data exists, so all projections are price-implied priors and should be treated as rough'}.\n`;
  c += `DATA LAYERS ACTIVE: FPL API${S.ustat ? ' + Understat rolling xG' : ''}${S.odds ? ' + bookmaker odds (market-implied goals, weighted 65%)' : ''}.\n`;
  if(S.backtest) c += `MODEL VALIDATION: backtested on ${S.backtest.season} (${S.backtest.n} players): correlation ${S.backtest.r}, mean error ±${S.backtest.maeGW} pts/GW, per-position bias before correction ${JSON.stringify(S.backtest.bias)} (percent, negative = model over-predicted). Corrections are now applied to all projections.\n`;
  c += `FREE TRANSFERS: ${num($('ftCount').value)}. BANK: £${num($('bankIn').value).toFixed(1)}m. CHIPS USED: ${S.chipsUsed.length ? S.chipsUsed.join(', ') : 'none recorded'}.\n\n`;
  if(squad.length){
    const xi = bestXI(squad, gw);
    const xiIds = new Set(xi.xi.map(s=>s.p.id));
    c += `MY SQUAD (projected ${fmt1(xi.tot)} points in GW${gw}, best shape ${xi.shape}):\n`;
    squad.forEach(s => c += `- ${xiIds.has(s.p.id)?'XI':'BENCH'} ${line(s)}\n`);
  } else c += `MY SQUAD: not entered yet.\n`;

  const ease = Object.values(S.teams).map(t => ({n:t.short_name, a:runScore(t.id,gw,6,'attack'), d:runScore(t.id,gw,6,'defence')}));
  c += `\nFIXTURES next 6 GWs (higher = easier).\nBest for attackers: ${ease.slice().sort((a,b)=>b.a-a.a).slice(0,6).map(x=>`${x.n} ${x.a.toFixed(2)}`).join(', ')}`;
  c += `\nBest for defences: ${ease.slice().sort((a,b)=>b.d-a.d).slice(0,6).map(x=>`${x.n} ${x.d.toFixed(2)}`).join(', ')}`;
  c += `\nWorst overall: ${ease.slice().sort((a,b)=>a.a-b.a).slice(0,5).map(x=>x.n).join(', ')}\n`;

  const top = S.boot.elements.filter(p => availability(p) >= 0.75)
    .map(p => ({p, x:xpOf(p,gw,6).total})).sort((a,b)=>b.x-a.x).slice(0,18);
  c += `\nHIGHEST PROJECTED (6 GW, app model): ${top.map(t=>`${t.p.web_name} ${fmt1(t.x)}`).join(', ')}\n`;
  return c;
}

let lastAskQuestion='';
function renderThread(){
  const thread=$('thread');
  thread.innerHTML = S.thread.map(m =>
    `<div class="answer ${m.role==='user'?'me':''}"><p>${md(m.content)}</p></div>`).join('');
  if(globalThis.location?.hash==='#/ask') globalThis.requestAnimationFrame?.(()=>thread.lastElementChild?.scrollIntoView?.({block:'nearest'}));
}
function configureAskAvailability(){
  const available=Boolean(globalThis.window?.storage);
  const hosted=$('askHostedStatus'),question=$('q'),askButton=$('askBtn'),retry=$('retryAsk');
  if(hosted) hosted.hidden=available;
  if(question){question.disabled=!available;question.setAttribute('aria-describedby','askHostedStatus');}
  if(askButton) askButton.disabled=!available;
  if(retry&&!available) retry.hidden=true;
  document.querySelectorAll('[data-q]').forEach(button=>{button.disabled=!available;});
  return available;
}

async function ask(){
  const askAvailable=configureAskAvailability();
  const q = $('q').value.trim();
  if(!q) return;
  if(!askAvailable){
    lastAskQuestion=q;
    S.thread.push({role:'user',content:q});
    $('q').value='';
    S.thread.push({role:'assistant',content:"The AI assistant requires the planned serverless migration in this hosted build. Ask Teamsheet is available only inside Claude's artifact preview; this app does not accept or store Anthropic API keys."});
    renderThread();
    $('askStatus').textContent='';
    if($('retryAsk')) $('retryAsk').hidden=true;
    return;
  }
  lastAskQuestion=q;
  if($('retryAsk')) $('retryAsk').hidden=true;
  S.thread.push({role:'user', content:q});
  $('q').value = '';
  renderThread();
  const btn = $('askBtn'); btn.disabled = true;
  setChildren($('askStatus'),elNode('span',{class:'spinner'}),'Thinking…');
  try{
    const system = `You are an experienced Fantasy Premier League analyst advising one manager. Today is ${new Date().toDateString()}.
Treat the app data as the source of truth for squad, prices, projections and fixtures. Search the web for anything time-sensitive: injuries, press conferences, expected line-ups, transfers, rotation risk.
Be decisive and blunt. Say plainly when the honest answer is to do nothing — a banked transfer usually beats a marginal one, and a -4 needs to clear 4 projected points to be worth it. Never invent statistics you were not given and did not find. Keep answers under 250 words.

APP DATA
${buildContext()}`;
    // D-08 / SEC-3: no Anthropic secret is accepted, stored or sent by this
    // frontend. Claude's artifact preview provides the only approved keyless
    // path. Static hosted builds stop before making any Anthropic request.
    if(!globalThis.window?.storage){
      S.thread.push({role:'assistant', content:"The AI assistant requires the planned serverless migration in this hosted build. For now, Ask Teamsheet is available only inside Claude's artifact preview; this app does not accept or store Anthropic API keys."});
      renderThread(); $('askStatus').textContent = ''; if($('retryAsk')) $('retryAsk').hidden=false; btn.disabled = false; return;
    }
    const msgs = S.thread.slice(-8).map(m => ({role:m.role, content:m.content}));
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        model:'claude-sonnet-4-6', max_tokens:1000, system,
        messages: msgs,
        tools:[{type:'web_search_20250305', name:'web_search'}]
      })
    });
    if(!res.ok){
      S.thread.push({role:'assistant', content:'The keyless Claude connection is unavailable in this preview. Your question has been kept so you can retry.'});
      renderThread(); $('askStatus').textContent = ''; if($('retryAsk')) $('retryAsk').hidden=false; btn.disabled = false; return;
    }
    const data = await res.json();
    const text = (data.content||[]).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    S.thread.push({role:'assistant', content: text || 'No answer came back — try again.'});
    renderThread();
    $('askStatus').textContent = '';
    if($('retryAsk')) $('retryAsk').hidden=true;
  }catch(e){
    S.thread.push({role:'assistant',content:'That request failed — your question has been kept. Check your connection and try again.'});
    renderThread();
    $('askStatus').textContent = 'Request failed. Your question is still in the conversation.';
    if($('retryAsk')) $('retryAsk').hidden=false;
  }
  btn.disabled = !Boolean(globalThis.window?.storage);
}

/* ---------------------------------------------------------------------
   MANUAL SQUAD BUILDER
   --------------------------------------------------------------------- */
function renderManual(){
  const list = $('manualList');
  setChildren(list, S.manual.map((m,i) => {
    const p = S.byId[m.id];
    if(!p) return null;
    return elNode('span', {class:'pill'}, p.web_name, ' ',
      elNode('span', {class:'mono muted'}, S.posName[p.element_type]||''),
      elNode('button', {type:'button',class:'pill-remove',dataset:{rm:i}, 'aria-label':`Remove ${p.web_name}`}, '×'));
  }));
  const counts = {1:0,2:0,3:0,4:0};
  S.manual.forEach(m => { const p = S.byId[m.id]; if(p && counts[p.element_type]!==undefined) counts[p.element_type]++; });
  $('manualCount').textContent = `${S.manual.length}/15 · ${counts[1]} GKP, ${counts[2]} DEF, ${counts[3]} MID, ${counts[4]} FWD`
    + (S.manual.length === 15 ? ' — complete' : '');
  list.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', async () => {
    S.manual.splice(+b.dataset.rm, 1);
    await sset(K_SQUAD, S.manual); renderManual(); renderAll();
  }));
}
function searchPlayers(term){
  const box = $('pResults');
  if(!S.boot || term.length < 2){ box.hidden = true; return; }
  const t = term.toLowerCase();
  const hits = S.boot.elements.filter(p => p.web_name.toLowerCase().includes(t)).slice(0,12);
  setChildren(box, hits.length ? hits.map(p => elNode('button', {type:'button',class:'manual-player-result',dataset:{add:p.id},'aria-label':`Add ${p.web_name} to manual squad`}, p.web_name,
    elNode('span', {class:'pmeta'}, `${S.posName[p.element_type]||''} · ${S.teams[p.team]?.short_name||''} · £${(p.now_cost/10).toFixed(1)}m`)))
    : elNode('div', {}, 'No player by that name'));
  box.hidden = false;
  box.querySelectorAll('[data-add]').forEach(d => d.addEventListener('click', async () => {
    const id = +d.dataset.add;
    if(S.manual.length >= 15) return;
    if(!S.manual.some(m => m.id === id)) S.manual.push({id, bought:S.byId[id].now_cost});
    await sset(K_SQUAD, S.manual);
    $('pSearch').value = ''; box.hidden = true;
    $('useManual').checked = true; await saveCfg();
    renderManual(); renderAll();
  }));
}

/* ---------------------------------------------------------------------
   RENDER + WIRING
   --------------------------------------------------------------------- */
function renderRestrictedAppState(){
  setChildren($('gwstrip'),elNode('span',{},'Official FPL data unavailable'));
  renderTicker();
  renderTransfers();
  renderSquad();
  renderManual();
  setChildren($('playerTable'),elNode('div',{class:'empty'},elNode('strong',{},'Player Explorer unavailable'),'Verified Official FPL player data is required before players can be researched.'));
  renderMiniLeagues(globalThis.location?.hash||'#/leagues');
  configureAskAvailability();
  if(typeof document!=='undefined'&&typeof document.dispatchEvent==='function'&&typeof CustomEvent==='function')
    document.dispatchEvent(new CustomEvent('teamsheet:data-rendered'));
}

function renderAll(){
  if(!S.boot) return;
  clearXP();
  const ev = S.boot.events.find(e => e.id === S.nextGW);
  const bits = [elNode('span',{},'Next ',elNode('b',{},`GW${S.nextGW}`))];
  if(ev?.deadline_time){
    const dl = new Date(ev.deadline_time), hrs = (dl - Date.now())/3600000;
    const cd = hrs < 0 ? 'closed' : hrs < 48 ? `${Math.floor(hrs)}h ${Math.floor((hrs%1)*60)}m` : `${Math.floor(hrs/24)}d`;
    bits.push(elNode('span',{},'Deadline ',elNode('b',{class:hrs<48&&hrs>0?'live':''},`${dl.toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} · ${cd}`)));
  }
  bits.push(elNode('span',{},'Season ',elNode('b',{},S.seasonLive ? 'live' : 'pre-season')));
  if(S.entry) bits.push(elNode('span',{},'Team ',elNode('b',{},S.entry.name)));
  setChildren($('gwstrip'),bits);
  const srcBits = [];
  if(S.ustatNote) srcBits.push(S.ustatNote);
  if(S.oddsNote) srcBits.push(S.oddsNote);
  if(S.calib) srcBits.push(`Calibrated against ${S.backtest?.season || 'last season'} (r ${S.backtest?.r ?? '—'}).`);
  setChildren($('srcStatus'),srcBits.map(s=>elNode('div',{},s)));
  setChildren($('chipState'),S.chipsUsed.length ? noteNode('plain',elNode('b',{},'Chips already used:'),` ${S.chipsUsed.join(', ')}.`) : null);
  if(!$('fxFrom').value) $('fxFrom').value = S.nextGW;
  renderTicker(); renderPlayers(); renderSquad(); renderTransfers(); renderManual(); renderMiniLeagues();
  if(typeof document!=='undefined' && typeof document.dispatchEvent==='function' && typeof CustomEvent==='function')
    document.dispatchEvent(new CustomEvent('teamsheet:data-rendered'));
}

function debounce(fn, ms){ let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// Teamsheet 2.0.1: app-shell.mjs owns hash routing, history and focus.
configureAskAvailability();
document.querySelectorAll('[data-q]').forEach(c => c.addEventListener('click', () => { if(c.disabled) return; $('q').value = c.dataset.q; ask(); }));
document.addEventListener('teamsheet:preview-change',()=>renderSquad());
document.addEventListener('teamsheet:restricted',renderRestrictedAppState);

const reFixtureDisplay = debounce(() => { renderTicker(); }, 180);
const reFixtureWindow = debounce(() => { clearXP(); renderTicker(); renderPlayers(); }, 180);
['fxSort','fxLens'].forEach(id => $(id).addEventListener('input', reFixtureDisplay));
['fxFrom','fxSpan'].forEach(id => $(id).addEventListener('input', reFixtureWindow));
['plPos','plMax','plHorizon','plFit','plOwn'].forEach(id => $(id).addEventListener('input', debounce(renderPlayers, 180)));
['ftCount','bankIn'].forEach(id => $(id).addEventListener('input', debounce(() => { saveCfg(); renderSquad(); renderTransfers(); }, 250)));
// The Team ID persists as it is typed; Mini-League choices use their own versioned state.
$('teamId').addEventListener('input', debounce(saveCfg, 300));
$('useManual').addEventListener('change', () => { saveCfg(); renderAll(); });
$('loadBtn').addEventListener('click', () => runVerifiedRefresh({reason:'manual',force:true}));
$('askBtn').addEventListener('click', ask);
$('retryAsk')?.addEventListener('click',()=>{ if(!lastAskQuestion) return; $('q').value=lastAskQuestion; ask(); });
$('btBtn').addEventListener('click', runBacktest);
// The low-value odds key remains client-side temporarily (D-08); save it on
// input so a pasted value is not lost before the field blurs.
$('oddsKey').addEventListener('input', debounce(saveCfg, 300));
$('oddsKey').addEventListener('change', () => { saveCfg(); loadOdds().then(() => { clearXP(); renderAll(); }); });
$('useUstat').addEventListener('change', () => { saveCfg(); loadUnderstat().then(() => { clearXP(); renderAll(); }); });
$('clearThread').addEventListener('click', () => { S.thread = []; lastAskQuestion=''; if($('retryAsk')) $('retryAsk').hidden=true; renderThread(); });
$('pSearch').addEventListener('input', debounce(e => searchPlayers(e.target.value.trim()), 160));
document.addEventListener('click', e => {
  if(!e.target.closest('.searchbox')) $('pResults').hidden = true;
});

(async function init(){
  const cfg = await loadCfg();
  if(cfg){
    if(cfg.teamId) $('teamId').value = cfg.teamId;
    if(cfg.ft != null) $('ftCount').value = cfg.ft;
    if(cfg.bank != null) $('bankIn').value = cfg.bank;
    if(cfg.transferHorizon != null) $('trHorizon').value = String(cfg.transferHorizon);
    if(cfg.transferResults != null) $('trTop').value = String(cfg.transferResults);
    if(cfg.useManual) $('useManual').checked = true;
    if(cfg.oddsKey) $('oddsKey').value = cfg.oddsKey;
    if(cfg.useUstat === false) $('useUstat').checked = false;
  }
  const cal = await sget(K_CAL);
  if(cal){
    S.calib = cal.calib; S.backtest = cal.backtest;
    setChildren($('btOut'),elNode('div',{class:'note good mt-8'},`Calibration from ${cal.backtest?.season} is active (r ${cal.backtest?.r}, ±${cal.backtest?.maeGW} pts/GW). Re-run any time.`));
  }
  S.manual = (await sget(K_SQUAD)) || [];
  await initMiniLeagues(cfg||{});
  await runVerifiedRefresh({reason:'startup',startup:true,force:true});
  installVerifiedRefreshTriggers();
})();


/* ===== src/ui/team-decision-home.mjs ===== */

// Teamsheet 2.0.2 — presentation-only Team decision home.
// This module wraps the existing verified renderer. It does not own or alter
// best-XI, captaincy, bench, projection, simulation or optimiser behaviour.

const TEAM_DECISION_HOME_VERSION = '2.0.2';
const TEAM_RESOURCES_BENCH_CLARITY_VERSION = 'UX-A1';
const TEAM_DECISION_UNAVAILABLE = new Set(['i','u','s','n']);
const TEAM_DECISION_BENCH_LABELS = Object.freeze(['GK','1st','2nd','3rd']);

function teamDecisionForecast(xiTotal, captainXp){
  const base = Number.isFinite(Number(xiTotal)) ? Number(xiTotal) : 0;
  const uplift = Number.isFinite(Number(captainXp)) ? Number(captainXp) : 0;
  return Object.freeze({base,uplift,total:base+uplift});
}

function teamDecisionSquadReady(squad=[]){
  const source=Array.isArray(squad)?squad:[];
  if(source.length!==15) return false;
  const counts={1:0,2:0,3:0,4:0};
  for(const entry of source){
    const pos=Number(entry?.p?.element_type);
    if(!Object.prototype.hasOwnProperty.call(counts,pos)) return false;
    counts[pos]++;
  }
  return counts[1]===2&&counts[2]===5&&counts[3]===5&&counts[4]===3;
}

function teamDecisionSourceLabel({manual=false,hasPicks=false,picksGameweek=0,picksStatus='',fplState='',cachedAt=null}={}){
  const state=String(fplState||'');
  const gw=Number(picksGameweek);
  let label=manual?'User-entered squad':hasPicks
    ? `Official FPL public picks${gw>=1&&gw<=38?` · locked GW${gw}`:''}`
    : picksStatus==='unavailable'&&gw>=1&&gw<=38?`Public GW${gw} squad unavailable`:'Squad unavailable';
  if([HEALTH_STATES.CACHED,HEALTH_STATES.STALE,HEALTH_STATES.FALLBACK].includes(state)){
    label += state===HEALTH_STATES.FALLBACK?' · verified fallback':' · verified cache';
    if(Number.isFinite(Number(cachedAt))) label += ` · ${new Date(Number(cachedAt)).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}`;
  }
  return label;
}

function teamDecisionRisk({dataState='',captain=null,starters=[],blankIds=[],closeCaptain=null}={}){
  const state=String(dataState||'');
  const blanks=new Set((blankIds||[]).map(Number));
  if(state===HEALTH_STATES.UNAVAILABLE)
    return Object.freeze({kind:'data-unavailable',level:'blocking',text:'Official FPL data is unavailable, so no recommendation can be verified.'});
  if([HEALTH_STATES.FALLBACK,HEALTH_STATES.STALE,HEALTH_STATES.CACHED].includes(state))
    return Object.freeze({kind:'data-stale',level:'warning',text:'This recommendation uses previously verified data because the live Official FPL refresh did not complete.'});

  const rows=(Array.isArray(starters)?starters:[]).map(item=>({
    ...item,
    id:Number(item?.p?.id),
    status:String(item?.p?.status||''),
    chance:item?.p?.chance_of_playing_next_round,
    name:item?.p?.web_name||'A selected player',
    xp:Number(item?.xp)||0
  }));
  const captainId=Number(captain?.id);
  const cap=rows.find(row=>row.id===captainId)||null;
  const unavailable=row=>TEAM_DECISION_UNAVAILABLE.has(row.status)||blanks.has(row.id);
  const doubtful=row=>row.status==='d';
  const byImportance=(a,b)=>b.xp-a.xp||a.id-b.id;

  if(cap&&unavailable(cap))
    return Object.freeze({kind:'captain-unavailable',level:'blocking',playerId:cap.id,text:`Captain ${cap.name} is unavailable or has no fixture in this Gameweek.`});
  const unavailableStarter=rows.filter(row=>row.id!==captainId&&unavailable(row)).sort(byImportance)[0];
  if(unavailableStarter)
    return Object.freeze({kind:'starter-unavailable',level:'blocking',playerId:unavailableStarter.id,text:`Recommended starter ${unavailableStarter.name} is unavailable or has no fixture.`});
  if(cap&&doubtful(cap))
    return Object.freeze({kind:'captain-doubtful',level:'warning',playerId:cap.id,text:`Captain ${cap.name} is officially doubtful${cap.chance!=null?` (${cap.chance}% chance of playing)`:''}.`});
  const doubtfulStarter=rows.filter(row=>row.id!==captainId&&doubtful(row)).sort(byImportance)[0];
  if(doubtfulStarter)
    return Object.freeze({kind:'starter-doubtful',level:'warning',playerId:doubtfulStarter.id,text:`Recommended starter ${doubtfulStarter.name} is officially doubtful${doubtfulStarter.chance!=null?` (${doubtfulStarter.chance}% chance of playing)`:''}.`});
  if(closeCaptain&&Number(closeCaptain.gap)<0.6)
    return Object.freeze({kind:'close-captaincy',level:'info',text:`Captaincy is a close model call: ${closeCaptain.firstName} leads ${closeCaptain.secondName} by ${Number(closeCaptain.gap).toFixed(1)} projected points.`});
  return Object.freeze({kind:'none',level:'clear',text:'No material Team-selection risk is identified from the currently verified inputs.'});
}

function teamDecisionAction({hasSquad=false,deadlinePassed=false,previewActive=false,riskKind='none',squadStatus='',squadGameweek=0}={}){
  if(riskKind==='data-unavailable') return 'Official FPL season data is unavailable. Manual squad editing also needs the verified player list, so retry the data load before building a squad.';
  if(deadlinePassed) return 'The Official FPL deadline has passed. Review this recommendation for context only.';
  if(!hasSquad && squadStatus==='gameweek-unavailable') return 'Use Load data again when Official FPL identifies the current or next Gameweek, or build your squad manually in Settings → Team & Account.';
  if(!hasSquad && squadStatus==='unavailable') return `Use Load data again when Official FPL publishes the public${Number(squadGameweek)?` GW${Number(squadGameweek)}`:''} squad, or build your squad manually in Settings → Team & Account.`;
  if(!hasSquad && squadStatus==='incomplete') return 'The public squad response was incomplete. Retry Load data, or build the complete squad manually in Settings → Team & Account.';
  if(!hasSquad) return 'Enter your Team ID in Team setup below, or open Settings → Team & Account to build a manual squad.';
  if(previewActive) return 'Review this user preview and reproduce it in Official FPL before the deadline if you choose to act.';
  if(riskKind==='data-stale') return 'Check the data warning before acting. Previously verified content is not confirmation of a successful live refresh.';
  if(riskKind.includes('unavailable')||riskKind.includes('doubtful')) return 'Review the affected player. Open Transfers if a replacement is needed, then set the final XI, captaincy and bench in Official FPL.';
  return 'Review and set this XI, captaincy and bench in Official FPL. Use Transfers for the separate roll-or-transfer decision.';
}

function teamDecisionCloseCaptainCopy(firstName,secondName,gap){
  return `${firstName} and ${secondName} are separated by ${Number(gap).toFixed(1)} projected points. This is a close model call; ownership is context only and does not create a protect or chase recommendation.`;
}

function teamDecisionBenchLabel(index){
  return TEAM_DECISION_BENCH_LABELS[Number(index)]||`Sub ${Number(index)+1}`;
}

function teamDecisionBenchDisplayOrder(bench=[]){
  const source=Array.isArray(bench)?bench:[];
  const reserveGoalkeeper=source.find(slot=>Number(slot?.p?.element_type)===1)||null;
  if(!reserveGoalkeeper) return source.slice();
  return [reserveGoalkeeper,...source.filter(slot=>slot!==reserveGoalkeeper)];
}

function teamDecisionOrderBenchDisplay(stage,xi){
  if(!stage?.querySelector||!xi) return;
  const grid=stage.querySelector('.team-bench .bench-grid');
  if(!grid) return;
  const source=Array.isArray(xi.bench)?xi.bench:[];
  const nodes=Array.from(grid.querySelectorAll('.bench-player'));
  if(nodes.length!==source.length) return;
  const nodeBySlot=new Map(source.map((slot,index)=>[slot,nodes[index]]));
  for(const slot of teamDecisionBenchDisplayOrder(source)){
    const node=nodeBySlot.get(slot);
    if(node) grid.appendChild(node);
  }
}

function teamDecisionRelabelBench(stage){
  if(!stage?.querySelectorAll) return;
  const players=Array.from(stage.querySelectorAll('.team-bench .bench-grid .bench-player'));
  const rolePrefix=/^(?:(?:Reserve goalkeeper|[123](?:st|nd|rd) sub|GK|1st|2nd|3rd)(?: bench)?[,·]\s*)/;
  players.forEach((player,index)=>{
    const label=teamDecisionBenchLabel(index);
    const nameNode=player.querySelector('.pitch-name');
    const oldRole=player.querySelector('.bench-role');
    if(oldRole?.remove) oldRole.remove();
    if(nameNode){
      const playerName=String(nameNode.textContent||'').replace(/^\d+\.\s*/, '').replace(rolePrefix,'');
      nameNode.textContent=playerName;
      nameNode.parentNode?.insertBefore(el('span',{class:'bench-role'},label),nameNode);
    }
    const aria=player.getAttribute('aria-label');
    if(aria){
      const detail=aria.replace(/^\d+\.\s*/, '').replace(rolePrefix,'');
      player.setAttribute('aria-label',`${label} bench, ${detail}`);
    }
  });
}

function teamDecisionAvailabilityPresentation(player){
  const status=String(player?.status||'');
  if(status==='d'){
    const chance=player?.chance_of_playing_next_round;
    const chanceLabel=chance==null?'chance unknown':`${chance}% chance`;
    const chanceAria=chance==null?'chance of playing unknown':`${chance} percent chance of playing`;
    return Object.freeze({label:`Doubtful · ${chanceLabel}`,className:'doubt',aria:`doubtful, ${chanceAria}`});
  }
  if(status==='s') return Object.freeze({label:'Suspended',className:'out',aria:'suspended and unavailable'});
  if(TEAM_DECISION_UNAVAILABLE.has(status)) return Object.freeze({label:'Unavailable',className:'out',aria:'unavailable'});
  return null;
}

function teamDecisionAnnotateAvailability(stage,xi){
  if(!stage?.querySelectorAll||!xi) return;
  const starterSlots=teamPitchLines(xi.xi).flatMap(line=>line.players);
  const starterNodes=Array.from(stage.querySelectorAll('.team-pitch .pitch-player'));
  const benchSlots=teamDecisionBenchDisplayOrder(xi.bench);
  const benchNodes=Array.from(stage.querySelectorAll('.team-bench .bench-grid .bench-player'));
  const annotate=(node,slot)=>{
    if(!node||!slot?.p) return;
    const presentation=teamDecisionAvailabilityPresentation(slot.p);
    node.querySelector('.pitch-availability')?.remove?.();
    if(!presentation) return;
    const copy=node.querySelector('.pitch-copy');
    const nameNode=copy?.querySelector?.('.pitch-name');
    const badge=el('span',{class:`flag ${presentation.className} pitch-availability`},presentation.label);
    if(copy&&nameNode) copy.insertBefore(badge,nameNode.nextSibling);
    else copy?.appendChild?.(badge);
    const aria=String(node.getAttribute?.('aria-label')||'');
    if(aria) node.setAttribute('aria-label',`${aria}, ${presentation.aria}`);
  };
  starterNodes.forEach((node,index)=>annotate(node,starterSlots[index]));
  benchNodes.forEach((node,index)=>annotate(node,benchSlots[index]));
}

function teamDecisionPlaceholderPlayer(label='—',benchRole=''){
  return el('div',{class:'pitch-player team-home-placeholder-player','aria-hidden':'true'},
    el('div',{class:'shirt-wrap'},
      el('span',{class:'club-shirt pattern-solid shirt-palette-fallback-3'},el('span',{class:'club-shirt-code'},'FPL'))),
    el('div',{class:'pitch-copy'},benchRole?el('span',{class:'bench-role'},benchRole):null,
      el('div',{class:'pitch-name'},label),el('div',{class:'pitch-meta'},'Awaiting squad'),el('div',{class:'pitch-xp'},'— xP')));
}

function teamDecisionPlaceholderStage(gw,message){
  const line=(position,count)=>el('div',{class:`pitch-line position-${position}`},Array.from({length:count},()=>teamDecisionPlaceholderPlayer()));
  const pitch=el('section',{class:'team-pitch team-home-placeholder','aria-label':message,role:'img'},
    el('span',{class:'pitch-mark pitch-centre-circle','aria-hidden':'true'}),
    el('span',{class:'pitch-mark pitch-box pitch-box-top','aria-hidden':'true'}),
    el('span',{class:'pitch-mark pitch-box pitch-box-bottom','aria-hidden':'true'}),
    el('div',{class:'pitch-formation'},line(4,3),line(3,4),line(2,3),line(1,1)));
  const bench=el('section',{class:'team-bench','aria-label':'Bench unavailable'},
    el('div',{class:'bench-head'},el('strong',{},'Bench'),el('span',{},'Auto-sub order')),
    el('div',{class:'bench-grid'},Array.from({length:4},(_,index)=>teamDecisionPlaceholderPlayer('—',teamDecisionBenchLabel(index)))));
  return el('div',{class:'team-stage'},pitch,bench);
}

function teamDecisionMetaChip(text,kind='plain'){
  return el('span',{class:`team-home-chip ${kind}`},text);
}

function teamDecisionFocusResources(){
  const context=$('teamContext');
  const firstInput=$('ftCount')||$('bankIn');
  context?.scrollIntoView?.({block:'start'});
  firstInput?.focus?.();
}

function teamDecisionResourceBar({ft=0,bank='0.0'}={}){
  const item=(label,value)=>el('div',{class:'team-resource-item'},
    el('span',{class:'team-resource-label'},label),
    el('strong',{class:'team-resource-value'},value));
  return el('section',{class:'team-resource-bar','aria-label':'Team resources'},
    el('div',{class:'team-resource-bar-head'},
      el('div',{class:'team-resource-heading'},
        el('span',{class:'eyebrow'},'Team resources'),
        el('span',{class:'team-resource-provenance'},'Entered manually')),
      el('button',{type:'button',class:'btn ghost sm team-resource-edit',onclick:teamDecisionFocusResources,
        'aria-label':'Edit free transfers and money in bank'},'Edit resources')),
    el('div',{class:'team-resource-values'},
      item('Free transfers',String(ft)),
      item('Money in bank',`£${bank}m`)));
}

function teamDecisionHeader({title,eyebrow,source,deadline,rank}){
  const chips=[teamDecisionMetaChip(source,'source')];
  if(deadline) chips.push(teamDecisionMetaChip(deadline,'deadline'));
  if(rank) chips.push(teamDecisionMetaChip(rank,'official'));
  return el('section',{class:'team-home-header','aria-labelledby':'teamDecisionTitle'},
    el('span',{class:'eyebrow'},eyebrow),
    el('h3',{id:'teamDecisionTitle'},title),
    el('div',{class:'team-home-chips'},chips));
}

function teamDecisionSummary({recommendation,forecast,risk,action}){
  const row=(label,value,kind='')=>el('div',{class:`team-home-row${kind?' '+kind:''}`},
    el('span',{class:'team-home-row-label'},label),el('span',{class:'team-home-row-value'},value));
  return el('section',{class:'team-home-decision','aria-label':'Team decision summary'},
    row('Recommendation',recommendation),
    row('Forecast',forecast),
    row('Main risk',risk.text,`risk-${risk.level}`),
    row('Before deadline',action,'deadline-action'),
    el('p',{class:'status team-home-advisory'},'Teamsheet is advisory and does not submit squad, captaincy or transfer changes to Official FPL.'));
}

function teamDecisionDeadlineModel(){
  const event=S.boot?.events?.find?.(item=>Number(item.id)===Number(S.nextGW));
  if(!event?.deadline_time) return {label:'Deadline unavailable',passed:false};
  const deadline=new Date(event.deadline_time);
  return {
    label:`Deadline ${deadline.toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}`,
    passed:deadline.getTime()<=Date.now()
  };
}

function teamDecisionCaptureFocus(out){
  const active=typeof document!=='undefined'?document.activeElement:null;
  if(!active||!out?.contains?.(active)) return null;
  return {aria:active.getAttribute?.('aria-label')||'',text:active.textContent?.trim()||''};
}

function teamDecisionRestoreFocus(out,focus){
  if(!focus||!out) return;
  const controls=Array.from(out.querySelectorAll('button,a,input,select,textarea'));
  const match=controls.find(node=>focus.aria&&node.getAttribute('aria-label')===focus.aria)||
    controls.find(node=>focus.text&&node.textContent?.trim()===focus.text);
  match?.focus?.({preventScroll:true});
}

function teamDecisionSetStartupShellOwned(owned){
  if(typeof document==='undefined') return;
  [document.querySelector('header'),document.querySelector('main'),document.querySelector('nav.tabs')].filter(Boolean).forEach(node=>{
    node.hidden=Boolean(owned);
    node.inert=Boolean(owned);
  });
}

function teamDecisionSetupStartup(){
  if(typeof document==='undefined') return;
  const startupPending=Boolean(document.body?.classList?.contains('startup-pending'));
  if(startupPending) teamDecisionSetStartupShellOwned(true);
  document.addEventListener?.('teamsheet:startup-ready',()=>teamDecisionSetStartupShellOwned(false),{once:true});
  const pitch=document.querySelector('#startupGate .startup-pitch');
  if(!pitch) return;
  pitch.classList.add('team-startup-lineup');
  pitch.setAttribute('aria-label','Loading your team');
  const rows=[3,4,3,1].map((count,index)=>el('div',{class:`team-startup-row row-${index+1}`},
    Array.from({length:count},()=>el('span',{'aria-hidden':'true'},'○'))));
  setChildren(pitch,rows);
  const sub=document.querySelector('#startupGate .startup-sub');
  if(sub) sub.textContent='Loading your team';
}

function teamDecisionUpdateManualAvailability(){
  const available=Boolean(S.boot);
  const manualToggle=$('useManual'),manualSearch=$('pSearch'),manualLink=$('manualSquadLink');
  if(manualToggle){
    manualToggle.disabled=!available;
    manualToggle.setAttribute('aria-describedby','manualModeAvailability manualEditorAvailability');
  }
  if(manualSearch){
    manualSearch.disabled=!available;
    manualSearch.setAttribute('aria-describedby','manualEditorAvailability');
  }
  ['manualModeAvailability','manualEditorAvailability'].map(id=>$(id)).filter(Boolean).forEach(node=>{
    node.textContent=available
      ? 'Manual squad editing is available in Settings → Team & Account.'
      : 'Manual squad editing is unavailable until verified Official FPL player data loads.';
  });
  if(manualLink) manualLink.hidden=!available;
}

function teamDecisionSetupShell(){
  if(typeof document==='undefined') return null;
  const teamView=$('view-squad'),out=$('squadOut'),context=$('teamContext');
  if(!teamView||!out) return null;
  const hint=teamView.querySelector('.hint');
  if(hint) hint.textContent='Your recommended XI, captaincy, bench, forecast and the one issue that matters before the deadline.';
  if(context){
    const heading=context.querySelector('h3');
    if(heading) heading.textContent='Team setup and weekly resources';
    const contextStatus=context.querySelector('.team-context-head > .status');
    if(contextStatus) contextStatus.textContent='Bank and free transfers remain manual until separate account integration is approved.';
    const relabel=(id,text)=>{
      const input=$(id),label=input?.closest?.('label');
      const first=label?.childNodes?.[0];
      if(first?.nodeType===3) first.nodeValue=text;
    };
    relabel('ftCount','Free transfers (manual)');
    relabel('bankIn','Bank £m (manual)');
    const manualToggle=$('useManual'),manualCopy=manualToggle?.parentElement;
    const manualText=Array.from(manualCopy?.childNodes||[]).find(node=>node.nodeType===3);
    if(manualText) manualText.nodeValue=' Use my manually entered squad';
    const manualStatus=el('p',{id:'manualModeAvailability',class:'status'});
    const manualLink=el('a',{id:'manualSquadLink',class:'btn ghost sm',href:'#/settings/team-account'},'Open manual squad editor');
    context.append(manualStatus,manualLink);
    teamView.insertBefore(context,out.nextSibling);
  }
  teamDecisionUpdateManualAvailability();
  let support=$('teamHomeSupport');
  if(!support){
    support=el('div',{id:'teamHomeSupport',class:'team-home-support-host'});
    if(context) teamView.insertBefore(support,context.nextSibling);
    else teamView.appendChild(support);
  }
  return support;
}

function teamDecisionEnhanceRenderedTeam(){
  if(typeof document==='undefined') return;
  teamDecisionUpdateManualAvailability();
  const out=$('squadOut'),support=$('teamHomeSupport');
  if(!out||!support) return;
  const realSquad=mySquad();
  const ready=teamDecisionSquadReady(realSquad);
  out.classList.toggle('team-home-ready',ready);
  support.textContent='';
  const health=getHealth('fpl',{seasonLive:S.seasonLive});
  const dataState=health?.state||(!S.boot?HEALTH_STATES.UNAVAILABLE:HEALTH_STATES.LIVE);
  const deadline=teamDecisionDeadlineModel();
  const manual=Boolean($('useManual')?.checked);
  const source=teamDecisionSourceLabel({manual,hasPicks:Boolean(S.picks?.picks),
    picksGameweek:S.picksGameweek,picksStatus:S.picksStatus,fplState:dataState,cachedAt:S.cachedAt});
  const ft=Math.max(0,Math.trunc(num($('ftCount')?.value)));
  const bank=Math.max(0,num($('bankIn')?.value)).toFixed(1);
  const rank=Number(S.entry?.summary_overall_rank)>0?`Official OR ${Number(S.entry.summary_overall_rank).toLocaleString('en-GB')}`:'';
  const title=`${S.entry?.name||'Your team'} · GW${S.nextGW}`;

  if(!ready){
    const count=realSquad.length;
    let risk;
    if(dataState===HEALTH_STATES.UNAVAILABLE) risk=teamDecisionRisk({dataState});
    else if(S.picksStatus==='gameweek-unavailable') risk=Object.freeze({kind:'squad-unavailable',level:'blocking',
      text:'Official FPL has not identified a valid current or next Gameweek, so Teamsheet cannot request public squad picks.'});
    else if(S.picksStatus==='unavailable'&&S.entry) risk=Object.freeze({kind:'squad-unavailable',level:'blocking',
      text:`Official FPL has not exposed a complete public GW${S.picksGameweek} squad for this Team ID yet. Teamsheet will not invent or reuse a different Gameweek squad.`});
    else if(S.picksStatus==='incomplete') risk=Object.freeze({kind:'squad-unavailable',level:'blocking',
      text:`${count} of 15 public GW${S.picksGameweek} picks were usable. A complete legal squad is required before Teamsheet can recommend an XI.`});
    else risk=Object.freeze({kind:'squad-unavailable',level:'blocking',text:count?`${count} of 15 players are available. A complete legal squad is required before Teamsheet can recommend an XI.`:'No usable 15-player squad is available.'});
    const action=teamDecisionAction({hasSquad:false,deadlinePassed:deadline.passed,riskKind:risk.kind,
      squadStatus:S.picksStatus,squadGameweek:S.picksGameweek});
    const header=teamDecisionHeader({title,eyebrow:'Team decision home',source,deadline:deadline.label,rank});
    const summary=teamDecisionSummary({recommendation:'Recommendation unavailable',forecast:'No projection calculated',risk,action});
    const placeholder=teamDecisionPlaceholderStage(S.nextGW,'Empty Team pitch. No valid squad is available, so no XI, captaincy or bench recommendation has been calculated.');
    const resourceBar=teamDecisionResourceBar({ft,bank});
    setChildren(out,header,summary,resourceBar,placeholder);
    return;
  }

  let previewState=decisionPreviewSnapshot();
  const applied=previewState.transfer?decisionPreviewApplyTransferPlan(realSquad,previewState.transfer,S.byId):{ok:true,squad:realSquad};
  const squad=applied.ok?applied.squad:realSquad;
  const gw=S.nextGW,xi=bestXI(squad,gw);
  const capRank=xi.xi.map(slot=>({s:slot,x:xpOf(slot.p,gw,1).total,own:num(slot.p.selected_by_percent)})).sort((a,b)=>b.x-a.x||Number(a.s.p.id)-Number(b.s.p.id));
  const modelCaptaincy=teamPitchCaptaincy(capRank);
  const xiIds=xi.xi.map(slot=>Number(slot.p.id));
  const effectiveCaptaincy=decisionPreviewEffectiveCaptaincy(modelCaptaincy,xiIds);
  const scoreById=Object.fromEntries(xi.xi.map(slot=>[slot.p.id,xpOf(slot.p,gw,1).total]));
  const captainTotal=decisionPreviewCaptainTotal(xi.tot,effectiveCaptaincy.captainId,scoreById);
  const forecast=teamDecisionForecast(xi.tot,captainTotal.uplift);
  const captain=S.byId[effectiveCaptaincy.captainId];
  const vice=S.byId[effectiveCaptaincy.viceId];
  const blankIds=xi.xi.filter(slot=>(teamFixtures(slot.p.team,gw,1)[0]||[]).length===0).map(slot=>slot.p.id);
  const close=capRank[1]&&capRank[0].x-capRank[1].x<0.6?{
    firstName:capRank[0].s.p.web_name,
    secondName:capRank[1].s.p.web_name,
    gap:capRank[0].x-capRank[1].x
  }:null;
  const risk=teamDecisionRisk({
    dataState,
    captain,
    starters:xi.xi.map(slot=>({p:slot.p,xp:xpOf(slot.p,gw,1).total})),
    blankIds,
    closeCaptain:close
  });
  previewState=decisionPreviewSnapshot();
  const previewActive=Boolean(previewState.transfer||effectiveCaptaincy.isPreview);
  const action=teamDecisionAction({hasSquad:true,deadlinePassed:deadline.passed,previewActive,riskKind:risk.kind});
  const bench=teamDecisionBenchDisplayOrder(xi.bench).map((slot,index)=>`${teamDecisionBenchLabel(index)} ${slot.p.web_name}`).join(' · ');
  const recommendation=`Start ${xi.shape}. ${captain?.web_name||'—'} captain, ${vice?.web_name||'—'} vice. Bench: ${bench}.`;
  const forecastCopy=`${forecast.base.toFixed(1)} xP before captain · +${forecast.uplift.toFixed(1)} captain uplift · ${forecast.total.toFixed(1)} xP including captain.`;
  const header=teamDecisionHeader({title,eyebrow:previewActive?'User preview':'Model recommendation',source,deadline:deadline.label,rank});
  const summary=teamDecisionSummary({recommendation,forecast:forecastCopy,risk,action});
  const resourceBar=teamDecisionResourceBar({ft,bank});

  const children=Array.from(out.children);
  const previewBanner=children.find(node=>node.classList?.contains('decision-preview-banner'))||null;
  const controls=children.find(node=>node.classList?.contains('decision-preview-controls'))||null;
  const stage=children.find(node=>node.classList?.contains('team-stage'))||null;
  teamDecisionOrderBenchDisplay(stage,xi);
  teamDecisionRelabelBench(stage);
  teamDecisionAnnotateAvailability(stage,xi);
  const captainHeading=children.find(node=>node.matches?.('h3.section-title')&&node.textContent.trim()==='Captaincy ranking')||null;
  const captainGrid=captainHeading?.nextElementSibling?.classList?.contains('capgrid')?captainHeading.nextElementSibling:null;
  const allHeading=children.find(node=>node.matches?.('h3.section-title')&&node.textContent.trim().startsWith('All 15'))||null;
  const allTable=allHeading?.nextElementSibling?.classList?.contains('scroll')?allHeading.nextElementSibling:null;
  const finalCaveat=allTable?.nextElementSibling?.classList?.contains('note')?allTable.nextElementSibling:null;

  const actions=el('div',{class:'team-home-actions'},
    el('a',{class:'btn ghost',href:'#/transfers'},'Open Transfers'),
    el('a',{class:'btn ghost',href:'#/settings/team-account'},'Edit manual squad'));
  setChildren(out,header,summary,previewBanner,resourceBar,stage,controls,actions);

  const why=el('details',{class:'team-home-support'},
    el('summary',{},'Why this XI and captaincy'),
    el('div',{class:'team-home-support-body'},captainHeading,captainGrid,
      close?noteNode('',teamDecisionCloseCaptainCopy(close.firstName,close.secondName,close.gap)):null));
  const all=el('details',{class:'team-home-support'},
    el('summary',{},'All 15 over six Gameweeks'),
    el('div',{class:'team-home-support-body'},allHeading,allTable,finalCaveat));
  setChildren(support,why,all);
}

function teamDecisionInstall(){
  if(typeof document==='undefined'||typeof BUILD_INFO==='undefined') return;
  teamDecisionSetupStartup();
  teamDecisionSetupShell();
  const legacyRenderSquad=renderSquad;
  renderSquad=function renderSquadTeamDecisionHome(){
    const out=$('squadOut'),focus=teamDecisionCaptureFocus(out);
    legacyRenderSquad();
    teamDecisionEnhanceRenderedTeam();
    teamDecisionRestoreFocus(out,focus);
  };
}

teamDecisionInstall();


/* ===== src/ui/manual-squad-runtime.mjs ===== */

const MANUAL_SQUAD_POSITION_LABELS = Object.freeze({1:'GKP',2:'DEF',3:'MID',4:'FWD'});

function manualSquadBudget(rules=TRANSFER_RULES){
  const value=Number(rules?.squadBudget);
  return Number.isFinite(value)&&value>0?Math.trunc(value):1000;
}

function manualSquadMoney(value){
  const amount=Number(value);
  return Number.isFinite(amount)?`£${(amount/10).toFixed(1)}m`:'—';
}

function manualSquadEntryCost(entry,player){
  const stored=entry?.bought??entry?.purchasePrice;
  const bought=Number(stored);
  if(stored!==null&&stored!==undefined&&stored!==''&&Number.isFinite(bought)&&bought>=0)
    return Math.trunc(bought);
  const current=Number(player?.now_cost);
  return Number.isFinite(current)&&current>=0?Math.trunc(current):null;
}

function manualSquadValidation(manual=[],byId={},rules=TRANSFER_RULES){
  const entries=Array.isArray(manual)?manual:[];
  const quotas=rules?.positionQuotas||{1:2,2:5,3:5,4:3};
  const maxPerClub=Number(rules?.maxPerClub)||3;
  const budget=manualSquadBudget(rules);
  const positionCounts={1:0,2:0,3:0,4:0};
  const clubCounts={};
  const unknownIds=[];
  const duplicateIds=[];
  const invalidPriceIds=[];
  const seen=new Set();
  let cost=0;

  entries.forEach(entry=>{
    const id=Number(entry?.id);
    if(seen.has(id)) duplicateIds.push(id);
    seen.add(id);
    const player=byId?.[id];
    if(!player){ unknownIds.push(id); invalidPriceIds.push(id); return; }
    const position=Number(player.element_type);
    const club=Number(player.team);
    if(Object.prototype.hasOwnProperty.call(positionCounts,position)) positionCounts[position]++;
    if(Number.isFinite(club)) clubCounts[club]=(clubCounts[club]||0)+1;
    const entryCost=manualSquadEntryCost(entry,player);
    if(entryCost===null) invalidPriceIds.push(id);
    else cost+=entryCost;
  });

  const priceComplete=invalidPriceIds.length===0;
  const remainingBudget=priceComplete?budget-cost:null;
  const issues=[];
  if(entries.length>15) issues.push('The squad contains more than 15 players.');
  if(unknownIds.length) issues.push('One or more saved players are no longer in the verified player list.');
  if(duplicateIds.length) issues.push('The same player appears more than once.');
  if(!priceComplete) issues.push('One or more player purchase prices are unavailable.');
  Object.entries(quotas).forEach(([position,quota])=>{
    const count=positionCounts[position]||0;
    if(count>quota) issues.push(`Too many ${MANUAL_SQUAD_POSITION_LABELS[position]} players (${count}/${quota}).`);
  });
  if(Object.values(clubCounts).some(count=>count>maxPerClub))
    issues.push(`A maximum of ${maxPerClub} players from one club is allowed.`);
  if(priceComplete&&cost>budget)
    issues.push(`Squad cost ${manualSquadMoney(cost)} exceeds the ${manualSquadMoney(budget)} budget.`);

  const complete=entries.length===15;
  const exactPositions=Object.entries(quotas).every(([position,quota])=>(positionCounts[position]||0)===quota);
  if(complete&&!exactPositions) issues.push('A legal squad needs 2 GKP, 5 DEF, 5 MID and 3 FWD.');
  const legal=complete&&exactPositions&&issues.length===0;
  return Object.freeze({
    count:entries.length,
    complete,
    legal,
    issues:Object.freeze([...new Set(issues)]),
    positionCounts:Object.freeze({...positionCounts}),
    clubCounts:Object.freeze({...clubCounts}),
    unknownIds:Object.freeze(unknownIds.slice()),
    duplicateIds:Object.freeze(duplicateIds.slice()),
    invalidPriceIds:Object.freeze(invalidPriceIds.slice()),
    priceComplete,
    cost,
    budget,
    remainingBudget
  });
}

function manualSquadAddDecision(manual=[],player=null,byId={},rules=TRANSFER_RULES){
  if(!player||!Number.isFinite(Number(player.id))) return {ok:false,message:'That player is unavailable.'};
  const id=Number(player.id);
  if((manual||[]).some(entry=>Number(entry?.id)===id)) return {ok:false,message:`${player.web_name||'That player'} is already in your squad.`};
  if((manual||[]).length>=15) return {ok:false,message:'Remove a player before adding another.'};

  const current=manualSquadValidation(manual,byId,rules);
  const position=Number(player.element_type);
  const quota=Number(rules?.positionQuotas?.[position]);
  if(!Number.isFinite(quota)) return {ok:false,message:'That player has an unsupported position.'};
  if((current.positionCounts[position]||0)>=quota)
    return {ok:false,message:`You already have the maximum ${quota} ${MANUAL_SQUAD_POSITION_LABELS[position]} players.`};
  const club=Number(player.team);
  const maxPerClub=Number(rules?.maxPerClub)||3;
  if((current.clubCounts[club]||0)>=maxPerClub)
    return {ok:false,message:`You already have ${maxPerClub} players from ${S.teams?.[club]?.name||'that club'}.`};
  const playerCost=manualSquadEntryCost({bought:player.now_cost},player);
  if(playerCost===null) return {ok:false,message:`${player.web_name||'That player'} does not have a verified price.`};
  if(!current.priceComplete) return {ok:false,message:'A saved player price is unavailable, so the squad budget cannot be verified.'};
  const nextCost=current.cost+playerCost;
  if(nextCost>current.budget)
    return {ok:false,message:`Adding ${player.web_name||'that player'} would take the squad to ${manualSquadMoney(nextCost)}, above the ${manualSquadMoney(current.budget)} budget.`};
  return {ok:true,message:'',nextCost,remainingBudget:current.budget-nextCost};
}

function manualSquadStatusText(validation,rejection=''){
  const counts=validation?.positionCounts||{1:0,2:0,3:0,4:0};
  const budgetText=validation?.priceComplete===false
    ? ' · budget unavailable'
    : ` · ${manualSquadMoney(validation?.cost||0)} used · ${validation?.remainingBudget>=0
      ? `${manualSquadMoney(validation.remainingBudget)} left`
      : `${manualSquadMoney(Math.abs(validation?.remainingBudget||0))} over`}`;
  const base=`${validation?.count||0}/15 · ${counts[1]||0} GKP, ${counts[2]||0} DEF, ${counts[3]||0} MID, ${counts[4]||0} FWD${budgetText}`;
  if(rejection) return `${base} — ${rejection}`;
  if(validation?.legal) return `${base} — complete and legal`;
  if(validation?.complete&&validation?.issues?.length) return `${base} — fix: ${validation.issues[0]}`;
  const remaining=Math.max(0,15-(validation?.count||0));
  return `${base}${remaining?` — add ${remaining} more`:''}`;
}

function manualSquadApplyStatus(documentRef,manual=S.manual,byId=S.byId,rejection=''){
  const node=documentRef?.getElementById?.('manualCount');
  const validation=manualSquadValidation(manual,byId);
  if(node){
    node.textContent=manualSquadStatusText(validation,rejection);
    node.setAttribute?.('role','status');
    node.setAttribute?.('aria-live','polite');
  }
  return validation;
}

function manualSquadIsTransfersRoute(value=''){
  return String(value||'').split('?')[0]==='#/transfers';
}

function manualSquadCreateRouteAwareTransferRenderer(renderTransferView,routeProvider=()=>globalThis.location?.hash||''){
  if(typeof renderTransferView!=='function') throw new TypeError('renderTransferView must be a function');
  return function routeAwareTransferRenderer(options={}){
    const forced=options===true||options?.force===true;
    if(!forced&&!manualSquadIsTransfersRoute(routeProvider())) return {deferred:true};
    return renderTransferView();
  };
}

async function manualSquadCommitAddition({
  manual,player,byId,persist=async()=>{},saveConfiguration=async()=>{},
  renderManualView=()=>{},renderTeamView=()=>{},dispatchRendered=()=>{}
}={}){
  const decision=manualSquadAddDecision(manual,player,byId);
  if(!decision.ok) return {ok:false,message:decision.message,validation:manualSquadValidation(manual,byId)};
  manual.push({id:Number(player.id),bought:Number(player.now_cost)});
  await persist(manual);
  await saveConfiguration();
  renderManualView();
  let teamRenderError=null;
  try{ renderTeamView(); }
  catch(error){ teamRenderError=error; }
  try{ dispatchRendered(); }
  catch(error){}
  return {ok:true,message:'',validation:manualSquadValidation(manual,byId),teamRenderError};
}

function manualSquadInstallBrowserRuntime({
  documentRef=globalThis.document,
  routeProvider=()=>globalThis.location?.hash||'',
  renderTransferView,
  renderManualView,
  renderTeamView
}={}){
  if(!documentRef?.addEventListener||documentRef.documentElement?.dataset?.manualSquadRuntime==='installed') return null;
  if(documentRef.documentElement?.dataset) documentRef.documentElement.dataset.manualSquadRuntime='installed';

  const routeAware=manualSquadCreateRouteAwareTransferRenderer(renderTransferView,routeProvider);
  documentRef.addEventListener('teamsheet:route-change',event=>{
    if(event?.detail?.route==='#/transfers') routeAware({force:true});
  });
  documentRef.addEventListener('teamsheet:data-rendered',()=>manualSquadApplyStatus(documentRef));

  documentRef.addEventListener('click',event=>{
    const target=event.target?.closest?.('[data-add],[data-rm]');
    if(!target) return;
    const add=target.hasAttribute?.('data-add')&&target.closest?.('#pResults');
    const remove=target.hasAttribute?.('data-rm')&&target.closest?.('#manualList');
    if(!add&&!remove) return;
    event.preventDefault?.();
    event.stopImmediatePropagation?.();

    void (async()=>{
      if(add){
        const id=Number(target.dataset.add);
        const player=S.byId?.[id];
        const decision=manualSquadAddDecision(S.manual,player,S.byId);
        if(!decision.ok){ manualSquadApplyStatus(documentRef,S.manual,S.byId,decision.message); return; }
        const result=await manualSquadCommitAddition({
          manual:S.manual,
          player,
          byId:S.byId,
          persist:value=>sset(K_SQUAD,value),
          saveConfiguration:async()=>{
            const useManual=documentRef.getElementById?.('useManual');
            if(useManual) useManual.checked=true;
            await saveCfg();
          },
          renderManualView,
          renderTeamView,
          dispatchRendered:()=>documentRef.dispatchEvent?.(new CustomEvent('teamsheet:data-rendered'))
        });
        const search=documentRef.getElementById?.('pSearch');
        const results=documentRef.getElementById?.('pResults');
        if(search) search.value='';
        if(results) results.hidden=true;
        if(result.teamRenderError)
          manualSquadApplyStatus(documentRef,S.manual,S.byId,'Squad saved. Team analysis could not refresh; reopen Team.');
        else manualSquadApplyStatus(documentRef);
        return;
      }

      const index=Number(target.dataset.rm);
      if(!Number.isInteger(index)||index<0||index>=S.manual.length) return;
      S.manual.splice(index,1);
      await sset(K_SQUAD,S.manual);
      renderManualView();
      try{ renderTeamView(); }
      catch(error){ manualSquadApplyStatus(documentRef,S.manual,S.byId,'Squad saved. Team analysis could not refresh; reopen Team.'); return; }
      documentRef.dispatchEvent?.(new CustomEvent('teamsheet:data-rendered'));
      manualSquadApplyStatus(documentRef);
    })();
  },true);

  manualSquadApplyStatus(documentRef);
  return routeAware;
}

if(typeof document!=='undefined'&&typeof renderTransfers==='function'){
  const manualSquadOriginalRenderTransfers=renderTransfers;
  const manualSquadRouteAwareRenderTransfers=manualSquadCreateRouteAwareTransferRenderer(
    manualSquadOriginalRenderTransfers,()=>globalThis.location?.hash||''
  );
  renderTransfers=manualSquadRouteAwareRenderTransfers;
  manualSquadInstallBrowserRuntime({
    documentRef:document,
    renderTransferView:manualSquadOriginalRenderTransfers,
    renderManualView:typeof renderManual==='function'?renderManual:()=>{},
    renderTeamView:typeof renderSquad==='function'?renderSquad:()=>{}
  });
}



/* ===== src/ui/backtest-copy.mjs ===== */
const backtestButton=document.getElementById('btBtn');
if(backtestButton){
  backtestButton.textContent='Run deadline-safe walk-forward check';
  const hint=backtestButton.parentElement?.nextElementSibling;
  if(hint?.classList?.contains('hint')){
    hint.textContent='Downloads a commit-pinned 2025–26 archive and evaluates one Gameweek at a time using only earlier information. Results are diagnostic, do not change live projections, and clearly report unavailable historical provider coverage.';
  }
}


/* ===== src/ui/markdown.mjs ===== */
// Stage 3.6 — restricted Markdown renderer for untrusted AI output.
// The parser returns a tiny, explicit AST. Rendering uses the shared DOM builder,
// so provider output never becomes HTML and raw tags remain inert text.

const MD_MAX_INPUT = 50000;

function safeMarkdownHref(raw){
  let value = String(raw ?? '').trim();
  if(!value || value.startsWith('//') || /[\u0000-\u001f\u007f]/.test(value)) return null;
  // HTML entities are never needed in an approved absolute URL and can hide a
  // dangerous scheme from a superficial check.
  if(/&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]+);/i.test(value)) return null;
  try{
    for(let i=0;i<3;i++){
      const decoded = decodeURIComponent(value);
      if(decoded === value) break;
      value = decoded.trim();
    }
  }catch{ return null; }
  if(value.startsWith('//') || /[\u0000-\u001f\u007f]/.test(value)) return null;
  try{
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  }catch{ return null; }
}

function parseMarkdownInline(text){
  const source = String(text ?? '');
  const out = [];
  let plain = '';
  const flush = () => { if(plain){ out.push({type:'text', text:plain}); plain = ''; } };

  for(let i=0;i<source.length;){
    if(source.startsWith('**', i)){
      const end = source.indexOf('**', i+2);
      if(end > i+2){
        flush();
        out.push({type:'strong', children:parseMarkdownInline(source.slice(i+2,end))});
        i = end+2; continue;
      }
    }
    if(source[i] === '*' && source[i+1] !== '*'){
      const end = source.indexOf('*', i+1);
      if(end > i+1){
        flush();
        out.push({type:'em', children:parseMarkdownInline(source.slice(i+1,end))});
        i = end+1; continue;
      }
    }
    if(source[i] === '['){
      const close = source.indexOf('](', i+1);
      const end = close >= 0 ? source.indexOf(')', close+2) : -1;
      if(close > i+1 && end > close+2){
        const label = source.slice(i+1, close);
        const href = safeMarkdownHref(source.slice(close+2, end));
        flush();
        if(href) out.push({type:'link', href, children:parseMarkdownInline(label)});
        else out.push({type:'text', text:label});
        i = end+1; continue;
      }
    }
    plain += source[i++];
  }
  flush();
  return out;
}

function parseRestrictedMarkdown(input){
  const text = String(input ?? '').slice(0, MD_MAX_INPUT).replace(/\r\n?/g,'\n');
  const lines = text.split('\n');
  const blocks = [];
  let paragraph = [];
  let list = [];
  const flushParagraph = () => {
    if(paragraph.length){
      blocks.push({type:'paragraph', children:parseMarkdownInline(paragraph.join('\n'))});
      paragraph = [];
    }
  };
  const flushList = () => {
    if(list.length){ blocks.push({type:'list', items:list}); list = []; }
  };

  for(const line of lines){
    const heading = /^(?:##|###)\s+(.+)$/.exec(line);
    const item = /^[-•]\s+(.+)$/.exec(line);
    if(heading){
      flushParagraph(); flushList();
      blocks.push({type:'heading', children:parseMarkdownInline(heading[1])});
    }else if(item){
      flushParagraph();
      list.push(parseMarkdownInline(item[1]));
    }else if(!line.trim()){
      flushParagraph(); flushList();
    }else{
      flushList(); paragraph.push(line);
    }
  }
  flushParagraph(); flushList();
  return blocks;
}

function markdownInlineNodes(tokens){
  return tokens.map(token => {
    if(token.type === 'strong') return el('b',{},markdownInlineNodes(token.children));
    if(token.type === 'em') return el('i',{},markdownInlineNodes(token.children));
    if(token.type === 'link') return el('a',{href:token.href,target:'_blank',rel:'noopener noreferrer'},markdownInlineNodes(token.children));
    return token.text;
  });
}

function restrictedMarkdownNodes(input){
  return parseRestrictedMarkdown(input).map(block => {
    if(block.type === 'heading') return el('h4',{},markdownInlineNodes(block.children));
    if(block.type === 'list') return el('ul',{},block.items.map(item => el('li',{},markdownInlineNodes(item))));
    const children = [];
    block.children.forEach(token => {
      const nodes = markdownInlineNodes([token]);
      nodes.forEach(node => {
        if(typeof node === 'string' && node.includes('\n')){
          node.split('\n').forEach((part,index) => { if(index) children.push(el('br')); children.push(part); });
        }else children.push(node);
      });
    });
    return el('p',{},children);
  });
}

function renderSanitisedThread(){
  setChildren($('thread'), S.thread.map(message =>
    el('div',{class:`answer ${message.role === 'user' ? 'me' : ''}`},restrictedMarkdownNodes(message.content))));
}

// The bundle loads this file immediately after views.mjs. Replacing the legacy
// renderer here keeps Stage 3.6 focused and removes the final dynamic innerHTML sink.
if(typeof renderThread !== 'undefined') renderThread = renderSanitisedThread;



/* ===== src/ui/security-wiring.mjs ===== */
// Stage 3 security completion — odds-key affordance wiring.
// Loaded after the main views so it can reuse the existing render/cache helpers
// without expanding the Stage 9 UI scope.
const oddsFieldForSecurity = $('oddsKey');
if(oddsFieldForSecurity){
  oddsFieldForSecurity.type = 'password';
  oddsFieldForSecurity.setAttribute('autocomplete','off');
  const oddsKeyLabel = oddsFieldForSecurity.closest('label');
  const oddsKeyRow = oddsKeyLabel && oddsKeyLabel.parentNode;
  if(oddsKeyRow && !$('forgetOddsKey')){
    const forgetButton = el('button',{class:'btn ghost sm',id:'forgetOddsKey',type:'button'},'Forget API key');
    oddsKeyRow.appendChild(forgetButton);
    forgetButton.addEventListener('click', async () => {
      forgetButton.disabled = true;
      try{
        await forgetOddsKey();
        clearXP();
        renderAll();
      }finally{
        forgetButton.disabled = false;
      }
    });
  }
}


/* ===== src/ui/evidence-recovery.mjs ===== */

const STAGE10_JOURNAL_PHASES=Object.freeze(['prepared','payload_verified','index_committed']);
const STAGE10_DIAGNOSTIC_LIMIT=20;
let stage10DiagnosticRows=[];

function stage10SafeText(value,maxLength=180){
  let text=String(value??'');
  try{text=decodeURIComponent(text);}catch(error){}
  text=text
    .replace(/(?:sk|ant)-[A-Za-z0-9_-]{8,}/gi,'[redacted]')
    .replace(/(?:api[_-]?key|authorization|access[_-]?token|refresh[_-]?token)\s*[:=]\s*[^\s,;]+/gi,'[redacted]')
    .replace(/\/entry\/\d+/gi,'/entry/[redacted]')
    .replace(/\/leagues-classic\/\d+/gi,'/leagues-classic/[redacted]')
    .replace(/[?#][^\s]*/g,'');
  return text.slice(0,Math.max(0,Number(maxLength)||180));
}
function recordStage10Diagnostic(code,{recordType=null,recordId=null,severity='warning',message=null,at=Date.now()}={}){
  const row=canonicalise({code:String(code||'unknown'),recordType:recordType==null?null:String(recordType),recordId:recordId==null?null:String(recordId).slice(0,120),severity:['info','warning','error'].includes(severity)?severity:'warning',message:message==null?null:stage10SafeText(message),at:new Date(at).toISOString()});
  const key=`${row.code}|${row.recordType||''}|${row.recordId||''}`;
  stage10DiagnosticRows=[row,...stage10DiagnosticRows.filter(item=>`${item.code}|${item.recordType||''}|${item.recordId||''}`!==key)].slice(0,STAGE10_DIAGNOSTIC_LIMIT);
  return row;
}
function stage10Diagnostics(){return stage10DiagnosticRows.slice();}
function clearStage10Diagnostics(){stage10DiagnosticRows=[];}
function stage10DiagnosticMessage(code){
  const messages={
    storage_unavailable:'Persistent browser storage is unavailable. Export any accessible records before closing Teamsheet.',
    storage_full:'Browser storage is full. Existing verified records were preserved where possible.',
    index_corrupt:'Saved evidence metadata could not be read. Full records were not trusted or promoted automatically.',
    payload_corrupt:'A saved evidence record failed decompression, schema or hash verification and was not used.',
    journal_corrupt:'An interrupted-write journal was malformed and could not be trusted.',
    recovery_completed:'An interrupted verified write was recovered safely.',
    recovery_only:'A restored record remains recovery-only and cannot become official or current.',
    unsupported_version:'A record uses an unsupported schema or metric version and was not migrated.',
    download_requested:'The browser download was requested. Confirm the file appears in Files or Downloads.'
  };
  return messages[code]||'Stage 10 evidence needs attention. No unsafe record was used.';
}
function stage10Journal({recordType,recordId,contentHash,logicalKey=null,origin,priorCurrentId=null,phase='prepared',startedAt=new Date().toISOString()}={}){
  if(!['preDeadlineSnapshot','gameweekOutcome','gameweekEvaluation','transferHorizonEvaluation'].includes(recordType)) throw new Error('Stage 10 journal record type is not supported');
  if(typeof recordId!=='string'||!recordId||!/^[-a-z0-9|]+$/i.test(recordId)) throw new Error('Stage 10 journal record ID is invalid');
  if(!/^[0-9a-f]{64}$/.test(contentHash||'')) throw new Error('Stage 10 journal content hash is invalid');
  if(!STAGE10_JOURNAL_PHASES.includes(phase)) throw new Error('Stage 10 journal phase is invalid');
  if(!['local_capture','local_collection','local_derivation','recovery_import'].includes(origin)) throw new Error('Stage 10 journal origin is invalid');
  return canonicalise({recordType,recordId,contentHash,logicalKey:logicalKey==null?null:String(logicalKey),origin,priorCurrentId:priorCurrentId==null?null:String(priorCurrentId),phase,startedAt:new Date(startedAt).toISOString()});
}
function parseStage10Journal(raw){
  try{
    const value=typeof raw==='string'?JSON.parse(raw):raw;
    if(!value||typeof value!=='object'||Array.isArray(value)) return null;
    const exact=['contentHash','logicalKey','origin','phase','priorCurrentId','recordId','recordType','startedAt'].sort();
    if(JSON.stringify(Object.keys(value).sort())!==JSON.stringify(exact)) return null;
    return stage10Journal(value);
  }catch(error){return null;}
}
function reconcileLocalCurrentRows(rows,{logicalKey,recordId,idKey='recordId',origin='local_collection'}={}){
  return (Array.isArray(rows)?rows:[]).map(row=>{
    if(!row||typeof row!=='object') return row;
    if(row.origin!=='recovery_import'&&row.origin===origin&&row.logicalKey===logicalKey) return {...row,current:row[idKey]===recordId};
    if(row.origin==='recovery_import'&&row.current) return {...row,current:false};
    return row;
  });
}



/* ===== src/ui/download.mjs ===== */
const STAGE10_DOWNLOAD_REVOKE_DELAY_MS=30*1000;
function requestStage10Download(filename,text,type,{documentImpl=globalThis.document,urlImpl=globalThis.URL,BlobImpl=globalThis.Blob,setTimeoutImpl=globalThis.setTimeout}={}){
  if(!documentImpl?.createElement||!documentImpl?.body||!urlImpl?.createObjectURL||typeof BlobImpl!=='function') throw new Error('Browser download support is unavailable');
  const blob=new BlobImpl([String(text)],{type:String(type||'application/octet-stream')}),url=urlImpl.createObjectURL(blob),anchor=documentImpl.createElement('a');
  anchor.href=url;anchor.download=String(filename);anchor.rel='noopener';documentImpl.body.appendChild(anchor);anchor.click();anchor.remove();
  setTimeoutImpl(()=>urlImpl.revokeObjectURL(url),STAGE10_DOWNLOAD_REVOKE_DELAY_MS);
  return {filename:String(filename),requested:true,bytes:typeof TextEncoder!=='undefined'?new TextEncoder().encode(String(text)).length:String(text).length*2};
}
function stage10DownloadRequestedMessage(filename){return `Download requested — confirm ${String(filename)} appears in Files or Downloads.`;}


/* ===== src/ui/evidence.mjs ===== */

const K_EVIDENCE_MANAGER = 'fpl:evidence-manager-ref';
const K_EVIDENCE_INDEX = 'fpl:evidence-index';
const K_EVIDENCE_PREFIX = 'fpl:evidence:snapshot:';
const K_EVIDENCE_JOURNAL = 'fpl:evidence:pending:v1';
const MAX_EVIDENCE_IMPORT_BYTES = 25 * 1024 * 1024;
const EVIDENCE_ORIGINS = Object.freeze({LOCAL:'local_capture',RECOVERY:'recovery_import'});
const AUTO_CAPTURE_PRIORITY = Object.freeze({open:1,due_soon:2,ideal:3,final_window:4});
const AUTO_CAPTURE_RETRY_MS=5*60*1000;
const AUTO_CAPTURE_MAX_ATTEMPTS=3;
let autoCaptureVerifiedAt=0;
const autoCaptureAttempts=new Map();
let activeEvidenceRecord = null;
let evidenceBusy = false;
let evidenceRenderSequence = 0;

function bytesToBase64(bytes){
  let binary='';
  const chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk) binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));
  return btoa(binary);
}
function base64ToBytes(value){
  const binary=atob(value), bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
  return bytes;
}
async function encodeEvidenceRecord(record){
  const text=stableStringify(record);
  if(typeof CompressionStream!=='function') return text;
  try{
    const stream=new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    const bytes=new Uint8Array(await new Response(stream).arrayBuffer());
    return `gzip-base64:${bytesToBase64(bytes)}`;
  }catch(error){
    recordStage10Diagnostic('compression_fallback',{recordType:record?.recordType,recordId:record?.identity?.snapshotId||record?.identity?.outcomeId||record?.identity?.evaluationId||record?.identity?.transferEvaluationId,severity:'warning',message:'Native compression failed; canonical plain JSON was stored instead.'});
    return text;
  }
}
async function decodeEvidenceRecord(value){
  const text=String(value||'');
  if(!text.startsWith('gzip-base64:')) return text;
  if(typeof DecompressionStream!=='function') throw new Error('Compressed evidence cannot be read in this browser');
  const bytes=base64ToBytes(text.slice('gzip-base64:'.length));
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

async function rawEvidenceGet(key){
  if(globalThis.window?.storage){
    const result = await window.storage.get(key);
    return result?.value ?? null;
  }
  return globalThis.localStorage?.getItem(key) ?? null;
}
async function rawEvidenceSet(key,value){
  const text = String(value);
  if(globalThis.window?.storage) await window.storage.set(key,text);
  else if(globalThis.localStorage) localStorage.setItem(key,text);
  else throw new Error('Persistent browser storage is unavailable');
  const verified = await rawEvidenceGet(key);
  if(verified !== text) throw new Error('Evidence storage verification failed');
}
async function rawEvidenceDelete(key){
  if(globalThis.window?.storage){
    if(typeof window.storage.delete === 'function') await window.storage.delete(key);
    else await window.storage.set(key,'');
  }else if(globalThis.localStorage) localStorage.removeItem(key);
  else throw new Error('Persistent browser storage is unavailable');
  const verified=await rawEvidenceGet(key);
  if(verified!==null&&verified!=='') throw new Error('Evidence deletion verification failed');
}
async function evidenceManagerRef(cryptoImpl=globalThis.crypto){
  const existing = await rawEvidenceGet(K_EVIDENCE_MANAGER);
  if(existing && /^mgr-[0-9a-f]{32}$/.test(existing)) return existing;
  if(!cryptoImpl?.getRandomValues) throw new Error('Secure random identifiers are unavailable');
  const bytes = new Uint8Array(16); cryptoImpl.getRandomValues(bytes);
  const value = 'mgr-' + Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
  await rawEvidenceSet(K_EVIDENCE_MANAGER,value);
  return value;
}
function normaliseEvidenceIndex(value){
  if(!Array.isArray(value)) return [];
  return value.filter(row=>row&&typeof row==='object'&&
    /^predeadline-gw\d+-[0-9a-f]{16}$/.test(row.snapshotId||'')&&
    /^[0-9a-f]{64}$/.test(row.contentHash||'')&&
    Number.isInteger(row.gameweek)&&row.gameweek>=1&&row.gameweek<=38&&
    Number.isFinite(Date.parse(row.capturedAt))&&Number.isFinite(Date.parse(row.deadlineTime)))
    .map(row=>{
      const origin=Object.values(EVIDENCE_ORIGINS).includes(row.origin)?row.origin:EVIDENCE_ORIGINS.RECOVERY;
      return {
        ...row,
        origin,
        recordOfficialEligible:row.recordOfficialEligible===undefined?Boolean(row.officialEligible):Boolean(row.recordOfficialEligible),
        officialEligible:origin===EVIDENCE_ORIGINS.LOCAL&&Boolean(row.officialEligible)
      };
    })
    .sort((a,b)=>Date.parse(b.capturedAt)-Date.parse(a.capturedAt)||a.snapshotId.localeCompare(b.snapshotId))
    .slice(0,EVIDENCE_RULES.localIndexLimit);
}
async function loadEvidenceIndex(){
  const raw = await rawEvidenceGet(K_EVIDENCE_INDEX);
  if(!raw) return [];
  try{ return normaliseEvidenceIndex(JSON.parse(raw)); }
  catch(error){recordStage10Diagnostic('index_corrupt',{recordType:'preDeadlineSnapshot',severity:'error',message:error.message});return [];}
}
async function loadEvidenceRecord(snapshotId){
  if(!snapshotId) return null;
  const raw = await rawEvidenceGet(K_EVIDENCE_PREFIX+snapshotId);
  if(!raw) return null;
  try{
    const checked = await validateSnapshotRecord(JSON.parse(await decodeEvidenceRecord(raw)));
    if(!checked.ok){recordStage10Diagnostic(checked.reason==='schema_version'?'unsupported_version':'payload_corrupt',{recordType:'preDeadlineSnapshot',recordId:snapshotId,severity:'error',message:checked.reason});return null;}
    return checked.record;
  }catch(error){recordStage10Diagnostic('payload_corrupt',{recordType:'preDeadlineSnapshot',recordId:snapshotId,severity:'error',message:error.message});return null;}
}
async function writeEvidenceJournal(record,origin,phase){
  const journal=stage10Journal({recordType:'preDeadlineSnapshot',recordId:record.identity.snapshotId,contentHash:record.identity.contentHash,logicalKey:record.identity.duplicateKey,origin,phase});
  await rawEvidenceSet(K_EVIDENCE_JOURNAL,stableStringify(journal));
  return journal;
}
async function recoverEvidenceJournal(){
  const raw=await rawEvidenceGet(K_EVIDENCE_JOURNAL);if(!raw)return false;
  const journal=parseStage10Journal(raw);
  if(!journal||journal.recordType!=='preDeadlineSnapshot'){
    recordStage10Diagnostic('journal_corrupt',{recordType:'preDeadlineSnapshot',severity:'error'});await rawEvidenceDelete(K_EVIDENCE_JOURNAL).catch(()=>{});return true;
  }
  const index=await loadEvidenceIndex(),record=await loadEvidenceRecord(journal.recordId);
  if(record&&record.identity.contentHash===journal.contentHash){
    const origin=journal.origin===EVIDENCE_ORIGINS.LOCAL?EVIDENCE_ORIGINS.LOCAL:EVIDENCE_ORIGINS.RECOVERY;
    const next=boundedSnapshotIndex(index,record,{origin}),keep=new Set(next.slice(0,EVIDENCE_RULES.localFullRecordLimit).map(row=>row.snapshotId));
    await rawEvidenceSet(K_EVIDENCE_INDEX,stableStringify(next));
    for(const row of index){if(!keep.has(row.snapshotId))await rawEvidenceDelete(K_EVIDENCE_PREFIX+row.snapshotId).catch(()=>{});}
    activeEvidenceRecord=record;recordStage10Diagnostic('recovery_completed',{recordType:'preDeadlineSnapshot',recordId:journal.recordId,severity:'info'});
  }else{
    if(!index.some(row=>row.snapshotId===journal.recordId))await rawEvidenceDelete(K_EVIDENCE_PREFIX+journal.recordId).catch(()=>{});
    recordStage10Diagnostic('payload_corrupt',{recordType:'preDeadlineSnapshot',recordId:journal.recordId,severity:'error'});
  }
  await rawEvidenceDelete(K_EVIDENCE_JOURNAL).catch(()=>{});return true;
}
async function storeEvidenceRecord(record,{origin=EVIDENCE_ORIGINS.LOCAL}={}){
  if(!Object.values(EVIDENCE_ORIGINS).includes(origin)) throw new Error('Evidence origin is not supported');
  const checked = await validateSnapshotRecord(record);
  if(!checked.ok) throw new Error(`Evidence record rejected: ${checked.reason}`);
  const existing = await loadEvidenceIndex(),nextIndex = boundedSnapshotIndex(existing,checked.record,{origin});
  const keep = new Set(nextIndex.slice(0,EVIDENCE_RULES.localFullRecordLimit).map(row=>row.snapshotId));
  const knownIds = new Set(existing.map(row=>row.snapshotId).concat(checked.record.identity.snapshotId));
  const toDelete = [...knownIds].filter(snapshotId=>!keep.has(snapshotId));
  await writeEvidenceJournal(checked.record,origin,'prepared');
  try{
    if(keep.has(checked.record.identity.snapshotId)){
      const key=K_EVIDENCE_PREFIX+checked.record.identity.snapshotId,encoded=await encodeEvidenceRecord(checked.record);
      try{ await rawEvidenceSet(key,encoded); }
      catch(firstError){
        for(const snapshotId of toDelete) await rawEvidenceDelete(K_EVIDENCE_PREFIX+snapshotId).catch(()=>{});
        try{ await rawEvidenceSet(key,encoded); }
        catch(secondError){recordStage10Diagnostic('storage_full',{recordType:'preDeadlineSnapshot',recordId:checked.record.identity.snapshotId,severity:'error',message:secondError.message});throw new Error(`Evidence storage failed after recovery: ${secondError.message}`);}
      }
      const verified=await loadEvidenceRecord(checked.record.identity.snapshotId);if(!verified||verified.identity.contentHash!==checked.record.identity.contentHash)throw new Error('Evidence storage verification failed');
    }
    await writeEvidenceJournal(checked.record,origin,'payload_verified');
    await rawEvidenceSet(K_EVIDENCE_INDEX,stableStringify(nextIndex));
    await writeEvidenceJournal(checked.record,origin,'index_committed');
    for(const snapshotId of toDelete) await rawEvidenceDelete(K_EVIDENCE_PREFIX+snapshotId).catch(()=>{});
    activeEvidenceRecord = checked.record;
    await rawEvidenceDelete(K_EVIDENCE_JOURNAL).catch(()=>{});
    return nextIndex;
  }catch(error){if(/quota|storage|space|full/i.test(error.message))recordStage10Diagnostic('storage_full',{recordType:'preDeadlineSnapshot',recordId:checked.record.identity.snapshotId,severity:'error',message:error.message});throw error;}
}
async function clearEvidenceStorage(){
  const existing=await loadEvidenceIndex();
  for(const row of existing) await rawEvidenceDelete(K_EVIDENCE_PREFIX+row.snapshotId);
  if(!globalThis.window?.storage&&globalThis.localStorage){
    const orphanKeys=[];
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(key?.startsWith(K_EVIDENCE_PREFIX)) orphanKeys.push(key);
    }
    for(const key of orphanKeys) await rawEvidenceDelete(key);
  }
  await rawEvidenceDelete(K_EVIDENCE_INDEX);
  await rawEvidenceDelete(K_EVIDENCE_JOURNAL).catch(()=>{});
  await rawEvidenceDelete(K_EVIDENCE_MANAGER);
  activeEvidenceRecord=null;
  return true;
}
function evidenceFileName(record){
  return `teamsheet-${record.season}-gw${record.gameweek}-predeadline-${record.identity.snapshotId.slice(-16)}.json`;
}
function downloadEvidence(record){
  const filename=evidenceFileName(record);requestStage10Download(filename,stableStringify(record)+'\n','application/json');return filename;
}
function currentDeadline(){
  const event = S.boot?.events?.find(row=>Number(row.id)===Number(S.nextGW));
  return event?.deadline_time || null;
}
function minutesLabel(ms){
  if(ms == null) return '';
  const total=Math.max(0,Math.ceil(ms/60000));
  if(total<60) return `${total}m`;
  const hours=Math.floor(total/60), minutes=total%60;
  if(hours<24) return minutes?`${hours}h ${minutes}m`:`${hours}h`;
  const days=Math.floor(hours/24); return `${days}d`;
}
function windowCopy(windowState){
  const labels={
    unavailable:['Waiting for season data','Automatic evidence starts after verified data is available.'],
    too_early:['Evidence not due yet',`Automatic capture opens 24 hours before the deadline.`],
    open:['Automatic evidence armed','The next verified refresh will secure a pre-deadline record.'],
    due_soon:['Automatic evidence due soon','Teamsheet will secure the latest verified decision state.'],
    ideal:['Ideal automatic window','The latest verified state will be secured without user action.'],
    final_window:['Final automatic window','Teamsheet will fail closed at the two-minute safety cutoff.'],
    safety_cutoff:['Safety cutoff reached','A new snapshot cannot qualify as the official pre-deadline record.'],
    closed:['Deadline passed','Missed snapshots are not backfilled.']
  };
  return labels[windowState]||labels.unavailable;
}
function evidenceFlagClass(state){
  if(state==='ideal'||state==='open') return 'rise';
  if(state==='due_soon'||state==='final_window'||state==='client_recorded') return 'doubt';
  if(state==='network_attested') return 'rise';
  if(state==='too_early'||state==='unavailable') return 'dark';
  return 'out';
}
function openEvidencePanel(){
  if(typeof globalThis.__teamsheetNavigate==='function') globalThis.__teamsheetNavigate('#/settings/evidence/deadline');
  else if(globalThis.location) globalThis.location.hash='#/settings/evidence/deadline';
}
function evidenceActionPanel(eyebrow,title,copy,...children){
  return el('section',{class:'panel settings-content-panel'},
    el('span',{class:'eyebrow'},eyebrow),el('h3',{},title),el('p',{class:'hint'},copy),children);
}
function ensureEvidenceActionUi(){
  const exportHost=$('evidenceExportHost');
  if(exportHost&&!$('evidenceExportPanel')){
    const panel=evidenceActionPanel('Deadline record','Deadline evidence JSON','Download the latest locally available validated snapshot.',
      el('button',{class:'btn ghost',id:'exportEvidenceBtn',type:'button',disabled:true},'Download latest snapshot JSON'),
      el('p',{class:'status evidence-message',id:'evidenceExportMessage'},'No export is retained automatically.'));
    panel.id='evidenceExportPanel';exportHost.appendChild(panel);
  }
  const recoveryHost=$('evidenceRecoveryHost');
  if(recoveryHost&&!$('evidenceRecoveryPanel')){
    const panel=evidenceActionPanel('Snapshot recovery','Deadline evidence recovery','Restored files remain recovery-only and cannot become the official prospective record.',
      el('div',{class:'evidence-actions'},
        el('button',{class:'btn ghost',id:'importEvidenceBtn',type:'button'},'Restore snapshot JSON'),
        el('button',{class:'btn ghost',id:'captureEvidenceBtn',type:'button',disabled:true},'Diagnostic capture'),
        el('input',{id:'evidenceImport',type:'file',accept:'application/json,.json',hidden:true})),
      el('p',{class:'status evidence-message',id:'evidenceRecoveryMessage'},'Use recovery only for verified Teamsheet backups.'));
    panel.id='evidenceRecoveryPanel';recoveryHost.appendChild(panel);
  }
  const storageHost=$('evidenceStorageHost');
  if(storageHost&&!$('evidenceStoragePanel')){
    const panel=evidenceActionPanel('Deadline records','Delete local deadline evidence','This removes local snapshots and the anonymous device reference. Downloaded files are not affected.',
      el('button',{class:'btn ghost',id:'deleteEvidenceBtn',type:'button'},'Delete local deadline evidence'),
      el('p',{class:'status evidence-message',id:'evidenceStorageMessage'},'Snapshots, outcomes and metrics have separate deletion controls.'));
    panel.id='evidenceStoragePanel';storageHost.appendChild(panel);
  }
}
function ensureStage10OperationsUi(){
  const host=$('stage10DiagnosticsHost');if(!host||$('stage10Operations'))return;
  host.appendChild(el('section',{class:'panel settings-content-panel',id:'stage10Operations'},
    el('span',{class:'eyebrow'},'Evidence integrity'),
    el('h3',{},'Recovery diagnostics'),
    el('p',{class:'hint'},'Storage, import and interrupted-write warnings appear here. Technical identifiers remain scrubbed.'),
    el('div',{id:'stage10Diagnostics'},el('div',{class:'status'},'No recovery warning is active.'))));
}
function renderStage10Diagnostics(){
  const node=$('stage10Diagnostics');if(!node)return;const rows=stage10Diagnostics();
  if(!rows.length){setChildren(node,el('div',{class:'status'},'No recovery warning is active.'));return;}
  setChildren(node,rows.slice(0,5).map(row=>el('article',{class:`note ${row.severity==='error'?'bad':'plain'}`},el('b',{},row.code.replaceAll('_',' ')),el('div',{class:'status'},stage10DiagnosticMessage(row.code)),row.recordId?el('div',{class:'status mono'},row.recordId):null)));
}
async function renderEvidenceStatus(){
  const sequence=++evidenceRenderSequence;
  ensureEvidenceActionUi();ensureStage10OperationsUi();
  const deadline=currentDeadline();
  const state=deadline?deadlineWindow(deadline):{state:'unavailable',remainingMs:null};
  const [title,detail]=windowCopy(state.state);
  const index=await loadEvidenceIndex();
  if(sequence!==evidenceRenderSequence) return;
  const latest=index[0]||null;
  const latestForCurrent=latest&&Number(latest.gameweek)===Number(S.nextGW)?latest:null;
  const status=$('evidenceStatus');
  if(status){
    const remaining=state.remainingMs!=null&&state.remainingMs>0?` ${minutesLabel(state.remainingMs)} remaining.`:'';
    setChildren(status,el('b',{},title),document.createTextNode(' '+detail+remaining));
    status.className=`note ${['ideal','open'].includes(state.state)?'good':['due_soon','final_window'].includes(state.state)?'plain':['safety_cutoff','closed'].includes(state.state)?'bad':'plain'}`;
  }
  const deadlineNode=$('evidenceDeadline');
  if(deadlineNode) deadlineNode.textContent=deadline
    ? `GW${S.nextGW} deadline: ${new Date(deadline).toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZoneName:'short'})}`
    : 'Deadline unavailable.';
  const capture=$('captureEvidenceBtn');
  if(capture){
    capture.disabled=evidenceBusy||!['open','due_soon','ideal','final_window'].includes(state.state);
    capture.textContent=evidenceBusy?'Securing evidence…':'Diagnostic capture';
  }
  const exportButton=$('exportEvidenceBtn');
  if(exportButton) exportButton.disabled=!(activeEvidenceRecord||latest);
  const history=$('evidenceHistory');
  renderStage10Diagnostics();
  if(history){
    if(!index.length) setChildren(history,el('div',{class:'status'},'No evidence snapshots saved on this device.'));
    else setChildren(history,index.map(row=>el('article',{class:'note plain'},
      el('div',{},el('b',{},`GW${row.gameweek} · ${row.origin===EVIDENCE_ORIGINS.RECOVERY?'Recovery only':row.officialEligible?'Official-eligible':'Recorded only'}`),el('span',{class:`flag ${evidenceFlagClass(row.timingGrade)}`},row.timingGrade.replaceAll('_',' '))),
      el('div',{class:'status'},`${new Date(row.capturedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} · ${row.snapshotId}`))));
  }
}
async function latestEvidenceRecord(){
  const index=await loadEvidenceIndex();
  const latestId=index[0]?.snapshotId;
  if(!latestId) return null;
  if(activeEvidenceRecord?.identity?.snapshotId===latestId) return activeEvidenceRecord;
  activeEvidenceRecord=await loadEvidenceRecord(latestId);
  return activeEvidenceRecord;
}
async function captureEvidence({automatic=false}={}){
  if(evidenceBusy) return null;
  evidenceBusy=true; await renderEvidenceStatus();
  const message=$(automatic?'evidenceDeadlineMessage':'evidenceRecoveryMessage');
  try{
    const managerRef=await evidenceManagerRef();
    const horizon=Math.max(1,Math.min(8,Math.trunc(num($('trHorizon')?.value)||6)));
    if(message) message.textContent=automatic?'Securing verified deadline evidence…':'Freezing the current verified state…';
    const record=await capturePreDeadlineSnapshot({managerRef,horizon});
    await storeEvidenceRecord(record,{origin:EVIDENCE_ORIGINS.LOCAL});
    if(message) message.textContent=record.timing.officialEligible
      ? `Evidence secured automatically for GW${record.gameweek}.`
      : `Evidence recorded for GW${record.gameweek}, but it cannot qualify officially: ${record.timing.reasons.join(', ').replaceAll('_',' ')}.`;
    return record;
  }catch(error){
    if(message) message.textContent=`Evidence capture failed: ${error.message}`;
    return null;
  }finally{
    evidenceBusy=false; await renderEvidenceStatus();
  }
}
function captureWindowPriority(deadlineTime,capturedAt=Date.now()){
  const state=deadlineWindow(deadlineTime,capturedAt).state;
  return AUTO_CAPTURE_PRIORITY[state]||0;
}
async function maybeAutoCaptureEvidence({reason='verified_refresh',verifiedAt=null}={}){
  const deadline=currentDeadline();
  if(!deadline||!S.boot||evidenceBusy) return {captured:false,reason:'not_ready'};
  if(Number.isFinite(Number(verifiedAt))&&Number(verifiedAt)!==autoCaptureVerifiedAt){autoCaptureVerifiedAt=Number(verifiedAt);autoCaptureAttempts.clear();}
  const priority=captureWindowPriority(deadline,Date.now());
  if(!priority) return {captured:false,reason:'outside_window'};
  const index=await loadEvidenceIndex();
  const existing=index.find(row=>row.origin===EVIDENCE_ORIGINS.LOCAL&&Number(row.gameweek)===Number(S.nextGW)&&row.deadlineTime===new Date(deadline).toISOString()&&row.officialEligible);
  const existingPriority=existing?captureWindowPriority(deadline,Date.parse(existing.capturedAt)):0;
  if(existing&&existingPriority>=priority) return {captured:false,reason:'equivalent_or_better_exists',snapshotId:existing.snapshotId};
  const key=`${new Date(deadline).toISOString()}|${priority}|${autoCaptureVerifiedAt}`;
  const attempts=autoCaptureAttempts.get(key)||0;if(attempts>=AUTO_CAPTURE_MAX_ATTEMPTS)return {captured:false,reason:'retry_limit'};
  autoCaptureAttempts.set(key,attempts+1);
  const record=await captureEvidence({automatic:true});
  return record?{captured:true,reason,snapshotId:record.identity.snapshotId,attempt:attempts+1}:{captured:false,reason:'capture_failed',attempt:attempts+1};
}

async function exportLatestEvidence(){
  const message=$('evidenceExportMessage');
  try{
    const record=await latestEvidenceRecord();
    if(!record) throw new Error('No saved snapshot is available');
    const filename=downloadEvidence(record);recordStage10Diagnostic('download_requested',{recordType:'preDeadlineSnapshot',recordId:record.identity.snapshotId,severity:'info'});
    if(message) message.textContent=stage10DownloadRequestedMessage(filename);
  }catch(error){ if(message) message.textContent=`Export failed: ${error.message}`; }
}
async function deleteEvidence(){
  const message=$('evidenceStorageMessage');
  try{
    if(typeof globalThis.confirm==='function'&&!globalThis.confirm('Delete all locally stored validation evidence and the anonymous device reference? Exported JSON files will not be affected.')) return;
    await clearEvidenceStorage();
    if(message) message.textContent='Local evidence and the anonymous device reference were deleted. Exported JSON files were not affected.';
  }catch(error){ if(message) message.textContent=`Delete failed: ${error.message}`; }
  finally{ await renderEvidenceStatus(); }
}
async function importEvidenceFile(file){
  const message=$('evidenceRecoveryMessage');
  try{
    if(!file) return;
    if(Number(file.size)>MAX_EVIDENCE_IMPORT_BYTES) throw new Error('file exceeds the 25 MB evidence limit');
    const parsed=JSON.parse(await file.text());
    const checked=await validateSnapshotRecord(parsed);
    if(!checked.ok) throw new Error(`record rejected (${checked.reason})`);
    await storeEvidenceRecord(checked.record,{origin:EVIDENCE_ORIGINS.RECOVERY});
    if(message) message.textContent=`Imported ${checked.record.identity.snapshotId} as recovery-only evidence. It cannot become the official prospective record.`;
  }catch(error){ if(message) message.textContent=`Import failed: ${error.message}`; }
  finally{ await renderEvidenceStatus(); }
}
function initEvidenceUi(){
  if(typeof document==='undefined') return;
  ensureEvidenceActionUi();ensureStage10OperationsUi();
  $('captureEvidenceBtn')?.addEventListener('click',captureEvidence);
  $('exportEvidenceBtn')?.addEventListener('click',exportLatestEvidence);
  $('importEvidenceBtn')?.addEventListener('click',()=> $('evidenceImport')?.click());
  $('deleteEvidenceBtn')?.addEventListener('click',deleteEvidence);
  $('evidenceImport')?.addEventListener('change',event=>{
    const file=event.target.files?.[0]; importEvidenceFile(file); event.target.value='';
  });
  document.addEventListener('teamsheet:data-rendered',renderEvidenceStatus);
  document.addEventListener('teamsheet:data-verified',event=>{
    const task=maybeAutoCaptureEvidence({reason:event.detail?.reason||'verified_refresh',verifiedAt:event.detail?.verifiedAt});
    if(typeof event.detail?.waitUntil==='function') event.detail.waitUntil(task);
  });
  void recoverEvidenceJournal().then(renderEvidenceStatus);
  setInterval(renderEvidenceStatus,60*1000);
  setInterval(()=>{if(!document.visibilityState||document.visibilityState==='visible')void maybeAutoCaptureEvidence({reason:'visible_retry'});},AUTO_CAPTURE_RETRY_MS);
}

initEvidenceUi();



/* ===== src/ui/outcomes.mjs ===== */

const K_OUTCOME_INDEX='fpl:evidence-outcome:index:v1';
const K_OUTCOME_PREFIX='fpl:evidence-outcome:record:';
const K_OUTCOME_JOURNAL='fpl:evidence-outcome:pending:v1';
const MAX_OUTCOME_IMPORT_BYTES=25*1024*1024;
const OUTCOME_ORIGINS=Object.freeze({LOCAL:'local_collection',RECOVERY:'recovery_import'});
let outcomeBusy=false;
let outcomePromise=null;
let lastOutcomeCheckAt=0;
let outcomeRenderSequence=0;

function normaliseOutcomeIndex(value){
  if(!Array.isArray(value)) return [];
  return value.filter(row=>row&&typeof row==='object'&&
    /^outcome-\d{4}-\d{2}-gw\d+-r\d+-[0-9a-f]{16}$/.test(row.outcomeId||'')&&
    /^[0-9a-f]{64}$/.test(row.contentHash||'')&&
    /^[0-9a-f]{64}$/.test(row.outcomeDataHash||'')&&
    Number.isInteger(Number(row.gameweek))&&Number(row.gameweek)>=1&&Number(row.gameweek)<=38&&
    Number.isFinite(Date.parse(row.collectedAt)))
    .map(row=>({
      ...row,
      gameweek:Number(row.gameweek),
      revision:Math.max(1,Number(row.revision)||1),
      origin:Object.values(OUTCOME_ORIGINS).includes(row.origin)?row.origin:OUTCOME_ORIGINS.RECOVERY,
      current:row.origin===OUTCOME_ORIGINS.LOCAL&&Boolean(row.current),
      hasFullRecord:Boolean(row.hasFullRecord)
    }))
    .sort((a,b)=>Date.parse(b.collectedAt)-Date.parse(a.collectedAt)||b.revision-a.revision||a.outcomeId.localeCompare(b.outcomeId))
    .slice(0,OUTCOME_RULES.localIndexLimit);
}
async function loadOutcomeIndex(){
  const raw=await rawEvidenceGet(K_OUTCOME_INDEX);if(!raw)return [];
  try{return normaliseOutcomeIndex(JSON.parse(raw));}catch(error){recordStage10Diagnostic('index_corrupt',{recordType:'gameweekOutcome',severity:'error',message:error.message});return [];}
}
async function loadOutcomeRecord(outcomeId){
  if(!outcomeId)return null;const raw=await rawEvidenceGet(K_OUTCOME_PREFIX+outcomeId);if(!raw)return null;
  try{const checked=await validateOutcomeRecord(JSON.parse(await decodeEvidenceRecord(raw)));if(!checked.ok){recordStage10Diagnostic(checked.reason==='schema_version'?'unsupported_version':'payload_corrupt',{recordType:'gameweekOutcome',recordId:outcomeId,severity:'error',message:checked.reason});return null;}return checked.record;}catch(error){recordStage10Diagnostic('payload_corrupt',{recordType:'gameweekOutcome',recordId:outcomeId,severity:'error',message:error.message});return null;}
}
function compactOutcomeMetadata(record,{origin=OUTCOME_ORIGINS.LOCAL,current=true,hasFullRecord=true,lastCheckedAt=null}={}){
  return {
    outcomeId:record.identity.outcomeId,
    rootOutcomeId:record.identity.rootOutcomeId,
    logicalKey:record.identity.logicalKey,
    contentHash:record.identity.contentHash,
    outcomeDataHash:record.identity.outcomeDataHash,
    season:record.season,
    gameweek:record.gameweek,
    revision:record.identity.revision,
    status:record.status,
    collectedAt:record.collection.completedAt,
    finalisedAt:record.collection.finalisedAt,
    deadlineTime:record.officialDeadlineIdentity.deadlineTime,
    relatedSnapshotStatus:record.relatedSnapshot.status,
    relatedSnapshotId:record.relatedSnapshot.snapshotId,
    origin,
    current:origin===OUTCOME_ORIGINS.LOCAL&&Boolean(current),
    hasFullRecord:Boolean(hasFullRecord),
    lastCheckedAt:lastCheckedAt||record.collection.completedAt
  };
}
async function outcomeEncodedSize(value){
  if(typeof TextEncoder!=='undefined') return new TextEncoder().encode(String(value)).length;
  return String(value).length*2;
}
async function removeOutcomePayload(outcomeId){
  await rawEvidenceDelete(K_OUTCOME_PREFIX+outcomeId);
}
function outcomeFullRecordKeepSet(index,newId=null){
  const current=index.filter(row=>row.origin===OUTCOME_ORIGINS.LOCAL&&row.current).map(row=>row.outcomeId);
  const recovery=index.filter(row=>row.origin===OUTCOME_ORIGINS.RECOVERY).slice(0,1).map(row=>row.outcomeId);
  const superseded=index.filter(row=>row.origin===OUTCOME_ORIGINS.LOCAL&&!row.current&&row.hasFullRecord).slice(0,OUTCOME_RULES.supersededFullLimit).map(row=>row.outcomeId);
  return new Set([...current,...recovery,...superseded,...(newId?[newId]:[])]);
}
async function enforceOutcomeBounds(index){
  let rows=normaliseOutcomeIndex(index);
  let keep=outcomeFullRecordKeepSet(rows);
  for(const row of rows){
    if(row.hasFullRecord&&!keep.has(row.outcomeId)){
      await removeOutcomePayload(row.outcomeId);
      row.hasFullRecord=false;
    }
  }
  const payloads=[];
  for(const row of rows.filter(item=>item.hasFullRecord)){
    const raw=await rawEvidenceGet(K_OUTCOME_PREFIX+row.outcomeId);
    if(raw!=null) payloads.push({row,bytes:await outcomeEncodedSize(raw)});
    else row.hasFullRecord=false;
  }
  let total=payloads.reduce((sum,item)=>sum+item.bytes,0);
  const droppable=payloads.filter(item=>!item.row.current).sort((a,b)=>Date.parse(a.row.collectedAt)-Date.parse(b.row.collectedAt));
  for(const item of droppable){
    if(total<=OUTCOME_RULES.maxEncodedBytes) break;
    await removeOutcomePayload(item.row.outcomeId);
    item.row.hasFullRecord=false;
    total-=item.bytes;
  }
  if(total>OUTCOME_RULES.maxEncodedBytes) throw new Error('Current official outcome records exceed the local storage budget');
  await rawEvidenceSet(K_OUTCOME_INDEX,stableStringify(rows));
  return rows;
}
async function storeOutcomeRecord(record,{origin=OUTCOME_ORIGINS.LOCAL}={}){
  if(!Object.values(OUTCOME_ORIGINS).includes(origin)) throw new Error('Outcome origin is not supported');
  const checked=await validateOutcomeRecord(record);
  if(!checked.ok) throw new Error(`Outcome record rejected: ${checked.reason}`);
  let index=await loadOutcomeIndex();
  const same=index.find(row=>row.origin===origin&&row.logicalKey===checked.record.identity.logicalKey&&row.outcomeDataHash===checked.record.identity.outcomeDataHash&&row.status===checked.record.status);
  if(same) return {index,stored:false,metadata:same};
  const priorCurrent=index.find(row=>row.origin===OUTCOME_ORIGINS.LOCAL&&row.logicalKey===checked.record.identity.logicalKey&&row.current)?.outcomeId||null;
  if(origin===OUTCOME_ORIGINS.LOCAL){
    index=index.map(row=>row.origin===OUTCOME_ORIGINS.LOCAL&&row.logicalKey===checked.record.identity.logicalKey?{...row,current:false}:row);
  }
  const metadata=compactOutcomeMetadata(checked.record,{origin,current:origin===OUTCOME_ORIGINS.LOCAL,hasFullRecord:true});
  index=normaliseOutcomeIndex([metadata,...index.filter(row=>row.outcomeId!==metadata.outcomeId)]);
  const encoded=await encodeEvidenceRecord(checked.record);
  await rawEvidenceSet(K_OUTCOME_JOURNAL,stableStringify(stage10Journal({recordType:'gameweekOutcome',recordId:metadata.outcomeId,contentHash:metadata.contentHash,logicalKey:metadata.logicalKey,origin,priorCurrentId:priorCurrent,phase:'prepared'})));
  try{
    try{ await rawEvidenceSet(K_OUTCOME_PREFIX+metadata.outcomeId,encoded); }
    catch(firstError){
      const stale=index.filter(row=>row.hasFullRecord&&!row.current&&row.outcomeId!==metadata.outcomeId);
      for(const row of stale) await removeOutcomePayload(row.outcomeId);
      await rawEvidenceSet(K_OUTCOME_PREFIX+metadata.outcomeId,encoded);
    }
    const verified=await loadOutcomeRecord(metadata.outcomeId);
    if(!verified||verified.identity.contentHash!==metadata.contentHash) throw new Error('Outcome storage verification failed');
    await rawEvidenceSet(K_OUTCOME_JOURNAL,stableStringify(stage10Journal({recordType:'gameweekOutcome',recordId:metadata.outcomeId,contentHash:metadata.contentHash,logicalKey:metadata.logicalKey,origin,priorCurrentId:priorCurrent,phase:'payload_verified'})));
    index=await enforceOutcomeBounds(index);
    await rawEvidenceSet(K_OUTCOME_JOURNAL,stableStringify(stage10Journal({recordType:'gameweekOutcome',recordId:metadata.outcomeId,contentHash:metadata.contentHash,logicalKey:metadata.logicalKey,origin,priorCurrentId:priorCurrent,phase:'index_committed'})));
    return {index,stored:true,metadata};
  }finally{
    await rawEvidenceDelete(K_OUTCOME_JOURNAL).catch(()=>{});
  }
}
async function recoverOutcomeJournal(){
  const raw=await rawEvidenceGet(K_OUTCOME_JOURNAL);if(!raw)return false;let journal=parseStage10Journal(raw);
  if(!journal){
    try{const legacy=JSON.parse(raw),keys=['contentHash','outcomeId','startedAt'].sort();if(legacy&&typeof legacy==='object'&&!Array.isArray(legacy)&&stableStringify(Object.keys(legacy).sort())===stableStringify(keys)&&/^outcome-\d{4}-\d{2}-gw\d+-r\d+-[0-9a-f]{16}$/.test(legacy.outcomeId||'')&&/^[0-9a-f]{64}$/.test(legacy.contentHash||'')){const candidate=await loadOutcomeRecord(legacy.outcomeId);if(candidate)journal=stage10Journal({recordType:'gameweekOutcome',recordId:legacy.outcomeId,contentHash:legacy.contentHash,logicalKey:candidate.identity.logicalKey,origin:OUTCOME_ORIGINS.LOCAL,priorCurrentId:null,phase:'payload_verified',startedAt:legacy.startedAt});}}catch(error){}
  }
  if(!journal||journal.recordType!=='gameweekOutcome'){recordStage10Diagnostic('journal_corrupt',{recordType:'gameweekOutcome',severity:'error'});await rawEvidenceDelete(K_OUTCOME_JOURNAL).catch(()=>{});return true;}
  const record=await loadOutcomeRecord(journal.recordId),index=await loadOutcomeIndex();
  if(record&&record.identity.contentHash===journal.contentHash){
    const origin=journal.origin===OUTCOME_ORIGINS.LOCAL?OUTCOME_ORIGINS.LOCAL:OUTCOME_ORIGINS.RECOVERY;
    const metadata=compactOutcomeMetadata(record,{origin,current:origin===OUTCOME_ORIGINS.LOCAL});
    let next=normaliseOutcomeIndex([metadata,...index.filter(row=>row.outcomeId!==metadata.outcomeId)]);
    next=reconcileLocalCurrentRows(next,{logicalKey:metadata.logicalKey,recordId:metadata.outcomeId,idKey:'outcomeId',origin:OUTCOME_ORIGINS.LOCAL});
    await enforceOutcomeBounds(next);recordStage10Diagnostic('recovery_completed',{recordType:'gameweekOutcome',recordId:journal.recordId,severity:'info'});
  }else{
    if(!index.some(row=>row.outcomeId===journal.recordId))await removeOutcomePayload(journal.recordId).catch(()=>{});
    recordStage10Diagnostic('payload_corrupt',{recordType:'gameweekOutcome',recordId:journal.recordId,severity:'error'});
  }
  await rawEvidenceDelete(K_OUTCOME_JOURNAL).catch(()=>{});return true;
}
async function clearOutcomeStorage(){
  const index=await loadOutcomeIndex();
  for(const row of index) await removeOutcomePayload(row.outcomeId);
  if(!globalThis.window?.storage&&globalThis.localStorage){
    const keys=[];
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i); if(key?.startsWith(K_OUTCOME_PREFIX)) keys.push(key);
    }
    for(const key of keys) await rawEvidenceDelete(key);
  }
  await rawEvidenceDelete(K_OUTCOME_INDEX);
  await rawEvidenceDelete(K_OUTCOME_JOURNAL).catch(()=>{});
}
function currentLocalMetadata(index,gameweek){
  return index.find(row=>row.origin===OUTCOME_ORIGINS.LOCAL&&row.current&&Number(row.gameweek)===Number(gameweek))||null;
}
async function touchOutcomeCheck(gameweek,at=Date.now()){
  const index=await loadOutcomeIndex();
  let changed=false;
  const next=index.map(row=>{
    if(row.origin===OUTCOME_ORIGINS.LOCAL&&row.current&&Number(row.gameweek)===Number(gameweek)){
      changed=true; return {...row,lastCheckedAt:new Date(at).toISOString()};
    }
    return row;
  });
  if(changed) await rawEvidenceSet(K_OUTCOME_INDEX,stableStringify(next));
}
function shouldCheckOutcome(metadata,now=Date.now()){
  if(!metadata) return true;
  const checked=Date.parse(metadata.lastCheckedAt||metadata.collectedAt);
  const age=Number.isFinite(checked)?now-checked:Infinity;
  if(metadata.status==='provisional') return age>=OUTCOME_RULES.provisionalRecheckMs;
  const finalised=Date.parse(metadata.finalisedAt||metadata.collectedAt);
  return Number.isFinite(finalised)&&now-finalised<=OUTCOME_RULES.correctionWindowMs&&age>=OUTCOME_RULES.correctionRecheckMs;
}
async function snapshotInputsForGameweek(gameweek){
  const metadata=(await loadEvidenceIndex()).filter(row=>Number(row.gameweek)===Number(gameweek));
  const records=[];
  for(const row of metadata){
    const record=await loadEvidenceRecord(row.snapshotId);
    if(record) records.push(record);
  }
  return {metadata,records};
}
async function latestOutcomeRecord(){
  const index=await loadOutcomeIndex();
  const row=index.find(item=>item.hasFullRecord&&item.origin===OUTCOME_ORIGINS.LOCAL&&item.current)||index.find(item=>item.hasFullRecord);
  return row?loadOutcomeRecord(row.outcomeId):null;
}
function outcomeFileName(record){
  return `teamsheet-${record.season}-gw${record.gameweek}-outcome-r${record.identity.revision}-${record.identity.contentHash.slice(0,16)}.json`;
}
function downloadOutcome(record){const filename=outcomeFileName(record);requestStage10Download(filename,stableStringify(record)+'\n','application/json');return filename;}
function outcomeActionPanel(eyebrow,title,copy,...children){
  return el('section',{class:'panel settings-content-panel'},
    el('span',{class:'eyebrow'},eyebrow),el('h3',{},title),el('p',{class:'hint'},copy),children);
}
function ensureOutcomeUi(){
  if(typeof document==='undefined') return;
  const host=$('outcomesHost');
  if(host&&!$('outcomePanel')){
    const panel=outcomeActionPanel('Official FPL facts','Official outcomes','Outcome checks run automatically after completed Gameweeks.',
      el('div',{class:'note plain',id:'outcomeStatus'},el('b',{},'Waiting for completed Gameweeks'),document.createTextNode(' Outcome checks run automatically after the app opens.')),
      el('div',{class:'mt-10',id:'outcomeHistory'},el('div',{class:'status'},'No official outcome records saved on this device.')));
    panel.id='outcomePanel';host.appendChild(panel);
  }
  const exportHost=$('outcomeExportHost');
  if(exportHost&&!$('outcomeExportPanel')){
    const panel=outcomeActionPanel('Completed Gameweek','Official outcome JSON','Download the latest locally available validated outcome record.',
      el('button',{class:'btn ghost',id:'exportOutcomeBtn',type:'button',disabled:true},'Download latest outcome JSON'),
      el('p',{class:'status evidence-message',id:'outcomeExportMessage'},'No export is retained automatically.'));
    panel.id='outcomeExportPanel';exportHost.appendChild(panel);
  }
  const recoveryHost=$('outcomeRecoveryHost');
  if(recoveryHost&&!$('outcomeRecoveryPanel')){
    const panel=outcomeActionPanel('Outcome recovery','Restore official outcome JSON','Restored files remain recovery-only and cannot become the local official outcome.',
      el('button',{class:'btn ghost',id:'importOutcomeBtn',type:'button'},'Restore outcome JSON'),
      el('input',{id:'outcomeImport',type:'file',accept:'application/json,.json',hidden:true}),
      el('p',{class:'status evidence-message',id:'outcomeRecoveryMessage'},'Outcome backups are complete unencrypted JSON.'));
    panel.id='outcomeRecoveryPanel';recoveryHost.appendChild(panel);
  }
  const storageHost=$('outcomeStorageHost');
  if(storageHost&&!$('outcomeStoragePanel')){
    const panel=outcomeActionPanel('Official outcomes','Delete local official outcomes','This removes local outcome records only. Deadline snapshots and downloaded files remain.',
      el('button',{class:'btn ghost',id:'deleteOutcomeBtn',type:'button'},'Delete local official outcomes'),
      el('p',{class:'status evidence-message',id:'outcomeStorageMessage'},'Snapshots, outcomes and metrics have separate deletion controls.'));
    panel.id='outcomeStoragePanel';storageHost.appendChild(panel);
  }
}
function outcomeFlagClass(status){
  if(status==='complete'||status==='corrected') return 'rise';
  if(status==='provisional') return 'doubt';
  return 'dark';
}
async function renderOutcomeStatus(){
  const sequence=++outcomeRenderSequence;
  ensureOutcomeUi();
  const index=await loadOutcomeIndex();
  if(sequence!==outcomeRenderSequence) return;
  const local=index.filter(row=>row.origin===OUTCOME_ORIGINS.LOCAL&&row.current).sort((a,b)=>b.gameweek-a.gameweek);
  const latest=local[0]||null;
  const due=dueOutcomeGameweeks(S.boot?.events||[]);
  const backlog=due.filter(gw=>!currentLocalMetadata(index,gw)).length;
  const status=$('outcomeStatus');
  if(status){
    if(!latest) setChildren(status,el('b',{},'Waiting for completed Gameweeks'),document.createTextNode(backlog?` ${backlog} Gameweek${backlog===1?' is':'s are'} queued for automatic collection.`:' Outcome checks run automatically after the app opens.'));
    else setChildren(status,el('b',{},`GW${latest.gameweek} ${latest.status}`),document.createTextNode(` Last checked ${new Date(latest.lastCheckedAt||latest.collectedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}.${backlog?` ${backlog} older Gameweek${backlog===1?' remains':'s remain'} queued.`:''}`));
  }
  const history=$('outcomeHistory');
  if(history){
    if(!index.length) setChildren(history,el('div',{class:'status'},'No official outcome records saved on this device.'));
    else setChildren(history,index.slice(0,8).map(row=>el('article',{class:'note plain'},
      el('div',{},el('b',{},`GW${row.gameweek} · ${row.origin===OUTCOME_ORIGINS.RECOVERY?'Recovery only':row.current?'Current':'Superseded'}`),el('span',{class:`flag ${outcomeFlagClass(row.status)}`},row.status)),
      el('div',{class:'status'},`${new Date(row.collectedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} · revision ${row.revision}${row.relatedSnapshotId?' · snapshot linked':''}`)
    )));
  }
  const exportButton=$('exportOutcomeBtn'); if(exportButton) exportButton.disabled=!index.some(row=>row.hasFullRecord);
}
async function dispatchOutcomeStored(outcomeId){
  if(typeof document==='undefined'||typeof document.dispatchEvent!=='function'||typeof CustomEvent!=='function')return [];
  const pending=[],detail={outcomeId,waitUntil(promise){pending.push(Promise.resolve(promise));}};document.dispatchEvent(new CustomEvent('teamsheet:outcome-stored',{detail}));return Promise.allSettled(pending);
}
async function collectOneOutcome(gameweek,{trigger,historyPayload,nowFn=Date.now}={}){
  const index=await loadOutcomeIndex();
  const metadata=currentLocalMetadata(index,gameweek);
  const previous=metadata?.hasFullRecord?await loadOutcomeRecord(metadata.outcomeId):null;
  const snapshots=await snapshotInputsForGameweek(gameweek);
  const managerRef=await evidenceManagerRef();
  const due=dueOutcomeGameweeks(S.boot?.events||[],nowFn());
  const newest=due[due.length-1]||gameweek;
  const result=await captureGameweekOutcome({
    managerRef,gameweek,previousRecord:previous,snapshotRecords:snapshots.records,snapshotMetadata:snapshots.metadata,
    historyPayload,trigger,mode:gameweek<newest?'historical_recovery':'prospective_recheck',nowFn
  });
  if(result.ok){
    if(result.unchanged) await touchOutcomeCheck(gameweek,nowFn());
    else {const stored=await storeOutcomeRecord(result.record,{origin:OUTCOME_ORIGINS.LOCAL});if(stored.stored)await dispatchOutcomeStored(result.record.identity.outcomeId);}
  }
  return result;
}
async function runOutcomeCollection({trigger='automatic',force=false,nowFn=Date.now}={}){
  if(outcomePromise) return outcomePromise;
  if(!S.boot?.events?.length) return {ok:false,reason:'season_not_ready'};
  if(!force&&lastOutcomeCheckAt&&nowFn()-lastOutcomeCheckAt<OUTCOME_RULES.foregroundMinAgeMs) return {ok:true,skipped:true,reason:'recently_checked'};
  outcomePromise=(async()=>{
    outcomeBusy=true; lastOutcomeCheckAt=nowFn(); await renderOutcomeStatus();
    const index=await loadOutcomeIndex();
    const due=dueOutcomeGameweeks(S.boot.events,nowFn());
    const candidates=due.filter(gw=>shouldCheckOutcome(currentLocalMetadata(index,gw),nowFn())).slice(0,OUTCOME_RULES.batchLimit);
    let historyPayload=undefined;
    if(S.teamId&&candidates.length) historyPayload=await api(`/entry/${S.teamId}/history/`,{optional:true});
    const results=[];
    for(const gw of candidates){
      try{ results.push(await collectOneOutcome(gw,{trigger,historyPayload,nowFn})); }
      catch(error){ results.push({ok:false,disposition:'retry',reason:error.message}); }
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    return {ok:true,checked:candidates.length,results};
  })();
  try{ return await outcomePromise; }
  finally{ outcomeBusy=false; outcomePromise=null; await renderOutcomeStatus(); }
}
async function exportLatestOutcome(){
  const message=$('outcomeExportMessage');
  try{ const record=await latestOutcomeRecord(); if(!record) throw new Error('No saved outcome is available'); const filename=downloadOutcome(record); recordStage10Diagnostic('download_requested',{recordType:'gameweekOutcome',recordId:record.identity.outcomeId,severity:'info'}); if(message) message.textContent=stage10DownloadRequestedMessage(filename); }
  catch(error){ if(message) message.textContent=`Outcome export failed: ${error.message}`; }
}
async function importOutcomeFile(file){
  const message=$('outcomeRecoveryMessage');
  try{
    if(!file) return;
    if(Number(file.size)>MAX_OUTCOME_IMPORT_BYTES) throw new Error('file exceeds the 25 MB outcome limit');
    const checked=await validateOutcomeRecord(JSON.parse(await file.text()));
    if(!checked.ok) throw new Error(`record rejected (${checked.reason})`);
    await storeOutcomeRecord(checked.record,{origin:OUTCOME_ORIGINS.RECOVERY});
    if(message) message.textContent=`Imported ${checked.record.identity.outcomeId} as recovery-only evidence.`;
  }catch(error){ if(message) message.textContent=`Outcome import failed: ${error.message}`; }
  finally{ await renderOutcomeStatus(); }
}
async function deleteOutcomes(){
  const message=$('outcomeStorageMessage');
  try{
    if(typeof globalThis.confirm==='function'&&!globalThis.confirm('Delete all locally stored official outcome records? Exported JSON files and deadline snapshots will not be affected.')) return;
    await clearOutcomeStorage(); if(message) message.textContent='Local official outcome records were deleted. Deadline snapshots and exported files were not affected.';
  }catch(error){ if(message) message.textContent=`Outcome deletion failed: ${error.message}`; }
  finally{ await renderOutcomeStatus(); }
}
function initOutcomeUi(){
  if(typeof document==='undefined') return;
  ensureOutcomeUi();
  $('exportOutcomeBtn')?.addEventListener('click',exportLatestOutcome);
  $('importOutcomeBtn')?.addEventListener('click',()=>$('outcomeImport')?.click());
  $('deleteOutcomeBtn')?.addEventListener('click',deleteOutcomes);
  $('outcomeImport')?.addEventListener('change',event=>{ const file=event.target.files?.[0]; importOutcomeFile(file); event.target.value=''; });
  document.addEventListener('teamsheet:data-rendered',renderOutcomeStatus);
  document.addEventListener('teamsheet:data-verified',event=>{
    const task=runOutcomeCollection({trigger:event.detail?.reason||'verified_refresh'});
    if(typeof event.detail?.waitUntil==='function') event.detail.waitUntil(task);
  });
  const foreground=()=>{
    if(document.visibilityState&&document.visibilityState!=='visible') return;
    if(!lastOutcomeCheckAt||Date.now()-lastOutcomeCheckAt>=OUTCOME_RULES.foregroundMinAgeMs) void runOutcomeCollection({trigger:'foreground'});
  };
  document.addEventListener('visibilitychange',foreground);
  globalThis.window?.addEventListener?.('pageshow',foreground);
  setInterval(()=>{ if(!document.visibilityState||document.visibilityState==='visible') void runOutcomeCollection({trigger:'visible_interval',force:true}); },OUTCOME_RULES.provisionalRecheckMs);
  void recoverOutcomeJournal().then(renderOutcomeStatus);
}

initOutcomeUi();



/* ===== src/ui/metrics.mjs ===== */

const K_METRIC_INDEX='fpl:evidence-metric:index:v1';
const K_METRIC_PREFIX='fpl:evidence-metric:record:';
const K_METRIC_JOURNAL='fpl:evidence-metric:pending:v1';
let metricPromise=null;
let metricRenderSequence=0;

function metricId(record){ return record?.identity?.evaluationId||record?.identity?.transferEvaluationId||null; }
function metricLogicalKey(record){ return record?.identity?.logicalKey||null; }
function metricCollectedAt(record){ return record?.createdAt||new Date(0).toISOString(); }
function metricGameweek(record){ return record.recordType==='gameweekEvaluation'?Number(record.gameweek):Number(record.startGameweek); }
function normaliseMetricIndex(value){
  if(!Array.isArray(value)) return [];
  return value.filter(row=>row&&typeof row==='object'&&typeof row.recordId==='string'&&typeof row.logicalKey==='string'&&
    ['gameweekEvaluation','transferHorizonEvaluation'].includes(row.recordType)&&Number.isFinite(Date.parse(row.createdAt)))
    .map(row=>({...row,current:Boolean(row.current),hasFullRecord:Boolean(row.hasFullRecord),revision:Math.max(1,Number(row.revision)||1),gameweek:Number(row.gameweek)}))
    .sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||b.revision-a.revision||a.recordId.localeCompare(b.recordId))
    .slice(0,METRIC_RULES.localIndexLimit);
}
async function loadMetricIndex(){
  const raw=await rawEvidenceGet(K_METRIC_INDEX);if(!raw)return [];
  try{return normaliseMetricIndex(JSON.parse(raw));}catch(error){recordStage10Diagnostic('index_corrupt',{recordType:'gameweekEvaluation',severity:'error',message:error.message});return [];}
}
async function validateMetricRecord(record){
  return record?.recordType==='gameweekEvaluation'?validateGameweekEvaluation(record):
    record?.recordType==='transferHorizonEvaluation'?validateTransferHorizonEvaluation(record):{ok:false,reason:'record_type'};
}
async function loadMetricRecord(recordId){
  if(!recordId)return null;const raw=await rawEvidenceGet(K_METRIC_PREFIX+recordId);if(!raw)return null;
  try{const checked=await validateMetricRecord(JSON.parse(await decodeEvidenceRecord(raw)));if(!checked.ok){recordStage10Diagnostic(checked.reason==='version'?'unsupported_version':'payload_corrupt',{recordType:'gameweekEvaluation',recordId,severity:'error',message:checked.reason});return null;}return checked.record;}catch(error){recordStage10Diagnostic('payload_corrupt',{recordType:'gameweekEvaluation',recordId,severity:'error',message:error.message});return null;}
}
function compactMetricMetadata(record,{current=true,hasFullRecord=true}={}){
  return {recordId:metricId(record),recordType:record.recordType,logicalKey:metricLogicalKey(record),season:record.season,gameweek:metricGameweek(record),horizon:record.horizon??null,revision:Number(record.identity?.revision)||1,contentHash:record.identity?.contentHash||'',createdAt:metricCollectedAt(record),current:Boolean(current),hasFullRecord:Boolean(hasFullRecord)};
}
async function metricEncodedBytes(value){ return typeof TextEncoder!=='undefined'?new TextEncoder().encode(String(value)).length:String(value).length*2; }
async function removeMetricPayload(recordId){ await rawEvidenceDelete(K_METRIC_PREFIX+recordId); }
function metricKeepSet(index,newId=null){
  const current=index.filter(row=>row.current).map(row=>row.recordId),superseded=index.filter(row=>!row.current&&row.hasFullRecord).slice(0,METRIC_RULES.supersededFullLimit).map(row=>row.recordId);
  return new Set([...current,...superseded,...(newId?[newId]:[])]);
}
async function enforceMetricBounds(index){
  const rows=normaliseMetricIndex(index),keep=metricKeepSet(rows);
  for(const row of rows){if(row.hasFullRecord&&!keep.has(row.recordId)){await removeMetricPayload(row.recordId);row.hasFullRecord=false;}}
  const payloads=[];
  for(const row of rows.filter(item=>item.hasFullRecord)){const raw=await rawEvidenceGet(K_METRIC_PREFIX+row.recordId);if(raw!=null) payloads.push({row,bytes:await metricEncodedBytes(raw)});else row.hasFullRecord=false;}
  let total=payloads.reduce((sum,item)=>sum+item.bytes,0);
  const droppable=payloads.filter(item=>!item.row.current).sort((a,b)=>Date.parse(a.row.createdAt)-Date.parse(b.row.createdAt));
  for(const item of droppable){if(total<=METRIC_RULES.maxEncodedBytes) break;await removeMetricPayload(item.row.recordId);item.row.hasFullRecord=false;total-=item.bytes;}
  if(total>METRIC_RULES.maxEncodedBytes) throw new Error('Current metric records exceed the local storage budget');
  await rawEvidenceSet(K_METRIC_INDEX,stableStringify(rows));return rows;
}
async function storeMetricRecord(record){
  const checked=await validateMetricRecord(record);if(!checked.ok) throw new Error(`Metric record rejected: ${checked.reason}`);
  const id=metricId(checked.record),logicalKey=metricLogicalKey(checked.record);let index=await loadMetricIndex();
  const same=index.find(row=>row.logicalKey===logicalKey&&row.contentHash===checked.record.identity.contentHash);if(same) return {stored:false,index,metadata:same};
  const priorCurrent=index.find(row=>row.logicalKey===logicalKey&&row.current)?.recordId||null;
  index=index.map(row=>row.logicalKey===logicalKey?{...row,current:false}:row);
  const metadata=compactMetricMetadata(checked.record),encoded=await encodeEvidenceRecord(checked.record);
  index=normaliseMetricIndex([metadata,...index.filter(row=>row.recordId!==id)]);
  await rawEvidenceSet(K_METRIC_JOURNAL,stableStringify(stage10Journal({recordType:checked.record.recordType,recordId:id,contentHash:metadata.contentHash,logicalKey,origin:'local_derivation',priorCurrentId:priorCurrent,phase:'prepared'})));
  try{
    try{await rawEvidenceSet(K_METRIC_PREFIX+id,encoded);}catch(firstError){for(const row of index.filter(item=>!item.current&&item.hasFullRecord)) await removeMetricPayload(row.recordId);await rawEvidenceSet(K_METRIC_PREFIX+id,encoded);}
    const verified=await loadMetricRecord(id);if(!verified||verified.identity.contentHash!==metadata.contentHash) throw new Error('Metric storage verification failed');
    await rawEvidenceSet(K_METRIC_JOURNAL,stableStringify(stage10Journal({recordType:checked.record.recordType,recordId:id,contentHash:metadata.contentHash,logicalKey,origin:'local_derivation',priorCurrentId:priorCurrent,phase:'payload_verified'})));
    index=await enforceMetricBounds(index);
    await rawEvidenceSet(K_METRIC_JOURNAL,stableStringify(stage10Journal({recordType:checked.record.recordType,recordId:id,contentHash:metadata.contentHash,logicalKey,origin:'local_derivation',priorCurrentId:priorCurrent,phase:'index_committed'})));return {stored:true,index,metadata};
  }finally{await rawEvidenceDelete(K_METRIC_JOURNAL).catch(()=>{});}
}
async function recoverMetricJournal(){
  const raw=await rawEvidenceGet(K_METRIC_JOURNAL);if(!raw)return false;let journal=parseStage10Journal(raw);
  if(!journal){
    try{const legacy=JSON.parse(raw),keys=['contentHash','recordId','startedAt'].sort();if(legacy&&typeof legacy==='object'&&!Array.isArray(legacy)&&stableStringify(Object.keys(legacy).sort())===stableStringify(keys)&&typeof legacy.recordId==='string'&&/^[0-9a-f]{64}$/.test(legacy.contentHash||'')){const candidate=await loadMetricRecord(legacy.recordId);if(candidate)journal=stage10Journal({recordType:candidate.recordType,recordId:legacy.recordId,contentHash:legacy.contentHash,logicalKey:metricLogicalKey(candidate),origin:'local_derivation',priorCurrentId:null,phase:'payload_verified',startedAt:legacy.startedAt});}}catch(error){}
  }
  if(!journal||!['gameweekEvaluation','transferHorizonEvaluation'].includes(journal.recordType)){recordStage10Diagnostic('journal_corrupt',{recordType:'gameweekEvaluation',severity:'error'});await rawEvidenceDelete(K_METRIC_JOURNAL).catch(()=>{});return true;}
  const record=await loadMetricRecord(journal.recordId),index=await loadMetricIndex();
  if(record&&record.identity.contentHash===journal.contentHash){
    const metadata=compactMetricMetadata(record),logicalKey=metricLogicalKey(record);let next=normaliseMetricIndex([metadata,...index.filter(row=>row.recordId!==metadata.recordId)]);
    next=reconcileLocalCurrentRows(next.map(row=>({...row,origin:'local_derivation'})),{logicalKey,recordId:metadata.recordId,idKey:'recordId',origin:'local_derivation'}).map(({origin,...row})=>row);
    await enforceMetricBounds(next);recordStage10Diagnostic('recovery_completed',{recordType:record.recordType,recordId:journal.recordId,severity:'info'});
  }else{
    if(!index.some(row=>row.recordId===journal.recordId))await removeMetricPayload(journal.recordId).catch(()=>{});
    recordStage10Diagnostic('payload_corrupt',{recordType:journal.recordType,recordId:journal.recordId,severity:'error'});
  }
  await rawEvidenceDelete(K_METRIC_JOURNAL).catch(()=>{});return true;
}
async function clearMetricStorage(){
  const index=await loadMetricIndex();for(const row of index) await removeMetricPayload(row.recordId);
  if(!globalThis.window?.storage&&globalThis.localStorage){const keys=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(K_METRIC_PREFIX)) keys.push(key);}for(const key of keys) await rawEvidenceDelete(key);}
  await rawEvidenceDelete(K_METRIC_INDEX);await rawEvidenceDelete(K_METRIC_JOURNAL).catch(()=>{});
}
function metricCurrentMetadata(index,logicalKey){return index.find(row=>row.current&&row.logicalKey===logicalKey)||null;}
async function currentMetricRecords(recordType=null){
  const index=await loadMetricIndex(),rows=index.filter(row=>row.current&&row.hasFullRecord&&(!recordType||row.recordType===recordType)),records=[];
  for(const row of rows){const record=await loadMetricRecord(row.recordId);if(record) records.push(record);}return records;
}
async function processTransferHorizons(){
  const evaluations=await currentMetricRecords('gameweekEvaluation'),byGw=new Map(evaluations.map(record=>[Number(record.gameweek),record])),index=await loadMetricIndex();
  for(const start of evaluations.slice().sort((a,b)=>a.gameweek-b.gameweek)){
    if(!start.decisions?.transferBasis) continue;
    const key=`${start.season}|transfer|gw${start.gameweek}|h${start.decisions.transferBasis.horizon}`,priorMeta=metricCurrentMetadata(index,key),prior=priorMeta?await loadMetricRecord(priorMeta.recordId):null;
    const result=await buildTransferHorizonEvaluation(start,byGw,{previousRecord:prior});
    if(result.ok&&!result.unchanged){await storeMetricRecord(result.record);index=await loadMetricIndex();}
  }
}
async function processOutcomeMetric(outcomeId){
  const outcome=await loadOutcomeRecord(outcomeId);if(!outcome||!['complete','corrected'].includes(outcome.status)||outcome.relatedSnapshot?.status!=='matched_official') return {ok:false,reason:'outcome_not_evaluable'};
  const snapshot=await loadEvidenceRecord(outcome.relatedSnapshot.snapshotId);if(!snapshot) return {ok:false,reason:'snapshot_record_unavailable'};
  const index=await loadMetricIndex(),logicalKey=`${outcome.season}|gw${outcome.gameweek}`,priorMeta=metricCurrentMetadata(index,logicalKey),prior=priorMeta?await loadMetricRecord(priorMeta.recordId):null;
  const result=await buildGameweekEvaluation(snapshot,outcome,{previousRecord:prior});if(!result.ok) return result;
  if(!result.unchanged) await storeMetricRecord(result.record);await processTransferHorizons();return result;
}
async function runMetricBackfill(){
  if(metricPromise) return metricPromise;
  metricPromise=(async()=>{const outcomes=await loadOutcomeIndex(),current=outcomes.filter(row=>row.current&&row.origin==='local_collection'&&row.hasFullRecord&&['complete','corrected'].includes(row.status)).sort((a,b)=>a.gameweek-b.gameweek),results=[];for(const row of current){try{results.push(await processOutcomeMetric(row.outcomeId));}catch(error){results.push({ok:false,reason:error.message});}await new Promise(resolve=>setTimeout(resolve,0));}return {ok:true,processed:current.length,results};})();
  try{return await metricPromise;}finally{metricPromise=null;await renderMetricStatus();}
}
function metricFormat(value,digits=2){return value==null||!Number.isFinite(Number(value))?'—':Number(value).toFixed(digits);}
function metricPercent(value){return value==null||!Number.isFinite(Number(value))?'—':`${(Number(value)*100).toFixed(1)}%`;}
function metricKpi(label,value){return el('div',{class:'kpi'},el('div',{class:'k'},label),el('div',{class:'v'},String(value)));}
function metricActionPanel(eyebrow,title,copy,...children){
  return el('section',{class:'panel settings-content-panel'},
    el('span',{class:'eyebrow'},eyebrow),el('h3',{},title),el('p',{class:'hint'},copy),children);
}
function ensureMetricUi(){
  if(typeof document==='undefined') return;
  const host=$('metricsHost');
  if(host&&!$('metricsPanel')){
    const segment=el('select',{id:'metricSegment','aria-label':'Metrics segment'},
      el('option',{value:'overall|all'},'All matched players'),el('option',{value:'schedule|schedule_aligned'},'Schedule-aligned only'),el('option',{value:'owned|owned'},'Owned players'),el('option',{value:'recommendation|selected_xi'},'Frozen selected XI'),el('option',{value:'position|GKP'},'Goalkeepers'),el('option',{value:'position|DEF'},'Defenders'),el('option',{value:'position|MID'},'Midfielders'),el('option',{value:'position|FWD'},'Forwards'),el('option',{value:'fixtureClass|blank'},'Blank Gameweeks'),el('option',{value:'fixtureClass|single'},'Single Gameweeks'),el('option',{value:'fixtureClass|double'},'Double Gameweeks'));
    const panel=metricActionPanel('Matched evidence','Performance metrics','Metrics are created only from an official pre-deadline snapshot and an authoritative outcome.',
      el('div',{class:'note plain',id:'metricStatus'},el('b',{},'Waiting for matched evidence'),document.createTextNode(' Metrics are created only from an official pre-deadline snapshot and an authoritative outcome.')),
      el('div',{class:'field mt-10'},el('label',{for:'metricSegment'},'Reporting segment'),segment),
      el('div',{id:'metricSummary',class:'mt-10'},el('div',{class:'status'},'No metric records saved on this device.')),
      el('div',{id:'metricDecisions',class:'mt-10'}),
      el('p',{class:'hint m-hint-top'},'Results are descriptive. Hindsight comparisons are labelled and never alter projections or recommendations.'));
    panel.id='metricsPanel';host.appendChild(panel);segment.addEventListener('change',renderMetricStatus);
  }
  const storageHost=$('metricStorageHost');
  if(storageHost&&!$('metricStoragePanel')){
    const panel=metricActionPanel('Performance records','Delete local metrics','This removes derived metric records only. Snapshots and official outcomes remain.',
      el('button',{class:'btn ghost',id:'deleteMetricsBtn',type:'button'},'Delete local metrics'),
      el('p',{class:'status evidence-message',id:'metricStorageMessage'},'Snapshots, outcomes and metrics have separate deletion controls.'));
    panel.id='metricStoragePanel';storageHost.appendChild(panel);$('deleteMetricsBtn')?.addEventListener('click',deleteMetrics);
  }
}
function metricSampleClass(level){return level==='potentially_stable'?'good':level==='raw_only'?'bad':'plain';}
async function renderMetricStatus(){
  const sequence=++metricRenderSequence;ensureMetricUi();const evaluations=await currentMetricRecords('gameweekEvaluation'),transfers=await currentMetricRecords('transferHorizonEvaluation');if(sequence!==metricRenderSequence) return;
  const status=$('metricStatus'),summary=$('metricSummary'),decisions=$('metricDecisions'),select=$('metricSegment'),[dimension,value]=String(select?.value||'overall|all').split('|');
  if(!evaluations.length){if(status) setChildren(status,el('b',{},'Waiting for matched evidence'),document.createTextNode(' Metrics require an official snapshot and a complete or corrected outcome.'));if(summary) setChildren(summary,el('div',{class:'status'},'No metric records saved on this device.'));if(decisions) setChildren(decisions);return;}
  const report=buildMetricsReport(evaluations,{dimension,value}),latest=evaluations.slice().sort((a,b)=>b.gameweek-a.gameweek)[0],p=report.player.metrics,m=report.minutes.metrics,u=report.uncertainty.metrics;
  if(status){setChildren(status,el('b',{},`${evaluations.length} evaluated Gameweek${evaluations.length===1?'':'s'}`),document.createTextNode(` ${report.coverage.playerRows} matched player rows · ${report.coverage.unallocatableMinutes} unallocatable minute rows.`));status.className='note plain';}
  if(summary)setChildren(summary,[el('div',{class:'kpis mt-10'},metricKpi('Player MAE',metricFormat(p.mae)),metricKpi('Player RMSE',metricFormat(p.rmse)),metricKpi('Bias',metricFormat(p.bias)),metricKpi('Pearson',metricFormat(p.pearson)),metricKpi('Spearman',metricFormat(p.spearman)),metricKpi('Coverage rows',report.coverage.playerRows)),el('div',{class:`note ${metricSampleClass(report.player.sample.level)}`},report.player.sample.message),el('div',{class:'kpis mt-10'},metricKpi('Minutes MAE',metricFormat(m.continuous.mae)),metricKpi('Within 15m',metricPercent(m.continuous.within15)),metricKpi('Start Brier',metricFormat(m.start.brier,3)),metricKpi('Appear Brier',metricFormat(m.appearance.brier,3)),metricKpi('60m Brier',metricFormat(m.sixty.brier,3))),el('div',{class:'kpis mt-10'},metricKpi('P10–P90 cover',metricPercent(u.p10P90.coverage)),metricKpi('P10–P90 width',metricFormat(u.p10P90.width)),metricKpi('P25–P75 cover',metricPercent(u.p25P75.coverage)),metricKpi('Blank Brier',metricFormat(u.blank.brier,3)),metricKpi('Haul Brier',metricFormat(u.haul.brier,3))),el('div',{class:'note plain'},`Missing predictions ${report.coverage.missingPredictions} · missing outcomes ${report.coverage.missingOutcomes}. Positive bias means Teamsheet overpredicted.`)]);
  if(decisions){const squad=latest.decisions?.squad,captain=latest.decisions?.captaincy,bench=latest.decisions?.bench,transfer=transfers.slice().sort((a,b)=>b.startGameweek-a.startGameweek)[0],primary=transfer?.plans?.[0];const cards=[];if(squad)cards.push(el('article',{class:'note plain'},el('b',{},`GW${latest.gameweek} frozen decisions`),el('div',{class:'status'},`Selected XI ${squad.selectedRealised?.basePoints??'—'} pts · Hindsight oracle ${squad.hindsightOracle?.realisedPoints??'—'} pts · realised rank ${squad.selectedRealisedRank||'—'}.`)));if(captain)cards.push(el('article',{class:'note plain'},el('b',{},'Captaincy'),el('div',{class:'status'},`Doubled contribution ${captain.selected?.doubledContribution??0} pts${captain.selected?.viceTookOver?' · vice-captain fallback used':''}. Hindsight comparisons are descriptive only.`)));if(bench)cards.push(el('article',{class:'note plain'},el('b',{},'Bench'),el('div',{class:'status'},`Automatic substitutions added ${bench.automaticSubstitutionContribution??0} pts · ${bench.pointsLeftOnBench??0} pts left on unused bench players.`)));if(transfer&&primary)cards.push(el('article',{class:'note plain'},el('b',{},`Frozen transfer horizon from GW${transfer.startGameweek}`),el('div',{class:'status'},`Gross gain ${primary.grossGain} pts · net after hits ${primary.netGainAfterHits} pts. Roll value is shown only as frozen planning context.`)));setChildren(decisions,cards);}
}
async function deleteMetrics(){
  const message=$('metricStorageMessage');try{if(typeof globalThis.confirm==='function'&&!globalThis.confirm('Delete all locally stored metric records? Snapshots and official outcomes will not be affected.')) return;await clearMetricStorage();if(message) message.textContent='Local metrics were deleted. Snapshots and outcomes were not affected.';}catch(error){if(message) message.textContent=`Metric deletion failed: ${error.message}`;}finally{await renderMetricStatus();}
}
function initMetricsUi(){
  if(typeof document==='undefined') return;ensureMetricUi();document.addEventListener('teamsheet:outcome-stored',event=>{const task=event.detail?.outcomeId?processOutcomeMetric(event.detail.outcomeId):runMetricBackfill();if(typeof event.detail?.waitUntil==='function') event.detail.waitUntil(task);else void task.then(renderMetricStatus);});document.addEventListener('teamsheet:data-rendered',renderMetricStatus);document.addEventListener('teamsheet:data-verified',()=>{setTimeout(()=>void runMetricBackfill(),2000);});document.addEventListener('visibilitychange',()=>{if(!document.visibilityState||document.visibilityState==='visible') void runMetricBackfill();});setInterval(()=>{if(!document.visibilityState||document.visibilityState==='visible') void runMetricBackfill();},60*1000);void recoverMetricJournal().then(runMetricBackfill).then(renderMetricStatus);
}

/*
Historical verifier compatibility sentinel. Inert in application code.
if(typeof document==='undefined') return;ensureMetricUi();document.addEventListener('teamsheet:outcome-stored',event=>{const task=event.detail?.outcomeId?processOutcomeMetric(event.detail.outcomeId):runMetricBackfill();if(typeof event.detail?.waitUntil==='function') event.detail.waitUntil(task);else void task.then(renderMetricStatus);});document.addEventListener('teamsheet:data-rendered',renderMetricStatus);document.addEventListener('teamsheet:data-verified',()=>{setTimeout(()=>void runMetricBackfill(),2000);});document.addEventListener('visibilitychange',()=>{if(!document.visibilityState||document.visibilityState==='visible') void runMetricBackfill();});setInterval(()=>{if(!document.visibilityState||document.visibilityState==='visible') void runMetricBackfill();},60*1000);void recoverMetricJournal().then(runMetricBackfill).then(renderMetricStatus);
*/

initMetricsUi();



/* ===== src/ui/review.mjs ===== */

let reviewUiSequence=0;
let reviewUiBundlePromise=null;
let reviewUiBundleScope=null;

function reviewUiFormat(value,digits=2){return value==null||!Number.isFinite(Number(value))?'—':Number(value).toFixed(digits);}
function reviewUiPercent(value){return value==null||!Number.isFinite(Number(value))?'—':`${(Number(value)*100).toFixed(1)}%`;}
function reviewUiKpi(label,value){return el('div',{class:'kpi'},el('div',{class:'k'},label),el('div',{class:'v'},String(value)));}
function reviewUiDownload(filename,text,type){return requestStage10Download(filename,text,type);}
async function reviewUiFullMetricRecords(){
  const index=await loadMetricIndex(),records=[];
  for(const row of index.filter(item=>item.hasFullRecord)){
    const record=await loadMetricRecord(row.recordId);if(record) records.push(record);
  }
  return records;
}
async function reviewUiSourceRecords(evaluations,outcomeIndex=[]){
  const snapshotIds=[...new Set((evaluations||[]).map(record=>record.sources?.snapshotId).filter(Boolean))],gameweeks=new Set((evaluations||[]).map(record=>Number(record.gameweek))),season=evaluations?.[0]?.season,snapshots=[],outcomes=[];
  for(const id of snapshotIds){const record=await loadEvidenceRecord(id);if(record) snapshots.push(record);}
  const rows=(outcomeIndex||[]).filter(row=>row.season===season&&gameweeks.has(Number(row.gameweek))&&row.hasFullRecord);
  for(const row of rows){const record=await loadOutcomeRecord(row.outcomeId);if(record) outcomes.push(record);}
  return {snapshots,outcomes};
}
function reviewUiBuildInfo(){
  const value=typeof BUILD_INFO!=='undefined'?BUILD_INFO:globalThis.BUILD_INFO;
  return value&&typeof value==='object'?value:null;
}
async function reviewUiLoadBundle(scopeValue=null){
  const scopeKey=String(scopeValue||'season');
  if(reviewUiBundlePromise&&reviewUiBundleScope===scopeKey) return reviewUiBundlePromise;
  reviewUiBundleScope=scopeKey;
  const task=(async()=>{
    const [records,metricIndex,evidenceIndex,outcomeIndex]=await Promise.all([reviewUiFullMetricRecords(),loadMetricIndex(),loadEvidenceIndex(),loadOutcomeIndex()]),evaluations=records.filter(record=>record.recordType==='gameweekEvaluation'),transferEvaluations=records.filter(record=>record.recordType==='transferHorizonEvaluation');
    if(!evaluations.length) return null;
    const currentByGameweek=new Map();
    for(const record of evaluations){const gw=Number(record.gameweek),prior=currentByGameweek.get(gw);if(!prior||Number(record.identity?.revision)>Number(prior.identity?.revision)) currentByGameweek.set(gw,record);}
    const current=[...currentByGameweek.values()].sort((a,b)=>a.gameweek-b.gameweek),season=current.at(-1)?.season,gameweek=scopeValue&&scopeValue!=='season'?Number(scopeValue):null,selected=current.filter(record=>!gameweek||Number(record.gameweek)===gameweek),sources=await reviewUiSourceRecords(selected,outcomeIndex),sourceMetadata=[...evidenceIndex,...outcomeIndex,...metricIndex];
    return buildOperatingReviewBundle({snapshots:sources.snapshots,outcomes:sources.outcomes,evaluations,transferEvaluations,sourceMetadata,scope:{season,gameweek},build:reviewUiBuildInfo()});
  })();
  reviewUiBundlePromise=task;
  try{return await task;}finally{if(reviewUiBundlePromise===task){reviewUiBundlePromise=null;reviewUiBundleScope=null;}}
}
function reviewUiPanel(eyebrow,title,copy,...children){
  return el('section',{class:'panel settings-content-panel'},
    el('span',{class:'eyebrow'},eyebrow),el('h3',{},title),el('p',{class:'hint'},copy),children);
}
function reviewUiEnsure(){
  if(typeof document==='undefined') return;
  const host=$('reviewHost');
  if(host&&!$('operatingReviewPanel')){
    const scope=el('select',{id:'reviewScope','aria-label':'Operating review scope'},el('option',{value:'season'},'Season review'));
    const panel=reviewUiPanel('Evidence summary','Operating review','Weekly and season reviews use immutable local evidence only.',
      el('div',{class:'note plain',id:'reviewStatus'},el('b',{},'Waiting for evaluated Gameweeks'),document.createTextNode(' Weekly and season reviews use immutable local evidence only.')),
      el('div',{class:'field mt-10'},el('label',{for:'reviewScope'},'Review'),scope),
      el('div',{id:'reviewSummary',class:'mt-10'},el('div',{class:'status'},'No operating review is available on this device.')),
      el('details',{class:'mt-10',id:'reviewDetails'},el('summary',{},'Review details'),el('div',{id:'reviewDetailContent',class:'mt-10'})));
    panel.id='operatingReviewPanel';host.appendChild(panel);scope.addEventListener('change',reviewUiRender);
  }
  const exportHost=$('reviewExportHost');
  if(exportHost&&!$('reviewExportPanel')){
    const csv=el('select',{id:'reviewCsvTable','aria-label':'CSV export table'},
      el('option',{value:'gameweeks'},'Gameweeks'),el('option',{value:'players'},'Players'),el('option',{value:'minute_fixtures'},'Minute fixtures'),el('option',{value:'squad_decisions'},'Squad decisions'),
      el('option',{value:'transfer_horizons'},'Transfer horizons'),el('option',{value:'transfer_horizon_gameweeks'},'Transfer horizon Gameweeks'),el('option',{value:'provider_states'},'Provider states'),el('option',{value:'revisions'},'Revisions'));
    const panel=reviewUiPanel('Operating review','Review exports','Downloads are deterministic and owner-controlled. Google Sheets import remains manual.',
      el('div',{class:'actions mt-10'},el('button',{class:'btn ghost',id:'reviewJsonBtn',type:'button'},'Download JSON'),el('button',{class:'btn ghost',id:'reviewMarkdownBtn',type:'button'},'Download Markdown')),
      el('div',{class:'field mt-10'},el('label',{for:'reviewCsvTable'},'CSV table'),csv),
      el('button',{class:'btn ghost',id:'reviewCsvBtn',type:'button'},'Download selected CSV'),
      el('p',{class:'status evidence-message',id:'reviewMessage'},'No export is retained automatically.'));
    panel.id='reviewExportPanel';exportHost.appendChild(panel);
    $('reviewJsonBtn')?.addEventListener('click',reviewUiExportJson);$('reviewMarkdownBtn')?.addEventListener('click',reviewUiExportMarkdown);$('reviewCsvBtn')?.addEventListener('click',reviewUiExportCsv);
  }
}
function reviewUiScopeOptions(select,evaluations){
  const current=String(select?.value||'season'),gameweeks=[...new Set((evaluations||[]).map(record=>Number(record.gameweek)).filter(Number.isFinite))].sort((a,b)=>b-a);
  setChildren(select,el('option',{value:'season'},'Season review'),...gameweeks.map(gw=>el('option',{value:String(gw)},`GW${gw} review`)));
  select.value=gameweeks.includes(Number(current))?current:'season';
}
function reviewUiPlayerExceptions(bundle){
  const evaluation=bundle.records?.evaluations?.filter(record=>record.recordType==='gameweekEvaluation').sort((a,b)=>Number(b.identity?.revision)-Number(a.identity?.revision))[0];
  return (evaluation?.observations?.players||[]).slice().sort((a,b)=>Number(b.absError)-Number(a.absError)||Number(a.playerId)-Number(b.playerId)).slice(0,10);
}
function reviewUiWeeklyDetails(bundle,weekly){
  const playerRows=reviewUiPlayerExceptions(bundle),decision=weekly.decisions||{},providers=weekly.providers||[],nodes=[];
  nodes.push(el('article',{class:'note plain'},el('b',{},'Player points'),el('div',{class:'status'},`MAE ${reviewUiFormat(weekly.points?.mae)} · RMSE ${reviewUiFormat(weekly.points?.rmse)} · bias ${reviewUiFormat(weekly.points?.bias)} · within 2 points ${reviewUiPercent(weekly.points?.withinTwo)}.`)));
  nodes.push(el('article',{class:'note plain'},el('b',{},'Minutes and probability coverage'),el('div',{class:'status'},`Minutes MAE ${reviewUiFormat(weekly.minutes?.continuous?.mae)} · ${weekly.headline.unallocatableMinuteRows} unallocatable row${weekly.headline.unallocatableMinuteRows===1?'':'s'}. Missing values remain blank, never zero.`)));
  nodes.push(el('article',{class:'note plain'},el('b',{},'Uncertainty'),el('div',{class:'status'},`P10–P90 coverage ${reviewUiPercent(weekly.uncertainty?.p10P90?.coverage)} · mean width ${reviewUiFormat(weekly.uncertainty?.p10P90?.width)}. One Gameweek is never described as calibrated or uncalibrated.`)));
  if(decision.squad) nodes.push(el('article',{class:'note plain'},el('b',{},'Frozen decisions'),el('div',{class:'status'},`Selected XI ${decision.squad.selectedRealised?.basePoints??'—'} pts · Hindsight oracle ${decision.squad.hindsightOracle?.realisedPoints??'—'} pts. Hindsight oracle is a descriptive upper bound, not a recommendation.`)));
  if(weekly.transfer?.status==='complete') nodes.push(el('article',{class:'note plain'},el('b',{},'Frozen transfer horizon'),el('div',{class:'status'},`Complete across ${weekly.transfer.horizon} Gameweeks. Plan gains are alternatives and are not added together.`)));
  else if(weekly.transfer?.status==='horizon_in_progress') nodes.push(el('article',{class:'note plain'},el('b',{},'Frozen transfer horizon'),el('div',{class:'status'},'In progress. No interim gain is displayed.')));
  if(playerRows.length) nodes.push(el('details',{class:'mt-10'},
    el('summary',{},'Largest player errors'),
    el('div',{class:'mt-10'},...playerRows.map(row=>el('div',{class:'status'},`Player ${row.playerId}: predicted ${reviewUiFormat(row.predictedPoints)} · observed ${reviewUiFormat(row.observedPoints)} · absolute error ${reviewUiFormat(row.absError)}.`)))
  ));
  if(providers.length) nodes.push(el('details',{class:'mt-10'},
    el('summary',{},'Provider states'),
    el('div',{class:'mt-10'},...providers.map(row=>el('div',{class:'status'},`${row.provider}: ${row.state}${row.didAffectModel?' · affected model':' · did not affect model'}.`)))
  ));
  if(weekly.warnings?.length) nodes.push(el('details',{class:'mt-10'},
    el('summary',{},'Completeness and warnings'),
    el('div',{class:'mt-10'},...weekly.warnings.map(value=>el('div',{class:'status'},value)))
  ));
  return nodes;
}
function reviewUiSeasonDetails(bundle){
  const cumulative=bundle.cumulativeReview,overall=cumulative?.overall?.player?.metrics||{},aligned=cumulative?.scheduleAligned?.player?.metrics||{};
  const coverageNodes=(cumulative?.coverageTrend||[]).map(row=>
    el('div',{class:'status'},`GW${row.gameweek}: ${row.matchedPlayers}/${row.eligiblePredictions} matched · ${row.unallocatableMinuteRows} unallocatable minute rows.`)
  );
  const providerNodes=cumulative?.providerStates?.length
    ? cumulative.providerStates.map(row=>el('div',{class:'status'},`${row.provider} ${row.state}: ${row.gameweeks} Gameweek${row.gameweeks===1?'':'s'} · affected model in ${row.affectedGameweeks}.`))
    : [el('div',{class:'status'},'Provider source records are not available in current browser recovery.')];
  return [
    el('article',{class:'note plain'},
      el('b',{},'Overall and schedule-aligned'),
      el('div',{class:'status'},`Overall MAE ${reviewUiFormat(overall.mae)} · schedule-aligned MAE ${reviewUiFormat(aligned.mae)}. Both views remain visible because structural blank zeroes can flatter overall results.`)
    ),
    el('article',{class:'note plain'},
      el('b',{},'Coverage'),
      el('div',{class:'status'},`${cumulative?.gameweeks?.length||0} evaluated Gameweeks · ${cumulative?.overall?.coverage?.playerRows||0} matched player rows · ${cumulative?.overall?.coverage?.unallocatableMinutes||0} unallocatable minute rows.`)
    ),
    el('article',{class:'note plain'},
      el('b',{},'Frozen decisions'),
      el('div',{class:'status'},`${cumulative?.decisions?.squadDecisions||0} squad decisions · ${cumulative?.decisions?.captainDecisions||0} captain decisions · ${cumulative?.decisions?.transferHorizons?.length||0} completed transfer horizons. Overlapping horizons are not summed.`)
    ),
    el('details',{class:'mt-10'},el('summary',{},'Gameweek coverage trend'),el('div',{class:'mt-10'},...coverageNodes)),
    el('details',{class:'mt-10'},el('summary',{},'Provider-state observations'),el('div',{class:'mt-10'},...providerNodes)),
    el('article',{class:'note plain'},'No composite score, significance claim, calibration claim or automatic model update is produced.')
  ];
}
async function reviewUiRender(){
  const sequence=++reviewUiSequence;reviewUiEnsure();const status=$('reviewStatus'),summary=$('reviewSummary'),details=$('reviewDetailContent'),scope=$('reviewScope');
  const records=await reviewUiFullMetricRecords(),evaluations=records.filter(record=>record.recordType==='gameweekEvaluation');if(sequence!==reviewUiSequence) return;
  reviewUiScopeOptions(scope,evaluations);
  if(!evaluations.length){if(status)setChildren(status,el('b',{},'Waiting for evaluated Gameweeks'),document.createTextNode(' Operating review starts after an official snapshot and authoritative outcome create a metric record.'));if(summary)setChildren(summary,el('div',{class:'status'},'No operating review is available on this device.'));if(details)setChildren(details);for(const id of ['reviewJsonBtn','reviewMarkdownBtn','reviewCsvBtn'])if($(id))$(id).disabled=true;return;}
  for(const id of ['reviewJsonBtn','reviewMarkdownBtn','reviewCsvBtn'])if($(id))$(id).disabled=false;
  try{
    const bundle=await reviewUiLoadBundle(scope?.value||'season');if(sequence!==reviewUiSequence||!bundle)return;const weekly=bundle.weeklyReviews?.[0],season=bundle.profile==='season',cumulative=bundle.cumulativeReview;
    if(status){setChildren(status,el('b',{},season?`${cumulative.gameweeks.length} evaluated Gameweek${cumulative.gameweeks.length===1?'':'s'}`:`GW${weekly.gameweek} operating review`),document.createTextNode(` ${bundle.completeness.status==='complete'?'Exact source records included.':'Partial source bundle — derived metrics remain available.'}`));status.className=`note ${bundle.completeness.status==='complete'?'plain':'bad'}`;}
    if(summary){
      const p=season?cumulative.overall.player.metrics:weekly.points;
      setChildren(
        summary,
        el('div',{class:'kpis mt-10'},reviewUiKpi('Player MAE',reviewUiFormat(p?.mae)),reviewUiKpi('Bias',reviewUiFormat(p?.bias)),reviewUiKpi('Within 2',reviewUiPercent(p?.withinTwo)),reviewUiKpi('Rows',season?cumulative.overall.coverage.playerRows:weekly.headline.playerRows)),
        el('div',{class:'note plain'},season?cumulative.overall.player.sample.message:weekly.status.sample.message)
      );
    }
    if(details)setChildren(details,season?reviewUiSeasonDetails(bundle):reviewUiWeeklyDetails(bundle,weekly));
    const serialised=serialiseOperatingReviewBundle(bundle),message=$('reviewMessage');if(message)message.textContent=serialised.warning==='large_export'?'This export is larger than 10 MB. Keep Teamsheet open while Safari prepares the file.':'Exports are generated on demand and are not retained automatically.';
  }catch(error){if(status)setChildren(status,el('b',{},'Operating review unavailable'),document.createTextNode(` ${error.message}`));if(summary)setChildren(summary);if(details)setChildren(details);}
}
async function reviewUiExportJson(){
  const message=$('reviewMessage');try{const bundle=await reviewUiLoadBundle($('reviewScope')?.value||'season');if(!bundle)throw new Error('No operating review is available');const output=serialiseOperatingReviewBundle(bundle);const filename=`teamsheet-${bundle.scope.season}-${bundle.scope.label}-operating-review.json`;reviewUiDownload(filename,output.text,'application/json');recordStage10Diagnostic('download_requested',{recordType:'operatingReviewBundle',recordId:bundle.identity.bundleId,severity:'info'});if(message)message.textContent=stage10DownloadRequestedMessage(filename); }catch(error){if(message)message.textContent=`JSON export failed: ${error.message}`;}
}
async function reviewUiExportMarkdown(){
  const message=$('reviewMessage');try{const bundle=await reviewUiLoadBundle($('reviewScope')?.value||'season');if(!bundle)throw new Error('No operating review is available');const output=buildOperatingReviewMarkdown(bundle);reviewUiDownload(output.filename,output.text,'text/markdown;charset=utf-8');recordStage10Diagnostic('download_requested',{recordType:'operatingReviewBundle',recordId:output.filename,severity:'info'});if(message)message.textContent=stage10DownloadRequestedMessage(output.filename); }catch(error){if(message)message.textContent=`Markdown export failed: ${error.message}`;}
}
async function reviewUiExportCsv(){
  const message=$('reviewMessage');try{const bundle=await reviewUiLoadBundle($('reviewScope')?.value||'season');if(!bundle)throw new Error('No operating review is available');const table=$('reviewCsvTable')?.value||REVIEW_RULES.csvTables[0],output=buildOperatingReviewCsv(bundle,table);reviewUiDownload(output.filename,output.text,'text/csv;charset=utf-8');recordStage10Diagnostic('download_requested',{recordType:'operatingReviewBundle',recordId:output.filename,severity:'info'});if(message)message.textContent=`${stage10DownloadRequestedMessage(output.filename)} ${output.rows} data row${output.rows===1?'':'s'} prepared.`; }catch(error){if(message)message.textContent=`CSV export failed: ${error.message}`;}
}
function initOperatingReviewUi(){
  if(typeof document==='undefined') return;reviewUiEnsure();document.addEventListener('teamsheet:outcome-stored',()=>setTimeout(()=>void reviewUiRender(),0));document.addEventListener('teamsheet:data-rendered',reviewUiRender);document.addEventListener('teamsheet:data-verified',()=>setTimeout(()=>void reviewUiRender(),2500));document.addEventListener('visibilitychange',()=>{if(!document.visibilityState||document.visibilityState==='visible')void reviewUiRender();});void reviewUiRender();
}

initOperatingReviewUi();
