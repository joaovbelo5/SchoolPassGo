// carometro.js

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const config = await api('/api/config');
        if (config && config.nome_instituicao) {
            document.getElementById('printEscola').textContent = config.nome_instituicao;
        }

        const turmas = await api('/api/turmas');
        
        const sel = document.getElementById('selectTurma');
        sel.innerHTML = '<option value="">Selecione uma turma...</option>';
        turmas.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            sel.appendChild(opt);
        });

    } catch (err) {
        alert('Erro ao inicializar carômetro: ' + err.message);
    }
});

async function buildAndPrint() {
    const turma = document.getElementById('selectTurma').value;
    if (!turma) {
        alert('Por favor, selecione uma turma primeiro.');
        return;
    }

    const showPlaceholder = document.getElementById('checkOmitirSemFoto').checked;
    const btn = document.getElementById('btnGerar');
    btn.disabled = true;

    try {
        const alunos = await api('/api/alunos');
        const filtered = alunos.filter(a => a.turma === turma);

        document.getElementById('printTurma').textContent = turma;
        document.getElementById('printDataHoje').textContent = new Date().toLocaleDateString('pt-BR');

        const grid = document.getElementById('printGrid');
        grid.innerHTML = '';

        const placeholderSVG = `data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22150%22%20height%3D%22200%22%20fill%3D%22%23ccc%22%20viewBox%3D%220%200%2016%2016%22%3E%3Cpath%20d%3D%22M3%2014s-1%200-1-1%201-4%206-4%206%203%206%204-1%201-1%201H3zm5-6a3%203%200%201%200%200-6%203%203%200%200%200%200%206z%22%2F%3E%3C%2Fsvg%3E`;

        let count = 0;

        filtered.forEach(a => {
            const fotoSrc = a.foto ? a.foto : placeholderSVG;
            
            if (!a.foto && !showPlaceholder) {
                return; // Skip students with no photo if disabled
            }

            count++;
            const card = document.createElement('div');
            card.className = 'student-card';
            card.innerHTML = `
                <img src="${fotoSrc}" class="student-photo" alt="Foto">
                <div class="student-name">${a.nome}</div>
                <div class="student-detail">${a.codigo_barras || ''}</div>
            `;
            grid.appendChild(card);
        });

        if (count === 0) {
            grid.innerHTML = '<p class="text-center" style="grid-column: 1 / -1; margin-top: 50px; font-style: italic;">Nenhum aluno encontrado ou todas as fotos ausentes.</p>';
        }

        setTimeout(() => {
            window.print();
        }, 500);

    } catch (err) {
        alert('Erro ao carregar dados: ' + err.message);
    } finally {
        btn.disabled = false;
    }
}
