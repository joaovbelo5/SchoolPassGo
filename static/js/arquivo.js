// static/js/arquivo.js

let currentAno = '';
let alunosArq = [];
let dossierModal;

document.addEventListener('DOMContentLoaded', async () => {
    dossierModal = new bootstrap.Modal(document.getElementById('dossierModal'));
    
    // Config header via API
    try {
        const conf = await api('/api/config');
        if (conf.nome_instituicao) {
            document.getElementById('navTitulo').textContent = conf.nome_instituicao;
            document.getElementById('printSchoolName').textContent = conf.nome_instituicao;
        }
        if (conf.logo_instituicao) {
            document.getElementById('navLogo').src = conf.logo_instituicao;
            document.getElementById('navLogo').classList.remove('d-none');
        }
    } catch(e) {}

    await loadArquivosList();

    document.getElementById('btnLoadArk').addEventListener('click', () => {
        const val = document.getElementById('selectArquivo').value;
        if (!val) return alert("Selecione um banco de dados válido.");
        currentAno = val;
        loadAlunos(val);
    });
});

async function loadArquivosList() {
    const sel = document.getElementById('selectArquivo');
    try {
        const list = await api('/api/arquivos/list');
        sel.innerHTML = '<option value="">Selecione uma Cápsula...</option>';
        if (list && list.length > 0) {
            list.forEach(ano => {
                sel.innerHTML += `<option value="${ano}">${ano}</option>`;
            });
            sel.disabled = false;
        } else {
            sel.innerHTML = '<option value="">Nenhum arquivo encontrado</option>';
        }
    } catch(err) {
        sel.innerHTML = '<option value="">Erro de conexão</option>';
    }
}

async function loadAlunos(ano) {
    const tbody = document.getElementById('alunosList');
    const tableContainer = document.getElementById('tableContainer');
    const emptyState = document.getElementById('emptyState');
    
    const btn = document.getElementById('btnLoadArk');
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Lendo...';
    btn.disabled = true;

    try {
        alunosArq = await api(`/api/arquivos/${ano}/alunos`);
        
        emptyState.style.display = 'none';
        tableContainer.style.display = 'block';
        tbody.innerHTML = '';
        
        if (alunosArq.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Cápsula vazia. Sem registros de alunos.</td></tr>`;
            return;
        }

        alunosArq.forEach(al => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="ps-4"><img src="${al.foto || '/static/img/silhueta.jpg'}" class="rounded-circle object-fit-cover shadow-sm border" width="45" height="45"></td>
                <td class="fw-semibold text-dark">${al.nome}</td>
                <td><span class="badge border border-secondary text-secondary">${al.turma || '-'}</span></td>
                <td>${al.turno || '-'}</td>
                <td><code class="text-muted">${al.codigo_barras || 'N/A'}</code></td>
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-dark shadow-sm fw-bold" onclick="openDossier(${al.id})"><i class="bi bi-folder2-open me-1"></i> Abrir Ficha</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        alert("Erro ao ler banco de dados póstumo: " + err.message);
    } finally {
        btn.innerHTML = '<i class="bi bi-search"></i> Explorar';
        btn.disabled = false;
    }
}

async function openDossier(id) {
    const al = alunosArq.find(x => x.id === id);
    if(!al) return;

    document.getElementById('dosNome').textContent = al.nome;
    document.getElementById('dosFoto').src = al.foto || '/static/img/silhueta.jpg';
    document.getElementById('dosTurma').textContent = al.turma || '-';
    document.getElementById('dosTurno').textContent = al.turno || '-';
    document.getElementById('dosMatricula').textContent = al.codigo_barras || '-';
    document.getElementById('dosTelefone').textContent = al.telefone_responsavel || '-';
    
    document.getElementById('printCapsuleName').textContent = `Documento extraído de: Base ${currentAno}.db`;

    // Fetch accesses & occurrences
    try {
        const stats = await api(`/api/arquivos/${currentAno}/aluno/${id}`);
        
        const acTable = document.getElementById('dosAcessosList');
        document.getElementById('dosCountAcessos').textContent = stats.acessos.length;
        acTable.innerHTML = '';
        if(stats.acessos.length === 0) {
            acTable.innerHTML = '<tr><td class="text-center py-2 text-muted">Sem registros</td></tr>';
        } else {
            stats.acessos.forEach(ac => {
                const badge = ac.tipo === 'entrada' ? 'text-success' : 'text-primary';
                acTable.innerHTML += `<tr>
                    <td class="text-muted">${new Date(ac.data_hora).toLocaleString('pt-BR')}</td>
                    <td class="${badge} fw-bold text-end">${ac.tipo.toUpperCase()}</td>
                </tr>`;
            });
        }

        const ocTable = document.getElementById('dosOcorrenciasList');
        document.getElementById('dosCountOcorrencias').textContent = stats.ocorrencias.length;
        ocTable.innerHTML = '';
        if(stats.ocorrencias.length === 0) {
            ocTable.innerHTML = '<tr><td class="text-center py-2 text-muted">Ficha limpa</td></tr>';
        } else {
            stats.ocorrencias.forEach(oc => {
                ocTable.innerHTML += `<tr>
                    <td class="text-muted" style="width: 120px;">${new Date(oc.data_hora).toLocaleString('pt-BR')}</td>
                    <td>
                        <strong>${oc.classificacao}</strong><br>
                        <span class="text-muted">${oc.descricao}</span>
                    </td>
                    <td class="text-end" style="width: 100px;">Assinado por:<br><i>${oc.registrado_por}</i></td>
                </tr>`;
            });
        }

        dossierModal.show();
    } catch(err) {
        alert("Falha ao abrir dossiê: " + err.message);
    }
}
