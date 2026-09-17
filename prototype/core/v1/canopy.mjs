import {generate as generateOld} from './specimens.mjs';
import {sample,pointOn} from './model.mjs';
import {taperedPath} from './style-render.mjs';
import {normalizeAppearance,colorsFor} from './appearance.mjs';

export const VERSION='canopy-study-2';
export const PRESETS=[
  {id:'juniper',name:'分层真柏',note:'横展叶层 · 错落留白',kind:'scale',tips:12},
  {id:'broom',name:'圆顶榉树',note:'连续圆冠 · 分级枝序',kind:'broad',tips:16},
  {id:'literati',name:'文人松',note:'疏朗裸干 · 饱满小冠',kind:'needle',tips:8},
  {id:'pine',name:'直干黑松',note:'挺拔收尖 · 层层横展',kind:'needle',tips:12,pot:'rect'},
  {id:'slant',name:'斜干松',note:'斜势主干 · 两侧平衡',kind:'needle',tips:12,pot:'oval-blue'},
  {id:'cascade',name:'悬崖真柏',note:'垂落干线 · 深盆悬枝',kind:'scale',tips:10,pot:'deep'},
  {id:'windswept',name:'风吹松',note:'顺风偏冠 · 低伏横展',kind:'needle',tips:10,pot:'shallow',stretch:1.12,flatten:.8,lean:.75}
];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const number=(x,d,a,b)=>Number.isFinite(+x)?clamp(+x,a,b):d;
export function normalize(c={}){
  return {version:VERSION,preset:PRESETS.some(p=>p.id===c.preset)?c.preset:'juniper',seed:String(c.seed??'BONSAI-01').slice(0,64),
    padScale:number(c.padScale,1,.7,1.25),leafScale:number(c.leafScale,1,.65,1.5),coverage:number(c.coverage,.85,.45,1),
    tipScale:number(c.tipScale,1,.65,1.35),...(c.preset==='literati'?{crownCount:Math.round(number(c.crownCount,5,3,6))}:{}),appearance:normalizeAppearance(c.appearance)};
}
const average=points=>({x:points.reduce((s,p)=>s+p.x,0)/points.length,y:points.reduce((s,p)=>s+p.y,0)/points.length});
// The slant experiment applies one affine transform to the whole reference
// scaffold, including branch attachments, so both comparison views align.
export function generateReference(input={}){
  const config=normalize(input),slant=config.preset==='slant';
  const old=generateOld({preset:slant?'pine':config.preset,seed:config.seed,strategy:'hybrid'});
  if(!slant)return old;
  const rootY=old.root.y,shift=(x,y)=>x-60+(rootY-y)*.43;
  for(const n of old.nodes)for(const [x,y]of [['x','y'],['cx1','cy1'],['cx2','cy2'],['ex','ey']])n[x]=shift(n[x],n[y]);
  for(const p of old.pads)p.x=shift(p.x,p.y);
  old.root.x-=60;old.preset={...old.preset,name:'斜干松',latin:'Shakan'};
  const minX=Math.min(old.root.x-110,...old.nodes.map(n=>Math.min(n.x,n.cx1,n.cx2,n.ex)-35));
  const maxX=Math.max(old.root.x+110,...old.nodes.map(n=>Math.max(n.x,n.cx1,n.cx2,n.ex)+35));
  old.viewBox={...old.viewBox,x:minX,width:Math.max(400,maxX-minX)};
  return old;
}
export function generate(input={}){
  const config=normalize(input),preset=PRESETS.find(p=>p.id===config.preset);
  // Reuse trained trunks; the broom's spoke-like primary wood is reorganized.
  const old=generateReference(config);
  const nodes=old.nodes.filter(n=>n.role!=='twig'&&(preset.kind!=='broad'||n.role==='trunk')).map(n=>({...n})),clusters=[],pads=[];
  const random=(key,p)=>sample(config.seed,`${preset.id}:canopy:${key}`,p);
  let primaries=nodes.filter(n=>n.role==='primary');
  if(preset.id==='literati'){
    const trunk=nodes.filter(n=>n.role==='trunk');
    // Additional trained branches occupy gaps; the long lower trunk stays bare.
    const extra=[[3,.55,-73,9,33,18],[5,.83,57,-5,29,16],[4,.45,-48,-2,25,15]];
    for(let j=0;j<config.crownCount-3;j++){
      const [at,t,dx,dy,rx,ry]=extra[j],parent=trunk[at],start=pointOn(parent,t),i=3+j;
      const end={x:start.x+dx*(.94+random(`extra${j}`,'reach')*.12),y:start.y+dy+(random(`extra${j}`,'height')-.5)*5};
      const n={id:`extra${j}`,parent:parent.id,role:'primary',pad:i,key:`extra${j}`,x:start.x,y:start.y,ex:end.x,ey:end.y,
        cx1:start.x+dx*.3,cy1:start.y+8,cx2:end.x-dx*.22,cy2:end.y+5,
        width:Math.min(parent.width*.45,3.8),tipWidth:1.3,born:-50,duration:8};
      nodes.push(n);primaries.push(n);old.pads.push({id:i,x:end.x+Math.sign(dx)*7,y:end.y-12,rx,ry});
    }
  }
  if(preset.kind==='broad'){
    const source=old.nodes.filter(n=>n.role==='primary'),trunk=nodes.at(-1),start=pointOn(trunk,.88);
    primaries=[];
    for(const [g,indices]of [[0,[0,1]],[1,[2,3,4]],[2,[5,6]]]){
      const ends=indices.map(i=>({x:source[i].ex,y:source[i].ey})),center=average(ends);
      const end={x:start.x+(center.x-start.x)*.53,y:start.y+(center.y-start.y)*.57};
      const bough={id:`bough${g}`,parent:trunk.id,role:'bough',key:`bough${g}`,x:start.x,y:start.y,ex:end.x,ey:end.y,
        cx1:start.x+(end.x-start.x)*.28,cy1:start.y+(end.y-start.y)*.37,
        cx2:end.x+(g===1?5:0),cy2:end.y+12,width:g===1?8:6,tipWidth:3.5,born:-50,duration:8};
      nodes.push(bough);
      for(const i of indices){const p={...source[i],parent:bough.id,x:end.x,y:end.y,width:3.5,
        cx1:end.x+(source[i].ex-end.x)*.28,cy1:end.y+(source[i].ey-end.y)*.4,
        cx2:end.x+(source[i].ex-end.x)*.72,cy2:end.y+(source[i].ey-end.y)*.7};nodes.push(p);primaries.push(p);}
    }
  }
  for(const [i,primary]of primaries.entries()){
    const base=old.pads[i],broad=preset.kind==='broad',needle=preset.kind==='needle';
    const pad={...base,rx:base.rx*config.padScale*(preset.stretch??1),ry:base.ry*config.padScale*(preset.flatten??1),
      z:(i%3===1?-1:1)*(1+i*.04)};
    pads.push(pad);primary.z=pad.z;
    const count=Math.round(preset.tips*config.tipScale),targets=[];
    // A stable, stratified distribution occupies one shared crown volume.
    for(let j=0;j<count;j++){
      let u,v;
      if(broad){const angle=j*2.3999632297,r=Math.sqrt((j+.5)/count);u=Math.cos(angle)*r;v=Math.sin(angle)*r;}
      else {const row=Math.min(2,Math.floor(j*3/count)),start=Math.ceil(row*count/3),end=Math.ceil((row+1)*count/3),cols=end-start;
        u=((j-start+.5)/cols*2-1)*(1-row*.16)+(row===1?.09:-.03);v=.25-row*.4;}
      const k=`${i}:${j}`,x=pad.x+(u+(random(k,'x')-.5)*.09)*pad.rx*.91;
      const y=pad.y+(v+(random(k,'y')-.5)*.24)*pad.ry*(broad?1:1.25);
      targets.push({x,y,key:k,rx:(broad?22:needle?16:19)*config.padScale*(.88+random(k,'radius')*.2)*(preset.stretch??1),
        ry:(broad?20:needle?12:15)*config.padScale*(.9+random(k,'height')*.18)*(preset.flatten??1),z:pad.z+(random(k,'z')-.5)*.3});
    }
    const addBranch=(parent,start,end,depth,key,terminal)=>{
      // Curvature varies once per branch, not at every extension step.
      const dx=end.x-start.x,dy=end.y-start.y;
      const bend=(random(key,'bend')-.5)*Math.min(5,Math.hypot(dx,dy)*.12);
      const width=Math.min(parent.tipWidth,terminal?1.35:Math.max(1.3,3.4*.71**depth));
      const n={id:`c${nodes.length}`,parent:parent.id,role:'twig',pad:i,z:pad.z,depth,key,
        x:start.x,y:start.y,ex:end.x,ey:end.y,cx1:start.x+dx*.3+bend,cy1:start.y+dy*.3,
        cx2:start.x+dx*.72+bend,cy2:start.y+dy*.72,width,tipWidth:width*(terminal?.47:.74),born:depth*12-18,duration:12};
      nodes.push(n);return n;
    };
    function divide(parent,start,points,depth,key){
      if(points.length===1){const p=points[0],n=addBranch(parent,start,p,depth,key,true);clusters.push({...p,node:n.id,pad:i,born:n.born+12});return;}
      const center=average(points),end={x:start.x+(center.x-start.x)*.56,y:start.y+(center.y-start.y)*.56};
      const n=addBranch(parent,start,end,depth,key,false);
      const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
      const axis=Math.max(...xs)-Math.min(...xs)>Math.max(...ys)-Math.min(...ys)?'x':'y';
      const ordered=[...points].sort((a,b)=>a[axis]-b[axis]),half=Math.ceil(ordered.length/2);
      divide(n,end,ordered.slice(0,half),depth+1,`${key}a`);divide(n,end,ordered.slice(half),depth+1,`${key}b`);
    }
    divide(primary,pointOn(primary,.58),targets,0,`pad${i}`);
  }
  // Fixed framing across leaf/detail controls. Include the largest allowed leaves.
  const minX=Math.min(old.viewBox.x,...clusters.map(c=>c.x-c.rx-16));
  const maxX=Math.max(old.viewBox.x+old.viewBox.width,...clusters.map(c=>c.x+c.rx+16));
  const minY=Math.min(old.viewBox.y,...clusters.map(c=>c.y-c.ry-16));
  const maxY=Math.max(old.root.y+(preset.pot==='deep'?130:68),old.viewBox.y+old.viewBox.height,...clusters.map(c=>c.y+c.ry+16));
  return {version:VERSION,config,preset,nodes,pads,clusters,root:old.root,
    viewBox:{x:minX-8,y:minY-8,width:maxX-minX+16,height:maxY-minY+16}};
}
const f=x=>Number(x).toFixed(2);
const progress=(born,h,duration=20)=>clamp((h-born)/duration,0,1);
// Rounded but irregular outlines, derived from leaf-bearing twig volumes.
function outline(c,rand){
  const pts=Array.from({length:16},(_,i)=>{const a=i*Math.PI/8,r=.89+rand(`${c.key}:${i}`,'edge')*.17;return {x:c.x+Math.cos(a)*c.rx*r,y:c.y+Math.sin(a)*c.ry*r};});
  const mid=(a,b)=>`${f((a.x+b.x)/2)} ${f((a.y+b.y)/2)}`;
  return `M${mid(pts.at(-1),pts[0])} ${pts.map((p,i)=>`Q${f(p.x)} ${f(p.y)} ${mid(p,pts[(i+1)%pts.length])}`).join(' ')}Z`;
}
// The first trunk segment widens smoothly into a horizontal soil contact.
// Blend out the slanted tube end so it cannot protrude below the soil surface.
function basalPath(n){
  const left=[],right=[];
  for(let i=0;i<=40;i++){
    const t=i/40,p=pointOn(n,t),a=pointOn(n,Math.max(0,t-.002)),b=pointOn(n,Math.min(1,t+.002));
    const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1;
    const u=clamp(t/.46,0,1),blend=u*u*(3-2*u);
    const radius=(n.width+(n.tipWidth-n.width)*t)/2*(1+.48*(1-blend));
    const nx=(1-blend)+(-dy/length)*blend,ny=(dx/length)*blend;
    const y=p.y-2*(1-blend);
    left.push(`${f(p.x+nx*radius)},${f(y+ny*radius)}`);
    right.push(`${f(p.x-nx*radius)},${f(y-ny*radius)}`);
  }
  return `M${left.join(' L')} L${right.reverse().join(' L')}Z`;
}
export function render(tree,{view='foliage',hour=96,id='canopy',viewBox=tree.viewBox}={}){
  const {config,preset,root}=tree,rand=(k,p)=>sample(config.seed,`${preset.id}:render:${k}`,p);
  const appearance=normalizeAppearance(config.appearance),colors=colorsFor(appearance);
  const shape=appearance.shape==='auto'?(preset.kind==='broad'?'oval':preset.kind):appearance.shape;
  const broad=shape!=='scale'&&shape!=='needle',needle=shape==='needle',silhouette=view==='silhouette';
  const silhouetteColor=appearance.background==='night'?'#d6dfd7':'#334c3e',woodColor=silhouette?silhouetteColor:colors.bark;
  const palette=appearance.foliage!=='native'?colors.foliage:preset.kind==='broad'?['#42613d','#577647','#6d8952','#81995b']:preset.kind==='needle'?['#2e5144','#426653','#5b7a5c','#788d67']:colors.foliage;
  function wood(n){const g=n.role==='twig'?progress(n.born,hour,n.duration??12):1;if(!g)return '';
    const end=pointOn(n,g),scale=.4+.6*g,startRadius=n.width*scale/2,endRadius=(n.width+(n.tipWidth-n.width)*g)*scale/2;
    // Shared round caps overlap the flat tube ends, sealing antialiasing seams
    // and filling the wedge between branches with different tangent directions.
    // Match wood colors across the junction rather than drawing a centerline.
    const joint=n.parent?`<circle cx="${f(n.x)}" cy="${f(n.y)}" r="${f(startRadius)}"/>`:'';
    return `<g fill="${woodColor}"><path d="${n.role==='trunk'&&!n.parent?basalPath(n):taperedPath(n,g)}"/>${joint}<circle cx="${f(end.x)}" cy="${f(end.y)}" r="${f(endRadius)}"/></g>`;
  }
  function foliage(c){const g=progress(c.born,hour,c.duration??20);if(!g)return '';
    const base=outline(c,rand);
    if(silhouette)return `<path d="${base}" fill="${silhouetteColor}"/>`;
    const detail=[],density=config.coverage;
    // Coherent core volume; porous boundaries receive individually visible leaves.
    if(density>=.6)detail.push(`<path d="${base}" fill="${palette[c.z<0?0:1]}" opacity="${f(.68+(density-.6)*.7)}"/>`);
    const count=Math.round((broad?37:needle?40:48)*density);
    for(let j=0;j<count;j++){
      const k=`${c.key}:${j}`,a=rand(k,'a')*Math.PI*2,r=Math.sqrt(rand(k,'r'));
      const x=c.x+Math.cos(a)*c.rx*r,y=c.y+Math.sin(a)*c.ry*r;
      // Lighting follows the cluster surface rather than independent bright speckles.
      const light=clamp(Math.floor((1-(y-c.y)/c.ry)*1.4+(rand(k,'tone')-.5)*1.2),0,3),color=palette[light];
      const size=(broad?5.2:needle?6:4.7)*config.leafScale*(.78+rand(k,'size')*.4);
      const angle=(rand(k,'angle')-.5)*(broad?130:65);
      if(needle){const tilt=(x-c.x)/c.rx*.65+(preset.lean??0);
        for(let q=-1;q<=1;q++){const a=tilt+q*.22;detail.push(`<path d="M${f(x)} ${f(y)} l${f(Math.sin(a)*size*1.6)} ${f(-Math.cos(a)*size*1.6)}" fill="none" stroke="${color}" stroke-width="1.45" stroke-linecap="round"/>`);}
      }else if(shape==='maple'||shape==='fan'||shape==='lance'){
        const path=shape==='maple'?'M0 1 L-.23 .43 L-.75 .53 L-.54 .1 L-1 -.23 L-.48 -.3 L-.5 -.83 L-.18 -.58 L0 -1.15 L.18 -.58 L.5 -.83 L.48 -.3 L1 -.23 L.54 .1 L.75 .53 L.23 .43Z':shape==='fan'?'M0 .9 Q-.18 .24 -.82 -.23 Q-1 -.65 -.74 -.83 Q-.36 -1.04 0 -.86 Q.38 -1.06 .78 -.82 Q1 -.55 .79 -.22 Q.18 .27 0 .9Z':'M0 1.22 Q-.68 .1 0 -1.25 Q.65 -.05 0 1.22Z';
        detail.push(`<path d="${path}" fill="${color}" transform="translate(${f(x)} ${f(y)}) rotate(${f(angle)}) scale(${f(size*(shape==='lance'?1:1.18))})"/>`);
      }else detail.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(size)}" ry="${f(size*(shape==='round'?.91:broad?.64:.57))}" fill="${color}" transform="rotate(${f(angle)} ${f(x)} ${f(y)})"/>`);
    }
    return `<g transform="translate(${f(c.x)} ${f(c.y)}) scale(${f(.4+.6*g)}) translate(${f(-c.x)} ${f(-c.y)})" opacity="${f(g)}">${detail.join('')}</g>`;
  }
  function padMarkup(p){return tree.nodes.filter(n=>n.pad===p.id).map(wood).join('')+(view==='skeleton'?'':tree.clusters.filter(c=>c.pad===p.id).sort((a,b)=>a.z-b.z).map(foliage).join(''));}
  const back=tree.pads.filter(p=>p.z<0).sort((a,b)=>a.z-b.z).map(padMarkup).join('');
  const front=tree.pads.filter(p=>p.z>=0).sort((a,b)=>a.z-b.z).map(padMarkup).join('');
  const trunks=tree.nodes.filter(n=>n.role==='trunk'||n.role==='bough').map(wood).join('');
  const deep=preset.pot==='deep',rect=preset.pot==='rect',w=deep?49:preset.id==='literati'?56:preset.pot==='shallow'?82:88,x=root.x,y=root.y,h=deep?105:preset.pot==='shallow'?23:31;
  const potColor=rect?['#957c66','#635344']:deep?['#747c83','#444c56']:preset.pot==='oval-blue'?['#8a9b9a','#516867']:['#879087','#515e57'];
  const rim=rect?`<rect x="${x-w}" y="${y-9}" width="${w*2}" height="18" rx="5" fill="#968574"/>`:`<ellipse cx="${x}" cy="${y}" rx="${w}" ry="11" fill="#8b8879"/>`;
  const pot=`<ellipse cx="${x}" cy="${y+h+13}" rx="${w+8}" ry="7" fill="#465041" opacity=".1"/><path d="M${x-w} ${y} L${x-w*(deep?.83:.78)} ${y+h} Q${x} ${y+h+12} ${x+w*(deep?.83:.78)} ${y+h} L${x+w} ${y}Z" fill="url(#${id}-pot)"/>${rim}<ellipse cx="${x}" cy="${y-2}" rx="${w-6}" ry="7" fill="#505141"/><ellipse cx="${x}" cy="${y-2}" rx="${w*.72}" ry="5" fill="#76815e"/>`;
  const base=tree.nodes.find(n=>n.role==='trunk'&&!n.parent),neck=pointOn(base,.17),radius=base.width/2;
  const roots=[-2.85,-.25,2.5,.7,1.7].map((angle,i)=>{
    const reach=radius*(2.1+rand(`root${i}`,'reach')*.65)+5;
    const tx=x+Math.cos(angle)*reach,ty=y-2+Math.sin(angle)*3.4;
    const sx=neck.x+Math.cos(angle)*radius*.32,sy=neck.y+3;
    const root={x:sx,y:sy,ex:tx,ey:ty,cx1:sx+(tx-sx)*.23,cy1:sy+(ty-sy)*.8,
      cx2:tx-(tx-sx)*.25,cy2:ty-1.2,width:radius*(i<2?.48:.38),tipWidth:.12};
    return `<path d="${taperedPath(root)}"/>`;
  }).join('');
  // The soil hides the lower edge of the flare and the tapering root tips.
  const soilContact=`<path d="M${f(x-radius*1.58)} ${f(y-1.7)} Q${f(x-radius*.72)} ${f(y-.3)} ${f(x)} ${f(y-.9)} T${f(x+radius*1.58)} ${f(y-1.1)} L${f(x+radius*1.65)} ${f(y+3.6)} Q${f(x)} ${f(y+5)} ${f(x-radius*1.65)} ${f(y+3.6)}Z" fill="#76815e"/>`;
  const b=viewBox;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x} ${b.y} ${b.width} ${b.height}" style="background:${colors.background}" role="img" aria-label="${preset.name}，${view==='skeleton'?'裸枝':silhouette?'单色轮廓':'完整枝叶'}"><defs><linearGradient id="${id}-pot" x2="0" y2="1"><stop stop-color="${potColor[0]}"/><stop offset="1" stop-color="${potColor[1]}"/></linearGradient></defs><rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" fill="${colors.background}"/>${pot}<g fill="${woodColor}">${roots}</g>${back}${trunks}${front}${soilContact}</svg>`;
}
