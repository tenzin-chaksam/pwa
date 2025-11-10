// public/sw.js
const CACHE_NAME = "data-logger-v1";
const SYNC_TAG = "sync-logs";
const DB_NAME = "OfflineLogsDB";
const DB_VERSION = 1;
const STORE_NAME = "logs";

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log("Service Worker installing...");
  self.skipWaiting();
});

// Activate event
self.addEventListener("activate", (event) => {
  console.log("Service Worker activating...");
  event.waitUntil(clients.claim());
});

// Helper: Open IndexedDB with proper initialization
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("IndexedDB error:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      console.log("Creating IndexedDB object store...");
      const db = event.target.result;

      // Delete old store if it exists
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }

      // Create new store
      db.createObjectStore(STORE_NAME, { keyPath: "timestamp" });
      console.log("Object store created");
    };
  });
}

// Helper: Save data to IndexedDB
async function saveToIndexedDB(data) {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(data);

      request.onsuccess = () => {
        console.log(" Data saved to IndexedDB:", data);
        resolve();
      };

      request.onerror = () => {
        console.error("Failed to save to IndexedDB:", request.error);
        reject(request.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error("IndexedDB save error:", error);
    throw error;
  }
}

// Helper: Get all offline data from IndexedDB
async function getOfflineData() {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error("Failed to get from IndexedDB:", request.error);
        reject(request.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error("IndexedDB get error:", error);
    return [];
  }
}

// Helper: Clear offline data from IndexedDB
async function clearOfflineData() {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log(" Offline data cleared");
        resolve();
      };

      request.onerror = () => {
        console.error("Failed to clear IndexedDB:", request.error);
        reject(request.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error("IndexedDB clear error:", error);
  }
}

// Fetch event - intercept network requests
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only intercept POST requests to form actions (Remix uses /_root.data or similar)
  if (
    request.method === "POST" &&
    (url.search.includes("index") || url.pathname.includes(".data"))
  ) {
    console.log("Intercepting POST request:", request.url);

    event.respondWith(
      (async () => {
        try {
          // Try network request first
          const networkResponse = await fetch(request.clone());
          console.log("POST request succeeded");
          return networkResponse;
        } catch (error) {
          console.warn("Network request failed, saving offline...");

          try {
            const formData = await request.clone().formData();
            const fieldValue = formData.get("fieldValue");

            if (!fieldValue) {
              throw new Error("No field value found");
            }

            console.log("Saving to IndexedDB:", fieldValue);

            await saveToIndexedDB({
              fieldValue: fieldValue.toString(),
              timestamp: Date.now(),
              url: request.url,
            });

            if ("sync" in self.registration) {
              await self.registration.sync.register(SYNC_TAG);
              console.log("📋 Background sync registered");
            }

            //  Return a fake "success" response that Remix can safely parse
            return new Response(
              JSON.stringify({
                success: true,
                message: "Saved offline. Will sync when online.",
                offline: true,
              }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  // 👇 Prevent Remix from interpreting as turbo-stream
                  "X-Remix-Response": "json",
                },
              }
            );
          } catch (saveError) {
            console.error("Failed to save offline:", saveError);

            return new Response(
              JSON.stringify({
                success: false,
                message: "Failed to save offline: " + saveError.message,
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" },
              }
            );
          }
        }
      })()
    );
    return;
  }

  if (request.method === "GET") {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          // Return cached response immediately

          fetch(request).then((response) => {
            // Update the cache in background (stale-while-revalidate)

            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, response.clone());
            });
          });

          return cached;
        }

        // Not cached — fetch from network and cache it

        return fetch(request)
          .then((response) => {
            if (
              response &&
              response.status === 200 &&
              response.type === "basic"
            ) {
              const resClone = response.clone();

              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, resClone);
              });
            }

            return response;
          })

          .catch(() => {
            // Optional fallback when offline (e.g., offline.html)

            return caches.match("/");
          });
      })
    );
  }

  // Don't handle other requests - let them pass through naturally
});

// Background Sync event - retry failed requests
self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) {
    console.log(" Background sync triggered...");
    event.waitUntil(syncOfflineData());
  }
});

// Sync offline data when back online
async function syncOfflineData() {
  try {
    const offlineData = await getOfflineData();

    if (offlineData.length === 0) {
      console.log("No offline data to sync");
      return;
    }

    console.log(` Syncing ${offlineData.length} offline logs...`);

    let syncedCount = 0;

    // Send each item
    for (const item of offlineData) {
      try {
        const formData = new FormData();
        formData.append("fieldValue", item.fieldValue);

        const response = await fetch(item.url, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        syncedCount++;
        console.log(
          ` Synced item ${syncedCount}/${offlineData.length}:`,
          item.fieldValue
        );
      } catch (itemError) {
        console.error("Failed to sync item:", item, itemError);
        // Continue with other items
      }
    }

    // Clear synced data
    await clearOfflineData();
    console.log(
      ` Sync complete! ${syncedCount}/${offlineData.length} items synced`
    );

    // Notify all clients
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: "SYNC_COMPLETE",
        count: syncedCount,
        total: offlineData.length,
      });
    });
  } catch (error) {
    console.error(" Sync failed:", error);
    throw error; // Retry sync later
  }
}
