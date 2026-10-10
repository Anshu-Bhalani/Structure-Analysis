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
            <div class="home-brand-mark">⌂</div>
            <div class="home-brand-text">
                <h1>Structure Analysis</h1>
                <p>Structural Analysis Model Manager</p>
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

    if (!nodes.length) {
        return `<svg viewBox="0 0 760 260" preserveAspectRatio="xMidYMid meet" aria-label="No structure defined">
            <rect x="0" y="0" width="760" height="260" fill="#f8fafc"/>
            <text x="380" y="126" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="14" font-weight="700" fill="#64748b">No structure defined yet</text>
            <text x="380" y="148" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="11" fill="#94a3b8">Add nodes and elements to preview the model</text>
        </svg>`;
    }

    const nodeById = {};
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

    const templateById = {};
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

    const loadNodes = new Set(loads.filter(ld => ld && ld.type === "Nodal Load").map(ld => String(ld.nodeId)));
    const loadMarks = nodes.filter(n => loadNodes.has(String(n.id))).map(n => {
        const x=sx(Number(n.x)||0), y=sy(Number(n.y)||0);
        return `<g><line x1="${x.toFixed(1)}" y1="${(y-27).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y-6).toFixed(1)}" stroke="#dc2626" stroke-width="2"/><polygon points="${(x-5).toFixed(1)},${(y-9).toFixed(1)} ${(x+5).toFixed(1)},${(y-9).toFixed(1)} ${x.toFixed(1)},${(y-2).toFixed(1)}" fill="#dc2626"/></g>`;
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
    const models = Object.values(library).sort((a, b) => {
        const at = new Date(a.updatedAt || 0).getTime();
        const bt = new Date(b.updatedAt || 0).getTime();
        return bt - at;
    });
    Array.from(selectedModelIds).forEach((id) => { if (!library[id]) selectedModelIds.delete(id); });

    if (countEl) countEl.textContent = `${models.length} ${models.length === 1 ? "Model" : "Models"}`;

    if (currentStatusEl) {
        if (currentModelLibraryId && library[currentModelLibraryId]) {
            currentStatusEl.textContent = "Saved";
            currentStatusEl.className = "badge badge-green";
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
        const data = item.data || {};
        const nodes = Array.isArray(data.nodes) ? data.nodes.length : 0;
        const elements = Array.isArray(data.elements) ? data.elements.length : 0;
        const loads = Array.isArray(data.loads) ? data.loads.length : 0;
        const moments = Array.isArray(data.moments) ? data.moments.length : 0;
        const isCurrent = item.id === currentModelLibraryId;
        const isGridModel = data.analysisMode === "grid";
        const modelTypeLabel = isGridModel ? "Grid Model" : "Beam / Truss / Frame Model";
        const modelTypeClass = isGridModel ? "badge-green" : "badge-blue";
        const safeId = escapeHtml(String(item.id || "")).replace(/'/g, "&#39;");
        const isSelected = selectedModelIds.has(item.id);
        return `<article class="model-card${isCurrent ? " current" : ""}${isSelected ? " selected" : ""}">
            <div class="model-card-preview">
                <label class="model-select-box" title="Select this model"><input type="checkbox" aria-label="Select model ${escapeHtml(item.name || "Structural Model")}" ${isSelected ? "checked" : ""} onchange="toggleModelSelection('${safeId}', this.checked)"></label>
                <span class="home-preview-label">Structure Preview</span>
                ${modelPreviewSVG(data)}
            </div>
            <div class="model-card-body">
                <div class="model-card-title-row">
                    <div class="model-card-name">${escapeHtml(item.name || "Structural Model")}</div>
                    <div class="model-card-badges">
                        <span class="badge ${modelTypeClass}">${modelTypeLabel}</span>
                        ${isCurrent ? '<span class="badge badge-gray">Current</span>' : ''}
                    </div>
                </div>
                <div class="model-card-meta">
                    <div class="model-card-stat"><div class="model-card-stat-label">Nodes</div><div class="model-card-stat-value">${nodes}</div></div>
                    <div class="model-card-stat"><div class="model-card-stat-label">Elements</div><div class="model-card-stat-value">${elements}</div></div>
                    <div class="model-card-stat"><div class="model-card-stat-label">Loads</div><div class="model-card-stat-value">${loads}</div></div>
                    <div class="model-card-stat"><div class="model-card-stat-label">Moments</div><div class="model-card-stat-value">${moments}</div></div>
                </div>
                <div class="model-card-foot">
                    <span class="model-card-saved">Saved ${escapeHtml(formatModelSavedTime(item.updatedAt))}</span>
                    <div class="model-card-actions">
                        <button type="button" class="icon-btn" onclick="openSavedModel('${safeId}')">Open</button>
                        <button type="button" class="icon-btn" onclick="exportSavedModel('${safeId}')">Export</button>
                        <button type="button" class="icon-btn" onclick="deleteSavedModel('${safeId}')">Delete</button>
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

function toggleModelSelection(id, checked) {
    if (checked) selectedModelIds.add(id);
    else selectedModelIds.delete(id);
    const card = Array.from(document.querySelectorAll("#modelLibraryGrid .model-card input[type=checkbox]"))
        .find((cb) => (cb.getAttribute("onchange") || "").includes(`'${id}'`));
    if (card) card.closest(".model-card").classList.toggle("selected", !!checked);
    updateModelSelectionToolbar();
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
    selectedModelIds.clear();

    if (deletedCurrentModel || Object.keys(remainingLibrary).length === 0) {
        // Deleting every saved model must also remove the active unsaved
        // working copy and its localStorage snapshot.
        resetActiveModelAfterSavedModelDeletion();
    }
    renderModelLibrary();
}

// Loads a model's input data into the working model and solves it without any
// dialogs. Returns { ok, message, sections, caseLabel }.
function solveModelSilently(data) {
    const captured = [];
    const origAlert = window.alert;
    const origConfirm = window.confirm;
    window.alert = (m) => { captured.push(String(m)); };
    window.confirm = () => true;
    try {
        applyPersistedInputModel(JSON.parse(JSON.stringify(data || {})));
        migrateUnitSystem();
        ensureBuiltInSupportTemplates();

        // Default analysis cases: first case that actually holds loads/moments.
        const lc = model.loadCases.find((c) => model.loads.some((l) => String(l.loadCaseId || "") === String(c.id)));
        const mc = model.momentCases.find((c) => model.moments.some((m) => String(m.momentCaseId || "") === String(c.id)));
        activeLoadCaseId = lc ? lc.id : "";
        activeMomentCaseId = mc ? mc.id : "";
        syncActiveAnalysisCaseSelectors();

        analysisState.status = "not-run";
        runAnalysisCore();

        const problems = captured.filter((m) => !/^Analysis completed successfully/.test(m));
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

    // Keep the user's current work so it can be put back afterwards.
    const snap = {
        data: JSON.parse(JSON.stringify(getPersistedInputModel())),
        loadCase: activeLoadCaseId,
        momentCase: activeMomentCaseId,
        status: analysisState.status,
    };

    try {
        for (let i = 0; i < items.length; i++) {
            await pdfShowProgress(`Solving model ${i + 1} of ${items.length}: ${items[i].name}…`);
            const r = solveModelSilently(items[i].data);
            if (r.ok) solved.push({ name: items[i].name, sections: r.sections, caseLabel: r.caseLabel });
            else failed.push({ name: items[i].name, message: r.message });
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
            const meta = {
                modelName: solved[k].name,
                caseLabel: solved[k].caseLabel,
                dateText,
                sectionPrefix: multi ? `Model ${k + 1} of ${solved.length} · ` : "",
                progressPrefix: multi ? `Model ${k + 1} of ${solved.length} — ` : "",
            };
            await pdfRenderSectionsToPages({ frame, doc, win, root }, solved[k].sections, meta, jpegPages);
        }

        await pdfShowProgress("Creating PDF file…");
        const title = solved.length === 1 ? `${solved[0].name} - Analysis Report` : `Selected Models (${solved.length}) - Analysis Report`;
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
