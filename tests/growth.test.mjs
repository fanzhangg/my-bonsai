import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshot,grow,profile,draw,HOUR,FRAME} from '../prototype/growth.mjs';
import {PRESETS} from '../prototype/core/v1/canopy.mjs';
test('all styles start with shaped wood and real branches, grow wood and foliage, and mature in seeded 3–6 days',()=>{
 const durations=new Set();
 for(const preset of PRESETS)for(const seed of ['one','two','three']){
  const record={config:{preset:preset.id,seed},createdAt:0},initial=snapshot(record,0),days=profile(record).days;durations.add(days);assert(days>=3&&days<=6);assert(initial.nodes.filter(n=>n.role==='trunk').length>=2);assert(initial.nodes.filter(n=>n.role==='primary'&&n.growth>.4).length>=2);assert.equal(initial.clusters.length,0);
  const mature=snapshot(record,days*24*HOUR);assert.equal(mature.progress,1);assert(mature.nodes.length>initial.nodes.length);assert(mature.nodes[0].width>initial.nodes[0].width);assert(mature.nodes[0].ey!==initial.nodes[0].ey);assert(mature.clusters.length>initial.clusters.length);assert.deepEqual(mature,snapshot(record,days*24*HOUR+HOUR));
  let count=0,leaves=0;
  for(const p of [0,.06,.2,.4,.6,.8,1]){const tree=grow(record,p);assert(tree.nodes.length>=count);count=tree.nodes.length;const mass=tree.clusters.reduce((s,c)=>s+c.leafAmount,0);assert(mass>=leaves);leaves=mass;assert(tree.nodes.every(n=>!n.parent||tree.nodes.some(parent=>parent.id===n.parent)));assert(!draw(tree).includes('NaN'));}
  assert.equal(grow(record,0).nodes[0].width,0);assert.equal(grow(record,0).seedOpacity,1);
 }
 assert.equal(durations.size,3);
});
test('pot stays centered at the same screen position for every style, seed and growth stage',()=>{
 for(const preset of PRESETS)for(const seed of ['left','right'])for(const p of [0,.3,1]){
  const tree=grow({config:{preset:preset.id,seed}},p),b=tree.viewBox;
  assert.equal(b.width,FRAME.width);assert.equal(b.height,FRAME.height);
  assert.equal(tree.root.x-b.x,b.width/2);
  assert.equal(tree.root.y-b.y,FRAME.aboveSoil);
  // SVG's centered meet transform, at both mobile and desktop sizes.
  for(const [width,height] of [[354,590],[752,650]]){
   const scale=Math.min(width/b.width,height/b.height),x=(width-b.width*scale)/2+(tree.root.x-b.x)*scale;
   assert(Math.abs(x-width/2)<1e-9);
  }
 }
});

test('leaves unfold on extending twigs and stay attached throughout growth',()=>{
 for(const preset of PRESETS){
  const record={config:{preset:preset.id,seed:'together'}},mature=grow(record,1),final=new Map(mature.clusters.map(c=>[c.key,c]));
  let overlapping=false;
  for(let step=1;step<=100;step++){
   const p=step/100,tree=grow(record,p),nodes=new Map(tree.nodes.map(n=>[n.id,n])),scale=(.55+.45*p*p*(3-2*p))*p**1.5;
   for(const c of tree.clusters){
    const n=nodes.get(c.node),target=final.get(c.key),tip=mature.nodes.find(n=>n.id===c.node);
    assert(n&&n.growth>0);assert(c.leafAmount>0&&c.leafAmount<=p**3);
    if(n.growth<1)overlapping=true;
    assert(Math.abs(c.rx-target.rx*scale*n.growth)<1e-8);
    assert(Math.abs(c.x-n.ex-(target.x-tip.ex)*scale*n.growth)<1e-8);
    assert(Math.abs(c.y-n.ey-(target.y-tip.ey)*scale*n.growth)<1e-8);
   }
  }
  assert(overlapping,`${preset.id} must leaf out before its supporting twigs finish`);
  assert(mature.clusters.every(c=>c.leafAmount===1));
 }
});

test('starter leaves mark young branch tips before crowns exist and yield to real foliage',()=>{
 for(const {id:preset} of PRESETS){
  const record={config:{preset,seed:'early-leaves'}},early=snapshot({...record,createdAt:0},0);
  assert.equal(early.clusters.length,0);
  assert(early.buds.length>0,`${preset} starts with leaf hints`);
  assert.equal(grow(record,0).buds.length,0);
  for(const b of early.buds){const branch=early.nodes.find(n=>n.id===b.node);assert.equal(branch.role,'primary');assert.equal(b.x,branch.ex);assert.equal(b.y,branch.ey);assert.equal(b.starterLeaves,2);assert(b.opacity>0&&b.opacity<=1);}
  assert(draw(early).includes('data-starter-leaves="2"'));
  assert(!/NaN|Infinity/.test(draw(early)));
  const cut=early.nodes.find(n=>n.id===early.buds[0].node);
  assert(!grow({...record,cuts:[{branchId:cut.id,at:0}]},early.progress,{at:0}).buds.some(b=>b.node===cut.id));
  assert.equal(grow(record,1).buds.length,0);
 }
});
