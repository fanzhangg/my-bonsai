import {generateTrunkDesign} from './trunk-design.mjs';
import {grow,HOUR,profile} from './growth.mjs';
import {render} from './growing-render.mjs';
import {pointOn} from './core/v1/model.mjs';
import {POT_PRESETS} from './pots.mjs';
import {generateBranchDesign,BRANCH_STUDY_PRESETS} from './branch-design.mjs';
import {generateCrownBaseline} from './crown-baseline.mjs';

const INFO={juniper:['真柏','横展承重枝 · 错位短分叉','01'],broom:['榉树','扇形粗枝 · 保留末端细分枝','02'],literati:['文人松','清瘦长干 · 疏朗抬梢','01']};
const START=200*HOUR;
export function createBranchReview(host){
  let sample=1,view='foliage',layout='candidate',serial=0,pruning=false,crown=true,refined=false,depth=true,colorStudy=false,trunkStudy=true,light='left',age=true,volume=true,shadow=true,paintStyle=null;
  let maturity=.25;
  const states=new Map();
  const stateFor=preset=>{
    if(!states.has(preset))states.set(preset,{at:START,cuts:[],slots:null});
    return states.get(preset);
  };
  host.innerHTML=`<div class="section-heading"><div><p class="eyebrow">BRANCH / FORM & PRUNING</p><h2>枝有主次，剪后仍有姿态</h2></div><span>枝干与树冠 · 仅本页预览</span></div>
    <p class="branch-intro">同一种子、同一镜头、150% 盆器。开启剪枝模式后，点击编号剪去对应侧枝，两版同步；剩余枝条保持原位，观察重心与留白。</p>
    <div class="tree-review-controls"><label>观察方式<select id="branch-view"><option value="foliage">完整枝叶</option><option value="skeleton">只看枝干</option><option value="silhouette">单色剪影</option></select></label>
    <label>对照内容<select id="branch-study"><option value="trunk">真柏 · 主干剪影</option><option value="blocks">真柏 · A 叶片色块</option><option value="soft">真柏 · B 柔和转面</option><option value="color">真柏 · 多维色彩</option><option value="crown">真柏 · 旧冠适配新枝干</option><option value="refined">真柏 · 适配后局部优化</option><option value="branches">三种枝干 · 原始对照</option></select></label>
    <label>手机对照<select id="branch-layout"><option value="candidate">候选版</option><option value="current">当前版</option><option value="both">上下对照</option></select></label>
    <label>生长进度 <output id="branch-maturity-label">25%</output><input id="branch-maturity" type="range" min="0" max="100" step="1" value="25" aria-label="生长进度"></label>
    <label><input id="branch-depth" type="checkbox" checked> 预设树冠层次（后深 · 前浅）</label>
    <label>候选光照<select id="crown-light"><option value="left">左上柔光</option><option value="right">右上柔光</option><option value="diffuse">中性漫射光</option></select></label>
    <label><input id="crown-age" type="checkbox" checked> 新老冠色差</label>
    <label><input id="crown-volume" type="checkbox" checked> 冠内体积</label>
    <label><input id="crown-shadow" type="checkbox" checked> 重叠柔影</label>
    <button type="button" id="branch-sample">换一组样本</button><button type="button" id="branch-mode" aria-pressed="false">剪枝模式</button><span id="branch-sample-label"></span></div>
    <p class="branch-intro">主干由下向上逐段伸长，并随生长增粗；100% 为成熟造型。调整生长进度或切换样本会重置本页剪枝。只能剪主要侧枝，主干保留；枝量不足时才会再生。</p>
    <div id="branch-comparisons"></div><p class="branch-footnote">候选版尚未接入认养与存档。剪枝和再生在此页本地计算，不保存到你的盆栽。</p>`;
  const cards=host.querySelector('#branch-comparisons');
  function recordFor(preset){return {createdAt:0,config:{preset,seed:`DESIGN-SYSTEM-${String(sample).padStart(2,'0')}`,pot:POT_PRESETS.find(p=>p.id===INFO[preset][2])},cuts:stateFor(preset).cuts};}
  function treeFor(preset,candidate){
    const tree=grow(recordFor(preset),maturity,{at:stateFor(preset).at,...(candidate||colorStudy||trunkStudy?{generator:trunkStudy&&candidate?generateTrunkDesign:crown?config=>generateCrownBaseline(config,{refined,depth:colorStudy?true:depth}):generateBranchDesign}:{})});
    if(colorStudy&&candidate)tree.crownColor={light,depth,age,volume,shadow,...(paintStyle?{style:paintStyle}:{})};
    return tree;
  }
  function branchNumber(state,id){return state.slots.findIndex(slot=>id===slot||id.endsWith(`:${slot}`))+1;}
  function art(preset,candidate){
    const tree=treeFor(preset,candidate),state=stateFor(preset);
    state.slots??=generateBranchDesign(recordFor(preset).config).nodes.filter(n=>n.role==='primary').map(n=>n.id);
    const id=`branch-review-${++serial}`;
    const svg=render(tree,{id,view,hour:tree.hour,transparent:true,
      viewBox:{x:tree.root.x-300,y:tree.root.y-420,width:640,height:620}}).replace('role="img"','role="group"');
    const markers=(pruning?tree.nodes.filter(n=>n.role==='primary'&&n.growth>.25):[]).map(n=>{
      const p=pointOn(n,.48),number=branchNumber(state,n.id);
      return `<g class="branch-marker" role="button" tabindex="0" aria-label="${INFO[preset][0]}${candidate?'候选版':'当前版'}：剪第 ${number} 枝" data-branch="${n.id}" data-preset="${preset}" transform="translate(${p.x} ${p.y})"><circle r="26" class="branch-hit"/><circle r="13"/><text text-anchor="middle" dy="5">${number}</text></g>`;
    }).join('');
    return `<div class="branch-art">${svg.replace('</svg>',`<g>${markers}</g></svg>`)}</div><p class="branch-count">${tree.nodes.filter(n=>n.role==='primary').length} 条可剪侧枝 · ${tree.nodes.filter(n=>n.role==='twig').length} 段细枝</p>`;
  }
  function paint(){
    cards.dataset.layout=layout;
    host.querySelector('#branch-maturity').value=Math.round(maturity*100);
    host.querySelector('#branch-maturity-label').textContent=`${Math.round(maturity*100)}%`;
    for(const id of ['crown-light','crown-age','crown-volume','crown-shadow'])host.querySelector('#'+id).disabled=!colorStudy;
    host.querySelector('#crown-shadow').disabled=!colorStudy||Boolean(paintStyle);
    host.querySelector('#crown-shadow').checked=!paintStyle&&shadow;
    host.querySelector('#branch-sample-label').textContent=`固定样本 ${String(sample).padStart(2,'0')} / 05`;
    cards.innerHTML=(crown?['juniper']:BRANCH_STUDY_PRESETS).map(preset=>{
      const [name,note]=INFO[preset],s=stateFor(preset);
      return `<section class="branch-pair" aria-label="${name}枝干对照"><div class="branch-pair-title"><h3>${name}</h3><span>${note}</span></div>
        <div class="branch-panes"><article class="branch-pane branch-current"><h4>${trunkStudy?'当前主干 · 固定层次色组':colorStudy?'上一版 · 固定层次色组':crown?'原始旧版 · 枝干与树冠':'当前版'}</h4>${art(preset,false)}</article><article class="branch-pane branch-candidate"><h4>${trunkStudy?'矮壮主干 · 强转折与收尖':colorStudy?(paintStyle==='blocks'?'A · 叶片色块':paintStyle==='soft'?'B · 柔和转面':'多维色彩 · 原色 / 叶龄 / 光影'):crown?(refined?'适配后局部优化':'旧版树冠 + 新版枝干'):'候选枝干'}</h4>${art(preset,true)}</article></div>
        ${pruning?`<div class="branch-cut-list" aria-label="${name}剪枝选择">${treeFor(preset,false).nodes.filter(n=>n.role==='primary'&&n.growth>.25).map(n=>`<button type="button" data-branch="${n.id}" data-preset="${preset}">剪第 ${branchNumber(s,n.id)} 枝</button>`).join('')}</div>`:''}
        <div class="branch-actions"><button type="button" data-action="undo" data-preset="${preset}" ${s.cuts.length?'':'disabled'}>撤销上次剪枝</button><button type="button" data-action="all" data-preset="${preset}" ${treeFor(preset,false).nodes.some(n=>n.role==='primary')?'':'disabled'}>剪去全部侧枝</button><button type="button" data-action="advance" data-preset="${preset}">生长 24 小时</button><button type="button" data-action="reset" data-preset="${preset}">恢复原树</button></div>
        <p class="branch-status" role="status">${s.cuts.length?`已剪 ${s.cuts.length} 次`:'尚未剪枝'} · 已推进 ${(s.at-START)/HOUR} 小时</p></section>`;
    }).join('');
  }
  function cut(preset,id){
    const s=stateFor(preset);
    if(!treeFor(preset,false).nodes.some(n=>n.id===id&&n.role==='primary'))return;
    s.cuts.push({id:`review-cut-${s.cuts.length+1}`,seq:s.cuts.length+1,at:s.at,branchId:id});
  }
  host.addEventListener('click',e=>{
    const target=e.target.closest('[data-branch],[data-action]');if(!target)return;
    const preset=target.dataset.preset,s=stateFor(preset);
    if(target.dataset.branch)cut(preset,target.dataset.branch);
    else if(target.dataset.action==='undo')s.cuts.pop();
    else if(target.dataset.action==='reset')states.delete(preset);
    else if(target.dataset.action==='advance'){
      s.at+=24*HOUR;
      maturity=Math.min(1,maturity+1/profile(recordFor(preset)).days);
    }
    else if(target.dataset.action==='all')for(const n of treeFor(preset,false).nodes.filter(n=>n.role==='primary'))cut(preset,n.id);
    paint();
  });
  host.addEventListener('keydown',e=>{if(e.target.matches('[data-branch]')&&['Enter',' '].includes(e.key)){e.preventDefault();cut(e.target.dataset.preset,e.target.dataset.branch);paint();}});
  host.querySelector('#branch-view').addEventListener('change',e=>{view=e.target.value;paint();});
  host.querySelector('#branch-maturity').addEventListener('input',e=>{maturity=Number(e.target.value)/100;states.clear();paint();});
  host.querySelector('#branch-depth').addEventListener('change',e=>{depth=e.target.checked;paint();});
  host.querySelector('#branch-study').addEventListener('change',e=>{trunkStudy=e.target.value==='trunk';paintStyle=['blocks','soft'].includes(e.target.value)?e.target.value:null;colorStudy=Boolean(paintStyle)||e.target.value==='color';crown=e.target.value!=='branches';refined=e.target.value==='refined';paint();});
  host.querySelector('#crown-light').addEventListener('change',e=>{light=e.target.value;paint();});
  host.querySelector('#crown-age').addEventListener('change',e=>{age=e.target.checked;paint();});
  host.querySelector('#crown-volume').addEventListener('change',e=>{volume=e.target.checked;paint();});
  host.querySelector('#crown-shadow').addEventListener('change',e=>{shadow=e.target.checked;paint();});
  host.querySelector('#branch-layout').addEventListener('change',e=>{layout=e.target.value;paint();});
  host.querySelector('#branch-sample').addEventListener('click',()=>{sample=sample%5+1;states.clear();paint();});
  host.querySelector('#branch-mode').addEventListener('click',e=>{pruning=!pruning;e.currentTarget.setAttribute('aria-pressed',String(pruning));paint();});
  paint();
}
