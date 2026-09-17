// Appearance is independent of branch generation and seeded cluster placement.
export const SHAPES=[{id:'auto',name:'随树种'},{id:'round',name:'圆叶'},{id:'oval',name:'椭圆叶'},{id:'lance',name:'细长叶'},{id:'maple',name:'掌状叶'},{id:'fan',name:'扇形叶'},{id:'needle',name:'针叶束'},{id:'scale',name:'短鳞叶'}];
export const FOLIAGE=[
  {id:'native',name:'原生绿',colors:['#335746','#486c51','#61815a','#7f9668']},
  {id:'jade',name:'嫩玉绿',colors:['#2f654e','#478965','#71ab7b','#a5c991']},
  {id:'ruby',name:'枫叶红',colors:['#682e38','#963e45','#bd5955','#dd8270']},
  {id:'gold',name:'银杏金',colors:['#8b692d','#b88c35','#d6ad4e','#e8cc7d']},
  {id:'sage',name:'雾青绿',colors:['#48655f','#64847a','#88a296','#aec0ae']},
  {id:'blue',name:'月光蓝',colors:['#365c65','#4c7f88','#76a3a7','#b0c9c4']}
];
export const BARK=[{id:'natural',name:'原木棕',color:'#6a5b48'},{id:'umber',name:'深胡桃',color:'#514336'},{id:'copper',name:'赤褐',color:'#885b49'},{id:'ash',name:'灰白木',color:'#b0a793'},{id:'charcoal',name:'炭灰',color:'#4c5552'}];
export const BACKGROUNDS=[{id:'ivory',name:'暖纸白',color:'#faf9f3'},{id:'mint',name:'浅苔绿',color:'#e9f0e5'},{id:'rose',name:'淡藕粉',color:'#f3e8e4'},{id:'sand',name:'暖砂色',color:'#efe3c9'},{id:'fog',name:'雾灰蓝',color:'#e4ebeb'},{id:'night',name:'深夜蓝',color:'#24323b'}];
export const LOOKS=[
  {id:'original',name:'原色',note:'自然叶形 · 原木 · 暖纸白',shape:'auto',foliage:'native',bark:'natural',background:'ivory'},
  {id:'spring',name:'春芽',note:'圆叶 · 嫩玉绿 · 浅苔绿',shape:'round',foliage:'jade',bark:'umber',background:'mint'},
  {id:'autumn',name:'枫红',note:'掌状叶 · 枫叶红 · 淡藕粉',shape:'maple',foliage:'ruby',bark:'charcoal',background:'rose'},
  {id:'golden',name:'金秋',note:'扇形叶 · 银杏金 · 暖砂色',shape:'fan',foliage:'gold',bark:'umber',background:'sand'},
  {id:'mist',name:'青雾',note:'细长叶 · 雾青绿 · 雾灰蓝',shape:'lance',foliage:'sage',bark:'copper',background:'fog'},
  {id:'moon',name:'月夜',note:'针叶束 · 月光蓝 · 灰白木',shape:'needle',foliage:'blue',bark:'ash',background:'night'}
];
export function normalizeAppearance(a={}){
  a=a&&typeof a==='object'?a:{};
  return {shape:SHAPES.some(x=>x.id===a.shape)?a.shape:'auto',foliage:FOLIAGE.some(x=>x.id===a.foliage)?a.foliage:'native',bark:BARK.some(x=>x.id===a.bark)?a.bark:'natural',background:BACKGROUNDS.some(x=>x.id===a.background)?a.background:'ivory'};
}
export function lookFor(a){const n=normalizeAppearance(a);return LOOKS.find(l=>Object.keys(n).every(k=>l[k]===n[k]));}
export function appearanceName(a){return lookFor(a)?.name??'自选搭配';}
export function colorsFor(a){const n=normalizeAppearance(a);return {background:BACKGROUNDS.find(b=>b.id===n.background).color,bark:BARK.find(b=>b.id===n.bark).color,foliage:FOLIAGE.find(b=>b.id===n.foliage).colors};}
