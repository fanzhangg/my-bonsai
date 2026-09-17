import {pointOn} from './model.mjs';
// Sample a cubic into a variable-width outline, retaining its centerline for
// pointer picking. Widths are diameters in simulation coordinates.
export function taperedPath(n,g=1){
  const left=[],right=[],steps=24;
  for(let i=0;i<=steps;i++){
    const t=g*i/steps,p=pointOn(n,t),before=pointOn(n,Math.max(0,t-.002)),after=pointOn(n,Math.min(1,t+.002));
    const dx=after.x-before.x,dy=after.y-before.y,d=Math.hypot(dx,dy)||1;
    const width=(n.width+(n.tipWidth-n.width)*t)*(.4+.6*g)/2;
    left.push(`${(p.x-dy/d*width).toFixed(2)},${(p.y+dx/d*width).toFixed(2)}`);
    right.push(`${(p.x+dy/d*width).toFixed(2)},${(p.y-dx/d*width).toFixed(2)}`);
  }
  return `M${left.join(' L')} L${right.reverse().join(' L')}Z`;
}
export function potMarkup(pot,style){
  const {x,y,deep}=pot,w=deep?49:style==='literati'?61:86,h=deep?103:35;
  return `<ellipse cx="${x}" cy="${y+h+9}" rx="${w+7}" ry="7" fill="#62594b" opacity=".1"/>
    <path d="M${x-w} ${y} L${x-w*.76} ${y+h} Q${x} ${y+h+12} ${x+w*.76} ${y+h} L${x+w} ${y}Z" fill="url(#pot)"/>
    <ellipse cx="${x}" cy="${y}" rx="${w}" ry="12" fill="url(#rim)"/>
    <ellipse cx="${x}" cy="${y-2}" rx="${w-7}" ry="8" fill="#524c3d"/>
    <path d="M${x-w*.76} ${y-1} Q${x-15} ${y-12} ${x+w*.76} ${y+1} Q${x} ${y+7} ${x-w*.76} ${y-1}" fill="#6e7950"/>
    <path d="M${x-w*.76} ${y+12} Q${x} ${y+24} ${x+w*.76} ${y+12}" fill="none" stroke="#c5b49c" opacity=".28"/>`;
}
