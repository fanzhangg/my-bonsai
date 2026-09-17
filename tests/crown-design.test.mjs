import test from 'node:test';
import assert from 'node:assert/strict';
import {applyCrownDesign,CROWN_NAMES} from '../prototype/crown-design.mjs';
import {generateBranchDesign} from '../prototype/branch-design.mjs';
import {grow,HOUR} from '../prototype/growth.mjs';
import {pointOn} from '../prototype/core/v1/model.mjs';
import {canopyPoint} from '../prototype/morphology.mjs';
import {render} from '../prototype/growing-render.mjs';
const at=200*HOUR;
const build=(record,p=1,time=at)=>grow(record,p,{at:time,generator:generateBranchDesign});

test('basic crowns keep wood intact, connect every leaf site and fit the review camera',()=>{
  for(const preset of Object.keys(CROWN_NAMES))for(let seed=1;seed<=5;seed++)for(const p of [.5,1]){
    const record={config:{preset,seed:`DESIGN-SYSTEM-${String(seed).padStart(2,'0')}`}},tree=build(record,p),before=structuredClone(tree);
    const crown=applyCrownDesign(tree);
    assert.deepEqual(tree,before);assert.deepEqual(crown.nodes,tree.nodes);assert.deepEqual(crown,applyCrownDesign(tree));
    const nodes=new Map(tree.nodes.map(n=>[n.id,n]));
    if(preset!=='broom'&&p===1){
      const crowns=new Map();
      for(const c of crown.clusters){
        if(crowns.has(c.node))assert.equal(c.crownShade,crowns.get(c.node));
        crowns.set(c.node,c.crownShade);
      }
      assert(new Set(crowns.values()).size>1,'small branches have independent depth tones');
    }
    for(const c of crown.clusters){
      const n=nodes.get(c.node),anchor=pointOn(n,c.anchorT);
      assert.equal(anchor.x,c.anchorX);assert.equal(anchor.y,c.anchorY);
      assert.equal(n.role,'twig');
      for(let i=0;i<40;i++){
        const q=canopyPoint(c,i*Math.PI/20);
        assert(q.x>tree.root.x-290&&q.x<tree.root.x+330);
        assert(q.y>tree.root.y-410&&q.y<tree.root.y+190);
      }
    }
    assert(!/NaN|undefined/.test(render(crown)));
  }
});

test('crown cuts leave survivors unchanged and regrowth uses the new branch anchors',()=>{
  for(const preset of Object.keys(CROWN_NAMES)){
    const record={createdAt:0,config:{preset,seed:'crown-cuts'},cuts:[]};
    const before=applyCrownDesign(build(record));
    const primaries=before.nodes.filter(n=>n.role==='primary');
    record.cuts=[{branchId:primaries[0].id,at,seq:1}];
    const after=applyCrownDesign(build(record));
    const ids=new Set(after.nodes.map(n=>n.id));
    assert.deepEqual(after.clusters,before.clusters.filter(c=>ids.has(c.node)));
    const survivingPads=new Set(after.clusters.map(c=>c.pad));
    assert.deepEqual(after.crownEnvelopes,before.crownEnvelopes.filter(e=>survivingPads.has(e.pad)));
    record.cuts=[];assert.deepEqual(applyCrownDesign(build(record)),before);
    record.cuts=primaries.map((n,i)=>({branchId:n.id,at,seq:i+1}));
    assert.equal(applyCrownDesign(build(record)).clusters.length,0);
    assert.equal(applyCrownDesign(build(record)).crownEnvelopes.length,0);
    const later=applyCrownDesign(build(record,1,at+120*HOUR));
    assert(later.clusters.length>0);
    for(const c of later.clusters){
      const n=later.nodes.find(n=>n.id===c.node);assert(n.regrown);
      assert.deepEqual(pointOn(n,c.anchorT),{x:c.anchorX,y:c.anchorY});
    }
  }
});
