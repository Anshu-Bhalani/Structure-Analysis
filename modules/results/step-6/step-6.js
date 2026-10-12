/* ==========================================================================
 * step-6.js — Results part: Step 6
 * Step 6 — Displacements
 * Adds its menu button + panel to the Results frame, then defines its solver / render code.
 * ========================================================================== */

/* ---- Markup ---- */
mountModuleHTML(".results-detail-menu", "beforeend", `<button type="button" class="results-detail-btn" data-result-panel="result-step-6" onclick="showResultDetail('result-step-6', this)">6. Displacements</button>
`);
mountModuleHTML(".results-detail-body", "beforeend", `
<div class="result-detail-panel" id="result-step-6">
    <div class="calc-step-slot" data-step-number="6"></div>
</div>
`);

/* ---- Logic ---- */
// Reconstruct actual absolute nodal displacements from solved increments and
// prescribed support movements. For the equivalent-action formulation the
// restrained incremental displacements are zero, and [Dp] is added back here.
function reconstructActualDisplacementVector(totalDof, prescribedDisp, freeIndices, DF) {
    const D = Matrix.zeros(totalDof, 1);
    for (let i = 0; i < totalDof; i++) {
        const raw = prescribedDisp?.[i];
        const value = raw === undefined || raw === null || raw === "" ? 0 : Number(raw);
        D[i][0] = Number.isFinite(value) ? value : 0;
    }
    freeIndices.forEach((freeIndex, i) => {
        D[freeIndex][0] += Number(DF[i]?.[0]) || 0;
    });
    return D;
}

// Step 6: The prescribed-movement effect is already contained in [AD] and [AC].
// Solve the incremental free displacements as [DF] = [SFF]^-1 [AFC], then
// restore the imposed movements to recover the actual displacement vector [D].
function solveStep6(ctx, step1, step5) {
    const { totalDof, dofMap, prescribedDisp, heavyModel } = step1;
    const { numF, numR, SFF, AFC, DR, freeIndices, restIndices, freeLabels, restLabels } = step5;

    let html = `<div class="calc-step"><h4>Step 6: Calculate Displacements</h4>`;
    let DF = Matrix.zeros(numF, 1);
    let RHS = AFC.map((row) => [Number(row[0]) || 0]);
    let SFF_inv = null;
    const SFR_DR = Matrix.zeros(numF, 1); // [DR] is identically zero in the incremental system.

    if (numF === 0) {
        html += `<p>No free degrees of freedom exist. The actual nodal movements are the prescribed values [Dp].</p>`;
    } else {
        // Because [AD] = -[SJ][Dp] has already been assembled, the incremental
        // solution uses [AFC] directly; subtracting [SFR][Dp] again would double-count settlement.
        SFF_inv = Matrix.invert(SFF);
        if (!SFF_inv) {
            alert("Step 6 failed: [SFF] is singular. The structure is unstable or the boundary conditions are insufficient.");
            return null;
        }

        DF = Matrix.mul(SFF_inv, RHS);

        html += `<p>[DF] = [SFF]⁻¹[AFC]. The equivalent movement actions are already included in [AC]; actual displacements are reconstructed as [D] = [Dp] + [D_increment].</p>`;
        if (!heavyModel) {
            html += matrixEqHTML(
                [
                    { m: SFF_inv, t: "[SFF]⁻¹", top: freeLabels, right: freeLabels },
                    { m: RHS, t: "[AFC]", right: freeLabels },
                    { m: DF, t: "[DF]", right: freeLabels },
                ],
                ["×", "="]
            );
        } else {
            html += `<p><strong>[DF]:</strong> ${numF} × 1 incremental displacement vector calculated successfully.</p>`;
        }
    }

    // [Dp] is nonzero only at prescribed/ restrained DOFs. [DF] is added to
    // the free DOFs; the resulting [D] is the actual displacement used in [AM].
    const D = reconstructActualDisplacementVector(totalDof, prescribedDisp, freeIndices, DF);

    // Persist solved nodal displacements for the Results displacement diagram.
    model.nodeDisplacements = {};
    model.nodes.forEach((node) => {
        const d = dofMap[node.id];
        model.nodeDisplacements[node.id] = isGridAnalysisMode()
            ? {
                // Keep Grid's three generalized joint DOFs distinct from the
                // plane solver's UX/UY/RZ fields used by the shared diagrams.
                ux: 0, uy: 0, rz: 0,
                thetaX: d.x === null ? 0 : D[d.x][0],
                thetaY: d.y === null ? 0 : D[d.y][0],
                deltaZ: d.z === null ? 0 : D[d.z][0],
            }
            : {
                ux: d.x === null ? 0 : D[d.x][0],
                uy: d.y === null ? 0 : D[d.y][0],
                rz: d.z === null ? 0 : D[d.z][0],
            };
    });

    if (numR > 0) {
        html += `<p><strong>Restrained displacements:</strong> ${restLabels.join(", ")} use zero incremental [DR]; the actual prescribed movement values are restored from [Dp] in [D].</p>`;
    }
    html += `</div>`;

    return { DF, D, SFF_inv, RHS, SFR_DR, html };
}

function renderStep6(step6) {
    return step6.html;
}
