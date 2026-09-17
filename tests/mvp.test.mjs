import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {snapshot,prunable,descendants,hitTest,HOUR,VERSION,draw} from '../prototype/life.mjs';
import {PRESETS,normalize} from '../prototype/core/v1/canopy.mjs';
import {openStore} from '../storage.mjs';
import {createServer} from '../server.mjs';
const make=preset=>({version:VERSION,createdAt:100000,config:normalize({preset,seed:'life-check'}),cuts:[]});
test('all styles start with foliage and prunable wood; growth and cuts replay deterministically',()=>{
  for(const preset of PRESETS){const record=make(preset.id),initial=snapshot(record,record.createdAt);assert(prunable(initial).length);assert(initial.clusters.some(c=>initial.hour>c.born));const branch=initial.nodes.find(n=>n.role==='primary'),removed=descendants(initial.nodes,branch.id);record.cuts.push({seq:1,at:record.createdAt+HOUR,branchId:branch.id});
    assert.deepEqual(snapshot(record,record.createdAt),initial);const cut=snapshot(record,record.createdAt+HOUR);assert(!cut.nodes.some(n=>removed.has(n.id)));assert(!prunable(cut).some(n=>n.id.startsWith('r')));const grown=snapshot(record,record.createdAt+120*HOUR);assert(prunable(grown).some(n=>n.id.startsWith('r')));assert.deepEqual(grown,snapshot(structuredClone(record),record.createdAt+120*HOUR));assert(!draw(grown).includes('NaN'));
    const shoot=prunable(grown).find(n=>n.id.startsWith('r'));record.cuts.push({seq:2,at:record.createdAt+120*HOUR,branchId:shoot.id});assert(!snapshot(record,record.createdAt+121*HOUR).nodes.some(n=>n.id===shoot.id));
  }
});
test('hit testing ignores empty space and delayed shoots; ancestor cuts cancel planned descendants',()=>{
  const record=make('juniper'),initial=snapshot(record,record.createdAt),primary=initial.nodes.find(n=>n.role==='primary');
  assert.equal(hitTest(initial,-10000,-10000,22),null);assert(prunable(initial).some(n=>n.id===hitTest(initial,primary.x,primary.y,22)));
  const twig=initial.nodes.find(n=>n.parent===primary.id);record.cuts.push({seq:1,at:record.createdAt,branchId:twig.id});
  const pending=snapshot(record,record.createdAt+3*HOUR);assert(!prunable(pending).some(n=>n.id.startsWith('r1:')));
  record.cuts.push({seq:2,at:record.createdAt+3*HOUR,branchId:primary.id});const later=snapshot(record,record.createdAt+200*HOUR);
  assert(!later.nodes.some(n=>n.id.startsWith('r1:')));assert(later.nodes.some(n=>n.id.startsWith('r2:')));
});
