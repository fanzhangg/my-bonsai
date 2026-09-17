export const GALLERY_LIMIT=200;
export const GALLERY_PAGE_SIZE=24;
export const GALLERY_SORTS=['active','interacted','visited'];

// Older records only have cut timestamps. Never use createdAt: cheat mode can
// rebase the growth timeline, and adoption alone is not a subsequent interaction.
export function activity(tree){
  const lastInteractedAt=tree.lastInteractedAt??Math.max(0,...(tree.cuts??[]).map(c=>c.at));
  const lastVisitedAt=tree.lastVisitedAt??0;
  return {lastInteractedAt,lastVisitedAt,lastActiveAt:Math.max(lastInteractedAt,lastVisitedAt)};
}
export function activityKey(sort){return {active:'lastActiveAt',interacted:'lastInteractedAt',visited:'lastVisitedAt'}[sort];}
