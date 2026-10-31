/* Keeps the app's own files on the phone so it opens instantly and works offline.
   Your item data is not stored here; it lives in the app's IndexedDB. Calls to Google are never intercepted. */
const BUILD = "35a3c2bcca";
const CACHE = "ftc-" + BUILD;
const PRECACHE = ["./","app.20af36e429.css","app.474d3985bf.js","fonts/bricolage-grotesque-latin-wght-normal.woff2","fonts/ibm-plex-mono-latin-400-normal.woff2","fonts/ibm-plex-mono-latin-600-normal.woff2","fonts/public-sans-latin-wght-normal.woff2","icon-180.png","icon-192.png","icon-512.png","icon.svg","index.html","manifest.webmanifest","scan-worker.2031b8c745.js","vendor/htm-3.1.1.umd.js","vendor/react-18.2.0.production.min.js","vendor/react-dom-18.2.0.production.min.js","vendor/zxing-0.21.3.min.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("ftc-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith(req.mode === "navigate" ? pageFirst(req) : cacheFirst(req));
});
// The page itself: newest from the network when there is one, saved copy when offline or slow.
async function pageFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(() => rej(new Error("slow")), 3500))]);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req, { ignoreSearch: true })) || (await cache.match("index.html")) || (await cache.match("./")) || Response.error();
  }
}
// Scripts, styles, fonts and icons have versioned or fingerprinted names, so a saved copy is always right.
async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}
