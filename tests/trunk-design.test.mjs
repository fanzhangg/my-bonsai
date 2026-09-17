import test from 'node:test';
import assert from 'node:assert/strict';
import {generateTrunkDesign} from '../prototype/trunk-design.mjs';
import {generateCrownBaseline} from '../prototype/crown-baseline.mjs';
import {pointOn} from '../prototype/core/v1/model.mjs';
import {grow,HOUR} from '../prototype/growth.mjs';

test('candidate trunk elongates in stages and thickens before reaching its mature silhouette',()=>{
  const record={createdAt:0,config:{preset:'juniper',seed:'trunk-life'},cuts:[]};
  let lastHeight=0,lastWidth=0,lastCount=0;
  const mature=grow(record,1,{generator:generateTrunkDesign});
  for(const p of [.05,.15,.25,.5,.75,1]){
    const tree=grow(record,p,{generator:generateTrunkDesign}),trunks=tree.nodes.filter(n=>n.role==='trunk');
    const height=tree.root.y-Math.min(...trunks.map(n=>n.ey)),width=trunks[0].width;
    assert(height>=lastHeight&&width>lastWidth&&trunks.length>=lastCount);
    if(p===.25){
      assert(trunks.length<mature.nodes.filter(n=>n.role==='trunk').length);
      assert(width<mature.nodes[0].width*.3);
    }
    for(const n of tree.nodes.filter(n=>n.parent)){
      const parent=tree.nodes.find(v=>v.id===n.parent);
      assert(parent,'growing tips remain attached to existing wood');
    }
    lastHeight=height;lastWidth=width;lastCount=trunks.length;
  }
});
test('trunk candidate is shorter, stronger and keeps attached foliage and cut IDs',()=>{
  for(let i=1;i<=5;i++){
    const config={preset:'juniper',seed:`DESIGN-SYSTEM-0${i}`},a=generateCrownBaseline(config),b=generateTrunkDesign(config);
    assert.deepEqual(a.nodes.filter(n=>n.role==='primary').map(n=>n.id),b.nodes.filter(n=>n.role==='primary').map(n=>n.id));
    const primaries=b.nodes.filter(n=>n.role==='primary');
    assert(b.nodes.some(n=>n.studyTier===3&&n.pad===primaries[0].pad));
    assert(!b.nodes.some(n=>n.studyTier===3&&n.pad===primaries.at(-1).pad));
    assert(!b.nodes.some(n=>n.studyTier===3&&n.pad===primaries.at(-2).pad));
    assert.deepEqual(b,generateTrunkDesign(config));
    for(const n of b.nodes){
      const old=a.nodes.find(v=>v.id===n.id);
      if(n.role==='trunk'){assert(n.width>old.width);assert(n.width>=n.tipWidth);}
      else {const p=pointOn(b.nodes.find(v=>v.id===n.parent),n.attachment);assert(Math.hypot(p.x-n.x,p.y-n.y)<1e-7);}
      if(n.role==='twig'){
        assert(n.ey<n.y&&n.cy2>n.ey,'terminal shoots rise and finish upward');
        const elevation=Math.atan2(n.y-n.ey,Math.abs(n.ex-n.x))*180/Math.PI;
        assert(n.studyTier===3?elevation>=24&&elevation<=66:elevation>=26&&elevation<=49);
        const parent=b.nodes.find(v=>v.id===n.parent),p=pointOn(parent,Math.max(0,n.attachment-.002)),q=pointOn(parent,Math.min(1,n.attachment+.002));
        const turn=Math.atan2(n.cy1-n.y,n.cx1-n.x)-Math.atan2(q.y-p.y,q.x-p.x);
        assert(Math.abs(Math.atan2(Math.sin(turn),Math.cos(turn)))<=.201,'collar follows parent flow');
      }
    }
    for(let j=0;j<b.clusters.length;j++){
      const c=b.clusters[j],old=a.clusters[j],n=b.nodes.find(v=>v.id===c.node),o=a.nodes.find(v=>v.id===old.node);
      assert(Math.abs((c.x-n.ex)-(old.x-o.ex))<1e-7);
      assert(Math.abs((c.y-n.ey)-(old.y-o.ey))<1e-7);
      assert.deepEqual(c.layerPalette,old.layerPalette);
    }
  }
});
test('trunk review cuts preserve survivors and undo restores candidate',()=>{
  const at=200*HOUR,record={createdAt:0,config:{preset:'juniper',seed:'trunk-cut'},cuts:[]};
  const build=()=>grow(record,1,{at,generator:generateTrunkDesign});
  const before=build(),branch=before.nodes.find(n=>n.role==='primary');
  record.cuts=[{branchId:branch.id,at,seq:1}];const after=build();
  for(const n of after.nodes)assert.deepEqual(n,before.nodes.find(v=>v.id===n.id));
  record.cuts=[];assert.deepEqual(build(),before);
});
