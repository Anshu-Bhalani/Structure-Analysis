/* ==========================================================================
 * main.js — global / common JavaScript
 * Shared by every page module: app configuration, application state, generic
 * helpers, unit system, input validation, matrix utilities, persistence
 * (save / load / export / import), sidebar navigation, sortable-table drag,
 * common select/delete helpers, refreshAll() and the application bootstrap.
 * 
 * Load order (see index.html): vendor/jspdf + svg2pdf + pdf-fonts -> main.js -> page modules
 * (home ... moment) -> results core -> results steps 1-8 -> diagrams.
 * ========================================================================== */

/* Injects a module's markup into the page.
 * target   : CSS selector (or Element) the markup is attached to
 * position : insertAdjacentHTML position ("beforeend", "afterbegin", "afterend", ...)
 * html     : markup string
 * Every page module / results part calls this once when its script loads. */
function mountModuleHTML(target, position, html) {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) {
        console.error("[mountModuleHTML] mount point not found:", target);
        return null;
    }
    el.insertAdjacentHTML(position, html);
    return el;
}

/* ---- Application shell (loading overlay, sidebar, top bar, page container) ---- */
document.body.insertAdjacentHTML("afterbegin", `
<div id="analysisLoadingOverlay" class="analysis-loading-overlay" aria-hidden="true">
    <div class="analysis-loading-card">
        <div class="analysis-loading-spinner"></div>
        <div class="analysis-loading-title">Preparing Structural Analysis</div>
        <div class="analysis-loading-text" id="analysisLoadingText">
            Loading nodes, elements, loads, moments and calculation data…
        </div>
    </div>
</div>



<div class="app home-mode">

    <!-- SIDEBAR -->
    <aside class="sidebar">
        <div class="brand">
            <h1>Structure Analysis</h1>
            <p>Input Model Builder</p>
        </div>
        <div class="nav-title">Model Input</div>
        <div class="nav-buttons">
            <button class="nav-btn active" data-section="home"><span class="nav-icon">⌂</span>Home</button>
            <button class="nav-btn" data-section="dashboard"><span class="nav-icon">⌂</span>Dashboard</button>
            <button class="nav-btn" data-section="nodes"><span class="nav-icon">●</span>Nodes</button>
            <button class="nav-btn" data-section="elements"><span class="nav-icon">━</span>Elements</button>
            <button class="nav-btn" data-section="supports"><span class="nav-icon">⚓</span>Supports</button>
            <button class="nav-btn" data-section="loadCases"><span class="nav-icon">▣</span>Load Cases</button>
            <button class="nav-btn" data-section="loads"><span class="nav-icon">↓</span>Loads</button>
            <button class="nav-btn" data-section="momentCases"><span class="nav-icon">↻</span>Moment Cases</button>
            <button class="nav-btn" data-section="moments"><span class="nav-icon">↺</span>Moments</button>
            <button class="nav-btn" data-section="results"><span class="nav-icon">📊</span>Results</button>
        </div>
        <div class="sidebar-bottom">
            <button class="sidebar-btn" onclick="exportModel()">Export JSON</button>
            <button class="sidebar-btn" onclick="document.getElementById('jsonImport').click()">Import JSON</button>
            <input type="file" id="jsonImport" accept=".json" style="display:none" onchange="importModel(event)">
            <button class="sidebar-btn" onclick="clearModel()">Clear Model</button>
        </div>
    </aside>

    <!-- MAIN -->
    <main class="main">

        <header class="topbar">
            <div class="page-title">
                <h2 id="pageTitle">Model Home</h2>
                <p id="pageSubtitle">Manage your structural analysis models.</p>
            </div>
            <div class="top-actions">
                <button id="topbarHomeButton" type="button" class="btn btn-secondary" onclick="goHome()">⌂ Home</button>
                <span id="currentModelTypeBadge" class="badge badge-blue model-type-indicator" role="status" aria-label="Current model type" title="Model type is selected when creating a model and cannot be changed afterward">Beam / Truss / Frame Model</span>
                <input id="modelName" class="model-name-input" type="text" maxlength="120" placeholder="Model Name" aria-label="Model Name" value="Structural Model" oninput="saveModelNamePreference()">
                <button class="btn btn-secondary" onclick="exportModel()">Export</button>
                <button class="btn btn-primary" onclick="saveModel()">Save Model</button>
            </div>
        </header>

        <div class="container">
        </div>
    </main>
</div>

<div id="newModelModal" class="model-create-modal" hidden aria-hidden="true">
    <div class="model-create-backdrop" onclick="closeNewModelDialog()" aria-hidden="true"></div>
    <form class="model-create-dialog" role="dialog" aria-modal="true" aria-labelledby="newModelDialogTitle" onsubmit="createNewModelFromDialog(event)">
        <div class="model-create-heading">
            <h2 id="newModelDialogTitle">Create New Structural Model</h2>
            <p>Choose the structure type now. It will remain fixed for this model.</p>
        </div>
        <label class="model-create-field" for="newModelNameInput">Model name</label>
        <input id="newModelNameInput" class="model-name-input model-create-name" type="text" maxlength="120" autocomplete="off" placeholder="Model name">
        <fieldset class="model-type-options">
            <legend>Structure type</legend>
            <label class="model-type-option">
                <input type="radio" name="newModelAnalysisMode" value="plane" checked>
                <span><strong>Beam / Truss / Frame</strong><small>Standard 2D structural analysis</small></span>
            </label>
            <label class="model-type-option">
                <input type="radio" name="newModelAnalysisMode" value="grid">
                <span><strong>Grid</strong><small>Grid bending and torsional analysis</small></span>
            </label>
        </fieldset>
        <p id="newModelValidationMessage" class="model-create-error" role="alert" hidden></p>
        <div class="model-create-actions">
            <button type="button" class="btn btn-secondary" onclick="closeNewModelDialog()">Cancel</button>
            <button type="submit" class="btn btn-primary">Create Model</button>
        </div>
    </form>
</div>
`);

// ==========================================================================
// 1. APP CONFIGURATION
// Application-wide constants: default values, diagram/rendering constants,
// persistence keys, and UI copy. Nothing in here performs calculations —
// it is pure static configuration consumed by the engines/controllers below.
// ==========================================================================
const AppConfig = {
    // Built-in plane-frame support templates. Always available; cannot be
    // deleted. Custom supports remain fully editable through the form.
    builtInSupportTemplates: [
        {
            id: "FIXED",
            description: "Fixed Support",
            type: "fixed",
            builtIn: true,
            restraints: { RFx: true, RFy: true, RFz: true, RMx: true, RMy: true, RMz: true },
            displacement: { dx: 0, dy: 0, dz: 0, tx: 0, ty: 0, tz: 0 },
        },
        {
            id: "ROLLER",
            description: "Roller Support",
            type: "roller",
            builtIn: true,
            restraints: { RFx: false, RFy: true, RFz: false, RMx: false, RMy: false, RMz: false },
            displacement: { dx: 0, dy: 0, dz: 0, tx: 0, ty: 0, tz: 0 },
        },
        {
            id: "HINGED",
            description: "Hinged Support",
            type: "hinged",
            builtIn: true,
            restraints: { RFx: true, RFy: true, RFz: false, RMx: false, RMy: false, RMz: false },
            displacement: { dx: 0, dy: 0, dz: 0, tx: 0, ty: 0, tz: 0 },
        },
    ],

    // Only these input-model keys are persisted to localStorage / export.
    // Solver-derived analysis state is never saved.
    persistedModelKeys: [
        "nodes",
        "elementTemplates",
        "elements",
        "supportTemplates",
        "supportAssignments",
        "loadCases",
        "loads",
        "momentCases",
        "moments",
    ],

    // Shared-baseline diagram scaling constants (see calculateAutoFit /
    // drawDiagramSVG): the same physical length always maps to the same
    // pixel length across the Structure Model, Reactions, AFD, SFD, BMD and
    // Displacement diagrams, keeping the whole visual system proportional.
    sharedDiagramBaselinePx: 200,
    modelDiagramBaselinePx: 200,

    // Page title/subtitle text shown in the topbar for each sidebar section.
    sectionTitles: {
        home: ["Model Home", "Manage multiple saved structural analysis models."],
        dashboard: ["Model Dashboard", "Define the structural analysis input model."],
        nodes: ["Nodes", "Define global node coordinates."],
        elements: ["Elements", "Define reusable element properties and node connectivity."],
        supports: ["Supports", "Define reusable support conditions."],
        loadCases: ["Load Cases", "Define reusable force load cases."],
        loads: ["Loads", "Define nodal and element force inputs."],
        momentCases: ["Moment Cases", "Define reusable moment cases."],
        moments: ["Moments", "Define nodal and element moment inputs."],
        results: ["Analysis Results", "Stiffness Method output."],
    },
};

// ==========================================================================
// 2. APPLICATION STATE
// ==========================================================================
const model = {
    nodes: [],
    elementTemplates: [],
    elements: [],
    supportTemplates: [],
    supportAssignments: [],
    loadCases: [],
    loads: [],
    momentCases: [],
    moments: [],
    dofSettings: { skipAxial: false, skipMoment: false },
    analysisMode: "plane",
};

// Named model library. Each saved model stores only the true input model,
// never solver-derived analysis state.
let currentModelLibraryId = localStorage.getItem("structuralCurrentModelId") || "";

function cloneBuiltInSupportTemplate(template) {
    return JSON.parse(JSON.stringify(template));
}

function ensureBuiltInSupportTemplates() {
    const customTemplates = (model.supportTemplates || []).filter((s) => !s.builtIn && !["FIXED", "ROLLER", "HINGED"].includes(s.id));
    model.supportTemplates = [
        ...AppConfig.builtInSupportTemplates.map(cloneBuiltInSupportTemplate),
        ...customTemplates.map((s) => ({ ...s, type: s.type || "custom", builtIn: false })),
    ];
}

// Active analysis case selections. These are UI state, not part of the persisted input model.
let activeLoadCaseId = "";
let activeMomentCaseId = "";

// Which diagram mode is currently shown in the fullscreen modal (see section 10).
let currentFSMode = "model";

// Analysis result lifecycle: not-run -> valid -> invalidated.
const analysisState = { status: "not-run" };

// Snapshot-style reference to the two central state objects, for anyone
// exploring this file for the first time. This is documentation, not a new
// state container: AppState.model and AppState.analysis are the exact same
// objects as `model` and `analysisState` above, and every function in this
// file continues to read/write `model` / `analysisState` directly.
const AppState = { model, analysis: analysisState };

function isGridAnalysisMode() {
    return model.analysisMode === "grid";
}

function syncAnalysisModeUI() {
    const gridMode = isGridAnalysisMode();
    const typeBadge = document.getElementById("currentModelTypeBadge");
    if (typeBadge) {
        typeBadge.textContent = gridMode ? "Grid Model" : "Beam / Truss / Frame Model";
        typeBadge.title = gridMode
            ? "Grid model — type is fixed for this model"
            : "Beam / Truss / Frame model — type is fixed for this model";
        typeBadge.className = `badge ${gridMode ? "badge-green" : "badge-blue"} model-type-indicator`;
    }
    const gridFields = document.getElementById("gridElementProperties");
    if (gridFields) gridFields.style.display = gridMode ? "grid" : "none";
    document.querySelectorAll(".grid-only-property").forEach((node) => {
        node.style.display = gridMode ? "table-cell" : "none";
    });
    document.querySelectorAll(".plane-only-property").forEach((node) => {
        const isTableCell = node.tagName === "TH" || node.tagName === "TD";
        node.style.display = gridMode ? "none" : (isTableCell ? "table-cell" : "");
    });
    const dofBox = document.getElementById("planeDofNumberingBox");
    if (dofBox) dofBox.style.display = isGridAnalysisMode() ? "none" : "block";
    const modeNote = document.getElementById("analysisModeNote");
    if (modeNote) {
        modeNote.textContent = isGridAnalysisMode()
            ? "Grid DOFs: θX, θY and ΔZ. Grid templates require positive E, G, I and J. Loads use Fz; torsion uses Mx (+ right/− left) and My (+ up/− down)."
            : "Plane analysis classifies each element as Beam, Truss or Frame from its A and I values.";
    }

    const setLabel = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    const setSupportDescription = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
    if (isGridAnalysisMode()) {
        setSupportDescription("supportFixedDescription", "θX + θY + ΔZ restrained");
        setSupportDescription("supportRollerDescription", "ΔZ restrained only<br><span style=\"color:#64748b;\">Grid rotations θX and θY free</span>");
        setSupportDescription("supportHingedDescription", "ΔZ restrained only<br><span style=\"color:#64748b;\">Grid rotations θX and θY free</span>");
        setLabel("supportRFxLabel", "θX restrained"); setLabel("supportRFyLabel", "θY restrained");
        setLabel("supportRFzLabel", "RFz (unused by Grid)"); setLabel("supportRMxLabel", "RMx (unused by Grid)");
        setLabel("supportRMyLabel", "RMy (unused by Grid)"); setLabel("supportRMzLabel", "ΔZ restrained");
        setLabel("supportDispXLabel", "Δx (unused by Grid)"); setLabel("supportDispYLabel", "Δy (unused by Grid)");
        setLabel("supportDispZLabel", "ΔZ prescribed"); setLabel("supportRotXLabel", "θX prescribed");
        setLabel("supportRotYLabel", "θY prescribed"); setLabel("supportRotZLabel", "θz (unused by Grid)");
    } else {
        setSupportDescription("supportFixedDescription", "RFx + RFy + RFz + RMx + RMy + RMz restrained");
        setSupportDescription("supportRollerDescription", "RFy restrained only<br><span style=\"color:#64748b;\">All other 2D restraints free</span>");
        setSupportDescription("supportHingedDescription", "RFx + RFy restrained<br><span style=\"color:#64748b;\">Rotation RZ remains free</span>");
        setLabel("supportRFxLabel", "RFx"); setLabel("supportRFyLabel", "RFy");
        setLabel("supportRFzLabel", "RFz (Ignore)"); setLabel("supportRMxLabel", "RMx (Ignore)");
        setLabel("supportRMyLabel", "RMy (Ignore)"); setLabel("supportRMzLabel", "RMz");
        setLabel("supportDispXLabel", "Δx"); setLabel("supportDispYLabel", "Δy");
        setLabel("supportDispZLabel", "Δz"); setLabel("supportRotXLabel", "θx");
        setLabel("supportRotYLabel", "θy"); setLabel("supportRotZLabel", "θz");
    }
    const loadType = document.getElementById("loadType")?.value || "Nodal Load";
    const isUDL = loadType === "Element UDL";
    if (isGridAnalysisMode()) {
        setLabel("lblLoadFx", isUDL ? "Start Fx (not used by Grid)" : "Fx (not used by Grid)");
        setLabel("lblLoadFy", isUDL ? "Start Fy (not used by Grid)" : "Fy (not used by Grid)");
        setLabel("lblLoadFz", isUDL ? "Start Fz" : "Fz");
        setLabel("lblLoadFxEnd", "End Fx (not used by Grid)");
        setLabel("lblLoadFyEnd", "End Fy (not used by Grid)");
        setLabel("lblLoadFzEnd", "End Fz");
        setLabel("lblMomentX", "Mx — Right / Left (+ right, − left)");
        setLabel("lblMomentY", "My — Up / Down (+ up, − down)");
        setLabel("lblMomentZ", "Mz (not used by Grid)");
    } else {
        setLabel("lblLoadFz", "Fz (Ignore)");
        setLabel("lblLoadFzEnd", "End Fz (Ignore)");
        setLabel("lblMomentX", "Mx (Ignore)");
        setLabel("lblMomentY", "My (Ignore)");
        setLabel("lblMomentZ", "Mz (Rotation)");
    }

    // User-facing Grid terminology is torsion; the stored model fields remain
    // compatible with existing moment-case and moment solver data.
    const gridNavLabels = [
        ["momentCases", gridMode ? "Torsion Cases" : "Moment Cases"],
        ["moments", gridMode ? "Torsions" : "Moments"],
    ];
    gridNavLabels.forEach(([section, label]) => {
        const button = document.querySelector(`.nav-btn[data-section="${section}"]`);
        if (button) {
            const icon = button.querySelector(".nav-icon");
            button.innerHTML = `${icon ? icon.outerHTML : ""}${label}`;
        }
    });
    const pageTitles = AppConfig.sectionTitles;
    pageTitles.momentCases = gridMode
        ? ["Torsion Cases", "Define reusable Grid torsion cases."]
        : ["Moment Cases", "Define reusable moment cases."];
    pageTitles.moments = gridMode
        ? ["Torsions", "Define nodal and element Grid torsions."]
        : ["Moments", "Define nodal and element moment inputs."];
    const activeSection = document.querySelector(".section.active")?.id;
    if (activeSection === "moments" || activeSection === "momentCases") {
        const title = document.getElementById("pageTitle");
        const subtitle = document.getElementById("pageSubtitle");
        const content = pageTitles[activeSection];
        if (content && title) title.textContent = content[0];
        if (content && subtitle) subtitle.textContent = content[1];
    }
    if (typeof syncLoadInputModeUI === "function") syncLoadInputModeUI();
    if (typeof syncMomentInputModeUI === "function") syncMomentInputModeUI();
    if (typeof syncMomentCaseInputModeUI === "function") syncMomentCaseInputModeUI();
}

function setAnalysisMode(value) {
    // A model's solver type is fixed when it is created. Loading/importing a
    // model restores its saved type through applyPersistedInputModel(); this
    // function intentionally cannot switch an existing model's solver.
    const requested = value === "grid" ? "grid" : "plane";
    if (requested !== (model.analysisMode === "grid" ? "grid" : "plane")) {
        console.warn("Model type cannot be changed after creation. Create a new model to use another solver.");
    }
    syncAnalysisModeUI();
    return requested === (model.analysisMode === "grid" ? "grid" : "plane");
}


// Page title/subtitle text shown in the topbar for each sidebar section.

// ==========================================================================
// 3. GENERIC HELPERS
// ==========================================================================
function getNextId(currentId) {
    const match = currentId.match(/^(.*?)(\d+)$/);
    if (match) {
        return match[1] + (parseInt(match[2], 10) + 1);
    }
    return currentId + "1";
}

function val(id) {
    return document.getElementById(id).value.trim();
}
function num(id) {
    const value = document.getElementById(id).value.trim();
    if (value === "") return "";
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : "";
}

// Mobile-friendly scientific notation helper. Tap "e" after entering the
// mantissa, then enter the exponent, e.g. 2e5, 7.5e-4, 1e-6.
function insertScientificExponent(id) {
    const input = document.getElementById(id);
    if (!input) return;
    input.focus();
    const start = typeof input.selectionStart === "number" ? input.selectionStart : input.value.length;
    const end = typeof input.selectionEnd === "number" ? input.selectionEnd : input.value.length;
    const before = input.value.slice(0, start);
    const after = input.value.slice(end);
    if (/[eE]/.test(input.value)) return;
    input.value = before + "e" + after;
    const pos = start + 1;
    if (typeof input.setSelectionRange === "function") input.setSelectionRange(pos, pos);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatNum(num) {
    if (Math.abs(num) < 1e-10) return "0.000";
    if (Math.abs(num) > 1e6 || (Math.abs(num) > 0 && Math.abs(num) < 1e-3))
        return Number(num).toExponential(3);
    return Number(num).toFixed(3);
}

// ==========================================================================
// UNIT SYSTEM
// Internal analysis units: kN, m, kN/m, kN·m, kN/m².
// UI material stiffness is entered in GPa and converted to kN/m².
// ==========================================================================
function getElementEInternal(tmpl) {
    if (!tmpl) return 0;
    if (Number.isFinite(Number(tmpl.E_GPa))) return Number(tmpl.E_GPa) * 1e6;
    // Legacy v14 stored E in N/m². Convert to the new GPa field.
    if (Number.isFinite(Number(tmpl.E))) return Number(tmpl.E) / 1000;
    return 0;
}

function migrateUnitSystem() {
    model.elementTemplates = (model.elementTemplates || []).map((tmpl) => {
        if (!Number.isFinite(Number(tmpl.E_GPa)) && Number.isFinite(Number(tmpl.E))) {
            // Legacy E values were entered as N/m². 1 GPa = 1e9 N/m².
            tmpl.E_GPa = Number(tmpl.E) / 1e9;
            delete tmpl.E;
        }
        return tmpl;
    });
}

function updateElementWeightUnit() {
    const type = val("selfWeightType");
    const label = document.getElementById("elementWeightLabel");
    const unit = document.getElementById("elementWeightUnit");
    if (!label || !unit) return;
    if (type === "lineWeight") {
        label.textContent = "Self Weight";
        unit.textContent = "kN/m";
    } else {
        label.textContent = "Density";
        unit.textContent = "kg/m³";
    }
}

// ==========================================================================
// INPUT VALIDATION HELPERS
// Centralized validation keeps all model entities consistent before mutation.
// ==========================================================================
function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}

function requireFinite(value, label, options = {}) {
    if (!isFiniteNumber(value)) return `${label} must be a finite number.`;
    if (options.min !== undefined && value < options.min) return `${label} must be at least ${options.min}.`;
    if (options.minExclusive !== undefined && value <= options.minExclusive) return `${label} must be greater than ${options.minExclusive}.`;
    return null;
}

function hasId(items, id, editingId = null) {
    return Array.isArray(items) && items.some((item) => String(item.id) === String(id) && String(item.id) !== String(editingId));
}

function requireReference(items, id, label) {
    if (!id) return `${label} is required.`;
    if (!items.some((item) => String(item.id) === String(id))) return `${label} "${id}" does not exist.`;
    return null;
}

function getElementLength(elementId) {
    const el = model.elements.find((item) => item.id === elementId);
    if (!el) return null;
    const n1 = model.nodes.find((n) => n.id === el.startNode);
    const n2 = model.nodes.find((n) => n.id === el.endNode);
    if (!n1 || !n2) return null;
    return Math.hypot(Number(n2.x) - Number(n1.x), Number(n2.y) - Number(n1.y));
}

function getElementStructuralType(element) {
    const tmpl = element ? model.elementTemplates.find((t) => t.id === element.templateId) : null;
    if (!tmpl) return null;
    const A = Number(tmpl.A);
    const I = Number(tmpl.I);
    if (!Number.isFinite(A) || !Number.isFinite(I)) return null;
    if (A === 0 && I > 0) return "beam";
    if (I === 0 && A > 0) return "truss";
    if (A > 0 && I > 0) return "frame";
    return null;
}

function detectDefaultGlobalDofNumberingConfig() {
    // The Neglect X / Neglect Moment M controls are manual. With both
    // controls unselected, no DOF is omitted just because an element has
    // A=0 or I=0.
    return { skipAxial: false, skipMoment: false };
}

function ensureGlobalDofNumberingConfig() {
    const existing = model.dofSettings;
    if (existing && typeof existing === "object" && typeof existing.skipAxial === "boolean" && typeof existing.skipMoment === "boolean") {
        return existing;
    }

    // Backward compatibility: models created before manual switches existed
    // retain their previous automatic behaviour the first time they are opened.
    model.dofSettings = detectDefaultGlobalDofNumberingConfig();
    return model.dofSettings;
}

function getGlobalDofNumberingConfig() {
    const config = ensureGlobalDofNumberingConfig();
    return {
        skipAxial: !!config.skipAxial,
        skipMoment: !!config.skipMoment,
    };
}

function setGlobalDofNumberingOption(option, checked) {
    if (option !== "skipAxial" && option !== "skipMoment") return;

    const config = ensureGlobalDofNumberingConfig();
    config[option] = !!checked;
    model.dofSettings = config;

    // Changing a numbering option changes the global matrix numbering, so any
    // previous analysis result must be discarded before another run.
    markAnalysisInvalidated();
    updateGlobalDofNumberingUI();
}

function getNodeStructuralDofRelevance(nodeId) {
    const connected = model.elements.filter((el) => el.startNode === nodeId || el.endNode === nodeId);
    if (isGridAnalysisMode()) {
        const active = connected.length > 0;
        return { ux: active, uy: active, rz: active };
    }
    let axial = false;
    let bending = false;
    connected.forEach((el) => {
        const tmpl = model.elementTemplates.find((t) => t.id === el.templateId);
        if (!tmpl) return;
        axial = axial || Number(tmpl.A) > 0;
        bending = bending || Number(tmpl.I) > 0;
    });
    return { ux: axial, uy: connected.length > 0, rz: bending };
}

function parseLengthInputStrict(rawValue, elementId, label = "Distance") {
    const str = rawValue === undefined || rawValue === null ? "" : String(rawValue).trim();
    if (str === "") return { ok: false, message: `${label} is required.` };
    const L = getElementLength(elementId);
    if (!isFiniteNumber(L) || L <= 0) return { ok: false, message: "The selected element must have a valid positive length before a distance can be assigned." };

    const formulaMatch = str.match(/^(\d*\.?\d*)\s*\*?\s*[lL]\s*(?:\/\s*(\d+\.?\d*))?$/);
    if (formulaMatch) {
        const multiplier = formulaMatch[1] === "" ? 1 : Number(formulaMatch[1]);
        const divisor = formulaMatch[2] ? Number(formulaMatch[2]) : 1;
        if (!Number.isFinite(multiplier) || !Number.isFinite(divisor) || divisor <= 0) return { ok: false, message: `${label} contains an invalid L expression.` };
        return { ok: true, value: (multiplier * L) / divisor, length: L };
    }

    const value = Number(str);
    if (!Number.isFinite(value)) return { ok: false, message: `${label} must be a finite number or a valid L expression such as L/2.` };
    return { ok: true, value, length: L };
}

function validateNodeInput(id, x, y, z, editingId = null) {
    if (!id) return "Node ID is required.";
    if (hasId(model.nodes, id, editingId)) return "Node ID already exists.";
    for (const [value, label] of [[x, "X Coordinate"], [y, "Y Coordinate"], [z, "Z Coordinate"]]) {
        const error = requireFinite(value, label);
        if (error) return error;
    }
    return null;
}

// ==========================================================================
// 4. MATRIX ALGEBRA UTILITIES
// Pure matrix helpers shared by the stiffness method solver below.
// ==========================================================================
const Matrix = {
    zeros: (r, c) => Array.from({ length: r }, () => new Array(c).fill(0)),
    add: (A, B) => A.map((row, i) => row.map((val, j) => val + B[i][j])),
    sub: (A, B) => A.map((row, i) => row.map((val, j) => val - B[i][j])),
    mul: (A, B) =>
        A.map((row) => B[0].map((_, j) => row.reduce((sum, val, k) => sum + val * B[k][j], 0))),
    transpose: (A) => A[0].map((_, c) => A.map((r) => r[c])),
    invert: (M) => {
        let n = M.length;
        let I = Matrix.zeros(n, n);
        for (let i = 0; i < n; i++) I[i][i] = 1;
        let C = M.map((r, i) => [...r, ...I[i]]);
        for (let i = 0; i < n; i++) {
            let maxEl = Math.abs(C[i][i]),
                maxRow = i;
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(C[k][i]) > maxEl) {
                    maxEl = Math.abs(C[k][i]);
                    maxRow = k;
                }
            }
            if (Math.abs(C[maxRow][i]) < 1e-10) return null; // Singular
            let tmp = C[maxRow];
            C[maxRow] = C[i];
            C[i] = tmp;
            let pivot = C[i][i];
            for (let j = 0; j < 2 * n; j++) C[i][j] /= pivot;
            for (let k = 0; k < n; k++) {
                if (k !== i) {
                    let factor = C[k][i];
                    for (let j = 0; j < 2 * n; j++) C[k][j] -= factor * C[i][j];
                }
            }
        }
        return C.map((r) => r.slice(n));
    },
};

// ==========================================================================
// 5. MATRIX / EQUATION HTML RENDERING HELPERS
// Render [Matrix] and [A] = [B] x [C] style equations as bracketed HTML tables.
// ==========================================================================
function matrixToHTML(M, title = "", topLabels = null, rightLabels = null) {
    if (!M || M.length === 0) return "";

    /*
     * Matrix reduction is handled here at the presentation boundary only.
     *
     * The stiffness/load calculations continue to use their existing
     * formulations. When a local element DOF was removed by the global
     * numbering configuration, its label is represented by "—". Those
     * placeholder positions must not be rendered as real matrix rows/columns.
     *
     * Example:
     *   [—, 1, 2, —, 3, 4]  ->  [1, 2, 3, 4]
     *   6×6 matrix            ->  4×4 matrix
     *
     * This keeps the existing calculation untouched while ensuring every
     * displayed matrix is dense and consistently re-indexed.
     */
    const isRemovedDofLabel = (label) =>
        label === "—" || label === "−" || label === "-" || label === null || label === undefined;

    const isVector = !Array.isArray(M[0]);
    const originalRows = isVector ? M.map((val) => [val]) : M;
    const originalRowCount = originalRows.length;
    const originalColCount = isVector ? 1 : originalRows[0].length;

    const topHasRemoved = Array.isArray(topLabels) &&
        topLabels.length === originalColCount &&
        topLabels.some(isRemovedDofLabel);

    const rightHasRemoved = Array.isArray(rightLabels) &&
        rightLabels.length === originalRowCount &&
        rightLabels.some(isRemovedDofLabel);

    let rowIndices = Array.from({ length: originalRowCount }, (_, i) => i);
    let colIndices = Array.from({ length: originalColCount }, (_, i) => i);

    if (rightHasRemoved) {
        rowIndices = rowIndices.filter((i) => !isRemovedDofLabel(rightLabels[i]));
    }

    if (topHasRemoved && !isVector) {
        colIndices = colIndices.filter((i) => !isRemovedDofLabel(topLabels[i]));
    }

    const rows = rowIndices.map((r) =>
        colIndices.map((c) => originalRows[r][c])
    );

    const displayTopLabels = topHasRemoved
        ? colIndices.map((_, i) => i + 1)
        : topLabels;
    const displayRightLabels = rightHasRemoved
        ? rowIndices.map((_, i) => i + 1)
        : rightLabels;

    let html = `<div class="matrix-wrapper">`;

    if (title) {
        html += `<div class="matrix-title">${title}</div>`;
    } else {
        html += `<div></div>`;
    }

    const colsCount = isVector ? 1 : rows[0]?.length || 0;

    if (displayTopLabels && !isVector) {
        html += `<div style="display: flex; width: 100%; padding: 0 8px;">`;
        for (let c = 0; c < colsCount; c++) {
            let lbl = displayTopLabels[c] !== undefined ? displayTopLabels[c] : "";
            html += `<div style="flex: 1; text-align: center; font-size: 11px; font-weight: bold; color: #dc2626;">${lbl}</div>`;
        }
        html += `</div>`;
    } else {
        html += `<div></div>`;
    }

    html += `<div style="display: flex; align-items: stretch; gap: 2px;">`;

    // Left Bracket
    html += `<div style="width: 6px; border-left: 2px solid #1e293b; border-top: 2px solid #1e293b; border-bottom: 2px solid #1e293b;"></div>`;

    // Values Table
    html += `<table class="matrix-table">`;

    rows.forEach((row) => {
        html += `<tr>`;
        row.forEach((val) => {
            html += `<td>${typeof val === "number" ? formatNum(val) : val}</td>`;
        });
        html += `</tr>`;
    });

    html += `</table>`;

    // Right Bracket
    html += `<div style="width: 6px; border-right: 2px solid #1e293b; border-top: 2px solid #1e293b; border-bottom: 2px solid #1e293b;"></div>`;

    // Right Labels
    if (displayRightLabels) {
        html += `<div style="display: flex; flex-direction: column; justify-content: space-around; margin-left: 6px; padding: 6px 0;">`;
        rows.forEach((_, i) => {
            let lbl = displayRightLabels[i] !== undefined ? displayRightLabels[i] : "";
            html += `<div style="font-size: 11px; font-weight: bold; color: #dc2626; line-height: 1;">${lbl}</div>`;
        });
        html += `</div>`;
    }

    html += `</div>`; // Close stretch flex
    html += `</div>`; // Close matrix-wrapper
    return html;
}

function matrixEqHTML(matrices, operators) {
    // Blank operators separate independent matrices into different rows.
    // Non-blank operators connect matrices into the same calculation row.
    let html = `<div class="eq-wrap">`;
    let row = ``;

    for (let i = 0; i < matrices.length; i++) {
        row += matrixToHTML(matrices[i].m, matrices[i].t, matrices[i].top, matrices[i].right);

        const op = i < operators.length ? String(operators[i]) : "";
        if (op.trim() !== "") {
            row += `<div style="display: inline-flex; align-items: center; justify-content: center;">
                        <div class="math-operator" style="margin: 0 10px;">${op}</div>
                    </div>`;
        } else {
            html += `<div class="eq-row">${row}</div>`;
            row = ``;
        }
    }

    if (row) {
        html += `<div class="eq-row">${row}</div>`;
    }

    html += `</div>`;
    return html;
}

function showEmpty(tbodyId, colspan, title = "No records yet") {
    document.getElementById(tbodyId).innerHTML =
        `<tr><td colspan="${colspan}"><div class="empty"><div class="empty-icon">○</div><h4>${title}</h4><div>Create an item using the form above.</div></div></td></tr>`;
}

// ==========================================================================
// 6. PERSISTENCE
// Save/load the input model to localStorage, export/import as JSON, clear all data.
// Only input data is persisted. Solver-derived analysis state is never saved.
// ==========================================================================
function getPersistedInputModel() {
    const persisted = {};

    // Persist only true user-input fields. Analysis mutates element and
    // support-assignment objects with calculated matrices, loads and reactions;
    // copying those objects directly would make exported/saved files enormous.
    const INPUT_FIELD_KEYS = {
        nodes: ["id", "x", "y", "z"],
        elementTemplates: ["id", "I", "E_GPa", "G_GPa", "J", "A", "density", "selfWeightType"],
        elements: ["id", "templateId", "startNode", "endNode"],
        supportTemplates: ["id", "description", "type", "builtIn", "restraints", "displacement"],
        supportAssignments: ["id", "supportId", "nodeId"],
        loadCases: ["id", "type", "description"],
        loads: ["id", "loadCaseId", "type", "nodeId", "elementId", "axisSystem", "angle", "distance", "distanceEnd", "Fx", "Fy", "Fz", "FxEnd", "FyEnd", "FzEnd"],
        momentCases: ["id", "type", "description"],
        moments: ["id", "momentCaseId", "type", "nodeId", "elementId", "distance", "Mx", "My", "Mz"],
    };

    AppConfig.persistedModelKeys.forEach((key) => {
        const items = Array.isArray(model[key]) ? model[key] : [];
        const fields = INPUT_FIELD_KEYS[key];
        persisted[key] = fields
            ? items.map((item) => {
                  const clean = {};
                  fields.forEach((field) => {
                      if (Object.prototype.hasOwnProperty.call(item || {}, field)) clean[field] = item[field];
                  });
                  return clean;
              })
            : [];
    });

    // Persist the manual global DoF switches with the model so each saved
    // model keeps its own numbering configuration.
    persisted.dofSettings = { ...getGlobalDofNumberingConfig() };
    persisted.analysisMode = model.analysisMode === "grid" ? "grid" : "plane";

    return persisted;
}

function applyPersistedInputModel(source) {
    AppConfig.persistedModelKeys.forEach((key) => {
        model[key] = Array.isArray(source?.[key]) ? source[key] : [];
    });
    model.analysisMode = source?.analysisMode === "grid" ? "grid" : "plane";
    syncAnalysisModeUI();

    if (source?.dofSettings && typeof source.dofSettings === "object" &&
        typeof source.dofSettings.skipAxial === "boolean" &&
        typeof source.dofSettings.skipMoment === "boolean") {
        model.dofSettings = {
            skipAxial: source.dofSettings.skipAxial,
            skipMoment: source.dofSettings.skipMoment,
        };
    } else {
        delete model.dofSettings;
        ensureGlobalDofNumberingConfig();
    }

    // Never carry solver-derived state across a save/load/import boundary.
    delete model.nodeDisplacements;
    model.elements.forEach((el) => {
        if (!el) return;
        delete el.plotData;
        delete el.L;
        delete el.cx;
        delete el.cy;
        delete el.SM;
        delete el.RT;
        delete el.RTT;
        delete el.SMS;
        delete el.AML;
        delete el.localwx;
        delete el.localwy;
        delete el.localPointLoads;
        delete el.localUDLs;
        delete el.localPointMoments;
    });
    model.supportAssignments.forEach((sa) => {
        if (!sa) return;
        delete sa.rx;
        delete sa.ry;
        delete sa.rz;
    });
}

function getModelName() {
    const input = document.getElementById("modelName");
    return (input?.value || "Structural Model").trim() || "Structural Model";
}

function saveModelNamePreference() {
    localStorage.setItem("structuralModelName", getModelName());
}

function sanitizeFileName(name) {
    return String(name || "Structural Model")
        .trim()
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
        .replace(/[. ]+$/g, "")
        .replace(/\s+/g, " ") || "Structural Model";
}

function hasModelInputData(data = getPersistedInputModel()) {
    return AppConfig.persistedModelKeys.some((key) => {
        let items = Array.isArray(data?.[key]) ? data[key] : [];
        // Built-in support templates are always available in the UI; they do
        // not mean the user has created a model that needs saving.
        if (key === "supportTemplates") {
            items = items.filter((item) => item && !item.builtIn && !["FIXED", "ROLLER", "HINGED"].includes(String(item.id)));
        }
        return items.length > 0;
    });
}

function createModelLibraryId() {
    return `model-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeModelLibraryRecords(source) {
    const normalized = {};
    const seenNames = new Set();
    let changed = false;

    Object.entries(source || {}).forEach(([storageId, record]) => {
        if (!record || typeof record !== "object" || Array.isArray(record)) {
            changed = true;
            return;
        }

        const id = String(storageId);
        const baseName = String(record.name ?? "").trim() || "Structural Model";
        let name = baseName;
        let suffix = 2;
        // Names are compared case-insensitively after trimming only the ends.
        // Internal spaces remain significant ("My Model" != "MyModel").
        while (seenNames.has(modelNameKey(name))) {
            name = `${baseName} (${suffix++})`;
        }
        seenNames.add(modelNameKey(name));

        if (record.name !== name || String(record.id || storageId) !== id) changed = true;
        normalized[id] = { ...record, id, name };
    });

    if (Object.keys(normalized).length !== Object.keys(source || {}).length) changed = true;
    return { library: normalized, changed };
}

function getModelLibrary() {
    try {
        const saved = JSON.parse(localStorage.getItem("structuralModels") || "{}");
        if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};

        const result = normalizeModelLibraryRecords(saved);
        if (result.changed) {
            localStorage.setItem("structuralModels", JSON.stringify(result.library));

            // If an existing duplicate had the current model ID, keep its
            // displayed name synchronized with the automatically repaired name.
            const currentId = localStorage.getItem("structuralCurrentModelId") || "";
            const oldName = saved[currentId]?.name;
            const repairedName = result.library[currentId]?.name;
            if (repairedName && String(oldName ?? "") !== repairedName) {
                localStorage.setItem("structuralModelName", repairedName);
                const nameInput = document.getElementById("modelName");
                if (nameInput) nameInput.value = repairedName;
            }
        }
        return result.library;
    } catch (error) {
        return {};
    }
}

function setModelLibrary(library) {
    const result = normalizeModelLibraryRecords(library);
    localStorage.setItem("structuralModels", JSON.stringify(result.library));

    const activeId = String(currentModelLibraryId || localStorage.getItem("structuralCurrentModelId") || "");
    const activeName = result.library[activeId]?.name;
    const requestedName = library?.[activeId]?.name;
    if (activeName && requestedName !== activeName) {
        localStorage.setItem("structuralModelName", activeName);
        const nameInput = document.getElementById("modelName");
        if (nameInput) nameInput.value = activeName;
    }
    return result.library;
}

function formatModelSavedTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString();
}

// ---- Duplicate-model protection -------------------------------------------
// A model counts as a duplicate of a saved one when it has the same name, or
// when its input data is identical to a saved model's data.
function modelNameKey(name) {
    // Ignore all whitespace and letter case when comparing names.
    // Displayed names retain their original internal spacing; whitespace is
    // removed only for duplicate detection (e.g. "Bridge Model" = "bridgemodel").
    return String(name ?? "").replace(/\s+/g, "").toLowerCase();
}

function getAvailableModelName(requestedName, library = getModelLibrary(), ignoreId = "") {
    const baseName = String(requestedName ?? "").trim() || "Structural Model";
    const used = new Set(Object.entries(library).filter(([id]) => String(id) !== String(ignoreId))
        .map(([, item]) => modelNameKey(item?.name)));
    if (!used.has(modelNameKey(baseName))) return baseName;

    let suffix = 2;
    let candidate = `${baseName} (${suffix})`;
    while (used.has(modelNameKey(candidate))) candidate = `${baseName} (${++suffix})`;
    return candidate;
}

function canonicalJSON(value) {
    if (Array.isArray(value)) return "[" + value.map(canonicalJSON).join(",") + "]";
    if (value && typeof value === "object") {
        return "{" + Object.keys(value).sort().map((k) => JSON.stringify(k) + ":" + canonicalJSON(value[k])).join(",") + "}";
    }
    return JSON.stringify(value === undefined ? null : value);
}

function modelDataFingerprint(data) {
    const norm = {};
    AppConfig.persistedModelKeys.forEach((key) => {
        let items = Array.isArray(data?.[key]) ? data[key] : [];
        if (key === "supportTemplates") {
            items = items.filter((t) => t && !t.builtIn && !["FIXED", "ROLLER", "HINGED"].includes(t.id));
        }
        norm[key] = items;
    });
    const hasInput = Object.values(norm).some((items) => items.length > 0);
    if (!hasInput) return "";
    const d = data?.dofSettings;
    norm.dofSettings = { skipAxial: !!(d && d.skipAxial), skipMoment: !!(d && d.skipMoment) };
    norm.analysisMode = data?.analysisMode === "grid" ? "grid" : "plane";
    return canonicalJSON(norm);
}

// Returns { type: "content" | "name", item } for the first saved model (other
// than ignoreId) that duplicates the given name/data, or null.
function findDuplicateModel(name, data, ignoreId, library = getModelLibrary()) {
    const key = modelNameKey(name);
    const fp = modelDataFingerprint(data);
    const others = Object.values(library).filter((m) => m && m.id !== ignoreId);
    if (fp) {
        const same = others.find((m) => modelDataFingerprint(m.data) === fp);
        if (same) return { type: "content", item: same };
    }
    const sameName = others.find((m) => modelNameKey(m.name) === key);
    if (sameName) return { type: "name", item: sameName };
    return null;
}

function duplicateModelMessage(dup) {
    return dup.type === "content"
        ? `Duplicate model: this model is identical to the saved model "${dup.item.name}". It was not saved again.`
        : `Duplicate model: a saved model named "${dup.item.name}" already exists. Rename this model before saving.`;
}

function saveCurrentModelToLibrary(silent = false) {
    const library = getModelLibrary();
    const data = getPersistedInputModel();
    let modelName = getModelName();

    const dup = findDuplicateModel(modelName, data, currentModelLibraryId, library);
    if (dup) {
        if (!silent) {
            alert(duplicateModelMessage(dup));
            return false;
        }
        // Avoid silently creating two saved models with the same name. Keep
        // identical content deduplicated; rename a different unsaved model so
        // autosaving before navigation does not lose the user's work.
        if (dup.type === "content") return false;
        modelName = getAvailableModelName(modelName, library, currentModelLibraryId);
        const nameInput = document.getElementById("modelName");
        if (nameInput) nameInput.value = modelName;
    }

    if (!currentModelLibraryId) currentModelLibraryId = createModelLibraryId();

    library[currentModelLibraryId] = {
        id: currentModelLibraryId,
        name: modelName,
        data,
        updatedAt: new Date().toISOString(),
    };

    setModelLibrary(library);
    localStorage.setItem("structuralCurrentModelId", currentModelLibraryId);
    localStorage.setItem("structuralInputModel", JSON.stringify(data));
    localStorage.setItem("structuralModelName", modelName);
    renderModelLibrary();

    if (!silent) alert(`Model "${modelName}" saved in browser storage.`);
    return true;
}

function saveModel() {
    // Save preferences only after the library accepts the name; a rejected
    // duplicate must not become the next startup's preferred model name.
    saveCurrentModelToLibrary(false);
}

function loadModel() {
    const savedName = localStorage.getItem("structuralModelName");
    const nameInput = document.getElementById("modelName");
    if (nameInput && savedName) nameInput.value = savedName;

    // Preferred: restore the currently selected model from the named library.
    const library = getModelLibrary();
    const storedCurrentId = localStorage.getItem("structuralCurrentModelId") || "";
    if (storedCurrentId && library[storedCurrentId]?.data) {
        currentModelLibraryId = storedCurrentId;
        if (nameInput) nameInput.value = library[storedCurrentId].name || nameInput.value || "Structural Model";
        applyPersistedInputModel(library[storedCurrentId].data);
        ensureBuiltInSupportTemplates();
        markAnalysisInvalidated();
        renderModelLibrary();
        return;
    }

    // Backward compatibility: migrate the previous single-model storage into
    // the new named library the first time the updated file is opened.
    const saved = localStorage.getItem("structuralInputModel");
    if (!saved) {
        renderModelLibrary();
        return;
    }
    try {
        const parsed = JSON.parse(saved);
        applyPersistedInputModel(parsed);
        ensureBuiltInSupportTemplates();
        markAnalysisInvalidated();

        if (!currentModelLibraryId) {
            currentModelLibraryId = createModelLibraryId();
            library[currentModelLibraryId] = {
                id: currentModelLibraryId,
                name: getModelName(),
                data: parsed,
                updatedAt: new Date().toISOString(),
            };
            setModelLibrary(library);
            localStorage.setItem("structuralCurrentModelId", currentModelLibraryId);
        }
        renderModelLibrary();
    } catch (error) {
        console.error(error);
        renderModelLibrary();
    }
}

function resetAnalysisForModelChange() {
    activeLoadCaseId = "";
    activeMomentCaseId = "";
    analysisState.status = "not-run";
    const resultsContent = document.getElementById("resultsContent");
    if (resultsContent) resultsContent.style.display = "none";
    updateAnalysisStatusUI();
}

function openSavedModel(modelId) {
    const library = getModelLibrary();
    const savedModel = library[modelId];
    if (!savedModel?.data) return;

    // Protect the current work from accidental loss by saving it first when it
    // contains input data. This does not alter the active solver state.
    if (hasModelInputData()) saveCurrentModelToLibrary(true);

    currentModelLibraryId = modelId;
    localStorage.setItem("structuralCurrentModelId", modelId);
    localStorage.setItem("structuralModelName", savedModel.name || "Structural Model");

    const nameInput = document.getElementById("modelName");
    if (nameInput) nameInput.value = savedModel.name || "Structural Model";

    applyPersistedInputModel(savedModel.data);
    migrateUnitSystem();
    ensureBuiltInSupportTemplates();
    resetAnalysisForModelChange();
    syncAnalysisModeUI();
    refreshAll();
    renderModelLibrary();

    const dashboardBtn = document.querySelector('.nav-btn[data-section="dashboard"]');
    switchSection("dashboard", dashboardBtn);
}

function newModel() {
    const library = getModelLibrary();
    const existingNames = new Set(Object.values(library).map((m) => modelNameKey(m && m.name)));
    if (hasModelInputData()) existingNames.add(modelNameKey(getModelName()));
    let defaultNumber = Object.keys(library).length + 1;
    while (existingNames.has(modelNameKey(`Model ${defaultNumber}`))) defaultNumber++;

    const modal = document.getElementById("newModelModal");
    const nameInput = document.getElementById("newModelNameInput");
    const validation = document.getElementById("newModelValidationMessage");
    if (!modal || !nameInput) {
        // Defensive fallback for an unexpected shell/rendering failure.
        const proposedName = prompt("Enter the new model name:", `Model ${defaultNumber}`);
        if (proposedName === null) return;
        const normalizedName = String(proposedName).trim() || `Model ${defaultNumber}`;
        const names = new Set(Object.values(getModelLibrary()).map((m) => modelNameKey(m && m.name)));
        if (hasModelInputData()) names.add(modelNameKey(getModelName()));
        if (names.has(modelNameKey(normalizedName))) {
            alert(`A model named "${normalizedName}" already exists or is about to be saved. Choose a different name.`);
            return;
        }
        createNewModelRecord(normalizedName, "plane");
        return;
    }

    nameInput.value = `Model ${defaultNumber}`;
    modal.dataset.defaultName = `Model ${defaultNumber}`;
    const btfOption = modal.querySelector('input[name="newModelAnalysisMode"][value="plane"]');
    if (btfOption) btfOption.checked = true;
    if (validation) { validation.textContent = ""; validation.hidden = true; }
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => nameInput.focus());
}

function closeNewModelDialog() {
    const modal = document.getElementById("newModelModal");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
}

function createNewModelFromDialog(event) {
    if (event) event.preventDefault();
    const modal = document.getElementById("newModelModal");
    const nameInput = document.getElementById("newModelNameInput");
    const validation = document.getElementById("newModelValidationMessage");
    if (!modal || !nameInput) return;

    const defaultName = modal.dataset.defaultName || "New Model";
    const modelName = nameInput.value.trim() || defaultName;
    const existingNames = new Set(Object.values(getModelLibrary()).map((m) => modelNameKey(m && m.name)));
    if (hasModelInputData()) existingNames.add(modelNameKey(getModelName()));
    if (existingNames.has(modelNameKey(modelName))) {
        if (validation) {
            validation.textContent = `A saved model named "${modelName}" already exists. Choose a different name.`;
            validation.hidden = false;
        } else {
            alert(`Duplicate model: a saved model named "${modelName}" already exists. Choose a different name.`);
        }
        nameInput.focus();
        return;
    }

    const selectedMode = modal.querySelector('input[name="newModelAnalysisMode"]:checked')?.value === "grid" ? "grid" : "plane";
    closeNewModelDialog();
    createNewModelRecord(modelName, selectedMode);
}

function createNewModelRecord(modelName, analysisMode) {
    if (hasModelInputData()) saveCurrentModelToLibrary(true);
    // Re-check after autosaving the previous model to guard every creation
    // path, including the prompt fallback and future callers.
    modelName = getAvailableModelName(modelName, getModelLibrary());

    AppConfig.persistedModelKeys.forEach((key) => {
        model[key] = [];
    });
    model.dofSettings = { skipAxial: false, skipMoment: false };
    // The solver type is chosen once at model creation and is never changed by
    // the in-workspace UI. Saved/imported models restore their own saved type.
    model.analysisMode = analysisMode === "grid" ? "grid" : "plane";
    syncAnalysisModeUI();
    ensureBuiltInSupportTemplates();
    currentModelLibraryId = "";
    localStorage.removeItem("structuralCurrentModelId");
    localStorage.setItem("structuralModelName", modelName);

    const nameInput = document.getElementById("modelName");
    if (nameInput) nameInput.value = modelName;

    resetAnalysisForModelChange();
    refreshAll();
    renderModelLibrary();
    const dashboardBtn = document.querySelector('.nav-btn[data-section="dashboard"]');
    switchSection("dashboard", dashboardBtn);
}
function deleteSavedModel(modelId) {
    const library = getModelLibrary();
    const savedModel = library[modelId];
    if (!savedModel) return;

    if (!confirm(`Delete saved model "${savedModel.name}"? This cannot be undone.`)) return;

    const deletedCurrentModel = currentModelLibraryId === modelId;
    delete library[modelId];
    setModelLibrary(library);

    if (deletedCurrentModel || Object.keys(library).length === 0) {
        // Deleting the active model (or the last remaining saved model) also
        // clears its live and persisted working copy to avoid a ghost model.
        resetActiveModelAfterSavedModelDeletion();
    }
    renderModelLibrary();
}

function downloadJSONFile(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 4)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

function exportModel() {
    saveModelNamePreference();
    const data = getPersistedInputModel();
    downloadJSONFile(`${sanitizeFileName(getModelName())}.json`, data);
}

function exportSavedModel(modelId) {
    const library = getModelLibrary();
    const savedModel = library[modelId];
    if (!savedModel?.data) return;
    downloadJSONFile(`${sanitizeFileName(savedModel.name)}.json`, savedModel.data);
}

function exportAllModels() {
    const library = getModelLibrary();
    const models = Object.values(library).sort((a, b) => String(a.name).localeCompare(String(b.name)));

    // Always export the current in-memory version of the open model. This means
    // recent edits are included even when the model was saved earlier.
    if (hasModelInputData()) {
        const currentData = getPersistedInputModel();
        const currentName = getModelName();
        const currentIndex = currentModelLibraryId
            ? models.findIndex((item) => item.id === currentModelLibraryId)
            : -1;

        const currentSnapshot = {
            id: currentModelLibraryId || "current-unsaved",
            name: currentName,
            data: currentData,
            updatedAt: new Date().toISOString(),
        };

        if (currentIndex >= 0) {
            models[currentIndex] = currentSnapshot;
        } else {
            models.push(currentSnapshot);
        }
    }

    if (models.length === 0) {
        alert("No saved models available to export.");
        return;
    }

    const bundle = {
        type: "StructuralAnalysisModelCollection",
        version: 1,
        exportedAt: new Date().toISOString(),
        models: models.map((item) => ({
            id: item.id,
            name: item.name,
            updatedAt: item.updatedAt || null,
            data: item.data,
        })),
    };

    const defaultExportFileName =
        localStorage.getItem("structuralExportAllFileName") || "Structural_Analysis_All_Models";
    const enteredExportFileName = prompt(
        "Enter export file name:",
        defaultExportFileName,
    );
    if (enteredExportFileName === null) return;

    const safeExportFileName = sanitizeFileName(enteredExportFileName) || defaultExportFileName;
    localStorage.setItem("structuralExportAllFileName", safeExportFileName);
    downloadJSONFile(`${safeExportFileName}.json`, bundle);
}

function importModel(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const imported = JSON.parse(e.target.result);

            // Collection import: merge all named models into the local library.
            if (imported?.type === "StructuralAnalysisModelCollection" && Array.isArray(imported.models)) {
                const library = getModelLibrary();
                let importedCount = 0;
                let duplicateCount = 0;

                imported.models.forEach((item) => {
                    if (!item?.data || typeof item.data !== "object") return;
                    let importName = String(item.name || `Imported Model ${importedCount + 1}`);
                    const fpImport = modelDataFingerprint(item.data);
                    if (fpImport && Object.values(library).some((m) => modelDataFingerprint(m.data) === fpImport)) {
                        duplicateCount++;
                        return;
                    }
                    if (Object.values(library).some((m) => modelNameKey(m.name) === modelNameKey(importName))) {
                        let n = 2;
                        while (Object.values(library).some((m) => modelNameKey(m.name) === modelNameKey(`${importName} (${n})`))) n++;
                        importName = `${importName} (${n})`;
                    }
                    let id = String(item.id || createModelLibraryId());
                    if (library[id]) id = createModelLibraryId();
                    library[id] = {
                        id,
                        name: importName,
                        data: item.data,
                        updatedAt: item.updatedAt || new Date().toISOString(),
                    };
                    importedCount++;
                });

                setModelLibrary(library);
                renderModelLibrary();
                alert(`${importedCount} model(s) imported into the model library.` +
                    (duplicateCount ? ` ${duplicateCount} duplicate model(s) already saved on this device were skipped.` : ""));
            } else {
                // Single-model JSON: load it as the current unsaved model.
                applyPersistedInputModel(imported);
                migrateUnitSystem();
                ensureBuiltInSupportTemplates();
                currentModelLibraryId = "";
                localStorage.removeItem("structuralCurrentModelId");

                const importedBaseName = file.name.replace(/\.json$/i, "").trim();
                const importedName = importedBaseName
                    ? getAvailableModelName(importedBaseName, getModelLibrary())
                    : "";
                const nameInput = document.getElementById("modelName");
                if (nameInput && importedName) {
                    nameInput.value = importedName;
                    saveModelNamePreference();
                }

                resetAnalysisForModelChange();
                refreshAll();
                renderModelLibrary();
                alert("Structural input model imported as the current unsaved model.");
            }
        } catch (error) {
            alert("Invalid JSON file.");
        } finally {
            event.target.value = "";
        }
    };
    reader.readAsText(file);
}

function resetActiveModelAfterSavedModelDeletion() {
    AppConfig.persistedModelKeys.forEach((key) => { model[key] = []; });
    model.dofSettings = { skipAxial: false, skipMoment: false };
    model.analysisMode = "plane";
    currentModelLibraryId = "";
    ["structuralCurrentModelId", "structuralInputModel", "structuralModelName"].forEach((key) => localStorage.removeItem(key));

    const nameInput = document.getElementById("modelName");
    if (nameInput) nameInput.value = "Structural Model";
    ensureBuiltInSupportTemplates();
    resetAnalysisForModelChange();
    syncAnalysisModeUI();
    const resultsContent = document.getElementById("resultsContent");
    if (resultsContent) resultsContent.style.display = "none";
    refreshAll();
}

function clearModel() {
    if (!confirm("Delete the entire current input model? Saved models in the Home library will not be deleted.")) return;

    AppConfig.persistedModelKeys.forEach((key) => {
        model[key] = [];
    });
    model.dofSettings = { skipAxial: false, skipMoment: false };
    ensureBuiltInSupportTemplates();
    currentModelLibraryId = "";
    localStorage.removeItem("structuralCurrentModelId");
    localStorage.removeItem("structuralInputModel");
    localStorage.removeItem("structuralModelName");

    const nameInput = document.getElementById("modelName");
    if (nameInput) nameInput.value = "Structural Model";

    resetAnalysisForModelChange();
    renderModelLibrary();
    document.getElementById("resultsContent").style.display = "none";
    refreshAll();
}

// ==========================================================================
// 7. NAVIGATION
// Sidebar section switching.
// ==========================================================================
function updatePageTitle(id) {
    document.getElementById("pageTitle").textContent = AppConfig.sectionTitles[id][0];
}

function updatePageSubtitle(id) {
    document.getElementById("pageSubtitle").textContent = AppConfig.sectionTitles[id][1];
}

function switchSection(id, btnEl) {
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".section").forEach((s) => s.classList.remove("active"));
    if (btnEl) btnEl.classList.add("active");
    const target = document.getElementById(id);
    if (target) target.classList.add("active");

    const appRoot = document.querySelector(".app");
    if (appRoot) appRoot.classList.toggle("home-mode", id === "home");

    const liveModelDiagramCard = document.getElementById("liveModelDiagramCard");
    if (liveModelDiagramCard) liveModelDiagramCard.style.display = id === "home" ? "none" : "block";

    const homeButton = document.getElementById("topbarHomeButton");
    if (homeButton) homeButton.style.display = id === "home" ? "none" : "inline-flex";

    updatePageTitle(id);
    updatePageSubtitle(id);
    refreshAll();
}

function goHome() {
    const homeBtn = document.querySelector('.nav-btn[data-section="home"]');
    switchSection("home", homeBtn);
}

document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        switchSection(btn.dataset.section, btn);
    });
});

// ==========================================================================
// 8. MODEL CRUD & TABLE RENDERING
// Each subsection: create-form submit handler, form reset, table render, (edit/delete).
// ==========================================================================

// ---- Reorderable Input Tables ----
// Drag the grip beside any input ID to change that collection's sequence.
// Pointer events are used so the same control works with mouse and touch.
const sortDragState = {
    row: null,
    handle: null,
    tbody: null,
    collection: null,
    pointerId: null,
    startX: 0,
    startY: 0,
    holdTimer: null,
    active: false,
};

const SORT_HOLD_DELAY_MS = 450;
const SORT_MOVE_CANCEL_PX = 10;

function reorderVisibleCollection(collectionName, orderedEncodedIds) {
    const collection = model[collectionName];
    if (!Array.isArray(collection)) return false;

    const orderedIds = [];
    orderedEncodedIds.forEach((encodedId) => {
        try {
            const id = decodeURIComponent(encodedId);
            if (!orderedIds.includes(id)) orderedIds.push(id);
        } catch (error) {
            // Ignore malformed DOM data; the underlying model remains intact.
        }
    });

    const idSet = new Set(orderedIds);
    const reorderedVisibleItems = orderedIds
        .map((id) => collection.find((item) => String(item?.id) === String(id)))
        .filter(Boolean);

    if (!reorderedVisibleItems.length) return false;

    const visiblePositions = [];
    collection.forEach((item, index) => {
        if (idSet.has(String(item?.id))) visiblePositions.push(index);
    });

    if (visiblePositions.length !== reorderedVisibleItems.length) return false;

    visiblePositions.forEach((position, index) => {
        collection[position] = reorderedVisibleItems[index];
    });

    return true;
}

function activateSortDrag() {
    if (!sortDragState.row || !sortDragState.handle) return;
    if (!sortDragState.row.isConnected) return;

    sortDragState.active = true;
    sortDragState.handle.classList.remove("sort-holding");
    sortDragState.handle.classList.add("sort-ready");
    sortDragState.row.classList.add("sort-dragging");

    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        try { navigator.vibrate([28, 22, 38]); } catch (error) {}
    }
}

function finishSortDrag(commit = true) {
    const row = sortDragState.row;
    const tbody = sortDragState.tbody;
    const collection = sortDragState.collection;
    const wasActive = sortDragState.active;

    if (sortDragState.holdTimer) {
        clearTimeout(sortDragState.holdTimer);
        sortDragState.holdTimer = null;
    }

    if (commit && wasActive && tbody && collection) {
        const orderedIds = Array.from(tbody.querySelectorAll("tr[data-sort-collection]"))
            .filter((tr) => tr.dataset.sortCollection === collection)
            .map((tr) => tr.dataset.sortId);

        if (reorderVisibleCollection(collection, orderedIds)) {
            markAnalysisInvalidated();
            refreshAll();
        }
    }

    if (row) row.classList.remove("sort-dragging", "sort-drop-target");
    if (sortDragState.handle) sortDragState.handle.classList.remove("sort-holding", "sort-ready");

    sortDragState.row = null;
    sortDragState.handle = null;
    sortDragState.tbody = null;
    sortDragState.collection = null;
    sortDragState.pointerId = null;
    sortDragState.startX = 0;
    sortDragState.startY = 0;
    sortDragState.active = false;
}

function handleSortPointerDown(e) {
    const handle = e.target.closest(".sort-handle");
    if (!handle) return;
    if (e.button !== undefined && e.button !== 0) return;

    const row = handle.closest("tr[data-sort-collection][data-sort-id]");
    const tbody = row?.parentElement;
    if (!row || !tbody) return;

    e.preventDefault();

    finishSortDrag(false);

    sortDragState.row = row;
    sortDragState.handle = handle;
    sortDragState.tbody = tbody;
    sortDragState.collection = row.dataset.sortCollection;
    sortDragState.pointerId = e.pointerId;
    sortDragState.startX = e.clientX;
    sortDragState.startY = e.clientY;
    sortDragState.active = false;

    handle.classList.add("sort-holding");

    sortDragState.holdTimer = setTimeout(() => {
        activateSortDrag();
    }, SORT_HOLD_DELAY_MS);

    if (handle.setPointerCapture) {
        try { handle.setPointerCapture(e.pointerId); } catch (error) {}
    }
}

function handleSortPointerMove(e) {
    if (!sortDragState.row || e.pointerId !== sortDragState.pointerId) return;

    const dx = e.clientX - sortDragState.startX;
    const dy = e.clientY - sortDragState.startY;
    const movement = Math.hypot(dx, dy);

    if (!sortDragState.active) {
        if (movement >= SORT_MOVE_CANCEL_PX) {
            finishSortDrag(false);
        }
        return;
    }

    e.preventDefault();

    const elementAtPointer = document.elementFromPoint(e.clientX, e.clientY);
    const targetRow = elementAtPointer?.closest("tr[data-sort-collection][data-sort-id]");
    if (!targetRow || targetRow.parentElement !== sortDragState.tbody) return;
    if (targetRow.dataset.sortCollection !== sortDragState.collection) return;
    if (targetRow === sortDragState.row) return;

    const currentTarget = sortDragState.tbody.querySelector("tr.sort-drop-target");
    if (currentTarget && currentTarget !== targetRow) currentTarget.classList.remove("sort-drop-target");
    targetRow.classList.add("sort-drop-target");

    const rect = targetRow.getBoundingClientRect();
    const insertBefore = e.clientY < rect.top + rect.height / 2;
    if (insertBefore) {
        sortDragState.tbody.insertBefore(sortDragState.row, targetRow);
    } else {
        sortDragState.tbody.insertBefore(sortDragState.row, targetRow.nextSibling);
    }
}

document.addEventListener("pointerdown", handleSortPointerDown, { passive: false });
document.addEventListener("pointermove", handleSortPointerMove, { passive: false });
document.addEventListener("pointerup", () => finishSortDrag(true));
document.addEventListener("pointercancel", () => finishSortDrag(true));

function sortHandle(id) {
    return `<span class="sort-handle" title="Drag to reorder" aria-label="Drag to reorder">⋮⋮</span>`;
}

function setOptions(selectId, items, placeholder, valueKey = "id") {
    const select = document.getElementById(selectId);
    if (!select) return;
    const current = select.value;
    select.innerHTML =
        `<option value="">${placeholder}</option>` +
        items
            .map((item) => {
                const value = typeof item === "string" ? item : item[valueKey];
                return `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`;
            })
            .join("");
    if (
        items.some((item) => {
            const value = typeof item === "string" ? item : item[valueKey];
            return String(value) === current;
        })
    )
        select.value = current;
}

function updateSelects() {
    setOptions("elementTemplateSelect", model.elementTemplates, "Select template");
    setOptions("elementStartNode", model.nodes, "Select node");
    setOptions("elementEndNode", model.nodes, "Select node");
    setOptions("supportTemplateSelect", model.supportTemplates, "Select support");
    setOptions("supportNodeSelect", model.nodes, "Select node");
    setOptions("loadCaseSelect", model.loadCases, "Select load case");
    setOptions("loadNode", model.nodes, "Select node");
    setOptions("loadElement", model.elements, "Select element");
    setOptions("momentCaseSelect", model.momentCases, "Select moment case");
    setOptions("momentNode", model.nodes, "Select node");
    setOptions("momentElement", model.elements, "Select element");
    syncActiveAnalysisCaseSelectors();
}

function getDeletionDependencies(collection, value, property) {
    const refValue = String(value);
    const deps = [];

    const addDependency = (label, items) => {
        if (items.length) deps.push(`${items.length} ${label}${items.length === 1 ? "" : "s"}`);
    };

    switch (collection) {
        case "nodes":
            addDependency("element", model.elements.filter((e) => String(e.startNode) === refValue || String(e.endNode) === refValue));
            addDependency("support assignment", model.supportAssignments.filter((s) => String(s.nodeId) === refValue));
            addDependency("load", model.loads.filter((l) => String(l.nodeId) === refValue));
            addDependency("moment", model.moments.filter((m) => String(m.nodeId) === refValue));
            break;
        case "elementTemplates":
            addDependency("element", model.elements.filter((e) => String(e.templateId) === refValue));
            break;
        case "elements":
            addDependency("load", model.loads.filter((l) => String(l.elementId) === refValue));
            addDependency("moment", model.moments.filter((m) => String(m.elementId) === refValue));
            break;
        case "supportTemplates":
            addDependency("support assignment", model.supportAssignments.filter((s) => String(s.supportId) === refValue));
            break;
        case "loadCases":
            addDependency("load", model.loads.filter((l) => String(l.loadCaseId) === refValue));
            break;
        case "momentCases":
            addDependency("moment", model.moments.filter((m) => String(m.momentCaseId) === refValue));
            break;
    }

    return deps;
}

function deleteItem(collection, encodedValue, property) {
    const value = decodeURIComponent(encodedValue);

    if (collection === "supportTemplates") {
        const support = model.supportTemplates.find((item) => String(item[property]) === String(value));
        if (support?.builtIn) return alert("Built-in support templates cannot be deleted.");
    }

    const dependencies = getDeletionDependencies(collection, value, property);
    if (dependencies.length) {
        const entityNames = {
            nodes: "Node",
            elementTemplates: "Element Template",
            elements: "Element",
            supportTemplates: "Support Template",
            supportAssignments: "Support Assignment",
            loadCases: "Load Case",
            loads: "Load",
            momentCases: "Moment Case",
            moments: "Moment",
        };
        return alert(`Cannot delete ${entityNames[collection] || collection} ${value} because it is referenced by ${dependencies.join(", ")}. Delete or reassign those dependent items first.`);
    }

    if (!confirm(`Delete ${value}?`)) return;
    markAnalysisInvalidated();
    model[collection] = model[collection].filter(
        (item) => String(item[property]) !== String(value),
    );
    refreshAll();
}

function refreshAll() {
    syncAnalysisModeUI();
    if (typeof syncLoadInputModeUI === "function") syncLoadInputModeUI();
    if (typeof syncMomentInputModeUI === "function") syncMomentInputModeUI();
    if (typeof syncMomentCaseInputModeUI === "function") syncMomentCaseInputModeUI();
    updateGlobalDofNumberingUI();
    renderModelLibrary();
    renderNodes();
    renderElementTemplates();
    renderElements();
    renderSupportTemplates();
    renderSupportAssignments();
    renderLoadCases();
    renderLoads();
    renderMomentCases();
    renderMoments();
    updateSelects();
    // updateSelects rebuilds the shared case dropdowns, so reapply mode labels
    // and placeholders afterward for Grid torsion terminology.
    if (typeof syncLoadInputModeUI === "function") syncLoadInputModeUI();
    if (typeof syncMomentInputModeUI === "function") syncMomentInputModeUI();
    if (typeof syncMomentCaseInputModeUI === "function") syncMomentCaseInputModeUI();
    updateStats();
    scheduleInlineModelDiagramRedraw();
}

/* ==========================================================================
 * APPLICATION BOOTSTRAP
 * Runs once every module script has loaded and registered its markup + logic
 * (index.html loads main.js first and the page / results modules afterwards).
 * ========================================================================== */
document.addEventListener("DOMContentLoaded", function initApplication() {
    // Establish the Home view before restoring saved data. Startup operations
    // can touch old or malformed browser data; they must never leave the shell
    // in dashboard styling while the Home section is active.
    const homeNavBtn = document.querySelector('.nav-btn[data-section="home"]');
    const forceHomeView = () => {
        document.querySelectorAll(".section").forEach((section) => {
            section.classList.toggle("active", section.id === "home");
        });
        document.querySelectorAll(".nav-btn").forEach((button) => {
            button.classList.toggle("active", button === homeNavBtn);
        });
        const appRoot = document.querySelector(".app");
        if (appRoot) appRoot.classList.add("home-mode");
        const liveModelDiagramCard = document.getElementById("liveModelDiagramCard");
        if (liveModelDiagramCard) liveModelDiagramCard.style.display = "none";
        const homeButton = document.getElementById("topbarHomeButton");
        if (homeButton) homeButton.style.display = "none";
        updatePageTitle("home");
        updatePageSubtitle("home");
    };

    forceHomeView();
    try {
        loadModel();
        migrateUnitSystem();
        ensureBuiltInSupportTemplates();
        analysisState.status = "not-run";
        updateAnalysisStatusUI();
        updateElementWeightUnit();
        syncAnalysisModeUI();
        toggleLoadTarget();
        toggleMomentTarget();
        refreshAll();
    } catch (error) {
        console.error("[startup] Initialization failed; keeping the Home screen visible.", error);
    } finally {
        // Reassert Home after initialization so no intermediate UI update or
        // partial failure can determine which screen users see on page open.
        forceHomeView();
        try {
            renderModelLibrary();
        } catch (error) {
            console.error("[startup] Could not refresh the saved-model list.", error);
        }
    }
});


/* ---- Supplied Grid calculation engine (Steps 1–3, embedded in an existing file) ---- */
/*
 * Grid Structure Analysis — Steps 1–3 only.
 * No CSS, UI, DOM rendering, persistence, diagrams, or event handlers.
 *
 * API:
 *   const result = GridSolver.calculateSteps1To3(model, {
 *     loadCaseId: "LC1",
 *     momentCaseId: "MC1"
 *   });
 *
 * This file intentionally stops after member-property and member-stiffness
 * calculations. It does not calculate global equilibrium, displacements,
 * support reactions, or final member end actions.
 */
(function (global) {
  "use strict";

  const BUILT_IN_SUPPORT_TEMPLATES = [
    {
      id: "FIXED", description: "Fixed Grid Support", type: "fixed", builtIn: true,
      restraints: { RFx: true, RFy: true, RFz: false, RMx: false, RMy: false, RMz: true },
      displacement: { dx: 0, dy: 0, dz: 0, tx: 0, ty: 0, tz: 0 }
    },
    {
      id: "ROLLER", description: "Grid Vertical Support", type: "roller", builtIn: true,
      restraints: { RFx: false, RFy: false, RFz: false, RMx: false, RMy: false, RMz: true },
      displacement: { dx: 0, dy: 0, dz: 0, tx: 0, ty: 0, tz: 0 }
    },
    {
      id: "HINGED", description: "Grid Hinge (RFz only)", type: "hinged", builtIn: true,
      restraints: { RFx: false, RFy: false, RFz: false, RMx: false, RMy: false, RMz: true },
      displacement: { dx: 0, dy: 0, dz: 0, tx: 0, ty: 0, tz: 0 }
    }
  ];

  const EMPTY_MODEL = () => ({
    nodes: [], elementTemplates: [], elements: [], supportTemplates: [],
    supportAssignments: [], loadCases: [], loads: [], momentCases: [], moments: []
  });

  const Matrix = Object.freeze({
    zeros: (rows, cols) => Array.from({ length: rows }, () => new Array(cols).fill(0)),
    mul: (A, B) => {
      if (!A.length || !B.length || !B[0].length) return [];
      if (A[0].length !== B.length) throw new Error("Matrix dimensions do not match for multiplication.");
      return A.map(row => B[0].map((_, col) =>
        row.reduce((sum, value, k) => sum + value * B[k][col], 0)
      ));
    },
    transpose: A => A.length ? A[0].map((_, col) => A.map(row => row[col])) : []
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeModel(input) {
    const source = input && input.model ? input.model : input;
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      throw new TypeError("GridSolver.calculateSteps1To3 expects a model object.");
    }

    const normalized = EMPTY_MODEL();
    for (const key of Object.keys(normalized)) {
      if (source[key] !== undefined) {
        if (!Array.isArray(source[key])) throw new TypeError(`Model field '${key}' must be an array.`);
        normalized[key] = clone(source[key]);
      }
    }

    // Migrate older files whose E and G values were stored in N/m².
    normalized.elementTemplates = normalized.elementTemplates.map(template => {
      const item = { ...template };
      if (!Number.isFinite(Number(item.E_GPa)) && Number.isFinite(Number(item.E))) {
        item.E_GPa = Number(item.E) / 1e9;
        delete item.E;
      }
      if (!Number.isFinite(Number(item.G_GPa)) && Number.isFinite(Number(item.G))) {
        item.G_GPa = Number(item.G) / 1e9;
        delete item.G;
      }
      if (!Number.isFinite(Number(item.J))) item.J = Number(item.I) || 0;
      return item;
    });

    const customTemplates = normalized.supportTemplates.filter(support =>
      !support.builtIn && !["FIXED", "ROLLER", "HINGED"].includes(String(support.id))
    );
    normalized.supportTemplates = [
      ...BUILT_IN_SUPPORT_TEMPLATES.map(clone),
      ...customTemplates.map(support => ({ ...support, type: support.type || "custom", builtIn: false }))
    ];
    return normalized;
  }

  function getElementEInternal(template) {
    if (!template) return 0;
    if (Number.isFinite(Number(template.E_GPa))) return Number(template.E_GPa) * 1e6;
    if (Number.isFinite(Number(template.E))) return Number(template.E) / 1000;
    return 0;
  }

  function getElementGInternal(template) {
    if (!template) return 0;
    if (Number.isFinite(Number(template.G_GPa))) return Number(template.G_GPa) * 1e6;
    if (Number.isFinite(Number(template.G))) return Number(template.G) / 1000;
    return 0;
  }

  function gridElementMatrices(n1, n2, template) {
    if (!n1 || !n2 || !template) return null;
    const dx = Number(n2.x) - Number(n1.x);
    const dy = Number(n2.y) - Number(n1.y);
    const L = Math.hypot(dx, dy);
    if (!(L > 0)) return null;

    const cx = dx / L;
    const cy = dy / L;
    const E = getElementEInternal(template);
    const G = getElementGInternal(template);
    const I = Number(template.I);
    const J = Number(template.J);
    if (!(E > 0 && G > 0 && I > 0 && J > 0)) return null;

    const a = 12 * E * I / Math.pow(L, 3);
    const b = 6 * E * I / Math.pow(L, 2);
    const c = 4 * E * I / L;
    const m = G * J / L;
    const p = m * cx * cx + c * cy * cy;
    const q = (m - c) * cx * cy;
    const ss = m * cy * cy + c * cx * cx;
    const r = b * cy;
    const t = -b * cx;
    const p1 = -m * cx * cx + 0.5 * c * cy * cy;
    const q1 = (-m - 0.5 * c) * cx * cy;
    const r1 = -b * cy;
    const s1 = -m * cy * cy + 0.5 * c * cx * cx;
    const t1 = b * cx;

    const SM = [
      [m, 0, 0, -m, 0, 0],
      [0, c, -b, 0, c / 2, b],
      [0, -b, a, 0, -b, -a],
      [-m, 0, 0, m, 0, 0],
      [0, c / 2, -b, 0, c, b],
      [0, b, -a, 0, b, a]
    ];
    const RT = [
      [cx, cy, 0, 0, 0, 0],
      [-cy, cx, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0],
      [0, 0, 0, cx, cy, 0],
      [0, 0, 0, -cy, cx, 0],
      [0, 0, 0, 0, 0, 1]
    ];
    const RTT = Matrix.transpose(RT);
    const SMS = Matrix.mul(Matrix.mul(RTT, SM), RT);

    return {
      L, cx, cy, E, G, I, J, A: Number(template.A) || 0,
      a, b, c, m, p, q, s: ss, r, t, p1, q1, r1, s1, t1,
      SM, RT, RTT, SMS
    };
  }

  function gridPointLoadVector(P, a, L) {
    const x = Math.max(0, Math.min(Number(a) || 0, L));
    const xi = x / L;
    const N1 = 1 - 3 * xi * xi + 2 * xi * xi * xi;
    const N2 = L * (xi - 2 * xi * xi + xi * xi * xi);
    const N3 = 3 * xi * xi - 2 * xi * xi * xi;
    const N4 = L * (-xi * xi + xi * xi * xi);
    const load = Number(P) || 0;
    return [0, -load * N2, load * N1, 0, -load * N4, load * N3];
  }

  function gridPointTorsionFEM(T, a, L) {
    const x = Math.max(0, Math.min(Number(a) || 0, L));
    const load = Number(T) || 0;
    return [-load * (L - x) / L, 0, 0, -load * x / L, 0, 0];
  }

  function gridPointMomentVector(M, a, L) {
    const x = Math.max(0, Math.min(Number(a) || 0, L));
    const xi = x / L;
    const dN1 = (-6 * xi + 6 * xi * xi) / L;
    const dN2 = 1 - 4 * xi + 3 * xi * xi;
    const dN3 = (6 * xi - 6 * xi * xi) / L;
    const dN4 = -2 * xi + 3 * xi * xi;
    return [0, -M * dN2, M * dN1, 0, -M * dN4, M * dN3];
  }

  function gridUDLLoadVector(q1, q2, a, b, L) {
    const lo = Math.max(0, Math.min(Number(a) || 0, L));
    const hi = Math.max(0, Math.min(Number(b) || 0, L));
    const out = Matrix.zeros(6, 1);
    if (!(hi > lo)) return out;
    const span = hi - lo;
    const gp = [
      [-0.9815606342467191, 0.0471753363865118], [-0.9041172563704749, 0.1069393259953184],
      [-0.7699026741943047, 0.1600783285433464], [-0.5873179542866175, 0.2031674267230659],
      [-0.3678314989981802, 0.2334925365383548], [-0.1252334085114689, 0.2491470458134029],
      [0.1252334085114689, 0.2491470458134029], [0.3678314989981802, 0.2334925365383548],
      [0.5873179542866175, 0.2031674267230659], [0.7699026741943047, 0.1600783285433464],
      [0.9041172563704749, 0.1069393259953184], [0.9815606342467191, 0.0471753363865118]
    ];
    // 12-point Gauss-Legendre integration for a linearly varying UDL.
    for (const [z, w] of gp) {
      const x = lo + 0.5 * (z + 1) * span;
      const wt = 0.5 * span * w;
      const xi = x / L;
      const N1 = 1 - 3 * xi * xi + 2 * xi * xi * xi;
      const N2 = L * (xi - 2 * xi * xi + xi * xi * xi);
      const N3 = 3 * xi * xi - 2 * xi * xi * xi;
      const N4 = L * (-xi * xi + xi * xi * xi);
      const qx = Number(q1) + (Number(q2) - Number(q1)) * ((x - lo) / span);
      const v = [0, -N2 * qx, N1 * qx, 0, -N4 * qx, N3 * qx];
      for (let i = 0; i < 6; i++) out[i][0] += wt * v[i];
    }
    return out;
  }

  function gridLocalMomentComponents(Mx, My, cx, cy) {
    return { Mx: cx * Mx + cy * My, My: -cy * Mx + cx * My };
  }

  function activeCaseId(options, field, list) {
    const requested = options[field];
    return String(requested ?? (list[0] && list[0].id) ?? "");
  }

  function calculateSteps1To3(inputModel, options = {}) {
    options = options || {};
    const model = normalizeModel(inputModel);
    if (!model.nodes.length) throw new Error("The model must contain at least one node.");
    if (!model.elements.length) throw new Error("The model must contain at least one element.");

    const nodeIds = new Set();
    model.nodes.forEach(node => {
      const id = String(node.id ?? "");
      if (!id) throw new Error("Every node must have an ID.");
      if (nodeIds.has(id)) throw new Error(`Duplicate node ID '${id}'.`);
      nodeIds.add(id);
    });

    const activeLoadCaseId = activeCaseId(options, "loadCaseId", model.loadCases);
    const activeMomentCaseId = activeCaseId(options, "momentCaseId", model.momentCases);
    if (model.loads.length && !activeLoadCaseId) throw new Error("Select a load case before calculating member loads.");
    if (model.moments.length && !activeMomentCaseId) throw new Error("Select a moment case before calculating member moments.");
    if (activeLoadCaseId && !model.loadCases.some(item => String(item.id) === activeLoadCaseId)) {
      throw new Error(`Load case '${activeLoadCaseId}' does not exist in the model.`);
    }
    if (activeMomentCaseId && !model.momentCases.some(item => String(item.id) === activeMomentCaseId)) {
      throw new Error(`Moment case '${activeMomentCaseId}' does not exist in the model.`);
    }

    const isActiveLoadCase = load => !!activeLoadCaseId && String(load.loadCaseId || "") === activeLoadCaseId;
    const isActiveMomentCase = moment => !!activeMomentCaseId && String(moment.momentCaseId || "") === activeMomentCaseId;

    // STEP 1 — Degree-of-freedom numbering and restraints.
    const dofMap = {};
    model.nodes.forEach((node, index) => {
      dofMap[node.id] = { x: 3 * index, y: 3 * index + 1, z: 3 * index + 2, num: index };
    });
    const totalDof = model.nodes.length * 3;
    const isRestrained = new Array(totalDof).fill(false);
    const prescribedDisp = new Array(totalDof).fill(0);

    const gridSupportRestraints = assignment => {
      const template = model.supportTemplates.find(support => support.id === assignment.supportId);
      if (!template) return { rx: false, ry: false, rz: false, dx: 0, dy: 0, dz: 0 };
      return {
        rx: !!(template.restraints && template.restraints.RFx),
        ry: !!(template.restraints && template.restraints.RFy),
        rz: !!(template.restraints && template.restraints.RMz),
        dx: Number(template.displacement && template.displacement.tx) || 0,
        dy: Number(template.displacement && template.displacement.ty) || 0,
        dz: Number(template.displacement && template.displacement.dz) || 0
      };
    };

    model.supportAssignments.forEach(assignment => {
      const dof = dofMap[assignment.nodeId];
      if (!dof) return;
      const restraint = gridSupportRestraints(assignment);
      if (restraint.rx) { isRestrained[dof.x] = true; prescribedDisp[dof.x] = restraint.dx; }
      if (restraint.ry) { isRestrained[dof.y] = true; prescribedDisp[dof.y] = restraint.dy; }
      if (restraint.rz) { isRestrained[dof.z] = true; prescribedDisp[dof.z] = restraint.dz; }
    });

    model.elements.forEach(element => {
      const n1 = model.nodes.find(node => node.id === element.startNode);
      const n2 = model.nodes.find(node => node.id === element.endNode);
      const template = model.elementTemplates.find(item => item.id === element.templateId);
      if (!n1 || !n2 || !template) throw new Error(`Element '${element.id}' has an invalid node or template reference.`);
      if (!gridElementMatrices(n1, n2, template)) {
        throw new Error(`Element '${element.id}' requires positive I, J, E and G values and a non-zero XY length.`);
      }
    });

    const step1Nodes = model.nodes.map((node, index) => {
      const dof = dofMap[node.id];
      return {
        nodeId: node.id,
        nodeNumber: index + 1,
        dof: {
          thetaX: { number: dof.x + 1, restrained: isRestrained[dof.x], prescribed: prescribedDisp[dof.x] },
          thetaY: { number: dof.y + 1, restrained: isRestrained[dof.y], prescribed: prescribedDisp[dof.y] },
          deltaZ: { number: dof.z + 1, restrained: isRestrained[dof.z], prescribed: prescribedDisp[dof.z] }
        }
      };
    });
    const step1 = { title: "Grid Joint DoF Numbering", dofMap, numNodes: model.nodes.length, totalDof, nodes: step1Nodes };

    // STEP 2 — Joint coordinates and member geometry/material properties.
    const step2Joints = model.nodes.map((node, index) => {
      const dof = dofMap[node.id];
      return {
        jointNumber: index + 1,
        nodeId: node.id,
        x: Number(node.x) || 0,
        y: Number(node.y) || 0,
        z: Number(node.z) || 0,
        dof: {
          thetaX: dof.x + 1, thetaY: dof.y + 1, deltaZ: dof.z + 1
        },
        restrained: {
          thetaX: isRestrained[dof.x], thetaY: isRestrained[dof.y], deltaZ: isRestrained[dof.z]
        }
      };
    });
    const step2Members = model.elements.map((element, index) => {
      const n1 = model.nodes.find(node => node.id === element.startNode);
      const n2 = model.nodes.find(node => node.id === element.endNode);
      const template = model.elementTemplates.find(item => item.id === element.templateId);
      const p = gridElementMatrices(n1, n2, template);
      return {
        memberNumber: index + 1,
        elementId: element.id,
        templateId: element.templateId,
        startNode: element.startNode,
        endNode: element.endNode,
        I: p.I, J: p.J, E_GPa: p.E / 1e6, G_GPa: p.G / 1e6, A: p.A,
        length: p.L, cx: p.cx, cy: p.cy,
        m: p.m, a: p.a, b: p.b, c: p.c,
        p: p.p, q: p.q, r: p.r, s: p.s, t: p.t,
        p1: p.p1, q1: p.q1, r1: p.r1, s1: p.s1, t1: p.t1
      };
    });
    const step2 = { title: "Joint and Member Properties", joints: step2Joints, members: step2Members };

    // STEP 3 — Local member stiffness matrices, transformed stiffness matrices,
    // and equivalent fixed-end actions for member loads in the selected cases.
    const step3Members = model.elements.map(element => {
      const n1 = model.nodes.find(node => node.id === element.startNode);
      const n2 = model.nodes.find(node => node.id === element.endNode);
      const template = model.elementTemplates.find(item => item.id === element.templateId);
      const p = gridElementMatrices(n1, n2, template);
      const AML = Matrix.zeros(6, 1);
      const localPointLoads = [];
      const localUDLs = [];
      const localPointMoments = [];
      const activeLC = model.loadCases.find(item => String(item.id) === activeLoadCaseId);

      if (Number(template.density) > 0 && activeLC && activeLC.type === "Self Weight") {
        const q = template.selfWeightType === "density"
          ? -(Number(template.density) * p.A * 9.81) / 1000
          : -Number(template.density);
        const fixedEnd = gridUDLLoadVector(q, q, 0, p.L, p.L);
        for (let i = 0; i < 6; i++) AML[i][0] -= fixedEnd[i][0];
      }

      model.loads.forEach(load => {
        if (!isActiveLoadCase(load) || load.elementId !== element.id) return;
        if (load.type === "Element Point Load" || load.type === "Element Load") {
          const a = Math.max(0, Math.min(Number(load.distance) || 0, p.L));
          const force = Number(load.Fz) || 0;
          const fixedEnd = gridPointLoadVector(force, a, p.L);
          for (let i = 0; i < 6; i++) AML[i][0] -= fixedEnd[i];
          localPointLoads.push({ distance: a, Fz: force });
        } else if (load.type === "Element UDL") {
          const a = Math.max(0, Math.min(Number(load.distance) || 0, p.L));
          const rawEnd = load.distanceEnd === "" || load.distanceEnd == null ? p.L : Number(load.distanceEnd);
          const b = Math.max(0, Math.min(rawEnd, p.L));
          if (!(b > a)) return;
          const q1 = Number(load.Fz) || 0;
          const q2 = load.FzEnd !== undefined && load.FzEnd !== "" ? (Number(load.FzEnd) || 0) : q1;
          const fixedEnd = gridUDLLoadVector(q1, q2, a, b, p.L);
          for (let i = 0; i < 6; i++) AML[i][0] -= fixedEnd[i][0];
          localUDLs.push({ startDistance: a, endDistance: b, q1, q2 });
        }
      });

      model.moments.forEach(moment => {
        if (!isActiveMomentCase(moment) || moment.elementId !== element.id || moment.type !== "Element Moment") return;
        const a = Math.max(0, Math.min(Number(moment.distance) || 0, p.L));
        const hasMx = Number.isFinite(Number(moment.Mx));
        const hasMy = Number.isFinite(Number(moment.My));
        const globalMx = hasMx ? Number(moment.Mx) : 0;
        const globalMy = hasMy ? Number(moment.My) : 0;
        const local = gridLocalMomentComponents(globalMx, globalMy, p.cx, p.cy);
        const torsion = (Number(moment.Mz) || 0) + local.Mx;
        const bendingVector = gridPointMomentVector(local.My, a, p.L);
        const torsionVector = gridPointTorsionFEM(torsion, a, p.L);
        for (let i = 0; i < 6; i++) AML[i][0] += bendingVector[i] + torsionVector[i];
        localPointMoments.push({ distance: a, Mx: torsion, My: local.My });
      });

      const AMS = Matrix.mul(p.RTT, AML);
      return {
        elementId: element.id,
        templateId: element.templateId,
        startNode: element.startNode,
        endNode: element.endNode,
        length: p.L,
        directionCosines: { cx: p.cx, cy: p.cy },
        SM: p.SM,
        RT: p.RT,
        RTT: p.RTT,
        SMS: p.SMS,
        AML,
        AMS,
        localPointLoads,
        localUDLs,
        localPointMoments
      };
    });

    return {
      success: true,
      solver: "Grid Structure Analysis — Steps 1–3",
      units: { force: "kN", length: "m", moment: "kN·m", rotation: "rad", translation: "m" },
      activeCases: { loadCaseId: activeLoadCaseId, momentCaseId: activeMomentCaseId },
      dofOrder: ["thetaX", "thetaY", "deltaZ"],
      steps: { step1, step2, step3: { title: "Member Stiffness Matrices and Fixed-End Actions", members: step3Members } }
    };
  }

  global.GridSolver = Object.freeze({
    version: "1.1.0-steps-1-3-only",
    calculateSteps1To3,
    Matrix
  });
})(window);
