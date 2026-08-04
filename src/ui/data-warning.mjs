import { S } from '../state.mjs';
import { $, el, setChildren } from '../util.mjs';
import { getHealth, HEALTH_STATES } from '../providers/registry.mjs';

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

export {
  MATERIAL_SAVED_FPL_STATES,
  materialDataAgeLabel,
  fplDataWarningModel,
  currentFplDataWarning,
  renderGlobalDataWarning,
  renderRouteDataWarning
};
