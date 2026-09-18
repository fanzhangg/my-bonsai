import {normalize,PRESETS} from './core/v1/canopy.mjs';
import {LOOKS} from './core/v1/appearance.mjs';
import {sample} from './core/v1/model.mjs';
import {POT_PRESETS,normalizePot} from './pots.mjs';
import {treeVersion,LEGACY_VERSION,CURRENT_VERSION} from './tree-versions.mjs';
import {FORMS,PALETTES,normalizeDesign} from './core/v3/config.mjs';
// Independent draws: adding a palette cannot reroll the branch structure.
export const CLAIM_WEIGHTS={variation:[[.25,.2],[.55,.6],[.85,.2]],density:[[.2,.2],[.5,.6],[.8,.2]]};
function weighted(value,options){let total=0;for(const [choice,weight]of options){total+=weight;if(value<total)return choice;}return options.at(-1)[0];}
// A fresh random claim ID identifies exactly the tree shown before adoption.
// Server and browser derive the same configuration; retries never reroll it.
export function configForClaim(id,version=LEGACY_VERSION,growthPolicy){
  treeVersion({version});
  if(version===CURRENT_VERSION){
    const pick=(items,key)=>items[Math.floor(sample(id,'claim-v3',key)*items.length)];
    const form=pick(FORMS,'form');
    return normalizeDesign({seed:id,preset:form.id,growthPolicy,crown:pick(form.crowns,'crown'),leaf:pick(form.leaves,'leaf'),palette:pick(Object.keys(PALETTES),'palette'),
      variation:weighted(sample(id,'claim-v3','variation'),CLAIM_WEIGHTS.variation),density:weighted(sample(id,'claim-v3','density'),CLAIM_WEIGHTS.density),
      pot:normalizePot(pick(POT_PRESETS,'pot'))});
  }
  const config=normalize({seed:id,preset:PRESETS[Math.floor(sample(id,'claim','style')*PRESETS.length)].id,appearance:LOOKS[Math.floor(sample(id,'claim','look')*LOOKS.length)]});
  config.pot=normalizePot(POT_PRESETS[Math.floor(sample(id,'claim','pot')*POT_PRESETS.length)]);
  return config;
}
