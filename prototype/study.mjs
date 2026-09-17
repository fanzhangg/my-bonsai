import {VERSION,PRESETS,STRATEGIES,normalize,generate,render,validateSelection} from './specimens.mjs';
const $=id=>document.getElementById(id),STORE='bonsai-specimen-review-v1';
let strategy='hybrid',seed='BONSAI-01',hour=96,chosen=[],editing=null,edits=new Map(),cache=new Map(),timer;
const fields=[['movement','主干走势',.5,1.5,.05],['taper','收尖',.7,1.6,.05],['fullness','冠叶疏密',.3,1,.05],['branching','分枝层数',2,5,1],['leafSize','叶片尺度',.55,1.5,.05]];
const key=c=>JSON.stringify(normalize(c));
const tree=c=>{const k=key(c);if(!cache.has(k)){if(cache.size>100)cache.clear();cache.set(k,generate(c));}return cache.get(k);};
const configFor=(preset,algorithm)=>normalize({...edits.get(preset),preset,strategy:algorithm,seed});
function notify(message){$('status').textContent=message;$('status').classList.add('show');clearTimeout(timer);timer=setTimeout(()=>$('status').classList.remove('show'),2400);}
function save(){try{localStorage.setItem(STORE,JSON.stringify({version:VERSION,candidates:chosen}));}catch{notify('本机保存失败，请导出候选。');}}
function drawing(c,id){return render(tree(c),{hour,skeleton:$('skeleton').checked,guides:$('guides').checked,id});}
function toggle(c){const k=key(c),i=chosen.findIndex(v=>key(v)===k);if(i>=0)chosen.splice(i,1);else{if(chosen.length>=30){notify('最多保留 30 个候选。');return;}chosen.push(normalize(c));}save();draw();if(editing)updateEditor();}
function draw(){
  const selected=$('preset').value,all=selected==='all';$('strategies').hidden=!all;
  $('strategy-note').textContent=all?STRATEGIES.find(s=>s.id===strategy).note:'同款式、同种子、同一套参数，比较 A / B / C';
  for(const b of $('strategies').children)b.setAttribute('aria-pressed',String(b.dataset.strategy===strategy));
  const configs=all?PRESETS.map(p=>configFor(p.id,strategy)):STRATEGIES.map(s=>configFor(selected,s.id));
  $('gallery').replaceChildren();
  configs.forEach((c,i)=>{
    const p=PRESETS.find(p=>p.id===c.preset),s=STRATEGIES.find(s=>s.id===c.strategy),picked=chosen.some(v=>key(v)===key(c));
    const article=document.createElement('article');article.className=`card${picked?' picked':''}`;
    article.innerHTML=`<div class="card-head"><h2>${p.name}</h2><span class="code">${String(PRESETS.indexOf(p)+1).padStart(2,'0')}${s.code} · ${s.name}</span></div><p class="latin">${p.latin}</p><div class="tree-frame">${drawing(c,`sample${i}`)}</div><div class="card-foot"><button data-action="compare">${all?'比较 A/B/C':'全部款式'}</button><button data-action="edit">调参数</button><button data-action="pick" aria-pressed="${picked}">${picked?'已选':'选为候选'}</button></div>`;
    article.querySelector('[data-action=compare]').onclick=()=>{$('preset').value=all?c.preset:'all';draw();};
    article.querySelector('[data-action=edit]').onclick=()=>openEditor(c);
    article.querySelector('[data-action=pick]').onclick=()=>toggle(c);
    $('gallery').append(article);
  });
  drawChosen();
}
function drawChosen(){
  $('count').textContent=chosen.length;$('export').disabled=!chosen.length;$('chosen').replaceChildren();
  if(!chosen.length){const p=document.createElement('p');p.className='empty';p.textContent='点“选为候选”保留树形、算法、种子和参数。';$('chosen').append(p);return;}
  chosen.forEach((c,i)=>{
    const p=PRESETS.find(p=>p.id===c.preset),s=STRATEGIES.find(s=>s.id===c.strategy),item=document.createElement('article');item.className='chosen-card';
    item.innerHTML=`<h3>${p.name} · ${s.code}</h3>${render(tree(c),{hour:96,skeleton:$('skeleton').checked,id:`chosen${i}`})}<p></p><div class="actions"><button data-edit>查看参数</button><button data-remove>移除</button></div>`;
    item.querySelector('p').textContent=`${c.seed} · 走势 ${c.movement} / 收尖 ${c.taper} / 疏密 ${c.fullness} / ${c.branching} 层 / 叶 ${c.leafSize}`;
    item.querySelector('[data-edit]').onclick=()=>openEditor(c);item.querySelector('[data-remove]').onclick=()=>toggle(c);$('chosen').append(item);
  });
}
function openEditor(c){editing={...c};$('editor-title').textContent=PRESETS.find(p=>p.id===c.preset).name;$('edit-strategy').value=c.strategy;
  for(const [name]of fields)$(`edit-${name}`).value=c[name];updateEditor();$('editor').showModal();
}
function updateEditor(){
  if(!editing)return;editing=normalize(editing);$('preview').innerHTML=drawing(editing,'editor');
  for(const [name]of fields)$(`out-${name}`).textContent=editing[name];
  $('edit-summary').textContent=`${STRATEGIES.find(s=>s.id===editing.strategy).note} · ${tree(editing).nodes.length} 段枝干`;
  $('pick-edit').textContent=chosen.some(c=>key(c)===key(editing))?'移出候选':'加入候选';
}
for(const p of PRESETS){const o=document.createElement('option');o.value=p.id;o.textContent=p.name;$('preset').append(o);}
for(const s of STRATEGIES){const b=document.createElement('button');b.dataset.strategy=s.id;b.textContent=`${s.code} ${s.name}`;b.onclick=()=>{strategy=s.id;draw();};$('strategies').append(b);const o=document.createElement('option');o.value=s.id;o.textContent=`${s.code} ${s.name}`;$('edit-strategy').append(o);}
for(const [name,label,min,max,step]of fields){const row=document.createElement('div');row.className='parameter';row.innerHTML=`<label for="edit-${name}">${label}<output id="out-${name}"></output></label><input id="edit-${name}" type="range" min="${min}" max="${max}" step="${step}">`;$('sliders').append(row);
  $(`edit-${name}`).oninput=()=>{editing[name]=Number($(`edit-${name}`).value);edits.set(editing.preset,{...editing});updateEditor();};
}
$('edit-strategy').onchange=()=>{editing.strategy=$('edit-strategy').value;updateEditor();};
$('restore').onclick=()=>{editing=normalize({preset:editing.preset,strategy:editing.strategy,seed:editing.seed});edits.delete(editing.preset);for(const [name]of fields)$(`edit-${name}`).value=editing[name];updateEditor();};
$('pick-edit').onclick=()=>toggle(editing);
$('close').onclick=()=>$('editor').close();$('editor').onclose=()=>{editing=null;draw();};
$('preset').onchange=draw;
$('seed').onchange=()=>{seed=$('seed').value.trim()||'BONSAI-01';$('seed').value=seed;draw();};
$('shuffle').onclick=()=>{seed=`B-${crypto.getRandomValues(new Uint32Array(1))[0].toString(16).slice(0,6).toUpperCase()}`;$('seed').value=seed;draw();};
for(const id of ['skeleton','guides'])$(id).onchange=draw;
$('time').oninput=()=>{hour=Number($('time').value);$('hour').textContent=`${hour}h`;draw();};
$('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({version:VERSION,candidates:chosen},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='bonsai-selection.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('import').onclick=()=>$('file').click();$('file').onchange=async()=>{try{const file=$('file').files[0];if(!file)return;if(file.size>100000)throw new Error('文件过大');const data=validateSelection(JSON.parse(await file.text()));for(const c of data.candidates)if(!chosen.some(v=>key(v)===key(c))&&chosen.length<30)chosen.push(c);save();draw();notify('候选已导入');}catch(error){notify(error.message);}finally{$('file').value='';}};
try{const raw=localStorage.getItem(STORE);if(raw)chosen=validateSelection(JSON.parse(raw)).candidates;}catch{notify('候选记录无法读取，请重新导入。');}
draw();
