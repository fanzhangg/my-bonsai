import test from 'node:test';
import assert from 'node:assert/strict';
import {startWind,windPose,windStrength,branchFlex,branchPoses} from '../prototype/wind.mjs';
const nodes=[
 {id:0,parent:-1,role:'trunk',width:20,x:200,y:440},
 {id:1,parent:0,role:'trunk',width:8,x:210,y:250},
 {id:2,parent:1,role:'bough',width:6,x:210,y:220},
 {id:3,parent:2,role:'branch',width:2,x:250,y:200},
 {id:4,parent:3,role:'twig',width:.5,x:285,y:180},
];
const point=(p,x,y)=>({x:p.a*x-p.b*y+p.x,y:p.b*x+p.a*y+p.y});

test('fixed woody scaffold, connected fine branches, and stronger leaf motion in wind',()=>{
 assert.equal(branchFlex(nodes[0],20),0);assert.equal(branchFlex(nodes[1],20),0);assert.equal(branchFlex(nodes[2],20),0);
 assert.ok(branchFlex(nodes[4],20)>branchFlex(nodes[3],20));
 let motion=0;
 for(let t=0;t<30;t+=.1){
  const poses=branchPoses(nodes,20,t,windStrength('storm'));
  for(const id of [0,1,2]){
   const p=poses.get(id);assert.equal(p.angle,0);assert.deepEqual(point(p,120,150),{x:120,y:150});
  }
  for(const n of nodes.slice(1)){
   const p=poses.get(n.id),parent=poses.get(n.parent),a=point(p,n.x,n.y),b=point(parent,n.x,n.y);
   assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-9,'branch joints remain attached');
   assert.ok(Math.abs(p.angle)<.2,'branch movement remains gentle');
  }
  motion=Math.max(motion,Math.abs(poses.get(4).angle));
  const pose=windPose(t,windStrength('storm'));assert.ok(Math.abs(pose.flutter)<5.5);
 }
 assert.ok(motion>.02,'fine twigs visibly sway');
 assert.ok(windStrength('storm')>windStrength('clear'));
});

test('wind preserves phase after rendering, pauses when hidden, and respects reduced motion',t=>{
 const media=new EventTarget();media.matches=false;
 const doc=new EventTarget();doc.hidden=false;doc.body={dataset:{weather:'clear'}};
 let next=0;const frames=new Map();
 const globals={matchMedia:()=>media,requestAnimationFrame:callback=>{frames.set(++next,callback);return next;},cancelAnimationFrame:id=>frames.delete(id),document:doc};
 for(const [key,value] of Object.entries(globals)){
  const original=Object.getOwnPropertyDescriptor(globalThis,key);
  Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
  t.after(()=>{if(original)Object.defineProperty(globalThis,key,original);else delete globalThis[key];});
 }
 function element(dataset){return {dataset,attrs:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];}};}
 const makeWood=()=>nodes.map(n=>element({windWood:n.id,windParent:n.parent,windRole:n.role,windWidth:n.width,windX:n.x,windY:n.y}));
 let wood=makeWood(),leaf=element({windNode:4,windLeaf:'1',windX:'300',windY:'170'});
 const crown=element({windBaseWidth:20});
 const wind=startWind({querySelector:()=>crown,querySelectorAll:s=>s==='[data-wind-leaf]'?[leaf]:wood});
 wind.refresh();
 const [id,callback]=frames.entries().next().value;frames.delete(id);callback(performance.now()+32);
 const pose=leaf.attrs.transform,twig=wood[4].attrs.transform;
 assert.ok(twig);assert.equal(wood[0].attrs.transform,undefined);assert.equal(wood[2].attrs.transform,undefined);
 wood=makeWood();wind.refresh();assert.equal(leaf.attrs.transform,pose);assert.equal(wood[4].attrs.transform,twig);
 assert.equal(frames.size,1);
 wind.setPaused(true);assert.equal(frames.size,0);assert.equal(leaf.attrs.transform,undefined);
 wind.refresh();assert.equal(frames.size,0);assert.equal(wood[4].attrs.transform,undefined);
 wind.setPaused(false);assert.equal(frames.size,1);
 doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(frames.size,0);
 media.matches=true;media.dispatchEvent(new Event('change'));
 assert.equal(leaf.attrs.transform,undefined);assert.equal(wood[4].attrs.transform,undefined);
 doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(frames.size,0);
 media.matches=false;media.dispatchEvent(new Event('change'));assert.equal(frames.size,1);
 wind.destroy();assert.equal(frames.size,0);
});
