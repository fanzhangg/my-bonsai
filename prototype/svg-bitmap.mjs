// Decode once, then animate/display a bounded bitmap rather than thousands of paths.
export async function svgBitmap(markup,width,height,{maxSize=1024,scale=Math.min(globalThis.devicePixelRatio||1,2)}={}){
 const ratio=Math.min(scale,maxSize/Math.max(width,height));
 const canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));
 const source=URL.createObjectURL(new Blob([markup],{type:'image/svg+xml'})),image=new Image();
 try{
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{image.src='';reject(new Error('Image decode timed out'));},4000);
   image.onload=()=>{clearTimeout(timer);resolve();};image.onerror=()=>{clearTimeout(timer);reject(new Error('Image decode failed'));};image.src=source;
  });
  const context=canvas.getContext('2d');if(!context)throw new Error('Canvas unavailable');
  context.drawImage(image,0,0,canvas.width,canvas.height);return canvas;
 }finally{URL.revokeObjectURL(source);}
}

export function releaseBitmap(canvas){if(canvas){canvas.remove();canvas.width=canvas.height=1;}}
