import {PALETTES} from './core/v3/bonsai-language.mjs';
import {colorsFor,normalizeAppearance} from './core/v1/appearance.mjs';
import {TONES,normalizePot} from './pots.mjs';
const rgb=c=>c.slice(1).match(/../g).map(v=>parseInt(v,16));
export function mix(a,b,t){const x=rgb(a),y=rgb(b);return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('');}
export function luminance(c){return rgb(c).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);}
export function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
// Keep the material hue; shift only as far as required for its local backdrop.
function readable(color,bg,ratio){if(contrast(color,bg)>=ratio)return color;let end=contrast('#050b08',bg)>contrast('#fdfef9',bg)?'#050b08':'#fdfef9';if(contrast(end,bg)<ratio)end=contrast('#000000',bg)>contrast('#ffffff',bg)?'#000000':'#ffffff';for(let i=1;i<=100;i++){const c=mix(color,end,i/100);if(contrast(c,bg)>=ratio)return c;}return end;}
export function potColorTokens(scene,toneId){
 const tone=TONES.find(t=>t.id===toneId)||TONES[0],ground=mix(scene.colors[1],scene.colors[2],.45);
 const body=readable(tone.body,ground,2);
 return {'bonsai-vessel-body':body,'bonsai-vessel-rim':readable(tone.rim,ground,2),'bonsai-vessel-pattern':readable(tone.ink,body,1.65)};
}
export function colorTokens(scene,appearance={},preset={},potDesign,language){
 const a=normalizeAppearance(appearance),base=colorsFor(a),bg=scene.colors[1],ground=mix(bg,scene.colors[2],.45);
 const theme=PALETTES[language?.palette]?.scene;
 if(theme)base.bark=theme.bark;
 const dark=luminance(bg)<.18;
 const foliage=a.foliage!=='native'?base.foliage:preset.kind==='broad'?['#42613d','#577647','#6d8952','#81995b']:preset.kind==='needle'?['#2e5144','#426653','#5b7a5c','#788d67']:base.foliage;
 const tokens={'ink':readable('#354d49',scene.colors[0],4.5),'muted':readable('#697b72',ground,4.5),'surface':dark?'#283d45':'#edf0e7','border':dark?'#61757a':'#a3afa3','action':dark?'#c3d4bd':'#355648','action-ink':dark?'#21382e':'#f6f6eb','focus':dark?'#e8c990':'#735028','bonsai-bark':readable(base.bark,bg,3),'bonsai-soil':dark?'#525648':'#505141','bonsai-moss':dark?'#8c9873':'#76815e'};
 tokens['panel-ink']=readable('#697b72',tokens.surface,4.5);
 // One shared shift preserves the four-tone canopy hierarchy, including shadows.
 const leafEnd=dark?'#e1e9d5':'#162b23';
 let shift=dark?.28:0;
 while(shift<1&&foliage.some(c=>contrast(mix(c,leafEnd,shift),bg)<1.65))shift=Math.min(1,shift+.01);
 foliage.forEach((c,i)=>tokens['bonsai-leaf-'+i]=mix(c,leafEnd,shift));
 const pot=preset.pot==='rect'?['#957c66','#635344']:preset.pot==='deep'?['#747c83','#444c56']:preset.pot==='oval-blue'?['#8a9b9a','#516867']:['#879087','#515e57'];
 tokens['bonsai-pot-top']=readable(pot[0],ground,2);tokens['bonsai-pot-bottom']=readable(pot[1],ground,2);
 tokens['bonsai-rim']=readable(preset.pot==='rect'?'#968574':'#8b8879',ground,2);
 const selectedPot=normalizePot(potDesign);if(selectedPot)Object.assign(tokens,potColorTokens(scene,selectedPot.tone));
 if(theme){
  tokens['bonsai-vessel-body']=readable(theme.body,ground,2);
  tokens['bonsai-vessel-rim']=readable(theme.rim,ground,2);
  tokens['bonsai-moss']=dark?mix(theme.moss,'#e1e9d5',.25):theme.moss;
 }
 // One bounded environment adjustment across all three fixed crown ramps.
 // Keep each cluster's age/light tint and gradient instead of replacing it
 // with the legacy four-color foliage palette.
 if(language){tokens['bonsai-crown-brightness']=dark?1.24:scene.kind==='storm'?.94:1;tokens['bonsai-crown-saturation']=dark?.86:['rain','fog','snow'].includes(scene.kind)?.94:1;}
 return tokens;
}
