import {PRESETS,normalize} from './core/v1/canopy.mjs';
import {LOOKS,BACKGROUNDS} from './core/v1/appearance.mjs';
import {grow,profile,VERSION} from './growth.mjs';
import {render,POT_SCALE} from './growing-render.mjs';
import {TONES,SHAPES,PATTERNS,POT_PRESETS,potSvg} from './design-system-pots.mjs';
import {createColorReview} from './colors.mjs';
import {createVisitorReview} from './design-system-visitors.mjs';
import {createWateringReview} from './design-system-watering.mjs';
import {createPruningReview} from './design-system-pruning.mjs';
import {MORPHOLOGY} from './morphology.mjs';

const $=id=>document.getElementById(id);
const state={tree:'juniper',shape:'oval',tone:'sand',pattern:'plain',look:'original',stage:'mature',potScale:POT_SCALE};
const notes={
  juniper:{form:'曲干 · 横向叶层',pair:'浅椭圆 / 圆角长方',pot:'01'},
  broom:{form:'直干 · 连续圆冠',pair:'圆腹 / 圆角方',pot:'02'},
  literati:{form:'瘦高 · 疏朗小冠',pair:'浅椭圆 / 折方',pot:'01'},
  pine:{form:'直干 · 收尖三角冠',pair:'折方 / 六角',pot:'03'},
  slant:{form:'斜干 · 偏向树冠',pair:'浅椭圆 / 圆角长方',pot:'05'},
  cascade:{form:'垂干 · 下落悬枝',pair:'高筒',pot:'04'},
  windswept:{form:'倾干 · 同向枝叶',pair:'浅椭圆 / 折方',pot:'03'}
};
let serial=0;
const cache=new Map();
const treeReview={view:'foliage',morphology:true,sample:1};
function scene(treeId,config,lookId='original',stage='mature',compact=false,applicationPot=false,review={}){
  const {view='foliage',morphology=true,sample=1,potScale}=review;
  const key=[treeId,lookId,stage,morphology,sample].join(':');
  if(!cache.has(key)){
    const record={version:VERSION,createdAt:0,cuts:[],config:normalize({preset:treeId,seed:`DESIGN-SYSTEM-${String(sample).padStart(2,'0')}`,appearance:LOOKS.find(l=>l.id===lookId)})};
    const tree=grow(record,stage==='young'?profile(record).initial:1,{morphology});
    cache.set(key,tree);
  }
  const cached=cache.get(key),id=`design-tree-${++serial}`;
  const tree=applicationPot?cached:{...cached,config:{...cached.config,pot:config}};
  const parsed=new DOMParser().parseFromString(render(tree,{hour:tree.hour,transparent:true,id,view,potScale}),'text/html');
  const svg=parsed.querySelector('svg');
  if(compact)svg.setAttribute('viewBox',`${tree.viewBox.x} ${tree.viewBox.y} ${tree.viewBox.width} ${tree.viewBox.height}`);
  svg.setAttribute('aria-label',`${tree.preset.name}，${applicationPot?'应用默认盆器':SHAPES.find(s=>s.id===config.shape).name+'，'+TONES.find(t=>t.id===config.tone).name}，${stage==='young'?'幼苗':'成树'}，${view==='skeleton'?'裸枝':view==='silhouette'?'单色剪影':'完整枝叶'}`);
  return new XMLSerializer().serializeToString(svg);
}
function buttons(items,field){return items.map(item=>`<button type="button" data-field="${field}" data-value="${item.id}" aria-pressed="${state[field]===item.id}">${item.name}</button>`).join('');}
$('tree-choices').innerHTML=buttons(PRESETS,'tree');
$('pattern-choices').innerHTML=buttons(PATTERNS,'pattern');
$('shape-choices').innerHTML=SHAPES.map((s,i)=>`<button type="button" data-field="shape" data-value="${s.id}" aria-pressed="${state.shape===s.id}">${potSvg({shape:s.id,tone:'sand',pattern:'plain'},`shape-${i}`)}<span>${s.name}</span></button>`).join('');
$('tone-choices').innerHTML=TONES.map(t=>`<button type="button" data-field="tone" data-value="${t.id}" aria-label="${t.name}" aria-pressed="${state.tone===t.id}" style="--swatch:${t.body};--tick:${t.id==='ink'?'#fff':'#35483b'}"><i aria-hidden="true"></i></button>`).join('');
$('tree-look').innerHTML=LOOKS.map(l=>`<option value="${l.id}">${l.name}</option>`).join('');
$('preset-strip').innerHTML=POT_PRESETS.map(p=>`<button type="button" data-preset="${p.id}" aria-pressed="${p.id==='01'}">${potSvg(p,`strip-${p.id}`)}<small>${p.id}</small><b>${p.name}</b></button>`).join('');
function paint(){
  const shape=SHAPES.find(s=>s.id===state.shape),tone=TONES.find(t=>t.id===state.tone),pattern=PATTERNS.find(p=>p.id===state.pattern);
  const preset=PRESETS.find(p=>p.id===state.tree),look=LOOKS.find(l=>l.id===state.look),background=BACKGROUNDS.find(b=>b.id===look.background);
  $('composition').innerHTML=scene(state.tree,state,state.look,state.stage,false,false,{potScale:state.potScale});
  const canvas=$('composition').parentElement;
  canvas.style.background=state.look==='original'?'#f1f2e9':background.color;
  canvas.style.color=state.look==='moon'?'#e0e8df':'#35483b';
  canvas.style.setProperty('--muted',state.look==='moon'?'#bdcbbd':'#6a7568');
  $('composition-name').textContent=`${preset.name} · ${tone.name}${shape.name}`;
  $('composition-detail').textContent=`${pattern.name} / ${look.name} / ${state.stage==='young'?'初始化幼苗':'成熟形态'} / 盆器 ${Math.round(state.potScale*100)}%`;
  $('tone-name').textContent=tone.name;
  $('tree-look').value=state.look;
  $('pairing-note').textContent=state.tree==='cascade'&&state.shape!=='tall'?'搭配提示：悬崖树形优先使用高筒，为下垂枝条留出空间。':`搭配建议：${notes[state.tree].pair}。建议不限制自由组合。`;
  document.querySelectorAll('[data-field]').forEach(b=>b.setAttribute('aria-pressed',String(state[b.dataset.field]===b.dataset.value)));
  document.querySelectorAll('[data-stage]').forEach(b=>b.setAttribute('aria-pressed',String(state.stage===b.dataset.stage)));
  document.querySelectorAll('[data-pot-scale]').forEach(b=>b.setAttribute('aria-pressed',String(state.potScale===Number(b.dataset.potScale))));
  document.querySelectorAll('#preset-strip [data-preset]').forEach(b=>{const p=POT_PRESETS.find(p=>p.id===b.dataset.preset);b.setAttribute('aria-pressed',String(['shape','tone','pattern'].every(k=>p[k]===state[k])));});
}
document.querySelectorAll('[data-field]').forEach(b=>b.addEventListener('click',()=>{state[b.dataset.field]=b.dataset.value;paint();}));
document.querySelectorAll('[data-stage]').forEach(b=>b.addEventListener('click',()=>{state.stage=b.dataset.stage;paint();}));
$('tree-look').addEventListener('change',e=>{state.look=e.target.value;paint();});
document.querySelectorAll('[data-pot-scale]').forEach(b=>b.addEventListener('click',()=>{state.potScale=Number(b.dataset.potScale);paint();}));

const tabs=[...document.querySelectorAll('[role=tab]')];
const populated=new Set();
function showPanel(name,updateHash=true){
  if(!tabs.some(tab=>tab.id===`tab-${name}`))name='compose';
  tabs.forEach(tab=>{const active=tab.id===`tab-${name}`;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;$(tab.getAttribute('aria-controls')).hidden=!active;});
  if(!populated.has(name)){if(name==='trees')buildTrees();if(name==='pots')buildPots();if(name==='system')buildSystem();populated.add(name);}
  if(name==='colors')colorReview.render();
  visitorReview.setActive(name==='visitors');
  pruningReview.setActive(name==='pruning');
  wateringReview.setActive(name==='watering');
  const motionFrame=$('motion-preview');
  if(name==='motion'){if(!motionFrame.hasAttribute('src'))motionFrame.src='/motion-preview.html';}
  else if(motionFrame.hasAttribute('src'))motionFrame.removeAttribute('src');
  if(updateHash&&location.hash!==`#${name}`)history.pushState(null,'',`#${name}`);
}
tabs.forEach((tab,index)=>{
  tab.addEventListener('click',()=>showPanel(tab.id.slice(4)));
  tab.addEventListener('keydown',e=>{let next;if(e.key==='ArrowRight')next=(index+1)%tabs.length;if(e.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;if(e.key==='Home')next=0;if(e.key==='End')next=tabs.length-1;if(next!==undefined){e.preventDefault();tabs[next].click();tabs[next].focus();}});
});
function usePot(id){const p=POT_PRESETS.find(p=>p.id===id);for(const key of ['shape','tone','pattern'])state[key]=p[key];showPanel('compose');paint();}
$('preset-strip').addEventListener('click',e=>{const b=e.target.closest('[data-preset]');if(b)usePot(b.dataset.preset);});

function buildTrees(){
  $('tree-gallery').innerHTML=PRESETS.map((p,i)=>`<article class="tree-card"><span class="index">T0${i+1} / ${MORPHOLOGY[p.id].form}</span><div class="tree-art">${scene(p.id,POT_PRESETS.find(x=>x.id===notes[p.id].pot),'original','mature',true,false,treeReview)}</div><h3>${p.name}</h3><p>${treeReview.morphology?MORPHOLOGY[p.id].note:p.note}<br>建议盆形：${notes[p.id].pair}</p><button type="button" data-tree-preview="${p.id}">搭配这棵树 →</button></article>`).join('');
  $('tree-review-status').textContent=`${treeReview.morphology?'新版形态':'旧版对照'} · 样本 ${String(treeReview.sample).padStart(2,'0')} · 同一镜头与盆器`;
}
$('tree-gallery').addEventListener('click',e=>{const b=e.target.closest('[data-tree-preview]');if(b){state.tree=b.dataset.treePreview;usePot(notes[state.tree].pot);tabs[0].focus();}});
$('tree-review-view').addEventListener('change',e=>{treeReview.view=e.target.value;buildTrees();});
$('tree-review-version').addEventListener('change',e=>{treeReview.morphology=e.target.value==='new';buildTrees();});
$('tree-review-sample').addEventListener('click',()=>{treeReview.sample=treeReview.sample%5+1;buildTrees();});
function buildPots(){
  $('pot-gallery').innerHTML=POT_PRESETS.map(p=>{const s=SHAPES.find(s=>s.id===p.shape);return `<article class="pot-card"><span class="index">P${p.id} / ${s.name}</span>${potSvg(p,`gallery-${p.id}`)}<h3>${p.name}</h3><p>${s.note}</p><div class="ratio"><span>宽 : 高 ≈ ${(s.width/s.height).toFixed(1)} : 1</span><span>${PATTERNS.find(x=>x.id===p.pattern).name}</span></div><button type="button" data-gallery-preset="${p.id}">放入组合预览</button></article>`;}).join('');
  $('pot-gallery').addEventListener('click',e=>{const b=e.target.closest('[data-gallery-preset]');if(b){usePot(b.dataset.galleryPreset);tabs[0].focus();}});
  $('pattern-gallery').innerHTML=PATTERNS.map(p=>`<article class="pattern-item">${potSvg({shape:'soft',tone:'porcelain',pattern:p.id},`pattern-${p.id}`)}<h3>${p.name}</h3><p>${p.note}</p></article>`).join('');
  $('pot-anatomy').innerHTML=`<svg viewBox="-145 -62 310 238" role="img" aria-label="盆体、花纹、盆沿、土面四层分解示意"><g transform="translate(0 120)"><path d="M-88 0 V18 Q-88 49 -53 49 H53 Q88 49 88 18 V0Z" fill="#deded2"/></g><g transform="translate(0 71)" stroke="#6e8ba6" stroke-width="2" fill="none"><path d="M-45 12 L-26 -3 L-9 12 M-18 7 L3 -12 L32 12"/></g><ellipse cy="30" rx="88" ry="9" fill="#efeee5" stroke="#c3c9b9" stroke-width=".7"/><ellipse cy="30" rx="81" ry="6" fill="#faf9f3"/><ellipse cy="-22" rx="81" ry="6" fill="#505141"/><ellipse cy="-22" rx="60" ry="3.5" fill="#76815e"/><path d="M-105 -20 V145 M105 -20 V145" stroke="#aeb7a5" stroke-dasharray="3 5" fill="none"/><g font-family="sans-serif" font-size="11" fill="#6a7568"><text x="116" y="148">01</text><text x="116" y="82">02</text><text x="116" y="34">03</text><text x="116" y="-18">04</text></g></svg>`;
}
function buildSystem(){
  const ui=[['纸白','#faf9f3'],['正文','#35483b'],['主操作','#355d47'],['焦点','#bd875c'],['次级文字','#6a7568'],['分隔线','#dce0d4'],['选中底色','#e8eee2'],['土面','#505141']];
  const colors=items=>items.map(([name,color])=>`<div class="token-color"><i style="background:${color}"></i><span>${name}</span><code>${color.toUpperCase()}</code></div>`).join('');
  $('ui-colors').innerHTML=colors(ui);$('pot-colors').innerHTML=colors(TONES.map(t=>[t.name,t.body]));
}
$('sample-claim').addEventListener('click',()=>{$('component-status').textContent='已演示主操作反馈；未创建真实盆栽。';});
$('sample-option').addEventListener('click',e=>{const pressed=e.target.getAttribute('aria-pressed')!=='true';e.target.setAttribute('aria-pressed',String(pressed));e.target.textContent=pressed?'✓ 圆腹已选':'选择圆腹';});
const colorReview=createColorReview({
  getState:()=>state,
  updateState:patch=>{Object.assign(state,patch);paint();},
  renderTree:(look,applicationPot)=>scene(state.tree,state,look,state.stage,false,applicationPot),
  editPot:()=>{showPanel('compose');tabs[0].focus();}
});
document.querySelectorAll('[data-open-colors]').forEach(button=>button.addEventListener('click',()=>{showPanel('colors');$('tab-colors').focus();}));
const visitorReview=createVisitorReview({getState:()=>state,renderTree:()=>scene(state.tree,state,state.look,state.stage)});
const pruningReview=createPruningReview();
const wateringReview=createWateringReview();
window.addEventListener('hashchange',()=>showPanel(location.hash.slice(1),false));
paint();showPanel(location.hash.slice(1)||'compose',false);
