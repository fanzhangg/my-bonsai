import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshot,draw,HOUR} from '../prototype/growth.mjs';
import {CURRENT_VERSION} from '../prototype/tree-versions.mjs';
import {normalizeDesign} from '../prototype/core/v3/config.mjs';
import {leafSites,leafLayers,snipNearEdge} from '../prototype/leaf-trim-model.mjs';
import {outerLeafEdges} from '../prototype/leaf-edge.mjs';
import {leafDistance} from '../prototype/leaf-geometry.mjs';
import {leafSupport} from '../prototype/leaf-backing.mjs';
import {saveLeafTrims} from '../prototype/leaf-trim-events.mjs';

test('rare flowers and clover keep their shape through edge snips, save and new growth',()=>{
 for(const shape of ['sakura','star','heart']){
  const record={version:CURRENT_VERSION,createdAt:0,revision:0,config:normalizeDesign({preset:'broom',leaf:shape,palette:'sakura',seed:'rare-trim-merge'}),cuts:[],leafTrims:[]},at=168*HOUR;
  const tree=snapshot(record,at),group=leafLayers(tree)[0],catalog=new Map(group.clusters.map(c=>[c.key,leafSites(tree,c)]));
  assert([...catalog.values()].flat().every(s=>s.shape===shape));
  for(const s of catalog.get(group.clusters[0].key).slice(0,4)){
   const support=leafSupport(s,.2);
   for(let i=0;i<32;i++)assert(leafDistance(s,{x:s.x+Math.cos(i*Math.PI/16)*support.radius,y:s.y+Math.sin(i*Math.PI/16)*support.radius},.2)<.001,'backing support stays inside each flower/leaf');
  }
  const before=draw(tree),point=[...outerLeafEdges(group,catalog).values()][0][0];
  const cuts=snipNearEdge(group,catalog,point,1);assert.equal(cuts.length,1);
  const saved=saveLeafTrims(record,{id:crypto.randomUUID(),revision:0,operations:[{model:'leaf-3',crownId:group.id,targets:cuts.map(({clusterKey,index})=>({clusterKey,index}))}]},at);
  const after=draw(snapshot(saved,at));
  assert.equal((before.match(/data-leaf-shape=/g)??[]).length-(after.match(/data-leaf-shape=/g)??[]).length,1);
  assert.equal(draw(tree),after,'live preview and persisted replay agree');
  for(const hours of [12,96]){
   const grown=draw(snapshot(saved,at+hours*HOUR));assert(grown.includes(`data-leaf-shape="${shape}"`));
   assert.equal((grown.match(/data-flower-center/g)??[]).length,shape==='heart'?0:(grown.match(/data-leaf-shape=/g)??[]).length);
  }
 }
});
