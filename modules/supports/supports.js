/* ==========================================================================
 * supports.js — Supports page module
 * Supports page — support templates (fixed / roller / hinged / custom) and support assignments.
 * Contains this page's markup (injected into .container) and its logic.
 * ========================================================================== */

/* ---- Markup ---- */
mountModuleHTML(".container", "beforeend", `
<!-- SUPPORTS -->
<section class="section" id="supports">
    <div class="card">
        <div class="card-header">
            <div><h3>Built-in Support Templates</h3><p>These three standard support templates are already available. No creation is required.</p></div>
        </div>
        <div class="card-body">
            <div class="grid grid-3">
                <div class="restraint-box">
                    <div class="restraint-title">FIXED SUPPORT</div>
                    <p id="supportFixedDescription" style="font-size:12px; color:#475569; line-height:1.5; margin-bottom:10px;">RFx + RFy + RFz + RMx + RMy + RMz restrained</p>
                    <button type="button" class="btn btn-primary" onclick="selectBuiltInSupport('FIXED')">Use Fixed</button>
                </div>
                <div class="restraint-box">
                    <div class="restraint-title">ROLLER SUPPORT</div>
                    <p id="supportRollerDescription" style="font-size:12px; color:#475569; line-height:1.5; margin-bottom:10px;">RFy restrained only<br><span style="color:#64748b;">All other 2D restraints free</span></p>
                    <button type="button" class="btn btn-primary" onclick="selectBuiltInSupport('ROLLER')">Use Roller</button>
                </div>
                <div class="restraint-box">
                    <div class="restraint-title">HINGED SUPPORT</div>
                    <p id="supportHingedDescription" style="font-size:12px; color:#475569; line-height:1.5; margin-bottom:10px;">RFx + RFy restrained<br><span style="color:#64748b;">Rotation RZ remains free</span></p>
                    <button type="button" class="btn btn-primary" onclick="selectBuiltInSupport('HINGED')">Use Hinged</button>
                </div>
            </div>
        </div>
    </div>

    <div class="card">
        <div class="card-header">
            <div><h3>Create Custom Support Template</h3><p>Use this form only when you need a support condition other than the three built-in templates.</p></div>
        </div>
        <div class="card-body">
            <form id="supportTemplateForm">
                <div class="grid grid-3">
                    <div class="field"><label for="supportId">Support ID</label><input id="supportId" placeholder="S1" value="S1"></div>
                    <div class="field"><label for="supportDescription">Description</label><input id="supportDescription" placeholder="Pinned Support" value="Pinned Support"></div>
                </div>
                <div class="restraint-box" style="margin-top:18px;">
                    <div class="restraint-title">Restraints</div>
                    <div class="check-grid">
                        <label class="check-item"><input type="checkbox" id="RFx"><span id="supportRFxLabel">RFx</span></label>
                        <label class="check-item"><input type="checkbox" id="RFy"><span id="supportRFyLabel">RFy</span></label>
                        <label class="check-item"><input type="checkbox" id="RFz"><span id="supportRFzLabel">RFz (Ignore)</span></label>
                        <label class="check-item"><input type="checkbox" id="RMx"><span id="supportRMxLabel">RMx (Ignore)</span></label>
                        <label class="check-item"><input type="checkbox" id="RMy"><span id="supportRMyLabel">RMy (Ignore)</span></label>
                        <label class="check-item"><input type="checkbox" id="RMz"><span id="supportRMzLabel">RMz</span></label>
                    </div>
                </div>
                <div class="restraint-box" style="margin-top:14px;">
                    <div class="restraint-title">Prescribed Displacements</div>
                    <div class="grid grid-3">
                        <div class="field"><label for="dispX" id="supportDispXLabel">Δx</label><div class="input-wrap has-unit"><input id="dispX" type="text" inputmode="decimal" placeholder="0" value="0"><span class="input-unit">m</span></div><div class="length-chip-row scientific-shortcut-row"><button type="button" class="scientific-chip" onclick="insertScientificExponent('dispX')">e</button></div></div>
                        <div class="field"><label for="dispY" id="supportDispYLabel">Δy</label><div class="input-wrap has-unit"><input id="dispY" type="text" inputmode="decimal" placeholder="0" value="0"><span class="input-unit">m</span></div><div class="length-chip-row scientific-shortcut-row"><button type="button" class="scientific-chip" onclick="insertScientificExponent('dispY')">e</button></div></div>
                        <div class="field"><label for="dispZ" id="supportDispZLabel">Δz</label><div class="input-wrap has-unit"><input id="dispZ" type="text" inputmode="decimal" placeholder="0" value="0"><span class="input-unit">m</span></div><div class="length-chip-row scientific-shortcut-row"><button type="button" class="scientific-chip" onclick="insertScientificExponent('dispZ')">e</button></div></div>
                        <div class="field"><label for="rotX" id="supportRotXLabel">θx</label><div class="input-wrap has-unit"><input id="rotX" type="text" inputmode="decimal" placeholder="0" value="0"><span class="input-unit">rad</span></div><div class="length-chip-row scientific-shortcut-row"><button type="button" class="scientific-chip" onclick="insertScientificExponent('rotX')">e</button></div></div>
                        <div class="field"><label for="rotY" id="supportRotYLabel">θy</label><div class="input-wrap has-unit"><input id="rotY" type="text" inputmode="decimal" placeholder="0" value="0"><span class="input-unit">rad</span></div><div class="length-chip-row scientific-shortcut-row"><button type="button" class="scientific-chip" onclick="insertScientificExponent('rotY')">e</button></div></div>
                        <div class="field"><label for="rotZ" id="supportRotZLabel">θz</label><div class="input-wrap has-unit"><input id="rotZ" type="text" inputmode="decimal" placeholder="0" value="0"><span class="input-unit">rad</span></div><div class="length-chip-row scientific-shortcut-row"><button type="button" class="scientific-chip" onclick="insertScientificExponent('rotZ')">e</button></div></div>
                    </div>
                </div>
                <div class="form-footer">
                    <button type="button" class="btn btn-secondary" onclick="resetSupportForm()">Reset</button>
                    <button id="supportTemplateSubmitBtn" type="submit" class="btn btn-primary">Create Custom Support</button>
                </div>
            </form>
        </div>
    </div>

    <div class="card">
        <div class="card-header">
            <div><h3>Support Templates</h3><p>Reusable support definitions.</p></div>
        </div>
        <div class="card-body">
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Support ID</th><th>Description</th><th>Restraints</th><th>Displacement</th><th>Actions</th></tr></thead>
                    <tbody id="supportTemplateTable"></tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="card">
        <div class="card-header">
            <div><h3>Assign Support to Node</h3><p>Apply a reusable support template to any node.</p></div>
        </div>
        <div class="card-body">
            <form id="supportAssignmentForm">
                <div class="grid grid-3">
                    <div class="field"><label for="supportAssignmentId">Support Assignment ID</label><input id="supportAssignmentId" placeholder="SA1" value="SA1"></div>
                    <div class="field"><label for="supportTemplateSelect">Support Template</label><select id="supportTemplateSelect"><option value="">Select support</option></select></div>
                    <div class="field"><label for="supportNodeSelect">Node ID</label><select id="supportNodeSelect"><option value="">Select node</option></select></div>
                </div>
                <div class="form-footer">
                    <button id="supportAssignmentSubmitBtn" type="submit" class="btn btn-primary">Assign Support</button>
                </div>
            </form>
        </div>
    </div>

    <div class="card">
        <div class="card-header">
            <div><h3>Assigned Supports</h3></div>
        </div>
        <div class="card-body">
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Assignment ID</th><th>Support</th><th>Node</th><th>Actions</th></tr></thead>
                    <tbody id="supportAssignmentTable"></tbody>
                </table>
            </div>
        </div>
    </div>
</section>
`);

/* ---- Logic ---- */
// ---- Support Templates ----
let editingSupportTemplateId = null;

function createSupportTemplate(data) {
    model.supportTemplates.push(data);
    markAnalysisInvalidated();
}

function updateSupportTemplate(existingId, data) {
    const support = model.supportTemplates.find((s) => s.id === existingId && !s.builtIn);
    if (!support) return false;
    const oldId = support.id;
    Object.assign(support, data);
    if (oldId !== data.id) model.supportAssignments.forEach((sa) => { if (sa.supportId === oldId) sa.supportId = data.id; });
    markAnalysisInvalidated();
    return true;
}

document.getElementById("supportTemplateForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = val("supportId");
    if (!id) return alert("Support ID is required.");
    if (hasId(model.supportTemplates, id, editingSupportTemplateId)) return alert("Support ID already exists.");
    const numericSupportValues = [[num("dispX"), "Δx"], [num("dispY"), "Δy"], [num("dispZ"), "Δz"], [num("rotX"), "θx"], [num("rotY"), "θy"], [num("rotZ"), "θz"]];
    for (const [value, label] of numericSupportValues) { const error = requireFinite(value, label); if (error) return alert(error); }
    const data = {
        id, description: val("supportDescription"), type: "custom", builtIn: false,
        restraints: { RFx: document.getElementById("RFx").checked, RFy: document.getElementById("RFy").checked, RFz: document.getElementById("RFz").checked, RMx: document.getElementById("RMx").checked, RMy: document.getElementById("RMy").checked, RMz: document.getElementById("RMz").checked },
        displacement: { dx: num("dispX"), dy: num("dispY"), dz: num("dispZ"), tx: num("rotX"), ty: num("rotY"), tz: num("rotZ") },
    };
    if (editingSupportTemplateId !== null) {
        const updated = updateSupportTemplate(editingSupportTemplateId, data);
        if (!updated) { resetSupportForm(); return; }
    } else {
        createSupportTemplate(data);
    }
    resetSupportForm();
    document.getElementById("supportId").value = getNextId(id);
    refreshAll();
});
function resetSupportForm() {
    document.getElementById("supportTemplateForm").reset();
    editingSupportTemplateId = null;
    document.getElementById("supportTemplateSubmitBtn").textContent = "Create Custom Support";
}
function editSupportTemplate(encodedId) {
    const id = decodeURIComponent(encodedId);
    const support = model.supportTemplates.find((s) => s.id === id);
    if (!support || support.builtIn) return;
    editingSupportTemplateId = support.id;
    document.getElementById("supportId").value = support.id;
    document.getElementById("supportDescription").value = support.description || "";
    ["RFx","RFy","RFz","RMx","RMy","RMz"].forEach((key) => { document.getElementById(key).checked = !!support.restraints?.[key]; });
    document.getElementById("dispX").value = support.displacement?.dx ?? 0;
    document.getElementById("dispY").value = support.displacement?.dy ?? 0;
    document.getElementById("dispZ").value = support.displacement?.dz ?? 0;
    document.getElementById("rotX").value = support.displacement?.tx ?? 0;
    document.getElementById("rotY").value = support.displacement?.ty ?? 0;
    document.getElementById("rotZ").value = support.displacement?.tz ?? 0;
    document.getElementById("supportTemplateSubmitBtn").textContent = "Update Custom Support";
}
function selectBuiltInSupport(id) {
    const select = document.getElementById("supportTemplateSelect");
    if (!select) return;
    select.value = id;
    const assignmentCard = document.getElementById("supportAssignmentForm");
    if (assignmentCard) assignmentCard.scrollIntoView({ behavior: "smooth", block: "center" });
}
function renderSupportTemplates() {
    const tbody = document.getElementById("supportTemplateTable");
    if (!model.supportTemplates.length) return showEmpty("supportTemplateTable", 5);
    const gridMode = typeof isGridAnalysisMode === "function" && isGridAnalysisMode();
    const gridRestraintLabels = { RFx: "θX", RFy: "θY", RMz: "ΔZ" };
    const allRestraintLabels = { RFx: "RFx", RFy: "RFy", RFz: "RFz", RMx: "RMx", RMy: "RMy", RMz: "RMz" };
    tbody.innerHTML = model.supportTemplates.map((s) => {
        const restraints = s.restraints || {};
        const active = Object.entries(restraints).filter(([key, value]) => !!value).map(([key]) => key);
        const effective = active.filter((key) => gridMode ? Object.prototype.hasOwnProperty.call(gridRestraintLabels, key) : Object.prototype.hasOwnProperty.call(allRestraintLabels, key));
        const ignored = gridMode ? active.filter((key) => !Object.prototype.hasOwnProperty.call(gridRestraintLabels, key)) : [];
        const labels = gridMode ? gridRestraintLabels : allRestraintLabels;
        const r = effective.map((key) => labels[key]).join(", ") || "None";
        const rText = `${escapeHtml(r)}${ignored.length ? `<br><span class="muted">Ignored in Grid: ${escapeHtml(ignored.map((key) => allRestraintLabels[key] || key).join(", "))}</span>` : ""}`;
        const d = s.displacement || {};
        const disp = gridMode
            ? `ΔZ=${escapeHtml(d.dz ?? 0)}<br>θX=${escapeHtml(d.tx ?? 0)} rad, θY=${escapeHtml(d.ty ?? 0)} rad${(Number(d.dx) || Number(d.dy) || Number(d.tz)) ? `<br><span class="muted">Unused in Grid: Δx=${escapeHtml(d.dx ?? 0)}, Δy=${escapeHtml(d.dy ?? 0)}, θz=${escapeHtml(d.tz ?? 0)}</span>` : ""}`
            : `Δx=${escapeHtml(d.dx ?? 0)}, Δy=${escapeHtml(d.dy ?? 0)}, Δz=${escapeHtml(d.dz ?? 0)}<br>θx=${escapeHtml(d.tx ?? 0)} rad, θy=${escapeHtml(d.ty ?? 0)} rad, θz=${escapeHtml(d.tz ?? 0)} rad`;
        const kind = s.builtIn ? `<span class="badge badge-blue">Built-in</span>` : `<span class="badge badge-gray">Custom</span>`;
        const action = s.builtIn ? `<span class="badge badge-gray">Protected</span>` : `<div class="table-actions"><button type="button" class="icon-btn" aria-label="Edit support template ${escapeHtml(s.id)}" title="Edit support template ${escapeHtml(s.id)}" onclick="editSupportTemplate('${encodeInlineArgument(s.id)}')">✎</button><button type="button" class="icon-btn" aria-label="Delete support template ${escapeHtml(s.id)}" title="Delete support template ${escapeHtml(s.id)}" onclick="deleteItem('supportTemplates','${encodeInlineArgument(s.id)}','id')">×</button></div>`;
        return `<tr data-sort-collection="supportTemplates" data-sort-id="${escapeHtml(encodeInlineArgument(s.id))}"><td>${sortHandle(s.id)}${escapeHtml(s.id)}</td><td>${escapeHtml(s.description)}<br>${kind}</td><td>${rText}</td><td>${disp}</td><td>${action}</td></tr>`;
    }).join("");
}

// ---- Support Assignments (apply a support template to a node) ----
let editingSupportAssignmentId = null;

function createSupportAssignment(data) {
    model.supportAssignments.push(data);
    markAnalysisInvalidated();
}

function updateSupportAssignment(existingId, data) {
    const assignment = model.supportAssignments.find((sa) => sa.id === existingId);
    if (!assignment) return false;
    Object.assign(assignment, data);
    markAnalysisInvalidated();
    return true;
}

document.getElementById("supportAssignmentForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = val("supportAssignmentId");
    if (!id) return alert("Support Assignment ID is required.");
    if (hasId(model.supportAssignments, id, editingSupportAssignmentId)) return alert("Support Assignment ID already exists.");
    const supportId = val("supportTemplateSelect");
    const nodeId = val("supportNodeSelect");
    let error = requireReference(model.supportTemplates, supportId, "Support Template");
    if (error) return alert(error);
    error = requireReference(model.nodes, nodeId, "Support Node");
    if (error) return alert(error);
    const otherAssignmentOnNode = model.supportAssignments.find((assignment) =>
        String(assignment.nodeId) === String(nodeId) &&
        (editingSupportAssignmentId === null || String(assignment.id) !== String(editingSupportAssignmentId))
    );
    if (otherAssignmentOnNode) {
        return alert(`Node "${nodeId}" already has support assignment "${otherAssignmentOnNode.id}". Create one custom support template with all required restraints instead of assigning multiple supports to the same node.`);
    }
    const data = { id, supportId, nodeId };
    if (editingSupportAssignmentId !== null) {
        const updated = updateSupportAssignment(editingSupportAssignmentId, data);
        if (!updated) { resetSupportAssignmentForm(); return; }
    } else {
        createSupportAssignment(data);
    }
    resetSupportAssignmentForm();
    document.getElementById("supportAssignmentId").value = getNextId(id);
    refreshAll();
});
function resetSupportAssignmentForm() {
    document.getElementById("supportAssignmentForm").reset();
    editingSupportAssignmentId = null;
    document.getElementById("supportAssignmentSubmitBtn").textContent = "Assign Support";
}
function editSupportAssignment(encodedId) {
    const id = decodeURIComponent(encodedId);
    const assignment = model.supportAssignments.find((sa) => sa.id === id);
    if (!assignment) return;
    editingSupportAssignmentId = assignment.id;
    document.getElementById("supportAssignmentId").value = assignment.id;
    document.getElementById("supportTemplateSelect").value = assignment.supportId;
    document.getElementById("supportNodeSelect").value = assignment.nodeId;
    document.getElementById("supportAssignmentSubmitBtn").textContent = "Update Support";
}
function renderSupportAssignments() {
    const tbody = document.getElementById("supportAssignmentTable");
    if (!model.supportAssignments.length) return showEmpty("supportAssignmentTable", 4);
    tbody.innerHTML = model.supportAssignments.map((s) =>
        `<tr data-sort-collection="supportAssignments" data-sort-id="${escapeHtml(encodeInlineArgument(s.id))}"><td>${sortHandle(s.id)}${escapeHtml(s.id)}</td><td><span class="badge badge-orange">${escapeHtml(s.supportId)}</span></td><td>${escapeHtml(s.nodeId)}</td><td><div class="table-actions"><button type="button" class="icon-btn" aria-label="Edit support assignment ${escapeHtml(s.id)}" title="Edit support assignment ${escapeHtml(s.id)}" onclick="editSupportAssignment('${encodeInlineArgument(s.id)}')">✎</button><button type="button" class="icon-btn" aria-label="Delete support assignment ${escapeHtml(s.id)}" title="Delete support assignment ${escapeHtml(s.id)}" onclick="deleteItem('supportAssignments','${encodeInlineArgument(s.id)}','id')">×</button></div></td></tr>`
    ).join("");
}
