const CACHE_NAME = "studyflow-shell-v1";
const CORE_ASSETS = ["/", "/index.html", "/manifest.json", "/studyflow-icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch((error) => {
        // Installation should still succeed if one optional shell asset is unavailable.
        console.warn("StudyFlow offline shell cache was only partially prepared.", error);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("studyflow-shell-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/auth/") || url.pathname.startsWith("/rest/")) return;
  if (/\.(?:map|json5?)$/i.test(url.pathname) && url.pathname !== "/manifest.json") return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match("/index.html");
          return cached || caches.match("/");
        })
    );
    return;
  }

  // Cache app assets after the first successful fetch. Hashed build filenames
  // ensure new deploys get distinct cache entries instead of stale code.
  if (/\.(?:js|css|svg|png|jpg|jpeg|webp|woff2?)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request).then((response) => {
          if (response && response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
        return cached || network.catch(() => Response.error());
      })
    );
  }
});
