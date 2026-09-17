import test from 'node:test';
import assert from 'node:assert/strict';
import {generateCrownBaseline} from '../prototype/crown-baseline.mjs';
import {painterlyPaint} from '../prototype/crown-painterly.mjs';
import {render} from '../prototype/growing-render.mjs';
test('support groups share a stable paint frame and both styles preserve geometry',()=>{
  for(let seed=1;seed<=5;seed++){
    const t=generateCrownBaseline({preset:'juniper',seed:`DESIGN-SYSTEM-0${seed}`});
    const groups=new Map();
    for(const c of t.clusters){
      const f=c.paintFrame,frame=[c.x+f.x*c.rx,c.y+f.y*c.ry,f.rx*c.rx,f.ry*c.ry];
      if(groups.has(c.node))frame.forEach((n,i)=>assert(Math.abs(n-groups.get(c.node)[i])<1e-8));
      groups.set(c.node,frame);
      const a=painterlyPaint(c),b=painterlyPaint(c,{style:'soft'});
      assert.equal(a.base,b.base);
      for(const paint of [a,b])assert.match(paint.shadeAt(c.x,c.y),/^#[0-9a-f]{6}$/);
    }
    const silhouette=render(t,{view:'silhouette'});
    t.crownColor={style:'blocks'};
    assert.equal(render(t,{view:'silhouette'}),silhouette);
    assert(!/NaN|undefined/.test(render(t)));
    const first=t.clusters[0],before=painterlyPaint(first).shadeAt(first.x,first.y);
    t.clusters=t.clusters.filter(c=>c.node===first.node);
    assert.equal(painterlyPaint(t.clusters[0]).shadeAt(first.x,first.y),before);
  }
});
