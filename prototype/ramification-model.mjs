import {pointOn, sample} from './core/v1/model.mjs';

// Review-only architecture. Orders describe branching, never SVG draw order.
function branch(id,parent,order,start,end,width,attach=1){
  const dx=end.x-start.x,dy=end.y-start.y;
  return {id,parent,order,attach,x:start.x,y:start.y,ex:end.x,ey:end.y,
    cx1:start.x+dx*.25,cy1:start.y+dy*.06,cx2:start.x+dx*.75,cy2:start.y+dy*.92,
    width,tipWidth:width*.38,leaves:order===3,scar:false,pending:false};
}
export function createRamification(species='elm',seed='RAMIFY-01'){
  const trunk=branch('T',null,0,{x:360,y:485},{x:367,y:104},34);
  Object.assign(trunk,{cx1:306,cy1:358,cx2:401,cy2:259,tipWidth:3});
  const tree={species,seed,nodes:[trunk],flush:0,serial:0};
  const rand=(id,p)=>sample(seed,id,p);
  for(let i=0;i<7;i++){
    const side=i%2?-1:1,attach=.27+i*.102,start=pointOn(trunk,attach);
    const span=(163-i*15)*(1+rand(String(i),'span')*.16);
    const end={x:start.x+side*span,y:start.y-24-i*3};
    const p=branch(`B${i+1}`,'T',1,start,end,11-i*.95,attach);tree.nodes.push(p);
    for(let j=0;j<3;j++){
      const a=.36+j*.27,s=pointOn(p,a),length=span*(.34+rand(p.id+j,'length')*.12);
      const e={x:s.x+side*length*(j===1?.42:.85),y:s.y-(j===1?65:36)*(species==='juniper'?.68:1)};
      const q=branch(`${p.id}.${j+1}`,p.id,2,s,e,p.width*.48,a);tree.nodes.push(q);
      for(let k=0;k<2;k++){
        const t=.52+k*.43,u=pointOn(q,t),v={x:u.x+(k?side:-side)*(18+rand(q.id+k,'twig')*14),y:u.y-23-rand(q.id+k,'up')*17};
        tree.nodes.push(branch(`${q.id}.${k+1}`,q.id,3,u,v,q.width*.45,t));
      }
    }
  }
  return tree;
}
export function family(tree,id){
  const ids=new Set([id]);let changed=true;
  while(changed){changed=false;for(const n of tree.nodes)if(ids.has(n.parent)&&!ids.has(n.id)){ids.add(n.id);changed=true;}}
  return ids;
}
export function cutPlan(tree,id,mode='remove'){
  const node=tree.nodes.find(n=>n.id===id);
  if(!node?.order)return null;
  const t=mode==='shorten'?.62:0,removed=new Set();
  if(!t)for(const key of family(tree,id))removed.add(key);
  else for(const child of tree.nodes.filter(n=>n.parent===id&&n.attach>t))for(const key of family(tree,child.id))removed.add(key);
  const leaves=tree.nodes.filter(n=>n.leaves&&(removed.has(n.id)||(t&&n.id===id))).length;
  return {id,t,removed,leaves,point:pointOn(node,t)};
}
// de Casteljau subdivision keeps proximal wood and its children in place.
function shorten(n,t){
  const mix=(a,b)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  const a=mix(n,{x:n.cx1,y:n.cy1}),b=mix({x:n.cx1,y:n.cy1},{x:n.cx2,y:n.cy2}),c=mix({x:n.cx2,y:n.cy2},{x:n.ex,y:n.ey});
  const d=mix(a,b),e=mix(b,c),p=mix(d,e);
  return {...n,cx1:a.x,cy1:a.y,cx2:d.x,cy2:d.y,ex:p.x,ey:p.y,tipWidth:n.width+(n.tipWidth-n.width)*t,leaves:false,scar:true,pending:true};
}
export function pruneRamification(tree,id,mode='remove'){
  const plan=cutPlan(tree,id,mode);if(!plan)return tree;
  const next=structuredClone(tree);
  next.nodes=next.nodes.filter(n=>!plan.removed.has(n.id)).map(n=>n.id===id?shorten(n,plan.t):n.parent===id?{...n,attach:n.attach/plan.t}:n);
  return next;
}
export function flushRamification(tree){
  const next=structuredClone(tree);next.flush++;
  for(const n of [...next.nodes]){
    if(!n.pending)continue;n.pending=false;
    const hasLeaves=next.nodes.some(q=>q.leaves&&family(next,n.id).has(q.id));
    // Conservative juniper rule: do not promise buds on a bare branch.
    if(next.species==='juniper'&&!hasLeaves)continue;
    for(let k=0;k<2;k++){
      const attach=.76+k*.17,start=pointOn(n,attach),side=k?1:-1;
      const end={x:start.x+side*18,y:start.y-28};
      const shoot=branch(`N${++next.serial}`,n.id,n.order+1,start,end,Math.min(2,n.tipWidth*.6),attach);
      Object.assign(shoot,{leaves:true,fresh:true});next.nodes.push(shoot);
    }
  }
  return next;
}
