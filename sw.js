// ── bump this version every time you deploy ──
const VERSION = 'techspeak-v3';
const ASSETS  = ['./index.html', './manifest.json', './icon-192.svg', './icon-512.svg'];

// INSTALL — cache core assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION).then(c => c.addAll(ASSETS))
  );
  // Skip waiting = new SW activates immediately, no need to close app
  self.skipWaiting();
});

// ACTIVATE — delete old caches, claim all open tabs instantly
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim()) // take control of all open tabs NOW
  );
});

// FETCH — network first for HTML (always get latest), cache fallback for assets
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Never intercept Firebase / Google API calls
  if (url.includes('firestore') || url.includes('googleapis') ||
      url.includes('firebase') || url.includes('gstatic')) return;

  // For the main HTML page — network first, fall back to cache
  if (e.request.mode === 'navigate' || url.endsWith('index.html')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // Save fresh copy to cache
          const clone = res.clone();
          caches.open(VERSION).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // For other assets — cache first, then network
  if (e.request.method !== 'GET') return;
  if (!url.startsWith(self.location.origin)) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.status === 200) {
          const clone = res.clone();
          caches.open(VERSION).then(c => c.put(e.request, clone));
        }
        return res;
      });
    }).catch(() => caches.match('./index.html'))
  );
});

// NOTIFICATION CLICK
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('index.html') && 'focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow('./index.html');
    })
  );
});

// PUSH
self.addEventListener('push', e => {
  let data = { title: 'Techspeak Tracker', body: 'You have pending tasks!' };
  try { if (e.data) data = e.data.json(); } catch(err) {}
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, tag: data.tag || 'ts-push', renotify: true
  }));
});
