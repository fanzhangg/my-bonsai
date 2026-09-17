import test from 'node:test';
import assert from 'node:assert/strict';
import {createParticles,particlePose} from '../prototype/weather-particles.mjs';
const random=()=>.5;
test('particle phases remain evenly spaced through repeated lifetimes',()=>{
 for(const kind of ['rain','snow','storm']){
  const particles=createParticles(kind,900,500,random);
  for(const t of [0,1,5,30,180])for(let layer=0;layer<3;layer++){
   const band=particles.filter(p=>p.layer===layer),ys=band.map(p=>particlePose(p,t,kind,900,500).y).sort((a,b)=>a-b);
   const expected=555/band.length;
   for(let i=1;i<ys.length;i++)assert.ok(Math.abs(ys[i]-ys[i-1]-expected)<1e-8);
  }
 }
 assert.deepEqual(createParticles('clear',900,500),[]);
});
test('rain stays controlled, snow drifts gently, and precipitation vanishes at ground',()=>{
 for(const kind of ['rain','snow','storm','wind'])for(const p of createParticles(kind,900,500,random)){
  const a=particlePose(p,1,kind,900,500),b=particlePose(p,1.001,kind,900,500);
  assert.ok(a.alpha>=0&&a.alpha<=1);
  if(kind!=='wind'){
   assert.ok(a.vy<290);
   assert.ok(Math.abs((b.y-a.y)/.001-a.vy)<1e-6);
   assert.equal(particlePose({...p,phase:.999},0,kind,900,500).alpha,0);
  }
  if(kind==='snow')assert.ok(a.vy<30);
 }
});
test('30, 60 and 120 Hz rendering give the same trajectory',()=>{
 const p=createParticles('rain',900,500,random)[0],expected=particlePose(p,2,'rain',900,500);
 for(const fps of [30,60,120]){
  let seconds=0;for(let i=0;i<fps*2;i++)seconds+=1/fps;
  const actual=particlePose(p,seconds,'rain',900,500);
  assert.ok(Math.hypot(actual.x-expected.x,actual.y-expected.y)<1e-8);
 }
});
