// Shared by rendering and blade hit testing. Distances are to the visible
// leaf boundary, not to an unrelated circle around its center.
import {STYLIZED_OUTLINES,stylizedLeafMarkup} from './core/v3/stylized-foliage.mjs';
const f=n=>Number(n).toFixed(2);
export const LEAF_PATHS={
 maple:'M0 1 L-.23 .43 L-.75 .53 L-.54 .1 L-1 -.23 L-.48 -.3 L-.5 -.83 L-.18 -.58 L0 -1.15 L.18 -.58 L.5 -.83 L.48 -.3 L1 -.23 L.54 .1 L.75 .53 L.23 .43Z',
 fan:'M0 .9 Q-.18 .24 -.82 -.23 Q-1 -.65 -.74 -.83 Q-.36 -1.04 0 -.86 Q.38 -1.06 .78 -.82 Q1 -.55 .79 -.22 Q.18 .27 0 .9Z',
 lance:'M0 1.22 Q-.68 .1 0 -1.25 Q.65 -.05 0 1.22Z'
};
const maple=[[0,1],[-.23,.43],[-.75,.53],[-.54,.1],[-1,-.23],[-.48,-.3],[-.5,-.83],[-.18,-.58],[0,-1.15],[.18,-.58],[.5,-.83],[.48,-.3],[1,-.23],[.54,.1],[.75,.53],[.23,.43]];
function quadratics(start,segments){
 const points=[];let a=start;
 for(const [cx,cy,x,y]of segments){for(let i=0;i<12;i++){const t=i/12,u=1-t;points.push([u*u*a[0]+2*u*t*cx+t*t*x,u*u*a[1]+2*u*t*cy+t*t*y]);}a=[x,y];}
 return points;
}
const outlines={maple,fan:quadratics([0,.9],[[-.18,.24,-.82,-.23],[-1,-.65,-.74,-.83],[-.36,-1.04,0,-.86],[.38,-1.06,.78,-.82],[1,-.55,.79,-.22],[.18,.27,0,.9]]),lance:quadratics([0,1.22],[[-.68,.1,0,-1.25],[.65,-.05,0,1.22]])};
export function leafAspect(shape){return shape==='round'?.91:shape==='scale'?.57:.64;}
// World-space silhouettes for detecting the outside edge of a whole canopy.
export function leafOutlines(leaf,regrowth=1){
 const size=leaf.size*regrowth;if(size<=0)return [];
 if(leaf.shape==='needle')return [-1,0,1].map(q=>{
  const a=(leaf.tilt??0)+q*.22,dx=Math.sin(a)*size*1.6,dy=-Math.cos(a)*size*1.6,r=.725*(leaf.renderScale??1);
  return Array.from({length:16},(_,i)=>{const angle=i*Math.PI/8,x=Math.cos(angle),y=Math.sin(angle),tip=x*dx+y*dy>0;return {x:leaf.x+x*r+(tip?dx:0),y:leaf.y+y*r+(tip?dy:0)};});
 });
 const polygon=outlines[leaf.shape]??Array.from({length:48},(_,i)=>[Math.cos(i*Math.PI/24),Math.sin(i*Math.PI/24)*leafAspect(leaf.shape)]);
 const a=(leaf.angle??0)*Math.PI/180,s=size*(LEAF_PATHS[leaf.shape]&&leaf.shape!=='lance'?1.18:1);
 return (STYLIZED_OUTLINES[leaf.shape]??[polygon]).map(p=>p.map(([x,y])=>({x:leaf.x+(x*Math.cos(a)-y*Math.sin(a))*s,y:leaf.y+(x*Math.sin(a)+y*Math.cos(a))*s})));
}
function segmentDistance(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);}
export function leafDistance(leaf,point,regrowth=1){
 const size=leaf.size*regrowth;if(size<=0)return Infinity;
 const dx=point.x-leaf.x,dy=point.y-leaf.y;
 if(leaf.shape==='needle'){
  let distance=Infinity;
  for(let q=-1;q<=1;q++){const a=(leaf.tilt??0)+q*.22;distance=Math.min(distance,segmentDistance(dx,dy,[0,0],[Math.sin(a)*size*1.6,-Math.cos(a)*size*1.6]));}
  return Math.max(0,distance-.725*(leaf.renderScale??1));
 }
 const angle=-(leaf.angle??0)*Math.PI/180,scale=size*(LEAF_PATHS[leaf.shape]&&leaf.shape!=='lance'?1.18:1);
 const x=(dx*Math.cos(angle)-dy*Math.sin(angle))/scale,y=(dx*Math.sin(angle)+dy*Math.cos(angle))/scale;
 const polygon=outlines[leaf.shape]??Array.from({length:48},(_,i)=>[Math.cos(i*Math.PI/24),Math.sin(i*Math.PI/24)*leafAspect(leaf.shape)]);
 let distance=Infinity;
 for(const p of STYLIZED_OUTLINES[leaf.shape]??[polygon]){
  let inside=false;
  for(let i=0,j=p.length-1;i<p.length;j=i++){
   const a=p[i],b=p[j];
   if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
   distance=Math.min(distance,segmentDistance(x,y,a,b));
  }
  if(inside)return 0;
 }
 return distance*scale;
}
export function leafGlyph(leaf,color,regrowth=1,{accent=color,silhouette=false}={}){
 const {x,y,shape,angle=0}=leaf,size=leaf.size*regrowth;
 if(STYLIZED_OUTLINES[shape])return stylizedLeafMarkup(shape,{x,y,size,angle,color,accent,silhouette,showCenter:true});
 if(shape==='needle')return [-1,0,1].map(q=>{const a=(leaf.tilt??0)+q*.22;return `<path d="M${f(x)} ${f(y)} l${f(Math.sin(a)*size*1.6)} ${f(-Math.cos(a)*size*1.6)}" fill="none" stroke="${color}" stroke-width="${f(1.45*(leaf.renderScale??1))}" stroke-linecap="round"/>`;}).join('');
 if(LEAF_PATHS[shape])return `<path d="${LEAF_PATHS[shape]}" fill="${color}" transform="translate(${f(x)} ${f(y)}) rotate(${f(angle)}) scale(${f(size*(shape==='lance'?1:1.18))})"/>`;
 return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(size)}" ry="${f(size*leafAspect(shape))}" fill="${color}" transform="rotate(${f(angle)} ${f(x)} ${f(y)})"/>`;
}
