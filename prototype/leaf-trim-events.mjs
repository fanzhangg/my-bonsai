import {snapshot,HOUR} from './growth.mjs';
import {CURRENT_VERSION} from './tree-versions.mjs';
import {proposeTrim,trimEvent,trimState,acceptTrimProposal,TRIM_MODEL,TRIM_POINTS,TRIM_BATCH_LIMIT,ERASE_MODEL,ERASE_BATCH_POINTS,validEraseOperation,proposeErase,eraseEvent,SNIP_MODEL,SNIP_TARGET_LIMIT,validSnipOperation,proposeSnip} from './leaf-trim-model.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export function validTrimOperation(op){return op?.model===SNIP_MODEL?validSnipOperation(op):op?.model===ERASE_MODEL?validEraseOperation(op):op&&(!op.model||op.model===TRIM_MODEL)&&typeof op.crownId==='string'&&op.crownId.length<=256&&typeof op.clusterKey==='string'&&op.clusterKey.length<=256&&Number.isInteger(op.index)&&op.index>=0&&op.index<TRIM_POINTS&&[.015,.01,.005,.0025].includes(op.depth);}
const signature=ops=>JSON.stringify(ops.map(o=>o.model===SNIP_MODEL?[o.model,o.crownId,o.targets.map(t=>[t.clusterKey,t.index])]:o.model===ERASE_MODEL?[o.model,o.crownId,o.radius,o.points]:[o.crownId,o.clusterKey,o.index,o.depth]));
export function saveLeafTrims(old,body,at){
 if(!old)fail(404,'找不到这盆树');
 if(old.version!==CURRENT_VERSION)fail(409,'这棵树暂不支持修叶');
 if(!uuid(body.id)||!Number.isSafeInteger(body.revision)||!Array.isArray(body.operations)||!body.operations.length||body.operations.length>TRIM_BATCH_LIMIT||!body.operations.every(validTrimOperation))fail(400,'无效修叶请求');
 if(body.operations.reduce((n,o)=>n+(o.points?.length??0),0)>ERASE_BATCH_POINTS)fail(400,'修叶笔迹过长');
 if(body.operations.reduce((n,o)=>n+(o.targets?.length??0),0)>SNIP_TARGET_LIMIT)fail(400,'修叶记录过长');
 const existing=(old.leafTrims??[]).filter(e=>e.batchId===body.id);
 if(existing.length){if(signature(existing)!==signature(body.operations))fail(409,'修叶请求已使用');return old;}
 if(body.revision!==(old.revision??0))fail(409,'树的样子有变化，请重新载入并确认');
 if((old.leafTrims?.length??0)+body.operations.length>4096)fail(409,'修叶记录已满');
 const next={...old,leafTrims:[...(old.leafTrims??[])]},tree=snapshot(old,at);
 const state=trimState(tree,next,at);
 for(const [i,op]of body.operations.entries()){
  if(op.model===SNIP_MODEL){
   const proposal=proposeSnip(tree,op);if(!proposal)fail(409,'这层树冠已变化，请重新确认');
   next.leafTrims.push({...eraseEvent(proposal,at,`${body.id}:${i}`,next.leafTrims.length+1),batchId:body.id});continue;
  }
  if(op.model===ERASE_MODEL){
   const proposal=proposeErase(tree,op);if(!proposal)fail(409,'这层树冠已变化，请重新确认');
   next.leafTrims.push({...eraseEvent(proposal,at,`${body.id}:${i}`,next.leafTrims.length+1),batchId:body.id});continue;
  }
  const proposal=proposeTrim(tree,next,at,op,state);
  if(!proposal||proposal.depth!==op.depth)fail(409,'这处树冠已变化或达到修叶限制，请重新确认');
  next.leafTrims.push({...trimEvent(proposal,at,`${body.id}:${i}`,next.leafTrims.length+1),batchId:body.id});
  acceptTrimProposal(state,proposal);
 }
 return {...next,revision:(old.revision??0)+1,lastInteractedAt:at};
}

// Cheat edits may move an existing timeline but must not forge trim geometry.
export function rebaseLeafTrims(record,body,next,geometryChanged){
 const raw=body.leafTrims;
 if(raw===undefined)return geometryChanged?[]:(record.leafTrims??[]).map(e=>({...e,at:next.createdAt+e.at-record.createdAt}));
 if(!Array.isArray(raw)||raw.length>4096||(geometryChanged&&raw.some(e=>(record.leafTrims??[]).some(old=>old.id===e?.id))))fail(400,'更换树冠结构后须清空旧修叶记录');
 const ids=new Set(),history={...next,leafTrims:[]};let unchangedPrefix=!geometryChanged;
 for(const r of [...raw].sort((a,b)=>a.hour-b.hour||a.seq-b.seq)){
  if(!validTrimOperation(r)||typeof r.id!=='string'||r.id.length>80||ids.has(r.id)||![TRIM_MODEL,ERASE_MODEL,SNIP_MODEL].includes(r.model)||!Number.isFinite(r.hour)||r.hour<0||r.hour>24*365*100||(r.batchId!==undefined&&!uuid(r.batchId)))fail(400,'无效修叶记录');
  ids.add(r.id);const time=next.createdAt+r.hour*HOUR;
  const old=(record.leafTrims??[])[history.leafTrims.length];
  const relative=(items,origin)=>JSON.stringify(items.map(e=>({...e,at:e.at-origin})));
  const unchanged=unchangedPrefix&&old&&old.id===r.id&&old.batchId===r.batchId&&signature([old])===signature([r])&&Math.abs(old.at-record.createdAt-r.hour*HOUR)<1&&relative(record.cuts,record.createdAt)===relative(next.cuts,next.createdAt)&&relative(record.waterings??[],record.createdAt)===relative(next.waterings??[],next.createdAt);
  unchangedPrefix=Boolean(unchanged);
  let proposal=r;
  if(r.model===SNIP_MODEL){proposal=unchanged?old:proposeSnip(snapshot(history,time),r);if(!proposal)fail(400,'无效叶片位置');}
  else if(r.model===ERASE_MODEL){proposal=unchanged?old:proposeErase(snapshot(history,time),r);if(!proposal)fail(400,'无效树冠层级');}
  else if(!unchanged){const p=proposeTrim(snapshot(history,time),history,time,r);if(!p||p.depth!==r.depth)fail(400,'无效修叶位置或超过修叶限制');}
  const event={...(r.model===SNIP_MODEL?eraseEvent(proposal,time,r.id,history.leafTrims.length+1):r.model===ERASE_MODEL?eraseEvent({model:ERASE_MODEL,crownId:proposal.crownId,radius:proposal.radius,points:proposal.points,clusterKeys:proposal.clusterKeys},time,r.id,history.leafTrims.length+1):trimEvent(r,time,r.id,history.leafTrims.length+1)),...(r.batchId?{batchId:r.batchId}:{})};
  history.leafTrims.push(event);
 }
 return history.leafTrims;
}
