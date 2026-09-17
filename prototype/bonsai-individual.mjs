import {sample,pointOn} from './core/v1/model.mjs';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const coords=[['x','y'],['cx1','cy1'],['cx2','cy2'],['ex','ey']];
// Tier 0 is the trunk; branch tiers count actual forks, not trunk segments.
// Absolute bounds are mature SVG units; growth scales them with the tree.
export const BRANCH_WIDTH_BANDS=[
  null,
  // Carrying limbs taper before the next fork; second-tier bases carry more
  // of that local thickness, without raising their absolute width ceiling.
  {min:3.4,max:22,ratio:[.30,.52],base:.32,slenderness:.18,tip:[.50,.54]},
  {min:2.0,max:9,ratio:[.58,.78],base:.16,slenderness:.18,tip:[.55,.72]},
  {min:1.2,max:5.2,ratio:[.40,.67],base:.09,slenderness:.16,tip:[.52,.70]},
  {min:.8,max:3.2,ratio:[.38,.64],base:.055,slenderness:.15,tip:[.50,.68]}
];
// Curated proportions in mature SVG units. Shared width ceilings stay intact;
// each trained gesture gets its own trunk balance and branch length envelope.
export const FORM_PROPORTIONS={
  juniper:{trunk:1.02,girth:.86,tip:.065,lengths:[[40,125],[24,64],[14,35],[9,23]]},
  broom:{trunk:1,girth:.98,tip:.36,lengths:[[38,105],[38,88],[18,44],[10,28]]},
  literati:{trunk:1,girth:1,tip:.12,lengths:[[28,75],[18,36],[11,24],[8,18]]},
  pine:{trunk:.94,girth:.94,tip:.07,lengths:[[28,136],[20,48],[12,30],[9,22]]},
  slant:{trunk:.97,girth:.91,tip:.075,lengths:[[28,130],[20,48],[12,30],[9,22]]},
  cascade:{trunk:1.08,girth:.84,tip:.075,lengths:[[30,80],[18,40],[12,26],[9,20]]},
  windswept:{trunk:1,girth:.95,tip:.085,lengths:[[36,145],[24,60],[14,34],[10,24]]}
};
export function branchLength(n){
  let length=0,previous=pointOn(n,0);
  for(let i=1;i<=16;i++){const p=pointOn(n,i/16);length+=Math.hypot(p.x-previous.x,p.y-previous.y);previous=p;}
  return length;
}
function fitBranchLength(n,parent,profile){
  const tier=(parent.branchTier??0)+1,band=profile.lengths[Math.min(tier,4)-1];
  const upper=Math.min(band[1],parent.role==='trunk'?Infinity:branchLength(parent)*1.25);
  const lower=Math.min(band[0],upper),length=branchLength(n);
  const scale=clamp(length,lower,upper)/Math.max(.001,length);
  for(const [x,y]of coords.slice(1)){n[x]=n.x+(n[x]-n.x)*scale;n[y]=n.y+(n[y]-n.y)*scale;}
}
function sizeBranch(n,parent,baseWidth,weight){
  const tier=(parent.branchTier??0)+1,band=BRANCH_WIDTH_BANDS[Math.min(tier,4)];
  const local=parent.width+(parent.tipWidth-parent.width)*n.attachment;
  const length=branchLength(n);
  const upper=Math.min(band.max,baseWidth*band.base,local*band.ratio[1],length*band.slenderness);
  // A thin parent takes precedence over the readability floor at a young tip.
  const lower=Math.min(upper,Math.max(band.min,local*band.ratio[0]));
  const taper=clamp(n.tipWidth/n.width,...band.tip);
  n.branchTier=tier;n.width=lower+(upper-lower)*clamp(weight,0,1);n.tipWidth=n.width*taper;
}
const rules={
  juniper:{count:[4,8],bend:27,lean:.14,height:.16,girth:.28},
  broom:{count:[5,10],bend:9,lean:.10,height:.15,girth:.24},
  literati:{count:[2,4],bend:33,lean:.17,height:.18,girth:.25},
  pine:{count:[5,8],bend:10,lean:.10,height:.16,girth:.28},
  slant:{count:[4,7],bend:17,lean:.14,height:.14,girth:.26},
  cascade:{count:[3,6],bend:19,lean:.10,height:.16,girth:.25},
  windswept:{count:[4,7],bend:14,lean:.11,height:.13,girth:.24}
};
export function individualOptions(input={}){
  const number=(value,fallback)=>Number.isFinite(value)?clamp(value,0,1):fallback;
  return {variation:number(input.variation,.55),density:number(input.density,.5)};
}

// A seed describes an individual, not an index into a list of specimens.
// Low-frequency trunk motion and stratified buds avoid independent white noise.
export function individualPlan(preset,seed,input={}){
  const {variation:v,density}=individualOptions(input),rule=rules[preset]??rules.juniper;
  const rand=(key,property)=>sample(seed,`individual:${preset}:${key}`,property);
  const signed=(key,property)=>rand(key,property)*2-1;
  const [min,max]=rule.count;
  const count=clamp(Math.round(min+(max-min)*density+signed('tree','count')*(.65+v)),min,max);
  const weights=Array.from({length:count-1},(_,i)=>1+signed(i,'spacing')*.4*v);
  const total=weights.reduce((sum,w)=>sum+w,0);let position=0;
  const buds=Array.from({length:count},(_,i)=>{
    const u=position/total;if(i<count-1)position+=weights[i];
    return {u,reach:1+signed(i,'reach')*.26*v,angle:signed(i,'angle')*.19*v,
      girth:1+signed(i,'girth')*.22*v,detail:rand(i,'detail'),tempo:.86+rand(i,'tempo')*.28,
      attachment:signed(i,'attachment')*.12*v};
  });
  return {variation:v,density,count,buds,lean:signed('tree','lean')*rule.lean*v,
    height:1+signed('tree','height')*rule.height*v,
    girth:1+signed('tree','girth')*rule.girth*v,
    bend:signed('tree','bend')*rule.bend*v,phase:rand('tree','phase')*Math.PI*2,
    taper:1+signed('tree','taper')*.26*v,
    rhythm:1+signed('tree','rhythm')*.24*v,
    mirror:!['pine','broom'].includes(preset)&&rand('tree','mirror')<.45};
}

function trunkArc(trunks){
  const entries=[];let length=0;
  for(const n of trunks){
    let prev=pointOn(n,0);
    for(let i=1;i<=24;i++){
      const p=pointOn(n,i/24),span=Math.hypot(p.x-prev.x,p.y-prev.y);
      entries.push({n,t0:(i-1)/24,t1:i/24,start:length,span});length+=span;prev=p;
    }
  }
  return {length,at(u){
    const d=clamp(u,0,1)*length,e=entries.find(e=>d<=e.start+e.span)??entries.at(-1);
    const t=e.t0+(e.t1-e.t0)*clamp((d-e.start)/Math.max(.001,e.span),0,1);
    return {node:e.n,t,...pointOn(e.n,t)};
  },position(n,t){
    const e=entries.find(e=>e.n.id===n.id&&t<=e.t1)??entries.at(-1);
    return (e.start+e.span*clamp((t-e.t0)/(e.t1-e.t0),0,1))/length;
  }};
}

export function diversify(tree,input={}){
  const plan=individualPlan(tree.preset.id,tree.config.seed,input),v=plan.variation;
  if(v===0)return tree; // Explicit reference mode for visual regression.
  const kind=tree.preset.id,root=tree.root,source=new Map(tree.nodes.map(n=>[n.id,n])),proportions=FORM_PROPORTIONS[kind];
  const oldTrunks=tree.nodes.filter(n=>n.role==='trunk'),oldArc=trunkArc(oldTrunks);
  const primaries=tree.nodes.filter(n=>n.role==='primary');
  const rand=(key,p)=>sample(tree.config.seed,`individual:${kind}:${key}`,p);
  // Shared knot/tangent construction keeps neighbouring trunk pieces C1.
  const knots=[{x:root.x,y:root.y},...oldTrunks.map(n=>({x:n.ex,y:n.ey}))];
  const cumulative=[0];
  for(let i=1;i<knots.length;i++)cumulative.push(cumulative[i-1]+Math.hypot(knots[i].x-knots[i-1].x,knots[i].y-knots[i-1].y));
  const total=cumulative.at(-1),cos=Math.cos(plan.lean),sin=Math.sin(plan.lean);
  const points=knots.map((p,i)=>{
    const u=cumulative[i]/total,dx=p.x-root.x,dy=p.y-root.y;
    const wave=plan.bend*Math.sin(Math.PI*u)*Math.sin(Math.PI*2*u+plan.phase);
    return {x:root.x+((dx*cos-dy*sin)*plan.rhythm+wave)*proportions.trunk,y:root.y+(dx*sin+dy*cos)*plan.height*proportions.trunk};
  });
  const tangent=i=>{
    const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
    return {x:(b.x-a.x)/(i===0||i===points.length-1?1:2),y:(b.y-a.y)/(i===0||i===points.length-1?1:2)};
  };
  const baseWidth=oldTrunks[0].width*plan.girth*proportions.girth;
  const tipWidth=Math.max(oldTrunks.at(-1).tipWidth*plan.girth*proportions.girth,baseWidth*proportions.tip);
  const referenceWidths=[oldTrunks[0].width,...oldTrunks.map(n=>n.tipWidth)];
  const widths=referenceWidths.map(w=>tipWidth+(baseWidth-tipWidth)*Math.pow(clamp((w-oldTrunks.at(-1).tipWidth)/(oldTrunks[0].width-oldTrunks.at(-1).tipWidth),0,1),plan.taper));
  const nodes=oldTrunks.map((n,i)=>{
    const a=points[i],b=points[i+1],ta=tangent(i),tb=tangent(i+1);
    return {...n,x:a.x,y:a.y,ex:b.x,ey:b.y,cx1:a.x+ta.x/3,cy1:a.y+ta.y/3,cx2:b.x-tb.x/3,cy2:b.y-tb.y/3,
      width:widths[i],tipWidth:widths[i+1],attachment:n.parent?1:undefined,branchTier:0,
      growthTempo:.85+rand(n.id,'tempo')*.3,growthDelay:rand(n.id,'delay')*.12};
  });
  const arc=trunkArc(nodes),mapped=new Map(nodes.map(n=>[n.id,n]));
  // Broadleaf fan boughs stay as three large gestures. Their child counts,
  // angles, spacing and weight are generated independently for this seed.
  for(const n of tree.nodes.filter(n=>n.role==='bough')){
    const parent=mapped.get(n.parent),p=pointOn(parent,n.attachment),oldParent=source.get(n.parent);
    const sx=1+(rand(n.id,'spread')*2-1)*.18*v,sy=plan.height;
    const next={...n};
    for(const [x,y]of coords){next[x]=p.x+(n[x]-n.x)*sx;next[y]=p.y+(n[y]-n.y)*sy;}
    next.width=n.width*(parent.width/oldParent.width);next.tipWidth=n.tipWidth*(parent.width/oldParent.width);
    fitBranchLength(next,parent,proportions);
    sizeBranch(next,parent,baseWidth,.5+(rand(n.id,'girth')-.5)*v);
    nodes.push(next);mapped.set(n.id,next);
  }
  const positions=primaries.map(n=>{
    let limb=n,parent=source.get(n.parent);
    while(parent.role!=='trunk'){limb=parent;parent=source.get(parent.parent);}
    return oldArc.position(parent,limb.attachment??1);
  });
  const first=Math.min(...positions),last=Math.max(...positions);
  const clusters=[],pads=[],depth={};
  const ordered=[...primaries].sort((a,b)=>kind==='broom'?a.ex-b.ex:positions[primaries.indexOf(a)]-positions[primaries.indexOf(b)]);
  const newBoughs=nodes.filter(n=>n.role==='bough');
  const count=plan.count,frameLayers=[1,2,0,1,0,2,1,2,0,1];

  for(let slot=0;slot<count;slot++){
    const bud=plan.buds[slot],u=bud.u;
    const sourceIndex=Math.round(u*(ordered.length-1)),primary=ordered[sourceIndex];
    const family=tree.nodes.filter(n=>n.pad===primary.pad&&n.role!=='trunk'&&n.role!=='bough');
    const oldPad=tree.pads.find(p=>p.id===primary.pad);
    let parent,t,side;
    if(kind==='broom'){
      // Ordered fans spread across the crown without crossing one another.
      parent=newBoughs[Math.min(newBoughs.length-1,Math.floor(u*newBoughs.length))];
      t=clamp(.82+bud.attachment,.60,.98);side=1;
    }else{
      // Jitter is applied to positive intervals, so buds cannot swap order.
      const lower=clamp(first+(rand('tree','first-bud')*2-1)*.025*v,.04,.94);
      const upper=clamp(last-(.015+rand('tree','apex-gap')*.035)*v,lower+.02,.985);
      const anchor=arc.at(lower+(upper-lower)*u);
      parent=anchor.node;t=anchor.t;
      const originalSide=Math.sign(primary.ex-primary.x)||1;
      if(kind==='windswept')side=originalSide;
      else if(kind==='cascade')side=originalSide;
      else side=(slot%2===0?-1:1)*(Math.sign(ordered[0].ex-ordered[0].x)||1)*-1;
    }
    const anchor=pointOn(parent,t),sourceSide=Math.sign(primary.ex-primary.x)||1;
    const flip=kind==='broom'?1:side/sourceSide;
    const length=bud.reach*(1-.09*v*u),angle=bud.angle;
    const ca=Math.cos(angle),sa=Math.sin(angle);
    const transform=(dx,dy)=>({x:(dx*flip*ca-dy*sa)*length,y:(dx*flip*sa+dy*ca)*length});
    const ids=new Map(family.map(n=>[n.id,`individual:${slot}:${n.id}`]));
    const produced=new Map();
    // Keep at most one late fork on selected older branch families. Removing
    // a fork reassigns its leaves to the surviving parent rather than floating.
    const omitted=new Set();
    for(const n of family)if(n.role==='twig'&&(n.studyTier===3||n.key.includes('/t'))){
      if(u>.72||rand(`${slot}:${n.id}`,'keep')>.55+plan.density*.4)omitted.add(n.id);
    }
    for(const n of family)if(omitted.has(n.parent))omitted.add(n.id);
    const resolve=id=>{while(omitted.has(id))id=source.get(id).parent;return id;};
    function make(n){
      if(produced.has(n.id))return produced.get(n.id);
      if(omitted.has(n.id))return make(source.get(resolve(n.id)));
      const isPrimary=n.id===primary.id,p=isPrimary?parent:make(source.get(n.parent));
      // Do not keep subdivision that would only add hairlines at phone size.
      if(!isPrimary&&(omitted.has(n.parent)||(p.branchTier>=3&&p.tipWidth<1.1))){omitted.add(n.id);return p;}
      const attach=isPrimary?t:clamp(n.attachment+(rand(`${slot}:${n.id}`,'attach')*2-1)*.07*v,.28,.98);
      const a=isPrimary?anchor:pointOn(p,attach),next={...n,id:ids.get(n.id),key:`individual:${slot}:${n.key}`,parent:isPrimary?parent.id:p.id,pad:slot,attachment:attach};
      const localScale=isPrimary?1:1+(rand(`${slot}:${n.id}`,'length')*2-1)*.14*v;
      for(const [x,y]of coords){const d=transform((n[x]-n.x)*localScale,(n[y]-n.y)*localScale);next[x]=a.x+d.x;next[y]=a.y+d.y;}
      if(kind==='broom'&&isPrimary){
        // Spread branch tips continuously across the fan, not into repeated
        // copies of the same pre-existing spoke.
        const target=ordered[0].ex+(ordered.at(-1).ex-ordered[0].ex)*u;
        const shift=(target-primary.ex)*(1-.2*v);
        next.ex+=shift;next.cx1+=shift*.2;next.cx2+=shift*.75;
      }
      // At a new junction begin in the parent's direction, then flow outward.
      const pa=pointOn(p,Math.max(0,attach-.002)),pb=pointOn(p,Math.min(1,attach+.002));
      const heading=Math.atan2(pb.y-pa.y,pb.x-pa.x),target=Math.atan2(next.ey-a.y,next.ex-a.x);
      const turn=Math.atan2(Math.sin(target-heading),Math.cos(target-heading));
      const departure=heading+clamp(turn*(isPrimary?.55:.25),isPrimary?-.68:-.24,isPrimary?.68:.24);
      const handle=Math.hypot(next.ex-a.x,next.ey-a.y)*.30;
      next.cx1=a.x+Math.cos(departure)*handle;next.cy1=a.y+Math.sin(departure)*handle;
      fitBranchLength(next,p,proportions);
      sizeBranch(next,p,baseWidth,(.5+(rand(`${slot}:${n.id}`,'width')-.5)*v)*bud.girth);
      next.growthTempo=bud.tempo*(.92+rand(`${slot}:${n.id}`,'tempo')*.16);
      next.growthDelay=rand(`${slot}:${n.id}`,'delay')*.24;
      nodes.push(next);produced.set(n.id,next);depth[next.id]=frameLayers[slot]*2-2;
      return next;
    }
    family.forEach(make);
    const leafScale=clamp(length*(.93+rand(slot,'crown-size')*.14),.74,1.25);
    for(const c of tree.clusters.filter(c=>c.pad===primary.pad)){
      const targetId=resolve(c.node),before=source.get(c.node),after=produced.get(targetId);
      if(!after)continue;
      // Keep the canopy level: branch rotation does not tilt an entire cloud.
      clusters.push({...c,key:`individual:${slot}:${c.key}`,pad:slot,node:after.id,
        x:after.ex+(c.x-before.ex)*leafScale*flip,y:after.ey+(c.y-before.ey)*leafScale,
        rx:c.rx*leafScale,ry:c.ry*leafScale,z:depth[after.id]+.05,crownLayer:frameLayers[slot],crownAge:1-u});
    }
    const crown=clusters.filter(c=>c.pad===slot);
    const minX=Math.min(...crown.map(c=>c.x-c.rx)),maxX=Math.max(...crown.map(c=>c.x+c.rx));
    const minY=Math.min(...crown.map(c=>c.y-c.ry)),maxY=Math.max(...crown.map(c=>c.y+c.ry));
    pads.push({...oldPad,id:slot,x:(minX+maxX)/2,y:(minY+maxY)/2,rx:(maxX-minX)/2,ry:(maxY-minY)/2,age:1-u,z:frameLayers[slot]*2-2});
  }
  if(plan.mirror){
    for(const n of nodes)for(const [x]of coords)n[x]=root.x*2-n[x];
    for(const c of clusters){c.x=root.x*2-c.x;c.contour={...c.contour,skew:-c.contour.skew,slope:-c.contour.slope};}
    for(const p of pads)p.x=root.x*2-p.x;
  }
  tree.nodes=nodes;tree.clusters=clusters;tree.pads=pads;tree.crownWoodDepth=depth;
  tree.individual={version:'individual-1',...individualOptions(input),primaryCount:count};
  return tree;
}
