export const WEATHER_MAX_AGE=60*60*1000;
export function weatherKind(code,wind=0){
 if([95,96,99].includes(code))return 'storm';
 if([71,73,75,77,85,86].includes(code))return 'snow';
 if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code))return 'rain';
 if([45,48].includes(code))return 'fog';
 if(wind>=25)return 'wind';
 return [2,3].includes(code)?'cloudy':'clear';
}
export function localHour(at,timezone){
 try{const parts=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hourCycle:'h23',hour:'2-digit',minute:'2-digit',second:'2-digit'}).formatToParts(at);const get=t=>Number(parts.find(p=>p.type===t)?.value||0);return get('hour')+get('minute')/60+get('second')/3600;}catch{return new Date(at).getHours()+new Date(at).getMinutes()/60;}
}
const palettes={night:['#192734','#2a3e49','#475952'],dawn:['#aeb2c1','#d8c7bc','#ede0cb'],day:['#a3bed1','#d2e1e7','#eeeadd'],sunset:['#b9aebe','#dfc4b7','#efdbbe']};
const mix=(a,b,t)=>{const rgb=x=>x.match(/\w\w/g).map(v=>parseInt(v,16));const x=rgb(a.slice(1)),y=rgb(b.slice(1));return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('');};
export function sceneFor(data,at=Date.now(),override={}){
 const fresh=data&&Number.isFinite(data.fetchedAt)&&at-data.fetchedAt>=-60000&&at-data.fetchedAt<WEATHER_MAX_AGE&&at-data.observedAt<2*WEATHER_MAX_AGE;
 const hour=Number.isFinite(override.hour)?override.hour:localHour(at,fresh?data.timezone:undefined);
 let sunrise=6.5,sunset=18.5;
 if(fresh){const dateKey=time=>new Intl.DateTimeFormat('en-CA',{timeZone:data.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(time);const date=dateKey(at);const rise=data.sunrise?.find(t=>t>0&&dateKey(t)===date),set=data.sunset?.find(t=>t>0&&dateKey(t)===date);if(rise&&set){sunrise=localHour(rise,data.timezone);sunset=localHour(set,data.timezone);}}
 const polar=fresh&&!data.sunrise?.some(t=>t>0)&&!Number.isFinite(override.hour);
 const stops=[[0,'night'],[Math.max(.1,sunrise-1),'night'],[sunrise,'dawn'],[sunrise+1.2,'day'],[Math.max(sunrise+1.3,sunset-1),'day'],[sunset,'sunset'],[Math.min(23.9,sunset+1.2),'night'],[24,'night']].sort((a,b)=>a[0]-b[0]);
 let index=stops.findIndex((s,i)=>i<stops.length-1&&hour>=s[0]&&hour<stops[i+1][0]);if(index<0)index=0;
 const [a,name]=stops[index],[b,next]=stops[index+1],t=Math.max(0,Math.min(1,(hour-a)/(b-a||1)));
 let colors=palettes[name].map((c,i)=>mix(c,palettes[next][i],t));
 const night=polar?!data.isDay:hour<sunrise-.3||hour>sunset+.6;
 if(polar)colors=palettes[data.isDay?'day':'night'];
 const kind=override.kind&&override.kind!=='live'?override.kind:fresh?weatherKind(data.code,data.wind):'clear';
 const overcast=['rain','storm','fog','snow','cloudy'].includes(kind);
 if(overcast){const grey=night?['#1e2c39','#30424b','#495b54']:kind==='snow'?['#afc1ca','#d4dddd','#eeeee4']:['#aabac4','#d2dcd9','#eae9dc'];colors=colors.map((c,i)=>mix(c,grey[i],kind==='storm'?.8:.55));}
 return {colors,night,kind,hour,live:!!fresh};
}
