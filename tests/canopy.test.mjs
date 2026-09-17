import test from 'node:test';
import assert from 'node:assert/strict';
import {PRESETS,normalize,generate,generateReference,render} from '../prototype/canopy.mjs';
import {LOOKS,SHAPES,normalizeAppearance,colorsFor} from '../prototype/appearance.mjs';

test('crown hierarchies have bounded tips, connected wood and leaf support across seeds and limits',()=>{
  for(const preset of PRESETS)for(let seed=0;seed<6;seed++)for(const tipScale of [.65,1,1.35]){
    const tree=generate({preset:preset.id,seed:`canopy-${seed}`,tipScale,padScale:seed%2?.7:1.25});
    const byId=new Map();
    for(const n of tree.nodes){
      assert.ok(!byId.has(n.id));
      if(n.parent)assert.ok(byId.has(n.parent));
      for(const k of ['x','y','cx1','cy1','cx2','cy2','ex','ey','width','tipWidth'])assert.ok(Number.isFinite(n[k]));
      assert.ok(n.width>=n.tipWidth&&n.tipWidth>0);
      const parent=byId.get(n.parent);
      if(n.role==='twig'&&parent.role==='twig'){
        assert.equal(n.x,parent.ex);assert.equal(n.y,parent.ey);
        assert.ok(n.born>=parent.born+parent.duration,'child starts after parent reaches attachment');
      }
      byId.set(n.id,n);
    }
    assert.ok(tree.nodes.length<350);
    for(const pad of tree.pads)assert.equal(tree.clusters.filter(c=>c.pad===pad.id).length,Math.round(preset.tips*tipScale));
    for(const c of tree.clusters){const n=byId.get(c.node);assert.ok(n);assert.equal(c.x,n.ex);assert.equal(c.y,n.ey);assert.ok(c.born>=n.born+n.duration);}
    assert.deepEqual(tree.nodes.filter(n=>n.role==='trunk'),generateReference({preset:preset.id,seed:`canopy-${seed}`}).nodes.filter(n=>n.role==='trunk'));
  }
});
test('leaf scale and coverage never move branches, cluster anchors or camera',()=>{
  for(const p of PRESETS){const original=generate({preset:p.id});
    for(const change of [{leafScale:1.5},{coverage:.45}]){const t=generate({preset:p.id,...change});assert.deepEqual(t.nodes,original.nodes);assert.deepEqual(t.clusters,original.clusters);assert.deepEqual(t.viewBox,original.viewBox);assert.notEqual(render(t),render(original));}
    assert.deepEqual(generate(original.config),original);
    assert.deepEqual(generate(JSON.parse(JSON.stringify(normalize(original.config)))),original);
  }
});
test('views and time are pure and render valid finite geometry',()=>{
  for(const p of PRESETS){const tree=generate({preset:p.id}),snapshot=JSON.stringify(tree);
    const full=render(tree),bare=render(tree,{view:'skeleton'}),silhouette=render(tree,{view:'silhouette'}),early=render(tree,{hour:0});
    assert.ok(full.length>bare.length&&full.length>silhouette.length&&full.length>early.length);
    for(const svg of [full,bare,silhouette,early])assert.ok(!/NaN|Infinity|undefined/.test(svg));
    assert.equal(snapshot,JSON.stringify(tree));
  }
});

test('new styles preserve their silhouette and include hanging foliage within the frame',()=>{
  for(let i=0;i<6;i++){
    const seed=`style-${i}`,pine=generate({preset:'pine',seed}),slant=generate({preset:'slant',seed}),cascade=generate({preset:'cascade',seed}),wind=generate({preset:'windswept',seed});
    const apex=t=>t.nodes.filter(n=>n.role==='trunk').at(-1);
    assert.ok(Math.abs(apex(pine).ex-pine.root.x)<20);
    assert.ok(apex(slant).ex-slant.root.x>120);
    assert.ok(apex(cascade).ey>cascade.root.y+105,'cascade extends below its deep pot');
    assert.ok(wind.pads.every(p=>p.x>wind.root.x));
    for(const t of [pine,slant,cascade,wind])for(const c of t.clusters){
      const b=t.viewBox;
      assert.ok(c.x-c.rx>b.x&&c.x+c.rx<b.x+b.width);
      assert.ok(c.y-c.ry>b.y&&c.y+c.ry<b.y+b.height);
    }
  }
});

test('appearance schemes preserve geometry and survive candidate round trips',()=>{
  for(const preset of PRESETS){
    const original=generate({preset:preset.id,seed:'appearance-review'});
    for(const look of LOOKS){
      const tree=generate({...original.config,appearance:look}),colors=colorsFor(look);
      assert.deepEqual(tree.nodes,original.nodes);assert.deepEqual(tree.clusters,original.clusters);assert.deepEqual(tree.viewBox,original.viewBox);
      assert.deepEqual(generate(JSON.parse(JSON.stringify(tree.config))),tree);
      const svg=render(tree);assert.ok(svg.includes(colors.bark)&&svg.includes(colors.background));
      if(look.foliage!=='native')assert.ok(svg.includes(colors.foliage[2]));
      assert.ok(!/NaN|Infinity|undefined/.test(svg));
    }
  }
  const outputs=SHAPES.filter(s=>s.id!=='auto').map(s=>render(generate({preset:'broom',appearance:{shape:s.id}})));
  assert.equal(new Set(outputs).size,outputs.length,'leaf shapes have distinct geometry');
  assert.deepEqual(normalizeAppearance({shape:'invalid',bark:'url(example)',background:'bad'}),normalizeAppearance());
});
