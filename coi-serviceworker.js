/*! coi-service-worker v0.1.7 - Guido Zuidhof and contributors, licensed under MIT */
// https://github.com/nicm/nicm.github.io/blob/master/coi-serviceworker.js
// Minimal service worker that adds COOP/COEP headers to enable SharedArrayBuffer
// on hosting platforms (like GitHub Pages) that don't allow custom HTTP headers.
let coepCredentialless = false;
if (typeof window === "undefined") {
  // Service worker scope
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

  self.addEventListener("message", (ev) => {
    if (ev.data && ev.data.type === "deregister") {
      self.registration
        .unregister()
        .then(() => self.clients.matchAll())
        .then((clients) => clients.forEach((client) => client.navigate(client.url)));
    }
  });

  self.addEventListener("fetch", function (e) {
    if (
      e.request.cache === "only-if-cached" &&
      e.request.mode !== "same-origin"
    ) {
      return;
    }

    e.respondWith(
      fetch(e.request)
        .then((r) => {
          if (r.status === 0) return r;

          const headers = new Headers(r.headers);
          headers.set("Cross-Origin-Embedder-Policy",
            coepCredentialless ? "credentialless" : "require-corp");
          headers.set("Cross-Origin-Opener-Policy", "same-origin");

          return new Response(r.body, {
            status: r.status,
            statusText: r.statusText,
            headers,
          });
        })
        .catch((e) => console.error(e))
    );
  });
} else {
  // Window scope — register the service worker
  const reloadedBySelf = window.sessionStorage.getItem("coiReloadedBySelf");
  window.sessionStorage.removeItem("coiReloadedBySelf");
  const coepDegrading = reloadedBySelf === "coepdegrade";

  // If SharedArrayBuffer is already available, no action needed.
  if (window.crossOriginIsolated !== false || window.SharedArrayBuffer) return;

  if (!window.isSecureContext) {
    console.log("COOP/COEP service worker: not a secure context, skipping.");
    return;
  }

  // Register ourselves as a service worker.
  const n = navigator;
  if (n.serviceWorker) {
    n.serviceWorker.register(new URL("coi-serviceworker.js", import.meta.url).href).then(
      (registration) => {
        registration.addEventListener("updatefound", () => {
          const newSW = registration.installing;
          newSW.addEventListener("statechange", () => {
            if (newSW.state === "activated" && !coepDegrading) {
              window.sessionStorage.setItem("coiReloadedBySelf", "coiReload");
              window.location.reload();
            }
          });
        });

        if (registration.active && !reloadedBySelf) {
          window.sessionStorage.setItem("coiReloadedBySelf", "coiReload");
          window.location.reload();
        }
      },
      (err) => console.error("COOP/COEP service worker registration failed:", err)
    );
  }
}
