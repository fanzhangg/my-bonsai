import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolveLanguage,detectLanguage,translate,localize} from '../prototype/i18n.mjs';
import {english} from '../prototype/locales/en.mjs';
import {shareData} from '../prototype/share-data.mjs';
import {growthStatus} from '../prototype/growth-status.mjs';

test('saved choice wins; browser preferences use the first supported language and accept regional variants',()=>{
 assert.equal(resolveLanguage('en',['zh-CN']),'en');
 assert.equal(resolveLanguage('zh',['en-US']),'zh');
 for(const locale of ['zh-CN','zh-TW','zh-Hant-HK','ZH_hans'])assert.equal(resolveLanguage(null,[locale]),'zh');
 assert.equal(resolveLanguage(null,['fr-FR','en-GB','zh-CN']),'en');
 assert.equal(resolveLanguage('invalid',['fr-FR','zh-TW','en-US']),'zh');
 assert.equal(resolveLanguage(null,['ja-JP']),'en');
 assert.equal(resolveLanguage(null,[]),'en');
});

test('blocked preference storage still falls back to browser language',t=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('blocked');}});
 const nav=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{languages:['fr','zh-HK']}});
 t.after(()=>{
  if(previous)Object.defineProperty(globalThis,'localStorage',previous);else delete globalThis.localStorage;
  if(nav)Object.defineProperty(globalThis,'navigator',nav);else delete globalThis.navigator;
 });
 assert.equal(detectLanguage(),'zh');
});

test('interpolation preserves names and literal markup without interpreting nested placeholders',()=>{
 const name='我的盆栽 <img> {id}';
 assert.equal(translate('探望{name}，编号 {id}',{name,id:'123'},'en'),`Visit ${name}, ID 123`);
 assert.equal(translate('探望{name}，编号 {id}',{name,id:'123'},'zh'),`探望${name}，编号 123`);
 assert.equal(translate('unknown',{},'en'),'unknown');
});

test('DOM localization only targets marked application copy',()=>{
 const user={textContent:'认领我'},button={dataset:{i18n:'认领我'},textContent:''};
 const root={querySelectorAll(selector){return selector==='[data-i18n]'?[button]:[];}};
 localize(root,'en');
 assert.equal(button.textContent,'Adopt me');assert.equal(user.textContent,'认领我');
});

test('English sharing preserves user names and canonical URLs; Chinese remains the server default',()=>{
 const record={id:'test-id',name:'小树 <b>Oak</b>'};
 const en=shareData(record,'https://example.com',120000,'en');
 const zh=shareData(record,'https://example.com',120000);
 assert.equal(en.title,'Come see my bonsai: 小树 <b>Oak</b>');
 assert.equal(en.text,'Water my bonsai and watch it grow with me.');
 assert.equal(en.url,zh.url);assert.equal(en.image,zh.image);
 assert.match(zh.title,/快来看/);
});

test('growth summaries localize counts and retain Chinese compatibility',()=>{
 const tree={recovery:[{},{}]};
 assert.equal(growthStatus(tree,'en'),'2 areas preparing new growth');
 assert.equal(growthStatus(tree),'2 处正在准备新生长');
 const gradual={gradualGrowth:true,branchRanges:[{level:1,count:2,min:1,ideal:2,max:3}]};
 assert.doesNotMatch(growthStatus(gradual,'en'),/[一-龥]/);
});

test('every marked page message and explicit translated UI string has an English entry',async()=>{
 for(const name of ['index.html','gallery.html','mvp.mjs','gallery.mjs','pruning.mjs','watering.mjs','visitors.mjs','weather.mjs','share.mjs','leaf-trimming.mjs','growth-status.mjs']){
  const source=await readFile(new URL('../prototype/'+name,import.meta.url),'utf8');
  const keys=[...source.matchAll(/data-i18n(?:-aria-label|-title|-placeholder)?="([^"]+)"/g),...source.matchAll(/\bt\('([^']+)'/g)];
  for(const [,key] of keys)assert.ok(Object.hasOwn(english,key),`${name}: missing ${key}`);
 }
});
