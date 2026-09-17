import test from 'node:test';
import assert from 'node:assert/strict';
import {waterPoint,waterImpact,nearPlanter,waterFacing,createWaterTank,spendWater,refillWaterTank,WATER_CAPACITY} from '../prototype/watering-motion.mjs';
test('water follows emission momentum and gravity without steering toward the pot',()=>{
 const drop={x:200,y:100,vx:-40,vy:50};
 assert.deepEqual(waterPoint(drop,0),{x:200,y:100});
 assert.deepEqual(waterPoint(drop,1),{x:160,y:460});
 assert.ok(waterPoint(drop,1).y-waterPoint(drop,.5).y>waterPoint(drop,.5).y-drop.y);
 assert.equal(waterPoint({...drop,x:400},1).x-waterPoint(drop,1).x,200);
 assert.deepEqual(drop,{x:200,y:100,vx:-40,vy:50});
});
test('can faces inward and does not flicker when crossing the center deadband',()=>{
 assert.equal(waterFacing(100,300,1),-1);
 assert.equal(waterFacing(500,300,-1),1);
 assert.equal(waterFacing(295,300,-1),-1);
 assert.equal(waterFacing(305,300,1),1);
});
test('growth starts with water consumption and is bounded by each refill',()=>{
 const tank=createWaterTank();const first=spendWater(tank,100);
 assert.ok(Math.abs(first.growth-.00125)<1e-12);assert.equal(tank.remaining,WATER_CAPACITY-100);
 const rest=spendWater(tank,10000);assert.equal(first.growth+rest.growth,.05);
 assert.deepEqual(spendWater(tank,100),{used:0,growth:0});
 refillWaterTank(tank);assert.equal(tank.remaining,4000);assert.equal(spendWater(tank,4000).growth,.05);
});

test('watering can start beside or slightly below the pot as well as above the tree',()=>{
 const soil={x:300,y:440},top={x:300,y:150};
 for(const factor of [.5,1]){
  assert.ok(nearPlanter({x:soil.x+130,y:soil.y+40},soil,top,factor));
  assert.ok(nearPlanter({x:soil.x,y:top.y-60},soil,top,factor));
  assert.equal(nearPlanter({x:soil.x+300,y:soil.y},soil,top,factor),false);
 }
});

test('stopping consumption stops growth and resuming uses only remaining water',()=>{
 const tank=createWaterTank();const first=spendWater(tank,1200);
 assert.deepEqual(spendWater(tank,0),{used:0,growth:0});
 assert.deepEqual(spendWater(tank,-10),{used:0,growth:0});
 assert.equal(tank.remaining,2800);
 assert.ok(Math.abs(first.growth+spendWater(tank,2800).growth-.05)<1e-12);
});


test('water stops at the first surface crossed, including thin foliage and ground',()=>{
 const drop={x:20,y:0,vx:0,vy:100};
 const hit=waterImpact(drop,0,1,q=>q.y>=50&&q.y<=55||q.y>=180);
 assert.ok(hit.y>=50&&hit.y<50.1);
 const ground=waterImpact(drop,0,1,q=>q.y>=180);
 assert.ok(ground.y>=180&&ground.y<180.1);
 assert.equal(waterImpact(drop,0,.1,q=>q.y>=50),null);
});
