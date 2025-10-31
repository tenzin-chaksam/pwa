// public/sw.js
const CACHE_VERSION = "v1";
const CACHE_NAME = `log-manager-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

// Files to cache immediately on install
const PRECACHE_URLS = ["/", "/manifest.json"];

// Install - cache static assets
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker...");

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[SW] Precaching static assets");
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => {
        console.log("[SW] Skip waiting");
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error("[SW] Precaching failed:", error);
      })
  );
});

// Activate - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker...");

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old caches
            if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
              console.log("[SW] Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log("[SW] Claiming clients");
        return self.clients.claim();
      })
  );
});

// Fetch - network first, cache fallback
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // Skip API calls to DynamoDB (you want fresh data)
  // Adjust this pattern to match your API routes
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  event.respondWith(
    // Try network first
    fetch(request)
      .then((response) => {
        // If successful, cache the response
        if (response && response.status === 200) {
          const responseToCache = response.clone();

          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });
        }

        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log("[SW] Serving from cache:", url.pathname);
            return cachedResponse;
          }

          // Not in cache either - return offline page
          return new Response(
            `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <title>Offline</title>
                  <style>
                    body {
                      font-family: system-ui, -apple-system, sans-serif;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      min-height: 100vh;
                      margin: 0;
                      background: #f3f4f6;
                    }
                    .offline-container {
                      text-align: center;
                      padding: 2rem;
                      background: white;
                      border-radius: 0.5rem;
                      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    }
                    h1 { color: #ef4444; margin: 0 0 1rem 0; }
                    p { color: #6b7280; }
                  </style>
                </head>
                <body>
                  <div class="offline-container">
                    <h1>⚠️ You're Offline</h1>
                    <p>This page isn't available offline.</p>
                    <p>Please check your connection and try again.</p>
                  </div>
                </body>
              </html>
              `,
            {
              status: 503,
              statusText: "Service Unavailable",
              headers: new Headers({
                "Content-Type": "text/html",
              }),
            }
          );
        });
      })
  );
});

// Listen for messages from the client
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

console.log("[SW] Service worker script loaded");
