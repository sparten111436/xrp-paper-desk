const V='v5',C='xrp-paper-'+V,F=['./','index.html','style.css?v=5','logic.js?v=5','app.js?v=5','manifest.json','icon-180.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(F.map(u=>new Request(u,{cache:'reload'})))))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
// network-first for pages + code; cache only as offline fallback
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
 const code=e.request.mode==='navigate'||/\.(html|js|css)$/.test(u.pathname)||u.pathname.endsWith('/');
 if(code){e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r;})
   .catch(()=>caches.match(e.request,{ignoreSearch:false}).then(r=>r||caches.match(e.request,{ignoreSearch:true})).then(r=>r||caches.match('index.html'))));return;}
 e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});
