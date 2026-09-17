// Review-only material and lighting model. All coordinates are local to a crown.
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
function linear([L,C,h]){
  const a=C*Math.cos(h*Math.PI/180),b=C*Math.sin(h*Math.PI/180);
  const l=(L+.3963377774*a+.2158037573*b)**3;
  const m=(L-.1055613458*a-.0638541728*b)**3;
  const s=(L-.0894841775*a-1.291485548*b)**3;
  return [4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s];
}
const hex=rgb=>'#'+rgb.map(v=>{v=clamp(v);return Math.round(255*(v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055)).toString(16).padStart(2,'0');}).join('');
export function crownPaint(c,{light='left',depth=true,age=true,volume=true}={}){
  const maturity=age?clamp(c.crownAge??.5):.5;
  const layer=depth?clamp((c.crownLayer??1)-1,-1,1):0;
  const albedo=linear([.56+(1-maturity)*.075+layer*.045,.077+layer*.006,145-(1-maturity)*7-layer*2]);
  const side=light==='right'?1:-1,diffuse=light==='diffuse';
  const exposure=.87+(c.crownPosition??0)*side*.13;
  const cx=side*.28,cy=-.42;
  // Broad light plane, soft turning plane, core shadow, then restrained bounce.
  // This deliberately shaped value curve makes a rounded mass readable at
  // phone size. Both the SVG core and leaves sample the same continuous curve.
  const planes=[[0,1.65],[.25,1.50],[.50,1.08],[.72,.60],[.90,.38],[1,.44]];
  const form=r=>{
    r=clamp(r);
    const i=planes.findIndex(([t])=>t>=r);
    if(i<=0)return planes[0][1];
    const [a,x]=planes[i-1],[b,y]=planes[i],t=(r-a)/(b-a);
    return x+(y-x)*t;
  };
  const radius=(x,y)=>Math.hypot(x-cx,y-cy)/1.56;
  const atRadius=(r,noise=0)=>{
    const energy=diffuse?.87:volume?.30+exposure*(form(r)-.30):.48+.95*exposure*.48;
    const warmth=diffuse?0:volume?clamp(1-r*1.6):.2;
    return hex(albedo.map((v,i)=>v*(energy+[.04,.01,-.025][i]*warmth)*(1+noise*.075)));
  };
  return {cx,cy,stops:planes.map(([t])=>({offset:t,color:atRadius(t)})),
    shadeAt:(x,y,noise=0)=>atRadius(radius(x,y),clamp(noise,-1,1))};
}

// Contact shading is only cast between overlapping crowns of distinct depth.
// It is an illustrative occlusion cue, not a simulated directional cast shadow.
export function crownOccluders(c,clusters){
  return clusters.filter(front=>front.node!==c.node&&(front.crownLayer??1)>(c.crownLayer??1)&&
    Math.hypot((front.x-c.x)/(front.rx+c.rx),(front.y-c.y)/(front.ry+c.ry))<.95);
}
