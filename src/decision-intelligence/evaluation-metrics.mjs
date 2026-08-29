function pairs(rows,metric){return rows.map(row=>[row.prediction?.[metric.predictionField],row.outcome?.[metric.outcomeField]]).filter(([p,o])=>Number.isFinite(p)&&Number.isFinite(o));}
const rounded=value=>Number(value.toFixed(12));
export function evaluateMetric(rows,metric){
  const values=pairs(rows,metric),n=values.length;
  if(metric.adapter==='calibration'){
    const bins=metric.binEdges.slice(0,-1).map((lower,index)=>{const upper=metric.binEdges[index+1],items=values.filter(([p])=>p>=lower&&(index===metric.binEdges.length-2?p<=upper:p<upper));return {lower,upper,count:items.length,meanPrediction:items.length?rounded(items.reduce((s,[p])=>s+p,0)/items.length):null,observedFrequency:items.length?rounded(items.reduce((s,[,o])=>s+o,0)/items.length):null};});
    const ece=n?rounded(bins.reduce((sum,bin)=>sum+(bin.count/n)*Math.abs(bin.meanPrediction-bin.observedFrequency),0)):null;
    return {metricId:metric.metricId,adapter:metric.adapter,version:metric.version,sampleCount:n,value:ece,bins};
  }
  const errors=values.map(([p,o])=>p-o); let value=null;
  if(n&&metric.adapter==='brier')value=errors.reduce((s,e)=>s+e*e,0)/n;
  if(n&&metric.adapter==='mae')value=errors.reduce((s,e)=>s+Math.abs(e),0)/n;
  if(n&&metric.adapter==='rmse')value=Math.sqrt(errors.reduce((s,e)=>s+e*e,0)/n);
  return {metricId:metric.metricId,adapter:metric.adapter,version:metric.version,sampleCount:n,value:value===null?null:rounded(value)};
}
