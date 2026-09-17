import { Simulation, DEFAULTS, VERSION, versionFor, MAX_HOUR, sample, growth, pointOn, affectedIds, validateScene, pruneAt } from './experiment.mjs';
import { taperedPath, potMarkup } from './style-render.mjs';

const $=id=>document.getElementById(id);
const STORE='bonsai-style-lab-v2';
let config={...DEFAULTS},events=[],hour=0,latest=0,selected=null,sim,controlSim,state;
let legacyReview='',previousTimeline=null;
let playing=false,playTarget=96,frame=0,lastTime=0,painted=-1,replaying=false;
let zoom=1,panX=0,panY=0,renderedNodes=[],toastTimer;
const cutColor='#b67853';
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const snap=v=>Math.round(v*2)/2;
const fmt=h=>`${h} 小时`;
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3600);}
function scene(){return {version:versionFor(config),config,events,hour:latest};}
function save(){try{localStorage.setItem(STORE,JSON.stringify({...scene(),review:legacyReview}));}catch{toast('本机存储不可用，请导出场景。');}}
function load(){try{const raw=localStorage.getItem(STORE);if(raw){const data=JSON.parse(raw),valid=validateScene(data);config=valid.config;events=valid.events;latest=valid.hour;hour=latest;legacyReview=String(data.review||'').slice(0,20000);}else{const old=localStorage.getItem('bonsai-style-lab-v1');if(old){const data=validateScene(JSON.parse(old));config={...DEFAULTS,...data.config,algorithmVersion:VERSION};previousTimeline=data;}}const previous=localStorage.getItem(`${STORE}-previous`);if(previous)previousTimeline=validateScene(JSON.parse(previous));}catch{toast('存储场景无法读取。');}}
function createSims(){sim=new Simulation(config,events);controlSim=new Simulation(config,[]);}
function syncControls(){
  for(const style of ['moyogi','literati','cascade','legacy']){const active=(config.style||'legacy')===style;$(style).classList.toggle('active',active);$(style).setAttribute('aria-pressed',String(active));}
  $('legacy-model').hidden=!!config.style&&config.style!=='legacy';
  $('style-debug').hidden=!config.style||config.style==='legacy';
  for(const key of ['movement','taper','density']){$(key).value=config[key]??DEFAULTS[key];$(`${key}-value`).textContent=Number($(key).value).toFixed(2);}
  $('guidance').checked=config.guidance!==false;
  $('seed').value=config.seed;for(const key of ['dominance','light','randomness'])$(key).value=config[key];
  $('dominance-value').textContent=`${Math.round(config.dominance*100)}%`;
  $('randomness-value').textContent=`${Math.round(config.randomness*100)}%`;
  $('light-value').textContent=config.light===0?'正上方':`${config.light<0?'左':'右'} ${Math.abs(config.light)}°`;
  for(const mode of ['adaptive','baseline']){$(mode).classList.toggle('active',config.mode===mode);$(mode).setAttribute('aria-pressed',String(config.mode===mode));}
  $('dominance').disabled=$('light').disabled=config.mode==='baseline';
}
function reset(next=config){stop();config={...next};events=[];selected=null;$('candidates').hidden=true;hour=0;latest=0;zoom=1;panX=panY=0;createSims();syncControls();draw();save();}
const lerp=(a,b,t)=>a+(b-a)*t;
function partial(n,t){
  const a={x:lerp(n.x,n.cx1,t),y:lerp(n.y,n.cy1,t)};
  const b={x:lerp(n.cx1,n.cx2,t),y:lerp(n.cy1,n.cy2,t)};
  const p=pointOn(n,t);
  return `M${n.x.toFixed(2)} ${n.y.toFixed(2)} C${a.x.toFixed(2)} ${a.y.toFixed(2)} ${lerp(a.x,b.x,t).toFixed(2)} ${lerp(a.y,b.y,t).toFixed(2)} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
}
function geometry(snapshot,t){
  const map=new Map();
  for(const n of snapshot.nodes){
    let dx=0,dy=0;
    if(n.parent){const p=map.get(n.parent);const at=pointOn(p,n.attach*growth(p,t));dx=at.x-n.x;dy=at.y-n.y;}
    map.set(n.id,{...n,x:n.x+dx,y:n.y+dy,cx1:n.cx1+dx,cy1:n.cy1+dy,cx2:n.cx2+dx,cy2:n.cy2+dy,ex:n.ex+dx,ey:n.ey+dy});
  }
  return [...map.values()];
}
function draw(){
  const started=performance.now();
  const t=snap(hour);state=sim.at(t);if(!state)return;
  const styled=!!sim.plan;
  const box=styled?sim.plan.viewBox:{x:0,y:0,width:500,height:540};
  $('tree').setAttribute('viewBox',`${box.x} ${box.y} ${box.width} ${box.height}`);
  $('pot-layer').innerHTML=styled?potMarkup(sim.plan.pot,config.style):legacyPot;
  $('ground').style.display=styled?'none':'';$('ground-shadow').style.display=styled?'none':'';
  $('guide-layer').innerHTML=styled&&$('guides').checked?sim.plan.pads.filter(p=>state.nodes.some(n=>n.id===p.owner)).map(p=>`<ellipse cx="${p.x}" cy="${p.y}" rx="${p.rx}" ry="${p.ry}" fill="#749264" fill-opacity=".08" stroke="#8caa78" stroke-dasharray="4 4"/>`).join('')+sim.plan.gaps.map(p=>`<ellipse cx="${p.x}" cy="${p.y}" rx="${p.rx}" ry="${p.ry}" fill="#bf9870" fill-opacity=".15" stroke="#bb9675" stroke-dasharray="3 4"/>`).join(''):'';
  if(selected&&!state.nodes.some(n=>n.id===selected))selected=null;
  const chosen=selected?affectedIds(state,selected):new Set();
  renderedNodes=geometry(state,t);
  const stems=[],leaves=[],hits=[],buds=[];
  const byId=new Map(renderedNodes.map(n=>[n.id,n]));
  for(const n of renderedNodes){
    const g=growth(n,t);if(g<.002)continue;
    const path=partial(n,g);const chosenNode=chosen.has(n.id);
    const color=chosenNode?'#b87d57':n.regrown&&t-n.born<12?cutColor:'#6b6049';
    if(styled)stems.push(`<path d="${taperedPath(n,g)}" fill="${color}"/>`);
    else stems.push(`<path class="stem" d="${path}" fill="none" stroke="${color}" stroke-width="${Math.max(.65,n.width*(.4+.6*g)).toFixed(2)}"/>`);
    if((n.order??n.depth)<2)stems.push(`<path class="stem" d="${path}" fill="none" stroke="#ae9a74" opacity=".24" stroke-width="${Math.max(.6,n.width*.1)}"/>`);
    const end=pointOn(n,g);
    let childGrowth=0;for(const s of n.slots){if(s.child&&byId.has(s.child))childGrowth=Math.max(childGrowth,growth(byId.get(s.child),t));}
    const leafOpacity=(styled&&n.role==='trunk'?0:(1-childGrowth)**2*g);
    if(!$('skeleton').checked&&leafOpacity>.02){
      const count=styled?5+Math.round(sample(config.seed,n.key,'leafCount')*5):7+Math.round(sample(config.seed,n.key,'leafCount')*6);
      const radius=styled?(config.style==='literati'?8:10):12+(7-n.depth)*1.2;
      const colors=chosenNode?['#b99161','#bc9b70','#a78358']:['#627b46','#7c9155','#536e40','#8e9e64','#a4af7a'];
      for(let j=0;j<count;j++){
        const a=sample(config.seed,n.key,`leafAngle${j}`)*Math.PI*2;
        const d=Math.sqrt(sample(config.seed,n.key,`leafD${j}`))*radius;
        const x=end.x+Math.cos(a)*d*1.45,y=end.y+Math.sin(a)*d*.65;
        const rx=(styled?3+sample(config.seed,n.key,`leafSize${j}`)*4:5+sample(config.seed,n.key,`leafSize${j}`)*6)*(.4+.6*g);
        leaves.push(`<ellipse cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" rx="${rx.toFixed(2)}" ry="${(rx*.55).toFixed(2)}" transform="rotate(${(a*18).toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})" fill="${colors[j%colors.length]}" opacity="${(leafOpacity*.85).toFixed(2)}"/>`);
      }
    }
    if(n.depth>0){hits.push(`<path data-branch="${n.id}" d="${path}" fill="none" stroke="transparent" stroke-width="18" tabindex="0" role="button" aria-label="选择枝条 ${n.id}"/>`);}
    if($('buds').checked)for(const s of n.slots){
      if(s.child)continue;
      const sleeping=t>s.expires;
      buds.push(`<circle cx="${end.x}" cy="${end.y}" r="${sleeping?3:4}" fill="${sleeping?'#dadbc8':s.regrow?'#bc8155':'#b6c779'}" stroke="${sleeping?'#929779':'#789450'}" stroke-width="1"/>`);
    }
  }
  $('branch-layer').innerHTML=stems.join('');$('leaf-layer').innerHTML=leaves.join('');$('hit-layer').innerHTML=hits.join('');$('bud-layer').innerHTML=buds.join('');
  $('scar-layer').innerHTML=state.scars.filter(s=>t-s.at<72&&byId.has(s.parent)).map(s=>`<circle cx="${s.x}" cy="${s.y}" r="3" fill="${cutColor}" opacity="${Math.max(.15,1-(t-s.at)/72)}"/>`).join('');
  $('ghost-layer').innerHTML=$('compare').checked?geometry(controlSim.at(t),t).map(n=>`<path d="${partial(n,growth(n,t))}" fill="none" stroke="#afbda0" opacity=".38" stroke-width="${Math.max(1,n.width*.7)}" stroke-dasharray="3 3"/>`).join(''):'';
  $('viewport').setAttribute('transform',`translate(${250+panX} ${370+panY}) scale(${zoom}) translate(-250 -370)`);
  $('age').textContent=fmt(t);
  const horizon=Math.max(96,Math.ceil(latest/24)*24);$('timeline').max=horizon;$('timeline').value=t;
  document.querySelector('.time-marks').innerHTML=Array.from({length:5},(_,i)=>`<span>${horizon*i/4}h</span>`).join('');
  $('now').hidden=t>=latest&&!replaying;
  $('branch-count').textContent=state.nodes.length;$('bud-count').textContent=state.dormant;$('cut-count').textContent=state.applied.length;
  $('selection').hidden=!selected;
  if(selected){
    const n=state.nodes.find(n=>n.id===selected);const diag=n.slots.find(s=>s.diagnostics)?.diagnostics;
    $('selected-name').textContent=`${styled?({trunk:'主干',primary:'主枝',twig:'细枝'}[n.role]):`第 ${n.depth} 层`} · ${chosen.size} 段`;
    $('selected-info').textContent=`${t-n.born>=n.duration?'已长足':'生长中'} · ${n.born<0?'出生时已有':`第 ${+(n.born/24).toFixed(2)} 天长出`}${diag?` · 受光 ${Math.round(diag.light*100)}% · 空间 ${Math.round(diag.room*100)}%`:''}`;
    const futureCuts=events.filter(e=>e.at>t).length;
    $('branch-notice').hidden=t>=latest;
    $('branch-notice').textContent=futureCuts?`从此刻重新模拟，替换后续 ${futureCuts} 刀；原时间线可导出。`:'从此刻继续模拟。';
  }
  $('render-time').textContent=`${(performance.now()-started).toFixed(1)} ms / 帧`;
  $('export-previous').hidden=!previousTimeline;
  renderHistory();
}
function renderHistory(){
  $('event-ticks').replaceChildren();
  events.forEach((e,i)=>{
    const b=document.createElement('button');b.textContent=`${i+1} · ${e.at}h`;b.title=e.branch;b.onclick=()=>{stop();hour=e.at;selected=null;draw();};$('event-ticks').append(b);
  });
}
function stop(){playing=false;replaying=false;hour=snap(hour);cancelAnimationFrame(frame);$('play').textContent='播放';}
function animate(time){
  if(!playing)return;
  const dt=Math.min(.1,(time-lastTime)/1000);lastTime=time;
  hour=Math.min(playTarget,hour+dt*Number($('speed').value));
  if(!replaying)latest=Math.max(latest,snap(hour));
  if(snap(hour)!==painted){painted=snap(hour);draw();}
  if(hour>=playTarget){stop();hour=snap(hour);draw();save();return;}
  frame=requestAnimationFrame(animate);
}
function play(replay=false){
  if(playing){stop();draw();save();return;}
  selected=null;replaying=replay;
  if(replay){playTarget=latest;hour=0;}
  else playTarget=hour<latest?latest:Math.min(MAX_HOUR,Math.max(96,latest+24));
  if(playTarget===0){replaying=false;return;}
  if(reduceMotion){hour=playTarget;latest=Math.max(latest,hour);replaying=false;draw();save();toast('已按减少动态设置直接展示终点，可拖时间轴逐步查看。');return;}
  playing=true;lastTime=performance.now();painted=-1;$('play').textContent='暂停';frame=requestAnimationFrame(animate);
}
function selectBranch(id){stop();selected=id;$('candidates').hidden=true;draw();}
function confirmCut(){
  if(!selected)return;
  stop();
  const before=scene(),next=pruneAt(before,selected,hour,crypto.randomUUID());
  if(hour<latest){previousTimeline=before;try{localStorage.setItem(`${STORE}-previous`,JSON.stringify(before));}catch{toast('原时间线未能存入本机，可立即导出。');}}
  events=next.events;latest=hour=next.hour;sim=new Simulation(config,events);selected=null;save();draw();
}
function advance(hours){stop();selected=null;hour=Math.min(MAX_HOUR,snap(hour+hours));latest=Math.max(latest,hour);draw();save();}
function download(name,body,type='application/json'){
  const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportScene(){download(`bonsai-${config.seed.replace(/[^\w-]/g,'').slice(0,30)||'scene'}.json`,JSON.stringify({...scene(),...(legacyReview?{review:legacyReview}:{})},null,2));}
$('export-previous').onclick=()=>{if(previousTimeline)download('bonsai-previous.json',JSON.stringify(previousTimeline,null,2));};
$('play').onclick=()=>play();$('replay').onclick=()=>{stop();play(true);};
$('now').onclick=()=>{stop();hour=latest;selected=null;draw();};
$('timeline').oninput=()=>{stop();hour=+$('timeline').value;latest=Math.max(latest,hour);selected=null;draw();};$('timeline').onchange=save;
document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>advance(+b.dataset.jump));
$('cancel-cut').onclick=()=>{selected=null;draw();};$('confirm-cut').onclick=confirmCut;
for(const mode of ['adaptive','baseline'])$(mode).onclick=()=>{if(mode===config.mode)return;reset({...config,mode});toast('模型已切换，开始同种子的新实验。');};
for(const style of ['moyogi','literati','cascade','legacy'])$(style).onclick=()=>{
  if((config.style||'legacy')===style)return;
  reset({...DEFAULTS,seed:config.seed,style,mode:'adaptive'});
};
for(const key of ['movement','taper','density']){
  $(key).oninput=()=>{$(`${key}-value`).textContent=Number($(key).value).toFixed(2);};
  $(key).onchange=()=>reset({...config,[key]:+$(key).value});
}
$('guidance').onchange=()=>reset({...config,guidance:$('guidance').checked});
$('guides').onchange=draw;
$('load-legacy').onclick=()=>{try{
  const raw=localStorage.getItem('bonsai-style-lab-v1')||localStorage.getItem('bonsai-growth-lab-v1');if(!raw){toast('此浏览器没有旧实验，可用导入打开 JSON。');return;}
  const data=JSON.parse(raw),valid=validateScene(data);stop();config=valid.config;events=valid.events;hour=latest=valid.hour;selected=null;zoom=1;panX=panY=0;legacyReview=String(data.review||'').slice(0,20000);createSims();syncControls();draw();save();
}catch(error){toast(`读取失败：${error.message}`);}};
for(const key of ['dominance','light','randomness']){
  $(key).oninput=()=>{$(`${key}-value`).textContent=key==='light'?`${+$(key).value<0?'左':'右'} ${Math.abs(+$(key).value)}°`:`${Math.round(+$(key).value*100)}%`;};
  $(key).onchange=()=>{reset({...config,[key]:+$(key).value});toast('参数已更新，开始新实验。');};
}
$('apply-seed').onclick=()=>reset({...config,seed:$('seed').value.trim()||DEFAULTS.seed});$('seed').onkeydown=e=>{if(e.key==='Enter')$('apply-seed').click();};
$('new-seed').onclick=()=>reset({...config,seed:`MOSS-${crypto.getRandomValues(new Uint32Array(1))[0].toString(16).slice(0,6).toUpperCase()}`});
$('reset').onclick=()=>{reset();toast('已恢复这棵树的初始状态。');};
for(const key of ['compare','buds','skeleton'])$(key).onchange=draw;
$('export').onclick=exportScene;$('import').onclick=()=>$('import-file').click();
$('import-file').onchange=async e=>{
  try{const file=e.target.files[0];if(!file)return;if(file.size>300000)throw new Error('文件不能大于 300 KB');const data=JSON.parse(await file.text());const valid=validateScene(data);stop();config=valid.config;events=valid.events;latest=valid.hour;hour=latest;selected=null;legacyReview=String(data.review||'').slice(0,20000);createSims();syncControls();draw();save();toast('已导入');}catch(error){toast(`导入失败：${error.message}`);}finally{e.target.value='';}
};

// Pointer hit testing uses the rendered curves, with an explicit candidate
// chooser for overlapping branches. Gestures never submit a cut.
const pointers=new Map();let gesture=null,moved=false;
const svg=$('tree');
function svgPoint(e){const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());return {x:(p.x-250-panX)/zoom+250,y:(p.y-370-panY)/zoom+370};}
function distance(n,p){let best=Infinity;const g=growth(n,snap(hour));for(let i=0;i<=16;i++){const q=pointOn(n,g*i/16);best=Math.min(best,Math.hypot(p.x-q.x,p.y-q.y));}return best;}
svg.addEventListener('pointerdown',e=>{
  if(playing){stop();draw();}
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});svg.setPointerCapture(e.pointerId);
  moved=false;gesture={x:e.clientX,y:e.clientY,panX,panY,zoom,distance:pointers.size===2?Math.hypot(...pointerDelta()):0};
});
function pointerDelta(){const p=[...pointers.values()];return [p[0].x-p[1].x,p[0].y-p[1].y];}
svg.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId)||!gesture)return;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
  if(Math.hypot(dx,dy)>7)moved=true;
  if(pointers.size===2&&gesture.distance){zoom=Math.max(1,Math.min(2.6,gesture.zoom*Math.hypot(...pointerDelta())/gesture.distance));moved=true;draw();}
  else if(moved&&zoom>1){const scale=1/svg.getScreenCTM().a;panX=Math.max(-150,Math.min(150,gesture.panX+dx*scale));panY=Math.max(-150,Math.min(150,gesture.panY+dy*scale));draw();}
});
svg.addEventListener('pointerup',e=>{
  const wasMulti=pointers.size>1;pointers.delete(e.pointerId);
  if(moved||wasMulti){moved=true;return;}
  const p=svgPoint(e);const choices=renderedNodes.filter(n=>n.depth>0&&growth(n,hour)>.05).map(n=>({n,d:distance(n,p)})).filter(o=>o.d<12/zoom).sort((a,b)=>a.d-b.d).slice(0,4);
  if(!choices.length){selected=null;$('candidates').hidden=true;draw();return;}
  if(choices.length===1){selectBranch(choices[0].n.id);return;}
  selected=choices[0].n.id;draw();$('candidates').replaceChildren();$('candidates').hidden=false;
  choices.forEach(({n},i)=>{const b=document.createElement('button');b.textContent=`${i+1} · 第${n.depth}层`;b.onclick=()=>selectBranch(n.id);$('candidates').append(b);});
});
svg.addEventListener('pointercancel',()=>{pointers.clear();moved=true;});
$('hit-layer').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.dataset.branch){e.preventDefault();selectBranch(e.target.dataset.branch);}});
// Synthetic accessibility clicks have detail=0; pointer clicks are handled above.
$('hit-layer').addEventListener('click',e=>{if(e.detail===0&&e.target.dataset.branch)selectBranch(e.target.dataset.branch);});
$('zoom-in').onclick=()=>{zoom=Math.min(2.6,zoom+.3);draw();};$('zoom-out').onclick=()=>{zoom=Math.max(1,zoom-.3);if(zoom===1)panX=panY=0;draw();};$('zoom-reset').onclick=()=>{zoom=1;panX=panY=0;draw();};
document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();save();}});
const legacyPot=$('pot-layer').innerHTML;
$('viewport').insertBefore($('pot-layer'),$('branch-layer'));
load();createSims();syncControls();draw();
