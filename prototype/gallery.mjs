import {snapshot,draw} from './growth.mjs';
import {PRESETS} from './core/v1/canopy.mjs';
// Muted ink follows the rendered paper color, including legacy night palettes.
const captionInk={'#e8dccb':'#706858','#e9f0e5':'#526b55','#f3e8e4':'#805d59','#efe3c9':'#78613c','#e4ebeb':'#526c70','#24323b':'#c5d5da'};
const grid=document.getElementById('gallery-grid'),status=document.getElementById('gallery-status');
let query='',searchTimer;
let generation=0,controller,loading=false,nextCursor=null,hasMore=true,renderTimer;
const cards=new Map(),seen=new Set(),pending=new Set();
function scheduleRender(){
 if(renderTimer!==undefined||!pending.size)return;
 // Yield between trees: an entire row must not monopolize the main thread.
 renderTimer=setTimeout(()=>{
  renderTimer=undefined;const card=pending.values().next().value;pending.delete(card);
  if(card&&cards.has(card.art))card.render();scheduleRender();
 },0);
}
function visibility(card,visible){
 if(visible){if(!card.art.firstChild){pending.add(card);scheduleRender();}}
 else{pending.delete(card);card.art.replaceChildren();}
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
 return {item,art,render(){try{art.innerHTML=draw(snapshot(record,now),{transparent:false,id:`gallery-${record.id}`});const svg=art.firstElementChild;
  // Gallery paper is a presentation override; published tree renderers stay unchanged.
  if(svg.style.backgroundColor==='rgb(250, 249, 243)'){
   svg.style.backgroundColor='#e8dccb';
   for(const child of svg.children)if(child.tagName==='rect'&&child.getAttribute('fill')==='#faf9f3')child.setAttribute('fill','#e8dccb');
  }
  const background=svg.style.backgroundColor;link.style.setProperty('--card-paper',background);const probe=document.createElement('span');for(const [paper,ink] of Object.entries(captionInk)){probe.style.backgroundColor=paper;if(probe.style.backgroundColor===background){link.style.setProperty('--caption-ink',ink);break;}}}catch{observer?.unobserve(art);cards.delete(art);item.remove();}}};
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
 cards.clear();seen.clear();pending.clear();grid.replaceChildren();nextCursor=null;hasMore=true;loading=false;
 await loadPage();checkViewport();
}
window.addEventListener('scroll',checkViewport,{passive:true});
window.addEventListener('resize',checkViewport);
window.addEventListener('pageshow',event=>{if(event.persisted)void reset();});
window.addEventListener('online',()=>{if(hasMore)void loadPage();});
void reset();

function search(){clearTimeout(searchTimer);const value=document.getElementById('name-search').value.trim();if([...value].length>30){status.textContent='搜索名称最多 30 个字符';return;}if(value===query)return;query=value;void reset();}
document.getElementById('gallery-search').addEventListener('submit',event=>{event.preventDefault();search();});
document.getElementById('name-search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(search,250);});
