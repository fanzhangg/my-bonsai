import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {openStore} from '../storage.mjs';
import {createServer} from '../server.mjs';
import {snapshot,wateringRecovery} from '../prototype/growth.mjs';
import {PRESETS} from '../prototype/core/v1/canopy.mjs';
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
  await store.mutate(id,old=>{const at=Date.now(),mature={...old,createdAt:at-1000*3600000},cuts=snapshot(mature,at).nodes.filter(n=>n.role==='primary').map((n,seq)=>({id:randomUUID(),branchId:n.id,seq,at}));return {...mature,cuts};});
  const {data:recovery}=await post('/'+id+'/waterings',{id:randomUUID(),used:4000});
  assert.equal(recovery.waterings.at(-1).recoveryHours,24);
  assert.ok(snapshot(recovery,recovery.serverNow).nodes.some(n=>n.regrown&&n.growth>.1));
  const reloaded=await (await fetch(base+'/'+id)).json();assert.deepEqual(reloaded.waterings,recovery.waterings);
  const cheat=applyCheat(recovery,cheatRequest(recovery,24),recovery.serverNow+100000000);
  assert.equal(cheat.waterings.at(-1).recoveryHours,24);
 }finally{await new Promise(r=>server.close(r));await store.close();await rm(dir,{recursive:true,force:true});}
});

test('watering a bare mature tree visibly extends new shoots without restoring cut branches',()=>{
 for(const {id:preset} of PRESETS){
  const at=2000000000000,base={createdAt:at-1000*3600000,config:{preset,seed:'bare-watering'},cuts:[]};
  const mature=snapshot(base,at),cutIds=mature.nodes.filter(n=>n.role==='primary').map(n=>n.id);
  const bare={...base,cuts:cutIds.map((branchId,seq)=>({branchId,seq,at}))};
  const before=snapshot(bare,at);assert.equal(before.clusters.length,0);
  const watered={...bare,waterings:[{at:at+1,amount:.0125,recoveryHours:wateringRecovery(before,2000)}]};
  const half=snapshot(watered,at+1);
  assert.ok(half.nodes.some(n=>n.regrown&&Math.hypot(n.ex-n.x,n.ey-n.y)>2),preset);
  assert.ok(!half.nodes.some(n=>cutIds.includes(n.id)));
  assert.deepEqual(half.nodes.filter(n=>!n.regrown),before.nodes);
  assert.deepEqual(snapshot(watered,at-1),snapshot(bare,at-1));
  assert.equal(wateringRecovery(mature,4000),0);
  assert.deepEqual(replayFrame(watered,at+1,1),half);
 }
});
