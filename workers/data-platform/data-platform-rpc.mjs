import {WorkerEntrypoint} from 'cloudflare:workers';
import httpWorker,{healthOperation,ingestObservationOperation,queryObservationsOperation} from './data-platform.mjs';
import {scheduledOfficialFplHistory} from './official-fpl-history.mjs';

// These RPC entrypoints are retained as historical/rollback surface after DATA-S1C-R.
// DATA-S2A does not use RPC for collection: the scheduled handler uses the Worker's
// existing D1 binding directly.
export class DataPlatformReadEntrypoint extends WorkerEntrypoint{
  health(){return healthOperation();}
  queryObservations(query){return queryObservationsOperation(this.env,query);}
}

export class DataPlatformIngestEntrypoint extends WorkerEntrypoint{
  ingestObservation(observation){return ingestObservationOperation(this.env,observation);}
}

async function scheduled(controller,env){
  return scheduledOfficialFplHistory(controller,env);
}

export default {fetch:httpWorker.fetch,scheduled};
