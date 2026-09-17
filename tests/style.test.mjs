import test from 'node:test';
import assert from 'node:assert/strict';
import {StyleSimulation,DEFAULTS,STYLES,VERSION} from '../prototype/style-model.mjs';
import {Simulation,validateScene,pruneAt,versionFor} from '../prototype/experiment.mjs';
import {Simulation as Legacy,VERSION as LEGACY_VERSION,affectedIds} from '../prototype/model.mjs';
import {taperedPath} from '../prototype/style-render.mjs';
import {StyleSimulation as StyleV1,VERSION as V1} from '../prototype/style-model-v1.mjs';
const event=(branch,at=24,seq=1)=>({id:`cut${seq}`,branch,at,seq,actor:'A'});

test('three styles × twelve seeds: usable initial wood, stable finite growth and distinct architecture',()=>{
  for(const style of STYLES)for(let i=0;i<12;i++){
    const sim=new StyleSimulation({...DEFAULTS,style,seed:`style-${i}`});
    const start=sim.at(0);assert.ok(start.nodes.filter(n=>n.role==='primary').length>=6);
    const trunk=start.nodes.filter(n=>n.role==='trunk');assert.ok(trunk.every(n=>n.axisId==='trunk'&&n.order===0));
    if(style==='cascade')assert.ok(trunk.filter(n=>n.ey>n.y).length>=3,'continuous descending trunk');
    if(style==='literati')assert.ok(start.nodes.filter(n=>n.role==='primary').every(n=>n.y<260),'bare lower trunk');
    const grown=sim.at(120);assert.ok(grown.nodes.length>start.nodes.length&&grown.nodes.length<=sim.maxNodes);
    for(const n of grown.nodes){
      for(const key of ['x','y','ex','ey','width','tipWidth'])assert.ok(Number.isFinite(n[key]),key);
      assert.ok(n.width>=n.tipWidth&&n.tipWidth>0);assert.ok(!/NaN|Infinity/.test(taperedPath(n)));
      const box=sim.plan.viewBox;assert.ok(n.ex>=box.x+12&&n.ex<=box.x+box.width-12&&n.ey>=box.y+12&&n.ey<=box.y+box.height-12,'stable camera contains grown endpoints');
    }
    assert.deepEqual(sim.at(144).nodes,grown.nodes);
  }
});
test('all styles replay deterministically and round trip under their own version',()=>{
  for(const style of STYLES){
    const config={...DEFAULTS,style},direct=new StyleSimulation(config),stepped=new StyleSimulation(config);
    for(let h=0;h<=72;h+=.5)stepped.at(h);
    assert.deepEqual(stepped.at(72),direct.at(72));
    const scene=validateScene(JSON.parse(JSON.stringify({version:VERSION,config,events:[event('b0')],hour:72})));
    assert.deepEqual(new Simulation(scene.config,scene.events).at(72),new StyleSimulation(config,scene.events).at(72));
  }
});
test('cuts remove subtrees without moving or thinning surviving old wood; regrowth is delayed and competitive',()=>{
  for(const style of STYLES){
    const config={...DEFAULTS,style},before=new StyleSimulation(config).at(24),removed=affectedIds(before,'b0.s1');
    const sim=new StyleSimulation(config,[event('b0.s1')]);const after=sim.at(24);
    assert.ok(after.nodes.every(n=>!removed.has(n.id)));
    for(const n of after.nodes){const old=before.nodes.find(b=>b.id===n.id);for(const k of ['x','y','cx1','cy1','cx2','cy2','ex','ey','width','tipWidth'])assert.equal(n[k],old[k],k);}
    assert.ok(!sim.at(27).nodes.some(n=>n.regrown));
    assert.ok(sim.at(72).nodes.some(n=>n.regrown));
    const later=sim.at(96);for(const n of after.nodes){const old=later.nodes.find(b=>b.id===n.id);assert.ok(old.width>=n.width);assert.equal(old.ex,n.ex);}
  }
});
test('initial same-time cuts, historical edits and protected root work for style experiments',()=>{
  const initial={version:VERSION,config:DEFAULTS,events:[],hour:0};
  const first=pruneAt(initial,'b0',0,'a'),second=pruneAt(first,'b1',0,'b');
  assert.equal(second.events.length,2);assert.doesNotThrow(()=>new Simulation(second.config,second.events).at(96));
  assert.throws(()=>pruneAt(initial,'0',0,'root'));
  const original={...initial,events:[event('b0',24),event('b1',48,2)],hour:72},saved=JSON.stringify(original);
  const past=pruneAt(original,'b2',30,'past');assert.deepEqual(past.events.map(e=>e.at),[24,30]);assert.equal(JSON.stringify(original),saved);
  assert.throws(()=>validateScene({...initial,config:{...DEFAULTS,style:'unknown'}}));
  assert.throws(()=>validateScene({...initial,events:[event('missing',0)]}));
});
test('pruning leader chooses a living side shoot and does not relocate existing geometry',()=>{
  const plain=new StyleSimulation(DEFAULTS).at(24),sim=new StyleSimulation(DEFAULTS,[event('t1')]);
  const cut=sim.at(24),leader=cut.nodes.find(n=>n.leader);
  assert.ok(leader);const before=plain.nodes.find(n=>n.id===leader.id);assert.equal(leader.ex,before.ex);assert.equal(leader.ey,before.ey);
  assert.ok(cut.nodes.find(n=>n.id==='b0.s1').leader,'promotion reaches the existing tip');
  assert.ok(sim.at(96).nodes.every(n=>Number.isFinite(n.width)));
});
test('style controls and constraint ablation change growth, without altering old legacy playback',()=>{
  const original=new StyleSimulation(DEFAULTS).at(96);
  for(const change of [{guidance:false},{density:.2},{light:65},{dominance:1},{movement:1.4},{taper:1.4}])assert.notDeepEqual(new StyleSimulation({...DEFAULTS,...change}).at(96).nodes,original.nodes);
  const old=validateScene({version:LEGACY_VERSION,config:{seed:'MOSS-0826'},events:[event('0.1')],hour:72});
  assert.equal(versionFor(old.config),LEGACY_VERSION);assert.deepEqual(new Simulation(old.config,old.events).at(72),new Legacy(old.config,old.events).at(72));
});
test('future cuts and request ids do not rewrite random samples or historical frames',()=>{
  const events=[event('b0.s1')],a=new StyleSimulation(DEFAULTS,events),b=new StyleSimulation(DEFAULTS,[{...events[0],id:'other'}]);
  assert.deepEqual(a.at(12),new StyleSimulation(DEFAULTS).at(12));assert.deepEqual(a.at(72).nodes,b.at(72).nodes);
});

test('new shoots stay upward and outward along their whole curve, with bounded turns and no wood crossings',()=>{
  for(const style of STYLES)for(const guidance of [true,false])for(let i=0;i<6;i++){
    const config={...DEFAULTS,style,guidance,seed:`flow-${i}`,light:i%2?65:-65,randomness:1};
    const sim=new StyleSimulation(config,[event('b0.s1')]),state=sim.at(96),byId=new Map(state.nodes.map(n=>[n.id,n]));
    for(const n of state.nodes.filter(n=>n.role==='twig')){
      assert.ok(n.y>=n.cy1&&n.cy1>=n.cy2&&n.cy2>=n.ey,'every cubic tangent has non-downward y');
      const xs=[n.x,n.cx1,n.cx2,n.ex].map(x=>x*n.flowSide);
      assert.ok(xs.every((x,j)=>j===0||x>=xs[j-1]),'no outward reversal inside curve');
      const parent=byId.get(n.parent);
      if(parent.role==='twig'){
        const tangent=Math.atan2(parent.ex-parent.cx2,parent.cy2-parent.ey);
        assert.ok(Math.abs(n.angle-tangent)<=.560001,'new segment must follow parent direction');
      }
      assert.equal(sim.crossesWood(n,n.parent),false,'no non-parent centerline crossings');
    }
    if(style==='cascade')assert.ok(state.nodes.some(n=>n.role==='trunk'&&n.ey>n.y),'hanging scaffold is preserved');
  }
});

test('first style version keeps its old geometry and pruning on import',()=>{
  const scene={version:V1,config:DEFAULTS,events:[event('b0.s1')],hour:96};
  const loaded=validateScene(JSON.parse(JSON.stringify(scene)));
  assert.equal(versionFor(loaded.config),V1);
  assert.deepEqual(new Simulation(loaded.config,loaded.events).at(96),new StyleV1(DEFAULTS,scene.events).at(96));
  const edited=pruneAt(loaded,'b1',30,'old-edit');assert.equal(edited.version,V1);
  assert.deepEqual(new Simulation(edited.config,edited.events).at(96),new StyleV1(DEFAULTS,edited.events).at(96));
});
