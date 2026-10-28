const CACHE_NAME = 'viagem-app-v68';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://unpkg.com/@zxing/library@0.23.0/umd/index.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // Item por item (em vez de addAll) para que uma falha isolada (ex: CDN
      // bloqueada numa rede específica) não impeça o resto de ficar offline.
      .then((cache) => Promise.all(ASSETS.map(async (url) => {
        try {
          // Bibliotecas de CDN têm a versão na URL e nunca mudam: reaproveita
          // a cópia da versão anterior em vez de baixar tudo de novo (era o
          // que mais atrasava o aviso de "nova versão" no celular).
          if (url.startsWith('https://')) {
            const old = await caches.match(url);
            if (old) return cache.put(url, old);
          }
          // cache: 'reload' pula o cache HTTP do navegador — o GitHub Pages
          // manda guardar por 10 min, e sem isso a versão nova podia salvar
          // o index.html antigo.
          await cache.add(new Request(url, { cache: 'reload' }));
        } catch (e) {}
      })))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Só GET é cacheável, e deixamos passar direto qualquer coisa fora do nosso
// próprio domínio + CDNs conhecidos (o Firebase Realtime Database sincroniza
// por WebSocket, não por fetch, então não é afetado por isto).
// Dados ao vivo (cotação, previsão do tempo) vão sempre direto à rede: antes
// passavam pelo cache como o resto e a cotação ficava congelada no valor da
// primeira consulta até a próxima versão do app.
const LIVE_HOSTS = ['economia.awesomeapi.com.br', 'open.er-api.com', 'api.open-meteo.com', 'geocoding-api.open-meteo.com'];

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (LIVE_HOSTS.includes(new URL(event.request.url).hostname)) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
