import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, VERSION, DEFAULTS, affectedIds, validateScene, sample, pruneAt } from '../prototype/model.mjs';

const cut=(branch,at=24,actor='A',seq=1)=>({id:`test-${seq}`,branch,at,actor,seq});
test('same seed replays identically, independent of frame requests',()=>{
  const direct=new Simulation(DEFAULTS).at(72);
  const stepped=new Simulation(DEFAULTS);for(let t=0;t<=72;t+=.5)stepped.at(t);
  assert.deepEqual(stepped.at(72),direct);
  assert.deepEqual(stepped.at(12),new Simulation(DEFAULTS).at(12));
});
test('seeded initial trees have immediately usable branches and bounded geometry',()=>{
  for(let i=0;i<20;i++){
    const sim=new Simulation({seed:`review-${i}`});
    assert.ok(sim.at(0).nodes.filter(n=>n.depth>0).length>=2);
    const grown=sim.at(120);assert.ok(grown.nodes.length<=255);
    for(const n of grown.nodes){assert.ok(n.depth<=7);for(const k of ['x','y','ex','ey','width'])assert.ok(Number.isFinite(n[k]));}
    assert.deepEqual(sim.at(144).nodes,grown.nodes,'unpruned tree stabilizes within a few virtual days');
  }
});
test('different seeds produce different trees and controls affect the adaptive result',()=>{
  const baseline=new Simulation(DEFAULTS).at(72);
  assert.notDeepEqual(new Simulation({...DEFAULTS,seed:'another'}).at(72),baseline);
  assert.notDeepEqual(new Simulation({...DEFAULTS,light:65}).at(72).nodes,baseline.nodes);
  assert.notDeepEqual(new Simulation({...DEFAULTS,dominance:1}).at(72).nodes,baseline.nodes);
  assert.notDeepEqual(new Simulation({...DEFAULTS,mode:'baseline'}).at(72).nodes,baseline.nodes);
});
test('cut removes exactly its living subtree and preserves existing wood geometry',()=>{
  const before=new Simulation(DEFAULTS).at(24),target='0.1';
  const removed=affectedIds(before,target);
  const after=new Simulation(DEFAULTS,[cut(target)]).at(24);
  for(const id of removed)assert.ok(!after.nodes.some(n=>n.id===id));
  const same=after.nodes.filter(n=>before.nodes.some(b=>b.id===n.id));
  for(const n of same){const original=before.nodes.find(b=>b.id===n.id);assert.equal(n.ex,original.ex);assert.equal(n.ey,original.ey);assert.ok(n.width>=original.width);}
});
test('regrowth waits, has new lineage, and cutting a parent cancels its future sprouts',()=>{
  const first=cut('0.1',24);const s=new Simulation(DEFAULTS,[first]);
  assert.ok(!s.at(27).nodes.some(n=>n.regrown));
  const later=s.at(29);const sprout=later.nodes.find(n=>n.regrown);
  assert.ok(sprout);assert.equal(sprout.parent,'0');assert.equal(sprout.key,'0.1.regrowth');
  assert.ok(sprout.born>=27.5&&sprout.born<=29);
  const child='0.0.0';const cancelled=new Simulation(DEFAULTS,[cut(child,24),cut('0.0',25,'B',2)]).at(40);
  assert.ok(!cancelled.nodes.some(n=>n.parent===child||n.id==='0.0.0r1'));
});
test('future events do not change the past and request UUID does not choose randomness',()=>{
  const a=cut('0.1');const b={...a,id:'different-request-id'};
  const sa=new Simulation(DEFAULTS,[a]),sb=new Simulation(DEFAULTS,[b]);
  assert.deepEqual(sa.at(12),new Simulation(DEFAULTS).at(12));
  assert.deepEqual(sa.at(48).nodes,sb.at(48).nodes);
});
test('regrowth can itself be pruned, with bounded live tree size',()=>{
  const es=[cut('0.1',24),cut('0.1r1',36,'B',2)];
  const s=new Simulation(DEFAULTS,es).at(96);
  assert.ok(s.nodes.some(n=>n.id==='0.1r2'));assert.ok(s.nodes.length<=255);
  assert.ok(!s.nodes.some(n=>n.id==='0.1r1'));
});
test('trunk and already deleted branches cannot be pruned',()=>{
  assert.throws(()=>new Simulation(DEFAULTS,[cut('0')]).at(24),/无效/);
  assert.throws(()=>new Simulation(DEFAULTS,[cut('0.1'),cut('0.1',25,'B',2)]).at(26),/无效/);
});
test('scene round trip preserves result and rejects malformed histories',()=>{
  const scene={version:VERSION,config:DEFAULTS,events:[cut('0.1')],hour:72};
  const loaded=validateScene(JSON.parse(JSON.stringify(scene)));
  assert.deepEqual(new Simulation(loaded.config,loaded.events).at(72),new Simulation(DEFAULTS,scene.events).at(72));
  assert.throws(()=>validateScene({...scene,version:'unknown'}));
  assert.throws(()=>validateScene({...scene,events:[cut('0')]}));
  assert.throws(()=>validateScene({...scene,events:[cut('0.1',24.1)]}));
  assert.throws(()=>validateScene({...scene,events:[...scene.events,...scene.events]}));
  assert.throws(()=>validateScene({...scene,hour:9999}));
});
test('random samples are reproducible and property separated',()=>{
  assert.equal(sample('a','0','angle'),sample('a','0','angle'));
  assert.notEqual(sample('a','0','angle'),sample('a','0','length'));
  for(let i=0;i<100;i++){const r=sample('a',String(i),'x');assert.ok(r>=0&&r<1);}
});

test('experiment permits consecutive cuts at the same initial time without cooldown',()=>{
  const original={version:VERSION,config:DEFAULTS,events:[],hour:0};
  const first=pruneAt(original,'0.1',0,'first');
  const second=pruneAt(first,'0.0',0,'second');
  assert.equal(second.events.length,2);
  assert.deepEqual(second.events.map(e=>e.at),[0,0]);
  assert.equal(new Simulation(second.config,second.events).at(0).nodes.length,1);
  assert.equal(original.events.length,0);
  assert.doesNotThrow(()=>validateScene(second));
});

test('pruning in the past keeps the prefix and drops the future without mutating the original',()=>{
  const original={version:VERSION,config:DEFAULTS,events:[cut('0.1',24),cut('0.0',48,'B',2)],hour:72};
  const saved=JSON.stringify(original);
  const next=pruneAt(original,'0.0',30,'past-edit');
  assert.equal(next.hour,30);
  assert.deepEqual(next.events.map(e=>e.at),[24,30]);
  assert.equal(next.events[0].id,original.events[0].id);
  assert.equal(JSON.stringify(original),saved);
  assert.doesNotThrow(()=>new Simulation(next.config,next.events).at(96));
  assert.doesNotThrow(()=>validateScene(next));
});
