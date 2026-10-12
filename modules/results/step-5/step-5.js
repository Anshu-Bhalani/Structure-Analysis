/* ==========================================================================
 * step-5.js — Results part: Step 5
 * Step 5 — Boundary conditions
 * Adds its menu button + panel to the Results frame, then defines its solver / render code.
 * ========================================================================== */

/* ---- Markup ---- */
mountModuleHTML(".results-detail-menu", "beforeend", `<button type="button" class="results-detail-btn" data-result-panel="result-step-5" onclick="showResultDetail('result-step-5', this)">5. Boundary Conditions</button>
`);
mountModuleHTML(".results-detail-body", "beforeend", `
<div class="result-detail-panel" id="result-step-5">
    <div class="calc-step-slot" data-step-number="5"></div>
</div>
`);

/* ---- Logic ---- */
// Step 5: Incorporate boundary conditions exactly as prescribed in the LPW-3 manual.
// Free DoFs are placed first (ascending order), followed by restrained DoFs
// (ascending order). The assembled stiffness matrix [SJ] and load vector [AC]
// are then partitioned into the four sub-matrices/vectors required by Step 6.
function solveStep5(ctx, step1, step4) {
    const { totalDof, isRestrained, prescribedDisp, SJ, heavyModel } = step1;
    const { AC, structurallyRelevantDof } = step4;

    // The manual numbers only the actual structural joint displacements.
    // Keep the existing model's beam/truss dummy-DoF handling intact by using
    // the structural-relevance mask created in Step 4.
    const activeIndices = [];
    for (let i = 0; i < totalDof; i++) {
        if (structurallyRelevantDof[i]) activeIndices.push(i);
    }

    const freeIndices = activeIndices.filter((i) => !isRestrained[i]);
    const restIndices = activeIndices.filter((i) => isRestrained[i]);

    const numF = freeIndices.length;
    const numR = restIndices.length;

    // Rearranged numbering required by the manual: free DoFs first, then
    // restrained DoFs, with each group remaining in ascending global order.
    const reorderedIndices = [...freeIndices, ...restIndices];
    const reorderedLabels = reorderedIndices.map((i) => i + 1);
    const freeLabels = freeIndices.map((i) => i + 1);
    const restLabels = restIndices.map((i) => i + 1);

    // Build [SJ]R and [AC]R from the reordered global system:
    // [SJ]R = [ SFF  SFR ]
    //         [ SRF  SRR ]
    // [AC]R = [ AFC ]
    //         [ ARC ]
    const SJR = Matrix.zeros(reorderedIndices.length, reorderedIndices.length);
    const ACR = Matrix.zeros(reorderedIndices.length, 1);

    reorderedIndices.forEach((ri, r) => {
        ACR[r][0] = AC[ri][0];
        reorderedIndices.forEach((ci, c) => {
            SJR[r][c] = SJ[ri][ci];
        });
    });

    const SFF = Matrix.zeros(numF, numF);
    const SFR = Matrix.zeros(numF, numR);
    const SRF = Matrix.zeros(numR, numF);
    const SRR = Matrix.zeros(numR, numR);
    const AFC = Matrix.zeros(numF, 1);
    const ARC = Matrix.zeros(numR, 1);
    // DpR stores the actual imposed support values for reporting. DR is the
    // incremental restrained displacement vector used in the transformed
    // system; it is zero because its effect is already in AD from Step 4.
    const prescribedDR = Matrix.zeros(numR, 1);
    const DR = Matrix.zeros(numR, 1);

    for (let i = 0; i < numF; i++) {
        AFC[i][0] = ACR[i][0];
        for (let j = 0; j < numF; j++) SFF[i][j] = SJR[i][j];
        for (let j = 0; j < numR; j++) SFR[i][j] = SJR[i][numF + j];
    }

    for (let i = 0; i < numR; i++) {
        ARC[i][0] = ACR[numF + i][0];
        prescribedDR[i][0] = Number.isFinite(Number(prescribedDisp[restIndices[i]]))
            ? Number(prescribedDisp[restIndices[i]])
            : 0;
        DR[i][0] = 0;
        for (let j = 0; j < numF; j++) SRF[i][j] = SJR[numF + i][j];
        for (let j = 0; j < numR; j++) SRR[i][j] = SJR[numF + i][numF + j];
    }

    let html = `<div class="calc-step"><h4>Step 5: Incorporate Boundary Conditions</h4>`;
    html += `<p>[SJ] and [AC] are rearranged so that free degrees of freedom are listed first, followed by restrained degrees of freedom. Prescribed movements have already been converted to equivalent actions [AD] in Step 4. The solve therefore uses zero incremental restrained displacement [DR] = 0; the actual prescribed movement vector [Dp] is restored in Step 6.</p>`;

    if (reorderedIndices.length > 0) {
        html += `<h5>Rearranged System [SJR] and [AC]R</h5>`;
        if (!heavyModel) {
            html += matrixEqHTML(
                [
                    { m: SJR, t: "[SJ]R", top: reorderedLabels, right: reorderedLabels },
                    { m: ACR, t: "[AC]R", right: reorderedLabels },
                ],
                [" "]
            );
        } else {
            html += `<p><strong>[SJ]R:</strong> ${SJR.length} × ${SJR.length} &nbsp;&nbsp; <strong>[AC]R:</strong> ${ACR.length} × 1</p>`;
        }
    }

    html += `<h5>Free / Restrained Partition</h5>`;
    if (numF > 0) {
        if (!heavyModel) {
            html += matrixEqHTML(
                [
                    { m: SFF, t: "[SFF]", top: freeLabels, right: freeLabels },
                    { m: SFR, t: "[SFR]", top: restLabels, right: freeLabels },
                    { m: AFC, t: "[AFC]", right: freeLabels },
                ],
                [" ", " "]
            );
        } else {
            html += `<p><strong>[SFF]:</strong> ${numF} × ${numF} &nbsp;&nbsp; <strong>[SFR]:</strong> ${numF} × ${numR} &nbsp;&nbsp; <strong>[AFC]:</strong> ${numF} × 1</p>`;
        }
    } else {
        html += `<p>No free structural degrees of freedom are present.</p>`;
    }

    if (numR > 0) {
        html += `<p><strong>Restrained DoFs:</strong> ${restLabels.join(", ")} &nbsp;&nbsp; <strong>[Dp]R:</strong> prescribed support movements; <strong>[DR]:</strong> zero incremental values.</p>`;
        if (!heavyModel) {
            html += matrixEqHTML(
                [
                    { m: SRF, t: "[SRF]", top: freeLabels, right: restLabels },
                    { m: SRR, t: "[SRR]", top: restLabels, right: restLabels },
                    { m: ARC, t: "[ARC]", right: restLabels },
                    { m: prescribedDR, t: "[Dp]R (actual prescribed)", right: restLabels },
                    { m: DR, t: "[DR] (incremental = 0)", right: restLabels },
                ],
                [" ", " ", " ", " "]
            );
        }
    } else {
        html += `<p><strong>Restrained DoFs:</strong> None.</p>`;
    }

    html += `</div>`;

    return {
        freeIndices,
        restIndices,
        reorderedIndices,
        numF,
        numR,
        SJR,
        ACR,
        SFF,
        SFR,
        SRF,
        SRR,
        AFC,
        ARC,
        prescribedDR,
        DR,
        freeLabels,
        restLabels,
        html,
    };
}

function renderStep5(step5) {
    return step5.html;
}
