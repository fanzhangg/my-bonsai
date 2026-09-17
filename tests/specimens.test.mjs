import test from 'node:test';
import assert from 'node:assert/strict';
import {VERSION,PRESETS,STRATEGIES,normalize,generate,render,validateSelection} from '../prototype/specimens.mjs';

test('six styles × three strategies × six seeds stay finite, bounded and reproducible',()=>{
  for(const p of PRESETS)for(const s of STRATEGIES)for(let i=0;i<6;i++){
    const config={preset:p.id,strategy:s.id,seed:`review-${i}`},tree=generate(config);
    assert.ok(tree.nodes.length>15&&tree.nodes.length<=1400);
    const ids=new Set();
    for(const n of tree.nodes){
      assert.ok(!ids.has(n.id));if(n.parent)assert.ok(ids.has(n.parent),'parent is generated before child');ids.add(n.id);
      for(const k of ['x','y','cx1','cy1','cx2','cy2','ex','ey','width','tipWidth'])assert.ok(Number.isFinite(n[k]),k);
      assert.ok(n.width>=n.tipWidth&&n.tipWidth>0);
      if(n.role==='twig')assert.ok(n.y>=n.cy1&&n.cy1>=n.cy2&&n.cy2>=n.ey,'new shoots never hook downward');
    }
    for(const site of tree.leafSites)assert.ok(ids.has(site.node),'leaves have real branch support');
    if(i===0)assert.deepEqual(generate(config),tree);
  }
});
test('strategies share initial trained wood but have different ramification',()=>{
  for(const p of PRESETS){
    const trees=STRATEGIES.map(s=>generate({preset:p.id,strategy:s.id}));
    const scaffold=t=>t.nodes.filter(n=>n.role!=='twig').map(({key,x,y,cx1,cy1,cx2,cy2,ex,ey,width,tipWidth})=>({key,x,y,cx1,cy1,cx2,cy2,ex,ey,width,tipWidth}));
    assert.deepEqual(scaffold(trees[0]),scaffold(trees[1]));assert.deepEqual(scaffold(trees[1]),scaffold(trees[2]));
    assert.notDeepEqual(trees[0].nodes.filter(n=>n.role==='twig'),trees[1].nodes.filter(n=>n.role==='twig'));
    assert.notDeepEqual(trees[1].nodes.filter(n=>n.role==='twig'),trees[2].nodes.filter(n=>n.role==='twig'));
  }
});
test('parameter choices and exported candidates reproduce exactly',()=>{
  const original=normalize({preset:'broom',strategy:'hybrid',seed:'chosen',movement:1.3,taper:1.4,fullness:.7,branching:4,leafSize:1.2});
  const saved=validateSelection(JSON.parse(JSON.stringify({version:VERSION,candidates:[original]})));
  assert.deepEqual(saved.candidates[0],original);assert.deepEqual(generate(saved.candidates[0]),generate(original));
  for(const change of [{movement:.7},{taper:.8},{fullness:.3},{branching:2},{leafSize:.6}])assert.notEqual(render(generate({...original,...change})),render(generate(original)));
  assert.throws(()=>validateSelection({version:'unknown',candidates:[]}));
  assert.throws(()=>validateSelection({version:VERSION,candidates:[{preset:'missing'}]}));
});
test('rendering respects skeleton and developmental time without changing model',()=>{
  const tree=generate({preset:'juniper'}),saved=JSON.stringify(tree);
  const initial=render(tree,{hour:0}),mature=render(tree,{hour:96}),bare=render(tree,{hour:96,skeleton:true});
  assert.notEqual(initial,mature);assert.ok(mature.length>initial.length);assert.ok(bare.length<mature.length);
  assert.ok(!/NaN|Infinity|undefined/.test(mature));assert.equal(JSON.stringify(tree),saved);
});
