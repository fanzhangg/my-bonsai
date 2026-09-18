import test from 'node:test';
import assert from 'node:assert/strict';
import {recoveryPlan} from '../prototype/core/v3/regrowth.mjs';
import {snapshot,HOUR} from '../prototype/growth.mjs';
import {normalizeDesign} from '../prototype/core/v3/config.mjs';
import {CURRENT_VERSION} from '../prototype/tree-versions.mjs';
import {CUT_MODEL,canPrune} from '../prototype/pruning-model.mjs';
import {compareGrowthSites,chooseHeightSite} from '../prototype/core/v3/growth-space.mjs';

const line=(id,parent,role,x,y,ex,ey)=>({id,parent,role,x,y,ex,ey,cx1:x+(ex-x)/3,cy1:y+(ey-y)/3,cx2:x+(ex-x)*2/3,cy2:y+(ey-y)*2/3,width:8,tipWidth:3,pad:0});
function fixture(shade=false){
 const layout={nodes:[line('trunk',null,'trunk',250,450,250,80),line('low','trunk','primary',250,370,320,360),line('middle','trunk','primary',250,280,180,270),line('high','trunk','primary',250,170,320,160)],
  clusters:[{pad:0,z:0},...(shade?[{node:'middle',pad:9,z:0,x:310,y:115,rx:90,ry:40}]:[])],root:{x:250,y:450},applicationFrame:{x:0,y:0,width:600,height:500}};
 const record={config:{seed:'height',preset:'juniper'},cuts:[{id:'upper-gap',branchId:'high',at:0,model:CUT_MODEL},{id:'last-cut-low',branchId:'low',at:0,model:CUT_MODEL}]};
 return {layout,record};
}

test('a low cut can be followed by a new primary in a higher opening, within one shared budget',()=>{
 const {layout,record}=fixture(),immediate=recoveryPlan(layout,record,0);
 assert.equal(immediate.jobs.filter(j=>!j.parentId).length,1,'one shared opportunity clock rather than one replacement clock per empty region');
 assert(![...immediate.live.values()].some(n=>n.regrown));
 const plan=recoveryPlan(layout,record,40*HOUR),newWood=[...plan.live.values()].filter(n=>n.regrown&&n.pruningLevel===1);
 assert(newWood[0].y<220,'the first shoot uses the open upper site after the low cut');
 assert.equal(newWood[0].zoneId,'zone-2');
 const range=plan.ranges.find(r=>r.level===1);
 assert(range.wholeTree);assert.equal(range.count,3);assert.equal(range.max,3);
 assert.deepEqual(recoveryPlan(layout,record,40000*HOUR).ranges,plan.ranges,'empty regions cannot exceed the whole-tree cap');
});

test('a blocked top leads to the viable middle before the more open bottom',()=>{
 const {layout,record}=fixture(true),plan=recoveryPlan(layout,record,40*HOUR);
 const newWood=[...plan.live.values()].filter(n=>n.regrown&&n.pruningLevel===1);
 assert(newWood[0].y>220&&newWood[0].y<300,'top is shaded: inspect the middle instead of jumping to the bottom');
 assert.equal(newWood[0].zoneId,'zone-1');
 const old={...record,cuts:record.cuts.map(c=>({...c,model:'state-7'}))};
 const oldShoot=[...recoveryPlan(layout,old,40*HOUR).live.values()].find(n=>n.regrown&&n.pruningLevel===1);
 assert(oldShoot.y>300,'the same historical state-7 scene retains its old low placement');
 assert(newWood.every(n=>n.parent==='trunk'));
 assert(plan.ranges.every(r=>r.count<=r.max));
});

test('height search descends through every blocked intermediate range',()=>{
 const sites=Array.from({length:6},(_,i)=>({start:{y:100+i*50},safe:true,woodRoom:20,space:35,
  habitat:{openness:.8,light:.7},habitatBand:14+i,heightBand:5-i,relocation:i*50,score:i}));
 const saved=structuredClone(sites);
 for(let blocked=0;blocked<6;blocked++){
  const scene=structuredClone(sites);
  for(let i=0;i<blocked;i++){
   // Reject successive ranges for different reasons, not just "top full".
   if(i%3===0)scene[i].woodRoom=0;
   else if(i%3===1)scene[i].habitat.light=.3;
   else scene[i].habitat.openness=.3;
  }
  assert.equal(chooseHeightSite(scene),scene[blocked],`descend to range ${blocked+1}; brighter lower ranges must wait`);
 }
 assert.deepEqual(sites,saved);
 const crowded=sites.map(s=>({...s,safe:false}));
 assert(crowded.includes(chooseHeightSite(crowded)),'bounded fallback when every site is compromised');
});

test('natural-4 keeps its previous height decisions before a new cut',()=>{
 const r={version:CURRENT_VERSION,createdAt:0,config:normalizeDesign({preset:'juniper',seed:'height-history',growthPolicy:'natural-4'}),cuts:[]};
 const at=500*HOUR,past=snapshot(r,at),branch=past.nodes.find(canPrune);
 r.cuts.push({id:'new-height-search',seq:1,at:at+HOUR,branchId:branch.id,model:CUT_MODEL});
 assert.deepEqual(snapshot(r,at),past);
 const later=snapshot(r,at+240*HOUR);
 assert.deepEqual(snapshot(JSON.parse(JSON.stringify(r)),at+240*HOUR),later);
 assert(later.branchRanges.every(r=>r.count<=r.max));
});

test('height breaks environmental ties before cut distance but cannot override space or safety',()=>{
 const low={safe:true,woodRoom:20,habitatBand:16,heightBand:0,relocation:300,score:0};
 const high={...low,heightBand:3,relocation:0};
 assert(compareGrowthSites(high,low)<0);
 assert(compareGrowthSites({...high,habitatBand:15},low)>0);
 assert(compareGrowthSites({...high,woodRoom:0},low)>0);
 assert(compareGrowthSites({...high,safe:false},low)>0);
});

test('natural-3 history retains its regional births until the new interaction',()=>{
 const r={version:CURRENT_VERSION,createdAt:0,config:normalizeDesign({preset:'juniper',seed:'height-history',growthPolicy:'natural-3'}),cuts:[]};
 const at=500*HOUR,past=snapshot(r,at),low=past.nodes.filter(n=>n.pruningLevel===1&&canPrune(n)).sort((a,b)=>b.y-a.y)[0];
 r.cuts.push({id:'new-cut',seq:1,at:at+HOUR,branchId:low.id,model:CUT_MODEL});
 assert.deepEqual(snapshot(r,at),past);
 const next=snapshot(r,at+100*HOUR);
 assert.equal(next.branchRanges.filter(r=>r.level===1).length,1);
 assert.deepEqual(snapshot(JSON.parse(JSON.stringify(r)),at+100*HOUR),next);
});
