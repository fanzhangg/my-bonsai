import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {openStore} from '../storage.mjs';
import {createServer} from '../server.mjs';
import {snapshot} from '../prototype/growth.mjs';
import {replayFrame} from '../prototype/playback.mjs';
import {applyCheat,cheatRequest} from '../prototype/cheats.mjs';
test('partial and full watering persist, replay consistently, and retries never duplicate growth',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'bonsai-watering-')),file=path.join(dir,'trees.json');
 const store=await openStore({url:'',file}),server=createServer(store,{realtimeWeatherEnabled:false});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port+'/api/trees';
 const post=async(p,body)=>{const r=await fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 try{
  const id=randomUUID(),{data:before}=await post('',{id});
  for(const used of [-1,0,4001,'100',null])assert.equal((await post('/'+id+'/waterings',{id:randomUUID(),used})).status,400);
  const operation={id:randomUUID(),used:1200};
  const results=await Promise.all([post('/'+id+'/waterings',operation),post('/'+id+'/waterings',operation)]);
  assert.ok(results.every(r=>r.status===200&&r.data.waterings.length===1));
  assert.equal((await post('/'+id+'/waterings',{...operation,used:4000})).status,409);
  const {data:after,status}=await post('/'+id+'/waterings',{id:randomUUID(),used:4000});assert.equal(status,200);
  assert.equal(after.waterings.length,2);
  const at=after.serverNow;
  assert.ok(Math.abs(snapshot(after,at).progress-snapshot(before,at).progress-.0325)<1e-10);
  assert.deepEqual(replayFrame(after,at,1),snapshot(after,at));
  assert.deepEqual(snapshot(after,before.createdAt-1),snapshot(before,before.createdAt-1));
  const saved=applyCheat(after,cheatRequest(after,24),at+100000000);
  assert.deepEqual(saved.waterings.map(w=>w.amount),after.waterings.map(w=>w.amount));
  const reopened=await openStore({url:'',file});assert.deepEqual((await reopened.get(id)).waterings,after.waterings);await reopened.close();
  const gallery=await (await fetch(base.replace('/trees','/gallery'))).json();assert.equal(gallery.trees.find(t=>t.id===id).waterings.length,2);
 }finally{await new Promise(r=>server.close(r));await store.close();await rm(dir,{recursive:true,force:true});}
});
