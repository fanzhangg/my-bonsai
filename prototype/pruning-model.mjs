import {pointOn} from './core/v1/model.mjs';

export function branchFamily(nodes,id){
  const root=nodes.find(n=>n.id===id);
  if(!root||root.role==='trunk')return new Set();
  const ids=new Set([id]);
  let changed=true;
  while(changed){changed=false;for(const n of nodes)if(n.role!=='trunk'&&ids.has(n.parent)&&!ids.has(n.id)){ids.add(n.id);changed=true;}}
  return ids;
}
function onTrunk(nodes,p,scale){
  for(const n of nodes.filter(n=>n.role==='trunk'))for(let i=0;i<=40;i++){
    const q=pointOn(n,i/40),width=n.width+(n.tipWidth-n.width)*i/40;
    if(Math.hypot(q.x-p.x,q.y-p.y)<width/2+7/scale)return true;
  }
  return false;
}
export function pruningPoints(nodes,removed=new Set(),scale=1){
  const points=[];
  for(const node of nodes.filter(n=>n.role==='primary'&&n.growth!==0&&!removed.has(n.id))){
    // Keep each visible marker outside the protected trunk, even on small trees.
    for(let i=0;i<=7;i++){
      const point=pointOn(node,.22+i*.1);
      if(!onTrunk(nodes,point,scale)){points.push({node,point});break;}
    }
  }
  return points;
}
export function pruningTarget(nodes,removed,p,scale=1,current=null,points=pruningPoints(nodes,removed,scale)){
  if(onTrunk(nodes,p,scale))return {protected:true};
  let best=null,distance=30/scale;
  for(const candidate of points){
    if(removed.has(candidate.node.id))continue;
    const d=Math.hypot(candidate.point.x-p.x,candidate.point.y-p.y);
    if(d<distance){distance=d;best=candidate;}
  }
  // A wider release radius avoids flicker at the edge; a closer marker still wins.
  if(!best&&current?.node&&!removed.has(current.node.id)&&points.some(c=>c.node.id===current.node.id)&&Math.hypot(current.point.x-p.x,current.point.y-p.y)<44/scale)return current;
  return best;
}
