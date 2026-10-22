const C='xrp-paper-v1',F=['./','index.html','style.css','logic.js','app.js','manifest.json','icon-180.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(F))));
self.addEventListener('fetch',e=>{if(e.request.url.includes('coinbase.com'))return;e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});
