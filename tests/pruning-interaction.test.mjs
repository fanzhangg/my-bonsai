import test from 'node:test';
import assert from 'node:assert/strict';
import {createPruning} from '../prototype/pruning.mjs';

// Minimal DOM adapter: drive real event handlers without a browser dependency.
class Element extends EventTarget {
  constructor(tag='div'){
    super();this.tag=tag;this.children=[];this.style={};this.dataset={};this.attrs={};this.classes=new Set();this.clientWidth=800;this.clientHeight=600;
    this.classList={add:(...names)=>names.forEach(n=>this.classes.add(n)),remove:(...names)=>names.forEach(n=>this.classes.delete(n)),contains:name=>this.classes.has(name)};
  }
  set className(value){this.classes=new Set(value.split(' '));}
  setAttribute(key,value){this.attrs[key]=String(value);}
  getAttribute(key){return this.attrs[key]??null;}
  hasAttribute(key){return key in this.attrs;}
  append(child){child.remove();child.parent=this;this.children.push(child);}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);this.parent=null;}
  replaceChildren(){for(const c of [...this.children])c.remove();}
  contains(el){return el===this||this.children.some(c=>c.contains(el));}
  closest(selector){return selector.split(',').includes(this.tag)?this:this.parent?.closest(selector)??null;}
  querySelectorAll(selector){
    const matches=el=>selector.split(',').some(s=>s.startsWith('.')?el.classList.contains(s.slice(1)):s.startsWith('[')?el.hasAttribute(s.slice(1,-1)):el.tag===s);
    return this.children.flatMap(c=>[...(matches(c)?[c]:[]),...c.querySelectorAll(selector)]);
  }
  querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
  getBoundingClientRect(){return {x:0,y:0};}
  getScreenCTM(){return {a:1,b:0,inverse(){return this;}};}
  setPointerCapture(){}
  animate(){return {finished:Promise.resolve()};}
}
function fire(el,type,details={}){const event=new Event(type,{cancelable:true});Object.assign(event,{button:0,pointerId:1,pointerType:'mouse',clientX:736,clientY:530,...details});el.dispatchEvent(event);}
const settled=()=>new Promise(resolve=>setImmediate(resolve));
function setup(t,{fail=false}={}){
  const win=new Element(),doc=new Element();doc.createElement=tag=>new Element(tag);doc.createElementNS=(_,tag)=>new Element(tag);
  const globals={window:win,document:doc,matchMedia:()=>({matches:true}),getComputedStyle:()=>({transform:'none',getPropertyValue:()=> '0px'}),ResizeObserver:class{observe(){}},DOMPoint:class{constructor(x,y){this.x=x;this.y=y;}matrixTransform(){return this;}}};
  for(const [key,value]of Object.entries(globals)){const previous=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value,configurable:true});t.after(()=>previous?Object.defineProperty(globalThis,key,previous):delete globalThis[key]);}
  const scene=new Element(),treeElement=new Element(),svg=new Element('svg'),tool=new Element('button'),message=new Element('p');
  scene.append(tool);scene.append(message);treeElement.append(svg);
  const branch={id:'side',role:'primary',x:100,y:100,cx1:160,cy1:100,cx2:240,cy2:100,ex:300,ey:100,width:10,tipWidth:4,growth:1};
  const wood=new Element('path');wood.setAttribute('data-wind-wood',0);svg.append(wood);
  const commits=[],busy=[],errors=[];
  const pruning=createPruning({scene,treeElement,tool,message,onCommit:async id=>{if(fail)throw new Error('offline');commits.push(id);},onBusyChange:value=>busy.push(value),onError:error=>errors.push(error)});
  pruning.refresh({nodes:[branch]});pruning.setActive(true);
  const markers=scene.querySelector('.pruning-points');
  const point=()=>({clientX:parseFloat(markers.children[0].style.left),clientY:parseFloat(markers.children[0].style.top)});
  const pickup=(type='mouse')=>{fire(tool,'pointerdown',{pointerType:type});fire(win,'pointerup',{pointerType:type});};
  return {win,doc,scene,tool,message,svg,wood,markers,point,pickup,commits,busy,errors,pruning};
}
test('click pickup shows points, hovering snaps and marks selection, second click commits once',async t=>{
  const h=setup(t);h.pickup();
  assert.equal(h.markers.children.length,1);assert.equal(h.pruning.busy,true);assert.equal(h.tool.getAttribute('aria-pressed'),'true');
  const point=h.point();fire(h.win,'pointermove',{...point,clientY:point.clientY+20});
  assert.equal(parseFloat(h.tool.style.top),point.clientY+12);
  assert.ok(h.markers.children[0].classList.contains('is-selected'));assert.ok(h.wood.classList.contains('pruning-selected'));assert.match(h.message.textContent,/已选中旁支 · 点击/);
  fire(h.win,'pointerdown',point);fire(h.win,'pointerup',point);fire(h.win,'pointerup',point);await settled();
  assert.deepEqual(h.commits,['side']);assert.deepEqual(h.busy,[true,false]);assert.equal(h.pruning.busy,false);assert.equal(h.markers.children.length,0);assert.equal(h.svg.children.length,0);
  h.pickup();assert.equal(h.markers.children.length,0);
});
test('touch drag offsets the scissors above the finger and release cuts; touch tap uses the visible point',async t=>{
  const h=setup(t);fire(h.tool,'pointerdown',{pointerType:'touch'});const point=h.point();
  fire(h.win,'pointermove',{...point,clientY:point.clientY+54,pointerType:'touch'});
  assert.ok(h.tool.classList.contains('is-snapped'));assert.match(h.message.textContent,/松手/);
  fire(h.win,'pointerup',{...point,clientY:point.clientY+54,pointerType:'touch'});await settled();assert.deepEqual(h.commits,['side']);
});
test('touch click pickup followed by tapping a marker selects its exact location',async t=>{
  const h=setup(t);h.pickup('touch');const point=h.point();
  fire(h.win,'pointerdown',{...point,pointerType:'touch'});assert.ok(h.tool.classList.contains('is-snapped'));
  fire(h.win,'pointerup',{...point,pointerType:'touch'});await settled();assert.deepEqual(h.commits,['side']);
});
test('Escape, interrupted drag and blank release clear points and never commit',async t=>{
  const h=setup(t);
  for(const cancel of [()=>fire(h.win,'keydown',{key:'Escape'}),()=>fire(h.win,'blur'),()=>fire(h.win,'scroll')]){
    h.pickup();fire(h.win,'pointermove',h.point());cancel();await settled();
    assert.equal(h.markers.children.length,0);assert.equal(h.pruning.busy,false);assert.equal(h.tool.classList.contains('is-snapped'),false);assert.equal(h.wood.classList.contains('pruning-selected'),false);
  }
  fire(h.tool,'pointerdown',{pointerType:'touch'});fire(h.tool,'pointercancel');await settled();
  assert.equal(h.pruning.busy,false);
  fire(h.tool,'pointerdown');fire(h.win,'pointerup',{clientX:700,clientY:400});await settled();
  assert.deepEqual(h.commits,[]);assert.equal(h.pruning.busy,false);
});

test('secondary touches cannot pick up, move, cancel or drop the primary scissors gesture',async t=>{
  const h=setup(t),secondary={pointerId:2,pointerType:'touch',isPrimary:false};
  fire(h.tool,'pointerdown',secondary);assert.equal(h.pruning.busy,false);
  fire(h.tool,'pointerdown',{pointerType:'touch'});
  const point=h.point(),aim={...point,clientY:point.clientY+54,pointerType:'touch'};
  fire(h.win,'pointermove',aim);assert.ok(h.tool.classList.contains('is-snapped'));
  fire(h.win,'pointermove',{...secondary,clientX:10,clientY:10});
  fire(h.tool,'pointercancel',secondary);fire(h.tool,'lostpointercapture',secondary);fire(h.win,'pointerup',secondary);
  assert.equal(h.pruning.busy,true);assert.ok(h.tool.classList.contains('is-snapped'));
  fire(h.win,'pointerup',aim);await settled();assert.deepEqual(h.commits,['side']);
});

test('a secondary touch cannot claim the next tap after scissors pickup',async t=>{
  const h=setup(t);h.pickup('touch');const point=h.point();
  fire(h.win,'pointerdown',{...point,pointerId:2,pointerType:'touch',isPrimary:false});
  fire(h.win,'pointerup',{...point,pointerId:2,pointerType:'touch',isPrimary:false});
  assert.equal(h.tool.classList.contains('is-snapped'),false);assert.deepEqual(h.commits,[]);
  fire(h.win,'pointerdown',{...point,pointerType:'touch'});fire(h.win,'pointerup',{...point,pointerType:'touch'});await settled();
  assert.deepEqual(h.commits,['side']);
});

test('scissors return to the current viewport if it changes during the return animation',async t=>{
  const h=setup(t);h.pickup();
  h.tool.animate=()=>{h.scene.clientWidth=844;h.scene.clientHeight=390;return {finished:Promise.resolve()};};
  fire(h.win,'keydown',{key:'Escape'});await settled();
  assert.equal(h.tool.style.left,'780px');assert.equal(h.tool.style.top,'320px');assert.equal(h.pruning.busy,false);
});
test('keyboard selection shares markers; key repeat does not cut and a failed save preserves the branch',async t=>{
  const h=setup(t,{fail:true});fire(h.tool,'keydown',{key:' '});fire(h.tool,'keydown',{key:'ArrowRight'});
  assert.ok(h.markers.children[0].classList.contains('is-selected'));assert.match(h.message.textContent,/已选中旁支 1/);
  fire(h.tool,'keydown',{key:' ',repeat:true});assert.equal(h.pruning.busy,true);assert.equal(h.errors.length,0);
  fire(h.tool,'keydown',{key:' '});await settled();
  assert.equal(h.errors.length,1);assert.equal(h.pruning.busy,false);assert.equal(h.svg.children[0],h.wood);assert.equal(h.markers.children.length,0);
  h.pickup();assert.equal(h.markers.children.length,1);
});
