"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const workerSource = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
const manifestSource = fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8");
const offlineUiSource = fs.readFileSync(path.join(root, "assets/js/offline.js"), "utf8");

const coreAssetsMatch = workerSource.match(/const CORE_ASSETS = \[([\s\S]*?)\];/);
assert.ok(coreAssetsMatch, "Service Worker must declare its precached core assets");
const coreAssets = JSON.parse("[" + coreAssetsMatch[1] + "]");

test("PWA manifest is valid and scoped to the deployed application", () => {
    const manifest = JSON.parse(manifestSource);
    assert.equal(manifest.start_url, "./");
    assert.equal(manifest.scope, "./");
    assert.equal(manifest.display, "standalone");
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);
    for (const icon of manifest.icons) {
        assert.ok(fs.existsSync(path.join(root, icon.src)), "missing manifest icon: " + icon.src);
        assert.ok(coreAssets.includes(icon.src), "manifest icon must be precached: " + icon.src);
    }
    assert.match(indexSource, /rel="manifest" href="manifest\.webmanifest"/);
});

test("every precached asset exists and all local index resources are included", () => {
    assert.equal(new Set(coreAssets).size, coreAssets.length, "duplicate precache entries are not expected");
    for (const asset of coreAssets) {
        assert.ok(fs.existsSync(path.join(root, asset)), "missing precache asset: " + asset);
    }
    const references = Array.from(indexSource.matchAll(/(?:src|href)="([^"]+)"/g), (match) => match[1]);
    const localReferences = references
        .filter((value) => !/^(?:[a-z]+:|\/\/|#|data:)/i.test(value))
        .map((value) => value.split("?")[0].replace(/^\.\//, ""));
    for (const localPath of localReferences) {
        if (!localPath) continue;
        assert.ok(coreAssets.includes(localPath), "local index resource is missing from precache list: " + localPath);
    }
    assert.match(indexSource, /assets\/js\/offline\.js\?/);
    assert.match(indexSource, /service-worker|manifest\.webmanifest/);
});

test("offline readiness UI registers the Service Worker relative to the site root", () => {
    assert.match(offlineUiSource, /new URL\("\.\.\/", document\.currentScript\.src\)/);
    assert.match(offlineUiSource, /navigator\.serviceWorker\.register\(workerUrl\.href/);
    assert.match(offlineUiSource, /GET_OFFLINE_STATUS/);
    assert.match(offlineUiSource, /Offline ready/);
    assert.match(offlineUiSource, /serviceWorker/);
});

function createWorkerHarness(fetchImpl) {
    const listeners = new Map();
    const cacheStores = new Map();
    let skipWaitingCalled = false;
    let claimCalled = false;

    function urlOf(value) {
        return new URL(typeof value === "string" ? value : value.url);
    }
    function requestKey(value, ignoreSearch) {
        const url = urlOf(value);
        if (ignoreSearch) {
            url.search = "";
            url.hash = "";
        }
        return url.href;
    }

    const caches = {
        async open(name) {
            if (!cacheStores.has(name)) cacheStores.set(name, new Map());
            const store = cacheStores.get(name);
            return {
                async put(request, response) {
                    store.set(requestKey(request, false), response.clone());
                },
                async match(request, options = {}) {
                    const exact = store.get(requestKey(request, false));
                    if (exact) return exact.clone();
                    if (options.ignoreSearch) {
                        const base = requestKey(request, true);
                        for (const [key, response] of store.entries()) {
                            if (requestKey(key, true) === base) return response.clone();
                        }
                    }
                    return undefined;
                },
                async keys() {
                    return Array.from(store.keys(), (key) => new Request(key));
                }
            };
        },
        async keys() {
            return Array.from(cacheStores.keys());
        },
        async delete(name) {
            return cacheStores.delete(name);
        },
        async match(request, options) {
            for (const name of cacheStores.keys()) {
                const cache = await this.open(name);
                const found = await cache.match(request, options);
                if (found) return found;
            }
            return undefined;
        }
    };

    const clients = {
        async claim() { claimCalled = true; },
        async matchAll() { return []; }
    };
    const self = {
        location: new URL("https://example.test/Structure-Analysis/service-worker.js"),
        registration: { scope: "https://example.test/Structure-Analysis/" },
        clients,
        addEventListener(type, handler) { listeners.set(type, handler); },
        async skipWaiting() { skipWaitingCalled = true; }
    };

    vm.runInNewContext(workerSource, {
        self, caches, fetch: fetchImpl, URL, Request, Response, Promise, Set
    }, { filename: "service-worker.js" });

    return { listeners, caches, cacheStores, get skipWaitingCalled() { return skipWaitingCalled; },
        get claimCalled() { return claimCalled; } };
}

test("Service Worker precaches all declared app assets before activating", async () => {
    const requests = [];
    const harness = createWorkerHarness(async (request) => {
        requests.push(new URL(request.url).pathname);
        return new Response("cached " + new URL(request.url).pathname, { status: 200 });
    });
    let installPromise;
    harness.listeners.get("install")({ waitUntil(promise) { installPromise = promise; } });
    await installPromise;

    const cacheNames = await harness.caches.keys();
    assert.deepEqual(cacheNames, ["structure-analysis-offline-v1"]);
    const cache = await harness.caches.open(cacheNames[0]);
    const keys = await cache.keys();
    assert.equal(keys.length, coreAssets.length);
    assert.equal(requests.length, coreAssets.length);
    assert.equal(harness.skipWaitingCalled, true);
});

test("Service Worker preserves cached app and query-busted assets when network is unavailable", async () => {
    let online = true;
    const harness = createWorkerHarness(async (request) => {
        if (!online) throw new Error("simulated offline network");
        const url = new URL(request.url);
        return new Response("online " + url.pathname, { status: 200 });
    });
    let installPromise;
    harness.listeners.get("install")({ waitUntil(promise) { installPromise = promise; } });
    await installPromise;
    let activatePromise;
    harness.listeners.get("activate")({ waitUntil(promise) { activatePromise = promise; } });
    await activatePromise;
    assert.equal(harness.claimCalled, true);

    online = false;
    let navigationResponse;
    await harness.listeners.get("fetch")({
        request: { url: "https://example.test/Structure-Analysis/", method: "GET", mode: "navigate" },
        respondWith(promise) { navigationResponse = promise; }
    });
    const page = await navigationResponse;
    assert.equal(page.status, 200);
    assert.match(await page.text(), /cached \/Structure-Analysis\/index\.html/);

    let assetResponse;
    await harness.listeners.get("fetch")({
        request: { url: "https://example.test/Structure-Analysis/assets/js/main.js?v=20261013", method: "GET", mode: "cors" },
        respondWith(promise) { assetResponse = promise; }
    });
    const asset = await assetResponse;
    assert.equal(asset.status, 200);
    assert.match(await asset.text(), /cached \/Structure-Analysis\/assets\/js\/main\.js/);
});
