import {pointOn} from './core/v1/model.mjs';
import {branchFamily,pruningTarget} from './pruning-model.mjs';

export function createPruning({scene,treeElement,tool,message,onCommit=async()=>{},onBusyChange=()=>{},onSettled=()=>{},onError=()=>{}}){
  let tree=null,svg=null;const ns='http://www.w3.org/2000/svg';
  const make=(tag,attrs={})=>{const el=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);return el;};
  const removed=new Set(),reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  let active=false,held=false,busy=false,target=null,pointer=null,keyboard=false,keyboardIndex=-1;
  const elements=ids=>[...svg.querySelectorAll('[data-wind-wood],[data-wind-node]')].filter(el=>ids.has(tree.nodes[Number(el.getAttribute(el.hasAttribute('data-wind-wood')?'data-wind-wood':'data-wind-node'))]?.id));
  function position(x,y){tool.style.left=`${x}px`;tool.style.top=`${y}px`;}
  function home(){return {x:scene.clientWidth-64,y:scene.clientHeight-70};}
  function screen(p){const q=new DOMPoint(p.x,p.y).matrixTransform(svg.getScreenCTM()),r=scene.getBoundingClientRect();return {x:q.x-r.x,y:q.y-r.y};}
  function clear(){svg.querySelectorAll('.pruning-selected').forEach(el=>el.classList.remove('pruning-selected'));target=null;}
  function select(next){
    clear();target=next;
    if(next?.node){elements(branchFamily(tree.nodes,next.node.id)).forEach(el=>el.classList.add('pruning-selected'));message.textContent='这簇枝叶会落下。松手，剪下旁支。';}
    else message.textContent=next?.protected?'主干保留。试着靠近向外伸展的旁支。':'慢慢来，靠近一根向外伸展的旁支。';
  }
  function begin(){if(!active||!tree||!svg||busy||held)return false;held=true;onBusyChange(true);tool.classList.add('is-held');scene.classList.add('is-dragging');message.textContent='慢慢来，靠近一根向外伸展的旁支。';return true;}
  function move(e){
    if(!held||keyboard)return;
    const r=scene.getBoundingClientRect(),offset=e.pointerType==='touch'?54:0,aim={x:e.clientX,y:e.clientY-offset};
    const matrix=svg.getScreenCTM(),p=new DOMPoint(aim.x,aim.y).matrixTransform(matrix.inverse());
    select(pruningTarget(tree.nodes,removed,p,Math.hypot(matrix.a,matrix.b)));
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
    held=false;keyboard=false;pointer=null;busy=true;scene.classList.remove('is-dragging');
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
      message.textContent=tree.nodes.some(n=>n.role==='primary'&&!removed.has(n.id))?'枝叶落下，留出一点空。还可以继续。':'旁支已剪完，主干安静地留在这里。';
    }else{
      clear();tool.classList.remove('is-held');await returnHome();busy=false;message.textContent='拿起剪刀，慢慢靠近一根旁支。';
    }
    onBusyChange(false);onSettled();
  }
  tool.addEventListener('pointerdown',e=>{if(e.button!==0||!begin())return;e.preventDefault();pointer=e.pointerId;tool.setPointerCapture(pointer);});
  tool.addEventListener('pointermove',e=>{if(e.pointerId===pointer)move(e);});
  tool.addEventListener('pointerup',e=>{if(e.pointerId!==pointer)return;move(e);finish(true);});
  tool.addEventListener('pointercancel',()=>finish(false));
  tool.addEventListener('lostpointercapture',()=>{if(held&&!keyboard)finish(false);});
  tool.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&held){e.preventDefault();finish(false);return;}
    if(e.key===' '||e.key==='Enter'){e.preventDefault();if(held&&keyboard)finish(true);else if(begin()){keyboard=true;keyboardIndex=-1;message.textContent='剪刀已拿起。用方向键选择旁支，空格剪下。';}return;}
    if(!held||!keyboard||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
    e.preventDefault();const choices=tree.nodes.filter(n=>n.role==='primary'&&!removed.has(n.id));if(!choices.length)return;
    keyboardIndex=(keyboardIndex+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)+choices.length)%choices.length;
    const node=choices[keyboardIndex],point=pointOn(node,.22);select({node,point});const p=screen(point);position(p.x,p.y+12);message.textContent=`旁支 ${keyboardIndex+1}，共 ${choices.length} 根。空格剪下。`;
  });
  window.addEventListener('blur',()=>finish(false));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)finish(false);});
  new ResizeObserver(()=>{if(held)finish(false);else if(!busy){const h=home();position(h.x,h.y);}}).observe(scene);
  return {get busy(){return held||busy;},refresh(value){tree=value;svg=treeElement.querySelector('svg');removed.clear();},setActive(value){active=value;if(!active)finish(false);else if(!held&&!busy){const h=home();position(h.x,h.y);}}};
}
