import {snapshot,VERSION,HOUR} from './growth.mjs';
import {normalize} from './core/v1/canopy.mjs';
import {render} from './growing-render.mjs';
import {createPruning} from './pruning.mjs';

export function createPruningReview(){
  const $=id=>document.getElementById(id);
  const record={version:VERSION,createdAt:0,cuts:[],config:normalize({preset:'juniper',seed:'DESIGN-SYSTEM-01'})};
  let at=7*24*HOUR;
  const controls=document.createElement('div');controls.className='pruning-review-controls';
  const advance=document.createElement('button'),reset=document.createElement('button');
  advance.type=reset.type='button';advance.textContent='生长 8 小时';reset.textContent='重置样本';
  controls.append(advance,reset);$('pruning-scene').after(controls);
  function paint(){
    const tree=snapshot(record,at);
    $('pruning-tree').innerHTML=render(tree,{hour:tree.hour,transparent:true,id:'pruning-sample',viewBox:{x:-40,y:65,width:580,height:520}});
    review.refresh(tree);
  }
  const review=createPruning({scene:$('pruning-scene'),treeElement:$('pruning-tree'),tool:$('pruning-scissors'),message:$('pruning-message'),
    onCommit:async branchId=>{record.cuts.push({id:crypto.randomUUID(),seq:record.cuts.length+1,at,branchId});},
    onBusyChange:busy=>{advance.disabled=reset.disabled=busy;},onSettled:paint});
  advance.addEventListener('click',()=>{if(review.busy)return;at+=8*HOUR;paint();});
  reset.addEventListener('click',()=>{if(review.busy)return;at=7*24*HOUR;record.cuts=[];paint();});
  paint();return review;
}
