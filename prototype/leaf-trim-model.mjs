// Shared by preview, persistence validation and every v3 renderer.
import {sample} from './core/v1/model.mjs';
import {canopyPoint} from './core/v2/morphology.mjs';
import {normalizeAppearance} from './core/v1/appearance.mjs';
import {leafDistance} from './leaf-geometry.mjs';
import {outerLeaves,outerLeafEdges} from './leaf-edge.mjs';
import {STYLIZED_LEAVES} from './core/v3/stylized-foliage.mjs';

export const TRIM_MODEL='leaf-1',TRIM_RECOVERY_HOURS=48,TRIM_POINTS=192,TRIM_BATCH_LIMIT=512;
export const LEAF_GROWTH_SETTLE_HOURS=168,LEAF_DETAIL_SIZE=.75,LEAF_DETAIL_DENSITY=1.6;
// More small leaves and a little more growing room, without moving any wood.
export const foliageVolume=c=>c.starterLeaves?c:{...c,rx:c.rx*1.12,ry:c.ry*1.12};
const HOUR=3600000,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const polygonArea=pts=>Math.abs(pts.reduce((sum,p,i)=>{const q=pts[(i+1)%pts.length];return sum+p.x*q.y-q.x*p.y;},0))/2;
export function inside(p,pts){let yes=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;}
export const polygonPath=pts=>'M'+pts.map(p=>`${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' L')+'Z';
// Closed quadratic splines share tangents at every join, including the seam.
export function smoothLeafPath(points){
 if(!points.length)return '';
 const pts=points.filter((_,i)=>i%2===0),mid=(a,b)=>`${((a.x+b.x)/2).toFixed(3)} ${((a.y+b.y)/2).toFixed(3)}`;
 return `M${mid(pts.at(-1),pts[0])} `+pts.map((p,i)=>`Q${p.x.toFixed(3)} ${p.y.toFixed(3)} ${mid(p,pts[(i+1)%pts.length])}`).join(' ')+'Z';
}

// Sample the renderer's original quadratic outline without changing its seed.
export function referenceRim(tree,c,{expanded=true}={}){
 const volume=expanded?foliageVolume(c):c,controls=Array.from({length:24},(_,i)=>canopyPoint(volume,i*Math.PI/12,.94+sample(tree.config.seed,`${tree.preset.id}:render:${c.key}:${i}`,'edge')*.1));
 return controls.flatMap((p,i)=>{const a=controls[(i+23)%24],b=controls[(i+1)%24],start={x:(a.x+p.x)/2,y:(a.y+p.y)/2},end={x:(b.x+p.x)/2,y:(b.y+p.y)/2};
  return Array.from({length:8},(_,j)=>{const t=j/8,u=1-t;return {x:u*u*start.x+2*u*t*p.x+t*t*end.x,y:u*u*start.y+2*u*t*p.y+t*t*end.y};});
 });
}
export function trimClock(record,at){
 return (at-(record.createdAt??0))/HOUR+(record.waterings??[]).filter(w=>w.at<=at).reduce((sum,w)=>sum+(w.recoveryHours??0),0);
}
export function trimGroups(tree){
 const groups=new Map(),nodes=new Map(tree.nodes.map(n=>[n.id,n]));
 for(const c of tree.clusters){
  if((c.leafAmount??1)<.7||Math.min(c.rx,c.ry)<5)continue;
  let support=nodes.get(c.node);
  while(support&&support.pruningLevel>2&&nodes.has(support.parent))support=nodes.get(support.parent);
  const id=`crown:${support?.id??c.node}`;
  if(!groups.has(id))groups.set(id,{id,clusters:[],z:c.z??0});
  const g=groups.get(id);g.clusters.push(c);g.z=Math.max(g.z,c.z??0);
 }
 return [...groups.values()].map(g=>{
  const rims=g.clusters.map(c=>referenceRim(tree,c,{expanded:false})),pts=rims.flat();
  const left=Math.min(...pts.map(p=>p.x)),right=Math.max(...pts.map(p=>p.x)),top=Math.min(...pts.map(p=>p.y)),bottom=Math.max(...pts.map(p=>p.y));
  return {...g,x:left,y:top,width:right-left,height:bottom-top,d:Math.min(right-left,bottom-top),areaFloor:Math.max(...rims.map(polygonArea))};
 });
}
export function trimState(tree,record,at){
 const groups=trimGroups(tree),byCluster=new Map(),clock=trimClock(record,at);
 for(const g of groups)for(const c of g.clusters){const rim=referenceRim(tree,c,{expanded:false});byCluster.set(c.key,{c,g,rim,points:rim.map(p=>({...p})),depths:Array(TRIM_POINTS).fill(0)});}
 const events=(record.leafTrims??[]).filter(e=>e.at<=at&&e.model===TRIM_MODEL);
 for(const e of events){
  const s=byCluster.get(e.clusterKey);if(!s||s.g.id!==e.crownId||!Number.isInteger(e.index)||e.index<0||e.index>=TRIM_POINTS)continue;
  const weight=clamp(1-(clock-trimClock(record,e.at))/TRIM_RECOVERY_HOURS,0,1);
  if(weight===0)continue;
  addDepth(s,e.index,e.depth*weight);
 }
 for(const s of byCluster.values())updatePoints(s);
 return {groups,byCluster};
}
function addDepth(s,index,depth){
 const center=s.rim[index],halfWidth=s.g.d*.06;
 for(let i=0;i<TRIM_POINTS;i++){
  const p=s.rim[i],distance=Math.hypot(p.x-center.x,p.y-center.y);
  if(distance>=halfWidth)continue;
  const radius=Math.hypot(p.x-s.c.x,p.y-s.c.y);
  const bump=(1+Math.cos(Math.PI*distance/halfWidth))/2;
  s.depths[i]=Math.min(s.g.d*.05,radius*.12,s.depths[i]+depth*s.g.d*bump);
 }
}
function updatePoints(s){s.points=s.rim.map((p,i)=>{const r=Math.hypot(p.x-s.c.x,p.y-s.c.y)||1,f=1-s.depths[i]/r;return {x:s.c.x+(p.x-s.c.x)*f,y:s.c.y+(p.y-s.c.y)*f};});}
export function visibleTrimPoint(state,key,index){
 const s=state.byCluster.get(key);if(!s)return false;
 const p=s.points[index];
 // The selected crown is lifted in front of other crowns in the editor.
 // Its own overlapping leaf volumes still protect internal seams.
 for(const other of state.byCluster.values()){
  if(other===s)continue;
  if(other.g.id===s.g.id&&inside(p,other.points))return false;
 }
 return true;
}
export function proposeTrim(tree,record,at,{crownId,clusterKey,index},state=trimState(tree,record,at)){
 const s=state.byCluster.get(clusterKey);
 if(!s||s.g.id!==crownId||!Number.isInteger(index)||index<0||index>=TRIM_POINTS||!visibleTrimPoint(state,clusterKey,index))return null;
 const support=tree.nodes.find(n=>n.id===s.c.node),anchor=support?{x:support.ex,y:support.ey}:null;
 const siblings=[...state.byCluster.values()].filter(t=>t.g.id===crownId);
 const removed=siblings.reduce((sum,t)=>sum+polygonArea(t.rim)-polygonArea(t.points),0);
 // Sum of removed cluster areas is an upper bound on removed union area;
 // the largest cluster is a lower bound on the original union area.
 for(const depth of [.015,.01,.005,.0025]){
  const next={...s,depths:[...s.depths]};addDepth(next,index,depth);updatePoints(next);
  const delta=polygonArea(s.points)-polygonArea(next.points);
  if(delta<s.g.areaFloor*.000005||delta>s.g.areaFloor*.006||removed+delta>s.g.areaFloor*.08)continue;
  if(anchor&&inside(anchor,s.rim)&&!inside(anchor,next.points))continue;
  // Keep every existing overlap connection in the crown, even a narrow neck.
  const connected=siblings.every(t=>t===s||!overlap(s.points,t.points)||overlap(next.points,t.points));
  if(!connected)continue;
  return {model:TRIM_MODEL,crownId,clusterKey,index,depth,points:next.points,before:s.points,point:s.points[index],removed:delta};
 }
 return null;
}
function overlap(a,b){return a.some(p=>inside(p,b))||b.some(p=>inside(p,a));}
export function applyLeafTrims(tree,record,at){
 if(!(record.leafTrims??[]).some(e=>e.at<=at&&(e.model===SNIP_MODEL||trimClock(record,at)-trimClock(record,e.at)<TRIM_RECOVERY_HOURS)))return tree;
 const state=trimState(tree,record,at);
 for(const c of tree.clusters){const s=state.byCluster.get(c.key);if(s?.depths.some(d=>d>1e-8))c.leafTrim={points:s.points,reference:s.rim,depths:s.depths};}
 applyLeafErasing(tree,record,at);
 applyLeafSnips(tree,record,at);
 return tree;
}

export const SNIP_MODEL='leaf-3',SNIP_TARGET_LIMIT=4096;
// These are the actual visible leaves: one broad leaf or one three-needle tuft.
export function leafSites(tree,c,{original=false}={}){
 const {config,preset}=tree,appearance=normalizeAppearance(config.appearance);
 const shape=Object.hasOwn(STYLIZED_LEAVES,config.appearance?.shape)?config.appearance.shape:appearance.shape==='auto'?(preset.kind==='broad'?'oval':preset.kind):appearance.shape;
 const decorative=Object.hasOwn(STYLIZED_LEAVES,shape);
 const broad=shape!=='scale'&&shape!=='needle',needle=shape==='needle';
 const density=clamp(config.coverage*(c.foliageDensity??1),.3,1),count=c.starterLeaves??Math.ceil(Math.round((decorative?19:broad?37:needle?40:48)*density*(c.leafBudget??1)*LEAF_DETAIL_DENSITY)*(c.leafAmount??1));
 const rand=(k,p)=>sample(config.seed,`${preset.id}:render:${k}`,p);
 return Array.from({length:count},(_,index)=>{
  const k=`${c.key}:${index}`,p=c.starterLeaves?{x:c.x+(index===0?-3:3),y:c.y-2}:canopyPoint(foliageVolume(c),rand(k,'a')*Math.PI*2,Math.sqrt(rand(k,'r')));
  const size=(broad?5.2:needle?6:4.7)*config.leafScale*(c.detailScale??1)*(.78+rand(k,'size')*.4)*LEAF_DETAIL_SIZE*(decorative?2.05:1);
  const sprout=c.leafSprouts?.[index],raw={x:p.x+(sprout?.dx??0)*size,y:p.y+(sprout?.dy??0)*size};
  const renderScale=.4+.6*clamp(((tree.hour??Infinity)-(c.born??0))/(c.duration??20),0,1);
  const leaf={originalX:raw.x,originalY:raw.y,index,size:size*renderScale,angle:(rand(k,'angle')-.5)*(broad?130:65)+(sprout?.angle??0),shape,renderScale,lean:preset.lean??0};
  return {...leaf,...(original?raw:presentLeaf(raw,c,leaf))};
 });
}
function presentLeaf(raw,c,leaf){
 const p=shapeLeafPoint(raw,c.leafShape),scale=leaf.renderScale??1;
 const x=c.x===undefined?p.x:c.x+(p.x-c.x)*scale,y=c.y===undefined?p.y:c.y+(p.y-c.y)*scale;
 return {x,y,tilt:(p.x-(c.x??p.x))/(c.rx??1)*.65+(leaf.lean??0)};
}
export function validSnipOperation(op){
 return op?.model===SNIP_MODEL&&typeof op.crownId==='string'&&op.crownId.length<=256&&Array.isArray(op.targets)&&op.targets.length>0&&op.targets.length<=SNIP_TARGET_LIMIT&&op.targets.every(t=>typeof t.clusterKey==='string'&&t.clusterKey.length<=256&&Number.isInteger(t.index)&&t.index>=0&&t.index<1024)&&new Set(op.targets.map(t=>t.clusterKey+':'+t.index)).size===op.targets.length;
}
export function proposeSnip(tree,op){
 if(!validSnipOperation(op))return null;
 const group=leafLayers(tree).find(g=>g.id===op.crownId);if(!group)return null;
 const counts=new Map(group.clusters.map(c=>[c.key,leafSites(tree,c).length]));
 if(op.targets.some(t=>t.index>=(counts.get(t.clusterKey)??0)))return null;
 const catalog=new Map(group.clusters.map(c=>[c.key,leafSites(tree,c,{original:true})]));
 const frame=shapeOrigin(group);
 return {model:SNIP_MODEL,crownId:op.crownId,targets:op.targets.map(({clusterKey,index})=>({clusterKey,index})),shapeFrame:{dx:(frame.x-group.x)/group.rx,dy:(frame.y-group.y)/group.ry},shapeProfile:cutProfile(group,op.targets.map(t=>catalog.get(t.clusterKey)[t.index]),frame)};
}
export function applyLeafSnips(tree,record,at){
 const clusters=new Map([...tree.clusters,...(tree.buds??[])].map(c=>[c.key,c])),clock=trimClock(record,at);
 const groups=new Map(leafLayers(tree).map(g=>[g.id,g])),catalog=new Map();
 for(const e of record.leafTrims??[]){
  if(e.model!==SNIP_MODEL||e.at>at)continue;
  const age=clock-trimClock(record,e.at);
  const group=groups.get(e.crownId);
  if(group){
   const frame={x:group.x+(e.shapeFrame?.dx??0)*group.rx,y:group.y+(e.shapeFrame?.dy??0)*group.ry,rx:group.rx,ry:group.ry};
   const profile=e.shapeProfile??cutProfile(group,e.targets.flatMap(t=>{const c=clusters.get(t.clusterKey);if(!c)return [];if(!catalog.has(c.key))catalog.set(c.key,leafSites(tree,c,{original:true}));return catalog.get(c.key)[t.index]??[];}),frame);
   addShapeProfile(group,grownShapeProfile(profile,record.config.seed,e.crownId,age),frame);
  }
  // Stagger buds and give each new leaf a small, repeatable change in position
  // and angle. Reloads and time rebases must not reshuffle the crown.
  for(const t of e.targets){
   const c=clusters.get(t.clusterKey);if(!c)continue;
   const key=`${t.clusterKey}:${t.index}:${trimClock(record,e.at)}`,rand=p=>sample(record.config.seed,key,p);
   const rest=6+rand('bud-rest')*8,u=clamp((age-rest)/(TRIM_RECOVERY_HOURS-rest),0,1),growth=u*u*(3-2*u);
   if(age<TRIM_RECOVERY_HOURS){c.leafSnips??={};c.leafSnips[t.index]=Math.min(c.leafSnips[t.index]??1,growth);}
   c.leafSprouts??={};c.leafSprouts[t.index]={dx:(rand('bud-x')-.5)*.55*growth,dy:(rand('bud-y')-.5)*.4*growth,angle:(rand('bud-angle')-.5)*18*growth};
  }
 }
}
// Retain the trained shape. Growth is local and softly uneven, never a reset
// to the original crown or a uniform multiplication of its silhouette.
export function grownShapeProfile(profile,seed,crownId,age){
 const t=Math.max(0,age-6),u=1-Math.exp(-t/LEAF_GROWTH_SETTLE_HOURS);
 const phases=[2,3,5].map(n=>sample(seed,crownId,`leaf-growth-${n}`)*Math.PI*2);
 return profile.map((d,i)=>{
  const a=i/profile.length*Math.PI*2;
  const bias=(Math.sin(a*2+phases[0])+.55*Math.sin(a*3+phases[1])+.3*Math.sin(a*5+phases[2]))/1.85;
  const seasonal=.008*Math.sin(t/96+phases[1])*Math.sin(a*3+phases[2])*u;
  return d*(1-u*(.085+.025*bias+seasonal));
 });
}
export function snippedRim(tree,c,sites=leafSites(tree,c)){
 const rim=c.leafTrim?.points??referenceRim(tree,c),alive=sites.filter(s=>(c.leafSnips?.[s.index]??1)>0);
 if(!alive.length)return [];
 if(c.leafShape)return rim.map(p=>shapeLeafPoint(p,c.leafShape));
 const nearest=(p,list,trimmed)=>Math.min(...list.map(s=>Math.hypot(p.x-s.x,p.y-s.y)-s.size*(trimmed?(c.leafSnips?.[s.index]??1):1)));
 return rim.map(p=>{const r=Math.hypot(p.x-c.x,p.y-c.y)||1,loss=Math.max(0,nearest(p,alive,true)-nearest(p,sites,false)),f=Math.max(0,1-loss/r);return {x:c.x+(p.x-c.x)*f,y:c.y+(p.y-c.y)*f};});
}
const SHAPE_SAMPLES=192;
function shapeOrigin(group){return group.clusters.find(c=>c.leafShape)?.leafShape??{x:group.sculptX??group.x,y:group.sculptY??group.y,rx:group.rx,ry:group.ry};}
function cutProfile(group,leaves,frame=shapeOrigin(group)){
 const profile=Array(SHAPE_SAMPLES).fill(0);
 for(const leaf of leaves){
  const dx=((leaf.originalX??leaf.x)-frame.x)/frame.rx,dy=((leaf.originalY??leaf.y)-frame.y)/frame.ry,angle=Math.atan2(dy,dx);
  // Affect only the local lobe: adjacent shoulders stay put so a freehand
  // notch can leave two ears or the two lobes of a heart on either side.
  const strength=.018+.006*clamp(Math.hypot(dx,dy),0,1),spread=.28;
  for(let i=0;i<SHAPE_SAMPLES;i++){const a=Math.abs(Math.atan2(Math.sin(i*2*Math.PI/SHAPE_SAMPLES-angle),Math.cos(i*2*Math.PI/SHAPE_SAMPLES-angle)));if(a<spread)profile[i]+=strength*((1+Math.cos(Math.PI*a/spread))/2)**2;}
 }
 return profile;
}
function addShapeProfile(group,profile,frame=shapeOrigin(group)){
 const old=group.clusters.find(c=>c.leafShape)?.leafShape?.depths;
 const count=Math.max(old?.length??0,profile.length);
 const depths=old?Array.from({length:count},(_,i)=>profileDepth(old,i/count)+profileDepth(profile,i/count)):[...profile];
 const shape={x:frame.x,y:frame.y,rx:frame.rx,ry:frame.ry,depths};
 for(const c of group.clusters)c.leafShape=shape;
 return shape;
}
// Sample at the stored resolution, including previously saved 48-point shapes.
function profileDepth(depths,turn){
 const n=depths.length,u=((turn%1+1)%1)*n,i=Math.floor(u),t=u-i;
 const d=offset=>depths[(i+offset+n)%n];
 return .5*((2*d(0))+(-d(-1)+d(1))*t+(2*d(-1)-5*d(0)+4*d(1)-d(2))*t*t+(-d(-1)+3*d(0)-3*d(1)+d(2))*t*t*t);
}
export function shapeLeafPoint(p,shape){
 if(!shape)return {...p};
 const angle=Math.atan2((p.y-shape.y)/shape.ry,(p.x-shape.x)/shape.rx);
 const depth=Math.max(0,profileDepth(shape.depths,angle/(2*Math.PI)));
 const scale=Math.exp(-Math.min(depth,4));
 return {...p,x:shape.x+(p.x-shape.x)*scale,y:shape.y+(p.y-shape.y)*scale};
}
// Each closure catches a small surface tuft. A pass does not tunnel through
// every overlapping crown volume; another pass can reach what was underneath.
export function nearbyEdgeLeaves(edges,point,reach){
 // The crosshair must be close to the exposed part of a leaf, not merely
 // somewhere inside a leaf that also happens to touch the canopy silhouette.
 const nearby=new Set();
 for(const [leaf,points]of edges){
  if(points.some(p=>Math.hypot(p.x-point.x,p.y-point.y)<=reach))nearby.add(leaf);
 }
 return nearby;
}
export function snipNearEdge(group,catalog,point,reach,edges=outerLeafEdges(group,catalog)){
 return snipAt(group,catalog,point,reach,nearbyEdgeLeaves(edges,point,reach));
}
export function snipTarget(group,catalog,point,reach,edge=outerLeaves(group,catalog)){
 const candidates=[];
 for(const c of group.clusters)for(const leaf of catalog.get(c.key)??[]){
  if((c.leafSnips?.[leaf.index]??1)<=0||!edge.has(leaf))continue;
  const center=Math.hypot(point.x-leaf.x,point.y-leaf.y),growth=c.leafSnips?.[leaf.index]??1;
  if(center>reach+leaf.size*growth*1.8+1)continue;
  const distance=leafDistance(leaf,point,growth);
  if(distance<=reach)candidates.push({c,leaf,distance,center});
 }
 // An exact blade hit wins over nearby foliage. Among actual overlaps, honor
 // the renderer's layer and leaf paint order; near misses prefer the closest edge.
 candidates.sort((a,b)=>Number(a.distance>0)-Number(b.distance>0)||(a.distance>0?a.distance-b.distance:0)||(b.c.z??0)-(a.c.z??0)||group.clusters.indexOf(b.c)-group.clusters.indexOf(a.c)||b.leaf.index-a.leaf.index);
 return candidates[0]??null;
}
export function snipAt(group,catalog,point,reach,edge){
 const target=snipTarget(group,catalog,point,reach,edge);if(!target)return [];
 const {c,leaf}=target;c.leafSnips??={};c.leafSnips[leaf.index]=0;
 const cuts=[{clusterKey:c.key,index:leaf.index,leaf:{...leaf}}];
 if(group.rx&&group.ry){
  addShapeProfile(group,cutProfile(group,cuts.map(c=>c.leaf)));
  for(const c of group.clusters)for(const leaf of catalog.get(c.key)??[])Object.assign(leaf,presentLeaf({x:leaf.originalX,y:leaf.originalY},c,leaf));
 }
 return cuts;
}
export function trimEvent(proposal,at,id,seq){return {id,seq,at,model:TRIM_MODEL,crownId:proposal.crownId,clusterKey:proposal.clusterKey,index:proposal.index,depth:proposal.depth};}

// Keep a drag's geometry current without rebuilding the tree after every sample.
export function acceptTrimProposal(state,proposal){
 const s=state.byCluster.get(proposal.clusterKey);s.points=proposal.points;
 s.depths=s.rim.map((p,i)=>Math.hypot(p.x-s.points[i].x,p.y-s.points[i].y));
}

// Legacy leaf-2 strokes remain readable; current scissors use leaf-3 targets.
export const ERASE_MODEL='leaf-2',ERASE_POINT_LIMIT=2048,ERASE_BATCH_POINTS=16000;
export function leafLayers(tree){
 const groups=new Map();
 for(const c of [...tree.clusters,...(tree.buds??[])]){
  if(!c.starterLeaves&&(c.leafAmount??1)<=0)continue;
  // Bough-tip foliage has no pad tag. Include it in the nearest large layer,
  // rather than inventing an untrimmable one-pixel "undefined" layer.
  const pad=tree.pads.find(p=>p.id===c.pad)??tree.pads.toSorted((a,b)=>Math.hypot(c.x-a.x,c.y-a.y)-Math.hypot(c.x-b.x,c.y-b.y))[0];
  const id=`layer:${pad?.id??c.node}`;
  if(!groups.has(id))groups.set(id,{id,pad:pad?.id,clusters:[],z:c.z??0});
  const g=groups.get(id);g.clusters.push(c);g.z=Math.max(g.z,c.z??0);
 }
 return [...groups.values()].map(g=>{
  const pad=tree.pads.find(p=>p.id===g.pad),x=pad?.x??g.clusters[0].x,y=pad?.y??g.clusters[0].y;
  const scale=Math.max(pad?.rx??g.clusters[0].rx,pad?.ry??g.clusters[0].ry,1);
  const rim=g.clusters.flatMap(c=>referenceRim(tree,c));
  const sculptX=(Math.min(...rim.map(p=>p.x))+Math.max(...rim.map(p=>p.x)))/2,sculptY=(Math.min(...rim.map(p=>p.y))+Math.max(...rim.map(p=>p.y)))/2;
  return {...g,x,y,sculptX,sculptY,scale,rx:Math.max(1,pad?.rx??scale),ry:Math.max(1,pad?.ry??scale)};
 });
}
export function validEraseOperation(op){
 return op?.model===ERASE_MODEL&&typeof op.crownId==='string'&&op.crownId.length<=256&&
  Number.isFinite(op.radius)&&op.radius>=.005&&op.radius<=.5&&Array.isArray(op.points)&&op.points.length>0&&op.points.length<=ERASE_POINT_LIMIT&&
  op.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(v=>Number.isFinite(v)&&Math.abs(v)<=4));
}
export function proposeErase(tree,op){
 if(!validEraseOperation(op))return null;
 const g=leafLayers(tree).find(g=>g.id===op.crownId);if(!g)return null;
 return {model:ERASE_MODEL,crownId:g.id,radius:op.radius,points:op.points.map(p=>[...p]),clusterKeys:g.clusters.map(c=>c.key)};
}
export function eraseEvent(proposal,at,id,seq){return {...proposal,at,id,seq};}
export function applyLeafErasing(tree,record,at){
 const groups=new Map(leafLayers(tree).map(g=>[g.id,g])),clock=trimClock(record,at);
 for(const e of record.leafTrims??[]){
  if(e.model!==ERASE_MODEL||e.at>at)continue;
  const g=groups.get(e.crownId),weight=clamp(1-(clock-trimClock(record,e.at))/TRIM_RECOVERY_HOURS,0,1);
  if(!g||weight<=0)continue;
  const keys=new Set(e.clusterKeys),stroke={points:e.points.map(([x,y])=>[g.x+x*g.scale,g.y+y*g.scale]),radius:e.radius*g.scale*weight};
  for(const c of g.clusters)if(keys.has(c.key)){
   c.leafErase??=[];c.leafErase.push(stroke);
   // Interpret old prototype strokes as selections of whole leaves too. Keep
   // the recorded history, without preserving its old pixel-erasing effect.
   for(const leaf of leafSites(tree,c))if(stroke.points.some((p,i)=>segmentDistance(leaf,p,stroke.points[Math.max(0,i-1)])<=e.radius*g.scale)){
    c.leafSnips??={};c.leafSnips[leaf.index]=Math.min(c.leafSnips[leaf.index]??1,1-weight);
   }
  }
 }
}
function segmentDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((p.x-a[0])*dx+(p.y-a[1])*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(p.x-a[0]-t*dx,p.y-a[1]-t*dy);}
