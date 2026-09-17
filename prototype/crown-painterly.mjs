const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>'#'+a.slice(1).match(/../g).map((v,i)=>Math.round(parseInt(v,16)*(1-t)+parseInt(b.slice(1+i*2,3+i*2),16)*t).toString(16).padStart(2,'0')).join('');
export function painterlyPaint(c,{style='blocks',light='left',volume=true,depth=true,age=true}={}){
  const palettes=[['#304e3b','#4d7050','#729263','#98ac78'],['#3d573b','#638252','#8ea569','#b0bc84'],['#4c623e','#769257','#9eb573','#bdc78c']];
  const palette=palettes[depth?clamp(c.crownLayer??1,0,2):1].map(color=>age?mix(color,(c.crownAge??.5)<.5?'#b4c584':'#344c3b',Math.abs((c.crownAge??.5)-.5)*.10):color);
  const f=c.paintFrame??{x:0,y:0,rx:1,ry:1};
  const g={x:c.x+f.x*c.rx,y:c.y+f.y*c.ry,rx:f.rx*c.rx,ry:f.ry*c.ry};
  const side=light==='right'?1:-1,flat=!volume||light==='diffuse';
  const bend=x=>.48*x*x-side*.22*x+.045*Math.sin(x*5);
  const field=(x,y)=>(y-g.y)/g.ry+bend((x-g.x)/g.rx);
  const soft=style==='soft'?.13:.035;
  // Highlight cap -> light -> halftone -> core shadow at the turning edge
  // -> shadow with weak reflected light. The terminator is a region, not an outline.
  const tones=[mix(palette[2],palette[3],.66),palette[2],palette[1],
    mix(palette[0],'#243b2e',.14),palette[0],mix(palette[0],palette[1],.18)];
  const boundaries=[-.72,-.24,.30,.56,.84];
  const colorAt=q=>{
    if(flat)return palette[1];
    for(let i=0;i<boundaries.length;i++){
      const t=boundaries[i],width=i===2?soft*.8:soft;
      if(q<t-width)return tones[i];
      if(q<t+width)return mix(tones[i],tones[i+1],(q-t+width)/(2*width));
    }
    return tones.at(-1);
  };
  // Filled surfaces share a support-group frame; clip them to each real leaf
  // outline in the renderer. No union hull, new leaf geometry or spherical glow.
  const pathBelow=q=>{
    const pts=Array.from({length:33},(_,i)=>{const x=-3+i*6/32;return `${g.x+x*g.rx},${g.y+(q-bend(x))*g.ry}`;});
    return `M${pts.join(' L')} L${g.x+3*g.rx},${g.y+4*g.ry} L${g.x-3*g.rx},${g.y+4*g.ry}Z`;
  };
  const surfaces=[];
  if(!flat)for(const threshold of boundaries)for(let i=0;i<=6;i++){
    const q=threshold-soft+2*soft*i/6;
    surfaces.push({d:pathBelow(q),color:colorAt(q+1e-6)});
  }
  return {base:flat?palette[1]:tones[0],surfaces,
    shadeAt(x,y,noise=0){
      const q=field(x,y)+.065*Math.sin(x/g.rx*12+y/g.ry*5);
      const base=colorAt(q);
      // Sparse flecks are subordinate to the shared planes, never white dots.
      if(noise>.88&&q<-.60)return mix(base,palette[3],.32);
      return mix(base,noise>0?palette[2]:palette[0],Math.abs(noise)*.10);
    }};
}
