import {grow,VERSION} from './growth.mjs';
import {normalize} from './core/v1/canopy.mjs';
import {render} from './growing-render.mjs';
import {createWatering} from './watering.mjs';
export function createWateringReview(){
 const $=id=>document.getElementById(id),holder=$('watering-tree');
 const record={version:VERSION,createdAt:0,cuts:[],config:normalize({preset:'juniper',seed:'DESIGN-SYSTEM-01'})};
 return createWatering({scene:$('watering-scene'),holder,can:$('watering-can'),water:$('watering-water'),status:$('watering-status'),renderTree:value=>{
  const tree=grow(record,value);holder.innerHTML=render(tree,{hour:tree.hour,transparent:true,id:'watering-sample',viewBox:{x:-50,y:10,width:600,height:580}});return tree;
 }});
}
