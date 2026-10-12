# Structural Analysis – modular project

Open `index.html` in a browser (works from file:// — no build step, no server needed).

```
index.html                      ← only HTML file; links all CSS + JS
assets/
  css/main.css                  ← common styles
  js/main.js                    ← common JS (shell markup, state, helpers, persistence, navigation, bootstrap)
  vendor/                       ← jsPDF + svg2pdf + embedded fonts (vector PDF export)
modules/
  home/ dashboard/ nodes/ elements/ supports/ load-case/ load/ moment-case/ moment/   (*.js, + *.css where needed)
  results/
    results.js / results.css    ← Results frame, summary, equilibrium, orchestration, PDF export
    step-1 … step-8/            ← one folder per calculation part (step-8 = final result tables)
    diagrams/                   ← part 9: all diagrams (live model, reactions, AFD/SFD/BMD/displacement, DoF, full-screen)
```
Page markup lives inside each module's `.js` and is injected by `mountModuleHTML()` (defined in `main.js`), so `index.html` stays a pure link file. Script order in `index.html` matters.


## Offline use (hosted site)

When the GitHub Pages site is first opened while online, its Service Worker caches the application shell, local JavaScript/CSS modules, PDF libraries, and manifest/icon. Wait for the **Offline ready** status before disconnecting. Afterward, reopen the hosted site on the same browser/device to use the cached app without a network connection.

This requires the hosted HTTPS site; browsers do not allow Service Worker registration from `file://`. Model data continues to be stored locally by the app's existing browser-storage logic. Clearing site data can remove both saved models and offline cache. Publishing updates requires internet access.
