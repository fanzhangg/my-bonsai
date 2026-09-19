import test from 'node:test';
import assert from 'node:assert/strict';
import {Resvg} from '@resvg/resvg-js';
import {snapshot,draw,HOUR} from '../prototype/growth.mjs';
import {CURRENT_VERSION} from '../prototype/tree-versions.mjs';
import {normalizeDesign,FORMS} from '../prototype/core/v3/config.mjs';
import {leafLayers,leafSites,snipAt} from '../prototype/leaf-trim-model.mjs';
import {leafSupport,leafBackingMesh} from '../prototype/leaf-backing.mjs';
import {saveLeafTrims} from '../prototype/leaf-trim-events.mjs';

test('backing edges stay beneath surviving leaves during deep cuts, replay and regrowth',()=>{
 let checked=0;
 for(const form of FORMS){
  const record={version:CURRENT_VERSION,createdAt:0,revision:0,config:normalizeDesign({preset:form.id,seed:'covered-core',density:.8}),cuts:[],leafTrims:[]},at=168*HOUR;
  const tree=snapshot(record,at),group=leafLayers(tree)[0],catalog=new Map(group.clusters.map(c=>[c.key,leafSites(tree,c)])),targets=[];
  for(let i=0;i<60;i++){
   const leaves=group.clusters.flatMap(c=>catalog.get(c.key).filter(s=>(c.leafSnips?.[s.index]??1)>0)).sort((a,b)=>a.y-b.y);
   if(!leaves.length)break;
   targets.push(...snipAt(group,catalog,leaves[0],1).map(({clusterKey,index})=>({clusterKey,index})));
  }
  const saved=saveLeafTrims(record,{id:crypto.randomUUID(),revision:0,operations:[{model:'leaf-3',crownId:group.id,targets}]},at);
  for(const t of [tree,snapshot(saved,at),snapshot(saved,at+12*HOUR),snapshot(saved,at+96*HOUR)]){
   for(const c of t.clusters){
    const support=leafSites(t,c).filter(s=>(c.leafSnips?.[s.index]??1)>0).map(s=>leafSupport(s,c.leafSnips?.[s.index]??1));
    for(const triangle of leafBackingMesh(support))for(let edge=0;edge<3;edge++){
     const a=triangle[edge],b=triangle[(edge+1)%3];
     for(let i=0;i<=8;i++){
      const u=i/8,p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u};
      assert(Math.hypot(p.x-a.x,p.y-a.y)<=a.radius||Math.hypot(p.x-b.x,p.y-b.y)<=b.radius,'no uncovered backing edge, even when foliage is sparse');
     }
     checked++;
    }
   }
  }
  assert.deepEqual(tree.nodes,snapshot(saved,at).nodes);
 }
 assert(checked>0,'fixtures exercise actual backing polygons');
 assert.deepEqual(leafBackingMesh([]),[]);
 assert.deepEqual(leafBackingMesh([{x:0,y:0,radius:1},{x:20,y:0,radius:1},{x:0,y:20,radius:1}]),[],'disconnected leaves never create a bare triangular patch');
});

test('coverage margins fit inside the actual rotated leaf glyphs, including small new leaves',()=>{
 for(const [preset,shape]of [['broom','oval'],['broom','round'],['broom','maple'],['broom','fan'],['juniper','scale'],['pine','needle']]){
  const record={version:CURRENT_VERSION,createdAt:0,config:normalizeDesign({preset,leaf:shape,seed:'leaf-footprints'}),cuts:[],leafTrims:[]};
  const tree=snapshot(record,168*HOUR),c=tree.clusters[0];
  // All the sampled leaves use partial regrowth, the smallest supported case.
  c.leafSnips=Object.fromEntries(leafSites(tree,c).map(s=>[s.index,.15]));
  const markup=draw({...tree,clusters:[c],buds:[]});
  const glyphs=new Map([...markup.matchAll(/<g data-leaf-index="(\d+)">([\s\S]*?)<\/g>/g)].map(m=>[+m[1],m[2]]));
  for(const leaf of leafSites(tree,c).slice(0,8)){
   const support=leafSupport(leaf,.15),size=80,extent=4,scale=size/extent;
   const glyph=glyphs.get(leaf.index).replace(/(?:var\([^)]*\)|#[a-fA-F0-9]{6})/g,'#ffffff');
   const pixels=new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${leaf.x-extent/2} ${leaf.y-extent/2} ${extent} ${extent}">${glyph}</svg>`,{font:{loadSystemFonts:false}}).render().pixels;
   for(let i=0;i<32;i++){
    const a=i*Math.PI/16,x=Math.floor(size/2+Math.cos(a)*support.radius*scale),y=Math.floor(size/2+Math.sin(a)*support.radius*scale);
    assert(pixels[(y*size+x)*4+3]>200,shape+' support must stay inside its real glyph');
   }
  }
 }
});
