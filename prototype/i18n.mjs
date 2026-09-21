import {english} from './locales/en.mjs';

export const LANGUAGE_KEY='bonsai.language';
export function resolveLanguage(saved,languages=[]){
 if(saved==='zh'||saved==='en')return saved;
 for(const language of languages){
  const base=String(language).toLowerCase().split(/[-_]/)[0];
  if(base==='zh'||base==='en')return base;
 }
 return 'en';
}
export function detectLanguage(){
 const requested=typeof location!=='undefined'?new URLSearchParams(location.search).get('lang'):null;
 if(requested==='zh'||requested==='en')return requested;
 let saved;try{saved=globalThis.localStorage?.getItem(LANGUAGE_KEY);}catch{}
 return resolveLanguage(saved,globalThis.navigator?.languages??[globalThis.navigator?.language]);
}
// Server-side renderers retain their existing Chinese default, independent of host locale.
export const language=typeof window==='undefined'?'zh':detectLanguage();
export function translate(key,values={},locale=language){
 const message=locale==='en'&&Object.hasOwn(english,key)?english[key]:key;
 return message.replace(/\{(\w+)\}/g,(match,name)=>Object.hasOwn(values,name)?String(values[name]):match);
}
export const t=translate;
export function localizedError(message){
 const translated=t(message||'暂时无法连接');
 return language==='en'&&/[\u3400-\u9fff]/u.test(translated)?t('暂时无法保存，请稍后重试'):translated;
}

// Only explicitly marked application copy is translated, never names or inputs.
export function localize(root=document,locale=language){
 for(const node of root.querySelectorAll('[data-i18n]'))node.textContent=translate(node.dataset.i18n,{},locale);
 for(const attr of ['aria-label','title','placeholder']){
  for(const node of root.querySelectorAll(`[data-i18n-${attr}]`))node.setAttribute(attr,translate(node.getAttribute(`data-i18n-${attr}`),{},locale));
 }
}
if(typeof document!=='undefined'){
 window.addEventListener('pageshow',event=>{if(event.persisted&&detectLanguage()!==language)location.reload();});
 document.documentElement.lang=language==='zh'?'zh-CN':'en';
 localize();
 if(document.title==='我的盆栽')document.title=t('我的盆栽');
 const select=document.getElementById('language');
 if(select){
  let saved;try{saved=localStorage.getItem(LANGUAGE_KEY);}catch{}
  const requested=new URLSearchParams(location.search).get('lang');
  select.value=['zh','en'].includes(requested)?requested:['zh','en'].includes(saved)?saved:'auto';
  select.addEventListener('change',()=>{
   window.dispatchEvent(new Event('beforelanguagechange'));
   try{
    if(select.value==='auto')localStorage.removeItem(LANGUAGE_KEY);
    else localStorage.setItem(LANGUAGE_KEY,select.value);
   }catch{
    const url=new URL(location.href);
    if(select.value==='auto')url.searchParams.delete('lang');else url.searchParams.set('lang',select.value);
    location.assign(url);return;
   }
   // Existing beforeunload protection also protects unsaved edits here.
   const url=new URL(location.href);url.searchParams.delete('lang');location.assign(url);
  });
 }
}
