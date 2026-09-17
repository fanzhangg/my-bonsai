// The same scissors silhouette for standalone design-review surfaces.
export function pruningTool(id){
 const tool=document.createElement('button');tool.id=id;tool.type='button';tool.className='pruning-scissors';
 tool.innerHTML='<svg viewBox="-54 -54 108 108" aria-hidden="true"><g class="scissor-half scissor-a"><path d="M0 -43 Q-10 -30 -6 -5 L17 22 L21 18 L5 -3 Z" fill="#a4afa7"/><path d="M13 17 C20 12 30 19 32 29 C35 41 29 48 21 45 C13 43 8 32 9 24 C9 21 11 19 13 17 Z M17 23 C13 25 16 36 22 39 C27 42 29 36 27 30 C25 23 21 20 17 23 Z" fill="currentColor" fill-rule="evenodd"/></g><g class="scissor-half scissor-b"><path d="M0 -43 Q10 -30 6 -5 L-17 22 L-21 18 L-5 -3 Z" fill="#c5cdc3"/><path d="M-13 17 C-20 12 -30 19 -32 29 C-35 41 -29 48 -21 45 C-13 43 -8 32 -9 24 C-9 21 -11 19 -13 17 Z M-17 23 C-13 25 -16 36 -22 39 C-27 42 -29 36 -27 30 C-25 23 -21 20 -17 23 Z" fill="currentColor" fill-rule="evenodd"/></g><circle r="3" fill="#a58b60"/></svg>';
 return tool;
}
