import test from 'node:test';
import assert from 'node:assert/strict';
import {FORMS,PALETTES,selection,generateLanguage,languageFrame,crownCoversTip} from '../prototype/bonsai-language.mjs';
import {generateTrunkDesign} from '../prototype/trunk-design.mjs';
import {grow,HOUR} from '../prototype/growth.mjs';
import {pointOn} from '../prototype/core/v1/model.mjs';
import {render} from '../prototype/growing-render.mjs';

test('design language retains approved juniper geometry and colors',()=>{
  const config={preset:'juniper',seed:'DESIGN-SYSTEM-01',variation:0},before=generateTrunkDesign(config),after=generateLanguage(config);
  assert.deepEqual(after.nodes,before.nodes);
  for(let i=0;i<before.clusters.length;i++){
    const a=before.clusters[i],b=after.clusters[i];
    for(const key of ['x','y','rx','ry','node','layerPalette'])assert.deepEqual(b[key],a[key]);
  }
});
test('all curated form, crown, leaf and color combinations retain finite attached geometry',()=>{
  for(const f of FORMS)for(const crown of f.crowns)for(const leaf of f.leaves)for(const palette of Object.keys(PALETTES)){
    const config={preset:f.id,crown,leaf,palette,seed:'language-check'},t=generateLanguage(config),index=new Map(t.nodes.map(n=>[n.id,n]));
    for(const n of t.nodes){
      for(const key of ['x','y','ex','ey','cx1','cy1','cx2','cy2','width','tipWidth'])assert(Number.isFinite(n[key]),`${f.id} ${n.id} ${key}`);
      if(n.parent&&n.role!=='trunk'){
        const p=pointOn(index.get(n.parent),n.attachment);
        assert(Math.hypot(n.x-p.x,n.y-p.y)<.001,`${f.id} attached branch`);
      }
      assert(n.width>=n.tipWidth&&n.tipWidth>0);
      if(n.role!=='trunk')assert(t.clusters.some(c=>c.pad===n.pad&&crownCoversTip(c,n)),`${f.id}/${crown}: no exposed mature branch tip`);
    }
    for(const c of t.clusters){assert(index.has(c.node));assert(c.rx>0&&c.ry>0);assert.equal(c.layerPalette.length,4);}
    const frame=languageFrame(t),svg=render(t,{viewBox:frame});
    assert(!svg.includes('NaN')&&!svg.includes('Infinity'));
    assert.equal(t.config.appearance.shape,leaf);
    assert.equal(t.language.palette,palette,'every tree form accepts every palette');
    assert.deepEqual(t,generateLanguage(config));
  }
});

test('extended mature branch tips carry attached foliage and cut foliage does not reappear',()=>{
  const record={createdAt:0,config:{preset:'juniper',palette:'mist',variation:.85,density:.8,seed:'655bc0bf-ed33-4435-bbf6-e27eafaff27a'},cuts:[]};
  const options={generator:generateLanguage,at:200*HOUR},tree=grow(record,1,options);
  assert(tree.clusters.some(c=>c.terminalCrown),'regression seed includes formerly bare carrying tips');
  for(const n of tree.nodes.filter(n=>n.role!=='trunk')){
    assert(tree.clusters.some(c=>c.pad===n.pad&&crownCoversTip(c,n)),`${n.id}: covered after growth transforms`);
  }
  const crown=tree.clusters.find(c=>c.terminalCrown);
  const cut=grow({...record,cuts:[{id:'tip-cut',seq:1,at:200*HOUR,branchId:crown.node}]},1,options);
  assert(!cut.clusters.some(c=>c.node===crown.node),'coverage repair must happen before pruning');
  for(const c of cut.clusters)assert.deepEqual(c,tree.clusters.find(original=>original.key===c.key));
});
test('all forms grow in a fixed frame and pruning leaves surviving geometry unchanged',()=>{
  for(const f of FORMS){
    const record={createdAt:0,config:{preset:f.id,seed:'growth-language'},cuts:[]},generator=generateLanguage;
    const mature=grow(record,1,{generator,at:200*HOUR}),young=grow(record,.25,{generator,at:200*HOUR});
    assert(young.nodes[0].width<mature.nodes[0].width);
    assert(young.nodes.length<mature.nodes.length);
    const branch=mature.nodes.find(n=>n.role==='primary');
    const cut=grow({...record,cuts:[{id:'cut',seq:1,at:200*HOUR,branchId:branch.id}]},1,{generator,at:200*HOUR});
    assert(!cut.nodes.some(n=>n.id===branch.id));
    for(const n of cut.nodes)assert.deepEqual(n,mature.nodes.find(p=>p.id===n.id));
  }
  assert.equal(selection({preset:'pine',palette:'ruby',leaf:'maple'}).palette,'ruby');
  assert.equal(selection({preset:'pine',palette:'ruby',leaf:'maple'}).leaf,'needle');
  for(const p of Object.values(PALETTES))assert.equal(p.layers.length,3);
});
