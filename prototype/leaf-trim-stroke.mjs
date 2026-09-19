// Spatial samples, not timers: identical paths cut equally at any input rate.
// Releasing/cancelling never adds a cut; resting the tool doesn't keep digging.
export function createTrimStroke(start,onSample,spacing=7){
 let previous={...start},remaining=spacing,active=true;
 return {
  move(next){
   if(!active)return;
   let dx=next.x-previous.x,dy=next.y-previous.y,length=Math.hypot(dx,dy);
   if(!length)return;
   const ux=dx/length,uy=dy/length;let traveled=0;
   while(length-traveled>=remaining){
    traveled+=remaining;onSample({x:previous.x+ux*traveled,y:previous.y+uy*traveled});remaining=spacing;
   }
   remaining-=length-traveled;previous={...next};
  },
  stop(){active=false;}
 };
}

// One visible closure at a time. Fast motion never queues missed cuts, and
// resting or releasing the scissors cannot trigger a delayed cut.
export const SNIP_INTERVAL_MS=170;
export const SNIP_REACH_PX=16;
export function createSnipPacer(onSnip,{interval=SNIP_INTERVAL_MS,distance=2}={}){
 let last=null,lastAt=-Infinity,active=true;
 return {
  move(point,at=performance.now()){
   if(!active||at-lastAt<interval||last&&Math.hypot(point.x-last.x,point.y-last.y)<distance)return false;
   if(!onSnip(point))return false;
   last={x:point.x,y:point.y};lastAt=at;return true;
  },
  stop(){active=false;}
 };
}
