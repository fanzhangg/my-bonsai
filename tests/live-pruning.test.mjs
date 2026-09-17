import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {openStore} from '../storage.mjs';
import {createServer} from '../server.mjs';
import {snapshot,VERSION,HOUR} from '../prototype/growth.mjs';
import {replayFrame} from '../prototype/playback.mjs';
import {PRESETS} from '../prototype/core/v1/canopy.mjs';
import {branchFamily} from '../prototype/pruning-model.mjs';

test('persisted cuts remove current and future descendants, preserve geometry and leave no scars',()=>{
 for(const {id:preset} of PRESETS){
  const record={version:VERSION,createdAt:100000,config:{preset,seed:'live-pruning'},cuts:[]};
  const at=record.createdAt+HOUR,before=snapshot(record,at),branch=before.nodes.find(n=>n.role==='primary');
  const mature=snapshot(record,at+300*HOUR),family=branchFamily(mature.nodes,branch.id);
  const cut={...record,cuts:[{id:randomUUID(),at,branchId:branch.id}]};
  assert.deepEqual(snapshot(cut,at-1),snapshot(record,at-1));
  for(const time of [at,at+300*HOUR]){
   const original=snapshot(record,time),after=snapshot(cut,time);
   assert.deepEqual(after.nodes,original.nodes.filter(n=>!family.has(n.id)));
   assert.deepEqual(after.clusters,original.clusters.filter(c=>!family.has(c.node)));
   assert.deepEqual(after.scars,[]);
   assert.deepEqual(replayFrame(cut,time,1),after);
  }
  const trunk=before.nodes.find(n=>n.role==='trunk');
  assert.deepEqual(snapshot({...record,cuts:[{at,branchId:trunk.id}]},at),before);
 }
});

test('live cuts validate on the server, serialize concurrent requests and survive reopening storage',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'bonsai-pruning-')),file=path.join(dir,'trees.json');
 const store=await openStore({url:'',file}),server=createServer(store,{realtimeWeatherEnabled:false});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}/api/trees`;
 const post=async(p,body,headers={})=>{const r=await fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 try{
  const id=randomUUID();const {data:record}=await post('',{id});
  const tree=snapshot(record),branches=tree.nodes.filter(n=>n.role==='primary'),trunk=tree.nodes.find(n=>n.role==='trunk');
  assert.ok(branches.length>=2);
  assert.equal((await post('/'+id+'/cuts',{id:randomUUID(),branchId:trunk.id})).status,409);
  assert.equal((await post('/'+id+'/cuts',{id:randomUUID(),branchId:'missing'})).status,409);
  assert.equal((await post('/'+id+'/cuts',{id:'bad',branchId:branches[0].id})).status,400);
  assert.equal((await post('/'+randomUUID()+'/cuts',{id:randomUUID(),branchId:branches[0].id})).status,404);
  assert.equal((await post('/'+id+'/cuts',{id:randomUUID(),branchId:branches[0].id},{Origin:'https://other.example'})).status,403);
  const operation={id:randomUUID(),branchId:branches[0].id};
  const responses=await Promise.all([post('/'+id+'/cuts',operation),post('/'+id+'/cuts',operation)]);
  assert.ok(responses.every(r=>r.status===200&&r.data.cuts.length===1));
  assert.equal((await post('/'+id+'/cuts',{...operation,branchId:branches[1].id})).status,409);
  assert.equal((await post('/'+id+'/cuts',{id:randomUUID(),branchId:branches[0].id})).status,409);
  const second=await post('/'+id+'/cuts',{id:randomUUID(),branchId:branches[1].id});
  assert.equal(second.status,200);assert.equal(second.data.cuts.length,2);
  const reopened=await openStore({url:'',file});
  const saved=await reopened.get(id);assert.deepEqual(saved.cuts,second.data.cuts);
  assert.ok(!snapshot(saved).nodes.some(n=>branches.slice(0,2).some(b=>b.id===n.id)));
  await reopened.close();
 }finally{await new Promise(r=>server.close(r));await store.close();await rm(dir,{recursive:true,force:true});}
});
