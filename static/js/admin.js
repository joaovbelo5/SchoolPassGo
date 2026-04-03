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
        document.getElementById('alunoFotoBase64').value = '';
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
        
        tr.innerHTML = `
            <td class="ps-4"><img src="${aluno.foto || defaultPhoto}" class="rounded-circle object-fit-cover shadow-sm border" width="45" height="45"></td>
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

function renderAcessos(list) {
    const tbody = document.getElementById('acessosList');
    tbody.innerHTML = '';
    
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
    
    document.getElementById('alunoFotoBase64').value = aluno.foto || '';
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
        displayValue: false,
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
        targetStudents = targetStudents.filter(s => s.foto && s.foto.length > 100);
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
    
    const templateNode = document.querySelector('#printArea .id-card');
    const now = new Date();
    const emissaoStr = now.toLocaleDateString('pt-BR');
    const validadeStr = `VALIDADE: 31/12/${now.getFullYear()}`;

    const btn = document.querySelector('#batchPrintModal .btn-spg-primary');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Gerando...';
    btn.disabled = true;

    setTimeout(() => {
        targetStudents.forEach(aluno => {
            const card = templateNode.cloneNode(true);
            card.querySelector('#cardFoto').src = aluno.foto || 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22100%22%20height%3D%22130%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20d%3D%22M12%2012c2.21%200%204-1.79%204-4s-1.79-4-4-4-4%201.79-4%204%201.79%204%204%204zm0%202c-2.67%200-8%201.34-8%204v2h16v-2c0-2.66-5.33-4-8-4z%22%20fill%3D%22%23ccc%22%2F%3E%3C%2Fsvg%3E';
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
                displayValue: false,
                margin: 0
            });
        });

        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
                batchPrintModal.hide();
                window.print();
                // Clear after print dialog is closed (usually wait a bit)
                setTimeout(() => { container.innerHTML = ''; }, 5000);
            });
        });
        
    }, 300);
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
