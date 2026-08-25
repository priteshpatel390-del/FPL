import {WorkerEntrypoint} from 'cloudflare:workers';

// Repository-only acceptance caller. Its binding is read-only and it owns no storage.
export default class DataPlatformAcceptanceCaller extends WorkerEntrypoint{
  health(){return this.env.DATA_PLATFORM_READ.health();}
  queryObservations(query){return this.env.DATA_PLATFORM_READ.queryObservations(query);}
}
