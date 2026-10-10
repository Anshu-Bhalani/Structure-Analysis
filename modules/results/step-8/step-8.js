/* ==========================================================================
 * step-8.js — Results part: Step 8
 * Step 8 — Final results (tables of displacements, reactions, member end forces)
 * Adds its menu button + panel to the Results frame, then defines its solver / render code.
 * ========================================================================== */

/* ---- Markup ---- */
mountModuleHTML(".results-detail-menu", "beforeend", `<button type="button" class="results-detail-btn" data-result-panel="result-final" onclick="showResultDetail('result-final', this)">8. Final Results</button>
`);
mountModuleHTML(".results-detail-body", "beforeend", `
<div class="result-detail-panel" id="result-final">
    <div class="final-results-grid">
        <div class="final-result-block">
            <div class="final-result-title">Nodal Displacements</div>
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Node</th><th id="resDispHdr1">UX (m)</th><th id="resDispHdr2">UY (m)</th><th id="resDispHdr3">RZ (rad)</th></tr></thead>
                    <tbody id="resDispTable"></tbody>
                </table>
            </div>
        </div>

        <div class="final-result-block">
            <div class="final-result-title">Support Reactions</div>
            <div class="table-wrap">
                <table>
                    <thead><tr><th rowspan="2">Node</th><th colspan="3" id="resReactionGlobalHeading">Global Axes</th><th colspan="3" id="resReactionLocalHeading">Local Axes</th></tr><tr><th id="resReactionHdr1">Fx (kN)</th><th id="resReactionHdr2">Fy (kN)</th><th id="resReactionHdr3">Mz (kN·m)</th><th id="resReactionHdr4">Fx′ (kN)</th><th id="resReactionHdr5">Fy′ (kN)</th><th id="resReactionHdr6">Mz′ (kN·m)</th></tr></thead>
                    <tbody id="resReactionsTable"></tbody>
                </table>
            </div>
        </div>

        <div class="final-result-block">
            <div class="final-result-title">Member End Forces (Local Axes)</div>
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Element</th><th>Node</th><th id="resForceHdr1">Axial (kN)</th><th id="resForceHdr2">Shear (kN)</th><th id="resForceHdr3">Moment (kN·m)</th></tr></thead>
                    <tbody id="resForcesTable"></tbody>
                </table>
            </div>
        </div>
    </div>
</div>
`);

/* ---- Logic ---- */
// Step 8: Prepare per-element plot data (used by the AFD/SFD/BMD/Displacement
// diagrams) from the member end actions [AM] recovered in Step 7. This step
// produces no visible calc-report section, matching the original analysis
// routine, which never rendered a distinct "Step 8" block.
function solveStep8(ctx, step7) {
    const grid = isGridAnalysisMode();
    step7.elementResults.forEach(({ el, AM }) => {
        const gridPointMoments = (el.localPointMoments || []).map((moment) => ({ a: moment.a, Mx: Number(moment.Mx) || 0, My: Number(moment.My) || 0 }));
        el.plotData = {
            grid,
            L: el.L,
            cx: el.cx,
            cy: el.cy,
            wx: grid ? 0 : el.localwx,
            wy: grid ? 0 : el.localwy,
            pointLoads: el.localPointLoads || [],
            localUDLs: el.localUDLs || [],
            localPointMoments: el.localPointMoments || [],
            gridUDLs: grid ? (el.localUDLs || []).map((udl) => ({ a: udl.a, b: udl.b, q1: Number(udl.localFy1) || 0, q2: Number(udl.localFy2) || 0 })) : [],
            gridPointLoads: grid ? (el.localPointLoads || []).map((load) => ({ a: load.a, Fz: Number(load.Pz) || Number(load.Py) || 0 })) : [],
            gridPointTorsions: grid ? gridPointMoments.map((moment) => ({ a: moment.a, Mx: moment.Mx })) : [],
            gridPointMoments: grid ? gridPointMoments : [],
            fx1: -AM[0][0],
            fy1: grid ? AM[2][0] : AM[1][0],
            mz1: grid ? AM[1][0] : AM[2][0],
        };
    });
    return { count: step7.elementResults.length };
}

function renderStep8() {
    return "";
}
