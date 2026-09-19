import {PALETTES} from './bonsai-language.mjs';
import {STYLIZED_LEAVES,stylizedLeafMarkup} from './stylized-foliage.mjs';
import {sample,pointOn} from '../v1/model.mjs';
import {taperedPath} from '../v1/style-render.mjs';
import {normalizeAppearance,colorsFor} from '../v1/appearance.mjs';
import {normalizePot,potMarkup,potOpening} from '../v2/pots.mjs';
import {canopyPoint} from '../v2/morphology.mjs';
import {crownPaint,crownOccluders} from '../v2/crown-color.mjs';
import {painterlyPaint} from '../v2/crown-painterly.mjs';

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const f=x=>Number(x).toFixed(2);
const progress=(born,h,duration=20)=>clamp((h-born)/duration,0,1);
// Enlarge the vessel around the soil anchor without changing the tree or camera.
export const POT_SCALE=1.5;
// Rounded but irregular outlines, derived from leaf-bearing twig volumes.
function outline(c,rand){
  const pts=Array.from({length:24},(_,i)=>{const a=i*Math.PI/12,r=.94+rand(`${c.key}:${i}`,'edge')*.1;return canopyPoint(c,a,r);});
  const mid=(a,b)=>`${f((a.x+b.x)/2)} ${f((a.y+b.y)/2)}`;
  return `M${mid(pts.at(-1),pts[0])} ${pts.map((p,i)=>`Q${f(p.x)} ${f(p.y)} ${mid(p,pts[(i+1)%pts.length])}`).join(' ')}Z`;
}
// The first trunk segment widens smoothly into a horizontal soil contact.
// Blend out the slanted tube end so it cannot protrude below the soil surface.
function basalPath(n,openingRadius){
  const left=[],right=[];
  for(let i=0;i<=40;i++){
    const t=i/40,p=pointOn(n,t),a=pointOn(n,Math.max(0,t-.002)),b=pointOn(n,Math.min(1,t+.002));
    const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1;
    const u=clamp(t/.46,0,1),blend=u*u*(3-2*u);
    const naturalRadius=(n.width+(n.tipWidth-n.width)*t)/2;
    const radius=naturalRadius*blend+Math.min(naturalRadius*1.48,openingRadius*.68)*(1-blend);
    const nx=(1-blend)+(-dy/length)*blend,ny=(dx/length)*blend;
    const y=p.y-2*(1-blend);
    left.push(`${f(p.x+nx*radius)},${f(y+ny*radius)}`);
    right.push(`${f(p.x-nx*radius)},${f(y-ny*radius)}`);
  }
  return `M${left.join(' L')} L${right.reverse().join(' L')}Z`;
}
export function render(tree,{view='foliage',hour=96,id='canopy',viewBox=tree.viewBox,transparent=false,potScale=POT_SCALE}={}){
  const {config,preset,root}=tree,rand=(k,p)=>sample(config.seed,`${preset.id}:render:${k}`,p);
  const deep=preset.pot==='deep',rect=preset.pot==='rect',w=deep?49:preset.id==='literati'?56:preset.pot==='shallow'?82:88,x=root.x,y=root.y,h=deep?105:preset.pot==='shallow'?23:31;
  const selectedPot=normalizePot(config.pot);
  const potTransform=`translate(${x} ${y}) scale(${potScale}) translate(${-x} ${-y})`;
  const originalOpening=selectedPot?potOpening(selectedPot,x,y):{rx:w-6,cy:y-2,markup:`<ellipse cx="${x}" cy="${y-2}" rx="${w-6}" ry="7"/>`};
  const opening={rx:originalOpening.rx*potScale,cy:y+(originalOpening.cy-y)*potScale,
    markup:originalOpening.markup.replace('/>',` transform="${potTransform}"/>`)};
  const appearance=normalizeAppearance(config.appearance),colors=colorsFor(appearance);
  const theme=PALETTES[tree.language?.palette]?.scene;
  if(theme)colors.background=theme.background;
  const materials=theme?{'bark':theme.bark,'moss':theme.moss}:{};
  const material=(name,color)=>transparent?`var(--bonsai-${name},${materials[name]??color})`:materials[name]??color;
  const shape=Object.hasOwn(STYLIZED_LEAVES,config.appearance?.shape)?config.appearance.shape:appearance.shape==='auto'?(preset.kind==='broad'?'oval':preset.kind):appearance.shape;
  const decorative=Object.hasOwn(STYLIZED_LEAVES,shape);
  const broad=shape!=='scale'&&shape!=='needle',needle=shape==='needle',silhouette=view==='silhouette';
  const silhouetteColor=appearance.background==='night'?'#d6dfd7':'#334c3e',woodColor=silhouette?silhouetteColor:material('bark',colors.bark);
  const basePalette=appearance.foliage!=='native'?colors.foliage:preset.kind==='broad'?['#42613d','#577647','#6d8952','#81995b']:preset.kind==='needle'?['#2e5144','#426653','#5b7a5c','#788d67']:colors.foliage;
  const palette=basePalette.map((c,i)=>material('leaf-'+i,c));
  const nodeIndex=new Map(tree.nodes.map((n,i)=>[n.id,i]));
  function wood(n){const g=n.role==='twig'?progress(n.born,hour,n.duration??12):1;if(!g)return '';

    const end=pointOn(n,g),scale=.4+.6*g,startRadius=n.width*scale/2,endRadius=(n.width+(n.tipWidth-n.width)*g)*scale/2;
    // Shared round caps overlap the flat tube ends, sealing antialiasing seams
    // and filling the wedge between branches with different tangent directions.
    // Match wood colors across the junction rather than drawing a centerline.
    const joint=n.parent?`<circle cx="${f(n.x)}" cy="${f(n.y)}" r="${f(startRadius)}"/>`:'';
    const basal=n.role==='trunk'&&!n.parent;
    return `<g data-wind-wood="${nodeIndex.get(n.id)}" data-wind-parent="${nodeIndex.get(n.parent)??-1}" data-wind-role="${n.role}" data-wind-width="${f(n.width)}" data-wind-x="${f(n.x)}" data-wind-y="${f(n.y)}" fill="${woodColor}"${basal?` clip-path="url(#${id}-root-opening)"`:''}><path d="${basal?basalPath(n,opening.rx):taperedPath(n,g)}"/>${joint}<circle cx="${f(end.x)}" cy="${f(end.y)}" r="${f(endRadius)}"/></g>`;
  }
  function foliage(c){const g=progress(c.born,hour,c.duration??20);if(!g)return '';
    const base=outline(c,rand);
    if(silhouette&&!c.starterLeaves)return `<path d="${base}" fill="${silhouetteColor}"/>`;
    const leafPalette=silhouette?Array(4).fill(silhouetteColor):c.layerPalette??palette;
    const illustrated=tree.crownColor?.style?painterlyPaint(c,tree.crownColor):null;
    const paint=tree.crownColor&&!illustrated?crownPaint(c,tree.crownColor):null;
    const detail=[],density=clamp(config.coverage*(c.foliageDensity??1),.3,1);
    const volumeId=`${id}-leaf-volume-${c.starterLeaves?'bud-'+tree.buds.indexOf(c):tree.clusters.indexOf(c)}`;
    if(paint)detail.push(`<defs><radialGradient id="${volumeId}" cx="${50+paint.cx*50}%" cy="${50+paint.cy*50}%" r="78%">${paint.stops.map(s=>`<stop offset="${s.offset}" stop-color="${s.color}"/>`).join('')}</radialGradient></defs>`);
    else if(c.layerPalette)detail.push(`<defs><radialGradient id="${volumeId}" cx="${c.crownSun===1?64:36}%" cy="23%" r="78%"><stop offset="0" stop-color="${leafPalette[2]}"/><stop offset=".56" stop-color="${leafPalette[1]}"/><stop offset="1" stop-color="${leafPalette[0]}"/></radialGradient></defs>`);
    // Coherent core volume; porous boundaries receive individually visible leaves.
    if(illustrated){
      const clip=`${volumeId}-paint`;
      detail.push(`<defs><clipPath id="${clip}"><path d="${base}"/></clipPath></defs><g clip-path="url(#${clip})" opacity="${f(.90*(c.leafAmount??1))}"><path d="${base}" fill="${illustrated.base}"/>${illustrated.surfaces.map(s=>`<path d="${s.d}" fill="${s.color}"/>`).join('')}</g>`);
    }else if(density>=.6 && (c.leafAmount??1)>.35)detail.push(`<path d="${base}" fill="${c.layerPalette?`url(#${volumeId})`:leafPalette[c.z<0?0:1]}" opacity="${f((c.layerPalette?.9:(.68+(density-.6)*.7))*(c.leafAmount??1))}"/>`);
    const count=Math.round((decorative?19:broad?37:needle?40:48)*density*(c.leafBudget??1));
    for(let j=0;j<(c.starterLeaves??Math.ceil(count*(c.leafAmount??1)));j++){
      const k=`${c.key}:${j}`,a=rand(k,'a')*Math.PI*2,r=Math.sqrt(rand(k,'r'));
      const {x,y}=c.starterLeaves?{x:c.x+(j===0?-3:3),y:c.y-2}:canopyPoint(c,a,r);
      // Lighting follows the cluster surface rather than independent bright speckles.
      const surface=c.layerPalette?1.55-(y-c.y)/c.ry*1.35+(x-c.x)/c.rx*.3*(c.crownSun??-1):(1-(y-c.y)/c.ry)*1.4;
      const light=clamp(Math.floor(surface+(rand(k,'tone')-.5)*(c.layerPalette?.7:1.2)+(c.crownShade??0)),0,3),color=illustrated?illustrated.shadeAt(x,y,rand(k,'tone')*2-1):paint?paint.shadeAt((x-c.x)/c.rx,(y-c.y)/c.ry,rand(k,'tone')*2-1):leafPalette[light];
      const size=(broad?5.2:needle?6:4.7)*config.leafScale*(c.detailScale??1)*(.78+rand(k,'size')*.4);
      const angle=(rand(k,'angle')-.5)*(broad?130:65);
      if(needle){const tilt=(x-c.x)/c.rx*.65+(preset.lean??0);
        for(let q=-1;q<=1;q++){const a=tilt+q*.22;detail.push(`<path d="M${f(x)} ${f(y)} l${f(Math.sin(a)*size*1.6)} ${f(-Math.cos(a)*size*1.6)}" fill="none" stroke="${color}" stroke-width="1.45" stroke-linecap="round"/>`);}
      }else if(Object.hasOwn(STYLIZED_LEAVES,shape)){
        detail.push(stylizedLeafMarkup(shape,{x,y,size:size*2.05,angle,color,accent:leafPalette[3],silhouette,showCenter:true}));
      }else if(shape==='maple'||shape==='fan'||shape==='lance'){
        const path=shape==='maple'?'M0 1 L-.23 .43 L-.75 .53 L-.54 .1 L-1 -.23 L-.48 -.3 L-.5 -.83 L-.18 -.58 L0 -1.15 L.18 -.58 L.5 -.83 L.48 -.3 L1 -.23 L.54 .1 L.75 .53 L.23 .43Z':shape==='fan'?'M0 .9 Q-.18 .24 -.82 -.23 Q-1 -.65 -.74 -.83 Q-.36 -1.04 0 -.86 Q.38 -1.06 .78 -.82 Q1 -.55 .79 -.22 Q.18 .27 0 .9Z':'M0 1.22 Q-.68 .1 0 -1.25 Q.65 -.05 0 1.22Z';
        detail.push(`<path d="${path}" fill="${color}" transform="translate(${f(x)} ${f(y)}) rotate(${f(angle)}) scale(${f(size*(shape==='lance'?1:1.18))})"/>`);
      }else detail.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(size)}" ry="${f(size*(shape==='round'?.91:broad?.64:.57))}" fill="${color}" transform="rotate(${f(angle)} ${f(x)} ${f(y)})"/>`);
    }
    if(paint&&tree.crownColor.depth!==false&&tree.crownColor.shadow!==false){
      const occluders=crownOccluders(c,tree.clusters);
      if(occluders.length){
        const clipId=`${volumeId}-contact-clip`,shadeId=`${volumeId}-contact`;
        detail.push(`<defs><clipPath id="${clipId}"><path d="${base}"/></clipPath><radialGradient id="${shadeId}"><stop offset=".5" stop-color="#20382b" stop-opacity=".25"/><stop offset=".8" stop-color="#20382b" stop-opacity=".15"/><stop offset="1" stop-color="#20382b" stop-opacity="0"/></radialGradient></defs><g clip-path="url(#${clipId})">${occluders.map(front=>`<ellipse cx="${f(front.x)}" cy="${f(front.y+Math.min(4,front.ry*.18))}" rx="${f(front.rx*1.06)}" ry="${f(front.ry*1.18)}" fill="url(#${shadeId})" opacity="${f(front.leafAmount??1)}"/>`).join('')}</g>`);
      }
    }
    const anchor=tree.nodes.find(n=>n.id===c.node);
    return `<g data-wind-node="${nodeIndex.get(c.node)??-1}"${transparent?' style="filter:brightness(var(--bonsai-crown-brightness,1)) saturate(var(--bonsai-crown-saturation,1))"':''} data-wind-leaf="${f(rand(c.key,'wind')*Math.PI*2)}" data-wind-x="${f(c.anchorX??anchor?.ex??c.x)}" data-wind-y="${f(c.anchorY??anchor?.ey??c.y)}"${c.starterLeaves?' data-starter-leaves="2"':''}><g transform="translate(${f(c.x)} ${f(c.y)}) scale(${f(.4+.6*g)}) translate(${f(-c.x)} ${f(-c.y)})" opacity="${f(g*(c.opacity??1))}">${detail.join('')}</g></g>`;
  }
  const foliageClusters=[...tree.clusters,...(tree.buds??[])];
  function padMarkup(p){return tree.nodes.filter(n=>n.pad===p.id).map(wood).join('')+(view==='skeleton'?'':foliageClusters.filter(c=>c.pad===p.id).sort((a,b)=>a.z-b.z).map(foliage).join(''));}
  const back=tree.crownDesign?'':tree.pads.filter(p=>p.z<0).sort((a,b)=>a.z-b.z).map(padMarkup).join('');
  const front=tree.crownDesign?'':tree.pads.filter(p=>p.z>=0).sort((a,b)=>a.z-b.z).map(padMarkup).join('');
  const trunks=tree.crownDesign?'':tree.nodes.filter(n=>n.role==='trunk'||n.role==='bough').map(wood).join('');
  const envelopes=tree.crownEnvelopes??[];
  const crownClips=envelopes.map(e=>`<clipPath id="${id}-crown-${e.pad}"><path d="${e.path}"/></clipPath>`).join('');
  const leafMarkup=c=>envelopes.length?`<g clip-path="url(#${id}-crown-${c.pad})">${foliage(c)}</g>`:foliage(c);
  const woodLayer=n=>tree.crownProtectWood&&n.role!=='twig'?8:tree.crownWoodDepth?.[n.id]??(n.regrown?Object.entries(tree.crownWoodDepth??{}).find(([key])=>n.id.endsWith(`:${key}`))?.[1]:undefined)??n.z??0;
  const layered=tree.crownDesign?`<defs>${crownClips}</defs>`+[
    ...tree.nodes.map(n=>({z:woodLayer(n),markup:wood(n)})),
    ...(view==='skeleton'?[]:[
      ...envelopes.map(e=>({z:e.z,markup:`<path data-crown-envelope="${e.pad}" d="${e.path}" fill="${silhouette?silhouetteColor:palette[e.z<0?0:1]}" opacity="${f(e.opacity)}"/>`})),
      ...foliageClusters.map(c=>({z:c.z,markup:c.starterLeaves?foliage(c):leafMarkup(c)}))
    ])].sort((a,b)=>a.z-b.z).map(item=>item.markup).join(''):null;
  const basePotColor=rect?['#957c66','#635344']:deep?['#747c83','#444c56']:preset.pot==='oval-blue'?['#8a9b9a','#516867']:['#879087','#515e57'];
  const potColor=basePotColor.map((c,i)=>material(i?'pot-bottom':'pot-top',c));
  const rim=rect?`<rect x="${x-w}" y="${y-9}" width="${w*2}" height="18" rx="5" fill="${material('rim','#968574')}"/>`:`<ellipse cx="${x}" cy="${y}" rx="${w}" ry="11" fill="${material('rim','#8b8879')}"/>`;
  function vesselMarkup(){
    const markup=potMarkup(selectedPot,x,y,`${id}-vessel-clip`,{dynamic:transparent||Boolean(theme)});
    if(transparent||!theme)return markup;
    const colors={'vessel-body':theme.body,'vessel-rim':theme.rim,moss:theme.moss};
    return markup.replace(/var\(--bonsai-([^,]+),([^)]+)\)/g,(_,name,fallback)=>colors[name]??fallback);
  }
  const pot=selectedPot?vesselMarkup():`<path d="M${x-w} ${y} L${x-w*(deep?.83:.78)} ${y+h} Q${x} ${y+h+12} ${x+w*(deep?.83:.78)} ${y+h} L${x+w} ${y}Z" fill="url(#${id}-pot)"/>${rim}<ellipse cx="${x}" cy="${y-2}" rx="${w-6}" ry="7" fill="${material('soil','#505141')}"/><ellipse cx="${x}" cy="${y-2}" rx="${w*.72}" ry="5" fill="${material('moss','#76815e')}"/>`;
  const base=tree.nodes.find(n=>n.role==='trunk'&&!n.parent),neck=pointOn(base,.17),radius=base.width/2;
  const roots=[-2.85,-.25,2.5,.7,1.7].map((angle,i)=>{
    const reach=Math.min(radius*(2.1+rand(`root${i}`,'reach')*.65)+5,opening.rx*.84);
    const tx=x+Math.cos(angle)*reach,ty=opening.cy+Math.sin(angle)*2.4;
    const sx=neck.x+Math.cos(angle)*radius*.32,sy=neck.y+3;
    const root={x:sx,y:sy,ex:tx,ey:ty,cx1:sx+(tx-sx)*.23,cy1:sy+(ty-sy)*.8,
      cx2:tx-(tx-sx)*.25,cy2:ty-1.2,width:radius*(i<2?.48:.38),tipWidth:.12};
    return `<path d="${taperedPath(root)}"/>`;
  }).join('');
  // Keep the moss contact inside the soil, leaving the front rim visible.
  const contact=Math.min(radius*1.65,opening.rx*.74);
  const soilContact=`<path data-root-contact clip-path="url(#${id}-soil-opening)" d="M${f(x-contact)} ${f(y-1.7)} Q${f(x-contact*.44)} ${f(y-.3)} ${f(x)} ${f(y-.9)} T${f(x+contact)} ${f(y-1.1)} L${f(x+contact)} ${f(y+2)} Q${f(x)} ${f(y+3)} ${f(x-contact)} ${f(y+2)}Z" fill="${material('moss','#76815e')}"/>`;
  const b=viewBox;

  // Only the basal segment and exposed roots enter this opening. Cascading
  // branches remain free to hang in front of or below the pot.
  const rootClip=`<clipPath id="${id}-root-opening"><rect x="${b.x}" y="${b.y}" width="${b.width}" height="${Math.max(0,opening.cy-b.y)}"/>${opening.markup}</clipPath><clipPath id="${id}-soil-opening">${opening.markup}</clipPath>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x} ${b.y} ${b.width} ${b.height}" style="background:${transparent?'transparent':colors.background}" role="img" aria-label="${preset.name}，${view==='skeleton'?'裸枝':silhouette?'单色轮廓':'完整枝叶'}"><defs>${rootClip}<linearGradient id="${id}-pot" x2="0" y2="1"><stop stop-color="${potColor[0]}"/><stop offset="1" stop-color="${potColor[1]}"/></linearGradient></defs>${transparent?'':`<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" fill="${colors.background}"/>`}<g data-weather-ground transform="${potTransform}">${pot}</g><g data-wind-tree data-wind-root="${f(root.y)}" data-wind-base-width="${f(base.width)}"><g data-exposed-roots clip-path="url(#${id}-root-opening)" fill="${woodColor}">${roots}</g>${layered??(back+trunks+front)}</g>${soilContact}</svg>`;
}
