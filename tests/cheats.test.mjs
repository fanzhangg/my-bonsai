import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {openStore} from '../storage.mjs';
import {createServer} from '../server.mjs';
import {applyCheat,cheatRequest,MAX_CHEAT_HOURS} from '../prototype/cheats.mjs';
import {snapshot,HOUR} from '../prototype/growth.mjs';
import {configForClaim} from '../prototype/claim.mjs';
import {lookFor} from '../prototype/core/v1/appearance.mjs';

test('cheats rebase growth and cuts together, including cuts after a rewound preview',()=>{
 const record={createdAt:100000,config:configForClaim(randomUUID()),cuts:[]};
 const branch=snapshot(record,record.createdAt+100*HOUR).nodes.find(n=>n.role==='primary');
 record.cuts.push({id:randomUUID(),seq:1,branchId:branch.id,at:record.createdAt+80*HOUR});
 for(const hours of [0,24,100,200]){
  const saved=applyCheat(record,cheatRequest(record,hours),2000000000000);
  assert.deepEqual(snapshot(saved,2000000000000),snapshot(record,record.createdAt+hours*HOUR));
  assert.deepEqual(saved.config.pot,record.config.pot);
  assert.equal(saved.cuts[0].at-saved.createdAt,80*HOUR);
 }
});

test('cheat API persists edits, protects concurrent changes, and claims the edited preview atomically',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'bonsai-cheats-')),file=path.join(dir,'trees.json');
 const store=await openStore({url:'',file}),server=createServer(store,{realtimeWeatherEnabled:false});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}/api/trees`;
 const post=async(p,body,headers={})=>{const response=await fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
 try{
  const id=randomUUID(),{data:record}=await post('',{id});
  const edits={...cheatRequest(record,72),preset:'cascade',look:'autumn',seed:'saved-cheat'};
  const {status,data:saved}=await post('/'+id+'/cheats',edits);
  assert.equal(status,200);assert.equal(saved.config.preset,'cascade');assert.equal(saved.config.seed,'saved-cheat');assert.equal(lookFor(saved.config.appearance).id,'autumn');
  assert.deepEqual(saved.config.pot,record.config.pot);assert.equal(saved.revision,1);
  assert.ok(Math.abs((saved.serverNow-saved.createdAt)/HOUR-72)<.001);
  assert.equal((await post('/'+id+'/cheats',edits)).status,409);
  const reopened=await openStore({url:'',file});
  const persisted=await reopened.get(id);assert.deepEqual(persisted.config,saved.config);assert.equal(persisted.createdAt,saved.createdAt);await reopened.close();
  const loaded=await (await fetch(base+'/'+id)).json();assert.deepEqual(loaded.config,saved.config);
  const branch=snapshot(saved).nodes.find(n=>n.role==='primary');
  const cut=await post('/'+id+'/cuts',{id:randomUUID(),branchId:branch.id});assert.equal(cut.status,200);assert.equal(cut.data.revision,2);
  assert.equal((await post('/'+id+'/cheats',cheatRequest(saved,100))).status,409);
  const cutEdit=cheatRequest(cut.data,120);cutEdit.look='moon';
  const editedCut=await post('/'+id+'/cheats',cutEdit);assert.equal(editedCut.status,200);assert.equal(editedCut.data.cuts.length,1);
  assert.ok(!snapshot(editedCut.data).nodes.some(n=>n.id===branch.id));
  const current=cheatRequest(editedCut.data,120);
  const concurrent=await Promise.all([post('/'+id+'/cheats',{...current,seed:'first',cuts:[]}),post('/'+id+'/cheats',{...current,seed:'second',cuts:[]})]);
  assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
  const claimedId=randomUUID(),preview={config:configForClaim(claimedId),createdAt:0,cuts:[]};
  const claimBody={id:claimedId,cheat:{...cheatRequest(preview,48),preset:'broom',seed:'edited-home',look:'golden'}};
  const claimed=await post('',claimBody);assert.equal(claimed.status,201);assert.equal(claimed.data.config.seed,'edited-home');assert.equal(claimed.data.config.preset,'broom');
  assert.deepEqual(claimed.data.config.pot,preview.config.pot);
  const retried=await post('',claimBody);assert.equal(retried.data.createdAt,claimed.data.createdAt);assert.equal(retried.data.revision,claimed.data.revision);
  const badId=randomUUID();assert.equal((await post('',{id:badId,cheat:{}})).status,400);assert.equal(await store.get(badId),undefined);
 }finally{await new Promise(r=>server.close(r));await store.close();await rm(dir,{recursive:true,force:true});}
});

test('invalid cheat fields and cross-origin requests cannot change stored trees',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'bonsai-cheat-validation-')),file=path.join(dir,'trees.json');
 const store=await openStore({url:'',file}),server=createServer(store,{realtimeWeatherEnabled:false});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const id=randomUUID(),record={id,createdAt:Date.now(),config:configForClaim(id),cuts:[]};
 await store.mutate(id,()=>record);
 const base=`http://127.0.0.1:${server.address().port}/api/trees/`;
 const post=(body,headers={},target=id)=>fetch(base+target+'/cheats',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 const valid=cheatRequest(record,24);
 try{
  for(const invalid of [{revision:-1},{revision:'0'},{preset:'bad'},{look:'bad'},{seed:'a'.repeat(65)},{seed:{}},{hours:-1},{hours:MAX_CHEAT_HOURS+1},{hours:null},{hours:'24'},{cuts:{}},{cuts:[{id:randomUUID(),branchId:'missing',hour:0}]},{cuts:[null]}]){
   assert.equal((await post({...valid,...invalid})).status,400,JSON.stringify(invalid));
   assert.deepEqual(await store.get(id),record);
  }
  assert.equal((await post(valid,{Origin:'https://other.example'})).status,403);
  assert.equal((await post(valid,{},randomUUID())).status,404);
  assert.deepEqual(await store.get(id),record);
 }finally{await new Promise(r=>server.close(r));await store.close();await rm(dir,{recursive:true,force:true});}
});

test('rebasing preserves historical watering amounts after growth rate changes',()=>{
 const record={createdAt:100000,config:configForClaim(randomUUID()),cuts:[],waterings:[{id:randomUUID(),at:100000,used:4000,amount:.025}]};
 const saved=applyCheat(record,cheatRequest(record,24),2000000000000);
 assert.equal(saved.waterings[0].amount,.025);
 assert.deepEqual(snapshot(saved,2000000000000),snapshot(record,record.createdAt+24*HOUR));
});

test('rebasing preserves saved larger tanks and recovery from before the slowdown',()=>{
 const record={createdAt:100000,config:configForClaim(randomUUID()),cuts:[],waterings:[{id:randomUUID(),at:100000,used:8000,amount:.2,recoveryHours:48}]};
 const saved=applyCheat(record,cheatRequest(record,24),2000000000000);
 assert.equal(saved.waterings[0].amount,.2);
 assert.equal(saved.waterings[0].recoveryHours,48);
 assert.equal(saved.waterings[0].used,8000);
 const request=cheatRequest(record,24);request.waterings[0].id=randomUUID();
 assert.throws(()=>applyCheat(record,request,2000000000000),{status:400});
});
