import {createHash} from 'node:crypto';

const PRODUCTION_TABLES=new Set(['shadow_observations','observation_heads','canonical_entities','ingestion_runs','data_sources','data_source_revisions']);
export const E2_PERMITTED_INITIAL_SYSTEM_OBJECTS=Object.freeze(['sqlite_sequence']);
const clean=value=>value===null?null:String(value);
const column=(cid,name,type,notnull=0,dflt_value=null,pk=0)=>({cid,name,type,notnull,dflt_value,pk,hidden:0});
const index=(unique,origin,columns)=>({unique,origin,partial:0,columns:columns.map(([cid,name],seqno)=>({seqno,cid,name,desc:0,coll:'BINARY',key:1}))});
const table=(name,columns,indexes=[],foreignKeys=[],checks=[])=>({name,columns,indexes,foreignKeys,checks});

/** Repository-owned expectation; it is not derived from observed live metadata or raw live DDL. */
export const E2_EXPECTED_SEMANTIC_SCHEMA=Object.freeze([
  table('e2_atomicity',[column(0,'run_id','TEXT',1,null,1),column(1,'sequence_no','INTEGER',1,null,2),column(2,'marker','TEXT',1),column(3,'valid_value','INTEGER',1)],
    [index(1,'pk',[[0,'run_id'],[1,'sequence_no']]),index(1,'u',[[0,'run_id'],[2,'marker']])],[],['valid_value in (0,1)']),
  table('e2_entities',[column(0,'entity_id','TEXT',0,null,1),column(1,'kind','TEXT',1),column(2,'created_at','TEXT',1)],
    [index(1,'pk',[[0,'entity_id']])],[],["kind in ('event','team','player','fixture')"]),
  table('e2_heads',[column(0,'logical_key','TEXT',0,null,1),column(1,'observation_id','TEXT',1)],
    [index(1,'pk',[[0,'logical_key']])],[{id:0,seq:0,table:'e2_observations',from:'observation_id',to:'observation_id',on_update:'NO ACTION',on_delete:'NO ACTION',match:'NONE'}]),
  table('e2_observations',[column(0,'observation_id','TEXT',0,null,1),column(1,'logical_key','TEXT',1),column(2,'value_number','REAL'),column(3,'value_text','TEXT'),column(4,'value_boolean','INTEGER')],
    [index(1,'pk',[[0,'observation_id']]),index(1,'u',[[1,'logical_key']])],[],['value_boolean is null or value_boolean in (0,1)']),
  table('e2_runs',[column(0,'run_id','TEXT',0,null,1),column(1,'status','TEXT',1),column(2,'records_accepted','INTEGER',1,'0')],
    [index(1,'pk',[[0,'run_id']])],[],["status in ('started','completed')",'records_accepted >= 0'])
]);

const normalizeCheck=value=>String(value).toLowerCase().replace(/["`\[\]]/g,'').replace(/\s+/g,' ').replace(/\s*([(),])\s*/g,'$1').trim();
function checksFromSql(sql){
  const source=String(sql||''),out=[];for(let at=0;(at=source.toLowerCase().indexOf('check',at))!==-1;){let open=source.indexOf('(',at+5);if(open<0)break;let depth=1,i=open+1;for(;i<source.length&&depth;i++){if(source[i]==='(')depth++;else if(source[i]===')')depth--;}if(depth)throw new Error('e2_live_schema_check_invalid');out.push(normalizeCheck(source.slice(open+1,i-1)));at=i;}return out.sort();
}
function canonicalTable(table){
  return {name:clean(table.name),
    columns:[...(table.columns||[])].map(value=>({cid:Number(value.cid),name:clean(value.name),type:clean(value.type)?.toUpperCase(),notnull:Number(value.notnull),dflt_value:clean(value.dflt_value),pk:Number(value.pk),hidden:Number(value.hidden||0)})).sort((a,b)=>a.cid-b.cid),
    indexes:[...(table.indexes||[])].map(value=>({unique:Number(value.unique),origin:clean(value.origin),partial:Number(value.partial||0),columns:[...(value.columns||[])].filter(column=>Number(column.key??1)===1).map(column=>({seqno:Number(column.seqno),cid:Number(column.cid),name:clean(column.name),desc:Number(column.desc||0),coll:clean(column.coll),key:1})).sort((a,b)=>a.seqno-b.seqno)})).sort((a,b)=>a.origin.localeCompare(b.origin)||JSON.stringify(a.columns).localeCompare(JSON.stringify(b.columns))),
    foreignKeys:[...(table.foreignKeys||[])].map(value=>({id:Number(value.id),seq:Number(value.seq),table:clean(value.table),from:clean(value.from),to:clean(value.to),on_update:clean(value.on_update),on_delete:clean(value.on_delete),match:clean(value.match)})).sort((a,b)=>a.id-b.id||a.seq-b.seq),
    checks:(Array.isArray(table.checks)?table.checks.map(normalizeCheck):checksFromSql(table.sql)).sort()};
}
export function canonicalizeLiveSchema(metadata){if(!Array.isArray(metadata))throw new Error('e2_live_schema_metadata_invalid');return JSON.stringify(metadata.map(canonicalTable).sort((a,b)=>a.name.localeCompare(b.name)));}
export const deriveLiveSchemaFingerprint=metadata=>`sha256:${createHash('sha256').update(canonicalizeLiveSchema(metadata)).digest('hex')}`;
export const E2_EXPECTED_SEMANTIC_SCHEMA_FINGERPRINT=deriveLiveSchemaFingerprint(E2_EXPECTED_SEMANTIC_SCHEMA);
export function validateInitialLiveObjects(objects){if(!Array.isArray(objects))throw new Error('e2_initial_objects_invalid');for(const object of objects){const {name,type}=object||{};if(PRODUCTION_TABLES.has(name))throw new Error('e2_production_schema_rejected');if(type!=='table'||!E2_PERMITTED_INITIAL_SYSTEM_OBJECTS.includes(name))throw new Error('e2_initial_schema_unexpected_object');}if(new Set(objects.map(row=>row.name)).size!==objects.length)throw new Error('e2_initial_schema_unexpected_object');return true;}
export function validateSetupLiveSchema(metadata){const observed=deriveLiveSchemaFingerprint(metadata);if(observed!==E2_EXPECTED_SEMANTIC_SCHEMA_FINGERPRINT)throw new Error('e2_setup_schema_semantic_mismatch');return observed;}
