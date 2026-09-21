import {svgBitmap,releaseBitmap} from './svg-bitmap.mjs';
import {PRESETS} from './core/v1/canopy.mjs';
// Muted ink follows the rendered paper color, including legacy night palettes.
const captionInk={'#e8dccb':'#706858','#e9f0e5':'#526b55','#f3e8e4':'#805d59','#efe3c9':'#78613c','#e4ebeb':'#526c70','#24323b':'#c5d5da'};
const grid=document.getElementById('gallery-grid'),status=document.getElementById('gallery-status');
let query='',searchTimer;
let generation=0,controller,loading=false,nextCursor=null,hasMore=true,renderTimer;
const cards=new Map(),seen=new Set(),pending=new Set(),cache=new Map();
let worker=null,rendering=false,cancelPreview=null;
function stopWorker(){worker?.terminate();worker=null;}
function preview(record,now){
 return new Promise((resolve,reject)=>{
  try{
   worker??=new Worker(new URL('./gallery-worker.mjs',import.meta.url),{type:'module'});
   const finish=(error,data)=>{clearTimeout(timer);cancelPreview=null;error?reject(error):resolve(data);};
   const timer=setTimeout(()=>{stopWorker();finish(new Error('Preview timed out'));},15000);
   cancelPreview=()=>{stopWorker();finish(new Error('Preview cancelled'));};
   worker.onmessage=({data})=>finish(data.error?new Error(data.error):null,data);
   worker.onerror=()=>{stopWorker();finish(new Error('Preview worker unavailable'));};
   worker.postMessage({record,now});
  }catch(error){if(cancelPreview)cancelPreview();else reject(error);}
 });
}
function trimCache(){
 for(const [entry,bitmap] of cache){
  if(cache.size<=24)break;
  if(!entry.visible){cache.delete(entry);releaseBitmap(bitmap);}
 }
}
function scheduleRender(){
 if(renderTimer!==undefined||rendering||!pending.size)return;
 renderTimer=setTimeout(async()=>{
  renderTimer=undefined;const entry=pending.values().next().value;pending.delete(entry);
  if(entry&&cards.has(entry.art)){
   rendering=true;try{await entry.render();}finally{rendering=false;}
  }
  scheduleRender();
 },0);
}
function visibility(entry,visible){
 entry.visible=visible;
 if(visible){if(!entry.art.firstChild){pending.add(entry);scheduleRender();}}
 else{pending.delete(entry);entry.art.replaceChildren();trimCache();}
}
const observer='IntersectionObserver' in window?new IntersectionObserver(entries=>{
 for(const entry of entries){const card=cards.get(entry.target);if(card)visibility(card,entry.isIntersecting);}
},{rootMargin:'240px'}):null;
function card(record,now){
 const item=document.createElement('li'),link=document.createElement('a'),art=document.createElement('div');
 const name=record.name||PRESETS.find(p=>p.id===record.config.preset)?.name||'一盆树';
 link.className='tree-card';link.href='/t/'+encodeURIComponent(record.id);
 link.setAttribute('aria-label',`探望${name}，编号 ${record.id.slice(0,8)}`);
 art.className='tree-art';art.setAttribute('aria-hidden','true');
 const caption=document.createElement('span');caption.className='tree-caption';caption.textContent=record.name||'';
 link.append(art,caption);item.append(link);
 let retry=null;
 const entry={item,art,visible:false,async render(){
  let bitmap=cache.get(entry);
  try{
   if(!bitmap){
    const {svg,paper}=await preview(record,now);
    if(!cards.has(art))return;
    bitmap=await svgBitmap(svg,640,640,{maxSize:640,scale:1});
    if(!cards.has(art)){releaseBitmap(bitmap);return;}
    link.style.setProperty('--card-paper',paper);link.style.setProperty('--caption-ink',captionInk[paper]??'#706858');
   }
   cache.delete(entry);cache.set(entry,bitmap);
   if(entry.visible)art.replaceChildren(bitmap);
   retry?.remove();retry=null;art.setAttribute('aria-hidden','true');trimCache();
  }catch{
   if(!cards.has(art))return;
   art.textContent='预览暂不可用';
   retry?.remove();retry=document.createElement('button');retry.type='button';retry.textContent='重试预览';
   retry.addEventListener('click',()=>{retry.disabled=true;art.replaceChildren();pending.add(entry);scheduleRender();});
   item.append(retry);
  }
 }};return entry;
}

function checkViewport(){
 if(!observer)for(const card of cards.values()){const rect=card.art.getBoundingClientRect();visibility(card,rect.bottom>=-240&&rect.top<=innerHeight+240);}
 const last=grid.lastElementChild;
 if(last&&last.getBoundingClientRect().bottom<innerHeight+600&&hasMore&&!loading)void loadPage();
}
async function loadPage(){
 if(loading||!hasMore)return;
 const current=generation;let loaded=false;loading=true;controller=new AbortController();
 grid.setAttribute('aria-busy','true');status.textContent='正在加载盆栽';
 try{
  const url='/api/gallery?sort=active&q='+encodeURIComponent(query)+(nextCursor?'&cursor='+encodeURIComponent(nextCursor):'');
  const response=await fetch(url,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
  if(!response.ok)throw new Error('Gallery unavailable');
  const data=await response.json();if(current!==generation)return;
  const added=[];
  for(const record of data.trees){if(seen.has(record.id))continue;seen.add(record.id);const entry=card(record,data.serverNow);cards.set(entry.art,entry);added.push(entry);}
  grid.append(...added.map(c=>c.item));added.forEach(c=>observer?.observe(c.art));
  nextCursor=data.nextCursor??null;hasMore=Boolean(nextCursor);
  loaded=true;
  status.textContent=seen.size?'':(query?'没有找到这个名字的盆栽':'暂时没有活跃的盆栽');
 }catch{if(current===generation)status.textContent='暂时无法加载更多盆栽，滚动页面或刷新重试';}
 finally{if(current===generation){loading=false;grid.setAttribute('aria-busy','false');if(loaded)requestAnimationFrame(checkViewport);}}
}
async function reset(){
 generation++;controller?.abort();observer?.disconnect();clearTimeout(renderTimer);renderTimer=undefined;
 for(const bitmap of cache.values())releaseBitmap(bitmap);cache.clear();
 cards.clear();seen.clear();pending.clear();grid.replaceChildren();nextCursor=null;hasMore=true;loading=false;
 cancelPreview?.();
 await loadPage();checkViewport();
}
window.addEventListener('scroll',checkViewport,{passive:true});
window.addEventListener('resize',checkViewport);
window.addEventListener('pageshow',event=>{if(event.persisted)void reset();});
window.addEventListener('pagehide',()=>{cancelPreview?.();stopWorker();});
window.addEventListener('online',()=>{if(hasMore)void loadPage();});
void reset();

function search(){clearTimeout(searchTimer);const value=document.getElementById('name-search').value.trim();if([...value].length>30){status.textContent='搜索名称最多 30 个字符';return;}if(value===query)return;query=value;void reset();}
document.getElementById('gallery-search').addEventListener('submit',event=>{event.preventDefault();search();});
document.getElementById('name-search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(search,250);});
