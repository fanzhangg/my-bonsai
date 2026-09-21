import {Worker} from 'node:worker_threads';
import {createHash} from 'node:crypto';
import {colorsFor} from './prototype/core/v1/appearance.mjs';
import {PALETTES,selection} from './prototype/core/v3/bonsai-language.mjs';
import {treeVersion,CURRENT_VERSION} from './prototype/tree-versions.mjs';

export function galleryPaper(record){
 const scene=treeVersion(record)===CURRENT_VERSION?PALETTES[selection(record.config).palette].scene:undefined;
 const background=scene?.background??colorsFor(record.config.appearance).background;
 return background==='#faf9f3'?'#e8dccb':background;
}

export const THUMBNAIL_TTL=3600000;
export function thumbnailKey(record){
 return createHash('sha256').update(JSON.stringify([1,record.version,record.createdAt,record.config,record.cuts,record.leafTrims??[],record.waterings??[]])).digest('hex');
}
function render(record,at){
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./gallery-thumbnail-worker.mjs',import.meta.url),{workerData:{record,at}});
  const timer=setTimeout(()=>{void worker.terminate();reject(new Error('Thumbnail timed out'));},30000);
  worker.once('message',image=>resolve({...image,png:Buffer.from(image.png)}));
  worker.once('error',reject);
  worker.once('exit',code=>{clearTimeout(timer);if(code!==0)reject(new Error('Thumbnail worker exited'));});
 });
}
// Persistent images survive process restarts. One render at a time, shared by
// concurrent requests; stale images remain readable even if regeneration fails.
export function createGalleryThumbnails(store,{renderImage=render,now=Date.now}={}){
 const pending=new Map();let queue=Promise.resolve();
 function refresh(record){
  if(pending.has(record.id))return pending.get(record.id);
  if(pending.size>=64)return Promise.reject(new Error('Thumbnail queue full'));
  const job=queue.then(async()=>{
   const at=now(),image=await renderImage(record,at);
   const result={...image,key:thumbnailKey(record),generatedAt:at};
   await store.putThumbnail(record.id,result);return result;
  });
  pending.set(record.id,job);
  queue=job.catch(()=>{}).finally(()=>pending.delete(record.id));
  return job;
 }
 return {async get(record){
  const cached=await store.getThumbnail(record.id);
  if(cached){
   if(cached.key!==thumbnailKey(record)||now()-cached.generatedAt>=THUMBNAIL_TTL)void refresh(record).catch(()=>{});
   return cached;
  }
  return refresh(record);
 },async idle(){await queue;}};
}
