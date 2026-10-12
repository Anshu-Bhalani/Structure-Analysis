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
                    <div class="field plane-only-property"><label for="elementMemberType">Member Type</label><select id="elementMemberType" onchange="syncElementTemplateTypeUI()"><option value="frame" selected>Frame</option><option value="beam">Beam</option><option value="truss">Truss</option></select></div>
                    <div class="field"><label for="elementI">Moment of Inertia (I)</label><div class="input-wrap has-unit"><input id="elementI" type="text" inputmode="decimal" placeholder="1" value="1"><span class="input-unit">m⁴</span></div><div class="length-chip-row scientific-shortcut-row"><button type="button" class="scientific-chip" onclick="insertScientificExponent('elementI')">e</button></div></div>
                    <div class="field"><label for="elementE">Modulus of Elasticity (E)</label><div class="input-wrap has-unit"><input id="elementE" type="text" inputmode="decimal" placeholder="1" value="1"><span class="input-unit">kN/m²</span></div><div class="length-chip-row scientific-shortcut-row"><button type="button" class="scientific-chip" onclick="insertScientificExponent('elementE')">e</button></div></div>
                    <div class="field plane-only-property"><label for="elementA">Cross-sectional Area (A)</label><div class="input-wrap has-unit"><input id="elementA" type="text" inputmode="decimal" placeholder="1" value="1"><span class="input-unit">m²</span></div><div class="length-chip-row scientific-shortcut-row"><button type="button" class="scientific-chip" onclick="insertScientificExponent('elementA')">e</button></div></div>
                </div>
                <div class="grid grid-2 plane-only-property" id="planeThermalProperties" style="margin-top:14px;">
                    <div class="field"><label for="elementAlpha">Thermal Expansion Coefficient (α)</label><div class="input-wrap has-unit"><input id="elementAlpha" type="text" inputmode="decimal" placeholder="e.g. 0.000012" value="0"><span class="input-unit">1/°C</span></div><div class="length-chip-row scientific-shortcut-row"><button type="button" class="scientific-chip" onclick="insertScientificExponent('elementAlpha')">e</button></div></div>
                    <div class="field"><label for="elementThermalDepth">Section Depth for Thermal Gradient (d)</label><div class="input-wrap has-unit"><input id="elementThermalDepth" type="text" inputmode="decimal" placeholder="e.g. 0.3" value="0"><span class="input-unit">m</span></div><div class="length-chip-row scientific-shortcut-row"><button type="button" class="scientific-chip" onclick="insertScientificExponent('elementThermalDepth')">e</button></div></div>
                </div>
                <div id="gridElementProperties" class="grid grid-2" style="display:none; margin-top:14px;">
                    <div class="field"><label for="elementG">Shear Modulus (G)</label><div class="input-wrap has-unit"><input id="elementG" type="text" inputmode="decimal" placeholder="80" value="80"><span class="input-unit">GPa</span></div><div class="length-chip-row scientific-shortcut-row"><button type="button" class="scientific-chip" onclick="insertScientificExponent('elementG')">e</button></div></div>
                    <div class="field"><label for="elementJ">Torsional Constant (J)</label><div class="input-wrap has-unit"><input id="elementJ" type="text" inputmode="decimal" placeholder="1" value="1"><span class="input-unit">m⁴</span></div><div class="length-chip-row scientific-shortcut-row"><button type="button" class="scientific-chip" onclick="insertScientificExponent('elementJ')">e</button></div></div>
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
                    <thead><tr><th>Template ID</th><th class="plane-only-property">Type</th><th>I (m⁴)</th><th>E (kN/m²)</th><th class="grid-only-property" style="display:none;">G (GPa)</th><th class="grid-only-property" style="display:none;">J (m⁴)</th><th class="plane-only-property">A (m²)</th><th class="plane-only-property">α (1/°C)</th><th class="plane-only-property">d (m)</th><th>Actions</th></tr></thead>
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
    const memberType = gridMode ? "" : val("elementMemberType");
    const I = memberType === "truss" ? 0 : num("elementI");
    const E_kN_m2 = num("elementE"), G_GPa = num("elementG"), J = num("elementJ"), A = num("elementA");
    const alpha = num("elementAlpha"), thermalDepth = num("elementThermalDepth");
    const validations = [
        [I, "Moment of Inertia (I)", gridMode || memberType !== "truss" ? { minExclusive: 0 } : { min: 0 }],
        [E_kN_m2, "Modulus of Elasticity (E)", { minExclusive: 0 }],
    ];
    if (gridMode) {
        validations.push([G_GPa, "Shear Modulus (G)", { minExclusive: 0 }], [J, "Torsional Constant (J)", { minExclusive: 0 }]);
    } else {
        validations.push(
            [A, "Cross-sectional Area (A)", { minExclusive: 0 }],
            [alpha, "Thermal Expansion Coefficient (α)", { min: 0 }],
            [thermalDepth, "Thermal Section Depth (d)", { min: 0 }]
        );
        if (!["beam", "truss", "frame"].includes(memberType)) return alert("Select Beam, Truss or Frame as the member type.");
    }
    for (const [value, label, options] of validations) {
        const error = requireFinite(value, label, options);
        if (error) return alert(error);
    }
    if (!gridMode && memberType === "beam" && I <= 0) return alert("A Beam requires both A > 0 and I > 0.");
    if (!gridMode && memberType === "frame" && I <= 0) return alert("A Frame requires both A > 0 and I > 0.");
    // Keep the two property sets separate. Values from the other solver mode
    // must not leak into the saved template when a template is edited.
    const data = {
        id,
        memberType: gridMode ? undefined : memberType,
        I,
        E_kN_m2,
        G_GPa: gridMode ? G_GPa : undefined,
        J: gridMode ? J : undefined,
        A: gridMode ? undefined : A,
        alpha: gridMode ? undefined : alpha,
        thermalDepth: gridMode ? undefined : thermalDepth
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
    syncElementTemplateTypeUI();
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
    document.getElementById("elementE").value = getElementEInternal(template);
    document.getElementById("elementG").value = template.G_GPa ?? "";
    document.getElementById("elementJ").value = template.J ?? "";
    document.getElementById("elementA").value = template.A ?? "1";
    document.getElementById("elementMemberType").value = getElementStructuralType({ templateId: template.id }) || "frame";
    document.getElementById("elementAlpha").value = template.alpha ?? 0;
    document.getElementById("elementThermalDepth").value = template.thermalDepth ?? 0;
    syncElementTemplateTypeUI();
    document.getElementById("elementTemplateSubmitBtn").textContent = "Update Element Template";
}
function syncElementTemplateTypeUI() {
    const typeInput = document.getElementById("elementMemberType");
    const inertiaInput = document.getElementById("elementI");
    if (!typeInput || !inertiaInput) return;
    if (isGridAnalysisMode()) {
        inertiaInput.disabled = false;
        return;
    }
    if (typeInput.value === "truss") {
        inertiaInput.value = "0";
        inertiaInput.disabled = true;
    } else {
        if (Number(inertiaInput.value) === 0 || inertiaInput.value === "") inertiaInput.value = "1";
        inertiaInput.disabled = false;
    }
}

function renderElementTemplates() {
    const tbody = document.getElementById("elementTemplateTable");
    const search = val("elementTemplateSearch").toLowerCase();
    const rows = model.elementTemplates.filter((e) => e.id.toLowerCase().includes(search));
    if (!rows.length) return showEmpty("elementTemplateTable", isGridAnalysisMode() ? 6 : 8);
    tbody.innerHTML = rows.map((e) => {
        const memberType = getElementStructuralType({ templateId: e.id }) || "—";
        return `<tr data-sort-collection="elementTemplates" data-sort-id="${escapeHtml(encodeInlineArgument(e.id))}"><td>${sortHandle(e.id)}<span class="badge badge-blue">${escapeHtml(e.id)}</span></td><td class="plane-only-property">${escapeHtml(memberType)}</td><td>${formatNum(e.I)}</td><td>${formatNum(getElementEInternal(e))}</td><td class="grid-only-property" style="display:none;">${e.G_GPa === undefined || e.G_GPa === "" ? "—" : formatNum(Number(e.G_GPa))}</td><td class="grid-only-property" style="display:none;">${e.J === undefined || e.J === "" ? "—" : formatNum(Number(e.J))}</td><td class="plane-only-property">${e.A === undefined || e.A === "" ? "—" : formatNum(Number(e.A))}</td><td class="plane-only-property">${e.alpha === undefined || e.alpha === "" ? "—" : formatNum(Number(e.alpha))}</td><td class="plane-only-property">${e.thermalDepth === undefined || e.thermalDepth === "" ? "—" : formatNum(Number(e.thermalDepth))}</td><td><div class="table-actions"><button type="button" class="icon-btn" aria-label="Edit element template ${escapeHtml(e.id)}" title="Edit element template ${escapeHtml(e.id)}" onclick="editElementTemplate('${encodeInlineArgument(e.id)}')">✎</button><button type="button" class="icon-btn" aria-label="Delete element template ${escapeHtml(e.id)}" title="Delete element template ${escapeHtml(e.id)}" onclick="deleteItem('elementTemplates','${encodeInlineArgument(e.id)}','id')">×</button></div></td></tr>`;
    }).join("");
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
        model.loadCases.forEach((loadCase) => {
            const weights = loadCase.memberSelfWeights;
            if (!weights || typeof weights !== "object" || Array.isArray(weights)) return;
            if (Object.prototype.hasOwnProperty.call(weights, String(oldId))) {
                weights[String(data.id)] = weights[String(oldId)];
                delete weights[String(oldId)];
            }
        });
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
