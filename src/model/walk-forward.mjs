const DEFAULT_WALK_FORWARD = Object.freeze({
  minTrainingGameweeks: 8,
  calibrationGameweeks: 4,
  holdoutGameweeks: 1,
  stepGameweeks: 1,
  minimumHoldoutRows: 1,
  calibrationMin: 0.7,
  calibrationMax: 1.3,
  predictionBands: Object.freeze([0,2,4,6,10,Infinity])
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

export function validateDatasetPin(pin = {}){
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

export function normaliseObservations(input){
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

export function buildWalkForwardFolds(observations, options = {}){
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

export function fitPositionCalibration(rows, options = {}){
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

export function applyPositionCalibration(rows, calibration, variant='fold_calibrated'){
  return normaliseObservations(rows).map(row=>({...row,
    predicted: row.predicted * Number(calibration[row.position] ?? 1), variant
  }));
}

export function pearson(xs,ys){
  if(xs.length !== ys.length || xs.length < 3) return null;
  const mx=xs.reduce((a,b)=>a+b,0)/xs.length, my=ys.reduce((a,b)=>a+b,0)/ys.length;
  let sxy=0,sxx=0,syy=0;
  for(let i=0;i<xs.length;i++){
    const dx=xs[i]-mx,dy=ys[i]-my;
    sxy+=dx*dy;sxx+=dx*dx;syy+=dy*dy;
  }
  return sxx && syy ? sxy/Math.sqrt(sxx*syy) : null;
}

export function metricSummary(rows){
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

export function segmentedMetrics(rows, options = {}){
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

export function compareAblations(rows){
  const clean = normaliseObservations(rows);
  const variants = [...new Set(clean.map(row=>row.variant))].sort();
  const keySets = variants.map(variant=>new Set(clean.filter(row=>row.variant===variant).map(row=>`${row.gameweek}|${row.playerId}`)));
  if(keySets.length > 1){
    const base = [...keySets[0]].sort().join(',');
    for(let i=1;i<keySets.length;i++) if([...keySets[i]].sort().join(',') !== base) throw new Error('ablation variants must use identical holdout keys');
  }
  return Object.fromEntries(variants.map(variant=>[variant,segmentedMetrics(clean.filter(row=>row.variant===variant))]));
}

export function stableResult(result){
  const sortObject = value => {
    if(Array.isArray(value)) return value.map(sortObject);
    if(value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key=>[key,sortObject(value[key])]));
    if(typeof value === 'number' && Number.isFinite(value)) return Number(value.toFixed(8));
    return value;
  };
  return JSON.stringify(sortObject(result));
}

export function evaluateWalkForward(observations, meta = {}, options = {}){
  const pin = validateDatasetPin(meta.dataset);
  if(!pin.ok) throw new Error(`dataset is not pinned: ${pin.issues.join(', ')}`);
  const {config,folds} = buildWalkForwardFolds(observations,options);
  if(!folds.length) throw new Error('insufficient chronological data for walk-forward evaluation');
  const foldResults = folds.map(fold=>({
    index:fold.index,
    trainGameweeks:fold.trainGameweeks,
    calibrationGameweeks:fold.calibrationGameweeks,
    holdoutGameweeks:fold.holdoutGameweeks,
    metrics:segmentedMetrics(fold.holdout)
  }));
  const allHoldout = folds.flatMap(fold=>fold.holdout);
  return {
    method:'deadline-information-only walk-forward',
    config,
    dataset:{...pin,rows:Number(meta.dataset.rows ?? observations.length),malformedRows:Number(meta.dataset.malformedRows ?? 0)},
    oddsHistory:meta.oddsHistory === true ? 'logged_pre_deadline' : 'not_available',
    folds:foldResults,
    aggregate:segmentedMetrics(allHoldout),
    ablations:compareAblations(allHoldout)
  };
}

export { DEFAULT_WALK_FORWARD };