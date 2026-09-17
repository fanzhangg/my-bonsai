// One dispatch point for browser, API validation, gallery and share images.
import * as legacy from './core/v2/growth.mjs';
import {generate} from './core/v3/runtime.mjs';
import {render} from './core/v3/growing-render.mjs';
import {treeVersion,CURRENT_VERSION,LEGACY_VERSION} from './tree-versions.mjs';
import {applyRecovery,branchLevels} from './core/v3/regrowth.mjs';
export {HOUR,FRAME,profile,wateringProgress,wateringRecovery} from './core/v2/growth.mjs';
// Historical callers without an explicit version remain on v2.
export const VERSION=LEGACY_VERSION;
export function grow(record,p,options={}){
  if(options.generator)return legacy.grow(record,p,options);
  if(treeVersion(record)===LEGACY_VERSION)return legacy.grow(record,p,options);
  const at=options.at??Infinity,events=[...(record.cuts??[])].sort((a,b)=>a.at-b.at||a.seq-b.seq);
  const hasOldGenerations=events.some(c=>c.branchId.startsWith('regrow:'));
  const firstAdaptive=hasOldGenerations?events.findIndex(c=>c.model==='state-1'):-1;
  let tree;
  if(hasOldGenerations&&(firstAdaptive<0||at<events[firstAdaptive].at)){
   // Historical v3 replacement IDs remain replayable; migrate only when the
   // user makes their first cut with the new interaction.
   tree=legacy.grow(record,p,{...options,generator:generate});
   const levels=branchLevels(tree.nodes);tree.nodes=tree.nodes.map(n=>({...n,pruningLevel:levels.get(n.id)}));tree.recovery=[];
  }else if(hasOldGenerations){
   const boundary=events[firstAdaptive].at,base={...record,cuts:events.slice(0,firstAdaptive)};
   const scaffold=legacy.grow(base,1,{at:boundary,generator:generate});
   tree=legacy.grow(base,p,{at:boundary,generator:generate});
   applyRecovery(tree,scaffold,{...record,cuts:events.slice(firstAdaptive)},at,generate(record.config));
  }else{
   tree=legacy.grow({...record,cuts:[]},p,{...options,generator:generate});
   applyRecovery(tree,generate(record.config),record,at);
  }
  tree.engineVersion=CURRENT_VERSION;tree.viewBox=tree.applicationFrame;
  return tree;
}
export function snapshot(record,at=Date.now()){
  if(treeVersion(record)===LEGACY_VERSION)return legacy.snapshot(record,at);
  const {days,initial}=legacy.profile(record),p=Math.max(0,Math.min(1,initial+(at-record.createdAt)/(days*24*legacy.HOUR)*(1-initial)+legacy.wateringProgress(record,at)));
  return grow(record,p,{at});
}
export function applicationFrame(tree){return tree.engineVersion===CURRENT_VERSION?tree.viewBox:{x:tree.root.x-300,y:tree.root.y-420,width:640,height:620};}
export function draw(tree,{transparent=false,viewBox=tree.viewBox,id='growing-tree'}={}){
  if(tree.engineVersion!==CURRENT_VERSION)return legacy.draw(tree,{transparent,viewBox,id});
  const svg=render(tree,{hour:tree.hour,id,transparent,viewBox});
  return svg.replace('</svg>',`<ellipse cx="${tree.root.x}" cy="${tree.root.y-4}" rx="4" ry="2.5" fill="#8f6240" opacity="${tree.seedOpacity}"/></svg>`);
}
