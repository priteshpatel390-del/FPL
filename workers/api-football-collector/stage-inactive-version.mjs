import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {EXPECTED_D1_DATABASE_ID} from '../data-platform/phase4b/live-contract.mjs';

export const WORKER_NAME='teamsheet-api-football-shadow-collector';
export const CONFIG_PATH='workers/api-football-collector/wrangler.jsonc';
export const ENTRY_PATH='workers/api-football-collector/collector.mjs';
export const ENTRY_MODULE='collector.mjs';
export const EXPECTED_COMPATIBILITY_DATE='2026-09-16';
export const EXPECTED_DATABASE_NAME='teamsheet-data';
export const EXPECTED_BINDING_NAME='TEAMSHEET_DATA_DB';
export const EXPECTED_ACTIVATION='REPOSITORY_ONLY_BLOCKED';
export const EXPECTED_PLAIN_TEXT_VARS=Object.freeze({
  API_FOOTBALL_FPL_SEASON:'2026-27',
  API_FOOTBALL_PROVIDER_SEASON:'2026',
  EIA_2I5D_ACTIVATION:EXPECTED_ACTIVATION
});
export const REVIEWED_MODULE_PATHS=Object.freeze([
  'src/decision-intelligence/api-football-discovery.mjs',
  'src/decision-intelligence/api-football-foundation.mjs',
  'src/decision-intelligence/api-football-owner-mapping.mjs',
  'src/decision-intelligence/api-football-prelive-qualification.mjs',
  'src/decision-intelligence/api-football-shadow-contracts.mjs',
  'src/decision-intelligence/canonical.mjs',
  'src/decision-intelligence/eia1-safety.mjs',
  'src/decision-intelligence/eia1-workload-contract.mjs',
  'src/decision-intelligence/observation.mjs',
  'src/decision-intelligence/official-fpl-history-canonical.mjs',
  'src/decision-intelligence/rights.mjs',
  'workers/api-football-collector/activation-orchestrator.mjs',
  'workers/api-football-collector/collector.mjs',
  'workers/api-football-collector/d1-persistence.mjs',
  'workers/api-football-collector/mapping-persistence.mjs',
  'workers/api-football-collector/planner-orchestrator.mjs',
  'workers/api-football-collector/runtime-contracts.mjs',
  'workers/api-football-collector/scheduler.mjs',
  'workers/api-football-collector/semantic-validation.mjs'
]);

const API_BASE='https://api.cloudflare.com/client/v4';
const CONFIG_KEYS=Object.freeze(['$schema','name','main','compatibility_date','workers_dev','preview_urls','observability','vars','triggers','d1_databases']);
const STATIC_SPECIFIER=/\