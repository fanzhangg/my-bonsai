export const SHARE_TITLE='快来看我种的盆栽';
export const SHARE_TEXT='来给我的盆栽浇浇水，一起看它慢慢长大。';
export const SHARE_WIDTH=1200,SHARE_HEIGHT=630;
export function shareVersion(record,at=Date.now()){
 return `${record.revision??0}-${Math.floor(at/60000)}`;
}
export function shareData(record,origin,at=Date.now()){
 const url=new URL('/t/'+record.id,origin).href;
 return {title:SHARE_TITLE,text:SHARE_TEXT,url,image:`${url}/share.png?v=${shareVersion(record,at)}`};
}
export const invitation=data=>`${data.title}\n${data.text}\n${data.url}`;
// Keep this synchronous so navigator.share is called during the user's click.
export function nativeShareData(data,file,platform){
 const payload={title:data.title,text:data.text,url:data.url};
 if(file&&platform.canShare?.({files:[file]})){
  payload.files=[file];
  // Some photo destinations ignore the URL field; keep the invitation usable.
  payload.text=`${data.text}\n${data.url}`;
 }
 return payload;
}
