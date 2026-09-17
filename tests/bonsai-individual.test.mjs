import test from 'node:test';
import assert from 'node:assert/strict';
import {individualPlan,FORM_PROPORTIONS,branchLength} from '../prototype/bonsai-individual.mjs';
import {FORMS,generateLanguage,languageFrame,crownCoversTip} from '../prototype/bonsai-language.mjs';
import {pointOn} from '../prototype/core/v1/model.mjs';
import {grow,HOUR} from '../prototype/growth.mjs';

test('each form yields a thousand distinct plans with ordered buds and varied branch counts',()=>{
  for(const {id} of FORMS){
    const plans=new Set(),counts=new Set();
    for(let i=0;i<1000;i++){
      const p=individualPlan(id,`population-${i}`);
      plans.add(JSON.stringify(p));counts.add(p.count);
      for(let j=1;j<p.buds.length;j++)assert(p.buds[j].u-p.buds[j-1].u>.04);
      assert(individualPlan(id,`population-${i}`,{density:.2}).count<=individualPlan(id,`population-${i}`,{density:.8}).count);
    }
    assert.equal(plans.size,1000,`${id}: unique generated individuals`);
    assert(counts.size>=3,`${id}: branch count actually changes`);
  }
});

test('extreme controls keep connected tapered wood, supported crowns and distinct silhouettes across seeds',()=>{
  for(const {id} of FORMS){
    const silhouettes=new Set();
    for(let i=0;i<24;i++){
      const t=generateLanguage({preset:id,seed:`geometry-${i}`,variation:i%2?.85:.25,density:i%3===0?.2:.8});
      const nodes=new Map(t.nodes.map(n=>[n.id,n]));assert.equal(nodes.size,t.nodes.length);
      silhouettes.add(t.nodes.map(n=>[n.parent,n.x,n.y,n.ex,n.ey,n.width].map(x=>typeof x==='number'?x.toFixed(1):x).join(',')).join('|'));
      assert.equal(t.pads.length,t.nodes.filter(n=>n.role==='primary').length);
      for(const n of t.nodes){
        for(const k of ['x','y','cx1','cy1','cx2','cy2','ex','ey','width','tipWidth'])assert(Number.isFinite(n[k]),`${id}/${i}: ${k}`);
        assert(n.width>=n.tipWidth&&n.tipWidth>0);
        if(!n.parent)continue;
        const parent=nodes.get(n.parent);assert(parent);
        const p=pointOn(parent,n.attachment??1);
        assert(Math.hypot(p.x-n.x,p.y-n.y)<1e-6,`${id}/${i}: attached joint`);
        const local=parent.width+(parent.tipWidth-parent.width)*(n.attachment??1);
        assert(n.width<=local+1e-6,`${id}/${i}: child must fit parent`);
        if(n.role!=='trunk'){
          assert(t.clusters.some(c=>c.pad===n.pad&&crownCoversTip(c,n)),`${id}/${i}: mature side-branch tip has foliage`);
          assert.equal(n.branchTier,parent.branchTier+1,'count forks, not trunk segments');
          const tier=Math.min(n.branchTier,4);
          assert(n.width<=[0,22,9,5.2,3.2][tier]+1e-6,`${id}/${i}: tier width ceiling`);
          assert(n.width<=local*[0,.52,.78,.67,.64][tier]+1e-6,'child has a visible hierarchy');
          assert(n.tipWidth>=n.width*.50,'fine tips remain legible');
          const band=FORM_PROPORTIONS[id].lengths[tier-1],length=branchLength(n);
          const ceiling=Math.min(band[1],parent.role==='trunk'?Infinity:branchLength(parent)*1.25);
          assert(length<=ceiling+1e-6,`${id}/${i}: branch respects form and parent length`);
          assert(length>=Math.min(band[0],ceiling)-1e-6,`${id}/${i}: crown support is not a stub`);
          assert(!(parent.branchTier>=3&&parent.tipWidth<1.1),'hairline forks are collapsed');
        }
        if(n.role==='trunk'){
          const a=Math.atan2(parent.ey-parent.cy2,parent.ex-parent.cx2),b=Math.atan2(n.cy1-n.y,n.cx1-n.x);
          assert(Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)))<1e-6,'trunk tangent continuous');
          assert(Math.abs(n.width-parent.tipWidth)<1e-6);
        }
      }
      for(const c of t.clusters){
        const n=nodes.get(c.node);assert(n);
        assert(c.rx>0&&c.ry>0&&Number.isFinite(c.x+c.y));
        assert(Math.abs(c.x-n.ex)<c.rx*1.15,'support stays inside crown width');
      }
      const f=languageFrame(t);
      for(const c of t.clusters)assert(c.x-c.rx>=f.x&&c.x+c.rx<=f.x+f.width&&c.y-c.ry>=f.y&&c.y+c.ry<=f.y+f.height);
    }
    assert.equal(silhouettes.size,24,`${id}: actual silhouettes differ`);
  }
});

test('thick juniper carrying limbs flow into distal second-tier branches without a large width step',()=>{
  const tree=generateLanguage({preset:'juniper',seed:'4bc5f0b6-03be-445a-a1cb-b5268a052c03',variation:.55,density:.8});
  const nodes=new Map(tree.nodes.map(n=>[n.id,n]));
  const distal=tree.nodes.filter(n=>n.branchTier===2&&n.attachment>.8&&nodes.get(n.parent).width>10);
  assert(distal.length>=2,'regression specimen includes thick outer junctions');
  for(const child of distal){
    const parent=nodes.get(child.parent),local=parent.width+(parent.tipWidth-parent.width)*child.attachment;
    assert(child.width/local>=.65,'outer junction does not halve the visible thickness');
    assert(parent.tipWidth/child.width<1.4,'parent cap does not create a heavy shoulder');
    assert(child.width<=9,'smoother transition does not inflate second-tier wood');
  }
});

test('individual identity survives color changes, repeated growth and pruning without rerolling',()=>{
  for(const {id} of FORMS){
    const config={preset:id,seed:'keep-my-tree',variation:.85,density:.8};
    const a=generateLanguage({...config,palette:'forest'}),b=generateLanguage({...config,palette:'ruby'});
    assert.deepEqual(a.nodes,b.nodes,'palette cannot change branching');
    const record={createdAt:0,config,cuts:[]},options={generator:generateLanguage,at:200*HOUR};
    const full=grow(record,1,options),half=grow(record,.5,options);
    assert(half.nodes.length<full.nodes.length);
    assert.deepEqual(grow(record,.5,options),half);
    const primary=full.nodes.find(n=>n.role==='primary');
    const cut=grow({...record,cuts:[{id:'cut',seq:1,at:200*HOUR,branchId:primary.id}]},1,options);
    assert(!cut.nodes.some(n=>n.id===primary.id));
    for(const n of cut.nodes)assert.deepEqual(n,full.nodes.find(p=>p.id===n.id));
    assert.deepEqual(grow(record,1,options),full);
  }
});
