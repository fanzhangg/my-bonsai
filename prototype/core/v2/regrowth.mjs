import {sample,pointOn} from '../v1/model.mjs';
import {branchFamily} from './pruning-model.mjs';

const HOUR=3600000;
const smooth=value=>{const p=Math.max(0,Math.min(1,value));return p*p*(3-2*p);};
const random=(seed,generation,property)=>sample(seed,`regrowth:${generation}`,property);
const shootId=(generation,id)=>`regrow:${generation}:${id}`;

// Replay cuts and births in time order. No wall-clock timers or stored random
// state: refresh, server validation and offline growth reconstruct the same tree.
export function regrowthPlan(nodes,cuts,seed,at){
  const slots=nodes.filter(n=>n.role==='primary').map(n=>({source:n.id,id:n.id,shoot:null}));
  const minimum=Math.min(slots.length,Math.max(2,Math.ceil(slots.length/2)));
  const removed=new Set();let generation=0,nextBirth=null;
  const count=()=>slots.filter(s=>s.id!==null).length;
  function schedule(time){
    if(nextBirth===null&&count()<minimum)nextBirth=time+Math.round((4+random(seed,generation,'wait')*4)*HOUR);
  }
  function advance(time){
    while(nextBirth!==null&&nextBirth<=time){
      const vacant=slots.filter(s=>s.id===null);
      const slot=vacant[Math.floor(random(seed,generation,'slot')*vacant.length)];
      const born=nextBirth;
      slot.id=shootId(generation,slot.source);slot.shoot={id:slot.id,source:slot.source,generation,born};
      generation++;nextBirth=null;schedule(born);
    }
  }
  const events=cuts.filter(c=>Number.isFinite(c.at)&&c.at<=at).map((cut,i)=>({...cut,order:cut.seq??i})).sort((a,b)=>a.at-b.at||a.order-b.order);
  for(const cut of events){
    advance(cut.at);
    const slot=slots.find(s=>s.id===cut.branchId);
    if(!slot)continue;
    if(!slot.shoot)for(const id of branchFamily(nodes,slot.source))removed.add(id);
    slot.id=null;slot.shoot=null;schedule(cut.at);
  }
  advance(at);
  return {removed,shoots:slots.flatMap(s=>s.shoot?[s.shoot]:[])};
}

export function appendRegrowth(tree,{shoots,original,clusters,attachments,mapped,scale,thickness,seed,at}){
  const nodes=[...original.values()];
  for(const shoot of shoots){
    const source=original.get(shoot.source),family=branchFamily(nodes,source.id),grown=new Map(),timing=new Map();
    const age=(at-shoot.born)/HOUR,size=.82+random(seed,shoot.generation,'size')*.16;
    const angle=(random(seed,shoot.generation,'angle')-.5)*.24,cos=Math.cos(angle),sin=Math.sin(angle);
    const vector=(x,y)=>({x:(x*cos-y*sin)*scale*size,y:(x*sin+y*cos)*scale*size});
    function extend(n){
      if(grown.has(n.id))return grown.get(n.id);
      const primary=n.id===source.id,parent=primary?mapped.get(n.parent):extend(original.get(n.parent));
      const born=primary?0:timing.get(n.parent).end,duration=primary?12+random(seed,shoot.generation,'duration')*6:6;
      timing.set(n.id,{born,duration,end:born+duration});
      const growth=Math.min(smooth((age-born)/duration),parent.growth);
      const attachment=primary?Math.max(.08,Math.min(.96,attachments.get(n.id)+(random(seed,shoot.generation,'attachment')-.5)*.12)):attachments.get(n.id);
      const anchor=pointOn(parent,attachment);
      const next={...n,id:shootId(shoot.generation,n.id),parent:parent.id,key:shootId(shoot.generation,n.key??n.id),
        x:anchor.x,y:anchor.y,width:n.width*thickness*size*(.15+.85*growth),tipWidth:n.tipWidth*thickness*size*(.15+.85*growth),
        born:-100,duration:1,growth,regrown:true};
      for(const [x,y]of [['cx1','cy1'],['cx2','cy2'],['ex','ey']]){const d=vector(n[x]-n.x,n[y]-n.y);next[x]=anchor.x+d.x*growth;next[y]=anchor.y+d.y*growth;}
      grown.set(n.id,next);if(growth>0)tree.nodes.push(next);return next;
    }
    for(const n of nodes)if(family.has(n.id))extend(n);
    for(const c of clusters){
      if(!family.has(c.node))continue;
      const n=grown.get(c.node),s=timing.get(c.node),leafAmount=smooth((age-s.born)/(s.duration+12))*n.growth;
      if(!leafAmount)continue;
      const old=original.get(c.node),offset=vector(c.x-old.ex,c.y-old.ey);
      tree.clusters.push({...c,key:shootId(shoot.generation,c.key),node:n.id,x:n.ex+offset.x*n.growth,y:n.ey+offset.y*n.growth,
        rx:c.rx*scale*size*n.growth,ry:c.ry*scale*size*n.growth,born:-100,leafAmount,
        ...(c.crownAge!==undefined?{crownAge:Math.max(0,Math.min(1,(age-timing.get(c.node).end)/96))}:{})});
    }
  }
}
