import {WATER_CAPACITY,WATER_GROWTH_PER_TANK,WATER_RECOVERY_HOURS_PER_TANK} from './watering-motion.mjs';
import {PRESETS,normalize} from './core/v1/canopy.mjs';
import {LOOKS,lookFor} from './core/v1/appearance.mjs';
import {grow,snapshot,HOUR} from './growth.mjs';

export const MAX_CHEAT_HOURS=24*365*100;
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const validHour=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=MAX_CHEAT_HOURS;
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};

export function cheatRequest(record,hours){
 return {revision:record.revision??0,preset:record.config.preset,seed:record.config.seed,
  look:lookFor(record.config.appearance)?.id??null,hours,
  waterings:(record.waterings??[]).map(w=>({id:w.id,used:w.used,recoveryHours:w.recoveryHours??0,hour:(w.at-record.createdAt)/HOUR})),
  cuts:(record.cuts??[]).map(c=>({id:c.id,branchId:c.branchId,hour:(c.at-record.createdAt)/HOUR}))};
}

// Rebase the preview's whole timeline together, so saved cuts and growth agree.
export function applyCheat(record,body,at){
 if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'无效作弊请求');
 if(!Number.isSafeInteger(body.revision)||body.revision<0)fail(400,'无效版本');
 if(body.revision!==(record.revision??0))fail(409,'这棵树已更新，请先重新载入已保存状态');
 if(!PRESETS.some(p=>p.id===body.preset)||typeof body.seed!=='string'||body.seed.length>64||!validHour(body.hours))fail(400,'无效树形、种子或生长时间');
 const look=LOOKS.find(l=>l.id===body.look);
 if(!look&&body.look!==null)fail(400,'无效外观');
 if(!Array.isArray(body.cuts)||body.cuts.length>64)fail(400,'无效剪枝记录');
 const config={...record.config,...normalize({...record.config,preset:body.preset,seed:body.seed,appearance:look??record.config.appearance})};
 const createdAt=at-body.hours*HOUR;
 const branches=new Set(grow({config,cuts:[]},1).nodes.filter(n=>n.role==='primary').map(n=>n.id));
 const ids=new Set(),cuts=body.cuts.map((cut,i)=>{
  if(!cut||!uuid(cut.id)||ids.has(cut.id)||typeof cut.branchId!=='string'||cut.branchId.length>100||!validHour(cut.hour))fail(400,'无效剪枝记录');
  ids.add(cut.id);
  return {id:cut.id,seq:i+1,branchId:cut.branchId,at:createdAt+cut.hour*HOUR};
 });
 // Regrown branches are created by earlier cuts, so validate their identities
 // against that history (including future cuts kept by a rewound preview).
 const rawWater=body.waterings??(record.waterings??[]).map(w=>({id:w.id,used:w.used,hour:(w.at-record.createdAt)/HOUR}));
 if(!Array.isArray(rawWater)||rawWater.length>256)fail(400,'无效浇水记录');
 const waterIds=new Set(),waterings=rawWater.map(w=>{
  if(!w||!uuid(w.id)||waterIds.has(w.id)||!Number.isFinite(w.used)||w.used<=0||w.used>WATER_CAPACITY+.01||!validHour(w.hour))fail(400,'无效浇水记录');
  if(!Number.isFinite(w.recoveryHours??0)||(w.recoveryHours??0)<0||(w.recoveryHours??0)>Math.min(w.used,WATER_CAPACITY)/WATER_CAPACITY*WATER_RECOVERY_HOURS_PER_TANK+1e-8)fail(400,'无效恢复生长记录');
  const previous=(record.waterings??[]).find(old=>old.id===w.id&&old.used===w.used);
  waterIds.add(w.id);return {id:w.id,used:w.used,recoveryHours:w.recoveryHours??0,at:createdAt+w.hour*HOUR,amount:previous?.amount??Math.min(w.used,WATER_CAPACITY)/WATER_CAPACITY*WATER_GROWTH_PER_TANK};
 });
 const history={config,createdAt,cuts:[],waterings};
 for(const cut of [...cuts].sort((a,b)=>a.at-b.at||a.seq-b.seq)){
  if(!branches.has(cut.branchId)&&!snapshot(history,cut.at).nodes.some(n=>n.id===cut.branchId&&n.role==='primary'&&n.growth>0))fail(400,'无效剪枝记录');
  history.cuts.push(cut);
 }
 return {...record,config,createdAt,cuts,waterings,revision:(record.revision??0)+1};
}
