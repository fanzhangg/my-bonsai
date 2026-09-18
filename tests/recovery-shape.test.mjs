import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshot,HOUR} from '../prototype/growth.mjs';
import {normalizeDesign,FORMS} from '../prototype/core/v3/config.mjs';
import {generate} from '../prototype/core/v3/runtime.mjs';
import {pointOn} from '../prototype/core/v1/model.mjs';
import {FORM_PROPORTIONS,BRANCH_WIDTH_BANDS,branchLength} from '../prototype/core/v3/bonsai-individual.mjs';
import {CURRENT_VERSION} from '../prototype/tree-versions.mjs';
import {CUT_MODEL,canPrune} from '../prototype/pruning-model.mjs';

const turn=a=>Math.atan2(Math.sin(a),Math.cos(a));
const direction=n=>Math.atan2(n.ey-n.y,n.ex-n.x);
test('replacement families retain trained direction, smooth junctions and taper through repeated cuts and later growth',()=>{
 for(const {id:preset}of FORMS)for(const seed of ['immediate-recovery','style-left','style-right']){
  const record={version:CURRENT_VERSION,createdAt:0,config:normalizeDesign({preset,seed}),cuts:[]};
  const layout=generate(record.config),references=new Map(layout.nodes.map(n=>[n.id,n]));
  let at=200*HOUR;
  for(let i=0;i<12;i++){
   const before=snapshot(record,at),branch=before.nodes.find(n=>n.pruningLevel===1&&canPrune(n));
   record.cuts.push({id:`cut-${i}`,seq:i+1,branchId:branch.id,at,model:CUT_MODEL});
   at+=24*HOUR;
  }
  const tree=snapshot(record,at+240*HOUR),nodes=new Map(tree.nodes.map(n=>[n.id,n])),grown=tree.nodes.filter(n=>n.regrown);
  assert(grown.some(n=>n.pruningLevel===1),preset);
  assert(grown.some(n=>n.pruningLevel===2),preset);
  assert(grown.every(n=>n.pruningLevel<=3),preset);
  for(const n of grown){
   const parent=nodes.get(n.parent),reference=references.get(n.growthReference);
   assert(reference,`${preset}: descendants retain their trained family reference`);
   assert(Math.abs(turn(direction(n)-direction(reference)))<=.581,`${preset}: no cumulative directional drift`);
   const anchor=pointOn(parent,n.attachment);
   assert(Math.hypot(n.x-anchor.x,n.y-anchor.y)<.001,`${preset}: connected to live wood`);
   const a=pointOn(parent,Math.max(0,n.attachment-.002)),b=pointOn(parent,Math.min(1,n.attachment+.002));
   const departure=Math.atan2(n.cy1-n.y,n.cx1-n.x),tangent=Math.atan2(b.y-a.y,b.x-a.x);
   assert(Math.abs(turn(departure-tangent))<=(n.pruningLevel===1?.681:.241),`${preset}: no abrupt junction`);
   const tier=n.branchTier,band=BRANCH_WIDTH_BANDS[tier],local=parent.width+(parent.tipWidth-parent.width)*n.attachment;
   assert(n.width>0&&n.width<=local*band.ratio[1]+.001,`${preset}: child thinner than supporting wood`);
   assert(n.tipWidth<n.width&&n.tipWidth>0,`${preset}: tapered tip`);
   assert(branchLength(n)<=FORM_PROPORTIONS[preset].lengths[tier-1][1]*1.2,`${preset}: retain style proportions`);
   if(n.pruningLevel>1)assert(branchLength(n)<=branchLength(parent)*.9,`${preset}: progressively shorter fine branches`);
  }
  assert.deepEqual(snapshot(JSON.parse(JSON.stringify(record)),at+240*HOUR),tree);
 }
});
