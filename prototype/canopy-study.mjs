import {VERSION,PRESETS,normalize,generate,generateReference,render} from './canopy.mjs';
import {render as oldRender} from './specimens.mjs';
import {LOOKS,SHAPES,FOLIAGE,BARK,BACKGROUNDS,normalizeAppearance,lookFor,appearanceName,colorsFor} from './appearance.mjs';
const $=id=>document.getElementById(id),STORE='bonsai-canopy-review-v2';
const fields=[['crownCount','冠团数量',3,6,1],['padScale','叶团体积',.7,1.25,.05],['leafScale','叶片 / 针束大小',.65,1.5,.05],['coverage','叶团覆盖度',.45,1,.05],['tipScale','枝梢预算',.65,1.35,.05]];
let seed='BONSAI-01',view='foliage',mode='looks',hour=96,editing=null,chosen=[],timer,appearance=normalizeAppearance();
const edits=new Map(),cache=new Map(),oldCache=new Map(),key=c=>JSON.stringify(normalize(c));
function tree(c){const k=key(c);if(!cache.has(k)){if(cache.size>80)cache.clear();cache.set(k,generate(c));}return cache.get(k);}
function oldTree(c){const k=JSON.stringify([c.preset,c.seed]);if(!oldCache.has(k)){if(oldCache.size>30)oldCache.clear();oldCache.set(k,generateReference(c));}return oldCache.get(k);}
function configFor(p){return normalize({...edits.get(p),preset:p,seed,appearance});}
function notify(s){$('status').textContent=s;$('status').classList.add('show');clearTimeout(timer);timer=setTimeout(()=>$('status').classList.remove('show'),2300);}
function save(){try{localStorage.setItem(STORE,JSON.stringify({version:VERSION,candidates:chosen}));}catch{notify('本机保存失败，请导出参数。');}}
function picked(c){return chosen.some(v=>key(c)===key(v));}
function toggle(c){const i=chosen.findIndex(v=>key(v)===key(c));if(i>=0)chosen.splice(i,1);else{if(chosen.length>=30){notify('最多保存 30 个候选');return;}chosen.push(normalize(c));}save();draw();if(editing)updateEditor();}
function framing(c){const a=tree(c).viewBox,b=oldTree(c).viewBox,x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);return {x,y,width:Math.max(a.x+a.width,b.x+b.width)-x,height:Math.max(a.y+a.height,b.y+b.height)-y};}
function drawTree(c,id){return render(tree(c),{id,view,hour,viewBox:framing(c)});}
function oldDrawing(c,id){const b=framing(c),t={...oldTree(c),viewBox:b};return oldRender(t,{id,hour,skeleton:view==='skeleton'});}
function draw(){
  $('gallery').classList.toggle('compare',mode==='compare');$('gallery').classList.toggle('single',mode!=='looks'&&$('preset').value!=='all');$('gallery').replaceChildren();
  for(const b of $('versions').children)b.setAttribute('aria-pressed',String(b.dataset.mode===mode));
  const selected=$('preset').value,looks=mode==='looks';
  const samples=looks?LOOKS.map(look=>({c:normalize({...configFor(selected==='all'?'juniper':selected),appearance:look}),look})):PRESETS.filter(p=>selected==='all'||selected===p.id).map(p=>({c:configFor(p.id)}));
  for(const {c,look}of samples){const p=PRESETS.find(p=>p.id===c.preset),t=tree(c),article=document.createElement('article');article.className=`card${picked(c)?' picked':''}`;
    article.innerHTML=`<div class="card-head"><h2>${look?look.name:p.name}</h2><span class="code">${look?p.name:p.note}</span></div>${look?`<p class="look-note">${look.note}</p>`:''}`+
      (mode==='compare'?`<div class="pair"><div><p class="pair-label">旧版 · 独立撒叶</p><div class="tree-frame ${view==='silhouette'?'silhouette-old':''}">${oldDrawing(c,`old-${p.id}`)}</div></div><div><p class="pair-label"><strong>新版 · 成组叶团</strong></p><div class="tree-frame">${drawTree(c,`new-${p.id}`)}</div></div></div>`:`<div class="tree-frame">${drawTree(c,look?`${p.id}-${look.id}`:p.id)}</div>`)+
      `<div class="card-foot">${look?'<button data-use>使用方案</button>':''}<button data-edit>调参数</button>${look?'':`<small>${appearanceName(c.appearance)}</small>`}<button data-pick aria-pressed="${picked(c)}">${picked(c)?'已选':'选为候选'}</button></div>`;
    if(look)article.querySelector('[data-use]').onclick=()=>applyAppearance(look);
    article.querySelector('[data-edit]').onclick=()=>openEditor(c);article.querySelector('[data-pick]').onclick=()=>toggle(c);$('gallery').append(article);
  }
  drawChosen();
}
function drawChosen(){
  $('count').textContent=chosen.length;$('export').disabled=!chosen.length;$('chosen').replaceChildren();
  if(!chosen.length){const p=document.createElement('p');p.className='empty';p.textContent='选定喜欢的冠形和参数。';$('chosen').append(p);return;}
  chosen.forEach((c,i)=>{const card=document.createElement('article');card.className='chosen-card';const p=PRESETS.find(p=>p.id===c.preset);
    card.innerHTML=`<h3>${p.name} · ${appearanceName(c.appearance)}</h3>${render(tree(c),{id:`chosen-${i}`,view,hour:96})}<p class="candidate-meta"></p><div class="actions"><button data-edit>查看参数</button><button data-remove>移除</button></div>`;
    card.querySelector('p').textContent=`${c.seed}${c.crownCount?` · ${c.crownCount} 冠团`:''} · 体积 ${c.padScale} / 叶 ${c.leafScale} / 覆盖 ${c.coverage} / 枝梢 ${c.tipScale}`;
    card.querySelector('[data-edit]').onclick=()=>openEditor(c);card.querySelector('[data-remove]').onclick=()=>toggle(c);$('chosen').append(card);
  });
}
function openEditor(c){editing={...c};$('editor-title').textContent=PRESETS.find(p=>p.id===c.preset).name;syncSliders();updateEditor();$('editor').showModal();}
function syncSliders(){for(const [name]of fields){const input=$(`edit-${name}`);input.closest('.parameter').hidden=name==='crownCount'&&editing.preset!=='literati';input.value=editing[name]??3;}}
function updateEditor(){editing=normalize(editing);$('preview').innerHTML=drawTree(editing,'editor');$('edit-look').value=lookFor(editing.appearance)?.id??'custom';for(const [name]of fields)$(`out-${name}`).textContent=editing[name];$('pick-edit').textContent=picked(editing)?'移出候选':'加入候选';$('edit-summary').textContent=`${appearanceName(editing.appearance)} · ${tree(editing).nodes.filter(n=>n.role==='twig').length} 段细枝 · ${tree(editing).clusters.length} 个叶簇 · ${editing.seed}`;}
for(const [name,label,min,max,step]of fields){const row=document.createElement('div');row.className='parameter';row.innerHTML=`<label for="edit-${name}">${label}<output id="out-${name}"></output></label><input id="edit-${name}" type="range" min="${min}" max="${max}" step="${step}">`;$('sliders').append(row);$(`edit-${name}`).oninput=()=>{editing[name]=Number($(`edit-${name}`).value);edits.set(editing.preset,{...editing});updateEditor();};}
for(const b of $('versions').children)b.onclick=()=>{mode=b.dataset.mode;if(mode==='looks'&&$('preset').value==='all')$('preset').value='juniper';draw();};
for(const b of $('views').children)b.onclick=()=>{view=b.dataset.view;for(const x of $('views').children)x.setAttribute('aria-pressed',String(x===b));draw();};
for(const p of PRESETS){const option=document.createElement('option');option.value=p.id;option.textContent=p.name;$('preset').append(option);}
$('preset').value='juniper';
$('preset').onchange=()=>{if(mode==='looks'&&$('preset').value==='all')mode='new';draw();};
function syncAppearance(){
  const chosenLook=lookFor(appearance);
  for(const button of $('looks').children)button.setAttribute('aria-pressed',String(button.dataset.look===chosenLook?.id));
  for(const name of ['shape','foliage','bark','background'])$(`look-${name}`).value=appearance[name];
  $('appearance-name').textContent=chosenLook?.name??'自选搭配';
}
function applyAppearance(value){appearance=normalizeAppearance(value);mode='new';syncAppearance();draw();}
for(const look of LOOKS){const c=colorsFor(look),button=document.createElement('button');button.dataset.look=look.id;
  button.innerHTML=`<span class="swatches" aria-hidden="true"><i style="background:${c.background};border:1px solid #b6b9ab"></i><i style="background:${c.foliage[2]}"></i><i style="background:${c.bark}"></i></span><span>${look.name}</span>`;
  button.onclick=()=>applyAppearance(look);$('looks').append(button);
  const option=document.createElement('option');option.value=look.id;option.textContent=look.name;$('edit-look').append(option);
}
$('edit-look').onchange=()=>{editing.appearance=normalizeAppearance(LOOKS.find(l=>l.id===$('edit-look').value));updateEditor();};
for(const [name,options]of [['shape',SHAPES],['foliage',FOLIAGE],['bark',BARK],['background',BACKGROUNDS]]){
  const select=$(`look-${name}`);for(const item of options){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;select.append(option);}
  select.onchange=()=>applyAppearance({...appearance,[name]:select.value});
}
syncAppearance();
$('seed').onchange=()=>{seed=$('seed').value.trim()||'BONSAI-01';$('seed').value=seed;draw();};
$('shuffle').onclick=()=>{seed=`C-${crypto.getRandomValues(new Uint32Array(1))[0].toString(16).toUpperCase()}`;$('seed').value=seed;draw();};
$('time').oninput=()=>{hour=Number($('time').value);$('hour').textContent=`${hour}h`;draw();};
$('close').onclick=()=>$('editor').close();$('editor').onclose=()=>{editing=null;draw();};
$('restore').onclick=()=>{editing=normalize({preset:editing.preset,seed:editing.seed,appearance:editing.appearance});edits.delete(editing.preset);syncSliders();updateEditor();};
$('pick-edit').onclick=()=>toggle(editing);
$('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({version:VERSION,candidates:chosen},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='bonsai-canopy-selection.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
try{const raw=localStorage.getItem(STORE);if(raw){const data=JSON.parse(raw);if(data.version!==VERSION||!Array.isArray(data.candidates)||data.candidates.length>30||data.candidates.some(c=>!c||!PRESETS.some(p=>p.id===c.preset)||typeof c.seed!=='string'))throw new Error('Invalid saved selection');chosen=data.candidates.map(c=>normalize({...c,crownCount:c.crownCount??3}));}}catch{notify('候选记录无法读取。');}
draw();
