import test from 'node:test';
import assert from 'node:assert/strict';
import {configForClaim} from '../prototype/claim.mjs';
import {POT_PRESETS,SHAPES,normalizePot,potMarkup} from '../prototype/pots.mjs';
import {PRESETS} from '../prototype/core/v1/canopy.mjs';
import {grow,draw,snapshot,HOUR} from '../prototype/growth.mjs';
import {replayFrame} from '../prototype/playback.mjs';
import {colorTokens,contrast,mix} from '../prototype/color-system.mjs';
import {sceneFor} from '../prototype/weather-model.mjs';

test('claim IDs distribute all eight approved pots deterministically',()=>{
  const seen=new Set();
  for(let i=0;i<128;i++){
    const id=`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`;
    const config=configForClaim(id),pot=normalizePot(config.pot);
    assert(pot);assert.deepEqual(configForClaim(id),config);
    const match=POT_PRESETS.find(p=>p.shape===pot.shape&&p.tone===pot.tone&&p.pattern===pot.pattern);
    assert(match);seen.add(match.id);
  }
  assert.equal(seen.size,8);
});

test('pot changes leave growth geometry intact and persist through replay',()=>{
  const record={config:{seed:'same-tree',preset:'juniper'},createdAt:100000,cuts:[]};
  for(const preset of POT_PRESETS){
    const config={...record.config,pot:normalizePot(preset)},selected={...record,config};
    for(const p of [0,.3,1]){
      const old=grow(record,p),tree=grow(selected,p);
      assert.deepEqual(tree.nodes,old.nodes);assert.deepEqual(tree.clusters,old.clusters);
      assert.deepEqual(tree.root,old.root);assert.deepEqual(tree.viewBox,old.viewBox);
      assert.deepEqual(tree.config.pot,config.pot);
      const svg=draw(tree,{transparent:true});
      assert(svg.includes(`data-pot-shape="${preset.shape}"`));
      assert(svg.includes(`data-pot-tone="${preset.tone}"`));
      assert(svg.includes(`data-pot-pattern="${preset.pattern}"`));
      assert(!/NaN|undefined/.test(svg));
      assert(!draw(tree).includes('var('));
    }
    const end=record.createdAt+24*HOUR;
    for(const t of [0,.5,1])assert.deepEqual(replayFrame(selected,end,t).config.pot,config.pot);
    assert.deepEqual(snapshot(JSON.parse(JSON.stringify(selected)),end),snapshot(selected,end));
  }
});

test('missing and invalid pot data retain the legacy rendering',()=>{
  const record={config:{seed:'legacy-pot',preset:'cascade'}};
  const expected=draw(grow(record,1),{transparent:true});
  assert(!expected.includes('data-pot-shape'));
  for(const pot of [null,{},[],{shape:'bad',tone:'sand',pattern:'plain'},{shape:'oval',tone:'<script>',pattern:'plain'}]){
    assert.equal(normalizePot(pot),undefined);
    assert.equal(draw(grow({config:{...record.config,pot}},1),{transparent:true}),expected);
  }
});

test('soil stays inside every planter rim',()=>{
  for(const shape of SHAPES){
    const svg=potMarkup({shape:shape.id},0,0,'test',{dynamic:false});
    const soil=svg.match(/<g fill="#505141">(.*?)<\/g>/)[1];
    if(soil.includes('<ellipse')){
      assert(Number(soil.match(/rx="([^"]+)"/)[1])<shape.width/2-5,shape.id);
    }else{
      const xs=[...soil.matchAll(/[MLH](-?[\d.]+)/g)].map(m=>Number(m[1]));
      assert(xs.every(x=>Math.abs(x)<shape.width/2-5),shape.id);
    }
  }
});

test('exposed root tips fit the chosen pot through growth without clipping hanging branches',()=>{
  for(const preset of PRESETS)for(const pot of POT_PRESETS)for(const p of [.3,1]){
    const tree=grow({config:{preset:preset.id,seed:'DESIGN-SYSTEM-01',pot}},p);
    const svg=draw(tree),half=SHAPES.find(s=>s.id===pot.shape).width/2;
    const roots=svg.match(/<g data-exposed-roots[^>]*>(.*?)<\/g>/)[1];
    for(const [,path] of roots.matchAll(/d="([^"]+)"/g)){
      const points=[...path.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(m=>({x:Number(m[1]),y:Number(m[2])}));
      for(const tip of [points[24],points[25]]){
        assert(Math.abs(tip.x-tree.root.x)<half-8,`${preset.id}/${pot.shape}: root outside rim`);
        assert(Math.abs(tip.y-(tree.root.y-1))<3,`${preset.id}/${pot.shape}: root outside soil depth`);
      }
    }
    const wood=[...svg.matchAll(/<g data-wind-wood="\d+"[^>]*>/g)].map(m=>m[0]);
    assert.equal(wood.filter(g=>g.includes('clip-path')).length,1);
    assert(wood.find(g=>g.includes('data-wind-parent="-1"')).includes('clip-path'));
    assert(!/<g data-wind-tree[^>]*clip-path/.test(svg));
  }
});

test('live planter materials adapt to the sky without changing other scene tokens',()=>{
  for(const hour of [0,6.5,12,18.5])for(const kind of ['clear','rain','snow'])for(const preset of POT_PRESETS){
    const scene=sceneFor(null,0,{hour,kind}),base=colorTokens(scene),actual=colorTokens(scene,{}, {},normalizePot(preset));
    for(const key of Object.keys(base))assert.equal(actual[key],base[key]);
    const ground=mix(scene.colors[1],scene.colors[2],.45);
    assert(contrast(actual['bonsai-vessel-body'],ground)>=2);
    assert(contrast(actual['bonsai-vessel-rim'],ground)>=2);
    assert(contrast(actual['bonsai-vessel-pattern'],actual['bonsai-vessel-body'])>=1.65);
  }
});
