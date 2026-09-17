import test from 'node:test';
import assert from 'node:assert/strict';
import {createSharing} from '../prototype/share.mjs';

const png=()=>new Response(new Blob(['png'],{type:'image/png'}),{headers:{'Content-Type':'image/png'}});
function setup(t,{platform={},load=async()=>png()}={}){
 const globals={location:{origin:'https://garden.example'},navigator:platform,fetch:load};
 for(const [key,value]of Object.entries(globals)){
  const previous=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value,configurable:true});
  t.after(()=>previous?Object.defineProperty(globalThis,key,previous):delete globalThis[key]);
 }
 t.mock.method(Date,'now',()=>120000);
 const record={id:'9c6539c0-c82e-4eab-a726-c13d6100869f',revision:0},button={},statuses=[];
 const sharing=createSharing({button,getRecord:()=>record,onStatus:text=>statuses.push(text)});
 return {button,record,statuses,sharing};
}

test('one click opens native sharing synchronously with the prefetched photo and invitation',async t=>{
 let calls=0,payload;
 const {button,record,sharing}=setup(t,{platform:{canShare:()=>true,share:data=>{calls++;payload=data;return Promise.resolve();}}});
 await sharing.prepare();
 const pending=button.onclick();assert.equal(calls,1);assert.equal(payload.files[0].type,'image/png');
 assert(payload.url.endsWith('/t/'+record.id));assert(payload.text.includes('浇浇水'));await pending;
});

test('a slow thumbnail cannot delay the system sheet or lose click activation',async t=>{
 let finish,calls=0,payload;
 const {button,sharing}=setup(t,{load:()=>new Promise(resolve=>{finish=resolve;}),platform:{canShare:()=>true,share:data=>{calls++;payload=data;return Promise.resolve();}}});
 const preparing=sharing.prepare(),clicked=button.onclick();
 assert.equal(calls,1);assert(!payload.files);assert(payload.url.includes('/t/'));
 await clicked;finish(png());await preparing;
 await button.onclick();assert.equal(payload.files[0].type,'image/png');
});

test('cancelled native sharing never copies or shows a fallback; repeated clicks do not open another sheet',async t=>{
 let cancel,calls=0,copies=0;
 const {button,statuses}=setup(t,{platform:{share:()=>{calls++;return new Promise((resolve,reject)=>{cancel=reject;});},clipboard:{writeText:async()=>{copies++;}}}});
 const pending=button.onclick();await button.onclick();assert.equal(calls,1);
 cancel(new DOMException('cancel','AbortError'));await pending;
 assert.equal(copies,0);assert.deepEqual(statuses,['']);
});

test('unsupported native sharing copies the invitation and reports clipboard failure without a panel',async t=>{
 let copied,fail=false;
 const {button,record,statuses}=setup(t,{platform:{clipboard:{writeText:async text=>{if(fail)throw Error('denied');copied=text;}}}});
 await button.onclick();assert(copied.includes(record.id));assert(copied.includes('快来看我种的盆栽'));assert.match(statuses.at(-1),/已复制/);
 fail=true;await button.onclick();assert.match(statuses.at(-1),/地址栏/);
});

test('image failures retain direct link sharing and revisions discard stale thumbnails',async t=>{
 let payload,broken=true,finish;
 const {button,record,sharing}=setup(t,{load:async()=>broken?new Response('',{status:503}):new Promise(resolve=>{finish=resolve;}),platform:{canShare:()=>true,share:async data=>{payload=data;}}});
 await sharing.prepare();await button.onclick();assert(!payload.files);
 broken=false;const first=sharing.prepare();finish(png());await first;await button.onclick();assert(payload.files);
 record.revision++;const second=sharing.prepare();await button.onclick();assert(!payload.files);
 finish(png());await second;await button.onclick();assert(payload.files);
});
