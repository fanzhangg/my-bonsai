import {t} from './i18n.mjs';
import {edgePoint,flightPoint,visitTiming,flightAppearance} from './visitor-flight.mjs';

const butterflies=[
  {name:t('淡杏蝶'),color:'#c9b68c',size:22,wing:'M24 24Q9 4 8 14Q7 23 17 26Q10 33 16 34Q23 34 24 24Z'},
  {name:t('米白蝶'),color:'#ded9c4',size:20,wing:'M24 24C20 13 10 8 9 17Q8 24 17 26Q10 31 16 34Q24 34 24 24Z'},
  {name:t('灰蓝蝶'),color:'#9eafb0',size:21,wing:'M24 24L10 10Q4 20 17 26Q10 32 16 33Q23 33 24 24Z'}
];
function butterflyMarkup(type){
  const wing=`<path d="${type.wing}" fill="${type.color}"/>`;
  return `<svg viewBox="0 0 48 48" aria-hidden="true"><g class="visitor-flight-form"><g class="visitor-heading"><g class="visitor-wing visitor-wing-left">${wing}</g><g class="visitor-wing visitor-wing-right"><g transform="translate(48 0) scale(-1 1)">${wing}</g></g><path d="M24 20V30" stroke="#68705b" stroke-width="1.3" stroke-linecap="round"/></g></g><g class="visitor-rest-form"><g class="visitor-rest-heading"><g class="visitor-folded-wing" fill="${type.color}"><path d="M25 24Q11 19 13 11Q21 10 27 23Z" opacity=".55"/><path d="M25 24Q15 20 19 8Q29 11 28 23Z"/></g><path d="M20 24H30M29 24L32 21" fill="none" stroke="#68705b" stroke-width="1.1" stroke-linecap="round"/></g></g></svg>`;
}
const firefly='<span class="visitor-firefly" aria-hidden="true"></span>';

export function createVisitors({scene,treeElement,layer,onCount=()=>{},onStatus=()=>{},focusTarget=layer}){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let active=false,paused=false,mode='day',bugs=[],clock=0,last=0,raf=0,perches=[],hasFoliage=false;
  const label=()=>mode==='day'?t('蝴蝶'):t('萤火虫');
  function updateCount(){ onCount(t('{count} 位访客',{count:bugs.filter(b=>b.phase==='idle'||b.phase==='enter').length})); }
  // Map real leaf-cluster surfaces into the overlay, including SVG letterboxing.
  function measurePerches(){
    const bounds=layer.getBoundingClientRect();
    if(!bounds.width||!bounds.height)return;
    const leaves=[...treeElement.querySelectorAll('[data-wind-leaf]')];
    hasFoliage=leaves.length>0;
    if(!hasFoliage){const branches=treeElement.querySelector('[data-wind-tree]');if(branches)leaves.push(branches);}
    const points=leaves.map(leaf=>{
      const box=leaf.getBBox(),matrix=leaf.getScreenCTM();
      if(!matrix||!box.width)return null;
      const point=new DOMPoint(box.x+box.width*.5,box.y+box.height*.2).matrixTransform(matrix);
      return {x:(point.x-bounds.left)/bounds.width*100,y:(point.y-bounds.top)/bounds.height*100};
    }).filter(Boolean).sort((a,b)=>a.y-b.y);
    perches=points.filter((p,i)=>points.slice(0,i).every(q=>Math.hypot(p.x-q.x,p.y-q.y)>7));
    if(!perches.length)perches=[{x:45,y:38},{x:60,y:48},{x:36,y:53}];
  }
  function butterflyPose(b,time){
    const duration=18+b.index*2,offset=[0,9,15][b.index];
    const total=time+offset,cycle=Math.floor(total/duration),t=total%duration,rest=6+b.index;
    const start=perches[(b.perch+b.index*2+cycle)%perches.length];
    const end=perches[(b.perch+b.index*2+cycle+1)%perches.length];
    // A sapling with bare branches has nowhere to perch yet.
    if(!hasFoliage)return {x:start.x+Math.cos(time*.45+b.seed)*8,y:start.y+Math.sin(time*.6+b.seed)*5,resting:false};
    if(t<rest)return {...start,resting:true};
    const progress=(t-rest)/(duration-rest),u=progress*progress*(3-2*progress),v=1-u,side=b.index===1?-1:1;
    const c1={x:Math.max(12,Math.min(88,start.x+side*24)),y:Math.max(16,start.y-20)};
    const c2={x:Math.max(12,Math.min(88,end.x-side*21)),y:Math.max(16,end.y-15)};
    // A broad curved excursion, with uneven flutter that fades during landing.
    const envelope=Math.sin(Math.PI*u)**2;
    return {x:v*v*v*start.x+3*v*v*u*c1.x+3*v*u*u*c2.x+u*u*u*end.x+Math.sin(time*3.1+b.seed)*1.2*envelope,
      y:v*v*v*start.y+3*v*v*u*c1.y+3*v*u*u*c2.y+u*u*u*end.y+Math.sin(time*5.3+b.seed)*.75*envelope,
      resting:false,landing:u>.9};
  }
  function position(b){
    const t=reduced.matches?0:Math.max(0,clock-b.localStart)/1000;
    if(mode==='day')return butterflyPose(b,t);
    return {x:b.x+Math.sin(t*.47+b.seed)*4,y:b.y+Math.cos(t*.63+b.seed)*3};
  }
  function renderBugs(){
    const width=layer.clientWidth,height=layer.clientHeight;
    for(const b of bugs){
      if(b.phase==='waiting'){
        if(clock<b.nextVisit)continue;
        arrive(b);
      }
      if(b.phase==='idle'&&clock>=b.departAt&&document.activeElement!==b.button)depart(b,false);
      const elapsed=clock-b.since;
      let p=position(b),opacity=1,scale=1;
      if(b.phase==='leave'){
        const u=Math.min(1,elapsed/(reduced.matches?240:b.leaveDuration));
        p=reduced.matches?b.from:flightPoint(b.from,b.exit,u,b.bend);
        const depth=flightAppearance(u,false);
        opacity=b.departOpacity*depth.opacity;
        scale=reduced.matches?1:b.departScale*depth.scale;
        if(u===1){
          b.phase='waiting';b.nextVisit=clock+visitTiming().wait;b.button.style.visibility='hidden';
          b.button.dataset.phase='waiting';continue;
        }
      }else if(b.phase==='enter'){
        const u=Math.min(1,elapsed/(reduced.matches?400:b.timing.enter));
        // Freeze the local orbit until the curved entrance reaches that exact position.
        const eased=1-(1-u)**2;
        p=reduced.matches?p:flightPoint(b.entry,p,eased,b.bend);
        const depth=flightAppearance(u,true);
        opacity=depth.opacity;scale=reduced.matches?1:depth.scale;
        if(u===1){b.phase='idle';b.localStart=clock;b.departAt=clock+b.timing.stay;}
      }
      if(mode==='day'){
        const resting=Boolean(p.resting)&&b.phase==='idle';
        const previous=b.current,dx=previous?(p.x-previous.x)*width:0,dy=previous?(p.y-previous.y)*height:0;
        const target=!resting&&Math.hypot(dx,dy)>.01?Math.atan2(dy,dx)*180/Math.PI+90:b.angle;
        const turn=((target-b.angle+540)%360)-180;
        b.angle+=turn*(reduced.matches?1:.09);
        const seconds=reduced.matches?0:clock/1000;
        const beat=(Math.sin(seconds*(25+b.index*3)+b.seed)+1)/2;
        const spread=reduced.matches?.8:.35+beat*.65;
        b.heading.style.transform=`rotate(${b.angle}deg)`;
        b.folded.style.transform=`scaleX(${reduced.matches?1:.94+Math.sin(seconds*1.1+b.seed)*.06})`;
        b.wings[0].style.transform=`scaleX(${spread})`;
        b.wings[1].style.transform=`scaleX(${spread*(resting?.62:.88)})`;
        const behavior=resting?'resting':'flying';
        if(b.button.dataset.behavior!==behavior){
          b.button.dataset.behavior=behavior;
          b.button.setAttribute('aria-label',t('{name}，{state}，点击让它飞走',{name:butterflies[b.index].name,state:resting?t('停在树冠休息'):t('飞舞中')}));
        }
      }
      b.current=p;
      b.depthScale=scale;b.depthOpacity=opacity;
      b.button.style.setProperty('--visitor-distance-scale',scale);
      b.button.dataset.phase=b.phase;
      b.button.style.transform=`translate(${p.x/100*width-24}px,${p.y/100*height-24}px)`;
      b.button.style.opacity=opacity;
      b.button.style.visibility='visible';
    }
  }
  function arrive(b){
    if(b.visits) b.index=(b.index+1+Math.floor(Math.random()*2))%butterflies.length;
    b.visits++;
    b.seed=Math.random()*Math.PI*2;b.perch=Math.floor(Math.random()*perches.length);
    b.x=28+Math.random()*44;b.y=28+Math.random()*32;
    b.timing=visitTiming();b.entry=edgePoint();b.bend=4+Math.random()*9;
    b.localStart=Infinity;b.since=clock;b.phase='enter';b.current=null;
    b.button.innerHTML=mode==='day'?butterflyMarkup(butterflies[b.index]):firefly;
    b.visual=b.button.querySelector('svg');b.wings=b.button.querySelectorAll('.visitor-wing');
    b.heading=b.button.querySelector('.visitor-heading');b.folded=b.button.querySelector('.visitor-folded-wing');
    const restHeading=b.button.querySelector('.visitor-rest-heading');
    if(restHeading)restHeading.style.transform=`rotate(${-8+Math.random()*16}deg) scaleX(${Math.random()<.5?-1:1})`;
    // Start with a mix of small, medium and large visitors; keep each size for its whole visit.
    const sizeClass=b.visits===1?b.slot%3:Math.floor(Math.random()*3);
    const sizeRange=[[.62,.78],[.92,1.08],[1.18,1.3]][sizeClass];
    const individualSize=sizeRange[0]+Math.random()*(sizeRange[1]-sizeRange[0]);
    b.button.style.setProperty('--butterfly-size',`${butterflies[b.index].size*individualSize}px`);
    b.button.style.setProperty('--offset',`${-Math.random()*4}s`);
    b.button.style.setProperty('--glow-size',individualSize);
    b.button.setAttribute('aria-label',t('{name} {index}，点击让它飞走',{name:label(),index:b.slot+1}));
    delete b.button.dataset.behavior;
    const destination=position(b);
    b.angle=Math.atan2(destination.y-b.entry.y,destination.x-b.entry.x)*180/Math.PI+90;
    b.button.disabled=false;updateCount();
  }
  function depart(b,startled){
    if(b.phase==='leave'||b.phase==='waiting')return;
    b.from={...b.current};b.exit=edgePoint();b.bend=4+Math.random()*10;
    b.departScale=b.depthScale??1;b.departOpacity=b.depthOpacity??1;
    b.leaveDuration=startled?1100:b.timing.leave;b.phase='leave';b.since=clock;
    // Move keyboard focus before disabling its departing target.
    if(document.activeElement===b.button)focusTarget.focus({preventScroll:true});
    b.button.disabled=true;
    updateCount();
  }
  function dismiss(b){
    if(b.phase==='leave'||b.phase==='waiting')return;
    depart(b,true);
    onStatus(paused?t('已暂停。继续飞舞后，这只{name}会飞走。',{name:label()}):t('这只{name}飞远了。等一会儿，也许会有新的访客。',{name:label()}));
    updateCount();renderBugs();
  }
  function reset({initial=false}={}){
    clock=0;layer.replaceChildren();
    const positions=mode==='day'?[[32,35],[65,30],[57,53]]:[[29,36],[68,35],[40,55],[60,60],[74,50]];
    bugs=positions.map(([x,y],i)=>{
      const button=document.createElement('button');button.type='button';button.className=`visitor-bug ${mode==='day'?'visitor-butterfly':'visitor-glow'}`;
      button.setAttribute('aria-label',t('{name} {index}，点击让它飞走',{name:label(),index:i+1}));
      button.style.visibility='hidden';button.disabled=true;button.dataset.phase='waiting';
      const b={button,x,y,index:i%3,slot:i,visits:0,phase:'waiting',nextVisit:i===0?0:i*(1800+Math.random()*1800)};
      button.addEventListener('click',()=>dismiss(b));layer.append(button);return b;
    });
    if(initial){
      bugs.forEach((b,i)=>{
        arrive(b);
        b.phase='idle';b.departAt=clock+b.timing.stay;
        [b.x,b.y]=positions[i];
        b.perch=Math.floor(i*perches.length/bugs.length);
        // Begin partway through a flight, so the opening scene is already inhabited.
        const duration=18+b.index*2,rest=6+b.index,offset=[0,9,15][b.index];
        const flightTime=(rest+(duration-rest)*(.25+Math.random()*.5)-offset+duration)%duration;
        b.localStart=clock-flightTime*1000;
        if(mode==='day'){
          const p=butterflyPose(b,flightTime),next=butterflyPose(b,flightTime+.02);
          b.angle=Math.atan2((next.y-p.y)*layer.clientHeight,(next.x-p.x)*layer.clientWidth)*180/Math.PI+90;
        }
      });
    }
    onStatus(initial?t('小访客已经在枝叶间飞舞，轻触一只试试。'):paused?t('已重新邀请，继续飞舞后，小访客会从画面外飞来。'):t('小访客正从远处飞来，也会随兴离开。'));
    updateCount();renderBugs();sync();
  }
  function frame(now){
    clock+=last?Math.min(now-last,64):0;last=now;renderBugs();raf=requestAnimationFrame(frame);
  }
  function sync(){
    cancelAnimationFrame(raf);last=0;
    const running=active&&!paused&&!document.hidden;
    scene.classList.toggle('visitor-still',!running);
    if(running)raf=requestAnimationFrame(frame);
  }
  const observer=new ResizeObserver(()=>{if(active){measurePerches();renderBugs();}});
  observer.observe(layer);
  document.addEventListener('visibilitychange',sync);
  reduced.addEventListener('change',renderBugs);
  return {
    refresh(){measurePerches();if(active)renderBugs();},
    setActive(value){active=value;if(active){measurePerches();if(!bugs.length)reset({initial:true});renderBugs();}sync();},
    setMode(value){if(mode===value)return;mode=value;if(bugs.length){measurePerches();reset({initial:true});}},
    setPaused(value){paused=value;sync();},
    reset,
    destroy(){active=false;cancelAnimationFrame(raf);observer.disconnect();document.removeEventListener('visibilitychange',sync);reduced.removeEventListener('change',renderBugs);layer.replaceChildren();}
  };
}
