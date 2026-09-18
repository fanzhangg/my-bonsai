import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {snapshot,HOUR,draw} from '../prototype/growth.mjs';
import {normalizeDesign,FORMS} from '../prototype/core/v3/config.mjs';
import {CURRENT_VERSION} from '../prototype/tree-versions.mjs';
import {canPrune,branchFamily} from '../prototype/pruning-model.mjs';
import {applyCheat,cheatRequest} from '../prototype/cheats.mjs';
const CUT_MODEL='state-4'; // Frozen pre-gradual history.
import {recoveryPlan} from '../prototype/core/v3/regrowth.mjs';

const at=200*HOUR;
const recordFor=(preset='juniper')=>({version:CURRENT_VERSION,createdAt:0,config:normalizeDesign({preset,seed:'immediate-recovery'}),cuts:[]});
function cut(r,node,time=at,model=CUT_MODEL){const event={id:randomUUID(),seq:r.cuts.length+1,branchId:node.id,at:time,model};r.cuts.push(event);return event;}
function prepareRecovery(r){
 const first=snapshot(r,at),parent=first.nodes.find(n=>n.pruningLevel===1&&first.nodes.filter(c=>c.parent===n.id&&canPrune(c)).length>=2);
 const children=first.nodes.filter(n=>n.parent===parent.id&&canPrune(n));
 for(const n of children.slice(0,-1))cut(r,n);
 const before=snapshot(r,at);return {before,branch:before.nodes.find(n=>n.id===children.at(-1).id)};
}

test('each form reveals a real prunable secondary shoot immediately while all surviving wood stays fixed',()=>{
 for(const {id}of FORMS){
  const r=recordFor(id),{before,branch}=prepareRecovery(r);
  const family=branchFamily(before.nodes,branch.id),event=cut(r,branch),saved=structuredClone(r),after=snapshot(r,at);
  const replacement=after.nodes.find(n=>n.recoveryCut===event.id);
  assert(replacement&&canPrune(replacement),id);assert.equal(replacement.parent,branch.parent);
  assert(after.clusters.some(c=>c.node===replacement.id&&c.leafAmount>0));
  const survivors=before.nodes.filter(n=>!family.has(n.id));
  for(const n of survivors)assert.deepEqual(after.nodes.find(x=>x.id===n.id),n);
  assert(!/NaN|Infinity/.test(draw(after)));
  assert.deepEqual(r,saved);
  const next=cut(r,replacement);assert(!snapshot(r,at).nodes.some(n=>n.id===replacement.id));
  assert(snapshot(r,at).nodes.some(n=>n.recoveryCut===next.id&&canPrune(n)));
 }
});

test('replacement placement responds to the recent cut, with a fallback on short parents and unchanged state-1 replay',()=>{
 function plan(t,length=250,model=CUT_MODEL){
  const line=(id,parent,role,x,y,ex,ey)=>({id,parent,role,x,y,ex,ey,cx1:x+(ex-x)/3,cy1:y+(ey-y)/3,cx2:x+(ex-x)*2/3,cy2:y+(ey-y)*2/3,width:8,tipWidth:3,pad:0});
  const x=100+length*t;
  const scaffold={nodes:[line('trunk',null,'trunk',100,450,100,100),line('parent','trunk','primary',100,250,100+length,250),
   line('cut','parent','twig',x,250,x+45,250)],
   clusters:[{pad:0,z:0}],root:{x:100,y:450},applicationFrame:{x:0,y:0,width:600,height:500}};
  return recoveryPlan(scaffold,{config:{seed:'relocation',preset:'juniper'},cuts:[{id:'event',branchId:'cut',at:0,model}]},model===CUT_MODEL?0:HOUR);
 }
 const nearBase=plan(.5).live.get('sprout:0'),nearTip=plan(.9).live.get('sprout:0');
 assert(nearBase.x>285,'a cut near the base prefers available space farther out');
 assert(nearTip.x<265,'a cut near the tip prefers available space closer in');
 assert.equal(nearBase.parent,'parent');assert.equal(nearTip.parent,'parent');
 const short=plan(.5,12).live.get('sprout:0');
 assert(short,'limited space must not prevent recovery');assert.equal(short.parent,'parent');
 assert(short.x>=100&&short.x<=112,'the shoot must stay attached to its living parent');
 assert.deepEqual(plan(.5,250,'state-1').live.get('sprout:0'),plan(.9,250,'state-1').live.get('sprout:0'));
});

test('primary recovery is immediate only when its region needs branches, with bounded repeat cuts',()=>{
 const r=recordFor();let visible=0,quiet=0;
 for(let i=0;i<40;i++){
  const before=snapshot(r,at),node=before.nodes.find(n=>n.pruningLevel===1&&canPrune(n));
  const event=cut(r,node),after=snapshot(r,at),newNodes=after.nodes.filter(n=>n.recoveryCut===event.id);
  if(newNodes.length)visible++;else quiet++;
  assert(newNodes.length<=1);assert(after.nodes.length<180);
  assert(!after.nodes.some(n=>n.id===node.id));
 }
 assert(visible>0);assert(quiet>0);
 assert.equal(r.createdAt,0);assert(r.cuts.every(c=>c.at===at));
});

test('persisted feedback endpoint survives rebase, reload, watering and later natural growth',()=>{
 const r=recordFor(),{before,branch:target}=prepareRecovery(r),event=cut(r,target);
 const immediate=snapshot(r,at),branch=immediate.nodes.find(n=>n.recoveryCut===event.id);
 const saved=applyCheat(r,cheatRequest(r,200),800*HOUR);
 assert.deepEqual(snapshot(saved,800*HOUR),immediate);
 assert.deepEqual(snapshot(JSON.parse(JSON.stringify(r)),at),immediate);
 assert.deepEqual(snapshot(r,at-1),snapshot({...r,cuts:[]},at-1));
 r.waterings=[{id:randomUUID(),at:at+HOUR,used:100,amount:.01,recoveryHours:2}];
 assert.deepEqual(snapshot(r,at),immediate);
 const later=snapshot(r,at+8*HOUR);
 assert.deepEqual(later.nodes.find(n=>n.id===branch.id),branch);
 assert(later.clusters.find(c=>c.node===branch.id).leafAmount>immediate.clusters.find(c=>c.node===branch.id).leafAmount);
 const old=recordFor();cut(old,before.nodes.find(n=>n.pruningLevel===2&&canPrune(n)),at,'state-1');
 assert(!snapshot(old,at).nodes.some(n=>n.recoveryCut));
 assert(snapshot(old,at).recovery.length>0);
});
