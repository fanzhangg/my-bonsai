import test from 'node:test';
import assert from 'node:assert/strict';
import {crownPaint,crownOccluders} from '../prototype/crown-color.mjs';
import {generateCrownBaseline} from '../prototype/crown-baseline.mjs';
import {render} from '../prototype/growing-render.mjs';
import {grow,HOUR} from '../prototype/growth.mjs';
const brightness=c=>c.slice(1).match(/../g).reduce((sum,v)=>sum+parseInt(v,16),0);
test('rounded crown has broad light, turning plane, core shadow and restrained bounce',()=>{
  const p=crownPaint({crownAge:.5,crownLayer:1,crownPosition:0});
  const values=p.stops.map(s=>brightness(s.color));
  assert(values[0]>values[1]&&values[1]>values[2]&&values[2]>values[3]&&values[3]>values[4]);
  assert(values[5]>values[4]&&values[5]<values[3]);
  assert(values[0]-values[1]<values[2]-values[3],'broad light plane turns more decisively into shadow');
  const flat=crownPaint({crownAge:.5},{volume:false});
  assert.equal(new Set(flat.stops.map(s=>s.color)).size,1);
});
test('contact shade follows only nearby foreground foliage and disappears with its caster',()=>{
  const back={node:'back',x:0,y:0,rx:20,ry:10,crownLayer:0};
  const front={...back,node:'front',x:10,crownLayer:2};
  const far={...front,node:'far',x:100};
  const peer={...back,node:'peer'};
  assert.deepEqual(crownOccluders(back,[back,front,far,peer]),[front]);
  assert.deepEqual(crownOccluders(front,[back,front]),[]);
  assert.deepEqual(crownOccluders(back,[back,far,peer]),[]);
  const tree=generateCrownBaseline({preset:'juniper',seed:'DESIGN-SYSTEM-01'});
  tree.crownColor={shadow:true};
  assert(render(tree).includes('-contact-clip'));
  tree.crownColor.shadow=false;
  assert(!render(tree).includes('-contact-clip'));
});
test('crown material, depth and light are independent with a coherent local light field',()=>{
  const c={crownAge:.6,crownLayer:1,crownPosition:0};
  const left=crownPaint(c),right=crownPaint(c,{light:'right'});
  assert.equal(left.shadeAt(-.6,-.4),right.shadeAt(.6,-.4));
  assert(brightness(left.shadeAt(-.6,-.4))>brightness(left.shadeAt(.6,.5)));
  assert(brightness(crownPaint({...c,crownAge:0}).shadeAt(0,0))>brightness(crownPaint({...c,crownAge:1}).shadeAt(0,0)));
  assert.equal(crownPaint({...c,crownAge:0},{age:false}).shadeAt(0,0),crownPaint({...c,crownAge:1},{age:false}).shadeAt(0,0));
  assert.equal(crownPaint({...c,crownLayer:0},{depth:false}).shadeAt(0,0),crownPaint({...c,crownLayer:2},{depth:false}).shadeAt(0,0));
  const diffuse=crownPaint(c,{light:'diffuse'});
  assert.equal(diffuse.shadeAt(-1,-1),diffuse.shadeAt(1,1));
  for(const light of ['left','right','diffuse'])for(let age=0;age<=1;age+=.25)for(const layer of [0,1,2]){
    const p=crownPaint({...c,crownAge:age,crownLayer:layer},{light});
    for(const x of [-1,0,1])for(const y of [-1,0,1])assert.match(p.shadeAt(x,y),/^#[0-9a-f]{6}$/);
  }
});
test('review coloring leaves wood and silhouette untouched',()=>{
  const t=generateCrownBaseline({preset:'juniper',seed:'DESIGN-SYSTEM-01'});
  const before=render(t,{view:'silhouette'}),wood=render(t,{view:'skeleton'});
  t.crownColor={light:'right'};
  assert.equal(render(t,{view:'silhouette'}),before);
  assert.equal(render(t,{view:'skeleton'}),wood);
  assert(!render(t).includes('NaN'));
});
test('new crown age follows regrowth time instead of the old supporting crown',()=>{
  const at=200*HOUR,record={createdAt:0,config:{preset:'juniper',seed:'color-regrowth'},cuts:[]};
  const build=time=>grow(record,1,{at:time,generator:generateCrownBaseline});
  record.cuts=build(at).nodes.filter(n=>n.role==='primary').map((n,i)=>({branchId:n.id,at,seq:i+1}));
  const young=build(at+60*HOUR),older=build(at+84*HOUR);
  assert(young.clusters.length>0);
  assert(young.clusters.some(c=>c.crownAge<.5));
  for(const c of young.clusters){
    const next=older.clusters.find(n=>n.key===c.key);
    assert(next.crownAge>=c.crownAge);
    assert(next.crownAge<=1);
  }
});
