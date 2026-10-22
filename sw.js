const C='xrp-paper-v2',F=['./','index.html','style.css','logic.js','app.js','manifest.json','icon-180.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(F)))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.url.includes('coinbase.com'))return;e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});
