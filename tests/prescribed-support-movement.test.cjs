"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mainSource = fs.readFileSync(path.join(root, "assets/js/main.js"), "utf8");
const supportsSource = fs.readFileSync(path.join(root, "modules/supports/supports.js"), "utf8");
const step1Source = fs.readFileSync(path.join(root, "modules/results/step-1/step-1.js"), "utf8");
const step4Source = fs.readFileSync(path.join(root, "modules/results/step-4/step-4.js"), "utf8");
const step5Source = fs.readFileSync(path.join(root, "modules/results/step-5/step-5.js"), "utf8");
const step6Source = fs.readFileSync(path.join(root, "modules/results/step-6/step-6.js"), "utf8");
const step7Source = fs.readFileSync(path.join(root, "modules/results/step-7/step-7.js"), "utf8");

function section(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    assert.notEqual(start, -1, "missing source marker: " + startMarker);
    assert.notEqual(end, -1, "missing end marker: " + endMarker);
    return source.slice(start, end).trim();
}

function near(actual, expected, tolerance = 1e-10) {
    assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)),
        "expected " + actual + " to be within tolerance of " + expected);
}

const movementHelpersSource = section(
    mainSource,
    "const SUPPORT_MOVEMENT_FIELDS =",
    "\n// ==========================================================================\\n// 6. PERSISTENCE"
);
const movementHelpers = new Function(
    "AppConfig",
    "isGridAnalysisMode",
    movementHelpersSource + "\nreturn { normalizeLegacySupportMovementAssignments, getSupportAssignmentPrescribedDisplacements, supportTemplateRestrainsMovement };"
)({
    builtInSupportTemplates: [
        { id: "FIXED", restraints: { RFx: true, RFy: true, RFz: true, RMx: true, RMy: true, RMz: true }, displacement: { dx: 0, dy: 0, dz: 0, tx: 0, ty: 0, tz: 0 } },
        { id: "ROLLER", restraints: { RFx: false, RFy: true, RFz: false, RMx: false, RMy: false, RMz: false }, displacement: { dx: 0, dy: 0, dz: 0, tx: 0, ty: 0, tz: 0 } },
        { id: "HINGED", restraints: { RFx: true, RFy: true, RFz: false, RMx: false, RMy: false, RMz: false }, displacement: { dx: 0, dy: 0, dz: 0, tx: 0, ty: 0, tz: 0 } }
    ]
}, () => false);

function matrixApi() {
    return {
        zeros(rows, cols) {
            return Array.from({ length: rows }, () => new Array(cols).fill(0));
        },
        mul(A, B) {
            return A.map((row) => B[0].map((_, col) =>
                row.reduce((sum, value, k) => sum + value * B[k][col], 0)
            ));
        }
    };
}

const buildAD = new Function(
    "Matrix",
    section(step4Source, "function buildPrescribedMovementActionVector(", "\n// Step 4:") +
    "\nreturn buildPrescribedMovementActionVector;"
)(matrixApi());

const reconstructActualD = new Function(
    "Matrix",
    section(step6Source, "function reconstructActualDisplacementVector(", "\n// Step 6:") +
    "\nreturn reconstructActualDisplacementVector;"
)(matrixApi());

function beamBendingStiffness(E, I, L) {
    const a = 12 * E * I / (L ** 3);
    const b = 6 * E * I / (L ** 2);
    const c = 4 * E * I / L;
    const d = 2 * E * I / L;
    return [
        [a, b, -a, b],
        [b, c, -b, d],
        [-a, -b, a, -b],
        [b, d, -b, c]
    ];
}

test("AD from a prescribed settlement produces 12EIδ/L³ shears and 6EIδ/L² end actions", () => {
    const E = 30000;
    const I = 0.004;
    const L = 4;
    const delta = 0.015;
    const K = beamBendingStiffness(E, I, L);
    const { Dp, AD } = buildAD(K, [0, 0, delta, 0]);

    near(Dp[2][0], delta);
    near(AD[0][0], 12 * E * I * delta / (L ** 3));
    near(AD[1][0], 6 * E * I * delta / (L ** 2));
    near(AD[2][0], -12 * E * I * delta / (L ** 3));
    near(AD[3][0], 6 * E * I * delta / (L ** 2));
});

test("AD from a prescribed end rotation uses the corresponding EI/L and EI/L² terms", () => {
    const E = 210000;
    const I = 8e-5;
    const L = 3.5;
    const theta = 0.012;
    const K = beamBendingStiffness(E, I, L);
    const { Dp, AD } = buildAD(K, [0, 0, 0, theta]);

    near(Dp[3][0], theta);
    near(AD[0][0], -6 * E * I * theta / (L ** 2));
    near(AD[1][0], -2 * E * I * theta / L);
    near(AD[2][0], 6 * E * I * theta / (L ** 2));
    near(AD[3][0], -4 * E * I * theta / L);
});

test("actual displacement recovery adds prescribed movement after solving free increments", () => {
    const Dp = [0, 0, 0.02, 0.1];
    const DF = [[0.03], [-0.04]];
    const D = reconstructActualD(4, Dp, [0, 1], DF);
    assert.deepEqual(D, [[0.03], [-0.04], [0.02], [0.1]]);
});

test("legacy template movements migrate to every assignment and are then removed from templates", () => {
    const source = {
        analysisMode: "plane",
        supportTemplates: [{
            id: "S1",
            restraints: { RFx: true, RFy: true, RFz: false, RMx: false, RMy: false, RMz: true },
            displacement: { dx: 0.001, dy: -0.02, dz: 0, tx: 0, ty: 0, tz: 0.015 }
        }],
        supportAssignments: [
            { id: "SA1", supportId: "S1", nodeId: "N1" },
            { id: "SA2", supportId: "S1", nodeId: "N2" }
        ]
    };
    const migrated = movementHelpers.normalizeLegacySupportMovementAssignments(source);
    assert.deepEqual(migrated.supportAssignments[0].prescribedDisplacements, {
        dx: 0.001, dy: -0.02, dz: 0, tx: 0, ty: 0, tz: 0.015
    });
    assert.deepEqual(migrated.supportAssignments[1].prescribedDisplacements, migrated.supportAssignments[0].prescribedDisplacements);

    const cleaned = movementHelpers.normalizeLegacySupportMovementAssignments(migrated, { clearTemplateValues: true });
    assert.deepEqual(cleaned.supportTemplates[0].displacement, { dx: 0, dy: 0, dz: 0, tx: 0, ty: 0, tz: 0 });
    assert.equal(cleaned.supportAssignments[1].prescribedDisplacements.dy, -0.02);
});

test("explicit assignment movement overrides legacy template movement, including explicit zero", () => {
    const assignment = {
        id: "SA1", supportId: "S1", nodeId: "N1",
        prescribedDisplacements: { dx: 0, dy: 0.025, dz: 0, tx: 0, ty: 0, tz: 0 }
    };
    const template = {
        id: "S1",
        restraints: { RFx: true, RFy: true, RFz: false, RMx: false, RMy: false, RMz: true },
        displacement: { dx: 0.5, dy: 0, dz: 0, tx: 0, ty: 0, tz: 0 }
    };
    const value = movementHelpers.getSupportAssignmentPrescribedDisplacements(assignment, template);
    assert.equal(value.dx, 0);
    assert.equal(value.dy, 0.025);
});

test("Grid settlement values are permitted on the built-in vertical support", () => {
    assert.equal(movementHelpers.supportTemplateRestrainsMovement({ id: "ROLLER", restraints: { RFy: true } }, "dz", true), true);
    assert.equal(movementHelpers.supportTemplateRestrainsMovement({ id: "ROLLER", restraints: { RFy: true } }, "tx", true), false);
});

test("prescribed movements are entered and persisted per support assignment, not in template fields", () => {
    assert.match(supportsSource, /id="assignmentDispY"/);
    assert.match(supportsSource, /id="assignmentRotZ"/);
    assert.match(supportsSource, /id="assignmentDispZ"/);
    assert.match(supportsSource, /id="assignmentRotX"/);
    assert.match(supportsSource, /const data = \{ id, supportId, nodeId, prescribedDisplacements \}/);
    assert.doesNotMatch(supportsSource, /document\.getElementById\("dispX"\)/);
    assert.doesNotMatch(supportsSource, /for="dispX"/);
    assert.match(mainSource, /supportAssignments: \["id", "supportId", "nodeId", "prescribedDisplacements"\]/);
    assert.match(mainSource, /normalizeLegacySupportMovementAssignments/);
    assert.match(step1Source, /getSupportAssignmentPrescribedDisplacements\(sa, t\)/);
    assert.match(mainSource, /const movement = assignment\.prescribedDisplacements/);
});

test("Step 4 assembles AC from AE, AJ, and AD; restrained incremental displacement is zero", () => {
    assert.match(step4Source, /const physicalAC = Matrix\.add\(AE, AJ\)/);
    assert.match(step4Source, /let AC = Matrix\.add\(physicalAC, AD\)/);
    assert.match(step4Source, /return \{ Dp, AD \}/);
    assert.match(step4Source, /return \{ AC, physicalAC, AD, Dp, globalLabels, structurallyRelevantDof, html \}/);
    assert.match(step5Source, /DR\[i\]\[0\] = 0/);
    assert.match(step5Source, /prescribedDR/);
});

test("Step 6 uses actual total displacement for Step 7 member end actions", () => {
    assert.match(step6Source, /reconstructActualDisplacementVector\(totalDof, prescribedDisp, freeIndices, DF\)/);
    assert.match(step7Source, /const \{ DF, D \} = step6/);
    assert.match(step7Source, /Matrix\.mul\(el\.RT, DS\)/);
    assert.doesNotMatch(step7Source, /SRR_DR/);
});
