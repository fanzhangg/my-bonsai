import {waterPoint,waterImpact,nearPlanter,waterFacing,createWaterTank,spendWater,refillWaterTank,WATER_CAPACITY} from './watering-motion.mjs';
import {toolHome} from './tool-home.mjs';

export function createWatering({scene,holder,can,water,status,initialProgress=.55,renderTree,onDose=()=>{},onFinish=async()=>{},onBusyChange=()=>{},onError=()=>{},getHome}){
 const ns='http://www.w3.org/2000/svg',vessel=can.querySelector('.watering-vessel');
 let progress=initialProgress,tree,svg,saving=false,usedThisHold=0,active=false,held=false,pouring=false,returning=false,pointer=null,raf=0,started=0,lastEmit=0,lastGrowth=0,lastFrame=0,direction=1,growthTarget=initialProgress,lastSplash=0,pouredThisHold=false,position={x:0,y:0};
 const particles=[],splashes=[];
 const tank=createWaterTank();
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 function refresh(next){tree=next;svg=holder.querySelector('svg');}
 function paint(value){progress=value;refresh(renderTree(value));holder.dataset.progress=(tree?.progress??value).toFixed(4);}
 paint(progress);
 const notify=()=>onBusyChange(held||pouring||returning||saving);
 async function finish(){
  if(!usedThisHold)return;const used=usedThisHold;usedThisHold=0;saving=true;notify();
  try{await onFinish(used);}catch(error){onError(error);}finally{saving=false;notify();}
 }
 function place(p){position=p;can.style.left=p.x+'px';can.style.top=p.y+'px';if(svg&&active){direction=waterFacing(p.x,geometry().soil.x,direction);can.querySelector('svg').style.transform='scaleX('+direction+')';}}
 function home(){return getHome?getHome(scene):toolHome(scene);}
 function screen(x,y){const q=new DOMPoint(x,y).matrixTransform(svg.getScreenCTM()),r=scene.getBoundingClientRect();return {x:q.x-r.x,y:q.y-r.y};}
 function geometry(){return {soil:screen(tree.root.x,tree.root.y-3),top:screen(tree.root.x,svg.querySelector('[data-wind-tree]').getBBox().y),factor:svg.getScreenCTM().a};}
 function element(tag,attrs){const el=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);water.append(el);return el;}
 const streams=Array.from({length:5},()=>element('path',{class:'watering-stream'}));
 function clearWater(){particles.forEach(p=>p.dot?.remove());particles.length=0;streams.forEach(el=>el.setAttribute('d',''));splashes.splice(0).forEach(p=>p.el.remove());}
 function showWater(){can.dataset.remaining=String(tank.remaining);can.style.setProperty('--water-fill',String(tank.remaining/WATER_CAPACITY));}
 showWater();
 function updateFlow(time){
  const g=geometry(),near=nearPlanter(position,g.soil,g.top,g.factor),flowing=pouring&&held&&tank.remaining>0&&near;
  can.classList.toggle('is-pouring',flowing);
  can.classList.toggle('is-draining',flowing&&tank.remaining<900);
  can.style.setProperty('--drain-tilt',((1-Math.min(1,tank.remaining/900))*-8)+'deg');
  water.dataset.phase=flowing?(tank.remaining<600?'drops':tank.remaining<900?'draining':'stream'):'idle';
  water.dataset.flowing=String(flowing);
  if(pouring&&tank.remaining>0)status.textContent=near?'正在浇水，可以继续移动水壶。':'已离开盆栽，停止出水。移回附近可继续。';
  return flowing;
 }
 function emit(time){
  const pressure=Math.min(1,tank.remaining/900),dripping=tank.remaining<600;
  // Read the transformed nozzle: includes tilt transition and the current drag position.
  const matrix=vessel.getScreenCTM(),rect=scene.getBoundingClientRect();
  const tip=new DOMPoint(-51,-14).matrixTransform(matrix),out=new DOMPoint(-52,-13.2).matrixTransform(matrix);
  const dx=out.x-tip.x,dy=out.y-tip.y,length=Math.hypot(dx,dy)||1;
  for(let lane=0;lane<5;lane++){if(dripping?lane!==2:Math.abs(lane-2)>Math.ceil(pressure*2))continue;const spread=lane-2;particles.push({dot:dripping?element('ellipse',{class:'watering-drain-drop',rx:1.5,ry:2.4}):null,x:tip.x-rect.x+spread*1.6,y:tip.y-rect.y+spread*.8,vx:(dx/length*100+spread*13)*(.3+.7*pressure),vy:(dy/length*90+spread*2)*(.45+.55*pressure),born:time,direction,lane});}
 }
 function collisionSurface(){
  const rect=scene.getBoundingClientRect();
  const leaves=[...svg.querySelectorAll('[data-wind-leaf]')].map(el=>{const r=el.getBoundingClientRect();return {x:r.x-rect.x+r.width/2,y:r.y-rect.y+r.height/2,rx:r.width/2,ry:r.height/2};});
  const solids=[...svg.querySelectorAll('[data-wind-wood] path,[data-wind-wood] circle,[data-weather-ground] path,[data-weather-ground] ellipse,[data-weather-ground] rect')].filter(el=>!el.closest('defs')).map(el=>({el,box:el.getBoundingClientRect(),inverse:el.getScreenCTM().inverse()}));
  const pot=svg.querySelector('[data-weather-ground]').getBoundingClientRect(),ground=pot.bottom-rect.top;
  return q=>{
   if(q.y>=ground)return true;
   if(leaves.some(l=>l.rx>0&&l.ry>0&&((q.x-l.x)/l.rx)**2+((q.y-l.y)/l.ry)**2<=1))return true;
   const x=q.x+rect.x,y=q.y+rect.y;
   return solids.some(({el,box,inverse})=>x>=box.left&&x<=box.right&&y>=box.top&&y<=box.bottom&&el.isPointInFill(new DOMPoint(x,y).matrixTransform(inverse)));
  };
 }
 function splash(point,time){
  if(time-lastSplash<70)return;lastSplash=time;
  const el=element('g',{'data-water-impact':'',transform:'translate('+point.x+' '+point.y+')'});
  const ripple=document.createElementNS(ns,'ellipse');ripple.setAttribute('class','watering-ripple');el.append(ripple);
  const drops=Array.from({length:4},(_,i)=>{const dot=document.createElementNS(ns,'circle');dot.setAttribute('class','watering-droplet');dot.setAttribute('r',String(i%2?1.4:1.8));el.append(dot);return {dot,vx:(i-1.5)*24,vy:-42-(i%2)*20};});
  splashes.push({born:time,el,ripple,drops});
 }
 function drawWater(time,dt){
  const hit=collisionSurface(),points=Array.from({length:5},()=>[]);
  for(let i=particles.length-1;i>=0;i--){
   const p=particles[i],age=(time-p.born)/1000,q=waterPoint(p,age);
   const impact=waterImpact(p,p.age??0,age,hit);p.age=age;
   if(impact){
    particles.splice(i,1);p.dot?.remove();if(!p.dot)points[p.lane].push({...impact,direction:p.direction});splash(impact,time);
   }else if(q.y>scene.clientHeight+12||age>2){p.dot?.remove();particles.splice(i,1);}
   else if(p.dot){p.dot.setAttribute('cx',q.x);p.dot.setAttribute('cy',q.y);}
   else points[p.lane].push({...q,direction:p.direction});
  }
  // Five separate fine streams retain their own trajectories, never a thick ribbon.
  points.forEach((lane,i)=>{
   let path='',segment=[];
   const flush=()=>{if(!segment.length)return;path+=' M'+segment[0].x+' '+segment[0].y;for(let j=1;j<segment.length;j++){const p=segment[j-1],q=segment[j];path+=' Q'+p.x+' '+p.y+' '+(p.x+q.x)/2+' '+(p.y+q.y)/2;}const end=segment.at(-1);path+=' L'+end.x+' '+end.y;segment=[];};
   for(const p of lane){const previous=segment.at(-1);if(previous&&(p.direction!==previous.direction||Math.hypot(p.x-previous.x,p.y-previous.y)>35))flush();segment.push(p);}flush();streams[i].setAttribute('d',path);streams[i].style.strokeWidth=String(.55+.55*Math.min(1,tank.remaining/900));
  });
  for(let i=splashes.length-1;i>=0;i--){const p=splashes[i],age=(time-p.born)/600;if(age>=1){p.el.remove();splashes.splice(i,1);}else{p.ripple.setAttribute('rx',2+age*9);p.ripple.setAttribute('ry',1+age*2);p.el.style.opacity=String((1-age)*.7);for(const {dot,vx,vy} of p.drops){const t=age*.6;dot.setAttribute('cx',vx*t);dot.setAttribute('cy',Math.min(0,vy*t+140*t*t));}}}
 }
 async function returnHome(){
  if(returning)return;returning=true;can.classList.remove('is-held');const destination=home();
  if(active&&!reduced())await can.animate([{left:position.x+'px',top:position.y+'px'},{left:destination.x+'px',top:destination.y+'px'}],{duration:380,easing:'cubic-bezier(.2,.7,.2,1)'}).finished.catch(()=>{});
  place(home());refillWaterTank(tank);pouredThisHold=false;showWater();status.textContent='水壶已补满，可以再次拿起。';returning=false;notify();
 }
 function complete(){
  cancelAnimationFrame(raf);raf=0;pouring=false;clearWater();can.classList.remove('is-pouring','is-draining');water.dataset.phase='idle';water.dataset.flowing='false';status.textContent=tank.remaining<=0?'水壶已空，松手放回补水。':'放回水壶，补满后可继续。';
  void finish();notify();
 }
 function frame(time){
  if(!active||document.hidden){complete();return;}
  const elapsed=time-started,dt=Math.min(60,Math.max(0,time-lastFrame));lastFrame=time;
  if(updateFlow(time)&&elapsed>250){
   const dose=spendWater(tank,dt);usedThisHold+=dose.used;onDose(dose.used);
   growthTarget=Math.min(1,growthTarget+dose.growth);
   if(dose.used>0&&(time-lastGrowth>=100||tank.remaining===0)){paint(growthTarget);lastGrowth=time;}
   showWater();
   if(dose.used>0&&tank.remaining>0&&time-lastEmit>(tank.remaining<600?105:12)){emit(time);lastEmit=time;}
  }
  drawWater(time,dt);
  if((tank.remaining<=0||(!held&&!can.classList.contains('is-pouring')))&&particles.length===0&&splashes.length===0){complete();return;}raf=requestAnimationFrame(frame);
 }
 function pour(){
  if(!held||pouring||pouredThisHold||tank.remaining<=0)return;
  pouring=true;pouredThisHold=true;started=performance.now();lastFrame=started;lastEmit=started;lastGrowth=started;
  can.classList.add('is-pouring');status.textContent='正在浇水，可以继续移动水壶。';raf=requestAnimationFrame(frame);
 }
 function check(){const g=geometry();if(nearPlanter(position,g.soil,g.top,g.factor))pour();if(pouring)updateFlow(performance.now());}
 function begin(){if(!active||returning||held||pouring||saving)return false;held=true;notify();pouredThisHold=pouring;can.classList.add('is-held');status.textContent=pouring?'继续移动水壶，水流会跟随壶嘴。':'移到盆栽或花盆附近即可浇水。';return true;}
 function move(e){
  if(!held||e.pointerId!==pointer)return;const r=scene.getBoundingClientRect();place({x:e.clientX-r.x,y:e.clientY-r.y-(e.pointerType==='touch'?48:0)});check();
 }
 function release(){if(!held)return;held=false;pointer=null;can.classList.remove('is-held','is-pouring','is-draining');water.dataset.phase='idle';water.dataset.flowing='false';void finish();returnHome();}
 can.addEventListener('pointerdown',e=>{if(e.isPrimary===false||e.button!==0||!begin())return;e.preventDefault();pointer=e.pointerId;can.setPointerCapture(pointer);});
 can.addEventListener('pointermove',move);
 can.addEventListener('pointerup',e=>{if(e.pointerId!==pointer)return;move(e);release();});
 const cancelPointer=e=>{if(e.pointerId===pointer)release();};
 can.addEventListener('pointercancel',cancelPointer);can.addEventListener('lostpointercapture',cancelPointer);
 can.addEventListener('keydown',e=>{
  if(e.key===' '||e.key==='Enter'){e.preventDefault();if(e.repeat)return;if(held)release();else begin();}
  if(e.key.startsWith('Arrow')&&held){e.preventDefault();const step=e.shiftKey?48:24;place({x:position.x+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),y:position.y+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0)});check();}
  if(e.key==='Escape')release();
 });
 window.addEventListener('blur',release);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){release();if(pouring)complete();}});
 new ResizeObserver(()=>{if(pouring)complete();if(held)release();else if(!returning)place(home());}).observe(scene);
 return {refresh,get busy(){return held||pouring||returning||saving;},setActive(value){active=value;if(!active){release();if(pouring)complete();}else{if(!held&&!pouring&&!returning)place(home());}}};
}
