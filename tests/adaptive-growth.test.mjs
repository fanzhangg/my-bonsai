import test from 'node:test';
import assert from 'node:assert/strict';
import {createGarden,advanceGarden,pruneGarden,gardenTree,zoneStatus,canPrune,validateGarden} from '../prototype/adaptive-growth-model.mjs';
import {render} from '../prototype/growing-render.mjs';

const cutAll=s=>s.nodes.filter(n=>canPrune(n,s.hour)).reduce((state,n)=>pruneGarden(state,n.id),s);

test('each local region recovers independently while all surviving wood stays fixed',()=>{
  for(const preset of ['juniper','literati','broom']){
    const before=createGarden(preset),zone=before.zones.at(-1);
    let state=before.nodes.filter(n=>n.order===1&&n.zoneId===zone.id).reduce((s,n)=>pruneGarden(s,n.id),before);
    const survivors=structuredClone(state.nodes);
    assert.equal(state.nodes.filter(n=>n.order===1&&n.zoneId===zone.id).length,0);
    assert.ok(state.nodes.some(n=>n.order===1));
    state=advanceGarden(state,24);
    assert.equal(zoneStatus(state).find(z=>z.id===zone.id).ready,zone.target);
    for(const n of survivors){
      const current=state.nodes.find(other=>other.id===n.id);
      for(const key of ['x','y','cx1','cy1','cx2','cy2','ex','ey','width','tipWidth'])assert.equal(current[key],n[key]);
    }
    assert.ok(validateGarden(state));assert.ok(!/NaN|Infinity/.test(render(gardenTree(state))));
  }
});

test('one hundred complete pruning cycles remain bounded and recover with unique identities',()=>{
  let s=createGarden(),seen=new Set(s.nodes.map(n=>n.id));
  for(let cycle=0;cycle<100;cycle++){
    s=cutAll(s);assert.equal(s.nodes.filter(n=>n.order===1).length,0);
    s=advanceGarden(s,48);
    assert.ok(zoneStatus(s).every(z=>z.ready>=z.low));
    for(const n of s.nodes.filter(n=>n.order>0)){assert.ok(!seen.has(n.id));seen.add(n.id);}
    assert.ok(validateGarden(s));assert.equal(s.jobs.length,0);
  }
});

test('serialized recovery and arbitrary time partitions produce identical trees',()=>{
  const s=cutAll(createGarden());
  const direct=advanceGarden(s,48);
  let partitioned=JSON.parse(JSON.stringify(s));
  for(const hours of [.2,.3,1,2.25,.25,4,10,30])partitioned=advanceGarden(partitioned,hours);
  assert.deepEqual(partitioned,direct);
  assert.deepEqual(s,cutAll(createGarden()),'advancing must not mutate the input');
});

test('fine-branch pruning restores live children; pruning their parent cancels all orphan jobs',()=>{
  let s=createGarden(),parent=s.nodes.find(n=>n.order===1);
  const children=s.nodes.filter(n=>n.parent===parent.id);
  for(const n of children)s=pruneGarden(s,n.id);
  assert.ok(s.jobs.some(j=>j.parentId===parent.id));
  const restored=advanceGarden(s,24);
  assert.equal(restored.nodes.filter(n=>n.parent===parent.id).length,2);
  assert.ok(restored.nodes.filter(n=>n.parent===parent.id).every(n=>!children.some(old=>old.id===n.id)));
  s=pruneGarden(s,parent.id);assert.ok(!s.jobs.some(j=>j.parentId===parent.id));
  s=advanceGarden(s,48);assert.ok(validateGarden(s));assert.ok(!s.nodes.some(n=>n.parent===parent.id));
});

test('new direction depends on current occupancy, not only seed and birth ordinal',()=>{
  const empty=cutAll(createGarden());
  const occupied=structuredClone(empty);
  const first=advanceGarden(empty,1).nodes.find(n=>n.isNew&&n.order===1);
  occupied.nodes.push({...first,id:'occupancy-probe',parent:occupied.nodes[0].id,zoneId:'external',order:3,born:-100,isNew:false});
  const alternative=advanceGarden(occupied,1).nodes.find(n=>n.isNew&&n.order===1);
  assert.notDeepEqual([alternative.ex,alternative.ey],[first.ex,first.ey]);
});

test('young shoots and protected wood cannot be cut; a stable tree stops adding structure',()=>{
  const initial=createGarden();
  assert.strictEqual(pruneGarden(initial,initial.nodes.find(n=>n.order===0).id),initial);
  const young=advanceGarden(cutAll(initial),1),shoot=young.nodes.find(n=>n.isNew);
  assert.strictEqual(pruneGarden(young,shoot.id),young);
  const grown=advanceGarden(young,72),later=advanceGarden(grown,1000);
  assert.deepEqual(later.nodes,grown.nodes);assert.deepEqual(later.jobs,[]);
});
