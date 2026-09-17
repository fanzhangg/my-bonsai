import {sample} from './core/v1/model.mjs';

// Stable positions across time/weather changes; only opacity gently twinkles.
export function startStars(){
 if(document.getElementById('weather-stars'))return;
 const sky=document.createElement('div');sky.id='weather-stars';sky.setAttribute('aria-hidden','true');
 for(let i=0;i<64;i++){
  const random=key=>sample('night-sky',String(i),key),star=document.createElement('i');
  const x=3+((i%8)+random('x')*.8)/8*94;
  const y=3+(Math.floor(i/8)+random('y')*.8)/8*53;
  star.style.cssText=`left:${x}%;top:${y}%;--star-size:${.9+random('size')*1.4}px;--star-opacity:${.35+random('opacity')*.4};--star-duration:${4+random('duration')*5}s;--star-delay:${-random('phase')*9}s`;
  sky.append(star);
 }
 document.body.append(sky);
}
