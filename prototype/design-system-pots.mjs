// Review-only design vocabulary. Production tree records/rendering are unchanged.
export const TONES = [
  {id:'sand',name:'砂白',body:'#c9bca5',rim:'#e6dece',ink:'#746b5b'},
  {id:'celadon',name:'青瓷',body:'#9daa95',rim:'#c6d0bd',ink:'#526b57'},
  {id:'clay',name:'赤陶',body:'#b8806d',rim:'#d5a493',ink:'#754c3e'},
  {id:'ink',name:'墨蓝',body:'#637380',rim:'#92a2ae',ink:'#d6dedf'},
  {id:'porcelain',name:'瓷白',body:'#deded2',rim:'#efeee5',ink:'#6e8ba6'},
  {id:'rose',name:'雾粉',body:'#d0a69c',rim:'#e6c9be',ink:'#8c615b'},
  {id:'moss',name:'苔绿',body:'#8b9371',rim:'#b9bd9d',ink:'#eeead8'},
  {id:'ochre',name:'暖黄',body:'#cbb373',rim:'#e4d09d',ink:'#f8f0d8'}
];
export const SHAPES = [
  {id:'oval',name:'浅椭圆',width:176,height:36,note:'低矮横展 · 柔和收底'},
  {id:'bowl',name:'圆腹',width:148,height:66,note:'弧线饱满 · 圆润重心'},
  {id:'rect',name:'折方',width:176,height:43,note:'折角盆口 · 内收直壁'},
  {id:'tall',name:'高筒',width:98,height:105,note:'纵向比例 · 悬枝留白'},
  {id:'soft',name:'圆角长方',width:176,height:49,note:'横向展开 · 圆角侧壁'},
  {id:'petal',name:'花瓣',width:154,height:62,note:'浅波浪口 · 圆弧盆腹'},
  {id:'hex',name:'六角',width:144,height:67,note:'折线外沿 · 两侧收角'},
  {id:'roundrect',name:'圆角方',width:146,height:58,note:'宽高平衡 · 圆角收底'}
];
export const PATTERNS = [
  {id:'plain',name:'素面',note:'仅保留盆口与轮廓'},
  {id:'vertical',name:'竖纹',note:'四根线 · 顺应盆壁'},
  {id:'mountain',name:'山岚',note:'三座山 · 一朵云'},
  {id:'bands',name:'横纹',note:'两条线 · 绕过正面'},
  {id:'geometric',name:'几何',note:'半圆与方块 · 三枚图形'}
];
export const POT_PRESETS = [
  {id:'01',name:'砂白浅椭圆',shape:'oval',tone:'sand',pattern:'plain'},
  {id:'02',name:'青瓷圆腹',shape:'bowl',tone:'celadon',pattern:'plain'},
  {id:'03',name:'赤陶折方',shape:'rect',tone:'clay',pattern:'plain'},
  {id:'04',name:'墨蓝高筒',shape:'tall',tone:'ink',pattern:'vertical'},
  {id:'05',name:'青花山岚',shape:'soft',tone:'porcelain',pattern:'mountain'},
  {id:'06',name:'雾粉花瓣',shape:'petal',tone:'rose',pattern:'plain'},
  {id:'07',name:'苔绿横纹',shape:'hex',tone:'moss',pattern:'bands'},
  {id:'08',name:'暖黄几何',shape:'roundrect',tone:'ochre',pattern:'geometric'}
];
export function potMarkup({shape='oval',tone='sand',pattern='plain'}={},x=0,y=0,id='review-pot'){
  const s=SHAPES.find(s=>s.id===shape)||SHAPES[0],base=TONES.find(t=>t.id===tone)||TONES[0];
  const t={body:`var(--review-pot-body,${base.body})`,rim:`var(--review-pot-rim,${base.rim})`,ink:`var(--review-pot-pattern,${base.ink})`};
  const w=s.width/2,h=s.height;
  let body,lip;
  if(s.id==='oval')body=`M${-w} 0 C${-w} ${h*.85} ${-w*.6} ${h} 0 ${h} S${w} ${h*.85} ${w} 0Z`;
  else if(s.id==='bowl')body=`M${-w} 0 C${-w*1.12} ${h*.68} ${-w*.65} ${h} 0 ${h} S${w*1.12} ${h*.68} ${w} 0Z`;
  else if(s.id==='rect')body=`M${-w} 0 L${-w*.82} ${h} Q0 ${h+3} ${w*.82} ${h} L${w} 0Z`;
  else if(s.id==='tall')body=`M${-w} 0 L${-w*.82} ${h-5} Q0 ${h+5} ${w*.82} ${h-5} L${w} 0Z`;
  else if(s.id==='hex')body=`M${-w} 0 L${-w*.9} ${h*.82} L${-w*.55} ${h} H${w*.55} L${w*.9} ${h*.82} L${w} 0Z`;
  else if(s.id==='petal')body=`M${-w} 0 C${-w*.94} ${h*.78} ${-w*.57} ${h} 0 ${h} S${w*.94} ${h*.78} ${w} 0 L${w} -4 Q${w*.82} -15 ${w*.65} -4 Q${w*.4} -17 ${w*.2} -5 Q0 -17 ${-w*.2} -5 Q${-w*.4} -17 ${-w*.65} -4 Q${-w*.82} -15 ${-w} -4Z`;
  else body=`M${-w} 0 V${h*.37} Q${-w} ${h} ${-w*.6} ${h} H${w*.6} Q${w} ${h} ${w} ${h*.37} V0Z`;
  if(['rect','hex'].includes(s.id))lip=`<path d="M${-w} 0 L${-w*.78} -11 H${w*.78} L${w} 0 L${w*.8} 9 H${-w*.8}Z" fill="${t.rim}"/><path d="M${-w+8} -1 L${-w*.76} -7 H${w*.76} L${w-8} -1 L${w*.77} 5 H${-w*.77}Z" fill="#505141"/>`;
  else lip=`<ellipse rx="${w}" ry="9" fill="${t.rim}"/><ellipse cy="-1" rx="${w-7}" ry="5.8" fill="#505141"/>`;
  const cx=w*.5,mid=h*.47;
  let decor='';
  if(pattern==='vertical')decor=[-.58,-.2,.2,.58].map(a=>`<path d="M${w*a} 14 L${w*a*.88} ${h-11}"/>`).join('');
  if(pattern==='bands')decor=`<path d="M${-w} ${h*.37} Q0 ${h*.48} ${w} ${h*.37} M${-w} ${h*.58} Q0 ${h*.69} ${w} ${h*.58}"/>`;
  if(pattern==='mountain')decor=`<path d="M${-cx} ${mid+9} l${w*.2} -12 l${w*.2} 12 m${-w*.14} -4 l${w*.22} -15 l${w*.3} 19 M${w*.25} ${mid-6} q-6 -5 0 -7 q4 -8 10 -2 q9 -1 9 4 q0 5 -19 5Z"/>`;
  if(pattern==='geometric')decor=`<path d="M${-cx-5} ${mid-6} a8 8 0 0 1 0 16Z M${cx+5} ${mid-6} a8 8 0 0 0 0 16Z" fill="${t.ink}" stroke="none"/><rect x="-7" y="${mid-6}" width="14" height="14" fill="${t.ink}" stroke="none"/>`;
  const seam=s.id==='petal'?`<path d="M-27 14 Q-23 36 -12 49 M27 14 Q23 36 12 49" fill="none" stroke="${t.rim}" stroke-width="2"/>`:'';
  return `<g data-review-pot="${s.id}" transform="translate(${x} ${y})"><defs><clipPath id="${id}"><path d="${body}"/></clipPath></defs><path d="${body}" fill="${t.body}"/><g clip-path="url(#${id})" fill="none" stroke="${t.ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${decor}</g>${seam}${lip.replaceAll('fill="#505141"','fill="var(--bonsai-soil,#505141)"')}<ellipse cy="-1" rx="${w*.68}" ry="3.5" fill="var(--bonsai-moss,#76815e)"/></g>`;
}
export function potSvg(config,id='pot-thumbnail'){
  return `<svg viewBox="-115 -27 230 150" role="img" aria-label="${SHAPES.find(s=>s.id===config.shape)?.name||'盆器'}">${potMarkup(config,0,0,id)}</svg>`;
}
