import {waterPoint,waterImpact,nearPlanter,waterFacing,createWaterTank,spendWater,refillWaterTank,WATER_CAPACITY} from './watering-motion.mjs';
import {toolHome} from './tool-home.mjs';
import {collisionGrid} from './collision-grid.mjs';

export function createWatering({scene,holder,can,water,status,initialProgress=.55,renderTree,onDose=()=>{},onFinish=async()=>{},onBusyChange=()=>{},onError=()=>{},onSettled,getHome}){
 const ns='http://www.w3.org/2000/svg',vessel=can.querySelector('.watering-vessel'),facing=can.querySelector('.watering-facing');
 let progress=initialProgress,tree,svg,saving=false,usedThisHold=0,active=false,held=false,pouring=false,returning=false,pointer=null,raf=0,started=0,lastEmit=0,lastFrame=0,direction=1,growthTarget=initialProgress,lastSplash=0,pouredThisHold=false,position={x:0,y:0};
 let cachedGeometry=null,cachedCollision=null,wasBusy=false,growthDirty=false;
 let animationTime=0,previousNozzle=null,streamId=0;
 const invalidate=()=>{cachedGeometry=null;cachedCollision=null;};
 const particles=[],splashes=[];
 const tank=createWaterTank();
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 function refresh(next){tree=next;svg=holder.querySelector('svg');invalidate();}
 function paint(value){progress=value;refresh(renderTree(value));holder.dataset.progress=(tree?.progress??value).toFixed(4);}
 paint(progress);
 const notify=()=>{
  const busy=held||pouring||returning||saving;if(busy===wasBusy)return;wasBusy=busy;
  onBusyChange(busy);
  // Keep the tree stable until both the last splash and return animation finish.
  if(!busy&&growthDirty){growthDirty=false;if(onSettled)onSettled();else paint(growthTarget);}
 };
 async function finish(){
  if(!usedThisHold)return;const used=usedThisHold;usedThisHold=0;saving=true;notify();
  try{await onFinish(used);}catch(error){onError(error);}finally{saving=false;notify();}
 }
 // Keep mirroring inside SVG: legacy WebKit can omit outer CSS transforms
 // from getScreenCTM(), leaving emitted water on the opposite side of the can.
 function place(p){position=p;can.style.left='0px';can.style.top='0px';can.style.translate=p.x+'px '+p.y+'px';if(svg&&active){direction=waterFacing(p.x,geometry().soil.x,direction);facing.setAttribute('transform','scale('+direction+' 1)');}}
 function home(){return getHome?getHome(scene):toolHome(scene);}
 function screen(x,y){const q=new DOMPoint(x,y).matrixTransform(svg.getScreenCTM()),r=scene.getBoundingClientRect();return {x:q.x-r.x,y:q.y-r.y};}
 function geometry(){return cachedGeometry??={soil:screen(tree.root.x,tree.root.y-3),top:screen(tree.root.x,svg.querySelector('[data-wind-tree]').getBBox().y),factor:svg.getScreenCTM().a};}
 function element(tag,attrs){const el=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);water.append(el);return el;}
 const streams=Array.from({length:5},()=>element('path',{class:'watering-stream'}));
 function clearWater(){previousNozzle=null;particles.forEach(p=>p.dot?.remove());particles.length=0;streams.forEach(el=>el.setAttribute('d',''));splashes.splice(0).forEach(p=>p.el.remove());}
 function showWater(){can.dataset.remaining=String(tank.remaining);can.style.setProperty('--water-fill',String(tank.remaining/WATER_CAPACITY));}
 showWater();
 function updateFlow(time){
  const g=geometry(),near=nearPlanter(position,g.soil,g.top,g.factor),flowing=pouring&&held&&tank.remaining>0&&near;
  if(!flowing)previousNozzle=null;
  can.classList.toggle('is-pouring',flowing);
  can.classList.toggle('is-draining',flowing&&tank.remaining<900);
  can.style.setProperty('--drain-tilt',((1-Math.min(1,tank.remaining/900))*-8)+'deg');
  water.dataset.phase=flowing?(tank.remaining<600?'drops':tank.remaining<900?'draining':'stream'):'idle';
  water.dataset.flowing=String(flowing);
  if(pouring&&tank.remaining>0)status.textContent=near?'正在浇水，可以继续移动水壶。':'已离开盆栽，停止出水。移回附近可继续。';
  return flowing;
 }
 function emit(time,dt){
  const pressure=Math.min(1,tank.remaining/900),dripping=tank.remaining<600;
  // Read the actual tilted nozzle once per frame, not once per water sample.
  const matrix=vessel.getScreenCTM(),rect=scene.getBoundingClientRect();
  const tip=new DOMPoint(-51,-14).matrixTransform(matrix),out=new DOMPoint(-52,-13.2).matrixTransform(matrix);
  const current={x:tip.x-rect.x,y:tip.y-rect.y,dx:out.x-tip.x,dy:out.y-tip.y,direction};
  const previous=previousNozzle?.direction===direction?previousNozzle:null;
  if(!previous)streamId++;
  const from=previous??current;
  // Fixed-density emission keeps each lane connected even at 8–15 fps.
  // A direction flip starts a new stream instead of drawing across the can.
  const count=dripping?1:Math.max(1,Math.ceil(dt/12));
  for(let step=1;step<=count;step++){
   const u=step/count,x=from.x+(current.x-from.x)*u,y=from.y+(current.y-from.y)*u;
   const dx=from.dx+(current.dx-from.dx)*u,dy=from.dy+(current.dy-from.dy)*u,length=Math.hypot(dx,dy)||1;
   for(let lane=0;lane<5;lane++){
    if(dripping?lane!==2:Math.abs(lane-2)>Math.ceil(pressure*2))continue;
    const spread=lane-2;
    particles.push({dot:dripping?element('ellipse',{class:'watering-drain-drop',rx:1.5,ry:2.4}):null,
     x:x+spread*1.6,y:y+spread*.8,vx:(dx/length*100+spread*13)*(.3+.7*pressure),vy:(dy/length*90+spread*2)*(.45+.55*pressure),
     born:dripping?time:time-dt+dt*u,direction,lane,stream:streamId});
   }
  }
  previousNozzle=current;
 }
 function collisionSurface(){
  if(cachedCollision)return cachedCollision;
  const rect=scene.getBoundingClientRect(),shapes=[];
  for(const el of svg.querySelectorAll('[data-wind-leaf]')){
   const r=el.getBoundingClientRect(),x=r.x-rect.x+r.width/2,y=r.y-rect.y+r.height/2,rx=r.width/2,ry=r.height/2;
   if(rx>0&&ry>0)shapes.push({left:x-rx,right:x+rx,top:y-ry,bottom:y+ry,hit:q=>((q.x-x)/rx)**2+((q.y-y)/ry)**2<=1});
  }
  for(const el of svg.querySelectorAll('[data-wind-wood] path,[data-wind-wood] circle,[data-weather-ground] path,[data-weather-ground] ellipse,[data-weather-ground] rect')){
   if(el.closest('defs'))continue;
   const box=el.getBoundingClientRect(),inverse=el.getScreenCTM().inverse();
   shapes.push({left:box.left-rect.x,right:box.right-rect.x,top:box.top-rect.y,bottom:box.bottom-rect.y,
    hit:q=>el.isPointInFill(new DOMPoint(q.x+rect.x,q.y+rect.y).matrixTransform(inverse))});
  }
  const ground=svg.querySelector('[data-weather-ground]').getBoundingClientRect().bottom-rect.top,hit=collisionGrid(shapes);
  return cachedCollision=q=>q.y>=ground||hit(q);
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
    particles.splice(i,1);p.dot?.remove();if(!p.dot)points[p.lane].push({...impact,direction:p.direction,stream:p.stream});splash(impact,time);
   }else if(q.y>scene.clientHeight+12||age>2){p.dot?.remove();particles.splice(i,1);}
   else if(p.dot){p.dot.setAttribute('cx',q.x);p.dot.setAttribute('cy',q.y);}
   else points[p.lane].push({...q,direction:p.direction,stream:p.stream});
  }
  // Five separate fine streams retain their own trajectories, never a thick ribbon.
  points.forEach((lane,i)=>{
   let path='',segment=[];
   const flush=()=>{if(!segment.length)return;path+=' M'+segment[0].x+' '+segment[0].y;for(let j=1;j<segment.length;j++){const p=segment[j-1],q=segment[j];path+=' Q'+p.x+' '+p.y+' '+(p.x+q.x)/2+' '+(p.y+q.y)/2;}const end=segment.at(-1);path+=' L'+end.x+' '+end.y;segment=[];};
   for(const p of lane){const previous=segment.at(-1);if(previous&&(p.stream!==previous.stream||p.direction!==previous.direction||Math.hypot(p.x-previous.x,p.y-previous.y)>35))flush();segment.push(p);}flush();streams[i].setAttribute('d',path);streams[i].style.strokeWidth=String(.55+.55*Math.min(1,tank.remaining/900));
  });
  for(let i=splashes.length-1;i>=0;i--){const p=splashes[i],age=(time-p.born)/600;if(age>=1){p.el.remove();splashes.splice(i,1);}else{p.ripple.setAttribute('rx',2+age*9);p.ripple.setAttribute('ry',1+age*2);p.el.style.opacity=String((1-age)*.7);for(const {dot,vx,vy} of p.drops){const t=age*.6;dot.setAttribute('cx',vx*t);dot.setAttribute('cy',Math.min(0,vy*t+140*t*t));}}}
 }
 async function returnHome(){
  if(returning)return;returning=true;can.classList.remove('is-held');const destination=home();
  if(active&&!reduced())await can.animate([{translate:position.x+'px '+position.y+'px'},{translate:destination.x+'px '+destination.y+'px'}],{duration:380,easing:'cubic-bezier(.2,.7,.2,1)'}).finished.catch(()=>{});
  place(home());refillWaterTank(tank);pouredThisHold=false;showWater();status.textContent='水壶已补满，可以再次拿起。';returning=false;notify();
 }
 function complete(){
  cancelAnimationFrame(raf);raf=0;pouring=false;clearWater();can.classList.remove('is-pouring','is-draining');water.dataset.phase='idle';water.dataset.flowing='false';status.textContent=tank.remaining<=0?'水壶已空，松手放回补水。':'放回水壶，补满后可继续。';
  void finish();notify();
 }
 function frame(timestamp){
  if(!active||document.hidden){complete();return;}
  const elapsed=timestamp-started,dt=Math.min(60,Math.max(0,timestamp-lastFrame));lastFrame=timestamp;
  // Water motion and dosage share the same bounded clock: a stalled frame must
  // not age every existing drop out while only emitting one new drop at the tip.
  animationTime+=dt;const time=animationTime;
  if(updateFlow(time)&&elapsed>250){
   const dose=spendWater(tank,dt);usedThisHold+=dose.used;onDose(dose.used);
   growthTarget=Math.min(1,growthTarget+dose.growth);
   if(dose.used>0)growthDirty=true;
   showWater();
   if(dose.used>0&&tank.remaining>0&&(tank.remaining>=600||time-lastEmit>=105)){emit(time,dt);lastEmit=time;}
  }
  drawWater(time,dt);
  if((tank.remaining<=0||(!held&&!can.classList.contains('is-pouring')))&&particles.length===0&&splashes.length===0){complete();return;}raf=requestAnimationFrame(frame);
 }
 function pour(){
  if(!held||pouring||pouredThisHold||tank.remaining<=0)return;
  pouring=true;pouredThisHold=true;started=performance.now();lastFrame=started;lastEmit=started;animationTime=started;previousNozzle=null;
  can.classList.add('is-pouring');status.textContent='正在浇水，可以继续移动水壶。';raf=requestAnimationFrame(frame);
 }
 function check(){const g=geometry();if(nearPlanter(position,g.soil,g.top,g.factor))pour();if(pouring)updateFlow(performance.now());}
 function begin(){if(!active||returning||held||pouring||saving)return false;held=true;notify();invalidate();pouredThisHold=pouring;can.classList.add('is-held');status.textContent=pouring?'继续移动水壶，水流会跟随壶嘴。':'移到盆栽或花盆附近即可浇水。';return true;}
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
 window.addEventListener('scroll',invalidate,{passive:true,capture:true});
 new ResizeObserver(()=>{invalidate();if(pouring)complete();if(held)release();else if(!returning)place(home());}).observe(scene);
 return {refresh,get busy(){return held||pouring||returning||saving;},setActive(value){active=value;if(!active){release();if(pouring)complete();}else{if(!held&&!pouring&&!returning)place(home());}}};
}
