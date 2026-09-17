import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {snapshot,grow,draw,HOUR,VERSION} from '../prototype/growth.mjs';
import {PRESETS} from '../prototype/core/v1/canopy.mjs';
import {pointOn} from '../prototype/core/v1/model.mjs';
import {branchFamily} from '../prototype/pruning-model.mjs';
import {replayFrame} from '../prototype/playback.mjs';
import {applyCheat,cheatRequest} from '../prototype/cheats.mjs';
import {openStore} from '../storage.mjs';
import {createServer} from '../server.mjs';

const primaries=tree=>tree.nodes.filter(n=>n.role==='primary');
const cutAt=200*HOUR;
const recordFor=(preset='juniper',seed='regrowth')=>({version:VERSION,createdAt:0,config:{preset,seed},cuts:[]});
function cut(record,nodes,at){for(const n of nodes)record.cuts.push({id:randomUUID(),seq:record.cuts.length+1,branchId:n.id,at});}

test('all seven tree forms recover after complete pruning, without resurrecting any old branch or moving survivors',()=>{
  for(const {id:preset}of PRESETS){
    const record=recordFor(preset),before=snapshot(record,cutAt),branches=primaries(before),removed=new Set(branches.flatMap(n=>[...branchFamily(before.nodes,n.id)]));
    cut(record,branches,cutAt);
    assert.deepEqual(snapshot(record,cutAt-1),snapshot({...record,cuts:[]},cutAt-1));
    assert.equal(primaries(snapshot(record,cutAt)).length,0);
    assert.equal(primaries(snapshot(record,cutAt+4*HOUR-1)).length,0);
    const budding=snapshot(record,cutAt+8*HOUR);assert.ok(primaries(budding).length>=1);assert.equal(budding.clusters.length,0);
    const after=snapshot(record,cutAt+120*HOUR);
    assert.equal(primaries(after).length,Math.max(2,Math.ceil(branches.length/2)));
    assert.ok(after.clusters.length>0);assert.ok(primaries(after).every(n=>n.regrown&&n.growth===1));
    assert.ok(after.nodes.every(n=>!removed.has(n.id)));
    assert.deepEqual(after.nodes.filter(n=>!n.regrown),before.nodes.filter(n=>!removed.has(n.id)));
    assert.deepEqual(after.viewBox,before.viewBox);assert.deepEqual(after.scars,[]);
    const map=new Map(after.nodes.map(n=>[n.id,n]));
    assert.equal(map.size,after.nodes.length);
    for(const n of after.nodes){
      assert.ok(['x','y','cx1','cy1','cx2','cy2','ex','ey','width','tipWidth'].every(k=>Number.isFinite(n[k])));
      if(n.regrown){const parent=map.get(n.parent);assert.ok(parent);let gap=Infinity;for(let i=0;i<=1000;i++){const p=pointOn(parent,i/1000);gap=Math.min(gap,Math.hypot(n.x-p.x,n.y-p.y));}assert.ok(gap<.5);}
    }
    assert.ok(after.clusters.every(c=>map.has(c.node)));
    const markup=draw(after);assert.ok(!/NaN|Infinity/.test(markup));
    for(const n of primaries(after))assert.ok(markup.includes(`data-wind-wood="${after.nodes.indexOf(n)}"`));
  }
});

test('sparse crowns replenish up to the threshold, leave healthy crowns alone, and stop growing extra branches',()=>{
  const record=recordFor(),before=snapshot(record,cutAt),branches=primaries(before),minimum=Math.ceil(branches.length/2);
  cut(record,branches.slice(minimum),cutAt);
  assert.equal(primaries(snapshot(record,cutAt+500*HOUR)).length,minimum);
  assert.equal(snapshot(record,cutAt+500*HOUR).nodes.some(n=>n.regrown),false);
  cut(record,[branches[minimum-1]],cutAt+HOUR);
  const recovered=snapshot(record,cutAt+120*HOUR);
  assert.equal(primaries(recovered).filter(n=>n.regrown).length,1);
  assert.deepEqual(snapshot(record,cutAt+24*365*100*HOUR),recovered);
});

test('new shoots extend and leaf out gradually with stable identities; future cuts and operation UUIDs cannot rewrite the past',()=>{
  const record=recordFor();cut(record,primaries(snapshot(record,cutAt)),cutAt);
  const early=snapshot(record,cutAt+8*HOUR),shoot=primaries(early)[0],later=snapshot(record,cutAt+12*HOUR).nodes.find(n=>n.id===shoot.id);
  assert.ok(shoot.growth>0&&shoot.growth<1);assert.ok(later.growth>shoot.growth);
  const budding=snapshot(record,cutAt+12*HOUR);
  assert(budding.buds.some(b=>b.node===shoot.id&&b.starterLeaves===2),'new shoots show leaf hints before terminal foliage');
  assert.ok(Math.hypot(later.ex-later.x,later.ey-later.y)>Math.hypot(shoot.ex-shoot.x,shoot.ey-shoot.y));
  const mature=snapshot(record,cutAt+120*HOUR);cut(record,[primaries(mature)[0]],cutAt+120*HOUR);
  assert.deepEqual(snapshot(record,cutAt+8*HOUR),early);
  assert.deepEqual(snapshot({...record,cuts:record.cuts.map(c=>({...c,id:randomUUID()}))},cutAt+8*HOUR),early);
  for(const age of [0,8,24,60,130]){
    const at=cutAt+age*HOUR;assert.deepEqual(snapshot(JSON.parse(JSON.stringify(record)),at),snapshot(record,at));
    assert.deepEqual(replayFrame(record,at,1),snapshot(record,at));
    assert.ok(!/NaN|Infinity/.test(draw(replayFrame(record,at,.1))));
  }
});

test('new generations remain prunable and repeatedly recover with distinct, deterministic shapes',()=>{
  const record=recordFor(),before=snapshot(record,cutAt);cut(record,primaries(before),cutAt);
  const identities=new Set(),shapes=[];
  for(let cycle=1;cycle<=3;cycle++){
    const at=cutAt+cycle*120*HOUR,tree=snapshot(record,at),branches=primaries(tree);
    assert.equal(branches.length,Math.ceil(primaries(before).length/2));
    for(const n of branches){assert.ok(!identities.has(n.id));identities.add(n.id);}
    shapes.push(branches.map(n=>[n.x,n.y,n.ex,n.ey]));
    cut(record,branches,at);assert.equal(primaries(snapshot(record,at)).length,0);
  }
  assert.notDeepEqual(shapes[0],shapes[1]);assert.notDeepEqual(shapes[1],shapes[2]);
});

test('regenerated foliage appears while its supporting twig is still extending',()=>{
 for(const {id:preset} of PRESETS){
  const record=recordFor(preset);cut(record,primaries(snapshot(record,cutAt)),cutAt);
  let overlapping=false;
  for(let hour=8;hour<=60;hour++){
   const tree=snapshot(record,cutAt+hour*HOUR),nodes=new Map(tree.nodes.map(n=>[n.id,n]));
   for(const c of tree.clusters){const n=nodes.get(c.node);assert(n&&n.growth>0);if(n.regrown&&n.growth<1&&c.leafAmount>0)overlapping=true;}
  }
  assert(overlapping,`${preset} regrowth must leaf out during extension`);
 }
});

test('even fully regenerated crowns respect the whole plant maturity cap',()=>{
 const record=recordFor(),before=snapshot(record,cutAt);cut(record,primaries(before),cutAt);
 const mature=grow(record,1,{at:cutAt+120*HOUR});
 for(const p of [.4,.6,.8]){
  const young=grow(record,p,{at:cutAt+120*HOUR});
  assert(young.clusters.some(c=>young.nodes.find(n=>n.id===c.node)?.regrown));
  assert(young.clusters.every(c=>c.leafAmount<=p**3));
 }
 assert(mature.clusters.every(c=>c.leafAmount===1));
});

test('cheat saves preserve regenerated cuts and reject unborn or fabricated regenerated branches',()=>{
  const record=recordFor();cut(record,primaries(snapshot(record,cutAt)),cutAt);
  const time=cutAt+100*HOUR,shoot=primaries(snapshot(record,time))[0];cut(record,[shoot],time);
  for(const hour of [0,210,310,600]){
    const saved=applyCheat(record,cheatRequest(record,hour),2e12);
    assert.deepEqual(snapshot(saved,2e12),snapshot(record,hour*HOUR));
  }
  const body=cheatRequest(record,400);
  assert.throws(()=>applyCheat(record,{...body,cuts:[...body.cuts,{id:randomUUID(),branchId:'regrow:999:missing',hour:400}]},2e12),/无效剪枝记录/);
  assert.throws(()=>applyCheat(record,{...body,cuts:body.cuts.map(c=>c.branchId===shoot.id?{...c,hour:200}:c)},2e12),/无效剪枝记录/);
});

test('server accepts cuts on regrown branches, persists them, and keeps duplicate requests idempotent',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'bonsai-regrowth-')),file=path.join(dir,'trees.json'),store=await openStore({url:'',file});
  const at=Date.now(),record={...recordFor(),id:randomUUID(),createdAt:at-600*HOUR};
  cut(record,primaries(snapshot(record,at-200*HOUR)),at-200*HOUR);await store.mutate(record.id,()=>record);
  const server=createServer(store,{realtimeWeatherEnabled:false});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
    const branch=primaries(snapshot(record,at))[0];assert.ok(branch.regrown);
    const body={id:randomUUID(),branchId:branch.id},url=`http://127.0.0.1:${server.address().port}/api/trees/${record.id}/cuts`;
    const post=async body=>{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
    const saved=await post(body);assert.equal(saved.status,200);assert.equal(saved.data.cuts.length,record.cuts.length+1);
    const retry=await post(body);assert.equal(retry.status,200);assert.deepEqual(retry.data.cuts,saved.data.cuts);
    assert.equal((await post({...body,id:randomUUID()})).status,409);
    const reopened=await openStore({url:'',file});
    try{const persisted=await reopened.get(record.id);assert.deepEqual(persisted.cuts,saved.data.cuts);assert.ok(!snapshot(persisted).nodes.some(n=>n.id===branch.id));assert.deepEqual(snapshot(persisted,at+120*HOUR),snapshot(saved.data,at+120*HOUR));}finally{await reopened.close();}
  }finally{await new Promise(r=>server.close(r));await store.close();await rm(dir,{recursive:true,force:true});}
});
