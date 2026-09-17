import {sceneFor} from './weather-model.mjs';
import {reviewColorTokens} from './design-system-color-tokens.mjs';
import {LOOKS} from './core/v1/appearance.mjs';
import {PRESETS} from './core/v1/canopy.mjs';
import {createVisitors} from './visitors.mjs';

export function createVisitorReview({getState,renderTree}){
  const $=id=>document.getElementById(`visitor-${id}`);
  let mode='day',paused=false;
  const visitors=createVisitors({scene:$('scene'),treeElement:$('tree'),layer:$('layer'),focusTarget:$('reset'),
    onCount:text=>$('count').textContent=text,onStatus:text=>$('status').textContent=text});
  function drawTree(){
    const state=getState(),sky=sceneFor(null,0,{hour:mode==='day'?10:22,kind:'clear'});
    const tokens=reviewColorTokens(sky,LOOKS.find(l=>l.id===state.look),PRESETS.find(p=>p.id===state.tree),state.tone);
    Object.entries(tokens).forEach(([key,value])=>$('scene').style.setProperty(`--${key}`,value));
    $('scene').style.background=`linear-gradient(180deg,${sky.colors.join(',')})`;
    $('tree').innerHTML=renderTree();visitors.refresh();
  }
  document.querySelectorAll('[data-visitor-time]').forEach(button=>button.addEventListener('click',()=>{
    mode=button.dataset.visitorTime;$('scene').dataset.time=mode;
    document.querySelectorAll('[data-visitor-time]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    $('time-label').textContent=mode==='day'?'白昼 · 10:00':'夜晚 · 22:00';
    $('scene-note').textContent=mode==='day'?'有的绕着枝叶飞，有的停下来歇一歇。':'夜静了，几点微光陪着这棵树。';
    drawTree();visitors.setMode(mode);
  }));
  $('pause').addEventListener('click',()=>{
    paused=!paused;$('pause').setAttribute('aria-pressed',String(paused));$('pause').textContent=paused?'继续飞舞':'暂停飞舞';
    $('status').textContent=paused?'时间停一会儿。小访客也歇一歇。':'小访客继续飞舞。';visitors.setPaused(paused);
  });
  $('reset').addEventListener('click',()=>visitors.reset());
  $('hit-areas').addEventListener('change',e=>$('scene').classList.toggle('visitor-show-hits',e.target.checked));
  return {setActive(value){if(value)drawTree();visitors.setActive(value);}};
}