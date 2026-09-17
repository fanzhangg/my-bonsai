// An intentionally small 2D bud-competition experiment, not a reproduction
// of Palubicki et al. 2009. Units: virtual hours and SVG world coordinates.
export const VERSION = 'bud-lab-1';
export const DEFAULTS = Object.freeze({ seed: 'MOSS-0826', mode: 'adaptive', dominance: 0.55, light: -25, randomness: 0.65, maxDepth: 7 });
export const STEP = 0.5;
export const MAX_HOUR = 336;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function sample(seed, key, property) {
  const text = `${seed}|${key}|${property}`;
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function normalizeConfig(input = {}) {
  return { seed: String(input.seed ?? DEFAULTS.seed).slice(0, 64), mode: input.mode === 'baseline' ? 'baseline' : 'adaptive',
    dominance: clamp(Number.isFinite(+input.dominance) ? +input.dominance : DEFAULTS.dominance, 0, 1),
    light: clamp(Number.isFinite(+input.light) ? +input.light : DEFAULTS.light, -65, 65),
    randomness: clamp(Number.isFinite(+input.randomness) ? +input.randomness : DEFAULTS.randomness, 0, 1),
    maxDepth: clamp(Math.round(Number(input.maxDepth) || 7), 3, 7) };
}
export function pointOn(n, t) {
  const u = 1 - t;
  return { x: u*u*u*n.x + 3*u*u*t*n.cx1 + 3*u*t*t*n.cx2 + t*t*t*n.ex,
    y: u*u*u*n.y + 3*u*u*t*n.cy1 + 3*u*t*t*n.cy2 + t*t*t*n.ey };
}
export function growth(n, hour) { return 1 - (1 - clamp((hour - n.born) / n.duration, 0, 1)) ** 2; }
function descendants(nodes, id) {
  const found = new Set([id]);
  for (const node of nodes) if (node.alive && found.has(node.parent)) found.add(node.id);
  return found;
}
export function affectedIds(state, id) { return descendants(state.nodes, id); }

export class Simulation {
  constructor(config = {}, events = []) {
    this.config = normalizeConfig(config);
    this.events = [...events].sort((a,b) => a.at - b.at || a.seq - b.seq);
    this.nodes = []; this.scars = []; this.applied = []; this.eventIndex = 0; this.cache = new Map();
    this.hour = -18;
    this.create(null, 0, -18, '0', '0');
    this.updateWidths(-18);
    this.advance(0);
  }
  rand(key, prop) { return sample(this.config.seed, key, prop); }
  create(parent, slotIndex, born, id, key, direction = null, regrown = false, actor = null) {
    const depth = parent ? parent.depth + 1 : 0;
    const r = this.config.randomness;
    const tempo = 1 + (this.rand(key, 'tempo') - .5) * .2 * r;
    const attach = parent ? (parent.depth === 0 ? (slotIndex === 0 ? .97 : .64) : (slotIndex === 0 ? 1 : .72)) : 0;
    const p = parent ? pointOn(parent, attach) : { x: 250, y: 465 };
    const angle = direction ?? ((this.rand(key, 'lean') - .5) * .24);
    const length = (depth === 0 ? 102 : 91 * .77 ** (depth - 1)) * (1 + (this.rand(key, 'length') - .5) * .16 * r);
    const bend = (this.rand(key, 'bend') - .5) * length * .36;
    const ex = p.x + Math.sin(angle) * length, ey = p.y - Math.cos(angle) * length;
    const node = { id, key, parent: parent?.id ?? null, slotIndex, depth, born, duration: 12 * tempo,
      x:p.x, y:p.y, ex, ey, angle, length, attach,
      cx1:p.x + (ex-p.x)*.32 + Math.cos(angle)*bend,
      cy1:p.y + (ey-p.y)*.32 + Math.sin(angle)*bend,
      cx2:p.x + (ex-p.x)*.7 - Math.cos(angle)*bend*.6,
      cy2:p.y + (ey-p.y)*.7 - Math.sin(angle)*bend*.6,
      alive:true, regrown, actor, width: depth === 0 ? 9 : Math.max(1.3, 8 * .72 ** depth),
      slots:[0,1].map(i => ({ child:null, generation:0, due:born+(i === 0 ? 5 : 11)*tempo, credit:0,
        expires:born+(i === 0 ? 5 : 11)*tempo+6, regrow:false, key:`${key}.${i}`, actor:null })) };
    this.nodes.push(node);
    if (parent) parent.slots[slotIndex].child = id;
    return node;
  }
  environment(point, parent, angle) {
    const lightAngle = this.config.light * Math.PI / 180;
    const lx = Math.sin(lightAngle), ly = -Math.cos(lightAngle);
    let shade = 0, nearest = 80;
    for (const n of this.nodes) {
      if (!n.alive || n.id === parent.id || n.id === parent.parent || n.depth === 0) continue;
      const dx = n.ex-point.x, dy=n.ey-point.y;
      const distance = Math.hypot(dx,dy);
      nearest = Math.min(nearest,distance);
      const ahead = dx*lx+dy*ly, cross=Math.abs(dx*ly-dy*lx);
      if (ahead>0 && ahead<110 && cross<22) shade += (1-cross/22)*(1-ahead/130)*.24;
    }
    const light = clamp(Math.exp(-shade), .12, 1);
    const room = clamp(nearest / 25, .08, 1);
    const upward = .8 + .2*Math.cos(angle-lightAngle);
    return { light, room, score:light * .5 + room * .4 + upward * .1 };
  }
  candidate(parent, index, slot) {
    const key = slot.key;
    const jitter = (this.rand(key,'angle')-.5)*.22*this.config.randomness;
    let base;
    if (parent.depth === 0) base = index === 0 ? -.36 : 1.03;
    else if (index === 0) base = parent.angle * .9 + jitter;
    else {
      const side = this.rand(key,'side') > .3 ? (parent.angle >= 0 ? 1 : -1) : (parent.angle >= 0 ? -1 : 1);
      base = parent.angle + side*(.58 + this.rand(key,'fork')*.24) + jitter;
    }
    if (slot.regrow) base += (base > 0 ? -1 : 1) * .3;
    const attach = parent.depth === 0 ? (index===0?.97:.64) : (index===0?1:.72);
    const p = pointOn(parent,attach);
    if (this.config.mode === 'baseline') return { angle:clamp(base,-1.4,1.4), light:1,room:1,score:1 };
    let best = null;
    // Search a small fan for open, illuminated space. This is not the
    // attraction-point algorithm: no attraction points are being consumed.
    for (const turn of [0,-.24,.24,-.44,.44]) {
      const angle=clamp(base*.9+this.config.light*Math.PI/180*.1+turn,-1.42,1.42);
      const length=91*.77**parent.depth;
      const q={x:p.x+Math.sin(angle)*length,y:p.y-Math.cos(angle)*length};
      const env=this.environment(q,parent,angle);
      const score=env.score-Math.abs(turn)*.18;
      if (!best || score>best.score) best={...env,angle,score};
    }
    return best;
  }
  tick(hour) {
    const candidates=[];
    for (const n of this.nodes) {
      if (!n.alive || n.depth>=this.config.maxDepth) continue;
      for (let i=0;i<2;i++) {
        const s=n.slots[i];
        if (s.child || hour+1e-8<s.due) continue;
        if (this.config.mode === 'adaptive' && hour>s.expires && !s.regrow) continue;
        const c=this.candidate(n,i,s);
        const apicalExists=!!n.slots[0].child;
        const apical=i===1 && apicalExists ? 1-this.config.dominance*.6 : 1;
        const weight=(.3+.7*c.light)*(.3+.7*c.room)*apical;
        // Regrowth is scheduled, with immediate activation at the first tick
        // after its delay. Other buds share a per-tick resource budget.
        s.credit += STEP*weight*.8;
        s.diagnostics={light:c.light,room:c.room,apical,weight};
        if (this.config.mode==='baseline' || s.regrow || s.credit>=1) candidates.push({n,i,s,c,weight});
      }
    }
    candidates.sort((a,b)=>(b.s.regrow-a.s.regrow) || (b.weight-a.weight) || (a.s.key<b.s.key?-1:a.s.key>b.s.key?1:0));
    const budget=this.config.mode==='baseline'?Infinity:3;
    for (const {n,i,s,c} of candidates.slice(0,budget)) {
      const id=s.generation===0?`${n.id}.${i}`:`${n.id}.${i}r${s.generation}`;
      this.create(n,i,hour,id,s.key,c.angle,s.regrow,s.actor);
    }
    this.updateWidths(hour);
  }
  updateWidths(hour) {
    const mass=new Map();
    for (let i=this.nodes.length-1;i>=0;i--) {
      const n=this.nodes[i]; if (!n.alive) continue;
      const m=(mass.get(n.id)||0)+Math.max(.1,growth(n,hour)); mass.set(n.id,m);
      if(n.parent)mass.set(n.parent,(mass.get(n.parent)||0)+m);
      // Monotone accumulated thickening: cutting leaves does not thin old wood.
      n.width=Math.max(n.width,1.1+Math.sqrt(m)*1.55);
    }
  }
  cut(event) {
    const node=this.nodes.find(n=>n.id===event.branch && n.alive);
    if(!node || node.depth===0)throw new Error(`无效剪枝：${event.branch}`);
    const parent=this.nodes.find(n=>n.id===node.parent && n.alive);
    const ids=descendants(this.nodes,node.id);
    for(const n of this.nodes)if(ids.has(n.id))n.alive=false;
    const s=parent.slots[node.slotIndex];
    s.child=null; s.generation++; s.key=`${node.key}.regrowth`;
    const delay=4+(this.rand(s.key,'budDelay')-.5)*this.config.randomness;
    s.due=event.at+delay; s.expires=s.due+6; s.credit=0;s.regrow=true;s.actor=event.actor;
    // Release nearby dormant buds after pruning. Already-grown branches keep
    // their geometry; only future buds respond to the changed surroundings.
    if(this.config.mode==='adaptive')for(const n of this.nodes){
      if(!n.alive)continue;
      if(Math.hypot(n.ex-node.x,n.ey-node.y)<95)for(const b of n.slots){
        if(!b.child && b!==s){b.due=Math.max(event.at+4,b.due); b.expires=b.due+6;}
      }
    }
    this.scars.push({parent:parent.id,slotIndex:node.slotIndex,x:node.x,y:node.y,at:event.at,actor:event.actor,budAt:s.due});
    this.applied.push({...event,removed:ids.size,budAt:s.due});
  }
  advance(target) {
    const end=Math.round(target/STEP)*STEP;
    while(this.hour<end-1e-8){
      this.hour=+(this.hour+STEP).toFixed(2);
      // Users cut a state already shown at this tick. Grow first, then apply
      // same-time cuts so surviving wood never shrinks retroactively.
      this.tick(this.hour);
      while(this.eventIndex<this.events.length && this.events[this.eventIndex].at<=this.hour){
        this.cut(this.events[this.eventIndex++]);
      }
      if(this.hour>=0)this.cache.set(this.hour,this.snapshot());
    }
    // Events at t=0 must also apply to the initial cache.
    while(this.eventIndex<this.events.length && this.events[this.eventIndex].at<=this.hour){
      this.cut(this.events[this.eventIndex++]); this.cache.set(this.hour,this.snapshot());
    }
  }
  snapshot(){
    const nodes=this.nodes.filter(n=>n.alive).map(n=>({...n,slots:n.slots.map(s=>({...s,diagnostics:s.diagnostics?{...s.diagnostics}:null}))}));
    const tips=nodes.filter(n=>!n.slots.some(s=>s.child));
    const dormant=nodes.reduce((sum,n)=>sum+(n.depth<this.config.maxDepth?n.slots.filter(s=>!s.child&&this.hour>s.expires).length:0),0);
    return {hour:this.hour,nodes,scars:this.scars.map(s=>({...s})),applied:this.applied.map(e=>({...e})),tips:tips.length,dormant};
  }
  at(hour){
    const t=Math.round(clamp(hour,0,MAX_HOUR)/STEP)*STEP;
    if(t>this.hour)this.advance(t);
    return this.cache.get(t);
  }
}

// Pruning is an experiment edit at any displayed tick. Preserve the prefix,
// discard future events, and continue from the edited time with no cooldown.
export function pruneAt(scene, branch, at, id) {
  if(!Number.isFinite(at)||at<0||at>MAX_HOUR||at%STEP!==0)throw new Error('无效模拟时间');
  const events=scene.events.filter(e=>e.at<=at).map(e=>({...e}));
  if(events.some(e=>e.id===id))throw new Error('重复事件 ID');
  events.push({id,branch,at,actor:'A',seq:events.length+1});
  const result={version:VERSION,config:{...scene.config},events,hour:at};
  new Simulation(result.config,events).at(at);
  return result;
}

export function validateScene(data) {
  if(!data || data.version!==VERSION)throw new Error('场景版本不匹配');
  if(!data.config || typeof data.config.seed!=='string' || data.config.seed.length>64)throw new Error('种子格式不正确');
  if(!Array.isArray(data.events)||data.events.length>1000)throw new Error('导入事件过多');
  if(!Number.isFinite(data.hour)||data.hour<0||data.hour>MAX_HOUR)throw new Error('时间超出 0–336 小时');
  let last=-1;const ids=new Set();
  const events=data.events.map((e,i)=>{
    if(!e || typeof e.id!=='string'||ids.has(e.id)||typeof e.branch!=='string'||e.branch.length>1500 || !['A','B'].includes(e.actor) || !Number.isFinite(e.at)||e.at<last||e.at<0||e.at>data.hour||e.at%STEP!==0)throw new Error(`第 ${i+1} 个事件无效`);
    ids.add(e.id);last=e.at;return {id:e.id,branch:e.branch,actor:e.actor,at:e.at,seq:i+1};
  });
  const config=normalizeConfig(data.config);
  new Simulation(config,events).at(data.hour);
  return {version:VERSION,config,events,hour:Math.round(data.hour/STEP)*STEP};
}
