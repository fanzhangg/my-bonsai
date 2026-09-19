import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Resvg} from '@resvg/resvg-js';
import {snapshot,draw,HOUR} from '../prototype/growth.mjs';
import {CURRENT_VERSION} from '../prototype/tree-versions.mjs';
import {normalizeDesign,FORMS} from '../prototype/core/v3/config.mjs';
import {leafLayers,trimGroups,ERASE_MODEL,ERASE_POINT_LIMIT,ERASE_BATCH_POINTS,proposeErase,eraseEvent,applyLeafErasing,validEraseOperation} from '../prototype/leaf-trim-model.mjs';
import {saveLeafTrims} from '../prototype/leaf-trim-events.mjs';
import {applyCheat,cheatRequest} from '../prototype/cheats.mjs';

const at=168*HOUR;
const recordFor=preset=>({version:CURRENT_VERSION,createdAt:0,revision:0,config:normalizeDesign({preset:preset??'juniper',seed:'leaf-layer-test'}),cuts:[],leafTrims:[]});
const stroke=(g,points=[[-1,0],[1,0]],radius=.07)=>({model:ERASE_MODEL,crownId:g.id,radius,points});
const body=operations=>({id:randomUUID(),revision:0,operations});

test('leaf tool selects complete layout layers, including small and overlapping leaf volumes',()=>{
 for(const f of FORMS){
  const tree=snapshot(recordFor(f.id),at),layers=leafLayers(tree);
  assert.equal(layers.length,new Set(tree.clusters.map(c=>c.pad).filter(p=>p!==undefined)).size);
  assert.deepEqual(layers.flatMap(g=>g.clusters.map(c=>c.key)).sort(),tree.clusters.map(c=>c.key).sort());
  assert(layers.some(g=>g.clusters.length>1));
  assert(layers.length<trimGroups(tree).length);
 }
 const tree=snapshot(recordFor(),at),c=tree.clusters[0];tree.clusters.push({...c,key:'tiny-leaf',rx:1,ry:1,leafAmount:.1});
 assert(leafLayers(tree).find(g=>g.pad===c.pad).clusters.some(c=>c.key==='tiny-leaf'));
});

test('one stroke immediately erases all overlapping members of a layer, preserving other layers and all wood',()=>{
 const r=recordFor(),before=snapshot(r,at),g=leafLayers(before)[0];
 const saved=saveLeafTrims(r,body([stroke(g)]),at),after=snapshot(saved,at),keys=new Set(g.clusters.map(c=>c.key));
 assert.deepEqual(before.nodes,after.nodes);
 assert.deepEqual(before.clusters.filter(c=>!keys.has(c.key)),after.clusters.filter(c=>!keys.has(c.key)));
 assert(after.clusters.filter(c=>keys.has(c.key)).every(c=>c.leafErase?.length===1));
 assert.equal(after.clusters.find(c=>keys.has(c.key)).leafErase[0].radius,.07*g.scale);
 assert.deepEqual(draw(after),draw(snapshot(structuredClone(saved),at)));
 assert(!draw(after).includes('<mask'),'legacy strokes now remove whole leaves without paint masks');
 assert.deepEqual(snapshot(saved,at-1),snapshot(r,at-1));
 const rebased=applyCheat(saved,cheatRequest(saved,168),300*HOUR);
 assert.equal(draw(snapshot(rebased,300*HOUR)),draw(after));
});

test('fine continuous sweeps can erase every leaf: rendered pixels exactly match the bare tree',()=>{
 for(const f of [...FORMS,...[1,6,24].map(hour=>({id:'juniper',hour}))]){
  const at=(f.hour??168)*HOUR;
  const r=recordFor(f.id),before=snapshot(r,at),operations=leafLayers(before).map(g=>{
   // A connected serpentine brush pass: no area, depth, support or minimum-volume floor.
   const points=[];for(let row=0;row<=40;row++){const y=-4+row*.2;points.push([row%2?4:-4,y],[row%2?-4:4,y]);}
   return stroke(g,points,.12);
  });
  const saved=saveLeafTrims(r,body(operations),at),tree=snapshot(saved,at);
  const pixels=t=>new Resvg(draw(t).replace(/\s(data-[\w-]+)(?=[\s>])/g,' $1=""'),{fitTo:{mode:'width',value:320}}).render().pixels;
  const actual=pixels(tree),bare=pixels({...tree,clusters:[],buds:[]});
  assert(actual.equals(bare),f.id+' at '+(f.hour??168)+'h has no protected leaf remnant; differing channels: '+actual.reduce((n,v,i)=>n+(v!==bare[i]),0));
  assert.deepEqual(tree.nodes,before.nodes);
 }
});

test('eraser recovery is gradual, does not affect new growth, and leaves historical masks stable after branch removal',()=>{
 const r=recordFor(),before=snapshot(r,at),g=leafLayers(before)[0],saved=saveLeafTrims(r,body([stroke(g)]),at);
 const a=snapshot(saved,at),b=snapshot(saved,at+24*HOUR);
 assert(Math.abs(b.clusters[0].leafErase[0].radius-a.clusters[0].leafErase[0].radius/2)<1e-8);
 assert.deepEqual(snapshot(saved,at+48*HOUR),snapshot(r,at+48*HOUR));
 const subset=snapshot(r,at);subset.clusters=subset.clusters.filter(c=>c.key!==g.clusters[0].key);
 subset.clusters.push({...g.clusters[1],key:'new-growth'});
 applyLeafErasing(subset,saved,at);
 assert.equal(subset.clusters.at(-1).leafErase,undefined);
 assert.deepEqual(subset.clusters.find(c=>c.key===g.clusters[1].key).leafErase,a.clusters.find(c=>c.key===g.clusters[1].key).leafErase);
});

test('stroke persistence validates coordinates, counts, targets and retries atomically',()=>{
 const r=recordFor(),tree=snapshot(r,at),g=leafLayers(tree)[0],op=stroke(g),request=body([op]);
 for(const invalid of [{...op,radius:0},{...op,radius:Infinity},{...op,points:[]},{...op,points:[[NaN,0]]},{...op,points:[[5,0]]},{...op,points:Array(ERASE_POINT_LIMIT+1).fill([0,0])}])
  assert.throws(()=>saveLeafTrims(r,body([invalid]),at),/无效/);
 assert.throws(()=>saveLeafTrims(r,body([op,{...op,crownId:'layer:missing'}]),at),/变化/);
 assert.equal(r.leafTrims.length,0);
 const saved=saveLeafTrims(r,request,at);
 assert.deepEqual(saveLeafTrims(saved,request,at+HOUR),saved);
 assert.throws(()=>saveLeafTrims(saved,{...request,operations:[stroke(g,[[0,0]])]},at),/已使用/);
 assert.throws(()=>saveLeafTrims(saved,{...request,id:randomUUID()},at),/变化/);
 const long=stroke(g,Array(ERASE_POINT_LIMIT).fill([0,0]));
 assert.throws(()=>saveLeafTrims(r,body(Array(Math.ceil(ERASE_BATCH_POINTS/ERASE_POINT_LIMIT)+1).fill(long)),at),/过长/);
 assert(validEraseOperation(stroke(g,[[0,0]],.005)),'precision dabs are allowed');
 const p=proposeErase(tree,op);assert.deepEqual(eraseEvent(p,at,'test',1).clusterKeys,g.clusters.map(c=>c.key));
});
