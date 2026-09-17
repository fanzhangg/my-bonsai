import {WATER_CAPACITY,WATER_RECOVERY_HOURS_PER_TANK} from './watering-motion.mjs';
import {generate} from './morphology.mjs';
import {generate as reference} from '../v1/canopy.mjs';
import {render} from './growing-render.mjs';
import {sample,pointOn} from '../v1/model.mjs';
import {normalizePot} from './pots.mjs';
import {regrowthPlan,appendRegrowth} from './regrowth.mjs';

export const HOUR=3600000;
export const VERSION='bonsai-growth-2';
// A shared camera anchored to the pot, never to the crown's bounding box.
// Keep both scale and soil position identical across styles and growth stages.
export const FRAME={width:740,height:740,aboveSoil:470};
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export function profile(record){return {days:3+sample(record.config.seed,'lifetime','days')*3,initial:({broom:.5,literati:.55,cascade:.35}[record.config.preset]??.3)};}
export function wateringProgress(record,at=Date.now()){return (record.waterings??[]).reduce((sum,w)=>sum+(w.at<=at?w.amount:0),0);}
// A bare canopy gets visible new shoots while a leafy tree keeps its gentle pace.
export function wateringRecovery(tree,used,{capacity=WATER_CAPACITY,recoveryHoursPerTank=WATER_RECOVERY_HOURS_PER_TANK}={}){return tree.clusters.some(c=>(c.leafAmount??1)>.08)?0:Math.min(capacity,Math.max(0,used))/capacity*recoveryHoursPerTank;}
export function snapshot(record,at=Date.now()){
 const {days,initial}=profile(record),p=clamp(initial+(at-record.createdAt)/(days*24*HOUR)*(1-initial)+wateringProgress(record,at));
 return grow(record,p,{at});
}
export function grow(record,p,{morphology=true,at=Infinity,generator}={}){
 p=clamp(p);const tree=(generator??(morphology?generate:reference))(record.config),original=new Map(tree.nodes.map(n=>[n.id,n])),clusters=tree.clusters,schedule=new Map(),attachments=new Map();
 const pot=normalizePot(record.config.pot);if(pot)tree.config.pot=pot;
 tree.viewBox={x:tree.root.x-FRAME.width/2,y:tree.root.y-FRAME.aboveSoil,width:FRAME.width,height:FRAME.height};
 function timing(n){if(schedule.has(n.id))return schedule.get(n.id);const parent=original.get(n.parent);let attach=1;
   if(parent){let best=Infinity;for(let i=0;i<=100;i++){const t=i/100,q=pointOn(parent,t),distance=Math.hypot(q.x-n.x,q.y-n.y);if(distance<best){best=distance;attach=t;}}}
   attachments.set(n.id,attach);const ps=parent?timing(parent):null;
   const value={born:ps?ps.born+ps.duration+(n.role==='trunk'?.08:.12)+(n.growthDelay??0):0,duration:(n.role==='trunk'?1:n.role==='twig'?.55:.9)*(n.growthTempo??1)};schedule.set(n.id,value);return value;
 }
 tree.nodes.forEach(timing);const end=Math.max(...tree.clusters.map(c=>{const s=schedule.get(c.node);return s.born+s.duration+1.6;}));
 const clock=p*end,scale=.55+.45*smooth(p),thickness=(.04+.96*p**1.3)*smooth(p/.018),mapped=new Map();
 function transform(n){if(mapped.has(n.id))return mapped.get(n.id);const s=schedule.get(n.id),g=smooth((clock-s.born)/s.duration),parent=original.get(n.parent),grownParent=parent?transform(parent):null;
   const anchor=grownParent?pointOn(grownParent,attachments.get(n.id)):tree.root;
   const next={...n,x:anchor.x,y:anchor.y,width:n.width*thickness,tipWidth:n.tipWidth*thickness,born:-100,duration:1,growth:g};
   for(const [x,y]of [['cx1','cy1'],['cx2','cy2'],['ex','ey']]){next[x]=anchor.x+(n[x]-n.x)*scale*g;next[y]=anchor.y+(n[y]-n.y)*scale*g;}
   mapped.set(n.id,next);return next;
 }
 tree.nodes.forEach(transform);tree.nodes=[...mapped.values()].filter(n=>n.growth>0||!n.parent);
 // Buds unfold while their supporting twig extends, then fill out after it.
 // Contract the whole leaf volume toward the live tip until the twig is grown.
 tree.clusters=tree.clusters.flatMap(c=>{const s=schedule.get(c.node),leafAmount=smooth((clock-s.born)/(s.duration+1.6));if(!leafAmount)return [];const n=mapped.get(c.node),old=original.get(c.node),leafScale=scale*n.growth;return [{...c,x:n.ex+(c.x-old.ex)*leafScale,y:n.ey+(c.y-old.ey)*leafScale,rx:c.rx*leafScale,ry:c.ry*leafScale,born:-100,leafAmount}];});
 tree.hour=clock;tree.progress=p;tree.matureDays=profile(record).days;tree.seedOpacity=1-smooth(p/.035);tree.scars=[];
 // Resolve descendants against the complete scaffold, including unborn twigs.
 // Filtering after growth keeps all surviving wood and the camera unchanged.
 // Rebase cuts onto the same biological clock: past watering never speeds a later cut.
 const recovery=time=>(record.waterings??[]).reduce((sum,w)=>sum+(w.at<=at&&w.at<time?(w.recoveryHours??0)*HOUR:0),0);
 const recoveryAt=at+recovery(Infinity);
 const recoveryCuts=(record.cuts??[]).map(c=>({...c,at:c.at+recovery(c.at)}));
 const {removed,shoots}=regrowthPlan([...original.values()],recoveryCuts,record.config.seed,recoveryAt);
 tree.nodes=tree.nodes.filter(n=>!removed.has(n.id));
 tree.clusters=tree.clusters.filter(c=>!removed.has(c.node));
 appendRegrowth(tree,{shoots,original,clusters,attachments,mapped,scale,thickness,seed:record.config.seed,at:recoveryAt});
 // A locally mature twig cannot carry an adult crown on a young plant.
 // Cubic leaf capacity gives seedlings a few leaves; the volume expands
 // about the live tip so leaves remain attached, including after pruning.
 const capacity=p**3,crownScale=Math.sqrt(capacity),live=new Map(tree.nodes.map(n=>[n.id,n]));
 tree.clusters=tree.clusters.map(c=>{const n=live.get(c.node);return {...c,leafAmount:Math.min(c.leafAmount,capacity),x:n.ex+(c.x-n.ex)*crownScale,y:n.ey+(c.y-n.ey)*crownScale,rx:c.rx*crownScale,ry:c.ry*crownScale};});
 // Two small starter leaves mark a future crown before its terminal twigs
 // exist. They ride the living branch tip and fade as real foliage takes over.
 const leafMass=new Map();
 for(const c of tree.clusters){let n=live.get(c.node);while(n&&n.role!=='primary')n=live.get(n.parent);if(n)leafMass.set(n.id,(leafMass.get(n.id)??0)+c.leafAmount);}
 tree.buds=tree.nodes.flatMap(n=>{
  if(n.role!=='primary')return [];
  const unfold=smooth((n.growth-.05)/.25),opacity=unfold*(1-smooth((leafMass.get(n.id)??0)/.18));
  if(opacity<=0)return [];
  return [{key:`bud:${n.id}`,node:n.id,pad:n.pad,z:n.z??0,x:n.ex,y:n.ey,rx:5,ry:3,born:-100,
   leafAmount:0,starterLeaves:2,detailScale:.55,opacity}];
 });
 return tree;
}
export function draw(tree,{transparent=false,viewBox=tree.viewBox,id='growing-tree'}={}){
 const svg=render(tree,{hour:tree.hour,id,transparent,viewBox});
 const seed=`<ellipse cx="${tree.root.x}" cy="${tree.root.y-4}" rx="4" ry="2.5" fill="#8f6240" opacity="${tree.seedOpacity}"/>`;
 return svg.replace('</svg>',seed+'</svg>');
}
