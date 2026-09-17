import {sceneFor,WEATHER_MAX_AGE} from './weather-model.mjs';
const $=id=>document.getElementById(id),CACHE='bonsai-weather-v1';
export function startWeather({debug=false}={}){
 let data=null,override={},geoState='正在获取位置',busy=false,lastAttempt=0,scene,raf=0,previous=0,particles=[],width=0,height=0;
 const canvas=$('weather-effects'),ctx=canvas.getContext('2d'),motion=matchMedia('(prefers-reduced-motion: reduce)');
 try{const cached=JSON.parse(sessionStorage.getItem(CACHE));if(cached&&Date.now()-cached.fetchedAt<WEATHER_MAX_AGE)data=cached;}catch{}
 function resize(){width=innerWidth;height=innerHeight;const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=width*dpr;canvas.height=height*dpr;ctx?.setTransform(dpr,0,0,dpr,0,0);}
 function resetParticles(){const n=scene.kind==='snow'?38:scene.kind==='storm'?65:scene.kind==='rain'?45:scene.kind==='wind'?14:0;particles=Array.from({length:n},()=>({x:Math.random()*width,y:Math.random()*height,size:1+Math.random()*2,phase:Math.random()*6.28,speed:.6+Math.random()*.8}));}
 function animate(time){raf=0;if(document.hidden||motion.matches||!particles.length||!ctx)return;const dt=Math.min((time-previous)/1000,.05);previous=time;ctx.clearRect(0,0,width,height);ctx.lineWidth=scene.kind==='snow'?1:1.1;
  for(const p of particles){const snow=scene.kind==='snow',wind=scene.kind==='wind';p.y+=dt*(snow?24:wind?5:390)*p.speed;p.x+=dt*(snow?Math.sin(time/1800+p.phase)*10:wind?70:-65)*p.speed;if(p.y>height+30){p.y=-30;p.x=Math.random()*width;}if(p.x>width+80)p.x=-80;if(p.x< -80)p.x=width+80;
   ctx.beginPath();if(snow){ctx.fillStyle=scene.night?'#eff4f399':'#fffdfbcc';ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();}else{ctx.strokeStyle=wind?'#f1f5ee28':scene.night?'#d2e2e544':'#577c8a40';ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+(wind?45:-3),p.y+(wind?0:13*p.speed));ctx.stroke();}}
  raf=requestAnimationFrame(animate);
 }
 function run(){document.body.classList.toggle('weather-paused',document.hidden);if(raf)cancelAnimationFrame(raf);raf=0;ctx?.clearRect(0,0,width,height);if(!document.hidden&&!motion.matches&&particles.length){previous=performance.now();raf=requestAnimationFrame(animate);}}
 function apply(){const next=sceneFor(data,Date.now(),override),changed=next.kind!==scene?.kind;scene=next;const style=document.documentElement.style;['top','middle','bottom'].forEach((key,i)=>style.setProperty('--sky-'+key,scene.colors[i]));style.setProperty('--tree-light',scene.filter);style.setProperty('--ink',scene.foreground);document.body.classList.toggle('night',scene.night);document.body.dataset.weather=scene.kind;document.querySelector('meta[name="theme-color"]').content=scene.colors[0];$('weather-credit').hidden=!scene.live;
  if(debug)$('weather-info').textContent=`${override.kind&&override.kind!=='live'||Number.isFinite(override.hour)?'调试预览 · ':''}${geoState}\n${scene.live?(data.stale?'天气缓存 · ':'Open-Meteo · ')+data.timezone:'设备时间 · 天气未知'} · ${Math.floor(scene.hour).toString().padStart(2,'0')}:${Math.floor(scene.hour%1*60).toString().padStart(2,'0')}\n${scene.kind}${scene.live?' · 更新于 '+new Date(data.fetchedAt).toLocaleTimeString():''}`;
  if(changed){resetParticles();run();}
 }
 async function locate(force=false){if(busy||document.hidden||(!force&&Date.now()-lastAttempt<10*60*1000))return;busy=true;lastAttempt=Date.now();
  try{if(!navigator.geolocation)throw new Error('此浏览器不支持定位');
   const permission=await navigator.permissions?.query({name:'geolocation'}).catch(()=>null);if(permission?.state==='denied')throw new Error('未获定位授权');
   const position=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,maximumAge:5*60*1000,timeout:9000}));
   // Round before transmission; neither exact coordinates nor a tree ID is sent.
   const lat=(Math.round(position.coords.latitude*10)/10).toFixed(1),lon=(Math.round(position.coords.longitude*10)/10).toFixed(1);
   const r=await fetch(`/api/weather?lat=${lat}&lon=${lon}`,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error('天气暂不可用');data=await r.json();geoState='当前位置（约 10 公里精度）';try{sessionStorage.setItem(CACHE,JSON.stringify(data));}catch{}
  }catch(e){geoState=e.code===1?'未获定位授权':e.code===3?'定位超时':e.message||'定位不可用';}finally{busy=false;apply();}
 }
 if(debug){$('weather-controls').hidden=false;$('weather-kind').onchange=e=>{override.kind=e.target.value;apply();};$('weather-hour').oninput=e=>{override.hour=Number(e.target.value);$('weather-hour-value').textContent=override.hour.toFixed(1)+' 时';apply();};$('weather-live').onclick=()=>{override={};$('weather-kind').value='live';$('weather-hour').value=sceneFor(data).hour;$('weather-hour-value').textContent='实时';apply();locate(true);};}
 resize();apply();locate();addEventListener('resize',()=>{resize();resetParticles();run();});motion.addEventListener('change',run);
 document.addEventListener('visibilitychange',()=>{run();if(!document.hidden){apply();locate();}});setInterval(()=>{if(!document.hidden){apply();locate();}},60000);
}
