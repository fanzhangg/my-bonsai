import {snapshot,draw,HOUR,VERSION,wateringRecovery} from './growth.mjs';
import {replayFrame,REPLAY_MS} from './playback.mjs';
import {LOOKS,lookFor} from './core/v1/appearance.mjs';
import {PRESETS,normalize} from './core/v1/canopy.mjs';
import {configForClaim} from './claim.mjs';
import {cheatRequest,MAX_CHEAT_HOURS} from './cheats.mjs';
import {startWeather} from './weather.mjs';
import {startWind} from './wind.mjs';
import {createVisitors} from './visitors.mjs';
import {createWatering} from './watering.mjs';
import {WATER_CAPACITY,WATER_GROWTH_PER_TANK} from './watering-motion.mjs';
import {createPruning} from './pruning.mjs';
import {toolHome} from './tool-home.mjs';
import {createSharing} from './share.mjs';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),debug=params.has('cheat')||params.has('debug');
const visitors=createVisitors({scene:$('insect-layer'),treeElement:$('stage'),layer:$('insect-layer')});
const weather=startWeather({debug,onSceneChange:scene=>visitors.setMode(scene.night?'night':'day')});
const wind=startWind($('stage'));
let treeId=location.pathname.match(/^\/t\/([^/]+)$/)?.[1];
let sharing;
let record,sandbox,offset=0,hours=0,playing=false,timer,loading=false,dirty=false;
let pendingWater=0,pendingRecovery=0,recoveryRate=0;const waterQueue=[];let waterSave=null;
let visitPending=true,visitInFlight=false;
async function recordVisit(){
 if(!treeId||document.hidden||!visitPending||visitInFlight)return;
 visitInFlight=true;visitPending=false;
 try{await api('/'+treeId+'/visits',{});}catch{visitPending=true;}
 finally{visitInFlight=false;}
}
function cheatControls(busy=pruning.busy||watering.busy){
 $('debug').querySelectorAll('button,input,select').forEach(el=>el.disabled=busy||loading);
 $('save-cheat').disabled=busy||loading||!treeId||!dirty;
 $('claim').disabled=busy||loading;
 $('regenerate').disabled=busy||loading;
 $('share').disabled=busy||loading;
 if(!busy&&!loading)void sharing?.prepare();
}
function cheatStatus(text){$('cheat-status').textContent=text;cheatControls();}
function changed(){dirty=true;cheatStatus(treeId?'有未保存的修改':'认领时会保存当前样本');}
const pruning=createPruning({
 scene:$('live-pruning'),treeElement:$('stage'),tool:$('pruning-scissors'),message:$('pruning-message'),
 onBusyChange:busy=>{wind.setPaused(busy);visitors.setActive(!busy);watering.setActive(!busy&&!loading&&!playing&&Boolean(record&&(treeId||sandbox)));cheatControls(busy);},
 onCommit:async branchId=>{
  if(sandbox){sandbox.cuts.push({id:crypto.randomUUID(),seq:sandbox.cuts.length+1,at:now(),branchId});changed();return;}
  const body={id:crypto.randomUUID(),branchId};
  let data;
  // A network retry must reuse the same operation ID: never cut twice.
  try{data=await api('/'+treeId+'/cuts',body);}catch(error){
   if(error.httpStatus)throw error;
   data=await api('/'+treeId+'/cuts',body);
  }
  record=data;offset=data.serverNow-Date.now();status();
 },
 onError:error=>{status(error.message||'剪枝暂时无法保存，请稍后再试');$('retry').hidden=false;},
 onSettled:()=>paint()
});
function waterSnapshot(){
 const data=sandbox||record;if(!data)return null;
 const at=sandbox?sandbox.createdAt+hours*HOUR:Date.now()+offset;
 return snapshot({...data,waterings:[...(data.waterings??[]),{at,amount:pendingWater/WATER_CAPACITY*WATER_GROWTH_PER_TANK,recoveryHours:pendingRecovery}]},at);
}
function renderWaterTree(){
 const tree=waterSnapshot();if(!tree)return null;
 $('stage').innerHTML=draw(tree,{transparent:true,viewBox:{x:tree.root.x-300,y:tree.root.y-420,width:640,height:620}});
 weather.setTree(tree);return tree;
}
async function flushWater(){
 if(waterSave)return waterSave;
 waterSave=(async()=>{
  while(waterQueue.length){const body=waterQueue[0];let data;
   try{data=await api('/'+treeId+'/waterings',body);}catch(error){if(error.httpStatus)throw error;data=await api('/'+treeId+'/waterings',body);}
   record=data;offset=data.serverNow-Date.now();pendingWater=Math.max(0,pendingWater-body.used);pendingRecovery=Math.max(0,pendingRecovery-(body.recoveryHours??0));waterQueue.shift();
  }
 })();
 try{await waterSave;}finally{waterSave=null;}
}
const watering=createWatering({scene:$('live-watering'),holder:$('stage'),can:$('watering-can'),water:$('watering-water'),status:$('watering-status'),renderTree:renderWaterTree,
 getHome:scene=>toolHome(scene,190),
 onDose:used=>{if(pendingWater===0)recoveryRate=wateringRecovery(waterSnapshot(),4000)/4000;pendingWater+=used;pendingRecovery+=used*recoveryRate;},
 onFinish:async used=>{
  if(sandbox){sandbox.waterings??=[];sandbox.waterings.push({id:crypto.randomUUID(),at:now(),amount:used/WATER_CAPACITY*WATER_GROWTH_PER_TANK,recoveryHours:used*recoveryRate,used});pendingWater=Math.max(0,pendingWater-used);pendingRecovery=Math.max(0,pendingRecovery-used*recoveryRate);changed();return;}
  waterQueue.push({id:crypto.randomUUID(),used,recoveryHours:used*recoveryRate});await flushWater();
 },
 onBusyChange:busy=>{wind.setPaused(busy);visitors.setActive(!busy);pruning.setActive(!busy&&!loading&&!playing&&Boolean(record&&(treeId||sandbox)));cheatControls(busy);if(!busy&&record)paint(waterSnapshot());},
 onError:error=>{status(error.message||'浇水暂时无法保存，请重试');$('retry').hidden=false;}
});
function pruningAvailability(){
 const available=Boolean(record&&(treeId||sandbox)&&!playing);
 $('live-pruning').hidden=!available;
 $('pruning-scissors').disabled=loading;
 pruning.setActive(available&&!loading&&!watering.busy);
 $('live-watering').hidden=!available;$('watering-can').disabled=loading||pruning.busy;
 watering.setActive(available&&!loading&&!pruning.busy);
}
const current=()=>sandbox||record;
const now=()=>sandbox?sandbox.createdAt+hours*HOUR:Date.now()+offset;
function status(text=''){$('status').textContent=text;$('status').hidden=!text;}
async function api(path,body){const r=await fetch('/api/trees'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});const data=await r.json();if(!r.ok)throw Object.assign(new Error(data.error),{httpStatus:r.status});return data;}
function paint(tree=snapshot(current(),now())){if(pruning.busy)return;weather.setTree(tree);$('stage').innerHTML=draw(tree,{transparent:true,viewBox:{x:tree.root.x-300,y:tree.root.y-420,width:640,height:620}});pruning.refresh(tree);watering.refresh(tree);pruningAvailability();wind.refresh();visitors.refresh();visitors.setActive(true);if(debug){$('age').textContent=`${hours.toFixed(1)} 小时`;$('info').textContent=`${record.id||'未认领样本'}\n${VERSION}\n成熟需 ${tree.matureDays.toFixed(1)} 天 · 生长 ${(tree.progress*100).toFixed(1)}% · 枝段 ${tree.nodes.length} · 叶团 ${tree.clusters.filter(c=>tree.hour>c.born).length}\n${playing?'回放中':'静止预览'}`;}}
function stop(){clearTimeout(timer);playing=false;}
function replay(){stop();const data=structuredClone(current()),end=now(),start=performance.now();if(matchMedia('(prefers-reduced-motion: reduce)').matches){paint();return;}playing=true;const frame=()=>{const p=Math.min(1,(performance.now()-start)/REPLAY_MS);paint(replayFrame(data,end,p));if(p<1)timer=setTimeout(frame,70);else{stop();paint();}};frame();}
function debugFields(){$('preset').value=sandbox.config.preset;$('look').value=lookFor(sandbox.config.appearance)?.id||'original';$('seed').value=sandbox.config.seed;$('time').max=Math.max(168,Math.ceil(hours));$('time').value=hours;}
function resetSandbox(){stop();sandbox=structuredClone(record);hours=Math.max(0,(Date.now()+offset-record.createdAt)/HOUR);dirty=false;debugFields();paint();cheatStatus(treeId?'已载入保存的状态':'调整后的样本会随认领保存');}
async function sync(){if(loading||playing||pruning.busy||watering.busy||waterQueue.length||(!treeId)||sandbox)return;loading=true;pruningAvailability();try{const data=await api('/'+treeId),initial=!record;record=data;offset=data.serverNow-Date.now();void recordVisit();$('share').hidden=false;$('retry').hidden=true;status();if(debug){resetSandbox();$('debug').hidden=false;}if(initial)replay();else paint();}catch(e){status(e.message||'暂时无法连接');$('retry').hidden=false;}finally{loading=false;cheatControls();pruningAvailability();}}
$('retry').onclick=async()=>{try{await flushWater();status();$('retry').hidden=true;await sync();}catch(e){status(e.message||'暂时无法保存，请重试');}};
let claimId=crypto.randomUUID();
function showPreview(){
 stop();sandbox=undefined;offset=0;hours=0;dirty=false;
 record={version:VERSION,createdAt:Date.now(),config:configForClaim(claimId),cuts:[]};
 $('welcome').hidden=false;$('regenerate').hidden=false;status();
 if(debug){resetSandbox();$('debug').hidden=false;}
 replay();
}
$('regenerate').onclick=()=>{
 if(treeId||loading||pruning.busy||watering.busy)return;
 claimId=crypto.randomUUID();showPreview();
};
$('claim').onclick=async()=>{
 if(loading||pruning.busy||watering.busy)return;
 loading=true;cheatControls();pruningAvailability();status();
 try{
  const data=await api('',{id:claimId,...(sandbox?{cheat:cheatRequest(sandbox,hours)}:{})});
  treeId=data.id;record=data;offset=data.serverNow-Date.now();
  void recordVisit();
  history.pushState(null,'','/t/'+treeId+(debug?'?cheat=1':''));
  $('welcome').hidden=true;$('regenerate').hidden=true;$('share').hidden=false;$('new-tree').hidden=false;$('exit').href='/t/'+treeId;
  document.body.classList.remove('home');
  if(debug)resetSandbox();
  pruningAvailability();
  // Keep the actual SVG in place: no navigation, camera reset or seed replay.
  // The next ordinary sync continues growth from the newly persisted record.
 }catch(e){status(e.message||'暂时无法认领，请重试');}
 finally{loading=false;cheatControls();pruningAvailability();}
};
// Back/forward opens the corresponding page with its normal initialization.
window.addEventListener('popstate',()=>location.reload());
sharing=createSharing({button:$('share'),getRecord:()=>record,onStatus:status});
for(const p of PRESETS)$('preset').add(new Option(p.name,p.id));for(const l of LOOKS)$('look').add(new Option(l.name,l.id));
function changeSample(){if(!sandbox)return;stop();const geometryChanged=sandbox.config.preset!==$('preset').value||sandbox.config.seed!==$('seed').value;const pot=sandbox.config.pot;sandbox.config=normalize({...sandbox.config,preset:$('preset').value,seed:$('seed').value,appearance:LOOKS.find(l=>l.id===$('look').value)});if(pot)sandbox.config.pot=pot;if(geometryChanged)sandbox.cuts=[];changed();paint();}
$('preset').onchange=changeSample;$('look').onchange=changeSample;$('seed').onchange=changeSample;
$('random').onclick=()=>{$('seed').value=crypto.randomUUID();changeSample();};
$('time').oninput=()=>{stop();hours=Number($('time').value);changed();paint();};
document.querySelectorAll('[data-hours]').forEach(button=>button.onclick=()=>{stop();hours=Math.min(MAX_CHEAT_HOURS,hours+Number(button.dataset.hours));changed();debugFields();paint();});
$('replay').onclick=replay;
$('reset').onclick=async()=>{
 if(loading||pruning.busy)return;
 loading=true;stop();cheatControls();pruningAvailability();
 try{if(treeId){record=await api('/'+treeId);offset=record.serverNow-Date.now();}status();resetSandbox();}
 catch(e){cheatStatus(e.message||'暂时无法载入，请重试');}
 finally{loading=false;cheatControls();pruningAvailability();}
};
$('save-cheat').onclick=async()=>{
 if(loading||pruning.busy||!treeId||!dirty)return;
 loading=true;stop();cheatStatus('正在保存…');pruningAvailability();
 try{
  record=await api('/'+treeId+'/cheats',cheatRequest(sandbox,hours));offset=record.serverNow-Date.now();
  resetSandbox();status();cheatStatus('已保存，刷新或退出作弊模式后仍会保留');
 }catch(e){cheatStatus(e.httpStatus?e.message:'暂时无法确认保存结果，请重试保存；若提示已更新，请重新载入已保存状态');}
 finally{loading=false;cheatControls();pruningAvailability();}
};
window.addEventListener('beforeunload',event=>{if(dirty||pendingWater>0){event.preventDefault();event.returnValue='';}});
$('exit').href=location.pathname;
document.addEventListener('visibilitychange',()=>{if(!document.hidden){visitPending=true;if(record)void recordVisit();sync();}});setInterval(()=>{if(!document.hidden)sync();},15000);
document.body.classList.toggle('debug-mode',debug);document.body.classList.toggle('home',!treeId);
$('new-tree').hidden=!treeId;
if(treeId)await sync();else showPreview();
