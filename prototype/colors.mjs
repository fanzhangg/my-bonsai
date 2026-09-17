import {sceneFor} from './weather-model.mjs';
import {colorTokens,contrast} from './color-system.mjs';
import {LOOKS} from './core/v1/appearance.mjs';
import {PRESETS,normalize} from './core/v1/canopy.mjs';
import {snapshot,draw,HOUR} from './growth.mjs';
const $=id=>document.getElementById(id);
for(const p of PRESETS)$('style').add(new Option(p.name,p.id));
for(const l of LOOKS)$('look').add(new Option(l.name,l.id));
const timeLabel=h=>`${String(Math.floor(h)).padStart(2,'0')}:${String(Math.round(h%1*60)).padStart(2,'0')}`;
function treeFor(look){return snapshot({createdAt:0,config:normalize({preset:$('style').value,seed:'COLOR-REVIEW-01',appearance:look})},$('age').value==='young'?0:168*HOUR);}
function sceneHTML(tree,look,hour,kind,id,hero=false){
 const scene=sceneFor(null,0,{hour,kind}),tokens=colorTokens(scene,look,tree.preset);
 const style=[...scene.colors.map((c,i)=>`--sky-${['top','middle','bottom'][i]}:${c}`),...Object.entries(tokens).map(([k,v])=>`--${k}:${v}`)].join(';');
 const svg=draw(tree,{transparent:true}).replaceAll('growing-tree',id);
 return `<div class="scene ${hero?'hero':''}" style="${style}">${svg}${hero?`<span class="weather-mark">${timeLabel(hour)} · ${$('weather').selectedOptions[0].text}</span><span class="icon" aria-label="复制链接图标示意"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="8" y="8" width="11" height="12" rx="2"/><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3"/></svg></span><span class="action">认领这棵树 · 按钮示意</span>`:''}</div>`;
}
function render(){
 const look=LOOKS.find(l=>l.id===$('look').value),hour=Number($('hour').value),kind=$('weather').value,tree=treeFor(look),scene=sceneFor(null,0,{hour,kind}),tokens=colorTokens(scene,look,tree.preset);
 $('hour-label').value=timeLabel(hour);
 $('preview').outerHTML=sceneHTML(tree,look,hour,kind,'review-main',true).replace('<div ','<div id="preview" aria-label="当前配色预览" ');
 const rows=[['树干 / 背景',contrast(tokens['bonsai-bark'],scene.colors[1]),3],['最弱叶色 / 背景',Math.min(...[0,1,2,3].map(i=>contrast(tokens['bonsai-leaf-'+i],scene.colors[1]))),1.65],['按钮文字 / 按钮',contrast(tokens['action-ink'],tokens.action),4.5]];
 $('metrics').innerHTML=rows.map(([label,value,target])=>`<div class="metric"><span>${label}</span><b>${value.toFixed(2)} : 1 <small> / 目标 ${target}</small></b></div>`).join('');
 const groups=[['天气背景',scene.colors.map((c,i)=>[['天空','中景','地面'][i],c])],['叶团层次',[0,1,2,3].map((i)=>[['阴影','主体','受光','高光'][i],tokens['bonsai-leaf-'+i]])],['树干与陶盆',[['树干','bark'],['盆沿','rim'],['盆身亮部','pot-top'],['盆身暗部','pot-bottom'],['苔面','moss']].map(([n,k])=>[n,tokens['bonsai-'+k]])],['交互颜色',[['图标','ink'],['按钮','action'],['按钮文字','action-ink'],['焦点','focus'],['面板','surface']].map(([n,k])=>[n,tokens[k]])]];
 $('swatches').innerHTML=groups.map(([name,colors])=>`<article class="swatch-group"><h3>${name}</h3><div class="chips">${colors.map(([label,c])=>`<div class="chip"><i style="background:${c}"></i><span>${label}</span><code>${c.toUpperCase()}</code></div>`).join('')}</div></article>`).join('');
 $('times').innerHTML=[[6.5,'晨光'],[12,'白昼'],[18.5,'落日'],[0,'夜色']].map(([h,label],i)=>`<article class="card"><figure>${sceneHTML(tree,look,h,kind,'time-'+i)}<figcaption>${label}<small>${timeLabel(h)}</small></figcaption></figure></article>`).join('');
 $('looks').innerHTML=LOOKS.map((l,i)=>`<article class="card"><figure>${sceneHTML(treeFor(l),l,hour,kind,'look-'+i)}<figcaption>${l.name}<small>${timeLabel(hour)}</small></figcaption></figure></article>`).join('');
}
for(const id of ['style','look','weather','age'])$(id).addEventListener('change',render);
let frame;$('hour').addEventListener('input',()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(render);});
render();
