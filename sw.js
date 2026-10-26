/* service worker mínimo: deixa o site instalável como app. não guarda nada em cache (o site sempre vem atualizado). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
