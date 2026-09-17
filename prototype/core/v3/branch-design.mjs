// Review-only candidate. Production keeps using morphology.mjs directly.
import {generate as current} from '../v2/morphology.mjs';
import {pointOn,sample} from '../v1/model.mjs';

export const BRANCH_STUDY_PRESETS=['juniper','broom','literati'];
export function generateBranchDesign(config,{allForms=false}={}){
  const tree=current(config),kind=tree.preset.id;
  if(!allForms&&!BRANCH_STUDY_PRESETS.includes(kind))return tree;
  const broad=kind==='broom',slender=kind==='literati';
  const originalClusters=tree.clusters;
  tree.nodes=tree.nodes.filter(n=>n.role!=='twig');tree.clusters=[];
  const byId=new Map(tree.nodes.map(n=>[n.id,n]));
  const random=(key,prop)=>sample(tree.config.seed,`branch-design:${kind}:${key}`,prop);
  // Support the apex continuously, without changing its centerline or base.
  // The same mapping at both ends keeps adjacent trunk segments seamless.
  if(!broad){
    const support=w=>w+(slender?4:5)*Math.max(0,1-w/12)**2;
    for(const n of tree.nodes.filter(n=>n.role==='trunk')){
      n.width=support(n.width);n.tipWidth=support(n.tipWidth);
    }
  }
  const primaries=tree.nodes.filter(n=>n.role==='primary');
  const crownTop=Math.min(...primaries.map(n=>n.ey)),crownBottom=Math.max(...primaries.map(n=>n.ey));
  const isApical=n=>n.ey<=crownTop+(crownBottom-crownTop)*.26;
  // Preserve the trunk centerline and every prunable branch identity. Width is inherited
  // at the actual junction, not from the old fixed, needle-thin tip width.
  for(const n of tree.nodes){
    if(n.role==='trunk')continue;
    const parent=byId.get(n.parent),t=n.attachment;
    const localWidth=parent.width+(parent.tipWidth-parent.width)*t;
    const apical=n.role==='primary'&&isApical(n);
    n.width=localWidth*(n.role==='bough'?.8:apical?.86:broad?.72:slender?.82:.58);
    n.tipWidth=n.width*(apical?.84:broad?.68:slender?.74:.59);
    n.branchOrder=n.role==='bough'?1:broad?2:1;
    if(!broad){
      n.cy1+=slender?3:7;n.cy2=n.ey+(slender?8:12);
    }
  }
  for(const [index,primary] of primaries.entries()){
    const apical=isApical(primary);
    const pad=tree.pads.find(p=>p.id===primary.pad),side=Math.sign(primary.ex-primary.x)||1;
    const templates=originalClusters.filter(c=>c.pad===pad.id);
    const terminals=[];
    function branch(parent,t,end,key,ratio,order,terminal=false){
      const start=pointOn(parent,t),dx=end.x-start.x,dy=end.y-start.y;
      const bend=(random(key,'bend')-.5)*(broad?8:5);
      const width=(parent.width+(parent.tipWidth-parent.width)*t)*ratio;
      const n={id:`study:${primary.id}:${key}`,key:`study:${primary.id}:${key}`,parent:parent.id,
        role:'twig',pad:pad.id,z:pad.z,branchOrder:order,attachment:t,depth:order-2,
        x:start.x,y:start.y,ex:end.x,ey:end.y,
        cx1:start.x+dx*.32,cy1:start.y+dy*.2+(broad?0:4),
        cx2:start.x+dx*.7+bend,cy2:end.y+(broad?Math.abs(dy)*.18:5),
        width,tipWidth:width*(terminal?(apical?.56:.45):(apical?.84:.7)),born:-100,duration:12};
      tree.nodes.push(n);return n;
    }
    // Two staggered branch groups: an inner short lift and an outer long line.
    // Broom fans open upward; conifers spread horizontally with lifted ends.
    for(let j=0;j<2;j++){
      const t=j===0?.48:.86,weight=.92+random(`${primary.id}:${j}`,'reach')*.16;
      const end=broad?{x:primary.ex+(j?1:-1)*pad.rx*.27*weight,y:primary.ey-pad.ry*(j?.49:.34)}:
        {x:primary.ex+side*pad.rx*(j?.46:-.12)*weight,y:primary.ey-pad.ry*(j?.23:.62)};
      // At the conifer apex, one long gesture replaces two shrinking levels.
      if(apical&&!broad){
        end.x+=side*pad.rx*.18;end.y-=pad.ry*.2;
        terminals.push(branch(primary,t,end,`s${j}`,j?.92:.82,primary.branchOrder+1,true));
        continue;
      }
      const secondary=branch(primary,t,end,`s${j}`,apical?(j?.92:.8):slender?(j?.9:.7):(j?.82:.58),primary.branchOrder+1);
      const count=slender&&index%2===0&&j===0?1:2;
      for(let k=0;k<count;k++){
        const target=broad?{x:end.x+(k?1:-1)*pad.rx*(k?.25:.15),y:end.y-pad.ry*(k?.29:.22)}:
          {x:end.x+side*pad.rx*(k?.28:-.06),y:end.y-pad.ry*(k?.13:.36)};
        const fine=broad&&!apical&&index%2===0&&j===1&&k===1;
        const tip=branch(secondary,k?.94:.68,target,`s${j}/t${k}`,apical?(k?.88:.76):(k?.76:.55),secondary.branchOrder+1,!fine);
        if(fine){
          for(let q=0;q<2;q++)terminals.push(branch(tip,1,{x:target.x+(q?1:-1)*pad.rx*.12,y:target.y-pad.ry*.16},`s${j}/t${k}/f${q}`,q?.76:.52,tip.branchOrder+1,true));
        }else terminals.push(tip);
      }
    }
    for(const [i,n] of terminals.entries()){
      const c=templates[Math.floor(i*templates.length/terminals.length)];
      tree.clusters.push({...c,key:n.key,node:n.id,x:n.ex,y:n.ey,
        rx:pad.rx*(broad?.3:slender?.43:.34),ry:pad.ry*(broad?.32:.52),
        leafBudget:Math.min(2.1,c.leafBudget??1),born:-100,leafAmount:1});
    }
  }
  // Resolve parents first: children must attach to the revised curve, not its
  // old position. Keep all branch ends (and therefore the leaf silhouette).
  const connected=new Map(tree.nodes.map(n=>[n.id,n])),settled=new Set();
  function soften(n){
    if(settled.has(n.id))return;
    settled.add(n.id);
    if(n.role==='trunk'||!n.parent)return;
    const parent=connected.get(n.parent);soften(parent);
    const t=n.attachment,p=pointOn(parent,t);
    const a=pointOn(parent,Math.max(0,t-.001)),b=pointOn(parent,Math.min(1,t+.001));
    const heading=Math.atan2(b.y-a.y,b.x-a.x);
    const dx=n.ex-p.x,dy=n.ey-p.y,length=Math.hypot(dx,dy);
    const target=Math.atan2(dy,dx);
    const turn=Math.atan2(Math.sin(target-heading),Math.cos(target-heading));
    // Begin along the parent's flow, then open into the side branch. A bounded
    // departure angle avoids right-angle elbows and backward hooks at forks.
    const departure=heading+Math.max(-.65,Math.min(.65,turn*.55));
    const handle=length*.32;
    n.x=p.x;n.y=p.y;
    n.cx1=p.x+Math.cos(departure)*handle;n.cy1=p.y+Math.sin(departure)*handle;
    n.cx2=(n.cx2+n.ex-dx*.25)/2;n.cy2=(n.cy2+n.ey-dy*.25)/2;
  }
  tree.nodes.forEach(soften);
  tree.morphology='branch-review-3';return tree;
}
