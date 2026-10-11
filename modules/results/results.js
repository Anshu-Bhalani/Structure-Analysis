/* ==========================================================================
 * results.js — Results module (container + orchestration)
 * Results page frame: analysis execution card, active load/moment case selectors,
 * analysis summary, equilibrium check, step menu container, analysis orchestration
 * (runAnalysis / runAnalysisCore), load-transformation helpers and the PDF export.
 * The nine result parts live in sub-folders and plug into this frame:
 *   step-1 ... step-8  -> menu button + panel of each calculation step / final results
 *   diagrams           -> reaction + combined result diagram cards, live model diagram,
 *                         diagram engine and full-screen modal
 * ========================================================================== */

/* ---- Markup ---- */
mountModuleHTML(".container", "beforeend", `
<!-- RESULTS -->
<section class="section" id="results">
    <div class="card">
        <div class="card-header">
            <div>
                <h3>Analysis Execution</h3>
                <p><span id="analysisModeNote">Plane analysis classifies each element as Beam, Truss or Frame from its A and I values.</span> Units: kN, m, kN/m, kN·m. <span id="activeAnalysisCaseStatus" style="font-weight:700; color:#1d4ed8;"></span></p>
            </div>
            <button class="btn btn-primary" onclick="runAnalysis()">Run Analysis</button>
        </div>
        <div class="card-body" style="border-top: 1px solid var(--border); padding-top: 16px;">
            <div class="restraint-box">
                <div class="restraint-title">Active Analysis Cases</div>
                <div class="grid grid-2">
                    <div class="field">
                        <label for="activeLoadCaseSelect">Active Load Case</label>
                        <select id="activeLoadCaseSelect" onchange="setActiveAnalysisCases()"><option value="">No load case selected</option></select>
                    </div>
                    <div class="field">
                        <label for="activeMomentCaseSelect">Active Moment Case</label>
                        <select id="activeMomentCaseSelect" onchange="setActiveAnalysisCases()"><option value="">No moment case selected</option></select>
                    </div>
                </div>
                <small style="display:block; margin-top:10px; color:#64748b; line-height:1.5;">Only loads and moments belonging to the selected cases are included in the next analysis. Load cases and moment cases are selected independently.</small>
            </div>

            <div class="restraint-box" id="planeDofNumberingBox" style="margin-top:14px;">
                <div class="restraint-title">Global DoF Numbering</div>
                <div class="grid grid-2">
                    <label class="check-item" style="cursor:pointer;">
                        <input type="checkbox" id="skipAxialDofGlobal" onchange="setGlobalDofNumberingOption('skipAxial', this.checked)">
                        <span>Neglect X DOF in numbering</span>
                    </label>
                    <label class="check-item" style="cursor:pointer;">
                        <input type="checkbox" id="skipMomentDofGlobal" onchange="setGlobalDofNumberingOption('skipMoment', this.checked)">
                        <span>Neglect Moment M DOF in numbering</span>
                    </label>
                </div>
                <small id="globalDofNumberingNote" style="display:block; margin-top:10px; color:#64748b; line-height:1.5;">Select Neglect X and/or Neglect Moment M to omit only the corresponding DOFs that are unnecessary at each node according to connected element A/I values. Leave them unselected to keep all X,Y,M DOFs numbered.</small>
            </div>
        </div>
        <div id="analysisStatusBanner" style="margin-top:12px; padding:12px 14px; border-radius:9px; border:1px solid #bfdbfe; background:#eff6ff; color:#1e3a8a; font-size:12px; font-weight:700; line-height:1.5;">Analysis not run yet — Run Analysis to view results.</div>
    </div>

    <div id="resultsContent" style="display:none;">

        <!-- ANALYSIS SUMMARY -->
        <div class="analysis-summary-card">
            <div class="card-header">
                <div>
                    <h3>Analysis Summary</h3>
                    <p>Key results from the current analysis.</p>
                </div>
            </div>
            <div class="analysis-summary-grid">
                <div class="analysis-summary-metric"><div class="analysis-summary-label">Maximum displacement</div><div class="analysis-summary-value" id="summaryMaxDisplacement">—</div></div>
                <div class="analysis-summary-metric"><div class="analysis-summary-label">Maximum reaction</div><div class="analysis-summary-value" id="summaryMaxReaction">—</div></div>
                <div class="analysis-summary-metric"><div class="analysis-summary-label" id="summaryAxialLabel">Maximum axial force</div><div class="analysis-summary-value" id="summaryMaxAxial">—</div></div>
                <div class="analysis-summary-metric"><div class="analysis-summary-label" id="summaryShearLabel">Maximum shear</div><div class="analysis-summary-value" id="summaryMaxShear">—</div></div>
                <div class="analysis-summary-metric"><div class="analysis-summary-label" id="summaryMomentLabel">Maximum bending moment</div><div class="analysis-summary-value" id="summaryMaxMoment">—</div></div>
                <div class="analysis-summary-metric"><div class="analysis-summary-label">Equilibrium status</div><div class="analysis-summary-value" id="summaryEquilibriumStatus">—</div></div>
            </div>
        </div>

        <!-- EQUILIBRIUM CHECK -->
        <div class="equilibrium-card">
            <div class="card-header">
                <div>
                    <h3>Global Equilibrium Check</h3>
                    <p>External loads and support reactions must balance in global coordinates.</p>
                </div>
            </div>
            <div id="equilibriumStatus" class="equilibrium-status ok">✓ Equilibrium satisfied</div>
            <div class="equilibrium-grid">
                <div class="equilibrium-metric"><div class="equilibrium-metric-label" id="eqFxLabel">ΣFx Residual</div><div class="equilibrium-metric-value" id="eqFxResidual">0.000 kN</div></div>
                <div class="equilibrium-metric"><div class="equilibrium-metric-label" id="eqFyLabel">ΣFy Residual</div><div class="equilibrium-metric-value" id="eqFyResidual">0.000 kN</div></div>
                <div class="equilibrium-metric"><div class="equilibrium-metric-label" id="eqMzLabel">ΣMz Residual</div><div class="equilibrium-metric-value" id="eqMzResidual">0.000 kN·m</div></div>
                <div class="equilibrium-metric"><div class="equilibrium-metric-label" id="eqMaxResidualLabel">Force / Moment Residuals</div><div class="equilibrium-metric-value" id="eqMaxResidual">0.000</div></div>
            </div>
            <div class="equilibrium-note" id="equilibriumNote">External load vector + support reaction vector = global equilibrium residual.</div>
        </div>

        <!-- CALCULATION STEPS UI -->
                        <!-- CALCULATION STEPS + FINAL TABLES MENU -->
        <div class="card results-details-card">
            <div class="card-header" style="flex-wrap: wrap;">
                <div>
                    <h3>Analysis Calculation & Final Results</h3>
                    <p>Select one option to view only that calculation step or the final result tables.</p>
                </div>
                <button type="button" class="btn btn-secondary" id="exportPdfBtn" style="flex-shrink: 0; white-space: nowrap;" onclick="exportAnalysisPDF()" title="Export the full 8-step solution as a PDF">📄 Export PDF</button>
            </div>
            <div class="results-detail-menu" role="tablist" aria-label="Analysis calculation steps">
            </div>

            <div class="results-detail-body">
            </div>

            <!-- Hidden source container used by the existing solver; its generated step content is moved into the menu panels after each analysis. -->
            <div id="calcStepsContainer" class="calc-steps-source" aria-hidden="true"></div>
        </div>
    </div>
</section>
`);

/* ---- Logic ---- */
// ---- Cross-entity helpers: dropdown syncing, deletion, stats, full refresh ----
function updateAnalysisStatusUI() {
    const banner = document.getElementById("analysisStatusBanner");
    const statusEl = document.getElementById("activeAnalysisCaseStatus");
    if (!banner) return;

    if (analysisState.status === "valid") {
        banner.textContent = "Analysis results are current for the selected analysis cases.";
        banner.style.borderColor = "#bbf7d0";
        banner.style.background = "#f0fdf4";
        banner.style.color = "#166534";
    } else if (analysisState.status === "failed") {
        banner.textContent = "Equilibrium check failed — review the results before relying on them.";
        banner.style.borderColor = "#fecaca";
        banner.style.background = "#fef2f2";
        banner.style.color = "#991b1b";
    } else if (analysisState.status === "invalidated") {
        banner.textContent = "Model changed since last analysis — Run Analysis again.";
        banner.style.borderColor = "#fecaca";
        banner.style.background = "#fef2f2";
        banner.style.color = "#991b1b";
    } else {
        banner.textContent = "Analysis not run yet — Run Analysis to view results.";
        banner.style.borderColor = "#bfdbfe";
        banner.style.background = "#eff6ff";
        banner.style.color = "#1e3a8a";
    }

    if (statusEl) {
        if (analysisState.status === "valid") {
            statusEl.textContent = "";
        } else if (analysisState.status === "failed") {
            statusEl.textContent = " • Equilibrium check failed";
            statusEl.style.color = "#991b1b";
        } else {
            statusEl.textContent = analysisState.status === "invalidated" ? " • Results outdated" : " • Not run";
            statusEl.style.color = analysisState.status === "invalidated" ? "#b91c1c" : "#64748b";
        }
    }
}

function markAnalysisInvalidated() {
    updateGlobalDofNumberingUI();
    analysisState.status = "invalidated";
    model.nodeDisplacements = undefined;
    model.elements.forEach((el) => {
        if (el) delete el.plotData;
    });
    const resultsContent = document.getElementById("resultsContent");
    if (resultsContent) resultsContent.style.display = "none";
    updateAnalysisStatusUI();
}

function markAnalysisValid() {
    analysisState.status = "valid";
    updateAnalysisStatusUI();
}

function markAnalysisFailed() {
    analysisState.status = "failed";
    updateAnalysisStatusUI();
}

function setActiveAnalysisCases() {
    const previousLoad = activeLoadCaseId;
    const previousMoment = activeMomentCaseId;
    const loadSelect = document.getElementById("activeLoadCaseSelect");
    const momentSelect = document.getElementById("activeMomentCaseSelect");
    if (loadSelect) activeLoadCaseId = loadSelect.value;
    if (momentSelect) activeMomentCaseId = momentSelect.value;
    if (activeLoadCaseId !== previousLoad || activeMomentCaseId !== previousMoment) {
        markAnalysisInvalidated();
    }
    updateAnalysisStatusUI();
}

function updateGlobalDofNumberingUI() {
    const axialEl = document.getElementById("skipAxialDofGlobal");
    const momentEl = document.getElementById("skipMomentDofGlobal");
    const noteEl = document.getElementById("globalDofNumberingNote");
    const config = getGlobalDofNumberingConfig();

    // The two controls are the optional manual switches for the Excel-style
    // per-node numbering. They do not remove a DOF globally from the model.
    if (axialEl) { axialEl.checked = config.skipAxial; axialEl.disabled = false; }
    if (momentEl) { momentEl.checked = config.skipMoment; momentEl.disabled = false; }
    if (noteEl) {
        noteEl.textContent =
            "Neglect X: " + (config.skipAxial ? "ON" : "OFF") +
            " · Neglect Moment M: " + (config.skipMoment ? "ON" : "OFF") +
            ". When ON, only the DOF made unnecessary by the connected element A/I properties is omitted at that node. Shared nodes keep the union of required DOFs and numbering remains compressed.";
    }
}

function syncActiveAnalysisCaseSelectors() {
    const loadSelect = document.getElementById("activeLoadCaseSelect");
    const momentSelect = document.getElementById("activeMomentCaseSelect");
    if (!loadSelect || !momentSelect) return;

    const previousLoad = activeLoadCaseId;
    const previousMoment = activeMomentCaseId;

    loadSelect.innerHTML = model.loadCases.length
        ? model.loadCases.map((lc) => `<option value="${escapeHtml(lc.id)}">${escapeHtml(lc.id)} — ${escapeHtml(lc.type)}</option>`).join("")
        : `<option value="">No load cases available</option>`;

    momentSelect.innerHTML = model.momentCases.length
        ? model.momentCases.map((mc) => `<option value="${escapeHtml(mc.id)}">${escapeHtml(mc.id)} — ${escapeHtml(mc.type)}</option>`).join("")
        : `<option value="">No moment cases available</option>`;

    if (model.loadCases.some((lc) => lc.id === previousLoad)) {
        activeLoadCaseId = previousLoad;
    } else {
        activeLoadCaseId = model.loadCases.length ? model.loadCases[0].id : "";
    }

    if (model.momentCases.some((mc) => mc.id === previousMoment)) {
        activeMomentCaseId = previousMoment;
    } else {
        activeMomentCaseId = model.momentCases.length ? model.momentCases[0].id : "";
    }

    loadSelect.value = activeLoadCaseId;
    momentSelect.value = activeMomentCaseId;
}

function isActiveLoadCase(load) {
    return !!activeLoadCaseId && String(load.loadCaseId || "") === String(activeLoadCaseId);
}

function isActiveMomentCase(moment) {
    return !!activeMomentCaseId && String(moment.momentCaseId || "") === String(activeMomentCaseId);
}

function getActiveAnalysisCaseLabel() {
    const load = model.loadCases.find((lc) => lc.id === activeLoadCaseId);
    const moment = model.momentCases.find((mc) => mc.id === activeMomentCaseId);
    return `Load Case: ${load ? load.id : "None"} | Moment Case: ${moment ? moment.id : "None"}`;
}

// ==========================================================================
// 15. LOAD TRANSFORMATION HELPERS
// Plane-frame convention from the lab manual: [AMS] = [RT]^T [AML]
//
// For an inclined member, any load entered in GLOBAL/ANGLED axes is first
// resolved into the member axes (xm, ym). AML is then formed entirely in
// member axes. Only after AML is complete do we transform it to structure
// axes through RT^T.
// ==========================================================================
function rotateForceToGlobal(Fx, Fy, axisSystem, angleDeg) {
    let x = Number(Fx) || 0;
    let y = Number(Fy) || 0;

    if (axisSystem === "Angled") {
        const rad = ((Number(angleDeg) || 0) * Math.PI) / 180;
        return {
            x: x * Math.cos(rad) - y * Math.sin(rad),
            y: x * Math.sin(rad) + y * Math.cos(rad),
        };
    }

    return { x, y };
}

function globalForceToLocal(gx, gy, cx, cy) {
    // [Fxm]   [ Cx   Cy ] [Fx_global]
    // [Fym] = [-Cy   Cx ] [Fy_global]
    return {
        x: gx * cx + gy * cy,
        y: -gx * cy + gy * cx,
    };
}

function inputForceToLocal(Fx, Fy, axisSystem, angleDeg, cx, cy) {
    if (axisSystem === "Local") {
        return { x: Number(Fx) || 0, y: Number(Fy) || 0 };
    }

    const g = rotateForceToGlobal(Fx, Fy, axisSystem, angleDeg);
    return globalForceToLocal(g.x, g.y, cx, cy);
}

function localForceToGlobal(Fx, Fy, cx, cy) {
    return {
        x: Fx * cx - Fy * cy,
        y: Fx * cy + Fy * cx,
    };
}

function addLocalPointLoadToAML(AML, Px, Py, a, L) {
    AML[0][0] += (-Px * (L - a)) / L;
    AML[1][0] += (-Py * Math.pow(L - a, 2) * (L + 2 * a)) / Math.pow(L, 3);
    AML[2][0] += (-Py * a * Math.pow(L - a, 2)) / Math.pow(L, 2);
    AML[3][0] += (-Px * a) / L;
    AML[4][0] += (-Py * Math.pow(a, 2) * (3 * L - 2 * a)) / Math.pow(L, 3);
    AML[5][0] += (Py * Math.pow(a, 2) * (L - a)) / Math.pow(L, 2);
}

function integrateLinearLocalUDLToAML(AML, wx1, wy1, wx2, wy2, a, b, L, nSlices = 100) {
    if (b <= a) return;

    const h = (b - a) / nSlices;

    // Simpson integration of the exact point-load AML influence
    // functions. The load intensity is interpolated in LOCAL axes.
    for (let i = 0; i <= nSlices; i++) {
        const x = a + i * h;
        const t = (x - a) / (b - a);
        const wx = wx1 + t * (wx2 - wx1);
        const wy = wy1 + t * (wy2 - wy1);

        const mult = i === 0 || i === nSlices ? 1 : i % 2 === 0 ? 2 : 4;
        const weight = (h / 3) * mult;

        AML[0][0] += -wx * ((L - x) / L) * weight;
        AML[1][0] += -wy * ((Math.pow(L - x, 2) * (L + 2 * x)) / Math.pow(L, 3)) * weight;
        AML[2][0] += -wy * ((x * Math.pow(L - x, 2)) / Math.pow(L, 2)) * weight;
        AML[3][0] += -wx * (x / L) * weight;
        AML[4][0] += -wy * ((Math.pow(x, 2) * (3 * L - 2 * x)) / Math.pow(L, 3)) * weight;
        AML[5][0] += wy * ((Math.pow(x, 2) * (L - x)) / Math.pow(L, 2)) * weight;
    }
}

// ==========================================================================
// 16. STIFFNESS METHOD SOLVER
// Runs the full LPW-3 stiffness method and renders the step-by-step report.
// ==========================================================================
function showResultDetail(panelId, button) {
    document.querySelectorAll(".result-detail-panel").forEach((panel) => {
        panel.classList.toggle("active", panel.id === panelId);
    });

    document.querySelectorAll(".results-detail-btn").forEach((btn) => {
        btn.classList.toggle("active", btn === button);
    });
}

function setupResultDetailPanels() {
    const source = document.getElementById("calcStepsContainer");
    if (!source) return;

    const steps = Array.from(source.querySelectorAll(":scope > .calc-step"));
    steps.forEach((step, index) => {
        const stepNumber = index + 1;
        const slot = document.querySelector(`.calc-step-slot[data-step-number="${stepNumber}"]`);
        if (slot) {
            slot.innerHTML = "";
            slot.appendChild(step);
        }
    });

    const firstButton = document.querySelector('.results-detail-btn[data-result-panel="result-step-1"]');
    if (firstButton) showResultDetail("result-step-1", firstButton);
}

// Reconstructs global static equilibrium (ΣFx, ΣFy, ΣMz) directly from the
// input loads/moments/self-weight and the solved reactions, independent of
// the assembled [AC] load vector (see note below). Pure calculation — no
// DOM access. Rendering the result happens separately in
// renderEquilibriumCheck().
function calculateEquilibriumResiduals(AC, dofMap, modelNodes, restIndices, AR) {
    // IMPORTANT: Do not use the assembled [AC] vector for global statics.
    // [AC] contains finite-element equivalent nodal actions from member loads.
    // This check independently reconstructs the PHYSICAL external loads and
    // moments so that distributed loads are not mistaken for an unbalanced
    // nodal moment (e.g. a 10 kN/m UDL over 5 m gives 125 kN·m about its end).
    let sumFx = 0;
    let sumFy = 0;
    let sumMz = 0;

    const refNode = modelNodes[0] || { x: 0, y: 0 };
    const refX = Number(refNode.x) || 0;
    const refY = Number(refNode.y) || 0;

    const addForce = (x, y, fx, fy) => {
        const rx = x - refX;
        const ry = y - refY;
        sumFx += Number(fx) || 0;
        sumFy += Number(fy) || 0;
        sumMz += rx * (Number(fy) || 0) - ry * (Number(fx) || 0);
    };

    const addPureMoment = (mzStructuralSign) => {
        sumMz += Number(mzStructuralSign) || 0;
    };

    // ---------------------------------------------------------------------
    // 1. Nodal forces and nodal moments from the active cases.
    // ---------------------------------------------------------------------
    model.loads.forEach((ld) => {
        if (!isActiveLoadCase(ld) || ld.type !== "Nodal Load") return;
        const node = modelNodes.find((n) => n.id === ld.nodeId);
        if (!node) return;

        const g = rotateForceToGlobal(ld.Fx, ld.Fy, ld.axisSystem, ld.angle);
        addForce(Number(node.x) || 0, Number(node.y) || 0, g.x, g.y);
    });

    model.moments.forEach((m) => {
        if (!isActiveMomentCase(m) || m.type !== "Nodal Moment") return;
        // UI convention: +Mz is anticlockwise, matching the global structural
        // equilibrium convention.
        addPureMoment(Number(m.Mz) || 0);
    });

    // ---------------------------------------------------------------------
    // 2. Element point loads, partial/linearly varying UDLs, and self-weight.
    //    Reconstruct their actual global resultants directly from the input.
    // ---------------------------------------------------------------------
    const addElementUDLResultant = (el, a, b, qx1, qy1, qx2, qy2) => {
        const n1 = modelNodes.find((n) => n.id === el.startNode);
        const n2 = modelNodes.find((n) => n.id === el.endNode);
        if (!n1 || !n2) return;

        const x1 = Number(n1.x) || 0;
        const y1 = Number(n1.y) || 0;
        const Lseg = b - a;
        if (!(Lseg > 0)) return;

        const dx = (Number(n2.x) || 0) - x1;
        const dy = (Number(n2.y) || 0) - y1;
        const L = Math.hypot(dx, dy);
        if (!(L > 0)) return;

        const cx = dx / L;
        const cy = dy / L;

        const ix = ((qx1 + qx2) * 0.5) * Lseg;
        const iy = ((qy1 + qy2) * 0.5) * Lseg;

        // First moment of the line-load intensities with respect to the
        // element start node: ∫ s*q(s) ds over s in [a,b].
        const kx = (qx2 - qx1) / Lseg;
        const ky = (qy2 - qy1) / Lseg;
        // Equivalent expression using u=s-a is clearer and numerically safer.
        const sxSafe = a * qx1 * Lseg + a * kx * Lseg * Lseg / 2 + qx1 * Lseg * Lseg / 2 + kx * Math.pow(Lseg, 3) / 3;
        const sySafe = a * qy1 * Lseg + a * ky * Lseg * Lseg / 2 + qy1 * Lseg * Lseg / 2 + ky * Math.pow(Lseg, 3) / 3;

        sumFx += ix;
        sumFy += iy;
        sumMz += (x1 - refX) * iy - (y1 - refY) * ix + cx * sySafe - cy * sxSafe;
    };

    model.elements.forEach((el) => {
        const n1 = modelNodes.find((n) => n.id === el.startNode);
        const n2 = modelNodes.find((n) => n.id === el.endNode);
        const tmpl = model.elementTemplates.find((t) => t.id === el.templateId);
        if (!n1 || !n2 || !tmpl) return;

        const x1 = Number(n1.x) || 0;
        const y1 = Number(n1.y) || 0;
        const x2 = Number(n2.x) || 0;
        const y2 = Number(n2.y) || 0;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const L = Math.hypot(dx, dy);
        if (!(L > 0)) return;
        const cx = dx / L;
        const cy = dy / L;

        model.loads.forEach((ld) => {
            if (!isActiveLoadCase(ld) || ld.elementId !== el.id) return;

            if (ld.type === "Element Point Load" || ld.type === "Element Load") {
                const a = Math.max(0, Math.min(Number(ld.distance) || 0, L));
                const local = inputForceToLocal(ld.Fx, ld.Fy, ld.axisSystem, ld.angle, cx, cy);
                const global = localForceToGlobal(local.x, local.y, cx, cy);
                addForce(x1 + cx * a, y1 + cy * a, global.x, global.y);
                return;
            }

            if (ld.type === "Element UDL") {
                const a = Math.max(0, Math.min(Number(ld.distance) || 0, L));
                const bRaw = ld.distanceEnd !== undefined && ld.distanceEnd !== "" ? Number(ld.distanceEnd) : L;
                const b = Math.max(0, Math.min(Number.isFinite(bRaw) ? bRaw : L, L));
                if (!(a < b)) return;

                const Fx1 = Number(ld.Fx) || 0;
                const Fy1 = Number(ld.Fy) || 0;
                const Fx2 = ld.FxEnd !== undefined && ld.FxEnd !== "" ? Number(ld.FxEnd) : Fx1;
                const Fy2 = ld.FyEnd !== undefined && ld.FyEnd !== "" ? Number(ld.FyEnd) : Fy1;

                const local1 = inputForceToLocal(Fx1, Fy1, ld.axisSystem, ld.angle, cx, cy);
                const local2 = inputForceToLocal(Fx2, Fy2, ld.axisSystem, ld.angle, cx, cy);
                const global1 = localForceToGlobal(local1.x, local1.y, cx, cy);
                const global2 = localForceToGlobal(local2.x, local2.y, cx, cy);

                addElementUDLResultant(el, a, b, global1.x, global1.y, global2.x, global2.y);
            }
        });

        model.moments.forEach((m) => {
            if (!isActiveMomentCase(m) || m.type !== "Element Moment" || m.elementId !== el.id) return;
            // Applied element point moment is independent of its location.
            // +Mz in the UI is anticlockwise and therefore positive in the
            // global structural equilibrium convention.
            addPureMoment(Number(m.Mz) || 0);
        });

        // Per-element self-weight is applied only from the active Self Weight case.
        const activeLoadCase = model.loadCases.find((lc) => String(lc.id) === String(activeLoadCaseId));
        if (activeLoadCase?.type === "Self Weight") {
            const selfWeight = Number(activeLoadCase.memberSelfWeights?.[String(el.id)]) || 0;
            if (selfWeight > 0) {
                const weightPerLength = -selfWeight;
                addElementUDLResultant(el, 0, L, 0, weightPerLength, 0, weightPerLength);
            }
        }
    });

    // ---------------------------------------------------------------------
    // 3. Add solved support reactions in the same global equilibrium sign
    //    convention. AR is already expressed in structural/global DOFs.
    // ---------------------------------------------------------------------
    restIndices.forEach((ri, i) => {
        const reaction = Number(AR[i][0]) || 0;
        let reactionNode = null;
        let reactionDof = null;

        for (const node of modelNodes) {
            const d = dofMap[node.id];
            if (d.x === ri) { reactionNode = node; reactionDof = "UX"; break; }
            if (d.y === ri) { reactionNode = node; reactionDof = "UY"; break; }
            if (d.z === ri) { reactionNode = node; reactionDof = "RZ"; break; }
        }

        if (!reactionNode) return;

        if (reactionDof === "UX") {
            addForce(Number(reactionNode.x) || 0, Number(reactionNode.y) || 0, reaction, 0);
        } else if (reactionDof === "UY") {
            addForce(Number(reactionNode.x) || 0, Number(reactionNode.y) || 0, 0, reaction);
        } else if (reactionDof === "RZ") {
            sumMz += reaction;
        }
    });

    const absFx = Math.abs(sumFx);
    const absFy = Math.abs(sumFy);
    const absMz = Math.abs(sumMz);
    const maxResidual = Math.max(absFx, absFy, absMz);

    let loadScale = Math.max(Math.abs(sumFx), Math.abs(sumFy));
    let momentScale = Math.abs(sumMz);
    model.loads.forEach((ld) => {
        if (!isActiveLoadCase(ld)) return;
        loadScale = Math.max(loadScale, Math.abs(Number(ld.Fx) || 0), Math.abs(Number(ld.Fy) || 0));
    });
    model.moments.forEach((m) => {
        if (!isActiveMomentCase(m)) return;
        momentScale = Math.max(momentScale, Math.abs(Number(m.Mz) || 0));
    });
    restIndices.forEach((ri, i) => {
        loadScale = Math.max(loadScale, Math.abs(Number(AR[i][0]) || 0));
    });

    const structureSpan = Math.max(1, ...modelNodes.map((n) => Math.hypot((Number(n.x) || 0) - refX, (Number(n.y) || 0) - refY)));
    const tolerance = Math.max(1e-8, loadScale * 1e-8);
    const momentTolerance = Math.max(1e-8, Math.max(momentScale, loadScale * structureSpan) * 1e-8);
    const forceResidualOk = absFx <= tolerance && absFy <= tolerance;
    const momentResidualOk = absMz <= momentTolerance;
    const balanced = forceResidualOk && momentResidualOk;

    return {
        sumFx, sumFy, sumMz, maxResidual,
        maxForceResidual: Math.max(absFx, absFy),
        maxMomentResidual: absMz,
        balanced, tolerance, momentTolerance,
    };
}

// Grid equilibrium is audited from physical global load resultants and solved
// support reactions, including the positional moments caused by vertical Fz loads.
function calculateGridEquilibriumResiduals(AC, dofMap, modelNodes, restIndices, AR) {
    // The Grid equilibrium audit must check physical global statics, not the
    // unweighted sum of generalized nodal DOFs. A vertical Fz at (x,y) also
    // contributes Mx = (y-y0)Fz and My = -(x-x0)Fz about the common reference.
    // AC remains an assembled solver vector and is intentionally not used here.
    const refNode = modelNodes[0] || { x: 0, y: 0 };
    const refX = Number(refNode.x) || 0;
    const refY = Number(refNode.y) || 0;
    let sumMx = 0;
    let sumMy = 0;
    let sumFz = 0;
    let forceScale = 0;
    let momentScale = 0;

    const addVerticalForce = (x, y, fz) => {
        const fx = Number(x) || 0;
        const fy = Number(y) || 0;
        const force = Number(fz) || 0;
        const mx = (fy - refY) * force;
        const my = -(fx - refX) * force;
        sumFz += force;
        sumMx += mx;
        sumMy += my;
        forceScale = Math.max(forceScale, Math.abs(force));
        momentScale = Math.max(momentScale, Math.abs(mx), Math.abs(my));
    };

    const addAppliedTorsion = (mx, my) => {
        const tx = Number(mx) || 0;
        const ty = Number(my) || 0;
        sumMx += tx;
        sumMy += ty;
        momentScale = Math.max(momentScale, Math.abs(tx), Math.abs(ty));
    };

    // Resultant of a linearly varying vertical grid load over [a,b].
    // firstMoment is integral(s*q(s) ds), measured from the element start.
    const addGridUDLResultant = (el, a, b, q1, q2) => {
        const n1 = modelNodes.find((node) => String(node.id) === String(el.startNode));
        const n2 = modelNodes.find((node) => String(node.id) === String(el.endNode));
        if (!n1 || !n2) return;
        const x1 = Number(n1.x) || 0;
        const y1 = Number(n1.y) || 0;
        const dx = (Number(n2.x) || 0) - x1;
        const dy = (Number(n2.y) || 0) - y1;
        const L = Math.hypot(dx, dy);
        if (!(L > 0)) return;
        const lo = Math.max(0, Math.min(Number(a) || 0, L));
        const hi = Math.max(0, Math.min(Number(b), L));
        const span = hi - lo;
        if (!(span > 0)) return;
        const startLoad = Number(q1) || 0;
        const endLoad = Number(q2) || 0;
        const resultant = (startLoad + endLoad) * span / 2;
        const firstMoment = lo * resultant + span * span * (startLoad + 2 * endLoad) / 6;
        const cx = dx / L;
        const cy = dy / L;
        sumFz += resultant;
        const mx = (y1 - refY) * resultant + cy * firstMoment;
        const my = -((x1 - refX) * resultant + cx * firstMoment);
        sumMx += mx;
        sumMy += my;
        forceScale = Math.max(forceScale, Math.abs(startLoad * span), Math.abs(endLoad * span), Math.abs(resultant));
        momentScale = Math.max(momentScale, Math.abs(mx), Math.abs(my), Math.abs(firstMoment));
    };

    // 1. Applied nodal loads.
    model.loads.forEach((load) => {
        if (!isActiveLoadCase(load)) return;
        if (load.type === "Nodal Load") {
            const node = modelNodes.find((item) => String(item.id) === String(load.nodeId));
            if (node) addVerticalForce(node.x, node.y, load.Fz);
            return;
        }

        const elementLoad = load.type === "Element Point Load" || load.type === "Element Load" || load.type === "Element UDL";
        if (!elementLoad) return;
        const el = model.elements.find((item) => String(item.id) === String(load.elementId));
        if (!el) return;
        const n1 = modelNodes.find((node) => String(node.id) === String(el.startNode));
        const n2 = modelNodes.find((node) => String(node.id) === String(el.endNode));
        if (!n1 || !n2) return;
        const x1 = Number(n1.x) || 0;
        const y1 = Number(n1.y) || 0;
        const dx = (Number(n2.x) || 0) - x1;
        const dy = (Number(n2.y) || 0) - y1;
        const L = Math.hypot(dx, dy);
        if (!(L > 0)) return;
        const cx = dx / L;
        const cy = dy / L;

        if (load.type === "Element Point Load" || load.type === "Element Load") {
            const a = Math.max(0, Math.min(Number(load.distance) || 0, L));
            addVerticalForce(x1 + cx * a, y1 + cy * a, load.Fz);
        } else {
            const a = Math.max(0, Math.min(Number(load.distance) || 0, L));
            const rawEnd = load.distanceEnd === "" || load.distanceEnd == null ? L : Number(load.distanceEnd);
            const b = Math.max(0, Math.min(Number.isFinite(rawEnd) ? rawEnd : L, L));
            if (!(b > a)) return;
            const q1 = Number(load.Fz) || 0;
            const q2 = load.FzEnd !== undefined && load.FzEnd !== "" ? (Number(load.FzEnd) || 0) : q1;
            addGridUDLResultant(el, a, b, q1, q2);
        }
    });

    // 2. Self-weight, only for an active Self Weight load case, matching Grid
    //    Step 3's existing rule and property conversion.
    const activeCase = model.loadCases.find((item) => String(item.id) === String(activeLoadCaseId));
    if (activeCase?.type === "Self Weight") {
        model.elements.forEach((el) => {
            const n1 = modelNodes.find((node) => String(node.id) === String(el.startNode));
            const n2 = modelNodes.find((node) => String(node.id) === String(el.endNode));
            const template = model.elementTemplates.find((item) => String(item.id) === String(el.templateId));
            const selfWeight = Number(activeCase.memberSelfWeights?.[String(el.id)]) || 0;
            if (!n1 || !n2 || !template || !(selfWeight > 0)) return;
            const dx = (Number(n2.x) || 0) - (Number(n1.x) || 0);
            const dy = (Number(n2.y) || 0) - (Number(n1.y) || 0);
            const L = Math.hypot(dx, dy);
            if (!(L > 0)) return;
            // Self-weight is stored directly as a line load (kN/m).
            const q = -selfWeight;
            if (q !== 0) addGridUDLResultant(el, 0, L, q, q);
        });
    }

    // 3. Applied Grid torsions. Mx and My are already global moment components.
    model.moments.forEach((moment) => {
        if (!isActiveMomentCase(moment)) return;
        if (moment.type === "Nodal Moment") {
            addAppliedTorsion(moment.Mx, moment.My);
        } else if (moment.type === "Element Moment") {
            addAppliedTorsion(moment.Mx, moment.My);
            // Legacy Mz is not shown in Grid mode, but if an older model still
            // contains it, Step 3 treats it as torsion about the member axis.
            const mz = Number(moment.Mz) || 0;
            if (mz !== 0) {
                const el = model.elements.find((item) => String(item.id) === String(moment.elementId));
                const n1 = el && modelNodes.find((node) => String(node.id) === String(el.startNode));
                const n2 = el && modelNodes.find((node) => String(node.id) === String(el.endNode));
                if (n1 && n2) {
                    const dx = (Number(n2.x) || 0) - (Number(n1.x) || 0);
                    const dy = (Number(n2.y) || 0) - (Number(n1.y) || 0);
                    const L = Math.hypot(dx, dy);
                    if (L > 0) addAppliedTorsion(mz * dx / L, mz * dy / L);
                }
            }
        }
    });

    // 4. Solved support reactions: θX reaction = Mx, θY = My and ΔZ = Fz.
    //    A support's Fz reaction also contributes its coordinate-dependent Mx/My.
    restIndices.forEach((idx, i) => {
        const reaction = Number(AR[i]?.[0]) || 0;
        for (const node of modelNodes) {
            const d = dofMap[node.id];
            if (!d) continue;
            if (d.x === idx) {
                addAppliedTorsion(reaction, 0);
                break;
            }
            if (d.y === idx) {
                addAppliedTorsion(0, reaction);
                break;
            }
            if (d.z === idx) {
                addVerticalForce(node.x, node.y, reaction);
                break;
            }
        }
    });

    const absMx = Math.abs(sumMx);
    const absMy = Math.abs(sumMy);
    const absFz = Math.abs(sumFz);
    const maxResidual = Math.max(absMx, absMy, absFz);
    const structureSpan = Math.max(1, ...modelNodes.map((node) => Math.hypot((Number(node.x) || 0) - refX, (Number(node.y) || 0) - refY)));
    const forceTolerance = Math.max(1e-8, forceScale * 1e-8);
    const momentTolerance = Math.max(1e-8, momentScale * 1e-8, forceScale * structureSpan * 1e-8);
    return {
        // Existing result property names are retained for the shared UI: in
        // Grid mode these are ΣMx, ΣMy and ΣFz, as the labels already indicate.
        sumFx: sumMx,
        sumFy: sumMy,
        sumMz: sumFz,
        maxResidual,
        maxForceResidual: absFz,
        maxMomentResidual: Math.max(absMx, absMy),
        balanced: absMx <= momentTolerance && absMy <= momentTolerance && absFz <= forceTolerance,
        tolerance: forceTolerance,
        forceTolerance,
        momentTolerance,
        grid: true,
    };
}

// Writes an equilibrium-check result (from calculateEquilibriumResiduals())
// into the Results panel. Pure DOM update — no calculation.
function renderEquilibriumCheck(result) {
    const { sumFx, sumFy, sumMz, maxResidual, balanced, tolerance, momentTolerance } = result;

    const statusEl = document.getElementById("equilibriumStatus");
    const fxEl = document.getElementById("eqFxResidual");
    const fyEl = document.getElementById("eqFyResidual");
    const mzEl = document.getElementById("eqMzResidual");
    const maxEl = document.getElementById("eqMaxResidual");
    const noteEl = document.getElementById("equilibriumNote");

    if (result.grid) {
        if (fxEl) fxEl.textContent = `${formatNum(sumFx)} kN·m`;
        if (fyEl) fyEl.textContent = `${formatNum(sumFy)} kN·m`;
        if (mzEl) mzEl.textContent = `${formatNum(sumMz)} kN`;
    } else {
        if (fxEl) fxEl.textContent = `${formatNum(sumFx)} kN`;
        if (fyEl) fyEl.textContent = `${formatNum(sumFy)} kN`;
        if (mzEl) mzEl.textContent = `${formatNum(sumMz)} kN·m`;
    }
    const forceResidual = Number.isFinite(result.maxForceResidual)
        ? result.maxForceResidual
        : (result.grid ? Math.abs(sumMz) : Math.max(Math.abs(sumFx), Math.abs(sumFy)));
    const momentResidual = Number.isFinite(result.maxMomentResidual)
        ? result.maxMomentResidual
        : (result.grid ? Math.max(Math.abs(sumFx), Math.abs(sumFy)) : Math.abs(sumMz));
    const residualSummary = `Force: ${formatNum(forceResidual)} kN · Moment: ${formatNum(momentResidual)} kN·m`;
    if (maxEl) maxEl.textContent = residualSummary;

    if (statusEl) {
        statusEl.classList.toggle("ok", balanced);
        statusEl.classList.toggle("warn", !balanced);
        statusEl.textContent = balanced
            ? `✓ Equilibrium satisfied — ${residualSummary}`
            : `⚠ Equilibrium check failed — ${residualSummary}`;
    }
    if (noteEl) {
        noteEl.textContent = result.grid
            ? (balanced
                ? `ΣMx = ${formatNum(sumFx)} kN·m, ΣMy = ${formatNum(sumFy)} kN·m, ΣFz = ${formatNum(sumMz)} kN. Global Grid equilibrium residuals are within tolerance.`
                : `Grid global equilibrium residuals exceed tolerance. Force tolerance: ${formatNum(result.forceTolerance ?? tolerance)} kN; moment tolerance: ${formatNum(momentTolerance)} kN·m. Check member loads, nodal loads, torsion signs and support conditions.`)
            : (balanced
                ? `ΣFx = ${formatNum(sumFx)} kN, ΣFy = ${formatNum(sumFy)} kN, ΣMz = ${formatNum(sumMz)} kN·m. Residuals are within tolerance.`
                : `Check load directions, moment signs, support reactions, and member load equilibrium. Force tolerance: ${formatNum(tolerance)} kN; moment tolerance: ${formatNum(momentTolerance)} kN·m.`);
    }
}

// Compatibility wrapper preserving the original combined signature/behavior
// used by solveStep7 (calculate, then immediately render).
function updateEquilibriumCheck(AC, dofMap, modelNodes, restIndices, AR) {
    const result = isGridAnalysisMode()
        ? calculateGridEquilibriumResiduals(AC, dofMap, modelNodes, restIndices, AR)
        : calculateEquilibriumResiduals(AC, dofMap, modelNodes, restIndices, AR);
    renderEquilibriumCheck(result);
    return result;
}



// Maximum-magnitude displacement, reaction, axial force, shear, and moment
// across the whole solved structure, for the compact Results summary strip.
// Pure calculation — no DOM access.
function calculateAnalysisSummary(dofMap, D, AR, restIndices) {
    if (isGridAnalysisMode()) {
        let maxDisp = 0;
        model.nodes.forEach((node) => {
            const d = dofMap[node.id];
            if (d && d.z !== null) maxDisp = Math.max(maxDisp, Math.abs(Number(D[d.z]?.[0]) || 0));
        });
        let maxReaction = 0;
        model.supportAssignments.forEach((sa) => { maxReaction = Math.max(maxReaction, Math.abs(Number(sa.rz) || 0)); });
        let maxA = 0, maxV = 0, maxM = 0;
        model.elements.forEach((el) => {
            const AM = el.gridEndActions;
            if (!Array.isArray(AM) || AM.length < 6) return;
            maxA = Math.max(maxA, Math.abs(Number(AM[0]?.[0]) || 0), Math.abs(Number(AM[3]?.[0]) || 0));
            maxV = Math.max(maxV, Math.abs(Number(AM[1]?.[0]) || 0), Math.abs(Number(AM[4]?.[0]) || 0));
            maxM = Math.max(maxM, Math.abs(Number(AM[2]?.[0]) || 0), Math.abs(Number(AM[5]?.[0]) || 0));
        });
        return { maxDisp, maxReaction, maxA, maxV, maxM, grid: true };
    }
    let maxDisp = 0;
    model.nodes.forEach((n) => {
        const d = dofMap[n.id];
        if (!d) return;
        const ux = Number(D[d.x]?.[0]) || 0;
        const uy = Number(D[d.y]?.[0]) || 0;
        const mag = Math.hypot(ux, uy);
        if (mag > maxDisp) maxDisp = mag;
    });

    let maxReaction = 0;
    model.supportAssignments.forEach((sa) => {
        // Reactions are reported as a force resultant in kN; moment reaction
        // is intentionally excluded because it has different units.
        const mag = Math.hypot(Number(sa.rx) || 0, Number(sa.ry) || 0);
        if (mag > maxReaction) maxReaction = mag;
    });

    let maxA = 0, maxV = 0, maxM = 0;
    model.elements.forEach((el) => {
        if (!el.plotData) return;
        const pd = el.plotData;
        const xs = [];
        for (let i = 0; i <= 50; i++) xs.push((i / 50) * pd.L);
        pd.pointLoads.forEach((pl) => { xs.push(pl.a - 1e-6, pl.a + 1e-6); });
        pd.localPointMoments.forEach((pm) => { xs.push(pm.a - 1e-6, pm.a + 1e-6); });
        pd.localUDLs.forEach((udl) => { xs.push(udl.a, udl.b); });
        xs.sort((a, b) => a - b);

        xs.forEach((x) => {
            let A_ax = Number(pd.fx1) || 0;
            let V = Number(pd.fy1) || 0;
            let M = -(Number(pd.mz1) || 0) + (Number(pd.fy1) || 0) * x;

            A_ax += (Number(pd.wx) || 0) * x;
            V += (Number(pd.wy) || 0) * x;
            M += ((Number(pd.wy) || 0) * x * x) / 2;

            pd.localUDLs.forEach((udl) => {
                const wx1 = (Number(udl.Fx1) || 0) * pd.cx + (Number(udl.Fy1) || 0) * pd.cy;
                const wy1 = -(Number(udl.Fx1) || 0) * pd.cy + (Number(udl.Fy1) || 0) * pd.cx;
                const wx2 = (Number(udl.Fx2) || 0) * pd.cx + (Number(udl.Fy2) || 0) * pd.cy;
                const wy2 = -(Number(udl.Fx2) || 0) * pd.cy + (Number(udl.Fy2) || 0) * pd.cx;
                if (x > udl.a) {
                    const L_udl = udl.b - udl.a;
                    const len = Math.min(x, udl.b) - udl.a;
                    const w2x = wx1 + ((wx2 - wx1) * len) / L_udl;
                    A_ax += ((wx1 + w2x) / 2) * len;
                    const w2y = wy1 + ((wy2 - wy1) * len) / L_udl;
                    V += ((wy1 + w2y) / 2) * len;
                    const V_rect = wy1 * len;
                    const M_rect = V_rect * (x - (udl.a + len / 2));
                    const V_tri = 0.5 * (w2y - wy1) * len;
                    const M_tri = V_tri * (x - (udl.a + (2 * len) / 3));
                    M += M_rect + M_tri;
                }
            });

            pd.pointLoads.forEach((pl) => {
                if (x > pl.a) {
                    A_ax += Number(pl.Px) || 0;
                    V += Number(pl.Py) || 0;
                    M += (Number(pl.Py) || 0) * (x - pl.a);
                }
            });
            pd.localPointMoments.forEach((pm) => {
                if (x > pm.a) M -= Number(pm.Mz) || 0;
            });

            maxA = Math.max(maxA, Math.abs(A_ax));
            maxV = Math.max(maxV, Math.abs(V));
            maxM = Math.max(maxM, Math.abs(M));
        });
    });

    return { maxDisp, maxReaction, maxA, maxV, maxM };
}

// Writes an analysis summary (from calculateAnalysisSummary()) into the
// Results summary strip. Pure DOM update — no calculation. The equilibrium
// status label is intentionally read back from the equilibriumStatus element
// rather than recomputed, matching the original behavior of reflecting
// whatever renderEquilibriumCheck() most recently displayed there.
function renderAnalysisSummary(summary) {
    const { maxDisp, maxReaction, maxA, maxV, maxM } = summary;

    const dispEl = document.getElementById("summaryMaxDisplacement");
    const reactEl = document.getElementById("summaryMaxReaction");
    const axialEl = document.getElementById("summaryMaxAxial");
    const shearEl = document.getElementById("summaryMaxShear");
    const momentEl = document.getElementById("summaryMaxMoment");
    const eqEl = document.getElementById("summaryEquilibriumStatus");

    if (dispEl) dispEl.textContent = `${formatNum(maxDisp * 1000)} mm`;
    if (reactEl) reactEl.textContent = `${formatNum(maxReaction)} kN`;
    if (axialEl) axialEl.textContent = summary.grid ? `${formatNum(maxA)} kN·m` : `${formatNum(maxA)} kN`;
    if (shearEl) shearEl.textContent = summary.grid ? `${formatNum(maxV)} kN·m` : `${formatNum(maxV)} kN`;
    if (momentEl) momentEl.textContent = summary.grid ? `${formatNum(maxM)} kN` : `${formatNum(maxM)} kN·m`;
    if (eqEl) {
        const eq = document.getElementById("equilibriumStatus");
        eqEl.textContent = eq && eq.textContent.includes("satisfied") ? "Satisfied" : "Check failed";
    }
}

// Compatibility wrapper preserving the original combined signature/behavior
// used by runAnalysisCore (calculate, then immediately render).
function updateAnalysisSummary(dofMap, D, AR, restIndices) {
    const summary = calculateAnalysisSummary(dofMap, D, AR, restIndices);
    renderAnalysisSummary(summary);
    return summary;
}

function showAnalysisLoading() {
    const overlay = document.getElementById("analysisLoadingOverlay");
    const text = document.getElementById("analysisLoadingText");
    if (!overlay) return;
    if (text) {
        text.textContent =
            `Loading ${model.nodes.length} nodes, ${model.elements.length} elements, ` +
            `${model.loads.length} loads and ${model.moments.length} moments…`;
    }
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function hideAnalysisLoading() {
    const overlay = document.getElementById("analysisLoadingOverlay");
    if (!overlay) return;
    overlay.classList.remove("active");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

function runAnalysis() {
    showAnalysisLoading();

    // Give the browser one full paint cycle so the loading screen is actually
    // rendered before the synchronous stiffness calculation begins. This is
    // especially important for large imported models.
    requestAnimationFrame(() => {
        setTimeout(() => {
            try {
                runAnalysisCore();
            } catch (error) {
                console.error(error);
                alert("Analysis failed. Check the browser console for details.");
            } finally {
                hideAnalysisLoading();
            }
        }, 30);
    });
}

// ==========================================================================
// 16b. ANALYSIS ORCHESTRATOR
// The only top-level analysis controller. Validates input, establishes the
// active load/moment cases, then runs the eight solver steps in order and
// hands their results to the matching render/UI-update calls. No structural
// mathematics lives directly in this function.
// ==========================================================================
function updateSolverModeResultHeaders() {
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    if (isGridAnalysisMode()) {
        setText("resDispHdr1", "θX (rad)"); setText("resDispHdr2", "θY (rad)"); setText("resDispHdr3", "ΔZ (m)");
        setText("resReactionGlobalHeading", "Grid DOF Reactions"); setText("resReactionLocalHeading", "Local Components");
        setText("resReactionHdr1", "Mx (kN·m)"); setText("resReactionHdr2", "My (kN·m)"); setText("resReactionHdr3", "Fz (kN)");
        setText("resReactionHdr4", "—"); setText("resReactionHdr5", "—"); setText("resReactionHdr6", "—");
        setText("resForceHdr1", "Mx (kN·m)"); setText("resForceHdr2", "My (kN·m)"); setText("resForceHdr3", "Fz (kN)");
        setText("eqFxLabel", "ΣMx Residual"); setText("eqFyLabel", "ΣMy Residual"); setText("eqMzLabel", "ΣFz Residual");
        setText("eqMaxResidualLabel", "Force / Moment Residuals");
        setText("summaryAxialLabel", "Maximum Mx action"); setText("summaryShearLabel", "Maximum My action"); setText("summaryMomentLabel", "Maximum Fz action");
    } else {
        setText("resDispHdr1", "UX (m)"); setText("resDispHdr2", "UY (m)"); setText("resDispHdr3", "RZ (rad)");
        setText("resReactionGlobalHeading", "Global Axes"); setText("resReactionLocalHeading", "Local Axes (lowest-ID connected member)");
        setText("resReactionHdr1", "Fx (kN)"); setText("resReactionHdr2", "Fy (kN)"); setText("resReactionHdr3", "Mz (kN·m)");
        setText("resReactionHdr4", "Fx′ (kN)"); setText("resReactionHdr5", "Fy′ (kN)"); setText("resReactionHdr6", "Mz′ (kN·m)");
        setText("resForceHdr1", "Axial (kN)"); setText("resForceHdr2", "Shear (kN)"); setText("resForceHdr3", "Moment (kN·m)");
        setText("eqFxLabel", "ΣFx Residual"); setText("eqFyLabel", "ΣFy Residual"); setText("eqMzLabel", "ΣMz Residual");
        setText("eqMaxResidualLabel", "Force / Moment Residuals");
        setText("summaryAxialLabel", "Maximum axial force"); setText("summaryShearLabel", "Maximum shear"); setText("summaryMomentLabel", "Maximum bending moment");
    }
}

function runAnalysisCore() {
    setActiveAnalysisCases();

    if (model.nodes.length === 0 || model.elements.length === 0) {
        return alert("Model is empty. Please define nodes and elements.");
    }

    if (model.loads.length > 0 && !activeLoadCaseId) {
        return alert("Select an Active Load Case before running analysis.");
    }
    if (model.moments.length > 0 && !activeMomentCaseId) {
        return alert("Select an Active Moment Case before running analysis.");
    }

    const activeLoadCase = model.loadCases.find((lc) => String(lc.id) === String(activeLoadCaseId));
    const activeLoadCount = model.loads.filter(isActiveLoadCase).length;
    const activeMomentCount = model.moments.filter(isActiveMomentCase).length;
    if (model.loads.length > 0 && activeLoadCount === 0 && activeLoadCase?.type !== "Self Weight") {
        return alert(`No loads belong to Active Load Case "${activeLoadCaseId}". Choose a case containing loads or select a Self Weight case with per-element weights.`);
    }
    if (model.moments.length > 0 && activeMomentCount === 0) {
        return alert(`No moments belong to Active Moment Case "${activeMomentCaseId}". Choose a case containing moments.`);
    }

    const missingSelfWeightElement = getMissingSelfWeightElement(activeLoadCase);
    if (missingSelfWeightElement) {
        return alert(`Self Weight Load Case "${activeLoadCaseId}" has no valid weight for element "${missingSelfWeightElement.id}". Edit the load case and enter its self-weight in kN/m (enter 0 only if zero is intentional).`);
    }

    // Grid's supplied calculation engine is a 3-DOF plate-grid formulation:
    // θX, θY and ΔZ. Reject components that its model does not represent
    // rather than silently dropping them during assembly.
    if (isGridAnalysisMode()) {
        const unsupportedLoad = model.loads.find((load) => {
            if (!isActiveLoadCase(load)) return false;
            const fx = Number(load.Fx) || 0;
            const fy = Number(load.Fy) || 0;
            const fxEnd = Number(load.FxEnd) || 0;
            const fyEnd = Number(load.FyEnd) || 0;
            return Math.abs(fx) > 1e-12 || Math.abs(fy) > 1e-12 ||
                (load.type === "Element UDL" && (Math.abs(fxEnd) > 1e-12 || Math.abs(fyEnd) > 1e-12));
        });
        if (unsupportedLoad) {
            return alert(`Grid load "${unsupportedLoad.id}" contains Fx/Fy components. The Grid solver only supports Fz for nodal and member forces; set unsupported components to zero.`);
        }
        const unsupportedNodalMoment = model.moments.find((moment) =>
            isActiveMomentCase(moment) && moment.type === "Nodal Moment" && Math.abs(Number(moment.Mz) || 0) > 1e-12
        );
        if (unsupportedNodalMoment) {
            return alert(`Nodal moment "${unsupportedNodalMoment.id}" contains Mz, but Grid joints only have θX, θY and ΔZ DOFs. Use nodal Mx/My; Mz is supported only as a member moment input.`);
        }
    }

    const activeCaseLabel = getActiveAnalysisCaseLabel();
    const hasSelfWeightData = model.loadCases.some((loadCase) => loadCase.type === "Self Weight" && Object.values(loadCase.memberSelfWeights || {}).some((weight) => Number(weight) > 0));
    if (hasSelfWeightData && activeLoadCase?.type !== "Self Weight") {
        const useSelfWeight = confirm(
            `The selected Load Case "${activeLoadCaseId}" is not a Self Weight case. Self-weight from the other case will be excluded from this analysis.\n\nContinue?`,
        );
        if (!useSelfWeight) return;
    }

    // Matrix algebra helper (zeros/add/sub/mul/transpose/invert) — see the
    // "MATRIX ALGEBRA UTILITIES" section near the top of this file.
    const heavyModel = model.nodes.length > 10;
    const ctx = { activeCaseLabel, activeLoadCase, heavyModel };

    const step1 = solveStep1(ctx);
    if (!step1) return;

    const step2 = solveStep2(ctx, step1);
    const step3 = solveStep3(ctx, step1);

    const step4 = solveStep4(ctx, step1, step3);
    if (!step4) return;

    const step5 = solveStep5(ctx, step1, step4);
    const step6 = solveStep6(ctx, step1, step5);
    if (!step6) return;

    const step7 = solveStep7(ctx, step1, step4, step5, step6);
    const step8 = solveStep8(ctx, step7);

    let stepsHTML = "";
    stepsHTML += renderStep1(step1);
    stepsHTML += renderStep2(step2);
    stepsHTML += renderStep3(step3);
    stepsHTML += renderStep4(step4);
    stepsHTML += renderStep5(step5);
    stepsHTML += renderStep6(step6);
    stepsHTML += renderStep7(step7);
    stepsHTML += renderStep8(step8);

    updateSolverModeResultHeaders();
    document.getElementById("resDispTable").innerHTML = step7.resDispHTML;
    document.getElementById("resReactionsTable").innerHTML = step7.resReactHTML;
    document.getElementById("resForcesTable").innerHTML = step7.resForceHTML;
    updateAnalysisSummary(step1.dofMap, step6.D, step7.AR, step5.restIndices);

    document.getElementById("calcStepsContainer").innerHTML = stepsHTML;
    setupResultDetailPanels();
    const equilibriumPassed = step7.equilibriumResult?.balanced !== false;
    if (equilibriumPassed) markAnalysisValid();
    else markAnalysisFailed();
    const statusEl = document.getElementById("activeAnalysisCaseStatus");
    if (statusEl) {
        statusEl.textContent = equilibriumPassed
            ? ` Active: ${activeCaseLabel}`
            : ` Active: ${activeCaseLabel} • Equilibrium check failed`;
        if (!equilibriumPassed) statusEl.style.color = "#991b1b";
    }
    document.getElementById("resultsContent").style.display = "block";
    if (model.nodes.length > 10) {
        showHeavyDiagramPlaceholder("reactionSVGSmall");
    } else {
        drawDiagramSVG("reactionSVGSmall", "reactions");
    }
    updateResultsDiagram();
    if (equilibriumPassed) {
        alert(isGridAnalysisMode()
            ? "Grid analysis completed successfully using the Grid Stiffness Method."
            : "Analysis completed successfully using the LPW-3 Stiffness Method approach.");
    } else {
        alert("Analysis results were computed, but the global equilibrium check failed. Review the residuals, load cases, load directions and support conditions before relying on these results. PDF export is disabled until equilibrium passes.");
    }
}

// ==========================================================================
// 16b. PDF EXPORT (full 8-step solution report, generated in the page)
// Builds the report pages in a hidden frame from the SAME step content the
// page shows (Steps 1-7 are cloned from the results panels), draws the
// AFD / SFD / BMD diagrams as Step 8 (instead of the final tables), turns
// every report page is written as REAL vector PDF content (selectable text,
// vector diagrams - no images) and the PDF file is downloaded directly. No print dialog or device print feature is used.
// ==========================================================================
const PdfLayout = {
    pageW: 1160, pageH: 820, // page size in CSS px (A4 landscape ratio)
    marginX: 30, headerH: 46, footerH: 38,
    contentW: 1100,
    ptW: 841.89, ptH: 595.28, // A4 landscape in PDF points
};
PdfLayout.contentH = PdfLayout.pageH - PdfLayout.headerH - PdfLayout.footerH;
let pdfExportBusy = false;

const PDF_FRAME_CSS = `
html, body { margin: 0; padding: 0; background: #fff !important; overflow: visible !important; max-width: none !important; min-height: 0 !important; height: auto !important; display: block !important; }
#pdfRoot { width: ${PdfLayout.contentW}px; background: #fff; font-family: Inter, Arial, Helvetica, sans-serif; color: #182230; }
#pdfRoot .calc-step { margin: 0 !important; padding: 0 !important; border: 0 !important; }
#pdfRoot .eq-wrap, #pdfRoot .table-wrap, #pdfRoot .canvas-container { overflow: visible !important; }
#pdfRoot * { animation: none !important; transition: none !important; }
#pdfRoot .pdf-diagram h5 { margin-top: 0; }
#pdfRoot .pdf-diagram-box { border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; padding: 6px; }
#pdfRoot .pdf-diagram-box svg { width: 100% !important; height: auto !important; display: block; }
#pdfRoot .result-diagram-fixed-legend { position: static !important; z-index: auto !important; opacity: 1 !important; background: #fff !important; display: block; width: max-content; margin-top: 8px; box-shadow: none !important; max-height: none !important; overflow: visible !important; }
`;

function buildPdfDiagramBlock(mode) {
    const bb = getBoundingBox();
    const dX = Math.max(bb.maxX - bb.minX, 1e-9);
    const dY = Math.max(bb.maxY - bb.minY, 1e-9);
    const minL = getMinimumElementLength();
    const baselinePx = AppConfig.sharedDiagramBaselinePx;
    const diagramScale = minL && Number.isFinite(minL) && minL > 0 ? baselinePx / minL : baselinePx;
    const padding = 140;
    const renderWidth = Math.max(800, dX * diagramScale + 2 * padding);
    const renderHeight = Math.max(400, dY * diagramScale + 2 * padding);
    const camera = {
        scale: diagramScale,
        offsetX: padding - bb.minX * diagramScale,
        offsetY: padding + bb.maxY * diagramScale,
        intrinsicCanvas: true,
    };
    const renderers = { model: renderStructureModelDiagram, afd: renderAFDDiagram, sfd: renderSFDDiagram, bmd: renderBMDDiagram };
    const svg = renderers[mode](renderWidth, renderHeight, camera);
    const legend = buildResultDiagramLegend(mode, 1);
    return `<div class="pdf-diagram-box">${svg}</div>${legend}`;
}

function pdfShowProgress(text) {
    let ov = document.getElementById("pdfExportOverlay");
    if (!ov) {
        ov = document.createElement("div");
        ov.id = "pdfExportOverlay";
        ov.setAttribute("role", "status");
        ov.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483000;background:rgba(15,23,42,0.72);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;";
        ov.innerHTML = '<div style="background:#fff;border-radius:12px;padding:22px 26px;max-width:86vw;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.35)"><div style="font-size:30px;margin-bottom:8px">📄</div><div style="font-weight:800;color:#1e3a8a;font-size:16px;margin-bottom:6px">Generating PDF…</div><div id="pdfExportOverlayText" style="font-size:13px;color:#475569"></div></div>';
        document.body.appendChild(ov);
    }
    const t = document.getElementById("pdfExportOverlayText");
    if (t) t.textContent = text;
    return new Promise((resolve) => setTimeout(resolve, 20)); // let the browser repaint
}

function pdfHideProgress() {
    const ov = document.getElementById("pdfExportOverlay");
    if (ov) ov.remove();
}

function pdfCreateFrame() {
    // The application stylesheets live in external files (assets/css, modules/**),
    // so the off-screen layout frame links the very same files instead of copying
    // <style> text. Any remaining inline <style> blocks are still copied as before.
    const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .map((lk) => `<link rel="stylesheet" href="${lk.href}">`).join("");
    const pageStyles = Array.from(document.querySelectorAll("style")).map((st) => st.textContent).join("\n");
    const frame = document.createElement("iframe");
    frame.id = "pdfRenderFrame";
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;left:-30000px;top:0;width:1500px;height:1000px;border:0;pointer-events:none;";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8">${styleLinks}<style>${pageStyles}</style><style>${pdfFrameFontCss()}</style><style>${PDF_FRAME_CSS}</style></head><body><div id="pdfRoot"></div></body></html>`);
    doc.close();
    frame.stylesReady = pdfWaitForFrameStyles(doc).then(() => pdfLoadFrameFonts(doc));
    return frame;
}

// Resolves once every <link rel="stylesheet"> inside the render frame has loaded
// (or failed / timed out), so layout measurements use the final styles.
function pdfWaitForFrameStyles(doc) {
    const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
    const waits = links.map((lk) => new Promise((resolve) => {
        if (lk.sheet) return resolve();
        lk.addEventListener("load", () => resolve());
        lk.addEventListener("error", () => resolve());
    }));
    const timeout = new Promise((resolve) => setTimeout(resolve, 8000));
    return Promise.race([Promise.all(waits), timeout]);
}

// Replaces every inline <svg> by an <img> of the same size so the diagrams
// are drawn by the browser's own SVG renderer (sharp, exact colours/text).
async function pdfRasterizeSvgs(doc, root) {
    // (name kept for compatibility) The diagrams stay REAL <svg> elements - they
    // are written to the PDF as vector graphics. Here they only receive a fixed
    // size so the layout (and the page planning) is stable.
    Array.from(root.querySelectorAll("svg")).forEach((svg) => {
        const r = svg.getBoundingClientRect();
        let w = Math.round(r.width);
        let h = Math.round(r.height);
        if (!w || !h) {
            const vb = (svg.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
            w = vb[2] || 300;
            h = vb[3] || 150;
        }
        const box = svg.closest(".pdf-diagram-box");
        if (box) {
            const maxH = 500;
            const boxW = box.clientWidth - 14;
            const k = Math.min(1, maxH / h, boxW / w);
            w = Math.round(w * k);
            h = Math.round(h * k);
            svg.style.setProperty("margin", "0 auto", "important");
        }
        svg.setAttribute("width", w);
        svg.setAttribute("height", h);
        svg.style.setProperty("width", w + "px", "important");
        svg.style.setProperty("height", h + "px", "important");
        svg.style.setProperty("display", "block", "important");
        if (!svg.getAttribute("xmlns")) svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    });
}

// Splits a simple table that is wider than the page into several tables
// by column groups (first column repeated) so its text stays readable.
function pdfSplitWideTables(root) {
    const doc = root.ownerDocument;
    const maxW = PdfLayout.contentW;
    Array.from(root.querySelectorAll("table")).forEach((table) => {
        if (table.parentElement && table.parentElement.closest("table")) return;
        if (table.classList.contains("matrix-table")) return;
        const r = table.getBoundingClientRect();
        if (r.width <= maxW * 1.12) return;
        const head = table.tHead && table.tHead.rows.length === 1 ? table.tHead.rows[0] : null;
        const bodyRows = Array.from(table.tBodies).flatMap((b) => Array.from(b.rows));
        if (!head || !bodyRows.length) return;
        const nCols = head.cells.length;
        const simple = [head, ...bodyRows].every(
            (row) => row.cells.length === nCols && Array.from(row.cells).every((c) => c.colSpan === 1 && c.rowSpan === 1),
        );
        if (!simple || nCols < 3) return;
        const colW = Array.from(head.cells).map((c) => c.getBoundingClientRect().width);
        const groups = [];
        let cur = [];
        let curW = colW[0];
        for (let c = 1; c < nCols; c++) {
            if (cur.length && curW + colW[c] > maxW) {
                groups.push(cur);
                cur = [];
                curW = colW[0];
            }
            cur.push(c);
            curW += colW[c];
        }
        if (cur.length) groups.push(cur);
        if (groups.length < 2) return;
        groups.forEach((cols, gi) => {
            const keep = new Set([0, ...cols]);
            const t = table.cloneNode(false);
            t.style.width = "100%";
            t.style.minWidth = "0";
            if (gi > 0) t.style.marginTop = "14px";
            const prune = (row) => {
                const rc = row.cloneNode(true);
                Array.from(rc.cells).forEach((cell, idx) => {
                    if (!keep.has(idx)) cell.remove();
                });
                return rc;
            };
            const th = doc.createElement("thead");
            th.appendChild(prune(head));
            t.appendChild(th);
            const tb = doc.createElement("tbody");
            bodyRows.forEach((row) => tb.appendChild(prune(row)));
            t.appendChild(tb);
            table.parentNode.insertBefore(t, table);
        });
        table.remove();
    });
}

// Equations (matrix products) much wider than the page are allowed to wrap
// onto several lines instead of being shrunk to an unreadable size.
// DOF numbering of a matrix: the column numbers are centred over the text of
// their column and the row numbers get exactly the height of their matrix row,
// so both line up precisely with the numbers they belong to.
function pdfAlignMatrixLabels(root) {
    root.querySelectorAll(".matrix-wrapper").forEach((wrap) => {
        const table = wrap.querySelector("table.matrix-table");
        if (!table || !table.rows.length) return;
        const kids = Array.from(wrap.children);
        const mainRow = kids.find((k) => k.contains(table));
        const colRow = kids.find((k) => k !== mainRow && !k.classList.contains("matrix-title") && k.children.length > 0);
        const rowLabels = mainRow && mainRow.lastElementChild && mainRow.lastElementChild !== table &&
            !mainRow.lastElementChild.contains(table) && mainRow.lastElementChild.children.length
            ? mainRow.lastElementChild : null;
        const doc = wrap.ownerDocument;
        const wr = wrap.getBoundingClientRect();
        const tr0 = table.getBoundingClientRect();
        const rows = Array.from(table.rows);

        // ---- column numbers
        if (colRow && colRow !== rowLabels) {
            const labels = Array.from(colRow.children);
            const cells = Array.from(rows[0].cells);
            if (labels.length === cells.length) {
                const range = doc.createRange();
                const plan = cells.map((cell, j) => {
                    const cr = cell.getBoundingClientRect();
                    let l = Infinity, r = -Infinity;
                    rows.forEach((row) => {
                        const c = row.cells[j];
                        if (!c || !c.firstChild) return;
                        range.selectNodeContents(c);
                        Array.from(range.getClientRects()).forEach((q) => {
                            if (q.width > 0) { l = Math.min(l, q.left); r = Math.max(r, q.right); }
                        });
                    });
                    const textCenter = isFinite(l) ? (l + r) / 2 : cr.left + cr.width / 2;
                    return { width: cr.width, shift: textCenter - (cr.left + cr.width / 2) };
                });
                colRow.style.width = tr0.width + "px";
                colRow.style.padding = "0";
                colRow.style.justifySelf = "start";
                colRow.style.marginLeft = tr0.left - wr.left + "px";
                labels.forEach((lab, j) => {
                    lab.style.flex = "none";
                    lab.style.width = plan[j].width + "px";
                    lab.style.textAlign = "center";
                    lab.style.position = "relative";
                    lab.style.left = plan[j].shift + "px";
                });
            }
        }

        // ---- row numbers
        if (rowLabels && rowLabels.children.length === rows.length) {
            const rr = rows.map((row) => row.getBoundingClientRect());
            const cr = rowLabels.getBoundingClientRect();
            const labels = Array.from(rowLabels.children);
            rowLabels.style.padding = "0";
            rowLabels.style.paddingTop = Math.max(0, rr[0].top - cr.top) + "px";
            rowLabels.style.justifyContent = "flex-start";
            labels.forEach((lab, i) => {
                const h = i < rr.length - 1 ? rr[i + 1].top - rr[i].top : rr[i].height;
                lab.style.height = h + "px";
                lab.style.display = "flex";
                lab.style.alignItems = "center";
                lab.style.lineHeight = "1";
            });
        }
    });
}

// Packs the matrices / equations of a step side by side: every equation (".eq-row")
// is kept as ONE unbroken unit and as many units as fit are placed on one line.
// Each finished line is followed by exactly one blank line.
function pdfPackEquationRows(root) {
    const contentW = PdfLayout.contentW;
    const GAP = 40; // horizontal space between two units of a line
    const win = root.ownerDocument.defaultView;
    const doc = root.ownerDocument;
    const parents = new Set();
    root.querySelectorAll(".eq-wrap").forEach((w) => parents.add(w.parentElement));
    parents.forEach((parent) => {
        // one blank line = the line height of the surrounding text
        const probe = parent.querySelector("p") || parent;
        const pcs = win.getComputedStyle(probe);
        const fsz = parseFloat(pcs.fontSize) || 14;
        const lineGap = Math.round(parseFloat(pcs.lineHeight) || fsz * 1.5);

        const kids = Array.from(parent.children);
        let i = 0;
        while (i < kids.length) {
            if (!kids[i].classList.contains("eq-wrap")) { i++; continue; }
            const run = [];
            while (i < kids.length && kids[i].classList.contains("eq-wrap")) run.push(kids[i++]);
            const rows = [];
            run.forEach((w) => Array.from(w.children).forEach((c) => c.classList.contains("eq-row") && rows.push(c)));
            if (!rows.length) continue;

            const wcs = win.getComputedStyle(run[0]);
            const chrome = parseFloat(wcs.paddingLeft) + parseFloat(wcs.paddingRight) +
                parseFloat(wcs.borderLeftWidth) + parseFloat(wcs.borderRightWidth);
            const inner = contentW - chrome;
            rows.forEach((r) => {
                r.style.flex = "none";
                r.style.width = "max-content";
                r.style.minWidth = "0";
                r.style.margin = "0";
            });
            const widths = rows.map((r) => r.getBoundingClientRect().width);

            const lines = [];
            let cur = null;
            let curW = 0;
            rows.forEach((r, k) => {
                if (cur && curW + GAP + widths[k] <= inner) {
                    cur.push(r);
                    curW += GAP + widths[k];
                } else {
                    cur = [r];
                    curW = widths[k];
                    lines.push(cur);
                }
            });

            const anchor = run[0];
            lines.forEach((items) => {
                const line = doc.createElement("div");
                line.className = "eq-wrap pdf-eq-line";
                line.style.flexDirection = "row";
                line.style.flexWrap = "nowrap";
                // a unit wider than the line starts at the left edge: its overflow then
                // grows to the right, where the page-fit logic widens the card around it
                const lineW = items.reduce((a, r) => a + r.getBoundingClientRect().width, 0) + GAP * (items.length - 1);
                line.style.justifyContent = lineW > inner ? "flex-start" : "center";
                line.style.alignItems = "flex-start";
                line.style.gap = GAP + "px";
                line.style.marginBottom = lineGap + "px";
                items.forEach((r) => line.appendChild(r));
                parent.insertBefore(line, anchor);
            });
            run.forEach((w) => w.remove());
        }
    });
}

function pdfWrapWideEquations(root) {
    // An equation stays on ONE line (the page is scaled to fit it). Only an
    // extremely wide one - which would become unreadably small - is wrapped.
    root.querySelectorAll(".eq-row").forEach((row) => {
        if (row.getBoundingClientRect().width <= PdfLayout.contentW * 2.5) return;
        row.style.flexWrap = "wrap";
        row.style.minWidth = "0";
        row.style.width = "100%";
        row.style.rowGap = "18px";
        row.style.justifyContent = "center";
    });
}

// Splits any table taller than a page into several tables (same header,
// same column widths) so long tables can flow across pages.
function pdfSplitTallTables(root, availH) {
    const doc = root.ownerDocument;
    Array.from(root.querySelectorAll("table")).forEach((table) => {
        if (table.parentElement && table.parentElement.closest("table")) return;
        const r = table.getBoundingClientRect();
        if (r.height <= availH) return;
        const thead = table.tHead;
        const rows = Array.from(table.tBodies).flatMap((b) => Array.from(b.rows));
        if (rows.length < 2) return;
        const headH = thead ? thead.getBoundingClientRect().height : 0;
        const widths = Array.from(rows[0].cells).map((c) => c.getBoundingClientRect().width);
        const groups = [];
        let cur = [];
        let curH = headH;
        rows.forEach((row) => {
            const h = row.getBoundingClientRect().height;
            if (cur.length && curH + h > availH - 4) {
                groups.push(cur);
                cur = [];
                curH = headH;
            }
            cur.push(row);
            curH += h;
        });
        if (cur.length) groups.push(cur);
        if (groups.length < 2) return;
        groups.forEach((g) => {
            const t = table.cloneNode(false);
            t.style.width = r.width + "px";
            t.style.tableLayout = "fixed";
            const cg = doc.createElement("colgroup");
            widths.forEach((wd) => {
                const col = doc.createElement("col");
                col.style.width = wd + "px";
                cg.appendChild(col);
            });
            t.appendChild(cg);
            if (thead) t.appendChild(thead.cloneNode(true));
            const tb = doc.createElement("tbody");
            g.forEach((row) => tb.appendChild(row.cloneNode(true)));
            t.appendChild(tb);
            table.parentNode.insertBefore(t, table);
        });
        table.remove();
    });
}

// Breaks the section into "blocks" (heading, paragraph, matrix row, table…)
// that are never cut through; blocks taller than a page are split further.
function pdfCollectBlocks(root, availH) {
    const win = root.ownerDocument.defaultView;
    const out = [];
    const walk = (parent) => {
        Array.from(parent.children).forEach((c) => {
            const cs = win.getComputedStyle(c);
            if (cs.display === "none") return;
            const r = c.getBoundingClientRect();
            if (r.height < 1 && r.width < 1) return;
            const onlyElements = Array.from(c.childNodes).every(
                (n) => n.nodeType === 1 || (n.nodeType === 3 && !n.textContent.trim()),
            );
            const stacks = cs.display === "block" || (cs.display === "flex" && cs.flexDirection === "column");
            if (
                r.height > availH * 0.45 && c.children.length && onlyElements && stacks &&
                c.tagName !== "TABLE" && !c.classList.contains("pdf-diagram")
            ) {
                walk(c);
            } else {
                out.push(c);
            }
        });
    };
    walk(root);
    return out;
}

function pdfPlanPages(root, blocks, availH) {
    const contentW = PdfLayout.contentW;
    const win = root.ownerDocument.defaultView;
    const px = (v) => parseFloat(v) || 0;
    const rootTop = root.getBoundingClientRect().top;

    // 1. Measure the true content width of every block, pin every block to
    //    that width, then widen the containers of the wide ones so panel
    //    backgrounds / borders cover the whole content. Pinning first keeps
    //    the other blocks that share a container at their normal size.
    const measured = blocks.map((el) => {
        // True content width: the block itself or any descendant sticking out
        // to the right (scrollWidth alone misses overflowing tables).
        const br = el.getBoundingClientRect();
        let w = Math.max(el.offsetWidth || 0, br.width);
        el.querySelectorAll("*").forEach((d) => {
            const dr = d.getBoundingClientRect();
            if (dr.width > 0 && dr.right - br.left > w) w = dr.right - br.left;
        });
        return w;
    });
    blocks.forEach((el, i) => {
        el.style.width = Math.ceil(measured[i]) + "px";
        el.style.maxWidth = "none";
    });
    const widths = blocks.map((el, i) => {
        const w = measured[i];
        if (w <= contentW + 1) return w;
        let acc = 0;
        let a = el.parentElement;
        while (a && a !== root) {
            const cs = win.getComputedStyle(a);
            acc += px(cs.paddingLeft) + px(cs.paddingRight) + px(cs.borderLeftWidth) + px(cs.borderRightWidth);
            const need = Math.ceil(w + acc);
            if ((a.offsetWidth || 0) < need) {
                a.style.width = need + "px";
                a.style.maxWidth = "none";
            }
            a = a.parentElement;
        }
        return w + acc;
    });

    // 2. Measure every block AFTER widening. When a block is the first / last
    //    child of a container, the container's padding and border are included.
    const items = blocks.map((el, i) => {
        const r = el.getBoundingClientRect();
        let top = r.top;
        let bottom = r.bottom;
        let cur = el;
        while (cur.parentElement && cur.parentElement !== root && cur.parentElement.firstElementChild === cur) {
            cur = cur.parentElement;
            top = Math.min(top, cur.getBoundingClientRect().top);
        }
        cur = el;
        while (cur.parentElement && cur.parentElement !== root && cur.parentElement.lastElementChild === cur) {
            cur = cur.parentElement;
            bottom = Math.max(bottom, cur.getBoundingClientRect().bottom);
        }
        return {
            el,
            w: widths[i],
            top: top - rootTop,
            bottom: bottom - rootTop,
            br: el.classList.contains("pdf-break-before"),
        };
    });

    // 3. Keep a heading together with the block that follows it.
    const units = [];
    for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const isHeading = /^H[1-6]$/.test(it.el.tagName);
        const nx = items[i + 1];
        if (isHeading && nx && !nx.br && nx.bottom - it.top <= availH) {
            units.push({ top: it.top, bottom: nx.bottom, w: Math.max(it.w, nx.w), br: it.br });
            i++;
        } else {
            units.push({ top: it.top, bottom: it.bottom, w: it.w, br: it.br });
        }
    }

    // 4. Fill pages. Wide content (which has to be shrunk) is kept on its
    //    own pages so normal content keeps its full size.
    const pages = [];
    let cur = null;
    units.forEach((u) => {
        if (cur) {
            const wide = u.w > contentW + 1;
            const curWide = cur.w > contentW + 1;
            const w = Math.max(cur.w, u.w);
            const s = Math.min(1, contentW / w);
            const mixed = wide !== curWide && cur.bottom - cur.top > 150;
            if (u.br || mixed || (u.bottom - cur.top) * s > availH) {
                pages.push(cur);
                cur = null;
            }
        }
        if (!cur) cur = { top: u.top, bottom: u.bottom, w: u.w };
        else {
            cur.bottom = Math.max(cur.bottom, u.bottom);
            cur.w = Math.max(cur.w, u.w);
        }
    });
    if (cur) pages.push(cur);
    return pages;
}






// ---------------------------------------------------------------------------
// Vector PDF engine: the report is written with jsPDF as REAL text (embedded
// fonts, selectable / searchable) and REAL vector graphics (borders, fills,
// SVG diagrams through svg2pdf). No page is ever turned into an image.
// ---------------------------------------------------------------------------
const PDF_FONT_FILES = [
    ["sans-400", "PdfSans", "normal"],
    ["sans-700", "PdfSans", "bold"],
    ["sans-400i", "PdfSans", "italic"],
    ["sans-700i", "PdfSans", "bolditalic"],
    ["mono-400", "PdfMono", "normal"],
    ["mono-700", "PdfMono", "bold"],
];
const PDF_FONT_METRICS = { ascent: 0.92822, descent: 0.23584 }; // DejaVu Sans (hhea)
let pdfFontBlobUrls = null;

function pdfSvg2PdfFn() {
    const g = window.svg2pdf;
    if (!g) return null;
    return typeof g === "function" ? g : g.svg2pdf || null;
}

function pdfEngineReady() {
    return !!(window.jspdf && window.jspdf.jsPDF && window.PDF_FONT_DATA && pdfSvg2PdfFn());
}

// @font-face rules for the hidden layout frame. The embedded PDF fonts are
// registered under the family names the page uses, so the frame is laid out
// with exactly the glyph widths that end up in the PDF.
function pdfFrameFontCss() {
    if (!pdfFontBlobUrls) {
        pdfFontBlobUrls = {};
        PDF_FONT_FILES.forEach(([key]) => {
            const bin = atob(window.PDF_FONT_DATA[key]);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            pdfFontBlobUrls[key] = URL.createObjectURL(new Blob([bytes], { type: "font/ttf" }));
        });
    }
    const face = (family, weight, style, key) =>
        `@font-face{font-family:"${family}";font-weight:${weight};font-style:${style};src:url(${pdfFontBlobUrls[key]}) format("truetype");}`;
    let css = "";
    ["Inter", "Arial", "Helvetica", "PdfSans"].forEach((f) => {
        css += face(f, 400, "normal", "sans-400") + face(f, 700, "normal", "sans-700");
        css += face(f, 400, "italic", "sans-400i") + face(f, 700, "italic", "sans-700i");
    });
    ["SFMono-Regular", "Consolas", "Liberation Mono", "Menlo", "PdfMono"].forEach((f) => {
        css += face(f, 400, "normal", "mono-400") + face(f, 700, "normal", "mono-700");
        css += face(f, 400, "italic", "mono-400") + face(f, 700, "italic", "mono-700");
    });
    return css;
}

function pdfLoadFrameFonts(doc) {
    const specs = [];
    ["Arial", "PdfSans"].forEach((f) => {
        ["normal", "italic"].forEach((st) => ["400", "700"].forEach((w) => specs.push(`${st} ${w} 16px "${f}"`)));
    });
    ["Menlo", "PdfMono"].forEach((f) => ["400", "700"].forEach((w) => specs.push(`${w} 16px "${f}"`)));
    return Promise.all(specs.map((s) => doc.fonts.load(s, "Aa1Δ²").catch(() => null))).then(() => (doc.fonts.ready || null));
}

function pdfCreateDocument() {
    const L = PdfLayout;
    const pdf = new window.jspdf.jsPDF({ orientation: "landscape", unit: "pt", format: [L.ptW, L.ptH], compress: true });
    PDF_FONT_FILES.forEach(([key, name, style]) => {
        const file = `${key}.ttf`;
        pdf.addFileToVFS(file, window.PDF_FONT_DATA[key]);
        pdf.addFont(file, name, style, undefined, "Identity-H");
    });
    pdf.setLineJoin("miter");
    return pdf;
}

// The page list passed around by the callers doubles as the holder of the
// PDF document being written (one document per export).
function pdfDocumentFor(pages) {
    if (!pages.pdf) pages.pdf = pdfCreateDocument();
    return pages.pdf;
}

function pdfParseColor(str) {
    if (!str || str === "transparent") return null;
    const m = String(str).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
    if (p.length < 3) return null;
    const a = p.length > 3 ? p[3] : 1;
    return { r: Math.round(p[0]), g: Math.round(p[1]), b: Math.round(p[2]), a: isNaN(a) ? 1 : a };
}

function pdfFontFor(cs) {
    const fam = String(cs.fontFamily || "").toLowerCase();
    const mono = /mono|consolas|menlo|courier/.test(fam);
    const w = cs.fontWeight;
    const bold = w === "bold" || w === "bolder" || parseInt(w, 10) >= 600;
    const italic = /italic|oblique/.test(cs.fontStyle || "");
    if (mono) return { name: "PdfMono", style: bold ? "bold" : "normal" };
    return { name: "PdfSans", style: bold && italic ? "bolditalic" : bold ? "bold" : italic ? "italic" : "normal" };
}

function pdfFitText(pdf, text, maxW) {
    let t = String(text);
    if (pdf.getTextWidth(t) <= maxW) return t;
    while (t.length > 1 && pdf.getTextWidth(t + "…") > maxW) t = t.slice(0, -1);
    return t + "…";
}

// Fills / strokes with an optional alpha.
function pdfWithAlpha(pdf, alpha, fn) {
    if (alpha >= 0.999) return fn();
    pdf.saveGraphicsState();
    pdf.setGState(new pdf.GState({ opacity: Math.max(0, alpha), "stroke-opacity": Math.max(0, alpha) }));
    try {
        return fn();
    } finally {
        pdf.restoreGraphicsState();
    }
}

function pdfBoxRadius(cs, w, h) {
    const one = (v) => {
        const s = String(v || "0").split(" ")[0];
        const n = parseFloat(s) || 0;
        return s.endsWith("%") ? (n / 100) * Math.min(w, h) : n;
    };
    const r = Math.max(one(cs.borderTopLeftRadius), one(cs.borderTopRightRadius), one(cs.borderBottomRightRadius), one(cs.borderBottomLeftRadius));
    return Math.min(r, Math.min(w, h) / 2);
}

// Background + borders of one element as real vector shapes.
function pdfDrawBox(c, cs, rel) {
    const pdf = c.pdf;
    const s = c.s;
    const x = c.x(rel.left), y = c.y(rel.top), w = rel.width * s, h = rel.height * s;
    if (w <= 0 || h <= 0) return;
    const rad = pdfBoxRadius(cs, rel.width, rel.height) * s;

    const bg = pdfParseColor(cs.backgroundColor);
    if (bg && bg.a > 0) {
        pdfWithAlpha(pdf, bg.a, () => {
            pdf.setFillColor(bg.r, bg.g, bg.b);
            if (rad > 0.2) pdf.roundedRect(x, y, w, h, rad, rad, "F");
            else pdf.rect(x, y, w, h, "F");
        });
    }

    const sides = ["Top", "Right", "Bottom", "Left"].map((n) => ({
        n,
        w: parseFloat(cs["border" + n + "Width"]) || 0,
        st: cs["border" + n + "Style"],
        col: pdfParseColor(cs["border" + n + "Color"]),
    }));
    const active = sides.filter((sd) => sd.w > 0 && sd.st !== "none" && sd.st !== "hidden" && sd.col && sd.col.a > 0);
    if (!active.length) return;

    const same = active.length === 4 && active.every((sd) => sd.w === active[0].w && sd.st === active[0].st &&
        sd.col.r === active[0].col.r && sd.col.g === active[0].col.g && sd.col.b === active[0].col.b && sd.col.a === active[0].col.a);
    const dash = (sd) => (sd.st === "dashed" ? [sd.w * 3 * s, sd.w * 2 * s] : sd.st === "dotted" ? [sd.w * s, sd.w * s] : null);
    if (same && rad > 0.2) {
        const sd = active[0];
        const lw = sd.w * s;
        pdfWithAlpha(pdf, sd.col.a, () => {
            pdf.setDrawColor(sd.col.r, sd.col.g, sd.col.b);
            pdf.setLineWidth(lw);
            const d = dash(sd);
            if (d) pdf.setLineDashPattern(d, 0);
            pdf.roundedRect(x + lw / 2, y + lw / 2, w - lw, h - lw, Math.max(0, rad - lw / 2), Math.max(0, rad - lw / 2), "S");
            if (d) pdf.setLineDashPattern([], 0);
        });
        return;
    }
    active.forEach((sd) => {
        const lw = sd.w * s;
        pdfWithAlpha(pdf, sd.col.a, () => {
            const d = dash(sd);
            if (d) {
                pdf.setDrawColor(sd.col.r, sd.col.g, sd.col.b);
                pdf.setLineWidth(lw);
                pdf.setLineDashPattern(d, 0);
                if (sd.n === "Top") pdf.line(x, y + lw / 2, x + w, y + lw / 2);
                if (sd.n === "Bottom") pdf.line(x, y + h - lw / 2, x + w, y + h - lw / 2);
                if (sd.n === "Left") pdf.line(x + lw / 2, y, x + lw / 2, y + h);
                if (sd.n === "Right") pdf.line(x + w - lw / 2, y, x + w - lw / 2, y + h);
                pdf.setLineDashPattern([], 0);
                return;
            }
            pdf.setFillColor(sd.col.r, sd.col.g, sd.col.b);
            if (sd.n === "Top") pdf.rect(x, y, w, lw, "F");
            if (sd.n === "Bottom") pdf.rect(x, y + h - lw, w, lw, "F");
            if (sd.n === "Left") pdf.rect(x, y, lw, h, "F");
            if (sd.n === "Right") pdf.rect(x + w - lw, y, lw, h, "F");
        });
    });
}

// Draws every word of a text node as real PDF text at the position the
// browser laid it out.
function pdfDrawText(c, node) {
    const parent = node.parentElement;
    if (!parent) return;
    const text = node.nodeValue;
    if (!text || !text.trim()) return;
    const cs = c.win.getComputedStyle(parent);
    if (cs.visibility === "hidden" || cs.display === "none") return;
    const col = pdfParseColor(cs.color) || { r: 0, g: 0, b: 0, a: 1 };
    const fs = parseFloat(cs.fontSize) || 12;
    const font = pdfFontFor(cs);
    const pdf = c.pdf;
    const s = c.s;
    const ls = parseFloat(cs.letterSpacing) || 0;
    const tt = cs.textTransform;
    const underline = /underline/.test(cs.textDecorationLine || "");
    const strike = /line-through/.test(cs.textDecorationLine || "");
    const fsPt = fs * s;
    const lineH = (PDF_FONT_METRICS.ascent + PDF_FONT_METRICS.descent) * fs;
    const range = c.doc.createRange();

    pdf.setFont(font.name, font.style);
    pdf.setFontSize(fsPt);
    pdf.setTextColor(col.r, col.g, col.b);

    const place = (str, rect, perChar) => {
        const mid = rect.top - c.rootTop + rect.height / 2;
        if (mid < c.plan.top || mid > c.plan.bottom) return;
        const baseCss = rect.top - c.rootTop + (rect.height - lineH) / 2 + PDF_FONT_METRICS.ascent * fs;
        const px = c.x(rect.left - c.rootLeft);
        const py = c.y(baseCss);
        let charSpace = ls * s;
        if (!perChar && str.length > 0) {
            const natural = pdf.getTextWidth(str) + charSpace * str.length;
            const target = rect.width * s;
            const diff = target - natural;
            if (Math.abs(diff) > 0.15 && Math.abs(diff) < natural * 0.3) charSpace += diff / str.length;
        }
        pdfWithAlpha(pdf, col.a, () => {
            if (Math.abs(charSpace) > 0.001) pdf.text(str, px, py, { charSpace });
            else pdf.text(str, px, py);
            if (underline || strike) {
                pdf.setDrawColor(col.r, col.g, col.b);
                pdf.setLineWidth(Math.max(0.3, fsPt * 0.06));
                const wpt = rect.width * s;
                if (underline) pdf.line(px, py + fsPt * 0.12, px + wpt, py + fsPt * 0.12);
                if (strike) pdf.line(px, py - fsPt * 0.28, px + wpt, py - fsPt * 0.28);
            }
        });
    };

    const re = /\S+/g;
    let m;
    while ((m = re.exec(text))) {
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0.01 && r.height > 0.01);
        if (!rects.length) continue;
        let word = m[0];
        if (tt === "uppercase") word = word.toUpperCase();
        else if (tt === "lowercase") word = word.toLowerCase();
        else if (tt === "capitalize") word = word.charAt(0).toUpperCase() + word.slice(1);
        if (rects.length === 1) {
            place(word, rects[0], false);
        } else {
            // word broken over several lines: position each character on its own
            for (let i = 0; i < m[0].length; i++) {
                range.setStart(node, m.index + i);
                range.setEnd(node, m.index + i + 1);
                const rr = Array.from(range.getClientRects()).filter((r) => r.width > 0.01 && r.height > 0.01)[0];
                if (rr) place(word.charAt(i) || m[0].charAt(i), rr, true);
            }
        }
    }
    range.detach && range.detach();
}

// SVG diagrams become real vector graphics (paths, lines, text) in the PDF.
async function pdfDrawSvg(c, svg, rel) {
    const svg2pdf = pdfSvg2PdfFn();
    const holder = document.createElement("div");
    holder.style.cssText = "position:fixed;left:-30000px;top:0;pointer-events:none;opacity:0;";
    const clone = svg.cloneNode(true);
    clone.setAttribute("width", rel.width);
    clone.setAttribute("height", rel.height);
    clone.style.width = rel.width + "px";
    clone.style.height = rel.height + "px";
    if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.style.fontFamily = "PdfSans";
    clone.querySelectorAll("text, tspan").forEach((t) => {
        t.style.fontFamily = "PdfSans";
    });
    // svg2pdf ignores "dominant-baseline", so labels centred on a line with
    // dominant-baseline="middle" (e.g. the member length written over the member)
    // would sit too high. Apply the same vertical offset the browser uses
    // (half the x-height for "middle", half of ascent - descent for "central").
    Array.from(clone.querySelectorAll("text[dominant-baseline], tspan[dominant-baseline]")).forEach((t) => {
        const mode = t.getAttribute("dominant-baseline");
        const k = mode === "middle" ? 0.26 : mode === "central" || mode === "mathematical" ? 0.3465 : mode === "hanging" ? 0.72 : 0;
        t.removeAttribute("dominant-baseline");
        if (!k || t.tagName.toLowerCase() === "tspan") return;
        const fs = parseFloat(t.getAttribute("font-size") || window.getComputedStyle(t).fontSize) || 12;
        t.setAttribute("y", (parseFloat(t.getAttribute("y")) || 0) + k * fs);
    });
    // svg2pdf has no "paint-order": labels that use a white stroke as a halo behind the
    // text would be painted over their own fill. Split such labels into a halo copy
    // (drawn first) and the plain filled text on top - the same look as the page.
    Array.from(clone.querySelectorAll("text[paint-order]")).forEach((t) => {
        const stroke = t.getAttribute("stroke");
        if (!stroke || stroke === "none" || !/stroke/.test(t.getAttribute("paint-order") || "")) return;
        const halo = t.cloneNode(true);
        halo.setAttribute("fill", stroke);
        halo.removeAttribute("paint-order");
        t.parentNode.insertBefore(halo, t);
        t.setAttribute("stroke", "none");
        t.removeAttribute("stroke-width");
        t.removeAttribute("paint-order");
    });
    holder.appendChild(clone);
    document.body.appendChild(holder);
    try {
        await svg2pdf(clone, c.pdf, {
            x: c.x(rel.left),
            y: c.y(rel.top),
            width: rel.width * c.s,
            height: rel.height * c.s,
        });
    } finally {
        holder.remove();
    }
}

async function pdfDrawNode(c, node) {
    if (node.nodeType === 3) {
        pdfDrawText(c, node);
        return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (tag === "script" || tag === "style" || tag === "noscript" || tag === "template") return;
    const cs = c.win.getComputedStyle(node);
    if (cs.display === "none" || cs.visibility === "hidden") return;
    if (cs.display === "contents") {
        for (const ch of Array.from(node.childNodes)) await pdfDrawNode(c, ch);
        return;
    }
    const r = node.getBoundingClientRect();
    const rel = { left: r.left - c.rootLeft, top: r.top - c.rootTop, width: r.width, height: r.height };
    if (r.height > 0 && (rel.top > c.plan.bottom + 2 || rel.top + rel.height < c.plan.top - 2)) return;
    const op = parseFloat(cs.opacity);
    if (op === 0) return;
    const layer = !isNaN(op) && op < 1;
    if (layer) {
        c.pdf.saveGraphicsState();
        c.pdf.setGState(new c.pdf.GState({ opacity: op, "stroke-opacity": op }));
    }
    try {
        if (tag === "svg") {
            if (rel.width > 0 && rel.height > 0) await pdfDrawSvg(c, node, rel);
            return;
        }
        pdfDrawBox(c, cs, rel);
        for (const ch of Array.from(node.childNodes)) await pdfDrawNode(c, ch);
    } finally {
        if (layer) c.pdf.restoreGraphicsState();
    }
}

// Running header / footer of a report page.
function pdfDrawPageChrome(pdf, meta) {
    const L = PdfLayout;
    const S = L.ptW / L.pageW; // pt per page px
    pdf.setFont("PdfSans", "bold");
    pdf.setFontSize(13 * S);
    pdf.setTextColor(30, 58, 138);
    pdf.text(pdfFitText(pdf, `Structural Analysis Report — ${meta.modelName}`, 760 * S), L.marginX * S, 29 * S);
    pdf.setFontSize(12 * S);
    pdf.setTextColor(71, 85, 105);
    pdf.text(String(meta.sectionLabel), (L.pageW - L.marginX) * S, 29 * S, { align: "right" });
    pdf.setDrawColor(30, 58, 138);
    pdf.setLineWidth(1.5 * S);
    pdf.line(L.marginX * S, 38 * S, (L.pageW - L.marginX) * S, 38 * S);

    pdf.setDrawColor(203, 213, 225);
    pdf.setLineWidth(1 * S);
    pdf.line(L.marginX * S, (L.pageH - L.footerH + 6) * S, (L.pageW - L.marginX) * S, (L.pageH - L.footerH + 6) * S);
    pdf.setFont("PdfSans", "normal");
    pdf.setFontSize(11 * S);
    pdf.setTextColor(100, 116, 139);
    pdf.text(pdfFitText(pdf, `Load case: ${meta.caseLabel}  |  ${meta.dateText}`, 800 * S), L.marginX * S, (L.pageH - 14) * S);
    pdf.text(`Page ${meta.pageNo}`, (L.pageW - L.marginX) * S, (L.pageH - 14) * S, { align: "right" });
}

// Draws one planned page: chrome + the report region as vector content.
async function pdfDrawReportPage(pdf, root, plan, fc, meta) {
    const L = PdfLayout;
    const S = L.ptW / L.pageW;
    const w = Math.ceil(plan.w);
    const h = Math.ceil(plan.bottom - plan.top) + 1;
    const fit = Math.min(1, L.contentW / w, L.contentH / h);
    plan.fit = fit;

    pdfDrawPageChrome(pdf, meta);

    const rr = root.getBoundingClientRect();
    const s = fit * S; // pt per CSS px
    const c = {
        pdf, doc: fc.doc, win: fc.win, plan, s,
        rootLeft: rr.left, rootTop: rr.top,
        x: (cssX) => (L.marginX + cssX * fit) * S,
        y: (cssY) => (L.headerH + (cssY - plan.top) * fit) * S,
    };
    pdf.saveGraphicsState();
    pdf.rect(0, L.headerH * S, L.pageW * S, h * fit * S, null);
    pdf.clip();
    pdf.discardPath();
    try {
        for (const ch of Array.from(root.childNodes)) await pdfDrawNode(c, ch);
    } finally {
        pdf.restoreGraphicsState();
    }
}

function pdfBuildFile(pages, title) {
    const pdf = pages.pdf;
    pdf.setProperties({ title: String(title), creator: "Structural Analysis App" });
    return pdf.output("blob");
}

function pdfDownloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
    }, 60000);
}

// Collects the report sections (structure model diagram first, then Steps 1-7 from the results panels, Step 8 =
// AFD / SFD / BMD diagrams). Throws an Error carrying a user-facing message.
function pdfCollectReportSections() {
    const sections = [];

    // First page: the structure (model) diagram, followed by the solution steps.
    try {
        const nNodes = model.nodes.length, nEls = model.elements.length;
        const nSup = model.supportAssignments.length;
        sections.push({
            label: "Structure Model",
            html: `<div class="calc-step"><h4>Structure Model Diagram</h4><p>Structure analysed in this report: ${nNodes} node(s), ${nEls} element(s), ${nSup} support(s). The step-by-step solution follows.</p><div class="pdf-diagram">${buildPdfDiagramBlock("model")}</div></div>`,
        });
    } catch (err) {
        console.error(err);
        throw new Error("Could not draw the structure model diagram for the PDF. Check the browser console for details.");
    }
    for (let n = 1; n <= 7; n++) {
        const slot = document.querySelector(`.calc-step-slot[data-step-number="${n}"]`);
        const step = slot && slot.querySelector(":scope > .calc-step");
        if (!step) throw new Error("Step results are not available. Please run the analysis again.");
        const clone = step.cloneNode(true);
        clone.querySelectorAll("button, .btn").forEach((b) => b.remove());
        clone.querySelectorAll("[onclick]").forEach((el) => el.removeAttribute("onclick"));
        sections.push({ label: `Step ${n} of 8`, html: clone.outerHTML });
    }

    try {
        const titles = isGridAnalysisMode()
            ? {
                afd: "Torsion Diagram (Mx)",
                sfd: "Vertical Shear Diagram (Fz)",
                bmd: "Torsion Diagram (My)",
            }
            : {
                afd: "Axial Force Diagram (AFD)",
                sfd: "Shear Force Diagram (SFD)",
                bmd: "Bending Moment Diagram (BMD)",
            };
        const blocks = ["afd", "sfd", "bmd"].map(
            (mode, i) => `<div class="pdf-diagram${i > 0 ? " pdf-break-before" : ""}"><h5>${titles[mode]}</h5>${buildPdfDiagramBlock(mode)}</div>`,
        );
        sections.push({
            label: "Step 8 of 8",
            html: `<div class="calc-step"><h4>${isGridAnalysisMode() ? "Step 8: Grid Torsion (Mx, My) and Vertical Shear (Fz) Diagrams" : "Step 8: Axial Force, Shear Force and Bending Moment Diagrams (AFD, SFD, BMD)"}</h4><p>Diagrams derived from the member end actions [AM] recovered in Step 7 and the intermediate member loads.</p>${blocks.join("")}</div>`,
        });
    } catch (err) {
        console.error(err);
        throw new Error("Could not draw the Step 8 diagrams for the PDF. Check the browser console for details.");
    }
    return sections;
}

// Lays out the sections in the hidden frame and draws every page as vector PDF content
// (the "pages" array only counts pages and carries the jsPDF document).
async function pdfRenderSectionsToPages(fc, sections, meta, jpegPages) {
    const { frame, doc, win, root } = fc;
    const progressPrefix = meta.progressPrefix || "";
    for (let s = 0; s < sections.length; s++) {
        const sec = sections[s];
        await pdfShowProgress(`${progressPrefix}${sec.label}: laying out…`);
        root.innerHTML = sec.html;
        await pdfRasterizeSvgs(doc, root);
        pdfAlignMatrixLabels(root);
        pdfPackEquationRows(root);
        pdfSplitWideTables(root);
        pdfWrapWideEquations(root);
        pdfSplitTallTables(root, PdfLayout.contentH);
        const blocks = pdfCollectBlocks(root, PdfLayout.contentH);
        const plans = pdfPlanPages(root, blocks, PdfLayout.contentH);

        // Widen the frame if some block is wider than the page content.
        const maxW = Math.max(PdfLayout.contentW, ...plans.map((p) => Math.ceil(p.w)));
        const frameW = Math.max(1500, maxW + 80);
        const frameH = Math.max(1000, Math.ceil(root.getBoundingClientRect().height) + 40);
        frame.style.width = frameW + "px";
        frame.style.height = frameH + "px";
        await new Promise((r) => setTimeout(r, 30));

        for (let p = 0; p < plans.length; p++) {
            await pdfShowProgress(`${progressPrefix}${sec.label}: page ${p + 1} of ${plans.length}…`);
            const plan = plans[p];
            const pdf = pdfDocumentFor(jpegPages);
            if (jpegPages.length > 0) pdf.addPage();
            await pdfDrawReportPage(pdf, root, plan, { doc, win }, {
                ...meta,
                sectionLabel: (meta.sectionPrefix || "") + sec.label,
                pageNo: jpegPages.length + 1,
            });
            jpegPages.push({ vector: true }); // one entry per PDF page
        }
    }
}

async function exportAnalysisPDF() {
    if (pdfExportBusy) return;
    if (analysisState.status !== "valid") {
        const message = analysisState.status === "invalidated"
            ? "The model changed since the last analysis. Please run the analysis again before exporting the PDF."
            : analysisState.status === "failed"
                ? "The last analysis failed its equilibrium check. Review the model until equilibrium passes before exporting a report."
                : "Please run the analysis first, then export the PDF.";
        alert(message);
        return;
    }
    if (!pdfEngineReady()) {
        alert("The PDF engine could not be loaded. Please reload the page and try again.");
        return;
    }

    let sections;
    try {
        sections = pdfCollectReportSections();
    } catch (err) {
        alert(err.message);
        return;
    }

    pdfExportBusy = true;
    const btn = document.getElementById("exportPdfBtn");
    if (btn) btn.disabled = true;
    let frame = null;
    try {
        await pdfShowProgress("Preparing report…");
        frame = pdfCreateFrame();
        await frame.stylesReady;
        const doc = frame.contentDocument;
        const win = frame.contentWindow;
        const root = doc.getElementById("pdfRoot");
        if (doc.fonts && doc.fonts.ready) await doc.fonts.ready;

        const meta = {
            modelName: getModelName(),
            caseLabel: getActiveAnalysisCaseLabel(),
            dateText: new Date().toLocaleDateString(),
        };
        const jpegPages = [];
        await pdfRenderSectionsToPages({ frame, doc, win, root }, sections, meta, jpegPages);

        await pdfShowProgress("Creating PDF file…");
        const blob = pdfBuildFile(jpegPages, `${meta.modelName} - Analysis Report`);
        pdfDownloadBlob(blob, `${sanitizeFileName(meta.modelName)} - Analysis Report.pdf`);
    } catch (err) {
        console.error(err);
        alert("PDF export failed. Check the browser console for details.");
    } finally {
        if (frame) frame.remove();
        pdfHideProgress();
        pdfExportBusy = false;
        if (btn) btn.disabled = false;
    }
}
