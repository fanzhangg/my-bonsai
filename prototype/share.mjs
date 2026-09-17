import {shareData,invitation,nativeShareData} from './share-data.mjs';

export function createSharing({button,getRecord}){
 const $=id=>document.getElementById(id),dialog=$('share-dialog'),image=$('share-image'),native=$('share-native'),copy=$('share-copy'),download=$('share-download'),message=$('share-message'),manual=$('share-manual');
 let data,file,objectUrl,request,sharing=false;
 const release=()=>{request?.abort();request=null;if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=null;file=null;image.hidden=true;image.removeAttribute('src');download.hidden=true;download.removeAttribute('href');};
 $('share-close').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{release();button.focus();});
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
 button.onclick=async()=>{
  const record=getRecord();if(!record?.id||dialog.open)return;
  release();data=shareData(record,location.origin);manual.value=invitation(data);manual.hidden=true;
  $('share-title').textContent=data.title;$('share-description').textContent=data.text;
  native.hidden=typeof navigator.share!=='function';native.disabled=true;copy.classList.toggle('primary',native.hidden);
  message.textContent='正在准备盆栽缩略图…';dialog.showModal();
  const controller=new AbortController();request=controller;
  try{
   const response=await fetch(data.image,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
   if(!response.ok||!response.headers.get('Content-Type')?.startsWith('image/png'))throw new Error('Image unavailable');
   const blob=await response.blob();if(controller.signal.aborted)return;
   file=new File([blob],'我的盆栽.png',{type:'image/png'});objectUrl=URL.createObjectURL(blob);
   image.src=objectUrl;image.hidden=false;download.href=objectUrl;download.hidden=false;
   message.textContent=native.hidden?'复制邀请发给朋友，也可以保存盆栽图片。':'把这盆小树和浇水邀请分享给朋友。';
  }catch(error){if(controller.signal.aborted)return;message.textContent='缩略图暂时未能加载，仍可分享邀请链接。关闭后重试可重新加载图片。';}
  finally{if(request===controller)native.disabled=false;}
 };
 native.onclick=async()=>{
  if(sharing||!data)return;
  sharing=true;native.disabled=true;
  try{await navigator.share(nativeShareData(data,file,navigator));message.textContent='已打开分享，请在所选应用中完成发送。';}
  catch(error){message.textContent=error.name==='AbortError'?'已取消分享，随时可以再邀请朋友。':'暂时无法打开系统分享，请复制邀请或保存图片后发送。';}
  finally{sharing=false;native.disabled=false;}
 };
 copy.onclick=async()=>{
  try{await navigator.clipboard.writeText(invitation(data));message.textContent='邀请文案和盆栽链接已复制，发给朋友来浇水吧。';}
  catch{manual.hidden=false;manual.focus();manual.select();message.textContent='请长按或选中下方内容，复制后发给朋友。';}
 };
}
