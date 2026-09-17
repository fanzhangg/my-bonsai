import {PRESETS,normalize} from './core/v1/canopy.mjs';
import {grow,profile,draw} from './growth.mjs';
import {startWeather} from './weather.mjs';
import {startWind} from './wind.mjs';
const $=id=>document.getElementById(id);
const weather=startWeather({debug:true,preview:true}),wind=startWind($('stage'));
for(const p of PRESETS)$('motion-tree').add(new Option(p.name,p.id));
const descriptions={clear:'白天是柔和的天空渐变；晴朗夜晚出现轻轻闪烁的星星。',cloudy:'偏灰的天空渐变，呈现安静的阴天气氛。',rain:'半透明灰色雨线斜向落下，在接近地面时逐渐消失。',snow:'雪花随风缓缓飘落，接近地面时逐渐消失。',fog:'低饱和背景呈现雾天气氛，不叠加光雾。',wind:'长弧形风线掠过，细枝与叶片摆幅稍增。',storm:'灰色雨线更密、更快，接近地面时淡出，配合稍强的枝叶摆动。'};
function paint(){const record={createdAt:0,config:normalize({preset:$('motion-tree').value,seed:'MOTION-DESIGN-01'})};const tree=grow(record,$('motion-age').value==='young'?profile(record).initial:1);weather.setTree(tree);$('stage').innerHTML=draw(tree,{transparent:true});wind.refresh();}
$('motion-tree').addEventListener('change',paint);$('motion-age').addEventListener('change',paint);
function describe(){$('motion-description').textContent=descriptions[$('weather-kind').value];}
$('weather-kind').addEventListener('change',describe);paint();describe();
