document.addEventListener('DOMContentLoaded', () => {
    // Referencias a elementos comunes
    const careerSelect = document.getElementById('career-select');
    const pensumTitle = document.getElementById('pensum-title');
    const creditsCountElement = document.getElementById('credits-count');
    const totalCreditsCountElement = document.getElementById('total-credits-count');
    const materiasSummary = document.getElementById('materias-summary');
    const materiasCheckedCount = document.getElementById('materias-checked-count');
    const materiasTotalCount = document.getElementById('materias-total-count');

    // Referencias a vista tradicional
    const pensumContainer = document.getElementById('pensum-container');
    const plannerSection = document.getElementById('planner-section');
    const addSemesterBtn = document.getElementById('add-semester-btn');
    const semestersList = document.getElementById('semesters-list');

    // Referencias a vista Doble Carrera (Cajitas y Pool)
    const dobleCarreraContainer = document.getElementById('doble-carrera-container');
    const cajitasList = document.getElementById('cajitas-list');
    const activeCajitaTitle = document.getElementById('active-cajita-title');
    const activeCajitaCreditsNum = document.getElementById('active-cajita-credits-num');
    const activeCajitaMaterias = document.getElementById('active-cajita-materias');
    const finishCajitaBtn = document.getElementById('finish-cajita-btn');
    const finishCajitaSub = document.getElementById('finish-cajita-sub');
    const clearCajitaBtn = document.getElementById('clear-cajita-btn');
    const materiaSearchInput = document.getElementById('materia-search-input');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const disponiblesList = document.getElementById('disponibles-list');
    const bloqueadasList = document.getElementById('bloqueadas-list');
    const disponiblesBadge = document.getElementById('disponibles-badge');
    const bloqueadasBadge = document.getElementById('bloqueadas-badge');

    // Estado global
    let currentMode = 'standard'; // 'standard' o 'doble'
    let standardData = {};
    let addedSemestersCount = 0;

    // Estado Doble Carrera
    let dobleMaterias = [];
    let activeSelectedIds = new Set();
    let currentDobleSemester = 1;
    let finishedDobleSemesters = []; // [{ semId: 1, creditos: 18, materias: [...] }]
    let currentPoolFilter = 'all'; // 'all', 'cdat', 'matem', 'ambas'
    let currentSearchQuery = '';

    // ==========================================
    // CARGA DE CARRERA
    // ==========================================
    function loadCareer(filename) {
        fetch(`carreras/${filename}`)
            .then(response => response.json())
            .then(jsonData => {
                // Actualizar el título
                if (pensumTitle && careerSelect) {
                    pensumTitle.textContent = "Pensum de " + careerSelect.options[careerSelect.selectedIndex].text;
                }

                if (filename === 'doble.json') {
                    currentMode = 'doble';
                    pensumContainer.style.display = 'none';
                    plannerSection.style.display = 'none';
                    dobleCarreraContainer.style.display = 'block';
                    if (materiasSummary) materiasSummary.style.display = 'inline';

                    // Inicializar estado de Doble Carrera
                    const rawList = jsonData['Doble Carrera'] || [];
                    dobleMaterias = rawList.map(m => ({
                        ...m,
                        selected_variante: m.variantes ? m.variantes[0].codigo : (m.codigo || null),
                        status_checked: false,
                        locked_in_semester: false
                    }));
                    activeSelectedIds.clear();
                    currentDobleSemester = 1;
                    finishedDobleSemesters = [];
                    currentPoolFilter = 'all';
                    currentSearchQuery = '';
                    if (materiaSearchInput) materiaSearchInput.value = '';

                    filterButtons.forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.filter === 'all');
                    });

                    renderDobleCarrera();
                } else {
                    currentMode = 'standard';
                    pensumContainer.style.display = 'grid';
                    plannerSection.style.display = 'block';
                    dobleCarreraContainer.style.display = 'none';
                    if (materiasSummary) materiasSummary.style.display = 'none';

                    standardData = jsonData;
                    addedSemestersCount = 0;
                    if (semestersList) {
                        semestersList.innerHTML = '';
                    }

                    renderStandardPensum();
                }
            })
            .catch(error => console.error('Error cargando el JSON de carrera:', error));
    }

    // Escuchar cambio en el selector de carrera
    if (careerSelect) {
        careerSelect.addEventListener('change', (e) => {
            loadCareer(e.target.value);
        });
        // Cargar opción por defecto
        loadCareer(careerSelect.value || 'cdat.json');
    }

    // ==========================================
    // MODO ESTÁNDAR (CIENCIA DE DATOS / MATEMÁTICAS)
    // ==========================================
    function uncheckDependentsStandard(code) {
        const allMaterias = Object.values(standardData).flat();
        const materiasMap = new Map(allMaterias.filter(m => m.codigo).map(m => [m.codigo, m]));

        allMaterias.forEach(materia => {
            if (!materia.prerequisitos || !materia.status_checked) return;

            const depends = materia.prerequisitos.some(req => 
                Array.isArray(req) ? req.includes(code) : req === code
            );

            if (depends) {
                const met = materia.prerequisitos.every(req => 
                    Array.isArray(req) 
                        ? req.some(c => materiasMap.get(c)?.status_checked)
                        : materiasMap.get(req)?.status_checked
                );

                if (!met) {
                    materia.status_checked = false;
                    materia.locked_in_semester = false;
                    if (materia.codigo) uncheckDependentsStandard(materia.codigo);
                }
            }
        });
    }

    function renderStandardPensum() {
        pensumContainer.innerHTML = '';
        let totalCredits = 0;
        let maxCredits = 0;

        const allMaterias = Object.values(standardData).flat();
        const materiasMap = new Map(allMaterias.filter(m => m.codigo).map(m => [m.codigo, m]));
        const hasOpt1Global = materiasMap.has("033305");
        const hasOpt2Global = materiasMap.has("033746");
        const optMateriaCredits = parseInt(materiasMap.get("033305")?.creditos || 0);

        allMaterias.forEach(m => {
            const creds = parseInt(m.creditos || 0);
            if (m.status_checked) totalCredits += creds;
            maxCredits += creds;
        });

        if (hasOpt1Global && hasOpt2Global) {
            maxCredits -= optMateriaCredits;
        }

        if (creditsCountElement) creditsCountElement.textContent = totalCredits;
        if (totalCreditsCountElement) totalCreditsCountElement.textContent = maxCredits;

        for (const [semestreNombre, materias] of Object.entries(standardData)) {
            const col = document.createElement('div');
            col.className = 'semestre-column';

            let semestreTotalCredits = 0;
            let semestreCheckedCredits = 0;

            const hasOpt1 = materias.some(m => m.codigo === "033305");
            const hasOpt2 = materias.some(m => m.codigo === "033746");

            materias.forEach(m => {
                const creds = parseInt(m.creditos || 0);
                semestreTotalCredits += creds;
                if (m.status_checked) semestreCheckedCredits += creds;
            });

            if (hasOpt1 && hasOpt2) {
                semestreTotalCredits -= parseInt(materias.find(m => m.codigo === "033305")?.creditos || 0);
            }

            const header = document.createElement('div');
            header.className = 'semestre-header';
            header.innerHTML = `
                <div class="semestre-title">${semestreNombre}</div>
                <div class="semestre-credits">${semestreCheckedCredits} / ${semestreTotalCredits} cr</div>
            `;
            col.appendChild(header);

            materias.forEach(materia => {
                const card = document.createElement('div');
                card.className = 'materia-card';

                const isChecked = materia.status_checked;
                let isLocked = false;

                if (materia.prerequisitos?.length) {
                    const prereqsMet = materia.prerequisitos.every(req => 
                        Array.isArray(req)
                            ? req.some(c => materiasMap.get(c)?.locked_in_semester)
                            : materiasMap.get(req)?.locked_in_semester
                    );
                    if (!prereqsMet) isLocked = true;
                }

                if (!isChecked) {
                    if (materia.codigo === "033305" && materiasMap.get("033746")?.status_checked) isLocked = true;
                    if (materia.codigo === "033746" && materiasMap.get("033305")?.status_checked) isLocked = true;
                }

                if (materia.locked_in_semester) card.classList.add('locked-semester');
                else if (isChecked) card.classList.add('checked');
                else if (isLocked) card.classList.add('locked');
                else card.classList.add('available');

                const formattedPrereqs = materia.prerequisitos?.length
                    ? 'Prereq: ' + materia.prerequisitos.map(r => Array.isArray(r) ? r.join(' ó ') : r).join(', ')
                    : '';

                card.innerHTML = `
                    ${materia.creditos ? `<div class="materia-creditos">${materia.creditos}</div>` : ''}
                    <div class="materia-name">${materia.nombre}</div>
                    <div class="materia-code">${materia.codigo || ''}</div>
                    ${formattedPrereqs ? `<div class="materia-prereqs">${formattedPrereqs}</div>` : ''}
                `;

                if (!materia.locked_in_semester && (!isLocked || isChecked)) {
                    card.addEventListener('click', () => {
                        materia.status_checked = !materia.status_checked;
                        if (!materia.status_checked && materia.codigo) {
                            uncheckDependentsStandard(materia.codigo);
                        }
                        renderStandardPensum();
                    });
                }

                col.appendChild(card);
            });

            pensumContainer.appendChild(col);
        }
    }

    // Planificador estándar
    if (addSemesterBtn) {
        function deleteSemestersFromStandard(startId) {
            Object.values(standardData).flat().forEach(materia => {
                if (materia.locked_in_semester && materia.locked_in_semester >= startId) {
                    materia.locked_in_semester = false;
                    materia.status_checked = false;
                    if (materia.codigo) uncheckDependentsStandard(materia.codigo);
                }
            });
            addedSemestersCount = startId - 1;
            semestersList.querySelectorAll('.semester-block').forEach(block => {
                if (parseInt(block.dataset.semId) >= startId) block.remove();
            });
            renderStandardPensum();
        }

        addSemesterBtn.addEventListener('click', () => {
            const newlyLockedMaterias = [];
            let currentSemesterCredits = 0;

            Object.values(standardData).flat().forEach(materia => {
                if (materia.status_checked && !materia.locked_in_semester) {
                    materia.locked_in_semester = addedSemestersCount + 1;
                    currentSemesterCredits += parseInt(materia.creditos || 0);
                    newlyLockedMaterias.push(materia);
                }
            });

            if (newlyLockedMaterias.length > 0) {
                addedSemestersCount++;
                const currentSemId = addedSemestersCount;

                const block = document.createElement('div');
                block.className = 'semester-block';
                block.dataset.semId = currentSemId;

                const headerDiv = document.createElement('div');
                headerDiv.className = 'semester-block-header';
                headerDiv.innerHTML = `
                    <h3>Semestre ${currentSemId} (${currentSemesterCredits} cr)</h3>
                    <button class="delete-semester-btn" title="Eliminar este semestre y los siguientes">Eliminar</button>
                `;
                headerDiv.querySelector('.delete-semester-btn').onclick = () => deleteSemestersFromStandard(currentSemId);
                block.appendChild(headerDiv);

                const list = document.createElement('ul');
                newlyLockedMaterias.forEach(m => {
                    const listItem = document.createElement('li');
                    listItem.textContent = `${m.codigo || ''} - ${m.nombre}`;
                    list.appendChild(listItem);
                });
                block.appendChild(list);

                semestersList.appendChild(block);
                renderStandardPensum();
            } else {
                alert('No has seleccionado materias nuevas para agregar al semestre.');
            }
        });
    }

    // ==========================================
    // MODO DOBLE CARRERA (CAJITAS Y POOL)
    // ==========================================

    const getMateriaName = m => {
        const v = m.variantes?.find(x => x.codigo === m.selected_variante);
        return v ? v.nombre : m.nombre;
    };

    const getPrereqLabel = code => {
        const f = dobleMaterias.find(m => m.codigo === code || m.codigos_homologados?.includes(code));
        const lbl = f?.codigos_homologados?.length > 1 ? f.codigos_homologados.join(' / ') : code;
        return f ? `${f.nombre} (${lbl})` : code;
    };

    // Obtener mapa de códigos de materias cursadas en semestres cerrados
    function getLockedCodesMap() {
        const lockedCodes = new Set();
        dobleMaterias.forEach(m => {
            if (m.locked_in_semester) {
                if (m.selected_variante) lockedCodes.add(m.selected_variante);
                else if (m.codigo) lockedCodes.add(m.codigo);
                if (m.codigos_homologados && !m.variantes) {
                    m.codigos_homologados.forEach(c => lockedCodes.add(c));
                }
            }
        });
        return lockedCodes;
    }

    // Verificar si una materia cumple prerequisitos
    function checkPrerequisitesMet(materia, lockedCodes) {
        if (!materia.prerequisitos?.length) return { isMet: true, missingPrereqs: [] };
        const missingPrereqs = [];
        materia.prerequisitos.forEach(req => {
            if (Array.isArray(req)) {
                if (!req.some(c => lockedCodes.has(c))) {
                    missingPrereqs.push(req.map(getPrereqLabel).join(' ó '));
                }
            } else if (!lockedCodes.has(req)) {
                missingPrereqs.push(getPrereqLabel(req));
            }
        });
        return { isMet: missingPrereqs.length === 0, missingPrereqs };
    }

    // Comprobar exclusión mutua de optimización
    function isMutuallyExcluded(materia, lockedCodes) {
        if (materia.codigo === '033305') {
            const opt2 = dobleMaterias.find(m => m.codigo === '033746');
            if (opt2 && (opt2.locked_in_semester || activeSelectedIds.has(opt2.id))) {
                return { excluded: true, reason: 'Excluyente con Optimización lineal (033746)' };
            }
        }
        if (materia.codigo === '033746') {
            const opt1 = dobleMaterias.find(m => m.codigo === '033305');
            if (opt1 && (opt1.locked_in_semester || activeSelectedIds.has(opt1.id))) {
                return { excluded: true, reason: 'Excluyente con Temas de optimización (033305)' };
            }
        }
        return { excluded: false, reason: '' };
    }

    // Renderizar todo el sistema de Doble Carrera
    function renderDobleCarrera() {
        const lockedCodes = getLockedCodesMap();

        // 1. Calcular totales globales
        let totalPlanCredits = 0;
        let totalCompletedMaterias = 0;
        let maxDobleCredits = 0;
        let hasOpt1Global = false;
        let hasOpt2Global = false;
        let optMateriaCredits = 0;

        dobleMaterias.forEach(m => {
            const creds = parseInt(m.creditos || 0);
            maxDobleCredits += creds;
            if (m.codigo === '033305') {
                hasOpt1Global = true;
                optMateriaCredits = creds;
            }
            if (m.codigo === '033746') {
                hasOpt2Global = true;
            }
            if (m.locked_in_semester) {
                totalPlanCredits += creds;
                totalCompletedMaterias++;
            }
        });

        if (hasOpt1Global && hasOpt2Global) {
            maxDobleCredits -= optMateriaCredits;
        }
        const maxTotalMaterias = hasOpt1Global && hasOpt2Global ? dobleMaterias.length - 1 : dobleMaterias.length;

        let activeCajitaCredits = 0;
        const activeSelectedMaterias = [];
        activeSelectedIds.forEach(id => {
            const m = dobleMaterias.find(item => item.id === id);
            if (m) {
                activeCajitaCredits += parseInt(m.creditos || 0);
                activeSelectedMaterias.push(m);
            }
        });

        if (creditsCountElement) {
            creditsCountElement.textContent = totalPlanCredits + activeCajitaCredits;
        }
        if (totalCreditsCountElement) {
            totalCreditsCountElement.textContent = maxDobleCredits;
        }
        if (materiasCheckedCount) {
            materiasCheckedCount.textContent = totalCompletedMaterias + activeSelectedIds.size;
        }
        if (materiasTotalCount) {
            materiasTotalCount.textContent = maxTotalMaterias;
        }

        // 2. Renderizar Cajitas Terminadas
        renderFinishedCajitas();

        // 3. Renderizar Cajita Activa en Construcción
        renderActiveCajita(activeCajitaCredits, activeSelectedMaterias);

        // 4. Renderizar Pool de Materias Disponibles y No Disponibles
        renderPoolMaterias(lockedCodes);
    }

    // Renderizar cajitas finalizadas
    function renderFinishedCajitas() {
        if (!cajitasList) return;
        cajitasList.innerHTML = '';

        finishedDobleSemesters.forEach(sem => {
            const cajitaCard = document.createElement('div');
            cajitaCard.className = 'cajita-card';
            cajitaCard.dataset.semId = sem.semId;

            const chipsHtml = sem.materias.map(m => `
                <div class="cajita-materia-chip chip-${m.origen || 'ambas'}">
                    <span class="chip-name">${getMateriaName(m)}</span>
                    <span class="chip-meta">${m.creditos}cr</span>
                </div>
            `).join('');

            cajitaCard.innerHTML = `
                <div class="cajita-card-header">
                    <div class="cajita-card-title-group">
                        <h3>Semestre ${sem.semId}</h3>
                        <span class="cajita-cr-badge">${sem.creditos} cr</span>
                    </div>
                    <button class="cajita-delete-btn" title="Eliminar Semestre ${sem.semId} y posteriores">Eliminar</button>
                </div>
                <div class="cajita-chips-container">${chipsHtml}</div>
            `;

            cajitaCard.querySelector('.cajita-delete-btn').onclick = () => deleteDobleSemestersFrom(sem.semId);
            cajitasList.appendChild(cajitaCard);
        });
    }

    // Renderizar cajita en construcción
    function renderActiveCajita(activeCajitaCredits, activeSelectedMaterias) {
        if (!activeCajitaTitle) return;

        activeCajitaTitle.textContent = `Cajita Semestre ${currentDobleSemester}`;
        if (activeCajitaCreditsNum) activeCajitaCreditsNum.textContent = activeCajitaCredits;
        if (finishCajitaSub) finishCajitaSub.textContent = `Cerrar Semestre ${currentDobleSemester}`;
        if (finishCajitaBtn) finishCajitaBtn.disabled = activeSelectedIds.size === 0;
        if (clearCajitaBtn) clearCajitaBtn.style.display = activeSelectedIds.size > 0 ? 'inline-block' : 'none';

        if (activeCajitaMaterias) {
            activeCajitaMaterias.innerHTML = '';

            if (activeSelectedMaterias.length === 0) {
                activeCajitaMaterias.innerHTML = '<div class="cajita-empty-hint">👉 Selecciona materias de la lista de <strong>Materias Disponibles</strong> abajo para agregarlas a este semestre.</div>';
            } else {
                activeSelectedMaterias.forEach(m => {
                    const chip = document.createElement('div');
                    chip.className = `active-chip chip-${m.origen || 'ambas'}`;
                    chip.innerHTML = `
                        <span class="active-chip-name">${getMateriaName(m)}</span>
                        <span class="active-chip-cr">${m.creditos} cr</span>
                        <button class="active-chip-remove" title="Quitar de este semestre">×</button>
                    `;
                    chip.querySelector('.active-chip-remove').addEventListener('click', (e) => {
                        e.stopPropagation();
                        activeSelectedIds.delete(m.id);
                        renderDobleCarrera();
                    });
                    activeCajitaMaterias.appendChild(chip);
                });
            }
        }
    }

    // Renderizar pool de materias
    function renderPoolMaterias(lockedCodes) {
        if (!disponiblesList || !bloqueadasList) return;

        disponiblesList.innerHTML = '';
        bloqueadasList.innerHTML = '';

        let disponiblesCount = 0;
        let bloqueadasCount = 0;

        const query = currentSearchQuery.trim().toLowerCase();

        dobleMaterias.forEach(materia => {
            if (materia.locked_in_semester) return;
            if (currentPoolFilter !== 'all' && materia.origen !== currentPoolFilter) return;

            if (query) {
                const matchName = materia.nombre.toLowerCase().includes(query);
                const matchCode = materia.codigo && materia.codigo.toLowerCase().includes(query);
                if (!matchName && !matchCode) return;
            }

            const prereqStatus = checkPrerequisitesMet(materia, lockedCodes);
            const exclusionStatus = isMutuallyExcluded(materia, lockedCodes);
            const isAvailable = prereqStatus.isMet && !exclusionStatus.excluded;

            const card = document.createElement('div');
            card.className = 'pool-card';

            const isSelectedInActive = activeSelectedIds.has(materia.id);
            const origenTag = materia.origen === 'cdat' ? 'Ciencia de Datos' : (materia.origen === 'matem' ? 'Matemáticas' : 'Compartida');
            const codeLabel = materia.codigos_homologados?.length > 1
                ? materia.codigos_homologados.join(' / ')
                : (materia.codigo || '');

            card.innerHTML = `
                <div class="pool-card-cr">${materia.creditos}cr</div>
                <div class="pool-card-meta">
                    <span class="origen-badge origen-${materia.origen || 'ambas'}">${origenTag}</span>
                    ${codeLabel ? `<span class="pool-card-code">${codeLabel}</span>` : ''}
                </div>
                <div class="pool-card-title">${materia.nombre}</div>
            `;

            if (materia.variantes?.length > 1) {
                const variantContainer = document.createElement('div');
                variantContainer.className = 'variant-selector';

                materia.variantes.forEach(v => {
                    const btn = document.createElement('button');
                    btn.className = `variant-btn ${materia.selected_variante === v.codigo ? 'active' : ''}`;
                    btn.textContent = v.nombre;
                    btn.title = `Cursar como ${v.nombre} (${v.codigo})`;
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        materia.selected_variante = v.codigo;
                        materia.creditos = v.creditos;
                        renderDobleCarrera();
                    });
                    variantContainer.appendChild(btn);
                });
                card.appendChild(variantContainer);
            }

            if (isAvailable) {
                disponiblesCount++;
                card.classList.add('pool-card-available');

                if (isSelectedInActive) {
                    card.classList.add('selected');
                    const checkIcon = document.createElement('div');
                    checkIcon.className = 'selected-indicator';
                    checkIcon.innerHTML = '✓ Añadida al semestre';
                    card.appendChild(checkIcon);
                }

                card.addEventListener('click', () => {
                    if (activeSelectedIds.has(materia.id)) {
                        activeSelectedIds.delete(materia.id);
                    } else {
                        activeSelectedIds.add(materia.id);
                    }
                    renderDobleCarrera();
                });

                disponiblesList.appendChild(card);
            } else {
                bloqueadasCount++;
                card.classList.add('pool-card-locked');

                const lockedInfo = document.createElement('div');
                lockedInfo.className = 'pool-locked-info';

                if (exclusionStatus.excluded) {
                    const exclMsg = document.createElement('div');
                    exclMsg.className = 'missing-prereq-item excl-item';
                    exclMsg.innerHTML = `⚠️ ${exclusionStatus.reason}`;
                    lockedInfo.appendChild(exclMsg);
                }

                if (!prereqStatus.isMet && prereqStatus.missingPrereqs.length > 0) {
                    const prereqHeader = document.createElement('div');
                    prereqHeader.className = 'locked-reason-header';
                    prereqHeader.textContent = '🔒 Requiere cursar antes:';
                    lockedInfo.appendChild(prereqHeader);

                    prereqStatus.missingPrereqs.forEach(reqName => {
                        const item = document.createElement('div');
                        item.className = 'missing-prereq-item';
                        item.textContent = `• ${reqName}`;
                        lockedInfo.appendChild(item);
                    });
                }

                card.appendChild(lockedInfo);
                bloqueadasList.appendChild(card);
            }
        });

        if (disponiblesBadge) disponiblesBadge.textContent = disponiblesCount;
        if (bloqueadasBadge) bloqueadasBadge.textContent = bloqueadasCount;

        if (disponiblesCount === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'pool-empty-state';
            emptyMsg.textContent = query ? 'No hay materias disponibles que coincidan con la búsqueda.' : 'No tienes materias disponibles en este momento. Revisa tus semestres previos.';
            disponiblesList.appendChild(emptyMsg);
        }

        if (bloqueadasCount === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'pool-empty-state';
            emptyMsg.textContent = '¡Excelente! No tienes materias bloqueadas pendientes.';
            bloqueadasList.appendChild(emptyMsg);
        }
    }

    // Finalizar cajita activa y crear Semestre N
    if (finishCajitaBtn) {
        finishCajitaBtn.addEventListener('click', () => {
            if (activeSelectedIds.size === 0) return;

            const selectedMateriasList = [];
            let semCredits = 0;

            activeSelectedIds.forEach(id => {
                const m = dobleMaterias.find(item => item.id === id);
                if (m) {
                    m.locked_in_semester = currentDobleSemester;
                    m.status_checked = true;
                    semCredits += parseInt(m.creditos || 0);
                    selectedMateriasList.push(m);
                }
            });

            finishedDobleSemesters.push({
                semId: currentDobleSemester,
                creditos: semCredits,
                materias: selectedMateriasList
            });

            currentDobleSemester++;
            activeSelectedIds.clear();

            renderDobleCarrera();

            const activeCajitaEl = document.getElementById('active-cajita-container');
            if (activeCajitaEl) {
                activeCajitaEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }

    // Limpiar selección de la cajita activa
    if (clearCajitaBtn) {
        clearCajitaBtn.addEventListener('click', () => {
            activeSelectedIds.clear();
            renderDobleCarrera();
        });
    }

    // Eliminar semestre K y posteriores en Doble Carrera
    function deleteDobleSemestersFrom(startId) {
        dobleMaterias.forEach(m => {
            if (m.locked_in_semester && m.locked_in_semester >= startId) {
                m.locked_in_semester = false;
                m.status_checked = false;
            }
        });

        finishedDobleSemesters = finishedDobleSemesters.filter(sem => sem.semId < startId);
        currentDobleSemester = startId;
        activeSelectedIds.clear();

        renderDobleCarrera();
    }

    // Buscador en tiempo real
    if (materiaSearchInput) {
        materiaSearchInput.addEventListener('input', (e) => {
            currentSearchQuery = e.target.value;
            if (currentMode === 'doble') {
                renderDobleCarrera();
            }
        });
    }

    // Botones de filtro de origen
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPoolFilter = btn.dataset.filter || 'all';
            if (currentMode === 'doble') {
                renderDobleCarrera();
            }
        });
    });
});