document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('pensum-container');
    const creditsCountElement = document.getElementById('credits-count');
    let data = {};

    // Cargar el JSON
    fetch('materias.json')
        .then(response => response.json())
        .then(jsonData => {
            data = jsonData;
            renderPensum();
        })
        .catch(error => console.error('Error cargando el JSON:', error));

    function uncheckDependents(code) {
        for (const semestre in data) {
            data[semestre].forEach(materia => {
                if (materia.prerequisitos && materia.prerequisitos.includes(code)) {
                    if (materia.status_checked) {
                        materia.status_checked = false;
                        if (materia.codigo) {
                            uncheckDependents(materia.codigo);
                        }
                    }
                }
            });
        }
    }

    function renderPensum() {
        container.innerHTML = '';
        let totalCredits = 0;
        
        // Esto crea las materias segun el codigo y nombree
        const materiasMap = new Map();
        for (const semestre in data) {
            data[semestre].forEach(materia => {
                if (materia.codigo) {
                    materiasMap.set(materia.codigo, materia);
                }
                if (materia.status_checked && materia.creditos) {
                    totalCredits += parseInt(materia.creditos);
                }
            });
        }

        // Actualizar contador global
        if (creditsCountElement) {
            creditsCountElement.textContent = totalCredits;
        }

        // Para q salga por semestres
        for (const [semestreNombre, materias] of Object.entries(data)) {
            const col = document.createElement('div');
            col.className = 'semestre-column';

            // Calcular creditos del semestre
            let semestreTotalCredits = 0;
            let semestreCheckedCredits = 0;
            
            // Verificar si existen las materias mutuamente excluyentes en este semestre
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

            // Si ambas existen, restar los créditos de una de ellas del total posible
            if (hasOpt1 && hasOpt2) {
                const optMateria = materias.find(m => m.codigo === "033305");
                if (optMateria && optMateria.creditos) {
                    semestreTotalCredits -= parseInt(optMateria.creditos);
                }
            }

            // Header del semestre
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

                // Verificar prerequisitos
                if (materia.prerequisitos && materia.prerequisitos.length > 0) {
                    const prereqsMet = materia.prerequisitos.every(reqCode => {
                        const reqMateria = materiasMap.get(reqCode);
                        return reqMateria && reqMateria.status_checked;
                    });
                    if (!prereqsMet) {
                        isLocked = true;
                    }
                }

                // Logica de exclusion mutua para Optimizacion
                // 033305: Temas de optimización lineal
                // 033746: Optimización lineal
                if (!isChecked) {
                    if (materia.codigo === "033305" && materiasMap.get("033746")?.status_checked) {
                        isLocked = true;
                    }
                    if (materia.codigo === "033746" && materiasMap.get("033305")?.status_checked) {
                        isLocked = true;
                    }
                }

                // Aplicar clases
                if (isChecked) {
                    card.classList.add('checked');
                } else if (isLocked) {
                    card.classList.add('locked');
                } else {
                    card.classList.add('available');
                }

                // Creditos en la tarjeta
                if (materia.creditos) {
                    const creditosBadge = document.createElement('div');
                    creditosBadge.className = 'materia-creditos';
                    creditosBadge.textContent = materia.creditos;
                    card.appendChild(creditosBadge);
                }

                // Contenido de la tarjeta
                const name = document.createElement('div');
                name.className = 'materia-name';
                name.textContent = materia.nombre;
                
                const code = document.createElement('div');
                code.className = 'materia-code';
                code.textContent = materia.codigo || '';

                const prereqs = document.createElement('div');
                prereqs.className = 'materia-prereqs';
                if (materia.prerequisitos && materia.prerequisitos.length > 0) {
                    prereqs.textContent = 'Prereq: ' + materia.prerequisitos.join(', ');
                }

                card.appendChild(name);
                card.appendChild(code);
                card.appendChild(prereqs);

                if (!isLocked || isChecked) {
                    card.addEventListener('click', () => {
                        materia.status_checked = !materia.status_checked;
                        
                        // Si se desmarcó una anterior el resto se desmarcan
                        if (!materia.status_checked && materia.codigo) {
                            uncheckDependents(materia.codigo);
                        }

                        renderPensum();
                    });
                }

                col.appendChild(card);
            });

            container.appendChild(col);
        }
    }
});