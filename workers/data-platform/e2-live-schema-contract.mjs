import {createHash} from 'node:crypto';
import {E2_APPROVED_TABLES} from './e2-d1-rest-validation-plan.mjs';

const PRODUCTION_TABLES=new Set(['shadow_observations','observation_heads','canonical_entities','ingestion_runs','data_sources','data_source_revisions']);
export const E2_PERMITTED_INITIAL_SYSTEM_OBJECTS=Object.freeze(['sqlite_sequence']);
const clean=value=>value===null?null:String(value);
export function canonicalizeLiveSchema(metadata){
  if(!Array.isArray(metadata))throw new Error('e2_live_schema_metadata_invalid');
  const tables=metadata.map(table=>({
    name:clean(table.name),sql:clean(table.sql),
    columns:[...(table.columns||[])].map(column=>({cid:Number(column.cid),name:clean(column.name),type:clean(column.type),notnull:Number(column.notnull),default:clean(column.dflt_value),pk:Number(column.pk),hidden:Number(column.hidden||0)})).sort((a,b)=>a.cid-b.cid),
    indexes:[...(table.indexes||[])].map(index=>({name:clean(index.name),unique:Number(index.unique),origin:clean(index.origin),partial:Number(index.partial||0),columns:[...(index.columns||[])].map(column=>({seqno:Number(column.seqno),cid:Number(column.cid),name:clean(column.name),desc:Number(column.desc||0),coll:clean(column.coll),key:Number(column.key??1)})).sort((a,b)=>a.seqno-b.seqno)})).sort((a,b)=>a.name.localeCompare(b.name)),
    foreignKeys:[...(table.foreignKeys||[])].map(fk=>({id:Number(fk.id),seq:Number(fk.seq),table:clean(fk.table),from:clean(fk.from),to:clean(fk.to),on_update:clean(fk.on_update),on_delete:clean(fk.on_delete),match:clean(fk.match)})).sort((a,b)=>a.id-b.id||a.seq-b.seq)
  })).sort((a,b)=>a.name.localeCompare(b.name));
  return JSON.stringify(tables);
}
export const deriveLiveSchemaFingerprint=metadata=>`sha256:${createHash('sha256').update(canonicalizeLiveSchema(metadata)).digest('hex')}`;
export function validateInitialLiveObjects(objects){
  if(!Array.isArray(objects))throw new Error('e2_initial_objects_invalid');
  for(const object of objects){const name=object?.name,type=object?.type;if(PRODUCTION_TABLES.has(name))throw new Error('e2_production_schema_rejected');if(type!=='table'||!E2_PERMITTED_INITIAL_SYSTEM_OBJECTS.includes(name))throw new Error('e2_initial_schema_unexpected_object');}
  if(new Set(objects.map(row=>row.name)).size!==objects.length)throw new Error('e2_initial_schema_unexpected_object');return true;
}
export function validateSetupLiveSchema(metadata){const names=metadata?.map(row=>row.name);if(!Array.isArray(names)||names.length!==E2_APPROVED_TABLES.length||new Set(names).size!==names.length||E2_APPROVED_TABLES.some(name=>!names.includes(name)))throw new Error('e2_setup_schema_tables_mismatch');return deriveLiveSchemaFingerprint(metadata);}

