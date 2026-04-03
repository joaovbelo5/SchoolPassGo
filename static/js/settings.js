// settings.js - Settings Dashboard

let alterarSenhaModal;
let novoUsuarioModal;
let arquivamentoModal;

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Modals
    alterarSenhaModal = new bootstrap.Modal(document.getElementById('alterarSenhaModal'));
    novoUsuarioModal = new bootstrap.Modal(document.getElementById('novoUsuarioModal'));
    arquivamentoModal = new bootstrap.Modal(document.getElementById('arquivamentoModal'));
    
    // Load Students and Config
    loadUsuarios();
    loadConfig();

    // Event Listeners for Uploads
    setupUploadHandlers();

    // Main Save Button
    const btnSave = document.getElementById('btnSaveConfig');
    if (btnSave) {
        btnSave.addEventListener('click', salvarConfiguracoesAtuais);
    }

    // Backup & Restore Handlers
    setupBackupRestore();
});

async function loadConfig() {
    try {
        const config = await api('/api/config');
        if (config) {
            document.getElementById('configInstituicao').value = config.nome_instituicao || '';
            document.getElementById('configEndereco').value = config.endereco_instituicao || '';
            document.getElementById('configTelefone').value = config.telefone_instituicao || '';
            document.getElementById('configTelegramToken').value = config.telegram_bot_token || '';
            document.getElementById('configTempo').value = config.tempo_minimo_minutos || 5;
            
            if (config.logo_instituicao) {
                document.getElementById('b64Logo').value = config.logo_instituicao;
                document.getElementById('previewLogo').src = config.logo_instituicao;
            }
            if (config.assinatura_instituicao) {
                document.getElementById('b64Assinatura').value = config.assinatura_instituicao;
                const prev = document.getElementById('previewAssinatura');
                prev.src = config.assinatura_instituicao;
                prev.classList.remove('d-none');
                const ph = document.getElementById('assinaturaPlaceholder');
                if(ph) ph.classList.add('d-none');
            }
        }
    } catch (err) {
        showAlert('Erro ao carregar configurações: ' + err.message, 'danger');
    }
}

function setupUploadHandlers() {
    const uploadLogo = document.getElementById('uploadLogo');
    if (uploadLogo) {
        uploadLogo.addEventListener('change', function() {
            if (this.files[0]) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    document.getElementById('b64Logo').value = e.target.result;
                    document.getElementById('previewLogo').src = e.target.result;
                };
                reader.readAsDataURL(this.files[0]);
            }
        });
    }

    const uploadAssinatura = document.getElementById('uploadAssinatura');
    if (uploadAssinatura) {
        uploadAssinatura.addEventListener('change', function() {
            if (this.files[0]) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    document.getElementById('b64Assinatura').value = e.target.result;
                    const prev = document.getElementById('previewAssinatura');
                    prev.src = e.target.result;
                    prev.classList.remove('d-none');
                    const ph = document.getElementById('assinaturaPlaceholder');
                    if(ph) ph.classList.add('d-none');
                };
                reader.readAsDataURL(this.files[0]);
            }
        });
    }
}

async function salvarConfiguracoesAtuais() {
    const payload = {
        nome_instituicao: document.getElementById('configInstituicao').value,
        endereco_instituicao: document.getElementById('configEndereco').value,
        telefone_instituicao: document.getElementById('configTelefone').value,
        telegram_bot_token: document.getElementById('configTelegramToken').value,
        tempo_minimo_minutos: parseInt(document.getElementById('configTempo').value || 5),
        logo_instituicao: document.getElementById('b64Logo').value,
        assinatura_instituicao: document.getElementById('b64Assinatura').value
    };

    const btn = document.getElementById('btnSaveConfig');
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Salvando...';

    try {
        await api('/api/config', 'PUT', payload);
        showAlert('Configurações salvas com sucesso!', 'success');
        // If telegram token changed, maybe notify user they might need to restart if automated, 
        // but here the backend handles the restart of the bot typically.
    } catch (err) {
        showAlert('Erro ao salvar: ' + err.message, 'danger');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
}

// --- ARCHIVE ---

async function iniciarArquivamento() {
    const ano = document.getElementById('arquivoNome').value.trim();
    const conf = document.getElementById('arquivoConfirmacao').value.trim();
    
    if(!ano) return alert("Digite o ano letivo.");
    if(conf !== "CONFIRMAR DELEÇÃO") return alert("Palavra de confirmação incorreta!");

    if(!confirm("Atenção extrema: Todos os alunos atuais serão APAGADOS. Deseja continuar?")) return;

    const btn = document.getElementById('btnIniciarArk');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Arquivando...';

    try {
        await api('/api/arquivo/gerar', 'POST', {
            ano: ano,
            confirmacao: conf
        });
        alert("ANO LETIVO ARQUIVADO COM SUCESSO!\nO sistema foi limpo para o novo período.");
        window.location.reload();
    } catch(err) {
        alert("Erro ao arquivar: " + err.message);
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// --- BACKUP & RESTORE ---

function setupBackupRestore() {
    const inputFile = document.getElementById('inputRestoreFile');
    const fileInfo = document.getElementById('restoreFileInfo');
    const fileName = document.getElementById('restoreFileName');

    if (inputFile) {
        inputFile.addEventListener('change', () => {
            const f = inputFile.files[0];
            if (f) {
                fileName.textContent = f.name + ' (' + (f.size / 1024).toFixed(1) + ' KB)';
                fileInfo.classList.remove('d-none');
            } else {
                fileInfo.classList.add('d-none');
            }
        });
    }

    // The logic for actual restore is triggered via confirm callback or direct listener.
    // Let's add a button listener if we have a restore button, or handle it inside the change.
    // In our HTML, we have id="btnRestaurar" on the label. 
    // We'll add a helper to catch the click on the label if needed, or just use the input change as trigger.
    
    // We will implement a confirmation after selection.
    if (inputFile) {
        inputFile.addEventListener('change', () => {
            if (inputFile.files[0]) {
                setTimeout(confirmarRestore, 500); // Small delay to show info first
            }
        });
    }
}

async function fazerBackup() {
    const btn = document.getElementById('btnBackup');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Gerando...';
    
    try {
        window.location.href = '/api/backup';
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = original;
        }, 3000);
    } catch (e) {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

async function confirmarRestore() {
    const inputFile = document.getElementById('inputRestoreFile');
    const f = inputFile.files[0];
    if (!f) return;

    if (!confirm('⚠️ ATENÇÃO: Esta ação substituirá TODOS os dados atuais.\nDeseja continuar?')) {
        inputFile.value = '';
        document.getElementById('restoreFileInfo').classList.add('d-none');
        return;
    }

    const btn = document.getElementById('btnRestaurar');
    btn.style.pointerEvents = 'none';
    btn.style.opacity = '0.5';

    try {
        const formData = new FormData();
        formData.append('backup', f);

        const res = await fetch('/api/restaurar', {
            method: 'POST',
            body: formData
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || `Erro HTTP ${res.status}`);

        alert('✅ Sistema restaurado com sucesso!\nA página será recarregada.');
        window.location.reload();
    } catch (err) {
        alert('❌ Erro ao restaurar: ' + err.message);
        btn.style.pointerEvents = 'auto';
        btn.style.opacity = '1';
    }
}

// --- USER MANAGEMENT ---

async function loadUsuarios() {
    const tbody = document.getElementById('usuariosBody');
    if (!tbody) return;
    try {
        const users = await api('/api/usuarios');
        tbody.innerHTML = '';
        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-3 text-muted">Nenhum usuário cadastrado.</td></tr>';
            return;
        }
        users.forEach(u => {
            const criado = u.CriadoEm ? new Date(u.CriadoEm).toLocaleDateString('pt-BR') : '—';
            tbody.innerHTML += `
            <tr>
                <td class="ps-4"><code class="text-primary">${u.Username}</code></td>
                <td class="fw-semibold">${u.Nome}</td>
                <td class="text-muted small">${criado}</td>
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-outline-warning me-1 fw-bold" onclick="abrirAlterarSenha(${u.ID}, '${u.Username}')">
                        <i class="bi bi-key-fill"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger fw-bold" onclick="removerUsuario(${u.ID}, '${u.Username}')">
                        <i class="bi bi-trash3-fill"></i>
                    </button>
                </td>
            </tr>`;
        });
    } catch (err) {
        if(tbody) tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-3">${err.message}</td></tr>`;
    }
}

async function criarUsuario() {
    const nome = document.getElementById('nuNome').value.trim();
    const username = document.getElementById('nuUsername').value.trim();
    const password = document.getElementById('nuSenha').value;

    if (!nome || !username || !password) return alert('Preencha todos os campos.');
    if (password.length < 6) return alert('A senha deve ter no mínimo 6 caracteres.');

    try {
        await api('/api/usuarios', 'POST', { nome, username, password, papel: 'admin' });
        novoUsuarioModal.hide();
        document.getElementById('nuNome').value = '';
        document.getElementById('nuUsername').value = '';
        document.getElementById('nuSenha').value = '';
        showAlert('Usuário criado com sucesso!', 'success');
        loadUsuarios();
    } catch (err) {
        alert('Erro: ' + err.message);
    }
}

function abrirAlterarSenha(id, username) {
    document.getElementById('asUserId').value = id;
    document.getElementById('asUsername').textContent = username;
    document.getElementById('asSenha').value = '';
    alterarSenhaModal.show();
}

async function alterarSenha() {
    const id = document.getElementById('asUserId').value;
    const password = document.getElementById('asSenha').value;
    if (!password || password.length < 6) return alert('A senha deve ter no mínimo 6 caracteres.');

    try {
        await api(`/api/usuarios/${id}/senha`, 'PUT', { password });
        alterarSenhaModal.hide();
        showAlert('Senha atualizada com sucesso!', 'success');
    } catch (err) {
        alert('Erro: ' + err.message);
    }
}

async function removerUsuario(id, username) {
    if (!confirm(`Remover o usuário "${username}"?`)) return;
    try {
        await api(`/api/usuarios/${id}`, 'DELETE');
        showAlert(`Usuário ${username} removido.`, 'warning');
        loadUsuarios();
    } catch (err) {
        alert('Erro: ' + err.message);
    }
}

async function fazerLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
}
