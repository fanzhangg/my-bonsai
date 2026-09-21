// Review-only design vocabulary. The adoption/save pipeline is unchanged.
import {generateTrunkDesign} from './trunk-design.mjs';
import {generateBranchDesign} from './branch-design.mjs';
import {generate as morphology,canopyPoint} from '../v2/morphology.mjs';
import {POT_PRESETS} from '../v2/pots.mjs';
import {STYLIZED_LEAVES} from './stylized-foliage.mjs';
import {diversify} from './bonsai-individual.mjs';

export const FORMS=[
  {id:'juniper',name:'曲干真柏',gesture:'曲',note:'粗干回转，横枝舒展。大小云片错落，转折之间留出呼吸。',crowns:['cloud','cushion','airy'],leaves:['scale'],defaultPalette:'forest',pot:'01'},
  {id:'broom',name:'圆顶榉树',gesture:'圆',note:'短干托起向上的分枝，圆冠外缘相接，内部仍看得见枝序。',crowns:['dome','open','umbrella'],leaves:['oval','round','maple','fan'],defaultPalette:'spring',pot:'01'},
  {id:'literati',name:'文人松',gesture:'疏',note:'一条清瘦长线，几处偏置小冠。用大留白衬托枝梢的轻。',crowns:['airy','cloud'],leaves:['needle'],defaultPalette:'forest',pot:'02'},
  {id:'pine',name:'直干黑松',gesture:'立',note:'主干挺拔收尖，下枝宽厚，上枝短而轻，形成不对称的三角势。',crowns:['cloud','cushion'],leaves:['needle'],defaultPalette:'forest',pot:'03'},
  {id:'slant',name:'斜干松',gesture:'斜',note:'主干倾斜，低枝向反侧回拉。偏冠与盆器共同稳住重心。',crowns:['cloud','airy'],leaves:['needle'],defaultPalette:'forest',pot:'01'},
  {id:'cascade',name:'悬崖真柏',gesture:'垂',note:'从盆口抬头，再转折垂落。叶团沿外弯渐小，露出下行干线。',crowns:['cloud','cushion'],leaves:['scale'],defaultPalette:'forest',pot:'04'},
  {id:'windswept',name:'风吹松',gesture:'风',note:'干、枝、叶向同一方向舒展。迎风侧留空，顺风侧长而有节奏。',crowns:['stream','airy'],leaves:['needle'],defaultPalette:'forest',pot:'01'}
];
for(const form of FORMS){form.naturalLeaves=[...form.leaves];if(!form.naturalLeaves.includes('needle'))form.leaves.push(...Object.keys(STYLIZED_LEAVES));}
export const CROWNS={
  cloud:{name:'错落云片',note:'横向呼应，柔和起伏',x:1,y:1,rough:1},
  cushion:{name:'饱满团冠',note:'缩短横展，增加厚度',x:.93,y:1.22,rough:.8},
  airy:{name:'疏朗小冠',note:'收小叶团，露出枝线',x:.84,y:.90,rough:.85},
  dome:{name:'自然圆顶',note:'向上聚合，外缘连贯',x:1,y:1.08,rough:.85},
  open:{name:'透光圆冠',note:'叶团稍疏，枝序更清晰',x:.87,y:.95,rough:.9},
  umbrella:{name:'舒展伞冠',note:'横展圆肩，保留圆润厚度',x:1.10,y:.90,rough:.8},
  stream:{name:'顺风层冠',note:'顺势拉长，层层错位',x:1.06,y:.92,rough:.85}
};
export const LEAVES={scale:'短鳞叶',needle:'针叶束',oval:'椭圆叶',round:'圆叶',maple:'掌状叶',fan:'扇形叶',...Object.fromEntries(Object.entries(STYLIZED_LEAVES).map(([id,style])=>[id,style.name]))};
// Each row is a depth group; each column is shadow / body / light / accent.
// Deliberately curated ramps keep depth readable without algorithmic color drift.
export const PALETTES={
  sakura:{name:'樱雪粉',note:'豆沙粉暗部、浅樱粉与奶白高光',stylized:true,scene:{background:'#f5eeeb',bark:'#70545c',body:'#c8adb0',rim:'#f2e2de',moss:'#9b9e81'},layers:[['#aa697d','#cf91a2','#e8b7c2','#f6d7de'],['#c38a9b','#e2adba','#f3cdd5','#fce7eb'],['#d8a6b2','#efc7d0','#fae2e6','#fff4f3']]},
  lilac:{name:'暮光紫',note:'蓝紫暗部、鸢尾紫与柔雾丁香色',stylized:true,scene:{background:'#eeedf5',bark:'#595164',body:'#9695b4',rim:'#d7d4e8',moss:'#8e9a91'},layers:[['#504b83','#7265a6','#9887c4','#baadda'],['#6b5998','#9278b9','#b29ace','#d5c6e6'],['#8c73b0','#b19aca','#d0bfe2','#eee1f5']]},
  candy:{name:'薄荷糖',note:'薄荷青、开心果绿与奶油色高光',stylized:true,scene:{background:'#eef2e9',bark:'#666750',body:'#cebaa4',rim:'#f2e5d3',moss:'#90a080'},layers:[['#487a72','#70a598','#9cc6af','#c4dfc7'],['#689a82','#93bea0','#bfd9b4','#e0ebce'],['#91b294','#bbd2ac','#dbe6c4','#f7f3dc']]},
  forest:{name:'苔林',note:'沉静的深绿与暖绿',layers:[['#2c4938','#41664b','#597d59','#789569'],['#365139','#52764e','#6b905f','#8ba875'],['#485e3b','#6c8954','#87a466','#a2bb7e']]},
  mist:{name:'青雾',note:'低饱和的冷绿与灰绿',layers:[['#344c48','#49645b','#658071','#8a9d86'],['#405a4e','#5c7965','#79947a','#a0b293'],['#52664e','#788e69','#97aa82','#b6c19d']]},
  spring:{name:'新绿',note:'嫩叶明亮，暗部仍有重量',layers:[['#34543b','#4c7149','#719360','#94af7b'],['#42613d','#668850','#8baa67','#acc58a'],['#586e3e','#809b57','#a5bc77','#c6d798']]},
  amber:{name:'秋金',note:'赭色暗部与温润金叶',layers:[['#665036','#887040','#aa904f','#c6af70'],['#806036','#a98540','#c7a65b','#dfc581'],['#94713b','#bb994d','#d8b96c','#ead397']]},
  ruby:{name:'枫红',note:'酒红暗部与珊瑚亮面',layers:[['#583936','#7e4840','#a46854','#bf8b70'],['#733e38','#a25a49','#c78264','#dda486'],['#8b5140','#b97455','#d89c73','#e9bc95']]}
};
export function selection(input={}){
  const form=FORMS.find(f=>f.id===input.preset)??FORMS[0];
  return {form,crown:form.crowns.includes(input.crown)?input.crown:form.crowns[0],
    leaf:form.leaves.includes(input.leaf)?input.leaf:form.leaves[0],
    palette:Object.hasOwn(PALETTES,input.palette)?input.palette:form.defaultPalette};
}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const tint=(hex,amount,stylized=false)=>{
  const target=stylized?(amount>0?[255,247,252]:[52,42,67]):amount>0?[242,239,205]:[23,38,28];
  return '#'+hex.slice(1).match(/../g).map((v,i)=>Math.round(parseInt(v,16)*(1-Math.abs(amount))+target[i]*Math.abs(amount)).toString(16).padStart(2,'0')).join('');
};

function crownBottom(c,x){
  const rim=Array.from({length:128},(_,i)=>canopyPoint(c,i*Math.PI/64,.94)),hits=[];
  for(let i=0;i<rim.length;i++){
    const a=rim[i],b=rim[(i+1)%rim.length];
    if((a.x<=x&&b.x>x)||(b.x<=x&&a.x>x))hits.push(a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x));
  }
  return hits;
}
function anchorCrown(c,n){
  const hits=crownBottom(c,n.ex);
  if(hits.length)c.y=n.ey-(Math.max(...hits)-c.y)+Math.min(3,c.ry*.2);
}
export function crownCoversTip(c,n){
  if(Math.abs(c.x-n.ex)>c.rx*1.4||Math.abs(c.y-n.ey)>c.ry*1.4)return false;
  const hits=crownBottom(c,n.ex),y=n.ey-1;
  return hits.length>=2&&y>=Math.min(...hits)&&y<=Math.max(...hits);
}

// Only fine shoots carry mature foliage. Structural branches may end below
// their leafy shoots; covering those ends creates extra crowns inside the tree.
function coverExposedTips(tree){
  for(const n of tree.nodes){
    if(n.role!=='twig')continue;
    const family=tree.clusters.filter(c=>c.pad===n.pad);
    if(family.some(c=>crownCoversTip(c,n)))continue;
    const candidates=family.length?family:tree.clusters;
    const nearest=candidates.reduce((best,c)=>!best||Math.hypot(c.x-n.ex,c.y-n.ey)<Math.hypot(best.x-n.ex,best.y-n.ey)?c:best,null);
    if(!nearest)continue;
    const c={...nearest,key:`tip-crown:${n.id}`,node:n.id,pad:n.pad,
      x:n.ex,y:n.ey,rx:clamp(nearest.rx*.62,14,34),
      ry:clamp(nearest.ry*.68,10,25),
      contour:{...nearest.contour,skew:nearest.contour.skew*.5},terminalCrown:true};
    anchorCrown(c,n);tree.clusters.push(c);
  }
}

export function generateLanguage(input={}){
  const {form,crown,leaf,palette}=selection(input);
  const config={...input,preset:form.id,seed:input.seed??'DESIGN-SYSTEM-01',
    crownCount:form.id==='literati'?3:undefined,
    appearance:{shape:leaf,bark:palette==='ruby'?'charcoal':'natural'}};
  const tree=form.id==='juniper'?generateTrunkDesign(config):generateBranchDesign(config,{allForms:true});
  if(leaf==='maple'||leaf==='fan')tree.preset={...tree.preset,name:leaf==='maple'?'圆顶枫树':'圆顶银杏'};
  tree.config.pot=POT_PRESETS.find(p=>p.id===form.pot);
  tree.crownWoodDepth??={};
  const layers=[1,2,0,1,0,2,1];
  if(form.id!=='juniper'){
    // Preserve each trained tree's gesture. The extension changes the strength
    // of its lines and distributed foliage, not the identity of its scaffold.
    for(const n of tree.nodes){
      if(n.role==='trunk')continue;
      const parent=tree.nodes.find(p=>p.id===n.parent);
      const local=parent.width+(parent.tipWidth-parent.width)*n.attachment;
      const ratio=n.role==='bough'?.78:n.role==='primary'?.68:.66;
      n.width=Math.min(local*.88,Math.max(n.width,local*ratio));
      n.tipWidth=n.width*(n.role==='twig'?.62:.70);
    }
    const original=morphology(config);
    tree.clusters=original.clusters.map(c=>{
      const tips=tree.nodes.filter(n=>n.pad===c.pad&&n.role==='twig');
      const n=tips.reduce((best,n)=>Math.hypot(c.x-n.ex,c.y-n.ey)<Math.hypot(c.x-best.ex,c.y-best.ey)?n:best);
      const dx=c.x-n.ex,dy=c.y-n.ey;
      const distance=Math.hypot(dx/c.rx,dy/c.ry),reach=Math.min(1,.68/Math.max(.001,distance));
      const layer=layers[tree.pads.findIndex(p=>p.id===c.pad)]??1;
      return {...c,node:n.id,x:n.ex+dx*reach,y:n.ey+dy*reach,ry:c.ry*(form.id==='broom'?1:1.16),crownLayer:layer,crownSun:-1};
    });
    for(const n of tree.nodes)if(n.role!=='trunk')tree.crownWoodDepth[n.id]=(layers[tree.pads.findIndex(p=>p.id===n.pad)]??1)*2-2;
  }
  diversify(tree,input);
  const nodes=new Map(tree.nodes.map(n=>[n.id,n])),style=CROWNS[crown];
  const extent=Math.max(1,...tree.clusters.map(c=>Math.abs(c.x-tree.root.x)));
  for(const c of tree.clusters){
    const n=nodes.get(c.node);
    c.rx*=style.x;c.ry*=style.y;c.contour={...c.contour,rough:c.contour.rough*style.rough};
    // The underside enters the actual supporting tip. The change in leaf
    // volume must not leave a detached crown or swallow the primary branch.
    if(tree.individual||form.id!=='juniper'||crown!=='cloud'){
      anchorCrown(c,n);
    }
  }
  if(tree.individual)coverExposedTips(tree);
  for(const c of tree.clusters){
    const n=nodes.get(c.node),age=tree.pads.find(p=>p.id===c.pad)?.age??.5;
    if(tree.individual||form.id!=='juniper'||palette!=='forest'){
      const tone=clamp((.5-age)*.14-(n.ex-tree.root.x)/extent*.045,-.10,.10);
      c.layerPalette=PALETTES[palette].layers[c.crownLayer??1].map(color=>tint(color,tone,PALETTES[palette].stylized));
    }
    c.z=(c.crownLayer??1)*2-2+.05;
  }
  tree.crownDesign='language-1';tree.crownProtectWood=true;
  tree.language={form:form.id,crown,leaf,palette};
  return tree;
}

// A stable mature frame for every growth stage; include hanging cascades.
export function languageFrame(tree){
  const xs=[tree.root.x-155,tree.root.x+155],ys=[tree.root.y+180];
  for(const n of tree.nodes)for(const [x,y]of [['x','y'],['cx1','cy1'],['cx2','cy2'],['ex','ey']]){xs.push(n[x]-n.width,n[x]+n.width);ys.push(n[y]-n.width,n[y]+n.width);}
  for(const c of tree.clusters){xs.push(c.x-c.rx*1.3-12,c.x+c.rx*1.3+12);ys.push(c.y-c.ry*1.3-14,c.y+c.ry*1.3+14);}
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const size=Math.max(600,maxX-minX+55,maxY-minY+60);
  return {x:(minX+maxX-size)/2,y:(minY+maxY-size)/2,width:size,height:size};
}
