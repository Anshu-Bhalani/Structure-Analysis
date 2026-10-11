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
                    <div class="field"><label for="loadCaseId">Load Case ID</label><input id="loadCaseId" placeholder="LC1" value="LC1"></div>
                    <div class="field"><label for="loadCaseType">Type</label><select id="loadCaseType" onchange="renderSelfWeightMemberInputs()"><option value="Dead">Dead</option><option value="Live">Live</option><option value="Self Weight">Self Weight</option></select></div>
                    <div class="field"><label for="loadCaseDescription">Description</label><input id="loadCaseDescription" placeholder="Floor dead load" value="Dead Load"></div>
                </div>
                <div id="selfWeightCaseFields" class="restraint-box" style="display:none; margin-top:14px;">
                    <div class="restraint-title">Self Weight by Element</div>
                    <p style="color:#64748b; margin:0 0 12px; font-size:0.9em;">Enter each element's downward distributed self-weight individually (kN/m). Use 0 when that element has no self-weight.</p>
                    <div id="selfWeightMemberInputs" class="grid grid-2"></div>
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
                    <thead><tr><th>Load Case ID</th><th>Type</th><th>Description</th><th>Self Weight by Element</th><th>Actions</th></tr></thead>
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
    if (data.type !== "Self Weight") delete loadCase.memberSelfWeights;
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
    const memberSelfWeights = Object.create(null);
    if (type === "Self Weight") {
        for (const element of model.elements) {
            const input = Array.from(document.querySelectorAll("#selfWeightMemberInputs [data-self-weight-element]"))
                .find((item) => String(item.dataset.selfWeightElement) === String(element.id));
            const raw = input ? input.value.trim() : "";
            const weight = raw === "" ? NaN : Number(raw);
            if (!Number.isFinite(weight) || weight < 0) {
                return alert(`Self-weight for element '${element.id}' must be a finite number greater than or equal to 0 kN/m.`);
            }
            memberSelfWeights[String(element.id)] = weight;
        }
    }
    const data = type === "Self Weight"
        ? { id, type, description, memberSelfWeights }
        : { id, type, description };
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
    renderSelfWeightMemberInputs(false);
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
    renderSelfWeightMemberInputs(false);
}
function renderSelfWeightMemberInputs(preserveLiveValues = true) {
    const panel = document.getElementById("selfWeightCaseFields");
    const target = document.getElementById("selfWeightMemberInputs");
    const typeSelect = document.getElementById("loadCaseType");
    if (!panel || !target || !typeSelect) return;

    if (typeSelect.value !== "Self Weight") {
        panel.style.display = "none";
        return;
    }
    panel.style.display = "block";

    const liveValues = {};
    if (preserveLiveValues) {
        target.querySelectorAll("[data-self-weight-element]").forEach((input) => {
            liveValues[String(input.dataset.selfWeightElement)] = input.value;
        });
    }
    const editingCase = model.loadCases.find((item) => String(item.id) === String(editingLoadCaseId));
    const savedValues = editingCase?.memberSelfWeights && typeof editingCase.memberSelfWeights === "object"
        ? editingCase.memberSelfWeights : {};

    if (!model.elements.length) {
        target.innerHTML = '<p style="color:#b45309; margin:0;">Create an element first; its self-weight field will appear here.</p>';
        return;
    }

    target.innerHTML = model.elements.map((element) => {
        const id = String(element.id);
        const value = Object.prototype.hasOwnProperty.call(liveValues, id)
            ? liveValues[id]
            : (Object.prototype.hasOwnProperty.call(savedValues, id) ? savedValues[id] : "");
        return '<div class="field"><label>Element ' + escapeHtml(id) + '</label>' +
            '<div class="input-wrap has-unit"><input type="text" inputmode="decimal" data-self-weight-element="' + escapeHtml(id) +
            '" aria-label="Self-weight for element ' + escapeHtml(id) + '" value="' + escapeHtml(value) + '">' +
            '<span class="input-unit">kN/m</span></div></div>';
    }).join("");
}

function renderLoadCases() {
    const tbody = document.getElementById("loadCaseTable");
    if (!model.loadCases.length) {
        renderSelfWeightMemberInputs();
        return showEmpty("loadCaseTable", 5);
    }
    renderSelfWeightMemberInputs();
    tbody.innerHTML = model.loadCases.map((loadCase) => {
        const weights = loadCase.memberSelfWeights && typeof loadCase.memberSelfWeights === "object"
            ? loadCase.memberSelfWeights : {};
        const weightSummary = loadCase.type === "Self Weight"
            ? (model.elements.length
                ? model.elements.map((element) => {
                    const elementId = String(element.id);
                    const isSet = Object.prototype.hasOwnProperty.call(weights, elementId) &&
                        weights[elementId] !== undefined && weights[elementId] !== null && weights[elementId] !== "" &&
                        Number.isFinite(Number(weights[elementId])) && Number(weights[elementId]) >= 0;
                    return escapeHtml(elementId) + ": " + (isSet ? formatNum(Number(weights[elementId])) : '<strong style="color:#b45309;">Not set</strong>');
                }).join("; ") + " kN/m"
                : "No elements")
            : "—";
        return `<tr data-sort-collection="loadCases" data-sort-id="${escapeHtml(encodeInlineArgument(loadCase.id))}"><td>${sortHandle(loadCase.id)}${escapeHtml(loadCase.id)}</td><td><span class="badge badge-blue">${escapeHtml(loadCase.type)}</span></td><td>${escapeHtml(loadCase.description)}</td><td>${weightSummary}</td><td><div class="table-actions"><button type="button" class="icon-btn" aria-label="Edit load case ${escapeHtml(loadCase.id)}" title="Edit load case ${escapeHtml(loadCase.id)}" onclick="editLoadCase('${encodeInlineArgument(loadCase.id)}')">✎</button><button type="button" class="icon-btn" aria-label="Delete load case ${escapeHtml(loadCase.id)}" title="Delete load case ${escapeHtml(loadCase.id)}" onclick="deleteItem('loadCases','${encodeInlineArgument(loadCase.id)}','id')">×</button></div></td></tr>`;
    }).join("");
}
