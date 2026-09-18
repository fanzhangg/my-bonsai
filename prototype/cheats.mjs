import {WATER_CAPACITY,WATER_GROWTH_PER_TANK,WATER_RECOVERY_HOURS_PER_TANK} from './watering-motion.mjs';
import {PRESETS,normalize} from './core/v1/canopy.mjs';
import {LOOKS,lookFor} from './core/v1/appearance.mjs';
import {grow,snapshot,HOUR} from './growth.mjs';
import {treeVersion,CURRENT_VERSION} from './tree-versions.mjs';
import {validateDesign} from './core/v3/config.mjs';
import {canPrune,CUT_MODELS} from './pruning-model.mjs';

export const MAX_CHEAT_HOURS=24*365*100;
export const MAX_CHEAT_CUTS=4096;
export function futureOperations(record,at){return (record.cuts??[]).filter(e=>e.at>at).length+(record.waterings??[]).filter(e=>e.at>at).length;}
// Browsing the past preserves history. An explicit new action forks it.
export function branchTimeline(record,at){return {...record,cuts:(record.cuts??[]).filter(e=>e.at<=at),waterings:(record.waterings??[]).filter(e=>e.at<=at)};}
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const validHour=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=MAX_CHEAT_HOURS;
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};

export function cheatRequest(record,hours){
 return {revision:record.revision??0,preset:record.config.preset,seed:record.config.seed,
  look:lookFor(record.config.appearance)?.id??null,hours,
  ...(treeVersion(record)===CURRENT_VERSION?{design:Object.fromEntries(['crown','leaf','palette','variation','density','growthPolicy'].map(key=>[key,record.config[key]]))}:{}),
  waterings:(record.waterings??[]).map(w=>({id:w.id,used:w.used,recoveryHours:w.recoveryHours??0,hour:(w.at-record.createdAt)/HOUR})),
  cuts:(record.cuts??[]).map(c=>({id:c.id,branchId:c.branchId,hour:(c.at-record.createdAt)/HOUR,...(c.model?{model:c.model}:{})}))};
}

// Rebase the preview's whole timeline together, so saved cuts and growth agree.
export function applyCheat(record,body,at){
 if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'无效作弊请求');
 if(!Number.isSafeInteger(body.revision)||body.revision<0)fail(400,'无效版本');
 if(body.revision!==(record.revision??0))fail(409,'这棵树已更新，请先重新载入已保存状态');
 if(!PRESETS.some(p=>p.id===body.preset)||typeof body.seed!=='string'||body.seed.length>64||!validHour(body.hours))fail(400,'无效树形、种子或生长时间');
 const look=LOOKS.find(l=>l.id===body.look);
 if(!look&&body.look!==null)fail(400,'无效外观');
 if(!Array.isArray(body.cuts)||body.cuts.length>MAX_CHEAT_CUTS)fail(400,'无效剪枝记录');
 const modern=treeVersion(record)===CURRENT_VERSION;
 const config=modern?validateDesign({...record.config,...body.design,preset:body.preset,seed:body.seed}):{...record.config,...normalize({...record.config,preset:body.preset,seed:body.seed,appearance:look??record.config.appearance})};
 const createdAt=at-body.hours*HOUR;
 const geometryChanged=record.config.preset!==config.preset||record.config.seed!==config.seed||(modern&&(record.config.variation!==config.variation||record.config.density!==config.density||record.config.growthPolicy!==config.growthPolicy));
 if(geometryChanged&&body.cuts.length)fail(400,'更换树形、种子或枝干参数后须清空剪枝记录');
 const branches=new Set(grow({version:record.version,config,cuts:[]},1).nodes.filter(n=>n.role==='primary').map(n=>n.id));
 const ids=new Set(),cuts=body.cuts.map((cut,i)=>{
  if(!cut||!uuid(cut.id)||ids.has(cut.id)||typeof cut.branchId!=='string'||cut.branchId.length>100||!validHour(cut.hour))fail(400,'无效剪枝记录');
  ids.add(cut.id);
  if(cut.model!==undefined&&!CUT_MODELS.includes(cut.model))fail(400,'无效剪枝算法');
  return {id:cut.id,seq:i+1,branchId:cut.branchId,at:createdAt+cut.hour*HOUR,...(cut.model?{model:cut.model}:{})};
 });
 // Regrown branches are created by earlier cuts, so validate their identities
 // against that history (including future cuts kept by a rewound preview).
 const rawWater=body.waterings??(record.waterings??[]).map(w=>({id:w.id,used:w.used,hour:(w.at-record.createdAt)/HOUR}));
 if(!Array.isArray(rawWater)||rawWater.length>256)fail(400,'无效浇水记录');
 const waterIds=new Set(),waterings=rawWater.map(w=>{
  const previous=(record.waterings??[]).find(old=>old.id===w?.id&&old.used===w?.used);
  if(!w||!uuid(w.id)||waterIds.has(w.id)||!Number.isFinite(w.used)||w.used<=0||(!previous&&w.used>WATER_CAPACITY+.01)||!validHour(w.hour))fail(400,'无效浇水记录');
  if(!Number.isFinite(w.recoveryHours??0)||(w.recoveryHours??0)<0||(w.recoveryHours??0)>Math.max(previous?.recoveryHours??0,Math.min(w.used,WATER_CAPACITY)/WATER_CAPACITY*WATER_RECOVERY_HOURS_PER_TANK)+1e-8)fail(400,'无效恢复生长记录');
  waterIds.add(w.id);return {id:w.id,used:w.used,recoveryHours:w.recoveryHours??0,at:createdAt+w.hour*HOUR,amount:previous?.amount??Math.min(w.used,WATER_CAPACITY)/WATER_CAPACITY*WATER_GROWTH_PER_TANK};
 });
 const history={version:record.version,config,createdAt,cuts:[],waterings};
 const originalCuts=[...(record.cuts??[])].sort((a,b)=>a.at-b.at||a.seq-b.seq);
 let unchangedPrefix=!geometryChanged;
 for(const cut of [...cuts].sort((a,b)=>a.at-b.at||a.seq-b.seq)){
  const old=originalCuts[history.cuts.length];
  unchangedPrefix=unchangedPrefix&&Boolean(old&&old.id===cut.id&&old.branchId===cut.branchId&&old.model===cut.model&&Math.abs((old.at-record.createdAt)-(cut.at-createdAt))<1);
  const relativeWater=(items,origin,until)=>items.filter(w=>w.at-origin<=until).map(w=>[w.id,w.at-origin,w.amount,w.recoveryHours??0]);
  const persisted=unchangedPrefix&&JSON.stringify(relativeWater(record.waterings??[],record.createdAt,cut.at-createdAt))===JSON.stringify(relativeWater(waterings,createdAt,cut.at-createdAt));
  if(modern&&!persisted&&!CUT_MODELS.includes(cut.model))fail(400,'新的剪枝记录需要当前生长算法');
  if(modern?!persisted&&!snapshot(history,cut.at).nodes.some(n=>n.id===cut.branchId&&canPrune(n)):!branches.has(cut.branchId)&&!snapshot(history,cut.at).nodes.some(n=>n.id===cut.branchId&&n.role==='primary'&&n.growth>0))fail(400,'无效剪枝记录');
  history.cuts.push(cut);
 }
 return {...record,config,createdAt,cuts,waterings,revision:(record.revision??0)+1};
}
