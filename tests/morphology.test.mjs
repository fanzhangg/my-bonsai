import test from 'node:test';
import assert from 'node:assert/strict';
import {generate,canopyPoint,crownEnvironment} from '../prototype/morphology.mjs';
import {generate as reference,PRESETS} from '../prototype/core/v1/canopy.mjs';
import {pointOn} from '../prototype/core/v1/model.mjs';
import {grow} from '../prototype/growth.mjs';

test('character morphology preserves branch identity and attachment, with continuous taper',()=>{
  for(const preset of PRESETS)for(const seed of ['one','two','three']){
    const config={preset:preset.id,seed},tree=generate(config),old=reference(config),byId=new Map(tree.nodes.map(n=>[n.id,n]));
    assert.deepEqual(tree,generate(config));
    assert.deepEqual(tree.nodes.map(n=>[n.id,n.parent]),old.nodes.map(n=>[n.id,n.parent]));
    assert(tree.nodes[0].width>old.nodes[0].width*1.2);
    for(const n of tree.nodes){
      assert(n.width>0&&n.tipWidth>0&&n.tipWidth<n.width);
      if(!n.parent)continue;
      const parent=byId.get(n.parent),p=pointOn(parent,n.role==='trunk'?1:n.attachment);
      assert(Math.hypot(p.x-n.x,p.y-n.y)<1e-7,`${preset.id}: ${n.id} attachment`);
      if(n.role==='trunk')assert(Math.abs(n.width-parent.tipWidth)<1e-7);
      else assert(n.width<parent.width);
    }
    for(const c of tree.clusters){const n=byId.get(c.node);assert(Math.hypot(c.x-n.ex,c.y-n.ey)<1e-7);}
  }
});

test('style signatures keep broom junction substantial, literati slender and wind pads elongated',()=>{
  const tree=id=>generate({preset:id,seed:'character'});
  assert(tree('pine').nodes[0].width>tree('literati').nodes[0].width*2.5);
  assert(tree('broom').nodes.filter(n=>n.role==='trunk').at(-1).tipWidth>=10);
  const aspect=t=>t.clusters.reduce((s,c)=>s+c.rx/c.ry,0)/t.clusters.length;
  assert(aspect(tree('windswept'))>aspect(tree('broom'))*2);
  const a=tree('juniper'),b=generate({preset:'juniper',seed:'another'});
  assert.notEqual(a.nodes[0].width,b.nodes[0].width);
  assert.notDeepEqual(a.clusters.map(c=>c.contour),b.clusters.map(c=>c.contour));
});

test('actual crown envelopes fit the fixed application camera across styles and seeds',()=>{
  for(const preset of PRESETS)for(let i=0;i<10;i++){
    const tree=grow({config:{preset:preset.id,seed:`sample${i}`}},1),b=tree.viewBox;
    for(const c of tree.clusters)for(let j=0;j<48;j++){
      const p=canopyPoint(c,j*Math.PI/24,1.04),margin=16;
      assert(p.x-margin>=b.x&&p.x+margin<=b.x+b.width,`${preset.id}: horizontal bounds`);
      assert(p.y-margin>=b.y&&p.y+margin<=b.y+b.height,`${preset.id}: vertical bounds`);
    }
  }
});

test('older proximal crowns are larger; cascade age follows the trunk, not screen height',()=>{
  for(const preset of ['juniper','pine','slant','cascade','windswept'])for(const seed of ['one','two','three']){
    const tree=generate({preset,seed}),pads=[...tree.pads].sort((a,b)=>b.age-a.age);
    const oldest=pads[0],youngest=pads.at(-1);
    const area=pad=>tree.clusters.filter(c=>c.pad===pad.id).reduce((sum,c)=>sum+c.rx*c.ry,0);
    assert(area(oldest)>area(youngest)*1.5,`${preset}: older crown capacity`);
    if(preset==='cascade')assert(oldest.y<youngest.y);
  }
});

test('directional light and occlusion affect foliage while preserving trunk geometry',()=>{
  const lower={id:0,x:0,y:100,rx:30,ry:15,side:1,age:1};
  const upper={id:1,x:0,y:0,rx:50,ry:15,side:1,age:0};
  const open=crownEnvironment([lower],0).get(0),shaded=crownEnvironment([lower,upper],0).get(0);
  assert(shaded.shade>open.shade);assert(shaded.exposure<open.exposure);
  const clear=crownEnvironment([lower,{...upper,x:250}],0).get(0);
  assert.equal(clear.exposure,open.exposure);
  const config={preset:'juniper',seed:'light-study'},left=generate(config,{lightDirection:-.8}),right=generate(config,{lightDirection:.8});
  assert.deepEqual(left.nodes.filter(n=>n.role==='trunk'),right.nodes.filter(n=>n.role==='trunk'));
  assert.notDeepEqual(left.clusters,right.clusters);
  const side=left.pads.find(p=>p.x<left.root.x);
  assert(side.exposure>right.pads.find(p=>p.id===side.id).exposure);
});
