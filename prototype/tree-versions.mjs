export const LEGACY_VERSION='bonsai-growth-2';
export const CURRENT_VERSION='bonsai-growth-3';
export const SUPPORTED_VERSIONS=[LEGACY_VERSION,CURRENT_VERSION];
export function treeVersion(record={}){
  const version=record.version??LEGACY_VERSION;
  if(!SUPPORTED_VERSIONS.includes(version))throw Object.assign(new Error('不支持的盆栽版本，请刷新页面后重试'),{status:400});
  return version;
}
