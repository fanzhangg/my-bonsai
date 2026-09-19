import test from 'node:test';
import assert from 'node:assert/strict';
import {outerLeaves} from '../prototype/leaf-edge.mjs';
import {snipAt,snipTarget} from '../prototype/leaf-trim-model.mjs';

const leaf=(index,x,y,size=4)=>({index,x,y,size,angle:0,shape:'round'});
test('a foreground interior leaf is protected by the whole layer, even on an exact hit',()=>{
 const shell={key:'shell',z:0},core={key:'core',z:100};
 const group={clusters:[shell,core],x:0,y:0},inner=leaf(0,0,0);
 const ring=Array.from({length:64},(_,i)=>leaf(i,30*Math.cos(i*Math.PI/32),30*Math.sin(i*Math.PI/32)));
 const catalog=new Map([[shell.key,ring],[core.key,[inner]]]);
 assert(!outerLeaves(group,catalog).has(inner));
 assert.equal(snipTarget(group,catalog,inner,6),null,'directly pointing at the interior does not make it cuttable');
 const assisted=snipAt(group,catalog,inner,Infinity);
 assert.equal(assisted.length,1);assert.equal(assisted[0].clusterKey,'shell');assert.equal(core.leafSnips,undefined);
 // Once the surrounding silhouette is removed, the same leaf becomes exposed.
 shell.leafSnips=Object.fromEntries(ring.map(s=>[s.index,0]));
 assert(outerLeaves(group,catalog).has(inner));
 assert.deepEqual(snipAt(group,catalog,inner,6).map(c=>c.clusterKey),['core']);
 assert.deepEqual(snipAt(group,catalog,inner,Infinity),[]);
});

test('a concave notch remains accessible and repeated cuts expose the next leaf',()=>{
 const c={key:'notch'},group={clusters:[c],x:0,y:0};
 const front=leaf(0,0,-24),behind=leaf(1,0,-18,2.5),left=leaf(2,-16,-40,8),right=leaf(3,16,-40,8);
 const catalog=new Map([[c.key,[front,behind,left,right]]]);
 const edge=outerLeaves(group,catalog);
 assert(edge.has(front),'the notch between two taller shoulders is an outer edge');
 assert(!edge.has(behind),'foliage behind the notch stays protected');
 assert.equal(snipAt(group,catalog,behind,Infinity)[0].index,0);
 assert(outerLeaves(group,catalog).has(behind));
 assert.equal(snipAt(group,catalog,behind,Infinity)[0].index,1);
 assert.equal(c.leafSnips[2],undefined);assert.equal(c.leafSnips[3],undefined);
});

test('tiny regrowing needles and overlapping layers use their current rendered silhouettes',()=>{
 const back={key:'back',z:0},front={key:'front',z:2,leafSnips:{0:.2}},group={clusters:[back,front],x:0,y:20};
 const a={...leaf(0,0,0,8),shape:'needle',tilt:0,renderScale:.6},b={...a};
 const catalog=new Map([[back.key,[a]],[front.key,[b]]]);
 assert(outerLeaves(group,catalog).has(a));
 assert(!outerLeaves(group,catalog).has(b),'small new needles are covered by the mature silhouette');
 back.leafSnips={0:0};assert(outerLeaves(group,catalog).has(b));
});
