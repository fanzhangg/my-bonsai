// Manual browser regression: node tests/watering-browser.mjs
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../prototype/',import.meta.url));
const server=http.createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=pathname==='/'?fileURLToPath(new URL('./watering-browser.html',import.meta.url)):path.resolve(root,'.'+pathname);
  if(pathname!=='/'&&!file.startsWith(root)){res.writeHead(403);res.end();return;}
  const body=await readFile(file);
  res.writeHead(200,{'Content-Type':file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-store'});res.end(body);
 }catch{res.writeHead(404);res.end();}
});
server.listen(0,'127.0.0.1',()=>console.log(`Watering browser regression: http://127.0.0.1:${server.address().port}/`));
