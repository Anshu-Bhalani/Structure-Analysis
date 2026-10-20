"use strict";

/*
 * Register offline support without adding any visible UI.
 * The Service Worker quietly caches the application shell in the background.
 */
(function registerOfflineSupport() {
    if (!("serviceWorker" in navigator)) return;

    if (location.protocol !== "https:" &&
        location.hostname !== "localhost" &&
        location.hostname !== "127.0.0.1") {
        return;
    }

    // Resolve the site root correctly for GitHub Pages project paths.
    const siteRoot = new URL("../../", document.currentScript.src);
    const workerUrl = new URL("service-worker.js", siteRoot);

    navigator.serviceWorker.register(workerUrl.href, {
        scope: siteRoot.pathname,
        updateViaCache: "none"
    }).catch((error) => {
        // Offline support is optional; keep registration failures out of the UI.
        console.warn("[Offline] Background registration failed:", error);
    });
})();
