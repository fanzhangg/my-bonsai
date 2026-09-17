import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {openStore} from './storage.mjs';
import {VERSION,snapshot} from './prototype/growth.mjs';
import {configForClaim} from './prototype/claim.mjs';
import {coordinates,weatherAt} from './weather-service.mjs';
const root=path.resolve(fileURLToPath(new URL('./prototype/',import.meta.url)));
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export function createServer(store,{realtimeWeatherEnabled=process.env.REALTIME_WEATHER_ENABLED!=='false'}={}){
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
        const route=url.pathname.match(/^\/api\/trees(?:\/([^/]+)(?:\/(join|cuts))?)?$/);if(!route)fail(404,'找不到页面');
        const [,id,action]=route;if(id&&!uuid(id))fail(404,'找不到这盆树');
        if(action==='join')fail(410,'当前版本不支持加入');
        let body={};
        if(req.method==='POST'){
          if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)fail(403,'请从应用页面提交');
          if(!req.headers['content-type']?.startsWith('application/json'))fail(415,'需要 JSON');
          let bytes=0,chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>8192)fail(413,'请求过大');chunks.push(chunk);}try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{fail(400,'无效请求');}if(!body||Array.isArray(body)||typeof body!=='object')fail(400,'无效请求');
        }
        const result=tree=>({id:tree.id,version:tree.version,createdAt:tree.createdAt,config:tree.config,cuts:tree.cuts,serverNow:Date.now()});
        if(req.method==='GET'&&id&&!action){const tree=await store.get(id);if(!tree)fail(404,'找不到这盆树，请检查链接');return send(200,result(tree));}
        if(req.method!=='POST')fail(405,'不支持的操作');
        if(action==='cuts'){
          if(!uuid(body.id)||typeof body.branchId!=='string'||body.branchId.length>100)fail(400,'无效剪枝请求');
          const tree=await store.mutate(id,old=>{
            if(!old)fail(404,'找不到这盆树');
            const existing=old.cuts.find(c=>c.id===body.id);
            if(existing){if(existing.branchId!==body.branchId)fail(409,'剪枝请求已使用');return old;}
            const at=Date.now(),branch=snapshot(old,at).nodes.find(n=>n.id===body.branchId);
            if(!branch||branch.role!=='primary'||branch.growth<=0)fail(409,'这根枝条无法修剪');
            return {...old,cuts:[...old.cuts,{id:body.id,seq:old.cuts.length+1,at,branchId:branch.id}]};
          });
          return send(200,result(tree));
        }
        if(!id){
          if(!uuid(body.id))fail(400,'无效创建编号');
          const tree=await store.mutate(body.id,old=>old??{id:body.id,version:VERSION,createdAt:Date.now(),config:configForClaim(body.id),cuts:[]});
          return send(201,result(tree));
        }
        fail(405,'不支持的操作');
      }
      if(!['GET','HEAD'].includes(req.method))fail(405,'不支持的操作');
      const name=url.pathname==='/'||/^\/t\/[^/]+$/.test(url.pathname)?'/index.html':decodeURIComponent(url.pathname);
      const target=path.resolve(root,`.${name}`);if(!target.startsWith(root+path.sep)||!['.html','.css','.mjs','.svg'].includes(path.extname(target)))fail(404,'找不到页面');
      let file;try{file=await readFile(target);}catch{fail(404,'找不到页面');}
      res.writeHead(200,{'Content-Type':({'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(target)]+'; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'});res.end(req.method==='HEAD'?undefined:file);
    }catch(e){send(e.status||503,{error:e.status?e.message:'暂时无法保存，请稍后重试'});}
  });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const store=await openStore();const server=createServer(store);server.listen(Number(process.env.PORT||4173),process.env.HOST||(process.env.NODE_ENV==='production'?'0.0.0.0':'127.0.0.1'),()=>console.log(`一盆树: http://localhost:${process.env.PORT||4173}`));
  process.on('SIGTERM',()=>server.close(async()=>{await store.close();process.exit(0);}));
}
