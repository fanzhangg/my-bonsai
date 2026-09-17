// Review prototype: discrete, state-dependent growth. No production records.
import {generate} from './morphology.mjs';
import {sample,pointOn} from './core/v1/model.mjs';

export const MODEL_VERSION='adaptive-review-1';
export const STEP=.5;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const copy=value=>structuredClone(value);
export const maturity=(node,hour)=>clamp((hour-node.born)/node.duration,0,1);
const smooth=x=>x*x*(3-2*x);
const random=(s,key,prop)=>sample(s.seed,`${MODEL_VERSION}:${key}`,prop);
const geometry=['x','y','cx1','cy1','cx2','cy2','ex','ey','width','tipWidth'];

export function createGarden(preset='juniper',seed='AFTER-THE-CUT-01'){
  if(!['juniper','broom','literati'].includes(preset))throw new Error('Unsupported review preset');
  const source=generate({preset,seed});
  const nodes=source.nodes.filter(n=>n.role==='trunk'||n.role==='bough'||n.role==='primary').map(n=>({
    ...n,order:n.role==='primary'?1:0,born:-100,duration:12,ordinal:0,isNew:false,
  }));
  const byId=new Map(nodes.map(n=>[n.id,n]));
  const primary=nodes.filter(n=>n.order===1).sort((a,b)=>a.y-b.y||a.id.localeCompare(b.id));
  const count=preset==='literati'?2:3;
  const zones=Array.from({length:count},(_,index)=>({id:`zone-${index}`,name:count===2?['上冠','下冠'][index]:['上层','中层','下层'][index],supports:[],target:0}));
  for(const [i,n] of primary.entries()){
    const zone=zones[Math.min(count-1,Math.floor(i*count/primary.length))];
    n.zoneId=zone.id;
    const parent=byId.get(n.parent);
    let best=0,distance=Infinity;
    for(let j=8;j<=96;j++){const q=pointOn(parent,j/100),d=Math.hypot(q.x-n.x,q.y-n.y);if(d<distance){best=j/100;distance=d;}}
    zone.supports.push({parentId:parent.id,t:best});
    zone.target++;
  }
  for(const zone of zones){
    zone.target=Math.min(preset==='literati'?2:3,Math.max(1,zone.target));
    zone.low=Math.max(1,zone.target-1);
  }
  const state={version:MODEL_VERSION,preset,seed,hour:0,serial:0,cutCount:0,nodes,zones,jobs:[],log:[],
    root:source.root,config:source.config,treePreset:source.preset,maxNodes:180};
  // Only the starting specimen is seeded. All future descendants are decided
  // at their actual birth, from the surviving tree at that instant.
  for(const n of [...state.nodes].filter(n=>n.order===1)){
    for(let i=0;i<2;i++)birth(state,{parent:n,zoneId:n.zoneId},-40,false);
  }
  for(const n of [...state.nodes].filter(n=>n.order===2)){
    for(let i=0;i<2;i++)birth(state,{parent:n,zoneId:n.zoneId},-20,false);
  }
  return state;
}

function tip(node,hour){
  const g=smooth(maturity(node,hour));
  return {x:node.x+(node.ex-node.x)*g,y:node.y+(node.ey-node.y)*g};
}

function candidate(s,scope,ordinal,index){
  const key=`${scope.parent?.id??scope.zone.id}:${ordinal}:${index}`,r=p=>random(s,key,p);
  const order=scope.parent?scope.parent.order+1:1;
  let parent,t;
  if(scope.parent){parent=scope.parent;t=.48+r('attachment')*.43;}
  else{
    const support=scope.zone.supports[Math.floor(r('support')*scope.zone.supports.length)];
    parent=s.nodes.find(n=>n.id===support.parentId);t=clamp(support.t+(r('attachment')-.5)*.3,.1,.96);
  }
  const start=pointOn(parent,t),broad=s.preset==='broom';
  const side=scope.parent?Math.sign(parent.ex-parent.x)||1:(r('side')<.5?-1:1);
  let angle;
  if(order===1)angle=broad?(-Math.PI/2+(r('angle')-.5)*1.9):(side===1?-.12:Math.PI+.12)+(r('angle')-.5)*.65;
  else{
    const direction=Math.atan2(parent.ey-parent.y,parent.ex-parent.x);
    angle=direction+(r('angle')-.5)*1.45-(broad?.12:.18*side);
  }
  const length=(order===1?(s.preset==='literati'?66:92):order===2?43:27)*(.75+r('length')*.45);
  const end={x:start.x+Math.cos(angle)*length,y:start.y+Math.sin(angle)*length};
  let room=80;
  for(const other of s.nodes){
    if(other.id===parent.id||other.order===0)continue;
    const p=tip(other,s.hour);room=Math.min(room,Math.hypot(end.x-p.x,end.y-p.y));
  }
  // Keep the review crown above the vessel and inside its fixed camera.
  const valid=end.x>s.root.x-255&&end.x<s.root.x+255&&end.y>s.root.y-415&&end.y<s.root.y-35;
  const score=Math.min(room,80)*.7+(s.root.y-end.y)*.025+r('jitter')*8;
  return {parent,t,start,end,order,score:valid?score:-1000+score};
}

function birth(s,scope,born,isNew=true){
  if(s.nodes.length>=s.maxNodes)return null;
  const owner=scope.parent??scope.zone,ordinal=owner.ordinal??0;owner.ordinal=ordinal+1;
  const candidates=Array.from({length:18},(_,i)=>candidate(s,scope,ordinal,i)).sort((a,b)=>b.score-a.score);
  const c=candidates[0],{parent,start,order}=c;
  // Bounded fallback keeps recovery possible even in a crowded crown.
  const end={x:clamp(c.end.x,s.root.x-250,s.root.x+250),y:clamp(c.end.y,s.root.y-410,s.root.y-40)};
  const id=`new-${++s.serial}`,dx=end.x-start.x,dy=end.y-start.y;
  const local=parent.width+(parent.tipWidth-parent.width)*c.t;
  const width=Math.max(order===1?2.7:.8,Math.min(order===1?8:3.4,local*(order===1?.48:.62)));
  const node={id,key:id,parent:parent.id,role:order===1?'primary':'twig',order,
    zoneId:scope.zoneId??scope.zone.id,attachment:c.t,ordinal:0,
    x:start.x,y:start.y,ex:end.x,ey:end.y,cx1:start.x+dx*.32,cy1:start.y+dy*.24+3,
    cx2:start.x+dx*.72,cy2:start.y+dy*.8+4,width,tipWidth:Math.max(.3,width*.32),
    born,duration:order===1?12:order===2?8:6,isNew,z:order};
  s.nodes.push(node);
  if(isNew)addLog(s,`${zoneName(s,node.zoneId)}长出${order===1?'新侧枝':order===2?'二级枝':'新梢'}`,born,'birth');
  return node;
}

function zoneName(s,id){return s.zones.find(z=>z.id===id)?.name??'冠区';}
function addLog(s,text,hour,type){s.log.unshift({text,hour,type});s.log=s.log.slice(0,30);}

export function canPrune(node,hour,{fine=false}={}){
  return Boolean(node&&node.order>0&&node.order<=(fine?2:1)&&maturity(node,hour)>=.75);
}
export function pruneGarden(state,id){
  const target=state.nodes.find(n=>n.id===id);
  if(!canPrune(target,state.hour,{fine:true}))return state;
  const s=copy(state),removed=new Set([id]);
  let previous=0;
  while(previous!==removed.size){previous=removed.size;for(const n of s.nodes)if(removed.has(n.parent))removed.add(n.id);}
  s.nodes=s.nodes.filter(n=>!removed.has(n.id));
  s.jobs=s.jobs.filter(j=>!removed.has(j.parentId));s.cutCount++;
  addLog(s,`修剪${zoneName(s,target.zoneId)}${target.order===1?'侧枝':'细枝'}，释放生长空间`,s.hour,'cut');
  schedule(s);return s;
}

function schedule(s){
  for(const zone of s.zones){
    const count=s.nodes.filter(n=>n.order===1&&n.zoneId===zone.id).length;
    const active=s.jobs.some(j=>j.zoneId===zone.id&&!j.parentId);
    if(count<zone.low&&!active)s.jobs.push({zoneId:zone.id,readyAt:s.hour+1,startedAt:s.hour,target:zone.target});
  }
  for(const n of s.nodes){
    if(n.order<1||n.order>=3||maturity(n,s.hour)<1)continue;
    const children=s.nodes.filter(child=>child.parent===n.id).length;
    if(children<2&&!s.jobs.some(j=>j.parentId===n.id))s.jobs.push({zoneId:n.zoneId,parentId:n.id,readyAt:s.hour+2,startedAt:s.hour,target:2});
  }
}

function tick(s){
  schedule(s);
  // Oldest primary deficits win. Each birth sees all earlier births this tick.
  const due=s.jobs.filter(j=>j.readyAt<=s.hour).sort((a,b)=>Number(Boolean(a.parentId))-Number(Boolean(b.parentId))||a.startedAt-b.startedAt||a.zoneId.localeCompare(b.zoneId));
  for(const job of due){
    const parent=job.parentId?s.nodes.find(n=>n.id===job.parentId):null;
    const zone=s.zones.find(z=>z.id===job.zoneId);
    const count=s.nodes.filter(n=>parent?n.parent===parent.id:n.order===1&&n.zoneId===zone.id).length;
    if(job.parentId&&!parent||count>=job.target){s.jobs=s.jobs.filter(j=>j!==job);continue;}
    const born=birth(s,parent?{parent,zoneId:zone.id}:{zone},s.hour);
    if(born){if(count+1>=job.target)s.jobs=s.jobs.filter(j=>j!==job);else job.readyAt=s.hour+2;}
    else job.readyAt=s.hour+2;
  }
}

export function advanceGarden(state,hours){
  if(!Number.isFinite(hours)||hours<0||hours>24*365)throw new Error('Invalid growth interval');
  const s=copy(state),target=Math.round((s.hour+hours)*1e6)/1e6;
  for(let next=(Math.floor(s.hour/STEP)+1)*STEP;next<=target;next+=STEP){s.hour=next;tick(s);}
  s.hour=target;return s;
}

export function zoneStatus(s){
  return s.zones.map(zone=>{
    const branches=s.nodes.filter(n=>n.order===1&&n.zoneId===zone.id);
    const ready=branches.filter(n=>canPrune(n,s.hour)).length;
    const growing=branches.length-ready;
    const job=s.jobs.find(j=>j.zoneId===zone.id&&!j.parentId);
    return {...zone,count:branches.length,ready,growing,waiting:Boolean(job),nextIn:job?Math.max(0,job.readyAt-s.hour):null};
  });
}

export function gardenTree(s){
  const nodes=s.nodes.map(n=>{
    const g=smooth(maturity(n,s.hour)),next={...n,growth:g,born:-100,duration:1};
    for(const [x,y] of [['cx1','cy1'],['cx2','cy2'],['ex','ey']]){next[x]=n.x+(n[x]-n.x)*g;next[y]=n.y+(n[y]-n.y)*g;}
    next.width=n.width*(.2+.8*g);next.tipWidth=n.tipWidth*(.2+.8*g);
    return next;
  });
  const children=new Set(nodes.map(n=>n.parent)),clusters=[];
  for(const n of nodes){
    if(n.order<1)continue;
    const age=s.hour-s.nodes.find(original=>original.id===n.id).born;
    const leafAmount=clamp((age-3)/16,0,1);
    if(!leafAmount)continue;
    const terminal=!children.has(n.id),scale=terminal?1:.45;
    // Leaves of new twigs emerge locally, independent of whole-tree age.
    clusters.push({node:n.id,key:`leaf-${n.id}`,pad:n.zoneId,x:n.ex,y:n.ey-5,
      rx:(s.preset==='literati'?19:25)*scale*Math.sqrt(leafAmount),ry:(s.preset==='broom'?18:12)*scale*Math.sqrt(leafAmount),
      z:n.order,born:-100,duration:1,leafAmount,leafBudget:terminal?1:.35});
  }
  return {nodes,clusters,pads:[],buds:[],crownDesign:true,root:s.root,config:s.config,preset:s.treePreset,
    viewBox:{x:s.root.x-320,y:s.root.y-450,width:640,height:565},hour:100};
}

export function validateGarden(s){
  const ids=new Set(s.nodes.map(n=>n.id));
  return ids.size===s.nodes.length&&s.nodes.length<=s.maxNodes&&s.nodes.every(n=>
    (!n.parent||ids.has(n.parent))&&geometry.every(key=>Number.isFinite(n[key])));
}
