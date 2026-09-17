import {pointOn} from './core/v1/model.mjs';

export function branchFamily(nodes,id){
  const root=nodes.find(n=>n.id===id);
  if(!root||root.role==='trunk')return new Set();
  const ids=new Set([id]);
  let changed=true;
  while(changed){changed=false;for(const n of nodes)if(n.role!=='trunk'&&ids.has(n.parent)&&!ids.has(n.id)){ids.add(n.id);changed=true;}}
  return ids;
}
export function pruningTarget(nodes,removed,p,scale=1){
  // Protect the whole trunk silhouette, including junctions, before testing branches.
  for(const n of nodes.filter(n=>n.role==='trunk'))for(let i=0;i<=40;i++){
    const q=pointOn(n,i/40),width=n.width+(n.tipWidth-n.width)*i/40;
    if(Math.hypot(q.x-p.x,q.y-p.y)<width/2+7/scale)return {protected:true};
  }
  let best=null,distance=24/scale;
  for(const n of nodes.filter(n=>n.role==='primary'&&!removed.has(n.id))){
    for(let i=6;i<=38;i++){
      const q=pointOn(n,i/40),d=Math.hypot(q.x-p.x,q.y-p.y);
      if(d<distance){distance=d;best={node:n,point:pointOn(n,.22)};}
    }
  }
  return best;
}
