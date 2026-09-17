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
