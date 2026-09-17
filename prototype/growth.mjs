import {generate} from './morphology.mjs';
import {generate as reference} from './core/v1/canopy.mjs';
import {render} from './growing-render.mjs';
import {sample,pointOn} from './core/v1/model.mjs';
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
export function snapshot(record,at=Date.now()){
 const {days,initial}=profile(record),p=clamp(initial+(at-record.createdAt)/(days*24*HOUR)*(1-initial));
 return grow(record,p,{at});
}
export function grow(record,p,{morphology=true,at=Infinity}={}){
 p=clamp(p);const tree=(morphology?generate:reference)(record.config),original=new Map(tree.nodes.map(n=>[n.id,n])),clusters=tree.clusters,schedule=new Map(),attachments=new Map();
 const pot=normalizePot(record.config.pot);if(pot)tree.config.pot=pot;
 tree.viewBox={x:tree.root.x-FRAME.width/2,y:tree.root.y-FRAME.aboveSoil,width:FRAME.width,height:FRAME.height};
 function timing(n){if(schedule.has(n.id))return schedule.get(n.id);const parent=original.get(n.parent);let attach=1;
   if(parent){let best=Infinity;for(let i=0;i<=100;i++){const t=i/100,q=pointOn(parent,t),distance=Math.hypot(q.x-n.x,q.y-n.y);if(distance<best){best=distance;attach=t;}}}
   attachments.set(n.id,attach);const ps=parent?timing(parent):null;
   const value={born:ps?ps.born+ps.duration+(n.role==='trunk'?.08:.12):0,duration:n.role==='trunk'?1:n.role==='twig'?.55:.9};schedule.set(n.id,value);return value;
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
 tree.clusters=tree.clusters.flatMap(c=>{const s=schedule.get(c.node),leafAmount=smooth((clock-s.born-s.duration)/1.6);if(!leafAmount)return [];const n=mapped.get(c.node),old=original.get(c.node);return [{...c,x:n.ex+(c.x-old.ex)*scale,y:n.ey+(c.y-old.ey)*scale,rx:c.rx*scale,ry:c.ry*scale,born:-100,leafAmount}];});
 tree.hour=clock;tree.progress=p;tree.matureDays=profile(record).days;tree.seedOpacity=1-smooth(p/.035);tree.scars=[];
 // Resolve descendants against the complete scaffold, including unborn twigs.
 // Filtering after growth keeps all surviving wood and the camera unchanged.
 const {removed,shoots}=regrowthPlan([...original.values()],record.cuts??[],record.config.seed,at);
 tree.nodes=tree.nodes.filter(n=>!removed.has(n.id));
 tree.clusters=tree.clusters.filter(c=>!removed.has(c.node));
 appendRegrowth(tree,{shoots,original,clusters,attachments,mapped,scale,thickness,seed:record.config.seed,at});
 return tree;
}
export function draw(tree,{transparent=false,viewBox=tree.viewBox}={}){
 const svg=render(tree,{hour:tree.hour,id:'growing-tree',transparent,viewBox});
 const seed=`<ellipse cx="${tree.root.x}" cy="${tree.root.y-4}" rx="4" ry="2.5" fill="#8f6240" opacity="${tree.seedOpacity}"/>`;
 return svg.replace('</svg>',seed+'</svg>');
}
