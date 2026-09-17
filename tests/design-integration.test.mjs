import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {openStore} from '../storage.mjs';
import {createServer} from '../server.mjs';
import {CURRENT_VERSION,LEGACY_VERSION} from '../prototype/tree-versions.mjs';
import {configForClaim} from '../prototype/claim.mjs';
import {snapshot,grow,draw,HOUR,applicationFrame} from '../prototype/growth.mjs';
import {FORMS,PALETTES,normalizeDesign} from '../prototype/core/v3/config.mjs';
import {generateLanguage as review} from '../prototype/bonsai-language.mjs';
import {generateLanguage,crownCoversTip} from '../prototype/core/v3/bonsai-language.mjs';
import {cheatRequest,applyCheat} from '../prototype/cheats.mjs';
import {branchFamily,pruningPoints} from '../prototype/pruning-model.mjs';
import {colorTokens} from '../prototype/color-system.mjs';
import {sceneFor} from '../prototype/weather-model.mjs';

test('old records retain exact published model and SVG including cuts and regrowth',async()=>{
 const fixtures=JSON.parse(await readFile(new URL('./fixtures/growth-v2-8a70a72.json',import.meta.url),'utf8'));
 const hash=s=>createHash('sha256').update(s).digest('hex');
 for(const {record,frames}of fixtures)for(const f of frames){
  const tree=snapshot(record,record.createdAt+f.hour*HOUR);
  assert.equal(hash(JSON.stringify(tree)),f.model,`${record.config.preset}/${f.hour}: model`);
  assert.equal(hash(draw(tree)),f.svg,`${record.config.preset}/${f.hour}: SVG`);
  assert.deepEqual(snapshot({...record,version:undefined},record.createdAt+f.hour*HOUR),tree);
 }
 assert.throws(()=>snapshot({...fixtures[0].record,version:'unknown'}),/不支持/);
});

test('v3 freezes the reviewed design and generates every form/palette/pot reproducibly',()=>{
 const seen={forms:new Set(),palettes:new Set(),pots:new Set(),pairs:new Set()};
 for(let i=0;i<512;i++){
  const id=`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,config=configForClaim(id,CURRENT_VERSION);
  assert.deepEqual(config,configForClaim(id,CURRENT_VERSION));
  seen.forms.add(config.preset);seen.palettes.add(config.palette);seen.pots.add(JSON.stringify(config.pot));seen.pairs.add(config.preset+':'+config.palette);
 }
 assert.equal(seen.forms.size,7);assert.equal(seen.palettes.size,5);assert.equal(seen.pots.size,8);assert.equal(seen.pairs.size,35);
 for(const f of FORMS){
  const config=normalizeDesign({preset:f.id,seed:'655bc0bf-ed33-4435-bbf6-e27eafaff27a',variation:.85,density:.8});
  const a=review(config),b=generateLanguage(config);assert.deepEqual(a,b,'frozen algorithm retains reviewed geometry and coloring');
  const record={version:CURRENT_VERSION,config,createdAt:0,cuts:[]},mature=grow(record,1),frame=applicationFrame(mature);
  for(const progress of [0,.3,.6,1]){const t=grow(record,progress);assert.deepEqual(applicationFrame(t),frame);assert(!/NaN|Infinity/.test(draw(t)));}
  for(const c of mature.clusters){assert(c.x-c.rx>=frame.x&&c.x+c.rx<=frame.x+frame.width);assert(c.y-c.ry>=frame.y&&c.y+c.ry<=frame.y+frame.height);}
  for(const n of mature.nodes.filter(n=>n.role!=='trunk'))assert(mature.clusters.some(c=>c.pad===n.pad&&crownCoversTip(c,n)),'mature tips retain attached crowns');
  assert(pruningPoints(mature.nodes).length>=2,'new wood can be targeted by the existing scissors');
  const stable=structuredClone(mature);mature.nodes[0].width=0;mature.clusters.length=0;assert.deepEqual(grow(record,1),stable,'cache cannot be poisoned by callers');
  const ruby=grow({...record,config:normalizeDesign({...config,palette:'ruby'})},1);
  assert.deepEqual(ruby.nodes,grow(record,1).nodes,'color changes retain identity');
 }
});

test('v3 growth, repeated pruning, regrowth and environment retain the design identity',()=>{
 for(const f of FORMS){
  const config=normalizeDesign({preset:f.id,seed:'lifecycle-new',palette:'mist',variation:.85,density:.8});
  const record={version:CURRENT_VERSION,createdAt:0,config,cuts:[]},at=200*HOUR,before=snapshot(record,at),primaries=before.nodes.filter(n=>n.role==='primary');
  const removed=new Set();record.cuts=primaries.slice(0,Math.ceil(primaries.length*.7)).map((n,i)=>{for(const id of branchFamily(before.nodes,n.id))removed.add(id);return {id:randomUUID(),seq:i+1,branchId:n.id,at};});
  const cut=snapshot(record,at);assert.deepEqual(cut.nodes,before.nodes.filter(n=>!removed.has(n.id)));assert.deepEqual(cut.clusters,before.clusters.filter(c=>!removed.has(c.node)));
  const later=snapshot(record,at+160*HOUR),newBranch=later.nodes.find(n=>n.regrown&&n.role==='primary');assert(newBranch);
  assert.deepEqual(applicationFrame(later),applicationFrame(before),'regrowth never recenters the pot');
  for(const c of later.clusters){const b=later.viewBox;assert(c.x-c.rx>=b.x&&c.x+c.rx<=b.x+b.width&&c.y-c.ry>=b.y&&c.y+c.ry<=b.y+b.height,'regrowth fits the stable frame');}
  assert(later.clusters.filter(c=>c.node.startsWith('regrow:')).every(c=>c.layerPalette?.length===4));
  record.cuts.push({id:randomUUID(),seq:record.cuts.length+1,branchId:newBranch.id,at:at+160*HOUR});
  assert(!snapshot(record,at+160*HOUR).nodes.some(n=>n.id===newBranch.id));
  assert.deepEqual(snapshot(record,at+160*HOUR),snapshot(JSON.parse(JSON.stringify(record)),at+160*HOUR));
  const young={...record,cuts:[],createdAt:at};assert(snapshot({...young,waterings:[{at,amount:.01}]},at).progress>snapshot(young,at).progress);
  const svg=draw(before,{transparent:true});assert(svg.includes('var(--bonsai-crown-brightness,1)'));assert(!draw(before).includes('var('));
  for(const hour of [0,6,12,18])for(const kind of ['clear','rain','storm']){
   const tokens=colorTokens(sceneFor(null,at,{hour,kind}),before.config.appearance,before.preset,before.config.pot,before.language);
   assert(tokens['bonsai-crown-brightness']>=.94&&tokens['bonsai-crown-brightness']<=1.24);assert(tokens['bonsai-crown-saturation']>=.86);
  }
  const saved=applyCheat(record,cheatRequest(record,360),400*HOUR);assert.equal(saved.version,CURRENT_VERSION);assert.deepEqual(saved.config,config);
 }
});

test('versioned API preserves old homepages, new adoption, cheats, gallery and PNG sharing',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'bonsai-versioned-')),store=await openStore({url:'',file:path.join(dir,'trees.json')}),server=createServer(store,{realtimeWeatherEnabled:false,newTreeVersion:LEGACY_VERSION});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 t.after(async()=>{await new Promise(r=>server.close(r));await store.close();await rm(dir,{recursive:true,force:true});});
 const post=async(route,body)=>{const res=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:res.status,data:await res.json()};};
 assert((await (await fetch(base+'/runtime-config.mjs')).text()).includes(`newTreeVersion="${LEGACY_VERSION}"`));
 const old=await post('/api/trees',{id:randomUUID()});assert.equal(old.data.version,LEGACY_VERSION);assert.deepEqual(old.data.config,configForClaim(old.data.id));
 const id=randomUUID(),preview=configForClaim(id,CURRENT_VERSION),claimed=await post('/api/trees',{id,version:CURRENT_VERSION});
 assert.equal(claimed.status,201);assert.equal(claimed.data.version,CURRENT_VERSION);assert.deepEqual(claimed.data.config,preview,'client/server derive the same candidate even while new creation default is rolled back');
 assert.deepEqual((await post('/api/trees',{id,version:LEGACY_VERSION})).data.config,preview,'retry never rerolls');
 const wrong=randomUUID();assert.equal((await post('/api/trees',{id:wrong,version:'unknown'})).status,400);assert.equal(await store.get(wrong),undefined);
 const edits=cheatRequest(claimed.data,200);edits.design.palette='ruby';
 const saved=await post(`/api/trees/${id}/cheats`,edits);assert.equal(saved.status,200);assert.equal(saved.data.config.palette,'ruby');assert.deepEqual(saved.data.config.pot,preview.pot);
 assert.equal((await post(`/api/trees/${id}/cheats`,edits)).status,409);
 const branch=snapshot(saved.data,saved.data.serverNow).nodes.find(n=>n.role==='primary');
 const cut=await post(`/api/trees/${id}/cuts`,{id:randomUUID(),branchId:branch.id});assert.equal(cut.status,200);assert.equal(cut.data.version,CURRENT_VERSION);
 const water=await post(`/api/trees/${id}/waterings`,{id:randomUUID(),used:100});assert.equal(water.status,200);assert.equal(water.data.waterings.length,1);
 const loaded=await (await fetch(base+`/api/trees/${id}`)).json();assert.deepEqual(loaded.config,saved.data.config);assert.equal(loaded.cuts.length,1);
 await post(`/api/trees/${old.data.id}/visits`,{});const gallery=await (await fetch(base+'/api/gallery')).json();assert(gallery.trees.some(r=>r.version===CURRENT_VERSION));assert(gallery.trees.some(r=>r.version===LEGACY_VERSION));
 const png=await fetch(base+`/t/${id}/share.png`);assert.equal(png.status,200);assert.equal(png.headers.get('content-type'),'image/png');assert.deepEqual([...new Uint8Array(await png.arrayBuffer()).slice(0,8)],[137,80,78,71,13,10,26,10]);
 const persisted=await store.get(id);assert.deepEqual(persisted.config,saved.data.config);assert.equal(persisted.version,CURRENT_VERSION);
});
