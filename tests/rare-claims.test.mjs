import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {configForClaim,RARE_CLAIM_RATES} from '../prototype/claim.mjs';
import {FORMS,PALETTES} from '../prototype/core/v3/bonsai-language.mjs';
import {CURRENT_VERSION} from '../prototype/tree-versions.mjs';
import {openStore} from '../storage.mjs';
import {createServer} from '../server.mjs';
import {snapshot,draw,HOUR} from '../prototype/growth.mjs';

const idFor=i=>`aabbccdd-0000-4000-8000-${String(i).padStart(12,'0')}`;
test('rare claims are deterministic, low frequency and respect pine anatomy',()=>{
 const total=20000,palettes={},leaves={};let eligible=0,both=0;
 for(let i=0;i<total;i++){
  const config=configForClaim(idFor(i),CURRENT_VERSION),form=FORMS.find(f=>f.id===config.preset);
  const rareColor=Boolean(PALETTES[config.palette].stylized),rareLeaf=!form.naturalLeaves.includes(config.leaf);
  if(form.naturalLeaves.includes('needle'))assert.equal(config.leaf,'needle');else eligible++;
  if(rareColor)palettes[config.palette]=(palettes[config.palette]??0)+1;
  if(rareLeaf)leaves[config.leaf]=(leaves[config.leaf]??0)+1;
  if(rareColor&&rareLeaf)both++;
  if(i<100)assert.deepEqual(config,configForClaim(idFor(i),CURRENT_VERSION));
 }
 for(const id of ['sakura','lilac','candy'])assert(Math.abs(palettes[id]/total-RARE_CLAIM_RATES.palette/3)<.006);
 for(const id of ['sakura','star','heart'])assert(Math.abs(leaves[id]/eligible-RARE_CLAIM_RATES.leaf/3)<.008);
 assert(both>0&&both/eligible<.01,'independent rare combinations remain especially uncommon');
});

test('rare preview survives adoption, retry, reload, gallery and sharing',async t=>{
 let id,preview;
 for(let i=0;i<20000;i++){
  const config=configForClaim(idFor(i),CURRENT_VERSION);
  if(PALETTES[config.palette].stylized&&!FORMS.find(f=>f.id===config.preset).naturalLeaves.includes(config.leaf)){id=idFor(i);preview=config;break;}
 }
 assert(id);
 const dir=await mkdtemp(path.join(tmpdir(),'rare-bonsai-')),store=await openStore({url:'',file:path.join(dir,'trees.json')}),server=createServer(store,{realtimeWeatherEnabled:false});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 t.after(async()=>{await new Promise(r=>server.close(r));await store.close();await rm(dir,{recursive:true,force:true});});
 const post=async(route,body)=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const response=await post('/api/trees',{id,version:CURRENT_VERSION});assert.equal(response.status,201);
 const claimed=await response.json();assert.deepEqual(claimed.config,preview);
 assert.deepEqual((await (await post('/api/trees',{id,version:CURRENT_VERSION})).json()).config,preview);
 const loaded=await (await fetch(base+`/api/trees/${id}`)).json();assert.deepEqual(loaded.config,preview);
 assert.deepEqual((await store.get(id)).config,preview);
 const svg=draw(snapshot(loaded,loaded.createdAt+168*HOUR));
 assert(svg.includes(`data-leaf-shape="${preview.leaf}"`));
 assert(svg.includes(PALETTES[preview.palette].scene.body));
 assert(!svg.includes('var(--'),'shared SVG carries resolved material colors');
 await post(`/api/trees/${id}/visits`,{});
 const gallery=await (await fetch(base+'/api/gallery')).json();assert.deepEqual(gallery.trees.find(tree=>tree.id===id).config,preview);
 const png=await fetch(base+`/t/${id}/share.png`);assert.equal(png.status,200);assert.equal(png.headers.get('content-type'),'image/png');
});
