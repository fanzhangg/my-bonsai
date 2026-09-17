import {snapshot,draw,HOUR,VERSION} from './growth.mjs';
import {replayFrame,REPLAY_MS} from './playback.mjs';
import {LOOKS,lookFor} from './core/v1/appearance.mjs';
import {PRESETS,normalize} from './core/v1/canopy.mjs';
import {configForClaim} from './claim.mjs';
import {startWeather} from './weather.mjs';
import {startWind} from './wind.mjs';
import {createVisitors} from './visitors.mjs';
const $=id=>document.getElementById(id),debug=new URLSearchParams(location.search).has('debug');
const visitors=createVisitors({scene:$('insect-layer'),treeElement:$('stage'),layer:$('insect-layer')});
const weather=startWeather({debug,onSceneChange:scene=>visitors.setMode(scene.night?'night':'day')});
const wind=startWind($('stage'));
let treeId=location.pathname.match(/^\/t\/([^/]+)$/)?.[1];
let record,sandbox,offset=0,hours=0,playing=false,timer,loading=false;
const current=()=>sandbox||record;
const now=()=>sandbox?sandbox.createdAt+hours*HOUR:Date.now()+offset;
function status(text=''){$('status').textContent=text;$('status').hidden=!text;}
async function api(path,body){const r=await fetch('/api/trees'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});const data=await r.json();if(!r.ok)throw new Error(data.error);return data;}
function paint(tree=snapshot(current(),now())){weather.setTree(tree);$('stage').innerHTML=draw(tree,{transparent:true,viewBox:{x:tree.root.x-300,y:tree.root.y-420,width:640,height:620}});wind.refresh();visitors.refresh();visitors.setActive(true);if(debug){$('age').textContent=`${hours.toFixed(1)} 小时`;$('info').textContent=`${record.id||'未认领样本'}\n${VERSION}\n成熟需 ${tree.matureDays.toFixed(1)} 天 · 生长 ${(tree.progress*100).toFixed(1)}% · 枝段 ${tree.nodes.length} · 叶团 ${tree.clusters.filter(c=>tree.hour>c.born).length}\n${playing?'回放中':'静止预览'}`;}}
function stop(){clearTimeout(timer);playing=false;}
function replay(){stop();const data=structuredClone(current()),end=now(),start=performance.now();if(matchMedia('(prefers-reduced-motion: reduce)').matches){paint();return;}playing=true;const frame=()=>{const p=Math.min(1,(performance.now()-start)/REPLAY_MS);paint(replayFrame(data,end,p));if(p<1)timer=setTimeout(frame,70);else{stop();paint();}};frame();}
function debugFields(){$('preset').value=sandbox.config.preset;$('look').value=lookFor(sandbox.config.appearance)?.id||'original';$('seed').value=sandbox.config.seed;$('time').max=Math.max(168,Math.ceil(hours));$('time').value=hours;}
function resetSandbox(){stop();sandbox=structuredClone(record);hours=Math.max(0,(Date.now()+offset-record.createdAt)/HOUR);debugFields();paint();}
async function sync(){if(loading||playing||(!treeId)||sandbox)return;loading=true;try{const data=await api('/'+treeId),initial=!record;record=data;offset=data.serverNow-Date.now();$('copy').hidden=false;$('retry').hidden=true;status();if(debug){resetSandbox();$('debug').hidden=false;}if(initial)replay();else paint();}catch(e){status(e.message||'暂时无法连接');$('retry').hidden=false;}finally{loading=false;}}
$('retry').onclick=sync;
const claimId=crypto.randomUUID();
$('claim').onclick=async()=>{
 $('claim').disabled=true;status();
 try{
  const data=await api('',{id:claimId});
  treeId=data.id;record=data;offset=data.serverNow-Date.now();
  history.pushState(null,'','/t/'+treeId+(debug?'?debug=1':''));
  $('welcome').hidden=true;$('copy').hidden=false;$('new-tree').hidden=false;$('exit').href='/t/'+treeId;
  document.body.classList.remove('home');
  // Keep the actual SVG in place: no navigation, camera reset or seed replay.
  // The next ordinary sync continues growth from the newly persisted record.
 }catch(e){status(e.message||'暂时无法认领，请重试');$('claim').disabled=false;}
};
// Back/forward opens the corresponding page with its normal initialization.
window.addEventListener('popstate',()=>location.reload());
const copyIcon=$('copy').innerHTML;let copiedTimer;
$('copy').onclick=async()=>{const url=location.origin+'/t/'+record.id;try{await navigator.clipboard.writeText(url);status();$('copy').innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';$('copy').setAttribute('aria-label','链接已复制');clearTimeout(copiedTimer);copiedTimer=setTimeout(()=>{$('copy').innerHTML=copyIcon;$('copy').setAttribute('aria-label','复制链接');},1800);}catch{status('未能复制，请保存地址栏链接：'+url);}};
for(const p of PRESETS)$('preset').add(new Option(p.name,p.id));for(const l of LOOKS)$('look').add(new Option(l.name,l.id));
function changeSample(){if(!sandbox)return;stop();const pot=sandbox.config.pot;sandbox.config=normalize({...sandbox.config,preset:$('preset').value,seed:$('seed').value,appearance:LOOKS.find(l=>l.id===$('look').value)});if(pot)sandbox.config.pot=pot;sandbox.cuts=[];paint();}
$('preset').onchange=changeSample;$('look').onchange=changeSample;$('seed').onchange=changeSample;
$('random').onclick=()=>{$('seed').value=crypto.randomUUID();changeSample();};
$('time').oninput=()=>{stop();hours=Number($('time').value);paint();};
document.querySelectorAll('[data-hours]').forEach(button=>button.onclick=()=>{stop();hours+=Number(button.dataset.hours);debugFields();paint();});
$('replay').onclick=replay;$('reset').onclick=async()=>{if(treeId){try{record=await api('/'+treeId);offset=record.serverNow-Date.now();status();}catch(e){status(e.message);return;}}resetSandbox();};
$('exit').href=location.pathname;
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});setInterval(()=>{if(!document.hidden)sync();},15000);
document.body.classList.toggle('debug-mode',debug);document.body.classList.toggle('home',!treeId);
$('new-tree').hidden=!treeId;
if(treeId)await sync();else{record={version:VERSION,createdAt:Date.now(),config:configForClaim(claimId),cuts:[]};$('welcome').hidden=false;if(debug){resetSandbox();$('debug').hidden=false;}replay();}
