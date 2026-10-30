// JullSir Service Worker for Web Push & Notification
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'JullSir(줄서)', body: '순번이 호출되었습니다! 지금 입장해 주세요.', url: '/Jullsir/' };
  
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/Jullsir/favicon.svg',
    badge: '/Jullsir/favicon.svg',
    vibrate: [300, 100, 300, 100, 300],
    data: {
      url: data.url || '/Jullsir/'
    },
    requireInteraction: true,
    tag: 'jullsir-ticket-call'
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/Jullsir/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/Jullsir/') && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
