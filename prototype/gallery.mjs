import {t} from './i18n.mjs';
import {PRESETS} from './core/v1/canopy.mjs';
const captionInk={'#e8dccb':'#706858','#e9f0e5':'#526b55','#f3e8e4':'#805d59','#efe3c9':'#78613c','#e4ebeb':'#526c70','#24323b':'#c5d5da'};
const grid=document.getElementById('gallery-grid'),status=document.getElementById('gallery-status');
let query='',searchTimer;
let generation=0,controller,loading=false,nextCursor=null,hasMore=true;
const seen=new Set();
function card(record){
 const item=document.createElement('li'),link=document.createElement('a'),art=document.createElement('div');
 const name=record.name||t(PRESETS.find(p=>p.id===record.config.preset)?.name||'一盆树');
 link.style.setProperty('--card-paper',record.paper);link.style.setProperty('--caption-ink',captionInk[record.paper]??'#706858');
 link.className='tree-card';link.href='/t/'+encodeURIComponent(record.id);
 link.setAttribute('aria-label',t('探望{name}，编号 {id}',{name,id:record.id.slice(0,8)}));
 art.className='tree-art';art.setAttribute('aria-hidden','true');
 const image=document.createElement('img');image.alt='';image.width=640;image.height=640;
 image.loading='lazy';image.decoding='async';image.src=record.thumbnailUrl;
 const retry=document.createElement('button');retry.type='button';retry.textContent=t('重试预览');retry.hidden=true;
 image.addEventListener('error',()=>{image.hidden=true;retry.hidden=false;});
 image.addEventListener('load',()=>{image.hidden=false;retry.hidden=true;});
 retry.addEventListener('click',()=>{retry.hidden=true;image.src=record.thumbnailUrl+'?retry='+Date.now();});
 const caption=document.createElement('span');caption.className='tree-caption';caption.textContent=record.name||'';
 art.append(image);link.append(art,caption);item.append(link,retry);return item;
}

function checkViewport(){
 const last=grid.lastElementChild;
 if(last&&last.getBoundingClientRect().bottom<innerHeight+600&&hasMore&&!loading)void loadPage();
}
async function loadPage(){
 if(loading||!hasMore)return;
 const current=generation;let loaded=false;loading=true;controller=new AbortController();
 grid.setAttribute('aria-busy','true');status.textContent=t('正在加载盆栽');
 try{
  const url='/api/gallery?preview=1&sort=active&q='+encodeURIComponent(query)+(nextCursor?'&cursor='+encodeURIComponent(nextCursor):'');
  const response=await fetch(url,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
  if(!response.ok)throw new Error('Gallery unavailable');
  const data=await response.json();if(current!==generation)return;
  const added=[];
  for(const record of data.trees){if(seen.has(record.id))continue;seen.add(record.id);added.push(card(record));}
  grid.append(...added);
  nextCursor=data.nextCursor??null;hasMore=Boolean(nextCursor);
  loaded=true;
  status.textContent=seen.size?'':(query?t('没有找到这个名字的盆栽'):t('暂时没有活跃的盆栽'));
 }catch{if(current===generation)status.textContent=t('暂时无法加载更多盆栽，滚动页面或刷新重试');}
 finally{if(current===generation){loading=false;grid.setAttribute('aria-busy','false');if(loaded)requestAnimationFrame(checkViewport);}}
}
async function reset(){
 generation++;controller?.abort();
 seen.clear();grid.replaceChildren();nextCursor=null;hasMore=true;loading=false;
 await loadPage();checkViewport();
}
window.addEventListener('scroll',checkViewport,{passive:true});
window.addEventListener('resize',checkViewport);
window.addEventListener('pageshow',event=>{if(event.persisted)void reset();});
window.addEventListener('online',()=>{if(hasMore)void loadPage();});
const languageSearchKey='bonsai.language-search';
try{
 const value=sessionStorage.getItem(languageSearchKey);sessionStorage.removeItem(languageSearchKey);
 if(value!==null){document.getElementById('name-search').value=value;if([...value.trim()].length<=30)query=value.trim();}
}catch{}
window.addEventListener('beforelanguagechange',()=>{
 try{sessionStorage.setItem(languageSearchKey,document.getElementById('name-search').value);}catch{}
});
void reset();

function search(){clearTimeout(searchTimer);const value=document.getElementById('name-search').value.trim();if([...value].length>30){status.textContent=t('搜索名称最多 30 个字符');return;}if(value===query)return;query=value;void reset();}
document.getElementById('gallery-search').addEventListener('submit',event=>{event.preventDefault();search();});
document.getElementById('name-search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(search,250);});
