"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mainSource = fs.readFileSync(path.join(root, "assets/js/main.js"), "utf8");

function section(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    assert.notEqual(start, -1, "missing source marker: " + startMarker);
    assert.notEqual(end, -1, "missing end marker: " + endMarker);
    return source.slice(start, end).trim();
}

const builtInSupportTemplates = [
    { id: "FIXED", restraints: { RFx: true, RFy: true, RFz: true, RMx: true, RMy: true, RMz: true }, displacement: { dx: 0, dy: 0, dz: 0, tx: 0, ty: 0, tz: 0 } },
    { id: "ROLLER", restraints: { RFx: false, RFy: true, RFz: false, RMx: false, RMy: false, RMz: false }, displacement: { dx: 0, dy: 0, dz: 0, tx: 0, ty: 0, tz: 0 } },
    { id: "HINGED", restraints: { RFx: true, RFy: true, RFz: false, RMx: false, RMy: false, RMz: false }, displacement: { dx: 0, dy: 0, dz: 0, tx: 0, ty: 0, tz: 0 } }
];

const validatorSource = section(mainSource, "function validatePersistedInputModel(source) {", "\nfunction resetAllEditForms()");
const validate = new Function("AppConfig", "normalizeLegacySelfWeightModel",
    validatorSource + "\nreturn validatePersistedInputModel;"
)({
    persistedModelKeys: ["nodes", "elementTemplates", "elements", "supportTemplates", "supportAssignments", "loadCases", "loads", "momentCases", "moments"],
    builtInSupportTemplates
}, (value) => value);

function baseModel(mode) {
    const grid = mode === "grid";
    return {
        analysisMode: mode || "plane",
        nodes: [{ id: "N1", x: 0, y: 0, z: 0 }, { id: "N2", x: 4, y: 0, z: 0 }],
        elementTemplates: [grid ? { id: "T1", I: 1, E_GPa: 1, G_GPa: 1, J: 1 } : { id: "T1", I: 1, E_GPa: 1, A: 1 }],
        elements: [{ id: "E1", templateId: "T1", startNode: "N1", endNode: "N2" }],
        supportTemplates: [], supportAssignments: [],
        loadCases: [{ id: "LC1", type: "Dead" }], loads: [],
        momentCases: [{ id: "MC1", type: "Dead" }], moments: []
    };
}

test("Plane import accepts blank ignored Mx/My when active Mz is valid", () => {
    const model = baseModel("plane");
    model.moments = [{ id: "M1", momentCaseId: "MC1", type: "Nodal Moment", nodeId: "N1", Mx: "", My: "", Mz: 5 }];
    assert.equal(validate(model), true);
});

test("Grid import still requires active Mx/My components", () => {
    const model = baseModel("grid");
    model.moments = [{ id: "M1", momentCaseId: "MC1", type: "Nodal Moment", nodeId: "N1", Mx: "", My: 5, Mz: 0 }];
    assert.throws(() => validate(model), /Mx must be a finite number/);
});

test("UDL import accepts missing end distance and end intensities using UI defaults", () => {
    const model = baseModel("plane");
    model.loads = [{ id: "L1", loadCaseId: "LC1", type: "Element UDL", elementId: "E1", distance: 1, distanceEnd: "", Fx: 0, Fy: -2 }];
    assert.equal(validate(model), true);
});

test("import rejects numeric references instead of accepting string-coercion matches", () => {
    const model = baseModel("plane");
    model.elements[0].startNode = 1;
    assert.throws(() => validate(model), /References must match an existing string ID exactly/);
});

test("custom supports cannot shadow reserved built-in support IDs", () => {
    const model = baseModel("plane");
    model.supportTemplates = [{
        id: "FIXED", description: "Custom", type: "custom", builtIn: false,
        restraints: { RFx: false, RFy: false, RFz: false, RMx: false, RMy: false, RMz: false },
        displacement: { dx: 0, dy: 0, dz: 0, tx: 0, ty: 0, tz: 0 }
    }];
    assert.throws(() => validate(model), /reserved for a built-in support/);
});

test("import rejects unsafe __proto__ entity IDs", () => {
    const model = baseModel("plane");
    model.nodes[0].id = "__proto__";
    assert.throws(() => validate(model), /reserved ID "__proto__"/);
});

test("malformed saved-library data is preserved and a save is refused", () => {
    const getLibrarySource = section(mainSource, "function getModelLibrary() {", "\nfunction getModelLibraryReadFailureMessage()");
    const readMessageSource = section(mainSource, "function getModelLibraryReadFailureMessage() {", "\nfunction setModelLibrary(");
    const saveSource = section(mainSource, "function saveCurrentModelToLibrary(silent = false) {", "\nfunction saveModel()");
    const harnessCode = [
        "let lastModelLibraryReadFailed = false;",
        "let lastModelLibraryWriteSucceeded = true;",
        "let lastModelSaveStorageFailed = false;",
        "let currentModelLibraryId = '';",
        "const stored = { structuralModels: rawValue };",
        "let writeCount = 0;",
        "const safeStorageGetItem = (key) => Object.prototype.hasOwnProperty.call(stored, key) ? stored[key] : null;",
        "const safeStorageSetItem = (key, value) => { writeCount++; stored[key] = String(value); return true; };",
        "const safeStorageRemoveItem = (key) => { writeCount++; delete stored[key]; return true; };",
        "const normalizeModelLibraryRecords = (source) => ({ library: source, changed: false });",
        "const normalizeLegacySelfWeightModel = (value) => value;",
        "const modelNameKey = (value) => String(value || '').replace(/\\s+/g, '').toLowerCase();",
        "const getPersistedInputModel = () => ({});",
        "const getModelName = () => 'Test Model';",
        "const findDuplicateModel = () => null;",
        "const createModelLibraryId = () => 'test-id';",
        "const setModelLibrary = (value) => { writeCount++; stored.structuralModels = JSON.stringify(value); lastModelLibraryWriteSucceeded = true; return value; };",
        "const renderModelLibrary = () => {};",
        "const alert = () => {};",
        "const console = { warn: () => {} };",
        "const document = { getElementById: () => null };",
        getLibrarySource,
        readMessageSource,
        saveSource,
        "return { save: () => saveCurrentModelToLibrary(true), state: () => ({ readFailed: lastModelLibraryReadFailed, saveFailed: lastModelSaveStorageFailed, writeCount, rawValue: stored.structuralModels }) };"
    ].join("\n");
    const factory = new Function("rawValue", harnessCode);
    const badValues = ["{ definitely not valid JSON", JSON.stringify({ brokenRecord: null })];
    for (const rawBad of badValues) {
        const harness = factory(rawBad);
        assert.equal(harness.save(), false);
        const state = harness.state();
        assert.equal(state.readFailed, true);
        assert.equal(state.saveFailed, true);
        assert.equal(state.writeCount, 0);
        assert.equal(state.rawValue, rawBad);
    }
});

test("application JavaScript files parse", () => {
    const files = ["assets/js/main.js", "modules/home/home.js", "modules/nodes/nodes.js", "modules/elements/elements.js", "modules/load-case/load-case.js", "modules/load/load.js", "modules/moment-case/moment-case.js", "modules/moment/moment.js", "modules/results/results.js"];
    for (const relativePath of files) {
        const source = fs.readFileSync(path.join(root, relativePath), "utf8");
        assert.doesNotThrow(() => new Function(source), relativePath + " should parse");
    }
});


test("import rejects nodes that share the same X/Y coordinates", () => {
    const model = baseModel("plane");
    model.nodes.push({ id: "N3", x: 4, y: 0, z: 0 });
    assert.throws(() => validate(model), /share the same X\/Y coordinates/);
});

test("next ID preserves the existing numeric suffix width", () => {
    const nextIdSource = section(mainSource, "function getNextId(currentId) {", "\nfunction val(");
    const getNextId = new Function(nextIdSource + "\nreturn getNextId;")();
    assert.equal(getNextId("N09"), "N10");
    assert.equal(getNextId("N009"), "N010");
    assert.equal(getNextId("E99"), "E100");
});

test("live node validation rejects duplicate coordinates while allowing the edited node's own coordinates", () => {
    const nodeValidationSource = section(mainSource, "function validateNodeInput(id, x, y, z, editingId = null) {", "\n// ==========================================================================\n// 4. MATRIX ALGEBRA UTILITIES");
    const model = { nodes: [{ id: "N1", x: 0, y: 0 }, { id: "N2", x: 4, y: 0 }] };
    const hasId = (items, id, editingId = null) => items.some((item) => item.id === id && item.id !== editingId);
    const requireFinite = (value, label) => Number.isFinite(Number(value)) ? null : `${label} must be finite.`;
    const validateNodeInput = new Function("model", "hasId", "requireFinite", nodeValidationSource + "\nreturn validateNodeInput;")(model, hasId, requireFinite);
    assert.match(validateNodeInput("N3", 4, 0, 0), /unique X\/Y coordinates/);
    assert.equal(validateNodeInput("N2", 4, 0, 0, "N2"), null);
});

test("moving a node cannot leave point loads, UDLs, or member moments outside the new element length", () => {
    const nodesSource = fs.readFileSync(path.join(root, "modules/nodes/nodes.js"), "utf8");
    const movementSource = section(nodesSource, "function findNodeMoveDistanceViolation(nodeId, x, y) {", "\nfunction updateNode(");
    const model = {
        nodes: [{ id: "N1", x: 0, y: 0 }, { id: "N2", x: 4, y: 0 }],
        elements: [{ id: "E1", startNode: "N1", endNode: "N2" }],
        loads: [{ id: "L1", type: "Element Point Load", elementId: "E1", distance: 3 }],
        moments: []
    };
    const findViolation = new Function("model", movementSource + "\nreturn findNodeMoveDistanceViolation;")(model);
    assert.match(findViolation("N2", 2, 0), /load "L1"/);
    assert.equal(findViolation("N2", 5, 0), null);
    model.loads = [{ id: "L2", type: "Element UDL", elementId: "E1", distance: 1, distanceEnd: 3.5 }];
    assert.match(findViolation("N2", 3, 0), /UDL "L2"/);
    model.loads = [];
    model.moments = [{ id: "M1", type: "Element Moment", elementId: "E1", distance: 3.5 }];
    assert.match(findViolation("N2", 3, 0), /moment\/torsion "M1"/);
});

test("missing self-weight values are detected; explicitly entered zero is valid", () => {
    const helperSource = section(mainSource, "function getMissingSelfWeightElement(loadCase, elements = model.elements) {", "\nfunction getModelName()");
    const model = { elements: [{ id: "E1" }, { id: "E2" }] };
    const getMissing = new Function("model", helperSource + "\nreturn getMissingSelfWeightElement;")(model);
    const loadCase = { id: "SW1", type: "Self Weight", memberSelfWeights: { E1: 2 } };
    assert.equal(getMissing(loadCase).id, "E2");
    loadCase.memberSelfWeights.E2 = 0;
    assert.equal(getMissing(loadCase), null);
    assert.equal(getMissing({ type: "Dead", memberSelfWeights: {} }), null);
});

test("changing a Self Weight load case to another type clears stale member weights", () => {
    const loadCaseSource = fs.readFileSync(path.join(root, "modules/load-case/load-case.js"), "utf8");
    const updateSource = section(loadCaseSource, "function updateLoadCase(existingId, data) {", "\ndocument.getElementById(\"loadCaseForm\")");
    const loadCase = { id: "SW1", type: "Self Weight", description: "Weights", memberSelfWeights: { E1: 3 } };
    const model = { loadCases: [loadCase], loads: [] };
    let activeLoadCaseId = "SW1";
    let invalidated = false;
    const update = new Function("model", "activeLoadCaseId", "markAnalysisInvalidated", updateSource + "\nreturn updateLoadCase;")(
        model,
        activeLoadCaseId,
        () => { invalidated = true; }
    );
    assert.equal(update("SW1", { id: "LC1", type: "Dead", description: "Dead loads" }), true);
    assert.equal(Object.prototype.hasOwnProperty.call(loadCase, "memberSelfWeights"), false);
    assert.equal(model.loadCases[0].id, "LC1");
    assert.equal(invalidated, true);
});

test("navigation no longer rerenders every model table and diagram", () => {
    const switchSource = section(mainSource, "function switchSection(id, btnEl) {", "\nfunction goHome()");
    assert.doesNotMatch(switchSource, /refreshAll\s*\(/);
});

test("Clear Model resets analysis mode and item deletion resets the matching edit form", () => {
    const clearSource = section(mainSource, "function clearModel() {", "\n// ==========================================================================\n// 7. NAVIGATION");
    assert.match(clearSource, /model\.analysisMode\s*=\s*"plane"/);
    const deleteSource = section(mainSource, "function deleteItem(collection, encodedValue, property) {", "\nfunction refreshAll()");
    for (const identifier of ["editingNodeId", "editingElementTemplateId", "editingElementId", "editingSupportTemplateId", "editingSupportAssignmentId", "editingLoadCaseId", "editingLoadId", "editingMomentCaseId", "editingMomentId"]) {
        assert.match(deleteSource, new RegExp(identifier));
    }
});

test("single-model import offers replacing without saving and does not abort on Cancel", () => {
    const importSource = section(mainSource, "function importModel(event) {", "\nfunction resetActiveModelAfterSavedModelDeletion()");
    assert.match(importSource, /Choose OK to save the current model first, or Cancel to replace it without saving/);
    assert.match(importSource, /if \(saveBeforeReplace\)\s*\{/);
    assert.doesNotMatch(importSource, /if\s*\(!saveBeforeReplace\)\s*return/);
});

test("saving no longer writes a second full-model copy to legacy storage", () => {
    const saveSource = section(mainSource, "function saveCurrentModelToLibrary(silent = false) {", "\nfunction saveModel()");
    assert.doesNotMatch(saveSource, /safeStorageSetItem\("structuralInputModel"/);
    assert.match(saveSource, /safeStorageRemoveItem\("structuralInputModel"\)/);
    assert.match(saveSource, /lastModelLibraryWriteSucceeded\s*&&/);
});

test("Plane import ignores blank Fz when the active Fx/Fy values are valid", () => {
    const model = baseModel("plane");
    model.loads = [{ id: "L1", loadCaseId: "LC1", type: "Nodal Load", nodeId: "N1", Fx: 1, Fy: -2, Fz: "" }];
    assert.equal(validate(model), true);
});

test("storage failure is reported as failure and never as a successful save", () => {
    const getLibrarySource = section(mainSource, "function getModelLibrary() {", "\nfunction getModelLibraryReadFailureMessage()");
    const readMessageSource = section(mainSource, "function getModelLibraryReadFailureMessage() {", "\nfunction setModelLibrary(");
    const saveSource = section(mainSource, "function saveCurrentModelToLibrary(silent = false) {", "\nfunction saveModel()");
    const harnessCode = [
        "let lastModelLibraryWriteSucceeded = true;",
        "let lastModelSaveStorageFailed = false;",
        "let lastModelLibraryReadFailed = false;",
        "let currentModelLibraryId = '';",
        "const stored = { structuralModels: '{}' };",
        "const alerts = [];",
        "const safeStorageGetItem = (key) => Object.prototype.hasOwnProperty.call(stored, key) ? stored[key] : null;",
        "const safeStorageSetItem = (key, value) => false;",
        "const safeStorageRemoveItem = (key) => { delete stored[key]; return true; };",
        "const normalizeModelLibraryRecords = (source) => ({ library: source, changed: false });",
        "const normalizeLegacySelfWeightModel = (value) => value;",
        "const modelNameKey = (value) => String(value || '').replace(/\\s+/g, '').toLowerCase();",
        "const getPersistedInputModel = () => ({ nodes: [{ id: 'N1' }] });",
        "const getModelName = () => 'Test Model';",
        "const findDuplicateModel = () => null;",
        "const createModelLibraryId = () => 'test-id';",
        "const setModelLibrary = (value) => { lastModelLibraryWriteSucceeded = safeStorageSetItem('structuralModels', JSON.stringify(value)); return value; };",
        "const getAvailableModelName = (name) => name;",
        "const renderModelLibrary = () => {};",
        "const alert = (message) => alerts.push(String(message));",
        "const console = { warn: () => {} };",
        "const document = { getElementById: () => ({ value: 'Test Model' }) };",
        getLibrarySource,
        readMessageSource,
        saveSource,
        "return { save: () => saveCurrentModelToLibrary(false), state: () => ({ failed: lastModelSaveStorageFailed, alerts, stored }) };"
    ].join("\n");
    const harness = new Function(harnessCode)();
    assert.equal(harness.save(), false);
    const state = harness.state();
    assert.equal(state.failed, true);
    assert.ok(state.alerts.some((message) => /NOT confirmed saved/.test(message)));
    assert.ok(state.alerts.every((message) => !/saved in browser storage/.test(message)));
});
