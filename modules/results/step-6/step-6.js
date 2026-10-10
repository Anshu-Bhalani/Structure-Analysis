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
// Step 6: Calculate displacements exactly as shown in the LPW-3 manual.
// [AFC] = [SFF]{DF} + [SFR]{DR}
// Therefore, [DF] = [SFF]^-1 ([AFC] - [SFR][DR]).
// The full displacement vector [D] is then reconstructed using the free and
// restrained DoF locations so later reaction/member-action steps can use it.
function solveStep6(ctx, step1, step5) {
    const { totalDof, dofMap, heavyModel } = step1;
    const { numF, numR, SFF, SFR, AFC, DR, freeIndices, restIndices, freeLabels, restLabels } = step5;

    let html = `<div class="calc-step"><h4>Step 6: Calculate Displacements</h4>`;
    let DF = Matrix.zeros(numF, 1);
    let RHS = Matrix.zeros(numF, 1);
    let SFF_inv = null;
    let SFR_DR = Matrix.zeros(numF, 1);

    if (numF === 0) {
        html += `<p>No free degrees of freedom exist. All structural displacements are prescribed restrained values.</p>`;
    } else {
        // Form the right-hand side from the manual equation.
        if (numR > 0) {
            SFR_DR = Matrix.mul(SFR, DR);
            RHS = Matrix.sub(AFC, SFR_DR);
        } else {
            RHS = AFC.map((row) => [row[0]]);
        }

        // The manual expresses the solution using [SFF]^-1. Reject a
        // singular/unstable free stiffness matrix rather than fabricating a
        // displacement solution.
        SFF_inv = Matrix.invert(SFF);
        if (!SFF_inv) {
            alert("Step 6 failed: [SFF] is singular. The structure is unstable or the boundary conditions are insufficient.");
            return null;
        }

        DF = Matrix.mul(SFF_inv, RHS);

        html += `<p>[DF] = [SFF]⁻¹ ([AFC] - [SFR][DR])</p>`;
        if (!heavyModel) {
            if (numR > 0) {
                html += matrixEqHTML(
                    [
                        { m: AFC, t: "[AFC]", right: freeLabels },
                        { m: SFR, t: "[SFR]", top: restLabels, right: freeLabels },
                        { m: DR, t: "[DR]", right: restLabels },
                        { m: RHS, t: "[AFC] − [SFR][DR]", right: freeLabels },
                    ],
                    ["−", "×", "="]
                );
            }
            html += matrixEqHTML(
                [
                    { m: SFF_inv, t: "[SFF]⁻¹", top: freeLabels, right: freeLabels },
                    { m: RHS, t: numR > 0 ? "([AFC] − [SFR][DR])" : "[AFC]", right: freeLabels },
                    { m: DF, t: "[DF]", right: freeLabels },
                ],
                ["×", "="]
            );
        } else {
            html += `<p><strong>[DF]:</strong> ${numF} × 1 displacement vector calculated successfully.</p>`;
        }
    }

    // Reconstruct the complete global displacement vector. Restrained DoFs
    // receive their prescribed values; free DoFs receive the solved [DF].
    const D = Matrix.zeros(totalDof, 1);
    freeIndices.forEach((fi, i) => {
        D[fi][0] = DF[i][0];
    });
    restIndices.forEach((ri, i) => {
        D[ri][0] = DR[i][0];
    });

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
        html += `<p><strong>Restrained displacements [DR]:</strong> ${restLabels.join(", ")} are imposed as prescribed support values.</p>`;
    }
    html += `</div>`;

    return { DF, D, SFF_inv, RHS, SFR_DR, html };
}

function renderStep6(step6) {
    return step6.html;
}
