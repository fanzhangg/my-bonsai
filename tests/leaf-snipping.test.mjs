import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Resvg} from '@resvg/resvg-js';
import {snapshot,draw,HOUR} from '../prototype/growth.mjs';
import {CURRENT_VERSION} from '../prototype/tree-versions.mjs';
import {normalizeDesign,FORMS} from '../prototype/core/v3/config.mjs';
import {leafLayers,leafSites,SNIP_MODEL,snipAt,snipTarget,snippedRim,smoothLeafPath,referenceRim,polygonArea,shapeLeafPoint} from '../prototype/leaf-trim-model.mjs';
import {saveLeafTrims} from '../prototype/leaf-trim-events.mjs';
import {applyCheat,cheatRequest} from '../prototype/cheats.mjs';
const at=168*HOUR;
const recordFor=preset=>({version:CURRENT_VERSION,createdAt:0,revision:0,config:normalizeDesign({preset:preset??'juniper',seed:'whole-leaf-test'}),cuts:[],leafTrims:[]});
const request=(r,g,targets)=>({id:randomUUID(),revision:r.revision,operations:[{model:SNIP_MODEL,crownId:g.id,targets}]});
const glyphs=(svg,key)=>{const s=svg.split('data-leaf-cluster="'+key+'"')[1]?.split('data-leaf-cluster=')[0]??'';return new Map([...s.matchAll(/<g data-leaf-index="(\d+)">([\s\S]*?)<\/g>/g)].map(m=>[Number(m[1]),m[2]]));};

test('snips remove complete leaves and needle bundles; every surviving glyph stays intact',()=>{
 for(const preset of ['broom','pine','juniper']){
  const r=recordFor(preset),tree=snapshot(r,at),g=leafLayers(tree)[0],c=g.clusters[0],site=leafSites(tree,c)[0],before=glyphs(draw(tree),c.key);
  const saved=saveLeafTrims(r,request(r,g,[{clusterKey:c.key,index:site.index}]),at),after=snapshot(saved,at),markup=draw(after),leaves=glyphs(markup,c.key);
  assert(before.has(site.index));assert(!leaves.has(site.index));
  for(const [i,glyph]of before)if(i!==site.index){assert(leaves.has(i));assert.equal((leaves.get(i).match(/<(path|ellipse) /g)??[]).length,(glyph.match(/<(path|ellipse) /g)??[]).length,'remaining leaves keep their complete geometry');}
  assert.deepEqual(leafSites(tree,c).map(s=>s.size),leafSites(after,after.clusters.find(x=>x.key===c.key)).map(s=>s.size));
  assert(!markup.includes('<mask'),'new snips never cut a circular or line-shaped hole');
  assert.deepEqual(tree.nodes,after.nodes);
  const members=new Set(g.clusters.map(c=>c.key));assert.deepEqual(tree.clusters.filter(x=>!members.has(x.key)),after.clusters.filter(x=>!members.has(x.key)));
  assert.equal(draw(snapshot(structuredClone(saved),at)),markup);
  assert.equal(draw(snapshot(applyCheat(saved,cheatRequest(saved,168),300*HOUR),300*HOUR)),markup);
 }
});

test('a blade closure only removes a small surface tuft, then exposes leaves underneath',()=>{
 const r=recordFor(),tree=snapshot(r,at),g=leafLayers(tree)[0],source=g.clusters[0];
 const front={...source,key:'surface',z:100,leafSnips:{}},back={...source,key:'underneath',z:-100,leafSnips:{}},group={clusters:[back,front]};
 const site=leafSites(tree,source)[0],catalog=new Map([[front.key,[site]],[back.key,[site]]]);
 assert.deepEqual(snipAt(group,catalog,site,4).map(t=>t.clusterKey),['surface']);
 assert.equal(back.leafSnips[site.index],undefined);
 assert.deepEqual(snipAt(group,catalog,site,4).map(t=>t.clusterKey),['underneath']);
 assert.deepEqual(snipAt(group,catalog,site,4),[]);
 const many=new Map([[source.key,leafSites(tree,source)]]);
 assert.equal(snipAt({clusters:[source]},many,source,100).length,1);
 assert.deepEqual(snipAt(g,new Map(g.clusters.map(c=>[c.key,leafSites(tree,c)])),{x:-999,y:-999},4),[]);
});

test('freehand precision deepens a local notch while preserving both neighboring shoulders',()=>{
 const leaf=(index,angle,r=100)=>({index,x:Math.cos(angle)*r,y:Math.sin(angle)*r,originalX:Math.cos(angle)*r,originalY:Math.sin(angle)*r,size:4});
 const c={key:'local',z:1},g={clusters:[c],x:0,y:0,rx:100,ry:100};
 const sites=[...Array.from({length:6},(_,i)=>leaf(i,-Math.PI/2,100-i*4)),leaf(6,-Math.PI/2-.4),leaf(7,-Math.PI/2+.4)],catalog=new Map([[c.key,sites]]);
 const shoulders=sites.slice(6).map(s=>({x:s.x,y:s.y}));
 for(let i=0;i<6;i++){
  const p={x:sites[i].x,y:sites[i].y},target=snipTarget(g,catalog,p,2);
  assert.equal(target.leaf.index,i,'preview identifies the same complete leaf as the blade');
  const cuts=snipAt(g,catalog,p,2);assert.equal(cuts.length,1);assert.equal(cuts[0].index,i);
 }
 assert.deepEqual(sites.slice(6).map(s=>({x:s.x,y:s.y})),shoulders);
 assert(shapeLeafPoint({x:0,y:-100},c.leafShape).y>-90,'repeated precise cuts build a visible concavity');
 assert.equal(c.leafSnips[6],undefined);assert.equal(c.leafSnips[7],undefined);
 const rim=Array.from({length:720},(_,i)=>shapeLeafPoint(leaf(i,i*Math.PI/360),c.leafShape));
 assert(rim.every((p,i)=>Math.hypot(p.x-rim[(i+1)%rim.length].x,p.y-rim[(i+1)%rim.length].y)<4),'fine curves remain continuous across the notch and seam');
});

test('fine snips retain saved coarse profiles and replay identically after mixing resolutions',()=>{
 const r=recordFor(),initial=snapshot(r,at),g=leafLayers(initial)[0],c=g.clusters[0];
 const profile=Array.from({length:48},(_,i)=>.15+.1*Math.cos(i*Math.PI/24));
 const saved=saveLeafTrims(r,request(r,g,[{clusterKey:c.key,index:0}]),at);saved.leafTrims[0].shapeProfile=profile;
 const tree=snapshot(saved,at),group=leafLayers(tree).find(x=>x.id===g.id),shaped=group.clusters[0];
 const p={x:g.x+g.rx*.6,y:g.y-g.ry*.8};
 const historical=shapeLeafPoint(p,{x:shaped.leafShape.x,y:shaped.leafShape.y,rx:g.rx,ry:g.ry,depths:profile});
 const replay=shapeLeafPoint(p,shaped.leafShape);assert(Math.hypot(replay.x-historical.x,replay.y-historical.y)<1e-9);
 const catalog=new Map(group.clusters.map(c=>[c.key,leafSites(tree,c)])),target=catalog.get(shaped.key)[1];
 const cuts=snipAt(group,catalog,target,2),targets=cuts.map(({clusterKey,index})=>({clusterKey,index}));
 const next=saveLeafTrims(saved,request(saved,group,targets),at),again=snapshot(next,at).clusters.find(x=>x.key===shaped.key);
 shaped.leafShape.depths.forEach((d,i)=>assert(Math.abs(d-again.leafShape.depths[i])<1e-9));
});

test('whole-leaf snipping can still remove all foliage on every form without cutting any wood',()=>{
 for(const f of FORMS){
  let r=recordFor(f.id);const initial=snapshot(r,at);
  for(const g of leafLayers(initial)){
   const targets=g.clusters.flatMap(c=>leafSites(initial,c).map(s=>({clusterKey:c.key,index:s.index})));
   r=saveLeafTrims(r,request(r,g,targets),at);
  }
  const tree=snapshot(r,at),pixels=t=>new Resvg(draw(t).replace(/\s(data-[\w-]+)(?=[\s>])/g,' $1=""'),{fitTo:{mode:'width',value:256}}).render().pixels;
  assert(pixels(tree).equals(pixels({...tree,clusters:[],buds:[]})),f.id);
  assert.deepEqual(tree.nodes,initial.nodes);
 }
});

test('removed leaves stay absent initially and new leaves grow back from small to full size',()=>{
 const r=recordFor(),tree=snapshot(r,at),g=leafLayers(tree)[0],c=g.clusters[0],saved=saveLeafTrims(r,request(r,g,[{clusterKey:c.key,index:0}]),at);
 const cAt=h=>snapshot(saved,at+h*HOUR).clusters.find(x=>x.key===c.key);
 assert.equal(cAt(0).leafSnips[0],0);assert.equal(cAt(5).leafSnips[0],0);
 assert(cAt(24).leafSnips[0]>0&&cAt(24).leafSnips[0]<1);
 assert.equal(cAt(48).leafSnips,undefined);
 assert(cAt(48).leafShape,'new foliage retains the shaped growth envelope');
 assert(draw(snapshot(saved,at+48*HOUR))!==draw(snapshot(r,at+48*HOUR)));
});

test('one small edge snip visibly reshapes the entire layer and produces smooth closed backing paths',()=>{
 for(const f of FORMS){
  const r=recordFor(f.id),tree=snapshot(r,at),g=leafLayers(tree)[0];
  const targets=g.clusters.flatMap(c=>leafSites(tree,c).map(s=>({...s,clusterKey:c.key}))).sort((a,b)=>b.x-a.x).slice(0,3).map(({clusterKey,index})=>({clusterKey,index}));
  const saved=saveLeafTrims(r,request(r,g,targets),at),after=snapshot(saved,at),shaped=leafLayers(after).find(x=>x.id===g.id);
  const edgeChange=Math.max(...g.clusters.flatMap(c=>referenceRim(tree,c).map(p=>{const q=shapeLeafPoint(p,shaped.clusters[0].leafShape);return Math.hypot(q.x-p.x,q.y-p.y);})));
  assert(edgeChange>g.rx*.025,f.id+' must visibly move the local edge after three leaves');
  assert(shaped.clusters.every(c=>c.leafShape),'backing volumes and all leaf members share the envelope');
  const areaBefore=g.clusters.reduce((a,c)=>a+polygonArea(referenceRim(tree,c)),0),areaAfter=shaped.clusters.reduce((a,c)=>a+polygonArea(snippedRim(after,c)),0);
  assert(areaAfter<areaBefore,'backing area contracts along with the visibly shortened edge');
  for(const c of shaped.clusters){const path=smoothLeafPath(snippedRim(after,c));assert(path.endsWith('Z')&&path.includes('Q')&&!path.includes('L'));assert(!/NaN|Infinity/.test(path));}
  assert.deepEqual(after.nodes,tree.nodes);
 }
});

test('live shaping equals persisted replay and newly grown leaf volumes inherit the saved layer shape',()=>{
 const r=recordFor(),young=6*HOUR,tree=snapshot(r,young),g=leafLayers(tree)[0],catalog=new Map(g.clusters.map(c=>[c.key,leafSites(tree,c)])),leaf=catalog.get(g.clusters[0].key)[0];
 const cuts=snipAt(g,catalog,leaf,5),targets=cuts.map(({clusterKey,index})=>({clusterKey,index}));assert(targets.length);
 const saved=saveLeafTrims(r,request(r,g,targets),young),replay=snapshot(saved,young),again=leafLayers(replay).find(x=>x.id===g.id);
 g.clusters[0].leafShape.depths.forEach((d,i)=>assert(Math.abs(d-again.clusters[0].leafShape.depths[i])<1e-10));
 const later=snapshot(saved,young+168*HOUR),grown=leafLayers(later).find(x=>x.id===g.id),oldKeys=new Set(g.clusters.map(c=>c.key));
 assert(grown.clusters.some(c=>!oldKeys.has(c.key)),'fixture must contain new leaf volumes');
 assert(grown.clusters.every(c=>c.leafShape&&c.leafShape.depths.some(d=>d>0)));
 const copied=snapshot(structuredClone(saved),young+168*HOUR);assert(draw(copied)===draw(later));
});

test('whole-leaf requests validate membership and duplicates, save atomically and retry idempotently',()=>{
 const r=recordFor(),tree=snapshot(r,at),g=leafLayers(tree)[0],target={clusterKey:g.clusters[0].key,index:0},body=request(r,g,[target]);
 const saved=saveLeafTrims(r,body,at);assert.deepEqual(saveLeafTrims(saved,body,at+HOUR),saved);
 assert.throws(()=>saveLeafTrims(r,request(r,g,[target,target]),at),/无效/);
 assert.throws(()=>saveLeafTrims(r,request(r,g,[target,{...target,clusterKey:'missing'}]),at),/变化/);
 assert.throws(()=>saveLeafTrims(r,request(r,g,[{...target,index:999}]),at),/变化/);
 assert.equal(r.leafTrims.length,0);
 assert.throws(()=>saveLeafTrims(saved,{...body,operations:[{...body.operations[0],targets:[{...target,index:1}]}]},at),/已使用/);
});
