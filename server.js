import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {mkdirSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {createHash,createHmac,timingSafeEqual,randomUUID} from 'node:crypto';
import {rules,checkedConfig,checkedSub,onceValid,clock,due} from './public/push-shared.js';
const root=dirname(fileURLToPath(import.meta.url)), files=new Set('index.html app.js model.js schema.js store.js push.js push-shared.js sw.js style.css manifest.webmanifest icon-192.png icon-512.png vazir.woff2 FONT-LICENSE.txt'.split(' '));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
const hash=s=>createHash('sha256').update(s).digest();
const equal=(a,b)=>timingSafeEqual(hash(a),hash(b));
const nowISO=t=>new Date(t).toISOString();
export function makeApp({dbPath=':memory:', key='', publicKey='', deliver=null, now=()=>Date.now()}={}){
 if(dbPath!==':memory:')mkdirSync(dirname(dbPath),{recursive:true,mode:0o700});
 const db=new DatabaseSync(dbPath);db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS device (id INTEGER PRIMARY KEY CHECK(id=1),sub TEXT NOT NULL,config TEXT NOT NULL); CREATE TABLE IF NOT EXISTS queue(id TEXT PRIMARY KEY, kind TEXT NOT NULL, day TEXT, time TEXT, at INTEGER); CREATE TABLE IF NOT EXISTS sent(id TEXT PRIMARY KEY, kind TEXT NOT NULL, at INTEGER NOT NULL, status TEXT NOT NULL);`);
 const sql=(s,...a)=>db.prepare(s).run(...a), get=(s,...a)=>db.prepare(s).get(...a), all=(s,...a)=>db.prepare(s).all(...a);
 const tx=f=>{db.exec('BEGIN IMMEDIATE');try{const r=f();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}};
 const active=!!(key.length>=32&&publicKey&&deliver), token=(id,expiry,identity)=>createHmac('sha256',key).update(`${id}:${expiry}:${identity}`).digest('base64url');
 let busy=false;
 async function tick(){if(!active||busy)return;busy=true;try{
  const t=now(), dev=get('SELECT * FROM device');if(!dev)return;
  const sub=JSON.parse(dev.sub), cfg=JSON.parse(dev.config), local=clock(cfg.zone,new Date(t)), identity=hash(sub.endpoint).toString('hex');
  const jobs=cfg.rules.filter(r=>r.enabled&&r.days.includes(local.day)&&due(local,r.time)).map(r=>({id:`daily:${r.id}:${local.date}`,kind:r.id}));
  const queued=all('SELECT * FROM queue');
  for(const q of queued){const arrived=q.at!=null?t>=q.at:q.day===local.date&&due(local,q.time);const expired=q.at!=null?t-q.at>=600000:q.day<local.date||q.day===local.date&&q.time<=local.time&&!arrived;if(arrived&&!expired)jobs.push(q);else if(expired)tx(()=>{sql('DELETE FROM queue WHERE id=?',q.id);sql('INSERT OR IGNORE INTO sent VALUES(?,?,?,?)',q.id,q.kind,t,'expired');});}
  for(const j of jobs){if(get('SELECT sub FROM device')?.sub!==dev.sub)break;
   if(!tx(()=>{if(j.id.startsWith('one:')||j.id.startsWith('snooze:'))if(!sql('DELETE FROM queue WHERE id=?',j.id).changes)return false;return !!sql('INSERT OR IGNORE INTO sent VALUES(?,?,?,?)',j.id,j.kind,t,'claimed').changes;}))continue;
   const expiry=t+3600000, payload={id:j.id,title:rules[j.kind][0],body:rules[j.kind][1],snooze:j.id.startsWith('snooze:')?null:{id:j.id,expiry,signature:token(j.id,expiry,identity)}};
   try{await deliver(sub,payload);sql('UPDATE sent SET status=? WHERE id=?','accepted',j.id);}catch(e){const expired=[404,410].includes(e.statusCode);sql('UPDATE sent SET status=? WHERE id=?',expired?'subscription-expired':'failed',j.id);if(expired){const removed=sql('DELETE FROM device WHERE sub=?',dev.sub);if(removed.changes)sql('DELETE FROM queue');break;}}
  }sql('DELETE FROM sent WHERE at<?',t-45*86400000);
 }finally{busy=false;}}
 async function json(req){if(!String(req.headers['content-type']).startsWith('application/json'))throw Error('فرمت درخواست JSON نیست.');let text='',len=0;for await(const part of req){len+=part.length;if(len>25000)throw Error('درخواست بزرگ است.');text+=part;}return JSON.parse(text);}
 const server=createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  const send=(status,obj)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj));};
  const path=req.url.split('?')[0], method=req.method;
  try{
   if(path.startsWith('/api/')){
    if(path==='/api/status'&&method==='GET')return send(200,{available:active});
    if(!active)return send(503,{error:'سرور اعلان راه‌اندازی نشده است.'});
    if(path==='/api/snooze'&&method==='POST'){
     const x=await json(req), t=now(), dev=get('SELECT sub FROM device'), source=typeof x?.id==='string'&&x.id.length<160&&get('SELECT * FROM sent WHERE id=?',x.id);
     if(!dev||!source||x.id.startsWith('snooze:')||!Number.isSafeInteger(x.expiry)||x.expiry<t||x.expiry!==source.at+3600000||typeof x.signature!=='string'||!equal(token(x.id,x.expiry,hash(JSON.parse(dev.sub).endpoint).toString('hex')),x.signature))return send(403,{error:'درخواست تعویق معتبر نیست.'});
     const sid=`snooze:${x.id}`;tx(()=>{if(!get('SELECT id FROM sent WHERE id=?',sid))sql('INSERT OR IGNORE INTO queue VALUES(?,?,NULL,NULL,?)',sid,source.kind,t+600000);});return send(200,{ok:true});
    }
    if(!equal(req.headers.authorization||'',`Bearer ${key}`))return send(401,{error:'کلید راه‌اندازی صحیح نیست.'});
    if(path==='/api/config'&&method==='GET'){const d=get('SELECT config FROM device');return send(200,{publicKey,config:d?JSON.parse(d.config):null,queue:all('SELECT id,kind,day,time,at FROM queue ORDER BY day,time LIMIT 100'),history:all('SELECT kind,at,status FROM sent ORDER BY at DESC LIMIT 30').map(x=>({...x,at:nowISO(x.at)}))});}
    if(path==='/api/device'&&method==='PUT'){
     const x=await json(req),sub=checkedSub(x.sub),cfg=checkedConfig(x.config);
     tx(()=>{const prev=get('SELECT sub,config FROM device');if(prev&&(JSON.parse(prev.sub).endpoint!==sub.endpoint||JSON.parse(prev.config).zone!==cfg.zone))sql('DELETE FROM queue');sql('INSERT OR REPLACE INTO device VALUES(1,?,?)',JSON.stringify(sub),JSON.stringify(cfg));});return send(200,{ok:true});}
    if(path==='/api/device'&&method==='DELETE'){tx(()=>{sql('DELETE FROM device');sql('DELETE FROM queue');sql('DELETE FROM sent');});return send(200,{ok:true});}
    if(path==='/api/once'&&method==='POST'){
     const d=get('SELECT config FROM device');if(!d)throw Error('اول دستگاه را ثبت کن.');const x=onceValid(await json(req),JSON.parse(d.config).zone,new Date(now()));
     if(get('SELECT COUNT(*) AS n FROM queue').n>=100)throw Error('صف اعلان پر است.');
     if(!get('SELECT id FROM queue WHERE kind=? AND day=? AND time=?',x.kind,x.date,x.time))sql('INSERT INTO queue VALUES(?,?,?,?,NULL)',`one:${randomUUID()}`,x.kind,x.date,x.time);return send(200,{ok:true});}
    if(path==='/api/once'&&method==='DELETE'){const x=await json(req);if(typeof x?.id==='string')sql('DELETE FROM queue WHERE id=?',x.id);return send(200,{ok:true});}
    return send(404,{error:'مسیر پیدا نشد.'});
   }
   const file=path==='/'?'index.html':path.slice(1);if(!['GET','HEAD'].includes(method)||!files.has(file))return send(404,{error:'صفحه پیدا نشد.'});
   const data=await readFile(resolve(root,'public',file));res.writeHead(200,{'Content-Type':types[extname(file)],'Cache-Control':'no-cache'});res.end(method==='HEAD'?undefined:data);
  }catch(e){if(!res.headersSent)send(400,{error:path.startsWith('/api/')&&e instanceof SyntaxError?'درخواست معتبر نیست.':path.startsWith('/api/')&&e instanceof RangeError?'منطقه زمانی نامعتبر است.':String(e.message).includes('SQLITE')?'خطای ذخیره‌سازی سرور.':e.message});else res.end();}
 });
 return {server,tick,db};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {PUSH_SETUP_KEY:key='',VAPID_PUBLIC:publicKey='',VAPID_PRIVATE:privateKey='',VAPID_SUBJECT:subject='',PORT='8080',HOST='127.0.0.1',DB_PATH}=process.env;
 let deliver=null;if(key||publicKey||privateKey||subject){if(key.length<32||!publicKey||!privateKey||!subject)throw Error('PUSH_SETUP_KEY (≥32), VAPID_PUBLIC, VAPID_PRIVATE and VAPID_SUBJECT are all required.');const webpush=(await import('web-push')).default;webpush.setVapidDetails(subject,publicKey,privateKey);deliver=(sub,p)=>webpush.sendNotification(sub,JSON.stringify(p),{TTL:600,timeout:8000,urgency:'normal',topic:hash(p.id).toString('base64url').slice(0,32)});}
 const app=makeApp({dbPath:deliver?(DB_PATH||resolve(root,'private/push.sqlite')):':memory:',key,publicKey,deliver});app.server.listen(+PORT,HOST,()=>console.log(`SETAYESH OS · http://${HOST}:${PORT} · push ${deliver?'on':'off'}`));
 if(deliver){const check=()=>app.tick().catch(()=>console.error('Push scheduler error'));setInterval(check,15000).unref();check();}
}
