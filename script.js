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
        const materiasMap = new Map();
        for (const semestre in standardData) {
            standardData[semestre].forEach(materia => {
                if (materia.codigo) {
                    materiasMap.set(materia.codigo, materia);
                }
            });
        }

        for (const semestre in standardData) {
            standardData[semestre].forEach(materia => {
                if (materia.prerequisitos) {
                    const dependsOnCode = materia.prerequisitos.some(req => {
                        if (Array.isArray(req)) {
                            return req.includes(code);
                        }
                        return req === code;
                    });

                    if (dependsOnCode && materia.status_checked) {
                        const met = materia.prerequisitos.every(req => {
                            if (Array.isArray(req)) {
                                return req.some(reqCode => {
                                    const reqM = materiasMap.get(reqCode);
                                    return reqM && reqM.status_checked;
                                });
                            } else {
                                const reqM = materiasMap.get(req);
                                return reqM && reqM.status_checked;
                            }
                        });

                        if (!met) {
                            materia.status_checked = false;
                            materia.locked_in_semester = false;
                            if (materia.codigo) {
                                uncheckDependentsStandard(materia.codigo);
                            }
                        }
                    }
                }
            });
        }
    }

    function renderStandardPensum() {
        pensumContainer.innerHTML = '';
        let totalCredits = 0;
        let maxCredits = 0;

        const materiasMap = new Map();
        let hasOpt1Global = false;
        let hasOpt2Global = false;
        let optMateriaCredits = 0;

        for (const semestre in standardData) {
            standardData[semestre].forEach(materia => {
                if (materia.codigo) {
                    materiasMap.set(materia.codigo, materia);
                    if (materia.codigo === "033305") {
                        hasOpt1Global = true;
                        optMateriaCredits = parseInt(materia.creditos || 0);
                    }
                    if (materia.codigo === "033746") {
                        hasOpt2Global = true;
                    }
                }
                if (materia.status_checked && materia.creditos) {
                    totalCredits += parseInt(materia.creditos);
                }
                if (materia.creditos) {
                    maxCredits += parseInt(materia.creditos);
                }
            });
        }

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
                if (m.creditos) {
                    const creds = parseInt(m.creditos);
                    semestreTotalCredits += creds;
                    if (m.status_checked) {
                        semestreCheckedCredits += creds;
                    }
                }
            });

            if (hasOpt1 && hasOpt2) {
                const optMateria = materias.find(m => m.codigo === "033305");
                if (optMateria && optMateria.creditos) {
                    semestreTotalCredits -= parseInt(optMateria.creditos);
                }
            }

            const header = document.createElement('div');
            header.className = 'semestre-header';

            const title = document.createElement('div');
            title.className = 'semestre-title';
            title.textContent = semestreNombre;

            const creditsInfo = document.createElement('div');
            creditsInfo.className = 'semestre-credits';
            creditsInfo.textContent = `${semestreCheckedCredits} / ${semestreTotalCredits} cr`;

            header.appendChild(title);
            header.appendChild(creditsInfo);
            col.appendChild(header);

            materias.forEach(materia => {
                const card = document.createElement('div');
                card.className = 'materia-card';

                const isChecked = materia.status_checked;
                let isLocked = false;

                if (materia.prerequisitos && materia.prerequisitos.length > 0) {
                    const prereqsMet = materia.prerequisitos.every(req => {
                        if (Array.isArray(req)) {
                            return req.some(reqCode => {
                                const reqMateria = materiasMap.get(reqCode);
                                return reqMateria && reqMateria.locked_in_semester;
                            });
                        } else {
                            const reqMateria = materiasMap.get(req);
                            return reqMateria && reqMateria.locked_in_semester;
                        }
                    });
                    if (!prereqsMet) {
                        isLocked = true;
                    }
                }

                if (!isChecked) {
                    if (materia.codigo === "033305" && materiasMap.get("033746")?.status_checked) {
                        isLocked = true;
                    }
                    if (materia.codigo === "033746" && materiasMap.get("033305")?.status_checked) {
                        isLocked = true;
                    }
                }

                if (materia.locked_in_semester) {
                    card.classList.add('locked-semester');
                } else if (isChecked) {
                    card.classList.add('checked');
                } else if (isLocked) {
                    card.classList.add('locked');
                } else {
                    card.classList.add('available');
                }

                if (materia.creditos) {
                    const creditosBadge = document.createElement('div');
                    creditosBadge.className = 'materia-creditos';
                    creditosBadge.textContent = materia.creditos;
                    card.appendChild(creditosBadge);
                }

                const name = document.createElement('div');
                name.className = 'materia-name';
                name.textContent = materia.nombre;

                const code = document.createElement('div');
                code.className = 'materia-code';
                code.textContent = materia.codigo || '';

                const prereqs = document.createElement('div');
                prereqs.className = 'materia-prereqs';
                if (materia.prerequisitos && materia.prerequisitos.length > 0) {
                    const formattedPrereqs = materia.prerequisitos.map(req => {
                        if (Array.isArray(req)) {
                            return req.join(' ó ');
                        }
                        return req;
                    }).join(', ');
                    prereqs.textContent = 'Prereq: ' + formattedPrereqs;
                }

                card.appendChild(name);
                card.appendChild(code);
                card.appendChild(prereqs);

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
            for (const semestre in standardData) {
                standardData[semestre].forEach(materia => {
                    if (materia.locked_in_semester && materia.locked_in_semester >= startId) {
                        materia.locked_in_semester = false;
                        materia.status_checked = false;
                        if (materia.codigo) {
                            uncheckDependentsStandard(materia.codigo);
                        }
                    }
                });
            }
            addedSemestersCount = startId - 1;
            const blocks = semestersList.querySelectorAll('.semester-block');
            blocks.forEach(block => {
                if (parseInt(block.dataset.semId) >= startId) {
                    block.remove();
                }
            });
            renderStandardPensum();
        }

        addSemesterBtn.addEventListener('click', () => {
            const newlyLockedMaterias = [];
            let currentSemesterCredits = 0;

            for (const semestre in standardData) {
                standardData[semestre].forEach(materia => {
                    if (materia.status_checked && !materia.locked_in_semester) {
                        materia.locked_in_semester = addedSemestersCount + 1;
                        currentSemesterCredits += parseInt(materia.creditos || 0);
                        newlyLockedMaterias.push(materia);
                    }
                });
            }

            if (newlyLockedMaterias.length > 0) {
                addedSemestersCount++;
                const currentSemId = addedSemestersCount;

                const block = document.createElement('div');
                block.className = 'semester-block';
                block.dataset.semId = currentSemId;

                const headerDiv = document.createElement('div');
                headerDiv.className = 'semester-block-header';

                const title = document.createElement('h3');
                title.textContent = `Semestre ${currentSemId} (${currentSemesterCredits} cr)`;

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-semester-btn';
                deleteBtn.innerHTML = 'Eliminar';
                deleteBtn.title = 'Eliminar este semestre y los siguientes';
                deleteBtn.onclick = () => deleteSemestersFromStandard(currentSemId);

                headerDiv.appendChild(title);
                headerDiv.appendChild(deleteBtn);
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

    // Obtener mapa de códigos de materias cursadas en semestres cerrados
    function getLockedCodesMap() {
        const lockedCodes = new Set();
        dobleMaterias.forEach(m => {
            if (m.locked_in_semester && m.codigo) {
                lockedCodes.add(m.codigo);
            }
        });
        return lockedCodes;
    }

    // Verificar si una materia cumple prerequisitos
    function checkPrerequisitesMet(materia, lockedCodes) {
        if (!materia.prerequisitos || materia.prerequisitos.length === 0) {
            return { isMet: true, missingPrereqs: [] };
        }

        const missingPrereqs = [];

        materia.prerequisitos.forEach(req => {
            if (Array.isArray(req)) {
                const someMet = req.some(code => lockedCodes.has(code));
                if (!someMet) {
                    const names = req.map(code => {
                        const found = dobleMaterias.find(m => m.codigo === code);
                        return found ? `${found.nombre} (${code})` : code;
                    }).join(' ó ');
                    missingPrereqs.push(names);
                }
            } else {
                if (!lockedCodes.has(req)) {
                    const found = dobleMaterias.find(m => m.codigo === req);
                    missingPrereqs.push(found ? `${found.nombre} (${req})` : req);
                }
            }
        });

        return {
            isMet: missingPrereqs.length === 0,
            missingPrereqs
        };
    }

    // Comprobar exclusión mutua de optimización
    function isMutuallyExcluded(materia, lockedCodes) {
        if (materia.codigo === '033305') {
            const opt2Materia = dobleMaterias.find(m => m.codigo === '033746');
            if (opt2Materia && (opt2Materia.locked_in_semester || activeSelectedIds.has(opt2Materia.id))) {
                return { excluded: true, reason: 'Excluyente con Optimización lineal (033746)' };
            }
        }
        if (materia.codigo === '033746') {
            const opt1Materia = dobleMaterias.find(m => m.codigo === '033305');
            if (opt1Materia && (opt1Materia.locked_in_semester || activeSelectedIds.has(opt1Materia.id))) {
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
        const maxDobleCredits = 214;

        dobleMaterias.forEach(m => {
            if (m.locked_in_semester) {
                totalPlanCredits += parseInt(m.creditos || 0);
                totalCompletedMaterias++;
            }
        });

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
            materiasTotalCount.textContent = 68;
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

            const header = document.createElement('div');
            header.className = 'cajita-card-header';

            const titleGroup = document.createElement('div');
            titleGroup.className = 'cajita-card-title-group';

            const semTitle = document.createElement('h3');
            semTitle.textContent = `Semestre ${sem.semId}`;

            const crBadge = document.createElement('span');
            crBadge.className = 'cajita-cr-badge';
            crBadge.textContent = `${sem.creditos} cr`;

            titleGroup.appendChild(semTitle);
            titleGroup.appendChild(crBadge);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'cajita-delete-btn';
            deleteBtn.innerHTML = 'Eliminar';
            deleteBtn.title = `Eliminar Semestre ${sem.semId} y posteriores`;
            deleteBtn.addEventListener('click', () => deleteDobleSemestersFrom(sem.semId));

            header.appendChild(titleGroup);
            header.appendChild(deleteBtn);
            cajitaCard.appendChild(header);

            const chipsContainer = document.createElement('div');
            chipsContainer.className = 'cajita-chips-container';

            sem.materias.forEach(m => {
                const chip = document.createElement('div');
                chip.className = `cajita-materia-chip chip-${m.origen || 'ambas'}`;

                const chipName = document.createElement('span');
                chipName.className = 'chip-name';
                chipName.textContent = m.nombre;

                const chipMeta = document.createElement('span');
                chipMeta.className = 'chip-meta';
                chipMeta.textContent = `${m.creditos}cr`;

                chip.appendChild(chipName);
                chip.appendChild(chipMeta);
                chipsContainer.appendChild(chip);
            });

            cajitaCard.appendChild(chipsContainer);
            cajitasList.appendChild(cajitaCard);
        });
    }

    // Renderizar cajita en construcción
    function renderActiveCajita(activeCajitaCredits, activeSelectedMaterias) {
        if (!activeCajitaTitle) return;

        activeCajitaTitle.textContent = `Cajita Semestre ${currentDobleSemester}`;
        if (activeCajitaCreditsNum) {
            activeCajitaCreditsNum.textContent = activeCajitaCredits;
        }

        if (finishCajitaSub) {
            finishCajitaSub.textContent = `Cerrar Semestre ${currentDobleSemester}`;
        }

        if (finishCajitaBtn) {
            finishCajitaBtn.disabled = activeSelectedIds.size === 0;
        }
        if (clearCajitaBtn) {
            clearCajitaBtn.style.display = activeSelectedIds.size > 0 ? 'inline-block' : 'none';
        }

        if (activeCajitaMaterias) {
            activeCajitaMaterias.innerHTML = '';

            if (activeSelectedMaterias.length === 0) {
                const emptyHint = document.createElement('div');
                emptyHint.className = 'cajita-empty-hint';
                emptyHint.innerHTML = '👉 Selecciona materias de la lista de <strong>Materias Disponibles</strong> abajo para agregarlas a este semestre.';
                activeCajitaMaterias.appendChild(emptyHint);
            } else {
                activeSelectedMaterias.forEach(m => {
                    const chip = document.createElement('div');
                    chip.className = `active-chip chip-${m.origen || 'ambas'}`;

                    const chipName = document.createElement('span');
                    chipName.className = 'active-chip-name';
                    chipName.textContent = m.nombre;

                    const chipCr = document.createElement('span');
                    chipCr.className = 'active-chip-cr';
                    chipCr.textContent = `${m.creditos} cr`;

                    const removeBtn = document.createElement('button');
                    removeBtn.className = 'active-chip-remove';
                    removeBtn.innerHTML = '×';
                    removeBtn.title = 'Quitar de este semestre';
                    removeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        activeSelectedIds.delete(m.id);
                        renderDobleCarrera();
                    });

                    chip.appendChild(chipName);
                    chip.appendChild(chipCr);
                    chip.appendChild(removeBtn);
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
            if (materia.locked_in_semester) {
                return;
            }

            if (currentPoolFilter !== 'all' && materia.origen !== currentPoolFilter) {
                return;
            }

            if (query) {
                const matchName = materia.nombre.toLowerCase().includes(query);
                const matchCode = materia.codigo && materia.codigo.toLowerCase().includes(query);
                if (!matchName && !matchCode) {
                    return;
                }
            }

            const prereqStatus = checkPrerequisitesMet(materia, lockedCodes);
            const exclusionStatus = isMutuallyExcluded(materia, lockedCodes);

            const isAvailable = prereqStatus.isMet && !exclusionStatus.excluded;

            const card = document.createElement('div');
            card.className = 'pool-card';

            const isSelectedInActive = activeSelectedIds.has(materia.id);

            const crBadge = document.createElement('div');
            crBadge.className = 'pool-card-cr';
            crBadge.textContent = `${materia.creditos}cr`;
            card.appendChild(crBadge);

            const topMeta = document.createElement('div');
            topMeta.className = 'pool-card-meta';

            const tagOrigen = document.createElement('span');
            tagOrigen.className = `origen-badge origen-${materia.origen || 'ambas'}`;
            tagOrigen.textContent = materia.origen === 'cdat' ? 'Ciencia de Datos' : (materia.origen === 'matem' ? 'Matemáticas' : 'Compartida');
            topMeta.appendChild(tagOrigen);

            if (materia.codigo) {
                const codeBadge = document.createElement('span');
                codeBadge.className = 'pool-card-code';
                codeBadge.textContent = materia.codigo;
                topMeta.appendChild(codeBadge);
            }
            card.appendChild(topMeta);

            const nameEl = document.createElement('div');
            nameEl.className = 'pool-card-title';
            nameEl.textContent = materia.nombre;
            card.appendChild(nameEl);

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