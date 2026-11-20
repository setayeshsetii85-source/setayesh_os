import test from 'node:test';
import assert from 'node:assert/strict';
import webpush from 'web-push';
const {generateVAPIDKeys,generateRequestDetails}=webpush;
import {createECDH,randomBytes} from 'node:crypto';
import {agenda,empty,elapsed,plan,range,stats,pct,clashes,days} from '../public/model.js';
import {makeRules,clock} from '../public/push-shared.js';
import {makeApp} from '../server.js';

test('Saturday week, distinct project days, no overlap, intended study capacity',()=>{
 const state=empty(), list=range('2026-11-20','هفتگی');assert.equal(list[0],'2026-11-14');assert.equal(list[6],'2026-11-20');
 for(const [i,d] of list.entries()){
  const r=plan(d,state.settings), study=r.filter(x=>x.category==='مطالعه');assert.ok(r.every(x=>!x.start||!clashes(r,x)),days[i]);assert.equal(study.reduce((n,x)=>n+elapsed(x.start,x.end),0),i<5?180:300);assert.ok(r.some(x=>x.title.includes(i%2===0||i===6?'تولید محتوا · آقای اسپیگات':'تولید محتوا · ویترا')));assert.ok(r.some(x=>x.title==='پیگیری مشتریان اسپیگات'));
 }
 state.settings.schoolStart='06:45';assert.equal(plan(list[0],state.settings).filter(x=>x.category==='مطالعه').length,2);state.settings.wake='10:00';assert.ok(plan(list[6],state.settings).every((x,_,rows)=>!clashes(rows,x)));
});
test('completion does not create study, video watch excluded, sleep spans midnight',()=>{
 const q=empty(),date='2026-11-20';const item=agenda(q,date)[0];q.overrides[item.id]={status:'انجام شد'};
 q.items.push({type:'study',date,minutes:40,tests:4,correct:2,wrong:1},{type:'video',date,watched:70,active:12},{type:'sleep',date,bed:'21:00',wake:'05:00'});
 const s=stats(q,[date]);assert.equal(s.m,52);assert.equal(s.sleep[0],480);assert.equal(s.percent,pct(2,1,4,true));assert.equal(s.tasks.filter(x=>x.status==='انجام شد').length,1);assert.ok([29,30,31].includes(range(date,'ماهانه').length));
});
test('Tehran wall time and production Web Push encrypted request',()=>{
 assert.deepEqual(clock('Asia/Tehran',new Date('2026-11-20T16:30:00Z')),{date:'2026-11-20',time:'20:00',day:6});
 const e=createECDH('prime256v1');e.generateKeys();const sub={endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:e.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}};
 const pair=generateVAPIDKeys(), req=generateRequestDetails(sub,JSON.stringify({body:'سلام'}),{vapidDetails:{...pair,subject:'mailto:admin@example.com'},contentEncoding:'aes128gcm'});assert.equal(req.headers['Content-Encoding'],'aes128gcm');assert.ok(req.headers.Authorization.startsWith('vapid '));assert.ok(!req.body.includes(Buffer.from('سلام')));
});
test('HTTP auth, device config, duplicate prevention, once, snooze, history and wipe',async t=>{
 let ts=Date.parse('2026-11-20T16:30:00Z');const deliveries=[],key='x'.repeat(48),pair=generateVAPIDKeys(),app=makeApp({key,publicKey:pair.publicKey,deliver:async(s,p)=>deliveries.push(p),now:()=>ts});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>{app.server.close();app.db.close();});
 const base=`http://127.0.0.1:${app.server.address().port}`,call=(uri,method='GET',body,auth=true)=>fetch(`${base}/api/${uri}`,{method,headers:{...(auth?{Authorization:`Bearer ${key}`}:{ }),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 assert.equal((await call('config','GET',null,false)).status,401);assert.equal((await fetch(base+'/')).status,200);assert.equal((await fetch(base+'/private/push.sqlite')).status,404);
 const e=createECDH('prime256v1');e.generateKeys();const sub={endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:e.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}};
 const config={zone:'Asia/Tehran',rules:makeRules()};assert.equal((await call('device','PUT',{sub:{...sub,endpoint:'https://example.com/test'},config})).status,400);assert.equal((await call('device','PUT',{sub,config})).status,200);
 const once={date:'2026-11-20',time:'20:01',kind:'study'};assert.equal((await call('once','POST',once)).status,200);await call('once','POST',once);
 await app.tick();await app.tick();assert.equal(deliveries.length,1);assert.equal(deliveries[0].id,'daily:report:2026-11-20');
 const token=deliveries[0].snooze;assert.equal((await call('snooze','POST',{...token,signature:'fake'},false)).status,403);assert.equal((await call('snooze','POST',token,false)).status,200);await call('snooze','POST',token,false);
 ts+=60000;await app.tick();assert.equal(deliveries.length,2);assert.equal(deliveries[1].title,'مطالعه و تست');ts+=540000;await app.tick();await app.tick();assert.equal(deliveries.length,3);assert.equal(deliveries[2].snooze,null);
 const out=await (await call('config')).json();assert.equal(out.queue.length,0);assert.ok(out.history.every(x=>x.status==='accepted'));await call('device','DELETE');assert.equal((await (await call('config')).json()).history.length,0);
});
