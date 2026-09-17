// Art-directed 2D bonsai experiment. Geometry and growth are deterministic;
// envelopes are composition preferences, not a plant physiology simulation.
import { sample, pointOn, growth, affectedIds, STEP, MAX_HOUR } from './model.mjs';
export const VERSION = 'bonsai-style-1';
export const STYLES = ['moyogi', 'literati', 'cascade'];
export const DEFAULTS = Object.freeze({seed:'MOSS-0826',style:'moyogi',mode:'adaptive',dominance:.55,light:-25,randomness:.65,movement:1,taper:1,density:.65,guidance:true,maxDepth:12});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,d)=>Number.isFinite(+v)?+v:d;
export function normalizeConfig(input={}) {
  return {...DEFAULTS,seed:String(input.seed??DEFAULTS.seed).slice(0,64),style:STYLES.includes(input.style)?input.style:'moyogi',
    mode:input.mode==='baseline'?'baseline':'adaptive',dominance:clamp(finite(input.dominance,.55),0,1),light:clamp(finite(input.light,-25),-65,65),
    randomness:clamp(finite(input.randomness,.65),0,1),movement:clamp(finite(input.movement,1),.5,1.5),taper:clamp(finite(input.taper,1),.6,1.5),
    density:clamp(finite(input.density,.65),.2,1),guidance:input.guidance!==false};
}
export function makePlan(config) {
  const c=normalizeConfig(config),rnd=(key)=>sample(c.seed,'plan',key);
  const layouts={
    moyogi:{pot:{x:250,y:465,deep:false},radius:19,trunk:[[250,465],[219,414],[274,362],[232,314],[266,271],[253,235],[263,208]],
      branches:[[1,-98,-20,55,22],[2,104,-19,57,22],[3,-90,-23,50,21],[4,67,-18,44,19],[6,-15,-13,39,20]]},
    literati:{pot:{x:250,y:465,deep:false},radius:9,trunk:[[250,465],[217,411],[224,354],[286,306],[303,260],[277,222],[299,181],[281,147]],
      branches:[[5,65,-12,37,17],[6,-68,7,39,17],[7,11,-13,33,18]]},
    cascade:{pot:{x:183,y:240,deep:true},radius:17,trunk:[[183,240],[167,201],[211,179],[254,204],[272,263],[305,307],[307,374],[349,408]],
      branches:[[2,-66,-13,43,19],[4,78,-15,48,19],[5,-48,-12,35,17],[7,58,-12,40,18]]}
  };
  const base=layouts[c.style],origin=base.trunk[0];
  const trunk=base.trunk.map(([x,y],i)=>({x:origin[0]+(x-origin[0])*c.movement+(i?(rnd(`x${i}`)-.5)*16:0),y:y+(i?(rnd(`y${i}`)-.5)*12:0)}));
  const pads=base.branches.map(([at,dx,dy,rx,ry],i)=>{
    const start=trunk[at],scale=.88+rnd(`reach${i}`)*.24;
    return {id:`pad${i}`,at,x:start.x+dx*scale,y:start.y+dy-8,rx:rx*(.9+rnd(`rx${i}`)*.2),ry,side:Math.sign(dx),owner:`b${i}`};
  });
  const gaps=[];
  for(let i=0;i<pads.length-1;i++) {
    const a=pads[i],b=pads[i+1];
    if(Math.abs(a.y-b.y)>45)gaps.push({x:(a.x+b.x)/2,y:(a.y+b.y)/2,rx:35,ry:8});
  }
  const minX=Math.min(...trunk.map(p=>p.x-35),...pads.map(p=>p.x-p.rx-45),base.pot.x-100);
  const maxX=Math.max(...trunk.map(p=>p.x+35),...pads.map(p=>p.x+p.rx+45),base.pot.x+100);
  const minY=Math.min(...trunk.map(p=>p.y-35),...pads.map(p=>p.y-p.ry-40));
  const maxY=Math.max(...pads.map(p=>p.y+p.ry+40),base.pot.y+(base.pot.deep?125:60));
  const width=Math.max(390,maxX-minX),height=maxY-minY;
  return {trunk,pads,gaps,pot:base.pot,radius:base.radius,viewBox:{x:(minX+maxX-width)/2,y:minY,width,height}};
}

export class StyleSimulation {
  constructor(config={},events=[]) {
    this.config=normalizeConfig(config);this.plan=makePlan(this.config);this.events=[...events].sort((a,b)=>a.at-b.at||a.seq-b.seq);
    this.nodes=[];this.scars=[];this.applied=[];this.hour=0;this.eventIndex=0;this.cache=new Map();this.maxNodes=480;
    this.initialize();this.updateWidths(0);this.applyEvents();this.cache.set(0,this.snapshot());
  }
  rand(key,prop){return sample(this.config.seed,key,prop);}
  slot(key,due=4){return {child:null,generation:0,due,expires:due+20,credit:0,regrow:false,key,actor:null};}
  add({id,parent=null,start,end,c1,c2,role='twig',order=2,axisId=id,internode=0,pad=null,born=-40,width=3,tipWidth=1.5,key=id,regrown=false,round=0}) {
    const node={id,key,parent:parent?.id??null,depth:parent?parent.depth+1:0,order,role,axisId,internode,pad,round,born,duration:8+(this.rand(key,'tempo')-.5)*2*this.config.randomness,
      x:start.x,y:start.y,ex:end.x,ey:end.y,cx1:c1.x,cy1:c1.y,cx2:c2.x,cy2:c2.y,length:Math.hypot(end.x-start.x,end.y-start.y),angle:Math.atan2(end.x-start.x,start.y-end.y),
      attach:1,slotIndex:0,alive:true,regrown,width,tipWidth,baseWidth:width,baseTip:tipWidth,slots:[]};
    this.nodes.push(node);return node;
  }
  connect(parent,child,due=4){const index=parent.slots.length;parent.slots.push({...this.slot(`${parent.key}.bud${index}`,due),child:child.id});child.slotIndex=index;}
  initialize(){
    const pts=this.plan.trunk,chain=[];
    const rad=s=>1.8+(this.plan.radius-1.8)*(1-s)**(1.2*this.config.taper);
    for(let i=0;i<pts.length-1;i++){
      const a=pts[i],b=pts[i+1],prev=pts[Math.max(0,i-1)],next=pts[Math.min(pts.length-1,i+2)];
      const n=this.add({id:i===0?'0':`t${i}`,parent:chain.at(-1),start:a,end:b,
        c1:{x:a.x+(b.x-prev.x)/6,y:a.y+(b.y-prev.y)/6},c2:{x:b.x-(next.x-a.x)/6,y:b.y-(next.y-a.y)/6},
        role:'trunk',order:0,axisId:'trunk',internode:i,width:rad(i/(pts.length-1))*2,tipWidth:rad((i+1)/(pts.length-1))*2});
      if(chain.length)this.connect(chain.at(-1),n);chain.push(n);
    }
    for(const pad of this.plan.pads){
      const parent=chain[pad.at-1],a=pointOn(parent,1),b={x:pad.x,y:pad.y+8};
      const mid={x:a.x+(b.x-a.x)*.52,y:a.y+(b.y-a.y)*.45+7};
      let p=parent;
      for(let j=0;j<2;j++){
        const start=j===0?a:mid,end=j===0?mid:b;
        const w=Math.max(3,Math.min(parent.tipWidth*.64,this.config.style==='literati'?5.8:10));
        const n=this.add({id:j===0?pad.owner:`${pad.owner}.s1`,parent:p,start,end,
          c1:{x:start.x+(end.x-start.x)*.35,y:start.y+5},c2:{x:start.x+(end.x-start.x)*.75,y:end.y+5},
          role:'primary',order:1,axisId:pad.owner,internode:j,pad:pad.id,width:j===0?w:w*.62,tipWidth:j===0?w*.62:1.8});
        this.connect(p,n);p=n;
      }
      p.slots=[this.slot(`${p.key}.a`,2+this.rand(p.key,'due')*3),this.slot(`${p.key}.b`,7+this.rand(p.key,'due')*4)];
      // A back bud gives each initial branch foliage at two depths, and a
      // possible replacement leader after pruning its outer section.
      const inner=this.nodes.find(n=>n.id===pad.owner);
      inner.slots.push(this.slot(`${inner.key}.back`,9));
    }
  }
  environment(q,parent,angle){
    let nearest=65,shade=0;const lightAngle=this.config.light*Math.PI/180;
    for(const n of this.nodes){if(!n.alive||n.id===parent.id||n.id===parent.parent||n.role!=='twig')continue;
      const dx=n.ex-q.x,dy=n.ey-q.y;nearest=Math.min(nearest,Math.hypot(dx,dy));
      const ahead=dx*Math.sin(lightAngle)-dy*Math.cos(lightAngle),cross=Math.abs(dx*Math.cos(lightAngle)+dy*Math.sin(lightAngle));
      if(ahead>0&&ahead<70&&cross<15)shade+=(1-cross/15)*.22;
    }
    return {light:clamp(Math.exp(-shade),.15,1),room:clamp(nearest/15,.05,1),upward:(1+Math.cos(angle-lightAngle))/2};
  }
  candidate(parent,index,slot){
    const pad=this.plan.pads.find(p=>p.id===parent.pad);
    const start=pointOn(parent,1),key=slot.key;
    // A trunk cut has no old crown target: its new buds explore locally.
    const envelope=pad??{x:start.x+Math.sin(parent.angle)*26,y:start.y-Math.cos(parent.angle)*26,rx:36,ry:26};
    const target={x:envelope.x+(this.rand(key,'targetX')-.5)*envelope.rx*1.8,y:envelope.y+(this.rand(key,'targetY')-.5)*envelope.ry*1.6};
    const leader=slot.leader||parent.leader;
    const guide=leader?parent.angle+(this.rand(key,'leaderTurn')-.5)*.7:Math.atan2(target.x-start.x,start.y-target.y);
    const jitter=(this.rand(key,'angle')-.5)*.24*this.config.randomness;
    const natural=parent.angle+(index%2===0?-.38:.58)+jitter;
    const base=this.config.guidance?guide:natural;
    const length=(parent.role==='trunk'?25:parent.role==='primary'?24:20*.8**parent.round)*(1+(this.rand(key,'length')-.5)*.2*this.config.randomness);
    let best=null;
    for(const turn of [0,-.3,.3,-.6,.6]){
      const angle=base+turn+jitter,end={x:start.x+Math.sin(angle)*length,y:start.y-Math.cos(angle)*length};
      const env=this.environment(end,parent,angle);let outside=0,gap=0;
      for(const t of [.25,.5,.75,1]){
        const q={x:start.x+(end.x-start.x)*t,y:start.y+(end.y-start.y)*t};
        outside+=Math.max(0,Math.hypot((q.x-envelope.x)/envelope.rx,(q.y-envelope.y)/envelope.ry)-1)/4;
        gap+=this.plan.gaps.some(g=>((q.x-g.x)/g.rx)**2+((q.y-g.y)/g.ry)**2<1)?.25:0;
      }
      const guideScore=Math.cos(angle-guide);
      const score=(this.config.guidance?guideScore*.65-outside*2-gap*.7:0)+env.light*.25+env.room*.45+env.upward*.08-Math.abs(turn)*.06;
      if(!best||score>best.score)best={...env,score,angle,length,end,outside,gap};
    }
    return best;
  }
  tick(hour){
    const candidates=[];const living=this.nodes.filter(n=>n.alive);
    for(const n of living){
      for(let i=0;i<n.slots.length;i++){
        const s=n.slots[i];if(s.child||hour<s.due||hour>s.expires)continue;
        const c=this.candidate(n,i,s),apical=i>0&&n.slots[0]?.child?1-this.config.dominance*.65:1;
        const weight=(.2+.8*c.light)*(.15+.85*c.room)*apical;
        s.credit+=STEP*weight*.3; s.diagnostics={...c,apical,weight};
        const threshold=1.1+(1-this.config.density)*1.5;
        if(s.credit>=threshold&&(this.config.mode==='baseline'||!this.config.guidance||c.outside<.9))candidates.push({n,i,s,c,weight});
      }
    }
    candidates.sort((a,b)=>b.weight-a.weight||(a.s.key<b.s.key?-1:1));
    for(const {n,i,s,c} of candidates.slice(0,Math.min(3,this.maxNodes-living.length))){
      const id=`${n.id}.${i}g${s.generation}`,start=pointOn(n,1),end=c.end;
      const bend=(this.rand(s.key,'bend')-.5)*c.length*.3;
      const round=n.role==='twig'?n.round+1:0;
      const continuing=i===0&&n.role==='twig';
      const child=this.add({id,key:s.key,parent:n,start,end,
        c1:{x:start.x+(end.x-start.x)*.33+Math.cos(c.angle)*bend,y:start.y+(end.y-start.y)*.33+Math.sin(c.angle)*bend},
        c2:{x:start.x+(end.x-start.x)*.72,y:start.y+(end.y-start.y)*.72},
        order:n.role==='trunk'?1:continuing?n.order:n.order+1,axisId:continuing?n.axisId:id,internode:continuing?n.internode+1:0,
        pad:n.pad,born:hour,width:Math.max(1.1,2.8-round*.45),tipWidth:Math.max(.6,1.45-round*.2),regrown:s.regrow,round});
      child.slotIndex=i;child.leader=s.leader===true||(n.leader&&i===0);s.child=id;
      if(child.leader){child.axisId=n.axisId;child.order=n.order;}
      if(round<3)child.slots=[this.slot(`${child.key}.a`,hour+7),this.slot(`${child.key}.b`,hour+11)];
    }
    this.updateWidths(hour);
  }
  updateWidths(hour){
    const mass=new Map(),byId=new Map(this.nodes.filter(n=>n.alive).map(n=>[n.id,n]));
    for(let i=this.nodes.length-1;i>=0;i--){
      const n=this.nodes[i];if(!n.alive)continue;
      const m=(mass.get(n.id)||0)+growth(n,hour);mass.set(n.id,m);
      if(n.parent)mass.set(n.parent,(mass.get(n.parent)||0)+m);
      const demand=n.role==='trunk'?Math.sqrt(m)*1.1:Math.sqrt(m)*.85;
      n.width=Math.max(n.width,n.baseWidth,demand);n.tipWidth=Math.max(n.tipWidth,n.baseTip,n.width*(n.role==='twig'?.5:.55));
      const parent=byId.get(n.parent);
      if(parent){const needed=n.width*(parent.axisId===n.axisId?1:1.15);parent.tipWidth=Math.max(parent.tipWidth,needed);parent.width=Math.max(parent.width,parent.tipWidth);}
    }
  }
  cut(event){
    const node=this.nodes.find(n=>n.id===event.branch&&n.alive);if(!node||!node.parent)throw new Error(`无效剪枝：${event.branch}`);
    const parent=this.nodes.find(n=>n.id===node.parent&&n.alive),ids=affectedIds({nodes:this.nodes.filter(n=>n.alive)},node.id);
    for(const n of this.nodes)if(ids.has(n.id))n.alive=false;
    const slot=parent.slots[node.slotIndex];slot.child=null;slot.generation++;slot.key=`${node.key}.regrowth`;slot.credit=0;slot.regrow=true;
    const delay=4+this.rand(slot.key,'delay')*2;slot.due=event.at+delay;slot.expires=slot.due+22;
    slot.leader=node.axisId===parent.axisId;
    if(slot.leader){
      // Prefer an already living lateral shoot as the new leader. Its old
      // geometry stays fixed; only later tip extensions inherit this role.
      const replacements=this.nodes.filter(n=>n.alive&&n.parent===parent.id);
      replacements.sort((a,b)=>b.width-a.width||(a.key<b.key?-1:1));
      if(replacements.length){
        let promoted=replacements[0];
        while(promoted){
          promoted.leader=true;
          promoted=this.nodes.find(n=>n.alive&&n.parent===promoted.id&&n.axisId===promoted.axisId);
        }
        slot.leader=false;
      }
    }
    for(const n of this.nodes){if(!n.alive||Math.hypot(n.ex-node.x,n.ey-node.y)>65)continue;
      for(const s of n.slots)if(!s.child&&s!==slot){s.credit=0;s.due=event.at+4;s.expires=s.due+22;s.regrow=true;}
    }
    this.scars.push({parent:parent.id,x:node.x,y:node.y,at:event.at,budAt:slot.due});this.applied.push({...event,removed:ids.size,budAt:slot.due});
  }
  applyEvents(){while(this.eventIndex<this.events.length&&this.events[this.eventIndex].at<=this.hour)this.cut(this.events[this.eventIndex++]);}
  snapshot(){
    const nodes=this.nodes.filter(n=>n.alive).map(n=>({...n,slots:n.slots.map(s=>({...s,diagnostics:s.diagnostics?{light:s.diagnostics.light,room:s.diagnostics.room,weight:s.diagnostics.weight}:null}))}));
    return {hour:this.hour,nodes,scars:this.scars.map(s=>({...s})),applied:this.applied.map(e=>({...e})),tips:nodes.filter(n=>!n.slots.some(s=>s.child)).length,dormant:nodes.reduce((a,n)=>a+n.slots.filter(s=>!s.child&&this.hour>s.expires).length,0)};
  }
  at(hour){
    const t=Math.round(clamp(hour,0,MAX_HOUR)/STEP)*STEP;
    while(this.hour<t){this.hour=+(this.hour+STEP).toFixed(2);this.tick(this.hour);this.applyEvents();this.cache.set(this.hour,this.snapshot());}
    return this.cache.get(t);
  }
}
