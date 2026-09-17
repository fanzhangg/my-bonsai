// Review-only foliage pass over the already grown/pruned branch scaffold.
// This also anchors leaves correctly on regrown curves.
import {pointOn,sample} from './core/v1/model.mjs';
import {canopyPoint} from './morphology.mjs';

function smoothEnvelope(clusters){
  const points=clusters.flatMap(c=>Array.from({length:24},(_,i)=>canopyPoint(c,i*Math.PI/12)));
  points.sort((a,b)=>a.x-b.x||a.y-b.y);
  const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const half=pts=>{const out=[];for(const p of pts){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}return out;};
  const hull=[...half(points).slice(0,-1),...half([...points].reverse()).slice(0,-1)];
  const pair=p=>`${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  const mid=(a,b)=>pair({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  return `M${mid(hull.at(-1),hull[0])} ${hull.map((p,i)=>`Q${pair(p)} ${mid(p,hull[(i+1)%hull.length])}`).join(' ')}Z`;
}

export const CROWN_NAMES={juniper:'错层云片',broom:'宽拱圆顶',literati:'疏层小冠'};
export function applyCrownDesign(tree){
  const kind=tree.preset.id;if(!CROWN_NAMES[kind])return tree;
  const broad=kind==='broom',slender=kind==='literati';
  const nodes=new Map(tree.nodes.map(n=>[n.id,n]));
  const clusters=[];
  for(const c of tree.clusters){
    const n=nodes.get(c.node);if(!n)continue;
    const rand=prop=>sample(tree.config.seed,`crown-basic:${c.key}`,prop);
    // The major branch supplies the overall span; each small branch owns its
    // own crown height, contour and depth, shared by its foliage-bearing sites.
    const branchDepth=(n.z??0)+(rand('branch-depth')-.5)*1.3;
    const branchShade=(branchDepth<0?-.4:.1)+(rand('branch-depth')-.5)*1.5;
    const slope=(rand('branch-slope')-.5)*.13;
    for(let i=0;i<3;i++){
      const t=[.48,.77,1][i],p=pointOn(n,t),weight=[.48,.72,1][i]*(.9+rand(`size-${i}`)*.2);
      const rx=c.rx*weight*(broad?1.06:slender?.76:.84);
      const ry=c.ry*weight*(broad?1.3:slender?1.5:1.85)*(.85+rand('branch-height')*.3);
      const depth=broad?(n.z??0)+(i===1?-.16:.16)+(rand('depth')-.5)*.05:branchDepth+i*.015;
      clusters.push({...c,key:`${c.key}:crown:${i}`,anchorT:t,anchorX:p.x,anchorY:p.y,
        x:p.x,y:p.y-ry*.28,rx,ry,z:depth,crownBranch:n.id,
        crownShade:broad?((n.z??0)<0?-.8:i===1?-.45:.28):branchShade,detailScale:.72,
        leafBudget:Math.min(1.25,(c.leafBudget??1)*weight*.7),
        contour:{rough:.055,phase:rand('phase')*Math.PI*2+i*.8,cloud:!broad,
          skew:(rand('skew')-.5)*.3,slope:broad?0:slope,
          flat:!broad,wind:false}});
    }
  }
  // A rounded outer envelope unifies the branch group. Independently shaded
  // small crowns remain inside it, without fragmenting its silhouette.
  const crownEnvelopes=[...new Set(clusters.map(c=>c.pad))].map(pad=>{
    const group=clusters.filter(c=>c.pad===pad);
    return {pad,path:smoothEnvelope(group),z:Math.min(...group.map(c=>c.z))-.01,
      opacity:Math.max(...group.map(c=>c.leafAmount??1))};
  });
  return {...tree,clusters,crownEnvelopes,crownDesign:'basic-4'};
}
