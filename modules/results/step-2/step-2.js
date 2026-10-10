/* ==========================================================================
 * step-2.js — Results part: Step 2
 * Step 2 — Joint & member properties
 * Adds its menu button + panel to the Results frame, then defines its solver / render code.
 * ========================================================================== */

/* ---- Markup ---- */
mountModuleHTML(".results-detail-menu", "beforeend", `<button type="button" class="results-detail-btn" data-result-panel="result-step-2" onclick="showResultDetail('result-step-2', this)">2. Joint &amp; Member Properties</button>
`);
mountModuleHTML(".results-detail-body", "beforeend", `
<div class="result-detail-panel" id="result-step-2">
    <div class="calc-step-slot" data-step-number="2"></div>
</div>
`);

/* ---- Logic ---- */
// Step 2: Joint and Member Properties Tables (display-only; does not feed
// later steps — the actual stiffness terms are recomputed in Step 3).
function solveStep2(ctx, step1) {
    if (isGridAnalysisMode()) {
        const grid = ctx.gridSteps13;
        const joints = grid.steps.step2.joints;
        const members = grid.steps.step2.members;
        const jointRows = joints.map((n) => {
            const d = step1.dofMap[n.nodeId];
            const label = (idx) => step1.isRestrained[idx] ? `R (${formatNum(step1.prescribedDisp[idx])})` : `D${idx + 1}`;
            return `<tr><td>${escapeHtml(n.nodeId)}</td><td>${formatNum(n.x)}</td><td>${formatNum(n.y)}</td><td>${formatNum(n.z)}</td><td>${label(d.x)}</td><td>${label(d.y)}</td><td>${label(d.z)}</td></tr>`;
        }).join("");
        const memberRows = members.map((m) => `<tr><td>${escapeHtml(m.elementId)}</td><td>${escapeHtml(m.startNode)}</td><td>${escapeHtml(m.endNode)}</td><td>${formatNum(m.length)}</td><td>${formatNum(m.E_GPa)}</td><td>${formatNum(m.G_GPa)}</td><td>${formatNum(m.I)}</td><td>${formatNum(m.J)}</td><td>${formatNum(m.A)}</td></tr>`).join("");
        const html = `<div class="calc-step"><h4>Step 2: Grid Joint and Member Properties</h4>
            <h5>Joint Properties</h5><div class="table-wrap" style="margin-bottom:20px;border:1px solid #e2e8f0;border-radius:8px;"><table style="min-width:100%;background:white;"><thead><tr><th>Joint</th><th>X (m)</th><th>Y (m)</th><th>Z (m)</th><th>θX</th><th>θY</th><th>ΔZ</th></tr></thead><tbody>${jointRows}</tbody></table></div>
            <h5>Member Properties</h5><div class="table-wrap" style="border:1px solid #e2e8f0;border-radius:8px;"><table style="min-width:100%;background:white;"><thead><tr><th>Member</th><th>Start Node</th><th>End Node</th><th>L (m)</th><th>E (GPa)</th><th>G (GPa)</th><th>I (m⁴)</th><th>J (m⁴)</th><th>A (m²)</th></tr></thead><tbody>${memberRows}</tbody></table></div>
            <h5>Grid Stiffness Terms</h5><p>Computed from the supplied Grid engine: m = GJ/L, a = 12EI/L³, b = 6EI/L², c = 4EI/L. Grid uses I and J; A is used only for density-based self-weight.</p></div>`;
        return { html };
    }
    const { dofMap, isRestrained, prescribedDisp, heavyModel } = step1;

    let jointTableRows = "";
    model.nodes.forEach((n, i) => {
        let d = dofMap[n.id];
        let dxStr = d.x === null
            ? "—"
            : isRestrained[d.x]
                ? prescribedDisp[d.x] === 0
                    ? "0"
                    : prescribedDisp[d.x]
                : "D" + (d.x + 1);
        let dyStr = d.y === null
            ? "—"
            : isRestrained[d.y]
                ? prescribedDisp[d.y] === 0
                    ? "0"
                    : prescribedDisp[d.y]
                : "D" + (d.y + 1);
        let dzStr = d.z === null
            ? "—"
            : isRestrained[d.z]
                ? prescribedDisp[d.z] === 0
                    ? "0"
                    : prescribedDisp[d.z]
                : "D" + (d.z + 1);
        jointTableRows += `<tr><td>${i + 1} (${n.id})</td><td>${n.x}</td><td>${n.y}</td><td>${n.z}</td><td>${dxStr}</td><td>${dyStr}</td><td>${dzStr}</td></tr>`;
    });

    let memberTableRows = "";
    model.elements.forEach((el, index) => {
        let n1 = model.nodes.find((n) => n.id === el.startNode);
        let n2 = model.nodes.find((n) => n.id === el.endNode);
        let tmpl = model.elementTemplates.find((t) => t.id === el.templateId);
        if (!n1 || !n2 || !tmpl) return;

        let dx = n2.x - n1.x,
            dy = n2.y - n1.y;
        let L = Math.hypot(dx, dy);
        let cx = L > 0 ? dx / L : 0,
            cy = L > 0 ? dy / L : 0;
        let A = tmpl.A,
            E = getElementEInternal(tmpl),
            I = tmpl.I;
        const elementType = getElementStructuralType(el);

        let d_val = L > 0 ? (A * E) / L : 0;
        let dCx2 = d_val * cx * cx;
        let dCy2 = d_val * cy * cy;
        let dCxCy = d_val * cx * cy;

        let a_val = L > 0 ? (12 * E * I) / Math.pow(L, 3) : 0;
        let b_val = L > 0 ? (6 * E * I) / Math.pow(L, 2) : 0;
        let c_val = L > 0 ? (4 * E * I) / L : 0;

        let e_val = dCx2 + a_val * cy * cy;
        let f_val = (d_val - a_val) * cx * cy;
        let g_val = -b_val * cy;
        let h_val = dCy2 + a_val * cx * cx;
        let j_val = b_val * cx;

        memberTableRows += `<tr>
            <td>${index + 1}</td><td>${el.startNode}</td><td>${el.endNode}</td>
            <td>${formatNum(A)}</td><td>${formatNum(E / 1e6)}</td><td>${formatNum(I)}</td><td>${formatNum(L)}</td>
            <td>${formatNum(d_val)}</td><td>${formatNum(cx)}</td><td>${formatNum(cy)}</td>
            <td>${formatNum(dCx2)}</td><td>${formatNum(dCy2)}</td><td>${formatNum(dCxCy)}</td>
            <td>${formatNum(a_val)}</td><td>${formatNum(b_val)}</td><td>${formatNum(c_val)}</td>
            <td>${formatNum(e_val)}</td><td>${formatNum(f_val)}</td><td>${formatNum(g_val)}</td>
            <td>${formatNum(h_val)}</td><td>${formatNum(j_val)}</td>
        </tr>`;
    });

    let html = "";
    if (!heavyModel) {
        html += `<div class="calc-step">
        <h4>Step 2: Joint and Member Properties Tables</h4>
        <h5>Joint table</h5>
        <div class="table-wrap" style="margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <table style="min-width: 100%; background: white;">
                <thead><tr><th>Joint number</th><th>x coordinate</th><th>y coordinate</th><th>z coordinate</th><th>displacement-x</th><th>displacement-y</th><th>displacement-z</th></tr></thead>
                <tbody>${jointTableRows}</tbody>
            </table>
        </div>
        <h5>Members table</h5>
        <div class="table-wrap" style="border: 1px solid #e2e8f0; border-radius: 8px;">
            <table style="min-width: 100%; background: white;">
                <thead><tr>
                    <th style="text-transform: none;">member number</th><th style="text-transform: none;">node id start</th><th style="text-transform: none;">node id end</th>
                    <th style="text-transform: none;">A (m²)</th><th style="text-transform: none;">E (GPa)</th><th style="text-transform: none;">I (m⁴)</th><th style="text-transform: none;">L (m)</th>
                    <th style="text-transform: none;">d=AE/L (kN/m)</th><th style="text-transform: none;">Cx=(xk-xj)/L</th><th style="text-transform: none;">Cy=(yk-yj)/L</th>
                    <th style="text-transform: none;">d(Cx²)</th><th style="text-transform: none;">d(Cy²)</th><th style="text-transform: none;">d(Cx*Cy)</th>
                    <th style="text-transform: none;">a=12EI/(L³) (kN/m)</th><th style="text-transform: none;">b=6EI/(L²) (kN)</th><th style="text-transform: none;">c=4EI/L (kN·m)</th>
                    <th style="text-transform: none;">e (kN/m)</th><th style="text-transform: none;">f (kN/m)</th><th style="text-transform: none;">g (kN)</th>
                    <th style="text-transform: none;">h (kN/m)</th><th style="text-transform: none;">j (kN)</th>
                </tr></thead>
                <tbody>${memberTableRows}</tbody>
            </table>
        </div>
        
        <h5>General Matrix Formulas</h5>
        <div style="display:flex; flex-direction:column; align-items:center; gap: 20px; margin-top: 15px; margin-bottom: 25px;">
            <!-- SM -->
            <div class="matrix-wrapper">
                <div class="matrix-title">[SM]ᵢ</div>
                <div></div>
                <div style="display: flex; align-items: stretch; gap: 2px;">
                    <div style="width: 6px; border-left: 2px solid #1e293b; border-top: 2px solid #1e293b; border-bottom: 2px solid #1e293b;"></div>
                    <table class="matrix-table" style="text-align:center;">
                        <tr><td>d</td><td>0</td><td>0</td><td>-d</td><td>0</td><td>0</td></tr>
                        <tr><td>0</td><td>a</td><td>b</td><td>0</td><td>-a</td><td>b</td></tr>
                        <tr><td>0</td><td>b</td><td>c</td><td>0</td><td>-b</td><td>c/2</td></tr>
                        <tr><td>-d</td><td>0</td><td>0</td><td>d</td><td>0</td><td>0</td></tr>
                        <tr><td>0</td><td>-a</td><td>-b</td><td>0</td><td>a</td><td>-b</td></tr>
                        <tr><td>0</td><td>b</td><td>c/2</td><td>0</td><td>-b</td><td>c</td></tr>
                    </table>
                    <div style="width: 6px; border-right: 2px solid #1e293b; border-top: 2px solid #1e293b; border-bottom: 2px solid #1e293b;"></div>
                </div>
            </div>
            
            <!-- RT -->
            <div class="matrix-wrapper">
                <div class="matrix-title">[Rt]ᵢ</div>
                <div></div>
                <div style="display: flex; align-items: stretch; gap: 2px;">
                    <div style="width: 6px; border-left: 2px solid #1e293b; border-top: 2px solid #1e293b; border-bottom: 2px solid #1e293b;"></div>
                    <table class="matrix-table" style="text-align:center;">
                        <tr><td>Cx</td><td>Cy</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
                        <tr><td>-Cy</td><td>Cx</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
                        <tr><td>0</td><td>0</td><td>1</td><td>0</td><td>0</td><td>0</td></tr>
                        <tr><td>0</td><td>0</td><td>0</td><td>Cx</td><td>Cy</td><td>0</td></tr>
                        <tr><td>0</td><td>0</td><td>0</td><td>-Cy</td><td>Cx</td><td>0</td></tr>
                        <tr><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>1</td></tr>
                    </table>
                    <div style="width: 6px; border-right: 2px solid #1e293b; border-top: 2px solid #1e293b; border-bottom: 2px solid #1e293b;"></div>
                </div>
            </div>

            <!-- SMS -->
            <div class="matrix-wrapper">
                <div class="matrix-title">[Sms]ᵢ</div>
                <div></div>
                <div style="display: flex; align-items: stretch; gap: 2px;">
                    <div style="width: 6px; border-left: 2px solid #1e293b; border-top: 2px solid #1e293b; border-bottom: 2px solid #1e293b;"></div>
                    <table class="matrix-table" style="text-align:center;">
                        <tr><td>e</td><td>f</td><td>g</td><td>-e</td><td>-f</td><td>g</td></tr>
                        <tr><td>f</td><td>h</td><td>j</td><td>-f</td><td>-h</td><td>j</td></tr>
                        <tr><td>g</td><td>j</td><td>c</td><td>-g</td><td>-j</td><td>c/2</td></tr>
                        <tr><td>-e</td><td>-f</td><td>-g</td><td>e</td><td>f</td><td>-g</td></tr>
                        <tr><td>-f</td><td>-h</td><td>-j</td><td>f</td><td>h</td><td>-j</td></tr>
                        <tr><td>g</td><td>j</td><td>c/2</td><td>-g</td><td>-j</td><td>c</td></tr>
                    </table>
                    <div style="width: 6px; border-right: 2px solid #1e293b; border-top: 2px solid #1e293b; border-bottom: 2px solid #1e293b;"></div>
                </div>
            </div>
        </div>
    </div>`;
    }

    return { html };
}

function renderStep2(step2) {
    return step2.html;
}
