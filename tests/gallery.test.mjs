import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {openStore} from '../storage.mjs';
import {createServer} from '../server.mjs';
import {configForClaim} from '../prototype/claim.mjs';
import {snapshot,draw,VERSION} from '../prototype/growth.mjs';
import {cheatRequest} from '../prototype/cheats.mjs';

async function fixture(t,records=[]){
 const dir=await mkdtemp(path.join(tmpdir(),'bonsai-gallery-')),file=path.join(dir,'trees.json');
 await writeFile(file,JSON.stringify(Object.fromEntries(records.map(record=>[record.id,record]))));
 const store=await openStore({url:'',file}),server=createServer(store,{realtimeWeatherEnabled:false});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));await store.close();await rm(dir,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}`;
 const get=async p=>{const r=await fetch(base+p);return {status:r.status,data:await r.json()};};
 const post=async(p,body={},headers={})=>{const r=await fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 return {file,store,base,get,post};
}
test('gallery excludes untouched adoptions, pages at 24, sorts by activity with stable ties, and persists',async t=>{
 const {file,store,get}=await fixture(t),ids=[];
 for(let i=0;i<53;i++){
  const id=randomUUID();ids.push(id);
  await store.mutate(id,()=>({id,version:VERSION,createdAt:1,config:configForClaim(id),cuts:[],...(i<51?{lastVisitedAt:1000+i,lastInteractedAt:2000-i}:{})}));
 }
 const active=await get('/api/gallery');assert.equal(active.status,200);assert.equal(active.data.trees.length,24);assert.equal(active.data.limit,200);assert.equal(active.data.pageSize,24);
 assert.deepEqual(active.data.trees.map(t=>t.id),ids.slice(0,24));
 const visited=await get('/api/gallery?sort=visited');assert.deepEqual(visited.data.trees.map(t=>t.id),ids.slice(27,51).reverse());
 const interacted=await get('/api/gallery?sort=interacted');assert.deepEqual(interacted.data.trees.map(t=>t.id),ids.slice(0,24));
 await store.mutate(ids[0],tree=>({...tree,lastInteractedAt:9999}));await store.mutate(ids[1],tree=>({...tree,lastInteractedAt:9999}));
 assert.deepEqual((await get('/api/gallery')).data.trees.slice(0,2).map(t=>t.id),ids.slice(0,2).sort());
 const reopened=await openStore({url:'',file});assert.deepEqual(await reopened.listGallery(),await store.listGallery());await reopened.close();
 assert.equal((await get('/api/gallery?sort=invalid')).status,400);
});
test('real visits reorder gallery while polling and browsing gallery are read-only; visits preserve revisions',async t=>{
 const {store,get,post}=await fixture(t),id=randomUUID();
 const claim=await post('/api/trees',{id});assert.equal(claim.status,201);
 assert.deepEqual((await get('/api/gallery')).data.trees,[]);
 const untouched=await store.get(id);await get('/api/trees/'+id);assert.deepEqual(await store.get(id),untouched);
 assert.equal((await post('/api/trees/'+id+'/visits',{}, {Origin:'https://other.example'})).status,403);
 assert.equal((await post('/api/trees/'+randomUUID()+'/visits')).status,404);
 const visit=await post('/api/trees/'+id+'/visits');assert.equal(visit.status,200);
 const saved=await store.get(id);assert.equal(saved.revision,0);assert.equal(saved.lastVisitedAt,visit.data.lastVisitedAt);
 assert.equal((await get('/api/gallery')).data.trees[0].id,id);
 assert.equal((await get('/api/gallery?sort=visited')).data.trees[0].id,id);
 assert.deepEqual((await get('/api/gallery?sort=interacted')).data.trees,[]);
 await get('/api/gallery');await get('/api/trees/'+id);assert.deepEqual(await store.get(id),saved);
 assert.equal((await post('/api/gallery')).status,405);
});
test('successful interactions use wall time, retries do not bump activity, and visits cannot overwrite cuts',async t=>{
 const {store,get,post}=await fixture(t),id=randomUUID();
 const {data:tree}=await post('/api/trees',{id});
 const branch=snapshot(tree).nodes.find(n=>n.role==='primary'),body={id:randomUUID(),branchId:branch.id};
 const [cut,visit]=await Promise.all([post('/api/trees/'+id+'/cuts',body),post('/api/trees/'+id+'/visits')]);
 assert.equal(cut.status,200);assert.equal(visit.status,200);
 const saved=await store.get(id);assert.equal(saved.cuts.length,1);assert.ok(saved.lastInteractedAt);assert.ok(saved.lastVisitedAt);
 await post('/api/trees/'+id+'/cuts',body);assert.equal((await store.get(id)).lastInteractedAt,saved.lastInteractedAt);
 const start=Date.now();assert.equal((await post('/api/trees/'+id+'/cheats',cheatRequest(saved,500))).status,200);
 const edited=await store.get(id);assert.ok(edited.lastInteractedAt>=start);assert.ok(edited.createdAt<saved.createdAt);assert.equal(edited.lastVisitedAt,saved.lastVisitedAt);
 assert.equal((await get('/api/gallery?sort=interacted')).data.trees[0].lastInteractedAt,edited.lastInteractedAt);
});
test('legacy pruned trees appear without fabricating visit times; preview SVGs use independent definitions',async t=>{
 const {store,get,base}=await fixture(t),id=randomUUID(),record={id,version:VERSION,createdAt:1,config:configForClaim(id),cuts:[{id:randomUUID(),branchId:'missing',at:12345}]};
 await store.mutate(id,()=>record);
 const {data}=await get('/api/gallery');assert.equal(data.trees[0].lastInteractedAt,12345);assert.equal(data.trees[0].lastVisitedAt,0);
 assert.deepEqual((await get('/api/gallery?sort=visited')).data.trees,[]);
 const tree=snapshot(record),first=draw(tree,{id:'gallery-a'}),second=draw(tree,{id:'gallery-b'});
 assert.ok(first.includes('id="gallery-a-root-opening"'));assert.ok(second.includes('url(#gallery-b-root-opening)'));assert.ok(!second.includes('gallery-a'));
 for(const route of ['/gallery','/gallery/']){const response=await fetch(base+route);assert.equal(response.status,200);assert.match(await response.text(),/gallery-grid/);}
 assert.match(await (await fetch(base+'/')).text(),/href="\/gallery"/);
});

test('cursor pagination handles equal timestamps without duplicates and stops at 200',async t=>{
 const records=Array.from({length:210},()=>{const id=randomUUID();return {id,version:VERSION,createdAt:1,config:configForClaim(id),cuts:[],lastVisitedAt:10000};});
 const {get}=await fixture(t,records),ids=[];let cursor=null,pages=0;
 do{
  const result=await get('/api/gallery'+(cursor?'?cursor='+encodeURIComponent(cursor):''));assert.equal(result.status,200);
  assert.ok(result.data.trees.length<=24);ids.push(...result.data.trees.map(tree=>tree.id));cursor=result.data.nextCursor;pages++;
 }while(cursor&&pages<20);
 assert.equal(cursor,null);assert.equal(pages,9);assert.equal(ids.length,200);assert.equal(new Set(ids).size,200);
 assert.deepEqual(ids,records.map(tree=>tree.id).sort().slice(0,200));
 const first=(await get('/api/gallery')).data;
 assert.equal((await get('/api/gallery?sort=visited&cursor='+first.nextCursor)).status,400);
 for(const cursor of ['', 'bad', Buffer.from(JSON.stringify({sort:'active',id:records[0].id,at:10000,count:200})).toString('base64url')])assert.equal((await get('/api/gallery?cursor='+cursor)).status,400);
});

test('cursor follows activity order after a new visitor changes earlier ranking',async t=>{
 const records=Array.from({length:30},(_,i)=>{const id=randomUUID();return {id,version:VERSION,createdAt:1,config:configForClaim(id),cuts:[],lastVisitedAt:10000-i};});
 const {get,store}=await fixture(t,records);
 const first=(await get('/api/gallery')).data;
 // An unseen tree moves ahead of the cursor; it is visible on the next refresh.
 await store.mutate(records[27].id,tree=>({...tree,lastVisitedAt:20000}));
 const second=(await get('/api/gallery?cursor='+first.nextCursor)).data;
 assert.deepEqual(second.trees.map(tree=>tree.id),records.slice(24).filter(tree=>tree.id!==records[27].id).map(tree=>tree.id));
 assert.equal(second.nextCursor,null);
 assert.equal((await get('/api/gallery')).data.trees[0].id,records[27].id);
});
