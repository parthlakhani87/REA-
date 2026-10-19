// PONGS Connect service worker: device notifications (task reminders, approvals, messages),
// home-screen badge, and an offline screen for the installed app.
const OFFLINE_CACHE = "pongs-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((c) => c.addAll([OFFLINE_URL, "/icons/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== OFFLINE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Only page navigations are intercepted, and only to show the offline screen when there is no connection.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "PONGS Connect", body: event.data && event.data.text() };
  }
  const show = self.registration.showNotification(data.title || "PONGS Connect", {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    tag: data.tag,
    renotify: Boolean(data.tag),
    vibrate: [120, 60, 120],
    timestamp: Date.now(),
    data: { url: data.url || "/app" },
  });
  // Dot on the home-screen icon until the app is opened again.
  const badge = self.navigator.setAppBadge ? self.navigator.setAppBadge().catch(() => {}) : Promise.resolve();
  event.waitUntil(Promise.all([show, badge]));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/app", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.startsWith(self.location.origin) && "focus" in w) {
          return w
            .focus()
            .then(() => w.navigate(url))
            .catch(() => self.clients.openWindow(url));
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
