// Coarse coordinates only. No location is stored with a tree or in the database.
const cache=new Map(),TTL=10*60*1000;
export function coordinates(lat,lon){
 if(lat===null||lon===null||lat===''||lon==='')throw new Error('Invalid coordinates');
 lat=Number(lat);lon=Number(lon);
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw new Error('Invalid coordinates');
 return {lat:Math.round(lat*10)/10,lon:Math.round(lon*10)/10};
}
export async function weatherAt(lat,lon,{fetcher=fetch,now=Date.now()}={}){
 const c=coordinates(lat,lon),key=`${c.lat},${c.lon}`,old=cache.get(key);
 if(old&&now-old.fetchedAt<TTL)return old;
 const url=new URL('https://api.open-meteo.com/v1/forecast');
 url.search=new URLSearchParams({latitude:String(c.lat),longitude:String(c.lon),current:'weather_code,is_day,cloud_cover,wind_speed_10m',daily:'sunrise,sunset',timezone:'auto',timeformat:'unixtime',forecast_days:'2'}).toString();
 try{
  const response=await fetcher(url,{signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error('Weather unavailable');const data=await response.json();
  if(!data.current||!Number.isFinite(data.current.weather_code)||!Number.isFinite(data.current.time)||typeof data.timezone!=='string')throw new Error('Invalid weather response');
  new Intl.DateTimeFormat('en',{timeZone:data.timezone}).format();
  const result={code:data.current.weather_code,isDay:data.current.is_day===1,cloud:Number(data.current.cloud_cover)||0,wind:Number(data.current.wind_speed_10m)||0,timezone:data.timezone,observedAt:data.current.time*1000,fetchedAt:now,sunrise:(data.daily?.sunrise||[]).map(x=>x*1000),sunset:(data.daily?.sunset||[]).map(x=>x*1000),source:'Open-Meteo'};
  if(cache.size>=200)cache.delete(cache.keys().next().value);cache.set(key,result);return result;
 }catch(e){if(old&&now-old.fetchedAt<60*60*1000)return {...old,stale:true};throw e;}
}
