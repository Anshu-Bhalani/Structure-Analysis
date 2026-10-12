/* ==========================================================================
 * step-4.js — Results part: Step 4
 * Step 4 — Global stiffness assembly
 * Adds its menu button + panel to the Results frame, then defines its solver / render code.
 * ========================================================================== */

/* ---- Markup ---- */
mountModuleHTML(".results-detail-menu", "beforeend", `<button type="button" class="results-detail-btn" data-result-panel="result-step-4" onclick="showResultDetail('result-step-4', this)">4. Global Assembly</button>
`);
mountModuleHTML(".results-detail-body", "beforeend", `
<div class="result-detail-panel" id="result-step-4">
    <div class="calc-step-slot" data-step-number="4"></div>
</div>
`);

/* ---- Logic ---- */
// Prescribed movements are converted to equivalent nodal actions using the
// already-assembled global stiffness matrix. [AD] = -[SJ][Dp], where [Dp]
// contains imposed support movements at restrained DOFs and zero elsewhere.
// The solution then uses zero incremental movement at those supports; the
// actual displacement vector is reconstructed as D = Dp + D_increment.
function buildPrescribedMovementActionVector(SJ, prescribedDisp) {
    const totalDof = SJ.length;
    const Dp = Matrix.zeros(totalDof, 1);
    for (let i = 0; i < totalDof; i++) {
        const raw = prescribedDisp?.[i];
        const value = raw === undefined || raw === null || raw === "" ? 0 : Number(raw);
        Dp[i][0] = Number.isFinite(value) ? value : 0;
    }

    const stiffnessTimesMovement = Matrix.mul(SJ, Dp);
    const AD = Matrix.zeros(totalDof, 1);
    for (let i = 0; i < totalDof; i++) {
        AD[i][0] = -(Number(stiffnessTimesMovement[i]?.[0]) || 0);
    }
    return { Dp, AD };
}

// Step 4: Assemble [AC] = [AE] + [AJ] + [AD] + [AT], display the assembled
// system, then guard against zero-stiffness (unstable) DoFs before partitioning.
function assembleGlobalLoadVector(AE, AJ, AD, AT) {
    const physicalAC = Matrix.add(AE, AJ);
    let AC = Matrix.add(physicalAC, AD);
    AC = Matrix.add(AC, AT);
    return { AC, physicalAC };
}

function solveStep4(ctx, step1, step3) {
    const { dofMap, dofInfo, totalDof, isRestrained, prescribedDisp, heavyModel } = step1;
    const { SJ, AE, AJ } = step3;
    const AT = step3.AT || Matrix.zeros(AE.length, 1);
    const activeCaseLabel = ctx.activeCaseLabel;

    let globalLabels = Array.from({ length: totalDof }, (_, i) => i + 1);
    const { Dp, AD } = buildPrescribedMovementActionVector(SJ, prescribedDisp);
    const { AC, physicalAC } = assembleGlobalLoadVector(AE, AJ, AD, AT);

    let html = "";
    if (!heavyModel) {
        html += `<div class="calc-step"><h4>Step 4: Assembled Stiffness Matrix [SJ] & Load Vector [AC]</h4><p><strong>Active analysis:</strong> ${escapeHtml(activeCaseLabel)}</p>`;
    }
    if (!heavyModel) {
        html += matrixEqHTML(
            [{ m: SJ, t: "[SJ] (Global Assembly)", top: globalLabels, right: globalLabels }],
            [],
        );
    }
    if (!heavyModel) {
        html += `<p>[AD] = −[SJ][Dp]. Prescribed translations are entered in mm and converted to m before solving; rotations remain in rad. Lengths are m, I is m⁴, E is kN/m², and α is 1/°C. Therefore [AD] entries are kN at translational DOFs and kN·m at rotational DOFs. [AT] contains the equivalent global nodal actions from member temperature effects; its translation entries are kN and rotation entries are kN·m. The assembled load vector is [AC] = [AE] + [AJ] + [AD] + [AT].</p>`;
        html += matrixEqHTML(
            [
                { m: AE, t: "[AE]", right: globalLabels },
                { m: AJ, t: "[AJ]", right: globalLabels },
                { m: AD, t: "[AD]", right: globalLabels },
                { m: AT, t: "[AT] (Thermal Actions)", right: globalLabels },
                { m: AC, t: "[AC]", right: globalLabels },
            ],
            ["+", "+", "+", "="],
        );
    }
    if (!heavyModel) {
        html += `</div>`;
    }

    // --- ZERO-STIFFNESS DOF WARNING ---
    // Never silently change the mathematical model by auto-restraining a DOF.
    // First determine which joint DOFs are structurally relevant. Intentional
    // dummy DOFs are not part of the stiffness system: UX for a pure beam node
    // and RZ for a pure truss node are therefore excluded, not restrained.
    const structurallyRelevantDof = new Array(totalDof).fill(false);
    model.nodes.forEach((node) => {
        const d = dofMap[node.id];
        const relevance = getNodeStructuralDofRelevance(node.id);
        if (d.x !== null) structurallyRelevantDof[d.x] = !!relevance.ux;
        if (d.y !== null) structurallyRelevantDof[d.y] = !!relevance.uy;
        if (d.z !== null) structurallyRelevantDof[d.z] = !!relevance.rz;
    });

    const zeroStiffnessDofs = [];
    for (let i = 0; i < totalDof; i++) {
        // Intentional beam/truss dummy DOFs are excluded from this warning.
        if (!structurallyRelevantDof[i]) continue;
        if (!isNumericallyZeroStiffnessDof(SJ, i) || isRestrained[i]) continue;

        const info = dofInfo?.[i] || { nodeId: `DOF ${i + 1}`, dofLabel: "DOF" };

        zeroStiffnessDofs.push({
            nodeId: info.nodeId,
            dofLabel: info.dofLabel,
            hasLoad: Math.abs(AC[i][0]) >= 1e-10,
        });
    }

    if (zeroStiffnessDofs.length > 0) {
        const detail = zeroStiffnessDofs
            .map((d) => `${d.nodeId} ${d.dofLabel}${d.hasLoad ? " (load applied)" : ""}`)
            .join(", ");
        alert(
            `Warning: Zero-stiffness DOF detected at ${detail}.\n\n` +
            `The solver will NOT automatically restrain these DOFs.\n` +
            `Check the model connectivity, element properties, and support conditions before running the analysis again.`,
        );
        return null;
    }

    return { AC, physicalAC, AD, Dp, globalLabels, structurallyRelevantDof, html };
}

function renderStep4(step4) {
    return step4.html;
}
