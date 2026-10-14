document.addEventListener('DOMContentLoaded', () => {
    // Referencias a elementos comunes
    const creditsCountElement = document.getElementById('credits-count');
    const totalCreditsCountElement = document.getElementById('total-credits-count');
    const pensumContainer = document.getElementById('pensum-container');
    const addSemesterBtn = document.getElementById('add-semester-btn');
    const semestersList = document.getElementById('semesters-list');

    // Estado del pensum
    let standardData = {};
    let addedSemestersCount = 0;

    // Desmarcar en cascada materias dependientes cuando se desmarca un prerequisito
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
                        ? req.some(c => materiasMap.get(c)?.locked_in_semester)
                        : materiasMap.get(req)?.locked_in_semester
                );

                if (!met) {
                    materia.status_checked = false;
                    materia.locked_in_semester = false;
                    if (materia.codigo) uncheckDependentsStandard(materia.codigo);
                }
            }
        });
    }

    // Renderizar el tablero de los 8 semestres
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
                if (materia.linea) {
                    card.classList.add(`linea-${materia.linea}`);
                }

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
                    if (materia.codigo === "033305" && (materiasMap.get("033746")?.status_checked || materiasMap.get("033746")?.locked_in_semester)) isLocked = true;
                    if (materia.codigo === "033746" && (materiasMap.get("033305")?.status_checked || materiasMap.get("033305")?.locked_in_semester)) isLocked = true;
                }

                if (materia.locked_in_semester) card.classList.add('locked-semester');
                else if (isChecked) card.classList.add('checked');
                else if (isLocked) card.classList.add('locked');
                else card.classList.add('available');

                const formattedPrereqs = materia.prerequisitos?.length
                    ? 'PRE: ' + materia.prerequisitos.map(r => Array.isArray(r) ? r.join(' ó ') : r).join(', ')
                    : 'PRE: No tiene';

                card.innerHTML = `
                    ${materia.creditos ? `<div class="materia-creditos">${materia.creditos}</div>` : ''}
                    <div class="materia-name">${materia.nombre}</div>
                    <div class="materia-code">${materia.codigo ? 'ID ' + materia.codigo : ''}</div>
                    <div class="materia-prereqs">${formattedPrereqs}</div>
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

    // Planificador de semestres
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

    if (addSemesterBtn) {
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
                    listItem.textContent = `${m.codigo ? m.codigo + ' - ' : ''}${m.nombre} (${m.creditos} cr)`;
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

    // Cargar directamente el JSON de Ciencia de Datos
    fetch(`carreras/cdat.json?v=${Date.now()}`)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(jsonData => {
            standardData = jsonData;
            addedSemestersCount = 0;
            if (semestersList) semestersList.innerHTML = '';
            renderStandardPensum();
        })
        .catch(error => console.error('Error cargando el pensum de Ciencia de Datos:', error));
});