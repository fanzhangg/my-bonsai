import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {snapshot,HOUR} from '../prototype/growth.mjs';
import {normalizeDesign,FORMS} from '../prototype/core/v3/config.mjs';
import {CURRENT_VERSION} from '../prototype/tree-versions.mjs';
import {CUT_MODEL,canPrune} from '../prototype/pruning-model.mjs';
import {applyCheat,cheatRequest} from '../prototype/cheats.mjs';
import {growthStatus} from '../prototype/growth-status.mjs';

const at=200*HOUR;
const record=(preset='juniper',seed='range-test')=>({version:CURRENT_VERSION,createdAt:0,config:normalizeDesign({preset,seed}),cuts:[]});
const cut=(r,n,time=at,model=CUT_MODEL)=>{const event={id:randomUUID(),seq:r.cuts.length+1,branchId:n.id,at:time,model};r.cuts.push(event);return event;};
function pair(r){const tree=snapshot(r,at),parent=tree.nodes.find(n=>n.pruningLevel===1&&tree.nodes.filter(c=>c.parent===n.id&&canPrune(c)).length===2);return tree.nodes.filter(n=>n.parent===parent.id&&canPrune(n));}

test('every form leaves a cut at the lower bound empty and schedules recovery only after time passes',()=>{
 for(const {id}of FORMS){
  const r=record(id),[a,b]=pair(r),first=cut(r,a),quiet=snapshot(r,at);
  assert(!quiet.nodes.some(n=>n.recoveryCut===first.id),`${id}: two to one stays quiet`);
  const range=quiet.branchRanges.find(g=>g.key===a.parent);assert.deepEqual([range.count,range.min,range.ideal??range.max],[1,1,2]);assert(range.max>=2&&range.max<=3);
  cut(r,b);const empty=snapshot(r,at);
  assert.equal(empty.branchRanges.find(g=>g.key===a.parent).count,0);
  assert(!empty.nodes.some(n=>n.regrown),'cut never creates visible wood immediately');
  const job=empty.recovery.find(g=>g.key===a.parent),restored=snapshot(r,at+(job.hours+4)*HOUR);
  assert(restored.nodes.some(n=>n.parent===a.parent&&n.regrown&&canPrune(n)));
  assert(restored.branchRanges.find(g=>g.key===a.parent).count>=1);
  assert.match(growthStatus(restored),/下限/);assert.match(growthStatus(restored),/减速/);
 }
});

test('growth opportunities vary by seed, advance only with biological time and stop at capacity',()=>{
 const waits=new Set();
 for(let i=0;i<12;i++){
  const r=record('juniper',`chance-${i}`),[a]=pair(r);cut(r,a);
  const quiet=snapshot(r,at),job=quiet.recovery.find(g=>g.key===a.parent);waits.add(job.hours);
  assert(job.hours>=2&&job.chance>0&&job.chance<1);
  assert.deepEqual(snapshot(r,at),quiet,'refresh must not reroll the chance');
  assert.equal(snapshot(r,at+(job.hours-.001)*HOUR).branchRanges.find(g=>g.key===a.parent).count,1);
  assert.equal(snapshot(r,at+job.hours*HOUR).branchRanges.find(g=>g.key===a.parent).count,2,'birth reserves capacity even before visible');
  const full=snapshot(r,at+2000*HOUR);
  assert(full.branchRanges.every(g=>g.count<=g.max));
  assert(full.branchRanges.every(g=>g.count===g.max));
  assert.equal(full.recovery.length,0);
  assert.equal(snapshot(r,at+10000*HOUR).nodes.length,full.nodes.length,'time alone cannot exceed the cap');
 }
 assert(waits.size>=3,'natural growth must have variable waiting times');
});

test('interval growth preserves old history, saved/rebased timelines and watering determinism',()=>{
 const r=record(),[a]=pair(r);cut(r,a,at,'state-2');
 const past=snapshot(r,at+HOUR),oldShoot=past.nodes.find(n=>n.recoveryCut===r.cuts[0].id);assert(oldShoot);
 cut(r,oldShoot,at+HOUR);
 assert.deepEqual(snapshot(r,at),snapshot({...r,cuts:r.cuts.slice(0,1)},at));
 r.waterings=[{id:randomUUID(),at:at+2*HOUR,used:100,amount:.01,recoveryHours:2}];
 const time=at+48*HOUR,frame=snapshot(r,time);
 for(let i=1;i<48;i++)snapshot(r,at+i*HOUR);
 assert.deepEqual(snapshot(r,time),frame,'polling intermediate states cannot affect later births');
 assert.deepEqual(snapshot(JSON.parse(JSON.stringify(r)),time),frame);
 assert.deepEqual(snapshot(applyCheat(r,cheatRequest(r,time/HOUR),800*HOUR),800*HOUR),frame);
 const future={...r,waterings:[...r.waterings,{id:'future',at:time+HOUR,used:100,amount:.01,recoveryHours:2}]};
 assert.deepEqual(snapshot(future,time),frame);
});
