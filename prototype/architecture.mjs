import {generate as inherited} from './morphology.mjs';
import {pointOn,sample} from './core/v1/model.mjs';

// Review version: inherit the trained scaffold, ecological crown envelopes,
// seeded samples and renderer contract. Production growth remains versioned.
export const ARCHITECTURE={
  juniper:{sx:1.1,sy:1,shear:0,girth:1.08,leaf:.72,form:'曲干有力 · 云片错落',note:'强调干线转折、横向枝片和不等大的留白；细枝托起鳞叶云片。'},
  broom:{sx:1.09,sy:1,shear:0,girth:1,leaf:.67,form:'短干放射 · 细枝圆顶',note:'从短干分出三组大枝，小枝向外上方展开；无叶时仍读得出圆顶。'},
  literati:{sx:1.06,sy:1.09,shear:0,girth:.76,leaf:.58,form:'瘦干长留白 · 顶部三小冠',note:'只保留高处三组枝片，拉长裸干、缩小冠幅，让空白成为树形的一部分。'},
  pine:{sx:1.08,sy:1,shear:0,girth:1.16,leaf:.72,form:'粗根直干 · 下宽上窄',note:'敦厚根盘与直立主轴，低枝宽、顶枝短；针叶成束，层间透出干线。'},
  slant:{sx:1,sy:.96,shear:.16,girth:1.02,leaf:.72,form:'明显斜势 · 反向平衡枝',note:'树冠偏出根盘，保留反向低枝；上下枝仍向光生长，不把所有枝条吹向一边。'},
  cascade:{sx:1.02,sy:1.08,shear:0,girth:1.02,leaf:.7,form:'先抬后落 · 梢低于盆底',note:'根部抬头后折返下垂，沿垂干交错出枝；末梢低于深盆，叶片保持向上承光。'},
  windswept:{sx:1.15,sy:.72,shear:.17,girth:.94,leaf:.7,form:'低伏偏冠 · 枝梢同向',note:'压低树高并拉长顺风枝；所有小枝向下风侧展开，迎风侧留下明显空白。'}
};
const mean=points=>({x:points.reduce((s,p)=>s+p.x,0)/points.length,y:points.reduce((s,p)=>s+p.y,0)/points.length});
export function reviewFrame(tree){
  const cascade=tree.preset.id==='cascade',wind=tree.preset.id==='windswept';
  return {x:tree.root.x-(cascade?235:wind?165:380),y:tree.root.y-(cascade?195:440),width:cascade?650:wind?680:760,height:cascade?530:620};
}
export function generateArchitecture(input={}, {character=1}={}){
  const strength=Math.max(0,Math.min(1.4,Number.isFinite(character)?character:1));
  const tree=inherited({...input,...(input.preset==='literati'?{crownCount:3}:{})});
  if(input.pot)tree.config.pot=input.pot;
  const style=ARCHITECTURE[tree.preset.id],broad=tree.preset.id==='broom',wind=tree.preset.id==='windswept';
  const sx=1+(style.sx-1)*strength,sy=1+(style.sy-1)*strength,shear=style.shear*strength;
  const transform=(x,y)=>({x:tree.root.x+(x-tree.root.x)*sx+(tree.root.y-y)*shear,y:tree.root.y+(y-tree.root.y)*sy});
  const rand=(key,p)=>sample(tree.config.seed,`architecture:${tree.preset.id}:${key}`,p);
  const originalClusters=tree.clusters;
  tree.nodes=tree.nodes.filter(n=>n.role!=='twig').map(n=>{
    const q={...n,regrowthPad:n.pad??tree.nodes.find(child=>child.parent===n.id&&child.pad!==undefined)?.pad,
      order:n.role==='trunk'?0:n.role==='bough'?1:broad?2:1,
      attach:n.role==='trunk'?1:n.attachment,leaves:false,pending:false,scar:false};
    for(const [x,y] of [['x','y'],['cx1','cy1'],['cx2','cy2'],['ex','ey']]){const p=transform(n[x],n[y]);q[x]=p.x;q[y]=p.y;}
    q.width*=1+(style.girth-1)*strength;q.tipWidth*=1+(style.girth-1)*strength;
    return q;
  });
  tree.clusters=[];
  function add(parent,attach,end,id,order){
    const start=pointOn(parent,attach),dx=end.x-start.x,dy=end.y-start.y;
    const width=(parent.width+(parent.tipWidth-parent.width)*attach)*.86;
    const n={id,key:id,parent:parent.id,pad:parent.pad,z:parent.z,role:'twig',order,attach,attachment:attach,
      x:start.x,y:start.y,ex:end.x,ey:end.y,cx1:start.x+dx*.32,cy1:start.y+dy*.2,
      cx2:start.x+dx*.72,cy2:start.y+dy*.75,width,tipWidth:width*.9,born:-100,duration:12,
      leaves:false,pending:false,scar:false};tree.nodes.push(n);return n;
  }
  function divide(parent,points,id){
    const center=mean(points),terminal=points.length===1;
    const end=terminal?center:{x:parent.ex+(center.x-parent.ex)*.54,y:parent.ey+(center.y-parent.ey)*.54};
    if(wind)end.x=Math.max(end.x,parent.ex+1.5);
    const n=add(parent,1,end,id,parent.order+1);
    if(terminal){
      const c=points[0];n.leaves=true;
      tree.clusters.push({...c,node:n.id,key:id,x:n.ex,y:n.ey,rx:c.rx*style.leaf,ry:c.ry*style.leaf,
        leafBudget:.48,foliageDensity:tree.preset.kind==='scale'?.94:.67,born:-100,leafAmount:1});return;
    }
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y),axis=Math.max(...xs)-Math.min(...xs)>Math.max(...ys)-Math.min(...ys)?'x':'y';
    const sorted=[...points].sort((a,b)=>a[axis]-b[axis]),half=Math.ceil(sorted.length/2);
    divide(n,sorted.slice(0,half),id+'a');divide(n,sorted.slice(half),id+'b');
  }
  for(const p of [...tree.nodes].filter(n=>n.role==='primary')){
    const points=originalClusters.filter(c=>c.pad===p.pad).map(c=>({...c,...transform(c.x,c.y),
      rx:c.rx*sx,ry:c.ry*sy,contour:{...c.contour,slope:(c.contour?.slope??0)*sy/sx}}));
    if(broad){divide(p,points,`${p.id}:fine`);continue;}
    // Three separately selectable lateral axes distribute crown space along
    // the parent. Finer binary forks keep the previous crown-target strategy.
    const side=Math.sign(p.ex-p.x)||1;
    points.sort((a,b)=>side*(a.x-b.x));
    const count=tree.preset.id==='literati'?2:3;
    for(let i=0;i<count;i++){
      const group=points.slice(Math.floor(i*points.length/count),Math.floor((i+1)*points.length/count));
      const attach=.34+i*.5/(count-1)+(rand(p.id+i,'attach')-.5)*.06,start=pointOn(p,attach),center=mean(group);
      const end={x:start.x+(center.x-start.x)*.56,y:start.y+(center.y-start.y)*.56};
      if(wind)end.x=Math.max(end.x,start.x+8);
      const small=add(p,attach,end,`${p.id}:small${i}`,2);
      divide(small,group,`${small.id}:fine`);
    }
  }
  tree.architecture='branch-review-2';tree.character=strength;tree.hour=100;tree.flush=0;tree.serial=0;
  tree.seed=tree.config.seed;tree.species=tree.preset.kind==='broad'?'elm':tree.preset.kind==='scale'?'juniper':'pine';
  tree.viewBox=reviewFrame(tree);return tree;
}

// Biological depth remains in the graph. Only these two axes are selectable.
export function selectableBranches(tree,level){return tree.nodes.filter(n=>n.order===level&&(level===1||level===2));}
