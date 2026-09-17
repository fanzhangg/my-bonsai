import {normalize} from '../v1/canopy.mjs';
import {normalizePot} from '../v2/pots.mjs';
import {FORMS,PALETTES,selection} from './bonsai-language.mjs';
import {individualOptions} from './bonsai-individual.mjs';
export {FORMS,PALETTES};
export const PALETTE_BACKGROUNDS={forest:'ivory',mist:'fog',spring:'mint',amber:'sand',ruby:'rose'};
export function normalizeDesign(input={}){
  const {form,crown,leaf,palette}=selection(input),options=individualOptions(input);
  return {...normalize(input),preset:form.id,crown,leaf,palette,
    ...options,variation:Math.max(.25,options.variation),
    appearance:{shape:leaf,foliage:'native',bark:palette==='ruby'?'charcoal':'natural',background:PALETTE_BACKGROUNDS[palette]},
    ...(normalizePot(input.pot)?{pot:normalizePot(input.pot)}:{})};
}
export function validateDesign(input){
  const form=FORMS.find(f=>f.id===input.preset);
  if(!form||!form.crowns.includes(input.crown)||!form.leaves.includes(input.leaf)||!Object.hasOwn(PALETTES,input.palette)||
    !Number.isFinite(input.variation)||input.variation<.25||input.variation>1||!Number.isFinite(input.density)||input.density<0||input.density>1)
    throw Object.assign(new Error('无效的盆栽设计参数'),{status:400});
  return normalizeDesign(input);
}
