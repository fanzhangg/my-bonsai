const between=(min,max,random)=>min+(max-min)*random();

// All travel starts or ends beyond the clipped scene, never at an interior spawn point.
export function edgePoint(random=Math.random){
  const side=Math.floor(random()*3);
  if(side===2)return {x:between(18,82,random),y:-12};
  return {x:side===0?-12:112,y:between(18,64,random)};
}

export function flightPoint(from,to,progress,bend=8){
  const u=Math.max(0,Math.min(1,progress)),v=1-u;
  const c1={x:from.x+(to.x-from.x)*.32,y:from.y+(to.y-from.y)*.12-bend};
  const c2={x:from.x+(to.x-from.x)*.76,y:from.y+(to.y-from.y)*.8-bend};
  return {x:v*v*v*from.x+3*v*v*u*c1.x+3*v*u*u*c2.x+u*u*u*to.x,
    y:v*v*v*from.y+3*v*v*u*c1.y+3*v*u*u*c2.y+u*u*u*to.y};
}

export function visitTiming(random=Math.random){
  return {wait:between(4000,16000,random),enter:between(3200,5500,random),stay:between(14000,35000,random),leave:between(2600,4200,random)};
}

// The same depth envelope plays forward on approach and backward on departure.
export function flightAppearance(progress,entering){
  const u=Math.max(0,Math.min(1,progress));
  const near=entering?u:1-u,eased=near*near*(3-2*near);
  return {scale:.28+.72*eased,opacity:eased};
}
