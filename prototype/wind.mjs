// The woody scaffold is fixed; flexible branches move from their attachments.
export const windStrength=kind=>({wind:1.2,storm:1.35,rain:1.05,snow:.85,fog:.7}[kind]??1);
export function windPose(seconds,strength=1,phase=0){
 const beat=seconds*1.35,gust=.9+.12*Math.sin(seconds*.41)+.06*Math.sin(seconds*.73);
 return {
  bend:strength*gust*(.065*Math.sin(beat-phase)+.010*Math.sin(beat*2-phase+.6)),
  flutter:strength*gust*(2.8*Math.sin(beat-.85+phase*.25)+.9*Math.sin(seconds*3.2+phase)),
 };
}
export function branchFlex(node,baseWidth){
 if(node.role==='trunk'||node.parent<0)return 0;
 const limit=Math.max(.8,baseWidth*.24);
 return Math.max(0,1-node.width/limit)**2;
}
const identity={a:1,b:0,x:0,y:0,angle:0,depth:0};
export function branchPoses(nodes,baseWidth,seconds,strength){
 const byId=new Map(nodes.map(n=>[n.id,n])),poses=new Map();
 function pose(n){
  if(poses.has(n.id))return poses.get(n.id);
  const parent=byId.get(n.parent),p=parent?pose(parent):identity,depth=p.depth+1;
  const flex=branchFlex(n,baseWidth);
  const local=windPose(seconds,strength,depth*.38).bend*flex/(1+depth*.16);
  const angle=p.angle+local,a=Math.cos(angle),b=Math.sin(angle);
  // Compose rotations at the original junction, preserving parent attachment.
  const anchorX=p.a*n.x-p.b*n.y+p.x,anchorY=p.b*n.x+p.a*n.y+p.y;
  const result={a,b,x:anchorX-a*n.x+b*n.y,y:anchorY-b*n.x-a*n.y,angle,depth};
  poses.set(n.id,result);return result;
 }
 nodes.forEach(pose);return poses;
}
const matrix=p=>`matrix(${p.a} ${p.b} ${-p.b} ${p.a} ${p.x} ${p.y})`;
export function startWind(stage){
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 let crown=null,leaves=[],nodes=[],baseWidth=1,raf=0,last=0,seconds=0,paused=false,strength=windStrength(document.body.dataset.weather);
 function restore(){for(const item of [...nodes,...leaves])item.element.removeAttribute('transform');}
 function paint(){
  if(!crown)return;
  const poses=branchPoses(nodes,baseWidth,seconds,strength);
  for(const n of nodes){
   const p=poses.get(n.id);
   if(p.angle===0)n.element.removeAttribute('transform');
   else n.element.setAttribute('transform',matrix(p));
  }
  for(const leaf of leaves){
   const p=poses.get(leaf.node)??identity;
   const {flutter}=windPose(seconds,strength,leaf.phase);
   leaf.element.setAttribute('transform',`${matrix(p)} rotate(${flutter.toFixed(2)} ${leaf.x} ${leaf.y})`);
  }
 }
 function frame(time){
  raf=0;if(document.hidden||motion.matches||paused)return;
  const dt=Math.min((time-last)/1000,.05);last=time;seconds+=dt;
  strength+=(windStrength(document.body.dataset.weather)-strength)*(1-Math.exp(-dt/1.8));
  paint();raf=requestAnimationFrame(frame);
 }
 function run(){
  cancelAnimationFrame(raf);raf=0;
  if(motion.matches||paused){restore();return;}
  if(!document.hidden&&crown){last=performance.now();raf=requestAnimationFrame(frame);}
 }
 function refresh(){
  crown=stage.querySelector('[data-wind-tree]');baseWidth=Number(crown?.dataset.windBaseWidth??1);
  nodes=[...stage.querySelectorAll('[data-wind-wood]')].map(element=>{
   const d=element.dataset;
   return {element,id:Number(d.windWood),parent:Number(d.windParent),role:d.windRole,width:Number(d.windWidth),x:Number(d.windX),y:Number(d.windY)};
  });
  leaves=[...stage.querySelectorAll('[data-wind-leaf]')].map(element=>({element,node:Number(element.dataset.windNode),phase:Number(element.dataset.windLeaf),x:Number(element.dataset.windX),y:Number(element.dataset.windY)}));
  if(!motion.matches&&!paused)paint();run();
 }
 motion.addEventListener('change',run);
 document.addEventListener('visibilitychange',run);
 return {refresh,setPaused(value){paused=value;run();},destroy(){cancelAnimationFrame(raf);motion.removeEventListener('change',run);document.removeEventListener('visibilitychange',run);restore();}};
}
