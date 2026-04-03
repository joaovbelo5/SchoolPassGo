// chamada.js

document.addEventListener('DOMContentLoaded', async () => {
    // Current date
    const d = new Date();
    document.getElementById('selectMes').value = d.getMonth() + 1;
    document.getElementById('inputAno').value = d.getFullYear();

    // Fetch config and turmas
    try {
        const config = await api('/api/config');
        if (config && config.nome_instituicao) {
            document.getElementById('printEscola').textContent = config.nome_instituicao;
        }

        const alunos = await api('/api/alunos');
        const turmas = [...new Set(alunos.map(a => a.turma))].filter(t => t).sort();
        
        const sel = document.getElementById('selectTurma');
        sel.innerHTML = '<option value="">Selecione uma turma...</option>';
        turmas.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            sel.appendChild(opt);
        });

    } catch (err) {
        showAlert('Erro ao inicializar sistema. Verifique a conexão.', 'danger');
    }
});

const mesesNome = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

async function buildAndPrint() {
    const turma = document.getElementById('selectTurma').value;
    if (!turma) {
        alert('Selecione uma turma primeiro!'); 
        return;
    }
    
    const mes = parseInt(document.getElementById('selectMes').value);
    const ano = parseInt(document.getElementById('inputAno').value);
    const preencher = document.getElementById('checkPreencher').checked;
    
    const btn = document.getElementById('btnGerar');
    btn.disabled = true;

    try {
        const data = await api(`/api/relatorio/frequencia?turma=${encodeURIComponent(turma)}&mes=${mes}&ano=${ano}`);
        
        // ConfigTexts
        document.getElementById('printTurma').textContent = turma;
        document.getElementById('printMesAno').textContent = `${mesesNome[mes]} de ${ano}`;
        const today = new Date();
        document.getElementById('printDataHoje').textContent = today.toLocaleDateString('pt-BR');

        // Logic to build dynamic columns
        const diasNoMes = new Date(ano, mes, 0).getDate(); // Trick to get last day of the exact month

        const thead = document.getElementById('printTableHeader');
        thead.innerHTML = '<th class="td-name">NOME DO ALUNO</th>';
        
        for (let i = 1; i <= diasNoMes; i++) {
            const dateObj = new Date(ano, mes - 1, i);
            const isWeekend = (dateObj.getDay() === 0 || dateObj.getDay() === 6);
            const extraClass = isWeekend ? ' class="bg-weekend"' : '';
            thead.innerHTML += `<th${extraClass}>${i}</th>`;
        }
        thead.innerHTML += '<th>T</th>';

        // Build Rows representing students and ticks
        const tbody = document.getElementById('printTableBody');
        tbody.innerHTML = '';

        if (!data.alunos || data.alunos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${diasNoMes+2}">Nenhum aluno encontrado para esta turma.</td></tr>`;
        } else {
            data.alunos.forEach(aluno => {
                const tr = document.createElement('tr');
                let html = `<td class="td-name">${aluno.nome}</td>`;
                
                let total = 0;
                const setDias = new Set(aluno.dias || []);
                
                for (let i = 1; i <= diasNoMes; i++) {
                    const dateObj = new Date(ano, mes - 1, i);
                    const isWeekend = (dateObj.getDay() === 0 || dateObj.getDay() === 6);
                    const tdClass = isWeekend ? ' class="bg-weekend"' : '';
                    
                    let mark = '';
                    if (preencher && setDias.has(i)) {
                        mark = 'P';
                        total++;
                    }
                    html += `<td${tdClass}>${mark}</td>`;
                }
                
                const showTotal = preencher ? total : '0';
                html += `<td><strong>${showTotal}</strong></td>`;
                
                tr.innerHTML = html;
                tbody.appendChild(tr);
            });
        }

        setTimeout(() => {
            window.print();
        }, 500);

    } catch (err) {
        alert('Erro ao gerar relatório: ' + err.message);
    } finally {
        btn.disabled = false;
    }
}
