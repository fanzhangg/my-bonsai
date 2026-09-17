import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {openStore} from '../storage.mjs';
import {createServer} from '../server.mjs';
import {snapshot,HOUR,VERSION} from '../prototype/growth.mjs';
import {replayFrame} from '../prototype/playback.mjs';
import {configForClaim} from '../prototype/claim.mjs';
test('each fresh claim ID previews a different seed and reproduces the same tree',()=>{
 const a=randomUUID(),b=randomUUID();assert.notEqual(configForClaim(a).seed,configForClaim(b).seed);assert.deepEqual(configForClaim(a),configForClaim(a));
});
test('opening replay includes initial growth and ends at the exact current snapshot',()=>{
 const record={version:VERSION,createdAt:100000,config:{seed:'replay',preset:'broom'},cuts:[]};
 for(const elapsed of [0,24,72,200]){const end=record.createdAt+elapsed*HOUR;assert.equal(replayFrame(record,end,0).hour,0);assert.deepEqual(replayFrame(record,end,1),snapshot(record,end));assert(replayFrame(record,end,.5).hour<snapshot(record,end).hour);}
});
test('anonymous claim is durable and idempotent; old links work and mutation routes are disabled',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'bonsai-observe-')),file=path.join(dir,'trees.json');const store=await openStore({url:'',file}),server=createServer(store);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const request=async(p,body)=>{const r=await fetch(base+'/api/trees'+p,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
 try{const id=randomUUID(),first=await request('',{id});assert.equal(first.status,201);assert.deepEqual(first.data.config,configForClaim(id));assert(!('participants' in first.data));assert(!('name' in first.data));const again=await request('',{id});assert.deepEqual(first.data.config,again.data.config);assert.equal(first.data.createdAt,again.data.createdAt);assert.equal((await request('/'+id)).data.id,id);assert.equal((await request('/'+id+'/cuts',{})).status,410);assert.equal((await request('/'+id+'/join',{})).status,410);assert.equal((await request('/bad')).status,404);const reopened=await openStore({url:'',file});assert.equal((await reopened.get(id)).id,id);await reopened.close();
 const legacy=randomUUID();await store.mutate(legacy,()=>({...first.data,id:legacy,participants:[{name:'旧称呼'}]}));assert.equal((await request('/'+legacy)).status,200);assert(!('participants' in (await request('/'+legacy)).data));
 }finally{await new Promise(r=>server.close(r));await store.close();await rm(dir,{recursive:true,force:true});}
});
