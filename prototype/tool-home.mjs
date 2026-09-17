// Overlay padding carries the device safe-area insets into tool coordinates.
export function toolHome(scene,right=66){
 const style=getComputedStyle(scene),inset=side=>parseFloat(style.getPropertyValue('padding-'+side))||0;
 const radius=(parseFloat(style.getPropertyValue('--tool-hit-size'))||92)/2,bottom=parseFloat(style.getPropertyValue('--tool-rest-bottom'))||70;
 return {x:Math.max(inset('left')+radius,scene.clientWidth-right-inset('right')),y:Math.max(inset('top')+radius,scene.clientHeight-bottom-inset('bottom'))};
}
