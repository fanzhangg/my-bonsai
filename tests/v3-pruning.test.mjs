import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {snapshot,HOUR,draw} from '../prototype/growth.mjs';
import {grow as oldGrow} from '../prototype/core/v2/growth.mjs';
import {generate} from '../prototype/core/v3/runtime.mjs';
import {normalizeDesign,FORMS} from '../prototype/core/v3/config.mjs';
import {CURRENT_VERSION} from '../prototype/tree-versions.mjs';
import {branchFamily,canPrune,pruningPoints,pruningTarget,CUT_MODEL} from '../prototype/pruning-model.mjs';
import {applyCheat,cheatRequest,branchTimeline,futureOperations} from '../prototype/cheats.mjs';
import {createServer} from '../server.mjs';
import {openStore} from '../storage.mjs';


const recordFor=(preset='juniper')=>({version:CURRENT_VERSION,createdAt:0,config:normalizeDesign({preset,seed:'state-integration'}),cuts:[]});
const cut=(r,n,at)=>r.cuts.push({id:randomUUID(),seq:r.cuts.length+1,branchId:n.id,at,model:'state-1'});
const matureAt=200*HOUR;

test('occluded windswept branches and all v3 forms remain individually reachable at phone and desktop scales',()=>{
 for(const {id:preset}of FORMS){
  const r={...recordFor(preset),config:normalizeDesign({preset,seed:'ebf20375-015b-49e8-b3ee-641f811e558b',variation:.85,density:.5})};
  const tree=snapshot(r,217*HOUR),eligible=tree.nodes.filter(canPrune);
  for(const scale of [.3,.5,1,1.5]){
   const choices=pruningPoints(tree.nodes,new Set(),scale);
   assert.deepEqual(choices.map(c=>c.node.id),eligible.map(n=>n.id));
   for(const c of choices){
    assert.equal(pruningTarget(tree.nodes,new Set(),c.point,scale,null,choices)?.node.id,c.node.id);
    if(c.anchor)assert(!pruningTarget(tree.nodes,new Set(),c.point,scale,null,choices)?.protected);
   }
  }
 }
});

test('regrowth snapshots extend replacement branches without moving mature survivors or changing history',()=>{
 const r=recordFor(),before=snapshot(r,matureAt);
 for(const n of before.nodes.filter(n=>n.pruningLevel===1))cut(r,n,matureAt);
 const original=structuredClone(r),start=snapshot(r,matureAt),end=matureAt+12*HOUR;
 assert.deepEqual(snapshot(r,matureAt),start);
 let length=0;
 for(const p of [.25,.5,.75,1]){
  const frame=snapshot(r,matureAt+(end-matureAt)*p);
  for(const n of start.nodes)assert.deepEqual(frame.nodes.find(next=>next.id===n.id),n);
  const branch=frame.nodes.find(n=>n.regrown&&n.pruningLevel===1);
  assert(branch);const nextLength=Math.hypot(branch.ex-branch.x,branch.ey-branch.y);
  assert(nextLength>length);length=nextLength;
  assert(!/NaN|Infinity/.test(draw(frame)));
 }

 assert.deepEqual(r,original);
});

test('all v3 forms prune both side-branch levels and locally restore secondary wood',()=>{
 for(const {id}of FORMS){
  const r=recordFor(id),before=snapshot(r,matureAt),primary=before.nodes.find(n=>n.pruningLevel===1);
  assert(pruningPoints(before.nodes).some(p=>p.node.pruningLevel===2),id);
  assert(!before.nodes.some(n=>n.pruningLevel>2&&canPrune(n)));
  const children=before.nodes.filter(n=>n.parent===primary.id&&n.pruningLevel===2),removed=new Set();
  for(const n of children){cut(r,n,matureAt);for(const member of branchFamily(before.nodes,n.id))removed.add(member);}
  const after=snapshot(r,matureAt);assert.deepEqual(after.nodes,before.nodes.filter(n=>!removed.has(n.id)));
  assert(after.recovery.some(j=>j.node===primary.id&&j.level===2));
  const later=snapshot(r,matureAt+48*HOUR),newChildren=later.nodes.filter(n=>n.parent===primary.id&&n.pruningLevel===2);
  assert.equal(newChildren.length,2);assert(newChildren.every(n=>n.regrown&&canPrune(n)));
  assert(later.clusters.every(c=>later.nodes.some(n=>n.id===c.node)));
  assert(!/NaN|Infinity/.test(draw(later)));
 }
});

test('repeated full pruning produces bounded connected generations without resurrecting IDs',()=>{
 const r=recordFor(),seen=new Set();let time=matureAt;
 for(let cycle=0;cycle<20;cycle++){
  const before=snapshot(r,time);for(const n of before.nodes.filter(n=>n.pruningLevel===1)){assert(!seen.has(n.id));seen.add(n.id);cut(r,n,time);}
  const bare=snapshot(r,time);assert.equal(bare.nodes.filter(n=>n.pruningLevel===1).length,0);assert(bare.recovery.length>0);
  time+=72*HOUR;const after=snapshot(r,time);assert(after.nodes.some(n=>canPrune(n)));assert(after.nodes.length<180);
  const ids=new Set(after.nodes.map(n=>n.id));assert(after.nodes.every(n=>!n.parent||ids.has(n.parent)));
 }
 assert(r.cuts.length>64);assert.equal(applyCheat(r,cheatRequest(r,time/HOUR),3000*HOUR).cuts.length,r.cuts.length);
});

test('v3 replay survives watering, rebasing, long histories and edits to the future',()=>{
 const r=recordFor(),before=snapshot(r,matureAt);
 for(const n of before.nodes.filter(n=>n.pruningLevel===1))cut(r,n,matureAt);
 r.waterings=[{id:randomUUID(),at:matureAt+HOUR,used:100,amount:.01,recoveryHours:2}];
 const time=matureAt+30*HOUR,frame=snapshot(r,time);
 const saved=applyCheat(r,cheatRequest(r,time/HOUR),800*HOUR);
 assert.deepEqual(snapshot(saved,800*HOUR),frame);
 cut(r,frame.nodes.find(n=>canPrune(n)),time+12*HOUR);
 assert.deepEqual(snapshot(r,time),frame);assert.deepEqual(snapshot(JSON.parse(JSON.stringify(r)),time),frame);
 assert.equal(futureOperations(r,time),1);const fork=branchTimeline(r,time);assert.equal(futureOperations(fork,time),0);assert.equal(r.cuts.length,fork.cuts.length+1);
});

test('cheat replay rejects nonexistent, unborn, deeper and duplicate branches',()=>{
 const r=recordFor(),frame=snapshot(r,matureAt),body=cheatRequest(r,200);
 for(const branchId of ['sprout:999',frame.nodes.find(n=>n.pruningLevel===3).id]){
  assert.throws(()=>applyCheat(r,{...body,cuts:[{id:randomUUID(),branchId,hour:200,model:'state-1'}]},800*HOUR),/无效剪枝/);
 }
 const primary=frame.nodes.find(n=>canPrune(n));
 const one={id:randomUUID(),branchId:primary.id,hour:200,model:'state-1'};
 assert.throws(()=>applyCheat(r,{...body,cuts:[one,{...one,id:randomUUID()}]},800*HOUR),/无效剪枝/);
});

test('historical v3 replacement IDs stay removed and migrate on the first new cut',()=>{
 const r=recordFor(),first=oldGrow(r,1,{at:matureAt,generator:generate});
 for(const n of first.nodes.filter(n=>n.role==='primary'))r.cuts.push({id:randomUUID(),seq:r.cuts.length+1,branchId:n.id,at:matureAt});
 const past=oldGrow(r,1,{at:300*HOUR,generator:generate}),old=past.nodes.find(n=>n.regrown&&n.role==='primary');
 r.cuts.push({id:randomUUID(),seq:r.cuts.length+1,branchId:old.id,at:300*HOUR});
 const migratedAt=450*HOUR,before=snapshot(r,migratedAt),secondary=before.nodes.find(n=>n.pruningLevel===2&&canPrune(n));
 assert(!before.nodes.some(n=>n.id===old.id));cut(r,secondary,migratedAt);
 const after=snapshot(r,migratedAt+48*HOUR);assert(!after.nodes.some(n=>n.id===old.id||n.id===secondary.id));assert(after.nodes.some(n=>n.id.startsWith('sprout:')));
 const saved=applyCheat(r,cheatRequest(r,498),1000*HOUR);assert.deepEqual(snapshot(saved,1000*HOUR),after);
});

test('API accepts secondary cuts, rejects finer wood and keeps retries idempotent',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'v3-pruning-')),store=await openStore({url:'',file:path.join(dir,'trees.json')});
 const server=createServer(store,{realtimeWeatherEnabled:false});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));await store.close();await rm(dir,{recursive:true,force:true});});
 const r={...recordFor(),id:randomUUID(),createdAt:Date.now()-matureAt},frame=snapshot(r);await store.mutate(r.id,()=>r);
 const post=async body=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/api/trees/${r.id}/cuts`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
 const body={id:randomUUID(),branchId:frame.nodes.find(n=>n.pruningLevel===2&&canPrune(n)).id};
 const [a,b]=await Promise.all([post(body),post(body)]);assert.equal(a.status,200);assert.equal(b.status,200);assert.deepEqual(a.data.cuts,b.data.cuts);assert.equal(a.data.cuts[0].model,CUT_MODEL);
 const quiet=snapshot(a.data,a.data.serverNow);assert(!quiet.nodes.some(n=>n.recoveryCut===body.id),'at the lower bound, no immediate replacement');
 const parent=frame.nodes.find(n=>n.id===body.branchId).parent;
 const secondId=randomUUID(),second=await post({id:secondId,branchId:quiet.nodes.find(n=>n.parent===parent&&canPrune(n)).id});assert.equal(second.status,200);
 const sparse=snapshot(second.data,second.data.serverNow);assert(!sparse.nodes.some(n=>n.recoveryCut===secondId));
 const waiting=sparse.recovery.find(j=>j.key===parent);assert(waiting);
 const later=second.data.serverNow+(waiting.hours+8)*HOUR;
 const fresh=snapshot(second.data,later).nodes.find(n=>n.parent===parent&&n.regrown);assert(fresh&&canPrune(fresh));
 assert.equal((await post({id:randomUUID(),branchId:fresh.id})).status,409,'a future branch cannot be cut early');
 const advanced=applyCheat(second.data,cheatRequest(second.data,(later-second.data.createdAt)/HOUR),Date.now());
 await store.mutate(r.id,()=>advanced);
 const recut=await post({id:randomUUID(),branchId:fresh.id});assert.equal(recut.status,200);assert(!snapshot(recut.data,recut.data.serverNow).nodes.some(n=>n.id===fresh.id));
 assert.equal((await post({id:randomUUID(),branchId:frame.nodes.find(n=>n.pruningLevel===3).id})).status,409);
 const reopened=await openStore({url:'',file:path.join(dir,'trees.json')});t.after(()=>reopened.close());const persisted=await reopened.get(r.id);
 assert(!snapshot(persisted).nodes.some(n=>n.id===body.branchId));
 let time=250*HOUR;
 for(let cycle=0;cycle<20;cycle++){
  const frame=snapshot(persisted,persisted.createdAt+time);
  for(const n of frame.nodes.filter(n=>n.pruningLevel===1&&canPrune(n)))cut(persisted,n,persisted.createdAt+time);
  time+=72*HOUR;
 }
 const longBody=JSON.stringify(cheatRequest(persisted,time/HOUR));assert(Buffer.byteLength(longBody)>8192);
 const saved=await fetch(`http://127.0.0.1:${server.address().port}/api/trees/${r.id}/cheats`,{method:'POST',headers:{'Content-Type':'application/json'},body:longBody});
 assert.equal(saved.status,200);assert.equal((await saved.json()).cuts.length,persisted.cuts.length);
});
