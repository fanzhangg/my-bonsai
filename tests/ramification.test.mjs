import test from 'node:test';
import assert from 'node:assert/strict';
import {createRamification,family,cutPlan,pruneRamification,flushRamification} from '../prototype/ramification-model.mjs';
import {pointOn} from '../prototype/core/v1/model.mjs';

function attached(tree){
  for(const n of tree.nodes.filter(n=>n.parent)){
    const parent=tree.nodes.find(p=>p.id===n.parent);assert.ok(parent,`Missing parent: ${n.id}`);
    const anchor=pointOn(parent,n.attach);
    assert.ok(Math.hypot(anchor.x-n.x,anchor.y-n.y)<1e-8,`Detached: ${n.id}`);
    assert.ok(n.width<parent.width,`Taper: ${n.id}`);
  }
}
test('three branch orders are attached to parents and seeded geometry is stable',()=>{
  for(const species of ['elm','juniper']){
    const tree=createRamification(species);attached(tree);
    assert.deepEqual(new Set(tree.nodes.map(n=>n.order)),new Set([0,1,2,3]));
    assert.ok(tree.nodes.filter(n=>n.leaves).every(n=>n.order===3));
    assert.deepEqual(tree,createRamification(species));
  }
});
test('all three orders prune their own descendants without changing surviving wood',()=>{
  for(const id of ['B1','B1.1','B1.1.1']){
    const tree=createRamification(),original=structuredClone(tree),ids=family(tree,id),plan=cutPlan(tree,id);
    const next=pruneRamification(tree,id);
    assert.deepEqual(next.nodes,tree.nodes.filter(n=>!ids.has(n.id)));
    assert.equal(tree.nodes.filter(n=>n.leaves).length-next.nodes.filter(n=>n.leaves).length,plan.leaves);
    assert.deepEqual(tree,original);attached(next);
  }
  const tree=createRamification();assert.equal(pruneRamification(tree,'T'),tree);
  assert.equal(pruneRamification(tree,'missing'),tree);
});
test('shortening preserves proximal children and the exact surviving curve, including repeated cuts',()=>{
  let tree=createRamification();
  for(let i=0;i<3;i++){
    const before=tree.nodes.find(n=>n.id==='B1'),plan=cutPlan(tree,'B1','shorten');
    const next=pruneRamification(tree,'B1','shorten'),after=next.nodes.find(n=>n.id==='B1');
    for(const t of [0,.3,.7,1]){
      const a=pointOn(before,t*plan.t),b=pointOn(after,t);assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-8);
    }
    assert.ok(next.nodes.every(n=>!plan.removed.has(n.id)));attached(next);tree=next;
  }
});
test('new shoots stay attached and can be pruned; bare juniper wood does not regenerate',()=>{
  for(const species of ['elm','juniper']){
    const cut=pruneRamification(createRamification(species),'B1.1.1','shorten');
    const grown=flushRamification(cut),fresh=grown.nodes.filter(n=>n.fresh);
    assert.equal(fresh.length,species==='elm'?2:0);attached(grown);
    assert.equal(flushRamification(grown).nodes.length,grown.nodes.length);
    for(const shoot of fresh)assert.ok(!pruneRamification(grown,shoot.id).nodes.some(n=>n.id===shoot.id));
  }
  const retained=pruneRamification(createRamification('juniper'),'B1','shorten');
  assert.ok(flushRamification(retained).nodes.some(n=>n.fresh));
});
