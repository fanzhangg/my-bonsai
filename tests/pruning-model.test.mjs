import test from 'node:test';
import assert from 'node:assert/strict';
import {grow,VERSION} from '../prototype/growth.mjs';
import {normalize} from '../prototype/core/v1/canopy.mjs';
import {pointOn} from '../prototype/core/v1/model.mjs';
import {branchFamily,pruningTarget} from '../prototype/pruning-model.mjs';
const {nodes}=grow({version:VERSION,createdAt:0,cuts:[],config:normalize({preset:'juniper',seed:'DESIGN-SYSTEM-01'})},1);
test('trunk is protected along every segment at desktop and mobile scales',()=>{
  for(const scale of [.55,1,1.5])for(const n of nodes.filter(n=>n.role==='trunk'))for(let i=0;i<=10;i++){
    assert.equal(pruningTarget(nodes,new Set(),pointOn(n,i/10),scale)?.protected,true);
    assert.equal(branchFamily(nodes,n.id).size,0);
  }
});
test('side branch removal includes descendants but never trunk or siblings',()=>{
  const side=nodes.find(n=>n.role==='primary'),ids=branchFamily(nodes,side.id);
  assert.ok(ids.size>1);
  for(const n of nodes){
    if(n.role==='trunk'||(n.role==='primary'&&n.id!==side.id))assert.equal(ids.has(n.id),false);
    if(ids.has(n.parent)&&n.role!=='trunk')assert.ok(ids.has(n.id));
  }
  const p=pointOn(side,.5);
  assert.equal(pruningTarget(nodes,new Set(),p)?.node?.id,side.id);
  assert.equal(pruningTarget(nodes,ids,p),null);
});
test('empty space is not a cut target and all side branches can be exhausted',()=>{
  assert.equal(pruningTarget(nodes,new Set(),{x:-1000,y:-1000}),null);
  const removed=new Set(nodes.filter(n=>n.role!=='trunk').map(n=>n.id));
  for(const n of nodes.filter(n=>n.role==='primary'))assert.equal(pruningTarget(nodes,removed,pointOn(n,.7))?.node,undefined);
});
