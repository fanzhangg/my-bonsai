// Analytic particle trajectories: rendering frequency does not change the path.
// Stratified lifetime phases keep a steady stream rather than random respawn bursts.
const fract=x=>x-Math.floor(x);
const wrap=(x,size)=>((x%size)+size)%size;
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export function createParticles(kind,width,ground,random=Math.random){
 const base={rain:180,storm:250,snow:75,wind:24}[kind]??0;
 const count=Math.round(base*Math.max(.45,Math.min(1.5,width*ground/450000)));
 const particles=[];
 for(let layer=0;layer<3;layer++){
  const n=Math.floor((count+2-layer)/3),depth=[.82,1,1.15][layer];
  for(let i=0;i<n;i++)particles.push({
   layer,depth,phase:(i+.2+random()*.6)/n,
   // Low-discrepancy horizontal placement avoids lanes and large random holes.
   x:fract(i*.61803398875+layer*.273+(random()-.5)*.07),
   flutter:random()*Math.PI*2,landing:(random()-.5)*.35,
   size:(kind==='snow'?2.5:.9)*depth*(.9+random()*.2),
  });
 }
 return particles;
}
export function particlePose(p,time,kind,width,ground){
 const snow=kind==='snow',wind=kind==='wind',storm=kind==='storm';
 const fade=Math.max(40,Math.min(110,ground*.2));
 const landing=ground+p.landing*fade,travel=landing+55;
 // A rain traversal takes ~3 seconds, snow ~24 seconds. Depth variation is small.
 const rate=(snow?.042:storm?.44:.34)*p.depth;
 const y=wind?fract(p.phase+time*.006)*ground:fract(p.phase+time*rate)*travel-55;
 const vy=wind?ground*.006:travel*rate;
 const horizontal=wind?48:storm?-26:snow?5:-15;
 // Shared wind, integrated analytically; snow adds a gentle local flutter.
 const drift=p.depth*(horizontal*time+8/.45*Math.sin(time*.45));
 const flutter=snow?9*p.depth*Math.sin(time*.8+p.flutter):0;
 const vx=p.depth*(horizontal+8*Math.cos(time*.45))+(snow?7.2*p.depth*Math.cos(time*.8+p.flutter):0);
 const x=wrap(p.x*(width+160)+drift+flutter,width+160)-80;
 const length=snow||wind?Math.max(6,Math.min(18,vy*.075)):Math.max(18,Math.min(38,vy*.12));
 const tip=snow?p.size:length;
 const alpha=(.65+.25*p.depth)*(wind?1:1-smooth((y+tip-(landing-fade))/fade));
 return {x,y,vx,vy,length,alpha,size:p.size};
}
