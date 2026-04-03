// totem.js - Logic for the Totem Screen

document.addEventListener('DOMContentLoaded', async () => {
    const input = document.getElementById('barcodeInput');
    const inputSection = document.getElementById('inputSection');
    const title = document.getElementById('institutionName');
    
    let isProcessing = false;

    // Load configs
    try {
        const config = await api('/api/config');
        if (config && config.nome_instituicao) {
            title.textContent = config.nome_instituicao;
            document.title = "Totem - " + config.nome_instituicao;
        }
    } catch(e) {
        console.error('Failed to load institution name', e);
    }

    // Always keep focus on input
    input.focus();
    document.addEventListener('click', () => input.focus());

    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const barcode = input.value.trim();
            if (!barcode || isProcessing) return;
            
            isProcessing = true;
            input.value = ''; // clear immediately
            
            try {
                const result = await api('/api/totem/registrar', 'POST', { codigo_barras: barcode });
                showTotemResult(result.aluno, result.tipo, true);
            } catch (err) {
                showTotemError(err.message);
            } finally {
                setTimeout(() => { isProcessing = false; }, 500); // Small debounce
            }
        }
    });

    let timeoutId;

    function resetScreen() {
        document.getElementById('feedbackArea').classList.add('d-none');
        document.getElementById('studentName').textContent = '';
        input.readOnly = false;
        input.value = '';
        input.focus();
    }

    function showTotemResult(aluno, tipo, isSuccess) {
        clearTimeout(timeoutId);
        
        const area = document.getElementById('feedbackArea');
        area.classList.remove('d-none');
        
        document.getElementById('studentName').textContent = aluno.nome;
        document.getElementById('studentTurma').textContent = aluno.turma || '';
        document.getElementById('studentTurno').textContent = aluno.turno || '';
        
        const photoEl = document.getElementById('studentPhoto');
        if (aluno.foto) {
            photoEl.src = aluno.foto;
            photoEl.classList.remove('d-none');
        } else {
            photoEl.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22150%22%20height%3D%22150%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20d%3D%22M12%2012c2.21%200%204-1.79%204-4s-1.79-4-4-4-4%201.79-4%204%201.79%204%204%204zm0%202c-2.67%200-8%201.34-8%204v2h16v-2c0-2.66-5.33-4-8-4z%22%20fill%3D%22%23ccc%22%2F%3E%3C%2Fsvg%3E';
            photoEl.classList.remove('d-none');
        }

        const badge = document.getElementById('statusBadge');
        if (tipo === 'entrada') {
            badge.textContent = 'BEM-VINDO (ENTRADA)';
            badge.className = 'totem-badge-entrada';
        } else if (tipo === 'saida') {
            badge.textContent = 'AT\u00c9 LOGO (SA\u00cdDA)';
            badge.className = 'totem-badge-saida';
        }

        timeoutId = setTimeout(resetScreen, 4000);
    }

    function showTotemError(msg) {
        clearTimeout(timeoutId);
        
        const area = document.getElementById('feedbackArea');
        area.classList.remove('d-none');
        
        document.getElementById('studentName').textContent = 'C\u00f3digo n\u00e3o encontrado';
        document.getElementById('studentTurma').textContent = '';
        document.getElementById('studentTurno').textContent = '';
        
        const photoEl = document.getElementById('studentPhoto');
        photoEl.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22150%22%20height%3D%22150%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20d%3D%22M12%202C6.48%202%202%206.48%202%2012s4.48%2010%2010%2010%2010-4.48%2010-10S17.52%202%2012%202zm1%2015h-2v-2h2v2zm0-4h-2V7h2v6z%22%20fill%3D%22%23dc3545%22%2F%3E%3C%2Fsvg%3E';
        photoEl.classList.remove('d-none');
        
        const badge = document.getElementById('statusBadge');
        badge.textContent = msg;
        badge.className = 'badge-red w-100';

        timeoutId = setTimeout(resetScreen, 4000);
    }
});
