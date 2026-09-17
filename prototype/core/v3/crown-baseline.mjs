import {generate,canopyPoint} from '../v2/morphology.mjs';
import {generateBranchDesign} from './branch-design.mjs';

// Start from the original distributed canopy, not repeated endpoint blobs.
// Preserve all reviewed wood and attach old foliage to its nearest fine tip.
export function generateCrownBaseline(config,{refined=false,depth=true,lightDirection=-1}={}){
  const old=generate(config),tree=generateBranchDesign(config);
  if(tree.preset.id!=='juniper')return tree;
  const primaryLayers=[1,2,0,1,0,2];
  const woodDepth={};
  const sun=lightDirection<0?-1:1;
  const extent=Math.max(1,...old.clusters.map(c=>Math.abs(c.x-tree.root.x)));
  const tint=(hex,amount)=>{
    const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16)),target=amount>0?[242,239,205]:[23,38,28];
    return '#'+rgb.map((v,i)=>Math.round(v+(target[i]-v)*Math.abs(amount)).toString(16).padStart(2,'0')).join('');
  };
  const palettes=[['#2c4938','#41664b','#597d59','#789569'],
    ['#365139','#52764e','#6b905f','#8ba875'],
    ['#485e3b','#6c8954','#87a466','#a2bb7e']];
  const layerFor=n=>{
    const main=primaryLayers[tree.pads.findIndex(p=>p.id===n.pad)]??1;
    // Deliberate small-branch roles, not a separate random tint per leaf.
    const local=n.key?.includes('/t0')||n.key?.endsWith(':s0')?-1:0;
    return Math.max(0,main+local);
  };
  for(const n of tree.nodes)if(n.role!=='trunk')woodDepth[n.id]=layerFor(n)*2-2;
  tree.clusters=old.clusters.map(c=>{
    const tips=tree.nodes.filter(n=>n.pad===c.pad&&n.role==='twig');
    const n=tips.reduce((best,n)=>Math.hypot(c.x-n.ex,c.y-n.ey)<Math.hypot(c.x-best.ex,c.y-best.ey)?n:best);
    const dx=c.x-n.ex,dy=c.y-n.ey;
    // Keep the supporting tip inside the leaf volume. Only unsupported old
    // targets move; nearby ones retain the original distribution verbatim.
    const distance=Math.hypot(dx/c.rx,dy/c.ry),scale=Math.min(1,.72/Math.max(.001,distance));
    const age=old.pads.find(p=>p.id===c.pad).age;
    const sunExposure=Math.max(-1,Math.min(1,(n.ex-tree.root.x)/extent))*sun;
    const tone=(.5-age)*.22+sunExposure*.075;
    const next={...c,node:n.id,key:`restored:${c.key}`,x:n.ex+dx*scale,y:n.ey+dy*scale,ry:c.ry*1.25,
      crownAge:age,crownSun:sun,crownTone:tone,crownPosition:Math.max(-1,Math.min(1,(n.ex-tree.root.x)/extent)),crownLayer:layerFor(n),
      ...(depth?{crownLayer:layerFor(n),layerPalette:palettes[layerFor(n)].map(color=>tint(color,tone)),z:woodDepth[n.id]+.05}:{}),
      ...(refined?{rx:c.rx*1.04,contour:{...c.contour,rough:c.contour.rough*.65},
        crownShade:(n.z??0)<0?-.1:.04}:{})};
    // Connect to the underside at the tip's actual X, not to the lowest point
    // elsewhere on the crown. Let the fine tip enter the solid leaf volume;
    // reserving an air gap for individual leaves made the previous crowns float.
    const rim=Array.from({length:128},(_,i)=>canopyPoint(next,i*Math.PI/64,.94));
    const hits=[];
    for(let i=0;i<rim.length;i++){
      const a=rim[i],b=rim[(i+1)%rim.length];
      if((a.x<=n.ex&&b.x>n.ex)||(b.x<=n.ex&&a.x>n.ex))hits.push(a.y+(b.y-a.y)*(n.ex-a.x)/(b.x-a.x));
    }
    const underside=Math.max(...hits)-next.y;
    next.y=n.ey-underside+Math.min(3,next.ry*.2);
    return next;
  });
  // Store the unpruned support-group frame in cluster-relative coordinates.
  // Growth moves/scales it with the leaf; cutting a neighbour never recentres it.
  for(const c of tree.clusters){
    const group=tree.clusters.filter(p=>p.node===c.node);
    const left=Math.min(...group.map(p=>p.x-p.rx)),right=Math.max(...group.map(p=>p.x+p.rx));
    const top=Math.min(...group.map(p=>p.y-p.ry)),bottom=Math.max(...group.map(p=>p.y+p.ry));
    c.paintFrame={x:((left+right)/2-c.x)/c.rx,y:((top+bottom)/2-c.y)/c.ry,rx:(right-left)/2/c.rx,ry:(bottom-top)/2/c.ry};
  }
  tree.morphology=refined?'crown-restored-refined-1':'crown-restored-1';
  if(depth){tree.crownDesign='restored-depth-1';tree.crownWoodDepth=woodDepth;}
  tree.crownProtectWood=true;
  return tree;
}
