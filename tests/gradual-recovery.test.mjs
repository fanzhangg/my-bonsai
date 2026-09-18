import test from 'node:test';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {snapshot,HOUR} from '../prototype/growth.mjs';
import {normalizeDesign,FORMS} from '../prototype/core/v3/config.mjs';
import {NATURAL_GROWTH} from '../prototype/core/v3/natural-growth.mjs';
import {recoveryPlan} from '../prototype/core/v3/regrowth.mjs';
import {generate} from '../prototype/core/v3/runtime.mjs';
import {CURRENT_VERSION} from '../prototype/tree-versions.mjs';
import {CUT_MODEL,canPrune,branchFamily} from '../prototype/pruning-model.mjs';
import {applyCheat,cheatRequest} from '../prototype/cheats.mjs';

const record=(preset='juniper',seed='gradual')=>({version:CURRENT_VERSION,createdAt:0,config:normalizeDesign({preset,seed,growthPolicy:NATURAL_GROWTH}),cuts:[]});
const cut=(r,n,at)=>r.cuts.push({id:randomUUID(),seq:r.cuts.length+1,at,branchId:n.id,model:CUT_MODEL});

test('cuts preserve empty space; new wood and leaves develop on the biological clock in every form',()=>{
 for(const {id}of FORMS){
  const r=record(id),at=400*HOUR,before=snapshot(r,at),parent=before.nodes.find(n=>n.pruningLevel===1);
  const removed=new Set();
  for(const n of before.nodes.filter(n=>n.parent===parent.id&&canPrune(n))){
   for(const id of branchFamily(before.nodes,n.id))removed.add(id);cut(r,n,at);
  }
  const empty=snapshot(r,at);
  assert.deepEqual(empty.nodes,before.nodes.filter(n=>!removed.has(n.id)),'no free age or instant replacement');
  const job=empty.recovery.find(j=>j.key===parent.id);assert(job&&job.hours>=2);
  const birth=at+job.hours*HOUR,young=snapshot(r,birth+HOUR),shoot=young.nodes.find(n=>n.parent===parent.id&&n.regrown&&!before.nodes.some(b=>b.id===n.id));
  assert(shoot&&shoot.growth>0&&shoot.growth<.55);assert.equal(shoot.initialAgeHours,undefined);
  const mature=snapshot(r,birth+8*HOUR),grown=mature.nodes.find(n=>n.id===shoot.id);
  assert(canPrune(grown));assert(grown.growth>shoot.growth);
  assert(Math.hypot(grown.ex-grown.x,grown.ey-grown.y)>Math.hypot(shoot.ex-shoot.x,shoot.ey-shoot.y));
  for(const n of empty.nodes.filter(n=>!n.regrown))assert.deepEqual(mature.nodes.find(x=>x.id===n.id),n);
  assert.deepEqual(snapshot(JSON.parse(JSON.stringify(r)),birth+8*HOUR),mature);
  assert.deepEqual(snapshot(applyCheat(r,cheatRequest(r,(birth+8*HOUR)/HOUR),2000*HOUR),2000*HOUR),mature);
 }
});

test('sparse recovery is faster than filling the ideal silhouette, and mature surplus grows more slowly',()=>{
 const r=record(),layout=generate(r.config),at=200*HOUR;
 const before=snapshot(r,at),parent=before.nodes.find(n=>n.pruningLevel===1&&before.nodes.filter(c=>c.parent===n.id&&canPrune(c)).length===2);
 const children=before.nodes.filter(n=>n.parent===parent.id&&canPrune(n));
 cut(r,children[0],at);const ordinary=snapshot(r,at).recovery.find(j=>j.key===parent.id);
 cut(r,children[1],at);const urgent=snapshot(r,at).recovery.find(j=>j.key===parent.id);
 assert(urgent.chance>ordinary.chance);
 const plan=recoveryPlan(layout,r,at+2000*HOUR);
 assert(plan.ranges.every(g=>g.count<=g.max));assert.equal(plan.jobs.length,0);
 const first=snapshot(record(),200*HOUR),older=snapshot(record(),1000*HOUR);
 // Compare the same scope and density at different ages, after removing all its children.
 const probabilities=[];
 for(const [tree,time]of [[first,200*HOUR],[older,1000*HOUR]]){
  const data=record();const members=tree.nodes.filter(n=>n.parent===parent.id&&canPrune(n));
  for(const n of members.slice(1))cut(data,n,time);
  probabilities.push(snapshot(data,time).recovery.find(j=>j.key===parent.id).chance);
 }
 assert(probabilities[0]>probabilities[1],'older trees add branches more slowly at the same population');
});

test('delayed shoots prefer a different part of the living parent from the recent cut',()=>{
 function plan(t,length=250){
  const line=(id,parent,role,x,y,ex,ey)=>({id,parent,role,x,y,ex,ey,cx1:x+(ex-x)/3,cy1:y+(ey-y)/3,cx2:x+(ex-x)*2/3,cy2:y+(ey-y)*2/3,width:8,tipWidth:3,pad:0});
  const x=100+length*t;
  const scaffold={nodes:[line('trunk',null,'trunk',100,450,100,100),line('parent','trunk','primary',100,250,100+length,250),line('cut','parent','twig',x,250,x+45,250)],clusters:[{pad:0,z:0}],root:{x:100,y:450},applicationFrame:{x:0,y:0,width:600,height:500}};
  return recoveryPlan(scaffold,{config:{seed:'relocation',preset:'juniper'},cuts:[{id:'event',branchId:'cut',at:0,model:CUT_MODEL}]},24*HOUR).live.get('sprout:0');
 }
 assert(plan(.5).x>285);assert(plan(.9).x<265);
 const short=plan(.5,12);assert(short.x>=100&&short.x<=112);
});

test('natural-1 timelines remain unchanged before the first gradual cut',()=>{
 const r=record();r.config.growthPolicy='natural-1';
 const at=500*HOUR,before=snapshot(r,at),branch=before.nodes.find(canPrune);
 cut(r,branch,at+HOUR);
 assert.deepEqual(snapshot(r,at),before);
 assert(snapshot(r,at+HOUR).gradualGrowth);
 assert.deepEqual(normalizeDesign(r.config),r.config);
});
