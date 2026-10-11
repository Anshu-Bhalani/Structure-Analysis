/* ==========================================================================
 * tour.js — Onboarding tour module
 * Guided product tour (built on Driver.js, vendored in assets/vendor/driver/).
 *
 *  - Starts automatically ONLY the first time the app is opened in a browser.
 *    "Seen" is remembered in localStorage under STORAGE_KEY.
 *  - Every step has a "Skip tutorial" button (plus the × button and the Esc key).
 *  - A permanent floating "?" button (bottom-right) replays the tour any time.
 *  - The tour walks through Home and the workspace tabs by calling the app's own
 *    goHome() / switchSection(); when it ends (finished or skipped) the user is
 *    returned to the section and scroll position they started from.
 *  - It never reads or writes model data.
 *
 * Public API (window.StructuralTour):
 *   start()      replay the tour now
 *   isActive()   true while the tour is on screen
 *   hasSeen()    true once the tour has been started (auto or manual) before
 *   resetSeen()  forget that the tour was seen (it will auto-start on next load)
 *
 * Load order: after every page module (see index.html) so all markup exists.
 * ========================================================================== */
(function () {
    "use strict";

    if (window.StructuralTour) return; // guard against the script being loaded twice

    /* ----------------------------------------------------------------------
     * Configuration
     * -------------------------------------------------------------------- */
    const STORAGE_KEY = "structuralOnboardingTour";
    const AUTO_START_DELAY_MS = 500; // let the app finish its first render

    /* Each step:
     *   section : app section that must be visible ("home", "nodes", ...)
     *   element : CSS selector to highlight (omit for a centred welcome/finish card)
     *   popover : title / description (HTML allowed) / side / align / button labels
     * Steps whose element is missing or hidden at run time are skipped automatically. */
    const STEPS = [
        {
            section: "home",
            popover: {
                title: "Welcome to Structure Analysis",
                description:
                    "Take a quick tour (about two minutes) of how to build a structural model, " +
                    "run the stiffness-method analysis and read the results." +
                    "<br><br>You can skip at any time and replay the tour later from the " +
                    "<b>?</b> button at the bottom-right of the screen.",
                nextBtnText: "Start tour",
            },
        },
        {
            section: "home",
            element: "#home .home-standalone-head .btn-primary",
            popover: {
                title: "Create a model",
                description:
                    "This highlighted button starts a new project after you finish or skip the tour. " +
                    "You will name the model and choose its structure type — " +
                    "<b>Beam / Truss / Frame</b> (2D) or <b>Grid</b>. The type is fixed once the model is created.",
                side: "bottom",
                align: "end",
            },
        },
        {
            section: "home",
            element: "#home .home-standalone-head .home-standalone-actions",
            popover: {
                title: "Import &amp; export",
                description:
                    "<b>Import Model</b> loads a JSON file you exported earlier. " +
                    "<b>Export All Models</b> downloads every saved model in one file — handy as a backup or for sharing. " +
                    "After the tour closes, use the floating <b>?</b> button to replay the tutorial.",
                side: "bottom",
                align: "end",
            },
        },
        {
            section: "home",
            element: "#home .home-current-strip",
            popover: {
                title: "Current model",
                description:
                    "This strip shows the model you are working on, its type and whether it has been saved. " +
                    "After the tour, use <b>Save Current</b>, <b>Export Current</b> or <b>Start New Model</b> from here.",
                side: "bottom",
                align: "center",
            },
        },
        {
            section: "home",
            element: "#modelLibraryGrid",
            popover: {
                title: "Your saved models",
                description:
                    "Saved models appear here as cards with a preview of the structure. After the tour, open one to keep working on it, " +
                    "or select several to export or delete them together.",
                side: "top",
                align: "center",
            },
        },
        {
            section: "dashboard",
            element: ".sidebar .nav-buttons",
            popover: {
                title: "Model input tabs",
                description:
                    "Once a model is open, each part of the input lives in its own tab. " +
                    "Work from top to bottom — <b>Nodes → Elements → Supports → Load Cases → Loads → " +
                    "Moment Cases → Moments</b> — then open <b>Results</b>.",
                side: "right",
                align: "start",
            },
        },
        {
            section: "dashboard",
            element: "#dashboard .stat-grid",
            popover: {
                title: "Model at a glance",
                description:
                    "Live counts of the nodes, elements, supports, loads and moments (torsions for Grid models) " +
                    "in the current model — a quick way to check that nothing is missing.",
                side: "bottom",
                align: "center",
            },
        },
        {
            section: "dashboard",
            element: "#dashboard .model-note",
            popover: {
                title: "Recommended input order",
                description:
                    "Follow this sequence when defining a model. Later items depend on earlier ones — " +
                    "for example, elements need nodes, and loads need a load case.",
                side: "top",
                align: "center",
            },
        },
        {
            section: "dashboard",
            element: "#liveModelDiagramCard",
            popover: {
                title: "Live model diagram",
                description:
                    "Your structure is drawn here and updates instantly as you add or edit nodes, elements, " +
                    "supports and loads. Use it to spot mistakes early.",
                side: "bottom",
                align: "center",
            },
        },
        {
            section: "nodes",
            element: "#nodes > .card:first-child > .card-header",
            popover: {
                title: "1 · Nodes",
                description:
                    "Use the form below after the tour to define each joint with an ID and its X, Y and Z coordinates. " +
                    "Z is ignored in both 2D plane and Grid geometry; Grid members lie in the XY plane. " +
                    "Element lengths are calculated automatically from X and Y coordinates.",
                side: "bottom",
                align: "start",
            },
        },
        {
            section: "elements",
            element: "#elements > .card:first-child > .card-header",
            popover: {
                title: "2 · Element templates and elements",
                description:
                    "Create a reusable template with the section and material properties in the form below, then use " +
                    "the assignment card further down to connect a start node and an end node. " +
                    "One template can be used for many members.",
                side: "bottom",
                align: "start",
            },
        },
        {
            section: "supports",
            element: "#supports > .card:first-child",
            popover: {
                title: "3 · Supports",
                description:
                    "Pick a built-in <b>Fixed</b>, <b>Roller</b> or <b>Hinged</b> template — or define a custom one " +
                    "further down — then assign it to nodes to restrain the structure.",
                side: "bottom",
                align: "center",
            },
        },
        {
            section: "loads",
            element: "#loads > .card:first-child > .card-header",
            popover: {
                title: "4 · Loads and moments",
                description:
                    "Loads are grouped into <b>load cases</b> (Dead, Live, Self Weight): create a case in " +
                    "<b>Load Cases</b> first, then add nodal or element loads with the form below. For Grid models, " +
                    "self-weight must be entered directly as a line weight in kN/m. Moments " +
                    "(torsions for Grid models) work the same way in <b>Moment Cases</b> and <b>Moments</b>.",
                side: "bottom",
                align: "start",
            },
        },
        {
            section: "results",
            element: "#results > .card:first-child > .card-header .btn-primary",
            popover: {
                title: "5 · Run the analysis",
                description:
                    "After you finish or skip the tour, choose the active load case and moment case, then use " +
                    "<b>Run Analysis</b>. The solver runs in your browser; the calculation steps, reactions " +
                    "and diagrams then appear on this page. Press <b>Next</b> to continue this guided tour.",
                side: "bottom",
                align: "end",
            },
        },
        {
            section: "results",
            element: ".topbar .top-actions",
            popover: {
                title: "Save and export your work",
                description:
                    "<b>Save Model</b> stores the model in this browser; <b>Export</b> downloads it as a JSON file. " +
                    "You can also rename the model here. Save often — clearing browser data removes saved models.",
                side: "bottom",
                align: "end",
            },
        },
        {
            section: "home",
            popover: {
                title: "You are ready to go",
                description:
                    "That covers the essentials — finish the tour, then create your first model to get started." +
                    "<br><br>Need a refresher? Use the <b>?</b> button at the bottom-right of the screen " +
                    "after the tour closes to replay it.",
                doneBtnText: "Finish",
            },
        },
    ];

    /* ----------------------------------------------------------------------
     * First-visit persistence (localStorage)
     * -------------------------------------------------------------------- */

    /* localStorage can throw (private mode, blocked cookies, quota). When it is
     * unusable we cannot remember the visit, so we do NOT auto-start (otherwise
     * the tour would reappear on every page load). The "?" button still works. */
    function storageUsable() {
        try {
            const probe = "__structuralTourProbe__";
            if (!safeStorageSetItem(probe, "1")) return false;
            safeStorageRemoveItem(probe);
            return true;
        } catch (e) {
            return false;
        }
    }

    function hasSeen() {
        try {
            return safeStorageGetItem(STORAGE_KEY) !== null;
        } catch (e) {
            return false;
        }
    }

    function saveState(status) {
        try {
            safeStorageSetItem(STORAGE_KEY, JSON.stringify({ status: status, updatedAt: new Date().toISOString() }));
        } catch (e) {
            /* ignore — see storageUsable() */
        }
    }

    function resetSeen() {
        try {
            safeStorageRemoveItem(STORAGE_KEY);
        } catch (e) {
            /* ignore */
        }
    }

    /* ----------------------------------------------------------------------
     * Helpers
     * -------------------------------------------------------------------- */
    const tour = {
        driver: null,
        active: false,
        navigating: false,
        origin: null, // { section, x, y } — where the user was when the tour began
    };

    function frames(count) {
        return new Promise(function (resolve) {
            (function tick(n) {
                if (n <= 0) resolve();
                else requestAnimationFrame(function () { tick(n - 1); });
            })(count);
        });
    }

    function activeSectionId() {
        const el = document.querySelector(".container > .section.active");
        return el ? el.id : "home";
    }

    /* Show an app section using the application's own navigation functions. */
    function showSection(id) {
        if (!id || activeSectionId() === id) return;
        try {
            if (id === "home" && typeof goHome === "function") {
                goHome();
            } else if (typeof switchSection === "function") {
                switchSection(id, document.querySelector('.nav-btn[data-section="' + id + '"]'));
            }
        } catch (error) {
            console.error("[tour] Could not switch to section:", id, error);
        }
    }

    /* Driver un-marks the previous target only when its 400 ms transition ends, so
     * clicking Next faster than that leaves the highlight class / ARIA attributes on an
     * earlier (possibly now hidden) element until the tour closes. Clear them first. */
    function clearStaleHighlights() {
        document.querySelectorAll(".driver-active-element").forEach(function (el) {
            el.classList.remove("driver-active-element", "driver-no-interaction");
            el.removeAttribute("aria-haspopup");
            el.removeAttribute("aria-expanded");
            el.removeAttribute("aria-controls");
        });
    }

    function isStepAvailable(step) {
        if (!step.element) return true;
        const el = document.querySelector(step.element);
        return !!el && el.getClientRects().length > 0;
    }

    /* ----------------------------------------------------------------------
     * Navigation
     * -------------------------------------------------------------------- */

    /* Show step `index`, switching section first. Steps whose target is missing
     * or hidden are skipped in the direction of travel. `fallback` is the step
     * that was on screen (used if nothing before the start is available). */
    async function goToStep(index, direction, fallback) {
        let i = index;
        while (i >= 0 && i < STEPS.length) {
            showSection(STEPS[i].section);
            await frames(2); // let the section render before measuring it
            if (!tour.active) return; // closed while we were waiting
            if (isStepAvailable(STEPS[i])) {
                clearStaleHighlights();
                tour.driver.drive(i);
                return;
            }
            i += direction;
        }
        if (direction > 0) {
            finish("completed");
        } else if (typeof fallback === "number") {
            showSection(STEPS[fallback].section);
            await frames(2);
            if (tour.active) {
                clearStaleHighlights();
                tour.driver.drive(fallback);
            }
        }
    }

    async function navigate(index, direction, fallback) {
        if (tour.navigating) return; // ignore rapid double clicks / key repeat
        tour.navigating = true;
        try {
            await goToStep(index, direction, fallback);
        } finally {
            tour.navigating = false;
        }
    }

    function finish(outcome) {
        if (!tour.active) return; // already closed (also guards re-entrancy)
        tour.active = false;
        saveState(outcome); // "completed" | "skipped"
        try {
            tour.driver.destroy();
        } catch (error) {
            console.error("[tour] destroy failed", error);
        }
        // Put the user back where they were before the tour moved them around.
        const origin = tour.origin;
        tour.origin = null;
        if (origin) {
            showSection(origin.section);
            frames(2).then(function () { window.scrollTo(origin.x, origin.y); });
        }
    }

    /* Adds the "Skip tutorial" button to the popover (runs on every step). */
    function decoratePopover(popover) {
        const footer = popover.footer;
        if (!footer.querySelector(".sa-tour-skip")) {
            const skip = document.createElement("button");
            skip.type = "button";
            skip.className = "sa-tour-skip";
            skip.textContent = "Skip tutorial";
            skip.addEventListener("click", function () { finish("skipped"); });
            footer.appendChild(skip);
        }
        // Driver focuses the first control it finds (the × button). Move focus to
        // "Next" so Enter advances the tour; wait one frame so ours runs last.
        requestAnimationFrame(function () {
            if (tour.active && popover.nextButton) popover.nextButton.focus({ preventScroll: true });
        });
    }

    /* ----------------------------------------------------------------------
     * Public: start
     * -------------------------------------------------------------------- */
    function start() {
        if (tour.active) return false;

        const lib = window.driver && window.driver.js && window.driver.js.driver;
        if (typeof lib !== "function") {
            console.error("[tour] Driver.js is not loaded; check the <script> tag in index.html.");
            return false;
        }
        if (!document.querySelector(".app")) return false;

        tour.origin = { section: activeSectionId(), x: window.scrollX, y: window.scrollY };
        tour.active = true;
        saveState("started"); // consumed as soon as it shows, so a reload mid-tour will not repeat it

        const reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

        tour.driver = lib({
            // The steps are driven by navigate() so each one can switch sections first.
            steps: STEPS.map(function (s) { return { element: s.element, popover: s.popover }; }),
            popoverClass: "sa-tour",
            animate: !reduceMotion,
            smoothScroll: false,
            overlayColor: "#0f172a",
            overlayOpacity: 0.62,
            stagePadding: 8,
            stageRadius: 10,
            popoverOffset: 14,
            showProgress: true,
            progressText: "Step {{current}} of {{total}}",
            nextBtnText: "Next",
            prevBtnText: "Back",
            doneBtnText: "Finish",
            allowClose: true, // × button and Esc
            allowKeyboardControl: true, // ← / → / Esc
            disableActiveInteraction: true, // highlighted controls are not clickable mid-tour
            overlayClickBehavior: "none", // Driver ignores any value but "close" / "nextStep"; stops accidental dismissal

            onPopoverRender: decoratePopover,

            onNextClick: function () {
                const i = tour.driver.getActiveIndex();
                if (typeof i !== "number") return;
                if (i >= STEPS.length - 1) finish("completed");
                else navigate(i + 1, 1, i);
            },
            onPrevClick: function () {
                const i = tour.driver.getActiveIndex();
                if (typeof i !== "number" || i <= 0) return;
                navigate(i - 1, -1, i);
            },
            // Fires for ×, Esc and anything else that closes the tour early.
            onDestroyStarted: function () {
                finish("skipped");
            },
        });

        navigate(0, 1, null);
        return true;
    }

    /* ----------------------------------------------------------------------
     * Permanent "replay" button + first-visit auto start
     * -------------------------------------------------------------------- */
    function createHelpButton() {
        if (document.getElementById("tourHelpButton")) return;
        const btn = document.createElement("button");
        btn.id = "tourHelpButton";
        btn.type = "button";
        btn.className = "tour-help-btn";
        btn.setAttribute("aria-label", "Replay the product tour");
        btn.title = "Replay the product tour";
        btn.innerHTML = '<span class="tour-help-icon" aria-hidden="true">?</span><span class="tour-help-label">Take the tour</span>';
        btn.addEventListener("click", function () { start(); });
        document.body.appendChild(btn);
    }

    /* Visible "Replay Tutorial" entries in the app's own UI: the Home header (the only
     * navigation visible on Home) and the bottom of the sidebar (workspace tabs). */
    function createReplayButtons() {
        const homeActions = document.querySelector("#home .home-standalone-head .home-standalone-actions");
        if (homeActions && !document.getElementById("tourReplayHome")) {
            const b = document.createElement("button");
            b.id = "tourReplayHome";
            b.type = "button";
            b.className = "btn btn-secondary";
            b.textContent = "? Replay Tutorial";
            b.addEventListener("click", function () { start(); });
            homeActions.insertBefore(b, homeActions.firstChild);
        }
        const sidebarBottom = document.querySelector(".sidebar-bottom");
        if (sidebarBottom && !document.getElementById("tourReplaySidebar")) {
            const b = document.createElement("button");
            b.id = "tourReplaySidebar";
            b.type = "button";
            b.className = "sidebar-btn";
            b.textContent = "Replay Tutorial";
            b.addEventListener("click", function () { start(); });
            sidebarBottom.appendChild(b);
        }
    }

    function autoStartIfFirstVisit() {
        if (tour.active || hasSeen() || !storageUsable()) return;
        const modal = document.getElementById("newModelModal");
        if (modal && !modal.hidden) return; // another dialog is already open
        start();
    }

    function boot() {
        createHelpButton();
        createReplayButtons();
        const go = function () { setTimeout(autoStartIfFirstVisit, AUTO_START_DELAY_MS); };
        if (document.readyState === "complete") go();
        else window.addEventListener("load", go, { once: true });
    }

    window.StructuralTour = {
        start: start,
        isActive: function () { return tour.active; },
        hasSeen: hasSeen,
        resetSeen: resetSeen,
    };

    // main.js initialises the app on DOMContentLoaded; this listener is registered later, so it runs after it.
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
})();
