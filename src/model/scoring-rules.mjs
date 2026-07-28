import { clamp, num } from '../util.mjs';

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

export { poissonTail, expectedGroupedPoints, expectedThresholdPoints, shrunkRate };
