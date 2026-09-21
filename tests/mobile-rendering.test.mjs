import test from 'node:test';
import assert from 'node:assert/strict';
import {Resvg} from '@resvg/resvg-js';
import {collisionGrid} from '../prototype/collision-grid.mjs';
import {galleryPreview} from '../prototype/gallery-preview.mjs';
import {galleryPaper} from '../gallery-thumbnails.mjs';
import {configForClaim} from '../prototype/claim.mjs';
import {CURRENT_VERSION,LEGACY_VERSION} from '../prototype/tree-versions.mjs';

test('spatial collision candidates preserve ellipse/solid hits across cell edges and negative coordinates',()=>{
 const shapes=[];
 for(let i=0;i<80;i++){
  const x=(i%10)*37-120,y=Math.floor(i/10)*29-80,rx=12+i%4,ry=8+i%5;
  shapes.push({left:x-rx,right:x+rx,top:y-ry,bottom:y+ry,hit:p=>((p.x-x)/rx)**2+((p.y-y)/ry)**2<=1});
 }
 const hit=collisionGrid(shapes);
 for(let x=-150;x<250;x+=3)for(let y=-110;y<180;y+=3)assert.equal(hit({x,y}),shapes.some(s=>s.hit({x,y})),`${x},${y}`);
 assert.equal(collisionGrid([])({x:0,y:0}),false);
 let calls=0;
 const sparse=Array.from({length:1000},(_,i)=>({left:i*100,right:i*100+10,top:0,bottom:10,hit:()=>{calls++;return true;}}));
 assert.equal(collisionGrid(sparse)({x:99905,y:5}),true);assert.equal(calls,1);
});

test('gallery previews decode as standalone images for legacy and dense current trees',()=>{
 for(const version of [LEGACY_VERSION,CURRENT_VERSION]){
  const record={id:'mobile-preview',version,createdAt:0,config:{...configForClaim('mobile-preview',version),density:.8},cuts:[]};
  const before=structuredClone(record),{svg,paper}=galleryPreview(record,1000*3600000);
  const image=new Resvg(svg,{font:{loadSystemFonts:false}}).render();
  assert.equal(image.width,640);assert.equal(image.height,640);assert.ok(image.asPng().length>1000);
  assert.equal(galleryPaper(record),paper);assert.deepEqual(record,before,'preview must not mutate persisted tree data');
 }
});
