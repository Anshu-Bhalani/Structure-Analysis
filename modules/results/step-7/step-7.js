/* ==========================================================================
 * step-7.js — Results part: Step 7
 * Step 7 — Reactions & member end forces
 * Adds its menu button + panel to the Results frame, then defines its solver / render code.
 * ========================================================================== */

/* ---- Markup ---- */
mountModuleHTML(".results-detail-menu", "beforeend", `<button type="button" class="results-detail-btn" data-result-panel="result-step-7" onclick="showResultDetail('result-step-7', this)">7. Reactions &amp; Member Actions</button>
`);
mountModuleHTML(".results-detail-body", "beforeend", `
<div class="result-detail-panel" id="result-step-7">
    <div class="calc-step-slot" data-step-number="7"></div>
</div>
`);

/* ---- Logic ---- */
// Step 7: Recover support reactions from the incremental system.
// Since prescribed-movement actions [AD] are included in [AC] and restrained
// incremental displacements [DR] are zero, [AR] = -[ARC] + [SRF][DF].
// Member end actions always use actual displacements restored in [D].
function solveStep7(ctx, step1, step4, step5, step6) {
    const { dofMap, heavyModel } = step1;
    const { AC } = step4;
    const { numF, numR, SRF, ARC, restIndices, freeLabels, restLabels } = step5;
    const { DF, D } = step6;

    let SRF_DF = Matrix.zeros(numR, 1);
    if (numF > 0 && numR > 0) SRF_DF = Matrix.mul(SRF, DF);

    let negARC = Matrix.zeros(numR, 1);
    for (let i = 0; i < numR; i++) negARC[i][0] = -ARC[i][0];

    let AR = Matrix.zeros(numR, 1);
    for (let i = 0; i < numR; i++) {
        AR[i][0] = -ARC[i][0] + SRF_DF[i][0];
    }

    let html = "";
    if (!heavyModel) {
        html += `<div class="calc-step"><h4>Step 7: Support Reactions [AR] and Member End Actions [AM]</h4>`;
    }
    if (!heavyModel) {
        html += `<h5>Support Reactions [AR]</h5>`;
    }
    if (numR > 0) {
        if (!heavyModel) {
            html += numF > 0
            ? `<p>[AR] = -[ARC] + [SRF][DF], because incremental [DR] = 0.</p>`
            : `<p>[AR] = -[ARC], because no free degrees of freedom exist.</p>`;
        }

        if (numF > 0) {
            if (!heavyModel) {
                html += matrixEqHTML(
                    [
                        { m: negARC, t: "-[ARC]", right: restLabels },
                        { m: SRF, t: "[SRF]", top: freeLabels, right: restLabels },
                        { m: DF, t: "[DF]", right: freeLabels },
                        { m: AR, t: "[AR]", right: restLabels },
                    ],
                    ["+", "×", "="],
                );
            }
        } else {
            if (!heavyModel) {
                html += matrixEqHTML(
                    [
                        { m: negARC, t: "-[ARC]", right: restLabels },
                        { m: AR, t: "[AR]", right: restLabels },
                    ],
                    ["="],
                );
            }
        }
    } else {
        if (!heavyModel) {
            html += `<p>No restrained degrees of freedom.</p>`;
        }
    }

    if (!heavyModel) {
        html += `<h5>Member End Actions [AM]</h5>`;
    }
    if (!heavyModel) {
        html += `<p>[AM]ᵢ = [AML]ᵢ + [SM]ᵢ[RT]ᵢ[DS]ᵢ</p>`;
    }

    // Validate global static equilibrium before the orchestrator marks results as valid.
    const equilibriumResult = updateEquilibriumCheck(AC, dofMap, model.nodes, restIndices, AR);

    // Update UI Tables
    let resDispHTML = "";
    model.nodes.forEach((n) => {
        let d = dofMap[n.id];
        resDispHTML += `<tr><td>${escapeHtml(n.id)}</td><td>${d.x === null ? "—" : formatNum(D[d.x][0])}</td><td>${d.y === null ? "—" : formatNum(D[d.y][0])}</td><td>${d.z === null ? "—" : formatNum(D[d.z][0])}</td></tr>`;
    });

    let resReactHTML = "";
    model.supportAssignments.forEach((sa) => {
        let d = dofMap[sa.nodeId];
        let rx = 0,
            ry = 0,
            rz = 0;
        restIndices.forEach((ri, i) => {
            if (d.x !== null && ri === d.x) rx = AR[i][0];
            if (d.y !== null && ri === d.y) ry = AR[i][0];
            if (d.z !== null && ri === d.z) rz = AR[i][0];
        });
        sa.rx = rx;
        sa.ry = ry;
        sa.rz = rz; // Attach reactions for SVG diagram
        const localReaction = isGridAnalysisMode() ? null : getReactionLocalComponents(sa);
        const localX = localReaction ? formatNum(localReaction.x) : "—";
        const localY = localReaction ? formatNum(localReaction.y) : "—";
        const localZ = localReaction ? formatNum(rz) : "—";
        resReactHTML += `<tr><td>${escapeHtml(sa.nodeId)}</td><td>${formatNum(rx)}</td><td>${formatNum(ry)}</td><td>${formatNum(rz)}</td><td>${localX}</td><td>${localY}</td><td>${localZ}</td></tr>`;
    });

    let resForceHTML = "";
    const elementResults = [];
    model.elements.forEach((el) => {
        let n1 = model.nodes.find((n) => n.id === el.startNode);
        let n2 = model.nodes.find((n) => n.id === el.endNode);
        const elementDofMap = getElementGlobalDofIndices(el, n1, n2, dofMap);
        let idxs = elementDofMap.indices;
        let elLabels = idxs.map((idx) => idx === null ? "—" : idx + 1);

        let DS = Matrix.zeros(6, 1);
        for (let r = 0; r < 6; r++) DS[r][0] = idxs[r] === null ? 0 : D[idxs[r]][0];

        let RT_DS = Matrix.mul(el.RT, DS);
        let SM_RT_DS = Matrix.mul(el.SM, RT_DS);
        let AM = Matrix.add(el.AML, SM_RT_DS);
        if (isGridAnalysisMode()) el.gridEndActions = AM;

        // Step 7 [AM] direct formula injection
        if (!heavyModel) {
            html += `<h6 style="margin-top:10px; color:#475569;">Element ${escapeHtml(el.id)}</h6>`;
        }
        if (!heavyModel) {
            html += matrixEqHTML(
                [
                    { m: el.AML, t: `[AML]_${el.id}`, right: elLabels },
                    { m: el.SM, t: `[SM]_${el.id}`, top: elLabels, right: elLabels },
                    { m: el.RT, t: `[RT]_${el.id}`, top: elLabels, right: elLabels },
                    { m: DS, t: `[DS]_${el.id}`, right: elLabels },
                    { m: AM, t: `[AM]_${el.id}`, right: elLabels },
                ],
                ["+", "×", "×", "="],
            );
        }

        if (isGridAnalysisMode()) {
            resForceHTML += `<tr><td rowspan="2">${escapeHtml(el.id)}</td><td>${escapeHtml(el.startNode)} (Start)</td><td>${formatNum(AM[0][0])}</td><td>${formatNum(AM[1][0])}</td><td>${formatNum(AM[2][0])}</td></tr>
                             <tr><td>${escapeHtml(el.endNode)} (End)</td><td>${formatNum(AM[3][0])}</td><td>${formatNum(AM[4][0])}</td><td>${formatNum(AM[5][0])}</td></tr>`;
        } else {
            resForceHTML += `<tr><td rowspan="2">${escapeHtml(el.id)}</td><td>${escapeHtml(el.startNode)} (Start)</td><td>${formatNum(AM[0][0])}</td><td>${formatNum(AM[1][0])}</td><td>${formatNum(AM[2][0])}</td></tr>
                             <tr><td>${escapeHtml(el.endNode)} (End)</td><td>${formatNum(AM[3][0])}</td><td>${formatNum(AM[4][0])}</td><td>${formatNum(AM[5][0])}</td></tr>`;
        }

        elementResults.push({ el, AM });
    });
    if (!heavyModel) {
        html += `</div>`;
    } // Close step 7 container here

    return { AR, resDispHTML, resReactHTML, resForceHTML, elementResults, equilibriumResult, html };
}

function renderStep7(step7) {
    return step7.html;
}
