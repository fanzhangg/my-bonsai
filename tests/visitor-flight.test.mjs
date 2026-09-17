import test from 'node:test';
import assert from 'node:assert/strict';
import {edgePoint,flightPoint,visitTiming,flightAppearance} from '../prototype/visitor-flight.mjs';

test('visitors enter and leave beyond the scene boundary with continuous curved travel',()=>{
  for(const sample of [0,.2,.5,.8,.999]){
    const edge=edgePoint(()=>sample),inside={x:43,y:39};
    assert.ok(edge.x<0||edge.x>100||edge.y<0);
    for(const [from,to] of [[edge,inside],[inside,edge]]){
      assert.deepEqual(flightPoint(from,to,0),from);
      assert.deepEqual(flightPoint(from,to,1),to);
      let previous=from;
      for(let i=1;i<=240;i++){
        const p=flightPoint(from,to,i/240);
        assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
        assert.ok(Math.hypot(p.x-previous.x,p.y-previous.y)<1,'no interior jump');
        previous=p;
      }
    }
  }
});

test('random visits have bounded, distinct waiting, entrance, residence and departure times',()=>{
  const min=visitTiming(()=>0),max=visitTiming(()=>1);
  assert.deepEqual(min,{wait:4000,enter:3200,stay:14000,leave:2600});
  assert.deepEqual(max,{wait:16000,enter:5500,stay:35000,leave:4200});
});

test('approach and departure reverse the same smooth size and opacity envelope',()=>{
  assert.deepEqual(flightAppearance(0,true),{scale:.28,opacity:0});
  assert.deepEqual(flightAppearance(1,true),{scale:1,opacity:1});
  let previous=flightAppearance(0,true);
  for(let i=1;i<=100;i++){
    const arriving=flightAppearance(i/100,true),leaving=flightAppearance(1-i/100,false);
    assert.ok(Math.abs(arriving.scale-leaving.scale)<1e-12);
    assert.ok(Math.abs(arriving.opacity-leaving.opacity)<1e-12);
    assert.ok(arriving.scale>=previous.scale&&arriving.opacity>=previous.opacity);
    previous=arriving;
  }
});
