import {FORMS,CROWNS,LEAVES,PALETTES,selection} from './core/v3/bonsai-language.mjs';
import {snapshot,HOUR,applicationFrame} from './growth.mjs';
import {CURRENT_VERSION} from './tree-versions.mjs';
import {normalizeDesign} from './core/v3/config.mjs';
import {createPruning} from './pruning.mjs';
import {pruningTool} from './pruning-tool.mjs';

import {canPrune} from './pruning-model.mjs';
import {render} from './core/v3/growing-render.mjs';
import {individualOptions} from './core/v3/bonsai-individual.mjs';

const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const freshSeed=()=>crypto.randomUUID();
let state={preset:params.get('preset')??'juniper',crown:params.get('crown'),leaf:params.get('leaf'),palette:params.get('palette'),
  variation:[.25,.55,.85].includes(Number(params.get('variation')))?Number(params.get('variation')):.55,
  density:[.2,.5,.8].includes(Number(params.get('density')))?Number(params.get('density')):.5};
let seed=params.get('seed')?.slice(0,64)||freshSeed(),hours=168,view='foliage',serial=0,cuts=[],undo=null;
const scene=$('tree-art');scene.classList.add('design-pruning-scene');
const holder=document.createElement('div');holder.className='design-tree-holder';scene.append(holder);
const tool=pruningTool('design-scissors'),message=document.createElement('p');message.className='pruning-sr-only';message.setAttribute('role','status');scene.append(tool,message);
function controls(busy){document.querySelectorAll('aside button,aside input,aside select,.views button,#new-seed').forEach(el=>el.disabled=busy);}

const review=createPruning({scene,treeElement:holder,tool,message,
 onCommit:async branchId=>{remember();cuts.push({id:crypto.randomUUID(),seq:cuts.length+1,branchId,at:hours*HOUR,model:'state-1'});},
 onBusyChange:controls,onSettled:paintTree});
function remember(){undo={state:structuredClone(state),seed,hours,cuts:structuredClone(cuts)};}
function resetGeometry(){cuts=[];}
const seedName=()=>seed;
function prepare(){
  const query=new URLSearchParams({...state,seed});history.replaceState(null,'',`${location.pathname}?${query}`);
}
function currentRecord(){return {version:CURRENT_VERSION,createdAt:0,config:normalizeDesign({...state,seed:seedName()}),cuts};}
function paintTree(tree=snapshot(currentRecord(),hours*HOUR)){
  holder.innerHTML=render(tree,{view,hour:tree.hour,id:`language-${++serial}`,transparent:true,viewBox:applicationFrame(tree)});
  review.refresh(tree);
  const future=cuts.filter(c=>c.at>hours*HOUR).length;review.setActive(!future);

  tool.hidden=Boolean(future);
  $('maturity-label').textContent=`${hours.toFixed(1)} 小时`;$('maturity').max=Math.max(336,hours,...cuts.map(c=>c.at/HOUR));$('maturity').value=hours;
  $('design-growth-status').textContent=future?`后面还有 ${future} 次修剪。回看保留历史，从此刻继续会移除后续修剪。`:`可剪一级 ${tree.nodes.filter(n=>n.pruningLevel===1&&canPrune(n)).length} 根 · 二级 ${tree.nodes.filter(n=>n.pruningLevel===2&&canPrune(n)).length} 根${tree.recovery.length?` · ${tree.recovery.length} 处准备萌芽`:''}`;
  $('design-fork').hidden=!future;$('design-undo').disabled=!undo;$('design-clear').disabled=Boolean(future);
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
$('form-options').addEventListener('click',e=>{const b=e.target.closest('[data-form]');if(!b)return;remember();resetGeometry();state={preset:b.dataset.form,palette:state.palette,...individualOptions(state)};paint();});
$('palette-options').addEventListener('click',e=>{const b=e.target.closest('[data-palette]');if(!b)return;state.palette=b.dataset.palette;paint();});
for(const key of ['crown','leaf'])$(key).addEventListener('change',e=>{state[key]=e.target.value;paint();});
for(const key of ['variation','density'])$(key).addEventListener('change',e=>{remember();resetGeometry();state[key]=Number(e.target.value);paint();});
document.querySelector('.views').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(!b)return;view=b.dataset.view;paintTree();});
$('maturity').addEventListener('input',e=>{hours=Number(e.target.value);paintTree();});
$('new-seed').addEventListener('click',()=>{remember();resetGeometry();seed=freshSeed();prepare();paintTree();});
document.querySelectorAll('[data-grow-hours]').forEach(b=>b.addEventListener('click',()=>{remember();hours+=Number(b.dataset.growHours);paintTree();}));
$('design-fork').onclick=()=>{remember();cuts=cuts.filter(c=>c.at<=hours*HOUR);paintTree();};
$('design-undo').onclick=()=>{if(!undo)return;({state,seed,hours,cuts}=undo);undo=null;paint();};
$('design-clear').onclick=()=>{if(cuts.some(c=>c.at>hours*HOUR))return;remember();const tree=snapshot({version:CURRENT_VERSION,createdAt:0,config:normalizeDesign({...state,seed}),cuts},hours*HOUR);for(const n of tree.nodes.filter(n=>n.pruningLevel===1&&canPrune(n)))cuts.push({id:crypto.randomUUID(),seq:cuts.length+1,at:hours*HOUR,branchId:n.id});paintTree();};
paint();
