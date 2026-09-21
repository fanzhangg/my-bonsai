import {snapshot,draw} from './growth.mjs';

export function galleryPreview(record,now){
 let svg=draw(snapshot(record,now),{transparent:false,id:'gallery-preview'});
 const background=svg.match(/style="background:([^;"]+)/)?.[1]??'#e8dccb';
 const paper=background==='#faf9f3'?'#e8dccb':background;
 if(paper!==background)svg=svg.replaceAll(background,paper);
 // An image decoder parses XML, unlike inline HTML's permissive data attributes.
 svg=svg.replace(/\s(data-[\w-]+)(?=[\s>])/g,' $1=""');
 // Explicit square viewport matches the gallery's existing SVG layout.
 svg=svg.replace('<svg ','<svg width="640" height="640" ');
 return {svg,paper};
}
