/* ==========================================================================
 * nodes.js — Nodes page module
 * Nodes page — node input form, node table, search.
 * Contains this page's markup (injected into .container) and its logic.
 * ========================================================================== */

/* ---- Markup ---- */
mountModuleHTML(".container", "beforeend", `
<!-- NODES -->
<section class="section" id="nodes">
    <div class="card">
        <div class="card-header">
            <div><h3>Create Node</h3><p>Define the global coordinates of a node.</p></div>
        </div>
        <div class="card-body">
            <form id="nodeForm">
                <div class="grid grid-4">
                    <div class="field"><label for="nodeId">Node ID</label><input id="nodeId" placeholder="N1" value="N1"></div>
                    <div class="field"><label for="nodeX">X Coordinate</label><div class="input-wrap has-unit"><input id="nodeX" type="text" inputmode="decimal" placeholder="0" value="0"><span class="input-unit">m</span></div><div class="length-chip-row scientific-shortcut-row"><button type="button" class="scientific-chip" onclick="insertScientificExponent('nodeX')">e</button></div></div>
                    <div class="field"><label for="nodeY">Y Coordinate</label><div class="input-wrap has-unit"><input id="nodeY" type="text" inputmode="decimal" placeholder="0" value="0"><span class="input-unit">m</span></div><div class="length-chip-row scientific-shortcut-row"><button type="button" class="scientific-chip" onclick="insertScientificExponent('nodeY')">e</button></div></div>
                    <div class="field plane-only-property"><label for="nodeZ">Z Coordinate (unused in 2D analysis)</label><div class="input-wrap has-unit"><input id="nodeZ" type="text" inputmode="decimal" placeholder="0" value="0"><span class="input-unit">m</span></div><div class="length-chip-row scientific-shortcut-row"><button type="button" class="scientific-chip" onclick="insertScientificExponent('nodeZ')">e</button></div></div>
                </div>
                <div class="form-footer">
                    <button type="button" class="btn btn-secondary" onclick="resetNodeForm()">Reset</button>
                    <button type="submit" class="btn btn-primary" id="nodeSubmitBtn">Create Node</button>
                </div>
            </form>
        </div>
    </div>

    <div class="card">
        <div class="card-header">
            <div><h3>Node List</h3><p>All nodes currently present in the model.</p></div>
            <input id="nodeSearch" class="search-box" placeholder="Search Node..." oninput="renderNodes()">
        </div>
        <div class="card-body">
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Node ID</th><th>X (m)</th><th>Y (m)</th><th class="plane-only-property">Z (m)</th><th>Actions</th></tr></thead>
                    <tbody id="nodeTable"></tbody>
                </table>
            </div>
        </div>
    </div>
</section>
`);

/* ---- Logic ---- */
// ---- Nodes ----
let editingNodeId = null;

function createNode(id, x, y, z) {
    model.nodes.push({ id, x, y, z });
    markAnalysisInvalidated();
}

function findCollapsedConnectedElement(nodeId, x, y) {
    return model.elements.find((element) => {
        let otherNodeId = null;
        if (String(element.startNode) === String(nodeId)) otherNodeId = element.endNode;
        else if (String(element.endNode) === String(nodeId)) otherNodeId = element.startNode;
        if (otherNodeId === null) return false;
        const otherNode = model.nodes.find((candidate) => String(candidate.id) === String(otherNodeId));
        return !!otherNode && Number(otherNode.x) === Number(x) && Number(otherNode.y) === Number(y);
    }) || null;
}

function updateNode(existingId, id, x, y, z) {
    const node = model.nodes.find((n) => n.id === existingId);
    if (!node) return false;
    const oldId = node.id;
    node.id = id;
    node.x = x;
    node.y = y;
    node.z = z;
    if (oldId !== id) {
        model.elements.forEach((el) => {
            if (el.startNode === oldId) el.startNode = id;
            if (el.endNode === oldId) el.endNode = id;
        });
        model.supportAssignments.forEach((sa) => { if (sa.nodeId === oldId) sa.nodeId = id; });
        model.loads.forEach((load) => { if (load.nodeId === oldId) load.nodeId = id; });
        model.moments.forEach((moment) => { if (moment.nodeId === oldId) moment.nodeId = id; });
    }
    markAnalysisInvalidated();
    return true;
}

document.getElementById("nodeForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = val("nodeId");
    const x = num("nodeX"), y = num("nodeY"), z = isGridAnalysisMode() ? 0 : num("nodeZ");
    const validationError = validateNodeInput(id, x, y, z, editingNodeId);
    if (validationError) return alert(validationError);

    if (editingNodeId !== null) {
        const collapsedElement = findCollapsedConnectedElement(editingNodeId, x, y);
        if (collapsedElement) {
            return alert(`Node edit would make element "${collapsedElement.id}" zero-length. Move the node to a different X/Y coordinate before saving.`);
        }
        const updated = updateNode(editingNodeId, id, x, y, z);
        if (!updated) {
            editingNodeId = null;
            resetNodeForm();
            return;
        }
        const nextId = getNextId(id);
        resetNodeForm();
        document.getElementById("nodeId").value = nextId;
    } else {
        createNode(id, x, y, z);
        resetNodeForm();
        document.getElementById("nodeId").value = getNextId(id);
    }

    refreshAll();
});

function resetNodeForm() {
    document.getElementById("nodeForm").reset();
    editingNodeId = null;
    document.getElementById("nodeSubmitBtn").textContent = "Create Node";
}
function renderNodes() {
    const tbody = document.getElementById("nodeTable");
    const search = val("nodeSearch").toLowerCase();
    const rows = model.nodes.filter((n) => n.id.toLowerCase().includes(search));
    if (!rows.length) return showEmpty("nodeTable", 5);
    tbody.innerHTML = rows
        .map(
            (n) =>
                `<tr data-sort-collection="nodes" data-sort-id="${escapeHtml(encodeInlineArgument(n.id))}"><td>${sortHandle(n.id)}<span class="badge badge-blue">${escapeHtml(n.id)}</span></td><td>${escapeHtml(n.x)}</td><td>${escapeHtml(n.y)}</td><td class="plane-only-property" style="display:${isGridAnalysisMode() ? "none" : "table-cell"}">${escapeHtml(n.z ?? 0)}</td><td><div class="table-actions"><button type="button" class="icon-btn" aria-label="Edit node ${escapeHtml(n.id)}" title="Edit node ${escapeHtml(n.id)}" onclick="editNode('${encodeInlineArgument(n.id)}')">✎</button><button type="button" class="icon-btn" aria-label="Delete node ${escapeHtml(n.id)}" title="Delete node ${escapeHtml(n.id)}" onclick="deleteItem('nodes','${encodeInlineArgument(n.id)}','id')">×</button></div></td></tr>`,
        )
        .join("");
}
function editNode(encodedId) {
    const id = decodeURIComponent(encodedId);
    const node = model.nodes.find((n) => n.id === id);
    if (!node) return;

    editingNodeId = node.id;
    document.getElementById("nodeId").value = node.id;
    document.getElementById("nodeX").value = node.x;
    document.getElementById("nodeY").value = node.y;
    document.getElementById("nodeZ").value = node.z;
    document.getElementById("nodeSubmitBtn").textContent = "Update Node";
}
