import {WorkerEntrypoint} from 'cloudflare:workers';
import httpWorker,{healthOperation,ingestObservationOperation,queryObservationsOperation} from './data-platform.mjs';

// Separate entrypoints keep read-only callers incapable of invoking ingestion.
// Every method delegates to the same operation functions used by the HTTP adapter.
export class DataPlatformReadEntrypoint extends WorkerEntrypoint{
  health(){return healthOperation();}
  queryObservations(query){return queryObservationsOperation(this.env,query);}
}

export class DataPlatformIngestEntrypoint extends WorkerEntrypoint{
  ingestObservation(observation){return ingestObservationOperation(this.env,observation);}
}

export default httpWorker;
