// Overlay padding carries the device safe-area insets into tool coordinates.
export function toolHome(scene,right=66){
 const style=getComputedStyle(scene),inset=side=>parseFloat(style.getPropertyValue('padding-'+side))||0;
 return {x:Math.max(inset('left')+46,scene.clientWidth-right-inset('right')),y:Math.max(inset('top')+46,scene.clientHeight-70-inset('bottom'))};
}
