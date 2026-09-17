import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewColorTokens} from '../prototype/design-system-color-tokens.mjs';
import {colorTokens,contrast,mix} from '../prototype/color-system.mjs';
import {sceneFor} from '../prototype/weather-model.mjs';
import {TONES} from '../prototype/design-system-pots.mjs';
import {LOOKS} from '../prototype/core/v1/appearance.mjs';

test('review pot palettes preserve application tokens and remain distinct from the ground',()=>{
  for(const kind of ['clear','cloudy','rain','snow','fog','wind','storm'])for(const hour of [0,6.5,12,18.5])for(const tone of TONES){
    const scene=sceneFor(null,0,{hour,kind}),look=LOOKS[0],preset={kind:'scale'};
    const base=colorTokens(scene,look,preset),tokens=reviewColorTokens(scene,look,preset,tone.id);
    for(const [key,value] of Object.entries(base))assert.equal(tokens[key],value,`Changed app token ${key}`);
    assert(Object.values(tokens).every(c=>/^#[0-9a-f]{6}$/.test(c)));
    const ground=mix(scene.colors[1],scene.colors[2],.45);
    assert(contrast(tokens['review-pot-body'],ground)>=2,`${kind} ${hour} ${tone.id}`);
    assert(contrast(tokens['review-pot-rim'],ground)>=2);
    assert(contrast(tokens['review-pot-pattern'],tokens['review-pot-body'])>=1.65);
  }
});
