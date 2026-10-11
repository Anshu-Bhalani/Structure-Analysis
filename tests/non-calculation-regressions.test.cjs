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
    const files = ["assets/js/main.js", "modules/home/home.js", "modules/load/load.js", "modules/moment/moment.js", "modules/results/results.js"];
    for (const relativePath of files) {
        const source = fs.readFileSync(path.join(root, relativePath), "utf8");
        assert.doesNotThrow(() => new Function(source), relativePath + " should parse");
    }
});
