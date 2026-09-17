import {colorTokens,potColorTokens} from './color-system.mjs';

// Compatibility names for the color review UI; production uses the same palette.
export function reviewColorTokens(scene,appearance,preset,toneId){
  const pot=potColorTokens(scene,toneId);
  return {...colorTokens(scene,appearance,preset),...pot,
    'review-pot-body':pot['bonsai-vessel-body'],
    'review-pot-rim':pot['bonsai-vessel-rim'],
    'review-pot-pattern':pot['bonsai-vessel-pattern']};
}
