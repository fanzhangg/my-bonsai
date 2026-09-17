import {branchFamily,pruningPoints,pruningTarget} from './pruning-model.mjs';

export function createPruning({scene,treeElement,tool,message,onCommit=async()=>{},onBusyChange=()=>{},onSettled=()=>{},onError=()=>{}}){
  let tree=null,svg=null;const ns='http://www.w3.org/2000/svg';
  const make=(tag,attrs={})=>{const el=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);return el;};
  const removed=new Set(),reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  let active=false,held=false,busy=false,target=null,pointer=null,keyboard=false,keyboardIndex=-1;
  let choices=[],gesture=null,clickMode=false;
  const markers=document.createElement('div');markers.className='pruning-points';markers.setAttribute('aria-hidden','true');scene.append(markers);
  message.classList.add('pruning-sr-only');
  tool.setAttribute('aria-pressed','false');
  tool.setAttribute('aria-label','点击或拖动剪刀，靠近提示点选择旁支；也可按空格拿起，用方向键选择，再按空格剪下');
  const instruction=()=>choices.length?(keyboard?'用方向键选择提示点，空格剪下 · Esc 取消':clickMode?'靠近提示点，点击剪下 · Esc 取消':'拖向提示点，松手剪下 · 也可点击拿起'):'暂时没有可剪的旁支 · Esc 取消';
  const elements=ids=>[...svg.querySelectorAll('[data-wind-wood],[data-wind-node]')].filter(el=>ids.has(tree.nodes[Number(el.getAttribute(el.hasAttribute('data-wind-wood')?'data-wind-wood':'data-wind-node'))]?.id));
  function position(x,y){tool.style.left=`${x}px`;tool.style.top=`${y}px`;}
  function home(){return {x:scene.clientWidth-64,y:scene.clientHeight-70};}
  function screen(p){const q=new DOMPoint(p.x,p.y).matrixTransform(svg.getScreenCTM()),r=scene.getBoundingClientRect();return {x:q.x-r.x,y:q.y-r.y};}
  function clear(){svg?.querySelectorAll('.pruning-selected').forEach(el=>el.classList.remove('pruning-selected'));markers.querySelectorAll('.is-selected').forEach(el=>el.classList.remove('is-selected'));tool.classList.remove('is-snapped');scene.classList.remove('has-pruning-target');target=null;}
  function select(next){
    if(target?.node?.id===next?.node?.id&&Boolean(target?.protected)===Boolean(next?.protected))return;
    clear();target=next;
    if(next?.node){
      elements(branchFamily(tree.nodes,next.node.id)).forEach(el=>el.classList.add('pruning-selected'));
      markers.children[choices.findIndex(c=>c.node.id===next.node.id)]?.classList.add('is-selected');
      tool.classList.add('is-snapped');scene.classList.add('has-pruning-target');
      message.textContent=`已选中旁支 · ${keyboard?'空格':clickMode?'点击':'松手'}剪下这簇枝叶`;
    }else message.textContent=next?.protected?'主干保留，请靠近旁支上的提示点':instruction();
  }
  function showPoints(){
    const matrix=svg.getScreenCTM();choices=pruningPoints(tree.nodes,removed,Math.hypot(matrix.a,matrix.b));
    markers.replaceChildren();
    for(const choice of choices){
      const dot=document.createElement('span'),p=screen(choice.point);dot.className='pruning-point';dot.dataset.branchId=choice.node.id;
      dot.style.left=`${p.x}px`;dot.style.top=`${p.y}px`;
      markers.append(dot);
    }
  }
  function begin(){if(!active||!tree||!svg||busy||held)return false;held=true;clickMode=false;onBusyChange(true);showPoints();tool.classList.add('is-held');tool.setAttribute('aria-pressed','true');scene.classList.add('is-dragging');message.textContent=instruction();return true;}
  function move(e){
    if(!held||keyboard)return;
    const r=scene.getBoundingClientRect(),offset=e.pointerType==='touch'&&!clickMode?54:0,aim={x:e.clientX,y:e.clientY-offset};
    const matrix=svg.getScreenCTM(),p=new DOMPoint(aim.x,aim.y).matrixTransform(matrix.inverse());
    select(pruningTarget(tree.nodes,removed,p,Math.hypot(matrix.a,matrix.b),target,choices));
    const at=target?.node?screen(target.point):{x:aim.x-r.x,y:aim.y-r.y};
    position(at.x,at.y+12);
  }
  async function animate(el,frames,options){const animation=el.animate(frames,{...options,duration:reduced()?1:options.duration});try{await animation.finished;}catch{} }
  async function returnHome(){
    const h=home(),from={x:parseFloat(tool.style.left),y:parseFloat(tool.style.top)};
    await animate(tool,[{left:`${from.x}px`,top:`${from.y}px`},{left:`${h.x}px`,top:`${h.y}px`}],{duration:320,easing:'cubic-bezier(.2,.7,.2,1)'});
    position(h.x,h.y);
  }
  async function finish(commit){
    if(!held)return;
    const chosen=commit&&target?.node&&!removed.has(target.node.id)?target.node:null;
    held=false;keyboard=false;pointer=null;gesture=null;clickMode=false;busy=true;scene.classList.remove('is-dragging');tool.setAttribute('aria-pressed','false');markers.replaceChildren();
    if(chosen){
      // Close from the current opening angle, even midway through the idle cycle.
      const blades=[...tool.querySelectorAll('.scissor-half')];
      const poses=blades.map(blade=>getComputedStyle(blade).transform);
      tool.classList.add('is-snipping');message.textContent='咔嚓。';
      await Promise.all([
        ...blades.map((blade,i)=>animate(blade,[{transform:poses[i]},{transform:'rotate(0deg)'}],{duration:180,easing:'cubic-bezier(.3,0,.7,1)'})),
        animate(tool,[{rotate:'0deg'},{rotate:'-3deg',offset:.55},{rotate:'0deg'}],{duration:180})
      ]);
      try{await onCommit(chosen.id);}catch(error){
        clear();tool.classList.remove('is-held','is-snipping');await returnHome();busy=false;onBusyChange(false);onError(error);onSettled();return;
      }
      const family=branchFamily(tree.nodes,chosen.id),fall=make('g'),pieces=elements(family);
      clear();for(const el of pieces)fall.append(el);svg.append(fall);
      for(const id of family)removed.add(id);
      fall.style.transformOrigin=`${chosen.x}px ${chosen.y}px`;
      const direction=chosen.ex<chosen.x?-1:1;
      const falling=animate(fall,[{transform:'translate(0,0) rotate(0deg)',opacity:1},{transform:`translate(${direction*9}px,8px) rotate(${direction*7}deg)`,opacity:1,offset:.2},{transform:`translate(${direction*65}px,210px) rotate(${direction*30}deg)`,opacity:0}],{duration:900,easing:'cubic-bezier(.4,0,.85,.55)'}).then(()=>fall.remove());
      tool.classList.remove('is-held','is-snipping');
      await Promise.all([falling,returnHome()]);
      busy=false;
      message.textContent=tree.nodes.some(n=>n.role==='primary'&&!removed.has(n.id))?'枝叶落下，留出一点空。还可以继续。':'旁支已剪完，休息一阵后会慢慢长出新枝。';
    }else{
      clear();tool.classList.remove('is-held');await returnHome();busy=false;message.textContent='点击或拖动剪刀，靠近树上的提示点。';
    }
    onBusyChange(false);onSettled();
  }
  tool.addEventListener('pointerdown',e=>{
    if(e.button!==0||held||!begin())return;e.preventDefault();
    pointer=e.pointerId;gesture={x:e.clientX,y:e.clientY,dragged:false,pickup:true};tool.setPointerCapture(pointer);
  });
  window.addEventListener('pointerdown',e=>{
    if(!held||keyboard||pointer!==null||e.button!==0)return;
    if(e.target.closest('button,a,input,select,textarea')&&!tool.contains(e.target)){finish(false);return;}
    e.preventDefault();pointer=e.pointerId;gesture={pickup:false};tool.setPointerCapture(pointer);move(e);
  });
  window.addEventListener('pointermove',e=>{
    if(!held||keyboard||(pointer!==null&&e.pointerId!==pointer))return;
    if(gesture?.pickup&&!gesture.dragged){gesture.dragged=Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>6;if(!gesture.dragged)return;}
    move(e);
  });
  window.addEventListener('pointerup',e=>{
    if(e.pointerId!==pointer)return;
    if(gesture?.pickup&&!gesture.dragged)gesture.dragged=Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>6;
    if(gesture?.pickup&&!gesture.dragged){pointer=null;gesture=null;clickMode=true;message.textContent=instruction();return;}
    move(e);finish(true);
  });
  tool.addEventListener('pointercancel',()=>finish(false));
  tool.addEventListener('lostpointercapture',()=>{if(held&&!keyboard&&pointer!==null)finish(false);});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&held){e.preventDefault();finish(false);}});
  tool.addEventListener('keydown',e=>{
    if(e.key===' '||e.key==='Enter'){e.preventDefault();if(e.repeat)return;if(held&&keyboard)finish(true);else if(begin()){keyboard=true;keyboardIndex=-1;message.textContent=instruction();}return;}
    if(!held||!keyboard||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
    e.preventDefault();if(!choices.length)return;
    keyboardIndex=(keyboardIndex+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)+choices.length)%choices.length;
    const choice=choices[keyboardIndex];select(choice);const p=screen(choice.point);position(p.x,p.y+12);message.textContent=`已选中旁支 ${keyboardIndex+1}，共 ${choices.length} 根 · 空格剪下`;
  });
  window.addEventListener('blur',()=>finish(false));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)finish(false);});
  window.addEventListener('scroll',()=>{if(held)finish(false);},true);
  new ResizeObserver(()=>{if(held)finish(false);else if(!busy){const h=home();position(h.x,h.y);}}).observe(scene);
  return {get busy(){return held||busy;},refresh(value){tree=value;svg=treeElement.querySelector('svg');removed.clear();},setActive(value){active=value;if(!active)finish(false);else if(!held&&!busy){const h=home();position(h.x,h.y);}}};
}
