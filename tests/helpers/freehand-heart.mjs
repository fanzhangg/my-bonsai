// Acceptance-only operator: chooses leaf positions and calls the same one-leaf
// scissors as the UI. No heart preset or direct geometry mutation in the app.
import {snapshot,draw,HOUR} from '../../prototype/growth.mjs';
import {normalizeDesign} from '../../prototype/core/v3/config.mjs';
import {CURRENT_VERSION} from '../../prototype/tree-versions.mjs';
import {leafLayers,leafSites,snipAt,referenceRim,shapeLeafPoint,inside} from '../../prototype/leaf-trim-model.mjs';
import {saveLeafTrims} from '../../prototype/leaf-trim-events.mjs';
import {outerLeaves} from '../../prototype/leaf-edge.mjs';

export function sculptHeart(){
const record={version:CURRENT_VERSION,createdAt:0,revision:0,config:normalizeDesign({preset:'broom',seed:'heart-freehand-review',density:.65}),cuts:[],leafTrims:[]},at=168*HOUR;
const tree=snapshot(record,at),group=leafLayers(tree).sort((a,b)=>b.ry-a.ry)[0],before=structuredClone(tree);
const catalog=new Map(group.clusters.map(c=>[c.key,leafSites(tree,c)])),rims=group.clusters.flatMap(c=>referenceRim(tree,c));
const center={x:group.sculptX,y:group.sculptY};
const rawRadius=angle=>{
 const dx=Math.cos(angle),dy=Math.sin(angle);let max=0;
 for(const p of rims){const x=p.x-center.x,y=p.y-center.y,r=Math.hypot(x,y);if(Math.abs(Math.atan2(Math.sin(Math.atan2(y,x)-angle),Math.cos(Math.atan2(y,x)-angle)))<.035)max=Math.max(max,r);}
 return max;
};
const size=Math.min(group.rx,group.ry)*.88;
const heart=Array.from({length:360},(_,i)=>{const t=i*Math.PI/180;return {x:center.x+16*Math.sin(t)**3/17*size,y:center.y-(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))/17*size};});
const targetRadius=a=>{let lo=0,hi=Math.max(group.rx,group.ry)*3;for(let i=0;i<20;i++){const m=(lo+hi)/2;if(inside({x:center.x+Math.cos(a)*m,y:center.y+Math.sin(a)*m},heart))lo=m;else hi=m;}return lo;};
const angles=Array.from({length:192},(_,i)=>i*Math.PI/96),original=angles.map(rawRadius),desired=angles.map(targetRadius),targets=[];
for(let step=0;step<2000;step++){
 const profile=group.clusters[0].leafShape;
 const errors=angles.map((a,i)=>{const p={x:center.x+Math.cos(a)*original[i],y:center.y+Math.sin(a)*original[i]},q=shapeLeafPoint(p,profile);return Math.hypot(q.x-center.x,q.y-center.y)-desired[i];});
 const edge=outerLeaves(group,catalog);
 const alive=group.clusters.flatMap(c=>catalog.get(c.key).filter(s=>edge.has(s)).map(s=>({c,s})));
 if(!alive.length)break;
 let best=null,score=0;
 for(const candidate of alive){const s=candidate.s,a=Math.atan2(s.y-center.y,s.x-center.x),i=Math.round((a+2*Math.PI)%(2*Math.PI)*96/Math.PI)%192;
  const e=errors[i];if(e<.4)continue;
  const r=Math.hypot(s.x-center.x,s.y-center.y),v=e*(.7+.3*Math.min(1,r/(desired[i]+e)));
  if(v>score){score=v;best=candidate;}
 }
 if(!best)break;
 const cuts=snipAt(group,catalog,best.s,1,edge);targets.push(...cuts.map(({clusterKey,index})=>({clusterKey,index})));
}
const saved=saveLeafTrims(record,{id:crypto.randomUUID(),revision:0,operations:[{model:'leaf-3',crownId:group.id,targets}]},at);
return {record:saved,at,before,group,targets,center,size};
}
