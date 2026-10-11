/* ==========================================================================
 * moment-case.js — Moment Case page module
 * Moment Case page — moment case definitions.
 * Contains this page's markup (injected into .container) and its logic.
 * ========================================================================== */

/* ---- Markup ---- */
mountModuleHTML(".container", "beforeend", `
<!-- MOMENT CASES -->
<section class="section" id="momentCases">
    <div class="card">
        <div class="card-header">
            <div><h3 id="momentCaseFormTitle">Create Moment Case</h3><p id="momentCaseFormDescription">Create reusable moment case definitions.</p></div>
        </div>
        <div class="card-body">
            <form id="momentCaseForm">
                <div class="grid grid-3">
                    <div class="field"><label for="momentCaseId" id="momentCaseIdLabel">Moment Case ID</label><input id="momentCaseId" placeholder="MC1" value="MC1"></div>
                    <div class="field"><label for="momentCaseType">Type</label><select id="momentCaseType"><option value="Dead">Dead</option><option value="Live">Live</option><option value="Self Weight">Self Weight</option></select></div>
                    <div class="field"><label for="momentCaseDescription">Description</label><input id="momentCaseDescription" placeholder="Beam live moment" value="Dead Moment"></div>
                </div>
                <div class="form-footer"><button id="momentCaseSubmitBtn" type="submit" class="btn btn-primary">Create Moment Case</button></div>
            </form>
        </div>
    </div>

    <div class="card">
        <div class="card-header"><h3 id="momentCaseTableTitle">Moment Cases</h3></div>
        <div class="card-body">
            <div class="table-wrap">
                <table>
                    <thead id="momentCaseTableHead"><tr><th>Moment Case ID</th><th>Type</th><th>Description</th><th>Actions</th></tr></thead>
                    <tbody id="momentCaseTable"></tbody>
                </table>
            </div>
        </div>
    </div>
</section>
`);


// Keep Grid torsion case wording isolated from the BTF moment terminology.
function syncMomentCaseInputModeUI() {
    const gridMode = typeof isGridAnalysisMode === "function" && isGridAnalysisMode();
    const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    setText("momentCaseFormTitle", gridMode ? "Create Torsion Case" : "Create Moment Case");
    setText("momentCaseFormDescription", gridMode ? "Create reusable torsion case definitions." : "Create reusable moment case definitions.");
    setText("momentCaseIdLabel", gridMode ? "Torsion Case ID" : "Moment Case ID");
    const description = document.getElementById("momentCaseDescription");
    if (description) {
        description.placeholder = gridMode ? "Grid torsion case" : "Beam live moment";
        if (description.value === "Dead Moment" || description.value === "Dead Torsion") {
            description.value = gridMode ? "Dead Torsion" : "Dead Moment";
        }
    }
    setText("momentCaseSubmitBtn", editingMomentCaseId !== null ? (gridMode ? "Update Torsion Case" : "Update Moment Case") : (gridMode ? "Create Torsion Case" : "Create Moment Case"));
    setText("momentCaseTableTitle", gridMode ? "Torsion Cases" : "Moment Cases");
    const head = document.getElementById("momentCaseTableHead");
    if (head) head.innerHTML = gridMode
        ? `<tr><th>Torsion Case ID</th><th>Type</th><th>Description</th><th>Actions</th></tr>`
        : `<tr><th>Moment Case ID</th><th>Type</th><th>Description</th><th>Actions</th></tr>`;
}

/* ---- Logic ---- */
// ---- Moment Cases ----
let editingMomentCaseId = null;

function createMomentCase(data) {
    model.momentCases.push(data);
    markAnalysisInvalidated();
}

function updateMomentCase(existingId, data) {
    const momentCase = model.momentCases.find((mc) => mc.id === existingId);
    if (!momentCase) return false;
    const oldId = momentCase.id;
    Object.assign(momentCase, data);
    if (oldId !== data.id) {
        model.moments.forEach((moment) => { if (moment.momentCaseId === oldId) moment.momentCaseId = data.id; });
        if (activeMomentCaseId === oldId) activeMomentCaseId = data.id;
    }
    markAnalysisInvalidated();
    return true;
}

document.getElementById("momentCaseForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const gridMode = typeof isGridAnalysisMode === "function" && isGridAnalysisMode();
    const id = val("momentCaseId");
    if (!id) return alert(gridMode ? "Torsion Case ID is required." : "Moment Case ID is required.");
    if (hasId(model.momentCases, id, editingMomentCaseId)) return alert(gridMode ? "Torsion Case ID already exists." : "Moment Case ID already exists.");
    const type = val("momentCaseType");
    const description = val("momentCaseDescription");
    if (!type) return alert(gridMode ? "Torsion Case Type is required." : "Moment Case Type is required.");
    if (!description) return alert(gridMode ? "Torsion Case Description is required." : "Moment Case Description is required.");
    const data = { id, type, description };
    if (editingMomentCaseId !== null) {
        const updated = updateMomentCase(editingMomentCaseId, data);
        if (!updated) { resetMomentCaseForm(); return; }
    } else {
        createMomentCase(data);
    }
    resetMomentCaseForm();
    document.getElementById("momentCaseId").value = getNextId(id);
    refreshAll();
});
function resetMomentCaseForm() {
    document.getElementById("momentCaseForm").reset();
    editingMomentCaseId = null;
    document.getElementById("momentCaseSubmitBtn").textContent = "Create Moment Case";
    syncMomentCaseInputModeUI();
}
function editMomentCase(encodedId) {
    const id = decodeURIComponent(encodedId);
    const momentCase = model.momentCases.find((mc) => mc.id === id);
    if (!momentCase) return;
    editingMomentCaseId = momentCase.id;
    document.getElementById("momentCaseId").value = momentCase.id;
    document.getElementById("momentCaseType").value = momentCase.type;
    document.getElementById("momentCaseDescription").value = momentCase.description || "";
    document.getElementById("momentCaseSubmitBtn").textContent = typeof isGridAnalysisMode === "function" && isGridAnalysisMode() ? "Update Torsion Case" : "Update Moment Case";
    syncMomentCaseInputModeUI();
}
function renderMomentCases() {
    syncMomentCaseInputModeUI();
    const tbody = document.getElementById("momentCaseTable");
    if (!model.momentCases.length) return showEmpty("momentCaseTable", 4);
    tbody.innerHTML = model.momentCases.map((m) =>
        `<tr data-sort-collection="momentCases" data-sort-id="${escapeHtml(encodeInlineArgument(m.id))}"><td>${sortHandle(m.id)}${escapeHtml(m.id)}</td><td><span class="badge badge-blue">${escapeHtml(m.type)}</span></td><td>${escapeHtml(m.description)}</td><td><div class="table-actions"><button type="button" class="icon-btn" aria-label="Edit moment case ${escapeHtml(m.id)}" title="Edit moment case ${escapeHtml(m.id)}" onclick="editMomentCase('${encodeInlineArgument(m.id)}')">✎</button><button type="button" class="icon-btn" aria-label="Delete moment case ${escapeHtml(m.id)}" title="Delete moment case ${escapeHtml(m.id)}" onclick="deleteItem('momentCases','${encodeInlineArgument(m.id)}','id')">×</button></div></td></tr>`
    ).join("");
}
