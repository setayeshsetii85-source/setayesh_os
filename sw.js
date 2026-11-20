const CACHE='setayesh-shell-v3';
const BASE='/setayesh_os/';

const SHELL=[
 './',
 './index.html',
 './style.css',
 './app.js',
 './model.js',
 './store.js',
 './schema.js',
 './push.js',
 './push-shared.js',
 './icon-192.png',
 './icon-512.png',
 './manifest.webmanifest',
 './vazir.woff2'
].map(path=>new URL(path,self.location.origin+BASE).pathname);

self.addEventListener('install',event=>event.waitUntil(
 caches.open(CACHE)
  .then(cache=>cache.addAll(SHELL))
  .then(()=>self.skipWaiting())
));

self.addEventListener('activate',event=>event.waitUntil(
 caches.keys().then(keys=>Promise.all(
  keys.filter(k=>k.startsWith('setayesh-shell-')&&k!==CACHE)
   .map(k=>caches.delete(k))
 )).then(()=>self.clients.claim())
));

/* دریافت نسخه جدید از اینترنت و استفاده از کش هنگام آفلاین بودن */
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);

 if(
  event.request.method!=='GET'||
  url.origin!==self.location.origin||
  !SHELL.includes(url.pathname)
 )return;

 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);

  try{
   const response=await fetch(event.request);

   if(response.ok){
    await cache.put(url.pathname,response.clone());
   }

   return response;
  }catch(error){
   const cached=await cache.match(url.pathname);

   if(cached)return cached;

   throw error;
  }
 })());
});

self.addEventListener('push',event=>{
 let p;

 try{
  p=event.data?.json();
 }catch{}

 if(!p?.id||!p.title)return;

 event.waitUntil(self.registration.showNotification(p.title,{
  body:p.body,
  icon:BASE+'icon-192.png',
  badge:BASE+'icon-192.png',
  tag:p.id,
  renotify:false,
  dir:'rtl',
  lang:'fa',
  data:p.snooze,
  actions:p.snooze?[{action:'snooze',title:'۱۰ دقیقه بعد'}]:[]
 }));
});

self.addEventListener('notificationclick',event=>{
 event.notification.close();

 event.waitUntil((async()=>{
  if(event.action==='snooze'&&event.notification.data){
   try{
    const r=await fetch(BASE+'api/snooze',{
     method:'POST',
     headers:{'Content-Type':'application/json'},
     body:JSON.stringify(event.notification.data)
    });

    if(!r.ok)throw Error();

   }catch{
    await self.registration.showNotification('تعویق ثبت نشد',{
     body:'اتصال اینترنت را بررسی کن و در تنظیمات یادآور جدید بساز.',
     tag:'snooze-error',
     icon:BASE+'icon-192.png'
    });
   }

   return;
  }

  const windows=await self.clients.matchAll({
   type:'window',
   includeUncontrolled:true
  });

  if(windows.length){
   await windows[0].focus();
   return;
  }

  await self.clients.openWindow(BASE);
 })());
});
