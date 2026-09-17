import {generate as reference} from './core/v1/canopy.mjs';
import {sample,pointOn} from './core/v1/model.mjs';

// Art-directed proportions, not biological species growth rates. Keep the
// frozen v1 scaffold and node identities available for historical comparisons.
export const MORPHOLOGY={
  juniper:{base:58,taper:1.55,movement:1.3,spread:1.08,flat:.68,clusterX:1.12,clusterY:.63,rough:.22,form:'扭转粗干 · 错落云片',note:'根盘扎实，干线转折处出枝；叶层扁阔，大小相间。'},
  broom:{base:47,taper:1.15,movement:.8,spread:1.03,flat:1,clusterX:.95,clusterY:.83,rough:.14,form:'短干分叉 · 扇形圆顶',note:'短壮主干托起分级枝序；保留圆顶，边缘有起伏和透光。'},
  literati:{base:19,taper:1.25,movement:1.12,spread:.88,flat:.72,clusterX:.89,clusterY:.62,rough:.2,form:'细长曲干 · 疏枝小冠',note:'长裸干保留清瘦感；小冠偏置，枝下留出大片空白。'},
  pine:{base:65,taper:1.65,movement:.55,spread:1.04,flat:.72,clusterX:1.02,clusterY:.65,rough:.25,form:'敦厚直干 · 不等层三角冠',note:'粗壮根部向上明显收尖；低枝宽展，上层逐渐紧凑。'},
  slant:{base:57,taper:1.55,movement:1.16,spread:1.03,flat:.73,clusterX:1.08,clusterY:.64,rough:.23,form:'斜势重干 · 回拉平衡枝',note:'主干倾斜但有重量；反向低枝平衡偏冠，避免整树平移。'},
  cascade:{base:53,taper:1.48,movement:1.09,spread:.94,flat:.72,clusterX:1.04,clusterY:.65,rough:.23,form:'折返粗根 · 递减悬枝',note:'先抬头再折落；下行干线持续变细，叶层沿弯外侧展开。'},
  windswept:{base:47,taper:1.5,movement:1.02,spread:1.06,flat:.5,clusterX:1.3,clusterY:.55,rough:.26,form:'低伏斜干 · 顺风长梢',note:'枝干和叶梢向同一侧延伸；压低冠层，强化迎风空白。'}
};

function attachment(parent,node){
  let at=0,best=Infinity;
  for(let i=0;i<=100;i++){const p=pointOn(parent,i/100),d=Math.hypot(p.x-node.x,p.y-node.y);if(d<best){best=d;at=i/100;}}
  return at;
}

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// Long-term directional light, not today's sky color. Upper pads intercept
// rays toward the source; older branch capacity and light-driven vigor differ.
export function crownEnvironment(pads,lightDirection){
  return new Map(pads.map(p=>{
    let shade=0;
    for(const other of pads){
      const rise=p.y-other.y;if(rise<=12)continue;
      const rayX=p.x+rise*lightDirection;
      const overlap=clamp(1-Math.abs(rayX-other.x)/(p.rx*.6+other.rx),0,1);
      shade+=overlap*.42*Math.exp(-rise/260);
    }
    shade=clamp(shade,0,.72);
    const facing=Math.sign(p.side)*lightDirection;
    const exposure=clamp((.86+facing*.16)*(1-shade),.25,1);
    return [p.id,{age:p.age,shade,exposure,lightDirection}];
  }));
}

export function generate(config,{lightDirection}={}){
  const tree=reference(config),style=MORPHOLOGY[tree.preset.id],{root}=tree;
  const rand=(key,prop)=>sample(tree.config.seed,`morphology:${tree.preset.id}:${key}`,prop);
  const original=new Map(tree.nodes.map(n=>[n.id,{...n}])),mapped=new Map();
  const trunks=tree.nodes.filter(n=>n.role==='trunk');
  const lengths=trunks.map(n=>{let length=0,prev=pointOn(n,0);for(let i=1;i<=24;i++){const p=pointOn(n,i/24);length+=Math.hypot(p.x-prev.x,p.y-prev.y);prev=p;}return length;});
  const total=lengths.reduce((a,b)=>a+b,0),girth=style.base*(.9+rand('tree','girth')*.2);
  const lean=(rand('tree','lean')-.5)*(tree.preset.id==='pine'?9:26);
  const height=.95+rand('tree','height')*.1;
  const move=(x,y)=>({x:root.x+(x-root.x)*style.movement+lean*(root.y-y)/330,y:root.y+(y-root.y)*height*(tree.preset.id==='windswept'?.86:1)});
  let distance=0;const axis=new Map();
  for(const [i,n] of trunks.entries()){
    // A broom's trunk ends at the fan junction, not at a fine apical shoot.
    const tip=tree.preset.id==='broom'?12:2;
    const width=t=>tip+(girth-tip)*(1-t)**style.taper;
    const next={...n,width:width(distance/total),tipWidth:width((distance+lengths[i])/total)};
    for(const [x,y] of [['x','y'],['cx1','cy1'],['cx2','cy2'],['ex','ey']]){const p=move(n[x],n[y]);next[x]=p.x;next[y]=p.y;}
    axis.set(n.id,{start:distance,length:lengths[i]});
    mapped.set(n.id,next);distance+=lengths[i];
  }
  const primaries=tree.nodes.filter(n=>n.role==='primary');
  const positions=primaries.map(n=>{
    let child=n,parent=original.get(n.parent);
    while(parent.role!=='trunk'){child=parent;parent=original.get(parent.parent);}
    const a=axis.get(parent.id);return a.start+a.length*attachment(parent,child);
  });
  const first=Math.min(...positions),last=Math.max(...positions);
  const ecology=crownEnvironment(tree.pads.map(p=>{
    const i=primaries.findIndex(n=>n.pad===p.id),branch=primaries[i];
    return {...p,side:branch.ex-branch.x,
      age:tree.preset.id==='broom'?.65:1-(positions[i]-first)/Math.max(1,last-first)};
  }),Number.isFinite(lightDirection)?clamp(lightDirection,-1,1):(rand('tree','sun')<.5?-1:1)*(.45+rand('tree','sun-angle')*.35));
  const vigor=.94+rand('tree','crown-vigor')*.2;
  // A single transform per pad carries its entire branch family. Parent
  // attachment parameters are retained, including mid-curve attachments.
  const transforms=new Map(tree.pads.map((p,i)=>{
    const environment=ecology.get(p.id),{age,exposure}=environment;
    const restrained=tree.preset.id==='literati',broom=tree.preset.id==='broom',wind=tree.preset.id==='windswept';
    const mass=(broom?1.23:restrained?1.16+age*.18:1.3+age*.65)*vigor*(.9+exposure*.14);
    return [p.id,{
    x:style.spread*(.83+rand(`pad${i}`,'span')*.29),
    y:style.flat*(.84+rand(`pad${i}`,'height')*.3),
    crownX:(broom?1.04:restrained?1.07:wind?1.03+age*.18:1.1+age*.28)*(.95+exposure*.07),
    mass,massY:mass*(broom?1:1.12+age*.12),environment,
    slope:(rand(`pad${i}`,'slope')-.5)*.2+(tree.preset.id==='windswept'?-.13:0)
  }];}));
  function transform(n){
    if(mapped.has(n.id))return mapped.get(n.id);
    const parent=original.get(n.parent),grown=transform(parent),t=attachment(parent,n),start=pointOn(grown,t);
    const a=transforms.get(n.pad)??{x:1,y:1,slope:0};
    // Broadleaf boughs rise; conifer primary branches sag before their tips lift.
    const primary=n.role==='primary',broad=tree.preset.id==='broom';
    const sx=primary&&!broad?a.x*(tree.preset.id==='windswept'?.73:.89):a.x*(n.role==='twig'?a.crownX:1),sy=primary?1:a.y;
    const next={...n,x:start.x,y:start.y};
    for(const [x,y] of [['cx1','cy1'],['cx2','cy2'],['ex','ey']]){
      next[x]=start.x+(n[x]-n.x)*sx;
      next[y]=start.y+(n[y]-n.y)*sy+(n[x]-n.x)*a.slope;
      if(n.role==='twig'){
        const lift=Math.max(0,n.y-n[y]);
        next[x]+=lift*a.environment.lightDirection*.1*a.environment.exposure;
      }
    }
    if(primary&&!broad){next.cy1+=9;next.cy2+=5;}
    const parentWidth=grown.width+(grown.tipWidth-grown.width)*t;
    next.width=Math.min(parentWidth*.58,n.width*(n.role==='bough'?1.7:primary?1.65:1.08));
    next.tipWidth=Math.min(next.width*.72,n.tipWidth*(primary?1.2:1));
    next.attachment=t;
    mapped.set(n.id,next);return next;
  }
  tree.nodes=tree.nodes.map(transform);
  tree.clusters=tree.clusters.map(c=>{
    const old=original.get(c.node),n=mapped.get(c.node),a=transforms.get(c.pad);
    const size=.78+rand(c.key,'size')*.38;
    return {...c,x:n.ex+(c.x-old.ex)*a.x,y:n.ey+(c.y-old.ey)*a.y,
      rx:c.rx*style.clusterX*size*a.mass,ry:c.ry*style.clusterY*size*a.massY,
      foliageDensity:.72+a.environment.exposure*.32,
      leafBudget:Math.min(2.1,a.mass*a.massY),
      contour:{rough:style.rough,phase:rand(c.key,'phase')*Math.PI*2,
        skew:(rand(c.key,'skew')-.5)*.3-a.environment.lightDirection*.2,slope:a.slope,
        flat:tree.preset.id!=='broom',wind:tree.preset.id==='windswept'}};
  });
  tree.pads=tree.pads.map(p=>{
    const clusters=tree.clusters.filter(c=>c.pad===p.id);
    const minX=Math.min(...clusters.map(c=>c.x-c.rx)),maxX=Math.max(...clusters.map(c=>c.x+c.rx));
    const minY=Math.min(...clusters.map(c=>c.y-c.ry)),maxY=Math.max(...clusters.map(c=>c.y+c.ry));
    return {...p,x:(minX+maxX)/2,y:(minY+maxY)/2,rx:(maxX-minX)/2,ry:(maxY-minY)/2,...ecology.get(p.id)};
  });
  tree.morphology='character-2';
  return tree;
}

// One envelope for both the opaque core and individual leaves: a serrated
// crown must not have an ellipse of leaves floating outside its new outline.
export function canopyPoint(c,angle,radius=1){
  const s=c.contour;
  if(!s)return {x:c.x+Math.cos(angle)*c.rx*radius,y:c.y+Math.sin(angle)*c.ry*radius};
  const wave=1+s.rough*(.55*Math.sin(3*angle+s.phase)+.3*Math.sin(5*angle-s.phase)+.15*Math.cos(9*angle+s.phase));
  const u=Math.cos(angle),v=Math.sin(angle);
  const x=u*c.rx*wave*radius*(1+s.skew*v);
  const y=v*c.ry*wave*radius*(s.flat&&v>0?.52:1);
  return {x:c.x+x+(s.wind?-v*c.rx*.18*radius:0),y:c.y+y+x*s.slope};
}
