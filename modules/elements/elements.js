/* ==========================================================================
 * elements.js — Elements page module
 * Elements page — element templates (section / material) and element assignments.
 * Contains this page's markup (injected into .container) and its logic.
 * ========================================================================== */

/* ---- Markup ---- */
mountModuleHTML(".container", "beforeend", `
<!-- ELEMENTS -->
<section class="section" id="elements">
    <div class="card">
        <div class="card-header">
            <div><h3>Create Element Template</h3><p>Create a reusable element definition that can be assigned to multiple node pairs.</p></div>
        </div>
        <div class="card-body">
            <form id="elementTemplateForm">
                <div class="grid grid-3">
                    <div class="field"><label for="elementTemplateId">Element Template ID</label><input id="elementTemplateId" placeholder="E1" value="E1"></div>
                    <div class="field"><label for="elementI">Moment of Inertia (I)</label><div class="input-wrap has-unit"><input id="elementI" type="text" inputmode="decimal" placeholder="1" value="1"><span class="input-unit">m⁴</span></div><div class="length-chip-row scientific-shortcut-row"><button type="button" class="scientific-chip" onclick="insertScientificExponent('elementI')">e</button></div></div>
                    <div class="field"><label for="elementE">Modulus of Elasticity (E)</label><div class="input-wrap has-unit"><input id="elementE" type="text" inputmode="decimal" placeholder="200" value="200"><span class="input-unit">GPa</span></div><div class="length-chip-row scientific-shortcut-row"><button type="button" class="scientific-chip" onclick="insertScientificExponent('elementE')">e</button></div></div>
                    <div class="field plane-only-property"><label for="elementA">Cross-sectional Area (A)</label><div class="input-wrap has-unit"><input id="elementA" type="text" inputmode="decimal" placeholder="1" value="1"><span class="input-unit">m²</span></div><div class="length-chip-row scientific-shortcut-row"><button type="button" class="scientific-chip" onclick="insertScientificExponent('elementA')">e</button></div></div>
                    <div class="field"><label for="elementDensity" id="elementWeightLabel">Density / Self Weight</label><div class="input-wrap has-unit"><input id="elementDensity" type="text" inputmode="decimal" placeholder="0" value="0"><span id="elementWeightUnit" class="input-unit">kg/m³</span></div><div class="length-chip-row scientific-shortcut-row"><button type="button" class="scientific-chip" onclick="insertScientificExponent('elementDensity')">e</button></div></div>
                </div>
                <div id="gridElementProperties" class="grid grid-2" style="display:none; margin-top:14px;">
                    <div class="field"><label for="elementG">Shear Modulus (G)</label><div class="input-wrap has-unit"><input id="elementG" type="text" inputmode="decimal" placeholder="80" value="80"><span class="input-unit">GPa</span></div><div class="length-chip-row scientific-shortcut-row"><button type="button" class="scientific-chip" onclick="insertScientificExponent('elementG')">e</button></div></div>
                    <div class="field"><label for="elementJ">Torsional Constant (J)</label><div class="input-wrap has-unit"><input id="elementJ" type="text" inputmode="decimal" placeholder="1" value="1"><span class="input-unit">m⁴</span></div><div class="length-chip-row scientific-shortcut-row"><button type="button" class="scientific-chip" onclick="insertScientificExponent('elementJ')">e</button></div></div>
                </div>
                <div class="field" style="margin-top:14px; max-width:380px;">
                    <label for="selfWeightType">Self Weight Input Type</label>
                    <select id="selfWeightType" onchange="updateElementWeightUnit()">
                        <option value="density">Density (requires A)</option>
                        <option value="lineWeight">Self Weight</option>
                    </select>
                </div>
                <div class="form-footer">
                    <button type="button" class="btn btn-secondary" onclick="resetElementTemplateForm()">Reset</button>
                    <button id="elementTemplateSubmitBtn" type="submit" class="btn btn-primary">Create Element Template</button>
                </div>
            </form>
        </div>
    </div>

    <div class="card">
        <div class="card-header">
            <div><h3>Element Templates</h3><p>Reusable section/material definitions.</p></div>
            <input id="elementTemplateSearch" class="search-box" placeholder="Search..." oninput="renderElementTemplates()">
        </div>
        <div class="card-body">
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Template ID</th><th>I (m⁴)</th><th>E (GPa)</th><th class="grid-only-property" style="display:none;">G (GPa)</th><th class="grid-only-property" style="display:none;">J (m⁴)</th><th class="plane-only-property">A (m²)</th><th>Self Weight</th><th>Actions</th></tr></thead>
                    <tbody id="elementTemplateTable"></tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="card">
        <div class="card-header">
            <div><h3>Assign Element to Nodes</h3><p>Use an existing element template between two nodes.</p></div>
        </div>
        <div class="card-body">
            <form id="elementAssignmentForm">
                <div class="grid grid-4">
                    <div class="field"><label for="elementId">Element ID</label><input id="elementId" placeholder="E1-1" value="E1-1"></div>
                    <div class="field"><label for="elementTemplateSelect">Element Template</label><select id="elementTemplateSelect"><option value="">Select template</option></select></div>
                    <div class="field"><label for="elementStartNode">Start Node ID</label><select id="elementStartNode"><option value="">Select node</option></select></div>
                    <div class="field"><label for="elementEndNode">End Node ID</label><select id="elementEndNode"><option value="">Select node</option></select></div>
                </div>
                <div class="form-footer">
                    <button type="button" class="btn btn-secondary" onclick="resetElementAssignmentForm()">Reset</button>
                    <button id="elementSubmitBtn" type="submit" class="btn btn-primary">Assign Element</button>
                </div>
            </form>
        </div>
    </div>

    <div class="card">
        <div class="card-header">
            <div><h3>Element List</h3><p>Elements assigned to node pairs.</p></div>
        </div>
        <div class="card-body">
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Element ID</th><th>Template</th><th>Start Node</th><th>End Node</th><th>Actions</th></tr></thead>
                    <tbody id="elementTable"></tbody>
                </table>
            </div>
        </div>
    </div>
</section>
`);

/* ---- Logic ---- */
// ---- Element Templates ----
let editingElementTemplateId = null;

function createElementTemplate(data) {
    model.elementTemplates.push(data);
    markAnalysisInvalidated();
}

function updateElementTemplate(existingId, data) {
    const template = model.elementTemplates.find((t) => t.id === existingId);
    if (!template) return false;
    const oldId = template.id;
    Object.assign(template, data);
    if (oldId !== data.id) model.elements.forEach((el) => { if (el.templateId === oldId) el.templateId = data.id; });
    markAnalysisInvalidated();
    return true;
}

document.getElementById("elementTemplateForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = val("elementTemplateId");
    if (!id) return alert("Element Template ID is required.");
    if (hasId(model.elementTemplates, id, editingElementTemplateId)) return alert("Element Template ID already exists.");
    const gridMode = isGridAnalysisMode();
    const I = num("elementI"), E_GPa = num("elementE"), G_GPa = num("elementG"), J = num("elementJ"), A = num("elementA"), density = num("elementDensity");
    const validations = [
        [I, "Moment of Inertia (I)", gridMode ? { minExclusive: 0 } : { min: 0 }],
        [E_GPa, "Modulus of Elasticity (E)", { minExclusive: 0 }],
        [density, gridMode && val("selfWeightType") === "lineWeight" ? "Grid Line Self Weight" : "Density / Self Weight", { min: 0 }],
    ];
    if (gridMode) {
        validations.push([G_GPa, "Shear Modulus (G)", { minExclusive: 0 }], [J, "Torsional Constant (J)", { minExclusive: 0 }]);
    } else {
        validations.push([A, "Cross-sectional Area (A)", { min: 0 }]);
    }
    for (const [value, label, options] of validations) {
        const error = requireFinite(value, label, options);
        if (error) return alert(error);
    }
    // Grid templates intentionally have no cross-sectional area. Density
    // (kg/m³) therefore cannot be converted to a line load for Grid self-
    // weight. Reject it instead of storing a value the solver would silently
    // multiply by a missing/zero A. The user must enter kN/m explicitly.
    if (gridMode && val("selfWeightType") === "density" && density > 0) {
        return alert("Grid elements do not use cross-sectional area A, so density (kg/m³) cannot be converted to self-weight. Select Self Weight and enter the line weight in kN/m.");
    }
    if (!gridMode && A === 0 && I === 0) return alert("A and I cannot both be 0. Set A = 0 for a beam element or I = 0 for a truss element.");
    // Keep the two property sets separate. Values from the other solver mode
    // must not leak into the saved template when a template is edited.
    const data = {
        id, I, E_GPa,
        G_GPa: gridMode ? G_GPa : undefined,
        J: gridMode ? J : undefined,
        A: gridMode ? undefined : A,
        density,
        selfWeightType: gridMode ? "lineWeight" : val("selfWeightType")
    };
    if (editingElementTemplateId !== null) {
        const updated = updateElementTemplate(editingElementTemplateId, data);
        if (!updated) { resetElementTemplateForm(); return; }
    } else {
        createElementTemplate(data);
    }
    resetElementTemplateForm();
    document.getElementById("elementTemplateId").value = getNextId(id);
    refreshAll();
});
function resetElementTemplateForm() {
    document.getElementById("elementTemplateForm").reset();
    if (isGridAnalysisMode()) document.getElementById("selfWeightType").value = "lineWeight";
    updateElementWeightUnit();
    editingElementTemplateId = null;
    document.getElementById("elementTemplateSubmitBtn").textContent = "Create Element Template";
}
function editElementTemplate(encodedId) {
    const id = decodeURIComponent(encodedId);
    const template = model.elementTemplates.find((t) => t.id === id);
    if (!template) return;
    editingElementTemplateId = template.id;
    document.getElementById("elementTemplateId").value = template.id;
    document.getElementById("elementI").value = template.I;
    document.getElementById("elementE").value = template.E_GPa;
    document.getElementById("elementG").value = template.G_GPa ?? "";
    document.getElementById("elementJ").value = template.J ?? "";
    document.getElementById("elementA").value = template.A ?? "1";
    document.getElementById("elementDensity").value = template.density;
    document.getElementById("selfWeightType").value = template.selfWeightType || "density";
    updateElementWeightUnit();
    document.getElementById("elementTemplateSubmitBtn").textContent = "Update Element Template";
}
function renderElementTemplates() {
    const tbody = document.getElementById("elementTemplateTable");
    const search = val("elementTemplateSearch").toLowerCase();
    const rows = model.elementTemplates.filter((e) => e.id.toLowerCase().includes(search));
    if (!rows.length) return showEmpty("elementTemplateTable", isGridAnalysisMode() ? 7 : 6);
    tbody.innerHTML = rows.map((e) =>
        `<tr data-sort-collection="elementTemplates" data-sort-id="${escapeHtml(encodeInlineArgument(e.id))}"><td>${sortHandle(e.id)}<span class="badge badge-blue">${escapeHtml(e.id)}</span></td><td>${formatNum(e.I)}</td><td>${formatNum(Number(e.E_GPa))}</td><td class="grid-only-property" style="display:none;">${e.G_GPa === undefined || e.G_GPa === "" ? "—" : formatNum(Number(e.G_GPa))}</td><td class="grid-only-property" style="display:none;">${e.J === undefined || e.J === "" ? "—" : formatNum(Number(e.J))}</td><td class="plane-only-property">${e.A === undefined || e.A === "" ? "—" : formatNum(Number(e.A))}</td><td>${formatNum(e.density)} ${e.selfWeightType === "density" ? "kg/m³" : "kN/m"}</td><td><div class="table-actions"><button type="button" class="icon-btn" aria-label="Edit element template ${escapeHtml(e.id)}" title="Edit element template ${escapeHtml(e.id)}" onclick="editElementTemplate('${encodeInlineArgument(e.id)}')">✎</button><button type="button" class="icon-btn" aria-label="Delete element template ${escapeHtml(e.id)}" title="Delete element template ${escapeHtml(e.id)}" onclick="deleteItem('elementTemplates','${encodeInlineArgument(e.id)}','id')">×</button></div></td></tr>`
    ).join("");
}

// ---- Element Assignments (connect nodes with a template) ----
let editingElementId = null;

function createElement(data) {
    model.elements.push(data);
    markAnalysisInvalidated();
}

function updateElement(existingId, data) {
    const element = model.elements.find((el) => el.id === existingId);
    if (!element) return false;
    const oldId = element.id;
    Object.assign(element, data);
    if (oldId !== data.id) {
        model.loads.forEach((load) => { if (load.elementId === oldId) load.elementId = data.id; });
        model.moments.forEach((moment) => { if (moment.elementId === oldId) moment.elementId = data.id; });
    }
    markAnalysisInvalidated();
    return true;
}

document.getElementById("elementAssignmentForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = val("elementId");
    if (!id) return alert("Element ID is required.");
    if (hasId(model.elements, id, editingElementId)) return alert("Element ID already exists.");
    const templateId = val("elementTemplateSelect");
    const startNode = val("elementStartNode");
    const endNode = val("elementEndNode");
    let error = requireReference(model.elementTemplates, templateId, "Element Template");
    if (error) return alert(error);
    error = requireReference(model.nodes, startNode, "Start Node");
    if (error) return alert(error);
    error = requireReference(model.nodes, endNode, "End Node");
    if (error) return alert(error);
    if (startNode === endNode) return alert("Start Node and End Node must be different.");
    const n1 = model.nodes.find((n) => n.id === startNode);
    const n2 = model.nodes.find((n) => n.id === endNode);
    const L = Math.hypot(n2.x - n1.x, n2.y - n1.y);
    if (!Number.isFinite(L) || L <= 0) return alert("Element length must be greater than zero.");
    const data = { id, templateId, startNode, endNode };
    if (editingElementId !== null) {
        const updated = updateElement(editingElementId, data);
        if (!updated) { resetElementAssignmentForm(); return; }
    } else {
        createElement(data);
    }
    resetElementAssignmentForm();
    document.getElementById("elementId").value = getNextId(id);
    refreshAll();
});
function resetElementAssignmentForm() {
    document.getElementById("elementAssignmentForm").reset();
    editingElementId = null;
    document.getElementById("elementSubmitBtn").textContent = "Assign Element";
}
function editElement(encodedId) {
    const id = decodeURIComponent(encodedId);
    const element = model.elements.find((el) => el.id === id);
    if (!element) return;
    editingElementId = element.id;
    document.getElementById("elementId").value = element.id;
    document.getElementById("elementTemplateSelect").value = element.templateId;
    document.getElementById("elementStartNode").value = element.startNode;
    document.getElementById("elementEndNode").value = element.endNode;
    document.getElementById("elementSubmitBtn").textContent = "Update Element";
}
function renderElements() {
    const tbody = document.getElementById("elementTable");
    if (!model.elements.length) return showEmpty("elementTable", 5);
    tbody.innerHTML = model.elements.map((e) =>
        `<tr data-sort-collection="elements" data-sort-id="${escapeHtml(encodeInlineArgument(e.id))}"><td>${sortHandle(e.id)}<span class="badge badge-green">${escapeHtml(e.id)}</span></td><td>${escapeHtml(e.templateId)}</td><td>${escapeHtml(e.startNode)}</td><td>${escapeHtml(e.endNode)}</td><td><div class="table-actions"><button type="button" class="icon-btn" aria-label="Edit element ${escapeHtml(e.id)}" title="Edit element ${escapeHtml(e.id)}" onclick="editElement('${encodeInlineArgument(e.id)}')">✎</button><button type="button" class="icon-btn" aria-label="Delete element ${escapeHtml(e.id)}" title="Delete element ${escapeHtml(e.id)}" onclick="deleteItem('elements','${encodeInlineArgument(e.id)}','id')">×</button></div></td></tr>`
    ).join("");
}
