import test from 'node:test';
import assert from 'node:assert/strict';
import {grow,VERSION} from '../prototype/growth.mjs';
import {normalize} from '../prototype/core/v1/canopy.mjs';
import {pointOn} from '../prototype/core/v1/model.mjs';
import {branchFamily,pruningPoints,pruningTarget} from '../prototype/pruning-model.mjs';
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

const straight=(id,role,x,y,ex,ey)=>({id,role,x,y,ex,ey,cx1:x+(ex-x)/3,cy1:y+(ey-y)/3,cx2:x+2*(ex-x)/3,cy2:y+2*(ey-y)/3,width:10,tipWidth:4,growth:1});
test('visible points and snap targets match at mobile and desktop sizes',()=>{
  const branch=straight('side','primary',0,0,200,0),trunk=straight('trunk','trunk',0,-100,0,100);
  for(const scale of [.55,1,1.5]){
    const choices=pruningPoints([trunk,branch],new Set(),scale),chosen=choices[0];
    assert.equal(choices.length,1);
    assert.equal(pruningTarget([trunk,branch],new Set(),chosen.point,scale)?.node.id,branch.id);
    assert.equal(pruningTarget([trunk,branch],new Set(),{x:chosen.point.x,y:29/scale},scale)?.node.id,branch.id);
    assert.equal(pruningTarget([trunk,branch],new Set(),{x:chosen.point.x,y:31/scale},scale),null);
    assert.equal(pruningTarget([trunk,branch],new Set(),{x:190,y:0},scale),null);
    assert.equal(pruningTarget([trunk,branch],new Set(),{x:chosen.point.x,y:40/scale},scale,chosen)?.node.id,branch.id);
    assert.equal(pruningTarget([trunk,branch],new Set(),{x:chosen.point.x,y:45/scale},scale,chosen),null);
    assert.equal(pruningTarget([trunk,branch],new Set(),{x:0,y:0},scale,chosen)?.protected,true);
    assert.deepEqual(pruningPoints([trunk,branch],new Set(['side']),scale),[]);
    assert.equal(pruningTarget([trunk,branch],new Set(['side']),chosen.point,scale,chosen,choices),null);
  }
});
test('points move away from trunk junctions and hidden branches retain a linked cut point',()=>{
  const trunk=straight('trunk','trunk',0,-100,0,100),side=straight('side','primary',0,0,40,0);
  const choices=pruningPoints([trunk,side],new Set(),.55);
  assert.equal(choices.length,1);
  assert.ok(choices[0].point.x>pointOn(side,.22).x);
  assert.equal(pruningTarget([trunk,side],new Set(),choices[0].point,.55)?.node.id,'side');
  const hidden=straight('short','primary',0,0,2,0),[choice]=pruningPoints([trunk,hidden]);
  assert.deepEqual(choice.anchor,pointOn(hidden,.62));
  assert.equal(pruningTarget([trunk,hidden],new Set(),choice.point)?.node.id,'short');
  assert.deepEqual(pruningPoints([{...side,growth:0}]),[]);
});
test('nearest visible point wins when moving between adjacent branches',()=>{
  const nodes=[straight('a','primary',0,0,200,0),straight('b','primary',0,45,200,45)],choices=pruningPoints(nodes);
  assert.equal(pruningTarget(nodes,new Set(),{x:44,y:26},1,choices[0])?.node.id,'b');
});
