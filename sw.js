/* service worker da the relax club: deixa o site instalável como app e recebe as notificações.
   não guarda nada em cache (o site sempre vem atualizado). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});

/* notificação chegando (mandada por /api/avisos, /api/fila ou /api/news-aviso).
   dados: { titulo, texto, url, tag } */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (er) { d = { texto: e.data ? e.data.text() : '' }; }
  const titulo = d.titulo || 'the relax club';
  const opcoes = {
    body: d.texto || '',
    icon: '/teste/clara.jpg',
    badge: '/icone-192.png',
    tag: d.tag || 'trc',
    renotify: !!d.tag,
    data: { url: d.url || '/' },
    lang: 'pt-BR'
  };
  e.waitUntil(Promise.all([
    self.registration.showNotification(titulo, opcoes),
    self.navigator && self.navigator.setAppBadge ? self.navigator.setAppBadge(1).catch(() => {}) : null
  ]));
});

/* tocar na notificação: abre (ou foca) o app no link dela */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const alvo = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil((async () => {
    if (self.navigator && self.navigator.clearAppBadge) self.navigator.clearAppBadge().catch(() => {});
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of abertas) {
      if (c.url === alvo && 'focus' in c) return c.focus();
    }
    // link de fora (a news no substack) abre no navegador; link do site abre no app
    return self.clients.openWindow(alvo);
  })());
});
