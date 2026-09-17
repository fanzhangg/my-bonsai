import test from 'node:test';
import assert from 'node:assert/strict';
import {createWatering} from '../prototype/watering.mjs';
import {toolHome} from '../prototype/tool-home.mjs';

class Element extends EventTarget{
 constructor(){super();this.clientWidth=390;this.clientHeight=844;this.dataset={};this.style={setProperty(){}};this.classes=new Set();this.classList={add:(...v)=>v.forEach(x=>this.classes.add(x)),remove:(...v)=>v.forEach(x=>this.classes.delete(x)),contains:v=>this.classes.has(v)};}
 querySelector(){return null;}
 append(){}
 setAttribute(){}
 setPointerCapture(){}
 getBoundingClientRect(){return {x:0,y:0};}
}
function setup(t){
 const win=new Element(),doc=new Element();doc.createElementNS=()=>new Element();
 const globals={window:win,document:doc,matchMedia:()=>({matches:true}),getComputedStyle:()=>({getPropertyValue:()=> '0px'}),ResizeObserver:class{observe(){}},cancelAnimationFrame(){}};
 for(const [key,value] of Object.entries(globals)){const previous=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value,configurable:true});t.after(()=>previous?Object.defineProperty(globalThis,key,previous):delete globalThis[key]);}
 const scene=new Element(),can=new Element(),holder=new Element(),water=new Element(),status=new Element();
 const watering=createWatering({scene,can,holder,water,status,renderTree:()=>null});watering.setActive(true);
 return {win,doc,can,watering};
}
function fire(el,type,details={}){const event=new Event(type,{cancelable:true});Object.assign(event,{button:0,pointerId:1,pointerType:'touch',isPrimary:true,...details});el.dispatchEvent(event);}

test('only the primary touch can pick up the watering can; unrelated capture loss cannot drop it',t=>{
 const {can,watering}=setup(t),secondary={pointerId:2,isPrimary:false};
 fire(can,'pointerdown',secondary);assert.equal(watering.busy,false);
 fire(can,'pointerdown');assert.equal(watering.busy,true);
 fire(can,'pointerdown',secondary);fire(can,'pointercancel',secondary);fire(can,'lostpointercapture',secondary);fire(can,'pointerup',secondary);
 assert.equal(watering.busy,true);assert.ok(can.classList.contains('is-held'));
 fire(can,'pointercancel');assert.equal(watering.busy,false);assert.equal(can.dataset.remaining,'4000');
 fire(can,'pointerdown');fire(can,'lostpointercapture');assert.equal(watering.busy,false);
});

test('watering recovers after app interruption and ignores held-key repeat',t=>{
 const {win,doc,can,watering}=setup(t);
 fire(can,'keydown',{key:' '});fire(can,'keydown',{key:' ',repeat:true});assert.equal(watering.busy,true);
 fire(win,'blur');assert.equal(watering.busy,false);
 fire(can,'pointerdown');doc.hidden=true;fire(doc,'visibilitychange');assert.equal(watering.busy,false);
 doc.hidden=false;fire(can,'pointerdown');assert.equal(watering.busy,true);fire(can,'pointercancel');assert.equal(watering.busy,false);
});

test('tool homes preserve spacing and clear portrait and landscape safe areas',t=>{
 setup(t);const insets={top:0,right:44,bottom:21,left:44};
 Object.defineProperty(globalThis,'getComputedStyle',{value:()=>({getPropertyValue:name=>name==='--tool-hit-size'?'112px':name==='--tool-rest-bottom'?'104px':String(insets[name.slice(8)])+'px'}),configurable:true});
 for(const [width,height] of [[844,390],[320,568],[390,844]]){
  const scene={clientWidth:width,clientHeight:height},scissors=toolHome(scene,64),can=toolHome(scene,190);
  assert.ok(can.x-56>=insets.left);assert.ok(can.x+56<=scissors.x-56);
  assert.ok(scissors.x+56<=width-insets.right);assert.ok(scissors.y+56<=height-insets.bottom-40);
 }
});
