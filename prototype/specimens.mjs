// A separate, pruning-free morphology study. Style scaffolds represent trained
// stock; procedural ramification produces the living crown. No species biology
// or original paper implementation is claimed by these three strategies.
import {sample,pointOn} from './model.mjs';
import {taperedPath} from './style-render.mjs';
export const VERSION='specimen-study-1';
export const STRATEGIES=[{id:'axis',code:'A',name:'枝序生长',note:'沿枝轴递归分叉，轮廓更自由'},
  {id:'crown',code:'B',name:'冠形引导',note:'向前方冠区展开，叶层更完整'},
  {id:'hybrid',code:'C',name:'混合生长',note:'枝轴连续 + 冠形偏好 + 局部避让'}];
export const PRESETS=[
  {id:'juniper',name:'曲干真柏',latin:'Moyogi',leaf:'scale',pot:'oval',color:'#526f51',params:{movement:1,taper:1.2,fullness:.8,branching:4,leafSize:1},
    trunk:[[250,443],[219,398],[253,351],[237,302],[275,260],[260,213],[277,173],[267,138]],radius:17,
    limbs:[[1,113,375,59,23],[2,373,337,67,24],[3,145,281,53,25],[4,352,244,49,22],[6,211,159,45,24],[7,282,125,43,25]]},
  {id:'pine',name:'直干黑松',latin:'Chokkan',leaf:'needle',pot:'rect',color:'#344e40',params:{movement:.8,taper:1.3,fullness:.74,branching:4,leafSize:.9},
    trunk:[[250,443],[249,384],[251,328],[247,273],[253,217],[250,162],[252,112]],radius:19,
    limbs:[[1,115,363,64,25],[2,364,316,63,25],[3,160,259,52,24],[4,325,207,45,22],[5,201,151,39,24],[6,257,106,39,24]]},
  {id:'broom',name:'扫帚榉树',latin:'Hokidachi',leaf:'broad',pot:'oval',color:'#698146',params:{movement:.75,taper:1.05,fullness:.84,branching:5,leafSize:.85},
    trunk:[[250,443],[245,389],[252,339],[249,304]],radius:15,
    limbs:[[3,135,247,48,40],[3,151,202,50,42],[3,192,168,49,40],[3,244,149,48,40],[3,291,170,49,40],[3,335,207,51,42],[3,363,250,48,40]]},
  {id:'literati',name:'文人松',latin:'Bunjingi',leaf:'needle',pot:'round',color:'#48624d',params:{movement:1.15,taper:.92,fullness:.5,branching:3,leafSize:.88},
    trunk:[[241,443],[223,385],[240,325],[291,274],[303,226],[275,185],[293,145],[279,112]],radius:7,
    limbs:[[5,349,204,40,19],[6,224,160,39,19],[7,300,112,38,20]]},
  {id:'cascade',name:'悬崖真柏',latin:'Kengai',leaf:'scale',pot:'deep',color:'#4f7258',params:{movement:1,taper:1.2,fullness:.76,branching:4,leafSize:.95},
    trunk:[[182,243],[163,204],[196,176],[240,191],[269,241],[275,300],[315,333],[322,382],[356,419]],radius:15,
    limbs:[[2,129,165,42,23],[4,343,237,46,22],[6,251,320,39,21],[8,407,402,39,24]]},
  {id:'windswept',name:'风吹松',latin:'Fukinagashi',leaf:'needle',pot:'rect',color:'#4b624b',params:{movement:1,taper:1.1,fullness:.65,branching:4,leafSize:.95},
    trunk:[[169,443],[191,389],[225,340],[244,293],[286,254],[314,213],[342,180]],radius:14,
    limbs:[[1,325,370,55,20],[2,375,317,54,20],[3,387,261,49,20],[5,407,218,43,21],[6,391,172,39,21]]}
];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,d)=>Number.isFinite(+v)?+v:d;
export function normalize(input={}){
  const preset=PRESETS.find(p=>p.id===input.preset)||PRESETS[0],d=preset.params;
  return {version:VERSION,preset:preset.id,strategy:STRATEGIES.some(s=>s.id===input.strategy)?input.strategy:'hybrid',seed:String(input.seed??'BONSAI-01').slice(0,64),
    movement:clamp(finite(input.movement,d.movement),.5,1.5),taper:clamp(finite(input.taper,d.taper),.7,1.6),fullness:clamp(finite(input.fullness,d.fullness),.3,1),
    branching:clamp(Math.round(finite(input.branching,d.branching)),2,5),leafSize:clamp(finite(input.leafSize,d.leafSize),.55,1.5)};
}
export function generate(input={}){
  const config=normalize(input),preset=PRESETS.find(p=>p.id===config.preset),nodes=[],pads=[],tips=[];
  const rand=(key,prop)=>sample(config.seed,`${preset.id}:${key}`,prop);
  const root=preset.trunk[0];
  const controls=preset.trunk.map(([x,y],i)=>({x:root[0]+(x-root[0])*config.movement+(i?(rand('trunk',`x${i}`)-.5)*12:0),y:y+(i?(rand('trunk',`y${i}`)-.5)*9:0)}));
  const add=(n)=>{n.id=`n${nodes.length}`;nodes.push(n);return n;};
  const chain=[];
  const radius=s=>1.5+(preset.radius-1.5)*(1-s)**config.taper;
  for(let i=0;i<controls.length-1;i++){
    const a=controls[i],b=controls[i+1],prev=controls[Math.max(0,i-1)],next=controls[Math.min(controls.length-1,i+2)];
    chain.push(add({parent:chain.at(-1)?.id??null,role:'trunk',x:a.x,y:a.y,ex:b.x,ey:b.y,cx1:a.x+(b.x-prev.x)/6,cy1:a.y+(b.y-prev.y)/6,cx2:b.x-(next.x-a.x)/6,cy2:b.y-(next.y-a.y)/6,
      width:radius(i/(controls.length-1))*2,tipWidth:radius((i+1)/(controls.length-1))*2,born:-60,duration:8,key:`trunk${i}`}));
  }
  const curve=(a,b,bend=0)=>({x:a.x,y:a.y,ex:b.x,ey:b.y,cx1:a.x+(b.x-a.x)*.3,cy1:a.y+(b.y-a.y)*.32+bend,cx2:a.x+(b.x-a.x)*.7,cy2:a.y+(b.y-a.y)*.68+bend*.35});
  const terminal=(n,pad,weight=1)=>tips.push({node:n.id,pad:pad.id,weight});
  const grow=(parent,start,angle,len,depth,key,pad,side,born)=>{
    if(nodes.length>=1400)return;
    const angleLimit=preset.id==='windswept'?1.48:1.44;
    // A fan keeps each branch in its original outward half-plane.
    const axis=preset.id==='broom'?clamp(angle,-angleLimit,angleLimit):clamp(side*angle,.1,angleLimit)*side;
    const target={x:pad.x+(rand(key,'tx')-.5)*pad.rx*1.5,y:pad.y-pad.ry*.15-(rand(key,'ty')*.55)*pad.ry};
    const toward=Math.atan2(target.x-start.x,start.y-target.y);
    const forwardTarget=preset.id==='broom'?clamp(toward,-angleLimit,angleLimit):clamp(side*toward,.1,angleLimit)*side;
    const blend=config.strategy==='axis'?0:config.strategy==='crown'?.7:.32;
    const guide=axis+clamp(forwardTarget-axis,-.45,.45)*blend;
    let winner=null;
    for(const turn of config.strategy==='hybrid'?[0,-.16,.16]:[0])for(const scale of [1,.72,.48]){
      const a=preset.id==='broom'?clamp(guide+turn,-angleLimit,angleLimit):clamp(side*(guide+turn),.1,angleLimit)*side,l=len*scale;
      const end={x:start.x+Math.sin(a)*l,y:start.y-Math.cos(a)*l};
      const d=Math.hypot((end.x-pad.x)/pad.rx,(end.y-pad.y)/pad.ry),initial=Math.hypot((start.x-pad.x)/pad.rx,(start.y-pad.y)/pad.ry);
      if(config.strategy!=='axis'&&d>Math.max(1.1,initial-.07))continue;
      let room=1;
      if(config.strategy==='hybrid')for(const other of nodes){if(other.role!=='twig'||other.id===parent.id)continue;
        room=Math.min(room,Math.hypot(other.ex-end.x,other.ey-end.y)/8);
      }
      if(room<.27)continue;
      const score=scale*.4+room*.5-Math.abs(turn)*.8-Math.max(0,d-1)*.65;
      if(!winner||score>winner.score)winner={a,end,score};
    }
    if(!winner){terminal(parent,pad,.75);return;}
    const n=add({...curve(start,winner.end),parent:parent.id,role:'twig',width:Math.max(.7,3.1*(.68**depth)),tipWidth:Math.max(.35,1.8*.67**depth),
      born,duration:8,key,pad:pad.id,depth,side});
    if(depth>=config.branching-1||rand(key,'rest')>(depth>1?config.fullness*.78+.19:1)) {terminal(n,pad);return;}
    const nextLen=len*(.61+rand(key,'decay')*.11);
    // Distinct continuation and lateral buds, using coherent local variation.
    grow(n,{x:n.ex,y:n.ey},winner.a+side*(preset.id==='broom'?.18:.04)+(rand(key,'turn')-.5)*.2,nextLen,depth+1,`${key}.a`,pad,side,born+9);
    if(rand(key,'branch')<config.fullness*.7+.25){
      const attach=pointOn(n,.6+rand(key,'attach')*.2);
      grow(n,attach,winner.a-side*(.3+rand(key,'fork')*.18),nextLen*.87,depth+1,`${key}.b`,pad,side,born+11);
    }
  };
  preset.limbs.forEach(([at,x,y,rx,ry],i)=>{
    const parent=chain[at-1],start=preset.id==='broom'?pointOn(parent,.6+rand(`limb${i}`,'attach')*.4):{x:parent.ex,y:parent.ey};
    const base=preset.trunk[at],reach=.92+rand(`limb${i}`,'reach')*.16;
    const end={x:start.x+(x-base[0])*reach,y:start.y+(y-base[1])};
    const side=preset.id==='windswept'?1:Math.sign(end.x-start.x)||1;
    const pad={id:i,x:end.x+side*8,y:end.y-(preset.leaf==='broad'?22:12),rx:rx*(.9+config.fullness*.16),ry:ry*(1+config.fullness*.35)};pads.push(pad);
    const width=Math.min(parent.tipWidth*.55,preset.id==='broom'?11:9);
    const primary=add({...curve(start,end,preset.id==='broom'?-7:8),parent:parent.id,role:'primary',width:Math.max(3,width),tipWidth:1.5,born:-50,duration:8,key:`limb${i}`,pad:i});
    const shoots=preset.id==='literati'?3:preset.id==='broom'?6:7;
    for(let j=0;j<shoots;j++){
      const t=.28+(j+rand(`${i}.${j}`,'attach')*.4)*.72/(shoots-.5),a=pointOn(primary,t);
      let angle=side*(.55+rand(`${i}.${j}`,'fan')*.65);
      if(preset.id==='windswept')angle=1.13+j*.04;
      if(preset.id==='broom')angle=Math.atan2(end.x-start.x,start.y-end.y)+(j/(shoots-1)-.5)*.75;
      const len=(preset.id==='broom'?38:preset.id==='literati'?23:31)*(1+(rand(`${i}.${j}`,'length')-.5)*.26);
      grow(primary,a,angle,len,0,`limb${i}.shoot${j}`,pad,side,-12+j*1.1);
    }
  });
  // Keep foliage on living branch surfaces, not on opaque crown ellipses.
  // Near-terminal twigs also carry foliage, avoiding isolated terminal pompons.
  const leafSites=[];
  const childCount=new Map();for(const n of nodes)if(n.parent)childCount.set(n.parent,(childCount.get(n.parent)||0)+1);
  for(const n of nodes)if(n.role==='twig'&&(!childCount.get(n.id)||n.depth>=config.branching-3)){
    leafSites.push({node:n.id,t:.8,weight:childCount.get(n.id)?.55:1});
    if(n.depth>=config.branching-3&&config.fullness>.65)leafSites.push({node:n.id,t:.45,weight:.65});
  }
  // A branch that cannot extend still has leaves on its existing shoot.
  for(const tip of tips)if(!leafSites.some(s=>s.node===tip.node))leafSites.push({node:tip.node,t:1,weight:tip.weight});
  const minX=Math.min(root[0]-100,...nodes.map(n=>Math.min(n.x,n.cx1,n.cx2,n.ex)-22));
  const maxX=Math.max(root[0]+100,...nodes.map(n=>Math.max(n.x,n.cx1,n.cx2,n.ex)+22));
  const minY=Math.min(...nodes.map(n=>Math.min(n.y,n.cy1,n.cy2,n.ey)-25));
  const maxY=Math.max(root[1]+(preset.pot==='deep'?130:56),...nodes.map(n=>n.ey+22));
  const width=Math.max(400,maxX-minX+28),height=maxY-minY+24;
  return {version:VERSION,config,preset,nodes,leafSites,pads,root:{x:root[0],y:root[1]},viewBox:{x:(minX+maxX-width)/2,y:minY-12,width,height}};
}

const progress=(n,h)=>clamp((h-n.born)/n.duration,0,1);
const fmt=v=>Number(v).toFixed(2);
export function render(tree,{hour=96,skeleton=false,guides=false,id='tree'}={}){
  const {config,preset,root}=tree,byId=new Map(tree.nodes.map(n=>[n.id,n]));
  const rand=(key,p)=>sample(config.seed,`${preset.id}:${key}`,p);
  const palette=preset.leaf==='broad'?['#526b38','#6b8144','#89994d','#a2ac60']:preset.leaf==='needle'?['#304638','#435d43','#5b7150','#75845b']:['#365240','#4b6950','#64805c','#819166'];
  const wood=[],foliage=[];
  for(const n of tree.nodes){const g=progress(n,hour);if(g<=0)continue;
    wood.push(`<path d="${taperedPath(n,g)}" fill="${n.role==='twig'?'#716650':'#675c4b'}"/>`);
    if(n.role==='trunk')wood.push(`<path d="M${n.x} ${n.y} C${n.cx1} ${n.cy1} ${n.cx2} ${n.cy2} ${n.ex} ${n.ey}" fill="none" stroke="#a79678" stroke-width="${Math.max(.6,n.width*.09)}" opacity=".25"/>`);
  }
  const sites=[...tree.leafSites];
  if(hour<48)for(const n of tree.nodes)if(n.role==='twig'&&progress(n,hour)>.75&&!sites.some(s=>s.node===n.id)&&!tree.nodes.some(child=>child.parent===n.id&&progress(child,hour)>.2))sites.push({node:n.id,t:.7,weight:.6});
  if(!skeleton)for(const site of sites){
    const n=byId.get(site.node),g=progress(n,hour);if(g<site.t)continue;
    const p=pointOn(n,site.t),opacity=clamp((g-site.t)*5+.25,0,1),count=Math.round((preset.leaf==='scale'?24:preset.leaf==='needle'?24:16)*site.weight*config.fullness);
    for(let j=0;j<count;j++){
      const key=`${n.key}:${site.t}:${j}`,a=rand(key,'a')*Math.PI*2,r=Math.sqrt(rand(key,'r'))*(preset.leaf==='scale'?15:13)*config.leafSize;
      const x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r*.75,size=((preset.leaf==='needle'?3.2:2.5)+rand(key,'size')*2.7)*config.leafSize,color=palette[Math.floor(rand(key,'color')*palette.length)];
      if(preset.leaf==='needle'){
        const d=(rand(key,'angle')-.5)*2.3;
        foliage.push(`<path d="M${fmt(x)} ${fmt(y)} l${fmt(Math.sin(d)*size*2)} ${fmt(-Math.cos(d)*size*2)} M${fmt(x)} ${fmt(y)} l${fmt(Math.sin(d+.4)*size*1.7)} ${fmt(-Math.cos(d+.4)*size*1.7)}" stroke="${color}" stroke-width="1.1" stroke-linecap="round" opacity="${opacity}"/>`);
      }else foliage.push(`<ellipse cx="${fmt(x)}" cy="${fmt(y)}" rx="${fmt(size)}" ry="${fmt(size*(preset.leaf==='scale'?.64:.75))}" fill="${color}" opacity="${opacity}" transform="rotate(${fmt(a*40)} ${fmt(x)} ${fmt(y)})"/>`);
    }
  }
  const potWidth=preset.pot==='deep'?49:preset.pot==='round'?53:preset.id==='broom'?94:84,potHeight=preset.pot==='deep'?105:30;
  const px=root.x,py=root.y;
  const pot=`<ellipse cx="${px}" cy="${py+potHeight+12}" rx="${potWidth+7}" ry="7" fill="#686252" opacity=".12"/>
    <path d="M${px-potWidth} ${py} L${px-potWidth*.8} ${py+potHeight} Q${px} ${py+potHeight+12} ${px+potWidth*.8} ${py+potHeight} L${px+potWidth} ${py}Z" fill="url(#${id}-pot)"/>
    <ellipse cx="${px}" cy="${py}" rx="${potWidth}" ry="12" fill="#8a8070"/><ellipse cx="${px}" cy="${py-2}" rx="${potWidth-6}" ry="8" fill="#4c4b3b"/>
    <ellipse cx="${px}" cy="${py-1}" rx="${potWidth*.78}" ry="5" fill="#6a7650"/>`;
  const roots=Array.from({length:5},(_,i)=>{
    const side=i<2?-1:1,span=12+i*4;
    return `<path d="M${px} ${py-13} Q${px+side*span*.3} ${py-1} ${px+side*span} ${py+3}" stroke="#675c4b" stroke-width="${Math.max(1.8,preset.radius*.3-i*.3)}" fill="none" stroke-linecap="round"/>`;
  }).join('');
  const box=tree.viewBox;
  const overlay=guides?tree.pads.map(p=>`<ellipse cx="${p.x}" cy="${p.y}" rx="${p.rx}" ry="${p.ry}" fill="none" stroke="#99a886" stroke-dasharray="3 4"/>`).join(''):'';
  return `<svg viewBox="${box.x} ${box.y} ${box.width} ${box.height}" role="img" aria-label="${preset.name}，${STRATEGIES.find(s=>s.id===config.strategy).name}，${hour} 小时"><defs><linearGradient id="${id}-pot" x2="0" y2="1"><stop stop-color="${preset.pot==='oval'?'#777c72':'#857366'}"/><stop offset="1" stop-color="${preset.pot==='oval'?'#565f58':'#605148'}"/></linearGradient></defs>${overlay}${pot}${roots}${wood.join('')}${foliage.join('')}</svg>`;
}
export function validateSelection(data){
  if(data?.version!==VERSION||!Array.isArray(data.candidates)||data.candidates.length>30)throw new Error('候选文件格式无效');
  const candidates=data.candidates.map(c=>{
    if(!PRESETS.some(p=>p.id===c?.preset)||!STRATEGIES.some(s=>s.id===c.strategy)||typeof c.seed!=='string'||c.seed.length>64)throw new Error('候选参数无效');
    return normalize(c);
  });
  return {version:VERSION,candidates};
}
