const CACHE_NAME = 'jam-player-v1';
const ASSETS = [
  '/',
  '/index.html', // Ou o nome do seu arquivo principal
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;700;800&display=swap'
];

// Instalação: Salva os arquivos essenciais no navegador
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

// Estratégia: Tenta carregar da rede, se falhar (offline), usa o Cache
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
