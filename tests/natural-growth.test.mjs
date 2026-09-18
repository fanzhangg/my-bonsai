import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {snapshot,HOUR,profile} from '../prototype/growth.mjs';
import {normalizeDesign,FORMS} from '../prototype/core/v3/config.mjs';
import {NATURAL_GROWTH} from '../prototype/core/v3/natural-growth.mjs';
import {CURRENT_VERSION} from '../prototype/tree-versions.mjs';
import {CUT_MODEL,canPrune} from '../prototype/pruning-model.mjs';
import {applyCheat,cheatRequest} from '../prototype/cheats.mjs';
import {configForClaim} from '../prototype/claim.mjs';
import {growthStatus} from '../prototype/growth-status.mjs';
import {createServer} from '../server.mjs';
import {openStore} from '../storage.mjs';

const record=(preset='juniper',seed='natural-review')=>({version:CURRENT_VERSION,createdAt:0,config:normalizeDesign({preset,seed,growthPolicy:NATURAL_GROWTH}),cuts:[]});
test('untouched trees develop a modest prunable surplus after maturity, without moving their trained scaffold',()=>{
 for(const {id:preset}of FORMS)for(const seed of ['natural-review','natural-2','natural-3']){
  const r=record(preset,seed),mature=Math.ceil(profile(r).days*24)*HOUR;
  const {growthPolicy,...oldConfig}=r.config,old={...r,config:oldConfig};
  const before=snapshot(r,mature),later=snapshot(r,mature+240*HOUR);
  assert.deepEqual(before.nodes,snapshot(old,mature).nodes,'young/adolescent trees keep the trained silhouette');
  const baseCount=before.nodes.filter(canPrune).length,newCount=later.nodes.filter(canPrune).length;
  assert(newCount>baseCount,`${preset}: no cut or watering needed to produce new branches`);
  assert(newCount<=baseCount*1.5+1,`${preset}: a small surplus rather than unlimited density`);
  for(const n of before.nodes)assert.deepEqual(later.nodes.find(x=>x.id===n.id),n);
  assert(later.nodes.some(n=>n.surplus&&canPrune(n)),`${preset}: surplus can be pruned`);
  assert(later.branchRanges.every(g=>g.count<=g.max));
  assert.equal(r.cuts.length,0);
  assert.deepEqual(snapshot(old,mature+240*HOUR).nodes,snapshot(old,mature).nodes,'old untouched records do not gain retroactive branches');
 }
});

test('pruning surplus restores breathing room without an immediate replacement, while natural growth remains bounded',()=>{
 const r=record(),at=1000*HOUR,full=snapshot(r,at);
 assert.equal(full.recovery.length,0);assert.match(growthStatus(full),/比建议多/);
 assert.equal(snapshot(r,100000*HOUR).nodes.length,full.nodes.length);
 for(const n of full.nodes.filter(n=>n.surplus&&canPrune(n))){
  if(!snapshot(r,at).nodes.some(x=>x.id===n.id))continue;
  const event={id:randomUUID(),seq:r.cuts.length+1,branchId:n.id,at,model:CUT_MODEL};r.cuts.push(event);
  assert(!snapshot(r,at).nodes.some(x=>x.recoveryCut===event.id));
 }
 const pruned=snapshot(r,at);
 assert(pruned.nodes.length<full.nodes.length);
 assert(pruned.branchRanges.every(g=>g.count<=g.ideal));
 assert.deepEqual(snapshot(r,at+HOUR).nodes,pruned.nodes,'space remains after pruning');
 const restored=snapshot(r,at+500*HOUR);assert(restored.branchRanges.every(g=>g.count<=g.max));
 assert(restored.nodes.some(n=>n.surplus&&canPrune(n)),'continued unattended growth slowly returns');
});

test('natural growth survives reload, time rebasing and valid pruning of branches that grew before the first cut',()=>{
 const r=record(),at=500*HOUR,tree=snapshot(r,at),branch=tree.nodes.find(n=>n.surplus&&canPrune(n));assert(branch);
 r.cuts.push({id:randomUUID(),seq:1,branchId:branch.id,at,model:CUT_MODEL});
 const frame=snapshot(r,at),saved=applyCheat({...r,cuts:[]},cheatRequest(r,500),1500*HOUR);
 assert.equal(saved.config.growthPolicy,NATURAL_GROWTH);
 assert.deepEqual(snapshot(saved,1500*HOUR),frame);
 assert.deepEqual(snapshot(JSON.parse(JSON.stringify(r)),at),frame);
 assert.throws(()=>applyCheat(r,{...cheatRequest(r,500),design:{...cheatRequest(r,500).design,growthPolicy:undefined}},at),/须清空剪枝/);
});

test('adoption, API, gallery and storage preserve the preview natural-growth policy; older clients remain compatible',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'natural-growth-')),store=await openStore({url:'',file:path.join(dir,'trees.json')});
 const server=createServer(store,{realtimeWeatherEnabled:false});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await store.close();await rm(dir,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}`;
 const id=randomUUID(),r={version:CURRENT_VERSION,createdAt:0,config:configForClaim(id,CURRENT_VERSION,NATURAL_GROWTH),cuts:[]};
 const n=snapshot(r,500*HOUR).nodes.find(n=>n.surplus&&canPrune(n));assert(n);
 r.cuts.push({id:randomUUID(),seq:1,at:500*HOUR,branchId:n.id,model:CUT_MODEL});
 const response=await fetch(`${base}/api/trees`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,version:CURRENT_VERSION,growthPolicy:NATURAL_GROWTH,cheat:cheatRequest(r,500)})});
 assert.equal(response.status,201);const saved=await response.json();assert.equal(saved.config.growthPolicy,NATURAL_GROWTH);
 assert.deepEqual(snapshot(saved,saved.createdAt+500*HOUR),snapshot(r,500*HOUR));
 const gallery=await (await fetch(`${base}/api/gallery`)).json();assert.equal(gallery.trees.find(x=>x.id===id).config.growthPolicy,NATURAL_GROWTH);
 assert.equal((await fetch(`${base}/t/${id}/share.png`)).status,200);
 const reopened=await openStore({url:'',file:path.join(dir,'trees.json')});t.after(()=>reopened.close());assert.equal((await reopened.get(id)).config.growthPolicy,NATURAL_GROWTH);
 const legacy=await fetch(`${base}/api/trees`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:randomUUID(),version:CURRENT_VERSION})});
 assert.equal(legacy.status,201);assert.equal((await legacy.json()).config.growthPolicy,undefined);
});
