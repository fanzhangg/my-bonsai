export function growthStatus(tree){
 if(!tree.branchRanges)return tree.recovery?.length?`${tree.recovery.length} 处正在准备新生长`:'当前没有待萌芽区域';
 if(tree.gradualGrowth){
  const extra=tree.branchRanges.reduce((sum,r)=>sum+Math.max(0,r.count-r.ideal),0);
  const range=level=>{const groups=tree.branchRanges.filter(r=>r.level===level),sum=key=>groups.reduce((n,r)=>n+r[key],0);return `下限 ${sum('min')} · 理想 ${sum('ideal')} · 上限 ${sum('max')}`;};
  const deficit=tree.branchRanges.some(r=>r.count<r.min);
  return `一级枝：${range(1)}；二级枝：${range(2)}（随存活母枝调整）。${deficit?'枝量偏少，正在优先恢复':extra?`比建议多 ${extra} 根侧枝，可修剪恢复留白`:'修剪留白会保留，新枝逐渐长出'}；前期较快，接近理想后减速，上限停止添枝`;
 }
 if(tree.branchRanges.some(r=>r.ideal!==undefined)){
  const extra=tree.branchRanges.reduce((sum,r)=>sum+Math.max(0,r.count-r.ideal),0);
  return `建议每根母枝保留 1–2 根二级枝；自然生长时，部分母枝可长至 3 根。${extra?`目前比建议多 ${extra} 根侧枝，可修剪恢复留白`:'未修剪时还会缓慢添枝'}；低于下限才立即补枝`;
 }
 const regions=tree.branchRanges.filter(r=>r.level===1),intervals=[...new Set(regions.map(r=>r.max))].sort().map(max=>`1–${max}`).join(' / ');
 const room=tree.branchRanges.filter(r=>r.count<r.max).length;
 return `一级各区 ${intervals} 根，二级每母枝 1–2 根；低于下限立即补枝。${room?'区间内随生长随机添枝':'当前已达数量上限'}`;
}
