const CACHE_NAME = "studyflow-shell-v3";
const CORE_ASSETS = ["/", "/index.html", "/manifest.json", "/studyflow-icon.svg"];

async function prepareOfflineShell() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(
    CORE_ASSETS.map((asset) =>
      cache.add(asset).catch((error) => {
        console.warn("StudyFlow could not pre-cache " + asset, error);
      })
    )
  );

  // CRA emits hashed JS/CSS names at build time. Discover and cache those exact
  // URLs during install so the first visit can work offline after one online load.
  try {
    const response = await fetch("/index.html", { cache: "no-store" });
    if (!response.ok) return;
    const html = await response.text();
    await cache.put("/index.html", new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }));

    const urls = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/gi)]
      .map((match) => match[1])
      .filter((value) => value.startsWith("/") && !value.startsWith("//"));

    await Promise.all(
      [...new Set(urls)].map((asset) =>
        cache.add(asset).catch((error) => {
          console.warn("StudyFlow could not pre-cache app asset " + asset, error);
        })
      )
    );
  } catch (error) {
    console.warn("StudyFlow could not discover offline build assets.", error);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    prepareOfflineShell().then(() => self.skipWaiting())
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
        .then(async (response) => {
          if (response && response.ok) {
            await caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", response.clone()));
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

  if (/\.(?:js|css|svg|png|jpg|jpeg|webp|woff2?)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        // Keep the network promise handled even when a cached response is available.
        const network = fetch(request)
          .then(async (response) => {
            if (response && response.ok && response.type === "basic") {
              await caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
            }
            return response;
          })
          .catch(() => null);
        return cached || network.then((response) => response || Response.error());
      })
    );
  }
});
