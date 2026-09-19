import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshot,HOUR} from '../prototype/growth.mjs';
import {normalizeDesign} from '../prototype/core/v3/config.mjs';
import {CURRENT_VERSION} from '../prototype/tree-versions.mjs';
import {leafLayers,leafSites,snipAt,shapeLeafPoint,snippedRim,LEAF_GROWTH_SETTLE_HOURS,foliageVolume,grownShapeProfile} from '../prototype/leaf-trim-model.mjs';
import {sculptHeart} from './helpers/freehand-heart.mjs';
import {saveLeafTrims} from '../prototype/leaf-trim-events.mjs';
import {createSnipPacer,SNIP_INTERVAL_MS} from '../prototype/leaf-trim-stroke.mjs';
import {applyCheat,cheatRequest} from '../prototype/cheats.mjs';
const record=()=>({version:CURRENT_VERSION,createdAt:0,revision:0,config:normalizeDesign({preset:'broom',seed:'heart-freehand-review',density:.65}),cuts:[],leafTrims:[]});
const at=168*HOUR;

test('real individual snips can sculpt two heart lobes, a central cleft and a pointed bottom',()=>{
 const h=sculptHeart(),tree=snapshot(h.record,h.at),g=leafLayers(tree).find(g=>g.id===h.group.id),rim=g.clusters.flatMap(c=>snippedRim(tree,c));
 const topAt=x=>Math.min(...rim.filter(p=>Math.abs(p.x-x)<h.size*.05).map(p=>p.y));
 const notch=topAt(h.center.x),left=topAt(h.center.x-h.size*.55),right=topAt(h.center.x+h.size*.55);
 assert(notch>left+h.size*.18&&notch>right+h.size*.18,'two round lobes survive on either side of the cleft');
 const bottom=Math.max(...rim.map(p=>p.y)),tip=rim.filter(p=>p.y>bottom-h.size*.04);
 assert(tip.every(p=>Math.abs(p.x-h.center.x)<h.size*.2),'bottom converges to a centered point');
 assert(bottom>h.center.y+h.size*.8);
 const available=h.group.clusters.reduce((n,c)=>n+leafSites(h.before,c).length,0);
 assert(h.targets.length<available*.5,'the sculpture retains a dense body of leaves');
 assert.deepEqual(tree.nodes,h.before.nodes);
 assert.deepEqual(snapshot(structuredClone(h.record),h.at),tree);
});

test('fast drags never queue a burst of closures; stationary, released and cancelled tools do not cut',()=>{
 const cuts=[],pacer=createSnipPacer(p=>{cuts.push({...p});return true;});
 assert(pacer.move({x:0,y:0},0));
 for(let i=1;i<SNIP_INTERVAL_MS;i++)pacer.move({x:i*10,y:0},i);
 assert.equal(cuts.length,1);
 assert(pacer.move({x:4000,y:0},SNIP_INTERVAL_MS));assert.equal(cuts.length,2);
 assert(!pacer.move({x:4000,y:0},10000));assert.equal(cuts.length,2);
 pacer.stop();assert(!pacer.move({x:4100,y:0},20000));assert.equal(cuts.length,2);
 const missing=createSnipPacer(()=>false);assert(!missing.move({x:0,y:0},0));
});

test('trimmed canopy grows locally while keeping its trained outline over the long term',()=>{
 const r=record(),tree=snapshot(r,at),g=leafLayers(tree).sort((a,b)=>b.ry-a.ry)[0],catalog=new Map(g.clusters.map(c=>[c.key,leafSites(tree,c)])),targets=[];
 for(let i=0;i<30;i++){
  const candidates=g.clusters.flatMap(c=>catalog.get(c.key).filter(s=>(c.leafSnips?.[s.index]??1)>0));
  const site=candidates.sort((a,b)=>a.y-b.y)[0];
  targets.push(...snipAt(g,catalog,site,1).map(({clusterKey,index})=>({clusterKey,index})));
 }
 const saved=saveLeafTrims(r,{id:crypto.randomUUID(),revision:0,operations:[{model:'leaf-3',crownId:g.id,targets}]},at);
 const depths=g.clusters[0].leafShape.depths,angle=depths.indexOf(Math.max(...depths))*2*Math.PI/depths.length;
 const p={x:g.sculptX+Math.cos(angle)*g.rx,y:g.sculptY+Math.sin(angle)*g.ry},radii=[],fullRadius=Math.hypot(p.x-g.sculptX,p.y-g.sculptY);
 for(const hours of [0,24,96,LEAF_GROWTH_SETTLE_HOURS,480,8760]){
  const t=snapshot(saved,at+hours*HOUR),c=t.clusters.find(c=>c.key===g.clusters[0].key),q=shapeLeafPoint(p,c.leafShape);
  radii.push(Math.hypot(q.x-g.sculptX,q.y-g.sculptY));
 }
 assert(radii[2]>radii[0]+.05,'regrowth expands the local cut edge, not only the leaves');
 assert(radii.every(r=>r<fullRadius),'the original untrained outline never replaces the sculpture');
 assert(radii.at(-1)-radii[0]<(fullRadius-radii[0])*.16,'most of the original cut depth is retained');
 assert.deepEqual(snapshot(saved,at+480*HOUR),snapshot(structuredClone(saved),at+480*HOUR));
});

test('growth is bounded, direction-dependent and continuous, with repeatable natural variation',()=>{
 const profile=Array(192).fill(.8),young=grownShapeProfile(profile,'shape-growth','layer:1',0),grown=grownShapeProfile(profile,'shape-growth','layer:1',480);
 assert.deepEqual(young,profile);
 assert(grown.every((d,i)=>d>=profile[i]*.88&&d<=profile[i]));
 assert(Math.max(...grown)-Math.min(...grown)>.01,'different crown directions grow at different rates');
 assert.notDeepEqual(grown,grownShapeProfile(profile,'another-tree','layer:1',480));
 assert.deepEqual(grown,grownShapeProfile(profile,'shape-growth','layer:1',480));
 const next=grownShapeProfile(profile,'shape-growth','layer:1',480.001);
 assert(grown.every((d,i)=>Math.abs(d-next[i])<1e-6),'no time-bucket pop or random redraw');
 for(const age of [1000,10000,1000000])assert(grownShapeProfile(profile,'shape-growth','layer:1',age).every(d=>d>=.88*.8&&d<=.8));
});

test('a heart keeps its cleft and lobes as staggered small leaves fill the trained crown',()=>{
 const h=sculptHeart(),start=snapshot(h.record,h.at),startGroup=leafLayers(start).find(g=>g.id===h.group.id);
 for(const hours of [24,96,480,8760]){
  const tree=snapshot(h.record,h.at+hours*HOUR),g=leafLayers(tree).find(g=>g.id===h.group.id),rim=g.clusters.flatMap(c=>snippedRim(tree,c));
  const topAt=x=>Math.min(...rim.filter(p=>Math.abs(p.x-x)<h.size*.06).map(p=>p.y));
  assert(topAt(h.center.x)>Math.max(topAt(h.center.x-h.size*.55),topAt(h.center.x+h.size*.55))+h.size*.13,'regrowth preserves the heart cleft');
  assert(g.clusters.every(c=>c.leafShape),'old and new volumes use one coherent trained shape');
  const catalog=new Map(g.clusters.map(c=>[c.key,leafSites(tree,c)]));
  const site=g.clusters.flatMap(c=>catalog.get(c.key).filter(s=>(c.leafSnips?.[s.index]??1)>0)).sort((a,b)=>a.y-b.y)[0];
  const cuts=snipAt(g,catalog,site,1),targets=cuts.map(({clusterKey,index})=>({clusterKey,index}));
  const saved=saveLeafTrims(h.record,{id:crypto.randomUUID(),revision:h.record.revision,operations:[{model:'leaf-3',crownId:g.id,targets}]},h.at+hours*HOUR);
  const replay=snapshot(saved,h.at+hours*HOUR),again=leafLayers(replay).find(x=>x.id===g.id);
  for(const c of g.clusters){
   const restored=again.clusters.find(x=>x.key===c.key);
   c.leafShape.depths.forEach((d,i)=>assert(Math.abs(d-restored.leafShape.depths[i])<1e-9,'no shape jump after saving a grown crown'));
   for(const leaf of catalog.get(c.key).filter(s=>(c.leafSnips?.[s.index]??1)>0)){
    const other=leafSites(replay,restored)[leaf.index];
    assert(Math.hypot(leaf.x-other.x,leaf.y-other.y)<1e-8,'visible leaves and hit targets stay in sync with replay');
   }
  }
 }
 const young=leafLayers(snapshot(h.record,h.at+12*HOUR)).find(g=>g.id===h.group.id),growth=young.clusters.flatMap(c=>Object.values(c.leafSnips??{}));
 assert(growth.some(g=>g===0)&&growth.some(g=>g>0),'buds open at different times');
 const grown=leafLayers(snapshot(h.record,h.at+48*HOUR)).find(g=>g.id===h.group.id);
 assert(grown.clusters.every(c=>!c.leafSnips),'leaf count recovers normally');
 assert(grown.clusters.some((c,i)=>leafSites(snapshot(h.record,h.at+48*HOUR),c).some(s=>s.angle!==leafSites(start,startGroup.clusters[i])[s.index]?.angle)),'new leaves are not exact copies of the old ones');
 const shifted=applyCheat(h.record,cheatRequest(h.record,264),1000*HOUR);
 const beforeShift=snapshot(h.record,264*HOUR),afterShift=snapshot(shifted,1000*HOUR);
 for(const c of beforeShift.clusters){
  const restored=afterShift.clusters.find(x=>x.key===c.key);
  assert.deepEqual(leafSites(beforeShift,c),leafSites(afterShift,restored),'saving a debug timeline preserves natural growth variation');
 }
});

test('smaller, more numerous leaves share the larger visible volume used by scissors',()=>{
 const t=snapshot(record(),at),c=t.clusters[0],sites=leafSites(t,c),volume=foliageVolume(c);
 const oldCount=Math.ceil(Math.round(37*Math.max(.3,Math.min(1,t.config.coverage*(c.foliageDensity??1)))*(c.leafBudget??1))*(c.leafAmount??1));
 assert(sites.length>oldCount*1.5);
 assert(sites.every(s=>s.size<=5.2*t.config.leafScale*(c.detailScale??1)*1.18*.75+1e-9));
 assert(volume.rx>c.rx&&volume.ry>c.ry);assert.equal(volume.x,c.x);assert.equal(volume.y,c.y);
});
