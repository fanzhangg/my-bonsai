import {snapshot,draw,applicationFrame} from './growth.mjs';
import {leafLayers,referenceRim,snippedRim,smoothLeafPath,inside,SNIP_MODEL,SNIP_TARGET_LIMIT,leafSites,snipNearEdge,proposeSnip,eraseEvent} from './leaf-trim-model.mjs';
import {createSnipPacer,SNIP_INTERVAL_MS,SNIP_REACH_PX} from './leaf-trim-stroke.mjs';

export const leafScissors=`<svg viewBox="-40 -76 80 120" aria-hidden="true" data-tool-shape="long-handle-trimming">
 <g class="leaf-blade-a">
  <path d="M0 -68 Q-7 -53 -5 -31 L1 -24 L5 -29 Q2 -47 0 -68Z" fill="#8d9f96"/>
  <path d="M0 -66 L1 -30" fill="none" stroke="#dce5df" stroke-width="1.2"/>
  <path d="M1 -27 C4 -15 8 3 13 13" fill="none" stroke="#394f43" stroke-width="4" stroke-linecap="round"/>
  <ellipse cx="15" cy="26" rx="8.5" ry="13" transform="rotate(-12 15 26)" fill="none" stroke="#394f43" stroke-width="4"/>
 </g>
 <g class="leaf-blade-b">
  <path d="M0 -68 Q7 -53 5 -31 L-1 -24 L-5 -29 Q-2 -47 0 -68Z" fill="#bdcac0"/>
  <path d="M0 -66 L-1 -30" fill="none" stroke="#eef2e9" stroke-width="1.2"/>
  <path d="M-1 -27 C-4 -15 -8 3 -13 13" fill="none" stroke="#486252" stroke-width="4" stroke-linecap="round"/>
  <ellipse cx="-15" cy="26" rx="8.5" ry="13" transform="rotate(12 -15 26)" fill="none" stroke="#486252" stroke-width="4"/>
 </g>
 <circle cy="-28" r="3.6" fill="#8b9482" stroke="#e0dec5" stroke-width=".8"/><path d="M-1.5 -29.5 L1.5 -26.5" stroke="#4f6258" stroke-width="1"/>
 <g class="leaf-cut-point" transform="translate(0 -68)"><circle r="5" fill="none" stroke="#70553d" stroke-width="1"/><path d="M-8 0H-5M5 0H8M0 -8V-5M0 5V8" stroke="#70553d" stroke-width="1.4"/><circle r=".7" fill="#ac593e"/></g>
</svg>`;
const ns='http://www.w3.org/2000/svg';
const el=(tag,attrs)=>{const n=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};

// Independent tool, with the same pick up / target / release rhythm as pruning.
export function createLeafTrimming({holder,onSave,onBusyChange=()=>{},onClose=()=>{},onError=()=>{}}){
 const editor=document.createElement('div');editor.className='leaf-editor';editor.hidden=true;editor.tabIndex=-1;editor.setAttribute('role','application');editor.setAttribute('aria-label','修叶');
 editor.innerHTML='<div class="leaf-canvas"></div><p class="leaf-sr-only" role="status" aria-live="polite"></p><button class="leaf-tool" type="button" aria-label="拖动修叶剪到一层树冠，按住拖动修叶，松手保存；Esc 放回">'+leafScissors+'</button><div class="leaf-floating" hidden>'+leafScissors+'</div>';
 document.body.append(editor);
 editor.style.setProperty('--leaf-snip-duration',(SNIP_INTERVAL_MS-10)+'ms');
 const canvas=editor.querySelector('.leaf-canvas'),hint=editor.querySelector('[role=status]'),tool=editor.querySelector('.leaf-tool'),floating=editor.querySelector('.leaf-floating');
 let active=false,saving=false,base,at,tree,groups=[],rims=new Map(),selected=null,svg,gesture=null,targets=[],stroke=null,catalog=new Map(),snipTimer,home,returnFocus,holderVisibility,keyboardPoint=null;
 const say=text=>{hint.textContent=text;};
 function layout(){
  const r=holder.getBoundingClientRect();Object.assign(canvas.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
 }
 function render(){
  canvas.innerHTML=draw(tree,{transparent:true,viewBox:applicationFrame(tree),id:'leaf-editor-tree',focusClusterKeys:selected?.clusters.map(c=>c.key)});
  svg=canvas.querySelector('svg');svg.removeAttribute('role');svg.setAttribute('aria-label','选择整层树冠');
  const overlay=el('g',{'data-leaf-selection':'true'});
  for(const g of [...groups].sort((a,b)=>a.z-b.z)){
   if(selected)continue;
   const target=el('g',{'data-layer-id':g.id,role:'button',tabindex:'0','aria-label':'选择第 '+(groups.indexOf(g)+1)+' 层树冠',class:'leaf-layer'});
   for(const c of g.clusters)target.append(el('path',{d:smoothLeafPath(rims.get(c.key)),fill:'transparent'}));
   const scale=svgScale(),dot=el('circle',{cx:g.x,cy:g.y,r:5/scale,class:'leaf-layer-dot','vector-effect':'non-scaling-stroke'});
   target.append(dot);overlay.append(target);
  }
  svg.append(overlay);
 }
 function svgScale(){const m=svg.getScreenCTM();return Math.hypot(m.a,m.b);}
 function world(p){return new DOMPoint(p.x,p.y).matrixTransform(svg.getScreenCTM().inverse());}
 function screen(p){return new DOMPoint(p.x,p.y).matrixTransform(svg.getScreenCTM());}
 function place(p){floating.hidden=false;floating.style.left=p.x+'px';floating.style.top=p.y+'px';}
 function choose(g){
  selected=g;targets=[];stroke=null;keyboardPoint=null;render();say('已选第 '+(groups.indexOf(g)+1)+' 层树冠。按住拖动修叶，松手保存；Esc 放回。');
 }
 function hit(p){return [...groups].sort((a,b)=>b.z-a.z).find(g=>g.clusters.some(c=>inside(p,rims.get(c.key))));}
 function falling(cuts){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  for(const cut of cuts.slice(0,6)){
   const node=svg.querySelector('[data-leaf-cluster="'+cut.clusterKey+'"] [data-leaf-index="'+cut.index+'"]');if(!node)continue;
   const leaf=cut.leaf,p=screen(leaf),r=leaf.size*2,size=r*2*svgScale(),bit=document.createElement('div');
   bit.className='leaf-falling';bit.style.cssText='left:'+(p.x-size/2)+'px;top:'+(p.y-size/2)+'px;width:'+size+'px;height:'+size+'px';
   bit.innerHTML='<svg viewBox="'+[leaf.x-r,leaf.y-r,r*2,r*2].join(' ')+'">'+node.outerHTML+'</svg>';editor.append(bit);
   const sway=cut.index%2?1:-1;
   const animation=bit.animate([{transform:'translate(0,0) rotate(0deg)',opacity:1},{transform:`translate(${sway*(8+cut.index%7)}px,42px) rotate(${sway*55}deg)`,opacity:0}],{duration:440,easing:'ease-in'});
   animation.finished.catch(()=>{}).finally(()=>bit.remove());
  }
 }
 function sampleSnip(p){
  const cuts=snipNearEdge(selected,catalog,world(p),SNIP_REACH_PX/svgScale());if(!cuts.length)return false;
  falling(cuts);targets.push(...cuts.map(({clusterKey,index})=>({clusterKey,index})));
  for(const c of selected.clusters)rims.set(c.key,snippedRim(tree,c,catalog.get(c.key)));
  return true;
 }
 function append(pScreen){
  if(!selected)return;
  stroke??=createSnipPacer(sampleSnip);
  if(!stroke.move(pScreen))return;
  render();floating.classList.add('is-snipping');clearTimeout(snipTimer);
  snipTimer=setTimeout(()=>floating.classList.remove('is-snipping'),SNIP_INTERVAL_MS-10);
 }
 function begin(e,fromTool=false){
  if(!active||saving||gesture||e.button!==0||e.isPrimary===false)return;e.preventDefault();
  const offset=e.pointerType==='touch'?54:0,p={x:e.clientX,y:e.clientY-offset};
  gesture={id:e.pointerId,x:e.clientX,y:e.clientY,offset,moved:false,fromTool,started:false,target:e.target.closest?.('[data-layer-id]')?.getAttribute('data-layer-id')};
  editor.setPointerCapture(e.pointerId);tool.hidden=true;place(p);
  stroke?.stop();stroke=null;
  // Selecting a layer does not cut it. Pressing on a selected leaf cuts it now.
  if(selected&&!fromTool){append(p);gesture.started=true;}
 }
 function move(e){
  if(!active||saving)return;
  if(!gesture){if(e.pointerType==='mouse')place({x:e.clientX,y:e.clientY});return;}
  if(e.pointerId!==gesture.id)return;
  if(Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>4)gesture.moved=true;
  if(!gesture.moved&&!selected)return;
  const p={x:e.clientX,y:e.clientY-gesture.offset};place(p);
  if(!selected){const g=hit(world(p));if(!g)return;choose(g);}
  if(!gesture.started)gesture.started=true;
  append(p);
  if(targets.length>=SNIP_TARGET_LIMIT-32)void finish();
 }
 function releaseCapture(){stroke?.stop();const id=gesture?.id;gesture=null;if(id!==undefined&&editor.hasPointerCapture(id))editor.releasePointerCapture(id);}
 function close(){
  releaseCapture();active=false;editor.hidden=true;floating.hidden=true;floating.classList.remove('is-snipping');targets=[];stroke=null;clearTimeout(snipTimer);selected=null;keyboardPoint=null;
  holder.style.visibility=holderVisibility;document.body.classList.remove('leaf-editing');onBusyChange(false);onClose();returnFocus?.focus();
 }
 async function finish(){
  if(!active||saving)return;
  releaseCapture();
  if(!targets.length){close();return;}
  saving=true;tool.hidden=true;floating.classList.remove('is-snipping');say('正在保存修叶');
  const id=crypto.randomUUID(),operations=[{model:SNIP_MODEL,crownId:selected.id,targets}];
  const working={...base,leafTrims:[...(base.leafTrims??[]),{...eraseEvent(proposeSnip(tree,operations[0]),at,id+':0',(base.leafTrims?.length??0)+1),batchId:id}]};
  try{
   await onSave({id,revision:base.revision??0,operations},working,at);
   if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&!floating.hidden){
    const animation=floating.animate([{left:floating.style.left,top:floating.style.top},{left:home.x+'px',top:home.y+'px'}],{duration:240,easing:'ease-out',fill:'forwards'});
    try{await animation.finished;}catch{}animation.cancel();
   }
  }catch(error){onError(error);}
  finally{saving=false;close();}
 }
 editor.addEventListener('pointerdown',e=>begin(e,e.target.closest('.leaf-tool')!==null));
 editor.addEventListener('pointermove',move);
 editor.addEventListener('pointerup',e=>{
  if(!gesture||e.pointerId!==gesture.id)return;
  const g=gesture;releaseCapture();
  if(targets.length){void finish();return;}
  if(!g.moved&&g.target){choose(groups.find(layer=>layer.id===g.target));return;}
  if(!g.moved&&g.fromTool){say('选择一层树冠，按住拖动修叶');return;}
  if(selected&&!g.fromTool&&hit(world({x:g.x,y:g.y-g.offset}))?.id===selected.id){say('请将准星靠近树冠外缘。Esc 放回。');return;}
  close();
 });
 editor.addEventListener('pointercancel',e=>{if(active&&!saving&&gesture?.id===e.pointerId)close();});
 editor.addEventListener('lostpointercapture',e=>{if(gesture?.id===e.pointerId&&!saving)close();});
 editor.addEventListener('contextmenu',e=>e.preventDefault());
 editor.addEventListener('keydown',e=>{
  if(saving)return;
  if(e.key==='Escape'){e.preventDefault();close();return;}
  const target=e.target.closest('[data-layer-id]');
  if(target&&[' ','Enter'].includes(e.key)){e.preventDefault();choose(groups.find(g=>g.id===target.getAttribute('data-layer-id')));editor.focus();return;}
  if(e.key.startsWith('Arrow')){
   e.preventDefault();
   if(!selected){const index=groups.findIndex(g=>g.id===keyboardPoint?.id),g=groups[(index+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)+groups.length)%groups.length];if(g){keyboardPoint=g;canvas.querySelector('[data-layer-id="'+g.id+'"]')?.focus();}return;}
   keyboardPoint??={x:selected.x,y:selected.y};
   const step=(e.shiftKey?.5:2)/svgScale();keyboardPoint={x:keyboardPoint.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),y:keyboardPoint.y+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0)};
   const p=screen(keyboardPoint);place(p);
  }
  if([' ','Enter'].includes(e.key)&&selected&&!e.repeat){e.preventDefault();const p=screen(keyboardPoint??{x:selected.x,y:selected.y});place(p);append(p);if(targets.length)void finish();else say('请将准星靠近树冠外缘。Shift 加方向键微调。');}
 });
 const cancel=()=>{if(active&&!saving)close();};
 window.addEventListener('blur',cancel);window.addEventListener('resize',cancel);
 window.addEventListener('scroll',cancel,{passive:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
 return {
  get busy(){return active;},
  open(record,time,event){
   if(active||(event?.type==='pointerdown'&&event.isPrimary===false))return;
   base=structuredClone(record);at=time;tree=snapshot(base,at);groups=leafLayers(tree);if(!groups.length)return;
   rims=new Map(groups.flatMap(g=>g.clusters).map(c=>[c.key,c.leafShape||c.leafSnips?snippedRim(tree,c):referenceRim(tree,c)]));catalog=new Map(groups.flatMap(g=>g.clusters).map(c=>[c.key,leafSites(tree,c)]));selected=null;targets=[];stroke=null;saving=false;active=true;returnFocus=document.activeElement;holderVisibility=holder.style.visibility;
   const entry=event?.currentTarget??returnFocus,r=entry?.getBoundingClientRect?.();home=r?{x:r.left+r.width/2,y:r.top+8}:{x:innerWidth-64,y:innerHeight-104};
   editor.hidden=false;tool.hidden=false;tool.style.left=home.x+'px';tool.style.top=(home.y+40)+'px';floating.hidden=true;keyboardPoint=null;
   layout();render();holder.style.visibility='hidden';document.body.classList.add('leaf-editing');editor.focus({preventScroll:true});
   if(event?.type==='pointerdown')begin(event,true);
   onBusyChange(true);say('选择一层树冠，按住拖动修叶，松手保存；Esc 放回。');
  }
 };
}
