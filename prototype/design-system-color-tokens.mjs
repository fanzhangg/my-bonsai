import {colorTokens,contrast,mix} from './color-system.mjs';
import {TONES} from './design-system-pots.mjs';

// The new planters remain review-only; keep the application's material tokens intact.
function readable(color,background,target){
  if(contrast(color,background)>=target)return color;
  const end=contrast('#050b08',background)>contrast('#fdfef9',background)?'#050b08':'#fdfef9';
  for(let i=1;i<=100;i++){const next=mix(color,end,i/100);if(contrast(next,background)>=target)return next;}
  return end;
}
export function reviewColorTokens(scene,appearance,preset,toneId){
  const tokens=colorTokens(scene,appearance,preset),tone=TONES.find(t=>t.id===toneId)||TONES[0];
  const ground=mix(scene.colors[1],scene.colors[2],.45);
  const body=readable(tone.body,ground,2);
  return {...tokens,'review-pot-body':body,'review-pot-rim':readable(tone.rim,ground,2),'review-pot-pattern':readable(tone.ink,body,1.65)};
}
