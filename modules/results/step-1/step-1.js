/* ==========================================================================
 * step-1.js — Results part: Step 1
 * Step 1 — Degrees of freedom & numbering (solver + DoF numbering helpers)
 * Adds its menu button + panel to the Results frame, then defines its solver / render code.
 * ========================================================================== */

/* ---- Markup ---- */
mountModuleHTML(".results-detail-menu", "beforeend", `<button type="button" class="results-detail-btn active" data-result-panel="result-step-1" onclick="showResultDetail('result-step-1', this)">1. DoF &amp; Numbering</button>
`);
mountModuleHTML(".results-detail-body", "beforeend", `
<div class="result-detail-panel active" id="result-step-1">
    <div class="calc-step-slot" data-step-number="1"></div>
</div>
`);

/* ---- Logic ---- */
function buildStructuralDofNumbering() {
    if (isGridAnalysisMode()) {
        const dofMap = {};
        const dofInfo = [];
        let dofCounter = 0;
        model.nodes.forEach((node, index) => {
            const d = { x: dofCounter++, y: dofCounter++, z: dofCounter++, num: index };
            dofInfo[d.x] = { nodeId: node.id, dofLabel: "θX" };
            dofInfo[d.y] = { nodeId: node.id, dofLabel: "θY" };
            dofInfo[d.z] = { nodeId: node.id, dofLabel: "ΔZ" };
            dofMap[node.id] = d;
        });
        return { dofMap, dofInfo, totalDof: dofCounter };
    }
    const dofMap = {};
    const dofInfo = [];
    let dofCounter = 0;
    const dofConfig = getGlobalDofNumberingConfig();

    // The Neglect X / Neglect Moment M switches are optional controls.
    // New Beam templates use their actual area when X is included; when Ignore
    // X is checked, beam-only joints do not get axial DOFs. Truss and Frame
    // retain their existing axial behavior. Shared nodes use the union of DOFs.
    // The numbering is compressed, so an omitted DOF never reserves a number.
    model.nodes.forEach((node, index) => {
        const relevance = getNodeStructuralDofRelevance(node.id);
        const d = { x: null, y: null, z: null, num: index };

        if (!dofConfig.skipAxial || relevance.ux) {
            d.x = dofCounter++;
            dofInfo[d.x] = { nodeId: node.id, dofLabel: "UX" };
        }

        if (relevance.uy) {
            d.y = dofCounter++;
            dofInfo[d.y] = { nodeId: node.id, dofLabel: "UY" };
        }

        if (!dofConfig.skipMoment || relevance.rz) {
            d.z = dofCounter++;
            dofInfo[d.z] = { nodeId: node.id, dofLabel: "RZ" };
        }

        dofMap[node.id] = d;
    });

    return { dofMap, dofInfo, totalDof: dofCounter };
}

function getElementLocalDofMask(element) {
    if (isGridAnalysisMode()) return [true, true, true, true, true, true];
    const type = getElementStructuralType(element);
    if (type === "beam") {
        // Beam axial stiffness uses the section area only when Ignore X is OFF.
        const template = model.elementTemplates.find((item) => item.id === element.templateId);
        const axialActive = Number(template?.A) > 0 && !getGlobalDofNumberingConfig().skipAxial;
        return [axialActive, true, true, axialActive, true, true];
    }
    if (type === "truss") {
        // Truss: X, Y at both ends. M/rotation is released.
        return [true, true, false, true, true, false];
    }
    if (type === "frame") {
        // Frame: X, Y, M at both ends.
        return [true, true, true, true, true, true];
    }
    return [false, false, false, false, false, false];
}

function getElementGlobalDofIndices(element, n1, n2, dofMap) {
    if (!element || !n1 || !n2 || !dofMap) {
        return { indices: [null, null, null, null, null, null], mask: [false, false, false, false, false, false] };
    }

    const mask = getElementLocalDofMask(element);
    const nodeDofs = dofMap;
    const globalCandidates = [
        nodeDofs[n1.id]?.x ?? null,
        nodeDofs[n1.id]?.y ?? null,
        nodeDofs[n1.id]?.z ?? null,
        nodeDofs[n2.id]?.x ?? null,
        nodeDofs[n2.id]?.y ?? null,
        nodeDofs[n2.id]?.z ?? null,
    ];

    // A member uses only the DOFs allowed by its own type. This matters at a
    // mixed node: a truss can create a global X DOF at the node, but a beam
    // connected to the same node must still ignore X in that beam's member
    // matrix. Likewise, a beam/frame can create a global M DOF that a truss
    // must not use.
    const indices = globalCandidates.map((idx, i) => mask[i] ? idx : null);
    return { indices, mask };
}

// ==========================================================================
// 16a. SOLVER ENGINE
// The LPW-3 plane-frame stiffness method solver, split into the same eight
// steps the analysis report displays. Each solveStepN() function performs
// ONLY that step's calculation and returns a structured result (or null to
// signal that a fatal condition was already reported to the user via
// alert()/confirm() and the analysis must stop). HTML report generation for
// each step lives in the matching renderStepN() function further below —
// calculation and rendering are kept separate, but each step function does
// still assemble the small amount of step-local HTML text that its own
// numbers feed into (e.g. table rows), exactly as the original single
// analysis routine did, so the displayed report is pixel-for-pixel
// unchanged.
// ==========================================================================

function solveGridStep1(ctx) {
    let gridResult;
    try {
        gridResult = GridSolver.calculateSteps1To3(model, {
            loadCaseId: activeLoadCaseId,
            momentCaseId: activeMomentCaseId,
        });
    } catch (error) {
        alert(`Grid Steps 1–3 failed: ${error && error.message ? error.message : error}`);
        return null;
    }
    ctx.gridSteps13 = gridResult;
    const source = gridResult.steps.step1;
    const dofMap = source.dofMap;
    const totalDof = source.totalDof;
    const isRestrained = new Array(totalDof).fill(false);
    const prescribedDisp = new Array(totalDof).fill(0);
    const dofInfo = new Array(totalDof);
    source.nodes.forEach((item) => {
        const map = dofMap[item.nodeId];
        const items = [
            [map.x, item.dof.thetaX, "θX"],
            [map.y, item.dof.thetaY, "θY"],
            [map.z, item.dof.deltaZ, "ΔZ"],
        ];
        items.forEach(([idx, details, label]) => {
            isRestrained[idx] = !!details.restrained;
            prescribedDisp[idx] = Number(details.prescribed) || 0;
            dofInfo[idx] = { nodeId: item.nodeId, dofLabel: label };
        });
    });

    const heavyModel = ctx.heavyModel;
    const dofSvg = model.nodes.length > 10
        ? `<div style="height:380px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;text-align:center;color:#64748b;font-family:Arial,sans-serif;border:1px dashed #cbd5e1;border-radius:8px;background:#f8fafc;"><div style="font-size:26px;">⚡</div><div style="font-size:14px;font-weight:800;color:#334155;">Large model — DoF diagram paused</div><div style="font-size:11px;line-height:1.5;max-width:420px;">Open the full-screen DoF diagram to inspect the Grid numbering.</div></div>`
        : renderDOFDiagram(800, 400);
    const html = `<div class="calc-step">
        <h4>Step 1: Grid Joint DoF Numbering and Restraints</h4>
        <p>Grid uses three degrees of freedom per joint: θX, θY and ΔZ. The supplied Grid calculation engine numbers these in node order.</p>
        <div class="canvas-container" style="background:white;border:1px solid #cbd5e1;border-radius:6px;padding:10px;margin-bottom:15px;width:100%;max-width:100%;overflow-x:auto;height:400px;">${dofSvg}</div>
        <button class="btn btn-secondary" style="width:100%;" onclick="openFullScreen('dof')">🔍 Open Full Screen Diagram</button>
    </div>`;

    return {
        dofMap, dofInfo, numNodes: model.nodes.length, totalDof, isRestrained, prescribedDisp,
        SJ: Matrix.zeros(totalDof, totalDof), AE: Matrix.zeros(totalDof, 1), AJ: Matrix.zeros(totalDof, 1),
        heavyModel, html, gridSteps13: gridResult,
    };
}

// Step 1: Divide the structure into members, assign member/joint/DoF numbers.
function solveStep1(ctx) {
    if (isGridAnalysisMode()) return solveGridStep1(ctx);
    const numbering = buildStructuralDofNumbering();
    const { dofMap, dofInfo, totalDof } = numbering;
    let numNodes = model.nodes.length;

    // Validate structural element definitions and identify zero-stiffness modes.
    for (const el of model.elements) {
        const tmpl = model.elementTemplates.find((t) => t.id === el.templateId);
        if (!tmpl) {
            alert(`Element ${el.id} references a missing element template.`);
            return null;
        }
        const A = Number(tmpl.A);
        const I = Number(tmpl.I);
        if (!Number.isFinite(A) || !Number.isFinite(I) || A < 0 || I < 0 || (A === 0 && I === 0)) {
            alert(`Element ${el.id} must have A > 0 or I > 0. Use A = 0 for a beam or I = 0 for a truss.`);
            return null;
        }
    }

    // Calculate restrained DoFs early for Step 2 UI output
    let isRestrained = new Array(totalDof).fill(false);
    let prescribedDisp = new Array(totalDof).fill(0);

    model.supportAssignments.forEach((sa) => {
        let d = dofMap[sa.nodeId];
        let t = model.supportTemplates.find((s) => s.id === sa.supportId);
        if (d && t) {
            const relevant = getNodeStructuralDofRelevance(sa.nodeId);
            const movement = getSupportAssignmentPrescribedDisplacements(sa, t);
            // A = 0 -> pure beam/flexural behavior: axial RFx is irrelevant.
            // I = 0 -> pure truss behavior: rotational RMz is irrelevant.
            if (t.restraints.RFx && relevant.ux && d.x !== null) {
                isRestrained[d.x] = true;
                prescribedDisp[d.x] = Number(movement.dx) || 0;
            }
            if (t.restraints.RFy && relevant.uy && d.y !== null) {
                isRestrained[d.y] = true;
                prescribedDisp[d.y] = Number(movement.dy) || 0;
            }
            if (t.restraints.RMz && relevant.rz && d.z !== null) {
                isRestrained[d.z] = true;
                prescribedDisp[d.z] = Number(movement.tz) || 0;
            }
        }
    });

    let SJ = Matrix.zeros(totalDof, totalDof);
    let AE = Matrix.zeros(totalDof, 1);
    let AJ = Matrix.zeros(totalDof, 1);
    const heavyModel = ctx.heavyModel;

    // Step 1: SVG DIAGRAM INSERTION
    let step1SVG = model.nodes.length > 10
        ? `<div style="height:380px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;text-align:center;color:#64748b;font-family:Arial,sans-serif;border:1px dashed #cbd5e1;border-radius:8px;background:#f8fafc;">
                <div style="font-size:26px;">⚡</div>
                <div style="font-size:14px;font-weight:800;color:#334155;">Large model — DoF diagram paused</div>
                <div style="font-size:11px;line-height:1.5;max-width:420px;">The DoF / numbering diagram is rendered only in Full Screen for models above 10 nodes.</div>
           </div>`
        : renderDOFDiagram(800, 400);

    let html = `<div class="calc-step">
        <h4>Step 1: Divide the structure into number of members and assign member number, joint number and degrees of freedom (DoF) number</h4>
        <p>Structure is divided into ${model.elements.length} members and ${model.nodes.length} joints. DoF numbering is compressed only for the neglect options selected above.</p>
        <p><strong>Numbering rule:</strong> Beam → Y,M (and X when area is positive and Ignore X is OFF) &nbsp;|&nbsp; Truss → X,Y &nbsp;|&nbsp; Frame → X,Y,M. Ignore X also suppresses axial thermal actions. Shared nodes receive the union of the applicable member DOFs.</p>
        <div class="canvas-container" style="background: white; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; margin-bottom:15px; width: 100%; max-width: 100%; overflow-x: auto; height: 400px;">
            ${step1SVG}
        </div>
        <button class="btn btn-secondary" style="width: 100%;" onclick="openFullScreen('dof')">🔍 Open Full Screen Diagram</button>
    </div>`;

    return { dofMap, dofInfo, numNodes, totalDof, isRestrained, prescribedDisp, SJ, AE, AJ, heavyModel, html };
}

function renderStep1(step1) {
    return step1.html;
}
