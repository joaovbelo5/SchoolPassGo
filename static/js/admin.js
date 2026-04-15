// admin.js - Logic for Student Management and Acessos History

let students = [];
let appConfig = null;
const studentModal = new bootstrap.Modal(document.getElementById('studentModal'));
const barcodeModal = new bootstrap.Modal(document.getElementById('barcodeModal'));

let currentStream = null;

document.addEventListener('DOMContentLoaded', () => {
    loadStudents();

    document.getElementById('btnNewStudent').addEventListener('click', () => {
        document.getElementById('studentModalTitle').textContent = 'Cadastrar Aluno';
        document.getElementById('studentForm').reset();
        document.getElementById('alunoId').value = '';
        document.getElementById('alunoCodigo').value = '';
        document.getElementById('alunoTelefone').value = '';
        document.getElementById('alunoFotoBase64').value = '';
        togglePreview(false);
    });

    document.getElementById('btnSaveStudent').addEventListener('click', saveStudent);

    // Photo Upload handling with Resize/Compression
    document.getElementById('alunoFotoFile').addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const MAX_WIDTH = 600;
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    document.getElementById('alunoFotoBase64').value = dataUrl;
                    document.getElementById('photoPreview').src = dataUrl;
                    togglePreview(true);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('btnClearPhoto').addEventListener('click', () => {
        document.getElementById('alunoFotoFile').value = '';
        document.getElementById('alunoFotoBase64').value = '__EXCLUIR__';
        togglePreview(false);
    });

    // Webcam handling
    document.getElementById('btnStartWebcam').addEventListener('click', async () => {
        try {
            currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            const video = document.getElementById('webcamVideo');
            video.srcObject = currentStream;
            video.classList.remove('d-none');
            document.getElementById('btnStartWebcam').classList.add('d-none');
            document.getElementById('btnCaptureWebcam').classList.remove('d-none');
        } catch (err) {
            alert('Não foi possível acessar a câmera: ' + err.message);
        }
    });

    document.getElementById('btnCaptureWebcam').addEventListener('click', () => {
        const video = document.getElementById('webcamVideo');
        const canvas = document.getElementById('webcamCanvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        document.getElementById('alunoFotoBase64').value = dataUrl;
        document.getElementById('photoPreview').src = dataUrl;
        
        togglePreview(true);
        stopWebcam();
    });

    // Stop webcam if modal closes
    document.getElementById('studentModal').addEventListener('hidden.bs.modal', stopWebcam);
});

function togglePreview(show) {
    if (show) {
        document.getElementById('previewContainer').classList.remove('d-none');
    } else {
        document.getElementById('previewContainer').classList.add('d-none');
        document.getElementById('photoPreview').src = '';
    }
}

function stopWebcam() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
    document.getElementById('webcamVideo').classList.add('d-none');
    document.getElementById('btnStartWebcam').classList.remove('d-none');
    document.getElementById('btnCaptureWebcam').classList.add('d-none');
}

async function loadStudents() {
    setView('alunos');
    try {
        students = await api('/api/alunos');
        populateTurmaFilter();
        applyFilters();
    } catch (err) {
        showAlert(err.message, 'danger');
    }
}

function populateTurmaFilter() {
    const turmas = [...new Set(students.map(s => s.turma))].filter(t => t && t.trim() !== '').sort();
    const select = document.getElementById('filterTurma');
    const prevVal = select.value;
    select.innerHTML = '<option value="">Todas as Turmas...</option>';
    turmas.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        select.appendChild(opt);
    });
    select.value = prevVal; // Restore previous selection if it still exists
}

function applyFilters() {
    const searchVal = document.getElementById('searchStudent').value.toLowerCase();
    const turmaVal = document.getElementById('filterTurma').value;
    
    let filtered = students;

    if (searchVal) {
        filtered = filtered.filter(s => 
            (s.nome && s.nome.toLowerCase().includes(searchVal)) || 
            (s.codigo_barras && s.codigo_barras.includes(searchVal))
        );
    }

    if (turmaVal) {
        filtered = filtered.filter(s => s.turma === turmaVal);
    }

    // Performance protection: if no filters and too many students, limit to limit and show a notice
    const MAX_PREVIEW = 50;
    if (!searchVal && !turmaVal && filtered.length > MAX_PREVIEW) {
        const originalLength = filtered.length;
        filtered = filtered.slice(0, MAX_PREVIEW);
        renderStudents(filtered, originalLength);
    } else {
        renderStudents(filtered, 0);
    }
}

async function loadAcessos() {
    setView('acessos');
    try {
        const dataFiltro = document.getElementById('filterDataAcessos').value;
        const endpoint = dataFiltro ? `/api/acessos?data=${dataFiltro}` : '/api/acessos';
        const acessos = await api(endpoint);
        renderAcessos(acessos);
    } catch (err) {
        showAlert(err.message, 'danger');
    }
}

function showAlunosView() { setView('alunos'); }

function setView(view) {
    const tabAlunos = document.getElementById('tabBtnAlunos');
    const tabAcessos = document.getElementById('tabBtnAcessos');
    if (view === 'alunos') {
        document.getElementById('pageTitle').textContent = 'Gestão de Alunos';
        document.getElementById('btnNewStudent').classList.remove('d-none');
        document.getElementById('alunosTable').classList.remove('d-none');
        const filterSec = document.getElementById('alunosFilterSection'); if(filterSec) filterSec.classList.remove('d-none');
        const acessosSec = document.getElementById('acessosFilterSection'); if(acessosSec) acessosSec.classList.add('d-none');
        document.getElementById('acessosTable').classList.add('d-none');
        if(tabAlunos){ tabAlunos.className = 'btn-spg-primary'; }
        if(tabAcessos){ tabAcessos.className = 'btn-spg-ghost'; }
    } else {
        document.getElementById('pageTitle').textContent = 'Histórico de Acessos';
        document.getElementById('btnNewStudent').classList.add('d-none');
        document.getElementById('alunosTable').classList.add('d-none');
        const filterSec = document.getElementById('alunosFilterSection'); if(filterSec) filterSec.classList.add('d-none');
        const acessosSec = document.getElementById('acessosFilterSection'); if(acessosSec) acessosSec.classList.remove('d-none');
        document.getElementById('acessosTable').classList.remove('d-none');
        if(tabAlunos){ tabAlunos.className = 'btn-spg-ghost'; }
        if(tabAcessos){ tabAcessos.className = 'btn-spg-primary'; }
    }
}

function renderStudents(list, originalTotal = 0) {
    const tbody = document.getElementById('alunosList');
    tbody.innerHTML = '';
    
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Nenhum aluno listado. Verifique os filtros ou cadastre novos alunos.</td></tr>`;
        return;
    }

    list.forEach(aluno => {
        const tr = document.createElement('tr');
        const defaultPhoto = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20d%3D%22M12%2012c2.21%200%204-1.79%204-4s-1.79-4-4-4-4%201.79-4%204%201.79%204%204%204zm0%202c-2.67%200-8%201.34-8%204v2h16v-2c0-2.66-5.33-4-8-4z%22%20fill%3D%22%23ccc%22%2F%3E%3C%2Fsvg%3E';
        const fotoUrl = aluno.foto || defaultPhoto;
        
        tr.innerHTML = `
            <td class="ps-4"><img src="${fotoUrl}" onerror="this.src='${defaultPhoto}'" class="rounded-circle object-fit-cover shadow-sm border" width="45" height="45"></td>
            <td class="fw-semibold">${aluno.nome}</td>
            <td>${aluno.turma}</td>
            <td><span class="badge bg-light text-dark border">${aluno.turno}</span></td>
            <td><code>${aluno.codigo_barras}</code></td>
            <td class="text-end pe-4 text-nowrap">
                <button class="btn btn-sm btn-outline-success shadow-sm" onclick="registerAttendance('${aluno.codigo_barras}')" title="Registrar Presença"><i class="bi bi-check-circle"></i></button>
                <button class="btn btn-sm btn-outline-warning shadow-sm ms-1" onclick="editStudent(${aluno.id})" title="Editar"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger shadow-sm ms-1" onclick="abrirModalOcorrencias(${aluno.id}, '${aluno.nome.replace(/'/g, "\\'")}')" title="Ocorrências Disciplinares"><i class="bi bi-exclamation-triangle"></i></button>
                <button class="btn btn-sm btn-outline-info shadow-sm ms-1" onclick="showHistory(${aluno.id}, '${aluno.nome.replace(/'/g, "\\'")}')" title="Ver Histórico"><i class="bi bi-clock-history"></i></button>
                <button class="btn btn-sm btn-outline-primary shadow-sm ms-1" onclick="showBarcode(${aluno.id})" title="Ver Carteirinha"><i class="bi bi-upc-scan"></i></button>
                <button class="btn btn-sm btn-outline-secondary shadow-sm ms-1" onclick="deleteStudent(${aluno.id})" title="Excluir"><i class="bi bi-trash3"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (originalTotal > list.length) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="6" class="text-center py-3 text-secondary border-0 bg-light rounded-bottom" style="font-size: 13px;"><i class="bi bi-info-circle"></i> Existem mais ${originalTotal - list.length} alunos na base. Refine a pesquisa para localizá-los.</td>`;
        tbody.appendChild(tr);
    }
}

// Present students state
let estudantesPresentesMap = {};

function renderAcessos(list) {
    const tbody = document.getElementById('acessosList');
    tbody.innerHTML = '';

    processAcessosStats(list);
    
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">Nenhum acesso registrado.</td></tr>`;
        return;
    }

    list.forEach(acesso => {
        const tr = document.createElement('tr');
        const badgeCls = acesso.tipo === 'entrada' ? 'badge-green' : 'badge-blue';
        tr.innerHTML = `
            <td class="text-muted" style="font-size:.85rem">${formatDate(acesso.data_hora)}</td>
            <td class="fw-semibold">${acesso.aluno_nome}</td>
            <td>${acesso.aluno_turma} (${acesso.aluno_turno})</td>
            <td><span class="${badgeCls} text-uppercase">${acesso.tipo}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function processAcessosStats(list) {
    const btnShow = document.getElementById('btnShowPresentes');
    const container = document.getElementById('acessosTurnoStats');
    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = '';
        if (btnShow) btnShow.classList.add('d-none');
        return;
    }

    // Calcular stats
    let statsPorTurno = {};
    let trackingAlunos = {}; // aluno_id => { nome, turma, turno, entradas, saidas }

    list.forEach(a => {
        const t = a.aluno_turno || 'Desconhecido';
        if (!statsPorTurno[t]) statsPorTurno[t] = { entradas: 0, saidas: 0 };
        
        if (a.tipo === 'entrada') statsPorTurno[t].entradas++;
        if (a.tipo === 'saida') statsPorTurno[t].saidas++;

        if (!trackingAlunos[a.aluno_id]) {
            trackingAlunos[a.aluno_id] = {
                id: a.aluno_id,
                nome: a.aluno_nome,
                turma: a.aluno_turma || 'Sem Turma',
                turno: t,
                entradas: 0,
                saidas: 0
            };
        }
        if (a.tipo === 'entrada') trackingAlunos[a.aluno_id].entradas++;
        if (a.tipo === 'saida') trackingAlunos[a.aluno_id].saidas++;
    });

    // Reset list
    estudantesPresentesMap = {};
    let qtdPresentes = 0;

    Object.values(trackingAlunos).forEach(al => {
        // Aluno presente: tem ao menos 1 entrada e 0 saídas.
        if (al.entradas > 0 && al.saidas === 0) {
            qtdPresentes++;
            if (!estudantesPresentesMap[al.turma]) estudantesPresentesMap[al.turma] = [];
            estudantesPresentesMap[al.turma].push(al);
        }
    });

    // Mostrar os cartões por turno
    const coresTurno = {
        'Manhã': 'border-left: 3px solid #facc15',
        'Tarde': 'border-left: 3px solid #fb923c',
        'Noite': 'border-left: 3px solid #3b82f6',
        'Integral': 'border-left: 3px solid #8b5cf6'
    };

    let html = '';
    Object.keys(statsPorTurno).sort().forEach(turno => {
        const st = statsPorTurno[turno];
        const cxStyle = coresTurno[turno] || 'border-left: 3px solid #94a3b8';
        
        html += `
            <div class="col-auto mb-2">
                <div class="px-3 py-2 bg-white rounded-3 shadow-sm d-flex align-items-center gap-3" style="${cxStyle}; border:1px solid var(--gray-200)">
                    <div><small class="text-muted fw-bold text-uppercase" style="font-size:0.7rem">${turno}</small></div>
                    <div class="d-flex gap-3">
                        <div class="text-success fw-bold" style="font-size:0.9rem"><i class="bi bi-arrow-down-circle-fill me-1"></i> ${st.entradas} Entradas</div>
                        <div class="text-primary fw-bold" style="font-size:0.9rem"><i class="bi bi-arrow-up-circle-fill me-1"></i> ${st.saidas} Saídas</div>
                    </div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;

    // Controlar botão
    if (btnShow) {
        if (qtdPresentes > 0) {
            btnShow.classList.remove('d-none');
            btnShow.innerHTML = `<i class="bi bi-person-check-fill me-1 text-success"></i> ${qtdPresentes} Alunos Presentes`;
        } else {
            btnShow.classList.add('d-none');
        }
    }
}

let alunosPresentesModal = null;

function openAlunosPresentesModal() {
    if (!alunosPresentesModal) {
        alunosPresentesModal = new bootstrap.Modal(document.getElementById('alunosPresentesModal'));
    }

    const body = document.getElementById('alunosPresentesBody');
    body.innerHTML = '';

    const turmas = Object.keys(estudantesPresentesMap).sort();

    if (turmas.length === 0) {
        body.innerHTML = '<p class="text-center text-muted py-3">Nenhum aluno identificado.</p>';
        alunosPresentesModal.show();
        return;
    }

    let html = '';
    turmas.forEach(turma => {
        const alunos = estudantesPresentesMap[turma].sort((a, b) => a.nome.localeCompare(b.nome));
        html += `
            <div class="mb-4">
                <h6 class="border-bottom pb-2 fw-bold text-dark"><i class="bi bi-diagram-3-fill me-2 text-muted"></i>Turma: ${turma} <span class="badge bg-secondary ms-2">${alunos.length} alunos</span></h6>
                <div class="row g-2 mt-2">
        `;
        
        alunos.forEach(al => {
            html += `
                <div class="col-md-6 col-lg-4">
                    <div class="p-2 border rounded bg-white shadow-sm d-flex align-items-center gap-2">
                        <i class="bi bi-person-circle fs-3 text-secondary"></i>
                        <span class="fw-semibold text-truncate" style="font-size:0.85rem">${al.nome}</span>
                    </div>
                </div>
            `;
        });
        
        html += `</div></div>`;
    });

    body.innerHTML = html;
    alunosPresentesModal.show();
}

async function saveStudent() {
    const id = document.getElementById('alunoId').value;
    const nome = document.getElementById('alunoNome').value;
    const turma = document.getElementById('alunoTurma').value;
    const turno = document.getElementById('alunoTurno').value;
    const codigo_barras = document.getElementById('alunoCodigo').value;
    const telefone_responsavel = document.getElementById('alunoTelefone').value;
    const foto = document.getElementById('alunoFotoBase64').value;

    if (!nome) {
        alert('O nome do aluno é obrigatório.');
        return;
    }

    const btn = document.getElementById('btnSaveStudent');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Salvando...';

    try {
        if (id) {
            await api(`/api/alunos/${id}`, 'PUT', { nome, turma, turno, codigo_barras, telefone_responsavel, foto });
            showAlert('Aluno atualizado com sucesso!', 'success');
        } else {
            await api('/api/alunos', 'POST', { nome, turma, turno, codigo_barras, telefone_responsavel, foto });
            showAlert('Aluno cadastrado com sucesso!', 'success');
        }
        studentModal.hide();
        loadStudents();
    } catch (err) {
        showAlert(err.message, 'danger');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Salvar';
    }
}

function editStudent(id) {
    const aluno = students.find(s => s.id === id);
    if (!aluno) return;

    document.getElementById('studentModalTitle').textContent = 'Editar Aluno';
    document.getElementById('alunoId').value = aluno.id;
    document.getElementById('alunoNome').value = aluno.nome;
    document.getElementById('alunoTurma').value = aluno.turma;
    document.getElementById('alunoTurno').value = aluno.turno;
    document.getElementById('alunoCodigo').value = aluno.codigo_barras;
    document.getElementById('alunoTelefone').value = aluno.telefone_responsavel || '';
    
    document.getElementById('alunoFotoBase64').value = '';
    if (aluno.foto) {
        document.getElementById('photoPreview').src = aluno.foto;
        togglePreview(true);
    } else {
        togglePreview(false);
    }

    studentModal.show();
}

async function deleteStudent(id) {
    if (!confirm('Tem certeza que deseja excluir este aluno? Essa ação é irreversível.')) {
        return;
    }
    
    try {
        await api(`/api/alunos/${id}`, 'DELETE');
        showAlert('Aluno removido.', 'success');
        loadStudents();
    } catch (err) {
        showAlert(err.message, 'danger');
    }
}

async function showBarcode(id) {
    const aluno = students.find(s => s.id === id);
    if (!aluno) return;

    if (!appConfig) {
        appConfig = await api('/api/config').catch(()=>({}));
    }

    document.getElementById('cardFoto').src = aluno.foto || 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22100%22%20height%3D%22130%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20d%3D%22M12%2012c2.21%200%204-1.79%204-4s-1.79-4-4-4-4%201.79-4%204%201.79%204%204%204zm0%202c-2.67%200-8%201.34-8%204v2h16v-2c0-2.66-5.33-4-8-4z%22%20fill%3D%22%23ccc%22%2F%3E%3C%2Fsvg%3E';
    
    document.getElementById('cardAlunoNome').textContent = aluno.nome;
    document.getElementById('cardTurma').textContent = aluno.turma || '-';
    document.getElementById('cardTurno').textContent = aluno.turno || '-';
    document.getElementById('cardMatriculaText').textContent = aluno.codigo_barras;

    document.getElementById('cardEscolaNome').textContent = appConfig.nome_instituicao || 'NOME DA ESCOLA';
    document.getElementById('cardBackEscolaNome').textContent = appConfig.nome_instituicao || 'NOME DA ESCOLA';
    document.getElementById('cardEndereco').textContent = appConfig.endereco_instituicao || 'S/N';
    document.getElementById('cardTelefone').textContent = appConfig.telefone_instituicao || 'Sem Telefone';
    
    const logoEl = document.getElementById('cardLogo');
    if (appConfig.logo_instituicao) {
        logoEl.src = appConfig.logo_instituicao;
        logoEl.classList.remove('d-none');
    } else {
        logoEl.classList.add('d-none');
    }

    const assEl = document.getElementById('cardAssinatura');
    if (appConfig.assinatura_instituicao) {
        assEl.src = appConfig.assinatura_instituicao;
        assEl.classList.remove('d-none');
    } else {
        assEl.classList.add('d-none');
    }

    const now = new Date();
    document.getElementById('cardValidade').textContent = `VALIDADE: 31/12/${now.getFullYear()}`;
    const emissaoStr = now.toLocaleDateString('pt-BR');
    document.getElementById('cardEmissao').textContent = `Emitido em: ${emissaoStr}`;

    JsBarcode("#barcodeCanvas", aluno.codigo_barras, {
        format: "code128",
        lineColor: "#000",
        width: 1.5,
        height: 50,
        displayValue: true,
        fontSize: 12,
        margin: 0
    });
    
    barcodeModal.show();
}

async function registerAttendance(codigo_barras) {
    try {
        const resp = await api('/api/totem/registrar', 'POST', { codigo_barras });
        showAlert(`Presença registrada: ${resp.tipo.toUpperCase()} (${resp.aluno_nome})`, 'success');
    } catch (err) {
        showAlert(err.message, 'danger');
    }
}

let historyModalInstance = null;

async function showHistory(id, nome) {
    if (!historyModalInstance) {
        historyModalInstance = new bootstrap.Modal(document.getElementById('historyModal'));
    }
    
    const tbody = document.getElementById('studentHistoryList');
    tbody.innerHTML = `<tr><td colspan="2" class="text-center py-4"><span class="spinner-border spinner-border-sm text-primary"></span> Buscando...</td></tr>`;
    
    document.querySelector('#historyModal .modal-title').textContent = `Histórico - ${nome}`;
    historyModalInstance.show();

    try {
        const acessos = await api(`/api/alunos/${id}/acessos`);
        
        if (acessos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="2" class="text-center py-4 text-muted">Nenhum acesso registrado.</td></tr>`;
            return;
        }

        tbody.innerHTML = '';
        acessos.forEach(acesso => {
            const tr = document.createElement('tr');
            const badgeClass = acesso.tipo === 'entrada' ? 'bg-success' : 'bg-primary';
            tr.innerHTML = `
                <td class="ps-4 fw-medium text-muted">${formatDate(acesso.data_hora)}</td>
                <td><span class="badge ${badgeClass} text-uppercase">${acesso.tipo}</span></td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="2" class="text-center py-4 text-danger"><i class="bi bi-exclamation-triangle"></i> Erro: ${err.message}</td></tr>`;
    }
}

// --- Batch Print Logic ---
const batchPrintModalElement = document.getElementById('batchPrintModal');
let batchPrintModal = null;

function openBatchPrintModal() {
    if (!batchPrintModal && batchPrintModalElement) {
        batchPrintModal = new bootstrap.Modal(batchPrintModalElement);
    }
    if (!batchPrintModal) return;
    
    // extrai turmas unicas
    const turmas = [...new Set(students.map(s => s.turma))].filter(t => t && t.trim() !== '').sort();
    
    const select = document.getElementById('batchPrintTurma');
    select.innerHTML = '<option value="">Todas as Turmas (Atenção: muitas folhas)</option>';
    turmas.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        select.appendChild(opt);
    });

    batchPrintModal.show();
}

async function executeBatchPrint() {
    const selectedTurma = document.getElementById('batchPrintTurma').value;
    const onlyWithPhotos = document.getElementById('batchPrintFotoOnly').checked;

    let targetStudents = students;
    
    if (selectedTurma !== '') {
        targetStudents = targetStudents.filter(s => s.turma === selectedTurma);
    }
    
    if (onlyWithPhotos) {
        targetStudents = targetStudents.filter(s => s.foto && s.foto.length > 5);
    }

    if (targetStudents.length === 0) {
        alert('Nenhum aluno encontrado com esses filtros.');
        batchPrintModal.hide();
        return;
    }

    if (!appConfig) {
        appConfig = await api('/api/config').catch(()=>({}));
    }

    const container = document.getElementById('batchPrintArea');
    container.innerHTML = '';
    
    const templateNode = document.querySelector('#idCardPrintArea .id-card');
    const now = new Date();
    const emissaoStr = now.toLocaleDateString('pt-BR');
    const validadeStr = `VALIDADE: 31/12/${now.getFullYear()}`;

    const btn = document.querySelector('#batchPrintModal .btn-spg-primary');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Renderizando...';
    btn.disabled = true;

    const controlsArea = document.getElementById('batchPrintControlsArea');
    const progressArea = document.getElementById('batchPrintProgressArea');
    const errorMsg = document.getElementById('batchPrintErrorMsg');
    const progressBar = document.getElementById('batchPrintProgressBar');
    const progressText = document.getElementById('batchPrintProgressCount');

    // UI Feedback Start
    if (controlsArea) controlsArea.classList.add('d-none');
    if (progressArea) progressArea.classList.remove('d-none');
    if (errorMsg) errorMsg.classList.add('d-none');
    if (progressBar) progressBar.style.width = '0%';
    if (progressText) progressText.innerText = `0 / ${targetStudents.length}`;

    let loadedCount = 0;
    let errorCount = 0;
    let promises = [];

    setTimeout(() => {
        targetStudents.forEach(aluno => {
            const card = templateNode.cloneNode(true);
            const imgEl = card.querySelector('#cardFoto');
            
            imgEl.src = aluno.foto || 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22100%22%20height%3D%22130%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20d%3D%22M12%2012c2.21%200%204-1.79%204-4s-1.79-4-4-4-4%201.79-4%204%201.79%204%204%204zm0%202c-2.67%200-8%201.34-8%204v2h16v-2c0-2.66-5.33-4-8-4z%22%20fill%3D%22%23ccc%22%2F%3E%3C%2Fsvg%3E';
            card.querySelector('#cardAlunoNome').textContent = aluno.nome;
            card.querySelector('#cardTurma').textContent = aluno.turma || '-';
            card.querySelector('#cardTurno').textContent = aluno.turno || '-';
            card.querySelector('#cardMatriculaText').textContent = aluno.codigo_barras;

            card.querySelector('#cardEscolaNome').textContent = appConfig.nome_instituicao || 'NOME DA ESCOLA';
            card.querySelector('#cardBackEscolaNome').textContent = appConfig.nome_instituicao || 'NOME DA ESCOLA';
            card.querySelector('#cardEndereco').textContent = appConfig.endereco_instituicao || 'S/N';
            card.querySelector('#cardTelefone').textContent = appConfig.telefone_instituicao || 'Sem Telefone';
            
            const logoEl = card.querySelector('#cardLogo');
            if (appConfig.logo_instituicao) { logoEl.src = appConfig.logo_instituicao; logoEl.classList.remove('d-none'); }
            else { logoEl.classList.add('d-none'); }

            const assEl = card.querySelector('#cardAssinatura');
            if (appConfig.assinatura_instituicao) { assEl.src = appConfig.assinatura_instituicao; assEl.classList.remove('d-none'); }
            else { assEl.classList.add('d-none'); }

            card.querySelector('#cardValidade').textContent = validadeStr;
            card.querySelector('#cardEmissao').textContent = `Emitido em: ${emissaoStr}`;

            const canvas = card.querySelector('#barcodeCanvas');
            const uniqueId = `barcode_${aluno.id}`;
            canvas.id = uniqueId;

            container.appendChild(card);
            
            JsBarcode(`#${uniqueId}`, aluno.codigo_barras, {
                format: "code128",
                lineColor: "#000",
                width: 1.5,
                height: 50,
                displayValue: true,
                fontSize: 12,
                margin: 0
            });

            // Track image load
            const p = new Promise(resolve => {
                const checkDone = (success) => {
                    if (!success) errorCount++;
                    loadedCount++;
                    if (progressBar) progressBar.style.width = Math.round((loadedCount / targetStudents.length) * 100) + '%';
                    if (progressText) progressText.innerText = `${loadedCount} / ${targetStudents.length}`;
                    resolve();
                };
                if (imgEl.complete) {
                    checkDone(imgEl.naturalWidth !== 0);
                } else {
                    imgEl.onload = () => checkDone(true);
                    imgEl.onerror = () => checkDone(false);
                }
            });
            promises.push(p);
        });

        Promise.all(promises).then(() => {
            if (errorCount > 0) {
                if (errorMsg) errorMsg.classList.remove('d-none');
                btn.innerHTML = originalText;
                btn.disabled = false;
            } else {
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                    if (controlsArea) controlsArea.classList.remove('d-none');
                    if (progressArea) progressArea.classList.add('d-none');
                    
                    batchPrintModal.hide();
                    window.print();
                    setTimeout(() => { container.innerHTML = ''; }, 5000);
                }, 400); // UI breathing room
            }
        });
        
    }, 150);
}

// --- OCORRENCIAS ---
let ocorrenciaModal;
let ocorrenciaFormModal;
let historicoEdicaoModal;

let currentAlunoOcorrencias = [];
let currentAlunoID = 0;

async function abrirModalOcorrencias(alunoID, alunoNome) {
    currentAlunoID = alunoID;
    document.getElementById('ocorrenciaAlunoNome').textContent = 'Ocorrências de ' + alunoNome;
    document.getElementById('ocorrenciaAlunoID').value = alunoID;
    await fetchOcorrencias(alunoID);
    
    if(!ocorrenciaModal) ocorrenciaModal = new bootstrap.Modal(document.getElementById('ocorrenciaModal'));
    ocorrenciaModal.show();
}

async function fetchOcorrencias(alunoID) {
    try {
        const list = await api(`/api/alunos/${alunoID}/ocorrencias`);
        currentAlunoOcorrencias = list;
        renderOcorrencias(list);
    } catch(err) {
        showAlert('Erro ao buscar ocorrências: ' + err.message, 'danger');
    }
}

function renderOcorrencias(list) {
    const tbody = document.getElementById('ocorrenciasList');
    tbody.innerHTML = '';
    
    if(list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-3 text-muted">Nenhuma ocorrência disciplinar registrada.</td></tr>';
        return;
    }
    
    list.forEach(o => {
        let badge = 'bg-secondary';
        if(o.classificacao.includes('Verbal')) badge = 'bg-warning text-dark';
        if(o.classificacao.includes('Escrita')) badge = 'bg-danger';
        if(o.classificacao.includes('Suspensão')) badge = 'bg-dark';
        
        const dateStr = new Date(o.data_hora).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'});
        
        let histBtn = '';
        if(o.historico_edicao && o.historico_edicao.length > 2) {
            histBtn = `<button class="btn btn-sm btn-link text-info ms-1 p-0" title="Ver Edições Anteriores" onclick="verHistoricoEdicaoOcorrencia(${o.id})"><i class="bi bi-clock-history"></i></button>`;
        }
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-muted" style="font-size: 13px;">${dateStr}</td>
            <td><span class="badge ${badge}">${o.classificacao}</span><br><small class="text-muted" style="font-size: 11px;">${o.descricao}</small></td>
            <td><small>${o.registrado_por}</small></td>
            <td class="text-end text-nowrap">
                ${histBtn}
                <button class="btn btn-sm btn-outline-primary ms-1 shadow-sm" onclick="editarOcorrencia(${o.id})"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger ms-1 shadow-sm" onclick="excluirOcorrencia(${o.id})"><i class="bi bi-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function novaOcorrencia() {
    document.getElementById('ocorrenciaForm').reset();
    document.getElementById('ocorrenciaID').value = '';
    document.getElementById('ocorrenciaFormTitle').textContent = 'Nova Ocorrência';
    
    if(!ocorrenciaFormModal) ocorrenciaFormModal = new bootstrap.Modal(document.getElementById('ocorrenciaFormModal'));
    if(!ocorrenciaModal) ocorrenciaModal = new bootstrap.Modal(document.getElementById('ocorrenciaModal'));
    ocorrenciaModal.hide();
    ocorrenciaFormModal.show();
}

function editarOcorrencia(oID) {
    const o = currentAlunoOcorrencias.find(x => x.id === oID);
    if(!o) return;
    
    document.getElementById('ocorrenciaFormTitle').textContent = 'Editar Ocorrência';
    document.getElementById('ocorrenciaID').value = o.id;
    document.getElementById('ocClassificacao').value = o.classificacao;
    document.getElementById('ocDescricao').value = o.descricao;
    document.getElementById('ocAutor').value = o.registrado_por;
    
    if(!ocorrenciaFormModal) ocorrenciaFormModal = new bootstrap.Modal(document.getElementById('ocorrenciaFormModal'));
    if(!ocorrenciaModal) ocorrenciaModal = new bootstrap.Modal(document.getElementById('ocorrenciaModal'));
    ocorrenciaModal.hide();
    ocorrenciaFormModal.show();
}

async function salvarOcorrencia() {
    const req = {
        classificacao: document.getElementById('ocClassificacao').value,
        descricao: document.getElementById('ocDescricao').value,
        registrado_por: document.getElementById('ocAutor').value,
        enviar_telegram: document.getElementById('ocEnviarTelegram').checked
    };
    
    const oID = document.getElementById('ocorrenciaID').value;
    const alunoID = document.getElementById('ocorrenciaAlunoID').value;
    
    const btn = document.getElementById('btnSaveOcorrencia');
    btn.disabled = true;
    
    try {
        if(oID) {
            await api(`/api/ocorrencias/${oID}`, 'PUT', req);
        } else {
            await api(`/api/alunos/${alunoID}/ocorrencias`, 'POST', req);
        }
        
        ocorrenciaFormModal.hide();
        await fetchOcorrencias(alunoID);
        ocorrenciaModal.show();
    } catch(err) {
        alert('Erro ao salvar: ' + err.message);
    } finally {
        btn.disabled = false;
    }
}

async function excluirOcorrencia(oID) {
    if(!confirm('Deseja enviar esta ocorrência para a lixeira (Será apagada definitivamente em 30 dias)?')) return;
    
    try {
        await api(`/api/ocorrencias/${oID}`, 'DELETE');
        await fetchOcorrencias(currentAlunoID);
    } catch(err) {
        alert('Erro ao excluir: ' + err.message);
    }
}

function verHistoricoEdicaoOcorrencia(oID) {
    const o = currentAlunoOcorrencias.find(x => x.id === oID);
    if(!o || !o.historico_edicao) return;
    
    let hist = [];
    try { hist = JSON.parse(o.historico_edicao); } catch(e) {}
    
    const body = document.getElementById('historicoEdicaoBody');
    body.innerHTML = '';
    
    if(hist.length === 0) {
        body.innerHTML = '<p class="text-muted">Nenhum histórico de edição.</p>';
    } else {
        hist.forEach((h, idx) => {
            const dateF = new Date(h.data);
            const dtFinal = isNaN(dateF) ? h.data : dateF.toLocaleString('pt-BR');
            body.innerHTML += `
                <div class="mb-3 border-bottom pb-2">
                    <div class="fw-bold text-primary" style="font-size: 13px;">Alteração em ${dtFinal}</div>
                    <div class="small"><b>Classe Antiga:</b> ${h.classificacao}</div>
                    <div class="small text-muted border-start border-2 border-warning ps-2 mt-1">"${h.descricao}"</div>
                </div>
            `;
        });
    }
    
    if(!historicoEdicaoModal) historicoEdicaoModal = new bootstrap.Modal(document.getElementById('historicoEdicaoModal'));
    historicoEdicaoModal.show();
}

// ──── IMPORTAÇÃO DE ALUNOS (CSV/XLSX) ────

let importModal = null;
let importPreviewData = [];

function openImportModal() {
    if (!importModal) {
        importModal = new bootstrap.Modal(document.getElementById('importModal'));
    }
    resetImportModal();
    importModal.show();
}

function resetImportModal() {
    importPreviewData = [];
    document.getElementById('importDropZone').classList.remove('d-none');
    document.getElementById('importPreviewSection').classList.add('d-none');
    document.getElementById('importLoading').classList.add('d-none');
    document.getElementById('btnConfirmImport').classList.add('d-none');
    document.getElementById('importFileInput').value = '';
    document.getElementById('importPreviewBody').innerHTML = '';
    document.getElementById('importDuplicateToggle').classList.add('d-none');
    const dupCheck = document.getElementById('importIncludeDuplicates');
    if (dupCheck) dupCheck.checked = false;
}

// Setup drag-and-drop & file input events
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('importDropZone');
    const fileInput = document.getElementById('importFileInput');

    if (dropZone && fileInput) {
        dropZone.addEventListener('click', () => fileInput.click());

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--green-500)';
            dropZone.style.background = 'var(--green-50)';
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--gray-300)';
            dropZone.style.background = 'var(--gray-50)';
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--gray-300)';
            dropZone.style.background = 'var(--gray-50)';
            if (e.dataTransfer.files.length > 0) {
                handleImportFile(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                handleImportFile(fileInput.files[0]);
            }
        });

        // Duplicate toggle handler
        const dupToggle = document.getElementById('importIncludeDuplicates');
        if (dupToggle) {
            dupToggle.addEventListener('change', () => {
                renderImportPreview();
            });
        }
    }
});

async function handleImportFile(file) {
    const validExts = ['.csv', '.xlsx', '.xls'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExts.includes(ext)) {
        showAlert('Formato inválido. Use .csv ou .xlsx', 'danger');
        return;
    }

    // Show loading, hide drop zone
    document.getElementById('importDropZone').classList.add('d-none');
    document.getElementById('importLoading').classList.remove('d-none');

    const formData = new FormData();
    formData.append('arquivo', file);

    try {
        const resp = await fetch('/api/alunos/importar', {
            method: 'POST',
            body: formData
        });

        const data = await resp.json();

        if (!resp.ok) {
            throw new Error(data.error || 'Erro ao processar arquivo');
        }

        importPreviewData = data.alunos || [];

        document.getElementById('importLoading').classList.add('d-none');
        document.getElementById('importPreviewSection').classList.remove('d-none');
        document.getElementById('btnConfirmImport').classList.remove('d-none');

        renderImportPreview();
    } catch (err) {
        document.getElementById('importLoading').classList.add('d-none');
        document.getElementById('importDropZone').classList.remove('d-none');
        showAlert('Erro na importação: ' + err.message, 'danger');
    }
}

function renderImportPreview() {
    const tbody = document.getElementById('importPreviewBody');
    tbody.innerHTML = '';

    const includeDups = document.getElementById('importIncludeDuplicates').checked;
    const totalCount = importPreviewData.length;
    const dupCount = importPreviewData.filter(a => a.duplicado).length;

    // Update badges
    document.getElementById('importTotalBadge').textContent = `${totalCount} aluno(s) encontrado(s)`;

    const dupBadge = document.getElementById('importDupBadge');
    const dupToggle = document.getElementById('importDuplicateToggle');
    if (dupCount > 0) {
        dupBadge.textContent = `${dupCount} duplicado(s)`;
        dupBadge.classList.remove('d-none');
        dupToggle.classList.remove('d-none');
    } else {
        dupBadge.classList.add('d-none');
        dupToggle.classList.add('d-none');
    }

    importPreviewData.forEach((aluno, idx) => {
        const tr = document.createElement('tr');
        const isDup = aluno.duplicado;

        if (isDup) {
            tr.style.background = includeDups ? '#fff3cd' : '#f8f9fa';
            tr.style.opacity = includeDups ? '1' : '0.5';
        }

        const statusBadge = isDup
            ? `<span class="badge bg-warning text-dark"><i class="bi bi-exclamation-triangle-fill me-1"></i>Duplicado</span>`
            : `<span class="badge bg-success"><i class="bi bi-check-circle-fill me-1"></i>Novo</span>`;

        tr.innerHTML = `
            <td class="text-muted" style="font-size: .85rem">${aluno.linha}</td>
            <td class="fw-semibold">${escapeHtml(aluno.nome)}</td>
            <td>${escapeHtml(aluno.turma || '—')}</td>
            <td>${escapeHtml(aluno.turno || '—')}</td>
            <td class="text-center">${statusBadge}</td>
        `;
        tbody.appendChild(tr);
    });

    // Update confirm button count
    const toImport = includeDups ? totalCount : (totalCount - dupCount);
    const btn = document.getElementById('btnConfirmImport');
    btn.innerHTML = `<i class="bi bi-check-lg me-1"></i> Confirmar Importação (${toImport})`;
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

async function confirmImport() {
    const includeDups = document.getElementById('importIncludeDuplicates').checked;
    
    let toImport = importPreviewData;
    if (!includeDups) {
        toImport = toImport.filter(a => !a.duplicado);
    }

    if (toImport.length === 0) {
        showAlert('Nenhum aluno selecionado para importação.', 'warning');
        return;
    }

    const btn = document.getElementById('btnConfirmImport');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Importando...';

    try {
        const resp = await fetch('/api/alunos/importar/confirmar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                alunos: toImport.map(a => ({
                    nome: a.nome,
                    turma: a.turma,
                    turno: a.turno
                }))
            })
        });

        const data = await resp.json();

        if (!resp.ok) {
            throw new Error(data.error || 'Erro ao importar alunos');
        }

        showAlert(data.message, 'success');
        importModal.hide();
        loadStudents();
    } catch (err) {
        showAlert('Erro: ' + err.message, 'danger');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-check-lg me-1"></i> Confirmar Importação';
    }
}

