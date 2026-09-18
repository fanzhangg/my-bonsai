import {pointOn} from '../v1/model.mjs';
import {FORM_PROPORTIONS,BRANCH_WIDTH_BANDS,branchLength} from './bonsai-individual.mjs';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const heading=n=>Math.atan2(n.ey-n.y,n.ex-n.x);
const turn=a=>Math.atan2(Math.sin(a),Math.cos(a));

// Use the trained branch family as a directional/proportional reference, not
// a future trajectory. Each birth still chooses its attachment from live space.
export function recoveryShape({parent,reference,parentReference,t,level,preset,random,frame,root,surplus=false}){
 const start=pointOn(parent,t),profile=FORM_PROPORTIONS[preset]??FORM_PROPORTIONS.juniper;
 const tier=Math.min(4,(parent.branchTier??level-1)+1),band=profile.lengths[tier-1];
 const inherited=level===1?0:clamp(turn(heading(parent)-heading(parentReference)),-.3,.3);
 const spread=(preset==='windswept'?.22:preset==='broom'?.4:.32)*(surplus?1.4:1);
 const angle=heading(reference)+inherited+(random('angle')-.5)*spread;
 const parentLength=branchLength(parent),referenceLength=branchLength(reference);
 // Do not turn short upper limbs into long lower limbs, or let successive
 // generations accumulate reach beyond their trained family proportions.
 const upper=Math.min(band[1],referenceLength,level===1?Infinity:parentLength*.72);
 const lower=Math.min(band[0],upper);
 let length=clamp(referenceLength*(.72+random('length')*.22),lower,upper);
 const pa=pointOn(parent,Math.max(0,t-.002)),pb=pointOn(parent,Math.min(1,t+.002));
 const tangent=Math.atan2(pb.y-pa.y,pb.x-pa.x);
 const departure=tangent+clamp(turn(angle-tangent)*(level===1?.55:.25),level===1?-.68:-.24,level===1?.68:.24);
 // Young tips gently turn upward; the trained cascade/downwind direction
 // remains the main gesture rather than a global vertical growth rule.
 const tip=Math.atan2(Math.sin(angle)-.12,Math.cos(angle));
 const offsets={cx1:Math.cos(departure)*length*.3,cy1:Math.sin(departure)*length*.3,
  ex:Math.cos(angle)*length,ey:Math.sin(angle)*length};
 offsets.cx2=offsets.ex-Math.cos(tip)*length*.28;offsets.cy2=offsets.ey-Math.sin(tip)*length*.28;
 // Shorten the whole curve at the frame/soil boundary; clipping only its tip
 // would introduce a kink and change the chosen direction.
 let scale=1;
 for(const [x,y]of [['cx1','cy1'],['cx2','cy2'],['ex','ey']]){
  for(const [origin,delta,lo,hi]of [[start.x,offsets[x],frame.x+45,frame.x+frame.width-45],
   [start.y,offsets[y],frame.y+45,preset==='cascade'?frame.y+frame.height-45:root.y-25]]){
   if(delta>0&&origin<=hi)scale=Math.min(scale,(hi-origin)/delta);
   if(delta<0&&origin>=lo)scale=Math.min(scale,(lo-origin)/delta);
  }
 }
 scale=clamp(scale,.05,1);length*=scale;
 const curve={...start};for(const [x,y]of [['cx1','cy1'],['cx2','cy2'],['ex','ey']]){curve[x]=start.x+offsets[x]*scale;curve[y]=start.y+offsets[y]*scale;}
 const widths=BRANCH_WIDTH_BANDS[tier],local=parent.width+(parent.tipWidth-parent.width)*t;
 const maxWidth=Math.min(widths.max,local*widths.ratio[1],length*widths.slenderness);
 const minWidth=Math.min(maxWidth,Math.max(widths.min,local*widths.ratio[0]));
 const width=minWidth+(maxWidth-minWidth)*(.35+random('width')*.3);
 return {...curve,width,tipWidth:width*(widths.tip[0]+random('taper')*(widths.tip[1]-widths.tip[0])),branchTier:tier};
}
