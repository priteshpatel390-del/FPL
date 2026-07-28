import { GOAL_PTS, CS_PTS, ASSIST_PTS, DC_THRESH, BASE_GOALS } from '../config.mjs';
import { clamp } from '../util.mjs';

export const ARCHIVE_DATASET = Object.freeze({
  season: '2025-26',
  sourceRef: 'f9ed3e8839b0f970e0d5d4a83c5628f6eaee755a',
  url: 'https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/f9ed3e8839b0f970e0d5d4a83c5628f6eaee755a/data/2025-26/gws/merged_gw.csv'
});

const REQUIRED = Object.freeze([
  'element','position','GW','minutes','total_points','expected_goals',
  'expected_assists','saves','bps','yellow_cards'
]);
const POSMAP = Object.freeze({GK:1,GKP:1,DEF:2,MID:3,FWD:4});

export function parseArchiveCSV(text){
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

export async function sha256Hex(text){
  const subtle=globalThis.crypto?.subtle;
  if(!subtle) throw new Error('SHA-256 is unavailable in this environment');
  const bytes=new TextEncoder().encode(text);
  const digest=await subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
}

function numeric(value){
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

export function buildArchiveReplay(text){
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
    const minutes=numeric(get(raw,'minutes'));
    const actual=numeric(get(raw,'total_points'));
    if(!Number.isInteger(playerId)||!Number.isInteger(gameweek)||!position||minutes===null||actual===null){malformedRows++;continue;}
    const key=`${gameweek}|${playerId}`;
    const aggregate=grouped.get(key)||{
      playerId,gameweek,position,minutes:0,actual:0,xg:0,xa:0,saves:0,bps:0,dc:0,yc:0
    };
    if(aggregate.position!==position){malformedRows++;continue;}
    aggregate.minutes+=minutes;
    aggregate.actual+=actual;
    aggregate.xg+=numeric(get(raw,'expected_goals'))??0;
    aggregate.xa+=numeric(get(raw,'expected_assists'))??0;
    aggregate.saves+=numeric(get(raw,'saves'))??0;
    aggregate.bps+=numeric(get(raw,'bps'))??0;
    aggregate.dc+=numeric(get(raw,'defensive_contribution'))??0;
    aggregate.yc+=numeric(get(raw,'yellow_cards'))??0;
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
