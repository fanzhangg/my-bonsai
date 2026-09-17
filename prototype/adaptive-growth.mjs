import {createGarden,advanceGarden,pruneGarden,gardenTree,zoneStatus,canPrune,maturity,validateGarden,MODEL_VERSION} from './adaptive-growth-model.mjs';
import {render} from './growing-render.mjs';
import {pointOn} from './core/v1/model.mjs';

const $=id=>document.getElementById(id),storageKey='bonsai-adaptive-review-v1';
let state=createGarden(),baseline=createGarden(),undo=[],timer=null,seedIndex=1;
try{
  const saved=JSON.parse(localStorage.getItem(storageKey));
  if(saved?.version===MODEL_VERSION&&Number.isFinite(saved.hour)&&saved.hour>=0&&saved.hour<=8760&&validateGarden(saved)){
    state=saved;baseline=advanceGarden(createGarden(state.preset,state.seed),state.hour);
  }
}catch{/* A missing or obsolete local preview starts a fresh specimen. */}

const formatTime=hour=>`第 ${Math.floor(hour/24)} 天 · ${String(Math.floor(hour%24)).padStart(2,'0')}:${hour%1>=.5?'30':'00'}`;
function save(){try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{$('announcement').textContent='浏览器无法保存，当前预览仍可继续。';}}
function remember(){undo.push(structuredClone(state));if(undo.length>30)undo.shift();}
function stop(){if(timer)clearInterval(timer);timer=null;$('play').innerHTML='<span>▶</span> 自动生长';$('play').setAttribute('aria-pressed','false');}
function mutate(fn,{rememberState=true}={}){if(rememberState)remember();state=fn(state);save();paint();}
function advance(hours,rememberState=true){mutate(s=>advanceGarden(s,hours),{rememberState});}
function prune(id){stop();mutate(s=>pruneGarden(s,id));$('announcement').textContent='已修剪，空缺区域将重新生长。';}

function paint(){
  if(baseline.preset!==state.preset||baseline.seed!==state.seed||baseline.hour>state.hour)baseline=createGarden(state.preset,state.seed);
  if(baseline.hour<state.hour)baseline=advanceGarden(baseline,state.hour-baseline.hour);
  const comparison=$('compare').checked,shown=comparison?baseline:state,tree=gardenTree(shown);
  $('tree').innerHTML=render(tree,{id:'adaptive-review',hour:100,transparent:true,view:$('skeleton').checked?'skeleton':'foliage'});
  $('elapsed').textContent=formatTime(state.hour);
  $('scene-label').textContent=comparison?'未修剪对照 · 同一时刻':'你的树 · 可修剪';
  $('hint').textContent=comparison?'这是未修剪的对照树，关闭对照即可继续修剪。':state.nodes.some(n=>canPrune(n,state.hour))?'点击枝条上的圆点，剪去这根枝。':'新枝正在准备萌发，快进时间看看变化。';
  const zones=zoneStatus(state);
  $('zones').innerHTML=zones.map(z=>`<div class="zone-row"><div class="zone-head"><span>${z.name}</span><span class="${z.waiting||z.growing?'recovering':''}">${z.waiting?'等待萌芽':z.growing?'新枝伸展中':'枝条舒展'}</span></div><div class="zone-meter">${Array.from({length:Math.max(z.target,z.count)},(_,i)=>`<i class="${i<z.ready?'full':i<z.count?'growing':''}"></i>`).join('')}</div><p class="zone-detail">${z.ready} 根可剪${z.growing?` · ${z.growing} 根生长中`:''}${z.waiting?` · ${z.nextIn} 小时后萌芽`:''}</p></div>`).join('');
  $('branch-count').textContent=state.nodes.filter(n=>canPrune(n,state.hour)).length;
  $('new-count').textContent=state.nodes.filter(n=>n.isNew).length;
  $('cut-count').textContent=state.cutCount;
  $('journal').innerHTML=state.log.length?state.log.slice(0,8).map(e=>`<li class="${e.type}"><div>${e.text}<time>${formatTime(e.hour)}</time></div></li>`).join(''):'<li><div>一棵完整的树，等待你的第一剪。<time>从这里开始观察</time></div></li>';
  $('clear-zone').textContent=`剪空${zones.at(-1).name} ↗`;
  $('clear-zone').disabled=comparison||!state.nodes.some(n=>n.zoneId===zones.at(-1).id&&canPrune(n,state.hour));
  $('clear-all').disabled=comparison||!state.nodes.some(n=>canPrune(n,state.hour));
  $('undo').disabled=!undo.length;
  document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset===state.preset)));
  requestAnimationFrame(()=>paintMarkers(tree,shown,comparison));
}

function paintMarkers(tree,shown,comparison){
  const container=$('markers');container.replaceChildren();
  if(comparison)return;
  const svg=$('tree').querySelector('svg'),matrix=svg.getScreenCTM(),rect=container.getBoundingClientRect();
  if(!matrix)return;
  function position(el,p){const q=new DOMPoint(p.x,p.y).matrixTransform(matrix);el.style.left=`${q.x-rect.left}px`;el.style.top=`${q.y-rect.top}px`;}
  for(const n of tree.nodes){
    const original=shown.nodes.find(o=>o.id===n.id);
    if(canPrune(original,shown.hour,{fine:$('fine').checked})){
      const button=document.createElement('button');button.className=`branch-marker${n.order===2?' fine':''}`;button.textContent='−';
      button.setAttribute('aria-label',`修剪${shown.zones.find(z=>z.id===n.zoneId).name}${n.order===1?'侧枝':'细枝'} ${n.id}`);
      button.title=n.order===1?'剪去这根侧枝及其枝叶':'剪去这根二级枝';button.dataset.branchId=n.id;
      position(button,pointOn(n,n.order===1?.42:.58));button.addEventListener('click',()=>prune(n.id));container.append(button);
    }else if(original.isNew&&maturity(original,shown.hour)<1){const dot=document.createElement('i');dot.className='shoot-dot';position(dot,{x:n.ex,y:n.ey});container.append(dot);}
  }
}

document.querySelectorAll('[data-hours]').forEach(b=>b.addEventListener('click',()=>{stop();advance(Number(b.dataset.hours));}));
document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.preset===state.preset)return;stop();remember();state=createGarden(b.dataset.preset,state.seed);$('compare').checked=false;save();paint();}));
for(const id of ['fine','compare','skeleton'])$(id).addEventListener('change',paint);
$('play').addEventListener('click',()=>{
  if(timer){stop();return;}
  remember();$('play').innerHTML='<span>Ⅱ</span> 暂停生长';$('play').setAttribute('aria-pressed','true');
  timer=setInterval(()=>advance(2,false),1000);
});
$('undo').addEventListener('click',()=>{stop();if(!undo.length)return;state=undo.pop();save();paint();});
function clearBranches(zoneId){stop();mutate(s=>{const ids=s.nodes.filter(n=>canPrune(n,s.hour)&&(!zoneId||n.zoneId===zoneId)).map(n=>n.id);return ids.reduce((current,id)=>pruneGarden(current,id),s);});}
$('clear-zone').addEventListener('click',()=>clearBranches(state.zones.at(-1).id));
$('clear-all').addEventListener('click',()=>clearBranches());
$('reset').addEventListener('click',()=>{stop();remember();state=createGarden(state.preset,state.seed);$('compare').checked=false;save();paint();});
$('new-seed').addEventListener('click',()=>{stop();remember();state=createGarden(state.preset,`AFTER-THE-CUT-${Date.now()}-${seedIndex++}`);$('compare').checked=false;save();paint();});
new ResizeObserver(()=>{const shown=$('compare').checked?baseline:state;paintMarkers(gardenTree(shown),shown,$('compare').checked);}).observe($('scene'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
paint();
