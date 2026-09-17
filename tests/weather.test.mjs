import test from 'node:test';
import assert from 'node:assert/strict';
import {coordinates,weatherAt} from '../weather-service.mjs';
import {sceneFor,weatherKind,localHour,WEATHER_MAX_AGE} from '../prototype/weather-model.mjs';
import {snapshot,draw} from '../prototype/growth.mjs';
import {createServer} from '../server.mjs';
test('runtime weather switch is public, uncached, and disables the weather proxy',async()=>{
 for(const enabled of [false,true]){
  const server=createServer({}, {realtimeWeatherEnabled:enabled});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
   const base=`http://127.0.0.1:${server.address().port}`;
   const config=await fetch(base+'/runtime-config.mjs');
   assert.equal(config.headers.get('cache-control'),'no-store');
   assert.equal(await config.text(),`export const realtimeWeatherEnabled=${enabled};`);
   if(!enabled){const result=await fetch(base+'/api/weather?lat=52.5&lon=13.4');assert.equal(result.status,503);assert.equal((await result.json()).error,'实时天气已关闭');}
  }finally{await new Promise(resolve=>server.close(resolve));}
 }
});
test('weather codes distinguish rain, snow, fog, storm and wind',()=>{
 for(const c of [51,57,61,67,82])assert.equal(weatherKind(c),'rain');for(const c of [71,77,86])assert.equal(weatherKind(c),'snow');assert.equal(weatherKind(95),'storm');assert.equal(weatherKind(45),'fog');assert.equal(weatherKind(0,30),'wind');assert.equal(weatherKind(3),'cloudy');
});
test('local time follows timezone; stale weather stops rain and time overrides never mutate live data',()=>{
 const at=Date.UTC(2026,8,16,12),data={code:61,wind:2,timezone:'Asia/Shanghai',fetchedAt:at,observedAt:at,sunrise:[],sunset:[],isDay:false};
 assert.equal(localHour(at,'Asia/Shanghai'),20);assert.equal(localHour(at,'America/Los_Angeles'),5);
 const copy=structuredClone(data);assert.equal(sceneFor(data,at).kind,'rain');assert.equal(sceneFor(data,at).night,true);
 assert.equal(sceneFor(data,at+WEATHER_MAX_AGE+1).live,false);assert.equal(sceneFor(data,at+WEATHER_MAX_AGE+1).kind,'clear');
 assert.equal(sceneFor(data,at,{kind:'snow',hour:12}).night,false);assert.equal(sceneFor(data,at,{kind:'snow',hour:12}).kind,'snow');assert.deepEqual(data,copy);
 for(let hour=0;hour<24;hour+=.25)for(const kind of ['clear','rain','snow','fog','storm','wind']){const s=sceneFor(null,at,{hour,kind});assert(s.colors.every(c=>/^#[0-9a-f]{6}$/.test(c)));}
});
test('weather proxy rounds location, caches responses and only serves bounded stale data',async()=>{
 assert.deepEqual(coordinates('52.52349','13.41123'),{lat:52.5,lon:13.4});for(const args of [[null,1],['',1],[91,0],[0,181],['NaN',0]])assert.throws(()=>coordinates(...args));
 let calls=0;const now=Date.UTC(2026,8,16,12),fetcher=async url=>{calls++;assert.equal(url.hostname,'api.open-meteo.com');assert.equal(url.searchParams.get('latitude'),'52.5');return {ok:true,json:async()=>({timezone:'Europe/Berlin',current:{weather_code:73,is_day:1,time:now/1000,cloud_cover:90,wind_speed_10m:10},daily:{sunrise:[now/1000-20000],sunset:[now/1000+20000]}})};};
 const first=await weatherAt(52.52349,13.41123,{fetcher,now});assert.equal(first.code,73);assert(!('latitude' in first));assert.deepEqual(await weatherAt(52.52349,13.41123,{fetcher,now:now+1000}),first);assert.equal(calls,1);
 const offline=async()=>{throw new Error('offline');};assert.equal((await weatherAt(52.5,13.4,{fetcher:offline,now:now+700000})).stale,true);await assert.rejects(weatherAt(52.5,13.4,{fetcher:offline,now:now+WEATHER_MAX_AGE+1}));
});
test('transparent weather rendering preserves pot framing and all tree geometry',()=>{
 const tree=snapshot({createdAt:0,config:{preset:'windswept',seed:'weather'}},86400000),before=structuredClone(tree);const normal=draw(tree),clear=draw(tree,{transparent:true});assert(clear.includes('background:transparent'));assert(!clear.includes(`width="${tree.viewBox.width}" height="${tree.viewBox.height}" fill=`));assert(normal.includes('growing-tree-pot'));assert.deepEqual(tree,before);
});
