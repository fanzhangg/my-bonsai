import {snapshot,draw,HOUR,VERSION,wateringRecovery,applicationFrame} from './growth.mjs';
import {replayFrame,REPLAY_MS} from './playback.mjs';
import {LOOKS,lookFor} from './core/v1/appearance.mjs';
import {PRESETS,normalize} from './core/v1/canopy.mjs';
import {configForClaim} from './claim.mjs';
import * as runtime from '/runtime-config.mjs';
import {treeVersion,CURRENT_VERSION,LEGACY_VERSION} from './tree-versions.mjs';
import {FORMS,CROWNS,LEAVES,PALETTES} from './core/v3/bonsai-language.mjs';
import {normalizeDesign} from './core/v3/config.mjs';
import {NATURAL_GROWTH} from './core/v3/natural-growth.mjs';
import {cheatRequest,MAX_CHEAT_HOURS,futureOperations,branchTimeline} from './cheats.mjs';
import {canPrune,CUT_MODEL} from './pruning-model.mjs';
import {growthStatus} from './growth-status.mjs';
import {startWeather} from './weather.mjs';
import {startWind} from './wind.mjs';
import {createVisitors} from './visitors.mjs';
import {createWatering} from './watering.mjs';
import {WATER_CAPACITY,wateringAmount} from './watering-motion.mjs';
import {createPruning} from './pruning.mjs';
import {toolHome} from './tool-home.mjs';
import {createSharing} from './share.mjs';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),debug=params.has('cheat')||params.has('debug');
const newTreeVersion=runtime.newTreeVersion??LEGACY_VERSION;
const visitors=createVisitors({scene:$('insect-layer'),treeElement:$('stage'),layer:$('insect-layer')});
const weather=startWeather({debug,onSceneChange:scene=>visitors.setMode(scene.night?'night':'day')});
const wind=startWind($('stage'));
let treeId=location.pathname.match(/^\/t\/([^/]+)$/)?.[1];
let sharing;
let record,sandbox,offset=0,hours=0,playing=false,timer,loading=false,dirty=false;
let draftUndo=null;

function rememberDraft(){if(sandbox)draftUndo={record:structuredClone(sandbox),hours};}
let pendingWater=0,pendingRecovery=0,recoveryRate=0;const waterQueue=[];let waterSave=null;
let visitPending=true,visitInFlight=false;
async function recordVisit(){
 if(!treeId||document.hidden||!visitPending||visitInFlight)return;
 visitInFlight=true;visitPending=false;
 try{await api('/'+treeId+'/visits',{});}catch{visitPending=true;}
 finally{visitInFlight=false;}
}
function cheatControls(busy=pruning.busy||watering.busy||playing){
 $('debug').querySelectorAll('button,input,select').forEach(el=>el.disabled=busy||loading);
 $('save-cheat').disabled=busy||loading||!treeId||!dirty;
 $('undo-draft').disabled=busy||loading||!draftUndo;
 $('claim').disabled=busy||loading;
 $('claim-name').disabled=loading;
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
  if(sandbox){rememberDraft();sandbox.cuts.push({id:crypto.randomUUID(),seq:sandbox.cuts.length+1,at:now(),branchId,...(treeVersion(sandbox)===CURRENT_VERSION?{model:CUT_MODEL}:{})});changed();return;}
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
 return snapshot({...data,waterings:[...(data.waterings??[]),{at,amount:pendingWater/WATER_CAPACITY*wateringAmount(WATER_CAPACITY,data.wateringRules),recoveryHours:pendingRecovery}]},at);
}
function renderWaterTree(){
 const tree=waterSnapshot();if(!tree)return null;
 $('stage').innerHTML=draw(tree,{transparent:true,viewBox:applicationFrame(tree)});
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
 onDose:used=>{if(pendingWater===0)recoveryRate=wateringRecovery(waterSnapshot(),WATER_CAPACITY,(sandbox||record).wateringRules)/WATER_CAPACITY;pendingWater+=used;pendingRecovery+=used*recoveryRate;},
 onFinish:async used=>{
  if(sandbox){rememberDraft();sandbox.waterings??=[];sandbox.waterings.push({id:crypto.randomUUID(),at:now(),amount:wateringAmount(used,sandbox.wateringRules),recoveryHours:used*recoveryRate,used});pendingWater=Math.max(0,pendingWater-used);pendingRecovery=Math.max(0,pendingRecovery-used*recoveryRate);changed();return;}
  waterQueue.push({id:crypto.randomUUID(),used,recoveryHours:used*recoveryRate});await flushWater();
 },
 onBusyChange:busy=>{wind.setPaused(busy);visitors.setActive(!busy);pruning.setActive(!busy&&!loading&&!playing&&Boolean(record&&(treeId||sandbox)));cheatControls(busy);if(!busy&&record)paint(waterSnapshot());},
 onError:error=>{status(error.message||'浇水暂时无法保存，请重试');$('retry').hidden=false;}
});
function pruningAvailability(){
 const available=Boolean(record&&(treeId||sandbox)&&!playing&&!(sandbox&&futureOperations(sandbox,now())));
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
function showName(){const name=treeId?(record?.name??''):$('claim-name').value.trim();$('tree-name').textContent=name;$('tree-name').hidden=!name;}
$('claim-name').addEventListener('input',showName);
function paint(tree=snapshot(current(),now())){
 showName();
 if(pruning.busy)return;weather.setTree(tree);$('stage').innerHTML=draw(tree,{transparent:true,viewBox:applicationFrame(tree)});
 pruning.refresh(tree);watering.refresh(tree);pruningAvailability();wind.refresh();visitors.refresh();visitors.setActive(true);
 if(debug){
  $('age').textContent=`${hours.toFixed(1)} 小时`;
  const future=futureOperations(current(),now()),first=tree.nodes.filter(n=>canPrune(n)&&n.pruningLevel!==2).length,second=tree.nodes.filter(n=>canPrune(n)&&n.pruningLevel===2).length;
  $('timeline-note').textContent=future?`当前时刻之后还有 ${future} 次剪枝或浇水。回看不改变历史；要在此处重新修剪，请先从这里继续。`:'剪枝与浇水作用于当前预览时刻；快进可观察局部恢复。';
  $('branch-timeline').hidden=!future;
  $('growth-summary').textContent=`可剪一级侧枝 ${first} 根${tree.engineVersion===CURRENT_VERSION?` · 二级侧枝 ${second} 根`:''} · ${growthStatus(tree)}`;
  $('info').textContent=`${record.id||'未认领样本'}\n${current().version??VERSION}\n基础树形成熟 ${(tree.progress*100).toFixed(1)}% · 剪枝历史 ${current().cuts.length} 次\n${playing?'当前树形回放中':'预览已暂停，快进时间继续生长'}`;
 }
}
function stop(){clearTimeout(timer);playing=false;cheatControls();}
function replay(){stop();const data=structuredClone(current()),end=now(),start=performance.now();if(matchMedia('(prefers-reduced-motion: reduce)').matches){paint();return;}playing=true;cheatControls();const frame=()=>{const p=Math.min(1,(performance.now()-start)/REPLAY_MS);paint(replayFrame(data,end,p));if(p<1)timer=setTimeout(frame,70);else{stop();paint();}};frame();}
function debugFields(){designFields();$('preset').value=sandbox.config.preset;$('look').value=lookFor(sandbox.config.appearance)?.id||'original';$('seed').value=sandbox.config.seed;$('time').max=Math.min(MAX_CHEAT_HOURS,Math.max(168,Math.ceil(hours),...(sandbox.cuts??[]).map(c=>Math.ceil((c.at-sandbox.createdAt)/HOUR)),...(sandbox.waterings??[]).map(c=>Math.ceil((c.at-sandbox.createdAt)/HOUR))));$('time').value=hours;}
function resetSandbox(){stop();sandbox=structuredClone(record);draftUndo=null;hours=Math.max(0,(Date.now()+offset-record.createdAt)/HOUR);dirty=false;debugFields();paint();cheatStatus(treeId?'已载入保存的状态':'调整后的样本会随认领保存');}
async function sync(){if(loading||playing||pruning.busy||watering.busy||waterQueue.length||(!treeId)||sandbox)return;loading=true;pruningAvailability();try{const data=await api('/'+treeId),initial=!record;record=data;offset=data.serverNow-Date.now();void recordVisit();$('share').hidden=false;$('retry').hidden=true;status();if(debug){resetSandbox();$('debug').hidden=false;}if(initial)replay();else paint();}catch(e){status(e.message||'暂时无法连接');$('retry').hidden=false;}finally{loading=false;cheatControls();pruningAvailability();}}
$('retry').onclick=async()=>{try{await flushWater();status();$('retry').hidden=true;await sync();}catch(e){status(e.message||'暂时无法保存，请重试');}};
let claimId=crypto.randomUUID();
function showPreview(){
 stop();sandbox=undefined;offset=0;hours=0;dirty=false;
 record={version:newTreeVersion,createdAt:Date.now(),config:configForClaim(claimId,newTreeVersion,runtime.newGrowthPolicy),cuts:[]};
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
 if([...$('claim-name').value.trim()].length>30){status('盆栽名称最多 30 个字符');$('claim-name').focus();return;}
 loading=true;cheatControls();pruningAvailability();status();
 try{
  const data=await api('',{id:claimId,name:$('claim-name').value.trim(),version:record.version,growthPolicy:record.config.growthPolicy,...(sandbox?{cheat:cheatRequest(sandbox,hours)}:{})});
  treeId=data.id;record=data;showName();offset=data.serverNow-Date.now();
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
function designFields(){
 const modern=treeVersion(sandbox)===CURRENT_VERSION;$('design-controls').hidden=!modern;$('look').closest('label').hidden=modern;
 if(!modern)return;
 const c=sandbox.config,form=FORMS.find(f=>f.id===c.preset);
 for(const [key,items]of [['crown',form.crowns.map(id=>[id,CROWNS[id].name])],['leaf',form.leaves.map(id=>[id,LEAVES[id]])],['palette',Object.entries(PALETTES).map(([id,p])=>[id,p.name])]]){
  const el=$('design-'+key);el.replaceChildren(...items.map(([id,name])=>new Option(name,id)));el.value=c[key];
 }
 $('design-variation').value=c.variation;$('design-density').value=c.density;
}
function changeSample(){
 if(!sandbox)return;stop();rememberDraft();const before=sandbox.config,modern=treeVersion(sandbox)===CURRENT_VERSION;
 const geometryChanged=before.preset!==$('preset').value||before.seed!==$('seed').value;
 if(modern){
  sandbox.config=normalizeDesign({...before,preset:$('preset').value,seed:$('seed').value,
   crown:$('design-crown').value,leaf:$('design-leaf').value,palette:$('design-palette').value,
   variation:Number($('design-variation').value),density:Number($('design-density').value)});
 }else{const pot=before.pot;sandbox.config=normalize({...before,preset:$('preset').value,seed:$('seed').value,appearance:LOOKS.find(l=>l.id===$('look').value)});if(pot)sandbox.config.pot=pot;}
 if(geometryChanged||(modern&&(before.variation!==sandbox.config.variation||before.density!==sandbox.config.density))){sandbox.cuts=[];if(modern)sandbox.config.growthPolicy=NATURAL_GROWTH;}
 designFields();changed();paint();
}
for(const key of ['crown','leaf','palette','variation','density'])$('design-'+key).onchange=changeSample;
$('preset').onchange=changeSample;$('look').onchange=changeSample;$('seed').onchange=changeSample;
$('random').onclick=()=>{$('seed').value=crypto.randomUUID();changeSample();};
$('time').oninput=()=>{stop();rememberDraft();hours=Number($('time').value);changed();paint();};
document.querySelectorAll('[data-hours]').forEach(button=>button.onclick=()=>{stop();rememberDraft();hours=Math.min(MAX_CHEAT_HOURS,hours+Number(button.dataset.hours));changed();debugFields();paint();});
$('branch-timeline').onclick=()=>{stop();rememberDraft();sandbox=branchTimeline(sandbox,now());changed();debugFields();paint();cheatStatus('已移除这个时刻之后的操作，接下来的生长会按当前树形重新推演。可撤回。');};
$('undo-draft').onclick=()=>{if(!draftUndo)return;stop();sandbox=draftUndo.record;hours=draftUndo.hours;draftUndo=null;changed();debugFields();paint();};
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
