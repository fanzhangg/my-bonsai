import test from 'node:test';
import assert from 'node:assert/strict';
import {colorTokens,contrast,mix} from '../prototype/color-system.mjs';
import {sceneFor} from '../prototype/weather-model.mjs';
import {LOOKS} from '../prototype/core/v1/appearance.mjs';
test('all looks remain readable across weather and the full daily cycle',()=>{
 for(const kind of ['clear','rain','storm','fog','snow','cloudy','wind'])for(let hour=0;hour<24;hour+=.25)for(const look of LOOKS){
  const scene=sceneFor(null,0,{hour,kind}),before=JSON.stringify(scene),t=colorTokens(scene,look,{kind:'needle',pot:'deep'});
  assert.equal(JSON.stringify(scene),before);
  assert(Object.values(t).every(c=>/^#[0-9a-f]{6}$/.test(c)));
  assert(contrast(t.ink,scene.colors[0])>=4.5);
  assert(contrast(t['action'],t['action-ink'])>=4.5);
  assert(contrast(t['bonsai-bark'],scene.colors[1])>=3);
  for(let i=0;i<4;i++)assert(contrast(t['bonsai-leaf-'+i],scene.colors[1])>=1.65);
  assert(contrast(t['bonsai-pot-top'],mix(scene.colors[1],scene.colors[2],.45))>=2);
 }
});
