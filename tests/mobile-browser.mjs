// Manual responsive/performance review with disposable local data; never reads .env.
// Run: node tests/mobile-browser.mjs
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {openStore} from '../storage.mjs';
import {createServer} from '../server.mjs';
import {configForClaim} from '../prototype/claim.mjs';
import {CURRENT_VERSION} from '../prototype/tree-versions.mjs';

const dir=await mkdtemp(path.join(tmpdir(),'bonsai-mobile-review-'));
const store=await openStore({url:'',file:path.join(dir,'trees.json')});
const now=Date.now(),ids=[];
for(let i=0;i<30;i++){
 const id=randomUUID();ids.push(id);
 await store.mutate(id,()=>({id,name:'密集盆栽 '+(i+1),version:CURRENT_VERSION,createdAt:now-1000*3600000,
  config:{...configForClaim('mobile-perf-'+i,CURRENT_VERSION),density:.8},cuts:[],revision:0,lastVisitedAt:now-i}));
}
const server=createServer(store,{realtimeWeatherEnabled:false,publicBaseUrl:'http://localhost'});
const application=server.listeners('request')[0];server.removeAllListeners('request');
server.on('request',async(req,res)=>{
 if(req.url==='/__review'){
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
  res.end((await readFile(new URL('./mobile-browser.html',import.meta.url),'utf8')).replaceAll('__TREE__',ids[3]));
 }else application(req,res);
});
server.listen(0,'127.0.0.1',()=>console.log(`Mobile review: http://127.0.0.1:${server.address().port}/__review`));
let closing=false;
const close=()=>{if(closing)return;closing=true;server.close(async()=>{await store.close();await rm(dir,{recursive:true,force:true});process.exit(0);});};
process.on('SIGINT',close);process.on('SIGTERM',close);
