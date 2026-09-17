import {shareData,invitation,nativeShareData} from './share-data.mjs';

export function createSharing({button,getRecord,onStatus}){
 let file,fileKey,request,pending,sharing=false;
 async function prepare(){
  const record=getRecord();
  if(!record?.id||typeof navigator.share!=='function'||typeof navigator.canShare!=='function')return;
  const data=shareData(record,location.origin);
  if(fileKey===data.image&&(file||pending))return pending;
  request?.abort();file=null;fileKey=data.image;
  const controller=new AbortController();request=controller;
  pending=(async()=>{
   try{
    const response=await fetch(data.image,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
    if(!response.ok||!response.headers.get('Content-Type')?.startsWith('image/png'))return;
    const blob=await response.blob();
    if(!controller.signal.aborted)file=new File([blob],'我的盆栽.png',{type:'image/png'});
   }catch{/* Link previews still provide the thumbnail if image preparation fails. */}
   finally{if(request===controller)pending=null;}
  })();
  return pending;
 }
 button.onclick=async()=>{
  const record=getRecord();if(sharing||!record?.id)return;
  const data=shareData(record,location.origin),image=fileKey===data.image?file:null;
  sharing=true;onStatus('');
  try{
   if(typeof navigator.share==='function'){
    // Never await image loading here: the system sheet needs this click's activation.
    await navigator.share(nativeShareData(data,image,navigator));
   }else{
    await navigator.clipboard.writeText(invitation(data));
    onStatus('邀请文案和盆栽链接已复制，发给朋友来浇水吧。');
   }
  }catch(error){
   if(error.name!=='AbortError')onStatus(typeof navigator.share==='function'?'暂时无法打开系统分享，请稍后重试。':'未能复制邀请，请从地址栏复制盆栽链接发给朋友。');
  }finally{sharing=false;}
 };
 return {prepare};
}
