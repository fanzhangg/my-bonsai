import test from 'node:test';
import assert from 'node:assert/strict';
import {createLeafTrimming} from '../prototype/leaf-trimming.mjs';
import {snapshot,HOUR} from '../prototype/growth.mjs';
import {CURRENT_VERSION} from '../prototype/tree-versions.mjs';
import {normalizeDesign} from '../prototype/core/v3/config.mjs';
import {leafLayers,leafSites,referenceRim,inside} from '../prototype/leaf-trim-model.mjs';
import {outerLeafEdges} from '../prototype/leaf-edge.mjs';

// Drive the real pointer lifecycle; browser checks cover appearance and hit testing.
class Element extends EventTarget {
 constructor(tag='div'){super();this.tag=tag;this.children=[];this.attrs={};this.style={setProperty(k,v){this[k]=v;}};this.hidden=false;this.classes=new Set();this.captures=new Set();this.classList={add:(...v)=>v.forEach(x=>this.classes.add(x)),remove:(...v)=>v.forEach(x=>this.classes.delete(x))};}
 set className(v){this.classes=new Set(v.split(' '));}
 setAttribute(k,v){this.attrs[k]=String(v);}
 getAttribute(k){return this.attrs[k]??null;}
 removeAttribute(k){delete this.attrs[k];}
 append(c){c.parent=this;this.children.push(c);}
 matches(s){
  if(s.startsWith('.'))return this.classes.has(s.slice(1));
  if(s.startsWith('[')){const [k,v]=s.slice(1,-1).split('=');return k in this.attrs&&(v===undefined||this.attrs[k]===v.replaceAll('"',''));}
  return s===this.tag;
 }
 closest(s){return this.matches(s)?this:this.parent?.closest(s)??null;}
 querySelectorAll(s){return this.children.flatMap(c=>[...(c.matches(s)?[c]:[]),...c.querySelectorAll(s)]);}
 querySelector(s){return this.querySelectorAll(s)[0]??null;}
 set innerHTML(value){
  this.children=[];
  if(value.startsWith('<div class="leaf-canvas">')){
   for(const [tag,cls]of [['div','leaf-canvas'],['p','leaf-sr-only'],['button','leaf-tool'],['div','leaf-floating']]){const c=new Element(tag);c.className=cls;if(tag==='p')c.setAttribute('role','status');this.append(c);}
  }else if(value.startsWith('<svg')){
   const svg=new Element('svg');svg.append(new Element('defs'));
   if(value.includes('data-leaf-focus')){const g=new Element('g');g.setAttribute('data-leaf-focus','');svg.append(g);}
   this.append(svg);
  }
 }
 getBoundingClientRect(){return {left:0,top:0,width:700,height:650};}
 getScreenCTM(){return {a:1,b:0,inverse(){return this;}};}
 focus(){document.activeElement=this;}
 setPointerCapture(id){this.captures.add(id);}
 hasPointerCapture(id){return this.captures.has(id);}
 releasePointerCapture(id){this.captures.delete(id);}
}
const fire=(el,type,details={})=>{const e=new Event(type,{cancelable:true});Object.assign(e,{button:0,pointerId:1,pointerType:'mouse',isPrimary:true,clientX:0,clientY:0,...details});el.dispatchEvent(e);};
const settled=()=>new Promise(resolve=>setImmediate(resolve));
function setup(t,{fail=false}={}){
 t.mock.timers.enable({apis:['setTimeout']});
 const win=new Element(),doc=new Element();doc.body=new Element('body');doc.activeElement=new Element('button');doc.createElement=tag=>new Element(tag);doc.createElementNS=(_,tag)=>new Element(tag);
 for(const [key,value]of Object.entries({window:win,document:doc,matchMedia:()=>({matches:true}),DOMPoint:class{constructor(x,y){Object.defineProperties(this,{x:{value:x},y:{value:y}});}matrixTransform(){return this;}}})){
  const old=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value,configurable:true});t.after(()=>old?Object.defineProperty(globalThis,key,old):delete globalThis[key]);
 }
 const record={version:CURRENT_VERSION,createdAt:0,revision:0,config:normalizeDesign({preset:'juniper',seed:'leaf-events'}),cuts:[],leafTrims:[]},at=168*HOUR;
 const tree=snapshot(record,at),group=leafLayers(tree)[0],rims=group.clusters.map(c=>referenceRim(tree,c));
 const catalog=new Map(group.clusters.map(c=>[c.key,leafSites(tree,c)]));
 const center=[...outerLeafEdges(group,catalog).values()].flat().find(p=>rims.some(rim=>inside(p,rim)));
 assert(center,'fixture needs an exposed edge reachable within the selected layer');
 const holder=new Element(),saves=[],errors=[],busy=[];
 const tool=createLeafTrimming({holder,onSave:async(body,working)=>{if(fail)throw new Error('offline');saves.push({body,working});},onBusyChange:v=>busy.push(v),onError:e=>errors.push(e)});
 const editor=doc.body.children[0],open=event=>tool.open(record,at,event);
 return {win,doc,editor,tool,holder,open,center,group,saves,errors,busy};
}
function pointer(el,type,details={}){fire(el,type,details);}

test('semantic clicks can open the scissors while secondary pointer presses cannot',t=>{
 const h=setup(t);
 h.open({type:'pointerdown',isPrimary:false});assert.equal(h.tool.busy,false);
 h.open({type:'click',isPrimary:false,currentTarget:h.doc.activeElement});assert.equal(h.tool.busy,true);
 fire(h.editor,'keydown',{key:'Escape'});assert.equal(h.tool.busy,false);
});

test('selecting a whole layer never cuts; one continuous gesture saves exactly once on release',async t=>{
 const h=setup(t);h.open();
 const target=h.editor.querySelectorAll('[data-layer-id]').find(el=>el.getAttribute('data-layer-id')===h.group.id);
 // Adapter has no bubbling; expose the focused marker as the event target.
 const event=new Event('keydown',{cancelable:true});Object.defineProperty(event,'target',{value:target});Object.assign(event,{key:' '});h.editor.dispatchEvent(event);
 assert.equal(h.saves.length,0);assert(h.tool.busy);
 pointer(h.editor,'pointerdown',{clientX:h.center.x,clientY:h.center.y});

 pointer(h.editor,'pointermove',{clientX:h.center.x+80,clientY:h.center.y});
 assert.equal(h.saves.length,0);
 pointer(h.editor,'pointerup');pointer(h.editor,'pointerup');await settled();
 assert.equal(h.saves.length,1);assert.equal(h.saves[0].body.operations.length,1);
 assert.equal(h.saves[0].body.operations[0].model,'leaf-3');
 assert(h.saves[0].working.leafTrims[0].targets.length>0);
 assert(!('points' in h.saves[0].body.operations[0]),'store cut leaves, not a paint stroke');
 assert.equal(h.tool.busy,false);assert(h.editor.hidden);assert.deepEqual(h.busy,[true,false]);
});

test('tool drag selects a large layer; secondary pointers cannot cancel or save it',async t=>{
 const h=setup(t);h.open();
 pointer(h.editor,'pointerdown',{pointerType:'touch'});pointer(h.editor,'pointermove',{clientX:h.center.x,clientY:h.center.y+54,pointerType:'touch'});
 pointer(h.editor,'pointercancel',{pointerId:2,isPrimary:false});pointer(h.editor,'pointerup',{pointerId:2,isPrimary:false});
 assert(h.tool.busy);assert.equal(h.saves.length,0);

 pointer(h.editor,'pointermove',{clientX:h.center.x+40,clientY:h.center.y+54,pointerType:'touch'});
 pointer(h.editor,'pointerup');await settled();assert.equal(h.saves.length,1);
});

test('Escape, lost capture and blur cancel an unfinished stroke without writing history',async t=>{
 const h=setup(t);
 for(const cancel of [()=>fire(h.editor,'keydown',{key:'Escape'}),()=>fire(h.editor,'lostpointercapture'),()=>fire(h.win,'blur')]){
  h.open();pointer(h.editor,'pointerdown');pointer(h.editor,'pointermove',{clientX:h.center.x,clientY:h.center.y});cancel();t.mock.timers.tick(1000);await settled();
  assert.equal(h.tool.busy,false);assert(h.editor.hidden);assert.notEqual(h.holder.style.visibility,'hidden');
 }
 assert.equal(h.saves.length,0);
});

test('save failures restore the original view and report an error without leaving invisible controls',async t=>{
 const h=setup(t,{fail:true});h.open();pointer(h.editor,'pointerdown');pointer(h.editor,'pointermove',{clientX:h.center.x,clientY:h.center.y});pointer(h.editor,'pointerup');await settled();
 assert.equal(h.saves.length,0);assert.equal(h.errors[0].message,'offline');assert.equal(h.tool.busy,false);assert(h.editor.hidden);
});

test('keyboard snips preserve DOMPoint coordinates and save one leaf immediately',async t=>{
 const h=setup(t);h.open();
 const target=h.editor.querySelectorAll('[data-layer-id]').find(el=>el.getAttribute('data-layer-id')===h.group.id);
 const event=new Event('keydown',{cancelable:true});Object.defineProperty(event,'target',{value:target});Object.assign(event,{key:' '});h.editor.dispatchEvent(event);
 // Move from the layer marker to a leaf-bearing volume using the real key path.
 for(let i=0;i<Math.round(Math.abs(h.center.x-h.group.x)/2);i++)fire(h.editor,'keydown',{key:h.center.x>h.group.x?'ArrowRight':'ArrowLeft'});
 for(let i=0;i<Math.round(Math.abs(h.center.y-h.group.y)/2);i++)fire(h.editor,'keydown',{key:h.center.y>h.group.y?'ArrowDown':'ArrowUp'});
 fire(h.editor,'keydown',{key:' '});assert.equal(h.saves.length,1);await settled();
 assert.equal(h.saves[0].body.operations[0].targets.length,1);assert(!h.tool.busy);
});

test('a quick press cuts immediately and waiting after release cannot cut again',async t=>{
 const h=setup(t);h.open();
 pointer(h.editor,'pointerdown');pointer(h.editor,'pointermove',{clientX:h.center.x,clientY:h.center.y});
 assert(h.editor.querySelector('.leaf-floating').classes.has('is-snipping'));
 pointer(h.editor,'pointerup');await settled();
 assert.equal(h.saves.length,1);assert.equal(h.saves[0].body.operations[0].targets.length,1);
 t.mock.timers.tick(2000);await settled();assert.equal(h.saves.length,1);
});

test('hovering a cuttable edge keeps the scissors moving without removing any leaves',async t=>{
 const h=setup(t);h.open();
 const target=h.editor.querySelectorAll('[data-layer-id]').find(el=>el.getAttribute('data-layer-id')===h.group.id);
 const event=new Event('keydown',{cancelable:true});Object.defineProperty(event,'target',{value:target});Object.assign(event,{key:' '});h.editor.dispatchEvent(event);
 const floating=h.editor.querySelector('.leaf-floating');
 pointer(h.editor,'pointermove',{clientX:h.center.x,clientY:h.center.y});
 assert(floating.classes.has('is-in-range'));
 t.mock.timers.tick(2000);await settled();
 assert(floating.classes.has('is-in-range'),'animation stays active even without a cut or more pointer events');
 assert.equal(h.saves.length,0);
 pointer(h.editor,'pointermove',{clientX:-999,clientY:-999});
 assert(!floating.classes.has('is-in-range'),'leaving the edge stops the loop');
 pointer(h.editor,'pointermove',{clientX:h.center.x,clientY:h.center.y});
 assert(floating.classes.has('is-in-range'));
 fire(h.editor,'keydown',{key:'Escape'});await settled();
 assert(!floating.classes.has('is-in-range'));assert.equal(h.saves.length,0);
});

test('fine keyboard aiming uses half-pixel steps and an empty snip keeps the selection',async t=>{
 const h=setup(t);h.open();
 const target=h.editor.querySelectorAll('[data-layer-id]').find(el=>el.getAttribute('data-layer-id')===h.group.id);
 const event=new Event('keydown',{cancelable:true});Object.defineProperty(event,'target',{value:target});Object.assign(event,{key:' '});h.editor.dispatchEvent(event);
 fire(h.editor,'keydown',{key:'ArrowRight'});
 const floating=h.editor.querySelector('.leaf-floating'),before=parseFloat(floating.style.left);
 fire(h.editor,'keydown',{key:'ArrowRight',shiftKey:true});assert.equal(parseFloat(floating.style.left)-before,.5);
 for(let i=0;i<500;i++)fire(h.editor,'keydown',{key:'ArrowRight'});
 fire(h.editor,'keydown',{key:' '});await settled();
 assert.equal(h.saves.length,0);assert(h.tool.busy,'an empty snip does not throw away the selected layer');
 fire(h.editor,'keydown',{key:'Escape'});assert(!h.tool.busy);
});
