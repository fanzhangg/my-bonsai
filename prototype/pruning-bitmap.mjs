import {svgBitmap} from './svg-bitmap.mjs';

export async function pruningBitmap(svg,pieces,scene,anchor){
 const rect=svg.getBoundingClientRect(),container=scene.getBoundingClientRect(),matrix=svg.getScreenCTM();
 if(rect.width<=0||rect.height<=0)return null;
 const copy=svg.cloneNode(false);copy.removeAttribute('style');
 copy.setAttribute('width',rect.width);copy.setAttribute('height',rect.height);
 const defs=document.createElementNS('http://www.w3.org/2000/svg','defs');
 for(const original of svg.querySelectorAll('defs'))for(const child of original.children)defs.append(child.cloneNode(true));
 copy.append(defs);
 for(const piece of pieces){
  const clone=piece.cloneNode(true);clone.classList.remove('pruning-selected');
  clone.querySelectorAll('defs').forEach(el=>el.remove());copy.append(clone);
 }
 // Standalone SVG images cannot inherit the page's weather palette variables.
 const style=getComputedStyle(svg);
 const markup=new XMLSerializer().serializeToString(copy).replace(/var\((--[\w-]+),\s*([^()]+)\)/g,(_,key,fallback)=>style.getPropertyValue(key).trim()||fallback);
 const bitmap=await svgBitmap(markup,rect.width,rect.height);
 const point=new DOMPoint(anchor.x,anchor.y).matrixTransform(matrix);
 Object.assign(bitmap.style,{position:'absolute',left:(rect.left-container.left)+'px',top:(rect.top-container.top)+'px',width:rect.width+'px',height:rect.height+'px',pointerEvents:'none',transformOrigin:(point.x-rect.left)+'px '+(point.y-rect.top)+'px'});
 bitmap.setAttribute('aria-hidden','true');bitmap.dataset.pruningBitmap='';
 return {bitmap,scale:Math.hypot(matrix.a,matrix.b)};
}
