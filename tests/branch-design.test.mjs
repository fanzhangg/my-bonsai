import test from 'node:test';
import assert from 'node:assert/strict';
import {generateBranchDesign,BRANCH_STUDY_PRESETS} from '../prototype/branch-design.mjs';
import {generate} from '../prototype/morphology.mjs';
import {grow,HOUR} from '../prototype/growth.mjs';
import {render} from '../prototype/growing-render.mjs';
import {pointOn} from '../prototype/core/v1/model.mjs';
import {branchFamily} from '../prototype/pruning-model.mjs';

test('branch candidates preserve trunk centerlines and cut identities while reducing connected fine branches',()=>{
  for(const preset of BRANCH_STUDY_PRESETS)for(let sample=1;sample<=5;sample++){
    const config={preset,seed:`DESIGN-SYSTEM-${String(sample).padStart(2,'0')}`},old=generate(config),tree=generateBranchDesign(config);
    assert.deepEqual(tree,generateBranchDesign(config));
    const centerlines=nodes=>nodes.filter(n=>n.role==='trunk').map(({width,tipWidth,...n})=>n);
    assert.deepEqual(centerlines(tree.nodes),centerlines(old.nodes));
    assert.deepEqual(tree.nodes.filter(n=>n.role==='primary').map(n=>[n.id,n.parent]),old.nodes.filter(n=>n.role==='primary').map(n=>[n.id,n.parent]));
    assert(tree.nodes.length<old.nodes.length*.65);
    const byId=new Map(tree.nodes.map(n=>[n.id,n]));assert.equal(byId.size,tree.nodes.length);
    for(const n of tree.nodes){
      assert(n.width>n.tipWidth&&n.tipWidth>0);
      if(!n.parent)continue;
      const parent=byId.get(n.parent);assert(parent);
      if(n.role==='trunk')assert.equal(n.width,parent.tipWidth);
      const p=pointOn(parent,n.role==='trunk'?1:n.attachment);
      assert(Math.hypot(n.x-p.x,n.y-p.y)<1e-6);
      if(n.role!=='trunk'){
        assert(n.width<parent.width+(parent.tipWidth-parent.width)*n.attachment);
        const a=pointOn(parent,Math.max(0,n.attachment-.001)),b=pointOn(parent,Math.min(1,n.attachment+.001));
        const ux=b.x-a.x,uy=b.y-a.y,vx=n.cx1-n.x,vy=n.cy1-n.y;
        assert((ux*vx+uy*vy)/(Math.hypot(ux,uy)*Math.hypot(vx,vy))>.79,'fork follows parent flow without a sharp or backward departure');
      }
    }
    for(const c of tree.clusters){const n=byId.get(c.node);assert(n);assert.equal(n.ex,c.x);assert.equal(n.ey,c.y);}
    assert(!/NaN|undefined/.test(render(grow({config},1,{generator:generateBranchDesign}))));
  }
});

test('candidate cuts remove whole families without moving survivors; undo reconstructs the exact tree',()=>{
  for(const preset of BRANCH_STUDY_PRESETS){
    const record={config:{preset,seed:'pruning-review'},createdAt:0,cuts:[]},at=200*HOUR;
    const before=grow(record,1,{at,generator:generateBranchDesign});
    const branch=before.nodes.find(n=>n.role==='primary'),removed=branchFamily(before.nodes,branch.id);
    record.cuts.push({branchId:branch.id,at,seq:1});
    const after=grow(record,1,{at,generator:generateBranchDesign});
    assert.deepEqual(after.nodes,before.nodes.filter(n=>!removed.has(n.id)));
    assert.deepEqual(after.clusters,before.clusters.filter(c=>!removed.has(c.node)));
    record.cuts.pop();assert.deepEqual(grow(record,1,{at,generator:generateBranchDesign}),before);
  }
});

test('both comparison versions regrow matching cut targets and candidate families keep their reduced structure',()=>{
  for(const preset of BRANCH_STUDY_PRESETS){
    const at=200*HOUR,record={createdAt:0,config:{preset,seed:'regrowth-review'},cuts:[]};
    const candidate=grow(record,1,{at,generator:generateBranchDesign});
    const primaries=candidate.nodes.filter(n=>n.role==='primary');
    record.cuts=primaries.map((n,i)=>({branchId:n.id,at,seq:i+1}));
    const removed=new Set(primaries.flatMap(n=>[...branchFamily(candidate.nodes,n.id)]));
    const bare=grow(record,1,{at,generator:generateBranchDesign});
    assert(!bare.nodes.some(n=>removed.has(n.id)));assert.equal(bare.clusters.length,0);
    const later=at+120*HOUR;
    const old=grow(record,1,{at:later}),next=grow(record,1,{at:later,generator:generateBranchDesign});
    assert.deepEqual(next.nodes.filter(n=>n.role==='primary').map(n=>n.id),old.nodes.filter(n=>n.role==='primary').map(n=>n.id));
    assert(next.clusters.length>0);assert(!next.nodes.some(n=>removed.has(n.id)));
    assert(next.nodes.length<old.nodes.length);
    const ids=new Set(next.nodes.map(n=>n.id));assert(next.clusters.every(c=>ids.has(c.node)));
    const regrown=next.nodes.find(n=>n.role==='primary'),family=branchFamily(next.nodes,regrown.id);
    record.cuts.push({branchId:regrown.id,at:later,seq:record.cuts.length+1});
    assert(!grow(record,1,{at:later,generator:generateBranchDesign}).nodes.some(n=>family.has(n.id)));
  }
});
