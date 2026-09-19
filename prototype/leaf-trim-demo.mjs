import {snapshot,draw,HOUR,applicationFrame} from './growth.mjs';
import {normalizeDesign} from './core/v3/config.mjs';
import {FORMS} from './core/v3/bonsai-language.mjs';
import {CURRENT_VERSION} from './tree-versions.mjs';
import {createLeafTrimming} from './leaf-trimming.mjs';
const $=id=>document.getElementById(id),key='bonsai-leaf-trim-review-1';
let record,at;
try{const saved=JSON.parse(localStorage.getItem(key));if(saved?.record?.version===CURRENT_VERSION&&Number.isFinite(saved.at)){record=saved.record;at=saved.at;}}catch{}
function fresh(preset='juniper'){at=168*HOUR;record={version:CURRENT_VERSION,createdAt:0,revision:0,config:normalizeDesign({preset,seed:crypto.randomUUID(),variation:.55,density:.5}),cuts:[],leafTrims:[]};}
if(!record)fresh();
function save(){try{localStorage.setItem(key,JSON.stringify({record,at}));return true;}catch{return false;}}
function paint(){const tree=snapshot(record,at);$('sample').innerHTML=draw(tree,{transparent:true,viewBox:applicationFrame(tree)});$('form').value=record.config.preset;}
const editor=createLeafTrimming({holder:$('sample'),onSave:async(body,working)=>{const next={...working,revision:record.revision+1};try{localStorage.setItem(key,JSON.stringify({record:next,at}));}catch{throw new Error('浏览器未能保存，请检查本地存储空间后重试。');}record=next;},onClose:paint,onError:error=>{$('note').textContent=error.message;}});
for(const f of FORMS)$('form').add(new Option(f.name,f.id));
$('form').onchange=()=>{fresh($('form').value);save();paint();};$('reset').onclick=()=>{fresh($('form').value);save();paint();};$('grow').onclick=()=>{at+=24*HOUR;save();paint();};$('trim').onclick=event=>editor.open(record,at,event);paint();
