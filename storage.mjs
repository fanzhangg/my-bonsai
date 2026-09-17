import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
export async function openStore({url=process.env.DATABASE_URL,file=process.env.DATA_FILE||'data/trees.json'}={}){
  if(url){
    const {Pool}=await import('pg');const pool=new Pool({connectionString:url,max:5,connectionTimeoutMillis:10000});
    pool.on('error',()=>console.error('Database connection interrupted'));
    await pool.query('CREATE TABLE IF NOT EXISTS bonsai_trees (id uuid PRIMARY KEY, document jsonb NOT NULL)');
    return {
      async get(id){return (await pool.query('SELECT document FROM bonsai_trees WHERE id=$1',[id])).rows[0]?.document;},
      async mutate(id,fn){const client=await pool.connect();try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[id]);const old=(await client.query('SELECT document FROM bonsai_trees WHERE id=$1 FOR UPDATE',[id])).rows[0]?.document;const next=fn(old);await client.query('INSERT INTO bonsai_trees(id,document) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET document=EXCLUDED.document',[id,JSON.stringify(next)]);await client.query('COMMIT');return next;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}},
      async health(){await pool.query('SELECT 1');},async close(){await pool.end();}
    };
  }
  if(process.env.NODE_ENV==='production')throw new Error('Production requires DATABASE_URL');
  let documents={};try{documents=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  let queue=Promise.resolve();
  return {async get(id){await queue;return structuredClone(documents[id]);},mutate(id,fn){const task=queue.then(async()=>{const next=fn(structuredClone(documents[id]));const updated={...documents,[id]:next};await mkdir(path.dirname(file),{recursive:true});await writeFile(file+'.tmp',JSON.stringify(updated));await rename(file+'.tmp',file);documents=updated;return structuredClone(next);});queue=task.catch(()=>{});return task;},async health(){await queue;},async close(){await queue;}};
}
