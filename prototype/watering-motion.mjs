// Each drop retains its emission origin and velocity after the can moves.
export function waterPoint(drop,seconds){return {x:drop.x+drop.vx*seconds,y:drop.y+drop.vy*seconds+310*seconds*seconds};}
export function nearPlanter(p,soil,top,factor){
 return Math.abs(p.x-soil.x)<=Math.max(145,205*factor)&&p.y>=top.y-120&&p.y<=soil.y+Math.max(95,105*factor);
}
// Small center deadband avoids flipping back and forth as the hand trembles.
export function waterFacing(x,center,current=1){return x<center-18?-1:x>center+18?1:current;}
// Capacity is replenished only after the can returns to its resting position.
export const WATER_CAPACITY=4000;
// A full four-second pour advances growth by five percentage points.
export const WATER_GROWTH_PER_TANK=.05;
export const WATER_RECOVERY_HOURS_PER_TANK=12;
export const WATERING_RULES={capacity:WATER_CAPACITY,growthPerTank:WATER_GROWTH_PER_TANK,recoveryHoursPerTank:WATER_RECOVERY_HOURS_PER_TANK};
// The server advertises its loaded rules, so a newer browser bundle cannot
// preview a larger dose than the running server will persist.
export function wateringAmount(used,rules=WATERING_RULES){return Math.min(rules.capacity,Math.max(0,used))/rules.capacity*rules.growthPerTank;}
export function createWaterTank(){return {remaining:WATER_CAPACITY};}
export function refillWaterTank(tank){Object.assign(tank,createWaterTank());}
export function spendWater(tank,ms){
 const used=Math.min(tank.remaining,Math.max(0,ms));tank.remaining-=used;
 return {used,growth:used/WATER_CAPACITY*WATER_GROWTH_PER_TANK};
}

// Sweep the traveled segment so fast-moving water cannot tunnel through a surface.
export function waterImpact(drop,from,to,hit){
 const a=waterPoint(drop,from),b=waterPoint(drop,to);
 const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/3));
 let previous=from;
 for(let i=0;i<=steps;i++){
  const t=from+(to-from)*i/steps,q=waterPoint(drop,t);
  if(hit(q)){let lo=previous,hi=t;for(let j=0;j<7;j++){const mid=(lo+hi)/2;if(hit(waterPoint(drop,mid)))hi=mid;else lo=mid;}return waterPoint(drop,hi);}
  previous=t;
 }
 return null;
}
