import {t} from './i18n.mjs';
import {startStars} from './stars.mjs';
import {sceneFor,WEATHER_MAX_AGE} from './weather-model.mjs';
import {createParticles,particlePose} from './weather-particles.mjs';
import {colorTokens} from './color-system.mjs';
import {realtimeWeatherEnabled} from '/runtime-config.mjs';
const $=id=>document.getElementById(id),CACHE='bonsai-weather-v1';
export function startWeather({debug=false,preview=false,onSceneChange=()=>{}}={}){
 startStars();
 let treeAppearance={},treePreset={},treePot,treeLanguage,treeKey;
 let data=null,override=preview?{kind:'clear',hour:12}:{},geoState=realtimeWeatherEnabled?t('正在获取位置'):t('实时天气已关闭'),busy=false,lastAttempt=0,scene,raf=0,previous=0,elapsed=0,particles=[],width=0,height=0;
 const canvas=$('weather-effects'),ctx=canvas.getContext('2d'),motion=matchMedia('(prefers-reduced-motion: reduce)');
 if(realtimeWeatherEnabled&&!preview)try{const cached=JSON.parse(sessionStorage.getItem(CACHE));if(cached&&Date.now()-cached.fetchedAt<WEATHER_MAX_AGE)data=cached;}catch{}
 function resize(){width=innerWidth;height=innerHeight;const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=width*dpr;canvas.height=height*dpr;ctx?.setTransform(dpr,0,0,dpr,0,0);}
 function groundLevel(){
  const pot=$('stage')?.querySelector('[data-weather-ground]');
  return Math.max(60,Math.min(height,pot?.getBoundingClientRect().bottom??height*.8));
 }
 function resetParticles(){particles=createParticles(scene.kind,width,groundLevel());elapsed=0;}
 function animate(time){
  raf=0;if(document.hidden||motion.matches||!particles.length||!ctx)return;
  elapsed+=Math.max(0,(time-previous)/1000);previous=time;ctx.clearRect(0,0,width,height);
  const snow=scene.kind==='snow',wind=scene.kind==='wind',storm=scene.kind==='storm',ground=groundLevel();
  for(const particle of particles){
   const p=particlePose(particle,elapsed,scene.kind,width,ground);
   ctx.globalAlpha=p.alpha;ctx.beginPath();
   if(snow){
    ctx.fillStyle=scene.night?'#d9dddd80':'#d5dada80';
    ctx.strokeStyle=scene.night?'#b6bcbc20':'#8b94942b';ctx.lineWidth=.6;
    ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();ctx.stroke();
   }else if(wind){
    ctx.lineWidth=1.1*particle.depth;ctx.lineCap='round';
    ctx.strokeStyle=scene.night?'#b6bdbd4d':'#7d87873d';
    const length=65*particle.depth;
    ctx.moveTo(p.x,p.y);ctx.bezierCurveTo(p.x+length*.35,p.y-8,p.x+length*.7,p.y+7,p.x+length,p.y-3);ctx.stroke();
   }else{
    ctx.lineWidth=(storm?1.1:.85)*particle.depth;ctx.lineCap='round';
    ctx.strokeStyle=scene.night?'#b7bebe59':'#7b85854d';
    ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+p.length*p.vx/p.vy,p.y+p.length);ctx.stroke();
   }
  }
  ctx.globalAlpha=1;raf=requestAnimationFrame(animate);
 }
 function run(){document.body.classList.toggle('weather-paused',document.hidden);if(raf)cancelAnimationFrame(raf);raf=0;ctx?.clearRect(0,0,width,height);if(!document.hidden&&!motion.matches&&particles.length){previous=performance.now();raf=requestAnimationFrame(animate);}}
 function apply(){const next=sceneFor(data,Date.now(),override),changed=next.kind!==scene?.kind;scene=next;const style=document.documentElement.style;['top','middle','bottom'].forEach((key,i)=>style.setProperty('--sky-'+key,scene.colors[i]));Object.entries(colorTokens(scene,treeAppearance,treePreset,treePot,treeLanguage)).forEach(([key,value])=>style.setProperty('--'+key,value));document.body.classList.toggle('night',scene.night);document.body.dataset.weather=scene.kind;document.querySelector('meta[name="theme-color"]').content=scene.colors[0];$('weather-credit').hidden=!scene.live;
  if(debug)$('weather-info').textContent=`${override.kind&&override.kind!=='live'||Number.isFinite(override.hour)?t('调试预览 · '):''}${geoState}\n${scene.live?(data.stale?t('天气缓存 · '):'Open-Meteo · ')+data.timezone:t('设备时间 · 天气未知')} · ${Math.floor(scene.hour).toString().padStart(2,'0')}:${Math.floor(scene.hour%1*60).toString().padStart(2,'0')}\n${scene.kind}${scene.live?t(' · 更新于 ')+new Date(data.fetchedAt).toLocaleTimeString():''}`;
  if(changed){resetParticles();run();}
  onSceneChange(scene);
 }
 async function locate(force=false){if(preview||!realtimeWeatherEnabled||busy||document.hidden||(!force&&Date.now()-lastAttempt<10*60*1000))return;busy=true;lastAttempt=Date.now();
  try{if(!navigator.geolocation)throw new Error(t('此浏览器不支持定位'));
   const permission=await navigator.permissions?.query({name:'geolocation'}).catch(()=>null);if(permission?.state==='denied')throw new Error(t('未获定位授权'));
   const position=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,maximumAge:5*60*1000,timeout:9000}));
   // Round before transmission; neither exact coordinates nor a tree ID is sent.
   const lat=(Math.round(position.coords.latitude*10)/10).toFixed(1),lon=(Math.round(position.coords.longitude*10)/10).toFixed(1);
   const r=await fetch(`/api/weather?lat=${lat}&lon=${lon}`,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error(t('天气暂不可用'));data=await r.json();geoState=t('当前位置（约 10 公里精度）');try{sessionStorage.setItem(CACHE,JSON.stringify(data));}catch{}
  }catch(e){geoState=e.code===1?t('未获定位授权'):e.code===3?t('定位超时'):e.message||t('定位不可用');}finally{busy=false;apply();}
 }
 if(debug){$('weather-controls').hidden=false;$('weather-kind').onchange=e=>{override.kind=e.target.value;apply();};$('weather-hour').oninput=e=>{override.hour=Number(e.target.value);$('weather-hour-value').textContent=override.hour.toFixed(1)+t(' 时');apply();};$('weather-live').onclick=()=>{override={};$('weather-kind').value='live';$('weather-hour').value=sceneFor(data).hour;$('weather-hour-value').textContent=t('实时');apply();locate(true);};}
 resize();apply();locate();addEventListener('resize',()=>{resize();resetParticles();run();});motion.addEventListener('change',run);
 document.addEventListener('visibilitychange',()=>{run();if(!document.hidden){apply();locate();}});setInterval(()=>{if(!document.hidden){apply();locate();}},60000);
 return {setTree(tree){const key=JSON.stringify([tree.config.appearance,tree.preset.id,tree.config.pot,tree.language]);if(key===treeKey)return;treeKey=key;treeAppearance=tree.config.appearance;treePreset=tree.preset;treePot=tree.config.pot;treeLanguage=tree.language;for(const name of ['body','rim','pattern'])document.documentElement.style.removeProperty('--bonsai-vessel-'+name);apply();}};
}
