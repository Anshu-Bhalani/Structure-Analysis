/* ==========================================================================
 * home.js — Home page module
 * Home page — model library (saved models grid, current-model strip, multi-select export / delete).
 * Contains this page's markup (injected into .container) and its logic.
 * ========================================================================== */

/* ---- Markup ---- */
mountModuleHTML(".container", "beforeend", `
<!-- HOME / MODEL LIBRARY -->
<section class="section active" id="home">
    <div class="home-standalone-head">
        <div class="home-brand">
            <img class="home-brand-logo" src="assets/images/nirma-shield-transparent.webp" alt="Nirma University emblem">
            <div class="home-brand-text">
                <h1>Structure Analysis</h1>
                <p>Structural Analysis Model Manager</p>
                <p class="home-course-label">Advance Structure Mechanics (3CL102ME24)</p>
            </div>
        </div>
        <div class="home-standalone-actions">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('jsonImport').click()">Import Model</button>
            <button type="button" class="btn btn-secondary" onclick="exportAllModels()">Export All Models</button>
            <button type="button" class="btn btn-primary" onclick="newModel()">＋ New Model</button>
        </div>
    </div>

    <h2 class="home-standalone-title">Your Structural Models</h2>
    <p class="home-standalone-subtitle">Create and manage separate structural-analysis projects from one place. Open a model to enter nodes, elements, supports, loads, moments and run the existing analysis workflow.</p>

    <div class="home-hero">
        <div class="home-current-strip" style="border-top:none;">
            <div class="home-current-info">
                <span class="home-current-label">Current Model</span>
                <span id="homeCurrentModelName" class="home-current-name">Structural Model</span>
                <span id="homeCurrentModelType" class="badge badge-blue">Beam / Truss / Frame Model</span>
                <span id="homeCurrentModelStatus" class="badge badge-gray">Not saved</span>
            </div>
            <div class="home-standalone-actions">
                <button type="button" class="btn btn-secondary" onclick="saveModel()">Save Current</button>
                <button type="button" class="btn btn-secondary" onclick="exportModel()">Export Current</button>
                <button type="button" class="btn btn-secondary" onclick="newModel()">Start New Model</button>
            </div>
        </div>
    </div>

    <div class="home-library-head">
        <div>
            <h3>Saved Models</h3>
            <p>Open any saved model to continue working on its structure and analysis.</p>
        </div>
        <span id="homeModelCount" class="home-model-count">0 Models</span>
    </div>

    <div class="model-select-bar" id="modelSelectBar">
        <button type="button" class="btn btn-secondary" id="modelSelectAllBtn" onclick="toggleSelectAllModels()">Select All</button>
        <span class="model-selected-count" id="modelSelectedCount">0 selected</span>
        <div class="model-select-actions">
            <button type="button" class="btn btn-secondary" id="selExportJsonBtn" onclick="exportSelectedModelsJSON()" disabled>Export JSON</button>
            <button type="button" class="btn btn-secondary" id="selExportPdfBtn" onclick="exportSelectedModelsPDF()" disabled>Export PDF</button>
            <button type="button" class="btn btn-secondary model-select-delete" id="selDeleteBtn" onclick="deleteSelectedModels()" disabled>Delete</button>
        </div>
    </div>

    <div id="modelLibraryGrid" class="model-library-grid"></div>
</section>
`);

/* ---- Logic ---- */
function modelPreviewSVG(data) {
    const nodes = Array.isArray(data?.nodes) ? data.nodes : [];
    const elements = Array.isArray(data?.elements) ? data.elements : [];
    const supports = Array.isArray(data?.supportAssignments) ? data.supportAssignments : [];
    const loads = Array.isArray(data?.loads) ? data.loads : [];
    const moments = Array.isArray(data?.moments) ? data.moments : [];
    const isGridModel = data?.analysisMode === "grid";

    if (!nodes.length) {
        return `<svg viewBox="0 0 760 260" preserveAspectRatio="xMidYMid meet" aria-label="No structure defined">
            <rect x="0" y="0" width="760" height="260" fill="#f8fafc"/>
            <text x="380" y="126" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="14" font-weight="700" fill="#64748b">No structure defined yet</text>
            <text x="380" y="148" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="11" fill="#94a3b8">Add nodes and elements to preview the model</text>
        </svg>`;
    }

    const nodeById = Object.create(null);
    nodes.forEach(n => { nodeById[String(n.id)] = n; });

    const xs = nodes.map(n => Number(n.x) || 0);
    const ys = nodes.map(n => Number(n.y) || 0);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);
    const padX = Math.max(spanX * 0.14, 1);
    const padY = Math.max(spanY * 0.18, 1);
    const left = minX - padX, right = maxX + padX;
    const bottom = minY - padY, top = maxY + padY;
    const W = 760, H = 260;
    const sx = x => 55 + ((x - left) / Math.max(right - left, 1)) * 650;
    const sy = y => 210 - ((y - bottom) / Math.max(top - bottom, 1)) * 170;

    const templateById = Object.create(null);
    (Array.isArray(data.elementTemplates) ? data.elementTemplates : []).forEach(t => {
        templateById[String(t.id)] = t;
    });

    const elementLines = elements.map((el) => {
        const n1 = nodeById[String(el.startNode)], n2 = nodeById[String(el.endNode)];
        if (!n1 || !n2) return "";
        const x1=sx(Number(n1.x)||0), y1=sy(Number(n1.y)||0), x2=sx(Number(n2.x)||0), y2=sy(Number(n2.y)||0);
        const t = templateById[String(el.templateId)] || {};
        const A = Number(t.A) || 0, I = Number(t.I) || 0;
        const width = A === 0 ? 2 : I === 0 ? 1.8 : 2.7;
        return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="#334155" stroke-width="${width}" stroke-linecap="round"/>`;
    }).join("");

    const supportIds = new Set(supports.map(s => String(s.nodeId)));
    const supportMarks = nodes.filter(n => supportIds.has(String(n.id))).map(n => {
        const x=sx(Number(n.x)||0), y=sy(Number(n.y)||0);
        return `<polygon points="${(x-9).toFixed(1)},${(y+14).toFixed(1)} ${(x+9).toFixed(1)},${(y+14).toFixed(1)} ${x.toFixed(1)},${(y+2).toFixed(1)}" fill="#94a3b8" opacity="0.9"/>`;
    }).join("");

    const getElementPoint = (element, distance) => {
        if (!element) return null;
        const a = nodeById[String(element.startNode)], b = nodeById[String(element.endNode)];
        if (!a || !b) return null;
        const x1 = Number(a.x) || 0, y1 = Number(a.y) || 0;
        const x2 = Number(b.x) || 0, y2 = Number(b.y) || 0;
        const L = Math.hypot(x2 - x1, y2 - y1);
        if (!(L > 0)) return null;
        const t = Math.max(0, Math.min(1, (Number(distance) || 0) / L));
        return { x: sx(x1 + (x2 - x1) * t), y: sy(y1 + (y2 - y1) * t), cx: (x2 - x1) / L, cy: (y2 - y1) / L, length: L };
    };
    const forceVector = (load, element, end = false) => {
        let fx = Number(end ? (load.FxEnd ?? load.Fx) : load.Fx) || 0;
        let fy = Number(end ? (load.FyEnd ?? load.Fy) : load.Fy) || 0;
        const axis = load.axisSystem || "Global";
        if (axis === "Local" && element) {
            const p = getElementPoint(element, 0);
            if (p) return { x: fx * p.cx - fy * p.cy, y: fx * p.cy + fy * p.cx };
        }
        if (axis === "Angled") {
            const angle = (Number(load.angle) || 0) * Math.PI / 180;
            [fx, fy] = [fx * Math.cos(angle) - fy * Math.sin(angle), fx * Math.sin(angle) + fy * Math.cos(angle)];
        }
        return { x: fx, y: fy };
    };
    const drawForceArrow = (x, y, fx, fy, color = "#dc2626") => {
        const magnitude = Math.hypot(fx, fy);
        if (!(magnitude > 1e-12)) return "";
        const ux = fx / magnitude, uy = -fy / magnitude;
        const tailX = x - ux * 23, tailY = y - uy * 23;
        const tipX = x - ux * 5, tipY = y - uy * 5;
        const px = -uy, py = ux;
        return `<g><line x1="${tailX.toFixed(1)}" y1="${tailY.toFixed(1)}" x2="${tipX.toFixed(1)}" y2="${tipY.toFixed(1)}" stroke="${color}" stroke-width="1.8"/><polygon points="${tipX.toFixed(1)},${tipY.toFixed(1)} ${(tipX-ux*5+px*3).toFixed(1)},${(tipY-uy*5+py*3).toFixed(1)} ${(tipX-ux*5-px*3).toFixed(1)},${(tipY-uy*5-py*3).toFixed(1)}" fill="${color}"/></g>`;
    };
    const drawGridLoad = (x, y, fz) => {
        if (Math.abs(fz) <= 1e-12) return "";
        const r = Math.min(7.5, 4 + Math.sqrt(Math.abs(fz)) * 0.18);
        const color = fz < 0 ? "#dc2626" : "#16a34a";
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${fz < 0 ? color : "#ffffff"}" stroke="${color}" stroke-width="2"/>`;
    };
    const loadMarks = loads.map((load) => {
        if (!load) return "";
        const element = elements.find((el) => String(el.id) === String(load.elementId));
        if (load.type === "Nodal Load") {
            const node = nodeById[String(load.nodeId)];
            if (!node) return "";
            const x = sx(Number(node.x) || 0), y = sy(Number(node.y) || 0);
            return isGridModel ? drawGridLoad(x, y, Number(load.Fz) || 0) : (() => { const f = forceVector(load, null); return drawForceArrow(x, y, f.x, f.y); })();
        }
        if (!element) return "";
        const start = Math.max(0, Number(load.distance) || 0);
        const end = load.type === "Element UDL" ? Math.max(start, Number(load.distanceEnd) || getElementPoint(element, 0)?.length || start) : start;
        const positions = load.type === "Element UDL" ? [0.2, 0.5, 0.8].map(frac => start + (end - start) * frac) : [start];
        return positions.map((distance) => {
            const point = getElementPoint(element, distance);
            if (!point) return "";
            if (isGridModel) {
                const q1 = Number(load.Fz) || 0, q2 = Number(load.FzEnd ?? load.Fz) || 0;
                const t = end > start ? (distance - start) / (end - start) : 0;
                return drawGridLoad(point.x, point.y, q1 + (q2 - q1) * t);
            }
            const f1 = forceVector(load, element), f2 = forceVector(load, element, true);
            const t = end > start ? (distance - start) / (end - start) : 0;
            return drawForceArrow(point.x, point.y, f1.x + (f2.x - f1.x) * t, f1.y + (f2.y - f1.y) * t);
        }).join("");
    }).join("");

    const momentMarks = moments.map((moment) => {
        if (!moment) return "";
        const nodal = moment.type === "Nodal Moment";
        const node = nodal ? nodeById[String(moment.nodeId)] : null;
        const element = nodal ? null : elements.find((el) => String(el.id) === String(moment.elementId));
        const point = node
            ? { x: sx(Number(node.x) || 0), y: sy(Number(node.y) || 0) }
            : getElementPoint(element, moment.distance);
        if (!point) return "";
        if (isGridModel) {
            const mx = Number(moment.Mx) || 0, my = Number(moment.My) || 0;
            const labels = [];
            if (Math.abs(mx) > 1e-12) labels.push(mx > 0 ? "→" : "←");
            if (Math.abs(my) > 1e-12) labels.push(my > 0 ? "↑" : "↓");
            return labels.length ? `<text x="${(point.x+9).toFixed(1)}" y="${(point.y-11).toFixed(1)}" font-size="13" font-weight="800" fill="#7c3aed">${labels.join("")}</text>` : "";
        }
        const mz = Number(moment.Mz) || 0;
        if (Math.abs(mz) <= 1e-12) return "";
        return `<text x="${(point.x+8).toFixed(1)}" y="${(point.y-9).toFixed(1)}" font-size="15" font-weight="800" fill="#7c3aed">${mz > 0 ? "↺" : "↻"}</text>`;
    }).join("");

    const nodeMarks = nodes.map(n => {
        const x=sx(Number(n.x)||0), y=sy(Number(n.y)||0);
        return `<g><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="#2563eb" stroke="#ffffff" stroke-width="2"/><text x="${(x+8).toFixed(1)}" y="${(y-8).toFixed(1)}" font-family="Inter,Arial,sans-serif" font-size="9" font-weight="700" fill="#475569">${escapeHtml(String(n.id))}</text></g>`;
    }).join("");

    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" aria-label="Structural model preview">
        <rect x="0" y="0" width="${W}" height="${H}" fill="#f8fafc"/>
        <line x1="48" y1="224" x2="712" y2="224" stroke="#e2e8f0" stroke-width="1"/>
        ${elementLines}
        ${supportMarks}
        ${loadMarks}
        ${momentMarks}
        ${nodeMarks}
    </svg>`;
}

// Home-screen multi-select state (ids of the selected saved models).
const selectedModelIds = new Set();

function renderModelLibrary() {
    const grid = document.getElementById("modelLibraryGrid");
    const currentNameEl = document.getElementById("homeCurrentModelName");
    const currentStatusEl = document.getElementById("homeCurrentModelStatus");
    const currentTypeEl = document.getElementById("homeCurrentModelType");
    const countEl = document.getElementById("homeModelCount");
    if (!grid) return;

    const currentName = getModelName();
    if (currentNameEl) currentNameEl.textContent = currentName;
    if (currentTypeEl) {
        const gridMode = model.analysisMode === "grid";
        currentTypeEl.textContent = gridMode ? "Grid Model" : "Beam / Truss / Frame Model";
        currentTypeEl.className = `badge ${gridMode ? "badge-green" : "badge-blue"}`;
    }

    const library = getModelLibrary();
    if (lastModelLibraryReadFailed) {
        if (currentStatusEl) {
            currentStatusEl.textContent = "Library unavailable";
            currentStatusEl.className = "badge badge-red";
        }
        if (countEl) countEl.textContent = "Unavailable";
        grid.innerHTML = `<div class="home-empty" style="grid-column:1 / -1;">
            <div class="home-empty-icon">⚠</div>
            <h4>Saved-model library could not be read</h4>
            <p>The stored library has not been overwritten. Export the current workspace as JSON and keep a backup before attempting browser-storage recovery.</p>
        </div>`;
        updateModelSelectionToolbar();
        return;
    }
    const activeSavedModel = currentModelLibraryId ? library[currentModelLibraryId] : null;
    const liveCurrentData = getPersistedInputModel();
    const currentModelHasUnsavedChanges = !!activeSavedModel && (
        getModelName() !== String(activeSavedModel.name || "Structural Model") ||
        modelDataFingerprint(liveCurrentData) !== modelDataFingerprint(activeSavedModel.data)
    );
    const models = Object.values(library).sort((a, b) => {
        const at = new Date(a.updatedAt || 0).getTime();
        const bt = new Date(b.updatedAt || 0).getTime();
        return bt - at;
    });
    Array.from(selectedModelIds).forEach((id) => { if (!library[id]) selectedModelIds.delete(id); });

    if (countEl) countEl.textContent = `${models.length} ${models.length === 1 ? "Model" : "Models"}`;

    if (currentStatusEl) {
        if (activeSavedModel) {
            currentStatusEl.textContent = currentModelHasUnsavedChanges ? "Unsaved changes" : "Saved";
            currentStatusEl.className = currentModelHasUnsavedChanges ? "badge badge-orange" : "badge badge-green";
        } else {
            currentStatusEl.textContent = "Not saved";
            currentStatusEl.className = "badge badge-gray";
        }
    }

    if (!models.length) {
        grid.innerHTML = `<div class="home-empty" style="grid-column:1 / -1;">
            <div class="home-empty-icon">⌂</div>
            <h4>No saved models yet</h4>
            <p>Create your first structural model, give it a name, and use <b>Save Model</b>. It will appear here with a visual preview of the structure.</p>
            <button type="button" class="btn btn-primary" onclick="newModel()">＋ Create First Model</button>
        </div>`;
        updateModelSelectionToolbar();
        return;
    }

    grid.innerHTML = models.map((item) => {
        const savedData = item.data || {};
        const isCurrent = item.id === currentModelLibraryId;
        const data = isCurrent ? liveCurrentData : savedData;
        const displayName = isCurrent ? currentName : (item.name || "Structural Model");
        const nodes = Array.isArray(data.nodes) ? data.nodes.length : 0;
        const elements = Array.isArray(data.elements) ? data.elements.length : 0;
        const loads = Array.isArray(data.loads) ? data.loads.length : 0;
        const moments = Array.isArray(data.moments) ? data.moments.length : 0;
        const isGridModel = data.analysisMode === "grid";
        const modelTypeLabel = isGridModel ? "Grid Model" : "Beam / Truss / Frame Model";
        const modelTypeClass = isGridModel ? "badge-green" : "badge-blue";
        const safeId = encodeInlineArgument(String(item.id || ""));
        const isSelected = selectedModelIds.has(item.id);
        return `<article class="model-card${isCurrent ? " current" : ""}${isSelected ? " selected" : ""}">
            <div class="model-card-preview">
                <label class="model-select-box" title="Select this model"><input type="checkbox" aria-label="Select model ${escapeHtml(displayName)}" ${isSelected ? "checked" : ""} onchange="toggleModelSelection('${safeId}', this.checked)"></label>
                <span class="home-preview-label">Structure Preview</span>
                ${modelPreviewSVG(data)}
            </div>
            <div class="model-card-body">
                <div class="model-card-title-row">
                    <div class="model-card-name">${escapeHtml(displayName)}</div>
                    <div class="model-card-badges">
                        <span class="badge ${modelTypeClass}">${modelTypeLabel}</span>
                        ${isCurrent ? '<span class="badge badge-gray">Current</span>' : ''}
                    </div>
                </div>
                <div class="model-card-meta">
                    <div class="model-card-stat"><div class="model-card-stat-label">Nodes</div><div class="model-card-stat-value">${nodes}</div></div>
                    <div class="model-card-stat"><div class="model-card-stat-label">Elements</div><div class="model-card-stat-value">${elements}</div></div>
                    <div class="model-card-stat"><div class="model-card-stat-label">Loads</div><div class="model-card-stat-value">${loads}</div></div>
                    <div class="model-card-stat"><div class="model-card-stat-label">${isGridModel ? "Torsions" : "Moments"}</div><div class="model-card-stat-value">${moments}</div></div>
                </div>
                <div class="model-card-foot">
                    <span class="model-card-saved">${isCurrent && currentModelHasUnsavedChanges ? "Unsaved changes" : `Saved ${escapeHtml(formatModelSavedTime(item.updatedAt))}`}</span>
                    <div class="model-card-actions">
                        <button type="button" class="icon-btn" onclick="openSavedModelFromInline('${safeId}')">Open</button>
                        <button type="button" class="icon-btn" onclick="exportSavedModelFromInline('${safeId}')">Export</button>
                        <button type="button" class="icon-btn" onclick="deleteSavedModelFromInline('${safeId}')">Delete</button>
                    </div>
                </div>
            </div>
        </article>`;
    }).join("");
    updateModelSelectionToolbar();
}

// ==========================================================================
// 16c. HOME SCREEN: MULTI-SELECT (export JSON / export PDF / delete)
// ==========================================================================
function getSortedLibraryModels() {
    return Object.values(getModelLibrary()).sort((a, b) => {
        const at = new Date(a.updatedAt || 0).getTime();
        const bt = new Date(b.updatedAt || 0).getTime();
        return bt - at;
    });
}

function toggleModelSelection(encodedId, checked) {
    let id;
    try {
        id = decodeURIComponent(encodedId);
    } catch (error) {
        console.error("Invalid encoded model ID in selection control.", error);
        return;
    }
    if (checked) selectedModelIds.add(id);
    else selectedModelIds.delete(id);
    const card = Array.from(document.querySelectorAll("#modelLibraryGrid .model-card input[type=checkbox]"))
        .find((cb) => (cb.getAttribute("onchange") || "").includes(`'${encodedId}'`));
    if (card) card.closest(".model-card").classList.toggle("selected", !!checked);
    updateModelSelectionToolbar();
}

function decodeSavedModelId(encodedId) {
    try {
        return decodeURIComponent(encodedId);
    } catch (error) {
        console.error("Invalid encoded saved-model ID.", error);
        return null;
    }
}

function openSavedModelFromInline(encodedId) {
    const id = decodeSavedModelId(encodedId);
    if (id !== null) openSavedModel(id);
}

function exportSavedModelFromInline(encodedId) {
    const id = decodeSavedModelId(encodedId);
    if (id !== null) exportSavedModel(id);
}

function deleteSavedModelFromInline(encodedId) {
    const id = decodeSavedModelId(encodedId);
    if (id !== null) deleteSavedModel(id);
}

function toggleSelectAllModels() {
    const models = getSortedLibraryModels();
    const allSelected = models.length > 0 && models.every((m) => selectedModelIds.has(m.id));
    selectedModelIds.clear();
    if (!allSelected) models.forEach((m) => selectedModelIds.add(m.id));
    renderModelLibrary();
}

function updateModelSelectionToolbar() {
    const total = Object.keys(getModelLibrary()).length;
    const n = selectedModelIds.size;
    const countEl = document.getElementById("modelSelectedCount");
    const allBtn = document.getElementById("modelSelectAllBtn");
    if (countEl) countEl.textContent = `${n} selected`;
    if (allBtn) {
        allBtn.textContent = total > 0 && n === total ? "Deselect All" : "Select All";
        allBtn.disabled = total === 0;
        allBtn.style.opacity = total === 0 ? "0.45" : "";
    }
    ["selExportJsonBtn", "selExportPdfBtn", "selDeleteBtn"].forEach((id) => {
        const b = document.getElementById(id);
        if (b) b.disabled = n === 0 || (pdfExportBusy && id !== "selExportJsonBtn");
    });
}

// Selected models in display order. The model that is open right now is taken
// from memory so unsaved edits are included (same rule as "Export All").
function getSelectedModelSnapshots() {
    return getSortedLibraryModels()
        .filter((m) => selectedModelIds.has(m.id))
        .map((m) => {
            if (m.id === currentModelLibraryId && hasModelInputData()) {
                return { id: m.id, name: getModelName(), data: getPersistedInputModel(), updatedAt: m.updatedAt };
            }
            return { id: m.id, name: m.name || "Structural Model", data: m.data || {}, updatedAt: m.updatedAt };
        });
}

function exportSelectedModelsJSON() {
    const items = getSelectedModelSnapshots();
    if (lastModelLibraryReadFailed) {
        alert(getModelLibraryReadFailureMessage());
        return;
    }
    if (!items.length) {
        alert("Select at least one model first.");
        return;
    }
    if (items.length === 1) {
        downloadJSONFile(`${sanitizeFileName(items[0].name)}.json`, items[0].data);
        return;
    }
    const bundle = {
        type: "StructuralAnalysisModelCollection",
        version: 1,
        exportedAt: new Date().toISOString(),
        models: items.map((item) => ({
            id: item.id,
            name: item.name,
            updatedAt: item.updatedAt || null,
            data: item.data,
        })),
    };
    downloadJSONFile(`Selected_Models (${items.length}).json`, bundle);
}

function deleteSelectedModels() {
    const library = getModelLibrary();
    if (lastModelLibraryReadFailed) {
        alert(getModelLibraryReadFailureMessage());
        return;
    }
    const ids = Array.from(selectedModelIds).filter((id) => library[id]);
    if (!ids.length) {
        alert("Select at least one model first.");
        return;
    }
    const names = ids.map((id) => `• ${library[id].name}`).slice(0, 12).join("\n");
    const more = ids.length > 12 ? `\n…and ${ids.length - 12} more` : "";
    if (!confirm(`Delete ${ids.length} selected model(s)? This cannot be undone.\n\n${names}${more}`)) return;

    const deletedCurrentModel = ids.includes(currentModelLibraryId);
    ids.forEach((id) => { delete library[id]; });
    const remainingLibrary = setModelLibrary(library);
    if (!lastModelLibraryWriteSucceeded) {
        alert("The selected models were not deleted because browser storage rejected the library update. No deletion is confirmed.");
        return;
    }
    selectedModelIds.clear();

    if (deletedCurrentModel || Object.keys(remainingLibrary).length === 0) {
        // Deleting every saved model must also remove the active unsaved
        // working copy and its localStorage snapshot.
        resetActiveModelAfterSavedModelDeletion();
    }
    renderModelLibrary();
}

// Choose a batch-PDF analysis case only when the saved model makes that
// choice unambiguous. Never silently export a different load case or omit an
// available self-weight case just because its case has no explicit load rows.
function chooseUnambiguousBatchCases(modelData) {
    try {
        modelData = normalizeLegacySelfWeightModel(modelData);
    } catch (error) {
        return { ok: false, message: error.message || "Legacy self-weight data could not be converted safely. Review the model before batch export." };
    }
    const loadCases = Array.isArray(modelData?.loadCases) ? modelData.loadCases : [];
    const loads = Array.isArray(modelData?.loads) ? modelData.loads : [];
    const elements = Array.isArray(modelData?.elements) ? modelData.elements : [];
    const momentCases = Array.isArray(modelData?.momentCases) ? modelData.momentCases : [];
    const moments = Array.isArray(modelData?.moments) ? modelData.moments : [];
    const selfWeightCases = loadCases.filter((loadCase) => loadCase?.type === "Self Weight");
    const elementIds = new Set(elements.map((element) => String(element?.id ?? "")));
    const hasSelfWeightData = selfWeightCases.some((loadCase) =>
        Object.entries(loadCase?.memberSelfWeights || {}).some(([elementId, weight]) => elementIds.has(String(elementId)) && Number(weight) > 0)
    );
    const incompleteSelfWeightCase = selfWeightCases.find((loadCase) =>
        getMissingBatchSelfWeightElement(loadCase, elements)
    );
    if (incompleteSelfWeightCase) {
        const missingElement = getMissingBatchSelfWeightElement(incompleteSelfWeightCase, elements);
        return { ok: false, message: `Self Weight case "${incompleteSelfWeightCase.id}" has no valid weight for element "${missingElement.id}". Edit the case and enter a weight in kN/m (enter 0 only if zero is intentional).` };
    }
    if (hasSelfWeightData && selfWeightCases.length !== 1) {
        return { ok: false, message: "Batch PDF export cannot safely choose the self-weight analysis: this model needs exactly one Self Weight case. Open the model and export its Results after choosing the intended case." };
    }

    const loadCaseIdsWithLoads = [...new Set(loads.map((load) => String(load?.loadCaseId ?? "")).filter(Boolean))];
    const candidateLoadCaseIds = new Set(loadCaseIdsWithLoads);
    if (hasSelfWeightData && selfWeightCases.length === 1) candidateLoadCaseIds.add(String(selfWeightCases[0].id));
    if (candidateLoadCaseIds.size > 1) {
        return { ok: false, message: "Batch PDF export cannot safely guess between multiple load cases. Open the model and export its Results after selecting the intended case." };
    }

    const momentCaseIdsWithMoments = [...new Set(moments.map((moment) => String(moment?.momentCaseId ?? "")).filter(Boolean))];
    if (momentCaseIdsWithMoments.length > 1) {
        return { ok: false, message: "Batch PDF export cannot safely guess between multiple moment/torsion cases. Open the model and export its Results after selecting the intended case." };
    }
    return {
        ok: true,
        loadCaseId: hasSelfWeightData ? String(selfWeightCases[0].id) : (loadCaseIdsWithLoads[0] || ""),
        momentCaseId: momentCaseIdsWithMoments[0] || "",
    };
}

function getMissingBatchSelfWeightElement(loadCase, elements) {
    const weights = loadCase?.memberSelfWeights && typeof loadCase.memberSelfWeights === "object"
        ? loadCase.memberSelfWeights : {};
    return elements.find((element) => {
        const id = String(element?.id ?? "");
        if (!Object.prototype.hasOwnProperty.call(weights, id)) return true;
        const weight = weights[id];
        return weight === undefined || weight === null || weight === "" ||
            !Number.isFinite(Number(weight)) || Number(weight) < 0;
    }) || null;
}

// A Home-screen batch export has no active case selector. For plane models,
// retain the established safety rule and refuse to guess between multiple
// cases. Grid models can export every defined, applicable load-case / torsion-
// case combination instead of failing just because the model has alternatives.
function chooseBatchCaseCombinations(modelData) {
    if (modelData?.analysisMode !== "grid") {
        const choice = chooseUnambiguousBatchCases(modelData);
        return choice.ok ? { ok: true, choices: [choice] } : choice;
    }

    let normalized;
    try {
        normalized = normalizeLegacySelfWeightModel(modelData);
    } catch (error) {
        return { ok: false, message: error.message || "Legacy self-weight data could not be converted safely. Review the model before batch export." };
    }

    const loadCases = Array.isArray(normalized?.loadCases) ? normalized.loadCases : [];
    const loads = Array.isArray(normalized?.loads) ? normalized.loads : [];
    const elements = Array.isArray(normalized?.elements) ? normalized.elements : [];
    const moments = Array.isArray(normalized?.moments) ? normalized.moments : [];
    const elementIds = new Set(elements.map((element) => String(element?.id ?? "")));

    // Every case containing explicit loads is a candidate. A Self Weight case
    // is also included when it has a positive weight for an existing element,
    // even if it has no explicit load rows. Set semantics avoid duplicate case
    // reports when a Self Weight case contains both types of input.
    const loadCaseIds = new Set(
        loads.map((load) => String(load?.loadCaseId ?? "")).filter(Boolean)
    );
    for (const loadCase of loadCases.filter((item) => item?.type === "Self Weight")) {
        const hasApplicableWeight = Object.entries(loadCase?.memberSelfWeights || {}).some(
            ([elementId, weight]) => elementIds.has(String(elementId)) && Number(weight) > 0
        );
        const missingElement = getMissingBatchSelfWeightElement(loadCase, elements);
        if (missingElement) {
            return { ok: false, message: `Self Weight case "${loadCase.id}" has no valid weight for element "${missingElement.id}". Edit the case and enter a weight in kN/m (enter 0 only if zero is intentional).` };
        }
        if (hasApplicableWeight && loadCase.id !== undefined && loadCase.id !== null && String(loadCase.id)) {
            loadCaseIds.add(String(loadCase.id));
        }
    }

    const momentCaseIds = new Set(
        moments.map((moment) => String(moment?.momentCaseId ?? "")).filter(Boolean)
    );
    // Empty models retain the same default-case behavior as opening a model
    // and running its analysis from the Results page.
    if (!loadCaseIds.size) loadCaseIds.add("");
    if (!momentCaseIds.size) momentCaseIds.add("");

    const choices = [...loadCaseIds].flatMap((loadCaseId) =>
        [...momentCaseIds].map((momentCaseId) => ({
            ok: true,
            loadCaseId,
            momentCaseId,
        }))
    );
    return { ok: true, choices };
}

// runAnalysisCore uses a mode-specific success message. Recognize both the
// plane and Grid forms so a successful Grid solve is not misclassified as an
// error by the silent Home-screen exporter.
function isBatchAnalysisSuccessMessage(message) {
    return /^(?:Grid )?analysis completed successfully\b/i.test(String(message || ""));
}

// Loads a model's input data into the working model and solves it without any
// dialogs. Returns { ok, message, sections, caseLabel }.
function solveModelSilently(data, caseChoiceOverride = null) {
    const captured = [];
    const origAlert = window.alert;
    const origConfirm = window.confirm;
    window.alert = (m) => { captured.push(String(m)); };
    window.confirm = () => true;
    try {
        applyPersistedInputModel(JSON.parse(JSON.stringify(data || {})));
        migrateUnitSystem();
        ensureBuiltInSupportTemplates();

        const caseChoice = caseChoiceOverride || chooseUnambiguousBatchCases(model);
        if (!caseChoice.ok) return { ok: false, message: caseChoice.message };
        activeLoadCaseId = caseChoice.loadCaseId;
        activeMomentCaseId = caseChoice.momentCaseId;
        syncActiveAnalysisCaseSelectors();

        analysisState.status = "not-run";
        runAnalysisCore();

        const problems = captured.filter((m) => !isBatchAnalysisSuccessMessage(m));
        if (analysisState.status !== "valid" || problems.length) {
            return { ok: false, message: problems.join(" ") || "The analysis did not complete." };
        }
        const caseLabel = getActiveAnalysisCaseLabel();
        return { ok: true, sections: pdfCollectReportSections(), caseLabel };
    } catch (err) {
        console.error(err);
        return { ok: false, message: err && err.message ? err.message : "Unexpected error while solving the model." };
    } finally {
        window.alert = origAlert;
        window.confirm = origConfirm;
    }
}

async function exportSelectedModelsPDF() {
    if (pdfExportBusy) return;
    const items = getSelectedModelSnapshots();
    if (lastModelLibraryReadFailed) {
        alert(getModelLibraryReadFailureMessage());
        return;
    }
    if (!items.length) {
        alert("Select at least one model first.");
        return;
    }
    if (!pdfEngineReady()) {
        alert("The PDF engine could not be loaded. Please reload the page and try again.");
        return;
    }

    pdfExportBusy = true;
    updateModelSelectionToolbar();
    let frame = null;
    const solved = [];
    const failed = [];
    let hasExpandedCaseReports = false;

    // Keep the user's current work so it can be put back afterwards.
    const snap = {
        data: JSON.parse(JSON.stringify(getPersistedInputModel())),
        loadCase: activeLoadCaseId,
        momentCase: activeMomentCaseId,
        status: analysisState.status,
    };

    try {
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const casePlan = chooseBatchCaseCombinations(item.data);
            if (!casePlan.ok) {
                failed.push({ name: item.name, message: casePlan.message });
                continue;
            }
            if (item.data?.analysisMode === "grid" && casePlan.choices.length > 1) {
                hasExpandedCaseReports = true;
            }

            for (let j = 0; j < casePlan.choices.length; j++) {
                const caseChoice = casePlan.choices[j];
                const caseDescription = `Load Case ${caseChoice.loadCaseId || "None"} / Torsion Case ${caseChoice.momentCaseId || "None"}`;
                const caseProgress = casePlan.choices.length > 1 ? ` — ${caseDescription}` : "";
                await pdfShowProgress(`Solving model ${i + 1} of ${items.length}: ${item.name}${caseProgress}…`);
                const r = solveModelSilently(item.data, caseChoice);
                if (r.ok) {
                    solved.push({
                        modelKey: item.id || item.name,
                        name: item.name,
                        sections: r.sections,
                        caseLabel: r.caseLabel,
                    });
                } else {
                    failed.push({
                        name: item.name,
                        message: casePlan.choices.length > 1 ? `${caseDescription}: ${r.message}` : r.message,
                    });
                }
            }
        }
    } finally {
        // Restore the model that was open before the batch started.
        const origAlert = window.alert;
        const origConfirm = window.confirm;
        window.alert = () => {};
        window.confirm = () => true;
        try {
            applyPersistedInputModel(JSON.parse(JSON.stringify(snap.data)));
            migrateUnitSystem();
            ensureBuiltInSupportTemplates();
            activeLoadCaseId = snap.loadCase;
            activeMomentCaseId = snap.momentCase;
            refreshAll();
            if (snap.status === "valid") {
                runAnalysisCore();
            } else {
                analysisState.status = snap.status;
                const rc = document.getElementById("resultsContent");
                if (rc) rc.style.display = "none";
                updateAnalysisStatusUI();
            }
        } catch (err) {
            console.error(err);
        } finally {
            window.alert = origAlert;
            window.confirm = origConfirm;
        }
    }

    if (failed.length) {
        const list = failed.map((f) => `• ${f.name}: ${f.message}`).join("\n");
        if (!solved.length) {
            pdfHideProgress();
            pdfExportBusy = false;
            updateModelSelectionToolbar();
            alert(`No PDF was created. These models could not be solved:\n\n${list}`);
            return;
        }
        pdfHideProgress();
        const goOn = confirm(
            `These models could not be solved:\n\n${list}\n\nExport the PDF for the ${solved.length} model(s) that solved successfully?`,
        );
        if (!goOn) {
            pdfExportBusy = false;
            updateModelSelectionToolbar();
            return;
        }
    }

    try {
        await pdfShowProgress("Preparing report…");
        frame = pdfCreateFrame();
        await frame.stylesReady;
        const doc = frame.contentDocument;
        const win = frame.contentWindow;
        const root = doc.getElementById("pdfRoot");
        if (doc.fonts && doc.fonts.ready) await doc.fonts.ready;

        const jpegPages = [];
        const dateText = new Date().toLocaleDateString();
        for (let k = 0; k < solved.length; k++) {
            const multi = solved.length > 1;
            const reportPrefix = multi
                ? (hasExpandedCaseReports ? `Report ${k + 1} of ${solved.length}` : `Model ${k + 1} of ${solved.length}`)
                : "";
            const meta = {
                modelName: solved[k].name,
                caseLabel: solved[k].caseLabel,
                dateText,
                sectionPrefix: multi ? `${reportPrefix} · ` : "",
                progressPrefix: multi ? `${reportPrefix} — ` : "",
            };
            await pdfRenderSectionsToPages({ frame, doc, win, root }, solved[k].sections, meta, jpegPages);
        }

        await pdfShowProgress("Creating PDF file…");
        const title = solved.length === 1
            ? `${solved[0].name} - Analysis Report`
            : (hasExpandedCaseReports
                ? `Analysis Reports (${solved.length}) - Analysis Report`
                : `Selected Models (${solved.length}) - Analysis Report`);
        const blob = pdfBuildFile(jpegPages, title);
        pdfDownloadBlob(blob, `${sanitizeFileName(title)}.pdf`);
    } catch (err) {
        console.error(err);
        alert("PDF export failed. Check the browser console for details.");
    } finally {
        if (frame) frame.remove();
        pdfHideProgress();
        pdfExportBusy = false;
        updateModelSelectionToolbar();
    }
}
