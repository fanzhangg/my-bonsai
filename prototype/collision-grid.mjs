// Broad phase in scene pixels; the narrow phase retains the original shape test.
export function collisionGrid(shapes,cellSize=48){
 const cells=new Map();
 for(const shape of shapes){
  const {left,top,right,bottom}=shape;
  if(![left,top,right,bottom].every(Number.isFinite)||right<left||bottom<top)continue;
  for(let x=Math.floor(left/cellSize);x<=Math.floor(right/cellSize);x++)for(let y=Math.floor(top/cellSize);y<=Math.floor(bottom/cellSize);y++){
   const key=x+','+y;let bucket=cells.get(key);if(!bucket)cells.set(key,bucket=[]);bucket.push(shape);
  }
 }
 return point=>(cells.get(Math.floor(point.x/cellSize)+','+Math.floor(point.y/cellSize))??[]).some(shape=>point.x>=shape.left&&point.x<=shape.right&&point.y>=shape.top&&point.y<=shape.bottom&&shape.hit(point));
}
