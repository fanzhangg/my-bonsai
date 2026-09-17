// Versioned, deterministic lifecycle over the approved trained-tree geometry.
import {generate,render} from './core/v1/canopy.mjs';
import {sample,pointOn} from './core/v1/model.mjs';
export const VERSION='bonsai-life-1';
export const HOUR=3600000;
export function descendants(nodes,id){const ids=new Set([id]);for(let changed=true;changed;){changed=false;for(const n of nodes)if(ids.has(n.parent)&&!ids.has(n.id)){ids.add(n.id);changed=true;}}return ids;}
export function snapshot(record,at=Date.now()){
  if(record.version!==VERSION)throw new Error('Unsupported tree version');
  const tree=generate(record.config),hour=46+Math.max(0,at-record.createdAt)/HOUR*.23;
  tree.hour=hour;tree.scars=[];
  for(const cut of record.cuts){
    if(cut.at>at)break;
    const n=tree.nodes.find(n=>n.id===cut.branchId);if(!n)continue;
    const removed=descendants(tree.nodes,n.id),branches=tree.nodes.filter(x=>removed.has(x.id)),leaves=tree.clusters.filter(x=>removed.has(x.node));
    tree.nodes=tree.nodes.filter(x=>!removed.has(x.id));tree.clusters=tree.clusters.filter(x=>!removed.has(x.node));
    tree.scars=tree.scars.filter(s=>!removed.has(s.parent));
    tree.scars.push({x:n.x,y:n.y,r:Math.max(1.6,n.width*.45),parent:n.parent});
    const start=46+(cut.at-record.createdAt)/HOUR*.23+(4+sample(record.config.seed,`${cut.seq}`,'delay')*2)*.23;
    const scale=.78+sample(record.config.seed,`${cut.seq}`,'size')*.08;
    const angle=(sample(record.config.seed,`${cut.seq}`,'turn')-.5)*.12;
    const transform=(x,y)=>({x:n.x+scale*((x-n.x)*Math.cos(angle)-(y-n.y)*Math.sin(angle)),y:n.y+scale*((x-n.x)*Math.sin(angle)+(y-n.y)*Math.cos(angle))});
    const ids=new Map(branches.map((b,i)=>[b.id,`r${cut.seq}:${i}`]));
    const times=new Map();
    for(const b of branches){
      const born=times.has(b.parent)?times.get(b.parent)+3:start;times.set(b.id,born);
      const next={...b,id:ids.get(b.id),key:ids.get(b.id),parent:ids.get(b.parent)??b.parent,role:'twig',born,duration:3,width:b.width*scale,tipWidth:b.tipWidth*scale};
      for(const [x,y]of [['x','y'],['cx1','cy1'],['cx2','cy2'],['ex','ey']]){const p=transform(b[x],b[y]);next[x]=p.x;next[y]=p.y;}
      tree.nodes.push(next);
    }
    for(const c of leaves)tree.clusters.push({...c,...transform(c.x,c.y),node:ids.get(c.node),key:`r${cut.seq}:${c.key}`,rx:c.rx*scale,ry:c.ry*scale,born:times.get(c.node)+3,duration:6});
  }
  // Invisible planned shoots are retained for deterministic future growth.
  return tree;
}
export function prunable(tree){return tree.nodes.filter(n=>n.role!=='trunk'&&n.role!=='bough'&&(n.role!=='twig'||tree.hour>n.born+Math.min(2,n.duration/6)));}
const visiblePoints=(n,hour)=>{const g=n.role==='twig'?Math.min(1,Math.max(0,(hour-n.born)/(n.duration||12))):1;return Array.from({length:17},(_,i)=>pointOn(n,g*i/16));};
const path=(n,hour)=>`M${visiblePoints(n,hour).map(p=>`${p.x},${p.y}`).join(' L')}`;
export function hitTest(tree,x,y,radius){let closest=null,best=radius;for(const n of prunable(tree)){const pts=visiblePoints(n,tree.hour);for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1))),distance=Math.hypot(x-a.x-t*dx,y-a.y-t*dy);if(distance<best){best=distance;closest=n.id;}}}return closest;}
export function draw(tree,selected=null,interactive=false){
  let svg=render(tree,{hour:tree.hour,id:'living-tree'});
  const active=selected?descendants(tree.nodes,selected):new Set();
  const highlight=tree.nodes.filter(n=>active.has(n.id)&&(n.role!=='twig'||tree.hour>n.born)).map(n=>`<path d="${path(n,tree.hour)}" fill="none" stroke="#dc8857" stroke-width="${Math.max(3,n.width+2)}" stroke-linecap="round" opacity=".65"/>`).join('');
  const scars=tree.scars.map(s=>`<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="#c49a78"/>`).join('');
  // Interaction uses visible growth endpoints rather than future branch curves.
  const hits=interactive?prunable(tree).map(n=>`<path data-branch="${n.id}" d="${path(n,tree.hour)}" fill="none" stroke="transparent" stroke-width="16" pointer-events="stroke"/>`).join(''):'';
  return svg.replace('</svg>',`${scars}<g pointer-events="none">${highlight}</g>${hits}</svg>`);
}
