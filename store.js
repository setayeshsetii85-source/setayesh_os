import {empty,defaults} from './model.js';
import {schema} from './schema.js';
import {cardOrder} from './expansion.js';
export const maxNum=k=>({mastery:100,energy:5,satisfaction:5,rating:5,level:4,progress:100,minutes:1440,estimate:1440,actual:1440}[k]??1e12);
const safeKey=s=>typeof s==='string'&&/^[\p{L}\p{N}:_\-]{1,150}$/u.test(s)&&!['__proto__','constructor','prototype'].includes(s);
export const validDate=s=>typeof s==='string'&&/^20\d\d-\d\d-\d\d$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
export const validTime=s=>typeof s==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export function clean(raw){
 if(!raw||raw.version!==1||!Array.isArray(raw.items)||raw.items.length>20000||!raw.overrides||!raw.settings)throw Error('ساختار پشتیبان معتبر نیست.');
 const out=empty(), ids=new Set();
 for(const x of raw.items){
 if(!x||!safeKey(x.id)||ids.has(x.id)||!Object.hasOwn(schema,x.type)||!validDate(x.date))throw Error('رکورد یا تاریخ پشتیبان نامعتبر است.');
 ids.add(x.id);const y={id:x.id,type:x.type,date:x.date};
 for(const [k,l,t,v] of schema[x.type][1]){
 const z=x[k];if(z==null||z==='')continue;
 if(t==='num'){if(!Number.isSafeInteger(Number(z))||+z<0||+z>maxNum(k))throw Error(`عدد نامعتبر: ${l}`);y[k]=+z;}
 else if(typeof z!=='string'||z.length>8000||(t==='select'&&!v.includes(z))||(t==='date'&&!validDate(z))||(t==='time'&&!validTime(z))||(t==='ref'&&!safeKey(z))||(t==='url'&&!/^https:\/\/[^\s]+$/i.test(z)))throw Error(`مقدار نامعتبر: ${l}`);
 else y[k]=z;
 }if(['activity','event'].includes(y.type)&&((!!y.start)!==(!!y.end)||y.start&&y.start>=y.end||y.type==='activity'&&!y.start))throw Error('بازهٔ زمانی نامعتبر است.');out.items.push(y);
 }
 const refs=new Set(out.items.filter(x=>x.type==='client').map(x=>x.id)), activity=out.items.filter(x=>x.type==='activity').sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start));
 if(activity.some((x,i)=>!x.title?.trim()||!x.category||i>0&&x.date===activity[i-1].date&&x.start<activity[i-1].end))throw Error('رکوردهای زمان ناقص یا هم‌پوشان‌اند.');
 for(const x of out.items){if(['sale','contactlog'].includes(x.type)&&!refs.has(x.clientId))throw Error('پروندهٔ پیگیری یا فروش موجود نیست.');if(x.type==='sale'&&(!x.count||x.price==null||x.count*x.price>1e12||(x.discount||0)>x.count*x.price||(x.received||0)>x.count*x.price-(x.discount||0)))throw Error('مقادیر فروش نامعتبر است.');}
 const entries=Object.entries(raw.overrides);if(entries.length>40000)throw Error('حجم تقویم بیشتر از حد مجاز است.');
 for(const [k,v] of entries){if(!safeKey(k)||!v||!['باز','انجام شد','در حال انجام','حذف'].includes(v.status))throw Error('تغییر تقویم نامعتبر است.');out.overrides[k]={status:v.status};}
 for(const k of Object.keys(defaults)){
 const v=raw.settings[k];if(v===undefined)continue;
 if(k==='negative'){if(typeof v!=='boolean')throw Error('تنظیم درصد نامعتبر است.');}
 else if(['wake','sleep','schoolStart'].includes(k)){if(!validTime(v)&&!(k==='schoolStart'&&v===''))throw Error('ساعت تنظیمات نامعتبر است.');}
 else if(!Number.isInteger(v)||v<1||v>(k==='english'?45:k==='waterGoal'?30:720))throw Error('هدف زمانی نامعتبر است.');
 out.settings[k]=v;
 }
 if(raw.ui){const {theme,cards}=raw.ui;if(!['light','dark','system'].includes(theme)||cards!==null&&(!Array.isArray(cards)||cards.length>cardOrder.length||new Set(cards).size!==cards.length||!cards.every(x=>cardOrder.includes(x))))throw Error('چیدمان نامعتبر است.');out.ui={theme,cards};}
 if(raw.timer!=null){const {start,title,category}=raw.timer;if(!Number.isSafeInteger(start)||start<946684800000||start>4102444800000||typeof title!=='string'||!title.trim()||title.length>400||!schema.activity[1].find(x=>x[0]==='category')[3].includes(category))throw Error('تایمر نامعتبر است.');out.timer={start,title,category};}
 out.rev=Number.isSafeInteger(raw.rev)&&raw.rev>=0?raw.rev:0;return out;
}
const open=new Promise((resolve,reject)=>{const req=indexedDB.open('setayesh-local',1);req.onupgradeneeded=()=>req.result.createObjectStore('snap');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
export async function load(){const db=await open;return new Promise((res,rej)=>{const r=db.transaction('snap').objectStore('snap').get('main');r.onsuccess=()=>res(r.result||empty());r.onerror=()=>rej(r.error);});}
export async function save(next,rev){const db=await open;return new Promise((res,rej)=>{const tx=db.transaction('snap','readwrite'),store=tx.objectStore('snap'),r=store.get('main');let conflict=false; r.onsuccess=()=>{if((r.result?.rev||0)!==rev){conflict=true;tx.abort();return;}next.rev=rev+1;store.put(next,'main');};tx.oncomplete=()=>res(next);tx.onabort=()=>rej(conflict?Error('داده در پنجره دیگری تغییر کرده است. صفحه را بازخوانی کنید.'):tx.error||Error('ذخیره انجام نشد.'));});}
