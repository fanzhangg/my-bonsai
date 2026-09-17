import * as legacy from './model.mjs';
import {StyleSimulation, DEFAULTS, VERSION, normalizeConfig, STYLES} from './style-model.mjs';
import {StyleSimulation as StyleV1, VERSION as V1, normalizeConfig as normalizeV1} from './style-model-v1.mjs';
export {DEFAULTS,VERSION,STYLES};
export const {MAX_HOUR,sample,growth,pointOn,affectedIds}=legacy;
export const versionFor=config=>config.style&&config.style!=='legacy'?(config.algorithmVersion===V1?V1:VERSION):legacy.VERSION;
export class Simulation {constructor(config=DEFAULTS,events=[]){const version=versionFor(config);return version===V1?new StyleV1(config,events):version===VERSION?new StyleSimulation(config,events):new legacy.Simulation(config,events);}}
export function validateScene(data){
  if(data?.version===legacy.VERSION)return legacy.validateScene(data);
  if(![VERSION,V1].includes(data?.version))throw new Error('场景版本不匹配');
  if(!data.config||typeof data.config.seed!=='string'||data.config.seed.length>64||!STYLES.includes(data.config.style))throw new Error('风格或种子无效');
  if(!Number.isFinite(data.hour)||data.hour<0||data.hour>MAX_HOUR||!Array.isArray(data.events)||data.events.length>1000)throw new Error('场景时间或事件数量无效');
  let last=-1;const ids=new Set();
  const events=data.events.map((e,i)=>{
    if(!e||typeof e.id!=='string'||ids.has(e.id)||typeof e.branch!=='string'||e.branch.length>1500||!Number.isFinite(e.at)||e.at<last||e.at<0||e.at>data.hour||e.at%.5!==0)throw new Error(`第 ${i+1} 个事件无效`);
    ids.add(e.id);last=e.at;return {id:e.id,branch:e.branch,actor:'A',at:e.at,seq:i+1};
  });
  const config={...(data.version===V1?normalizeV1(data.config):normalizeConfig(data.config)),algorithmVersion:data.version};
  new Simulation(config,events).at(data.hour);
  return {version:data.version,config,events,hour:Math.round(data.hour*2)/2};
}
export function pruneAt(scene,branch,at,id){
  if(scene.version===legacy.VERSION)return legacy.pruneAt(scene,branch,at,id);
  if(!Number.isFinite(at)||at<0||at>MAX_HOUR||at%.5!==0)throw new Error('无效模拟时间');
  const events=scene.events.filter(e=>e.at<=at).map(e=>({...e}));
  if(events.some(e=>e.id===id))throw new Error('重复事件 ID');
  events.push({id,branch,at,actor:'A',seq:events.length+1});
  return validateScene({version:scene.version,config:scene.config,events,hour:at});
}
