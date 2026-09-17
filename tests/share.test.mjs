import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {openStore} from '../storage.mjs';
import {createServer} from '../server.mjs';
import {configForClaim} from '../prototype/claim.mjs';
import {VERSION,HOUR,snapshot} from '../prototype/growth.mjs';
import {shareData,invitation,nativeShareData,SHARE_TITLE,SHARE_TEXT} from '../prototype/share-data.mjs';
import {renderShareImage,publicOrigin,createShareImageCache} from '../share-preview.mjs';

test('native invitations keep the tree link with or without supported photo sharing',()=>{
 const record={id:randomUUID(),revision:4},data=shareData(record,'https://bonsai.example/ignored',60000);
 assert.equal(data.url,`https://bonsai.example/t/${record.id}`);
 assert.equal(data.image,data.url+'/share.png?v=4-1');
 assert.equal(invitation(data),`${SHARE_TITLE}\n${SHARE_TEXT}\n${data.url}`);
 const file=new File(['png'],'盆栽.png',{type:'image/png'});
 for(const platform of [{},{canShare:()=>false}])assert.deepEqual(nativeShareData(data,file,platform),{title:SHARE_TITLE,text:SHARE_TEXT,url:data.url});
 const shared=nativeShareData(data,file,{canShare:({files})=>files[0]===file});
 assert.deepEqual(shared.files,[file]);assert(shared.text.includes(data.url));assert.equal(shared.url,data.url);
 assert(!('files' in nativeShareData(data,null,{canShare:()=>true})));
});

test('public share URLs use the deployment origin or HTTPS proxy without debug parameters',()=>{
 const request={headers:{host:'bonsai.example','x-forwarded-proto':'https, http'},socket:{}};
 assert.equal(publicOrigin(request),'https://bonsai.example');
 assert.equal(publicOrigin(request,'https://garden.example/path'),'https://garden.example');
 assert.equal(publicOrigin({headers:{host:'localhost:4173'},socket:{}}),'http://localhost:4173');
 assert.throws(()=>publicOrigin(request,'javascript:alert(1)'));
});

test('tree links expose crawlable per-tree PNG previews without counting a visit or changing the record',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'bonsai-share-')),store=await openStore({url:'',file:path.join(dir,'trees.json')});
 const server=createServer(store,{publicBaseUrl:'https://garden.example',realtimeWeatherEnabled:false});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const id=randomUUID(),record={id,version:VERSION,createdAt:Date.now()-72*HOUR,config:configForClaim(id),cuts:[],revision:0};
  await store.mutate(id,()=>record);
  const response=await fetch(`${base}/t/${id}?cheat=1`),html=await response.text();
  assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/html/);
  assert(html.includes(`<meta property="og:title" content="${SHARE_TITLE}">`));
  assert(html.includes(`<meta property="og:description" content="${SHARE_TEXT}">`));
  assert(html.includes(`<meta property="og:url" content="https://garden.example/t/${id}">`));
  assert(html.includes('name="twitter:card" content="summary_large_image"'));
  const imageUrl=html.match(/property="og:image" content="([^"]+)"/)[1];
  assert(imageUrl.startsWith(`https://garden.example/t/${id}/share.png?v=0-`));assert(!imageUrl.includes('cheat'));
  const imagePath=new URL(imageUrl).pathname+new URL(imageUrl).search;
  const image=await fetch(base+imagePath),png=Buffer.from(await image.arrayBuffer());
  assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');
  assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);assert(png.length>2000);
  const head=await fetch(base+imagePath,{method:'HEAD'});assert.equal(head.status,200);assert.equal((await head.arrayBuffer()).byteLength,0);
  assert.equal((await fetch(base+imagePath+'&extra=ignored')).headers.get('content-type'),'image/png');
  assert.deepEqual(await store.get(id),record);
  const branch=snapshot(record).nodes.find(n=>n.role==='primary'&&n.growth>0);
  const cut=await fetch(`${base}/api/trees/${id}/cuts`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:randomUUID(),branchId:branch.id})});
  assert.equal(cut.status,200);
  const updatedHtml=await (await fetch(`${base}/t/${id}`)).text();assert(updatedHtml.includes(`/share.png?v=1-`));
  const changed=Buffer.from(await (await fetch(`${base}/t/${id}/share.png`)).arrayBuffer());assert.notDeepEqual(changed,png);
  assert.equal((await store.get(id)).lastVisitedAt,undefined);
  for(const route of [`/t/${randomUUID()}`,`/t/${randomUUID()}/share.png`,'/t/invalid/share.png'])assert.equal((await fetch(base+route)).status,404);
  assert.equal((await fetch(base+imagePath,{method:'POST'})).status,405);
  const homepage=await (await fetch(base+'/')).text();assert(!homepage.includes('property="og:image"'));
 }finally{await new Promise(resolve=>server.close(resolve));await store.close();await rm(dir,{recursive:true,force:true});}
});

test('thumbnail rendering follows the actual seed, saved pot and growth state',()=>{
 const at=1000000000,id=randomUUID(),record={id,version:VERSION,createdAt:at,config:configForClaim(id),cuts:[]};
 const young=renderShareImage(record,at),grown=renderShareImage(record,at+100*HOUR);
 assert.notDeepEqual(young,grown);
 assert.deepEqual(grown,renderShareImage(structuredClone(record),at+100*HOUR));
 assert.notDeepEqual(young,renderShareImage({...record,config:configForClaim(randomUUID())},at));
 const cache=createShareImageCache();assert.strictEqual(cache(record,at),cache(record,at+1));
 assert.notDeepEqual(cache({...record,revision:1,config:configForClaim(randomUUID())},at),cache(record,at));
});
