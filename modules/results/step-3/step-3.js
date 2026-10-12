/* ==========================================================================
 * step-3.js — Results part: Step 3
 * Step 3 — Member stiffness & AML (actions at member ends)
 * Adds its menu button + panel to the Results frame, then defines its solver / render code.
 * ========================================================================== */

/* ---- Markup ---- */
mountModuleHTML(".results-detail-menu", "beforeend", `<button type="button" class="results-detail-btn" data-result-panel="result-step-3" onclick="showResultDetail('result-step-3', this)">3. Member Stiffness &amp; AML</button>
`);
mountModuleHTML(".results-detail-body", "beforeend", `
<div class="result-detail-panel" id="result-step-3">
    <div class="calc-step-slot" data-step-number="3"></div>
</div>
`);

/* ---- Logic ---- */
// Step 3: Member stiffness matrices [SMS] and member end actions [AML],
// assembled directly into the global [SJ]/[AE] as each element is processed
// (matching the original single-pass implementation exactly), followed by
// assembly of nodal loads/moments into [AJ].
function solveGridStep3(ctx, step1) {
    const { dofMap, SJ, AE, AJ, heavyModel } = step1;
    const gridMembers = ctx.gridSteps13.steps.step3.members;
    let html = `<div class="calc-step"><h4>Step 3: Grid Member Stiffness Matrices and Fixed-End Actions</h4>`;
    model.elements.forEach((el) => {
        const member = gridMembers.find((m) => String(m.elementId) === String(el.id));
        const n1 = model.nodes.find((n) => n.id === el.startNode);
        const n2 = model.nodes.find((n) => n.id === el.endNode);
        if (!member || !n1 || !n2) throw new Error(`Missing Grid calculation result for element ${el.id}.`);
        el.L = member.length;
        el.cx = member.directionCosines.cx;
        el.cy = member.directionCosines.cy;
        el.SM = member.SM;
        el.RT = member.RT;
        el.RTT = member.RTT;
        el.SMS = member.SMS;
        el.AML = member.AML;
        el.AMS = member.AMS;
        el.localwx = 0;
        el.localwy = 0;
        el.localPointLoads = (member.localPointLoads || []).map((load) => ({ a: load.distance, Px: 0, Py: load.Fz, Pz: load.Fz, inputAxis: "Grid Z" }));
        el.localUDLs = (member.localUDLs || []).map((load) => ({ a: load.startDistance, b: load.endDistance, Fx1: 0, Fx2: 0, Fy1: load.q1, Fy2: load.q2, localFx1: 0, localFx2: 0, localFy1: load.q1, localFy2: load.q2, inputAxis: "Grid Z" }));
        el.localPointMoments = (member.localPointMoments || []).map((moment) => ({ a: moment.distance, Mz: moment.Mx, Mx: moment.Mx, My: moment.My }));
        const mapped = getElementGlobalDofIndices(el, n1, n2, dofMap);
        const indices = mapped.indices;
        const labels = indices.map((idx) => idx === null ? "—" : idx + 1);
        for (let r = 0; r < 6; r++) {
            if (indices[r] === null) continue;
            for (let c = 0; c < 6; c++) {
                if (indices[c] === null) continue;
                SJ[indices[r]][indices[c]] += member.SMS[r][c];
            }
            AE[indices[r]][0] -= member.AMS[r][0];
        }
        if (!heavyModel) {
            html += `<h5>Element ${escapeHtml(el.id)}</h5>`;
            html += matrixEqHTML([
                { m: el.SM, t: "[SM] (Grid Local)", top: labels, right: labels },
                { m: el.RT, t: "[RT] (Grid Transformation)", top: labels, right: labels },
            ], [" "]);
            html += matrixEqHTML([
                { m: el.SMS, t: "[SMS] = [RT]ᵀ[SM][RT]", top: labels, right: labels },
                { m: el.AML, t: "[AML] (Local Fixed-End Actions)", right: labels },
                { m: el.RTT, t: "[RT]ᵀ", right: labels },
                { m: el.AMS, t: "[AMS] = [RT]ᵀ[AML]", right: labels },
            ], [" ", "×", "="]);
        }
    });

    // Grid nodal loads act in the ΔZ direction; nodal Mx/My act in θX/θY.
    model.loads.forEach((load) => {
        if (!isActiveLoadCase(load) || load.type !== "Nodal Load") return;
        const dof = dofMap[load.nodeId];
        if (dof && dof.z !== null) AJ[dof.z][0] += Number(load.Fz) || 0;
    });
    model.moments.forEach((moment) => {
        if (!isActiveMomentCase(moment) || moment.type !== "Nodal Moment") return;
        const dof = dofMap[moment.nodeId];
        if (!dof) return;
        if (dof.x !== null) AJ[dof.x][0] += Number(moment.Mx) || 0;
        if (dof.y !== null) AJ[dof.y][0] += Number(moment.My) || 0;
    });
    html += `</div>`;
    // Grid models do not currently accept temperature loads, so [AT] is zero.
    return { SJ, AE, AJ, AT: Matrix.zeros(AE.length, 1), html };
}

function solveStep3(ctx, step1) {
    if (isGridAnalysisMode()) return solveGridStep3(ctx, step1);
    const { dofMap, SJ, AE, AJ, heavyModel } = step1;
    // [AT] is kept separate from [AE] so Step 4 can assemble thermal actions
    // explicitly as [AC] = [AE] + [AJ] + [AD] + [AT].
    const AT = Matrix.zeros(AE.length, 1);
    let html = "";

    if (!heavyModel) {
        html += `<div class="calc-step"><h4>Step 3: Member Stiffness Matrices [SMS] and Member End Actions [AML]</h4>`;
    }

    model.elements.forEach((el) => {
        let n1 = model.nodes.find((n) => n.id === el.startNode);
        let n2 = model.nodes.find((n) => n.id === el.endNode);
        let tmpl = model.elementTemplates.find((t) => t.id === el.templateId);
        if (!n1 || !n2 || !tmpl) return;

        let dx = n2.x - n1.x,
            dy = n2.y - n1.y;
        let L = Math.hypot(dx, dy);
        if (L === 0) return;
        let cx = dx / L,
            cy = dy / L;

        let E = getElementEInternal(tmpl),
            A = tmpl.A,
            I = tmpl.I;
        let SM = Matrix.zeros(6, 6);
        SM[0][0] = (E * A) / L;
        SM[0][3] = (-E * A) / L;
        SM[1][1] = (12 * E * I) / Math.pow(L, 3);
        SM[1][2] = (6 * E * I) / Math.pow(L, 2);
        SM[1][4] = (-12 * E * I) / Math.pow(L, 3);
        SM[1][5] = (6 * E * I) / Math.pow(L, 2);
        SM[2][1] = (6 * E * I) / Math.pow(L, 2);
        SM[2][2] = (4 * E * I) / L;
        SM[2][4] = (-6 * E * I) / Math.pow(L, 2);
        SM[2][5] = (2 * E * I) / L;
        SM[3][0] = (-E * A) / L;
        SM[3][3] = (E * A) / L;
        SM[4][1] = (-12 * E * I) / Math.pow(L, 3);
        SM[4][2] = (-6 * E * I) / Math.pow(L, 2);
        SM[4][4] = (12 * E * I) / Math.pow(L, 3);
        SM[4][5] = (-6 * E * I) / Math.pow(L, 2);
        SM[5][1] = (6 * E * I) / Math.pow(L, 2);
        SM[5][2] = (2 * E * I) / L;
        SM[5][4] = (-6 * E * I) / Math.pow(L, 2);
        SM[5][5] = (4 * E * I) / L;

        let RT = Matrix.zeros(6, 6);
        RT[0][0] = cx;
        RT[0][1] = cy;
        RT[1][0] = -cy;
        RT[1][1] = cx;
        RT[2][2] = 1;
        RT[3][3] = cx;
        RT[3][4] = cy;
        RT[4][3] = -cy;
        RT[4][4] = cx;
        RT[5][5] = 1;

        let RTT = Matrix.transpose(RT);
        let SMS = Matrix.mul(Matrix.mul(RTT, SM), RT);

        el.L = L;
        el.cx = cx;
        el.cy = cy;
        el.SM = SM;
        el.RT = RT;
        el.RTT = RTT;
        el.SMS = SMS;

        // Map the member's six local positions to the global system.
        // The node numbering is global, but X/M may still be intentionally
        // absent for this particular member type.
        const elementDofMap = getElementGlobalDofIndices(el, n1, n2, dofMap);
        let idxs = elementDofMap.indices;
        let elLabels = idxs.map((idx) => idx === null ? "—" : idx + 1);

        // Keep the existing 6×6 local element formulation, but assemble only
        // the DOFs that belong to this member type.
        for (let r = 0; r < 6; r++) {
            if (idxs[r] === null) continue;
            for (let c = 0; c < 6; c++) {
                if (idxs[c] === null) continue;
                SJ[idxs[r]][idxs[c]] += SMS[r][c];
            }
        }

        el.AML = Matrix.zeros(6, 1);
        el.localwx = 0;
        el.localwy = 0;
        el.localPointLoads = [];
        el.localUDLs = [];
        el.localPointMoments = [];

        const activeLoadCase = model.loadCases.find((lc) => String(lc.id) === String(activeLoadCaseId));
        const selfWeight = Number(activeLoadCase?.memberSelfWeights?.[String(el.id)]) || 0;
        const includeSelfWeight = activeLoadCase?.type === "Self Weight";
        if (selfWeight > 0 && includeSelfWeight) {
            const W_Y = -selfWeight;
            let wx = W_Y * cy,
                wy = W_Y * cx;
            el.localwx += wx;
            el.localwy += wy;

            el.AML[0][0] += (-wx * L) / 2;
            el.AML[1][0] += (-wy * L) / 2;
            el.AML[2][0] += (-wy * Math.pow(L, 2)) / 12;
            el.AML[3][0] += (-wx * L) / 2;
            el.AML[4][0] += (-wy * L) / 2;
            el.AML[5][0] += (wy * Math.pow(L, 2)) / 12;
        }

        // ------------------------------------------------------------
        // MEMBER LOADS: GLOBAL/ANGLED -> LOCAL -> AML -> GLOBAL AMS
        // ------------------------------------------------------------
        model.loads.forEach((ld) => {
            if (!isActiveLoadCase(ld)) return;
            if (ld.elementId !== el.id) return;

            // ELEMENT POINT LOAD
            if (ld.type === "Element Point Load" || ld.type === "Element Load") {
                let a = Number(ld.distance) || 0;
                a = Math.max(0, Math.min(a, el.L));

                // IMPORTANT: convert the applied load to member axes FIRST.
                // AML is defined only in member-oriented axes by the lab manual.
                const local = inputForceToLocal(
                    ld.Fx,
                    ld.Fy,
                    ld.axisSystem,
                    ld.angle,
                    el.cx,
                    el.cy,
                );

                el.localPointLoads.push({
                    a: a,
                    Px: local.x,
                    Py: local.y,
                    inputAxis: ld.axisSystem || "Global",
                });

                addLocalPointLoadToAML(el.AML, local.x, local.y, a, el.L);
                return;
            }

            // ELEMENT UDL / LINEARLY VARYING DISTRIBUTED LOAD
            if (ld.type === "Element UDL") {
                let a = Number(ld.distance) || 0;
                let b =
                    ld.distanceEnd !== undefined && ld.distanceEnd !== ""
                        ? Number(ld.distanceEnd)
                        : el.L;

                a = Math.max(0, Math.min(a, el.L));
                b = Math.max(0, Math.min(b, el.L));
                if (a >= b) return;

                const Fx1 = Number(ld.Fx) || 0;
                const Fy1 = Number(ld.Fy) || 0;
                const Fx2 = ld.FxEnd !== undefined && ld.FxEnd !== "" ? Number(ld.FxEnd) : Fx1;
                const Fy2 = ld.FyEnd !== undefined && ld.FyEnd !== "" ? Number(ld.FyEnd) : Fy1;

                // IMPORTANT: transform both UDL endpoint intensities to LOCAL axes
                // before calculating AML. For a member with fixed orientation,
                // a linearly varying global/angled UDL remains linearly varying
                // after this constant rotation.
                const local1 = inputForceToLocal(Fx1, Fy1, ld.axisSystem, ld.angle, el.cx, el.cy);
                const local2 = inputForceToLocal(Fx2, Fy2, ld.axisSystem, ld.angle, el.cx, el.cy);

                // Store GLOBAL components only for plotting / visualization.
                const global1 =
                    ld.axisSystem === "Local"
                        ? localForceToGlobal(local1.x, local1.y, el.cx, el.cy)
                        : rotateForceToGlobal(Fx1, Fy1, ld.axisSystem, ld.angle);
                const global2 =
                    ld.axisSystem === "Local"
                        ? localForceToGlobal(local2.x, local2.y, el.cx, el.cy)
                        : rotateForceToGlobal(Fx2, Fy2, ld.axisSystem, ld.angle);

                el.localUDLs.push({
                    a: a,
                    b: b,
                    Fx1: global1.x,
                    Fx2: global2.x,
                    Fy1: global1.y,
                    Fy2: global2.y,
                    localFx1: local1.x,
                    localFx2: local2.x,
                    localFy1: local1.y,
                    localFy2: local2.y,
                    inputAxis: ld.axisSystem || "Global",
                });

                integrateLinearLocalUDLToAML(
                    el.AML,
                    local1.x,
                    local1.y,
                    local2.x,
                    local2.y,
                    a,
                    b,
                    el.L,
                );
            }
        });

        model.moments.forEach((m) => {
            if (!isActiveMomentCase(m)) return;
            // UI convention: +Mz is anticlockwise, matching the
            // structural stiffness convention.
            let Mz = Number(m.Mz) || 0;
            if (m.type === "Element Moment" && m.elementId === el.id) {
                let a = m.distance || 0;
                if (a < 0) a = 0;
                if (a > el.L) a = el.L;
                let b = el.L - a;
                el.AML[1][0] += (-6 * Mz * a * b) / Math.pow(el.L, 3);
                el.AML[2][0] += (Mz * b * (2 * a - b)) / Math.pow(el.L, 2);
                el.AML[4][0] += (6 * Mz * a * b) / Math.pow(el.L, 3);
                el.AML[5][0] += (Mz * a * (2 * b - a)) / Math.pow(el.L, 2);

                el.localPointMoments.push({ a: a, Mz: Mz });
            }
        });

        // Assemble ordinary member loads into [AE] exactly as before.
        // Thermal loads get their own member-end vector and global vector [AT].
        const mechanicalAMS = Matrix.mul(el.RTT, el.AML);
        for (let r = 0; r < 6; r++) {
            if (idxs[r] === null) continue;
            AE[idxs[r]][0] -= mechanicalAMS[r][0];
        }

        const thermalAML = Matrix.zeros(6, 1);
        const ignoreAxialThermal = getGlobalDofNumberingConfig().skipAxial;
        model.loads.forEach((thermalLoad) => {
            if (!isActiveLoadCase(thermalLoad) || thermalLoad.elementId !== el.id) return;
            if (thermalLoad.type !== "Uniform Temperature Change" && thermalLoad.type !== "Temperature Gradient") return;
            const thermalActions = calculatePlaneThermalFixedEndActions(tmpl, thermalLoad, ignoreAxialThermal);
            thermalActions.forEach((value, index) => { thermalAML[index][0] += value; });
        });

        const thermalAMS = assembleThermalEquivalentNodalActions(AT, el.RTT, thermalAML, idxs);
        el.thermalAML = thermalAML;
        el.thermalAMS = thermalAMS;

        // Keep the combined local end-action vector for Step 7 member-force
        // recovery, while [AE] remains strictly mechanical and [AT] is thermal.
        for (let r = 0; r < 6; r++) el.AML[r][0] += thermalAML[r][0];
        const AMS = Matrix.mul(el.RTT, el.AML);
        el.AMS = AMS;

        if (!heavyModel) {
            html += `<h5>Element ${escapeHtml(el.id)}</h5>`;
        }
        if (!heavyModel) {
            html += matrixEqHTML(
                [
                    { m: el.SM, t: "[SM] (Local)", top: elLabels, right: elLabels },
                    { m: el.RT, t: "[Rt] (Rotational)", top: elLabels, right: elLabels },
                ],
                [" "],
            );
        }
        if (!heavyModel) {
            html += matrixEqHTML(
                [
                    { m: el.SMS, t: "[Sms] = [Rt]ᵀ[SM][Rt]", top: elLabels, right: elLabels },
                    { m: el.AML, t: "[AML] (Local Actions)", right: elLabels },
                    { m: el.RTT, t: "[RT]ᵀ", right: elLabels },
                    { m: el.AMS, t: "[AMS] = [RT]ᵀ[AML]", right: elLabels },
                ],
                [" ", "×", "="],
            );
        }
    });

    model.loads.forEach((ld) => {
        if (!isActiveLoadCase(ld)) return;
        let Fx = ld.Fx || 0,
            Fy = ld.Fy || 0;
        if (ld.type === "Nodal Load") {
            let d = dofMap[ld.nodeId];
            if (d) {
                // Use the single authoritative rotation helper (also used for
                // member loads) instead of a duplicated inline formula.
                const g = rotateForceToGlobal(Fx, Fy, ld.axisSystem, ld.angle);
                if (d.x !== null) AJ[d.x][0] += g.x;
                if (d.y !== null) AJ[d.y][0] += g.y;
            }
        }
    });

    model.moments.forEach((m) => {
        if (!isActiveMomentCase(m)) return;
        // UI convention: +Mz is anticlockwise, matching the global
        // stiffness formulation.
        let Mz = Number(m.Mz) || 0;
        if (m.type === "Nodal Moment") {
            let d = dofMap[m.nodeId];
            if (d && d.z !== null) AJ[d.z][0] += Mz;
        }
    });

    if (!heavyModel) {
        html += `</div>`;
    }

    return { SJ, AE, AJ, AT, html };
}

// Assemble the negative transformed thermal fixed-end actions into [AT].
// This mirrors the sign used for equivalent member-load actions in [AE] but
// stores thermal contributions separately to avoid double counting.
function assembleThermalEquivalentNodalActions(AT, RTT, thermalAML, indices) {
    const thermalAMS = Matrix.mul(RTT, thermalAML);
    for (let r = 0; r < indices.length; r++) {
        if (indices[r] === null) continue;
        AT[indices[r]][0] -= thermalAMS[r][0];
    }
    return thermalAMS;
}

// Return the six local fixed-end actions produced by a thermal input. The
// established solver convention is AML + SM·RT·DS for recovered member ends,
// and the global equivalent nodal vector is assembled as -RTᵀ·AML.
function calculatePlaneThermalFixedEndActions(template, load, ignoreAxial = false) {
    const actions = [0, 0, 0, 0, 0, 0];
    if (!template || !load) return actions;
    const E = getElementEInternal(template);
    const A = Number(template.A) || 0;
    const I = Number(template.I) || 0;
    const alpha = Number(template.alpha) || 0;
    if (!(E > 0) || !(alpha > 0)) return actions;

    if (load.type === "Uniform Temperature Change") {
        // Fully restrained axial thermal action magnitude: EAαΔT.
        // Heating (ΔT > 0) produces compression; the end-action signs below
        // match the element's local axial DOF convention.
        const deltaT = Number(load.temperatureDelta);
        if (!ignoreAxial && A > 0 && Number.isFinite(deltaT)) {
            const axialAction = E * A * alpha * deltaT;
            actions[0] = axialAction;
            actions[3] = -axialAction;
        }
    } else if (load.type === "Temperature Gradient") {
        // Face 1 is the local −Y face and Face 2 the local +Y face, so the
        // thermal curvature is α(T1−T2)/d. Section depth is measured in metres.
        const T1 = Number(load.temperatureT1);
        const T2 = Number(load.temperatureT2);
        const depth = Number(template.thermalDepth);
        if (I > 0 && depth > 0 && Number.isFinite(T1) && Number.isFinite(T2)) {
            const thermalMoment = E * I * alpha * (T1 - T2) / depth;
            actions[2] = thermalMoment;
            actions[5] = -thermalMoment;
        }
    }
    return actions;
}

function renderStep3(step3) {
    return step3.html;
}
