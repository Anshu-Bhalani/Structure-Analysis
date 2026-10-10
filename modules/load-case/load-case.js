/* ==========================================================================
 * load-case.js — Load Case page module
 * Load Case page — load case definitions.
 * Contains this page's markup (injected into .container) and its logic.
 * ========================================================================== */

/* ---- Markup ---- */
mountModuleHTML(".container", "beforeend", `
<!-- LOAD CASES -->
<section class="section" id="loadCases">
    <div class="card">
        <div class="card-header">
            <div><h3>Create Load Case</h3><p>Create reusable load case definitions.</p></div>
        </div>
        <div class="card-body">
            <form id="loadCaseForm">
                <div class="grid grid-3">
                    <div class="field"><label>Load Case ID</label><input id="loadCaseId" placeholder="LC1" value="LC1"></div>
                    <div class="field"><label>Type</label><select id="loadCaseType"><option value="Dead">Dead</option><option value="Live">Live</option><option value="Self Weight">Self Weight</option></select></div>
                    <div class="field"><label>Description</label><input id="loadCaseDescription" placeholder="Floor dead load" value="Dead Load"></div>
                </div>
                <div class="form-footer">
                    <button id="loadCaseSubmitBtn" type="submit" class="btn btn-primary">Create Load Case</button>
                </div>
            </form>
        </div>
    </div>

    <div class="card">
        <div class="card-header"><h3>Load Cases</h3></div>
        <div class="card-body">
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Load Case ID</th><th>Type</th><th>Description</th><th>Actions</th></tr></thead>
                    <tbody id="loadCaseTable"></tbody>
                </table>
            </div>
        </div>
    </div>
</section>
`);

/* ---- Logic ---- */
// ---- Load Cases ----
let editingLoadCaseId = null;

function createLoadCase(data) {
    model.loadCases.push(data);
    markAnalysisInvalidated();
}

function updateLoadCase(existingId, data) {
    const loadCase = model.loadCases.find((lc) => lc.id === existingId);
    if (!loadCase) return false;
    const oldId = loadCase.id;
    Object.assign(loadCase, data);
    if (oldId !== data.id) {
        model.loads.forEach((load) => { if (load.loadCaseId === oldId) load.loadCaseId = data.id; });
        if (activeLoadCaseId === oldId) activeLoadCaseId = data.id;
    }
    markAnalysisInvalidated();
    return true;
}

document.getElementById("loadCaseForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = val("loadCaseId");
    if (!id) return alert("Load Case ID is required.");
    if (hasId(model.loadCases, id, editingLoadCaseId)) return alert("Load Case ID already exists.");
    const type = val("loadCaseType");
    const description = val("loadCaseDescription");
    if (!type) return alert("Load Case Type is required.");
    if (!description) return alert("Load Case Description is required.");
    const data = { id, type, description };
    if (editingLoadCaseId !== null) {
        const updated = updateLoadCase(editingLoadCaseId, data);
        if (!updated) { resetLoadCaseForm(); return; }
    } else {
        createLoadCase(data);
    }
    resetLoadCaseForm();
    document.getElementById("loadCaseId").value = getNextId(id);
    refreshAll();
});
function resetLoadCaseForm() {
    document.getElementById("loadCaseForm").reset();
    editingLoadCaseId = null;
    document.getElementById("loadCaseSubmitBtn").textContent = "Create Load Case";
}
function editLoadCase(encodedId) {
    const id = decodeURIComponent(encodedId);
    const loadCase = model.loadCases.find((lc) => lc.id === id);
    if (!loadCase) return;
    editingLoadCaseId = loadCase.id;
    document.getElementById("loadCaseId").value = loadCase.id;
    document.getElementById("loadCaseType").value = loadCase.type;
    document.getElementById("loadCaseDescription").value = loadCase.description || "";
    document.getElementById("loadCaseSubmitBtn").textContent = "Update Load Case";
}
function renderLoadCases() {
    const tbody = document.getElementById("loadCaseTable");
    if (!model.loadCases.length) return showEmpty("loadCaseTable", 4);
    tbody.innerHTML = model.loadCases.map((l) =>
        `<tr data-sort-collection="loadCases" data-sort-id="${escapeHtml(encodeURIComponent(l.id))}"><td>${sortHandle(l.id)}${escapeHtml(l.id)}</td><td><span class="badge badge-blue">${escapeHtml(l.type)}</span></td><td>${escapeHtml(l.description)}</td><td><div class="table-actions"><button class="icon-btn" onclick="editLoadCase('${encodeURIComponent(l.id)}')">✎</button><button class="icon-btn" onclick="deleteItem('loadCases','${encodeURIComponent(l.id)}','id')">×</button></div></td></tr>`
    ).join("");
}
