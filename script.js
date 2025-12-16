document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('pensum-container');
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
        
        // Esto crea las materias segun el codigo y nombree
        const materiasMap = new Map();
        for (const semestre in data) {
            data[semestre].forEach(materia => {
                if (materia.codigo) {
                    materiasMap.set(materia.codigo, materia);
                }
            });
        }

        // Para q salga por semestres
        for (const [semestreNombre, materias] of Object.entries(data)) {
            const col = document.createElement('div');
            col.className = 'semestre-column';

            const title = document.createElement('div');
            title.className = 'semestre-title';
            title.textContent = semestreNombre;
            col.appendChild(title);

            materias.forEach(materia => {
                const card = document.createElement('div');
                card.className = 'materia-card';
                
                const isChecked = materia.status_checked;
                let isLocked = false;

                if (materia.prerequisitos && materia.prerequisitos.length > 0) {
                    const prereqsMet = materia.prerequisitos.every(reqCode => {
                        const reqMateria = materiasMap.get(reqCode);
                        return reqMateria && reqMateria.status_checked;
                    });
                    if (!prereqsMet) {
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
