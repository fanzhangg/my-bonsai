import {pointOn} from '../v1/model.mjs';

const clamp=v=>Math.max(0,Math.min(1,v));
// A stable, two-dimensional sky-exposure approximation. It intentionally does
// not follow the clock/weather: night must not reroll a branch's direction.
export function growthEnvironment(live,layout,time){
 const foliage=layout.clusters.filter(c=>live.has(c.node));
 for(const n of live.values())if(n.leafTemplate){
  const age=(time-n.bornAt)/3600000+(n.initialAgeHours??0);
  // Reserve some room for a shoot that has already been born, even before its
  // leaves unfold, so siblings do not all choose the same apparent opening.
  const size=Math.max(.4,Math.sqrt(clamp((age-3)/18)));
  foliage.push({x:n.ex,y:n.ey-3*size,rx:Math.min(32,n.leafTemplate.rx)*size,ry:Math.min(22,n.leafTemplate.ry)*size});
 }
 const crowns=foliage.filter(c=>[c.x,c.y,c.rx,c.ry].every(Number.isFinite)&&c.rx>0&&c.ry>0);
 return curve=>{
  let openness=0,light=0;
  for(const u of [.45,.7,1]){
   const p=pointOn(curve,u);
   let density=0;
   for(const c of crowns){
    const distance=Math.hypot((p.x-c.x)/(c.rx+6),(p.y-c.y)/(c.ry+6));
    density+=Math.max(0,1-distance);
   }
   openness+=1/(1+density*3);
   // Five rays into the upper sky hemisphere; overlapping crowns accumulate
   // shade. Outward and upward gaps both admit light, including cascade forms.
   for(const dx of [-.9,-.45,0,.45,.9]){
    let shade=0;
    for(const c of crowns){
     const x=(p.x-c.x)/c.rx,y=(p.y-c.y)/c.ry,vx=dx/c.rx,vy=-1/c.ry;
     const a=vx*vx+vy*vy,b=2*(x*vx+y*vy),d=b*b-4*a*(x*x+y*y-1);
     if(d<0)continue;
     const enter=(-b-Math.sqrt(d))/(2*a),leave=(-b+Math.sqrt(d))/(2*a);
     if(leave>0&&enter<140)shade+=Math.min(1,(Math.min(140,leave)-Math.max(0,enter))/20);
    }
    light+=1/(1+shade);
   }
  }
  return {openness:openness/3,light:light/15};
 };
}

// Space and light dominate cut distance. Only sites in the same narrow
// environmental band use relocation as a tie-breaker; it is not a veto.
export function compareGrowthSites(a,b){
 return Number(b.safe)-Number(a.safe)||Number(b.woodRoom>=2)-Number(a.woodRoom>=2)||
  b.habitatBand-a.habitatBand||(b.heightBand??0)-(a.heightBand??0)||b.relocation-a.relocation||b.score-a.score;
}

export function chooseHeightSite(candidates){
 const top=Math.min(...candidates.map(c=>c.start.y)),bottom=Math.max(...candidates.map(c=>c.start.y));
 const band=c=>Math.min(5,Math.floor((c.start.y-top)/Math.max(1,bottom-top)*6));
 // Inspect six continuous height ranges, highest first. A viable middle
 // opening wins over a slightly brighter low opening: light/space are entry
 // conditions for each range, not a global score that skips the middle.
 const suitable=c=>c.safe&&c.woodRoom>=2&&c.space>=12&&c.habitat.openness>=.62&&c.habitat.light>=.6;
 for(let height=0;height<6;height++){
  const sites=candidates.filter(c=>band(c)===height&&suitable(c));
  if(sites.length)return sites.sort(compareGrowthSites)[0];
 }
 // A completely crowded tree may have no ideal site. Keep the least
 // compromised location within the existing geometry constraints rather
 // than defaulting to the cut's original height or retrying forever.
 return [...candidates].sort(compareGrowthSites)[0];
}
