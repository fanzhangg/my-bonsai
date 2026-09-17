import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {openStore} from './storage.mjs';
import {VERSION,snapshot,wateringRecovery} from './prototype/growth.mjs';
import {WATER_CAPACITY,WATERING_RULES,wateringAmount} from './prototype/watering-motion.mjs';
import {configForClaim} from './prototype/claim.mjs';
import {applyCheat} from './prototype/cheats.mjs';
import {coordinates,weatherAt} from './weather-service.mjs';
import {activity,activityKey,GALLERY_LIMIT,GALLERY_PAGE_SIZE,GALLERY_SORTS} from './activity.mjs';
import {publicOrigin,shareMetadata,createShareImageCache} from './share-preview.mjs';
const root=path.resolve(fileURLToPath(new URL('./prototype/',import.meta.url)));
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export function createServer(store,{realtimeWeatherEnabled=process.env.REALTIME_WEATHER_ENABLED!=='false',publicBaseUrl=process.env.PUBLIC_BASE_URL||process.env.RENDER_EXTERNAL_URL}={}){
  const shareImage=createShareImageCache();
  return http.createServer(async(req,res)=>{
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
    try{
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/runtime-config.mjs'){
        if(req.method!=='GET')fail(405,'不支持的操作');
        res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
        return res.end(`export const realtimeWeatherEnabled=${Boolean(realtimeWeatherEnabled)};`);
      }
      if(url.pathname==='/healthz'){await store.health();return send(200,{ok:true});}
      if(url.pathname==='/api/weather'){
        if(!realtimeWeatherEnabled)fail(503,'实时天气已关闭');
        if(req.method!=='GET')fail(405,'不支持的操作');
        let c;try{c=coordinates(url.searchParams.get('lat'),url.searchParams.get('lon'));}catch{fail(400,'无效位置');}
        try{return send(200,await weatherAt(c.lat,c.lon));}catch{fail(503,'天气暂不可用');}
      }
      if(url.pathname.startsWith('/api/')){
        if(url.pathname==='/api/gallery'){
          if(req.method!=='GET')fail(405,'不支持的操作');
          const sort=url.searchParams.get('sort')??'active';if(!GALLERY_SORTS.includes(sort))fail(400,'无效排序方式');
          let after=null;const cursor=url.searchParams.get('cursor');
          if(cursor!==null){
            try{if(cursor.length>512)throw new Error();after=JSON.parse(Buffer.from(cursor,'base64url').toString());}catch{fail(400,'无效分页');}
            if(!after||after.sort!==sort||!uuid(after.id)||!Number.isSafeInteger(after.at)||after.at<=0||!Number.isInteger(after.count)||after.count<1||after.count>=GALLERY_LIMIT)fail(400,'无效分页');
          }
          const count=after?.count??0,pageSize=Math.min(GALLERY_PAGE_SIZE,GALLERY_LIMIT-count);
          const records=await store.listGallery(sort,{after,limit:pageSize+1}),trees=records.slice(0,pageSize);
          const last=trees.at(-1),nextCursor=records.length>pageSize&&count+trees.length<GALLERY_LIMIT?Buffer.from(JSON.stringify({sort,id:last.id,at:activity(last)[activityKey(sort)],count:count+trees.length})).toString('base64url'):null;
          return send(200,{trees:trees.map(tree=>({id:tree.id,version:tree.version,createdAt:tree.createdAt,config:tree.config,cuts:tree.cuts,waterings:tree.waterings??[],...activity(tree)})),sort,limit:GALLERY_LIMIT,pageSize:GALLERY_PAGE_SIZE,nextCursor,serverNow:Date.now()});
        }
        const route=url.pathname.match(/^\/api\/trees(?:\/([^/]+)(?:\/(join|cuts|cheats|visits|waterings))?)?$/);if(!route)fail(404,'找不到页面');
        const [,id,action]=route;if(id&&!uuid(id))fail(404,'找不到这盆树');
        if(action==='join')fail(410,'当前版本不支持加入');
        let body={};
        if(req.method==='POST'){
          if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)fail(403,'请从应用页面提交');
          if(!req.headers['content-type']?.startsWith('application/json'))fail(415,'需要 JSON');
          let bytes=0,chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>8192)fail(413,'请求过大');chunks.push(chunk);}try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{fail(400,'无效请求');}if(!body||Array.isArray(body)||typeof body!=='object')fail(400,'无效请求');
        }
        const result=tree=>({id:tree.id,version:tree.version,createdAt:tree.createdAt,config:tree.config,cuts:tree.cuts,waterings:tree.waterings??[],wateringRules:WATERING_RULES,revision:tree.revision??0,serverNow:Date.now()});
        if(req.method==='GET'&&id&&!action){const tree=await store.get(id);if(!tree)fail(404,'找不到这盆树，请检查链接');return send(200,result(tree));}
        if(req.method!=='POST')fail(405,'不支持的操作');
        if(action==='visits'){
          const tree=await store.mutate(id,old=>{
            if(!old)fail(404,'找不到这盆树');
            return {...old,lastVisitedAt:Date.now()};
          });
          return send(200,{lastVisitedAt:tree.lastVisitedAt});
        }
        if(action==='cheats'){
          const tree=await store.mutate(id,old=>{
            if(!old)fail(404,'找不到这盆树');
            const at=Date.now();return {...applyCheat(old,body,at),lastInteractedAt:at};
          });
          return send(200,result(tree));
        }
        if(action==='waterings'){
          if(!uuid(body.id)||!Number.isFinite(body.used)||body.used<=0||body.used>WATER_CAPACITY+0.01)fail(400,'无效浇水请求');
          const tree=await store.mutate(id,old=>{
            if(!old)fail(404,'找不到这盆树');
            const waterings=old.waterings??[],existing=waterings.find(w=>w.id===body.id);
            if(existing){if(existing.used!==body.used)fail(409,'浇水请求已使用');return old;}
            const at=Date.now();return {...old,revision:(old.revision??0)+1,lastInteractedAt:at,waterings:[...waterings,{id:body.id,at,used:body.used,recoveryHours:wateringRecovery(snapshot(old,at),body.used),amount:wateringAmount(body.used)}]};
          });
          return send(200,result(tree));
        }
        if(action==='cuts'){
          if(!uuid(body.id)||typeof body.branchId!=='string'||body.branchId.length>100)fail(400,'无效剪枝请求');
          const tree=await store.mutate(id,old=>{
            if(!old)fail(404,'找不到这盆树');
            const existing=old.cuts.find(c=>c.id===body.id);
            if(existing){if(existing.branchId!==body.branchId)fail(409,'剪枝请求已使用');return old;}
            const at=Date.now(),branch=snapshot(old,at).nodes.find(n=>n.id===body.branchId);
            if(!branch||branch.role!=='primary'||branch.growth<=0)fail(409,'这根枝条无法修剪');
            return {...old,lastInteractedAt:at,revision:(old.revision??0)+1,cuts:[...old.cuts,{id:body.id,seq:old.cuts.length+1,at,branchId:branch.id}]};
          });
          return send(200,result(tree));
        }
        if(!id){
          if(!uuid(body.id))fail(400,'无效创建编号');
          const tree=await store.mutate(body.id,old=>{
            if(old)return old;
            const at=Date.now(),record={id:body.id,version:VERSION,createdAt:at,config:configForClaim(body.id),cuts:[],revision:0};
            return body.cheat===undefined?record:applyCheat(record,body.cheat,at);
          });
          return send(201,result(tree));
        }
        fail(405,'不支持的操作');
      }
      if(!['GET','HEAD'].includes(req.method))fail(405,'不支持的操作');
      const treePage=url.pathname.match(/^\/t\/([^/]+)(\/share\.png)?$/);
      let sharedTree;
      if(treePage){
        if(!uuid(treePage[1]))fail(404,'找不到这盆树');
        sharedTree=await store.get(treePage[1]);if(!sharedTree)fail(404,'找不到这盆树，请检查链接');
        if(treePage[2]){
          const png=req.method==='HEAD'?undefined:shareImage(sharedTree);
          res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'public, max-age=60','X-Content-Type-Options':'nosniff'});
          return res.end(png);
        }
      }
      const name=url.pathname==='/gallery'||url.pathname==='/gallery/'?'/gallery.html':url.pathname==='/'||/^\/t\/[^/]+$/.test(url.pathname)?'/index.html':decodeURIComponent(url.pathname);
      const target=path.resolve(root,`.${name}`);if(!target.startsWith(root+path.sep)||!['.html','.css','.mjs','.svg'].includes(path.extname(target)))fail(404,'找不到页面');
      let file;try{file=await readFile(target);}catch{fail(404,'找不到页面');}
      if(sharedTree)file=file.toString('utf8').replace('<title>一盆树</title>',shareMetadata(sharedTree,publicOrigin(req,publicBaseUrl)));
      res.writeHead(200,{'Content-Type':({'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(target)]+'; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'});res.end(req.method==='HEAD'?undefined:file);
    }catch(e){send(e.status||503,{error:e.status?e.message:'暂时无法保存，请稍后重试'});}
  });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const store=await openStore();const server=createServer(store);server.listen(Number(process.env.PORT||4173),process.env.HOST||(process.env.NODE_ENV==='production'?'0.0.0.0':'127.0.0.1'),()=>console.log(`一盆树: http://localhost:${process.env.PORT||4173}`));
  process.on('SIGTERM',()=>server.close(async()=>{await store.close();process.exit(0);}));
}
