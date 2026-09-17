import test from 'node:test';
import assert from 'node:assert/strict';
import {generateCrownBaseline} from '../prototype/crown-baseline.mjs';
import {generateBranchDesign} from '../prototype/branch-design.mjs';
import {generate,canopyPoint} from '../prototype/morphology.mjs';
import {grow,HOUR} from '../prototype/growth.mjs';
import {render} from '../prototype/growing-render.mjs';

test('whole-tree light and age tint crowns without moving them',()=>{
  const config={preset:'juniper',seed:'DESIGN-SYSTEM-01'};
  const left=generateCrownBaseline(config,{lightDirection:-1}),right=generateCrownBaseline(config,{lightDirection:1});
  assert.deepEqual(left.nodes,right.nodes);
  for(let i=0;i<left.clusters.length;i++){
    const a=left.clusters[i],b=right.clusters[i],n=left.nodes.find(n=>n.id===a.node);
    assert.deepEqual([a.x,a.y,a.rx,a.ry],[b.x,b.y,b.rx,b.ry]);
    assert(Math.abs((a.crownTone+b.crownTone)/2-(.5-a.crownAge)*.22)<1e-9);
    if(n.ex>left.root.x)assert(b.crownTone>a.crownTone);
    else if(n.ex<left.root.x)assert(a.crownTone>b.crownTone);
  }
});

test('preset crown layers change color and draw order without changing the crown geometry',()=>{
  const config={preset:'juniper',seed:'DESIGN-SYSTEM-01'};
  const flat=generateCrownBaseline(config,{depth:false}),layered=generateCrownBaseline(config);
  assert.deepEqual(flat.nodes,layered.nodes);
  const geometry=tree=>tree.clusters.map(c=>[c.node,c.x,c.y,c.rx,c.ry,c.contour]);
  assert.deepEqual(geometry(flat),geometry(layered));
  assert.deepEqual(new Set(layered.clusters.map(c=>c.crownLayer)),new Set([0,1,2]));
  const tones=new Map();
  for(const c of layered.clusters){
    if(tones.has(c.node))assert.deepEqual(c.layerPalette,tones.get(c.node));
    tones.set(c.node,c.layerPalette);
    assert.equal(c.z,layered.crownWoodDepth[c.node]+.05);
  }
});

test('restored crowns retain old leaf volumes and reviewed wood without a hard envelope',()=>{
  for(let i=1;i<=5;i++)for(const refined of [false,true]){
    const config={preset:'juniper',seed:`DESIGN-SYSTEM-0${i}`},tree=generateCrownBaseline(config,{refined});
    assert.deepEqual(tree.nodes,generateBranchDesign(config).nodes);
    assert.equal(tree.clusters.length,generate(config).clusters.length);
    assert.deepEqual(tree,generateCrownBaseline(config,{refined}));
    for(const c of tree.clusters){
      const n=tree.nodes.find(n=>n.id===c.node);assert.equal(n.pad,c.pad);
      assert(Math.abs(c.x-n.ex)/c.rx<=.721);
      const rim=Array.from({length:128},(_,i)=>canopyPoint(c,i*Math.PI/64,.94));
      let inside=false;
      for(let j=0,k=rim.length-1;j<rim.length;k=j++){
        const a=rim[j],b=rim[k];
        if((a.y>n.ey)!==(b.y>n.ey)&&n.ex<(b.x-a.x)*(n.ey-a.y)/(b.y-a.y)+a.x)inside=!inside;
      }
      assert(inside,'supporting tip enters the solid foliage, with no floating gap');
    }
    const svg=render(tree);assert(!svg.includes('data-crown-envelope'));assert(!/NaN|undefined/.test(svg));
  }
});
test('restored leaf families survive pruning and regrowth without rearranging other crowns',()=>{
  const at=200*HOUR,record={createdAt:0,config:{preset:'juniper',seed:'restored-cut'},cuts:[]};
  const build=time=>grow(record,1,{at:time,generator:generateCrownBaseline});
  const before=build(at),primaries=before.nodes.filter(n=>n.role==='primary');
  record.cuts=[{branchId:primaries[0].id,at,seq:1}];
  const after=build(at),ids=new Set(after.nodes.map(n=>n.id));
  assert.deepEqual(after.clusters,before.clusters.filter(c=>ids.has(c.node)));
  record.cuts=[];assert.deepEqual(build(at),before);
  record.cuts=primaries.map((n,i)=>({branchId:n.id,at,seq:i+1}));
  assert.equal(build(at).clusters.length,0);
  const later=build(at+120*HOUR);assert(later.clusters.length>0);
  assert(later.clusters.every(c=>later.nodes.some(n=>n.id===c.node&&n.regrown)));
});
