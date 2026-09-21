import {galleryPreview} from './gallery-preview.mjs';
self.onmessage=({data:{record,now}})=>{
 try{self.postMessage(galleryPreview(record,now));}
 catch{self.postMessage({error:'Preview unavailable'});}
};
