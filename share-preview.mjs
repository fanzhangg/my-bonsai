import {Resvg} from '@resvg/resvg-js';
import {snapshot,draw} from './prototype/growth.mjs';
import {colorsFor} from './prototype/core/v1/appearance.mjs';
import {shareData,shareVersion,SHARE_WIDTH,SHARE_HEIGHT} from './prototype/share-data.mjs';

const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function publicOrigin(req,configured){
 const origin=configured||`${req.headers['x-forwarded-proto']?.split(',')[0].trim()==='https'||req.socket.encrypted?'https':'http'}://${req.headers.host}`;
 const parsed=new URL(origin);
 if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)throw new Error('Invalid public origin');
 return parsed.origin;
}
export function shareMetadata(record,origin,at=Date.now()){
 const data=shareData(record,origin,at);
 const tags=[['property','og:type','website'],['property','og:site_name','我的盆栽'],['property','og:locale','zh_CN'],
  ['property','og:title',data.title],['property','og:description',data.text],['property','og:url',data.url],
  ['property','og:image',data.image],['property','og:image:type','image/png'],
  ['property','og:image:width',SHARE_WIDTH],['property','og:image:height',SHARE_HEIGHT],['property','og:image:alt','我种的盆栽，快来给它浇水'],
  ['name','description',data.text],['name','twitter:card','summary_large_image'],['name','twitter:title',data.title],
  ['name','twitter:description',data.text],['name','twitter:image',data.image],['name','twitter:image:alt','我种的盆栽']];
 return `<title>${escape(data.title)} · 我的盆栽</title>\n<link rel="canonical" href="${escape(data.url)}">\n`+
  tags.map(([kind,key,value])=>`<meta ${kind}="${key}" content="${escape(value)}">`).join('\n');
}
export function renderShareImage(record,at=Date.now()){
 const tree=snapshot(record,at);
 // Inline HTML permits valueless data attributes; the PNG renderer parses XML.
 let svg=draw(tree).replace(/\s(data-[\w-]+)(?=[\s>])/g,' $1=""').replace(/(<\/defs>)<rect [^>]*\/>/,'$1');
 const font={loadSystemFonts:false},bounds=new Resvg(svg,{font}).getBBox();
 // Frame the actual plant and pot, so a young tree is legible in a small card.
 const height=Math.max(bounds.height*1.4,bounds.width*1.4*SHARE_HEIGHT/SHARE_WIDTH,100),width=height*SHARE_WIDTH/SHARE_HEIGHT;
 const viewBox=`${bounds.x+bounds.width/2-width/2} ${bounds.y+bounds.height/2-height/2} ${width} ${height}`;
 svg=svg.replace(/viewBox="[^"]+"/,`viewBox="${viewBox}"`).replace('<svg ',`<svg width="${SHARE_WIDTH}" height="${SHARE_HEIGHT}" `);
 return new Resvg(svg,{background:colorsFor(record.config.appearance).background,font}).render().asPng();
}
// Bound memory and render at most once per tree/revision/minute. Query strings
// cannot create arbitrary cache entries; fetching a preview never edits a tree.
export function createShareImageCache(){
 const cache=new Map();
 return (record,at=Date.now())=>{
  const key=record.id+':'+shareVersion(record,at);
  if(cache.has(key))return cache.get(key);
  const png=renderShareImage(record,at);cache.set(key,png);
  if(cache.size>32)cache.delete(cache.keys().next().value);
  return png;
 };
}
