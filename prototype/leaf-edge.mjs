import {leafOutlines} from './leaf-geometry.mjs';

// The sculpting model is radial, including concave hearts and notches. Follow
// its actual surviving silhouette rather than a convex hull or cluster borders.
const SAMPLES=960,TAU=Math.PI*2,STEP=TAU/SAMPLES;
const rays=Array.from({length:SAMPLES},(_,i)=>({x:Math.cos(i*STEP),y:Math.sin(i*STEP)}));
export function outerLeafEdges(group,catalog){
 const alive=group.clusters.flatMap((c,order)=>(catalog.get(c.key)??[]).filter(s=>(c.leafSnips?.[s.index]??1)>0).map(leaf=>({c,leaf,order})));
 if(!alive.length)return new Map();
 const shape=group.clusters.find(c=>c.leafShape)?.leafShape;
 const x=shape?.x??group.sculptX??group.x??alive.reduce((n,s)=>n+s.leaf.x,0)/alive.length;
 const y=shape?.y??group.sculptY??group.y??alive.reduce((n,s)=>n+s.leaf.y,0)/alive.length;
 const depths=new Float64Array(SAMPLES),owners=Array(SAMPLES).fill(null);
 // Later painted foliage owns an exactly overlapping silhouette.
 alive.sort((a,b)=>(a.c.z??0)-(b.c.z??0)||a.order-b.order||a.leaf.index-b.leaf.index);
 for(const item of alive)for(const polygon of leafOutlines(item.leaf,item.c.leafSnips?.[item.leaf.index]??1)){
  for(let j=0;j<polygon.length;j++){
   const a=polygon[j],b=polygon[(j+1)%polygon.length],ax=a.x-x,ay=a.y-y,ex=b.x-a.x,ey=b.y-a.y;
   const start=Math.atan2(ay,ax),end=Math.atan2(b.y-y,b.x-x),delta=Math.atan2(Math.sin(end-start),Math.cos(end-start));
   const lo=Math.ceil(Math.min(start,start+delta)/STEP-1e-9),hi=Math.floor(Math.max(start,start+delta)/STEP+1e-9);
   for(let k=lo;k<=hi;k++){
    const i=(k%SAMPLES+SAMPLES)%SAMPLES,d=rays[i],den=d.x*ey-d.y*ex;
    if(Math.abs(den)<1e-10)continue;
    const radius=(ax*ey-ay*ex)/den,u=(ax*d.y-ay*d.x)/den;
    if(radius<0||u< -1e-8||u>1+1e-8||radius<depths[i]-1e-8)continue;
    depths[i]=radius;owners[i]=item.leaf;
   }
  }
 }
 const edges=new Map();
 for(let i=0;i<SAMPLES;i++){
  const leaf=owners[i];if(!leaf)continue;
  if(!edges.has(leaf))edges.set(leaf,[]);
  edges.get(leaf).push({x:x+rays[i].x*depths[i],y:y+rays[i].y*depths[i]});
 }
 return edges;
}
export const outerLeaves=(group,catalog)=>new Set(outerLeafEdges(group,catalog).keys());
