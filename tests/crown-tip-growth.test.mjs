import test from 'node:test';
import assert from 'node:assert/strict';
import {generateLanguage as preview} from '../prototype/bonsai-language.mjs';
import {generateLanguage,FORMS,crownCoversTip} from '../prototype/core/v3/bonsai-language.mjs';
import {grow,draw,HOUR} from '../prototype/growth.mjs';
import {CURRENT_VERSION} from '../prototype/tree-versions.mjs';
import {CUT_MODEL} from '../prototype/pruning-model.mjs';

const config={seed:'452c40c1-f848-40c9-94cb-1ca34956f770',preset:'juniper',
  crown:'cushion',leaf:'scale',palette:'mist',variation:.55,density:.5,
  coverage:.85,padScale:1,tipScale:1,leafScale:1,growthPolicy:'natural-5'};

test('Dami keeps foliage on fine tips without extra crowns on carrying branches',()=>{
  for(const generate of [preview,generateLanguage]){
    const tree=generate(config),index=new Map(tree.nodes.map(n=>[n.id,n]));
    const carrying=tree.nodes.filter(n=>n.role==='primary');
    assert(carrying.length>0);
    for(const n of carrying){
      assert(tree.nodes.some(child=>child.parent===n.id),'regression has outward shoots');
      assert(!tree.clusters.some(c=>c.node===n.id),`${n.id}: no crown inside the branch family`);
    }
    assert(tree.clusters.length>0);
    for(const c of tree.clusters)assert.equal(index.get(c.node).role,'twig');
    for(const n of tree.nodes.filter(n=>n.role==='twig')){
      assert(tree.clusters.some(c=>c.pad===n.pad&&crownCoversTip(c,n)),`${n.id}: fine tip stays covered`);
    }
  }
});

test('saved snips on a removed filler crown do not break surviving tip leaves',()=>{
  const at=200*HOUR,record={version:CURRENT_VERSION,createdAt:0,cuts:[],config};
  const before=grow(record,1,{at}),cluster=before.clusters.find(c=>c.pad===1);
  const obsolete='tip-crown:individual:1:n75';
  const leafTrims=[{id:'saved-snip',seq:1,at,model:'leaf-3',crownId:'layer:1',targets:[
    {clusterKey:obsolete,index:39},{clusterKey:cluster.key,index:0}
  ]}];
  const tree=grow({...record,leafTrims},1,{at});
  assert(!tree.clusters.some(c=>c.key===obsolete),'saved history cannot recreate filler crowns');
  assert.equal(tree.clusters.find(c=>c.key===cluster.key).leafSnips[0],0);
  assert(!/NaN|Infinity/.test(draw(tree)));
});

test('all forms retain fine-tip crowns through growth and do not fill cut ends',()=>{
  for(const form of FORMS){
    const record={version:CURRENT_VERSION,createdAt:0,cuts:[],config:{...config,
      preset:form.id,crown:form.crowns[0],leaf:form.leaves[0]}};
    const at=200*HOUR,mature=grow(record,1,{at});
    for(const p of [.35,.65,1]){
      const tree=grow(record,p,{at}),index=new Map(tree.nodes.map(n=>[n.id,n]));
      for(const c of tree.clusters){
        const n=index.get(c.node);
        assert(n&&n.growth>0,'foliage needs a living support');
        // Natural growth creates genuinely new shoots, including primaries;
        // their own tip leaves are distinct from scaffold coverage repairs.
        if(!n.regrown)assert.equal(n.role,'twig',`${form.id}: structural ends stay bare`);
        assert(Math.hypot((c.x-n.ex)/c.rx,(c.y-n.ey)/c.ry)<2,'crown follows the growing tip');
      }
    }
    const twig=mature.nodes.find(n=>n.role==='twig');
    const cut=grow({...record,cuts:[{id:'tip-cut',seq:1,at,branchId:twig.id,model:CUT_MODEL}]},1,{at});
    assert(!cut.clusters.some(c=>c.node===twig.id),'cut foliage disappears');
    for(const c of cut.clusters.filter(c=>!c.key.startsWith('leaf:sprout:')))assert.deepEqual(c,mature.clusters.find(old=>old.key===c.key),'cutting does not add a crown to the exposed parent');
  }
});
