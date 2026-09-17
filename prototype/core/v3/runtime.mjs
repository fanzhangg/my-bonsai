import {generateLanguage} from './bonsai-language.mjs';
import {normalizeDesign} from './config.mjs';
// Cache only private mature scaffolds. Growth always receives its own copy.
const cache=new Map();
export function generate(config){
  const normalized=normalizeDesign(config),key=JSON.stringify(normalized);
  if(!cache.has(key)){
    const tree=generateLanguage(normalized);tree.config={...tree.config,...normalized};
    tree.applicationFrame=frameFor(tree);cache.set(key,tree);
    if(cache.size>24)cache.delete(cache.keys().next().value);
  }
  return structuredClone(cache.get(key));
}
export function frameFor(tree){
  // Anchor soil at a stable fraction, leaving room below for hanging branches.
  const rx=tree.root.x,ry=tree.root.y;
  let half=170,above=300,below=180;
  for(const n of tree.nodes)for(const [x,y]of [['x','y'],['cx1','cy1'],['cx2','cy2'],['ex','ey']]){
    half=Math.max(half,Math.abs(n[x]-rx)+n.width+20);above=Math.max(above,ry-n[y]+n.width+20);below=Math.max(below,n[y]-ry+n.width+20);
  }
  for(const c of tree.clusters){half=Math.max(half,Math.abs(c.x-rx)+c.rx*1.3+18);above=Math.max(above,ry-c.y+c.ry*1.3+18);below=Math.max(below,c.y-ry+c.ry*1.3+18);}
  const height=Math.max(620,half*2*620/640,above/.64,below/.36),width=height*640/620;
  return {x:rx-width/2,y:ry-height*.64,width,height};
}
