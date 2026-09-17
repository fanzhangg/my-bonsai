import {FORMS,CROWNS,LEAVES,PALETTES,selection,generateLanguage,languageFrame} from './bonsai-language.mjs';
import {grow} from './growth.mjs';
import {render} from './growing-render.mjs';
import {individualOptions} from './bonsai-individual.mjs';

const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const freshSeed=()=>crypto.randomUUID();
let state={preset:params.get('preset')??'juniper',crown:params.get('crown'),leaf:params.get('leaf'),palette:params.get('palette'),
  variation:[.25,.55,.85].includes(Number(params.get('variation')))?Number(params.get('variation')):.55,
  density:[.2,.5,.8].includes(Number(params.get('density')))?Number(params.get('density')):.5};
let seed=params.get('seed')?.slice(0,64)||freshSeed(),maturity=1,view='foliage',serial=0;
let mature,frame;
const seedName=()=>seed;
function prepare(){
  mature=generateLanguage({...state,seed:seedName()});frame=languageFrame(mature);
  const query=new URLSearchParams({...state,seed});history.replaceState(null,'',`${location.pathname}?${query}`);
}
function paintTree(){
  const tree=grow({createdAt:0,config:{...state,seed:seedName()},cuts:[]},maturity,{generator:generateLanguage});
  $('tree-art').innerHTML=render(tree,{view,hour:tree.hour,id:`language-${++serial}`,transparent:true,viewBox:frame});
  $('maturity-label').textContent=`${Math.round(maturity*100)}%`;
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
}
function paint(){
  const {form,crown,leaf,palette}=selection(state);state={preset:form.id,crown,leaf,palette,...individualOptions(state)};
  $('variation').value=state.variation;$('density').value=state.density;
  $('form-options').innerHTML=FORMS.map(f=>`<button type="button" data-form="${f.id}" aria-pressed="${f.id===form.id}">${f.name}</button>`).join('');
  $('form-note').textContent=form.note;
  $('crown').innerHTML=form.crowns.map(id=>`<option value="${id}" ${id===crown?'selected':''}>${CROWNS[id].name}</option>`).join('');
  $('leaf').innerHTML=form.leaves.map(id=>`<option value="${id}" ${id===leaf?'selected':''}>${LEAVES[id]}</option>`).join('');
  $('crown-note').textContent=CROWNS[crown].note+(leaf==='maple'||leaf==='fan'?' · 阔叶风格化变体':'');
  $('palette-options').innerHTML=Object.keys(PALETTES).map(id=>`<button type="button" data-palette="${id}" aria-pressed="${id===palette}" title="${PALETTES[id].note}"><i class="color-dot" style="background:${PALETTES[id].layers[1][1]}"></i>${PALETTES[id].name}</button>`).join('');
  $('depth-colors').innerHTML=PALETTES[palette].layers.map((colors,i)=>`<div class="depth-group"><div class="ramp" role="img" aria-label="${['后冠','中冠','前冠'][i]}：暗部、固有色、亮面、高光">${colors.map(c=>`<i style="background:${c}"></i>`).join('')}</div><span>${['后冠','中冠','前冠'][i]}</span></div>`).join('');
  $('specimen-number').textContent=`${String(FORMS.indexOf(form)+1).padStart(2,'0')} / ${form.gesture}`;
  $('specimen-name').textContent=leaf==='maple'?'圆顶枫树':leaf==='fan'?'圆顶银杏':form.name;
  $('specimen-note').textContent=`${CROWNS[crown].name} · ${LEAVES[leaf]} · ${PALETTES[palette].name}`;
  prepare();paintTree();
}
$('form-options').addEventListener('click',e=>{const b=e.target.closest('[data-form]');if(!b)return;state={preset:b.dataset.form,palette:state.palette,...individualOptions(state)};paint();});
$('palette-options').addEventListener('click',e=>{const b=e.target.closest('[data-palette]');if(!b)return;state.palette=b.dataset.palette;paint();});
for(const key of ['crown','leaf'])$(key).addEventListener('change',e=>{state[key]=e.target.value;paint();});
for(const key of ['variation','density'])$(key).addEventListener('change',e=>{state[key]=Number(e.target.value);paint();});
document.querySelector('.views').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(!b)return;view=b.dataset.view;paintTree();});
$('maturity').addEventListener('input',e=>{maturity=Number(e.target.value)/100;paintTree();});
$('new-seed').addEventListener('click',()=>{seed=freshSeed();prepare();paintTree();});
paint();
