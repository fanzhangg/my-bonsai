import test from 'node:test';
import assert from 'node:assert/strict';
import {growthEnvironment} from '../prototype/core/v3/growth-space.mjs';
import {recoveryPlan} from '../prototype/core/v3/regrowth.mjs';
import {snapshot,HOUR} from '../prototype/growth.mjs';
import {normalizeDesign} from '../prototype/core/v3/config.mjs';
import {CURRENT_VERSION} from '../prototype/tree-versions.mjs';
import {CUT_MODEL,canPrune} from '../prototype/pruning-model.mjs';

const line=(id,parent,role,x,y,ex,ey)=>({id,parent,role,x,y,ex,ey,cx1:x+(ex-x)/3,cy1:y+(ey-y)/3,cx2:x+(ex-x)*2/3,cy2:y+(ey-y)*2/3,width:8,tipWidth:3,pad:0});
function fixture(cloudX,model=CUT_MODEL){
 const scaffold={nodes:[line('trunk',null,'trunk',100,450,100,100),line('parent','trunk','primary',100,250,350,250),line('cut','parent','twig',225,250,270,250)],
  clusters:cloudX?[{node:'parent',pad:1,z:0,x:cloudX,y:210,rx:55,ry:28}]:[{pad:0,z:0}],root:{x:100,y:450},applicationFrame:{x:0,y:0,width:600,height:500}};
 const record={config:{seed:'relocation',preset:'juniper'},cuts:[{id:'event',branchId:'cut',at:0,model}]};
 return recoveryPlan(scaffold,record,24*HOUR).live.get('sprout:0');
}

test('a sunny opening near the cut wins over the shaded location farther from it',()=>{
 const distant=fixture(null),shaded=fixture(320),shadeMoved=fixture(230);
 assert(distant.x>300,'equally open sites still prefer distance from the cut');
 assert(shaded.x<260,'the open inner portion wins even though the cut is at x=225');
 assert(shadeMoved.x>300,'moving the canopy changes which end receives the shoot');
 assert(Math.abs(shaded.x-225)<Math.abs(distant.x-225));
 const geometry=({leafTemplate,pad,...wood})=>wood;
 assert.deepEqual(geometry(fixture(320,'state-5')),geometry(fixture(null,'state-5')),'historical geometry does not adopt the new light rule');
});

test('existing wood redirects later shoots into the open side instead of crossing the crowded side',()=>{
 const scaffold={nodes:[line('trunk',null,'trunk',100,450,100,100),line('parent','trunk','primary',100,250,350,250),line('cut','parent','twig',225,250,270,250),line('neighbor','trunk','primary',310,400,310,150)],clusters:[{pad:0,z:0}],root:{x:100,y:450},applicationFrame:{x:0,y:0,width:600,height:500}};
 const plan=model=>[...recoveryPlan(scaffold,{config:{seed:'relocation',preset:'juniper'},cuts:[{id:'event',branchId:'cut',at:0,model}]},24*HOUR).live.values()].filter(n=>n.regrown&&n.parent==='parent');
 const old=plan('state-5'),current=plan(CUT_MODEL);
 assert(old[1].x<310&&old[1].ex>310,'old distance preference crosses the neighbor');
 assert(current[1].ex<300&&current[2].ex<300,'new shoots stay in the free inner area');
});

test('shade follows living foliage and young shoots reserve room before their leaves unfold',()=>{
 const curve=line('candidate',null,'twig',205,300,235,300),live=new Map([['leaf',{}]]);
 const layout={clusters:[{node:'leaf',x:220,y:210,rx:35,ry:25}]};
 const shaded=growthEnvironment(live,layout,0)(curve);assert(shaded.light<1);
 live.delete('leaf');const open=growthEnvironment(live,layout,0)(curve);
 assert.equal(open.light,1);assert.equal(open.openness,1);
 live.set('new',{bornAt:0,ex:220,ey:300,leafTemplate:{rx:30,ry:20}});
 const reserved=growthEnvironment(live,layout,0)(curve);assert(reserved.openness<open.openness);
});

test('natural-2 history stays stable until a new cut opts into space-first growth',()=>{
 const r={version:CURRENT_VERSION,createdAt:0,config:normalizeDesign({seed:'space-history',preset:'juniper',growthPolicy:'natural-2'}),cuts:[]};
 const at=500*HOUR,old=snapshot(r,at),branch=old.nodes.find(canPrune);
 r.cuts.push({id:'new-rule',seq:1,branchId:branch.id,at:at+HOUR,model:CUT_MODEL});
 assert.deepEqual(snapshot(r,at),old);
 const future=snapshot(r,at+240*HOUR);
 assert.deepEqual(snapshot(JSON.parse(JSON.stringify(r)),at+240*HOUR),future);
 assert(future.branchRanges.every(r=>r.count<=r.max));
});
