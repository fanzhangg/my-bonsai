import {normalize,PRESETS} from './core/v1/canopy.mjs';
import {LOOKS} from './core/v1/appearance.mjs';
import {sample} from './core/v1/model.mjs';
import {POT_PRESETS,normalizePot} from './pots.mjs';
// A fresh random claim ID identifies exactly the tree shown before adoption.
// Server and browser derive the same configuration; retries never reroll it.
export function configForClaim(id){
  const config=normalize({seed:id,preset:PRESETS[Math.floor(sample(id,'claim','style')*PRESETS.length)].id,appearance:LOOKS[Math.floor(sample(id,'claim','look')*LOOKS.length)]});
  config.pot=normalizePot(POT_PRESETS[Math.floor(sample(id,'claim','pot')*POT_PRESETS.length)]);
  return config;
}
