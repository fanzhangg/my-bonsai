import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {snapshot,draw,HOUR} from '../prototype/growth.mjs';
import {CURRENT_VERSION} from '../prototype/tree-versions.mjs';
import {normalizeDesign,FORMS} from '../prototype/core/v3/config.mjs';
import {trimState,proposeTrim,trimEvent,polygonArea,TRIM_RECOVERY_HOURS,acceptTrimProposal} from '../prototype/leaf-trim-model.mjs';
import {createTrimStroke} from '../prototype/leaf-trim-stroke.mjs';
import {saveLeafTrims} from '../prototype/leaf-trim-events.mjs';
import {cheatRequest,applyCheat,branchTimeline,futureOperations} from '../prototype/cheats.mjs';
import {canPrune,CUT_MODEL} from '../prototype/pruning-model.mjs';
import {openStore} from '../storage.mjs';
import {createServer} from '../server.mjs';

const recordFor=(preset='juniper')=>({version:CURRENT_VERSION,createdAt:0,revision:0,config:normalizeDesign({preset,seed:'leaf-test'}),cuts:[],leafTrims:[]});
const at=168*HOUR;
function firstCut(record,time=at){const tree=snapshot(record,time),state=trimState(tree,record,time);for(const g of state.groups)for(const c of g.clusters)for(let index=0;index<192;index+=4){const p=proposeTrim(tree,record,time,{crownId:g.id,clusterKey:c.key,index},state);if(p)return p;}throw new Error('No exposed crown edge');}
const op=p=>({crownId:p.crownId,clusterKey:p.clusterKey,index:p.index,depth:p.depth});

test('focused crown renders once, after the grey context, without changing ordinary views',()=>{
 const record=recordFor(),tree=snapshot(record,at),before=draw(tree),state=trimState(tree,record,at),group=state.groups[0];
 const focused=draw(tree,{focusClusterKeys:group.clusters.map(c=>c.key)});
 assert(focused.includes('data-leaf-context opacity=".16" style="filter:grayscale(1)"'));
 const foreground=focused.slice(focused.indexOf('<g data-leaf-focus>'));
 assert.equal((foreground.match(/data-wind-leaf=/g)??[]).length,group.clusters.length);
 assert(!foreground.includes('data-wind-wood='));
 assert.equal((focused.match(/data-wind-leaf=/g)??[]).length,(before.match(/data-wind-leaf=/g)??[]).length);
 const ids=[...focused.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
 assert.equal(draw(tree),before,'editing focus must not alter the tree or normal renderer');
});

test('lifted crowns can trim edges that a different crown formerly covered',()=>{
 const record=recordFor(),tree=snapshot(record,at),cut=firstCut(record),c=tree.clusters.find(c=>c.key===cut.clusterKey);
 const covering={...c,key:'covering-crown',node:'covering-branch',z:100};
 tree.clusters.push(covering);tree.nodes.push({...tree.nodes.find(n=>n.id===c.node),id:'covering-branch',pruningLevel:2});
 assert(proposeTrim(tree,record,at,cut),'unrelated foreground leaf volumes do not block the lifted crown');
 const state=trimState(tree,record,at),original=state.byCluster.get(c.key),duplicate={...original,c:{...c,key:'same-crown-overlay'}};
 state.byCluster.set(duplicate.c.key,duplicate);
 assert.equal(proposeTrim(tree,record,at,cut,state),null,'overlaps inside the selected crown still cannot be erased as internal holes');
});

test('continuous drag samples paths independently of event rate and stops on release or cancellation',()=>{
 const trace=points=>{const samples=[],stroke=createTrimStroke({x:0,y:0},p=>samples.push([+p.x.toFixed(6),+p.y.toFixed(6)]));points.forEach(p=>stroke.move(p));return {samples,stroke};};
 const coarse=trace([{x:70,y:0},{x:70,y:70}]);
 const fine=trace([...Array.from({length:70},(_,i)=>({x:i+1,y:0})),...Array.from({length:70},(_,i)=>({x:70,y:i+1}))]);
 assert.deepEqual(coarse.samples,fine.samples);assert(coarse.samples.length>1);
 const length=coarse.samples.length;coarse.stroke.move({x:70,y:70});assert.equal(coarse.samples.length,length,'stationary scissors do not keep cutting');
 coarse.stroke.stop();coarse.stroke.move({x:200,y:70});assert.equal(coarse.samples.length,length,'release never causes a final or deferred cut');
 const partial=trace([{x:3,y:0}]);partial.stroke.stop();partial.stroke.move({x:70,y:0});assert.equal(partial.samples.length,0);
});

test('incremental erasing equals replay and saves as an atomic multi-cut batch',()=>{
 const r=recordFor(),tree=snapshot(r,at),state=trimState(tree,r,at),target=firstCut(r),operations=[];
 for(let step=0;step<40;step++){
  const cut=proposeTrim(tree,r,at,{...target,index:(target.index+step*2)%192},state);if(!cut)continue;
  operations.push(op(cut));acceptTrimProposal(state,cut);r.leafTrims.push(trimEvent(cut,at,randomUUID(),r.leafTrims.length+1));
 }
 assert(operations.length>1);
 const replay=trimState(tree,r,at);
 for(const [key,s]of state.byCluster){const t=replay.byCluster.get(key);s.points.forEach((p,i)=>assert(Math.hypot(p.x-t.points[i].x,p.y-t.points[i].y)<1e-8));}
 const saved=saveLeafTrims(recordFor(),{id:randomUUID(),revision:0,operations},at);
 assert.equal(saved.leafTrims.length,operations.length);assert.equal(saved.cuts.length,0);
});

test('every tree form trims only the chosen crown, retaining wood and deterministic history',()=>{
 for(const f of FORMS){
  const record=recordFor(f.id),before=snapshot(record,at),p=firstCut(record);
  record.leafTrims.push(trimEvent(p,at,randomUUID(),1));
  const after=snapshot(record,at);
  assert.deepEqual(before.nodes,after.nodes);
  assert.deepEqual(before.clusters.filter(c=>c.key!==p.clusterKey),after.clusters.filter(c=>c.key!==p.clusterKey));
  const trimmed=after.clusters.find(c=>c.key===p.clusterKey).leafTrim;assert(trimmed);
  assert(polygonArea(trimmed.points)<polygonArea(trimmed.reference));
  assert.equal(draw(after),draw(snapshot(structuredClone(record),at)));
  // A legacy micro-trim can fall between actual leaves. Its stored contour
  // still contracts, but the renderer must not invent an exposed solid edge
  // just to make that empty-space cut visible.
  assert(!/NaN|Infinity/.test(draw(after)));
  assert.deepEqual(snapshot(record,at-1),snapshot({...record,leafTrims:[]},at-1));
 }
});

test('legacy leaf-1 history retains its original local depth and area bounds',()=>{
 const record=recordFor(),p=firstCut(record),target=op(p);
 let accepted=0;
 for(let i=0;i<40;i++){
  const copy=structuredClone(record),tree=snapshot(copy,at),next=proposeTrim(tree,copy,at,target);
  if(next){record.leafTrims.push(trimEvent(next,at,randomUUID(),record.leafTrims.length+1));accepted++;}
 }
 assert(accepted>0&&accepted<40);
 // Sweep all exposed edges repeatedly: area is shared across sibling leaf volumes.
 for(let pass=0;pass<3;pass++)for(let index=0;index<192;index+=8){
  const tree=snapshot(record,at),s=trimState(tree,record,at),group=s.groups.find(g=>g.id===p.crownId);
  for(const c of group.clusters){const next=proposeTrim(tree,record,at,{crownId:group.id,clusterKey:c.key,index});if(next)record.leafTrims.push(trimEvent(next,at,randomUUID(),record.leafTrims.length+1));}
 }
 const state=trimState(snapshot(record,at),record,at);
 for(const group of state.groups){
  let removed=0;
  for(const c of group.clusters){const s=state.byCluster.get(c.key);removed+=polygonArea(s.rim)-polygonArea(s.points);assert(s.depths.every(d=>d<=group.d*.05+1e-8));}
  assert(removed<=group.areaFloor*.08+1e-8);
 }
});

test('trim recovery is gradual, reload-stable, and disappears with its supporting branch',()=>{
 const r=recordFor(),p=firstCut(r);r.leafTrims.push(trimEvent(p,at,randomUUID(),1));
 const area=time=>{const s=trimState(snapshot(r,time),r,time).byCluster.get(p.clusterKey);return polygonArea(s.rim)-polygonArea(s.points);};
 assert(area(at)>area(at+24*HOUR));assert(area(at+24*HOUR)>0);assert.equal(area(at+TRIM_RECOVERY_HOURS*HOUR),0);
 assert.deepEqual(snapshot(r,at+48*HOUR),snapshot({...r,leafTrims:[]},at+48*HOUR));
 const tree=snapshot(r,at),cluster=tree.clusters.find(c=>c.key===p.clusterKey),nodes=new Map(tree.nodes.map(n=>[n.id,n]));
 let branch=nodes.get(cluster.node);while(branch&&!canPrune(branch))branch=nodes.get(branch.parent);assert(branch);
 r.cuts.push({id:randomUUID(),branchId:branch.id,seq:1,at:at+HOUR,model:CUT_MODEL});
 assert(!snapshot(r,at+HOUR).clusters.some(c=>c.key===p.clusterKey));
 assert(futureOperations(r,at-1)>=2);assert.equal(branchTimeline(r,at-1).leafTrims.length,0);
});

test('trim batches are atomic, bounded, versioned and idempotent',()=>{
 const r=recordFor(),p=firstCut(r),body={id:randomUUID(),revision:0,operations:[op(p)]};
 assert.throws(()=>saveLeafTrims(r,{...body,operations:[op(p),{...op(p),crownId:'missing'}]},at),/变化|限制/);assert.equal(r.leafTrims.length,0);
 const saved=saveLeafTrims(r,body,at);assert.equal(saved.leafTrims.length,1);assert.equal(saved.revision,1);
 assert.deepEqual(saveLeafTrims(saved,body,at+HOUR),saved);
 assert.throws(()=>saveLeafTrims(saved,{...body,id:randomUUID()},at),/变化/);
 assert.throws(()=>saveLeafTrims(saved,{...body,operations:[{...op(p),index:(p.index+1)%192}]},at),/已使用/);
 assert.throws(()=>saveLeafTrims(r,{...body,operations:[{...op(p),depth:2}]},at),/无效/);
 assert.throws(()=>saveLeafTrims(r,{...body,operations:[{...op(p),index:192}]},at),/无效/);
 const rebased=applyCheat(saved,cheatRequest(saved,200),300*HOUR);
 assert.deepEqual(snapshot(rebased,300*HOUR),snapshot(saved,200*HOUR));
});

test('API saves leaf trims in local storage and includes them in tree and gallery responses',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'bonsai-leaf-trim-')),file=path.join(dir,'trees.json');
 const store=await openStore({url:'',file}),server=createServer(store,{realtimeWeatherEnabled:false});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}`,id=randomUUID(),time=Date.now(),record={...recordFor(),id,createdAt:time-at};
 await store.mutate(id,()=>record);
 const post=async(body,origin)=>{const r=await fetch(`${url}/api/trees/${id}/leaf-trims`,{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 try{
  const p=firstCut(record,time),body={id:randomUUID(),revision:0,operations:[op(p)]};
  assert.equal((await post(body,'https://elsewhere.example')).status,403);
  const [a,b]=await Promise.all([post(body),post(body)]);assert.equal(a.status,200);assert.equal(b.status,200);assert.equal(a.data.leafTrims.length,1);
  const get=await (await fetch(`${url}/api/trees/${id}`)).json();assert.deepEqual(get.leafTrims,a.data.leafTrims);
  const gallery=await (await fetch(`${url}/api/gallery`)).json();assert.deepEqual(gallery.trees[0].leafTrims,get.leafTrims);
  const reopened=await openStore({url:'',file});assert.deepEqual((await reopened.get(id)).leafTrims,get.leafTrims);await reopened.close();
  assert.equal((await post({...body,id:randomUUID()})).status,409);
 }finally{await new Promise(resolve=>server.close(resolve));await store.close();await rm(dir,{recursive:true,force:true});}
});
