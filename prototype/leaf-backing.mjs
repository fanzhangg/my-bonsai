// The backing may fill enclosed gaps, but every one of its boundary edges
// must lie under actual, surviving foliage. Overlapping inscribed leaf disks
// give that guarantee without adding uncuttable decorative leaves.
export function leafSupport(leaf,regrowth=1){
 const factor={round:.86,oval:.60,scale:.53,maple:.25,fan:.30,lance:.16,sakura:.12,star:.12,heart:.30}[leaf.shape]??.53;
 // All three needles share a round-capped stem; their stroke width is 1.45.
 const radius=leaf.shape==='needle'?.60*(leaf.renderScale??1):leaf.size*regrowth*factor;
 return {...leaf,radius:Math.max(0,radius-.04)};
}

export function leafBackingMesh(leaves){
 const points=leaves.filter(p=>p.radius>0),triangles=[],seen=new Set();
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const overlaps=(a,b)=>distance(a,b)<a.radius+b.radius;
 for(let i=0;i<points.length;i++){
  const a=points[i];
  // Local neighbors suffice to fill the core; bound the work even when a
  // strongly sculpted crown packs many leaves into a very small space.
  const near=points.map((b,j)=>({b,j,d:distance(a,b)})).filter(({b,j,d})=>j!==i&&d<a.radius+b.radius).sort((a,b)=>a.d-b.d||a.j-b.j).slice(0,8);
  for(let j=0;j<near.length;j++)for(let k=j+1;k<near.length;k++){
   const b=near[j].b,c=near[k].b;if(!overlaps(b,c))continue;
   const key=[i,near[j].j,near[k].j].sort((a,b)=>a-b).join(':');if(seen.has(key))continue;seen.add(key);
   const area=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
   if(Math.abs(area)<.001)continue;
   triangles.push(area>0?[a,b,c]:[a,c,b]);
  }
 }
 return triangles;
}

export const leafBackingPath=mesh=>mesh.map(triangle=>'M'+triangle.map(p=>`${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join('L')+'Z').join('');
