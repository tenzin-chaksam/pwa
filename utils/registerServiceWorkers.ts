// app/utils/registerServiceWorker.ts
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    console.log("Service Workers not supported");
    return;
  }

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      console.log("Service Worker registered:", registration.scope);

      // Listen for updates
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        console.log("New Service Worker found!");

        newWorker?.addEventListener("statechange", () => {
          if (newWorker.state === "activated") {
            console.log("New Service Worker activated");
          }
        });
      });
    } catch (error) {
      console.error("Service Worker registration failed:", error);
    }
  });

  // Listen for messages from service worker
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data.type === "SYNC_COMPLETE") {
      const { count, total } = event.data;
      console.log(`✅ Synced ${count}/${total} offline logs`);

      // Show a notification or refresh the page
      if (count > 0) {
        if (
          confirm(
            `${count} offline log${
              count !== 1 ? "s" : ""
            } synced! Refresh to see updates?`
          )
        ) {
          window.location.reload();
        }
      }
    }
  });

  // Monitor online/offline status
  window.addEventListener("online", () => {
    console.log("Back online!");
    // Trigger sync manually if needed
    navigator.serviceWorker.ready.then((registration) => {
      if ("sync" in registration) {
        registration.sync.register("sync-logs");
      }
    });
  });

  window.addEventListener("offline", () => {
    console.log("You are offline");
  });
}
