import {generateCrownBaseline} from './crown-baseline.mjs';
import {pointOn,sample} from './core/v1/model.mjs';

// Review-only bonsai proportions. Existing IDs remain the pruning contract.
export function generateTrunkDesign(config){
  const tree=generateCrownBaseline(config);
  if(tree.preset.id!=='juniper')return tree;
  const old=new Map(tree.nodes.map(n=>[n.id,{...n}]));
  const removed=new Set(tree.nodes.filter(n=>n.role==='twig'&&n.key.includes('/t')).map(n=>n.id));
  tree.nodes=tree.nodes.filter(n=>!removed.has(n.id));
  const trunks=tree.nodes.filter(n=>n.role==='trunk');
  const height=tree.root.y-Math.min(...trunks.map(n=>n.ey));
  const width=(w,y)=>w*(1.12+.48*Math.max(0,Math.min(1,(y-(tree.root.y-height))/height))**1.4);
  for(const n of trunks){
    const source=old.get(n.id);
    for(const [x,y]of [['x','y'],['cx1','cy1'],['cx2','cy2'],['ex','ey']]){
      n[x]=tree.root.x+(source[x]-tree.root.x)*1.55;
      n[y]=tree.root.y+(source[y]-tree.root.y)*.80;
    }
    n.width=width(source.width,source.y);n.tipWidth=width(source.tipWidth,source.ey);
  }
  const index=new Map(tree.nodes.map(n=>[n.id,n])),done=new Set(trunks.map(n=>n.id));
  function attach(n){
    if(done.has(n.id))return;
    const parent=index.get(n.parent);attach(parent);
    const source=old.get(n.id),anchor=pointOn(parent,n.attachment);
    const primary=n.role==='primary',outer=n.key.endsWith(':s1');
    const reach=primary?1.06:outer?1.46:1.26;
    let dx=(source.ex-source.x)*reach,dy=(source.ey-source.y)*(primary?.80:1.35);
    const upper=Math.max(0,Math.min(1,((tree.root.y-source.y)/height-.62)/.38));
    const apexReach=1+.15*upper*upper*(3-2*upper);
    dx*=apexReach;dy*=apexReach;
    if(!primary){
      const length=Math.hypot(dx,dy),side=Math.sign(dx)||Math.sign(parent.ex-parent.x)||1;
      const elevation=((outer?27:40)+sample(tree.config.seed,n.id,'branch-lift')*8)*Math.PI/180;
      dx=side*length*Math.cos(elevation);dy=-length*Math.sin(elevation);
    }
    n.x=anchor.x;n.y=anchor.y;n.ex=anchor.x+dx;n.ey=anchor.y+dy;
    const a=pointOn(parent,Math.max(0,n.attachment-.002)),b=pointOn(parent,Math.min(1,n.attachment+.002));
    const heading=Math.atan2(b.y-a.y,b.x-a.x),target=Math.atan2(dy,dx);
    const turn=Math.atan2(Math.sin(target-heading),Math.cos(target-heading));
    const departure=heading+Math.max(-.65,Math.min(.65,turn*.55)),handle=Math.hypot(dx,dy)*.30;
    n.cx1=anchor.x+Math.cos(departure)*handle;n.cy1=anchor.y+Math.sin(departure)*handle;
    n.cx2=n.ex-dx*.28;n.cy2=n.ey+(primary?15:9);
    if(!primary){
      const length=Math.hypot(dx,dy),exit=heading+Math.max(-.20,Math.min(.20,turn*.22));
      const initial=length*(outer?.38:.32);
      n.cx1=anchor.x+Math.cos(exit)*initial;
      n.cy1=anchor.y+Math.sin(exit)*initial;
      const side=Math.sign(dx)||1,tipElevation=(outer?54:66)*Math.PI/180;
      n.cx2=n.ex-side*Math.cos(tipElevation)*length*.30;
      n.cy2=n.ey+Math.sin(tipElevation)*length*.30;
    }
    const local=parent.width+(parent.tipWidth-parent.width)*n.attachment;
    n.width=Math.min(local*.88,Math.max(primary?source.width*1.10:source.width*1.55,primary?5:4.2));
    n.tipWidth=n.width*(primary?.72:.62);
    done.add(n.id);
  }
  tree.nodes.forEach(attach);
  tree.clusters=tree.clusters.map(c=>{
    const before=old.get(c.node),target=removed.has(c.node)?before.parent:c.node,after=index.get(target);
    return {...c,node:target,x:c.x+after.ex-before.ex,y:c.y+after.ey-before.ey};
  });
  for(const parent of tree.nodes.filter(n=>n.role==='twig')){
    // A new apical branch has not had enough development time to ramify again.
    // Retain the reviewed curves; only older primary families gain tier three.
    let primary=parent;
    while(primary.role!=='primary'&&primary.parent)primary=index.get(primary.parent);
    const formation=trunks.findIndex(n=>n.id===primary.parent)+(primary.attachment??1);
    const relativeAge=Math.max(0,1-formation/trunks.length);
    if(relativeAge<.30)continue;
    const outer=parent.key.endsWith(':s1');
    const t=outer?.58:.68,p=pointOn(parent,t);
    const a=pointOn(parent,t-.002),b=pointOn(parent,t+.002);
    const heading=Math.atan2(b.y-a.y,b.x-a.x),side=Math.sign(parent.ex-parent.x)||1;
    const length=Math.max(13,Math.min(36,Math.hypot(parent.ex-parent.x,parent.ey-parent.y)*(outer?.64:.52)));
    const elevation=(outer?65:25)*Math.PI/180,dx=side*Math.cos(elevation)*length,dy=-Math.sin(elevation)*length;
    const target=Math.atan2(dy,dx),turn=Math.atan2(Math.sin(target-heading),Math.cos(target-heading));
    const departure=heading+Math.max(-.18,Math.min(.18,turn*.25));
    const local=parent.width+(parent.tipWidth-parent.width)*t;
    const n={...parent,id:`${parent.id}:sprig`,key:`${parent.key}:sprig`,parent:parent.id,attachment:t,branchOrder:parent.branchOrder+1,studyTier:3,
      x:p.x,y:p.y,ex:p.x+dx,ey:p.y+dy,
      cx1:p.x+Math.cos(departure)*length*.34,cy1:p.y+Math.sin(departure)*length*.34,
      cx2:p.x+dx*.72,cy2:p.y+dy*.65,width:local*.82,tipWidth:0};
    n.tipWidth=n.width*.64;tree.nodes.push(n);
    tree.crownWoodDepth[n.id]=tree.crownWoodDepth[parent.id];
    let count=0;
    for(const c of tree.clusters.filter(c=>c.node===parent.id))if(count++%3===0){
      c.x+=n.ex-parent.ex;c.y+=n.ey-parent.ey;c.node=n.id;
    }
  }
  tree.morphology='trunk-review-10';
  return tree;
}
