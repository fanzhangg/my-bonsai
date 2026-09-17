import test from 'node:test';
import assert from 'node:assert/strict';
import {generateArchitecture,selectableBranches,ARCHITECTURE} from '../prototype/architecture.mjs';
import {generate as inherited,canopyPoint} from '../prototype/morphology.mjs';
import {pointOn} from '../prototype/core/v1/model.mjs';
import {cutPlan,pruneRamification,flushRamification} from '../prototype/ramification-model.mjs';
import {render} from '../prototype/growing-render.mjs';

function connected(tree){
  const map=new Map(tree.nodes.map(n=>[n.id,n]));
  assert.equal(map.size,tree.nodes.length);
  for(const n of tree.nodes){
    assert.ok(n.width>0&&n.tipWidth>0&&n.tipWidth<n.width);
    if(!n.parent)continue;
    const parent=map.get(n.parent);assert.ok(parent,`missing parent ${n.id}`);
    const p=pointOn(parent,n.attach);
    assert.ok(Math.hypot(p.x-n.x,p.y-n.y)<1e-7,`disconnected ${n.id}`);
    assert.ok(n.order===(n.role==='trunk'?0:parent.order+1),`branch order ${n.id}`);
    if(n.order)assert.ok(n.width<=parent.width);
  }
  for(const c of tree.clusters){const n=map.get(c.node);assert.ok(n?.leaves);assert.ok(Math.hypot(n.ex-c.x,n.ey-c.y)<1e-7);}
}
test('review inherits the existing scaffold at zero emphasis, with explicit big/small axes and reproducible finer branching',()=>{
  for(const preset of Object.keys(ARCHITECTURE)){
    const config={preset,seed:'inheritance'},tree=generateArchitecture(config,{character:0});
    const old=inherited({...config,...(preset==='literati'?{crownCount:3}:{})});
    for(const n of old.nodes.filter(n=>n.role!=='twig')){
      const next=tree.nodes.find(q=>q.id===n.id);
      assert.equal(next.parent,n.parent);
      for(const key of ['x','y','ex','ey','cx1','cy1','cx2','cy2','width','tipWidth'])assert.ok(Math.abs(next[key]-n[key])<1e-10);
    }
    assert.deepEqual(tree,generateArchitecture(config,{character:0}));connected(tree);
    assert.ok(selectableBranches(tree,1).length>0);assert.ok(selectableBranches(tree,2).length>0);
    assert.deepEqual(selectableBranches(tree,3),[]);
    assert.ok(tree.nodes.some(n=>n.order>2));
  }
});
test('every style and emphasis keeps connected finite wood and leaf envelopes inside a stable review camera',()=>{
  for(const preset of Object.keys(ARCHITECTURE))for(let seed=1;seed<=10;seed++)for(const character of [0,1,1.4]){
    const t=generateArchitecture({preset,seed:`DESIGN-SYSTEM-${String(seed).padStart(2,'0')}`},{character}),b=t.viewBox;connected(t);
    for(const c of t.clusters)for(let i=0;i<24;i++){
      const p=canopyPoint(c,i*Math.PI/12,1.04),margin=14;
      assert.ok(p.x-margin>=b.x&&p.x+margin<=b.x+b.width,`${preset}: horizontal crop`);
      assert.ok(p.y-margin>=b.y&&p.y+margin<=b.y+b.height,`${preset}: vertical crop`);
    }
  }
});
test('style signatures distinguish literati, upright, broom, cascade, slant and wind independently of foliage',()=>{
  for(let i=0;i<5;i++){
    const tree=preset=>generateArchitecture({preset,seed:`signature-${i}`});
    const pine=tree('pine'),literati=tree('literati'),broom=tree('broom'),cascade=tree('cascade'),wind=tree('windswept'),slant=tree('slant');
    assert.ok(pine.nodes[0].width>literati.nodes[0].width*3);
    assert.equal(selectableBranches(literati,1).length,3);
    const top=Math.min(...literati.nodes.map(n=>n.ey));
    assert.ok(selectableBranches(literati,1).every(n=>n.y<literati.root.y-(literati.root.y-top)*.6));
    assert.equal(selectableBranches(broom,1).length,3);
    assert.ok(selectableBranches(broom,2).every(n=>n.ey<n.y));
    assert.ok(cascade.nodes.filter(n=>n.role==='trunk').at(-1).ey>cascade.root.y+120);
    assert.ok(wind.nodes.filter(n=>n.order>0).every(n=>n.ex>n.x));
    assert.ok(selectableBranches(slant,1).some(n=>n.ex<n.x));
    assert.ok(slant.nodes.filter(n=>n.role==='trunk').at(-1).ex>slant.root.x+130);
  }
});
test('both pruning levels remove attached foliage, preserve survivors and frame, and support regrowth rendering',()=>{
  for(const preset of Object.keys(ARCHITECTURE))for(const level of [1,2])for(const mode of ['remove','shorten']){
    const tree=generateArchitecture({preset,seed:'pruning'}),before=structuredClone(tree),id=selectableBranches(tree,level)[0].id;
    const plan=cutPlan(tree,id,mode),next=pruneRamification(tree,id,mode);connected(next);
    assert.deepEqual(tree,before);assert.deepEqual(next.viewBox,tree.viewBox);
    assert.equal(tree.clusters.length-next.clusters.length,plan.leaves);
    for(const n of next.nodes.filter(n=>n.id!==id&&n.parent!==id))assert.deepEqual(n,tree.nodes.find(q=>q.id===n.id));
    const grown=flushRamification(next);connected(grown);
    const svg=render(grown,{hour:100});assert.ok(!/NaN|Infinity|undefined/.test(svg));
    grown.nodes.forEach((n,i)=>assert.ok(svg.includes(`data-wind-wood="${i}"`),`unrendered wood: ${preset} ${n.id}`));
  }
});
