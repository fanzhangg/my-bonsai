import {pointOn} from './core/v1/model.mjs';
export const CUT_MODEL='state-8';
export const CUT_MODELS=['state-1','state-2','state-3','state-4','state-5','state-6','state-7',CUT_MODEL];

// v3 explicitly annotates structural levels; old trees retain primary-only cuts.
export function canPrune(node){
  if(!node||node.role==='trunk'||node.role==='bough')return false;
  return node.pruningLevel!==undefined?[1,2].includes(node.pruningLevel)&&node.growth>=.55:node.role==='primary'&&node.growth!==0;
}

export function branchFamily(nodes,id){
  const root=nodes.find(n=>n.id===id);
  if(!root||root.role==='trunk')return new Set();
  const ids=new Set([id]);
  let changed=true;
  while(changed){changed=false;for(const n of nodes)if(n.role!=='trunk'&&ids.has(n.parent)&&!ids.has(n.id)){ids.add(n.id);changed=true;}}
  return ids;
}
function trunkGuard(nodes,scale){
  const samples=nodes.filter(n=>n.role==='trunk').flatMap(n=>Array.from({length:41},(_,i)=>({
    ...pointOn(n,i/40),radius:(n.width+(n.tipWidth-n.width)*i/40)/2+7/scale
  })));
  return p=>samples.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<q.radius);
}
export function pruningPoints(nodes,removed=new Set(),scale=1){
  const points=[],onTrunk=trunkGuard(nodes,scale);
  const available=p=>!onTrunk(p)&&points.every(c=>Math.hypot(c.point.x-p.x,c.point.y-p.y)>=22/scale);
  for(const node of nodes.filter(n=>canPrune(n)&&!removed.has(n.id))){
    let point;
    // Prefer a point on the branch, separated from neighbouring targets.
    for(let i=0;i<=7;i++){
      const candidate=pointOn(node,.22+i*.1);
      if(available(candidate)){point=candidate;break;}
    }
    if(point){points.push({node,point});continue;}
    // Occlusion is not a pruning rule. Give even a completely hidden branch
    // its own reachable callout, linked to its real geometry without moving it.
    const anchor=pointOn(node,.62),angle=Math.atan2(node.ey-node.y,node.ex-node.x);
    for(let radius=18/scale;!point;radius+=12/scale){
      for(let i=0;i<24;i++){
        const a=angle+i*Math.PI/12,candidate={x:anchor.x+Math.cos(a)*radius,y:anchor.y+Math.sin(a)*radius};
        if(available(candidate)){point=candidate;break;}
      }
    }
    points.push({node,point,anchor});
  }
  return points;
}
export function pruningTarget(nodes,removed,p,scale=1,current=null,points=pruningPoints(nodes,removed,scale)){
  if(trunkGuard(nodes,scale)(p))return {protected:true};
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
