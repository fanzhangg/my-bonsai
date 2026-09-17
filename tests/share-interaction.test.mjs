import test from 'node:test';
import assert from 'node:assert/strict';
import {createSharing} from '../prototype/share.mjs';

class Element extends EventTarget{
 constructor(){super();this.hidden=true;this.open=false;this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};}
 removeAttribute(name){delete this[name];}
 showModal(){this.open=true;}
 close(){this.open=false;this.dispatchEvent(new Event('close'));}
 focus(){this.focused=true;}
 select(){this.selected=true;}
}
function setup(t,{platform={},load=async()=>new Response(new Blob(['png'],{type:'image/png'}),{headers:{'Content-Type':'image/png'}})}={}){
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
 const globals={document:{getElementById:get},location:{origin:'https://garden.example'},navigator:platform,fetch:load};
 for(const [key,value]of Object.entries(globals)){
  const previous=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value,configurable:true});
  t.after(()=>previous?Object.defineProperty(globalThis,key,previous):delete globalThis[key]);
 }
 const record={id:'9c6539c0-c82e-4eab-a726-c13d6100869f',revision:0},button=get('share');
 createSharing({button,getRecord:()=>record});
 t.after(()=>get('share-dialog').close());
 return {get,button,record};
}

test('share click passes prepared image synchronously; cancellation never copies or sends a fallback',async t=>{
 let shares=0,copies=0,payload;
 const {get,button,record}=setup(t,{platform:{canShare:()=>true,share:data=>{shares++;payload=data;return Promise.reject(new DOMException('cancel','AbortError'));},clipboard:{writeText:async()=>{copies++;}}}});
 await button.onclick();assert.equal(get('share-image').hidden,false);assert.equal(get('share-native').disabled,false);
 const pending=get('share-native').onclick();assert.equal(shares,1);assert.equal(payload.files[0].type,'image/png');
 assert(payload.url.endsWith('/t/'+record.id));await pending;
 assert.equal(copies,0);assert.match(get('share-message').textContent,/已取消分享/);
 get('share-close').onclick();assert.equal(get('share-dialog').open,false);assert.equal(get('share-image').src,undefined);assert(button.focused);
});

test('unsupported native sharing offers copy and manual selection when clipboard permission fails',async t=>{
 const {get,button,record}=setup(t,{platform:{clipboard:{writeText:async()=>{throw new Error('denied');}}}});
 await button.onclick();assert.equal(get('share-native').hidden,true);assert(get('share-copy').classes.has('primary'));
 assert.equal(get('share-download').hidden,false);await get('share-copy').onclick();
 assert.equal(get('share-manual').hidden,false);assert(get('share-manual').selected);assert(get('share-manual').value.includes(record.id));
 assert(get('share-manual').value.includes('来给我的盆栽浇浇水'));
});

test('failed thumbnail still permits link sharing and successful invitation copying',async t=>{
 let payload,copied;
 const {get,button}=setup(t,{load:async()=>new Response('',{status:503}),platform:{share:async data=>{payload=data;},canShare:()=>true,clipboard:{writeText:async text=>{copied=text;}}}});
 await button.onclick();assert.equal(get('share-image').hidden,true);assert.equal(get('share-native').disabled,false);
 await get('share-native').onclick();assert(!payload.files);assert(payload.url.startsWith('https://garden.example/t/'));
 await get('share-copy').onclick();assert(copied.includes(payload.url));assert(copied.includes('快来看我种的盆栽'));
});

test('closing while the thumbnail loads discards its result',async t=>{
 let finish;
 const {get,button}=setup(t,{load:()=>new Promise(resolve=>{finish=resolve;})});
 const pending=button.onclick();get('share-close').onclick();
 finish(new Response(new Blob(['png'],{type:'image/png'}),{headers:{'Content-Type':'image/png'}}));await pending;
 assert.equal(get('share-dialog').open,false);assert.equal(get('share-image').hidden,true);assert.equal(get('share-image').src,undefined);
});
