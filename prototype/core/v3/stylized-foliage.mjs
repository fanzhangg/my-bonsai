// Keep star/heart URL keys so existing review links restore the revised shapes.
export const STYLIZED_LEAVES={
  sakura:{name:'五瓣樱花'},star:{name:'四瓣丁香'},heart:{name:'四叶草小叶'}
};
// Sakura tips have a small V notch, while lilac petals are long and rounded.
const sakuraPetal='M0 .06 C-.12 -.11 -.46 -.35 -.46 -.65 Q-.44 -.90 -.14 -1.08 L0 -.91 L.14 -1.08 Q.44 -.90 .46 -.65 C.46 -.35 .12 -.11 0 .06Z';
const lilacPetal='M0 .06 C-.12 -.10 -.46 -.40 -.42 -.73 C-.38 -1.11 .33 -1.15 .43 -.81 C.53 -.47 .18 -.11 0 .06Z';
// One heart-shaped leaflet, rather than an entire four-leaf clover rosette.
const cloverLeaf='M0 1 C-.18 .66 -.86 .32 -.86 -.27 C-.88 -.90 -.25 -1.07 0 -.49 C.25 -1.07 .88 -.90 .86 -.27 C.86 .32 .18 .66 0 1Z';
export function stylizedLeafMarkup(shape,{x,y,size,angle,color,accent,silhouette=false,showCenter=false}){
  const petal=shape==='sakura'?sakuraPetal:lilacPetal,count=shape==='sakura'?5:4;
  const petals=shape==='heart'?'<path d="'+cloverLeaf+'"/>':Array.from({length:count},(_,i)=>'<path d="'+petal+'" transform="rotate('+(i*360/count)+')"/>').join('');
  const detail=shape==='heart'&&!silhouette
    ?'<path d="M0 .91 Q-.05 .23 0 -.49" fill="none" stroke="'+accent+'" stroke-width=".035" opacity=".55"/>'
    :'';
  const stamens=shape==='star'
    ?'<circle r=".13" fill="#f6e7b1"/><circle r=".05" fill="#d4b467"/>'
    :'<g fill="none" stroke="#b88b67" stroke-width=".028">'+Array.from({length:8},(_,i)=>'<path d="M0 0 L0 -.29" transform="rotate('+(i*45)+')"/>').join('')+'</g><g fill="#b69b68">'+Array.from({length:8},(_,i)=>'<circle cx="0" cy="-.29" r=".045" transform="rotate('+(i*45)+')"/>').join('')+'</g>';
  const center=showCenter&&!silhouette&&shape!=='heart'?'<g data-flower-center>'+stamens+'</g>':'';
  return '<g data-leaf-shape="'+shape+'" fill="'+color+'" transform="translate('+x.toFixed(2)+' '+y.toFixed(2)+') rotate('+angle.toFixed(2)+') scale('+size.toFixed(2)+')">'+petals+detail+center+'</g>';
}
