import {createRamification,cutPlan,pruneRamification,flushRamification} from './ramification-model.mjs';
import {pointOn,sample} from './core/v1/model.mjs';
import {taperedPath} from './core/v1/style-render.mjs';
import {potMarkup} from './pots.mjs';

const names=['主干','一级侧枝','二级侧枝','三级细枝'];
const colors=['#66594a','#92704d','#607e6c','#5b8792'];
const label=n=>`${names[Math.min(3,n.order)]}${n.order>3?' · 新梢':''} ${n.id}`;
export function createRamificationReview(){
  const root=document.getElementById('ramification-review');
  root.innerHTML=`
    <div class="section-heading"><div><p class="eyebrow">LIVING STRUCTURE / 交互原型 01</p><h2>枝上生枝，才是一棵树。</h2></div><span>选择枝条 → 看清影响 → 再落剪</span></div>
    <div class="ram-workspace">
      <div class="ram-canvas"><div class="ram-top"><span id="ram-specimen">榆树 · 多级分枝</span><div class="segmented" aria-label="观察方式"><button data-ram-view="foliage" aria-pressed="true">枝叶</button><button data-ram-view="xray" aria-pressed="false">透视</button><button data-ram-view="skeleton" aria-pressed="false">骨架</button></div></div>
        <div id="ram-art" class="ram-art"></div><div class="ram-caption"><span>点击枝条圆点选择 · 橙色为本次剪除范围</span><span id="ram-count"></span></div>
      </div>
      <aside class="ram-options"><div class="ram-option-heading"><p class="eyebrow">BRANCH / 枝序</p><h3>从骨架，到一簇新叶。</h3></div>
        <label>树种示意<select id="ram-species"><option value="elm">榆树 · 阔叶</option><option value="juniper">真柏 · 鳞叶</option></select></label>
        <fieldset><legend>选择修剪层级</legend><div class="ram-levels"><button data-ram-level="1" aria-pressed="true">01 一级</button><button data-ram-level="2" aria-pressed="false">02 二级</button><button data-ram-level="3" aria-pressed="false">03 三级 / 细梢</button></div></fieldset>
        <label>当前枝条<select id="ram-branch"></select></label>
        <div class="ram-lineage" id="ram-lineage"></div>
        <fieldset><legend>修剪方式</legend><div class="ram-modes"><button data-ram-mode="remove" aria-pressed="true">整枝疏除</button><button data-ram-mode="shorten" aria-pressed="false">回剪至内侧</button></div></fieldset>
        <div class="ram-impact" id="ram-impact"></div><button class="primary" id="ram-cut">剪下选中枝条</button>
        <div class="ram-secondary"><button id="ram-undo">撤销</button><button id="ram-reset">重置样本</button></div>
        <button id="ram-grow">演示下一轮萌芽 →</button><p class="ram-note">先回剪，再演示保留枝上的新梢。演示轮次不对应真实天数。</p>
      </aside>
    </div>
    <p id="ram-status" class="ram-status" role="status">先试着剪一根三级细枝，再比较一级枝的影响。</p>
    <div class="ram-legend"><span><i style="background:#66594a"></i>主干 · 支撑</span><span><i style="background:#92704d"></i>一级 · 定姿态</span><span><i style="background:#607e6c"></i>二级 · 展枝片</span><span><i style="background:#5b8792"></i>三级 · 托叶簇</span><span><i style="background:#a4b672"></i>新梢 · 延续生长</span></div>
    <div class="principles"><article><span>01 / 连续的骨架</span><h3>枝条逐级收细</h3><p>主干承接一级枝，二级枝从一级枝上分出，三级细枝托起小叶簇。枝长、角度和间距有差异，叶间留出透光的空隙。</p></article><article><span>02 / 每一剪有来处</span><h3>剪掉的是一整段生命</h3><p>整枝疏除会带走所有下级枝叶；回剪只去掉切口以外的部分，保留内侧分枝。未被修剪的枝条保持原位。</p></article><article><span>03 / 树种有自己的节奏</span><h3>新芽从保留枝上长出</h3><p>榆树演示回剪后的分枝；真柏的裸枝不保证再萌芽。新梢带来新的轮廓，不直接恢复被剪掉的整片树冠。</p></article></div>
    <details class="ram-research"><summary>建模依据与本轮验收范围</summary><p>这是设计系统内的独立结构原型。已实现三级分枝、逐枝选择、两种修剪、后代联动、撤销与简化萌芽。真实树木可以继续分出更多枝级；此处把更细新梢归在第三级操作中。</p><p>下一步建议：按芽点与节间记录枝条；以光照、顶端优势、季节和树势共同决定芽是否启动；以保留叶量和枝龄影响增粗及恢复。当前没有模拟这些生理过程，也没有替换认养盆栽的生长模型。</p><p>资料：<a href="https://www.bonsaiempire.com/basics/styling/pruning" target="_blank" rel="noreferrer">Bonsai Empire · 修剪与顶端优势</a> / <a href="https://www.bonsaiempire.com/tree-species/juniper" target="_blank" rel="noreferrer">真柏的修剪限制</a> / <a href="https://www.algorithmicbotany.org/papers/selforg.sig2009.small.pdf" target="_blank" rel="noreferrer">Pałubicki 等 · 芽与光照竞争模型（2009）</a></p></details>`;
  const $=id=>document.getElementById(id);
  let tree=createRamification(),level=1,view='foliage',mode='remove',selected='B1',history=[];
  const candidates=()=>tree.nodes.filter(n=>Math.min(3,n.order)===level);
  function paint(){
    if(!candidates().some(n=>n.id===selected))selected=candidates()[0]?.id??null;
    const node=tree.nodes.find(n=>n.id===selected),plan=cutPlan(tree,selected,mode);
    $('ram-branch').innerHTML=candidates().map(n=>`<option value="${n.id}">${label(n)}</option>`).join('');
    $('ram-branch').value=selected??'';$('ram-branch').disabled=!node;
    const chain=[];for(let n=node;n;n=tree.nodes.find(p=>p.id===n.parent))chain.unshift(n.id==='T'?'主干':n.id);
    $('ram-lineage').textContent=chain.join(' → ')||'本层已没有枝条，可撤销或切换层级。';
    const total=tree.nodes.filter(n=>n.leaves).length;
    $('ram-impact').innerHTML=plan?`<strong>${mode==='remove'?'疏除整枝':'保留内侧 62% 枝段'}</strong><p>移除 ${plan.removed.size} 根完整枝条${mode==='shorten'?' + 选中枝梢':''}<br>带走 ${plan.leaves} / ${total} 簇叶 · ${total?Math.round(plan.leaves/total*100):0}%</p>`:'<p>选择另一层枝条继续观察。</p>';
    $('ram-cut').disabled=!node;$('ram-undo').disabled=!history.length;$('ram-grow').disabled=!tree.nodes.some(n=>n.pending);
    $('ram-specimen').textContent=`${tree.species==='elm'?'榆树':'真柏'} · 多级分枝${tree.flush?' · 萌芽演示 '+tree.flush:''}`;
    $('ram-count').textContent=`${tree.nodes.length-1} 枝 · ${total} 簇叶`;
    root.querySelectorAll('[data-ram-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.ramView===view)));
    root.querySelectorAll('[data-ram-level]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.ramLevel===level)));
    root.querySelectorAll('[data-ram-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.ramMode===mode)));
    const affected=n=>plan&&(plan.removed.has(n.id)||(plan.t&&n.id===selected));
    const woodColor=n=>n.fresh?'#819955':view==='foliage'?'#716252':colors[Math.min(3,n.order)];
    const retained=plan?.t?pruneRamification(tree,selected,mode).nodes.find(n=>n.id===selected):null;
    const wood=tree.nodes.map(n=>`<path d="${taperedPath(n)}" fill="${affected(n)?'#b97953':woodColor(n)}"/>${n.id===selected&&retained?`<path d="${taperedPath(retained)}" fill="${woodColor(n)}"/>`:''}${n.scar?`<circle cx="${n.ex}" cy="${n.ey}" r="${Math.max(2,n.tipWidth/2)}" fill="#dfbb94"/>`:''}`).join('');
    const leaves=view==='skeleton'?'':tree.nodes.filter(n=>n.leaves).map(n=>{
      const tint=affected(n)?'#be855c':n.fresh?'#a4b672':null;
      const shapes=Array.from({length:tree.species==='elm'?11:8},(_,i)=>{
        const r=(p)=>sample(tree.seed,n.id+i,p),x=n.ex+(r('x')-.5)*37,y=n.ey+(r('y')-.45)*26;
        return `<ellipse cx="${x}" cy="${y}" rx="${tree.species==='elm'?5+r('r')*3:10}" ry="${tree.species==='elm'?3.5:3}" transform="rotate(${r('a')*120-60} ${x} ${y})" fill="${tint||['#52735a','#64846a','#81996e'][i%3]}"/>`;
      }).join('');return `<g opacity="${view==='xray'?.16:.92}">${shapes}</g>`;
    }).join('');
    const markers=candidates().map(n=>{const p=pointOn(n,.26);return `<g data-ram-node="${n.id}" role="button" tabindex="0" aria-label="选择${label(n)}" aria-pressed="${selected===n.id}" class="ram-marker"><circle cx="${p.x}" cy="${p.y}" r="15" fill="transparent"/><circle cx="${p.x}" cy="${p.y}" r="${selected===n.id?6:4}" fill="${selected===n.id?'#b97953':'#faf9f3'}" stroke="${colors[Math.min(3,n.order)]}" stroke-width="2"/></g>`;}).join('');
    const cut=plan?`<g pointer-events="none" stroke="#b36740" stroke-width="2"><path d="M${plan.point.x-5} ${plan.point.y-5}l10 10m-10 0l10 -10"/></g>`:'';
    $('ram-art').innerHTML=`<svg viewBox="75 30 570 530" role="group" aria-label="可修剪的多级盆栽"><ellipse cx="360" cy="531" rx="114" ry="9" fill="#dfe2d5"/>${potMarkup({shape:'oval',tone:'sand',pattern:'plain'},360,485,'ram-pot',{dynamic:false})}${wood}${leaves}${markers}${cut}</svg>`;
  }
  function update(message){paint();if(message)$('ram-status').textContent=message;}
  function remember(){history.push(structuredClone(tree));}
  root.addEventListener('click',e=>{
    const b=e.target.closest('button,[data-ram-node]');if(!b)return;
    if(b.dataset.ramView){view=b.dataset.ramView;update();}
    if(b.dataset.ramLevel){level=+b.dataset.ramLevel;update();}
    if(b.dataset.ramMode){mode=b.dataset.ramMode;update();}
    if(b.dataset.ramNode){selected=b.dataset.ramNode;update();root.querySelector(`[data-ram-node="${selected}"]`)?.focus();}
  });
  $('ram-art').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.closest('[data-ram-node]')){e.preventDefault();e.target.closest('[data-ram-node]').dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
  $('ram-branch').addEventListener('change',e=>{selected=e.target.value;update();});
  $('ram-species').addEventListener('change',e=>{tree=createRamification(e.target.value);history=[];update('已切换树种并重置样本。');});
  $('ram-cut').addEventListener('click',()=>{if(!selected)return;remember();const id=selected;tree=pruneRamification(tree,id,mode);update(`已${mode==='remove'?'疏除':'回剪'} ${id}，其余枝条保持原位。可撤销。`);});
  $('ram-undo').addEventListener('click',()=>{if(history.length){tree=history.pop();update('已撤销上一步，恢复枝条与叶簇。');}});
  $('ram-reset').addEventListener('click',()=>{tree=createRamification(tree.species);history=[];update('已恢复最初样本。');});
  $('ram-grow').addEventListener('click',()=>{remember();const before=tree.nodes.length;tree=flushRamification(tree);update(tree.nodes.length>before?'保留枝上长出浅绿色新梢；被疏除的整枝不会原样恢复。':'这次没有新梢：真柏的裸枝不保证重新萌芽。');});
  paint();
}
