import {WorkerEntrypoint} from 'cloudflare:workers';

// Repository-only acceptance caller. Its binding is read-only and it owns no storage.
export default class DataPlatformAcceptanceCaller extends WorkerEntrypoint{
  async fetch(){return new Response(null,{status:404});}
  async health(){return await this.env.DATA_PLATFORM_READ.health();}
  async queryObservations(query){return await this.env.DATA_PLATFORM_READ.queryObservations(query);}
}
