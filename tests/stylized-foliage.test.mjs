import test from 'node:test';
import assert from 'node:assert/strict';
import {FORMS,PALETTES} from '../prototype/core/v3/bonsai-language.mjs';
import {normalizeDesign,validateDesign} from '../prototype/core/v3/config.mjs';
import {STYLIZED_LEAVES} from '../prototype/core/v3/stylized-foliage.mjs';
import {render} from '../prototype/core/v3/growing-render.mjs';
import {snapshot,draw,HOUR} from '../prototype/growth.mjs';
import {CURRENT_VERSION} from '../prototype/tree-versions.mjs';

test('all pine forms constrain old links and saved design validation to needles',()=>{
  for(const preset of ['pine','literati','slant','windswept']){
    assert.deepEqual(FORMS.find(f=>f.id===preset).leaves,['needle']);
    for(const leaf of ['sakura','star','heart','oval','round','maple','fan','scale']){
      const config=normalizeDesign({preset,leaf,palette:'lilac',seed:'pine-leaves'});
      assert.equal(config.leaf,'needle');
      assert.equal(config.appearance.shape,'needle');
      assert.equal(config.palette,'lilac');
      assert.throws(()=>validateDesign({...config,leaf}),/无效的盆栽设计参数/);
    }
    const config=normalizeDesign({preset,leaf:'star',palette:'lilac',seed:'pine-leaves'});
    const tree=snapshot({version:CURRENT_VERSION,config,createdAt:0,cuts:[]},168*HOUR);
    assert(!draw(tree).includes('data-leaf-shape='));
  }
});

test('decorative leaves survive config validation, growth and rendering on compatible tree forms',()=>{
  for(const form of FORMS)for(const leaf of Object.keys(STYLIZED_LEAVES).filter(id=>form.leaves.includes(id))){
    const config=normalizeDesign({preset:form.id,leaf,palette:'sakura',seed:'cartoon-review'});
    assert.equal(validateDesign(config).leaf,leaf);
    const record={version:CURRENT_VERSION,config,createdAt:0,cuts:[]};
    const tree=snapshot(record,168*HOUR),svg=draw(tree);
    assert(svg.includes(`data-leaf-shape="${leaf}"`),`${form.id}/${leaf} must render its actual decorative shape`);
    assert(!/NaN|Infinity/.test(svg));
    const centers=(svg.match(/data-flower-center/g)??[]).length,flowers=(svg.match(/data-leaf-shape=/g)??[]).length;
    if(leaf==='heart')assert.equal(centers,0,'clover leaflets never carry flower centers');
    else assert.equal(centers,flowers,'every flower has stamens');
    assert.equal(draw(snapshot(record,168*HOUR)),svg);
    assert(!render(tree,{view:'skeleton'}).includes('data-leaf-shape'));
    for(const palette of ['lilac','candy']){
      const recolored=snapshot({...record,config:normalizeDesign({...config,palette})},168*HOUR);
      assert.deepEqual(recolored.nodes,tree.nodes,'recoloring retains the branch geometry');
      assert(recolored.clusters.every(c=>c.layerPalette?.length===4));
      assert.notDeepEqual(recolored.clusters[0].layerPalette,tree.clusters[0].layerPalette);
    }
  }
});

test('new palette ramps remain progressively lighter across every depth group',()=>{
  const luminance=hex=>hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
  for(const id of ['sakura','lilac','candy']){
    const rows=PALETTES[id].layers;
    for(const row of rows)for(let i=1;i<row.length;i++)assert(luminance(row[i])>luminance(row[i-1]));
    for(let i=1;i<rows.length;i++)assert(luminance(rows[i][1])>luminance(rows[i-1][1]));
  }
});
