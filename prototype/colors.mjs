import {sceneFor} from './weather-model.mjs';
import {colorTokens,contrast,mix} from './color-system.mjs';
import {reviewColorTokens} from './design-system-color-tokens.mjs';
import {LOOKS} from './core/v1/appearance.mjs';
import {PRESETS} from './core/v1/canopy.mjs';
import {TONES,SHAPES,PATTERNS} from './design-system-pots.mjs';

const timeLabel=h=>`${String(Math.floor(h)).padStart(2,'0')}:${String(Math.round(h%1*60)).padStart(2,'0')}`;
export function createColorReview({getState,updateState,renderTree,editPot}){
  const $=name=>document.getElementById(`color-${name}`);
  for(const p of PRESETS)$('tree').add(new Option(p.name,p.id));
  for(const l of LOOKS)$('look').add(new Option(l.name,l.id));
  function tokensFor(scene,look){
    const state=getState(),preset=PRESETS.find(p=>p.id===state.tree);
    return $('pot-mode').value==='app'?colorTokens(scene,look,preset):reviewColorTokens(scene,look,preset,state.tone);
  }
  function frame(look,hour,kind,hero=false){
    const scene=sceneFor(null,0,{hour,kind}),tokens=tokensFor(scene,look);
    const style=[...scene.colors.map((c,i)=>`--sky-${['top','middle','bottom'][i]}:${c}`),...Object.entries(tokens).map(([k,v])=>`--${k}:${v}`)].join(';');
    const svg=renderTree(look.id,$('pot-mode').value==='app');
    return `<div class="color-scene ${hero?'color-hero':''}" style="${style}">${svg}${hero?`<span class="color-weather-mark">${timeLabel(hour)} · ${$('weather').selectedOptions[0].text}</span><span class="color-icon" aria-label="复制链接图标示意"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="8" y="8" width="11" height="12" rx="2"/><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3"/></svg></span><span class="color-action">认领这棵树 · 按钮示意</span>`:''}</div>`;
  }
  function render(){
    const state=getState();
    $('tree').value=state.tree;$('look').value=state.look;$('stage').value=state.stage;
    const look=LOOKS.find(l=>l.id===state.look),hour=Number($('hour').value),kind=$('weather').value;
    const scene=sceneFor(null,0,{hour,kind}),tokens=tokensFor(scene,look),design=$('pot-mode').value==='design';
    $('hour-label').value=timeLabel(hour);
    $('preview').innerHTML=frame(look,hour,kind,true);
    const potName=`${TONES.find(t=>t.id===state.tone).name}${SHAPES.find(s=>s.id===state.shape).name} · ${PATTERNS.find(p=>p.id===state.pattern).name}`;
    $('current-pot').textContent=design?potName:'应用默认盆器 · 随树形分配';
    $('token-note').textContent=design?'新盆器明暗适配为审核提案；树木与控件沿用应用算法':'应用当前配色 · 色值随场景更新';
    const ground=mix(scene.colors[1],scene.colors[2],.45);
    const rows=[['树干 / 中景',contrast(tokens['bonsai-bark'],scene.colors[1]),3],['最弱叶色 / 中景',Math.min(...[0,1,2,3].map(i=>contrast(tokens['bonsai-leaf-'+i],scene.colors[1]))),1.65],['盆体 / 地面',design?contrast(tokens['review-pot-body'],ground):Math.min(contrast(tokens['bonsai-pot-top'],ground),contrast(tokens['bonsai-pot-bottom'],ground)),2],['按钮文字 / 按钮',contrast(tokens['action-ink'],tokens.action),4.5]];
    $('metrics').innerHTML=rows.map(([label,value,target])=>`<div class="color-metric"><span>${label}</span><b>${value.toFixed(2)} : 1 <small>/ 目标 ${target}</small></b></div>`).join('');
    const material=design?[['树干','bonsai-bark'],['盆体','review-pot-body'],['盆沿','review-pot-rim'],['花纹','review-pot-pattern'],['苔面','bonsai-moss']]:[['树干','bonsai-bark'],['盆沿','bonsai-rim'],['盆身亮部','bonsai-pot-top'],['盆身暗部','bonsai-pot-bottom'],['苔面','bonsai-moss']];
    const groups=[['天气背景',scene.colors.map((c,i)=>[['天空','中景','地面'][i],c])],['叶团层次',[0,1,2,3].map(i=>[['阴影','主体','受光','高光'][i],tokens['bonsai-leaf-'+i]])],['树干与盆器',material.map(([n,k])=>[n,tokens[k]])],['交互颜色',[['图标','ink'],['按钮','action'],['按钮文字','action-ink'],['焦点','focus'],['面板','surface']].map(([n,k])=>[n,tokens[k]])]];
    $('swatches').innerHTML=groups.map(([name,colors])=>`<article class="color-swatch-group"><h3>${name}</h3><div class="color-chips">${colors.map(([label,c])=>`<div class="color-chip"><i style="background:${c}"></i><span>${label}</span><code>${c.toUpperCase()}</code></div>`).join('')}</div></article>`).join('');
    $('times').innerHTML=[[6.5,'晨光'],[12,'白昼'],[18.5,'落日'],[0,'夜色']].map(([h,label])=>`<figure class="color-card">${frame(look,h,kind)}<figcaption>${label}<small>${timeLabel(h)}</small></figcaption></figure>`).join('');
    $('looks').innerHTML=LOOKS.map(l=>`<figure class="color-card">${frame(l,hour,kind)}<figcaption>${l.name}<small>${timeLabel(hour)}</small></figcaption></figure>`).join('');
  }
  for(const [control,field] of [['tree','tree'],['look','look'],['stage','stage']])$(control).addEventListener('change',()=>{updateState({[field]:$(control).value});render();});
  for(const control of ['weather','pot-mode'])$(control).addEventListener('change',render);
  let pending;
  $('hour').addEventListener('input',()=>{cancelAnimationFrame(pending);pending=requestAnimationFrame(render);});
  $('edit-pot').addEventListener('click',()=>{$('pot-mode').value='design';editPot();});
  return {render};
}
