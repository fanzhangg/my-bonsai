import test from 'node:test';
import assert from 'node:assert/strict';
import {Resvg} from '@resvg/resvg-js';
import {leafGlyph,leafDistance} from '../prototype/leaf-geometry.mjs';
import {snipTarget,snipNearEdge,leafSites,leafLayers} from '../prototype/leaf-trim-model.mjs';
import {snapshot,draw,HOUR} from '../prototype/growth.mjs';
import {CURRENT_VERSION} from '../prototype/tree-versions.mjs';
import {normalizeDesign} from '../prototype/core/v3/config.mjs';
import {createSnipPacer,SNIP_REACH_PX} from '../prototype/leaf-trim-stroke.mjs';

test('nearby empty space catches an exposed leaf without requiring a direct hit',()=>{
 const c={key:'selected'},other={key:'other'},group={clusters:[c],x:0,y:0};
 const leaf={index:0,x:0,y:0,size:2,angle:0,shape:'round'};
 const point={x:14,y:0};
 const catalog=new Map([[c.key,[leaf]],[other.key,[{...leaf,x:14}]]]);
 assert(leafDistance(leaf,point)>9,'aim is in blank space outside the previous tolerance');
 assert.deepEqual(snipNearEdge(group,catalog,{x:30,y:0},SNIP_REACH_PX),[],'distant foliage stays untouched');
 assert.deepEqual(snipNearEdge(group,catalog,point,SNIP_REACH_PX).map(t=>[t.clusterKey,t.index]),[['selected',0]]);
 assert.equal(other.leafSnips,undefined,'nearby other layers remain untouched');
});

test('blade hits follow real rotated leaf edges and needle tips, including small regrowth',()=>{
 for(const shape of ['oval','round','scale','maple','fan','lance','needle','sakura','star','heart'])for(const regrowth of [1,.25]){
  const leaf={x:0,y:0,size:7,angle:37,shape,tilt:.4,renderScale:1};
  const glyph=leafGlyph(leaf,'#ffffff',regrowth).replace(/\s(data-[\w-]+)(?=[\s>])/g,' $1=""'),width=160,extent=32;
  const pixels=new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width}" viewBox="-16 -16 32 32">${glyph}</svg>`,{font:{loadSystemFonts:false}}).render().pixels;
  let checks=0;
  for(let y=0;y<width;y+=2)for(let x=0;x<width;x+=2){
   const point={x:(x+.5)*extent/width-16,y:(y+.5)*extent/width-16},distance=leafDistance(leaf,point,regrowth),alpha=pixels[(y*width+x)*4+3];
   if(alpha>250){assert(distance<.08,shape+' visible leaf must be hittable');checks++;}
   if(distance>.2)assert(alpha<10,shape+' blank space cannot count as a direct hit');
  }
  assert(checks>0);
 }
});

test('an exact visible hit beats a nearby foreground leaf; overlap obeys paint order',()=>{
 const front={key:'front',z:5},back={key:'back',z:1},point={x:0,y:0};
 const leaf=(index,x)=>({index,x,y:0,size:2,angle:0,shape:'oval'});
 const catalog=new Map([[front.key,[leaf(0,3)]],[back.key,[leaf(0,0),leaf(1,0)]]]),g={clusters:[back,front]};
 assert.equal(snipTarget(g,catalog,point,2).c.key,'back','nearby foreground does not steal an exact hit');
 assert.equal(snipTarget(g,catalog,point,2).leaf.index,1,'last painted visible leaf wins');
 catalog.get(front.key)[0].x=0;assert.equal(snipTarget(g,catalog,point,2).c.key,'front');
 front.leafSnips={0:0};assert.equal(snipTarget(g,catalog,point,2).c.key,'back');
});

test('crosshair gaps cannot reach distant edges or leaves in other layers',()=>{
 const c={key:'selected'},other={key:'other'},group={clusters:[c]},point={x:0,y:0};
 const leaf=(index,x)=>({index,x,y:0,size:2,angle:0,shape:'oval'});
 const catalog=new Map([[c.key,[leaf(0,16),leaf(1,-25)]],[other.key,[leaf(0,0)]]]);
 const cut=p=>snipNearEdge(group,catalog,p,6);
 assert.equal(snipTarget(group,catalog,point,6),null,'fixture requires no precise leaf hit');
 assert.deepEqual(cut(point),[],'no long-distance snapping from inside the canopy');
 assert.deepEqual(cut({x:21,y:0}).map(t=>[t.clusterKey,t.index]),[['selected',0]]);
 assert.deepEqual(cut(point),[],'cutting one edge cannot jump to the opposite edge');
 assert.deepEqual(cut({x:-30,y:0}).map(t=>[t.clusterKey,t.index]),[['selected',1]]);
 assert.deepEqual(cut(point),[],'bare selected layer cannot borrow another layer’s leaf');
 assert.equal(other.leafSnips,undefined);
});

test('even a boundary leaf cannot be cut by a crosshair deep inside its silhouette',()=>{
 for(const x of [16,24]){
  const c={key:'selected'},g={clusters:[c],x:0,y:0};
  const catalog=new Map([[c.key,[{index:0,x:0,y:0,size:20,angle:0,shape:'round'}]]]);
  assert.deepEqual(snipNearEdge(g,catalog,{x:0,y:0},6),[],'interior stays untouched');
  assert.deepEqual(snipNearEdge(g,catalog,{x:30,y:0},6),[],'outside beyond tolerance stays untouched');
  assert.equal(snipNearEdge(g,catalog,{x,y:0},6).length,1,'within tolerance on either side of the edge');
 }
});

test('new immature foliage uses identical coordinates and size for drawing and scissors',()=>{
 const record={version:CURRENT_VERSION,createdAt:0,config:normalizeDesign({preset:'broom',seed:'young-leaf-aim'}),cuts:[],leafTrims:[]};
 let checked=0;
 for(const hours of [0,2,6,18]){
  const tree=snapshot(record,hours*HOUR);
  // Exercise the renderer's unfolding phase explicitly; trained starter
  // crowns are born at -100 and have already finished unfolding on adoption.
  tree.clusters[0].born=tree.hour-3;tree.clusters[0].duration=20;
  const markup=draw(tree);
  for(const group of leafLayers(tree))for(const c of group.clusters){
   if(tree.hour<=c.born)continue;
   const leaf=leafSites(tree,c)[0];if(!leaf||leaf.renderScale===1)continue;
   const start=markup.indexOf(`data-leaf-cluster="${c.key}"`);if(start<0)continue;
   const clusterMarkup=markup.slice(start+'data-leaf-cluster='.length).split('data-leaf-cluster=')[0];
   assert(clusterMarkup.includes(`cx="${leaf.x.toFixed(2)}" cy="${leaf.y.toFixed(2)}" rx="${leaf.size.toFixed(2)}"`));
   assert.equal(leafDistance(leaf,leaf),0);checked++;
  }
 }
 assert(checked>0,'young fixture must include leaves still unfolding');
});

test('stationary DOMPoint inputs never turn into repeat cuts through object spreading',()=>{
 const point={};Object.defineProperties(point,{x:{value:10},y:{value:20}});
 let cuts=0;const pacer=createSnipPacer(()=>{cuts++;return true;});
 assert(pacer.move(point,0));assert(!pacer.move(point,1000));assert.equal(cuts,1);
 assert(pacer.move({x:13,y:20},1100));assert.equal(cuts,2);
});
