import {grow,VERSION} from './growth.mjs';
import {normalize} from './core/v1/canopy.mjs';
import {render} from './growing-render.mjs';
import {createPruning} from './pruning.mjs';

export function createPruningReview(){
  const $=id=>document.getElementById(id);
  const tree=grow({version:VERSION,createdAt:0,cuts:[],config:normalize({preset:'juniper',seed:'DESIGN-SYSTEM-01'})},1);
  $('pruning-tree').innerHTML=render(tree,{hour:tree.hour,transparent:true,id:'pruning-sample',viewBox:{x:-40,y:65,width:580,height:520}});
  const review=createPruning({scene:$('pruning-scene'),treeElement:$('pruning-tree'),tool:$('pruning-scissors'),message:$('pruning-message')});
  review.refresh(tree);return review;
}
