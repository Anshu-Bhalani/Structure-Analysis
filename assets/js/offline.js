"use strict";

(function setupOfflineReadiness() {
    if (document.getElementById("offlineReadinessStatus")) return;

    const indicator = document.createElement("div");
    indicator.id = "offlineReadinessStatus";
    indicator.className = "offline-readiness";
    indicator.dataset.state = "preparing";
    indicator.setAttribute("role", "status");
    indicator.setAttribute("aria-live", "polite");
    indicator.setAttribute("aria-atomic", "true");
    indicator.textContent = "Preparing offline access…";
    indicator.title = "The app caches its required files locally; user models remain in browser storage.";
    document.body.appendChild(indicator);

    let appCacheReady = false;
    let lastStatus = null;

    function show(text, state) {
        indicator.textContent = text;
        indicator.dataset.state = state;
    }

    function renderNetworkState() {
        if (appCacheReady) {
            show(navigator.onLine ? "Offline ready" : "Offline mode · app cached", navigator.onLine ? "ready" : "offline");
        } else if (!navigator.onLine) {
            show("Offline · setup incomplete", "warning");
        }
    }

    function applyWorkerStatus(message) {
        if (!message || message.type !== "OFFLINE_STATUS") return;
        lastStatus = message;
        appCacheReady = message.ready === true;
        if (appCacheReady) {
            renderNetworkState();
        } else {
            show("Preparing offline access (" + message.cached + "/" + message.total + ")", "preparing");
        }
    }

    function askWorker(worker) {
        if (worker && typeof worker.postMessage === "function") {
            worker.postMessage({ type: "GET_OFFLINE_STATUS" });
        }
    }

    if (!("serviceWorker" in navigator)) {
        show("Offline caching unavailable in this browser", "warning");
        return;
    }

    if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
        show("Offline caching requires a hosted HTTPS page", "warning");
        return;
    }

    navigator.serviceWorker.addEventListener("message", (event) => applyWorkerStatus(event.data));
    navigator.serviceWorker.addEventListener("controllerchange", () => {
        askWorker(navigator.serviceWorker.controller);
    });
    window.addEventListener("online", renderNetworkState);
    window.addEventListener("offline", renderNetworkState);

    // The script lives under assets/js; resolve the site root instead of
    // assuming the site is hosted at the domain root (GitHub Pages uses a subpath).
    const siteRoot = new URL("../../", document.currentScript.src);
    const workerUrl = new URL("service-worker.js", siteRoot);

    navigator.serviceWorker.register(workerUrl.href, {
        scope: siteRoot.pathname,
        updateViaCache: "none"
    }).then(async (registration) => {
        if (registration.installing) {
            registration.installing.addEventListener("statechange", () => {
                if (registration.installing && registration.installing.state === "redundant") {
                    show("Offline setup failed · reconnect and reload", "warning");
                }
            });
        }
        await navigator.serviceWorker.ready;
        askWorker(navigator.serviceWorker.controller || registration.active);
        // A newly activated worker can take a moment to finish its status check.
        if (lastStatus) applyWorkerStatus(lastStatus);
    }).catch((error) => {
        console.error("[Offline] Service Worker registration failed:", error);
        show("Offline setup failed · reconnect and reload", "warning");
    });
})();
